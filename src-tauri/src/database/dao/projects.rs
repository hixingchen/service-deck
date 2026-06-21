use std::collections::HashMap;
use rusqlite::{Connection, params};
use crate::error::AppError;
use crate::{Project, Service};

/// 加载所有项目（含关联服务）
pub fn load_all(conn: &Connection, services: &HashMap<String, Service>) -> Result<HashMap<String, Project>, AppError> {
    let mut stmt = conn.prepare("SELECT id, name, sort_index, favorite FROM projects ORDER BY sort_index")
        .map_err(|e| AppError::Database(format!("准备项目查询失败: {}", e)))?;

    let mut projects = HashMap::new();
    let rows = stmt.query_map([], |row| {
        let id: String = row.get("id")?;
        let name: String = row.get("name")?;
        let sort_index: i32 = row.get("sort_index")?;
        let favorite_int: i32 = row.get("favorite")?;
        Ok((id, name, sort_index, favorite_int != 0))
    }).map_err(|e| AppError::Database(format!("查询项目失败: {}", e)))?;

    for row in rows {
        let (id, name, sort_index, favorite) = row
            .map_err(|e| AppError::Database(format!("读取项目失败: {}", e)))?;

        // 通过关联表加载项目内的服务列表
        let project_services = load_project_services(conn, &id, services)?;

        projects.insert(id.clone(), Project {
            id,
            name,
            services: project_services,
            sort_index,
            favorite,
        });
    }

    Ok(projects)
}

/// 加载单个项目的服务列表
fn load_project_services(
    conn: &Connection,
    project_id: &str,
    services: &HashMap<String, Service>,
) -> Result<Vec<Service>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT service_id, sort_index FROM project_services WHERE project_id = ?1 ORDER BY sort_index"
    ).map_err(|e| AppError::Database(format!("准备项目服务查询失败: {}", e)))?;

    let rows = stmt.query_map(params![project_id], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, i32>(1)?))
    }).map_err(|e| AppError::Database(format!("查询项目服务失败: {}", e)))?;

    let mut result = Vec::new();
    for row in rows {
        let (service_id, _sort_index) = row
            .map_err(|e| AppError::Database(format!("读取项目服务失败: {}", e)))?;
        if let Some(svc) = services.get(&service_id) {
            result.push(svc.clone());
        }
    }

    Ok(result)
}

/// 插入或更新项目（不含服务关联）
/// 使用 ON CONFLICT DO UPDATE 替代 INSERT OR REPLACE，
/// 避免 SQLite 的 REPLACE 策略触发 DELETE + CASCADE 导致 project_services 关联被清除
pub fn save(conn: &Connection, project: &Project) -> Result<(), AppError> {
    conn.execute(
        "INSERT INTO projects (id, name, sort_index, favorite, updated_at) \
         VALUES (?1, ?2, ?3, ?4, datetime('now')) \
         ON CONFLICT(id) DO UPDATE SET \
         name = excluded.name, \
         sort_index = excluded.sort_index, \
         favorite = excluded.favorite, \
         updated_at = excluded.updated_at",
        params![project.id, project.name, project.sort_index, project.favorite as i32],
    ).map_err(|e| AppError::Database(format!("保存项目失败: {}", e)))?;
    Ok(())
}

/// 删除项目（级联删除关联表）
pub fn delete(conn: &Connection, id: &str) -> Result<(), AppError> {
    conn.execute("DELETE FROM project_services WHERE project_id = ?1", params![id])
        .map_err(|e| AppError::Database(format!("删除项目关联失败: {}", e)))?;
    let affected = conn.execute("DELETE FROM projects WHERE id = ?1", params![id])
        .map_err(|e| AppError::Database(format!("删除项目失败: {}", e)))?;
    if affected == 0 {
        return Err(AppError::NotFound("项目不存在".into()));
    }
    Ok(())
}

/// 向项目添加服务
pub fn add_service(conn: &Connection, project_id: &str, service_id: &str) -> Result<(), AppError> {
    // 获取当前最大排序
    let max_sort: i32 = conn.query_row(
        "SELECT COALESCE(MAX(sort_index), -1) FROM project_services WHERE project_id = ?1",
        params![project_id],
        |row| row.get(0),
    ).unwrap_or(-1);

    conn.execute(
        "INSERT OR IGNORE INTO project_services (project_id, service_id, sort_index) VALUES (?1, ?2, ?3)",
        params![project_id, service_id, max_sort + 1],
    ).map_err(|e| AppError::Database(format!("添加项目服务关联失败: {}", e)))?;
    Ok(())
}

/// 从项目移除服务
pub fn remove_service(conn: &Connection, project_id: &str, service_id: &str) -> Result<(), AppError> {
    conn.execute(
        "DELETE FROM project_services WHERE project_id = ?1 AND service_id = ?2",
        params![project_id, service_id],
    ).map_err(|e| AppError::Database(format!("移除项目服务关联失败: {}", e)))?;
    Ok(())
}

/// 批量更新排序索引（事务保护）
pub fn update_sort(conn: &Connection, updates: &[(String, i32)]) -> Result<(), AppError> {
    conn.execute("BEGIN", []).map_err(|e| AppError::Database(format!("开启事务失败: {}", e)))?;
    for (id, sort_index) in updates {
        let result = conn.execute(
            "UPDATE projects SET sort_index = ?1, updated_at = datetime('now') WHERE id = ?2",
            params![sort_index, id],
        );
        if let Err(e) = result {
            conn.execute("ROLLBACK", []).ok();
            return Err(AppError::Database(format!("更新项目排序失败: {}", e)));
        }
    }
    conn.execute("COMMIT", []).map_err(|e| AppError::Database(format!("提交事务失败: {}", e)))?;
    Ok(())
}

/// 切换收藏状态
pub fn toggle_favorite(conn: &Connection, id: &str) -> Result<bool, AppError> {
    let current: i32 = conn.query_row(
        "SELECT favorite FROM projects WHERE id = ?1", params![id],
        |row| row.get(0),
    ).map_err(|_| AppError::NotFound("项目不存在".into()))?;

    let new_val = if current == 0 { 1 } else { 0 };
    conn.execute(
        "UPDATE projects SET favorite = ?1, updated_at = datetime('now') WHERE id = ?2",
        params![new_val, id],
    ).map_err(|e| AppError::Database(format!("更新收藏状态失败: {}", e)))?;

    Ok(new_val != 0)
}

/// 获取项目的关联服务 ID 列表
pub fn get_service_ids(conn: &Connection, project_id: &str) -> Result<Vec<String>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT service_id FROM project_services WHERE project_id = ?1 ORDER BY sort_index"
    ).map_err(|e| AppError::Database(format!("准备查询失败: {}", e)))?;

    let ids = stmt.query_map(params![project_id], |row| row.get(0))
        .map_err(|e| AppError::Database(format!("查询项目服务失败: {}", e)))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(ids)
}
