<div align="center">

# Service Deck

**本地开发环境管理工具 — 一键启动项目所需的所有服务**

[English](README.md) | [中文](README_CN.md)

[![version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/hixingchen/service-deck/releases)
[![platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)](https://github.com/hixingchen/service-deck/releases)
[![built with Tauri](https://img.shields.io/badge/built%20with-Tauri%202-orange.svg)](https://tauri.app)
[![license](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

</div>

---

## 简介

Service Deck 是一个跨平台桌面应用，用于统一管理本地开发环境中的各种服务。将散落各处的服务（Node.js、Java、数据库、自定义脚本等）集中到一个仪表盘，通过项目分组实现一键批量启停。

## 功能特性

### 服务管理
- 完整的服务增删改查，支持名称、命令、工作目录、环境变量
- 环境变量分组 — 每个服务可配置多套环境变量，一键切换
- 服务依赖 — 通过 `depends_on` 定义启动顺序
- 健康检查 — 支持配置检查 URL 和间隔时间
- 收藏和拖拽排序

### 项目分组
- 将相关服务归入项目，统一管理
- 一键启动 / 停止 / 重启项目内所有服务
- 可展开的项目卡片，显示包含的服务并支持单独操作

### 进程管理
- 后台检测手动启动的服务（通过命令行匹配）
- PID 跟踪，停止时自动终止进程树
- 运行状态持久化到数据库 — 应用重启后自动恢复
- 自适应轮询（运行中 2s / 空闲 10s）

### 批量操作
- 选择多个服务批量启动 / 停止 / 重启
- 快速筛选运行中或已停止的服务

### 文件监听（热重载）
- 三种模式：**关闭**、**自动**（文件变更自动重启）、**确认**（提示后重启）
- 可配置监听路径、包含 / 排除 glob 模式
- 默认覆盖 JS / TS / Java / Python / Go / Rust / HTML / CSS 及常见配置文件

### 实时日志
- 每个服务的实时日志输出，支持暂停 / 继续
- 日志搜索和关键字高亮
- ANSI 颜色渲染
- 自动滚动到最新，限制 1000 行，超出自动裁剪

### 系统托盘
- 关闭窗口时最小化到托盘（可配置）
- 托盘右键菜单：显示 / 隐藏 / 退出
- 左键点击托盘图标恢复窗口
- 开机自启，支持静默 `--minimized` 模式

### 备份与迁移
- 手动数据库备份 / 恢复 / 重命名 / 删除
- 自动备份，支持配置保留时间（3 天 / 1 周 / 1 月）
- 配置目录迁移 — 将数据移动到自定义位置
- 完整配置导入 / 导出

### 国际化
- 支持中文和英文
- 语言偏好跨会话持久化

### 主题
- 亮色 / 暗色 / 跟随系统
- 通过 `prefers-color-scheme` 媒体查询实时切换

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18, TypeScript, Vite 5, Tailwind CSS 3.4 |
| 后端 | Tauri 2.x, Rust |
| 数据库 | SQLite（rusqlite, WAL 模式） |
| 文件监听 | notify v7 |
| 拖拽排序 | @dnd-kit/core + @dnd-kit/sortable |
| 图标 | lucide-react |

## 快速开始

### 环境要求

- [Node.js](https://nodejs.org/) >= 18
- [pnpm](https://pnpm.io/) >= 8
- [Rust](https://www.rust-lang.org/tools/install) >= 1.70
- [Tauri 环境依赖](https://v2.tauri.app/start/prerequisites/) — 平台相关的构建工具

### 安装

```bash
git clone https://github.com/hixingchen/service-deck.git
cd service-deck
pnpm install
```

### 开发

```bash
# 完整 Tauri 开发模式（前端 + 后端，支持热重载）
pnpm dev

# 仅前端（Vite 开发服务器，端口 1420）
pnpm dev:renderer
```

### 构建

```bash
# 构建当前平台的生产版本
pnpm build

# 仅构建前端
pnpm build:renderer

# TypeScript 类型检查
pnpm typecheck
```

## 项目结构

```
service-deck/
├── src/                          # React 前端
│   ├── components/               # UI 组件
│   ├── hooks/                    # 自定义 Hooks
│   ├── i18n/                     # 国际化（中文 / 英文）
│   ├── lib/                      # 工具函数和 API 层
│   ├── types.ts                  # TypeScript 类型定义
│   └── App.tsx                   # 根组件
├── src-tauri/                    # Rust 后端
│   ├── src/
│   │   ├── commands/             # Tauri IPC 命令处理
│   │   ├── services/             # 业务逻辑层
│   │   ├── database/             # SQLite DAO 和迁移
│   │   ├── logger.rs             # 应用日志
│   │   ├── config.rs             # 应用常量
│   │   ├── error.rs              # 错误类型
│   │   └── events.rs             # 事件定义
│   ├── capabilities/             # 权限声明
│   ├── icons/                    # 应用图标
│   └── tauri.conf.json           # Tauri 配置
├── package.json
└── tailwind.config.cjs
```

## 架构

```
UI 组件 → 自定义 Hooks → IPC 封装层 → Tauri IPC → Rust Command → Rust Service → 系统资源
```

- **视图层**（React）：仅负责渲染、交互、UI 状态
- **命令层**（Rust）：参数校验、权限检查，委托给 Service 层
- **业务层**（Rust）：核心业务逻辑、进程管理、文件操作
- **数据层**（Rust）：通过 rusqlite 操作 SQLite，WAL 模式，Schema 迁移

## 数据存储

| 数据 | 位置 |
|------|------|
| SQLite 数据库 | `~/.service-deck/service-deck.db` |
| 应用日志 | `~/.service-deck/logs/` |
| 配置文件 | `~/.service-deck/settings.json` |
| 备份文件 | 数据库同级目录 |

> 配置目录可在设置中自定义。

## 安全

- 通过 Tauri Capabilities 实现最小权限 — 未使用 `allowlist: all`
- 严格的内容安全策略（CSP）
- 所有用户输入路径经过路径遍历攻击校验
- 敏感环境变量标记并排除日志输出
- 单实例约束 — 防止重复启动

## 许可证

[MIT](LICENSE)
