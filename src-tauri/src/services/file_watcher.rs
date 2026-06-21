use std::collections::HashMap;
use std::path::Path;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager};

use crate::AppState;
use crate::events;
use crate::lock;
use crate::lock_or_panic;
use crate::{log_debug, log_info, log_warn, log_error};

/// 文件监听事件队列最大容量
const WATCH_EVENTS_MAX: usize = 500;

/// 文件监听事件
#[derive(Debug, Clone)]
pub struct WatchEvent {
    pub service_name: String,
    pub path: String,
    pub timestamp: Instant,
}

/// 简易通配符匹配（支持 `*` 匹配任意字符）
fn wildcard_match(pattern: &str, text: &str) -> bool {
    let pattern = pattern.to_lowercase();
    let text = text.to_lowercase();

    // 无通配符时精确匹配
    if !pattern.contains('*') {
        return pattern == text;
    }

    // 按 * 分割 pattern，逐段匹配
    let parts: Vec<&str> = pattern.split('*').collect();
    if parts.is_empty() { return true; }

    let mut pos = 0;
    for (i, part) in parts.iter().enumerate() {
        if part.is_empty() { continue; }

        if i == 0 {
            // 第一段必须从开头匹配
            if !text[pos..].starts_with(part) { return false; }
            pos += part.len();
        } else if i == parts.len() - 1 {
            // 最后一段必须从结尾匹配
            return text[pos..].ends_with(part);
        } else {
            // 中间段找最近匹配
            if let Some(found) = text[pos..].find(part) {
                pos += found + part.len();
            } else {
                return false;
            }
        }
    }

    true
}

/// 检查文件是否在监听白名单中（支持通配符）
///
/// - include: `*.js` 匹配所有 js 文件，`*` 匹配所有文件，`js` 兼容旧扩展名格式
/// - exclude: `node_modules` 精确匹配目录名，`.*` 匹配隐藏目录，`*.log` 匹配日志文件
pub fn is_file_watched(file_path: &Path, include: &[String], exclude: &[String]) -> bool {
    // 排除检查：匹配路径中任意组件
    for component in file_path.components() {
        let name = component.as_os_str().to_string_lossy();
        if exclude.iter().any(|pat| wildcard_match(pat, &name)) {
            return false;
        }
    }

    // 包含检查：匹配文件名（支持 *.ext 和 ext 两种格式）
    let file_name = file_path.file_name()
        .map(|n| n.to_string_lossy().to_lowercase())
        .unwrap_or_default();

    include.iter().any(|pat| {
        let pat_lower = pat.to_lowercase();
        if pat_lower.contains('*') {
            // 含通配符：匹配完整文件名（*.js 匹配 app.js，* 匹配所有文件）
            wildcard_match(&pat_lower, &file_name)
        } else {
            // 无通配符：兼容旧的扩展名匹配（js 匹配 .js 文件）
            file_path.extension()
                .map(|ext| ext.to_string_lossy().to_lowercase() == pat_lower)
                .unwrap_or(false)
        }
    })
}

/// 停止文件监听器
pub fn stop_watcher(
    watch_stop_signals: &Arc<Mutex<HashMap<String, Arc<Mutex<bool>>>>>,
    service_name: &str,
) -> Result<(), String> {
    let mut signals = lock!(watch_stop_signals);
    if let Some(signal) = signals.remove(service_name) {
        let mut should_stop = lock!(signal);
        *should_stop = true;
        log_info!("watcher", "发送停止信号: {}", service_name);
    }
    Ok(())
}

/// 启动文件监听器
pub fn start_watcher(
    app_handle: AppHandle,
    service_name: String,
    watch_path: String,
    include: Vec<String>,
    exclude: Vec<String>,
    auto_restart: bool,
) -> Result<(), String> {
    use notify::{RecommendedWatcher, RecursiveMode, Watcher};
    use std::sync::mpsc;

    let (tx, rx) = mpsc::channel::<notify::Result<notify::Event>>();
    let mut watcher = RecommendedWatcher::new(
        tx,
        notify::Config::default().with_poll_interval(Duration::from_millis(500)),
    ).map_err(|e| format!("创建监听器失败: {}", e))?;

    let path = Path::new(&watch_path);
    if !path.exists() {
        return Err(format!("监听目录不存在: {}", watch_path));
    }

    watcher.watch(path, RecursiveMode::Recursive)
        .map_err(|e| format!("启动监听失败: {}", e))?;

    let stop_signal = Arc::new(Mutex::new(false));
    let stop_signal_clone = stop_signal.clone();

    // 保存停止信号
    if let Some(state) = app_handle.try_state::<AppState>() {
        let mut signals = lock!(state.watch_stop_signals);
        signals.insert(service_name.clone(), stop_signal.clone());
    }

    let name = service_name.clone();
    let app = app_handle.clone();

    std::thread::spawn(move || {
        let mut last_restart = Instant::now();
        let debounce = Duration::from_millis(500);

        loop {
            {
                if *lock_or_panic!(stop_signal_clone) {
                    log_info!("watcher", "关闭: {}", name);
                    break;
                }
            }

            match rx.recv_timeout(Duration::from_millis(100)) {
                Ok(Ok(event)) => {
                    if !matches!(event.kind, notify::EventKind::Modify(_) | notify::EventKind::Create(_)) {
                        continue;
                    }
                    if !event.paths.iter().any(|p| is_file_watched(p, &include, &exclude)) {
                        continue;
                    }
                    let now = Instant::now();
                    if now.duration_since(last_restart) < debounce { continue; }
                    last_restart = now;

                    log_info!("watcher", "文件变化: service={}, paths={:?}", name, event.paths);

                    // 添加事件到队列（限制容量）
                    if let Some(state) = app.try_state::<AppState>() {
                        let mut events = lock_or_panic!(state.watch_events);
                        let excess = events.len().saturating_sub(WATCH_EVENTS_MAX - 1);
                        if excess > 0 {
                            events.drain(0..excess);
                        }
                        events.push(WatchEvent {
                            service_name: name.clone(),
                            path: event.paths.first()
                                .map(|p| p.to_string_lossy().to_string())
                                .unwrap_or_default(),
                            timestamp: now,
                        });
                    }

                    // 自动重启模式
                    if auto_restart {
                        if let Some(state) = app.try_state::<AppState>() {
                            let is_running = lock_or_panic!(state.processes).contains_key(&name);
                            if is_running {
                                log_info!("watcher", "自动重启: {}", name);
                                let _ = stop_process(&state, &name);
                                std::thread::sleep(Duration::from_millis(500));
                            }
                            let _ = start_process(&app, &state, &name);
                        }
                    }

                    let _ = app.emit(events::WATCH_EVENT, serde_json::json!({
                        "service_name": name,
                        "paths": event.paths.iter().map(|p| p.to_string_lossy().to_string()).collect::<Vec<_>>(),
                        "auto_restart": auto_restart,
                    }));
                }
                Ok(Err(e)) => log_warn!("watcher", "事件错误: {:?}", e),
                Err(_) => continue,
            }
        }

        drop(watcher);
        log_info!("watcher", "已关闭: {}", name);
    });

    log_info!("watcher", "启动: service={}, path={}", service_name, watch_path);
    Ok(())
}

/// 内部停止进程
fn stop_process(state: &AppState, service_name: &str) -> Result<(), String> {
    let mut processes = lock!(state.processes);
    let mut detected_pids = lock!(state.detected_pids);

    if let Some(mut process) = processes.remove(service_name) {
        crate::services::process_manager::kill_process_tree(process.id());
        let _ = process.wait();
    }
    if let Some(pid) = detected_pids.remove(service_name) {
        crate::services::process_manager::kill_process_tree(pid);
    }

    drop(processes);
    drop(detected_pids);
    lock!(state.log_buffers).remove(service_name);
    Ok(())
}

/// 内部启动进程
fn start_process(app: &AppHandle, state: &AppState, service_name: &str) -> Result<(), String> {
    let service = state.db.with_conn(|conn| {
        let all = crate::database::dao::services::load_all(conn)?;
        all.into_values()
            .find(|s| s.name == service_name)
            .ok_or_else(|| crate::error::AppError::NotFound("服务不存在".into()))
    }).map_err(|e| e.to_string())?;

    // 构建完整环境变量
    let full_env: std::collections::HashMap<String, String> = std::env::vars().collect();

    let child = crate::services::process_manager::spawn_with_realtime_log(
        app, &service, service_name, &lock!(state.settings).clone(),
        &state.log_buffers, &state.log_viewers_active,
        &full_env,
    )?;

    lock!(state.processes).insert(service_name.to_string(), child);
    Ok(())
}
