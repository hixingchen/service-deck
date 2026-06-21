use std::fmt;
use serde::Serialize;

/// 应用统一错误类型
#[derive(Debug, Serialize)]
pub enum AppError {
    Database(String),
    Io(String),
    Json(String),
    InvalidInput(String),
    NotFound(String),
    Process(String),
    Watch(String),
    Other(String),
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AppError::Database(msg) => write!(f, "数据库错误: {}", msg),
            AppError::Io(msg) => write!(f, "IO 错误: {}", msg),
            AppError::Json(msg) => write!(f, "JSON 错误: {}", msg),
            AppError::InvalidInput(msg) => write!(f, "{}", msg),
            AppError::NotFound(msg) => write!(f, "{}", msg),
            AppError::Process(msg) => write!(f, "进程错误: {}", msg),
            AppError::Watch(msg) => write!(f, "监听错误: {}", msg),
            AppError::Other(msg) => write!(f, "{}", msg),
        }
    }
}

impl std::error::Error for AppError {}

impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        AppError::Io(format!("{}", err))
    }
}

impl From<serde_json::Error> for AppError {
    fn from(err: serde_json::Error) -> Self {
        AppError::Json(format!("{}", err))
    }
}

impl From<rusqlite::Error> for AppError {
    fn from(err: rusqlite::Error) -> Self {
        AppError::Database(format!("{}", err))
    }
}

impl From<String> for AppError {
    fn from(msg: String) -> Self {
        AppError::Other(msg)
    }
}

impl From<AppError> for String {
    fn from(err: AppError) -> Self {
        err.to_string()
    }
}
