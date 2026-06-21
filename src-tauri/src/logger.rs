use std::fs::{self, OpenOptions, File};
use std::io::Write;
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};
use chrono::Local;
use serde::{Deserialize, Serialize};

/// 日志级别
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LogLevel {
    Debug,
    Info,
    Warn,
    Error,
}

impl LogLevel {
    pub fn as_str(&self) -> &'static str {
        match self {
            LogLevel::Debug => "DEBUG",
            LogLevel::Info => "INFO",
            LogLevel::Warn => "WARN",
            LogLevel::Error => "ERROR",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "debug" => LogLevel::Debug,
            "info" => LogLevel::Info,
            "warn" | "warning" => LogLevel::Warn,
            "error" => LogLevel::Error,
            _ => LogLevel::Info,
        }
    }
}

/// 日志条目
#[derive(Debug, Serialize, Deserialize)]
pub struct LogEntry {
    pub timestamp: String,
    pub level: String,
    pub target: String,
    pub message: String,
}

/// 全局日志管理器
pub struct Logger {
    log_dir: PathBuf,
    current_level: Mutex<LogLevel>,
    file: Mutex<Option<File>>,
    current_date: Mutex<String>,
    retention_days: Mutex<i64>,
}

impl Logger {
    /// 创建新的日志管理器
    pub fn new(log_dir: PathBuf, retention_days: i64) -> Self {
        fs::create_dir_all(&log_dir).ok();

        let logger = Logger {
            log_dir,
            current_level: Mutex::new(LogLevel::Info),
            file: Mutex::new(None),
            current_date: Mutex::new(String::new()),
            retention_days: Mutex::new(retention_days),
        };

        // 清理旧日志
        logger.cleanup_old_logs();

        // 初始化日志文件
        logger.rotate_if_needed();

        logger
    }

    /// 设置日志级别
    pub fn set_level(&self, level: LogLevel) {
        if let Ok(mut current) = self.current_level.lock() {
            *current = level;
        }
    }

    /// 获取当前日志级别
    pub fn get_level(&self) -> LogLevel {
        self.current_level.lock().map(|l| *l).unwrap_or(LogLevel::Info)
    }

    /// 设置日志保留天数
    pub fn set_retention_days(&self, days: i64) {
        if let Ok(mut current) = self.retention_days.lock() {
            *current = days;
        }
        // 立即清理旧日志
        self.cleanup_old_logs();
    }

    /// 获取日志保留天数
    pub fn get_retention_days(&self) -> i64 {
        self.retention_days.lock().map(|d| *d).unwrap_or(7)
    }

    /// 写入日志
    pub fn log(&self, level: LogLevel, target: &str, message: &str) {
        // 检查日志级别
        if level < self.get_level() {
            return;
        }

        let now = Local::now();
        let timestamp = now.format("%Y-%m-%d %H:%M:%S%.3f").to_string();
        let date = now.format("%Y-%m-%d").to_string();

        // 检查是否需要轮转
        {
            if let Ok(current_date) = self.current_date.lock() {
                let need_rotate = *current_date != date;
                drop(current_date);
                if need_rotate {
                    self.rotate_if_needed();
                }
            }
        }

        // 格式化日志行
        let log_line = format!("{} [{}] {} - {}\n", timestamp, level.as_str(), target, message);

        // 写入文件
        if let Ok(mut file_guard) = self.file.lock() {
            if let Some(ref mut file) = *file_guard {
                file.write_all(log_line.as_bytes()).ok();
                file.flush().ok();
            }
        }
    }

    /// 轮转日志文件
    fn rotate_if_needed(&self) {
        let now = Local::now();
        let date = now.format("%Y-%m-%d").to_string();
        let log_file = self.log_dir.join(format!("{}.log", date));

        if let Ok(mut file_guard) = self.file.lock() {
            *file_guard = OpenOptions::new()
                .create(true)
                .append(true)
                .open(&log_file)
                .ok();
        }

        if let Ok(mut current_date) = self.current_date.lock() {
            *current_date = date;
        }
    }

    /// 清理旧日志（根据保留天数配置）
    fn cleanup_old_logs(&self) {
        let days = self.retention_days.lock().map(|d| *d).unwrap_or(7);
        let now = Local::now();
        let cutoff = now - chrono::Duration::days(days);

        if let Ok(entries) = fs::read_dir(&self.log_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().map_or(false, |ext| ext == "log") {
                    if let Some(stem) = path.file_stem() {
                        let name = stem.to_string_lossy().to_string();
                        if let Ok(date) = chrono::NaiveDate::parse_from_str(&name, "%Y-%m-%d") {
                            if date < cutoff.naive_local().date() {
                                fs::remove_file(&path).ok();
                            }
                        }
                    }
                }
            }
        }
    }

    /// 读取日志文件内容
    pub fn read_logs(&self, date: Option<&str>, limit: usize) -> Vec<LogEntry> {
        let log_file = if let Some(d) = date {
            self.log_dir.join(format!("{}.log", d))
        } else {
            let today = Local::now().format("%Y-%m-%d").to_string();
            self.log_dir.join(format!("{}.log", today))
        };

        if !log_file.exists() {
            return Vec::new();
        }

        let content = fs::read_to_string(&log_file).unwrap_or_default();
        let lines: Vec<&str> = content.lines().collect();

        // 取最后 N 行
        let start = if lines.len() > limit {
            lines.len() - limit
        } else {
            0
        };

        lines[start..]
            .iter()
            .filter_map(|line| self.parse_log_line(line))
            .collect()
    }

    /// 获取可用的日志日期列表
    pub fn get_log_dates(&self) -> Vec<String> {
        let mut dates = Vec::new();

        if let Ok(entries) = fs::read_dir(&self.log_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().map_or(false, |ext| ext == "log") {
                    if let Some(stem) = path.file_stem() {
                        let name = stem.to_string_lossy().to_string();
                        if chrono::NaiveDate::parse_from_str(&name, "%Y-%m-%d").is_ok() {
                            dates.push(name);
                        }
                    }
                }
            }
        }

        dates.sort();
        dates.reverse();
        dates
    }

    /// 清空指定日期的日志文件
    pub fn clear_logs(&self, date: Option<&str>) -> Result<(), String> {
        let log_file = if let Some(d) = date {
            self.log_dir.join(format!("{}.log", d))
        } else {
            let today = Local::now().format("%Y-%m-%d").to_string();
            self.log_dir.join(format!("{}.log", today))
        };

        if log_file.exists() {
            // 如果清空的是当前日志文件，需要重新打开
            let today = Local::now().format("%Y-%m-%d").to_string();
            let is_current = date.map_or(true, |d| d == today);

            if is_current {
                // 关闭当前文件句柄
                if let Ok(mut file_guard) = self.file.lock() {
                    *file_guard = None;
                }
            }

            // 清空文件
            fs::write(&log_file, "").map_err(|e| format!("清空日志文件失败: {}", e))?;

            // 重新打开当前日志文件
            if is_current {
                self.rotate_if_needed();
            }
        }

        Ok(())
    }

    /// 解析日志行
    fn parse_log_line(&self, line: &str) -> Option<LogEntry> {
        // 格式: 2024-01-19 20:30:00.123 [INFO] target - message
        // 查找 [LEVEL] 部分
        let bracket_start = line.find('[')?;
        let bracket_end = line.find(']')?;
        if bracket_start >= bracket_end {
            return None;
        }

        let timestamp = line[..bracket_start].trim().to_string();
        let level = line[bracket_start + 1..bracket_end].to_string();

        // 查找 " - " 分隔符
        let after_bracket = &line[bracket_end + 1..];
        let separator_pos = after_bracket.find(" - ")?;
        let target = after_bracket[..separator_pos].trim().to_string();
        let message = after_bracket[separator_pos + 3..].to_string();

        if timestamp.is_empty() || level.is_empty() || target.is_empty() {
            return None;
        }

        Some(LogEntry {
            timestamp,
            level,
            target,
            message,
        })
    }
}

/// 全局日志实例（OnceLock 保证线程安全的一次性初始化）
static GLOBAL_LOGGER: OnceLock<Logger> = OnceLock::new();

/// 初始化全局日志
pub fn init(log_dir: PathBuf, level: LogLevel, retention_days: i64) {
    let logger = Logger::new(log_dir, retention_days);
    logger.set_level(level);
    GLOBAL_LOGGER.set(logger).ok();
}

/// 获取全局日志实例
pub fn get() -> Option<&'static Logger> {
    GLOBAL_LOGGER.get()
}

/// 日志宏
#[macro_export]
macro_rules! log_debug {
    ($target:expr, $($arg:tt)*) => {
        if let Some(logger) = $crate::logger::get() {
            logger.log($crate::logger::LogLevel::Debug, $target, &format!($($arg)*));
        }
    };
}

#[macro_export]
macro_rules! log_info {
    ($target:expr, $($arg:tt)*) => {
        if let Some(logger) = $crate::logger::get() {
            logger.log($crate::logger::LogLevel::Info, $target, &format!($($arg)*));
        }
    };
}

#[macro_export]
macro_rules! log_warn {
    ($target:expr, $($arg:tt)*) => {
        if let Some(logger) = $crate::logger::get() {
            logger.log($crate::logger::LogLevel::Warn, $target, &format!($($arg)*));
        }
    };
}

#[macro_export]
macro_rules! log_error {
    ($target:expr, $($arg:tt)*) => {
        if let Some(logger) = $crate::logger::get() {
            logger.log($crate::logger::LogLevel::Error, $target, &format!($($arg)*));
        }
    };
}
