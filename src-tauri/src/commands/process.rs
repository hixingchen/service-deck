use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use tauri::{State, AppHandle};
use crate::AppState;
use crate::database::dao;
use crate::services::process_manager;
use crate::services::dependency;
use crate::{lock, log_debug, log_info, log_warn, log_error};

/// 上次全量重检测的时间戳（进程启动后单调递增秒数）
/// 用于控制重检测频率，避免每次轮询都执行 wmic
static LAST_REDETECT: AtomicU64 = AtomicU64::new(0);

/// 重检测间隔（秒）：无运行服务时 30 秒，有运行服务时 10 秒
const REDETECT_INTERVAL_IDLE: u64 = 30;
const REDETECT_INTERVAL_ACTIVE: u64 = 10;

#[tauri::command]
pub fn start_service(
    app: AppHandle,
    state: State<AppState>,
    service_name: String,
    command: Option<String>,
) -> Result<(), String> {
    log_info!("process", "正在启动服务: {}", service_name);

    let settings = lock!(state.settings).clone();

    let service = state.db.with_conn(|conn| {
        let all = dao::services::load_all(conn)?;
        all.into_values().find(|s| s.name == service_name)
            .ok_or(crate::error::AppError::NotFound("服务不存在".into()))
    }).map_err(|e| e.to_string())?;

    let mut service = service;
    if let Some(cmd) = command {
        service.command = cmd;
    }

    // 清理已退出的进程
    {
        let mut processes = lock!(state.processes);
        let to_remove: Vec<String> = processes.iter_mut()
            .filter_map(|(name, process)| {
                if let Ok(Some(_)) = process.try_wait() { Some(name.clone()) } else { None }
            })
            .collect();
        if !to_remove.is_empty() {
            log_info!("process", "清理已退出进程: {:?}", to_remove);
        }
        for name in to_remove { processes.remove(&name); }
    }

    // 移除 detected_pids，停止旧进程
    {
        lock!(state.detected_pids).remove(&service_name);
    }
    {
        let mut processes = lock!(state.processes);
        if let Some(mut process) = processes.remove(&service_name) {
            log_info!("process", "停止旧进程: {} (PID: {})", service_name, process.id());
            process_manager::kill_process_tree(process.id());
            let _ = process.wait();
        }
    }

    // 构建完整环境变量（程序配置 + 系统环境）
    let full_env: HashMap<String, String> = std::env::vars().collect();

    // 启动
    let child = process_manager::spawn_with_realtime_log(
        &app, &service, &service_name, &settings,
        &state.log_buffers, &state.log_viewers_active,
        &full_env,
    )?;
    log_info!("process", "服务启动成功: {} (PID: {})", service_name, child.id());

    lock!(state.processes).insert(service_name.clone(), child);

    // 自动启动文件监听
    if service.watch_mode != crate::WatchMode::Off {
        let watch_path = if service.watch_path.is_empty() { service.path.clone() } else { service.watch_path.clone() };
        let auto = service.watch_mode == crate::WatchMode::Auto;
        log_info!("process", "启动文件监听: {} (路径: {}, 自动重启: {})", service_name, watch_path, auto);
        let _ = crate::services::file_watcher::start_watcher(
            app, service_name, watch_path,
            service.watch_include, service.watch_exclude, auto,
        );
    }

    Ok(())
}

#[tauri::command]
pub fn stop_service(state: State<AppState>, service_name: String) -> Result<(), String> {
    log_info!("process", "正在停止服务: {}", service_name);

    {
        let mut processes = lock!(state.processes);
        if let Some(mut process) = processes.remove(&service_name) {
            log_info!("process", "终止进程: {} (PID: {})", service_name, process.id());
            process_manager::kill_process_tree(process.id());
            let _ = process.wait();
        }
    }
    {
        let mut detected = lock!(state.detected_pids);
        if let Some(pid) = detected.remove(&service_name) {
            log_info!("process", "终止检测到的进程: {} (PID: {})", service_name, pid);
            process_manager::kill_process_tree(pid);
        }
    }

    crate::services::file_watcher::stop_watcher(&state.watch_stop_signals, &service_name)?;

    lock!(state.log_buffers).remove(&service_name);
    log_info!("process", "服务已停止: {}", service_name);
    Ok(())
}

#[tauri::command]
pub fn restart_service(app: AppHandle, state: State<AppState>, service_name: String) -> Result<(), String> {
    log_info!("process", "正在重启服务: {}", service_name);

    {
        let mut processes = lock!(state.processes);
        let mut detected = lock!(state.detected_pids);
        detected.remove(&service_name);
        if let Some(mut process) = processes.remove(&service_name) {
            process_manager::kill_process_tree(process.id());
            let _ = process.wait();
        }
    }
    lock!(state.log_buffers).remove(&service_name);
    start_service(app, state, service_name, None)
}

#[tauri::command]
pub fn start_project(app: AppHandle, state: State<AppState>, project_id: String) -> Result<Vec<String>, String> {
    log_info!("process", "正在启动项目: {}", project_id);

    let settings = lock!(state.settings).clone();

    let (project, services) = state.db.with_conn(|conn| {
        let services = dao::services::load_all(conn)?;
        let projects = dao::projects::load_all(conn, &services)?;
        let project = projects.get(&project_id)
            .ok_or(crate::error::AppError::NotFound("项目不存在".into()))?
            .clone();
        Ok((project, services))
    }).map_err(|e: crate::error::AppError| e.to_string())?;

    log_info!("process", "项目: {}, 包含 {} 个服务", project.name, project.services.len());

    // 收集需要启动的服务 ID（短暂持锁）
    let start_ids: Vec<String> = {
        let processes = lock!(state.processes);
        let detected = lock!(state.detected_pids);
        project.services.iter()
            .filter(|svc| !processes.contains_key(&svc.name) && !detected.contains_key(&svc.name))
            .filter_map(|svc| services.values().find(|s| s.name == svc.name).map(|s| s.id.clone()))
            .collect()
    };

    let ordered_ids = dependency::resolve_order(&services, &start_ids);
    let mut started = Vec::new();
    let mut errors = Vec::new();

    // 构建完整环境变量（程序配置 + 系统环境）
    let full_env: HashMap<String, String> = std::env::vars().collect();

    for svc_id in &ordered_ids {
        let global_svc = match services.get(svc_id) {
            Some(s) => s,
            None => continue,
        };

        // 每次迭代短暂检查运行状态
        {
            let processes = lock!(state.processes);
            let detected = lock!(state.detected_pids);
            if processes.contains_key(&global_svc.name) || detected.contains_key(&global_svc.name) {
                log_debug!("process", "跳过已运行的服务: {}", global_svc.name);
                continue;
            }
            let deps_ok = global_svc.depends_on.iter().all(|dep_id| {
                services.get(dep_id).map_or(false, |dep| {
                    processes.contains_key(&dep.name) || detected.contains_key(&dep.name)
                })
            });
            if !deps_ok {
                log_warn!("process", "服务 {} 依赖未满足，跳过启动", global_svc.name);
                errors.push(format!("{}: 依赖服务未启动", global_svc.name));
                continue;
            }
        }

        // spawn 在锁外执行
        match process_manager::spawn_with_realtime_log(
            &app, global_svc, &global_svc.name, &settings,
            &state.log_buffers, &state.log_viewers_active,
            &full_env,
        ) {
            Ok(child) => {
                log_info!("process", "项目服务启动成功: {} (PID: {})", global_svc.name, child.id());
                lock!(state.processes).insert(global_svc.name.clone(), child);
                started.push(global_svc.name.clone());
            }
            Err(e) => {
                log_error!("process", "项目服务启动失败: {} - {}", global_svc.name, e);
                errors.push(format!("{}: {}", global_svc.name, e));
            }
        }
    }

    log_info!("process", "项目启动完成: {}, 成功: {}, 失败: {}", project.name, started.len(), errors.len());

    if errors.is_empty() { Ok(started) } else { Err(format!("部分启动失败: {}", errors.join("; "))) }
}

#[tauri::command]
pub fn stop_project(state: State<AppState>, project_id: String) -> Result<Vec<String>, String> {
    log_info!("process", "正在停止项目: {}", project_id);

    let services_map = state.db.with_conn(|conn| dao::services::load_all(conn))
        .map_err(|e| e.to_string())?;
    let project = state.db.with_conn(|conn| {
        let projects = dao::projects::load_all(conn, &services_map)?;
        projects.get(&project_id).cloned()
            .ok_or(crate::error::AppError::NotFound("项目不存在".into()))
    }).map_err(|e: crate::error::AppError| e.to_string())?;

    let mut processes = lock!(state.processes);
    let mut detected = lock!(state.detected_pids);
    let mut stopped = Vec::new();

    for svc in &project.services {
        if let Some(mut process) = processes.remove(&svc.name) {
            log_info!("process", "停止项目服务: {} (PID: {})", svc.name, process.id());
            process_manager::kill_process_tree(process.id());
            let _ = process.wait();
            stopped.push(svc.name.clone());
        }
        if let Some(pid) = detected.remove(&svc.name) {
            log_info!("process", "停止检测到的项目服务: {} (PID: {})", svc.name, pid);
            process_manager::kill_process_tree(pid);
            if !stopped.contains(&svc.name) { stopped.push(svc.name.clone()); }
        }
    }

    drop(processes);
    drop(detected);

    // 停止关联的文件监听器
    for name in &stopped {
        let _ = crate::services::file_watcher::stop_watcher(&state.watch_stop_signals, name);
    }

    let mut buffers = lock!(state.log_buffers);
    for name in &stopped { buffers.remove(name); }

    log_info!("process", "项目停止完成: {}, 停止了 {} 个服务", project.name, stopped.len());
    Ok(stopped)
}

#[tauri::command]
pub fn restart_project(app: AppHandle, state: State<AppState>, project_id: String) -> Result<Vec<String>, String> {
    log_info!("process", "正在重启项目: {}", project_id);

    let stopped = stop_project(state.clone(), project_id.clone())?;
    std::thread::sleep(std::time::Duration::from_millis(500));
    let started = start_project(app, state, project_id)?;

    let mut result = Vec::new();
    result.extend(stopped.iter().map(|s| format!("停止: {}", s)));
    result.extend(started.iter().map(|s| format!("启动: {}", s)));

    log_info!("process", "项目重启完成: 停止 {}, 启动 {}", stopped.len(), started.len());
    Ok(result)
}

#[tauri::command]
pub fn batch_start_services(app: AppHandle, state: State<AppState>, service_names: Vec<String>) -> Result<Vec<String>, String> {
    log_info!("process", "批量启动服务: {:?}", service_names);

    let settings = lock!(state.settings).clone();
    let services = state.db.with_conn(|conn| dao::services::load_all(conn))
        .map_err(|e| e.to_string())?;

    let mut started = Vec::new();
    let mut errors = Vec::new();

    // 构建完整环境变量
    let full_env: HashMap<String, String> = std::env::vars().collect();

    for name in &service_names {
        if lock!(state.processes).contains_key(name) {
            log_debug!("process", "跳过已运行的服务: {}", name);
            continue;
        }

        let service = match services.values().find(|s| s.name == *name) {
            Some(s) => s,
            None => {
                log_warn!("process", "服务不存在: {}", name);
                errors.push(format!("{}: 服务不存在", name));
                continue;
            }
        };
        match process_manager::spawn_with_realtime_log(
            &app, service, name, &settings, &state.log_buffers, &state.log_viewers_active,
            &full_env,
        ) {
            Ok(child) => {
                log_info!("process", "批量启动成功: {} (PID: {})", name, child.id());
                lock!(state.processes).insert(name.clone(), child);
                started.push(name.clone());
            }
            Err(e) => {
                log_error!("process", "批量启动失败: {} - {}", name, e);
                errors.push(format!("{}: {}", name, e));
            }
        }
    }

    log_info!("process", "批量启动完成: 成功 {}, 失败 {}", started.len(), errors.len());
    if errors.is_empty() { Ok(started) } else { Err(format!("部分启动失败: {}", errors.join("; "))) }
}

#[tauri::command]
pub fn batch_stop_services(state: State<AppState>, service_names: Vec<String>) -> Result<Vec<String>, String> {
    log_info!("process", "批量停止服务: {:?}", service_names);

    let mut processes = lock!(state.processes);
    let mut detected = lock!(state.detected_pids);
    let mut stopped = Vec::new();

    for name in &service_names {
        if let Some(mut process) = processes.remove(name) {
            log_info!("process", "停止服务: {} (PID: {})", name, process.id());
            process_manager::kill_process_tree(process.id());
            let _ = process.wait();
            stopped.push(name.clone());
        }
        if let Some(pid) = detected.remove(name) {
            log_info!("process", "停止检测到的服务: {} (PID: {})", name, pid);
            process_manager::kill_process_tree(pid);
            if !stopped.contains(name) { stopped.push(name.clone()); }
        }
    }

    drop(processes);
    drop(detected);

    // 停止关联的文件监听器
    for name in &stopped {
        let _ = crate::services::file_watcher::stop_watcher(&state.watch_stop_signals, name);
    }

    let mut buffers = lock!(state.log_buffers);
    for name in &stopped { buffers.remove(name); }

    log_info!("process", "批量停止完成: 停止了 {} 个服务", stopped.len());
    Ok(stopped)
}

#[tauri::command]
pub fn get_running_services(state: State<AppState>) -> Result<Vec<String>, String> {
    let mut processes = lock!(state.processes);
    let mut detected = lock!(state.detected_pids);
    let mut running = std::collections::HashSet::new();
    let mut exited = Vec::new();

    // 1. 检查通过本程序启动的进程
    for (name, process) in processes.iter_mut() {
        match process.try_wait() {
            Ok(Some(_)) => {
                // try_wait 确认进程已退出，直接信任，不再用 is_pid_alive 二次检查
                // 避免 PID 被其他进程复用导致误判
                exited.push(name.clone());
            }
            Ok(None) => { running.insert(name.clone()); }
            Err(_) => { exited.push(name.clone()); }
        }
    }

    // 从 processes 中移除已退出的条目
    for name in &exited { processes.remove(name); }

    // 2. 检查外部检测到的进程
    let mut to_remove = Vec::new();
    for (name, pid) in detected.iter() {
        // 如果同名服务已在 processes 中管理，移除 detected 冗余条目
        if processes.contains_key(name) {
            to_remove.push(name.clone());
            continue;
        }
        if process_manager::is_pid_alive(*pid) {
            running.insert(name.clone());
        } else {
            to_remove.push(name.clone());
        }
    }
    for name in to_remove { detected.remove(&name); }

    // 3. 定期全量重检测（捕获外部手动启动的服务）
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let last = LAST_REDETECT.load(Ordering::Relaxed);
    let interval = if running.is_empty() { REDETECT_INTERVAL_IDLE } else { REDETECT_INTERVAL_ACTIVE };

    if now.saturating_sub(last) >= interval {
        LAST_REDETECT.store(now, Ordering::Relaxed);

        // 在锁内短暂释放后重新获取，避免长时间持锁执行 wmic
        drop(processes);
        drop(detected);

        let services = state.db.with_conn(|conn| {
            dao::services::load_all(conn)
        }).unwrap_or_default();

        let new_detected = process_manager::detect_running_by_command(&services);

        let processes = lock!(state.processes);
        let mut detected = lock!(state.detected_pids);

        // 合并重检测结果
        for (name, pid) in &new_detected {
            // 跳过已被本程序管理的服务
            if processes.contains_key(name) { continue; }

            if let Some(existing_pid) = detected.get(name) {
                // PID 未变化，跳过
                if *existing_pid == *pid { continue; }
                // PID 变化且新 PID 存活，更新
                if process_manager::is_pid_alive(*pid) {
                    log_info!("detect", "更新检测到的服务: {} (PID: {} → {})", name, existing_pid, pid);
                    detected.insert(name.clone(), *pid);
                }
            } else {
                // 新检测到的服务
                if process_manager::is_pid_alive(*pid) {
                    log_info!("detect", "新检测到服务: {} (PID: {})", name, pid);
                    detected.insert(name.clone(), *pid);
                }
            }
        }

        // 清理重检测中未出现但 detected 中仍存在的条目
        // （仅当该服务不在 processes 中时才清理）
        let stale: Vec<String> = detected.keys()
            .filter(|name| !new_detected.contains_key(*name) && !processes.contains_key(*name))
            .cloned()
            .collect();
        for name in stale {
            if let Some(pid) = detected.remove(&name) {
                log_info!("detect", "清除失效检测: {} (PID: {})", name, pid);
            }
        }

        running.clear();
        running.extend(processes.keys().cloned());
        running.extend(detected.keys().cloned());
    }

    Ok(running.into_iter().collect())
}
