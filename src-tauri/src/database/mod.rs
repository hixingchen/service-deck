pub mod schema;
pub mod migration;
pub mod dao;

use std::path::PathBuf;
use std::sync::Mutex;
use rusqlite::Connection;
use crate::error::AppError;
use crate::{log_info, log_error};

/// 数据库封装，内部使用 Mutex 保证线程安全
pub struct Database {
    conn: Mutex<Option<Connection>>,
    path: Mutex<PathBuf>,
}

impl Database {
    /// 打开或创建数据库
    pub fn open(db_path: &PathBuf) -> Result<Self, AppError> {
        log_info!("database", "打开数据库: {:?}", db_path);

        let conn = Connection::open(db_path)
            .map_err(|e| {
                log_error!("database", "打开数据库失败: {}", e);
                AppError::Database(format!("打开数据库失败: {}", e))
            })?;
        schema::init_schema(&conn)?;

        log_info!("database", "数据库打开成功");
        Ok(Self {
            conn: Mutex::new(Some(conn)),
            path: Mutex::new(db_path.clone()),
        })
    }

    /// 执行数据库操作（获取锁后调用闭包）
    pub fn with_conn<F, R>(&self, f: F) -> Result<R, AppError>
    where
        F: FnOnce(&Connection) -> Result<R, AppError>,
    {
        let conn_guard = self.conn.lock()
            .map_err(|e| AppError::Database(format!("获取数据库锁失败: {}", e)))?;
        let conn = conn_guard.as_ref()
            .ok_or_else(|| AppError::Database("数据库连接已关闭".into()))?;
        f(conn)
    }

    /// 获取数据库文件路径字符串
    pub fn db_path_string(&self) -> String {
        self.path.lock().map(|p| p.to_string_lossy().to_string()).unwrap_or_default()
    }

    /// 获取数据库文件路径
    pub fn db_path(&self) -> PathBuf {
        self.path.lock().map(|p| p.clone()).unwrap_or_default()
    }

    /// 迁移数据库到新路径（关闭连接 → 复制 → 删除旧文件 → 重新打开）
    pub fn migrate_to(&self, new_db_path: &PathBuf) -> Result<(), AppError> {
        let old_path = self.db_path();

        // 如果新旧路径相同，无需迁移
        if old_path == *new_db_path {
            return Ok(());
        }

        // 确保新目录存在
        if let Some(parent) = new_db_path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| AppError::Database(format!("创建目录失败: {}", e)))?;
        }

        // 1. 关闭当前数据库连接
        {
            let mut conn_guard = self.conn.lock()
                .map_err(|e| AppError::Database(format!("获取数据库锁失败: {}", e)))?;
            *conn_guard = None;
        }

        // 2. 复制数据库文件到新位置
        std::fs::copy(&old_path, new_db_path)
            .map_err(|e| AppError::Database(format!("复制数据库文件失败: {}", e)))?;

        // 3. 删除旧数据库文件
        std::fs::remove_file(&old_path)
            .map_err(|e| AppError::Database(format!("删除旧数据库文件失败: {}", e)))?;

        // 4. 重新打开新位置的数据库
        let new_conn = Connection::open(new_db_path)
            .map_err(|e| AppError::Database(format!("重新打开数据库失败: {}", e)))?;
        schema::init_schema(&new_conn)?;

        // 5. 更新内部状态
        {
            let mut conn_guard = self.conn.lock()
                .map_err(|e| AppError::Database(format!("获取数据库锁失败: {}", e)))?;
            *conn_guard = Some(new_conn);
        }
        {
            let mut path = self.path.lock()
                .map_err(|e| AppError::Database(format!("获取路径锁失败: {}", e)))?;
            *path = new_db_path.clone();
        }

        Ok(())
    }

    /// 关闭数据库连接（用于迁移前）
    pub fn close_for_migrate(&self) -> Result<(), AppError> {
        log_info!("database", "关闭数据库连接用于迁移");
        let mut conn_guard = self.conn.lock()
            .map_err(|e| AppError::Database(format!("获取数据库锁失败: {}", e)))?;
        *conn_guard = None;
        Ok(())
    }

    /// 重新打开数据库连接
    pub fn reopen(&self, db_path: &PathBuf) -> Result<(), AppError> {
        log_info!("database", "重新打开数据库: {:?}", db_path);

        let new_conn = Connection::open(db_path)
            .map_err(|e| {
                log_error!("database", "重新打开数据库失败: {}", e);
                AppError::Database(format!("打开数据库失败: {}", e))
            })?;
        schema::init_schema(&new_conn)?;

        let mut conn_guard = self.conn.lock()
            .map_err(|e| AppError::Database(format!("获取数据库锁失败: {}", e)))?;
        *conn_guard = Some(new_conn);

        let mut path = self.path.lock()
            .map_err(|e| AppError::Database(format!("获取路径锁失败: {}", e)))?;
        *path = db_path.clone();

        log_info!("database", "数据库重新打开成功");
        Ok(())
    }

    /// 关闭当前连接，重新打开指定目录下的数据库（目标文件必须已存在）
    pub fn reopen_at(&self, new_dir: &PathBuf) -> Result<(), AppError> {
        let new_db_path = new_dir.join("service-deck.db");

        // 关闭旧连接
        {
            let mut conn_guard = self.conn.lock()
                .map_err(|e| AppError::Database(format!("获取数据库锁失败: {}", e)))?;
            *conn_guard = None;
        }

        // 打开新连接
        let new_conn = Connection::open(&new_db_path)
            .map_err(|e| AppError::Database(format!("打开数据库失败: {}", e)))?;
        schema::init_schema(&new_conn)?;

        // 更新内部状态
        {
            let mut conn_guard = self.conn.lock()
                .map_err(|e| AppError::Database(format!("获取数据库锁失败: {}", e)))?;
            *conn_guard = Some(new_conn);
        }
        {
            let mut path = self.path.lock()
                .map_err(|e| AppError::Database(format!("获取路径锁失败: {}", e)))?;
            *path = new_db_path;
        }

        Ok(())
    }
}

/// 获取数据库文件路径: ~/.service-deck/service-deck.db
pub fn get_db_path() -> PathBuf {
    let home = dirs_next::home_dir().unwrap_or_else(|| PathBuf::from("."));
    let dir = home.join(".service-deck");
    std::fs::create_dir_all(&dir).ok();
    dir.join("service-deck.db")
}
