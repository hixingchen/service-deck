use std::fs;
use std::path::PathBuf;
use tauri::State;
use serde::{Serialize, Deserialize};
use crate::AppState;
use crate::database::dao;
use crate::{log_info, log_warn, log_error};

#[tauri::command]
pub fn get_config_dir(state: State<AppState>) -> Result<(String, String), String> {
    let home = dirs_next::home_dir().ok_or("无法获取用户目录")?;
    let default_dir = home.join(".service-deck");
    let default_dir_str = default_dir.to_string_lossy().to_string();

    // 从 AppState 获取当前配置目录
    let current_dir = state.config_dir.lock()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|_| default_dir_str.clone());

    Ok((current_dir, default_dir_str))
}

#[tauri::command]
pub async fn migrate_config_dir(state: State<'_, AppState>, new_dir: String) -> Result<(), String> {
    log_info!("config", "迁移配置目录到: {}", new_dir);

    let new_path = PathBuf::from(&new_dir);
    let old_path = state.config_dir.lock()
        .map(|p| p.clone())
        .unwrap_or_else(|_| {
            let home = dirs_next::home_dir().unwrap_or_default();
            home.join(".service-deck")
        });

    // 确保新目录存在
    fs::create_dir_all(&new_path)
        .map_err(|e| format!("创建新目录失败: {}", e))?;

    // 迁移数据库
    let new_db_path = new_path.join("service-deck.db");
    state.db.migrate_to(&new_db_path)
        .map_err(|e| {
            log_error!("config", "数据库迁移失败: {}", e);
            e.to_string()
        })?;
    log_info!("config", "数据库迁移成功");

    // 迁移 backups 目录
    let old_backups = old_path.join("backups");
    let new_backups = new_path.join("backups");
    if old_backups.exists() {
        copy_dir_all(&old_backups, &new_backups)
            .map_err(|e| {
                log_warn!("config", "备份目录迁移失败: {}", e);
                e
            })
            .ok();
        log_info!("config", "备份目录迁移成功");
    }

    // 迁移 logs 目录
    let old_logs = old_path.join("logs");
    let new_logs = new_path.join("logs");
    if old_logs.exists() {
        copy_dir_all(&old_logs, &new_logs)
            .map_err(|e| {
                log_warn!("config", "日志目录迁移失败: {}", e);
                e
            })
            .ok();
        log_info!("config", "日志目录迁移成功");
    }

    // 持久化配置目录到固定配置文件（~/.service-deck/settings.json）
    crate::write_saved_config_dir(&new_path)?;

    // 清理旧目录下的文件（仅当旧目录不是默认目录时）
    let home = dirs_next::home_dir().unwrap_or_default();
    let default_dir = home.join(".service-deck");
    if old_path != default_dir && old_path.exists() {
        // 删除旧数据库
        let old_db = old_path.join("service-deck.db");
        if old_db.exists() {
            fs::remove_file(&old_db).ok();
            // 删除 WAL 和 SHM 文件
            fs::remove_file(old_path.join("service-deck.db-wal")).ok();
            fs::remove_file(old_path.join("service-deck.db-shm")).ok();
        }
        // 删除旧备份目录
        let old_backups = old_path.join("backups");
        if old_backups.exists() {
            fs::remove_dir_all(&old_backups).ok();
        }
        // 删除旧日志目录
        let old_logs = old_path.join("logs");
        if old_logs.exists() {
            fs::remove_dir_all(&old_logs).ok();
        }
        log_info!("config", "旧目录清理完成");
    }

    // 更新内存中的 config_dir
    if let Ok(mut config_dir) = state.config_dir.lock() {
        *config_dir = new_path;
    }

    // 从新路径重新加载设置
    let new_settings = state.db.with_conn(|conn| {
        crate::database::dao::settings::load_settings(conn)
    }).map_err(|e| e.to_string())?;
    if let Ok(mut settings) = state.settings.lock() {
        *settings = new_settings;
    }

    log_info!("config", "配置目录迁移完成");
    Ok(())
}

/// 递归复制目录
fn copy_dir_all(src: &PathBuf, dst: &PathBuf) -> Result<(), String> {
    fs::create_dir_all(dst)
        .map_err(|e| format!("创建目录失败: {}", e))?;

    for entry in fs::read_dir(src)
        .map_err(|e| format!("读取目录失败: {}", e))? {
        let entry = entry.map_err(|e| format!("读取目录项失败: {}", e))?;
        let ty = entry.file_type()
            .map_err(|e| format!("获取文件类型失败: {}", e))?;

        let target = dst.join(entry.file_name());

        if ty.is_dir() {
            copy_dir_all(&entry.path(), &target)?;
        } else {
            fs::copy(entry.path(), target)
                .map_err(|e| format!("复制文件失败: {}", e))?;
        }
    }

    Ok(())
}

#[tauri::command]
pub fn export_config(state: State<AppState>, export_path: String) -> Result<(), String> {
    // 路径安全校验
    crate::utils::validate_file_path(&export_path).map_err(|e| e.to_string())?;

    log_info!("config", "导出配置到: {}", export_path);

    let json = state.db.with_conn(|conn| {
        let services = dao::services::load_all(conn)?;
        let projects = dao::projects::load_all(conn, &services)?;

        log_info!("config", "导出数据: {} 个服务, {} 个项目", services.len(), projects.len());

        let export = serde_json::json!({
            "services": services.values().collect::<Vec<_>>(),
            "projects": projects.values().collect::<Vec<_>>(),
        });

        serde_json::to_string_pretty(&export).map_err(|e| crate::error::AppError::Json(format!("{}", e)))
    }).map_err(|e| e.to_string())?;

    let path = PathBuf::from(&export_path);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("创建目录失败: {}", e))?;
    }
    fs::write(&path, &json).map_err(|e| format!("写入文件失败: {}", e))?;

    log_info!("config", "配置导出成功");
    Ok(())
}

#[tauri::command]
pub fn import_config(_app: tauri::AppHandle, state: State<AppState>, import_path: String) -> Result<(), String> {
    // 路径安全校验
    crate::utils::validate_file_path(&import_path).map_err(|e| e.to_string())?;

    let path = PathBuf::from(&import_path);
    if !path.exists() { return Err("导入文件不存在".into()); }

    let json = fs::read_to_string(&path).map_err(|e| format!("读取文件失败: {}", e))?;

    // 尝试解析为完整配置（含 services + projects）
    if let Ok(config) = serde_json::from_str::<serde_json::Value>(&json) {
        state.db.with_conn(|conn| {
            // 导入 services
            if let Some(svcs) = config.get("services").and_then(|v| v.as_array()) {
                for val in svcs {
                    if let Ok(svc) = serde_json::from_value::<crate::Service>(val.clone()) {
                        if let Err(e) = dao::services::save(conn, &svc) {
                            log_warn!("import", "保存服务 {} 失败: {}", svc.name, e);
                        }
                    }
                }
            }
            // 导入 projects
            if let Some(projs) = config.get("projects").and_then(|v| v.as_array()) {
                for val in projs {
                    if let Some(id) = val.get("id").and_then(|v| v.as_str()) {
                        let name = val.get("name").and_then(|v| v.as_str()).unwrap_or("");
                        let sort_index = val.get("sort_index").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
                        let favorite = val.get("favorite").and_then(|v| v.as_bool()).unwrap_or(false);
                        let project = crate::Project {
                            id: id.to_string(),
                            name: name.to_string(),
                            services: Vec::new(),
                            sort_index,
                            favorite,
                        };
                        let _ = dao::projects::save(conn, &project);

                        // 导入关联
                        if let Some(svcs) = val.get("services").and_then(|v| v.as_array()) {
                            for svc_val in svcs {
                                if let Some(sid) = svc_val.get("id").and_then(|v| v.as_str()) {
                                    let _ = dao::projects::add_service(conn, id, sid);
                                }
                            }
                        }
                    }
                }
            }
            Ok(())
        }).map_err(|e: crate::error::AppError| e.to_string())?;
    }

    Ok(())
}

/// 备份信息
#[derive(Serialize)]
pub struct BackupInfo {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub created_at: String,
}

/// 自动备份设置
#[derive(Serialize, Deserialize, Clone)]
pub struct AutoBackupConfig {
    pub enabled: bool,
    pub keep_days: i64, // 保留天数：3、7、30
}

impl Default for AutoBackupConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            keep_days: 7,
        }
    }
}

/// 获取备份根目录
fn get_backup_dir() -> Result<PathBuf, String> {
    let home = dirs_next::home_dir().ok_or("无法获取用户目录")?;
    let backup_dir = home.join(".service-deck").join("backups");
    fs::create_dir_all(&backup_dir).map_err(|e| format!("创建备份目录失败: {}", e))?;
    Ok(backup_dir)
}

/// 获取自动备份目录
fn get_auto_backup_dir() -> Result<PathBuf, String> {
    let dir = get_backup_dir()?.join("auto");
    fs::create_dir_all(&dir).map_err(|e| format!("创建自动备份目录失败: {}", e))?;
    Ok(dir)
}

/// 获取手动备份目录
fn get_manual_backup_dir() -> Result<PathBuf, String> {
    let dir = get_backup_dir()?.join("manual");
    fs::create_dir_all(&dir).map_err(|e| format!("创建手动备份目录失败: {}", e))?;
    Ok(dir)
}

/// 获取当前数据库路径
fn get_current_db_path(state: &AppState) -> PathBuf {
    state.db.db_path()
}

/// 执行数据库检查点
fn checkpoint_db(state: &AppState) -> Result<(), String> {
    state.db.with_conn(|conn| {
        conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE)")
            .map_err(|e| crate::error::AppError::Database(format!("检查点失败: {}", e)))?;
        Ok(())
    }).map_err(|e| e.to_string())
}

/// 创建备份文件（使用临时文件 + 原子重命名，防止中断导致损坏）
fn create_backup_file(state: &AppState, backup_dir: &PathBuf) -> Result<BackupInfo, String> {
    let db_path = get_current_db_path(state);

    if !db_path.exists() {
        return Err("数据库文件不存在".into());
    }

    // 执行检查点
    checkpoint_db(state)?;

    // 生成备份文件名
    let now = chrono::Local::now();
    let filename = format!("service-deck_{}.db", now.format("%Y%m%d_%H%M%S"));
    let backup_path = backup_dir.join(&filename);
    let temp_path = backup_dir.join(format!(".tmp_{}", filename));

    // 先复制到临时文件
    fs::copy(&db_path, &temp_path)
        .map_err(|e| {
            // 清理临时文件
            let _ = fs::remove_file(&temp_path);
            format!("备份失败: {}", e)
        })?;

    // 原子重命名：临时文件 → 正式文件
    // rename 是原子操作，要么成功，要么失败，不会留下不完整文件
    fs::rename(&temp_path, &backup_path)
        .map_err(|e| {
            // 清理临时文件
            let _ = fs::remove_file(&temp_path);
            format!("重命名备份文件失败: {}", e)
        })?;

    let metadata = fs::metadata(&backup_path)
        .map_err(|e| format!("获取备份信息失败: {}", e))?;

    Ok(BackupInfo {
        name: filename.replace(".db", ""),
        path: backup_path.to_string_lossy().to_string(),
        size: metadata.len(),
        created_at: now.format("%Y-%m-%d %H:%M:%S").to_string(),
    })
}

/// 扫描目录中的备份文件
fn scan_backups(dir: &PathBuf) -> Vec<BackupInfo> {
    let mut backups = Vec::new();

    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().map_or(false, |ext| ext == "db") {
                let name = path.file_stem()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string();

                let metadata = fs::metadata(&path).ok();
                let size = metadata.as_ref().map(|m| m.len()).unwrap_or(0);
                let created = metadata.as_ref()
                    .and_then(|m| m.created().ok())
                    .map(|t| {
                        let datetime: chrono::DateTime<chrono::Local> = t.into();
                        datetime.format("%Y-%m-%d %H:%M:%S").to_string()
                    })
                    .unwrap_or_else(|| "未知".to_string());

                backups.push(BackupInfo {
                    name,
                    path: path.to_string_lossy().to_string(),
                    size,
                    created_at: created,
                });
            }
        }
    }

    backups.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    backups
}

/// 获取手动备份列表
#[tauri::command]
pub fn get_manual_backups() -> Result<Vec<BackupInfo>, String> {
    let dir = get_manual_backup_dir()?;
    Ok(scan_backups(&dir))
}

/// 获取自动备份列表
#[tauri::command]
pub fn get_auto_backups() -> Result<Vec<BackupInfo>, String> {
    let dir = get_auto_backup_dir()?;
    Ok(scan_backups(&dir))
}

/// 创建手动备份
#[tauri::command]
pub fn create_manual_backup(state: State<AppState>) -> Result<BackupInfo, String> {
    log_info!("backup", "创建手动备份");
    let dir = get_manual_backup_dir()?;
    let backup = create_backup_file(&state, &dir)?;
    log_info!("backup", "手动备份创建成功: {}", backup.name);
    Ok(backup)
}

/// 创建自动备份（覆盖当天的）
#[tauri::command]
pub fn create_auto_backup(state: State<AppState>) -> Result<BackupInfo, String> {
    log_info!("backup", "创建自动备份");

    let dir = get_auto_backup_dir()?;

    // 删除当天已有的备份
    let today = chrono::Local::now().format("%Y%m%d").to_string();
    if let Ok(entries) = fs::read_dir(&dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if let Some(name) = path.file_stem().and_then(|n| n.to_str()) {
                if name.contains(&today) {
                    fs::remove_file(&path).ok();
                    log_info!("backup", "删除今天的旧备份: {:?}", path);
                }
            }
        }
    }

    let backup = create_backup_file(&state, &dir)?;
    log_info!("backup", "自动备份创建成功: {}", backup.name);
    Ok(backup)
}

/// 清理过期的自动备份
#[tauri::command]
pub fn cleanup_auto_backups(keep_days: i64) -> Result<u32, String> {
    log_info!("backup", "清理自动备份，保留 {} 天", keep_days);

    let dir = get_auto_backup_dir()?;
    let cutoff = chrono::Local::now() - chrono::Duration::days(keep_days);
    let mut deleted = 0;

    if let Ok(entries) = fs::read_dir(&dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().map_or(false, |ext| ext == "db") {
                if let Ok(metadata) = fs::metadata(&path) {
                    if let Ok(created) = metadata.created() {
                        let datetime: chrono::DateTime<chrono::Local> = created.into();
                        if datetime < cutoff {
                            fs::remove_file(&path).ok();
                            deleted += 1;
                            log_info!("backup", "删除过期备份: {:?}", path);
                        }
                    }
                }
            }
        }
    }

    log_info!("backup", "清理完成，删除了 {} 个备份", deleted);
    Ok(deleted)
}

/// 一键清空自动备份
#[tauri::command]
pub fn clear_auto_backups() -> Result<u32, String> {
    log_info!("backup", "清空所有自动备份");

    let dir = get_auto_backup_dir()?;
    let mut deleted = 0;

    if let Ok(entries) = fs::read_dir(&dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().map_or(false, |ext| ext == "db") {
                fs::remove_file(&path).ok();
                deleted += 1;
            }
        }
    }

    log_info!("backup", "清空完成，删除了 {} 个备份", deleted);
    Ok(deleted)
}

/// 启动时清理可能残留的临时文件
fn cleanup_temp_files() {
    // 清理手动备份目录的临时文件
    if let Ok(dir) = get_manual_backup_dir() {
        cleanup_temp_in_dir(&dir);
    }
    // 清理自动备份目录的临时文件
    if let Ok(dir) = get_auto_backup_dir() {
        cleanup_temp_in_dir(&dir);
    }
}

/// 清理目录中的临时文件（以 .tmp_ 开头的文件）
fn cleanup_temp_in_dir(dir: &PathBuf) {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                if name.starts_with(".tmp_") {
                    let _ = fs::remove_file(&path);
                    log_info!("backup", "清理残留临时文件: {:?}", path);
                }
            }
        }
    }
}

/// 启动时检查并执行自动备份
pub fn check_and_auto_backup(state: &AppState) {
    // 清理可能残留的临时文件
    cleanup_temp_files();

    // 从内存中的 settings 读取自动备份配置
    let (enabled, keep_days) = {
        let settings = match state.settings.lock() {
            Ok(s) => s,
            Err(_) => return,
        };
        (settings.auto_backup_enabled, settings.auto_backup_keep_days)
    };
    if !enabled {
        return;
    }

    log_info!("backup", "检查自动备份...");

    let dir = match get_auto_backup_dir() {
        Ok(d) => d,
        Err(e) => {
            log_error!("backup", "获取自动备份目录失败: {}", e);
            return;
        }
    };

    // 检查今天是否已有备份，有则覆盖
    let today = chrono::Local::now().format("%Y%m%d").to_string();
    if let Ok(entries) = fs::read_dir(&dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if let Some(name) = path.file_stem().and_then(|n| n.to_str()) {
                if name.contains(&today) {
                    fs::remove_file(&path).ok();
                    log_info!("backup", "删除今天的旧备份: {:?}", path);
                }
            }
        }
    }

    // 执行自动备份
    log_info!("backup", "执行自动备份...");
    match create_backup_file(state, &dir) {
        Ok(backup) => {
            log_info!("backup", "自动备份成功: {}", backup.name);
        }
        Err(e) => {
            log_error!("backup", "自动备份失败: {}", e);
        }
    }

    // 清理过期备份
    let _ = cleanup_auto_backups(keep_days);
}

/// 获取自动备份配置
#[tauri::command]
pub fn get_auto_backup_config_cmd(state: State<AppState>) -> Result<AutoBackupConfig, String> {
    let settings = state.settings.lock().map_err(|e| format!("获取锁失败: {}", e))?;
    Ok(AutoBackupConfig {
        enabled: settings.auto_backup_enabled,
        keep_days: settings.auto_backup_keep_days,
    })
}

/// 保存自动备份配置
#[tauri::command]
pub fn save_auto_backup_config_cmd(state: State<AppState>, config: AutoBackupConfig) -> Result<(), String> {
    log_info!("backup", "保存自动备份配置: enabled={}, keep_days={}", config.enabled, config.keep_days);

    // 更新内存状态
    {
        let mut settings = state.settings.lock().map_err(|e| format!("获取锁失败: {}", e))?;
        settings.auto_backup_enabled = config.enabled;
        settings.auto_backup_keep_days = config.keep_days;
    }

    // 持久化到数据库
    let settings = state.settings.lock().map_err(|e| format!("获取锁失败: {}", e))?;
    state.db.with_conn(|conn| {
        crate::database::dao::settings::save_settings(conn, &settings)
    }).map_err(|e| e.to_string())
}

/// 恢复备份
#[tauri::command]
pub fn restore_backup(app: tauri::AppHandle, state: State<AppState>, backup_path: String) -> Result<(), String> {
    log_info!("backup", "开始恢复备份: {}", backup_path);

    let backup = PathBuf::from(&backup_path);
    if !backup.exists() {
        log_error!("backup", "备份文件不存在: {}", backup_path);
        return Err("备份文件不存在".into());
    }

    let db_path = get_current_db_path(&state);

    // 关闭当前数据库连接
    state.db.close_for_migrate()
        .map_err(|e| {
            log_error!("backup", "关闭数据库失败: {}", e);
            format!("关闭数据库失败: {}", e)
        })?;

    // 删除当前的 WAL 和 SHM 文件（避免状态不一致）
    let wal_path = db_path.with_extension("db-wal");
    let shm_path = db_path.with_extension("db-shm");
    fs::remove_file(&wal_path).ok();
    fs::remove_file(&shm_path).ok();

    // 用备份文件替换当前数据库
    fs::copy(&backup, &db_path)
        .map_err(|e| {
            log_error!("backup", "恢复失败: {}", e);
            format!("恢复失败: {}", e)
        })?;

    // 重新打开数据库
    state.db.reopen(&db_path)
        .map_err(|e| {
            log_error!("backup", "重新打开数据库失败: {}", e);
            format!("重新打开数据库失败: {}", e)
        })?;

    // 重新加载设置
    let new_settings = state.db.with_conn(|conn| {
        dao::settings::load_settings(conn)
    }).map_err(|e| e.to_string())?;

    if let Ok(mut settings) = state.settings.lock() {
        *settings = new_settings;
    }

    log_info!("backup", "备份恢复成功");

    // 生产模式自动重启，开发模式需要手动重启
    #[cfg(not(debug_assertions))]
    {
        app.restart();
    }

    #[cfg(debug_assertions)]
    {
        log_info!("backup", "开发模式下需要手动重启应用");
    }

    Ok(())
}

/// 删除备份
#[tauri::command]
pub fn delete_backup(backup_path: String) -> Result<(), String> {
    // 路径安全校验
    crate::utils::validate_file_path(&backup_path).map_err(|e| e.to_string())?;

    log_info!("backup", "删除备份: {}", backup_path);

    let path = PathBuf::from(&backup_path);
    if !path.exists() {
        return Err("备份文件不存在".into());
    }

    // 安全检查：确保文件在备份目录内
    let backup_dir = get_backup_dir()?;
    if !path.starts_with(&backup_dir) {
        return Err("只能删除备份目录内的文件".into());
    }

    fs::remove_file(&path)
        .map_err(|e| format!("删除失败: {}", e))?;

    Ok(())
}

/// 重命名备份
#[tauri::command]
pub fn rename_backup(backup_path: String, new_name: String) -> Result<String, String> {
    // 路径安全校验
    crate::utils::validate_file_path(&backup_path).map_err(|e| e.to_string())?;

    log_info!("backup", "重命名备份: {} -> {}", backup_path, new_name);

    let path = PathBuf::from(&backup_path);
    if !path.exists() {
        return Err("备份文件不存在".into());
    }

    // 安全检查：确保文件在备份目录内
    let backup_dir = get_backup_dir()?;
    if !path.starts_with(&backup_dir) {
        return Err("只能重命名备份目录内的文件".into());
    }

    // 验证新名称（只允许字母、数字、下划线、连字符、中文）
    if new_name.is_empty() || new_name.len() > 100 {
        return Err("名称长度必须在 1-100 个字符之间".into());
    }

    // 构建新路径
    let new_path = path.parent()
        .ok_or("无法获取父目录")?
        .join(format!("{}.db", new_name));

    // 检查新文件是否已存在
    if new_path.exists() {
        return Err("同名备份已存在".into());
    }

    // 重命名文件
    fs::rename(&path, &new_path)
        .map_err(|e| format!("重命名失败: {}", e))?;

    log_info!("backup", "重命名成功: {:?}", new_path);
    Ok(new_path.to_string_lossy().to_string())
}
