// 应用常量与默认配置

/// Windows 隐藏窗口标志
#[cfg(windows)]
pub const CREATE_NO_WINDOW: u32 = 0x08000000;

/// 数据库 Schema 版本号，变更时递增
pub const SCHEMA_VERSION: i32 = 1;

/// 默认监听包含的文件类型（支持通配符）
pub fn default_watch_include() -> Vec<String> {
    vec![
        "*.js", "*.ts", "*.jsx", "*.tsx", "*.vue", "*.java", "*.py", "*.go", "*.rs",
        "*.html", "*.css", "*.scss", "*.json", "*.yaml", "*.yml", "*.toml",
        "*.xml", "*.properties", "*.conf",
    ]
    .into_iter()
    .map(String::from)
    .collect()
}

/// 默认监听排除的目录名（支持通配符）
pub fn default_watch_exclude() -> Vec<String> {
    vec![
        "node_modules", ".git", "dist", "build", "target", "__pycache__",
        ".next", ".nuxt", "logs", ".idea", ".vscode",
    ]
    .into_iter()
    .map(String::from)
    .collect()
}

/// 默认 service_type
pub fn default_service_type() -> String {
    "normal".to_string()
}

/// 默认语言
pub fn default_language() -> String {
    "zh".to_string()
}

/// 默认自动备份保留天数
pub fn default_auto_backup_keep_days() -> i64 {
    7
}
