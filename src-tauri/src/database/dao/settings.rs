use rusqlite::Connection;
use crate::error::AppError;
use crate::AppSettings;

/// 从数据库加载所有设置
pub fn load_settings(conn: &Connection) -> Result<AppSettings, AppError> {
    let mut stmt = conn.prepare("SELECT key, value FROM settings")
        .map_err(|e| AppError::Database(format!("准备设置查询失败: {}", e)))?;

    let mut settings = AppSettings::default();
    let rows = stmt.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    }).map_err(|e| AppError::Database(format!("查询设置失败: {}", e)))?;

    for row in rows {
        let (key, value) = row.map_err(|e| AppError::Database(format!("读取设置行失败: {}", e)))?;
        match key.as_str() {
            "minimize_to_tray" => settings.minimize_to_tray = value == "true",
            "show_notifications" => settings.show_notifications = value == "true",
            "theme" => settings.theme = value,
            "java_home" => settings.java_home = value,
            "language" => settings.language = value,
            "auto_backup_enabled" => settings.auto_backup_enabled = value == "true",
            "auto_backup_keep_days" => settings.auto_backup_keep_days = value.parse().unwrap_or(7),
            _ => {}
        }
    }

    Ok(settings)
}

/// 保存所有设置到数据库
pub fn save_settings(conn: &Connection, settings: &AppSettings) -> Result<(), AppError> {
    let entries = [
        ("minimize_to_tray", settings.minimize_to_tray.to_string()),
        ("show_notifications", settings.show_notifications.to_string()),
        ("theme", settings.theme.clone()),
        ("java_home", settings.java_home.clone()),
        ("language", settings.language.clone()),
        ("auto_backup_enabled", settings.auto_backup_enabled.to_string()),
        ("auto_backup_keep_days", settings.auto_backup_keep_days.to_string()),
    ];

    for (key, value) in &entries {
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?1, ?2, datetime('now'))",
            rusqlite::params![key, value],
        ).map_err(|e| AppError::Database(format!("保存设置 {} 失败: {}", key, e)))?;
    }

    Ok(())
}
