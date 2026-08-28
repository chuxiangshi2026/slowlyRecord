/**
 * 文本专注滚动模式 - 焦点窗口控制器
 *
 * 文本专注浮窗（focus.html?mode=text）发出的窗口动作（置顶、锁定等）需父窗口
 * 操作 BrowserWindow。单词模式的处理在 Word.vue 内，但文本模式从 TextMemory.vue
 * 打开时 Word.vue 已卸载，故由本控制器常驻处理。
 *
 * 通信通道：仅 DB pendingAction 轮询。
 *   - utools.onMessage 不在 uTools 官方 API（实测 hasApi:false），无效。
 *   - storage 事件在 uTools 父子窗口不同源，不触发，无效。
 *   - DB（utools.db）跨窗口共享，是唯一可靠通道。子窗口 postFocusModeAction
 *     以 persistPendingAction:true 写入 user-set.focusMode.pendingAction，
 *     本控制器轮询读取并执行。
 *
 * 复用 @/utils/focus-lock 的鼠标穿透判断。
 */
import { shouldIgnoreMouseInLockedFocusWindow } from '@/utils/focus-lock';
import { isUtools } from '@/adapters/platform';
import { getSetDb } from '@/utils/user-set-db-util';
import { getDbAdapter } from '@/adapters/db';

const IGNORE_MOUSE_POLL_INTERVAL = 50;
const DB_PENDING_POLL_INTERVAL = 300;
const DB_PENDING_TTL = 15000;

let focusWindow: any = null;
let lastSyncedLocked = false;
let ignoreMousePollTimer: any = null;
let lastPolledIgnoreMouse: boolean | null = null;
let warnedMissingIgnoreMouseApi = false;

let returnHandler: (() => void) | null = null;
let dbPollTimer: any = null;
let lastHandledAt = 0;

/** 注册当前文本专注窗口引用 */
export function setTextFocusWindow(win: any) {
  focusWindow = win;
  if (win) {
    if ((win as any)._winId !== undefined && (window as any).electronAPI) {
      // Electron 代理：用 ipc 实时通信，替代 DB pendingAction 轮询
      bindElectronListeners((win as any)._winId);
    } else {
      startDbPendingPoll();
    }
  } else {
    lastSyncedLocked = false;
    stopIgnoreMousePoll();
    stopDbPendingPoll();
    currentElectronWinId = null;
  }
}

// ========== Electron 分支：子窗口代理 + ipc 通信 ==========
export function createElectronWindowProxy(winId: number): any {
  const api = (window as any).electronAPI;
  const proxy: any = {
    _winId: winId,
    _destroyed: false,
    isDestroyed: () => proxy._destroyed,
    setIgnoreMouseEvents: (ignore: boolean, opts?: any) => { api.focusWindowInvoke(winId, 'setIgnoreMouseEvents', [ignore, opts]); },
    setAlwaysOnTop: (v: boolean) => { api.focusWindowInvoke(winId, 'setAlwaysOnTop', [v]); },
    setResizable: (v: boolean) => { api.focusWindowInvoke(winId, 'setResizable', [v]); },
    moveTop: () => { api.focusWindowInvoke(winId, 'moveTop', []); },
    focus: () => { api.focusWindowInvoke(winId, 'focus', []); },
    show: () => { api.focusWindowInvoke(winId, 'show', []); },
    close: () => { api.focusWindowInvoke(winId, 'close', []); },
    getBounds: () => api.focusWindowInvoke(winId, 'getBounds', []),
    isAlwaysOnTop: () => api.focusWindowInvoke(winId, 'isAlwaysOnTop', []),
    webContents: {
      executeJavaScript: (js: string) => api.focusWindowExecuteJS(winId, js),
    },
  };
  return proxy;
}

// 收集文章 doc + user-set，供子窗口 utools shim 同步读取
export function collectTextFocusDocsForChild(): Record<string, any> {
  const docs: Record<string, any> = {};
  try {
    const adapter: any = getDbAdapter();
    const articleDoc = adapter.get('slowlyrecord-textmemory-data');
    if (articleDoc) docs['slowlyrecord-textmemory-data'] = articleDoc;
    const userSetDocs = adapter.allDocs('user-set') as any[];
    for (const d of userSetDocs) if (d && d._id) docs[d._id] = d;
  } catch (e) {
    console.error('[textFocus] 收集 docs 失败:', e);
  }
  return docs;
}

let electronListenersBound = false;
let currentElectronWinId: number | null = null;
function bindElectronListeners(winId: number) {
  currentElectronWinId = winId;
  if (electronListenersBound) return;
  electronListenersBound = true;
  const api = (window as any).electronAPI;
  api.onFocusChildAction(({ channel, payload }: { channel: string; payload: any }) => {
    dispatchAction({ type: channel, payload });
  });
  api.onChildDbPut((doc: any) => {
    handleChildDbPut(doc);
  });
  api.onFocusWindowEvent(({ winId: id, event }: { winId: number; event: string }) => {
    if (id !== currentElectronWinId) return;
    if (event === 'closed') {
      focusWindow = null;
      lastSyncedLocked = false;
      stopIgnoreMousePoll();
      stopDbPendingPoll();
      currentElectronWinId = null;
    }
  });
}

async function handleChildDbPut(doc: any) {
  try {
    const adapter: any = getDbAdapter();
    let res = await adapter.put(doc);
    if (res && res.ok) return;
    const fresh = await adapter.get(doc._id);
    if (fresh) {
      doc._rev = fresh._rev;
      await adapter.put(doc);
    }
  } catch (e) {
    console.error('[textFocus] 父窗口持久化子窗口 db.put 失败:', e);
  }
}

/** 注册“返回列表”回调（openTextMemory 动作触发） */
export function setReturnToListHandler(fn: (() => void) | null) {
  returnHandler = fn;
}

function applyAlwaysOnTop(targetWindow: any, alwaysOnTop: boolean): boolean {
  if (!targetWindow || typeof targetWindow.setAlwaysOnTop !== 'function') {
    return false;
  }
  try {
    targetWindow.setAlwaysOnTop(alwaysOnTop);
    if (alwaysOnTop && typeof targetWindow.moveTop === 'function') {
      targetWindow.moveTop();
    }
    const applied = typeof targetWindow.isAlwaysOnTop === 'function'
      ? targetWindow.isAlwaysOnTop()
      : alwaysOnTop;
    return applied === alwaysOnTop;
  } catch (e) {
    console.error('[textFocus] 应用置顶状态失败:', e);
    return false;
  }
}

async function getCursorPointCandidates(): Promise<any[]> {
  try {
    if (isUtools() && (window as any).utools?.getCursorScreenPoint) {
      const point = (window as any).utools.getCursorScreenPoint();
      const candidates = [point];
      if ((window as any).utools.screenToDipPoint) {
        candidates.push((window as any).utools.screenToDipPoint(point));
      }
      return candidates;
    }
    if ((window as any).electronAPI?.getCursorScreenPoint) {
      const point = await (window as any).electronAPI.getCursorScreenPoint();
      return point ? [point] : [];
    }
  } catch (e) {
    console.error('[textFocus] 获取鼠标屏幕坐标失败:', e);
  }
  return [];
}

function setMouseIgnore(shouldIgnore: boolean) {
  if (!focusWindow || focusWindow.isDestroyed?.()) {
    return;
  }
  if (typeof focusWindow.setIgnoreMouseEvents !== 'function') {
    if (!warnedMissingIgnoreMouseApi) {
      console.warn('[textFocus] focusWindow 未暴露 setIgnoreMouseEvents API，无法穿透');
      warnedMissingIgnoreMouseApi = true;
    }
    return;
  }
  if (shouldIgnore === lastPolledIgnoreMouse) {
    return;
  }
  try {
    if (shouldIgnore) {
      focusWindow.setIgnoreMouseEvents(true, { forward: true });
    } else {
      focusWindow.setIgnoreMouseEvents(false);
      if (typeof focusWindow.focus === 'function') {
        focusWindow.focus();
      }
    }
    lastPolledIgnoreMouse = shouldIgnore;
  } catch (e) {
    console.error('[textFocus] 切换鼠标穿透失败:', e);
  }
}

function startIgnoreMousePoll() {
  if (ignoreMousePollTimer) {
    clearTimeout(ignoreMousePollTimer);
    ignoreMousePollTimer = null;
  }
  lastPolledIgnoreMouse = null;
  setMouseIgnore(true);

  const poll = async () => {
    if (!focusWindow || focusWindow.isDestroyed?.() || !lastSyncedLocked) {
      ignoreMousePollTimer = null;
      return;
    }
    try {
      const bounds = await focusWindow.getBounds?.();
      const cursorCandidates = await getCursorPointCandidates();
      if (!focusWindow || focusWindow.isDestroyed?.()) {
        ignoreMousePollTimer = null;
        return;
      }
      setMouseIgnore(shouldIgnoreMouseInLockedFocusWindow(bounds, cursorCandidates));
    } catch (e) {
      // ignore
    }
    if (focusWindow && !focusWindow.isDestroyed?.() && lastSyncedLocked) {
      ignoreMousePollTimer = setTimeout(poll, IGNORE_MOUSE_POLL_INTERVAL);
    } else {
      ignoreMousePollTimer = null;
    }
  };
  poll();
}

function stopIgnoreMousePoll() {
  if (ignoreMousePollTimer) {
    clearTimeout(ignoreMousePollTimer);
    ignoreMousePollTimer = null;
  }
  setMouseIgnore(false);
  lastPolledIgnoreMouse = null;
}

function handleSetAlwaysOnTop(state: any) {
  const value = state?.alwaysOnTop ?? true;
  if (!focusWindow || focusWindow.isDestroyed?.()) {
    return;
  }
  const applied = applyAlwaysOnTop(focusWindow, value);
  if (value && !applied) {
    // 置顶有时需要重试才生效
    [80, 220].forEach((delay) => {
      setTimeout(() => {
        if (focusWindow && !focusWindow.isDestroyed?.()) {
          applyAlwaysOnTop(focusWindow, true);
        }
      }, delay);
    });
  }
}

function handleSetLocked(payload: any) {
  const locked = payload?.locked === true;
  lastSyncedLocked = locked;
  if (!focusWindow || focusWindow.isDestroyed?.()) {
    return;
  }
  // 与单词模式一致：锁定后内容区鼠标穿透（顶部按钮区不穿透），底部控件不可点。
  if (locked) {
    setMouseIgnore(true);
    startIgnoreMousePoll();
  } else {
    stopIgnoreMousePoll();
  }
}

function focusLockWindow() {
  if (focusWindow && !focusWindow.isDestroyed?.() && typeof focusWindow.focus === 'function') {
    try {
      focusWindow.focus();
    } catch (e) {
      // ignore
    }
  }
}

function dispatchAction(action: any) {
  if (!action) return;
  const type = typeof action.type === 'string' ? action.type : (action.channel || '');
  const payload = action.payload;
  if (!type) return;

  switch (type) {
    case 'setAlwaysOnTop':
      handleSetAlwaysOnTop(payload);
      break;
    case 'setLocked':
      handleSetLocked(payload);
      break;
    case 'focusLockWindow':
      focusLockWindow();
      break;
    case 'openTextMemory':
      if (returnHandler) returnHandler();
      break;
    // 贴边相关动作文本模式不支持，忽略
    default:
      break;
  }
}

// ========== DB pendingAction 轮询（唯一通道） ==========

/** 处理成功后清理 DB 中的 pendingAction，避免进程重启 lastHandledAt 归零后重复执行 */
function clearDbPendingAction() {
  try {
    const userSetDoc = getSetDb(true);
    if (!userSetDoc?.focusMode?.pendingAction) return;
    delete userSetDoc.focusMode.pendingAction;
    getDbAdapter().put(userSetDoc);
  } catch (e) {
    console.error('[textFocus] 清理 DB pendingAction 失败:', e);
  }
}

function consumeDbPendingAction() {
  if (!focusWindow || focusWindow.isDestroyed?.()) {
    stopDbPendingPoll();
    return;
  }
  try {
    const focusMode = getSetDb(true)?.focusMode;
    const pending = focusMode?.pendingAction;
    if (!pending) return;
    // 单词模式动作交给 Word.vue
    if (pending.source === 'word') return;
    const at = Number(pending.at || 0);
    if (at && at <= lastHandledAt) return;
    if (at && Date.now() - at > DB_PENDING_TTL) return;
    lastHandledAt = at || Date.now();
    dispatchAction(pending);
    // 处理后清理 pendingAction，避免进程重启后重复执行
    clearDbPendingAction();
  } catch (e) {
    console.error('[textFocus] 读取 DB pendingAction 失败:', e);
  }
}

function startDbPendingPoll() {
  if (dbPollTimer) return;
  dbPollTimer = setInterval(consumeDbPendingAction, DB_PENDING_POLL_INTERVAL);
  consumeDbPendingAction();
}

function stopDbPendingPoll() {
  if (dbPollTimer) {
    clearInterval(dbPollTimer);
    dbPollTimer = null;
  }
}

/**
 * 注册监听（模块级单例，幂等）。
 * 实际通道 DB-poll 在 setTextFocusWindow 时启动，此处保留空实现以兼容旧调用。
 */
export function setupTextFocusListeners() {
  // DB-poll 由 setTextFocusWindow 触发，无需在此注册
}

/** 注销监听并清理状态 */
export function teardownTextFocusListeners() {
  stopIgnoreMousePoll();
  stopDbPendingPoll();
  lastSyncedLocked = false;
}
