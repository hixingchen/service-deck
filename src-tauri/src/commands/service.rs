use std::collections::HashMap;
use tauri::{State, AppHandle};
use crate::AppState;
use crate::config::{default_watch_include, default_watch_exclude};
use crate::database::dao;
use crate::services::file_watcher;
use crate::{Service, WatchMode};
use crate::lock;
use crate::log_info;

#[tauri::command]
pub fn get_services(state: State<AppState>) -> Result<Vec<Service>, String> {
    state.db.with_conn(|conn| {
        let mut services: Vec<Service> = dao::services::load_all(conn)?.into_values().collect();
        services.sort_by(|a, b| a.sort_index.cmp(&b.sort_index));
        Ok(services)
    }).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_service(
    state: State<AppState>,
    name: String,
    command: String,
    path: String,
    env_vars: HashMap<String, String>,
    log_path: String,
    service_type: Option<String>,
    depends_on: Option<Vec<String>>,
    health_check_url: Option<String>,
    runtime_versions: Option<HashMap<String, String>>,
    env_groups: Option<Vec<crate::EnvGroup>>,
) -> Result<Service, String> {
    if name.trim().is_empty() { return Err("服务名称不能为空".into()); }
    if command.trim().is_empty() { return Err("启动命令不能为空".into()); }

    state.db.with_conn(|conn| {
        // 检查名称唯一性
        let existing = dao::services::load_all(conn)?;
        if existing.values().any(|s| s.name == name.trim()) {
            return Err(crate::error::AppError::InvalidInput("服务名称已存在".into()));
        }

        let id = uuid::Uuid::new_v4().to_string();
        let max_sort = existing.values().map(|s| s.sort_index).max().unwrap_or(-1);
        let service = Service {
            id: id.clone(),
            name,
            command,
            path,
            sort_index: max_sort + 1,
            env_vars,
            log_path,
            service_type: service_type.unwrap_or_else(|| "normal".into()),
            depends_on: depends_on.unwrap_or_default(),
            health_check_url: health_check_url.unwrap_or_default(),
            health_check_interval: 0,
            favorite: false,
            watch_mode: WatchMode::Off,
            watch_path: String::new(),
            watch_include: default_watch_include(),
            watch_exclude: default_watch_exclude(),
            runtime_versions: runtime_versions.unwrap_or_default(),
            env_groups: env_groups.unwrap_or_default(),
        };
        dao::services::save(conn, &service)?;
        Ok(service)
    }).map_err(|e: crate::error::AppError| e.to_string())
}

#[tauri::command]
pub fn update_service(
    app: AppHandle,
    state: State<AppState>,
    id: String,
    name: String,
    command: String,
    path: String,
    env_vars: HashMap<String, String>,
    log_path: Option<String>,
    service_type: Option<String>,
    depends_on: Option<Vec<String>>,
    health_check_url: Option<String>,
    watch_mode: Option<String>,
    watch_path: Option<String>,
    watch_include: Option<Vec<String>>,
    watch_exclude: Option<Vec<String>>,
    runtime_versions: Option<HashMap<String, String>>,
    env_groups: Option<Vec<crate::EnvGroup>>,
) -> Result<(), String> {
    if name.trim().is_empty() { return Err("服务名称不能为空".into()); }
    if command.trim().is_empty() { return Err("启动命令不能为空".into()); }

    let service = state.db.with_conn(|conn| {
        let mut service = dao::services::get_by_id(conn, &id)?
            .ok_or(crate::error::AppError::NotFound("服务不存在".into()))?;

        service.name = name;
        service.command = command;
        service.path = path;
        service.env_vars = env_vars;
        service.log_path = log_path.unwrap_or_default();
        if let Some(st) = service_type { service.service_type = st; }
        if let Some(dep) = depends_on { service.depends_on = dep; }
        if let Some(hcu) = health_check_url { service.health_check_url = hcu; }
        if let Some(wm) = watch_mode {
            service.watch_mode = match wm.as_str() {
                "auto" => WatchMode::Auto,
                "confirm" => WatchMode::Confirm,
                _ => WatchMode::Off,
            };
        }
        if let Some(wp) = watch_path { service.watch_path = wp; }
        if let Some(wi) = watch_include { service.watch_include = wi; }
        if let Some(we) = watch_exclude { service.watch_exclude = we; }
        if let Some(rv) = runtime_versions { service.runtime_versions = rv; }
        if let Some(eg) = env_groups { service.env_groups = eg; }

        dao::services::save(conn, &service)?;
        Ok(service)
    }).map_err(|e: crate::error::AppError| e.to_string())?;

    // 如果监听配置发生变化，重启 watcher
    if service.watch_mode != WatchMode::Off {
        let _ = file_watcher::stop_watcher(&state.watch_stop_signals, &service.name);
        let watch_path = if service.watch_path.is_empty() { service.path.clone() } else { service.watch_path.clone() };
        let auto = service.watch_mode == WatchMode::Auto;
        log_info!("service", "重启文件监听: {} (路径: {}, 自动重启: {})", service.name, watch_path, auto);
        let _ = file_watcher::start_watcher(
            app, service.name.clone(), watch_path,
            service.watch_include.clone(), service.watch_exclude.clone(), auto,
        );
    } else {
        // 监听关闭时，停止已有的 watcher
        let _ = file_watcher::stop_watcher(&state.watch_stop_signals, &service.name);
    }

    Ok(())
}

#[tauri::command]
pub fn delete_service(state: State<AppState>, id: String) -> Result<(), String> {
    state.db.with_conn(|conn| {
        let service = dao::services::get_by_id(conn, &id)?
            .ok_or(crate::error::AppError::NotFound("服务不存在".into()))?;

        // 停止进程
        let mut processes = lock!(state.processes);
        if let Some(mut process) = processes.remove(&service.name) {
            crate::services::process_manager::kill_process_tree(process.id());
            let _ = process.wait();
        }
        drop(processes);

        // 清理全局 HashMap 中的对应条目
        if let Ok(mut buffers) = state.log_buffers.lock() {
            buffers.remove(&service.name);
        }
        if let Ok(mut viewers) = state.log_viewers_active.lock() {
            viewers.remove(&service.name);
        }
        if let Ok(mut signals) = state.watch_stop_signals.lock() {
            if let Some(signal) = signals.remove(&service.name) {
                if let Ok(mut should_stop) = signal.lock() {
                    *should_stop = true;
                }
            }
        }

        dao::services::delete(conn, &id)?;
        Ok(())
    }).map_err(|e: crate::error::AppError| e.to_string())
}

#[tauri::command]
pub fn update_service_sort(state: State<AppState>, updates: Vec<(String, i32)>) -> Result<(), String> {
    state.db.with_conn(|conn| dao::services::update_sort(conn, &updates))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn toggle_service_favorite(state: State<AppState>, id: String) -> Result<bool, String> {
    state.db.with_conn(|conn| dao::services::toggle_favorite(conn, &id))
        .map_err(|e| e.to_string())
}
