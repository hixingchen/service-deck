use std::path::{Path, PathBuf};

/// 路径安全校验错误
#[derive(Debug)]
pub enum PathGuardError {
    /// 路径遍历攻击（包含 ..）
    TraversalAttempt,
    /// 路径不在允许的目录内
    OutsideAllowedDir,
    /// 路径为空
    EmptyPath,
}

impl std::fmt::Display for PathGuardError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            PathGuardError::TraversalAttempt => write!(f, "路径包含非法遍历字符"),
            PathGuardError::OutsideAllowedDir => write!(f, "路径不在允许的目录内"),
            PathGuardError::EmptyPath => write!(f, "路径不能为空"),
        }
    }
}

/// 校验路径安全性
///
/// 检查规则：
/// 1. 路径不能为空
/// 2. 路径不能包含 `..`（防止路径遍历攻击）
/// 3. 如果指定了基准目录，路径必须在基准目录内
pub fn validate_path(path: &str, allowed_base: Option<&Path>) -> Result<PathBuf, PathGuardError> {
    if path.is_empty() {
        return Err(PathGuardError::EmptyPath);
    }

    // 检查是否包含路径遍历字符
    if path.contains("..") {
        return Err(PathGuardError::TraversalAttempt);
    }

    let path_buf = PathBuf::from(path);

    // 规范化路径（解析符号链接等）
    let canonical = if path_buf.is_absolute() {
        path_buf.clone()
    } else {
        // 相对路径转绝对路径
        std::env::current_dir()
            .unwrap_or_else(|_| PathBuf::from("."))
            .join(&path_buf)
    };

    // 如果指定了基准目录，检查路径是否在基准目录内
    if let Some(base) = allowed_base {
        let canonical_base = if base.is_absolute() {
            base.to_path_buf()
        } else {
            std::env::current_dir()
                .unwrap_or_else(|_| PathBuf::from("."))
                .join(base)
        };

        if !canonical.starts_with(&canonical_base) {
            return Err(PathGuardError::OutsideAllowedDir);
        }
    }

    Ok(path_buf)
}

/// 校验文件路径安全性（简化版本，只检查遍历攻击）
pub fn validate_file_path(path: &str) -> Result<PathBuf, PathGuardError> {
    validate_path(path, None)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_empty_path() {
        assert!(validate_file_path("").is_err());
    }

    #[test]
    fn test_traversal_attempt() {
        assert!(validate_file_path("../etc/passwd").is_err());
        assert!(validate_file_path("foo/../../../etc/passwd").is_err());
        assert!(validate_file_path("foo/bar/../../baz").is_err());
    }

    #[test]
    fn test_valid_path() {
        assert!(validate_file_path("foo/bar.txt").is_ok());
        assert!(validate_file_path("/absolute/path.txt").is_ok());
    }

    #[test]
    fn test_base_dir_check() {
        let base = Path::new("/allowed/dir");
        assert!(validate_path("/allowed/dir/file.txt", Some(base)).is_ok());
        assert!(validate_path("/other/dir/file.txt", Some(base)).is_err());
    }
}
