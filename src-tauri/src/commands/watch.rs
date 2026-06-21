use tauri::{State, AppHandle};
use crate::AppState;
use crate::WatchMode;
use crate::database::dao;
use crate::services::file_watcher;
use crate::lock;

#[tauri::command]
pub fn set_watch_mode(
    app: AppHandle,
    state: State<AppState>,
    service_name: String,
    mode: WatchMode,
    watch_path: Option<String>,
) -> Result<(), String> {
    let service = state.db.with_conn(|conn| {
        let all = dao::services::load_all(conn)?;
        let mut service = all.into_values().find(|s| s.name == service_name)
            .ok_or(crate::error::AppError::NotFound("服务不存在".into()))?;

        service.watch_mode = mode.clone();
        if let Some(path) = watch_path { service.watch_path = path; }
        if service.watch_path.is_empty() { service.watch_path = service.path.clone(); }

        dao::services::save(conn, &service)?;
        Ok(service)
    }).map_err(|e: crate::error::AppError| e.to_string())?;

    file_watcher::stop_watcher(&state.watch_stop_signals, &service_name)?;

    match mode {
        WatchMode::Off => {}
        WatchMode::Auto | WatchMode::Confirm => {
            let watch_path = if service.watch_path.is_empty() { service.path.clone() } else { service.watch_path };
            let auto = mode == WatchMode::Auto;
            file_watcher::start_watcher(
                app, service_name, watch_path,
                service.watch_include, service.watch_exclude, auto,
            )?;
        }
    }

    Ok(())
}

#[tauri::command]
pub fn get_watch_events(state: State<AppState>) -> Result<Vec<serde_json::Value>, String> {
    Ok(lock!(state.watch_events)
        .iter()
        .map(|e| serde_json::json!({
            "service_name": e.service_name,
            "path": e.path,
            "timestamp": e.timestamp.elapsed().as_millis(),
        }))
        .collect())
}

#[tauri::command]
pub fn clear_watch_events(state: State<AppState>) -> Result<(), String> {
    lock!(state.watch_events).clear();
    Ok(())
}
