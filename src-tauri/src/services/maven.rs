use std::fs;
use std::path::PathBuf;
use crate::log_debug;

/// 智能转换 Maven 命令（spring-boot:run → java -jar）
pub fn smart_convert(command: &str, work_dir: &str) -> String {
    if !command.contains("spring-boot:run") {
        return command.to_string();
    }

    log_debug!("maven", "输入: {}, 目录: {}", command, work_dir);
    let path = PathBuf::from(work_dir);

    // 解析 -pl 参数获取模块名
    let module_name = if command.contains("-pl") {
        command.split("-pl").nth(1)
            .and_then(|s| s.split_whitespace().next())
            .unwrap_or("")
    } else {
        ""
    };

    let target_dir = if !module_name.is_empty() {
        path.join(module_name).join("target")
    } else {
        path.join("target")
    };

    // 查找 war/jar 文件
    if target_dir.exists() {
        if let Some(jar_path) = find_jar_file(&target_dir) {
            let result = format!("java -jar \"{}\"", jar_path.display());
            log_debug!("maven", "转换结果: {}", result);
            return result;
        }
    }

    // 没有 war 文件，需要先编译
    let result = if !module_name.is_empty() {
        format!("mvn clean package -DskipTests -pl {} -am && java -jar \"{}\"", module_name, find_war_jar_glob(&target_dir))
    } else {
        format!("mvn clean package -DskipTests && java -jar \"{}\"", find_war_jar_glob(&target_dir))
    };
    log_debug!("maven", "需要编译: {}", result);
    result
}

/// 查找 target 目录中的 war/jar 文件路径字符串（用于命令行）
fn find_war_jar_glob(dir: &PathBuf) -> String {
    if let Some(jar_path) = find_jar_file(dir) {
        return jar_path.display().to_string();
    }
    // 返回通配符路径作为后备
    format!("{}/*.war", dir.display())
}

/// 查找 target 目录中的 war/jar 文件（优先 war）
fn find_jar_file(dir: &PathBuf) -> Option<PathBuf> {
    let mut candidates: Vec<PathBuf> = fs::read_dir(dir)
        .ok()?
        .filter_map(|e| e.ok())
        .filter(|e| {
            let name = e.file_name().to_string_lossy().to_string();
            let path = e.path();
            path.is_file()
                && !name.ends_with(".original")
                && (name.ends_with(".war") || name.ends_with(".jar"))
        })
        .map(|e| e.path())
        .collect();

    candidates.sort_by(|a, b| {
        let a_is_war = a.file_name().unwrap_or_default().to_string_lossy().ends_with(".war");
        let b_is_war = b.file_name().unwrap_or_default().to_string_lossy().ends_with(".war");
        b_is_war.cmp(&a_is_war)
    });

    candidates.into_iter().next()
}
