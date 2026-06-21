use tauri::State;
use crate::AppState;
use crate::database::dao;
use crate::Project;
use crate::lock;

#[tauri::command]
pub fn get_projects(state: State<AppState>) -> Result<Vec<Project>, String> {
    state.db.with_conn(|conn| {
        let services = dao::services::load_all(conn)?;
        let projects = dao::projects::load_all(conn, &services)?;
        let mut list: Vec<Project> = projects.into_values().collect();
        list.sort_by(|a, b| a.sort_index.cmp(&b.sort_index));
        Ok(list)
    }).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_project(state: State<AppState>, name: String) -> Result<Project, String> {
    if name.trim().is_empty() { return Err("项目名称不能为空".into()); }

    state.db.with_conn(|conn| {
        let existing = dao::projects::load_all(conn, &std::collections::HashMap::new())?;
        if existing.values().any(|p| p.name == name.trim()) {
            return Err(crate::error::AppError::InvalidInput("项目名称已存在".into()));
        }

        let id = uuid::Uuid::new_v4().to_string();
        let max_index = existing.values().map(|p| p.sort_index).max().unwrap_or(-1);
        let project = Project {
            id: id.clone(),
            name,
            services: Vec::new(),
            sort_index: max_index + 1,
            favorite: false,
        };
        dao::projects::save(conn, &project)?;
        Ok(project)
    }).map_err(|e: crate::error::AppError| e.to_string())
}

#[tauri::command]
pub fn update_project(state: State<AppState>, id: String, name: String, favorite: Option<bool>) -> Result<(), String> {
    state.db.with_conn(|conn| {
        let services = dao::services::load_all(conn)?;
        let mut projects = dao::projects::load_all(conn, &services)?;
        let project = projects.get_mut(&id)
            .ok_or(crate::error::AppError::NotFound("项目不存在".into()))?;
        project.name = name;
        if let Some(f) = favorite { project.favorite = f; }
        dao::projects::save(conn, project)?;
        Ok(())
    }).map_err(|e: crate::error::AppError| e.to_string())
}

#[tauri::command]
pub fn remove_project(state: State<AppState>, id: String) -> Result<(), String> {
    state.db.with_conn(|conn| {
        // 获取项目关联的服务名称用于停止进程
        let service_ids = dao::projects::get_service_ids(conn, &id)?;
        let services = dao::services::load_all(conn)?;

        // 检查哪些服务还被其他项目使用
        let mut shared_names = std::collections::HashSet::new();
        let all_projects = dao::projects::load_all(conn, &services)?;
        for (pid, proj) in &all_projects {
            if pid == &id { continue; }
            for svc in &proj.services {
                shared_names.insert(svc.name.clone());
            }
        }

        // 停止不再被其他项目使用的服务进程
        let mut processes = lock!(state.processes);
        for sid in &service_ids {
            if let Some(svc) = services.get(sid) {
                if !shared_names.contains(&svc.name) {
                    if let Some(mut process) = processes.remove(&svc.name) {
                        crate::services::process_manager::kill_process_tree(process.id());
                        let _ = process.wait();
                    }
                }
            }
        }
        drop(processes);

        dao::projects::delete(conn, &id)?;
        Ok(())
    }).map_err(|e: crate::error::AppError| e.to_string())
}

#[tauri::command]
pub fn toggle_project_favorite(state: State<AppState>, id: String) -> Result<bool, String> {
    state.db.with_conn(|conn| dao::projects::toggle_favorite(conn, &id))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_project_sort(state: State<AppState>, updates: Vec<(String, i32)>) -> Result<(), String> {
    state.db.with_conn(|conn| dao::projects::update_sort(conn, &updates))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_service_to_project(state: State<AppState>, project_id: String, service_id: String) -> Result<(), String> {
    state.db.with_conn(|conn| {
        // 验证项目和服务存在
        let services = dao::services::load_all(conn)?;
        if !services.contains_key(&service_id) {
            return Err(crate::error::AppError::NotFound("服务不存在".into()));
        }
        let projects = dao::projects::load_all(conn, &services)?;
        if !projects.contains_key(&project_id) {
            return Err(crate::error::AppError::NotFound("项目不存在".into()));
        }

        dao::projects::add_service(conn, &project_id, &service_id)?;
        Ok(())
    }).map_err(|e: crate::error::AppError| e.to_string())
}

#[tauri::command]
pub fn remove_service_from_project(state: State<AppState>, project_id: String, service_id: String) -> Result<(), String> {
    state.db.with_conn(|conn| {
        // 停止该服务的进程
        let services = dao::services::load_all(conn)?;
        if let Some(svc) = services.get(&service_id) {
            let mut processes = lock!(state.processes);
            if let Some(mut process) = processes.remove(&svc.name) {
                crate::services::process_manager::kill_process_tree(process.id());
                let _ = process.wait();
            }
        }

        dao::projects::remove_service(conn, &project_id, &service_id)?;
        Ok(())
    }).map_err(|e: crate::error::AppError| e.to_string())
}
