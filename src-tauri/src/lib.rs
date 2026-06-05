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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Service {
    pub id: String,
    pub name: String,
    pub command: String,
    pub path: String,
    pub startup_type: String,
    #[serde(default)]
    pub sort_index: i32,
    #[serde(default)]
    pub env_vars: HashMap<String, String>,
    #[serde(default)]
    pub log_path: String,
    #[serde(default = "default_category")]
    pub category: String,
}

fn default_category() -> String {
    "basic".to_string()
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
}

struct AppState {
    services: Mutex<HashMap<String, Service>>,
    projects: Mutex<HashMap<String, Project>>,
    processes: Mutex<HashMap<String, Child>>,
    settings: Mutex<AppSettings>,
}

fn get_data_dir(_app: &AppHandle) -> PathBuf {
    let exe_path = std::env::current_exe().expect("无法获取程序路径");
    let exe_dir = exe_path.parent().expect("无法获取程序目录");
    let config_dir = exe_dir.join("config");
    fs::create_dir_all(&config_dir).ok();
    config_dir
}

fn get_log_dir(app: &AppHandle) -> PathBuf {
    let dir = get_data_dir(app).join("logs");
    fs::create_dir_all(&dir).ok();
    dir
}

fn load_settings(app: &AppHandle) -> AppSettings {
    let path = get_data_dir(app).join("settings.json");
    if !path.exists() {
        return AppSettings::default();
    }
    match fs::read_to_string(&path) {
        Ok(json) => serde_json::from_str(&json).unwrap_or_default(),
        Err(_) => AppSettings::default(),
    }
}

fn get_services_path(app: &AppHandle) -> PathBuf {
    get_data_dir(app).join("services.json")
}

fn get_projects_path(app: &AppHandle) -> PathBuf {
    get_data_dir(app).join("projects.json")
}

fn save_services(app: &AppHandle, services: &HashMap<String, Service>) -> Result<(), String> {
    let path = get_services_path(app);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("创建目录失败: {}", e))?;
    }
    let vec: Vec<Service> = services.values().cloned().collect();
    let json = serde_json::to_string_pretty(&vec).map_err(|e| format!("序列化失败: {}", e))?;
    fs::write(&path, json).map_err(|e| format!("写入文件失败: {}", e))?;
    Ok(())
}

fn load_services(app: &AppHandle) -> HashMap<String, Service> {
    let path = get_services_path(app);
    if !path.exists() {
        return HashMap::new();
    }
    match fs::read_to_string(&path) {
        Ok(json) => {
            let vec: Vec<Service> = serde_json::from_str(&json).unwrap_or_default();
            vec.into_iter().map(|s| (s.id.clone(), s)).collect()
        }
        Err(_) => HashMap::new(),
    }
}

fn save_projects(app: &AppHandle, projects: &HashMap<String, Project>) -> Result<(), String> {
    let path = get_projects_path(app);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("创建目录失败: {}", e))?;
    }
    let vec: Vec<Project> = projects.values().cloned().collect();
    let json = serde_json::to_string_pretty(&vec).map_err(|e| format!("序列化失败: {}", e))?;
    fs::write(&path, json).map_err(|e| format!("写入文件失败: {}", e))?;
    Ok(())
}

fn load_projects(app: &AppHandle) -> HashMap<String, Project> {
    let path = get_projects_path(app);
    if !path.exists() {
        return HashMap::new();
    }
    match fs::read_to_string(&path) {
        Ok(json) => {
            let vec: Vec<Project> = serde_json::from_str(&json).unwrap_or_default();
            vec.into_iter().map(|p| (p.id.clone(), p)).collect()
        }
        Err(_) => HashMap::new(),
    }
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
fn add_service(app: AppHandle, state: State<AppState>, name: String, command: String, path: String, startup_type: String, env_vars: HashMap<String, String>, log_path: String, category: Option<String>) -> Result<Service, String> {
    let mut services = state.services.lock().unwrap();
    let id = uuid::Uuid::new_v4().to_string();
    let service = Service {
        id: id.clone(),
        name,
        command,
        path,
        startup_type,
        sort_index: services.len() as i32,
        env_vars,
        log_path,
        category: category.unwrap_or_else(|| "basic".to_string()),
    };
    services.insert(id.clone(), service.clone());
    save_services(&app, &services)?;
    Ok(service)
}

#[tauri::command]
fn update_service(app: AppHandle, state: State<AppState>, id: String, name: String, command: String, path: String, startup_type: String, env_vars: HashMap<String, String>, log_path: String, category: Option<String>) -> Result<(), String> {
    let mut services = state.services.lock().unwrap();
    let service = services.get_mut(&id).ok_or("服务不存在")?;
    service.name = name;
    service.command = command;
    service.path = path;
    service.startup_type = startup_type;
    service.env_vars = env_vars;
    service.log_path = log_path;
    if let Some(cat) = category {
        service.category = cat;
    }
    let updated = service.clone();

    // 同步更新所有项目中的该服务
    let mut projects = state.projects.lock().unwrap();
    for project in projects.values_mut() {
        if let Some(svc) = project.services.iter_mut().find(|s| s.id == id) {
            *svc = updated.clone();
        }
    }

    save_services(&app, &services)?;
    save_projects(&app, &projects)?;
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

    save_services(&app, &services)?;
    save_projects(&app, &projects)?;
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
    let mut projects = state.projects.lock().unwrap();
    let id = uuid::Uuid::new_v4().to_string();
    let max_index = projects.values().map(|p| p.sort_index).max().unwrap_or(-1);
    let project = Project {
        id: id.clone(),
        name,
        services: Vec::new(),
        sort_index: max_index + 1,
    };
    projects.insert(id.clone(), project.clone());
    save_projects(&app, &projects)?;
    Ok(project)
}

#[tauri::command]
fn update_project(app: AppHandle, state: State<AppState>, id: String, name: String) -> Result<(), String> {
    let mut projects = state.projects.lock().unwrap();
    let project = projects.get_mut(&id).ok_or("项目不存在")?;
    project.name = name;
    save_projects(&app, &projects)?;
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
    save_projects(&app, &projects)?;
    Ok(())
}

#[tauri::command]
fn update_project_sort(app: AppHandle, state: State<AppState>, updates: Vec<(String, i32)>) -> Result<(), String> {
    let mut projects = state.projects.lock().unwrap();
    for (id, sort_index) in updates {
        if let Some(project) = projects.get_mut(&id) {
            project.sort_index = sort_index;
        }
    }
    save_projects(&app, &projects)?;
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
    save_services(&app, &services)?;
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
    save_projects(&app, &projects)?;
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
    save_projects(&app, &projects)?;
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

#[tauri::command]
fn start_service(app: AppHandle, state: State<AppState>, service_name: String) -> Result<(), String> {
    let services = state.services.lock().unwrap();
    let mut processes = state.processes.lock().unwrap();

    let service = services.values().find(|s| s.name == service_name).ok_or("服务不存在")?;

    // 如果已运行，先停止
    if let Some(mut process) = processes.remove(&service_name) {
        kill_process_tree(process.id());
        let _ = process.wait();
    }

    let child = spawn_with_realtime_log(&app, service, &service_name)?;
    processes.insert(service_name, child);
    Ok(())
}

#[tauri::command]
fn start_project(app: AppHandle, state: State<AppState>, project_id: String) -> Result<Vec<String>, String> {
    let projects = state.projects.lock().unwrap();
    let services = state.services.lock().unwrap();
    let mut processes = state.processes.lock().unwrap();

    let project = projects.get(&project_id).ok_or("项目不存在")?;

    let mut started = Vec::new();
    let mut errors = Vec::new();

    for svc in &project.services {
        if svc.startup_type != "auto" {
            continue;
        }
        if processes.contains_key(&svc.name) {
            continue;
        }

        let global_svc = match services.get(&svc.id) {
            Some(s) => s,
            None => continue,
        };

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

// 解析日志文件路径：如果是目录，自动找最新的 .out/.log 文件
fn resolve_log_path(path: &PathBuf) -> PathBuf {
    if path.is_dir() {
        // 找目录下最新的 .out 文件，没有就找最新的 .log 文件
        let mut best: Option<(std::time::SystemTime, PathBuf)> = None;
        if let Ok(entries) = fs::read_dir(path) {
            for entry in entries.flatten() {
                let p = entry.path();
                let ext = p.extension().and_then(|e| e.to_str()).unwrap_or("");
                if ext == "out" || ext == "log" {
                    if let Ok(meta) = fs::metadata(&p) {
                        if let Ok(modified) = meta.modified() {
                            if best.is_none() || modified > best.as_ref().unwrap().0 {
                                best = Some((modified, p));
                            }
                        }
                    }
                }
            }
        }
        best.map(|(_, p)| p).unwrap_or_else(|| path.clone())
    } else {
        path.clone()
    }
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
    // 用 taskkill /T /F 杀掉整个进程树（包括子进程）
    let _ = Command::new("taskkill")
        .args(["/T", "/F", "/PID", &pid.to_string()])
        .output();
}

#[tauri::command]
fn stop_project(state: State<AppState>, project_id: String) -> Result<Vec<String>, String> {
    let projects = state.projects.lock().unwrap();
    let mut processes = state.processes.lock().unwrap();

    let project = projects.get(&project_id).ok_or("项目不存在")?;

    let mut stopped = Vec::new();
    for svc in &project.services {
        if let Some(mut process) = processes.remove(&svc.name) {
            kill_process_tree(process.id());
            let _ = process.wait();
            stopped.push(svc.name.clone());
        }
    }

    Ok(stopped)
}

#[tauri::command]
fn get_running_services(state: State<AppState>) -> Vec<String> {
    let mut processes = state.processes.lock().unwrap();
    let mut running = Vec::new();
    let mut exited = Vec::new();

    for (name, process) in processes.iter_mut() {
        match process.try_wait() {
            Ok(Some(_)) => {
                // 进程已退出
                exited.push(name.clone());
            }
            Ok(None) => {
                // 进程仍在运行
                running.push(name.clone());
            }
            Err(_) => {
                exited.push(name.clone());
            }
        }
    }

    // 清理已退出的进程
    for name in exited {
        processes.remove(&name);
    }

    running
}

#[tauri::command]
fn stop_service(state: State<AppState>, service_name: String) -> Result<(), String> {
    let mut processes = state.processes.lock().unwrap();

    if let Some(mut process) = processes.remove(&service_name) {
        kill_process_tree(process.id());
        let _ = process.wait();
    }

    Ok(())
}

#[tauri::command]
fn restart_service(app: AppHandle, state: State<AppState>, service_name: String) -> Result<(), String> {
    // 先停止
    {
        let mut processes = state.processes.lock().unwrap();
        if let Some(mut process) = processes.remove(&service_name) {
            kill_process_tree(process.id());
            let _ = process.wait();
        }
    }

    // 再启动（复用 start_service 逻辑）
    start_service(app, state, service_name)
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

#[tauri::command]
fn get_settings(state: State<AppState>) -> AppSettings {
    let settings = state.settings.lock().unwrap();
    settings.clone()
}

#[tauri::command]
fn get_config_dir(app: AppHandle) -> String {
    get_data_dir(&app).to_string_lossy().to_string()
}

#[derive(Serialize, Deserialize)]
struct ConfigBundle {
    services: Vec<Service>,
    projects: Vec<Project>,
}

#[tauri::command]
fn export_config(state: State<AppState>, export_path: String) -> Result<(), String> {
    let services = state.services.lock().unwrap();
    let projects = state.projects.lock().unwrap();

    let bundle = ConfigBundle {
        services: services.values().cloned().collect(),
        projects: projects.values().cloned().collect(),
    };

    let json = serde_json::to_string_pretty(&bundle).map_err(|e| format!("序列化失败: {}", e))?;
    fs::write(&export_path, json).map_err(|e| format!("写入文件失败: {}", e))?;

    Ok(())
}

#[tauri::command]
fn import_config(app: AppHandle, state: State<AppState>, import_path: String) -> Result<(), String> {
    let import_path = PathBuf::from(&import_path);

    if !import_path.exists() {
        return Err("导入文件不存在".to_string());
    }

    let json = fs::read_to_string(&import_path).map_err(|e| format!("读取文件失败: {}", e))?;

    // 尝试解析为 bundle 格式 { "services": [...], "projects": [...] }
    if let Ok(bundle) = serde_json::from_str::<ConfigBundle>(&json) {
        let services_map: HashMap<String, Service> = bundle.services.into_iter().map(|s| (s.id.clone(), s)).collect();
        let projects_map: HashMap<String, Project> = bundle.projects.into_iter().map(|p| (p.id.clone(), p)).collect();

        save_services(&app, &services_map)?;
        save_projects(&app, &projects_map)?;

        let mut services = state.services.lock().unwrap();
        *services = services_map;
        let mut projects = state.projects.lock().unwrap();
        *projects = projects_map;

        return Ok(());
    }

    // 尝试解析为单个 services 数组 [...]
    if let Ok(services_vec) = serde_json::from_str::<Vec<Service>>(&json) {
        let services_map: HashMap<String, Service> = services_vec.into_iter().map(|s| (s.id.clone(), s)).collect();
        save_services(&app, &services_map)?;

        let mut services = state.services.lock().unwrap();
        *services = services_map;

        return Ok(());
    }

    // 尝试解析为单个 projects 数组 [...]
    if let Ok(projects_vec) = serde_json::from_str::<Vec<Project>>(&json) {
        let projects_map: HashMap<String, Project> = projects_vec.into_iter().map(|p| (p.id.clone(), p)).collect();
        save_projects(&app, &projects_map)?;

        let mut projects = state.projects.lock().unwrap();
        *projects = projects_map;

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

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let settings = load_settings(app.handle());
            let services = load_services(app.handle());
            let projects = load_projects(app.handle());
            app.manage(AppState {
                services: Mutex::new(services),
                projects: Mutex::new(projects),
                processes: Mutex::new(HashMap::new()),
                settings: Mutex::new(settings),
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
            update_project_sort,
            add_service_to_project,
            remove_service_from_project,
            // 服务运行
            start_service,
            stop_service,
            restart_service,
            start_project,
            stop_project,
            get_running_services,
            get_service_logs,
            get_log_file_size,
            get_service_status,
            // 设置与配置
            get_settings,
            get_config_dir,
            export_config,
            import_config,
            open_directory,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
