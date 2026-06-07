<div align="center">

# Service Deck

**一键启动项目所需的所有服务，告别繁琐的环境切换**

[![version](https://img.shields.io/badge/version-1.1.0-blue.svg)](https://github.com/hixingchen/service-deck/releases)
[![platform](https://img.shields.io/badge/platform-Windows-lightgrey.svg)](https://github.com/hixingchen/service-deck/releases)
[![built with Tauri](https://img.shields.io/badge/built%20with-Tauri%202-orange.svg)](https://tauri.app)
[![license](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

English | [中文](README.md)

</div>

---

## Why Service Deck?

日常开发中，一个项目往往需要同时启动多个服务 —— 数据库、后端 API、前端 dev server、Redis、Nginx 等。每次切换项目，都要手动打开多个终端，逐个启动服务，过程繁琐且容易遗漏。

- **一键启动** — 选中项目，点击启动，所有关联服务按依赖顺序自动运行
- **项目快速切换** — `⌘J` 呼出项目切换器，搜索并一键启动/停止项目
- **服务依赖管理** — 设置服务依赖关系，拓扑排序确保启动顺序正确
- **项目分组与收藏** — 按团队/类型分组，收藏常用项目，快速定位
- **自动启动** — 标记项目为自动启动，打开应用即刻进入工作状态
- **实时监控** — 服务状态实时刷新，日志实时查看，健康检查一目了然

## Screenshots

| 项目列表 | 服务列表 |
| :---: | :---: |
| ![项目列表](screenshots/projects.png) | ![服务列表](screenshots/services.png) |

| 快速切换 | 依赖关系图 |
| :---: | :---: |
| ![快速切换](screenshots/quick-switcher.png) | ![依赖关系图](screenshots/dependency-graph.png) |

## Features

### 项目管理
- **项目分组** — 按前端、后端、数据库等维度组织项目
- **项目收藏** — 收藏常用项目，置顶显示，一键访问
- **项目自动启动** — 应用启动时自动启动标记的项目
- **项目模板** — 导出/导入项目配置，快速复用项目结构

### 服务管理
- **服务 CRUD** — 添加、编辑、删除服务，支持基础服务和项目服务分类
- **一键操作** — 启动、停止、重启服务，状态实时反馈
- **批量操作** — 选择多个服务批量启动/停止
- **服务模板** — 内置常见服务模板（Node.js、Python、Java、Docker 等）
- **拖拽排序** — 拖拽调整服务顺序

### 服务依赖
- **依赖声明** — 为服务设置 `depends_on` 依赖关系
- **拓扑排序** — 启动时自动按依赖顺序执行
- **依赖关系图** — 可视化展示服务间依赖关系
- **启动顺序** — 清晰展示服务启动顺序和层级

### 快速切换
- **快速切换器 (`⌘K`)** — 搜索并启动/停止服务
- **快速项目切换器 (`⌘J`)** — 搜索并启动/停止项目
- **键盘快捷键** — 全键盘操作，效率至上

### 监控与日志
- **实时状态** — 服务运行状态 2 秒轮询刷新
- **日志查看** — 实时查看服务日志，支持暂停/继续滚动
- **健康检查** — 服务健康状态检测
- **状态仪表板** — 服务状态概览，按类型/启动方式统计

### 高级功能
- **通知系统** — 操作成功/失败通知，未读计数
- **操作历史** — 记录所有服务操作，支持回溯
- **资源监控** — CPU、内存、网络使用率实时显示
- **定时任务** — Cron 表达式调度，定时执行服务操作
- **工作流** — 创建多步骤工作流，批量执行服务操作
- **脚本管理** — 管理常用脚本，一键执行
- **备份恢复** — 配置文件备份与恢复
- **环境切换** — 开发/测试/生产环境快速切换

### 系统功能
- **自定义标题栏** — 无边框窗口，原生体验
- **配置导入/导出** — 服务和项目配置一键导入导出
- **服务终端** — 在服务工作目录打开终端
- **搜索过滤** — 快速搜索服务

## Keyboard Shortcuts

| 快捷键 | 功能 |
| :--- | :--- |
| `⌘1` | 切换到服务列表 |
| `⌘2` | 切换到项目列表 |
| `⌘N` | 添加基础服务 |
| `⌘P` | 添加项目 |
| `⌘K` | 快速切换器 |
| `⌘J` | 快速项目切换器 |
| `⌘,` | 设置 |
| `Esc` | 关闭当前面板 |

## Toolbar

| 图标 | 功能 |
| :---: | :--- |
| 🔔 | 通知面板 — 查看操作通知 |
| 🕐 | 操作历史 — 查看历史记录 |
| 📊 | 资源监控 — CPU/内存/网络 |
| ⏰ | 定时任务 — Cron 调度 |
| 🌿 | 工作流 — 批量操作 |
| 💻 | 脚本管理 — 快速执行脚本 |
| 💾 | 备份恢复 — 配置文件备份 |
| 🌍 | 环境切换 — 开发/测试/生产 |
| ⚙️ | 设置 |

## Quick Start

### 1. 添加服务

点击「添加基础服务」或「添加项目服务」，填写服务信息：

| 字段 | 说明 | 示例 |
| :--- | :--- | :--- |
| 服务名称 | 显示名称 | `MySQL` |
| 工作目录 | 服务所在目录 | `D:\mysql\bin` |
| 启动命令 | 执行的命令 | `mysqld --console` |
| 启动类型 | 自动/手动 | `自动` |
| 服务类型 | 普通/npm/maven | `普通服务` |
| 日志路径 | 日志文件路径 | `D:\mysql\data\*.log` |
| 依赖服务 | 依赖的其他服务 | `Redis` |

### 2. 创建项目

点击「添加项目」，选择项目关联的服务：

```
项目名称: 我的电商项目
分组: 后端
关联服务: MySQL, Redis, API Server, Admin Panel
```

### 3. 一键启动

选中项目，点击「启动」按钮，所有关联服务将按依赖顺序自动启动：

```
MySQL (依赖: 无) → 启动中...
Redis (依赖: 无) → 启动中...
API Server (依赖: MySQL, Redis) → 等待依赖...
Admin Panel (依赖: API Server) → 等待依赖...
```

## Configuration

### 服务配置

| 字段 | 类型 | 说明 |
| :--- | :--- | :--- |
| `name` | string | 服务显示名称 |
| `command` | string | 启动命令 |
| `path` | string | 工作目录 |
| `startup_type` | string | `auto` / `manual` |
| `service_type` | string | `normal` / `npm` / `maven` |
| `cli_path` | string? | 自定义 CLI 路径 |
| `env_vars` | object | 环境变量 `KEY=VALUE` |
| `log_path` | string? | 日志文件路径 |
| `category` | string | `basic` / `project` |
| `depends_on` | string[] | 依赖服务 ID 列表 |
| `health_check_url` | string? | 健康检查 URL |
| `health_check_interval` | number | 检查间隔（秒） |

### 项目配置

| 字段 | 类型 | 说明 |
| :--- | :--- | :--- |
| `name` | string | 项目名称 |
| `group` | string? | 分组名称 |
| `favorite` | boolean | 是否收藏 |
| `auto_start` | boolean | 是否自动启动 |
| `services` | Service[] | 关联服务列表 |

### Tomcat 配置示例

> **Note**: Tomcat 的 `startup.bat` 会弹出新窗口，必须使用 `catalina.bat run`

| 字段 | 值 |
| :--- | :--- |
| 启动命令 | `catalina.bat run` |
| 工作目录 | `D:\apache-tomcat-9.x.x\bin` |
| 日志路径 | `D:\apache-tomcat-9.x.x\logs` |

## Architecture

```
service-deck/
├── src/                          # 前端源码 (React + TypeScript)
│   ├── App.tsx                   # 主应用组件
│   ├── types.ts                  # TypeScript 类型定义
│   ├── components/               # UI 组件 (36 个)
│   │   ├── ProjectCard.tsx       # 项目卡片
│   │   ├── SortableServiceCard.tsx # 可排序服务卡片
│   │   ├── ServiceFormModal.tsx  # 服务表单弹窗
│   │   ├── QuickSwitcher.tsx     # 快速切换器
│   │   ├── BatchOperations.tsx   # 批量操作面板
│   │   └── ...
│   └── hooks/                    # 自定义 Hooks (16 个)
│       ├── useServices.ts        # 服务 CRUD
│       ├── useProjects.ts        # 项目 CRUD
│       ├── useDnD.ts             # 拖拽排序
│       ├── useKeyboardShortcuts.ts # 键盘快捷键
│       └── ...
├── src-tauri/                    # 后端源码 (Rust + Tauri 2)
│   └── src/
│       ├── lib.rs                # 核心逻辑 (31 个 Tauri 命令)
│       └── main.rs               # 入口文件
├── package.json                  # 前端依赖
└── Cargo.toml                    # 后端依赖
```

### Tech Stack

| 层级 | 技术 |
| :--- | :--- |
| **前端框架** | React 18 + TypeScript |
| **UI 样式** | Tailwind CSS |
| **图标库** | Lucide React |
| **拖拽排序** | @dnd-kit |
| **桌面框架** | Tauri 2 |
| **后端语言** | Rust |
| **构建工具** | Vite |
| **包管理器** | pnpm |

### Tauri Commands (31)

<details>
<summary>点击展开完整命令列表</summary>

**服务管理**
- `get_services` — 获取所有服务
- `add_service` — 添加服务
- `update_service` — 更新服务
- `delete_service` — 删除服务
- `update_service_sort` — 更新服务排序

**项目管理**
- `get_projects` — 获取所有项目
- `add_project` — 添加项目
- `update_project` — 更新项目
- `remove_project` — 删除项目
- `toggle_project_favorite` — 切换收藏状态
- `update_project_sort` — 更新项目排序
- `add_service_to_project` — 添加服务到项目
- `remove_service_from_project` — 从项目移除服务
- `get_auto_start_projects` — 获取自动启动项目
- `start_auto_start_projects` — 启动自动启动项目

**服务运行时**
- `start_service` — 启动服务
- `stop_service` — 停止服务
- `restart_service` — 重启服务
- `start_project` — 启动项目所有服务
- `stop_project` — 停止项目所有服务
- `get_running_services` — 获取运行中的服务
- `get_service_logs` — 获取服务日志
- `get_log_file_size` — 获取日志文件大小
- `get_service_status` — 获取服务状态
- `check_service_health` — 检查服务健康
- `batch_start_services` — 批量启动服务
- `batch_stop_services` — 批量停止服务

**配置与工具**
- `get_settings` — 获取应用设置
- `get_config_dir` — 获取配置目录
- `export_config` — 导出配置
- `import_config` — 导入配置
- `open_directory` — 打开目录
- `get_available_commands` — 获取可用命令
- `execute_command` — 执行命令

</details>

## Download & Installation

### 系统要求

- Windows 10/11 (64-bit)
- Node.js >= 18
- pnpm
- Rust (最新稳定版)

### 安装

```bash
# 克隆项目
git clone https://github.com/hixingchen/service-deck.git
cd service-deck

# 安装依赖
pnpm install

# 启动开发
pnpm dev

# 构建生产版本
pnpm build
```

### 开发命令

```bash
pnpm dev          # 启动开发模式
pnpm build        # 构建生产版本
pnpm typecheck    # TypeScript 类型检查
```

## Contributing

欢迎贡献代码！请遵循以下步骤：

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

## License

本项目基于 MIT 协议开源 - 详见 [LICENSE](LICENSE) 文件

---

<div align="center">

**如果觉得有用，请给个 ⭐ Star 支持一下！**

</div>
