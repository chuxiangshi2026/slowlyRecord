/**
 * 子窗口适配层
 *
 * 收纳三个浮窗控制器（单词专注 Word.vue / 文本专注 text-focus-window.ts /
 * 输入法键盘 input-method-helper-window.ts）重复的窗口原语：
 * - createElectronWindowProxy：Electron IPC 子窗口代理，对齐 uTools BrowserWindow 调用形状
 * - getCursorPointCandidates：取鼠标屏幕坐标候选（uTools 同步 + DIP 换算 / Electron 走 IPC）
 * - applyChildWindowAlwaysOnTop：置顶应用 + 实际状态回读
 * - persistChildDbPut：子窗口 db.put 转发父窗口持久化（_rev 冲突重试一次）
 *
 * 注意：仅桌面端（uTools/Electron）有意义，Web/小程序端所有函数降级为空操作。
 */
import { isUtools } from './platform'
import { getDbAdapter } from './db'
import { updateSetDbWithRetry } from '@/utils/user-set-db-util'

/**
 * Electron 子窗口代理（IPC 转发）。
 * isAlwaysOnTop/isFocused 读本地状态（setAlwaysOnTop 时同步更新），
 * 保证 applyChildWindowAlwaysOnTop 的「实际状态 === 期望值」同步比较成立。
 */
export function createElectronWindowProxy(winId: number, alwaysOnTop: boolean = true): any {
  const api = (window as any).electronAPI
  const proxy: any = {
    _winId: winId,
    _destroyed: false,
    _focused: false,
    _alwaysOnTop: alwaysOnTop,
    isDestroyed: () => proxy._destroyed,
    isFocused: () => proxy._focused,
    isAlwaysOnTop: () => proxy._alwaysOnTop,
    setIgnoreMouseEvents: (ignore: boolean, opts?: any) => { api.focusWindowInvoke(winId, 'setIgnoreMouseEvents', [ignore, opts]) },
    setAlwaysOnTop: (v: boolean) => { proxy._alwaysOnTop = v; api.focusWindowInvoke(winId, 'setAlwaysOnTop', [v]) },
    setResizable: (v: boolean) => { api.focusWindowInvoke(winId, 'setResizable', [v]) },
    setBounds: (bounds: any) => { api.focusWindowInvoke(winId, 'setBounds', [bounds]) },
    moveTop: () => { api.focusWindowInvoke(winId, 'moveTop', []) },
    focus: () => { api.focusWindowInvoke(winId, 'focus', []) },
    show: () => { api.focusWindowInvoke(winId, 'show', []) },
    close: () => { api.focusWindowInvoke(winId, 'close', []) },
    getBounds: () => api.focusWindowInvoke(winId, 'getBounds', []),
    webContents: {
      executeJavaScript: (js: string) => api.focusWindowExecuteJS(winId, js),
    },
  }
  return proxy
}

/**
 * 鼠标屏幕坐标候选列表：uTools 同步取 + DIP 换算候选；Electron 走主进程 IPC。
 * 候选有多个是因为缩放下 getBounds 与光标坐标可能处于不同坐标系，
 * 由 shouldIgnoreMouseInLockedFocusWindow 逐个尝试。
 */
export async function getCursorPointCandidates(): Promise<any[]> {
  try {
    const utools = (window as any).utools
    if (isUtools() && utools?.getCursorScreenPoint) {
      const point = utools.getCursorScreenPoint()
      const candidates = [point]
      if (utools.screenToDipPoint) {
        candidates.push(utools.screenToDipPoint(point))
      }
      return candidates
    }
    if ((window as any).electronAPI?.getCursorScreenPoint) {
      const point = await (window as any).electronAPI.getCursorScreenPoint()
      return point ? [point] : []
    }
  } catch (e) {
    console.error('[window] 获取鼠标屏幕坐标失败:', e)
  }
  return []
}

/**
 * 应用子窗口置顶状态并回读实际值。
 * @returns 实际状态是否与期望一致（置顶偶发不生效时调用方据此前置重试）
 */
export function applyChildWindowAlwaysOnTop(targetWindow: any, alwaysOnTop: boolean, source: string): boolean {
  if (!targetWindow || typeof targetWindow.setAlwaysOnTop !== 'function') {
    return false
  }
  try {
    targetWindow.setAlwaysOnTop(alwaysOnTop)
    if (alwaysOnTop && typeof targetWindow.moveTop === 'function') {
      targetWindow.moveTop()
    }
    const applied = typeof targetWindow.isAlwaysOnTop === 'function'
      ? targetWindow.isAlwaysOnTop()
      : alwaysOnTop
    return applied === alwaysOnTop
  } catch (e) {
    console.error(`[${source}] 应用置顶状态失败:`, e)
    return false
  }
}

/**
 * 子窗口（utools shim）db.put 转发父窗口持久化。
 * 专注/输入法的 pendingAction 走设置合并队列；其他文档冲突时读最新 _rev 重试一次。
 * 三个浮窗控制器（单词/文本专注、输入法键盘）的 handleChildDbPut 统一实现。
 */
export async function persistChildDbPut(doc: any, logTag: string): Promise<void> {
  try {
    const focusPending = doc?.focusMode?.pendingAction
    const helperPending = doc?.inputMethodHelper?.pendingAction
    if (typeof doc?._id === 'string' && doc._id.startsWith('user-set') && (focusPending || helperPending)) {
      // 子窗口这里只新增 pendingAction；其他字段可能是旧快照，不能整份覆盖父窗口的新设置
      const ok = await updateSetDbWithRetry((latest) => {
        if (focusPending) {
          latest.focusMode = { ...(latest.focusMode || {}), pendingAction: focusPending }
        }
        if (helperPending) {
          latest.inputMethodHelper = { ...(latest.inputMethodHelper || {}), pendingAction: helperPending }
        }
      })
      if (!ok) console.error(`[${logTag}] 父窗口持久化子窗口动作失败`)
      return
    }
    const adapter: any = getDbAdapter()
    const res = await adapter.put(doc)
    if (res && res.ok) return
    const fresh = await adapter.get(doc._id)
    if (fresh) {
      doc._rev = fresh._rev
      await adapter.put(doc)
    }
  } catch (e) {
    console.error(`[${logTag}] 父窗口持久化子窗口 db.put 失败:`, e)
  }
}
