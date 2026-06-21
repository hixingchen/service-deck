/// 事件名常量定义。
/// 命名格式：`领域:动作`

/// 文件监听事件（文件变化通知前端）
pub const WATCH_EVENT: &str = "watch:event";

/// 命令执行输出（终端 stdout/stderr）
pub const COMMAND_OUTPUT: &str = "command:output";

/// 命令执行完成
pub const COMMAND_FINISHED: &str = "command:finished";

/// 服务日志实时推送（新增一行）
pub const LOG_LINE_ADDED: &str = "log:line-added";
