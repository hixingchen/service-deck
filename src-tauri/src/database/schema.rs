use rusqlite::Connection;
use crate::error::AppError;

/// 当前 Schema 版本
const CURRENT_VERSION: i32 = crate::config::SCHEMA_VERSION;

/// 初始化数据库 Schema
pub fn init_schema(conn: &Connection) -> Result<(), AppError> {
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;")
        .map_err(|e| AppError::Database(format!("设置 PRAGMA 失败: {}", e)))?;

    conn.execute_batch("
        CREATE TABLE IF NOT EXISTS schema_version (
            version INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS services (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            command TEXT NOT NULL,
            path TEXT NOT NULL DEFAULT '',
            sort_index INTEGER NOT NULL DEFAULT 0,
            env_vars TEXT NOT NULL DEFAULT '{}',
            log_path TEXT NOT NULL DEFAULT '',
            service_type TEXT NOT NULL DEFAULT 'normal',
            depends_on TEXT NOT NULL DEFAULT '[]',
            health_check_url TEXT NOT NULL DEFAULT '',
            health_check_interval INTEGER NOT NULL DEFAULT 0,
            favorite INTEGER NOT NULL DEFAULT 0,
            watch_mode TEXT NOT NULL DEFAULT 'off',
            watch_path TEXT NOT NULL DEFAULT '',
            watch_include TEXT NOT NULL DEFAULT '[]',
            watch_exclude TEXT NOT NULL DEFAULT '[]',
            runtime_versions TEXT NOT NULL DEFAULT '{}',
            env_groups TEXT NOT NULL DEFAULT '[]',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            sort_index INTEGER NOT NULL DEFAULT 0,
            favorite INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS project_services (
            project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
            sort_index INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (project_id, service_id)
        );

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS runtime_state (
            service_name TEXT PRIMARY KEY,
            pid INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_project_services_project ON project_services(project_id);
        CREATE INDEX IF NOT EXISTS idx_project_services_service ON project_services(service_id);
    ").map_err(|e| AppError::Database(format!("创建表失败: {}", e)))?;

    // Schema 版本管理
    let version: i32 = conn
        .query_row("SELECT version FROM schema_version LIMIT 1", [], |row| row.get(0))
        .unwrap_or(0);

    if version == 0 {
        conn.execute("DELETE FROM schema_version", []).ok();
        conn.execute("INSERT INTO schema_version (version) VALUES (?1)", [CURRENT_VERSION]).ok();
    }

    // 插入默认设置（忽略已存在）
    let defaults = [
        ("minimize_to_tray", "true"),
        ("show_notifications", "true"),
        ("theme", "dark"),
        ("auto_backup_enabled", "false"),
        ("auto_backup_keep_days", "7"),
    ];
    for (key, value) in &defaults {
        conn.execute(
            "INSERT OR IGNORE INTO settings (key, value) VALUES (?1, ?2)",
            rusqlite::params![key, value],
        ).ok();
    }

    Ok(())
}
