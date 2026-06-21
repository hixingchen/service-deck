<div align="center">

# Service Deck

**A local development environment manager — start all your project services with one click**

[English](README.md) | [中文](README_CN.md)

[![version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/hixingchen/service-deck/releases)
[![platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)](https://github.com/hixingchen/service-deck/releases)
[![built with Tauri](https://img.shields.io/badge/built%20with-Tauri%202-orange.svg)](https://tauri.app)
[![license](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

</div>

---

## Introduction

Service Deck is a cross-platform desktop application for managing local development services. It centralizes all your scattered services — Node.js, Java, databases, custom scripts, and more — into a single dashboard, enabling one-click batch start/stop through project grouping.

## Features

### Service Management
- Full CRUD for services with name, command, working directory, and environment variables
- Environment variable groups — switch between multiple env configs per service
- Service dependencies — define startup order with `depends_on`
- Health check support with configurable URL and interval
- Favorite and reorder services via drag-and-drop

### Project Grouping
- Group related services into projects for coordinated management
- Start / stop / restart all services in a project at once
- Expandable project cards showing contained services with individual controls

### Process Management
- Background detection of manually-started services (matches by command line)
- PID tracking and process tree killing on stop
- Running state persisted to database — survives app restart
- Polling-based status updates (adaptive: 2s active / 10s idle)

### Batch Operations
- Select multiple services and start / stop / restart them in bulk
- Quick-select filters for running or stopped services

### File Watching (Hot Reload)
- Three modes per service: **Off**, **Auto** (auto-restart), **Confirm** (prompt before restart)
- Configurable watch path, include / exclude glob patterns
- Default patterns cover JS / TS / Java / Python / Go / Rust / HTML / CSS and common config files

### Real-time Log Viewer
- Live log output per service with pause / resume
- Log search and filter with keyword highlighting
- ANSI color rendering for colored terminal output
- Auto-scroll to latest, capped at 1000 lines with smooth DOM trimming

### System Tray
- Minimize to tray on close (configurable)
- Tray context menu: Show / Hide / Exit
- Left-click tray icon to restore window
- Autostart at system boot with silent `--minimized` mode

### Backup & Migration
- Manual database backup / restore / rename / delete
- Automatic backups with configurable retention (3 days / 1 week / 1 month)
- Config directory migration — move data to a custom location
- Full config import / export for portability

### Internationalization
- Chinese (zh) and English (en) supported
- Language preference persisted across sessions

### Theming
- Light / Dark / System (follows OS preference)
- Real-time switching via `prefers-color-scheme` media query

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite 5, Tailwind CSS 3.4 |
| Backend | Tauri 2.x, Rust |
| Database | SQLite (via rusqlite, WAL mode) |
| File Watch | notify v7 |
| Drag & Drop | @dnd-kit/core + @dnd-kit/sortable |
| Icons | lucide-react |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [pnpm](https://pnpm.io/) >= 8
- [Rust](https://www.rust-lang.org/tools/install) >= 1.70
- [Tauri Prerequisites](https://v2.tauri.app/start/prerequisites/) — platform-specific build tools

### Installation

```bash
git clone https://github.com/hixingchen/service-deck.git
cd service-deck
pnpm install
```

### Development

```bash
# Full Tauri dev mode (frontend + backend with hot reload)
pnpm dev

# Frontend only (Vite dev server on port 1420)
pnpm dev:renderer
```

### Build

```bash
# Production build for current platform
pnpm build

# Frontend build only
pnpm build:renderer

# TypeScript type check
pnpm typecheck
```

## Project Structure

```
service-deck/
├── src/                          # React frontend
│   ├── components/               # UI components
│   ├── hooks/                    # Custom React hooks
│   ├── i18n/                     # Internationalization (zh / en)
│   ├── lib/                      # Utilities and API layer
│   ├── types.ts                  # TypeScript type definitions
│   └── App.tsx                   # Root component
├── src-tauri/                    # Rust backend
│   ├── src/
│   │   ├── commands/             # Tauri IPC command handlers
│   │   ├── services/             # Business logic layer
│   │   ├── database/             # SQLite DAO and migrations
│   │   ├── logger.rs             # Application logging
│   │   ├── config.rs             # App constants
│   │   ├── error.rs              # Error types
│   │   └── events.rs             # Event definitions
│   ├── capabilities/             # Permission declarations
│   ├── icons/                    # App icons
│   └── tauri.conf.json           # Tauri configuration
├── package.json
└── tailwind.config.cjs
```

## Architecture

```
UI Components → Custom Hooks → IPC Wrapper → Tauri IPC → Rust Command → Rust Service → System
```

- **View Layer** (React): Rendering, interaction, UI state only
- **Command Layer** (Rust): Parameter validation, permission checks, delegates to Service
- **Service Layer** (Rust): Core business logic, process management, file I/O
- **Database Layer** (Rust): SQLite via rusqlite with WAL mode, schema migrations

## Data Storage

| Data | Location |
|------|----------|
| SQLite database | `~/.service-deck/service-deck.db` |
| Application logs | `~/.service-deck/logs/` |
| Settings | `~/.service-deck/settings.json` |
| Backups | Alongside database file |

> The config directory is customizable via Settings.

## Security

- Minimal permissions via Tauri Capabilities — no `allowlist: all`
- Strict Content Security Policy (CSP)
- Path traversal protection on all user-supplied paths
- Sensitive environment variables marked and excluded from logs
- Single-instance enforcement — prevents duplicate processes

## License

[MIT](LICENSE)
