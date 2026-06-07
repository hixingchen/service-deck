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

Service Deck 是一个 Windows 桌面应用，用于统一管理本地开发环境中的各种服务。你可以将散落在各处的服务（Node.js、Maven、数据库、自定义脚本等）集中管理，通过项目分组实现一键批量启停。

**核心理念：工具适应项目，而不是项目适应工具。**

## 功能特性

### 服务管理
- **服务 CRUD** — 添加、编辑、删除服务
- **服务类型** — 支持普通命令、npm、Maven 三种类型
- **一键操作** — 启动、停止、重启服务
- **收藏服务** — 收藏常用服务，置顶显示
- **拖拽排序** — 拖拽调整服务显示顺序
- **批量操作** — 选择多个服务批量启动/停止/重启

### 项目管理
- **项目分组** — 将多个服务归入一个项目
- **项目收藏** — 收藏常用项目，置顶显示
- **一键启停** — 启动/停止项目时自动操作所有关联服务
- **拖拽排序** — 拖拽调整项目和服务顺序

### 智能命令终端
- **npm 服务** — 自动读取 `package.json` 中的 scripts 命令
- **Maven 服务** — 自动检测多模块项目、profiles，提供智能命令建议
- **实时输出** — 命令执行时实时显示输出，支持 ANSI 颜色
- **快速命令** — 内置 `npm install`、`mvn install` 等常用命令

### 日志查看
- **实时日志** — 服务运行时实时捕获 stdout/stderr
- **内存缓冲** — 日志存储在内存中，无需文件
- **搜索过滤** — 支持关键词搜索日志内容
- **暂停/继续** — 暂停自动滚动，方便查看历史日志
- **清屏** — 清除当前日志显示

### 备份恢复
- **配置导出** — 导出所有服务和项目配置到 JSON 文件
- **配置导入** — 从 JSON 文件导入配置
- **一键备份** — 快速备份当前配置

### 系统功能
- **自定义标题栏** — 无边框窗口，现代 UI 风格
- **系统托盘** — 最小化到托盘，后台运行
- **自动检测** — 启动时自动检测之前运行中的服务
- **配置持久化** — 所有配置自动保存到 `config.json`

## 快速开始

### 系统要求

- Windows 10/11 (64-bit)
- Node.js >= 18
- pnpm
- Rust (最新稳定版)

### 安装与运行

```bash
# 克隆项目
git clone https://github.com/hixingchen/service-deck.git
cd service-deck

# 安装依赖
pnpm install

# 启动开发模式
pnpm dev

# 构建生产版本
pnpm build
```

### 添加服务

1. 点击服务列表上方的「+」按钮
2. 填写服务信息：
   - **服务名称** — 显示名称，如 `前端开发服务器`
   - **服务类型** — 选择 `普通`、`npm` 或 `Maven`
   - **工作目录** — 服务所在目录
   - **启动命令** — 执行的命令（npm/Maven 类型会自动读取可用命令）
3. 点击「添加」

### 创建项目

1. 切换到项目列表视图
2. 点击「+」按钮创建项目
3. 为项目添加关联的服务
4. 点击项目卡片的「启动」按钮，一键启动所有服务

## 项目结构

```
service-deck/
├── src/                          # 前端 (React + TypeScript)
│   ├── App.tsx                   # 主应用
│   ├── types.ts                  # 类型定义
│   ├── components/               # UI 组件
│   │   ├── SortableServiceCard.tsx   # 服务卡片
│   │   ├── SortableProjectCard.tsx   # 项目卡片
│   │   ├── CommandTerminal.tsx       # 命令终端
│   │   ├── LogViewerPanel.tsx        # 日志查看器
│   │   ├── BackupRestorePanel.tsx    # 备份恢复
│   │   └── ...
│   └── hooks/                    # 自定义 Hooks
│       ├── useServices.ts        # 服务管理
│       ├── useProjects.ts        # 项目管理
│       ├── useLogs.ts            # 日志管理
│       ├── useDnD.ts             # 拖拽排序
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

配置文件位于可执行文件同目录下的 `config.json`，格式如下：

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
      "env_vars": {}
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
    "theme": ""
  }
}
```

## 开发命令

```bash
pnpm dev          # 启动开发模式
pnpm build        # 构建生产版本
pnpm typecheck    # TypeScript 类型检查
```

## License

本项目基于 MIT 协议开源 - 详见 [LICENSE](LICENSE) 文件

---

<div align="center">

**如果觉得有用，请给个 ⭐ Star 支持一下！**

</div>
