use std::fs;
use std::path::PathBuf;
use rusqlite::{Connection, params};
use crate::error::AppError;
use crate::{Service, WatchMode};
use crate::{log_info, log_warn, log_error};

/// 迁移 watch_include 格式：`js` → `*.js`
pub fn migrate_watch_include_format(conn: &Connection) -> Result<bool, AppError> {
    let mut stmt = conn.prepare("SELECT id, watch_include FROM services")?;
    let rows: Vec<(String, String)> = stmt.query_map([], |row| {
        Ok((row.get(0)?, row.get(1)?))
    })?.filter_map(|r| r.ok()).collect();

    let mut migrated = false;
    for (id, include_json) in rows {
        let list: Vec<String> = serde_json::from_str(&include_json)
            .unwrap_or_else(|_| Vec::new());

        let new_list: Vec<String> = list.iter().map(|item| {
            if item.starts_with("*.") || item.contains('*') {
                item.clone()
            } else {
                format!("*.{}", item)
            }
        }).collect();

        if new_list != list {
            let new_json = serde_json::to_string(&new_list).unwrap_or_else(|_| "[]".into());
            conn.execute(
                "UPDATE services SET watch_include = ?1 WHERE id = ?2",
                params![new_json, id],
            )?;
            migrated = true;
        }
    }

    if migrated {
        log_info!("migration", "watch_include 格式迁移完成（js → *.js）");
    }
    Ok(migrated)
}

/// 从旧 auto_backup.json 迁移到 settings 表
/// 返回 true 表示执行了迁移
pub fn migrate_auto_backup_json(conn: &Connection) -> Result<bool, AppError> {
    let home = dirs_next::home_dir().unwrap_or_default();
    let config_path = home.join(".service-deck").join("auto_backup.json");

    if !config_path.exists() {
        return Ok(false);
    }

    // 如果数据库已有 auto_backup_enabled 设置，跳过迁移
    let existing: Option<String> = conn
        .query_row(
            "SELECT value FROM settings WHERE key = 'auto_backup_enabled'",
            [],
            |row| row.get(0),
        )
        .ok();
    if existing.is_some() {
        // 已有数据，删除旧文件
        let _ = fs::remove_file(&config_path);
        return Ok(false);
    }

    log_info!("migration", "发现旧 auto_backup.json，迁移到数据库...");

    let json = fs::read_to_string(&config_path)
        .map_err(|e| AppError::Io(format!("{}", e)))?;
    let config: serde_json::Value = serde_json::from_str(&json)
        .map_err(|e| AppError::Json(format!("{}", e)))?;

    let enabled = config.get("enabled").and_then(|v| v.as_bool()).unwrap_or(false);
    let keep_days = config.get("keep_days").and_then(|v| v.as_i64()).unwrap_or(7);

    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('auto_backup_enabled', ?1)",
        params![enabled.to_string()],
    )?;
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('auto_backup_keep_days', ?1)",
        params![keep_days.to_string()],
    )?;

    // 删除旧文件
    let _ = fs::remove_file(&config_path);

    log_info!("migration", "auto_backup.json 迁移完成");
    Ok(true)
}

/// 从旧 JSON 配置文件迁移到 SQLite
/// 返回 true 表示执行了迁移
pub fn migrate_from_json(conn: &Connection) -> Result<bool, AppError> {
    let config_path = find_old_config();
    if !config_path.exists() {
        return Ok(false);
    }

    // 如果数据库已有数据，跳过迁移
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM services", [], |row| row.get(0))
        .unwrap_or(0);
    if count > 0 {
        return Ok(false);
    }

    log_info!("migration", "发现旧配置文件，开始迁移到 SQLite...");

    let json = fs::read_to_string(&config_path)
        .map_err(|e| AppError::Io(format!("{}", e)))?;
    let config: serde_json::Value = serde_json::from_str(&json)
        .map_err(|e| AppError::Json(format!("{}", e)))?;

    // 迁移 services
    if let Some(services) = config.get("services").and_then(|v| v.as_array()) {
        for svc_val in services {
            if let Ok(svc) = serde_json::from_value::<Service>(svc_val.clone()) {
                if let Err(e) = save_migrated_service(conn, &svc) {
                    log_warn!("migration", "迁移服务 {} 失败: {}", svc.name, e);
                }
            }
        }
    }

    // 迁移 projects
    if let Some(projects) = config.get("projects").and_then(|v| v.as_array()) {
        for proj_val in projects {
            if let Err(e) = migrate_project(conn, proj_val) {
                log_warn!("migration", "迁移项目失败: {}", e);
            }
        }
    }

    // 迁移 settings
    if let Some(settings) = config.get("settings").and_then(|v| v.as_object()) {
        for (key, value) in settings {
            let val_str = match value {
                serde_json::Value::Bool(b) => b.to_string(),
                serde_json::Value::String(s) => s.clone(),
                serde_json::Value::Number(n) => n.to_string(),
                _ => continue,
            };
            conn.execute(
                "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
                params![key, val_str],
            ).ok();
        }
    }

    // 备份旧配置文件
    let backup_path = config_path.with_extension("json.bak");
    let _ = fs::rename(&config_path, &backup_path);

    log_info!("migration", "迁移完成，旧配置已备份为 config.json.bak");
    Ok(true)
}

/// 查找旧配置文件路径（可执行文件目录下的 config.json）
fn find_old_config() -> PathBuf {
    let exe_path = std::env::current_exe().unwrap_or_default();
    let exe_dir = exe_path.parent().unwrap_or(std::path::Path::new("."));
    exe_dir.join("config.json")
}

/// 保存迁移的服务
fn save_migrated_service(conn: &Connection, svc: &Service) -> Result<(), AppError> {
    conn.execute(
        "INSERT INTO services \
         (id, name, command, path, sort_index, env_vars, log_path, service_type, \
          depends_on, health_check_url, health_check_interval, favorite, \
          watch_mode, watch_path, watch_include, watch_exclude, \
          runtime_versions, env_groups) \
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18) \
         ON CONFLICT(id) DO UPDATE SET \
         name = excluded.name, command = excluded.command, path = excluded.path, \
         sort_index = excluded.sort_index, env_vars = excluded.env_vars, \
         log_path = excluded.log_path, service_type = excluded.service_type, \
         depends_on = excluded.depends_on, health_check_url = excluded.health_check_url, \
         health_check_interval = excluded.health_check_interval, favorite = excluded.favorite, \
         watch_mode = excluded.watch_mode, watch_path = excluded.watch_path, \
         watch_include = excluded.watch_include, watch_exclude = excluded.watch_exclude, \
         runtime_versions = excluded.runtime_versions, env_groups = excluded.env_groups",
        params![
            svc.id, svc.name, svc.command, svc.path, svc.sort_index,
            serde_json::to_string(&svc.env_vars).unwrap_or_else(|_| "{}".into()),
            svc.log_path, svc.service_type,
            serde_json::to_string(&svc.depends_on).unwrap_or_else(|_| "[]".into()),
            svc.health_check_url, svc.health_check_interval, svc.favorite as i32,
            match svc.watch_mode {
                WatchMode::Auto => "auto",
                WatchMode::Confirm => "confirm",
                WatchMode::Off => "off",
            },
            svc.watch_path,
            serde_json::to_string(&svc.watch_include).unwrap_or_else(|_| "[]".into()),
            serde_json::to_string(&svc.watch_exclude).unwrap_or_else(|_| "[]".into()),
            serde_json::to_string(&svc.runtime_versions).unwrap_or_else(|_| "{}".into()),
            serde_json::to_string(&svc.env_groups).unwrap_or_else(|_| "[]".into()),
        ],
    )?;
    Ok(())
}

/// 迁移单个项目
fn migrate_project(conn: &Connection, val: &serde_json::Value) -> Result<(), AppError> {
    let id = val.get("id").and_then(|v| v.as_str()).ok_or_else(|| AppError::Other("项目缺少 id".into()))?;
    let name = val.get("name").and_then(|v| v.as_str()).unwrap_or("");
    let sort_index = val.get("sort_index").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
    let favorite = val.get("favorite").and_then(|v| v.as_bool()).unwrap_or(false) as i32;

    conn.execute(
        "INSERT INTO projects (id, name, sort_index, favorite) \
         VALUES (?1,?2,?3,?4) \
         ON CONFLICT(id) DO UPDATE SET \
         name = excluded.name, sort_index = excluded.sort_index, favorite = excluded.favorite",
        params![id, name, sort_index, favorite],
    )?;

    // 迁移项目-服务关联
    if let Some(svcs) = val.get("services").and_then(|v| v.as_array()) {
        for (idx, svc_val) in svcs.iter().enumerate() {
            if let Some(svc_id) = svc_val.get("id").and_then(|v| v.as_str()) {
                conn.execute(
                    "INSERT OR IGNORE INTO project_services (project_id, service_id, sort_index) VALUES (?1, ?2, ?3)",
                    params![id, svc_id, idx as i32],
                ).ok();
            }
        }
    }

    Ok(())
}
