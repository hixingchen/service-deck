use std::collections::HashMap;
use rusqlite::{Connection, params};
use crate::error::AppError;
use crate::{Service, WatchMode};
use crate::config::{default_watch_include, default_watch_exclude};

/// 将数据库行转换为 Service 结构体
pub fn row_to_service(row: &rusqlite::Row) -> rusqlite::Result<Service> {
    let env_vars_json: String = row.get("env_vars")?;
    let depends_on_json: String = row.get("depends_on")?;
    let watch_include_json: String = row.get("watch_include")?;
    let watch_exclude_json: String = row.get("watch_exclude")?;
    let runtime_versions_json: String = row.get("runtime_versions")?;
    let env_groups_json: String = row.get("env_groups")?;
    let watch_mode_str: String = row.get("watch_mode")?;
    let favorite_int: i32 = row.get("favorite")?;

    Ok(Service {
        id: row.get("id")?,
        name: row.get("name")?,
        command: row.get("command")?,
        path: row.get("path")?,
        sort_index: row.get("sort_index")?,
        env_vars: serde_json::from_str(&env_vars_json).unwrap_or_default(),
        log_path: row.get("log_path")?,
        service_type: row.get("service_type")?,
        depends_on: serde_json::from_str(&depends_on_json).unwrap_or_default(),
        health_check_url: row.get("health_check_url")?,
        health_check_interval: row.get("health_check_interval")?,
        favorite: favorite_int != 0,
        watch_mode: match watch_mode_str.as_str() {
            "auto" => WatchMode::Auto,
            "confirm" => WatchMode::Confirm,
            _ => WatchMode::Off,
        },
        watch_path: row.get("watch_path")?,
        watch_include: serde_json::from_str(&watch_include_json)
            .unwrap_or_else(|_| default_watch_include()),
        watch_exclude: serde_json::from_str(&watch_exclude_json)
            .unwrap_or_else(|_| default_watch_exclude()),
        runtime_versions: serde_json::from_str(&runtime_versions_json).unwrap_or_default(),
        env_groups: serde_json::from_str(&env_groups_json).unwrap_or_default(),
    })
}

pub const SELECT_COLUMNS: &str = "id, name, command, path, sort_index, env_vars, log_path, service_type, depends_on, health_check_url, health_check_interval, favorite, watch_mode, watch_path, watch_include, watch_exclude, runtime_versions, env_groups";

/// 加载所有服务
pub fn load_all(conn: &Connection) -> Result<HashMap<String, Service>, AppError> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {} FROM services ORDER BY sort_index", SELECT_COLUMNS
    )).map_err(|e| AppError::Database(format!("准备服务查询失败: {}", e)))?;

    let services = stmt.query_map([], |row| row_to_service(row))
        .map_err(|e| AppError::Database(format!("查询服务失败: {}", e)))?
        .filter_map(|r| r.ok())
        .map(|s| (s.id.clone(), s))
        .collect();

    Ok(services)
}

/// 根据 ID 获取单个服务
pub fn get_by_id(conn: &Connection, id: &str) -> Result<Option<Service>, AppError> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {} FROM services WHERE id = ?1", SELECT_COLUMNS
    )).map_err(|e| AppError::Database(format!("准备查询失败: {}", e)))?;

    let mut rows = stmt.query_map(params![id], |row| row_to_service(row))
        .map_err(|e| AppError::Database(format!("查询服务失败: {}", e)))?;

    match rows.next() {
        Some(row) => Ok(Some(row.map_err(|e| AppError::Database(format!("读取服务失败: {}", e)))?)),
        None => Ok(None),
    }
}

/// 插入或更新服务
/// 使用 ON CONFLICT DO UPDATE 替代 INSERT OR REPLACE，
/// 避免 SQLite 的 REPLACE 策略触发 DELETE + CASCADE 导致 project_services 关联被清除
pub fn save(conn: &Connection, service: &Service) -> Result<(), AppError> {
    conn.execute(
        "INSERT INTO services \
         (id, name, command, path, sort_index, env_vars, log_path, service_type, \
          depends_on, health_check_url, health_check_interval, favorite, \
          watch_mode, watch_path, watch_include, watch_exclude, \
          runtime_versions, env_groups, updated_at) \
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,datetime('now')) \
         ON CONFLICT(id) DO UPDATE SET \
         name = excluded.name, command = excluded.command, path = excluded.path, \
         sort_index = excluded.sort_index, env_vars = excluded.env_vars, \
         log_path = excluded.log_path, service_type = excluded.service_type, \
         depends_on = excluded.depends_on, health_check_url = excluded.health_check_url, \
         health_check_interval = excluded.health_check_interval, favorite = excluded.favorite, \
         watch_mode = excluded.watch_mode, watch_path = excluded.watch_path, \
         watch_include = excluded.watch_include, watch_exclude = excluded.watch_exclude, \
         runtime_versions = excluded.runtime_versions, env_groups = excluded.env_groups, \
         updated_at = excluded.updated_at",
        params![
            service.id,
            service.name,
            service.command,
            service.path,
            service.sort_index,
            serde_json::to_string(&service.env_vars).unwrap_or_else(|_| "{}".into()),
            service.log_path,
            service.service_type,
            serde_json::to_string(&service.depends_on).unwrap_or_else(|_| "[]".into()),
            service.health_check_url,
            service.health_check_interval,
            service.favorite as i32,
            match service.watch_mode {
                WatchMode::Auto => "auto",
                WatchMode::Confirm => "confirm",
                WatchMode::Off => "off",
            },
            service.watch_path,
            serde_json::to_string(&service.watch_include).unwrap_or_else(|_| "[]".into()),
            serde_json::to_string(&service.watch_exclude).unwrap_or_else(|_| "[]".into()),
            serde_json::to_string(&service.runtime_versions).unwrap_or_else(|_| "{}".into()),
            serde_json::to_string(&service.env_groups).unwrap_or_else(|_| "[]".into()),
        ],
    ).map_err(|e| AppError::Database(format!("保存服务失败: {}", e)))?;
    Ok(())
}

/// 删除服务
pub fn delete(conn: &Connection, id: &str) -> Result<(), AppError> {
    // 先删除关联关系
    conn.execute("DELETE FROM project_services WHERE service_id = ?1", params![id])
        .map_err(|e| AppError::Database(format!("删除服务关联失败: {}", e)))?;
    // 再删除服务本身
    let affected = conn.execute("DELETE FROM services WHERE id = ?1", params![id])
        .map_err(|e| AppError::Database(format!("删除服务失败: {}", e)))?;
    if affected == 0 {
        return Err(AppError::NotFound("服务不存在".into()));
    }
    Ok(())
}

/// 批量更新排序索引（事务保护）
pub fn update_sort(conn: &Connection, updates: &[(String, i32)]) -> Result<(), AppError> {
    conn.execute("BEGIN", []).map_err(|e| AppError::Database(format!("开启事务失败: {}", e)))?;
    for (id, sort_index) in updates {
        let result = conn.execute(
            "UPDATE services SET sort_index = ?1, updated_at = datetime('now') WHERE id = ?2",
            params![sort_index, id],
        );
        if let Err(e) = result {
            conn.execute("ROLLBACK", []).ok();
            return Err(AppError::Database(format!("更新服务排序失败: {}", e)));
        }
    }
    conn.execute("COMMIT", []).map_err(|e| AppError::Database(format!("提交事务失败: {}", e)))?;
    Ok(())
}

/// 切换收藏状态，返回新状态
pub fn toggle_favorite(conn: &Connection, id: &str) -> Result<bool, AppError> {
    let current: i32 = conn.query_row(
        "SELECT favorite FROM services WHERE id = ?1", params![id],
        |row| row.get(0),
    ).map_err(|_| AppError::NotFound("服务不存在".into()))?;

    let new_val = if current == 0 { 1 } else { 0 };
    conn.execute(
        "UPDATE services SET favorite = ?1, updated_at = datetime('now') WHERE id = ?2",
        params![new_val, id],
    ).map_err(|e| AppError::Database(format!("更新收藏状态失败: {}", e)))?;

    Ok(new_val != 0)
}
