use std::collections::HashMap;
use std::path::PathBuf;
use std::io::BufRead;
use tauri::{AppHandle, State, Emitter};
#[cfg(windows)]
use std::os::windows::process::CommandExt;
use crate::AppState;
use crate::events;
use crate::services::{maven, process_manager};
use crate::lock;

#[tauri::command]
pub fn get_available_commands(path: String, service_type: String) -> Result<Vec<String>, String> {
    let path = PathBuf::from(&path);
    if !path.exists() { return Err("目录不存在".into()); }

    match service_type.as_str() {
        "npm" => {
            let pkg = path.join("package.json");
            if !pkg.exists() { return Err("未找到 package.json".into()); }
            let content = std::fs::read_to_string(&pkg).map_err(|e| format!("读取失败: {}", e))?;
            let json: serde_json::Value = serde_json::from_str(&content).map_err(|e| format!("解析失败: {}", e))?;
            if let Some(scripts) = json.get("scripts").and_then(|s| s.as_object()) {
                Ok(scripts.keys().cloned().collect())
            } else {
                Ok(vec![])
            }
        }
        "maven" => parse_maven_commands(&path),
        _ => Ok(vec![]),
    }
}

fn parse_maven_commands(path: &PathBuf) -> Result<Vec<String>, String> {
    let pom = path.join("pom.xml");
    if !pom.exists() { return Err("未找到 pom.xml".into()); }
    let content = std::fs::read_to_string(&pom).map_err(|e| format!("读取失败: {}", e))?;

    let mut is_multi = false;
    let mut has_spring = false;
    let mut main_module = String::new();

    if content.contains("<modules>") && content.contains("<module>") {
        is_multi = true;
        for line in content.lines() {
            let trimmed = line.trim();
            if trimmed.contains("<module>") && trimmed.contains("</module>") {
                if let Some(start) = trimmed.find("<module>") {
                    let rest = &trimmed[start + 8..];
                    if let Some(end) = rest.find("</module>") {
                        let module_name = rest[..end].trim().to_string();
                        let module_pom = path.join(&module_name).join("pom.xml");
                        if module_pom.exists() {
                            let mc = std::fs::read_to_string(&module_pom).unwrap_or_default();
                            if mc.contains("spring-boot-maven-plugin") {
                                main_module = module_name;
                                has_spring = true;
                            }
                        }
                    }
                }
            }
        }
    } else if content.contains("spring-boot-maven-plugin") {
        has_spring = true;
    }

    let mut result = Vec::new();
    if has_spring {
        if is_multi && !main_module.is_empty() {
            result.push(format!("spring-boot:run -pl {}", main_module));
        } else {
            result.push("spring-boot:run".into());
        }
    }
    result.extend(["clean install", "clean package", "clean package -DskipTests", "compile", "test"].iter().map(|s| s.to_string()));
    result.dedup();
    Ok(result)
}

#[tauri::command]
pub async fn execute_command(app: AppHandle, state: State<'_, AppState>, command: String, work_dir: String) -> Result<(), String> {
    let work_path = PathBuf::from(&work_dir);
    if !work_path.exists() { return Err("工作目录不存在".into()); }
    let cmd = command.trim().to_string();
    if cmd.is_empty() { return Err("命令不能为空".into()); }

    let settings = lock!(state.settings).clone();

    // 使用 tokio 异步任务替代裸线程
    tokio::task::spawn_blocking(move || {
        let smart_cmd = maven::smart_convert(&cmd, &work_dir);
        let mut child_cmd = process_manager::build_command(&smart_cmd, &work_dir, &settings, &HashMap::new(), &HashMap::new());
        child_cmd.stdout(std::process::Stdio::piped()).stderr(std::process::Stdio::piped());
        #[cfg(windows)]
        child_cmd.creation_flags(crate::config::CREATE_NO_WINDOW);

        match child_cmd.spawn() {
            Ok(mut child) => {
                let stdout = child.stdout.take();
                let stderr = child.stderr.take();
                let app1 = app.clone();
                let app2 = app.clone();

                if let Some(stdout) = stdout {
                    std::thread::spawn(move || {
                        let reader = std::io::BufReader::new(stdout);
                        for line in reader.lines() {
                            if let Ok(line) = line {
                                let _ = app1.emit(events::COMMAND_OUTPUT, serde_json::json!({"type":"stdout","line":line}));
                            }
                        }
                    });
                }
                if let Some(stderr) = stderr {
                    std::thread::spawn(move || {
                        let reader = std::io::BufReader::new(stderr);
                        for line in reader.lines() {
                            if let Ok(line) = line {
                                let _ = app2.emit(events::COMMAND_OUTPUT, serde_json::json!({"type":"stderr","line":line}));
                            }
                        }
                    });
                }

                match child.wait() {
                    Ok(status) => { let _ = app.emit(events::COMMAND_FINISHED, serde_json::json!({"success":status.success(),"code":status.code()})); }
                    Err(e) => { let _ = app.emit(events::COMMAND_FINISHED, serde_json::json!({"success":false,"error":format!("{}",e)})); }
                }
            }
            Err(e) => { let _ = app.emit(events::COMMAND_FINISHED, serde_json::json!({"success":false,"error":format!("{}",e)})); }
        }
    });

    Ok(())
}

#[tauri::command]
pub fn open_directory(path: String) -> Result<(), String> {
    // 路径安全校验
    crate::utils::validate_file_path(&path).map_err(|e| e.to_string())?;

    let path = PathBuf::from(&path);
    if !path.exists() { return Err("目录不存在".into()); }
    #[cfg(windows)]
    { std::process::Command::new("explorer").arg(&path).spawn().map_err(|e| format!("打开失败: {}", e))?; }
    #[cfg(target_os = "macos")]
    { std::process::Command::new("open").arg(&path).spawn().map_err(|e| format!("打开失败: {}", e))?; }
    #[cfg(target_os = "linux")]
    { std::process::Command::new("xdg-open").arg(&path).spawn().map_err(|e| format!("打开失败: {}", e))?; }
    Ok(())
}

#[tauri::command]
pub fn show_main_window(app: AppHandle) {
    use tauri::Manager;
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[tauri::command]
pub fn open_system_terminal(path: String) -> Result<(), String> {
    // 路径安全校验
    crate::utils::validate_file_path(&path).map_err(|e| e.to_string())?;

    let work_path = PathBuf::from(&path);
    if !work_path.exists() { return Err("目录不存在".into()); }

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        // CREATE_NEW_CONSOLE = 0x00000010，确保在新窗口打开
        std::process::Command::new("cmd.exe")
            .arg("/K")
            .arg("cd")
            .arg("/d")
            .arg(&work_path)
            .creation_flags(0x00000010)
            .spawn()
            .map_err(|e| format!("打开终端失败: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("-a")
            .arg("Terminal")
            .arg(&work_path)
            .spawn()
            .map_err(|e| format!("打开终端失败: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        // 尝试常见的 Linux 终端
        let terminals = ["x-terminal-emulator", "gnome-terminal", "konsole", "xfce4-terminal", "xterm"];
        let mut opened = false;
        for terminal in &terminals {
            if std::process::Command::new(terminal)
                .arg("--working-directory")
                .arg(&work_path)
                .spawn()
                .is_ok()
            {
                opened = true;
                break;
            }
        }
        if !opened {
            return Err("无法找到可用的终端程序".into());
        }
    }

    Ok(())
}
