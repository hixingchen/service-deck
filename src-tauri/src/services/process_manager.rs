use std::process::{Command, Child, Stdio};
use std::collections::HashMap;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{AppHandle, Emitter};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

use crate::config::CREATE_NO_WINDOW;
use crate::events;
use crate::{Service, AppSettings};
use crate::lock_or_panic;
use crate::log_info;

// ===== 进程检测：shell 包装剥离 =====

/// 从 shell 包装的命令行中提取真实命令
///
/// Windows 上 `build_command` 会将命令包装为：
///   `cmd /C chcp 65001 >nul && {cmd} 2>&1`
/// Unix 上包装为：
///   `sh -c {cmd}`
fn strip_shell_wrapper(process_cmd: &str) -> &str {
    let trimmed = process_cmd.trim();

    // Windows: cmd.exe /C "..." 或 cmd /C ...
    #[cfg(windows)]
    {
        let lower = trimmed.to_lowercase();
        if lower.starts_with("cmd.exe /c ") || lower.starts_with("cmd /c ") {
            let prefix_len = if lower.starts_with("cmd.exe /c ") { 11 } else { 7 };
            let inner = trimmed[prefix_len..].trim().trim_matches('"');
            // 剥离 chcp 65001 >nul &&
            if let Some(pos) = inner.find("&&") {
                return inner[pos + 2..].trim();
            }
            return inner;
        }
    }

    // Unix: sh -c "..."
    #[cfg(not(windows))]
    {
        if trimmed.starts_with("sh -c ") || trimmed.starts_with("sh -c \"") {
            let inner = trimmed[6..].trim().trim_matches('"');
            return inner;
        }
    }

    trimmed
}

/// 判断服务命令与进程命令行是否匹配
///
/// 匹配策略（优先级从高到低）：
/// 1. 脚本运行器 (npm/pnpm/yarn run xxx)：进程命令行同时包含运行器和脚本名
/// 2. java -jar xxx：匹配 jar 文件名
/// 3. 通用匹配：服务命令的所有核心 token 在进程命令行中都出现
fn commands_match(service_cmd: &str, process_cmd: &str) -> bool {
    let svc_lower = service_cmd.to_lowercase();
    let proc_lower = process_cmd.to_lowercase();
    let svc_tokens: Vec<&str> = svc_lower.split_whitespace().collect();

    // 策略 1: 脚本运行器匹配
    if svc_tokens.len() >= 3 {
        let runner = svc_tokens[0];
        let subcmd = svc_tokens[1];
        let script = svc_tokens[2];
        if (runner == "npm" || runner == "pnpm" || runner == "yarn")
            && subcmd == "run"
        {
            return proc_lower.contains(runner) && proc_lower.contains(script);
        }
    }

    // 策略 2: java -jar 匹配
    if svc_tokens.len() >= 3 && svc_tokens[0] == "java" && svc_tokens[1] == "-jar" {
        let jar_name = svc_tokens[2].trim_matches('"');
        // 提取文件名部分（去掉路径）
        let jar_file = jar_name.rsplit(['/', '\\']).next().unwrap_or(jar_name);
        return proc_lower.contains("java") && proc_lower.contains(jar_file);
    }

    // 策略 3: 通用 token 匹配 — 服务命令的每个 token 都必须在进程命令行中出现
    let proc_tokens: Vec<&str> = proc_lower.split_whitespace().collect();

    // 跳过 shell 包装前缀（cmd, /C, sh, -c 等）
    let skip_set: std::collections::HashSet<&str> = [
        "cmd", "cmd.exe", "/c", "sh", "-c",
        "chcp", "65001", ">nul", "&&", "2>&1",
    ].iter().cloned().collect();

    let svc_core: Vec<&str> = svc_tokens.iter()
        .filter(|t| !skip_set.contains(*t) && !t.is_empty())
        .copied()
        .collect();

    if svc_core.is_empty() { return false; }

    // 所有核心 token 都必须在进程命令行中出现
    svc_core.iter().all(|token| proc_tokens.iter().any(|p| p.contains(token)))
}

/// 获取平台特定的 PATH 分隔符
#[cfg(windows)]
const PATH_SEP: &str = ";";
#[cfg(not(windows))]
const PATH_SEP: &str = ":";

/// 构建 Command 对象，处理中文路径编码问题
pub fn build_command(
    smart_cmd: &str,
    work_dir: &str,
    settings: &AppSettings,
    env_vars: &HashMap<String, String>,
    full_env: &HashMap<String, String>,
) -> Command {
    if smart_cmd.starts_with("java -jar ") {
        let jar_path = smart_cmd["java -jar ".len()..].trim().trim_matches('"');
        let java_exe = if !settings.java_home.is_empty() {
            // 跨平台 Java 可执行文件路径
            let java_name = if cfg!(windows) { "java.exe" } else { "java" };
            PathBuf::from(&settings.java_home).join("bin").join(java_name)
                .to_string_lossy().to_string()
        } else if let Some(java_home) = full_env.get("JAVA_HOME") {
            let java_name = if cfg!(windows) { "java.exe" } else { "java" };
            PathBuf::from(java_home).join("bin").join(java_name)
                .to_string_lossy().to_string()
        } else {
            "java".to_string()
        };
        let mut cmd = Command::new(&java_exe);
        cmd.arg("-jar").arg(jar_path);
        cmd.current_dir(work_dir);
        // 使用预构建的完整环境变量
        cmd.env_clear();
        cmd.envs(full_env);
        cmd.envs(env_vars);
        cmd
    } else {
        // 跨平台命令执行
        #[cfg(windows)]
        {
            let full = format!("chcp 65001 >nul && {} 2>&1", smart_cmd);
            let mut cmd = Command::new("cmd");
            cmd.args(["/C", &full]);
            cmd.current_dir(work_dir);
            cmd.creation_flags(CREATE_NO_WINDOW);
            apply_env_settings(&mut cmd, settings, env_vars, full_env);
            cmd
        }
        #[cfg(not(windows))]
        {
            let mut cmd = Command::new("sh");
            cmd.args(["-c", smart_cmd]);
            cmd.current_dir(work_dir);
            apply_env_settings(&mut cmd, settings, env_vars, full_env);
            cmd
        }
    }
}

/// 应用环境配置到 Command
pub fn apply_env_settings(
    cmd: &mut Command,
    settings: &AppSettings,
    service_env: &HashMap<String, String>,
    full_env: &HashMap<String, String>,
) {
    // 使用预构建的完整环境变量（包含程序配置 + 系统环境）
    cmd.env_clear();
    cmd.envs(full_env);
    cmd.envs(service_env);
    // 兼容旧的 java_home 设置
    if !settings.java_home.is_empty() {
        cmd.env("JAVA_HOME", &settings.java_home);
        let java_bin = PathBuf::from(&settings.java_home).join("bin");
        let path = full_env.get("PATH").cloned().unwrap_or_default();
        cmd.env("PATH", format!("{}{}{}", java_bin.display(), PATH_SEP, path));
    }
}

/// 日志行事件负载
#[derive(Clone, serde::Serialize)]
struct LogLinePayload {
    service_name: String,
    line: String,
}

/// 启动服务并捕获实时日志
pub fn spawn_with_realtime_log(
    app: &AppHandle,
    service: &Service,
    service_name: &str,
    settings: &AppSettings,
    log_buffers: &Arc<Mutex<HashMap<String, Vec<String>>>>,
    _log_viewers_active: &Arc<Mutex<HashMap<String, bool>>>,
    full_env: &HashMap<String, String>,
) -> Result<Child, String> {
    let smart_command = crate::services::maven::smart_convert(&service.command, &service.path);
    log_info!("spawn", "服务: {}, 命令: {} → {}, 目录: {}", service_name, service.command, smart_command, service.path);

    // 如果指定了日志路径，直接重定向到文件
    if !service.log_path.is_empty() {
        let mut cmd = build_command(&smart_command, &service.path, settings, &service.env_vars, full_env);
        #[cfg(windows)]
        cmd.creation_flags(CREATE_NO_WINDOW);
        return cmd.spawn().map_err(|e| format!("启动失败: {}", e));
    }

    // 用 pipe 实时捕获 stdout
    let mut cmd = build_command(&smart_command, &service.path, settings, &service.env_vars, full_env);
    cmd.stdout(Stdio::piped()).stderr(Stdio::null());
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let mut child = cmd.spawn().map_err(|e| format!("启动失败: {}", e))?;

    // 初始化日志缓冲区
    {
        let mut buffers = lock_or_panic!(log_buffers);
        buffers.insert(service_name.to_string(), Vec::new());
    }

    let log_buffers = log_buffers.clone();
    let app_handle = app.clone();

    // 后台线程读取 stdout
    if let Some(stdout) = child.stdout.take() {
        let name = service_name.to_string();
        let buffers = log_buffers.clone();
        thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                if let Ok(line) = line {
                    // 发送事件到前端（实时推送）
                    let _ = app_handle.emit(events::LOG_LINE_ADDED, LogLinePayload {
                        service_name: name.clone(),
                        line: line.clone(),
                    });

                    let mut buffers = lock_or_panic!(buffers);
                    let buffer = buffers.entry(name.clone()).or_insert_with(Vec::new);
                    buffer.push(line);
                    // 始终保留最新 1000 条，无论日志界面是否打开
                    if buffer.len() > 1000 {
                        let drain = buffer.len() - 1000;
                        buffer.drain(0..drain);
                    }
                }
            }
        });
    }

    Ok(child)
}

/// 杀掉整个进程树
#[cfg(windows)]
pub fn kill_process_tree(pid: u32) {
    let mut cmd = Command::new("taskkill");
    cmd.args(["/T", "/F", "/PID", &pid.to_string()]);
    cmd.creation_flags(CREATE_NO_WINDOW);
    let _ = cmd.output();

    // 终止子进程
    let mut wmic_cmd = Command::new("wmic");
    wmic_cmd.args(["process", "where", &format!("ParentProcessId={}", pid), "get", "ProcessId"]);
    wmic_cmd.creation_flags(CREATE_NO_WINDOW);
    if let Ok(output) = wmic_cmd.output() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        for line in stdout.lines() {
            if let Ok(child_pid) = line.trim().parse::<u32>() {
                if child_pid > 0 {
                    let mut kill_cmd = Command::new("taskkill");
                    kill_cmd.args(["/T", "/F", "/PID", &child_pid.to_string()]);
                    kill_cmd.creation_flags(CREATE_NO_WINDOW);
                    let _ = kill_cmd.output();
                }
            }
        }
    }
}

/// 杀掉整个进程树 (macOS/Linux)
#[cfg(not(windows))]
pub fn kill_process_tree(pid: u32) {
    // 使用 kill 命令发送 SIGTERM
    let _ = Command::new("kill").arg("-TERM").arg(pid.to_string()).output();
    // 等待一小段时间后，如果进程还在则发送 SIGKILL
    std::thread::sleep(std::time::Duration::from_millis(100));
    let _ = Command::new("kill").arg("-9").arg(pid.to_string()).output();
}

/// 检查 PID 是否存活
#[cfg(windows)]
pub fn is_pid_alive(pid: u32) -> bool {
    extern "system" {
        fn OpenProcess(dwDesiredAccess: u32, bInheritHandle: i32, dwProcessId: u32) -> *mut std::ffi::c_void;
        fn CloseHandle(hObject: *mut std::ffi::c_void) -> i32;
    }
    const PROCESS_QUERY_LIMITED_INFORMATION: u32 = 0x1000;
    unsafe {
        let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
        if handle.is_null() { return false; }
        CloseHandle(handle);
        true
    }
}

#[cfg(not(windows))]
pub fn is_pid_alive(pid: u32) -> bool {
    unsafe { libc::kill(pid as i32, 0) == 0 }
}

/// 通过命令行匹配检测运行中的服务
///
/// 检测流程：
/// 1. 调用 `wmic` 获取系统所有进程的命令行和 PID
/// 2. 剥离 shell 包装后，用 `commands_match` 精确匹配
/// 3. 同一服务命中多个进程时，取最新启动的（PID 最大）
#[cfg(windows)]
pub fn detect_running_by_command(services: &HashMap<String, Service>) -> HashMap<String, u32> {
    let mut result: HashMap<String, u32> = HashMap::new();

    let mut cmd = Command::new("wmic");
    cmd.args(["process", "get", "CommandLine,ProcessId", "/format:csv"]);
    cmd.creation_flags(CREATE_NO_WINDOW);
    let output = match cmd.output() {
        Ok(out) => String::from_utf8_lossy(&out.stdout).to_string(),
        Err(_) => return result,
    };

    // 解析系统进程列表
    let mut sys_processes: Vec<(String, u32)> = Vec::new();
    for line in output.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with("Node") { continue; }

        let mut in_quotes = false;
        let mut field_start = 0;
        let mut fields: Vec<String> = Vec::new();
        for (i, c) in line.char_indices() {
            match c {
                '"' => in_quotes = !in_quotes,
                ',' if !in_quotes => {
                    fields.push(line[field_start..i].trim().trim_matches('"').to_string());
                    field_start = i + 1;
                }
                _ => {}
            }
        }
        fields.push(line[field_start..].trim().trim_matches('"').to_string());

        if fields.len() >= 3 {
            if let Ok(pid) = fields[2].trim().parse::<u32>() {
                let raw_cmd = fields[1].trim().to_string();
                if !raw_cmd.is_empty() && pid > 0 {
                    sys_processes.push((raw_cmd, pid));
                }
            }
        }
    }

    // 匹配每个服务
    for service in services.values() {
        let svc_cmd = service.command.trim();
        if svc_cmd.is_empty() { continue; }

        let mut best_pid: Option<u32> = None;

        for (proc_raw_cmd, pid) in &sys_processes {
            let real_cmd = strip_shell_wrapper(proc_raw_cmd);
            if !commands_match(svc_cmd, real_cmd) { continue; }

            // 同一服务命中多个进程时，取 PID 最大的（最新启动）
            match best_pid {
                Some(existing) if *pid <= existing => {}
                _ => best_pid = Some(*pid),
            }
        }

        if let Some(pid) = best_pid {
            result.insert(service.name.clone(), pid);
        }
    }

    result
}

/// 通过命令行匹配检测运行中的服务 (macOS/Linux)
#[cfg(not(windows))]
pub fn detect_running_by_command(services: &HashMap<String, Service>) -> HashMap<String, u32> {
    let mut result: HashMap<String, u32> = HashMap::new();

    let output = match Command::new("ps").args(["-eo", "pid,command"]).output() {
        Ok(out) => String::from_utf8_lossy(&out.stdout).to_string(),
        Err(_) => return result,
    };

    let mut sys_processes: Vec<(String, u32)> = Vec::new();
    for line in output.lines() {
        let line = line.trim();
        if line.is_empty() { continue; }

        let parts: Vec<&str> = line.splitn(2, ' ').collect();
        if parts.len() >= 2 {
            if let Ok(pid) = parts[0].trim().parse::<u32>() {
                let cmd = parts[1].trim().to_string();
                if !cmd.is_empty() && pid > 0 {
                    sys_processes.push((cmd, pid));
                }
            }
        }
    }

    for service in services.values() {
        let svc_cmd = service.command.trim();
        if svc_cmd.is_empty() { continue; }

        let mut best_pid: Option<u32> = None;

        for (proc_raw_cmd, pid) in &sys_processes {
            let real_cmd = strip_shell_wrapper(proc_raw_cmd);
            if !commands_match(svc_cmd, real_cmd) { continue; }

            match best_pid {
                Some(existing) if *pid <= existing => {}
                _ => best_pid = Some(*pid),
            }
        }

        if let Some(pid) = best_pid {
            result.insert(service.name.clone(), pid);
        }
    }

    result
}
