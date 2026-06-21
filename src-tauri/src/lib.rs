mod config;
mod error;
mod events;
mod database;
mod services;
mod commands;
mod utils;
pub mod logger;

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex, OnceLock};
use std::process::Child;
use tauri::Manager;

/// 全局 AppHandle，供信号处理等外部回调使用
static APP_HANDLE: OnceLock<tauri::AppHandle> = OnceLock::new();

use database::Database;
use services::file_watcher::WatchEvent;

/// 获取 Mutex 锁，失败时返回错误字符串（用于返回 Result 的函数）
macro_rules! lock {
    ($mutex:expr) => {
        $mutex.lock().map_err(|e| -> String { format!("获取锁失败: {}", e) })?
    };
}
pub(crate) use lock;

/// 获取 Mutex 锁，失败时 panic（用于线程闭包等非 Result 上下文）
macro_rules! lock_or_panic {
    ($mutex:expr) => {
        $mutex.lock().expect("mutex poisoned")
    };
}
pub(crate) use lock_or_panic;

// ===== 共享类型定义 =====

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum WatchMode {
    Off,
    Auto,
    Confirm,
}

impl Default for WatchMode {
    fn default() -> Self { WatchMode::Off }
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
    #[serde(default = "config::default_service_type")]
    pub service_type: String,
    #[serde(default)]
    pub depends_on: Vec<String>,
    #[serde(default)]
    pub health_check_url: String,
    #[serde(default)]
    pub health_check_interval: u32,
    #[serde(default)]
    pub favorite: bool,
    #[serde(default)]
    pub watch_mode: WatchMode,
    #[serde(default)]
    pub watch_path: String,
    #[serde(default = "config::default_watch_include")]
    pub watch_include: Vec<String>,
    #[serde(default = "config::default_watch_exclude")]
    pub watch_exclude: Vec<String>,
    #[serde(default)]
    pub runtime_versions: HashMap<String, String>,
    #[serde(default)]
    pub env_groups: Vec<EnvGroup>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub services: Vec<Service>,
    #[serde(default)]
    pub sort_index: i32,
    #[serde(default)]
    pub favorite: bool,
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
    pub java_home: String,
    #[serde(default = "config::default_language")]
    pub language: String,
    #[serde(default)]
    pub auto_backup_enabled: bool,
    #[serde(default = "config::default_auto_backup_keep_days")]
    pub auto_backup_keep_days: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvGroup {
    pub id: String,
    pub service_id: String,
    pub name: String,
    pub vars: HashMap<String, EnvVar>,
    #[serde(default)]
    pub is_active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvVar {
    pub key: String,
    pub value: String,
    #[serde(default)]
    pub is_sensitive: bool,
    #[serde(default)]
    pub source: String,
}

// ===== 应用状态 =====

pub struct AppState {
    pub db: Arc<Database>,
    pub settings: Mutex<AppSettings>,
    pub processes: Mutex<HashMap<String, Child>>,
    pub detected_pids: Mutex<HashMap<String, u32>>,
    pub log_buffers: Arc<Mutex<HashMap<String, Vec<String>>>>,
    pub log_viewers_active: Arc<Mutex<HashMap<String, bool>>>,
    pub watch_events: Arc<Mutex<Vec<WatchEvent>>>,  // 容量上限见 WATCH_EVENTS_MAX
    pub watch_stop_signals: Arc<Mutex<HashMap<String, Arc<Mutex<bool>>>>>,
    pub config_dir: Mutex<PathBuf>,
}

/// 应用级固定配置文件名（固定在 ~/.service-deck/settings.json，不随配置目录迁移）
const APP_SETTINGS_FILE: &str = "settings.json";

/// 获取固定配置文件路径（~/.service-deck/settings.json）
fn app_settings_path() -> PathBuf {
    let home = dirs_next::home_dir().expect("无法获取用户目录");
    home.join(".service-deck").join(APP_SETTINGS_FILE)
}

/// 读取应用级固定配置
pub fn load_app_settings() -> serde_json::Value {
    let path = app_settings_path();
    match std::fs::read_to_string(&path) {
        Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
        Err(_) => serde_json::json!({}),
    }
}

/// 读取日志级别配置
fn load_log_level() -> logger::LogLevel {
    let settings = load_app_settings();
    let level_str = settings.get("log_level")
        .and_then(|v| v.as_str())
        .unwrap_or("info");
    logger::LogLevel::from_str(level_str)
}

/// 读取日志保留天数配置
fn load_log_retention_days() -> i64 {
    let settings = load_app_settings();
    settings.get("log_retention_days")
        .and_then(|v| v.as_i64())
        .unwrap_or(7)
}

/// 保存应用级固定配置（合并写入，保留已有字段）
pub fn save_app_settings(settings: &serde_json::Value) -> Result<(), String> {
    let path = app_settings_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("创建目录失败: {}", e))?;
    }
    let json = serde_json::to_string_pretty(settings).map_err(|e| format!("序列化配置失败: {}", e))?;
    std::fs::write(&path, json).map_err(|e| format!("写入配置文件失败: {}", e))?;
    Ok(())
}

/// 读取已保存的自定义配置目录
fn read_saved_config_dir() -> Option<PathBuf> {
    let settings = load_app_settings();
    let dir = settings.get("config_dir")?.as_str()?;
    if dir.is_empty() { return None; }
    Some(PathBuf::from(dir))
}

/// 将自定义配置目录写入固定配置文件
fn write_saved_config_dir(dir: &std::path::Path) -> Result<(), String> {
    let mut settings = load_app_settings();
    settings["config_dir"] = serde_json::Value::String(dir.to_string_lossy().to_string());
    save_app_settings(&settings)
}

// ===== 退出清理 =====

/// 应用退出前的清理：停止文件监听器、保存运行中进程 PID、终止所有子进程
fn cleanup_on_exit(app: &tauri::AppHandle) {
    log_info!("app", "开始退出清理");

    if let Some(state) = app.try_state::<AppState>() {
        // 1. 停止所有文件监听器
        if let Ok(mut signals) = state.watch_stop_signals.lock() {
            let count = signals.len();
            if count > 0 {
                log_info!("app", "停止 {} 个文件监听器", count);
                for (name, signal) in signals.drain() {
                    if let Ok(mut should_stop) = signal.lock() {
                        *should_stop = true;
                        log_debug!("app", "发送停止信号: {}", name);
                    }
                }
            }
        }

        // 2. 保存运行中进程 PID 到数据库
        let pids: HashMap<String, u32> = {
            if let Ok(processes) = state.processes.lock() {
                processes.iter().map(|(n, p)| (n.clone(), p.id())).collect()
            } else {
                HashMap::new()
            }
        };

        log_info!("app", "保存 {} 个运行中进程的 PID", pids.len());

        let _ = state.db.with_conn(|conn| {
            if let Err(e) = conn.execute("DELETE FROM runtime_state", []) {
                log_warn!("app", "清空运行状态表失败: {}", e);
            }
            for (name, pid) in &pids {
                if let Err(e) = conn.execute(
                    "INSERT INTO runtime_state (service_name, pid) VALUES (?1, ?2)",
                    rusqlite::params![name, pid],
                ) {
                    log_warn!("app", "保存进程 PID 失败: {} - {}", name, e);
                }
            }
            Ok(())
        });

        // 3. 终止所有子进程
        if let Ok(mut processes) = state.processes.lock() {
            let count = processes.len();
            log_info!("app", "终止 {} 个子进程", count);

            for (name, mut process) in processes.drain() {
                log_debug!("app", "终止进程: {} (PID: {})", name, process.id());
                services::process_manager::kill_process_tree(process.id());
                let _ = process.wait();
            }
        }

        // 4. 清空检测到的 PID
        if let Ok(mut detected) = state.detected_pids.lock() {
            detected.clear();
        }
    }

    log_info!("app", "退出清理完成");
}

/// 注册系统信号处理（Ctrl+C 等），确保异常退出时也能清理子进程
fn register_signal_handler() {
    ctrlc::set_handler(move || {
        log_info!("signal", "收到终止信号，开始清理");
        if let Some(handle) = APP_HANDLE.get() {
            cleanup_on_exit(handle);
        }
        std::process::exit(0);
    }).expect("注册信号处理失败");
}

// ===== 应用入口 =====

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // 二次启动时：显示并聚焦已有主窗口
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]), // 启动参数：最小化到托盘
        ))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // 初始化日志系统
            let home = dirs_next::home_dir().unwrap_or_else(|| std::path::PathBuf::from("."));
            let log_dir = home.join(".service-deck").join("logs");
            let log_level = load_log_level();
            let log_retention_days = load_log_retention_days();
            logger::init(log_dir, log_level, log_retention_days);
            log_info!("app", "应用启动，日志级别: {:?}，保留天数: {}", log_level, log_retention_days);

            // 初始化数据库（默认位置）
            let default_db_path = database::get_db_path();
            let db = match Database::open(&default_db_path) {
                Ok(db) => db,
                Err(e) => {
                    eprintln!("初始化数据库失败: {}", e);
                    return Err(e.into());
                }
            };

            // 读取已保存的自定义配置目录，如有则切换数据库位置
            let config_dir = if let Some(saved_dir) = read_saved_config_dir() {
                let new_db_path = saved_dir.join("service-deck.db");
                let default_parent = default_db_path.parent().unwrap_or(std::path::Path::new(".")).to_path_buf();
                if saved_dir != default_parent && new_db_path.exists() {
                    if let Err(e) = db.reopen_at(&saved_dir) {
                        log_warn!("setup", "切换到自定义配置目录失败: {}, 使用默认路径", e);
                        default_parent
                    } else {
                        log_info!("setup", "已切换到自定义配置目录: {:?}", saved_dir);
                        saved_dir
                    }
                } else {
                    default_parent
                }
            } else {
                default_db_path.parent().map(|p| p.to_path_buf()).unwrap_or_else(|| PathBuf::from("."))
            };

            // 尝试从旧 JSON 配置迁移
            let migrated = db.with_conn(|conn| {
                database::migration::migrate_from_json(conn)
            }).unwrap_or(false);
            if migrated {
                log_info!("setup", "已从 config.json 迁移到 SQLite");
            }

            // 迁移旧 auto_backup.json 到数据库
            let _ = db.with_conn(|conn| {
                database::migration::migrate_auto_backup_json(conn)
            });

            // 迁移 watch_include 格式：js → *.js
            let _ = db.with_conn(|conn| {
                database::migration::migrate_watch_include_format(conn)
            });

            // 加载设置
            let settings = db.with_conn(|conn| database::dao::settings::load_settings(conn))
                .unwrap_or_default();

            // 清空上次保存的运行状态（重启后 PID 会被系统复用，不可信任）
            // 由后台检测线程通过命令行匹配重新检测实际运行中的服务
            let _ = db.with_conn(|conn| {
                conn.execute("DELETE FROM runtime_state", [])
                    .map_err(|e| error::AppError::Database(e.to_string()))
            });

            let detected_pids = HashMap::new();

            // 创建系统托盘
            setup_tray(app)?;

            // 开机自启时静默启动到托盘（检查 --minimized 启动参数）
            // 窗口默认 visible:false，非自启时才显示
            if !std::env::args().any(|arg| arg == "--minimized") {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }

            // 设置窗口背景色
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_background_color(Some(tauri::window::Color(10, 10, 15, 255)));
            }

            // 注册 AppState
            let app_state = AppState {
                db: Arc::new(db),
                settings: Mutex::new(settings),
                processes: Mutex::new(HashMap::new()),
                detected_pids: Mutex::new(detected_pids),
                log_buffers: Arc::new(Mutex::new(HashMap::new())),
                log_viewers_active: Arc::new(Mutex::new(HashMap::new())),
                watch_events: Arc::new(Mutex::new(Vec::new())),
                watch_stop_signals: Arc::new(Mutex::new(HashMap::new())),
                config_dir: Mutex::new(config_dir),
            };
            app.manage(app_state);

            // 存储全局 AppHandle，供信号处理等外部回调使用
            let _ = APP_HANDLE.set(app.handle().clone());
            register_signal_handler();

            // 启动时检查自动备份
            {
                let state = app.state::<AppState>();
                commands::config_io::check_and_auto_backup(&state);
            }

            // 窗口关闭事件处理（根据 minimize_to_tray 设置决定行为）
            if let Some(window) = app.get_webview_window("main") {
                let win = window.clone();
                let app_handle = app.handle().clone();
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        // 实时读取 minimize_to_tray 设置
                        let should_minimize = app_handle
                            .try_state::<AppState>()
                            .map(|state| {
                                state.settings.lock().map(|s| s.minimize_to_tray).unwrap_or(true)
                            })
                            .unwrap_or(true); // 默认最小化到托盘

                        if should_minimize {
                            // 最小化到托盘：阻止关闭，隐藏窗口
                            api.prevent_close();
                            let _ = win.hide();
                        } else {
                            // 正常关闭：执行退出清理，放行关闭
                            cleanup_on_exit(&app_handle);
                        }
                    }
                });
            }

            // 后台检测手动启动的服务
            let app_handle = app.handle().clone();
            std::thread::spawn(move || {
                if let Some(state) = app_handle.try_state::<AppState>() {
                    let services = state.db.with_conn(|conn| {
                        database::dao::services::load_all(conn)
                    }).unwrap_or_default();

                    let detected = services::process_manager::detect_running_by_command(&services);
                    if !detected.is_empty() {
                        if let Ok(mut pids) = state.detected_pids.lock() {
                            for (name, pid) in detected {
                                if !pids.contains_key(&name) {
                                    log_info!("bg-detect", "检测到: {} (PID: {})", name, pid);
                                    pids.insert(name, pid);
                                }
                            }
                        }
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // 窗口
            commands::terminal::show_main_window,
            // 服务 CRUD
            commands::service::get_services,
            commands::service::add_service,
            commands::service::update_service,
            commands::service::delete_service,
            commands::service::update_service_sort,
            commands::service::toggle_service_favorite,
            // 项目 CRUD
            commands::project::get_projects,
            commands::project::add_project,
            commands::project::update_project,
            commands::project::remove_project,
            commands::project::toggle_project_favorite,
            commands::project::update_project_sort,
            commands::project::add_service_to_project,
            commands::project::remove_service_from_project,
            // 进程管理
            commands::process::start_service,
            commands::process::stop_service,
            commands::process::restart_service,
            commands::process::start_project,
            commands::process::stop_project,
            commands::process::restart_project,
            commands::process::get_running_services,
            commands::process::batch_start_services,
            commands::process::batch_stop_services,
            // 日志
            commands::log::get_service_logs,
            commands::log::get_log_file_size,
            commands::log::set_log_viewer_active,
            commands::log::clear_service_logs,
            // 设置
            commands::settings::get_settings,
            commands::settings::save_settings,
            // 配置导入导出
            commands::config_io::get_config_dir,
            commands::config_io::migrate_config_dir,
            commands::config_io::export_config,
            commands::config_io::import_config,
            // 数据库备份
            commands::config_io::get_manual_backups,
            commands::config_io::get_auto_backups,
            commands::config_io::create_manual_backup,
            commands::config_io::create_auto_backup,
            commands::config_io::restore_backup,
            commands::config_io::delete_backup,
            commands::config_io::rename_backup,
            commands::config_io::cleanup_auto_backups,
            commands::config_io::clear_auto_backups,
            // 文件监听
            commands::watch::set_watch_mode,
            commands::watch::get_watch_events,
            commands::watch::clear_watch_events,
            // 终端
            commands::terminal::open_directory,
            commands::terminal::open_system_terminal,
            // 应用日志
            commands::log::get_log_entries,
            commands::log::get_log_dates,
            commands::log::get_log_level,
            commands::log::set_log_level,
            commands::log::clear_logs,
            commands::log::get_log_retention_days,
            commands::log::set_log_retention_days,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// 设置系统托盘
fn setup_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    use tauri::menu::{MenuBuilder, MenuItemBuilder};

    let show_item = MenuItemBuilder::with_id("show", "显示窗口").build(app)?;
    let hide_item = MenuItemBuilder::with_id("hide", "隐藏窗口").build(app)?;
    let exit_item = MenuItemBuilder::with_id("exit", "退出程序").build(app)?;

    let menu = MenuBuilder::new(app)
        .item(&show_item)
        .item(&hide_item)
        .separator()
        .item(&exit_item)
        .build()?;

    let tray = app.tray_by_id("main").ok_or("托盘未找到")?;
    tray.set_menu(Some(menu.clone()))?;

    tray.on_menu_event(move |app, event| {
        match event.id().as_ref() {
            "show" => {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            }
            "hide" => {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.hide();
                }
            }
            "exit" => {
                cleanup_on_exit(app);
                app.exit(0);
            }
            _ => {}
        }
    });

    // 左键点击托盘 → 显示窗口
    let handle = app.handle().clone();
    tray.on_tray_icon_event(move |_tray, event| {
        if let tauri::tray::TrayIconEvent::Click {
            button: tauri::tray::MouseButton::Left,
            button_state: tauri::tray::MouseButtonState::Up,
            ..
        } = event {
            if let Some(w) = handle.get_webview_window("main") {
                let _ = w.show();
                let _ = w.set_focus();
            }
        }
    });

    Ok(())
}
