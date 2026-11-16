/**
 * 平台差异化文案的共用事实来源
 *
 * 同一份界面在 uTools 插件 / Electron 桌面应用 / Web 上使用，涉及"全局快捷键""退出插件"
 * 这类平台语义的文案必须按端区分，避免在桌面版里写"在 uTools 输入框输入…"。
 */
import { isElectron, isUtools, isWeb } from '@/adapters/platform'

/** 是否 macOS（mac 上 Electron 的 CommandOrControl 映射为 Cmd） */
function isMac(): boolean {
  return typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform || '')
}

/** Electron 主进程注册的应用级全局快捷键（与 electron/main.cjs 的 registerGlobalShortcuts 对应） */
export const APP_GLOBAL_SHORTCUTS = [
  { keys: 'Ctrl + Shift + W', desc: '显示 / 隐藏主窗口' },
  { keys: 'Ctrl + Shift + S', desc: '截图翻译' },
  { keys: 'Ctrl + Shift + T', desc: '划词翻译' },
  { keys: 'Ctrl + Shift + A', desc: '划词添加' },
]

/** 按平台替换修饰键显示（mac 用 Cmd） */
export function platformShortcutRows(): Array<{ desc: string; keys: string }> {
  const mac = isMac()
  return APP_GLOBAL_SHORTCUTS.map(({ keys, desc }) => ({
    desc,
    keys: mac ? keys.replace(/Ctrl/g, 'Cmd') : keys,
  }))
}

/**
 * 收集单词的全局唤起方式（引导提示用）
 * - uTools：输入框关键字
 * - Electron：应用级全局快捷键
 * - Web：仅页面内操作
 */
export function collectHint(): string {
  if (isUtools()) return '在 uTools 输入框输入「划词添加」「截图添加」可快速收集单词'
  if (isElectron()) return '任意程序里按 Ctrl+Shift+A 划词添加、Ctrl+Shift+T 划词翻译、Ctrl+Shift+S 截图翻译'
  if (isWeb()) return '网页版请在页面内输入或粘贴单词；安装桌面版可用全局快捷键'
  return '选中单词或截图后可快速加入词库'
}
