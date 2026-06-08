<div align="center">

# Service Deck

**本地服务管理工具 — 一键启动项目所需的所有服务**

[![version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/hixingchen/service-deck/releases)
[![platform](https://img.shields.io/badge/platform-Windows-lightgrey.svg)](https://github.com/hixingchen/service-deck/releases)
[![built with Tauri](https://img.shields.io/badge/built%20with-Tauri%202-orange.svg)](https://tauri.app)
[![license](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

</div>

---

## 简介

Service Deck 是一个 Windows 桌面应用，用于统一管理本地开发环境中的各种服务。将散落各处的服务（Node.js、Maven、数据库、自定义脚本等）集中管理，通过项目分组实现一键批量启停。

## 功能特性

### 服务管理
- 服务增删改查，支持普通命令、npm、Maven 三种类型
- 一键启动 / 停止 / 重启
- 收藏置顶、拖拽排序
- 批量启动 / 停止 / 重启

### 项目管理
- 将多个服务归入一个项目，一键启停整个项目
- 项目收藏置顶、拖拽排序
- 项目内服务独立启停

### 智能命令终端
- npm 类型自动读取 `package.json` 中的 scripts
- Maven 类型自动检测多模块项目、profiles，提供智能命令建议
- 自定义命令输入，实时输出，支持 ANSI 颜色

### 日志查看
- 实时捕获 stdout/stderr，内存缓冲
- 关键词搜索、暂停滚动、清屏
- 服务控制（启动 / 停止 / 重启）集成在日志面板内

### 环境配置
- 配置 JAVA_HOME（JDK 路径），所有 Java / Maven 命令使用指定 JDK

### 备份恢复
- 导出 / 导入所有服务和项目配置（JSON 格式）

### 系统功能
- 无边框窗口 + 自定义标题栏
- 系统托盘，最小化到后台运行
- 启动时自动检测之前运行中的服务（PID 持久化）
- 配置自动保存到 `config.json`

## 快速开始

### 系统要求

- Windows 10/11 (64-bit)
- Node.js >= 18
- pnpm
- Rust（最新稳定版）

### 安装与运行

```bash
git clone https://github.com/hixingchen/service-deck.git
cd service-deck

pnpm install

# 开发模式
pnpm dev

# 构建生产版本
pnpm build
```

### 添加服务

1. 点击「添加服务」
2. 填写信息：
   - **服务名称** — 显示名称
   - **服务类型** — 普通 / npm / Maven
   - **工作目录** — 服务所在目录（可浏览选择）
   - **启动命令** — npm / Maven 类型会自动读取可用命令
3. 点击「添加」

### 创建项目

1. 切换到「项目列表」视图
2. 点击「添加项目」，填写名称
3. 为项目关联服务
4. 点击项目卡片的启动按钮，一键启动所有服务

## 项目结构

```
service-deck/
├── src/                          # 前端 (React + TypeScript)
│   ├── App.tsx                   # 主应用组件
│   ├── types.ts                  # 类型定义
│   ├── components/               # UI 组件
│   │   ├── SortableServiceCard.tsx
│   │   ├── SortableProjectCard.tsx
│   │   ├── CommandTerminal.tsx
│   │   ├── LogViewerPanel.tsx
│   │   ├── BackupRestorePanel.tsx
│   │   ├── SettingsPanel.tsx
│   │   └── ...
│   └── hooks/                    # 自定义 Hooks
│       ├── useServices.ts
│       ├── useProjects.ts
│       ├── useLogs.ts
│       ├── useDnD.ts
│       └── ...
├── src-tauri/                    # 后端 (Rust + Tauri 2)
│   └── src/
│       ├── lib.rs                # 核心逻辑
│       └── main.rs               # 入口
├── package.json
└── Cargo.toml
```

## 技术栈

| 层级 | 技术 |
| :--- | :--- |
| 前端框架 | React 18 + TypeScript |
| UI 样式 | Tailwind CSS |
| 图标库 | Lucide React |
| 拖拽排序 | @dnd-kit |
| 桌面框架 | Tauri 2 |
| 后端语言 | Rust |
| 构建工具 | Vite |
| 包管理器 | pnpm |

## 配置文件

配置文件位于可执行文件同目录下的 `config.json`：

```json
{
  "services": [
    {
      "id": "uuid",
      "name": "服务名称",
      "command": "启动命令",
      "path": "工作目录",
      "service_type": "normal|npm|maven",
      "sort_index": 0,
      "favorite": false,
      "log_path": "",
      "env_vars": {},
      "depends_on": [],
      "health_check_url": "",
      "health_check_interval": 0
    }
  ],
  "projects": [
    {
      "id": "uuid",
      "name": "项目名称",
      "services": [],
      "sort_index": 0,
      "favorite": false
    }
  ],
  "settings": {
    "minimize_to_tray": true,
    "show_notifications": true,
    "theme": "",
    "java_home": ""
  },
  "running_pids": {}
}
```

## 开发命令

```bash
pnpm dev          # 启动开发模式
pnpm build        # 构建生产版本
pnpm typecheck    # TypeScript 类型检查
```

## License

MIT - 详见 [LICENSE](LICENSE)
