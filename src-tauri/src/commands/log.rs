use std::fs;
use std::path::PathBuf;
use serde::Serialize;
use tauri::State;
use crate::AppState;
use crate::database::dao;
use crate::lock;
use crate::{logger, load_app_settings, save_app_settings, log_info};

/// 从文件末尾读取最后 N 行
fn read_file_tail(path: &PathBuf, n: usize) -> Result<String, String> {
    use std::io::{Seek, SeekFrom, Read};

    let mut file = fs::File::open(path).map_err(|e| format!("打开日志文件失败: {}", e))?;
    let metadata = file.metadata().map_err(|e| format!("读取元数据失败: {}", e))?;
    let file_size = metadata.len();

    if file_size == 0 { return Ok(String::new()); }

    if file_size < 1024 * 1024 {
        let content = fs::read_to_string(path).map_err(|e| format!("读取日志失败: {}", e))?;
        let lines: Vec<&str> = content.lines().collect();
        let start = if lines.len() > n { lines.len() - n } else { 0 };
        return Ok(lines[start..].join("\n"));
    }

    let chunk_size: u64 = 8192;
    let mut pos = file_size;
    let mut tail_buf: Vec<u8> = Vec::new();
    let mut found_lines = 0;

    while pos > 0 && found_lines <= n {
        let read_size = chunk_size.min(pos);
        pos -= read_size;
        file.seek(SeekFrom::Start(pos)).map_err(|e| format!("seek 失败: {}", e))?;
        let mut chunk = vec![0u8; read_size as usize];
        file.read_exact(&mut chunk).map_err(|e| format!("读取失败: {}", e))?;
        found_lines += chunk.iter().filter(|&&b| b == b'\n').count();
        chunk.extend_from_slice(&tail_buf);
        tail_buf = chunk;
    }

    let content = String::from_utf8_lossy(&tail_buf);
    let lines: Vec<&str> = content.lines().collect();
    let start = if lines.len() > n { lines.len() - n } else { 0 };
    Ok(lines[start..].join("\n"))
}

#[tauri::command]
pub fn get_service_logs(state: State<AppState>, service_name: String, tail_lines: Option<usize>) -> Result<String, String> {
    let log_path = state.db.with_conn(|conn| {
        let all = dao::services::load_all(conn)?;
        Ok(all.into_values().find(|s| s.name == service_name)
            .map(|s| s.log_path)
            .unwrap_or_default())
    }).map_err(|e: crate::error::AppError| e.to_string())?;

    if !log_path.is_empty() {
        let p = PathBuf::from(&log_path);
        if !p.exists() { return Ok(String::new()); }
        return read_file_tail(&p, tail_lines.unwrap_or(1000));
    }

    let buffers = lock!(state.log_buffers);
    match buffers.get(&service_name) {
        Some(lines) => {
            let tail = tail_lines.unwrap_or(1000);
            let start = if lines.len() > tail { lines.len() - tail } else { 0 };
            Ok(lines[start..].join("\n"))
        }
        None => Ok(String::new()),
    }
}

#[tauri::command]
pub fn get_log_file_size(state: State<AppState>, service_name: String) -> Result<usize, String> {
    let log_path = state.db.with_conn(|conn| {
        let all = dao::services::load_all(conn)?;
        Ok(all.into_values().find(|s| s.name == service_name)
            .map(|s| s.log_path)
            .unwrap_or_default())
    }).map_err(|e: crate::error::AppError| e.to_string())?;

    if !log_path.is_empty() {
        let p = PathBuf::from(&log_path);
        if !p.exists() { return Ok(0); }
        let metadata = fs::metadata(&p).map_err(|e| format!("读取元数据失败: {}", e))?;
        return Ok(metadata.len() as usize);
    }

    let buffers = lock!(state.log_buffers);
    match buffers.get(&service_name) {
        Some(lines) => Ok(lines.join("\n").len()),
        None => Ok(0),
    }
}

#[tauri::command]
pub fn set_log_viewer_active(state: State<AppState>, service_name: String, active: bool) -> Result<(), String> {
    lock!(state.log_viewers_active).insert(service_name, active);
    Ok(())
}

#[tauri::command]
pub fn clear_service_logs(state: State<AppState>, service_name: String) -> Result<(), String> {
    let mut buffers = lock!(state.log_buffers);
    if let Some(buffer) = buffers.get_mut(&service_name) {
        if buffer.len() > 1000 {
            let drain = buffer.len() - 1000;
            buffer.drain(0..drain);
        }
    }
    Ok(())
}

// ===== 应用日志命令 =====

#[derive(Serialize)]
pub struct LogEntry {
    pub timestamp: String,
    pub level: String,
    pub target: String,
    pub message: String,
}

#[tauri::command]
pub fn get_log_entries(date: Option<String>, limit: Option<usize>) -> Vec<LogEntry> {
    let limit = limit.unwrap_or(500);
    if let Some(logger) = logger::get() {
        logger.read_logs(date.as_deref(), limit)
            .into_iter()
            .map(|e| LogEntry {
                timestamp: e.timestamp,
                level: e.level,
                target: e.target,
                message: e.message,
            })
            .collect()
    } else {
        Vec::new()
    }
}

#[tauri::command]
pub fn get_log_dates() -> Vec<String> {
    if let Some(logger) = logger::get() {
        logger.get_log_dates()
    } else {
        Vec::new()
    }
}

#[tauri::command]
pub fn get_log_level() -> String {
    if let Some(logger) = logger::get() {
        logger.get_level().as_str().to_lowercase()
    } else {
        "info".to_string()
    }
}

#[tauri::command]
pub fn set_log_level(level: String) {
    let new_level = logger::LogLevel::from_str(&level);
    if let Some(logger) = logger::get() {
        logger.set_level(new_level);
        log_info!("settings", "日志级别已更改为: {}", level);
    }
    // 持久化到配置文件
    let mut settings = load_app_settings();
    settings["log_level"] = serde_json::Value::String(level);
    save_app_settings(&settings).ok();
}

#[tauri::command]
pub fn clear_logs(date: Option<String>) -> Result<(), String> {
    if let Some(logger) = logger::get() {
        logger.clear_logs(date.as_deref())?;
        log_info!("settings", "清空日志完成");
    }
    Ok(())
}

#[tauri::command]
pub fn get_log_retention_days() -> i64 {
    if let Some(logger) = logger::get() {
        logger.get_retention_days()
    } else {
        7
    }
}

#[tauri::command]
pub fn set_log_retention_days(days: i64) {
    if let Some(logger) = logger::get() {
        logger.set_retention_days(days);
        log_info!("settings", "日志保留天数已更改为: {}", days);
    }
    // 持久化到配置文件
    let mut settings = load_app_settings();
    settings["log_retention_days"] = serde_json::Value::Number(days.into());
    save_app_settings(&settings).ok();
}
