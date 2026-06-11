use serde::{Deserialize, Serialize};
use std::process::{Command, Child, Stdio};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::thread;
use tauri::{State, AppHandle, Emitter};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

// Windows 隐藏窗口标志
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

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


#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AppSettings {
    #[serde(default)]
    pub minimize_to_tray: bool,
    #[serde(default)]
    pub show_notifications: bool,
    #[serde(default)]
    pub theme: String,
    #[serde(default)]
    pub java_home: String,            // JDK 路径，如 D:\software\commonBag\jdk\jdk8
}

struct AppState {
    services: Mutex<HashMap<String, Service>>,
    projects: Mutex<HashMap<String, Project>>,
    processes: Mutex<HashMap<String, Child>>,
    detected_pids: Mutex<HashMap<String, u32>>,  // 启动时检测到的运行中服务 PID
    settings: Mutex<AppSettings>,
    log_buffers: Arc<Mutex<HashMap<String, Vec<String>>>>,  // 服务日志缓冲区
    log_viewers_active: Arc<Mutex<HashMap<String, bool>>>,  // 哪些服务的日志界面是打开的
}

fn get_exe_dir(_app: &AppHandle) -> PathBuf {
    let exe_path = std::env::current_exe().expect("无法获取程序路径");
    exe_path.parent().expect("无法获取程序目录").to_path_buf()
}

fn get_config_path(app: &AppHandle) -> PathBuf {
    get_exe_dir(app).join("config.json")
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

// 从文件末尾读取最后 N 行（避免大文件 OOM）
fn read_file_tail(path: &PathBuf, n: usize) -> Result<String, String> {
    use std::io::{Seek, SeekFrom, Read};

    let mut file = fs::File::open(path).map_err(|e| format!("打开日志文件失败: {}", e))?;
    let metadata = file.metadata().map_err(|e| format!("读取文件元数据失败: {}", e))?;
    let file_size = metadata.len();

    if file_size == 0 {
        return Ok(String::new());
    }

    // 小文件（< 1MB）直接读取
    if file_size < 1024 * 1024 {
        let content = fs::read_to_string(path).map_err(|e| format!("读取日志失败: {}", e))?;
        let lines: Vec<&str> = content.lines().collect();
        let start = if lines.len() > n { lines.len() - n } else { 0 };
        return Ok(lines[start..].join("\n"));
    }

    // 大文件：从末尾向前按块读取，只保留最后一个块的数据
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

        // 统计本块中的换行符数量
        found_lines += chunk.iter().filter(|&&b| b == b'\n').count();

        // 将本块放在前面（因为我们是从后往前读的）
        chunk.extend_from_slice(&tail_buf);
        tail_buf = chunk;
    }

    // 从 tail_buf 中提取最后 n 行
    let content = String::from_utf8_lossy(&tail_buf);
    let lines: Vec<&str> = content.lines().collect();
    let start = if lines.len() > n { lines.len() - n } else { 0 };
    Ok(lines[start..].join("\n"))
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
        let _ = process.wait();
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
                let _ = process.wait();
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
            let _ = process.wait();
        }
    }

    project.services.retain(|s| s.id != service_id);
    drop(projects);
    drop(processes);
    save_all(&app, &state)?;
    Ok(())
}

// 智能转换 Maven 命令
fn smart_convert_maven_command(command: &str, work_dir: &str) -> String {
    // 检测是否是 spring-boot:run 命令
    if !command.contains("spring-boot:run") {
        eprintln!("[smart_convert] 非 spring-boot:run 命令，原样返回: {}", command);
        return command.to_string();
    }

    eprintln!("[smart_convert] 输入命令: {}, 工作目录: {}", command, work_dir);

    let path = PathBuf::from(work_dir);

    // 解析 -pl 参数获取模块名
    let module_name = if command.contains("-pl") {
        command.split("-pl").nth(1)
            .and_then(|s| s.split_whitespace().next())
            .unwrap_or("")
    } else {
        ""
    };

    eprintln!("[smart_convert] 解析模块名: '{}'", module_name);

    // 查找 war 或 jar 文件
    let target_dir = if !module_name.is_empty() {
        path.join(module_name).join("target")
    } else {
        path.join("target")
    };

    eprintln!("[smart_convert] target 目录: {:?}, 存在: {}", target_dir, target_dir.exists());

    // 列出 target 目录内容
    if target_dir.exists() {
        if let Ok(entries) = fs::read_dir(&target_dir) {
            eprintln!("[smart_convert] target 目录内容:");
            for entry in entries.flatten() {
                let name = entry.file_name().to_string_lossy().to_string();
                let is_file = entry.path().is_file();
                eprintln!("[smart_convert]   {} (file={})", name, is_file);
            }
        }
    }

    // 查找 war 或 jar 文件的函数（排除 .original 文件）
    let find_jar_file = |dir: &PathBuf| -> Option<PathBuf> {
        if let Ok(entries) = fs::read_dir(dir) {
            let mut candidates: Vec<PathBuf> = Vec::new();
            for entry in entries.flatten() {
                let name = entry.file_name().to_string_lossy().to_string();
                let path = entry.path();
                // 排除 .original 文件和非文件
                if !path.is_file() {
                    continue;
                }
                if name.ends_with(".original") {
                    continue;
                }
                if name.ends_with(".war") || name.ends_with(".jar") {
                    eprintln!("[smart_convert] 找到候选文件: {:?}", path);
                    candidates.push(path);
                }
            }
            // 优先选择 .war 文件（Spring Boot 项目通常打 war 包）
            candidates.sort_by(|a, b| {
                let a_name = a.file_name().unwrap_or_default().to_string_lossy();
                let b_name = b.file_name().unwrap_or_default().to_string_lossy();
                // .war 优先于 .jar
                let a_is_war = a_name.ends_with(".war");
                let b_is_war = b_name.ends_with(".war");
                b_is_war.cmp(&a_is_war)
            });
            return candidates.into_iter().next();
        }
        None
    };

    // 如果 target 目录存在且有 war 文件，直接运行
    if target_dir.exists() {
        if let Some(jar_path) = find_jar_file(&target_dir) {
            // 使用 Windows 风格路径（反斜杠）
            let path_str = jar_path.display().to_string().replace("/", "\\");
            let result = format!("java -jar \"{}\"", path_str);
            eprintln!("[smart_convert] 转换结果: {}", result);
            return result;
        }
        eprintln!("[smart_convert] target 目录存在但未找到 war/jar 文件");
    } else {
        eprintln!("[smart_convert] target 目录不存在");
    }

    // 没有 war 文件，需要先编译再运行
    let result = if !module_name.is_empty() {
        // 多模块项目：先编译，然后用 for 循环查找并运行
        let target_path = target_dir.display().to_string().replace("/", "\\");
        format!("mvn clean package -DskipTests -pl {} -am && for %f in (\"{}\\*.war\") do java -jar \"%f\"", module_name, target_path)
    } else {
        // 单模块项目
        let target_path = target_dir.display().to_string().replace("/", "\\");
        format!("mvn clean package -DskipTests && for %f in (\"{}\\*.war\") do java -jar \"%f\"", target_path)
    };
    eprintln!("[smart_convert] 需要先编译，转换结果: {}", result);
    result
}

// 应用环境配置到 Command（JAVA_HOME, MAVEN_HOME 等）
fn apply_env_settings(cmd: &mut Command, settings: &AppSettings, service_env: &HashMap<String, String>) {
    // 继承系统环境变量
    for (key, value) in std::env::vars() {
        cmd.env(&key, &value);
    }
    // 应用服务级环境变量
    cmd.envs(service_env);
    // 应用 JAVA_HOME
    if !settings.java_home.is_empty() {
        cmd.env("JAVA_HOME", &settings.java_home);
        let java_bin = PathBuf::from(&settings.java_home).join("bin");
        let path = std::env::var("PATH").unwrap_or_default();
        cmd.env("PATH", format!("{};{}", java_bin.display(), path));
    }
}

fn spawn_with_realtime_log(_app: &AppHandle, service: &Service, service_name: &str, state: &State<AppState>) -> Result<Child, String> {
    // 读取环境配置
    let settings = state.settings.lock().unwrap().clone();

    // 智能转换 Maven 命令
    let smart_command = smart_convert_maven_command(&service.command, &service.path);
    eprintln!("[spawn] 服务: {}, 原始命令: {}, 转换后: {}, 工作目录: {}", service_name, service.command, smart_command, service.path);

    // 如果用户指定了日志路径，直接重定向到文件
    if !service.log_path.is_empty() {
        let mut cmd = build_command(&smart_command, &service.path, &settings, &service.env_vars);
        #[cfg(windows)]
        cmd.creation_flags(CREATE_NO_WINDOW);
        return cmd.spawn().map_err(|e| format!("启动失败: {}", e));
    }

    // 否则用 pipe 实时捕获，存储到内存
    let mut cmd = build_command(&smart_command, &service.path, &settings, &service.env_vars);
    cmd.stdout(Stdio::piped()).stderr(Stdio::null());
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let mut child = cmd.spawn().map_err(|e| format!("启动失败: {}", e))?;

    // 初始化服务的日志缓冲区
    {
        let mut buffers = state.log_buffers.lock().unwrap();
        buffers.insert(service_name.to_string(), Vec::new());
    }

    // 克隆 Arc 引用以便在后台线程中使用
    let log_buffers = state.log_buffers.clone();
    let log_viewers_active = state.log_viewers_active.clone();

    // 后台线程读取 stdout
    if let Some(stdout) = child.stdout.take() {
        let service_name = service_name.to_string();
        let log_buffers = log_buffers.clone();
        let log_viewers_active = log_viewers_active.clone();
        thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                if let Ok(line) = line {
                    let mut buffers = log_buffers.lock().unwrap();
                    let buffer = buffers.entry(service_name.clone()).or_insert_with(Vec::new);
                    buffer.push(line);

                    // 检查日志界面是否打开
                    let viewers = log_viewers_active.lock().unwrap();
                    let is_active = viewers.get(&service_name).copied().unwrap_or(false);
                    drop(viewers);

                    // 日志缓冲区大小限制：界面关闭时保留5行，界面打开时最多10000行
                    let max_lines = if is_active { 10000 } else { 5 };
                    if buffer.len() > max_lines {
                        let drain_count = buffer.len() - max_lines;
                        buffer.drain(0..drain_count);
                    }
                }
            }
        });
    }

    // 后台线程读取 stderr
    if let Some(stderr) = child.stderr.take() {
        let service_name = service_name.to_string();
        let log_buffers = log_buffers.clone();
        let log_viewers_active = log_viewers_active.clone();
        thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines() {
                if let Ok(line) = line {
                    let mut buffers = log_buffers.lock().unwrap();
                    let buffer = buffers.entry(service_name.clone()).or_insert_with(Vec::new);
                    buffer.push(line);

                    // 检查日志界面是否打开
                    let viewers = log_viewers_active.lock().unwrap();
                    let is_active = viewers.get(&service_name).copied().unwrap_or(false);
                    drop(viewers);

                    // 日志缓冲区大小限制：界面关闭时保留5行，界面打开时最多10000行
                    let max_lines = if is_active { 10000 } else { 5 };
                    if buffer.len() > max_lines {
                        let drain_count = buffer.len() - max_lines;
                        buffer.drain(0..drain_count);
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

// 构建 Command 对象，处理中文路径编码问题
// java -jar "中文路径" 直接运行 java 进程，不走 cmd /C（避免路径乱码）
fn build_command(smart_cmd: &str, work_dir: &str, settings: &AppSettings, env_vars: &HashMap<String, String>) -> Command {
    // 检测是否是 java -jar 命令
    if smart_cmd.starts_with("java -jar ") {
        let jar_path = smart_cmd["java -jar ".len()..].trim().trim_matches('"');
        let java_exe = if !settings.java_home.is_empty() {
            format!("{}\\bin\\java.exe", settings.java_home)
        } else {
            "java".to_string()
        };
        let mut cmd = Command::new(&java_exe);
        cmd.arg("-jar").arg(jar_path);
        cmd.current_dir(work_dir);
        // 继承环境变量
        for (k, v) in std::env::vars() { cmd.env(&k, &v); }
        cmd.envs(env_vars);
        if !settings.java_home.is_empty() {
            cmd.env("JAVA_HOME", &settings.java_home);
        }
        cmd
    } else {
        // 非 java -jar 命令，走 cmd /C
        #[cfg(windows)]
        let full = format!("chcp 65001 >nul && {} 2>&1", smart_cmd);
        #[cfg(not(windows))]
        let full = format!("{} 2>&1", smart_cmd);
        let mut cmd = Command::new("cmd");
        cmd.args(["/C", &full]);
        cmd.current_dir(work_dir);
        apply_env_settings(&mut cmd, settings, env_vars);
        cmd
    }
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

    // 释放所有锁，避免阻塞前端轮询
    drop(detected_pids);
    drop(processes);
    drop(services);

    // 直接正式启动，捕获实时日志（不做预测试，避免阻塞 UI）
    // 启动失败会通过日志和状态指示灯反馈给用户
    let child = spawn_with_realtime_log(&app, &actual_service, &service_name, &state)?;
    eprintln!("[start_service] 服务 {} 启动成功 (PID: {})", service_name, child.id());
    let mut processes = state.processes.lock().unwrap();
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

    // 收集需要启动的服务名称（排除已在 processes 或 detected_pids 中的服务）
    // 注意：项目内嵌的服务是克隆副本，必须用 name 匹配全局服务来获取最新配置
    let start_names: Vec<String> = project.services.iter()
        .filter(|svc| !processes.contains_key(&svc.name) && !detected_pids.contains_key(&svc.name))
        .map(|svc| svc.name.clone())
        .collect();

    // 用名称收集对应的全局服务 ID，用于依赖排序
    let start_ids: Vec<String> = start_names.iter()
        .filter_map(|name| services.values().find(|s| s.name == *name).map(|s| s.id.clone()))
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

        match spawn_with_realtime_log(&app, global_svc, &global_svc.name, &state) {
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

        match spawn_with_realtime_log(&app, service, service_name, &state) {
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
    let mut detected_pids = state.detected_pids.lock().unwrap();

    let mut stopped = Vec::new();

    for service_name in &service_names {
        // 先从 processes 中停止（程序启动的进程）
        if let Some(mut process) = processes.remove(service_name) {
            kill_process_tree(process.id());
            let _ = process.wait();
            stopped.push(service_name.clone());
        }
        // 再从 detected_pids 中停止（手动启动或之前启动的进程）
        if let Some(pid) = detected_pids.remove(service_name) {
            kill_process_tree(pid);
            if !stopped.contains(service_name) {
                stopped.push(service_name.clone());
            }
        }
    }

    Ok(stopped)
}

#[tauri::command]
fn get_service_logs(_app: AppHandle, state: State<AppState>, service_name: String, tail_lines: Option<usize>) -> Result<String, String> {
    let services = state.services.lock().unwrap();

    let service = services.values().find(|s| s.name == service_name).ok_or("服务不存在")?;
    let log_path = service.log_path.clone();
    drop(services); // 释放锁，避免读文件期间阻塞其他操作

    // 如果用户指定了日志路径，从文件读取（只读最后 N 行，避免大文件 OOM）
    if !log_path.is_empty() {
        let log_file_path = PathBuf::from(&log_path);
        if !log_file_path.exists() {
            return Ok(String::new());
        }
        let tail = tail_lines.unwrap_or(100);
        return read_file_tail(&log_file_path, tail);
    }

    // 否则从内存缓冲区读取
    let buffers = state.log_buffers.lock().unwrap();
    let buffer = buffers.get(&service_name);

    match buffer {
        Some(lines) => {
            let tail = tail_lines.unwrap_or(100);
            let start = if lines.len() > tail { lines.len() - tail } else { 0 };
            Ok(lines[start..].join("\n"))
        }
        None => Ok(String::new()),
    }
}

#[tauri::command]
fn get_log_file_size(_app: AppHandle, state: State<AppState>, service_name: String) -> Result<usize, String> {
    let services = state.services.lock().unwrap();
    let service = services.values().find(|s| s.name == service_name).ok_or("服务不存在")?;

    // 如果用户指定了日志路径，从文件获取大小
    if !service.log_path.is_empty() {
        let log_file_path = PathBuf::from(&service.log_path);
        if !log_file_path.exists() {
            return Ok(0);
        }
        let metadata = fs::metadata(&log_file_path).map_err(|e| format!("读取元数据失败: {}", e))?;
        return Ok(metadata.len() as usize);
    }

    // 否则从内存缓冲区获取大小
    let buffers = state.log_buffers.lock().unwrap();
    let buffer = buffers.get(&service_name);
    match buffer {
        Some(lines) => Ok(lines.join("\n").len()),
        None => Ok(0),
    }
}

#[tauri::command]
fn set_log_viewer_active(state: State<AppState>, service_name: String, active: bool) -> Result<(), String> {
    let mut viewers = state.log_viewers_active.lock().unwrap();
    viewers.insert(service_name, active);
    Ok(())
}

#[tauri::command]
fn clear_service_logs(state: State<AppState>, service_name: String) -> Result<(), String> {
    let mut buffers = state.log_buffers.lock().unwrap();
    if let Some(buffer) = buffers.get_mut(&service_name) {
        // 只保留最近5行
        if buffer.len() > 5 {
            let drain_count = buffer.len() - 5;
            buffer.drain(0..drain_count);
        }
    }
    Ok(())
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

// 检查 PID 是否仍在运行（Windows API 直接调用，比 tasklist 快 100 倍）
#[cfg(windows)]
fn is_pid_alive(pid: u32) -> bool {
    extern "system" {
        fn OpenProcess(dwDesiredAccess: u32, bInheritHandle: i32, dwProcessId: u32) -> *mut std::ffi::c_void;
        fn CloseHandle(hObject: *mut std::ffi::c_void) -> i32;
    }

    const PROCESS_QUERY_LIMITED_INFORMATION: u32 = 0x1000;

    unsafe {
        let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
        if handle.is_null() {
            return false;
        }
        CloseHandle(handle);
        true
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
                        break;
                    }
                } else {
                    // 只有主命令，直接匹配
                    result.insert(service_name.clone(), *pid);
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

    // 确保父目录存在
    if let Some(parent) = path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| format!("创建目录失败: {}", e))?;
        }
    }

    // 直接写入文件
    fs::write(&path, &json).map_err(|e| format!("写入文件失败: {}, 路径: {:?}", e, path))?;

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
fn get_settings(state: State<AppState>) -> AppSettings {
    state.settings.lock().unwrap().clone()
}

#[tauri::command]
fn save_settings(app: AppHandle, state: State<AppState>, settings: AppSettings) -> Result<(), String> {
    {
        let mut s = state.settings.lock().unwrap();
        *s = settings;
    }
    save_all(&app, &state)
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

            let content = fs::read_to_string(&pom_path)
                .map_err(|e| format!("读取 pom.xml 失败: {}", e))?;

            let mut commands = Vec::new();
            let mut is_multi_module = false;
            let mut has_spring_boot = false;
            let mut main_module = String::new();

            // 检测是否是多模块项目
            if content.contains("<modules>") && content.contains("<module>") {
                is_multi_module = true;

                // 提取模块名称
                for line in content.lines() {
                    let trimmed = line.trim();
                    if trimmed.contains("<module>") && trimmed.contains("</module>") {
                        if let Some(start) = trimmed.find("<module>") {
                            let rest = &trimmed[start + 8..];
                            if let Some(end) = rest.find("</module>") {
                                let module_name = rest[..end].trim().to_string();
                                // 检查子模块是否有 main class
                                let module_path = path.join(&module_name);
                                if module_path.exists() {
                                    let module_pom = module_path.join("pom.xml");
                                    if module_pom.exists() {
                                        let module_content = fs::read_to_string(&module_pom).unwrap_or_default();
                                        if module_content.contains("spring-boot-maven-plugin") {
                                            main_module = module_name;
                                            has_spring_boot = true;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            } else {
                // 单模块项目
                if content.contains("spring-boot-maven-plugin") {
                    has_spring_boot = true;
                }
            }

            // 解析 pom.xml 中的 profiles
            let mut in_profiles = false;
            let mut in_profile = false;
            let mut current_id = String::new();

            for line in content.lines() {
                let trimmed = line.trim();

                if trimmed.contains("<profiles>") {
                    in_profiles = true;
                    continue;
                }

                if trimmed.contains("</profiles>") {
                    in_profiles = false;
                    continue;
                }

                if in_profiles && trimmed.contains("<profile>") {
                    in_profile = true;
                    current_id.clear();
                    continue;
                }

                if in_profile && trimmed.contains("</profile>") {
                    in_profile = false;
                    if !current_id.is_empty() {
                        commands.push(format!("-P{}", current_id));
                        commands.push(format!("clean install -P{}", current_id));
                    }
                    continue;
                }

                if in_profile && trimmed.contains("<id>") {
                    if let Some(start) = trimmed.find("<id>") {
                        let rest = &trimmed[start + 4..];
                        if let Some(end) = rest.find("</id>") {
                            current_id = rest[..end].trim().to_string();
                        }
                    }
                }
            }

            // 添加常用 maven 命令（精简版）
            let mut result: Vec<String> = Vec::new();

            // 启动命令（最常用，放最前面）
            if has_spring_boot {
                if is_multi_module && !main_module.is_empty() {
                    result.push(format!("spring-boot:run -pl {}", main_module));
                } else {
                    result.push("spring-boot:run".to_string());
                }
            }

            // 常用构建命令
            result.push("clean install".to_string());
            result.push("clean package".to_string());
            result.push("clean package -DskipTests".to_string());
            result.push("compile".to_string());
            result.push("test".to_string());

            // Profile 命令（如果有）
            result.extend(commands);

            // 去重
            result.dedup();

            Ok(result)
        }
        _ => Ok(vec![]),
    }
}

#[tauri::command]
#[allow(non_snake_case)]
async fn execute_command(app: AppHandle, state: State<'_, AppState>, command: String, workDir: String) -> Result<(), String> {
    let work_dir = PathBuf::from(&workDir);
    if !work_dir.exists() {
        return Err("工作目录不存在".to_string());
    }

    let cmd = command.trim().to_string();
    if cmd.is_empty() {
        return Err("命令不能为空".to_string());
    }

    let app_handle = app.clone();

    // 读取环境配置
    let settings = state.settings.lock().unwrap().clone();

    // 构建环境变量
    let mut envs: Vec<(String, String)> = std::env::vars().collect();
    if !settings.java_home.is_empty() {
        envs.push(("JAVA_HOME".to_string(), settings.java_home.clone()));
        let java_bin = PathBuf::from(&settings.java_home).join("bin").display().to_string();
        if let Some((_, path)) = envs.iter_mut().find(|(k, _)| k == "PATH") {
            *path = format!("{};{}", java_bin, path);
        }
    }

    // 在后台线程执行命令
    std::thread::spawn(move || {
        // 智能转换 Maven spring-boot:run 命令
        let smart_cmd = smart_convert_maven_command(&cmd, &workDir);
        eprintln!("[execute_command] 原始命令: {}, 转换后: {}", cmd, smart_cmd);

        let mut child_cmd = build_command(&smart_cmd, &workDir, &settings, &HashMap::new());
        child_cmd.stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped());
        #[cfg(windows)]
        child_cmd.creation_flags(CREATE_NO_WINDOW);
        let child = child_cmd.spawn();

        match child {
            Ok(mut child) => {
                // 读取 stdout
                let stdout = child.stdout.take();
                let stderr = child.stderr.take();

                let app_clone = app_handle.clone();
                let app_clone2 = app_handle.clone();

                // 后台线程读取 stdout
                if let Some(stdout) = stdout {
                    std::thread::spawn(move || {
                        use std::io::{BufRead, BufReader};
                        let reader = BufReader::new(stdout);
                        for line in reader.lines() {
                            if let Ok(line) = line {
                                let _ = app_clone.emit("command-output", serde_json::json!({
                                    "type": "stdout",
                                    "line": line
                                }));
                            }
                        }
                    });
                }

                // 后台线程读取 stderr
                if let Some(stderr) = stderr {
                    std::thread::spawn(move || {
                        use std::io::{BufRead, BufReader};
                        let reader = BufReader::new(stderr);
                        for line in reader.lines() {
                            if let Ok(line) = line {
                                let _ = app_clone2.emit("command-output", serde_json::json!({
                                    "type": "stderr",
                                    "line": line
                                }));
                            }
                        }
                    });
                }

                // 等待命令完成
                let status = child.wait();
                match status {
                    Ok(status) => {
                        let _ = app_handle.emit("command-finished", serde_json::json!({
                            "success": status.success(),
                            "code": status.code()
                        }));
                    }
                    Err(e) => {
                        let _ = app_handle.emit("command-finished", serde_json::json!({
                            "success": false,
                            "error": format!("等待命令完成失败: {}", e)
                        }));
                    }
                }
            }
            Err(e) => {
                let _ = app_handle.emit("command-finished", serde_json::json!({
                    "success": false,
                    "error": format!("启动命令失败: {}", e)
                }));
            }
        }
    });

    Ok(())
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

            // 1. 快速检查之前保存的 PID（只检查 PID 存活，不做命令行匹配）
            let mut detected_pids: HashMap<String, u32> = HashMap::new();
            for (service_name, pid) in &config.running_pids {
                if is_pid_alive(*pid) {
                    detected_pids.insert(service_name.clone(), *pid);
                }
            }

            // 2. 命令行匹配检测移到后台线程（wmic 很慢，不阻塞启动）
            let services_for_detect = services.clone();
            let app_handle_for_bg = app.handle().clone();

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
                        // 保存配置并终止所有子进程后退出
                        if let Some(state) = app.try_state::<AppState>() {
                            // 终止所有运行中的子进程
                            if let Ok(mut processes) = state.processes.lock() {
                                for (_, mut process) in processes.drain() {
                                    kill_process_tree(process.id());
                                    let _ = process.wait();
                                }
                            }
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

            let app_state = AppState {
                services: Mutex::new(services),
                projects: Mutex::new(projects),
                processes: Mutex::new(HashMap::new()),
                detected_pids: Mutex::new(detected_pids),
                settings: Mutex::new(config.settings),
                log_buffers: Arc::new(Mutex::new(HashMap::new())),
                log_viewers_active: Arc::new(Mutex::new(HashMap::new())),
            };
            app.manage(app_state);

            // 设置窗口背景色为深色，避免 WebView2 初始化时白屏闪烁
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_background_color(Some(tauri::window::Color(10, 10, 15, 255)));
                let _ = window.show();
                let _ = window.set_focus();
            }

            // 后台线程：通过命令行匹配检测手动启动的服务（wmic 较慢）
            std::thread::spawn(move || {
                let cmd_detected = detect_running_services_by_command(&services_for_detect);
                if !cmd_detected.is_empty() {
                    if let Some(state) = app_handle_for_bg.try_state::<AppState>() {
                        let mut detected = state.detected_pids.lock().unwrap();
                        for (service_name, pid) in cmd_detected {
                            if !detected.contains_key(&service_name) {
                                eprintln!("[bg-detect] 检测到手动启动的服务: {} (PID: {})", service_name, pid);
                                detected.insert(service_name, pid);
                            }
                        }
                    }
                }
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
            get_service_logs,
            get_log_file_size,
            set_log_viewer_active,
            clear_service_logs,
            batch_start_services,
            batch_stop_services,
            // 配置管理
            get_config_file_path,
            export_config,
            import_config,
            open_directory,
            get_available_commands,
            execute_command,
            // 设置
            get_settings,
            save_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
