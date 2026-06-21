export const zh = {
  // 通用
  common: {
    confirm: "确定",
    cancel: "取消",
    save: "保存",
    delete: "删除",
    edit: "编辑",
    add: "添加",
    close: "关闭",
    back: "返回",
    loading: "加载中...",
    success: "成功",
    error: "错误",
    noData: "暂无数据",
    browse: "浏览",
    search: "搜索",
    clear: "清空",
    noMatch: "未找到匹配内容",
  },

  // 侧边栏/导航
  nav: {
    services: "服务列表",
    projects: "项目列表",
    settings: "设置",
    batchOps: "批量操作",
    addService: "添加服务",
    addProject: "添加项目",
  },

  // 服务相关
  service: {
    name: "服务名称",
    command: "执行命令",
    path: "执行目录",
    type: "服务类型",
    status: {
      running: "运行中",
      stopped: "已停止",
    },
    action: {
      start: "启动",
      stop: "停止",
      restart: "重启",
      openDir: "打开目录",
      viewLogs: "查看日志",
      terminal: "命令终端",
      favorite: "收藏",
      unfavorite: "取消收藏",
    },
    form: {
      title: {
        add: "添加服务",
        edit: "编辑服务",
      },
      namePlaceholder: "请输入服务名称",
      commandPlaceholder: "如: npm run dev、java -jar app.jar",
      pathPlaceholder: "如: ~/projects/my-app",
      selectPath: "选择执行目录",
      nameRequired: "服务名称不能为空",
      commandRequired: "执行命令不能为空",
      pathRequired: "工作目录不能为空",
    },
    watch: {
      title: "文件监听",
      expand: "展开",
      collapse: "收起",
      mode: "监听模式",
      off: "关闭",
      auto: "自动重启",
      confirm: "确认重启",
      offDesc: "不监听文件变化",
      autoDesc: "文件变化时自动重启服务",
      confirmDesc: "文件变化时弹窗提示，确认后重启",
      watchPath: "监听目录",
      watchPathPlaceholder: "默认与执行目录一致",
      watchPathSame: "当前与执行目录一致",
      watchPathCustom: "已自定义监听目录",
      include: "监听文件类型",
      includePlaceholder: "如: *.js,*.ts,*.vue,*.java",
      includeHint: "支持通配符，如 *.js 匹配所有 js 文件",
      exclude: "排除模式",
      excludePlaceholder: "如: node_modules,.*,.git,*.log",
      excludeHint: "支持通配符，如 .* 排除隐藏目录，*.log 排除日志文件",
    },
    deleteConfirm: {
      title: "删除服务",
      message: "确定要删除服务「{name}」吗？此操作不可撤销。",
    },
  },

  // 项目相关
  project: {
    name: "项目名称",
    serviceCount: "{count} 个服务",
    projectCount: "{count} 个项目",
    runningCount: "运行中 {running}/{total}",
    noServices: "暂无服务",
    favorites: "收藏",
    allProjects: "全部项目",
    searchPlaceholder: "搜索项目名称...",
    noMatch: "未找到匹配的项目",
    form: {
      title: {
        add: "添加项目",
        edit: "编辑项目",
      },
      namePlaceholder: "请输入项目名称",
      nameRequired: "项目名称不能为空",
      addedServices: "已添加服务",
      addService: "添加",
      noServicesHint: "暂无服务",
      noServicesSubtext: "点击上方按钮添加",
    },
    action: {
      start: "启动项目",
      stop: "停止项目",
      restart: "重启项目",
    },
    deleteConfirm: {
      title: "删除项目",
      message: "确定要删除项目「{name}」吗？此操作不可撤销。",
    },
  },

  // 批量操作
  batch: {
    title: "批量操作",
    selectAll: "全选",
    deselectAll: "取消全选",
    selectRunning: "运行中",
    selectStopped: "已停止",
    selectedCount: "已选 {count} 个",
    start: "启动",
    stop: "停止",
    restart: "重启",
  },

  // 日志
  log: {
    title: "服务日志",
    noLogs: "暂无日志输出",
    clear: "清空日志",
    clearMsg: "已清屏，新日志将在此显示",
    search: "搜索日志...",
    clearScreen: "清屏",
    resume: "继续",
    pause: "暂停",
    clearConfirm: {
      title: "清空日志",
      message: "确定要清空该服务的所有日志吗？",
    },
  },

  // 终端
  terminal: {
    title: "打开终端",
    serviceName: "服务",
    path: "路径",
    openButton: "打开系统终端",
    opening: "打开中...",
    hint: "将在服务的执行目录打开系统命令行终端",
  },

  // 选择服务面板
  selectService: {
    title: "选择服务",
    searchPlaceholder: "搜索服务名称...",
    noAvailable: "没有可用的服务",
    noAvailableHint: "请先在服务列表中添加服务",
    noResults: "未找到匹配的服务",
    favorites: "收藏",
    allServices: "全部服务",
  },

  // 标题栏
  titleBar: {
    minimize: "最小化",
    maximize: "最大化",
    restore: "还原",
    close: "关闭",
  },

  // 设置
  settings: {
    general: {
      title: "通用",
      behavior: "行为",
      minimizeToTray: "关闭窗口时最小化到托盘",
      minimizeToTrayNote: "关闭窗口后应用继续在后台运行",
      appearance: "语言与外观",
      language: "语言",
      languageNote: "选择界面显示语言",
      darkMode: "外观模式",
      darkModeNote: "选择浅色、深色或跟随系统",
      themeLight: "浅色",
      themeDark: "深色",
      themeSystem: "跟随系统",
      advanced: "高级",
      autoStart: "开机自启",
      autoStartNote: "系统启动时自动运行",
    },
    environment: {
      title: "环境",
      browse: "浏览",
      save: "保存",
      comingSoon: "即将推出，敬请期待",
    },
    advanced: {
      title: "高级",
      backup: "备份与配置",
      logManagement: "日志管理",
      logManagementDesc: "查看应用运行日志",
      openLogViewer: "打开日志查看",
    },
    backup: {
      configDir: "配置目录",
      configDirDesc: "自定义数据存储位置，支持迁移和重置",
      hint: "建议定期备份配置文件",
      browse: "更改目录",
      resetDefault: "恢复默认",
      saveDir: "保存目录",
      migrating: "正在迁移配置目录...",
      migratingDesc: "请勿关闭应用，迁移完成后将自动刷新",
      migrateSuccess: "配置目录迁移完成",
      migrateSuccessDesc: "所有数据已迁移到新目录",
      // 数据库备份
      databaseBackup: "数据库备份",
      databaseBackupDesc: "备份数据库可以在出现问题时快速恢复",
      // 自动备份
      autoBackup: "自动备份",
      enableAutoBackup: "开启自动备份",
      keepDays: "保留时间",
      keep3Days: "3 天",
      keep1Week: "1 周",
      keep1Month: "1 个月",
      autoBackupList: "自动备份列表",
      clearAll: "清空",
      clearAutoConfirm: "确定要清空所有自动备份吗？此操作不可撤销。",
      // 手动备份
      manualBackup: "手动备份",
      manualBackupList: "手动备份列表",
      createBackup: "创建备份",
      creating: "创建中...",
      restoreBackup: "恢复备份",
      renameBackup: "重命名",
      deleteBackup: "删除备份",
      noBackups: "暂无备份",
      backupCount: "个备份",
      page: "页",
      prevPage: "上一页",
      nextPage: "下一页",
      restoreConfirm: "确定要恢复此备份吗？当前数据将被覆盖。",
      deleteConfirm: "确定要删除此备份吗？",
    },
    logs: {
      noLogs: "暂无日志",
      search: "搜索日志...",
      entries: "条日志",
      clearConfirm: "确定要清空当前日期的日志吗？",
      level: "日志级别",
      levelDesc: {
        debug: "显示所有日志，包括调试信息",
        info: "显示信息、警告和错误日志",
        warn: "仅显示警告和错误日志",
        error: "仅显示错误日志",
      },
      retention: "日志保留时间",
      retentionDesc: "超过保留时间的日志将自动清理",
      keep3Days: "3天",
      keep1Week: "1周",
      keep1Month: "1个月",
      refresh: "刷新",
      reachedBottom: "已到底",
    },
    savedToast: "设置已保存",
  },

  // 确认对话框
  confirm: {
    defaultTitle: "确认操作",
    defaultMessage: "确定要执行此操作吗？",
  },

  // 空状态
  empty: {
    noServices: "暂无服务",
    noServicesHint: "点击「添加服务」开始管理",
    noProjects: "暂无项目",
    noProjectsHint: "点击「添加项目」开始管理",
  },

  // 文件监听确认
  watchConfirm: {
    title: "文件变化检测",
    message: "检测到文件变化，是否重启服务？",
    restart: "重启",
    ignore: "忽略",
    moreFiles: "...还有 {count} 个文件",
  },

  // Toast 提示
  toast: {
    saved: "设置已保存",
    batchStartFailed: "批量启动失败",
    batchStopFailed: "批量停止失败",
    batchRestartFailed: "批量重启失败",
    restartServiceFailed: "重启服务失败",
  },
};

export type Translations = typeof zh;
