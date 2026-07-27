// 用户可见文案字典。zh-CN 为事实来源（完整），其余语言可部分翻译，
// 缺失键运行时回退 zh-CN（见 LocaleProvider 的 t()）。
// 注意：存档值（如状态磁贴的 'used'/'unused'）、协议字段（'join' 等）、
// CSS 类名与日志标识不属于文案，禁止抽到这里。

export const zhCN = {
  common: {
    confirm: '确认',
    cancel: '取消',
    delete: '删除',
    save: '保存',
    close: '关闭',
    retry: '重试',
    settings: '设置',
  },
  app: {
    workbench: '游戏策划工作台',
    workModules: '工作模块',
    backToDashboard: '返回项目大厅',
    moduleBrainstorm: '灵感白板',
    moduleBrainstormHint: '整理创意与关联',
    moduleTeam: '房间联机',
    moduleTeamHint: '多人实时协作',
    moduleDocs: '策划文档',
    moduleDocsHint: '撰写设计方案',
    moduleUi: 'UI 原型',
    moduleUiHint: '搭建界面草图',
    saveStatusSaving: '正在保存…',
    saveStatusUnsaved: '有未保存改动',
    saveStatusSaved: '已保存',
    roomOnline: (count: number) => `房间中 · ${count} 人在线`,
    projectSaved: '项目已保存',
    loadingProject: '正在载入项目…',
    moduleLoading: '模块加载中…',
    moduleLoadFailed: '模块加载失败，请检查网络或刷新后重试',
    paletteGoto: (label: string) => `跳转：${label}`,
    paletteGotoSettings: '跳转：设置',
    paletteGotoSettingsHint: 'AI 服务配置',
    paletteSaveProject: '保存项目',
    paletteToggleTheme: '切换深色 / 浅色主题',
    paletteToggleThemeHint: '外观',
    paletteBackHome: '返回项目大厅',
    paletteBackHomeHint: '自动保存后退出',
    paletteShortcutHelp: '查看快捷键',
    paletteAppearance: '外观',
  },
  settings: {
    theme: '主题',
    themeDark: '深色',
    themeLight: '浅色',
    language: '语言',
    languageZh: '中文',
    languageEn: 'English',
    backupTitle: '备份与恢复',
    backupDesc: '应用会自动定期备份；也可以随时手动备份或回退到某个备份',
    backupNow: '立即备份',
    backupDone: '已创建备份',
    backupFailed: '备份失败',
    backupRestore: '恢复',
    backupRestoreConfirmTitle: '恢复此备份？',
    backupRestoreConfirmMessage: '当前数据会先自动另存一份，然后被所选备份覆盖，应用将重新加载。',
    backupRestoreDone: '已恢复备份，正在重新加载…',
    backupRestoreFailed: '恢复失败',
    backupEmpty: '暂无备份',
    backupBrowserAvailable: (sizeKb: number) => `本地备份可用（${sizeKb} KB）`,
    backupKindRolling: '自动',
    backupKindDaily: '每日',
    backupKindManual: '手动',
    backupKindPrerestore: '恢复前',
    storageRecovered: (detail: string) => `存储恢复提示：${detail}`,
  },
};

/** zh-CN 字典的完整形状（事实来源） */
export type Messages = typeof zhCN;

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends string | ((...args: never[]) => string) ? T[K] : DeepPartial<T[K]>;
};

/** 其余语言允许部分翻译；键与 zh-CN 同构（类型约束防拼错键） */
export type PartialMessages = DeepPartial<Messages>;

export const enUS: PartialMessages = {
  common: {
    confirm: 'Confirm',
    cancel: 'Cancel',
    delete: 'Delete',
    save: 'Save',
    close: 'Close',
    retry: 'Retry',
    settings: 'Settings',
  },
  app: {
    workbench: 'Game Design Workbench',
    workModules: 'Modules',
    backToDashboard: 'Back to projects',
    moduleBrainstorm: 'Whiteboard',
    moduleBrainstormHint: 'Organize ideas & links',
    moduleTeam: 'Live Rooms',
    moduleTeamHint: 'Real-time collaboration',
    moduleDocs: 'Documents',
    moduleDocsHint: 'Write design specs',
    moduleUi: 'UI Prototype',
    moduleUiHint: 'Sketch interfaces',
    saveStatusSaving: 'Saving…',
    saveStatusUnsaved: 'Unsaved changes',
    saveStatusSaved: 'Saved',
    roomOnline: (count: number) => `In room · ${count} online`,
    projectSaved: 'Project saved',
    loadingProject: 'Loading project…',
    moduleLoading: 'Loading module…',
    moduleLoadFailed: 'Failed to load module. Check your network and retry.',
    paletteGoto: (label: string) => `Go to: ${label}`,
    paletteGotoSettings: 'Go to: Settings',
    paletteGotoSettingsHint: 'AI service config',
    paletteSaveProject: 'Save project',
    paletteToggleTheme: 'Toggle dark / light theme',
    paletteToggleThemeHint: 'Appearance',
    paletteBackHome: 'Back to projects',
    paletteBackHomeHint: 'Saves automatically on exit',
    paletteShortcutHelp: 'Keyboard shortcuts',
    paletteAppearance: 'Appearance',
  },
  settings: {
    theme: 'Theme',
    themeDark: 'Dark',
    themeLight: 'Light',
    language: 'Language',
    languageZh: '中文',
    languageEn: 'English',
    backupTitle: 'Backup & Restore',
    backupDesc: 'The app backs up automatically; you can also snapshot or roll back at any time',
    backupNow: 'Back up now',
    backupDone: 'Backup created',
    backupFailed: 'Backup failed',
    backupRestore: 'Restore',
    backupRestoreConfirmTitle: 'Restore this backup?',
    backupRestoreConfirmMessage: 'Current data will be saved aside first, then replaced by the selected backup. The app will reload.',
    backupRestoreDone: 'Backup restored, reloading…',
    backupRestoreFailed: 'Restore failed',
    backupEmpty: 'No backups yet',
    backupBrowserAvailable: (sizeKb: number) => `Local backup available (${sizeKb} KB)`,
    backupKindRolling: 'Auto',
    backupKindDaily: 'Daily',
    backupKindManual: 'Manual',
    backupKindPrerestore: 'Pre-restore',
    storageRecovered: (detail: string) => `Storage recovery: ${detail}`,
  },
};

export type LocaleCode = 'zh-CN' | 'en-US';

export const DICTIONARIES: Record<LocaleCode, PartialMessages> = {
  'zh-CN': zhCN,
  'en-US': enUS,
};

export const DEFAULT_LOCALE: LocaleCode = 'zh-CN';
export const LOCALE_STORAGE_KEY = 'gp_locale';
