use serde::{Deserialize, Serialize};
use std::process::{Command, Child, Stdio};
use std::collections::HashMap;
use std::sync::Mutex;
use std::fs::{self, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::thread;
use tauri::{State, AppHandle, Manager};

// 过滤 ANSI 转义码（颜色、样式等）
fn strip_ansi(s: &str) -> String {
    let mut result = String::with_capacity(s.len());
    let mut chars = s.chars();
    while let Some(c) = chars.next() {
        if c == '\x1b' {
            // 跳过 ESC[ ... m 序列
            if chars.next() == Some('[') {
                for cc in chars.by_ref() {
                    if cc == 'm' { break; }
                }
            }
        } else {
            result.push(c);
        }
    }
    result
}

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub services: Vec<Service>,
    #[serde(default)]
    pub sort_index: i32,
    #[serde(default)]
    pub favorite: bool,       // 是否收藏
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Service {
    pub id: String,
    pub name: String,
    pub command: String,
    pub path: String,
    #[serde(default)]
    pub sort_index: i32,
    #[serde(default)]
    pub env_vars: HashMap<String, String>,
    #[serde(default)]
    pub log_path: String,
    #[serde(default = "default_service_type")]
    pub service_type: String,
    #[serde(default)]
    pub depends_on: Vec<String>, // 依赖的服务ID列表
    #[serde(default)]
    pub health_check_url: String, // 健康检查URL
    #[serde(default)]
    pub health_check_interval: u32, // 健康检查间隔（秒）
    #[serde(default)]
    pub favorite: bool, // 是否收藏
}

fn default_service_type() -> String {
    "normal".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceStatus {
    pub name: String,
    pub status: String,
    pub pid: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AppSettings {
    // 预留设置字段，路径已固定为exe同级config目录
    #[serde(default)]
    pub minimize_to_tray: bool,       // 是否最小化到托盘
    #[serde(default)]
    pub show_notifications: bool,     // 是否显示通知
    #[serde(default)]
    pub theme: String,                // 主题设置
}

struct AppState {
    services: Mutex<HashMap<String, Service>>,
    projects: Mutex<HashMap<String, Project>>,
    processes: Mutex<HashMap<String, Child>>,
    detected_pids: Mutex<HashMap<String, u32>>,  // 启动时检测到的运行中服务 PID
    settings: Mutex<AppSettings>,
}

fn get_exe_dir(_app: &AppHandle) -> PathBuf {
    let exe_path = std::env::current_exe().expect("无法获取程序路径");
    exe_path.parent().expect("无法获取程序目录").to_path_buf()
}

fn get_config_path(app: &AppHandle) -> PathBuf {
    get_exe_dir(app).join("config.json")
}

fn get_log_dir(app: &AppHandle) -> PathBuf {
    let dir = get_exe_dir(app).join("logs");
    fs::create_dir_all(&dir).ok();
    dir
}

// 统一配置结构
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct AppConfig {
    #[serde(default)]
    services: Vec<Service>,
    #[serde(default)]
    projects: Vec<Project>,
    #[serde(default)]
    settings: AppSettings,
    #[serde(default)]
    running_pids: HashMap<String, u32>,  // 服务名 -> PID，用于持久化运行状态
}

fn load_config(app: &AppHandle) -> AppConfig {
    let path = get_config_path(app);

    // 新配置文件存在，直接加载
    if path.exists() {
        return match fs::read_to_string(&path) {
            Ok(json) => serde_json::from_str(&json).unwrap_or_default(),
            Err(_) => AppConfig::default(),
        };
    }

    // 尝试从旧配置迁移
    let exe_dir = get_exe_dir(app);
    let old_config_dir = exe_dir.join("config");
    let old_services_path = old_config_dir.join("services.json");
    let old_projects_path = old_config_dir.join("projects.json");

    if old_services_path.exists() || old_projects_path.exists() {
        let mut config = AppConfig::default();

        // 读取旧的 services.json
        if let Ok(json) = fs::read_to_string(&old_services_path) {
            if let Ok(vec) = serde_json::from_str::<Vec<Service>>(&json) {
                config.services = vec;
            }
        }

        // 读取旧的 projects.json
        if let Ok(json) = fs::read_to_string(&old_projects_path) {
            if let Ok(vec) = serde_json::from_str::<Vec<Project>>(&json) {
                config.projects = vec;
            }
        }

        // 保存为新格式
        let _ = save_config(app, &config);

        // 删除旧配置目录
        let _ = fs::remove_dir_all(&old_config_dir);

        return config;
    }

    AppConfig::default()
}

fn save_config(app: &AppHandle, config: &AppConfig) -> Result<(), String> {
    let path = get_config_path(app);
    let json = serde_json::to_string_pretty(config).map_err(|e| format!("序列化失败: {}", e))?;
    // 原子写入
    let tmp_path = path.with_extension("json.tmp");
    fs::write(&tmp_path, &json).map_err(|e| format!("写入临时文件失败: {}", e))?;
    fs::rename(&tmp_path, &path).map_err(|e| format!("重命名文件失败: {}", e))?;
    Ok(())
}

// 保存所有数据到 config.json
fn save_all(app: &AppHandle, state: &AppState) -> Result<(), String> {
    let services = state.services.lock().unwrap();
    let projects = state.projects.lock().unwrap();
    let settings = state.settings.lock().unwrap();
    let processes = state.processes.lock().unwrap();
    let detected_pids = state.detected_pids.lock().unwrap();

    // 收集运行中的进程 PID（合并 processes 和 detected_pids）
    let mut running_pids: HashMap<String, u32> = processes.iter()
        .map(|(name, process)| (name.clone(), process.id()))
        .collect();
    // 添加 detected_pids 中仍在运行的
    for (name, pid) in detected_pids.iter() {
        if !running_pids.contains_key(name) && is_pid_alive(*pid) {
            running_pids.insert(name.clone(), *pid);
        }
    }

    let config = AppConfig {
        services: services.values().cloned().collect(),
        projects: projects.values().cloned().collect(),
        settings: settings.clone(),
        running_pids,
    };
    save_config(app, &config)
}

// ===== 服务管理命令 =====

#[tauri::command]
fn get_services(state: State<AppState>) -> Vec<Service> {
    let services = state.services.lock().unwrap();
    let mut list: Vec<Service> = services.values().cloned().collect();
    list.sort_by(|a, b| a.sort_index.cmp(&b.sort_index));
    list
}

#[tauri::command]
fn add_service(app: AppHandle, state: State<AppState>, name: String, command: String, path: String, env_vars: HashMap<String, String>, log_path: String, service_type: Option<String>, depends_on: Option<Vec<String>>, health_check_url: Option<String>) -> Result<Service, String> {
    // 输入验证
    if name.trim().is_empty() {
        return Err("服务名称不能为空".to_string());
    }
    if command.trim().is_empty() {
        return Err("启动命令不能为空".to_string());
    }

    let mut services = state.services.lock().unwrap();

    // 检查名称唯一性
    if services.values().any(|s| s.name == name.trim()) {
        return Err("服务名称已存在".to_string());
    }
    let id = uuid::Uuid::new_v4().to_string();
    let service = Service {
        id: id.clone(),
        name,
        command,
        path,
        sort_index: services.len() as i32,
        env_vars,
        log_path,
        service_type: service_type.unwrap_or_else(|| "normal".to_string()),
        depends_on: depends_on.unwrap_or_default(),
        health_check_url: health_check_url.unwrap_or_default(),
        health_check_interval: 0,
        favorite: false,
    };
    services.insert(id.clone(), service.clone());
    drop(services);
    save_all(&app, &state)?;
    Ok(service)
}

#[tauri::command]
fn update_service(app: AppHandle, state: State<AppState>, id: String, name: String, command: String, path: String, env_vars: HashMap<String, String>, log_path: String, service_type: Option<String>, depends_on: Option<Vec<String>>, health_check_url: Option<String>) -> Result<(), String> {
    // 输入验证
    if name.trim().is_empty() {
        return Err("服务名称不能为空".to_string());
    }
    if command.trim().is_empty() {
        return Err("启动命令不能为空".to_string());
    }

    let mut services = state.services.lock().unwrap();
    let service = services.get_mut(&id).ok_or("服务不存在")?;
    service.name = name;
    service.command = command;
    service.path = path;
    service.env_vars = env_vars;
    service.log_path = log_path;
    if let Some(st) = service_type {
        service.service_type = st;
    }
    if let Some(dep) = depends_on {
        service.depends_on = dep;
    }
    if let Some(hcu) = health_check_url {
        service.health_check_url = hcu;
    }
    let updated = service.clone();

    // 同步更新所有项目中的该服务
    let mut projects = state.projects.lock().unwrap();
    for project in projects.values_mut() {
        if let Some(svc) = project.services.iter_mut().find(|s| s.id == id) {
            *svc = updated.clone();
        }
    }

    drop(services);
    drop(projects);
    save_all(&app, &state)?;
    Ok(())
}

#[tauri::command]
fn delete_service(app: AppHandle, state: State<AppState>, id: String) -> Result<(), String> {
    let mut services = state.services.lock().unwrap();
    let mut projects = state.projects.lock().unwrap();
    let mut processes = state.processes.lock().unwrap();

    let service = services.remove(&id).ok_or("服务不存在")?;

    // 停止该服务的进程
    if let Some(mut process) = processes.remove(&service.name) {
        let _ = process.kill();
    }

    // 从所有项目中移除该服务
    for project in projects.values_mut() {
        project.services.retain(|s| s.id != id);
    }

    drop(services);
    drop(projects);
    drop(processes);
    save_all(&app, &state)?;
    Ok(())
}

// ===== 项目管理命令 =====

#[tauri::command]
fn get_projects(state: State<AppState>) -> Vec<Project> {
    let projects = state.projects.lock().unwrap();
    projects.values().cloned().collect()
}

#[tauri::command]
fn add_project(app: AppHandle, state: State<AppState>, name: String) -> Result<Project, String> {
    // 输入验证
    if name.trim().is_empty() {
        return Err("项目名称不能为空".to_string());
    }

    let mut projects = state.projects.lock().unwrap();

    // 检查名称唯一性
    if projects.values().any(|p| p.name == name.trim()) {
        return Err("项目名称已存在".to_string());
    }
    let id = uuid::Uuid::new_v4().to_string();
    let max_index = projects.values().map(|p| p.sort_index).max().unwrap_or(-1);
    let project = Project {
        id: id.clone(),
        name,
        services: Vec::new(),
        sort_index: max_index + 1,
        favorite: false,
    };
    projects.insert(id.clone(), project.clone());
    drop(projects);
    save_all(&app, &state)?;
    Ok(project)
}

#[tauri::command]
fn update_project(app: AppHandle, state: State<AppState>, id: String, name: String, favorite: Option<bool>) -> Result<(), String> {
    let mut projects = state.projects.lock().unwrap();
    let project = projects.get_mut(&id).ok_or("项目不存在")?;
    project.name = name;
    if let Some(f) = favorite {
        project.favorite = f;
    }
    drop(projects);
    save_all(&app, &state)?;
    Ok(())
}

#[tauri::command]
fn remove_project(app: AppHandle, state: State<AppState>, id: String) -> Result<(), String> {
    let mut projects = state.projects.lock().unwrap();
    let mut processes = state.processes.lock().unwrap();

    if let Some(project) = projects.remove(&id) {
        // 停止该项目下的所有服务进程
        for service in &project.services {
            if let Some(mut process) = processes.remove(&service.name) {
                let _ = process.kill();
            }
        }
    }
    drop(projects);
    drop(processes);
    save_all(&app, &state)?;
    Ok(())
}

#[tauri::command]
fn toggle_project_favorite(app: AppHandle, state: State<AppState>, id: String) -> Result<bool, String> {
    let mut projects = state.projects.lock().unwrap();
    let project = projects.get_mut(&id).ok_or("项目不存在")?;
    project.favorite = !project.favorite;
    let result = project.favorite;
    drop(projects);
    save_all(&app, &state)?;
    Ok(result)
}

#[tauri::command]
fn toggle_service_favorite(app: AppHandle, state: State<AppState>, id: String) -> Result<bool, String> {
    let mut services = state.services.lock().unwrap();
    let service = services.get_mut(&id).ok_or("服务不存在")?;
    service.favorite = !service.favorite;
    let result = service.favorite;
    drop(services);
    save_all(&app, &state)?;
    Ok(result)
}

#[tauri::command]
fn update_project_sort(app: AppHandle, state: State<AppState>, updates: Vec<(String, i32)>) -> Result<(), String> {
    let mut projects = state.projects.lock().unwrap();
    for (id, sort_index) in updates {
        if let Some(project) = projects.get_mut(&id) {
            project.sort_index = sort_index;
        }
    }
    drop(projects);
    save_all(&app, &state)?;
    Ok(())
}

#[tauri::command]
fn update_service_sort(app: AppHandle, state: State<AppState>, updates: Vec<(String, i32)>) -> Result<(), String> {
    let mut services = state.services.lock().unwrap();
    for (id, sort_index) in updates {
        if let Some(service) = services.get_mut(&id) {
            service.sort_index = sort_index;
        }
    }
    drop(services);
    save_all(&app, &state)?;
    Ok(())
}

#[tauri::command]
fn add_service_to_project(app: AppHandle, state: State<AppState>, project_id: String, service_id: String) -> Result<(), String> {
    let services = state.services.lock().unwrap();
    let mut projects = state.projects.lock().unwrap();

    let service = services.get(&service_id).ok_or("服务不存在")?;
    let project = projects.get_mut(&project_id).ok_or("项目不存在")?;

    // 检查是否已添加
    if project.services.iter().any(|s| s.id == service_id) {
        return Err("该项目已添加该服务".to_string());
    }

    project.services.push(service.clone());
    drop(services);
    drop(projects);
    save_all(&app, &state)?;
    Ok(())
}

#[tauri::command]
fn remove_service_from_project(app: AppHandle, state: State<AppState>, project_id: String, service_id: String) -> Result<(), String> {
    let mut projects = state.projects.lock().unwrap();
    let mut processes = state.processes.lock().unwrap();

    let project = projects.get_mut(&project_id).ok_or("项目不存在")?;

    // 找到服务名称用于停止进程
    if let Some(service) = project.services.iter().find(|s| s.id == service_id) {
        let service_name = service.name.clone();
        if let Some(mut process) = processes.remove(&service_name) {
            let _ = process.kill();
        }
    }

    project.services.retain(|s| s.id != service_id);
    drop(projects);
    drop(processes);
    save_all(&app, &state)?;
    Ok(())
}

fn spawn_with_realtime_log(app: &AppHandle, service: &Service, service_name: &str) -> Result<Child, String> {
    let log_path = if service.log_path.is_empty() {
        let log_dir = get_log_dir(app);
        let safe_name = service_name.replace(|c: char| !c.is_alphanumeric() && c != '_' && c != '-', "_");
        log_dir.join(format!("{}.log", safe_name))
    } else {
        PathBuf::from(&service.log_path)
    };

    // Windows 隐藏窗口标志
    #[cfg(windows)]
    const CREATE_NO_WINDOW: u32 = 0x08000000;

    // Windows 自动切换 UTF-8 编码，解决中文乱码
    #[cfg(windows)]
    let full_command = format!("chcp 65001 >nul && {}", service.command);
    #[cfg(not(windows))]
    let full_command = service.command.clone();

    // 如果用户指定了日志路径，直接重定向到文件（用户自己看文件）
    if !service.log_path.is_empty() {
        let mut cmd = Command::new("cmd");
        cmd.args(["/C", &full_command])
            .current_dir(&service.path)
            .envs(&service.env_vars);
        #[cfg(windows)]
        cmd.creation_flags(CREATE_NO_WINDOW);
        return cmd.spawn().map_err(|e| format!("启动失败: {}", e));
    }

    // 否则用 pipe 实时捕获，后台线程写入日志文件
    let mut cmd = Command::new("cmd");
    cmd.args(["/C", &full_command])
        .current_dir(&service.path)
        .envs(&service.env_vars)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let mut child = cmd.spawn().map_err(|e| format!("启动失败: {}", e))?;

    // 后台线程读取 stdout
    if let Some(stdout) = child.stdout.take() {
        let log_path = log_path.clone();
        thread::spawn(move || {
            let reader = BufReader::new(stdout);
            if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(&log_path) {
                for line in reader.lines() {
                    if let Ok(line) = line {
                        let _ = writeln!(file, "{}", strip_ansi(&line));
                        let _ = file.flush();
                    }
                }
            }
        });
    }

    // 后台线程读取 stderr
    if let Some(stderr) = child.stderr.take() {
        let log_path = log_path.clone();
        thread::spawn(move || {
            let reader = BufReader::new(stderr);
            if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(&log_path) {
                for line in reader.lines() {
                    if let Ok(line) = line {
                        let _ = writeln!(file, "{}", strip_ansi(&line));
                        let _ = file.flush();
                    }
                }
            }
        });
    }

    Ok(child)
}

// 解析服务依赖顺序（拓扑排序）
fn resolve_dependency_order(services: &HashMap<String, Service>, target_ids: &[String]) -> Vec<String> {
    let mut visited = std::collections::HashSet::new();
    let mut order = Vec::new();

    fn dfs(
        service_id: &str,
        services: &HashMap<String, Service>,
        visited: &mut std::collections::HashSet<String>,
        order: &mut Vec<String>,
    ) {
        if visited.contains(service_id) {
            return;
        }
        visited.insert(service_id.to_string());

        if let Some(service) = services.get(service_id) {
            // 先递归处理依赖
            for dep_id in &service.depends_on {
                dfs(dep_id, services, visited, order);
            }
            order.push(service_id.to_string());
        }
    }

    for id in target_ids {
        dfs(id, services, &mut visited, &mut order);
    }

    order
}

#[tauri::command]
fn start_service(app: AppHandle, state: State<AppState>, service_name: String, command: Option<String>) -> Result<(), String> {
    let services = state.services.lock().unwrap();
    let mut processes = state.processes.lock().unwrap();
    let mut detected_pids = state.detected_pids.lock().unwrap();

    let service = services.values().find(|s| s.name == service_name).ok_or("服务不存在")?;

    // 从 detected_pids 中移除（现在由 processes 管理）
    detected_pids.remove(&service_name);

    // 清理已退出的进程句柄
    let mut to_remove = Vec::new();
    for (name, process) in processes.iter_mut() {
        if let Ok(Some(_)) = process.try_wait() {
            to_remove.push(name.clone());
        }
    }
    for name in to_remove {
        processes.remove(&name);
    }

    // 如果已运行，先强制杀死
    if let Some(mut process) = processes.remove(&service_name) {
        kill_process_tree(process.id());
        let _ = process.wait();
    }

    // 如果指定了命令，创建临时服务副本
    let actual_service = if let Some(cmd) = command {
        let mut modified = service.clone();
        modified.command = cmd;
        modified
    } else {
        service.clone()
    };

    let child = spawn_with_realtime_log(&app, &actual_service, &service_name)?;
    processes.insert(service_name, child);
    Ok(())
}

#[tauri::command]
fn start_project(app: AppHandle, state: State<AppState>, project_id: String) -> Result<Vec<String>, String> {
    let services = state.services.lock().unwrap();
    let projects = state.projects.lock().unwrap();
    let mut processes = state.processes.lock().unwrap();
    let detected_pids = state.detected_pids.lock().unwrap();

    let project = projects.get(&project_id).ok_or("项目不存在")?;

    // 收集需要启动的服务ID（排除已在 processes 或 detected_pids 中的服务）
    let start_ids: Vec<String> = project.services.iter()
        .filter(|svc| !processes.contains_key(&svc.name) && !detected_pids.contains_key(&svc.name))
        .map(|svc| svc.id.clone())
        .collect();

    // 解析依赖顺序（拓扑排序）
    let ordered_ids = resolve_dependency_order(&services, &start_ids);

    let mut started = Vec::new();
    let mut errors = Vec::new();

    for svc_id in &ordered_ids {
        let global_svc = match services.get(svc_id) {
            Some(s) => s,
            None => continue,
        };

        // 检查是否已在运行（检查 processes 和 detected_pids）
        if processes.contains_key(&global_svc.name) || detected_pids.contains_key(&global_svc.name) {
            continue;
        }

        // 检查依赖是否都已启动
        let deps_ok = global_svc.depends_on.iter().all(|dep_id| {
            services.get(dep_id).map_or(false, |dep| {
                processes.contains_key(&dep.name) || detected_pids.contains_key(&dep.name)
            })
        });

        if !deps_ok {
            errors.push(format!("{}: 依赖服务未启动", global_svc.name));
            continue;
        }

        match spawn_with_realtime_log(&app, global_svc, &global_svc.name) {
            Ok(child) => {
                processes.insert(global_svc.name.clone(), child);
                started.push(global_svc.name.clone());
            }
            Err(e) => {
                errors.push(format!("{}: {}", global_svc.name, e));
            }
        }
    }

    if errors.is_empty() {
        Ok(started)
    } else {
        Err(format!("部分启动失败: {}", errors.join("; ")))
    }
}

#[tauri::command]
fn batch_start_services(app: AppHandle, state: State<AppState>, service_names: Vec<String>) -> Result<Vec<String>, String> {
    let services = state.services.lock().unwrap();
    let mut processes = state.processes.lock().unwrap();

    let mut started = Vec::new();
    let mut errors = Vec::new();

    for service_name in &service_names {
        // 如果已运行，跳过
        if processes.contains_key(service_name) {
            continue;
        }

        let service = match services.values().find(|s| s.name == *service_name) {
            Some(s) => s,
            None => {
                errors.push(format!("{}: 服务不存在", service_name));
                continue;
            }
        };

        match spawn_with_realtime_log(&app, service, service_name) {
            Ok(child) => {
                processes.insert(service_name.clone(), child);
                started.push(service_name.clone());
            }
            Err(e) => {
                errors.push(format!("{}: {}", service_name, e));
            }
        }
    }

    if errors.is_empty() {
        Ok(started)
    } else {
        Err(format!("部分启动失败: {}", errors.join("; ")))
    }
}

#[tauri::command]
fn batch_stop_services(state: State<AppState>, service_names: Vec<String>) -> Result<Vec<String>, String> {
    let mut processes = state.processes.lock().unwrap();

    let mut stopped = Vec::new();

    for service_name in &service_names {
        if let Some(mut process) = processes.remove(service_name) {
            kill_process_tree(process.id());
            let _ = process.wait();
            stopped.push(service_name.clone());
        }
    }

    Ok(stopped)
}

// 解析日志文件路径
fn resolve_log_path(path: &PathBuf) -> PathBuf {
    path.clone()
}

#[tauri::command]
fn get_service_logs(app: AppHandle, state: State<AppState>, service_name: String, tail_lines: Option<usize>, offset: Option<usize>) -> Result<String, String> {
    let services = state.services.lock().unwrap();

    let service = services.values().find(|s| s.name == service_name).ok_or("服务不存在")?;

    let log_file_path = if service.log_path.is_empty() {
        let log_dir = get_log_dir(&app);
        let safe_name = service_name.replace(|c: char| !c.is_alphanumeric() && c != '_' && c != '-', "_");
        log_dir.join(format!("{}.log", safe_name))
    } else {
        resolve_log_path(&PathBuf::from(&service.log_path))
    };

    if !log_file_path.exists() {
        return Ok(String::new());
    }

    // offset模式：从指定字节位置读取，用于轮询追加
    if let Some(byte_offset) = offset {
        let metadata = fs::metadata(&log_file_path).map_err(|e| format!("读取元数据失败: {}", e))?;
        let file_size = metadata.len() as usize;
        if byte_offset >= file_size {
            return Ok(String::new());
        }
        let mut file = fs::File::open(&log_file_path).map_err(|e| format!("打开日志失败: {}", e))?;
        use std::io::{Read, Seek, SeekFrom};
        file.seek(SeekFrom::Start(byte_offset as u64)).map_err(|e| format!("seek失败: {}", e))?;
        let mut buf = String::new();
        file.read_to_string(&mut buf).map_err(|e| format!("读取失败: {}", e))?;
        return Ok(buf);
    }

    // tail模式：返回最后N行，用于首次打开
    let content = fs::read_to_string(&log_file_path)
        .map_err(|e| format!("读取日志失败: {}", e))?;

    let lines = content.lines().collect::<Vec<_>>();
    let tail = tail_lines.unwrap_or(100);
    let start = if lines.len() > tail { lines.len() - tail } else { 0 };
    Ok(lines[start..].join("\n"))
}

#[tauri::command]
fn get_log_file_size(app: AppHandle, state: State<AppState>, service_name: String) -> Result<usize, String> {
    let services = state.services.lock().unwrap();
    let service = services.values().find(|s| s.name == service_name).ok_or("服务不存在")?;

    let log_file_path = if service.log_path.is_empty() {
        let log_dir = get_log_dir(&app);
        let safe_name = service_name.replace(|c: char| !c.is_alphanumeric() && c != '_' && c != '-', "_");
        log_dir.join(format!("{}.log", safe_name))
    } else {
        resolve_log_path(&PathBuf::from(&service.log_path))
    };

    if !log_file_path.exists() {
        return Ok(0);
    }

    let metadata = fs::metadata(&log_file_path).map_err(|e| format!("读取元数据失败: {}", e))?;
    Ok(metadata.len() as usize)
}

fn kill_process_tree(pid: u32) {
    // 先用 taskkill /T /F 杀掉整个进程树（包括子进程）
    let _ = Command::new("taskkill")
        .args(["/T", "/F", "/PID", &pid.to_string()])
        .output();

    // 额外检查：用 wmic 查找并杀掉该 PID 的所有子进程
    // 因为某些服务（如 Java、Redis）会创建独立的进程树
    #[cfg(windows)]
    {
        // 查找以该 PID 为父进程的所有子进程
        if let Ok(output) = Command::new("wmic")
            .args(["process", "where", &format!("ParentProcessId={}", pid), "get", "ProcessId"])
            .output()
        {
            let stdout = String::from_utf8_lossy(&output.stdout);
            for line in stdout.lines() {
                let trimmed = line.trim();
                if let Ok(child_pid) = trimmed.parse::<u32>() {
                    if child_pid > 0 {
                        // 递归杀掉子进程
                        let _ = Command::new("taskkill")
                            .args(["/T", "/F", "/PID", &child_pid.to_string()])
                            .output();
                    }
                }
            }
        }

        // 最后再用 /IM 模式杀掉可能残留的进程名匹配
        // 这是为了处理 Java 等可能重命名自身的情况
    }
}

#[tauri::command]
fn stop_project(state: State<AppState>, project_id: String) -> Result<Vec<String>, String> {
    let projects = state.projects.lock().unwrap();
    let mut processes = state.processes.lock().unwrap();
    let mut detected_pids = state.detected_pids.lock().unwrap();

    let project = projects.get(&project_id).ok_or("项目不存在")?;

    let mut stopped = Vec::new();
    for svc in &project.services {
        // 先尝试从 processes 中停止（程序启动的进程）
        if let Some(mut process) = processes.remove(&svc.name) {
            kill_process_tree(process.id());
            let _ = process.wait();
            stopped.push(svc.name.clone());
        }

        // 再尝试从 detected_pids 中停止（手动启动或之前启动的进程）
        if let Some(pid) = detected_pids.remove(&svc.name) {
            kill_process_tree(pid);
            if !stopped.contains(&svc.name) {
                stopped.push(svc.name.clone());
            }
        }
    }

    Ok(stopped)
}

#[tauri::command]
fn restart_project(app: AppHandle, state: State<AppState>, project_id: String) -> Result<Vec<String>, String> {
    // 先停止所有运行中的服务
    let stopped = stop_project(state.clone(), project_id.clone())?;

    // 等待一小段时间确保进程完全停止
    std::thread::sleep(std::time::Duration::from_millis(500));

    // 启动所有项目服务
    let started = start_project(app, state, project_id)?;

    let mut result = Vec::new();
    result.extend(stopped.iter().map(|s| format!("停止: {}", s)));
    result.extend(started.iter().map(|s| format!("启动: {}", s)));

    Ok(result)
}

// 检查 PID 是否仍在运行（Windows）
#[cfg(windows)]
fn is_pid_alive(pid: u32) -> bool {
    use std::process::Command;
    let output = Command::new("tasklist")
        .args(["/FI", &format!("PID eq {}", pid), "/NH"])
        .output();
    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            // 如果输出包含 PID 信息，说明进程还在运行
            stdout.contains(&pid.to_string())
        }
        Err(_) => false,
    }
}

// 通过命令行匹配检测系统中运行的服务（支持手动启动的服务）
#[cfg(windows)]
fn detect_running_services_by_command(services: &HashMap<String, Service>) -> HashMap<String, u32> {
    use std::process::Command;

    let mut result: HashMap<String, u32> = HashMap::new();

    // 使用 wmic 获取所有进程的命令行
    let output = Command::new("wmic")
        .args(["process", "get", "CommandLine,ProcessId", "/format:csv"])
        .output();

    let stdout = match output {
        Ok(out) => String::from_utf8_lossy(&out.stdout).to_string(),
        Err(_) => return result,
    };

    // 收集所有进程信息
    // 注意：wmic CSV 格式中，CommandLine 可能包含逗号，需要用引号处理
    let mut processes: Vec<(String, u32)> = Vec::new();
    for line in stdout.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with("Node") {
            continue;
        }

        // 解析 CSV 格式：Node,CommandLine,ProcessId
        // 处理引号包围的字段
        let mut in_quotes = false;
        let mut field_start = 0;
        let mut fields: Vec<String> = Vec::new();

        for (i, c) in line.char_indices() {
            match c {
                '"' => {
                    in_quotes = !in_quotes;
                }
                ',' if !in_quotes => {
                    let field = line[field_start..i].trim().trim_matches('"').to_string();
                    fields.push(field);
                    field_start = i + 1;
                }
                _ => {}
            }
        }
        // 添加最后一个字段
        let last_field = line[field_start..].trim().trim_matches('"').to_string();
        fields.push(last_field);

        if fields.len() >= 3 {
            let process_cmd = fields[1].trim().to_string();
            let pid_str = fields[2].trim();

            if let Ok(pid) = pid_str.parse::<u32>() {
                if !process_cmd.is_empty() {
                    processes.push((process_cmd, pid));
                }
            }
        }
    }

    // 遍历所有服务，检查是否有匹配的进程
    for (_service_id, service) in services {
        let cmd = service.command.trim();
        let service_name = service.name.clone();
        if cmd.is_empty() {
            continue;
        }

        // 提取命令的主要部分（去掉环境变量等前缀）
        // 例如 "npm run dev" 或 "java -jar app.jar"
        let cmd_parts: Vec<&str> = cmd.split_whitespace().collect();
        if cmd_parts.is_empty() {
            continue;
        }

        // 在进程列表中查找匹配的命令行
        for (process_cmd, pid) in &processes {
            let process_lower = process_cmd.to_lowercase();
            let cmd_lower = cmd.to_lowercase();

            // 精确匹配：进程命令行包含完整的服务命令
            // 或者服务命令包含进程命令行（处理参数顺序不同的情况）
            if process_lower.contains(&cmd_lower) || cmd_lower.contains(&process_lower) {
                result.insert(service_name.clone(), *pid);
                println!("通过命令行匹配检测到服务 {} (PID: {}), 命令: {}", service_name, pid, process_cmd);
                break;
            }

            // 特殊处理 npm/pnpm/yarn 命令
            // npm run dev 实际上会启动 node 进程
            if cmd_parts[0] == "npm" || cmd_parts[0] == "pnpm" || cmd_parts[0] == "yarn" {
                // 检查是否是 node 进程运行 npm/pnpm/yarn 脚本
                if process_lower.contains("node") || process_lower.contains("npm") || process_lower.contains("pnpm") {
                    // 进一步检查参数是否匹配
                    if cmd_parts.len() > 2 && cmd_parts[1] == "run" {
                        let script_name = cmd_parts[2];
                        if process_lower.contains(script_name) {
                            result.insert(service_name.clone(), *pid);
                            println!("通过 npm/pnpm 脚本匹配检测到服务 {} (PID: {}), 命令: {}", service_name, pid, process_cmd);
                            break;
                        }
                    }
                }
            }

            // 模糊匹配：检查命令的主要部分
            // 例如 "npm" 或 "java" 是否在进程命令行中
            let main_cmd = cmd_parts[0].to_lowercase();
            if process_lower.starts_with(&main_cmd) || process_lower.contains(&format!("{} ", main_cmd)) {
                // 进一步验证：检查工作目录或更多参数
                // 这里简化处理，只匹配主命令
                if cmd_parts.len() > 1 {
                    // 如果有多个参数，检查是否都包含
                    let all_match = cmd_parts[1..].iter().all(|part| {
                        process_lower.contains(&part.to_lowercase())
                    });
                    if all_match {
                        result.insert(service_name.clone(), *pid);
                        println!("通过模糊匹配检测到服务 {} (PID: {}), 命令: {}", service_name, pid, process_cmd);
                        break;
                    }
                } else {
                    // 只有主命令，直接匹配
                    result.insert(service_name.clone(), *pid);
                    println!("通过主命令匹配检测到服务 {} (PID: {}), 命令: {}", service_name, pid, process_cmd);
                    break;
                }
            }
        }
    }

    result
}

#[cfg(not(windows))]
fn is_pid_alive(pid: u32) -> bool {
    // Unix: kill(pid, 0) 检查进程是否存在
    unsafe { libc::kill(pid as i32, 0) == 0 }
}

#[tauri::command]
fn get_running_services(state: State<AppState>) -> Vec<String> {
    let mut processes = state.processes.lock().unwrap();
    let mut detected_pids = state.detected_pids.lock().unwrap();
    let mut running = std::collections::HashSet::new();
    let mut exited = Vec::new();

    // 检查通过 processes 启动的服务
    for (name, process) in processes.iter_mut() {
        match process.try_wait() {
            Ok(Some(_)) => {
                // 父进程已退出，检查子进程是否还在
                let pid = process.id();
                if is_pid_alive(pid) {
                    running.insert(name.clone());
                } else {
                    exited.push(name.clone());
                }
            }
            Ok(None) => {
                // 进程仍在运行
                running.insert(name.clone());
            }
            Err(_) => {
                exited.push(name.clone());
            }
        }
    }

    // 检查启动时检测到的运行中服务（通过 PID）
    let mut detected_to_remove = Vec::new();
    for (name, pid) in detected_pids.iter() {
        // 如果已经在 processes 中，跳过
        if processes.contains_key(name) {
            detected_to_remove.push(name.clone());
            continue;
        }
        // 检查 PID 是否仍在运行
        if is_pid_alive(*pid) {
            running.insert(name.clone());
        } else {
            detected_to_remove.push(name.clone());
        }
    }
    // 清理已不再运行的 detected_pids
    for name in detected_to_remove {
        detected_pids.remove(&name);
    }

    running.into_iter().collect()
}

// 手动触发检测运行中的服务（用于调试）
#[tauri::command]
fn detect_running_services(state: State<AppState>) -> Vec<String> {
    let services = state.services.lock().unwrap();
    let mut detected_pids = state.detected_pids.lock().unwrap();

    // 通过命令行匹配检测
    let cmd_detected = detect_running_services_by_command(&services);
    let mut result = Vec::new();

    for (service_name, pid) in cmd_detected {
        if !detected_pids.contains_key(&service_name) {
            detected_pids.insert(service_name.clone(), pid);
            result.push(format!("{} (PID: {})", service_name, pid));
        }
    }

    // 返回当前所有检测到的服务
    let all_detected: Vec<String> = detected_pids.iter()
        .map(|(name, pid)| format!("{} (PID: {})", name, pid))
        .collect();

    println!("手动检测结果: {:?}", all_detected);
    all_detected
}

#[tauri::command]
fn stop_service(state: State<AppState>, service_name: String) -> Result<(), String> {
    let mut processes = state.processes.lock().unwrap();
    let mut detected_pids = state.detected_pids.lock().unwrap();

    // 先尝试从 processes 中停止（程序启动的进程）
    if let Some(mut process) = processes.remove(&service_name) {
        kill_process_tree(process.id());
        let _ = process.wait();
    }

    // 再尝试从 detected_pids 中停止（手动启动或之前启动的进程）
    if let Some(pid) = detected_pids.remove(&service_name) {
        kill_process_tree(pid);
    }

    Ok(())
}

#[tauri::command]
fn restart_service(app: AppHandle, state: State<AppState>, service_name: String) -> Result<(), String> {
    // 先停止
    {
        let mut processes = state.processes.lock().unwrap();
        let mut detected_pids = state.detected_pids.lock().unwrap();

        // 从 detected_pids 中移除
        detected_pids.remove(&service_name);

        if let Some(mut process) = processes.remove(&service_name) {
            kill_process_tree(process.id());
            let _ = process.wait();
        }
    }

    // 再启动（复用 start_service 逻辑）
    start_service(app, state, service_name, None)
}

#[tauri::command]
fn get_service_status(state: State<AppState>, service_name: String) -> ServiceStatus {
    let processes = state.processes.lock().unwrap();

    if let Some(process) = processes.get(&service_name) {
        ServiceStatus {
            name: service_name,
            status: "running".to_string(),
            pid: Some(process.id()),
        }
    } else {
        ServiceStatus {
            name: service_name,
            status: "stopped".to_string(),
            pid: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthCheckResult {
    pub service_name: String,
    pub is_healthy: bool,
    pub message: String,
    pub response_time_ms: u64,
}

#[tauri::command]
fn check_service_health(state: State<AppState>, service_name: String, health_check_url: Option<String>) -> HealthCheckResult {
    let processes = state.processes.lock().unwrap();

    // 检查进程是否在运行
    if let Some(process) = processes.get(&service_name) {
        let pid = process.id();
        // 如果配置了健康检查 URL，显示 URL 信息
        let message = if let Some(ref url) = health_check_url {
            if !url.is_empty() {
                format!("运行中 (PID: {}) - 检查地址: {}", pid, url)
            } else {
                format!("运行中 (PID: {})", pid)
            }
        } else {
            format!("运行中 (PID: {})", pid)
        };
        HealthCheckResult {
            service_name,
            is_healthy: true,
            message,
            response_time_ms: 0,
        }
    } else {
        HealthCheckResult {
            service_name,
            is_healthy: false,
            message: "未运行".to_string(),
            response_time_ms: 0,
        }
    }
}

#[derive(Serialize, Deserialize)]
struct ConfigBundle {
    services: Vec<Service>,
    projects: Vec<Project>,
}

#[tauri::command]
fn get_config_file_path(app: AppHandle) -> String {
    get_config_path(&app).to_string_lossy().to_string()
}

#[tauri::command]
fn export_config(state: State<AppState>, export_path: String) -> Result<(), String> {
    let services = state.services.lock().unwrap();
    let projects = state.projects.lock().unwrap();

    let config = AppConfig {
        services: services.values().cloned().collect(),
        projects: projects.values().cloned().collect(),
        settings: AppSettings::default(),
        running_pids: HashMap::default(),
    };

    let json = serde_json::to_string_pretty(&config).map_err(|e| format!("序列化失败: {}", e))?;

    let path = PathBuf::from(&export_path);
    println!("导出路径: {:?}", path);

    // 确保父目录存在
    if let Some(parent) = path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| format!("创建目录失败: {}", e))?;
        }
    }

    // 直接写入文件
    fs::write(&path, &json).map_err(|e| format!("写入文件失败: {}, 路径: {:?}", e, path))?;

    println!("导出成功: {:?}", path);
    Ok(())
}

#[tauri::command]
fn import_config(app: AppHandle, state: State<AppState>, import_path: String) -> Result<(), String> {
    let import_path = PathBuf::from(&import_path);

    if !import_path.exists() {
        return Err("导入文件不存在".to_string());
    }

    let json = fs::read_to_string(&import_path).map_err(|e| format!("读取文件失败: {}", e))?;

    // 尝试解析为 AppConfig 格式
    if let Ok(config) = serde_json::from_str::<AppConfig>(&json) {
        let mut services = state.services.lock().unwrap();
        let mut projects = state.projects.lock().unwrap();
        *services = config.services.into_iter().map(|s| (s.id.clone(), s)).collect();
        *projects = config.projects.into_iter().map(|p| (p.id.clone(), p)).collect();
        drop(services);
        drop(projects);
        save_all(&app, &state)?;
        return Ok(());
    }

    // 尝试解析为旧的 ConfigBundle 格式
    if let Ok(bundle) = serde_json::from_str::<ConfigBundle>(&json) {
        let mut services = state.services.lock().unwrap();
        let mut projects = state.projects.lock().unwrap();
        *services = bundle.services.into_iter().map(|s| (s.id.clone(), s)).collect();
        *projects = bundle.projects.into_iter().map(|p| (p.id.clone(), p)).collect();
        drop(services);
        drop(projects);
        save_all(&app, &state)?;
        return Ok(());
    }

    // 尝试解析为单个 services 数组
    if let Ok(services_vec) = serde_json::from_str::<Vec<Service>>(&json) {
        let mut services = state.services.lock().unwrap();
        *services = services_vec.into_iter().map(|s| (s.id.clone(), s)).collect();
        drop(services);
        save_all(&app, &state)?;
        return Ok(());
    }

    // 尝试解析为单个 projects 数组
    if let Ok(projects_vec) = serde_json::from_str::<Vec<Project>>(&json) {
        let mut projects = state.projects.lock().unwrap();
        *projects = projects_vec.into_iter().map(|p| (p.id.clone(), p)).collect();
        drop(projects);
        save_all(&app, &state)?;
        return Ok(());
    }

    Err("无法识别的配置文件格式".to_string())
}

#[tauri::command]
fn open_directory(path: String) -> Result<(), String> {
    let path = PathBuf::from(&path);
    if !path.exists() {
        return Err("目录不存在".to_string());
    }
    #[cfg(windows)]
    {
        std::process::Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("打开目录失败: {}", e))?;
    }
    #[cfg(not(windows))]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("打开目录失败: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
fn open_terminal(path: String) -> Result<(), String> {
    let path = PathBuf::from(&path);
    if !path.exists() {
        return Err("目录不存在".to_string());
    }
    #[cfg(windows)]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "cmd", "/K", "cd", "/d", path.to_str().unwrap_or("")])
            .spawn()
            .map_err(|e| format!("打开终端失败: {}", e))?;
    }
    #[cfg(not(windows))]
    {
        std::process::Command::new("x-terminal-emulator")
            .current_dir(&path)
            .spawn()
            .map_err(|e| format!("打开终端失败: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
fn get_available_commands(path: String, service_type: String) -> Result<Vec<String>, String> {
    let path = PathBuf::from(&path);
    if !path.exists() {
        return Err("目录不存在".to_string());
    }

    match service_type.as_str() {
        "npm" => {
            let package_json_path = path.join("package.json");
            if !package_json_path.exists() {
                return Err("未找到 package.json 文件".to_string());
            }
            let content = fs::read_to_string(&package_json_path)
                .map_err(|e| format!("读取 package.json 失败: {}", e))?;
            let json: serde_json::Value = serde_json::from_str(&content)
                .map_err(|e| format!("解析 package.json 失败: {}", e))?;
            if let Some(scripts) = json.get("scripts").and_then(|s| s.as_object()) {
                let commands: Vec<String> = scripts.keys().cloned().collect();
                Ok(commands)
            } else {
                Ok(vec![])
            }
        }
        "maven" => {
            let pom_path = path.join("pom.xml");
            if !pom_path.exists() {
                return Err("未找到 pom.xml 文件".to_string());
            }
            // 返回常用maven命令
            let commands = vec![
                "clean".to_string(),
                "compile".to_string(),
                "test".to_string(),
                "package".to_string(),
                "install".to_string(),
                "deploy".to_string(),
                "clean install".to_string(),
                "clean package".to_string(),
            ];
            Ok(commands)
        }
        _ => Ok(vec![]),
    }
}

#[tauri::command]
#[allow(non_snake_case)]
async fn execute_command(command: String, workDir: String) -> Result<String, String> {
    let work_dir = PathBuf::from(&workDir);
    if !work_dir.exists() {
        return Err("工作目录不存在".to_string());
    }

    let cmd = command.trim().to_string();
    if cmd.is_empty() {
        return Err("命令不能为空".to_string());
    }

    // 用 spawn_blocking 把阻塞逻辑放到独立线程池，不阻塞 tokio 运行时
    let result = tokio::task::spawn_blocking(move || -> Result<String, String> {
        let (tx, rx) = std::sync::mpsc::channel();
        let timeout_secs = 30u64;

        std::thread::spawn(move || {
            #[cfg(windows)]
            const CREATE_NO_WINDOW: u32 = 0x08000000;

            #[cfg(windows)]
            let child = {
                let full_command = format!("chcp 65001 >nul && {}", cmd);
                let mut cmd = std::process::Command::new("cmd");
                cmd.args(["/C", &full_command])
                    .current_dir(&work_dir)
                    .stdout(std::process::Stdio::piped())
                    .stderr(std::process::Stdio::piped())
                    .creation_flags(CREATE_NO_WINDOW);
                cmd.spawn()
            };

            #[cfg(not(windows))]
            let child = {
                let mut cmd = std::process::Command::new("sh");
                cmd.args(["-c", &cmd])
                    .current_dir(&work_dir)
                    .stdout(std::process::Stdio::piped())
                    .stderr(std::process::Stdio::piped());
                cmd.spawn()
            };

            match child {
                Ok(mut child) => {
                    let start = std::time::Instant::now();
                    loop {
                        match child.try_wait() {
                            Ok(Some(_)) => {
                                let output = child.wait_with_output();
                                let _ = tx.send(output);
                                return;
                            }
                            Ok(None) => {
                                if start.elapsed().as_secs() >= timeout_secs {
                                    let _ = child.kill();
                                    let _ = child.wait();
                                    let _ = tx.send(Err(std::io::Error::new(
                                        std::io::ErrorKind::TimedOut,
                                        "命令执行超时(30秒)，长时间运行的命令请使用服务启动功能",
                                    )));
                                    return;
                                }
                                std::thread::sleep(std::time::Duration::from_millis(100));
                            }
                            Err(e) => {
                                let _ = tx.send(Err(e));
                                return;
                            }
                        }
                    }
                }
                Err(e) => {
                    let _ = tx.send(Err(e));
                }
            }
        });

        let output = rx.recv()
            .map_err(|_| "命令执行失败".to_string())?
            .map_err(|e| format!("执行失败: {}", e))?;

        // Windows下尝试用GBK解码，失败则用UTF-8
        #[cfg(windows)]
        let (stdout, stderr) = {
            use encoding_rs::GBK;
            let (stdout_decoded, _, _) = GBK.decode(&output.stdout);
            let (stderr_decoded, _, _) = GBK.decode(&output.stderr);
            (stdout_decoded.to_string(), stderr_decoded.to_string())
        };

        #[cfg(not(windows))]
        let (stdout, stderr) = {
            (String::from_utf8_lossy(&output.stdout).to_string(),
             String::from_utf8_lossy(&output.stderr).to_string())
        };

        let mut result = String::new();
        if !stdout.is_empty() {
            result.push_str(&stdout);
        }
        if !stderr.is_empty() {
            if !result.is_empty() {
                result.push('\n');
            }
            result.push_str(&stderr);
        }

        if result.is_empty() && !output.status.success() {
            return Err(format!("命令执行失败，退出码: {}", output.status.code().unwrap_or(-1)));
        }

        Ok(result)
    }).await.map_err(|e| format!("任务执行失败: {}", e))?;

    result
}


pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            use tauri::Manager;
            use tauri::menu::{MenuBuilder, MenuItemBuilder};

            let config = load_config(app.handle());
            let services: HashMap<String, Service> = config.services.into_iter().map(|s| (s.id.clone(), s)).collect();
            let projects: HashMap<String, Project> = config.projects.into_iter().map(|p| (p.id.clone(), p)).collect();

            // 1. 检查之前保存的 PID 是否仍在运行
            let mut detected_pids: HashMap<String, u32> = HashMap::new();
            for (service_name, pid) in &config.running_pids {
                if is_pid_alive(*pid) {
                    detected_pids.insert(service_name.clone(), *pid);
                    println!("通过 PID 检测到服务 {} (PID: {}) 仍在运行", service_name, pid);
                }
            }

            // 2. 通过命令行匹配检测手动启动的服务
            let cmd_detected = detect_running_services_by_command(&services);
            for (service_name, pid) in cmd_detected {
                // 只添加尚未检测到的服务
                if !detected_pids.contains_key(&service_name) {
                    detected_pids.insert(service_name.clone(), pid);
                }
            }

            // 创建系统托盘菜单
            let show_item = MenuItemBuilder::with_id("show", "显示窗口").build(app)?;
            let hide_item = MenuItemBuilder::with_id("hide", "隐藏窗口").build(app)?;
            let exit_item = MenuItemBuilder::with_id("exit", "退出程序").build(app)?;

            let menu = MenuBuilder::new(app)
                .item(&show_item)
                .item(&hide_item)
                .separator()
                .item(&exit_item)
                .build()?;

            // 设置托盘菜单
            let tray = app.tray_by_id("main").unwrap();
            tray.set_menu(Some(menu.clone()))?;

            // 处理托盘菜单事件
            let app_handle = app.handle().clone();
            tray.on_menu_event(move |app, event| {
                match event.id().as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "hide" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.hide();
                        }
                    }
                    "exit" => {
                        // 保存配置并退出
                        if let Some(state) = app.try_state::<AppState>() {
                            let _ = save_all(app, &state);
                        }
                        app.exit(0);
                    }
                    _ => {}
                }
            });

            // 处理托盘点击事件 - 左键显示窗口
            let app_handle2 = app.handle().clone();
            tray.on_tray_icon_event(move |_tray, event| {
                if let tauri::tray::TrayIconEvent::Click { button: tauri::tray::MouseButton::Left, button_state: tauri::tray::MouseButtonState::Up, .. } = event {
                    if let Some(window) = app_handle2.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            });

            // 处理窗口关闭事件 - 最小化到托盘
            if let Some(window) = app.get_webview_window("main") {
                let window_clone = window.clone();
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        // 阻止默认关闭行为
                        api.prevent_close();
                        // 隐藏窗口
                        let _ = window_clone.hide();
                    }
                });
            }

            app.manage(AppState {
                services: Mutex::new(services),
                projects: Mutex::new(projects),
                processes: Mutex::new(HashMap::new()),
                detected_pids: Mutex::new(detected_pids),
                settings: Mutex::new(config.settings),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // 服务管理
            get_services,
            add_service,
            update_service,
            delete_service,
            update_service_sort,
            // 项目管理
            get_projects,
            add_project,
            update_project,
            remove_project,
            toggle_project_favorite,
            toggle_service_favorite,
            update_project_sort,
            add_service_to_project,
            remove_service_from_project,
            // 服务运行
            start_service,
            stop_service,
            restart_service,
            start_project,
            stop_project,
            restart_project,
            get_running_services,
            detect_running_services,
            get_service_logs,
            get_log_file_size,
            get_service_status,
            check_service_health,
            batch_start_services,
            batch_stop_services,
            // 配置管理
            get_config_file_path,
            export_config,
            import_config,
            open_directory,
            open_terminal,
            get_available_commands,
            execute_command,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
