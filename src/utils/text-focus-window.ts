/**
 * 文本专注滚动模式 - 焦点窗口控制器
 *
 * 文本专注浮窗（focus.html?mode=text）发出的窗口动作（置顶、锁定等）需父窗口
 * 操作 BrowserWindow。单词模式的处理在 Word.vue 内，但文本模式从 TextMemory.vue
 * 打开时 Word.vue 已卸载，故由本控制器常驻处理。
 *
 * 通信通道（与单词模式一致，多通道冗余、at 去重，先到先处理）：
 *   - utools.sendToParent → 父窗口 utools.onMessage（即时，Word.vue 同款通道）
 *   - localStorage 'slowly-record-focus-mode-action' storage 事件（即时，跨窗口可能不同源不触发）
 *   - DB user-set.focusMode.pendingAction 轮询 + 窗口关闭时兜底消费（可靠兜底，
 *     子窗口 postFocusModeAction 以 persistPendingAction:true 写入）
 * "返回列表"等动作必须走即时通道：子窗口点击后 100ms 即自关，300ms 轮询常常来不及，
 * 且子窗口自关后 uTools 可能连带隐藏主窗口，父窗口需在子窗口关闭前主动 close + showMainWindow。
 *
 * 复用 @/utils/focus-lock 的鼠标穿透判断。
 */
import { shouldIgnoreMouseInLockedFocusWindow, focusWindowClosed } from '@/utils/focus-lock';
import { isUtools } from '@/adapters/platform';
import { getSetDb } from '@/utils/user-set-db-util';
import { getDbAdapter } from '@/adapters/db';

const IGNORE_MOUSE_POLL_INTERVAL = 50;
const DB_PENDING_POLL_INTERVAL = 300;
const DB_PENDING_TTL = 15000;

let focusWindow: any = null;
// 已打开的所有文本专注窗口（setTextFocusWindow 只持有"当前"引用，并发计数需全量跟踪）
const textFocusWindows = new Set<any>();

/** 当前文本专注窗口是否仍存活 */
export function textFocusWindowAlive(): boolean {
  return !!focusWindow && !focusWindow.isDestroyed?.();
}

/** 仍存活的文本专注窗口数（打开入口重算并发计数用；已销毁的引用顺手清理） */
export function getAliveTextFocusWindowCount(): number {
  let alive = 0;
  for (const w of textFocusWindows) {
    if (w && !w.isDestroyed?.()) {
      alive++;
    } else {
      textFocusWindows.delete(w);
    }
  }
  return alive;
}
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
    textFocusWindows.add(win);
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
    if (event !== 'closed') return;
    // 多窗口时关闭的可能不是当前窗口：按 winId 登记销毁 + 回收并发计数
    for (const w of textFocusWindows) {
      if (w?._winId === id) {
        w._destroyed = true;
        textFocusWindows.delete(w);
      }
    }
    focusWindowClosed('text');
    // 关闭前 100ms 写入的 pendingAction（如返回列表）轮询来不及读到，兜底消费一次
    consumeLatestTextFocusPendingAction();
    if (id !== currentElectronWinId) return;
    focusWindow = null;
    lastSyncedLocked = false;
    stopIgnoreMousePoll();
    stopDbPendingPoll();
    currentElectronWinId = null;
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
  console.log('[textFocus] dispatchAction:', type, '窗口存活:', textFocusWindowAlive());

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
      // 对齐单词模式 handleOpenWordList：父窗口先主动关闭子窗口再返回列表，
      // 否则子窗口自关后 uTools 可能连带隐藏主窗口，showMainWindow 失效
      if (focusWindow && !focusWindow.isDestroyed?.()) {
        try {
          focusWindow.close();
        } catch (e) {
          // ignore
        }
      }
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

/**
 * 消费一次 DB 中的文本专注 pendingAction（若有且未过期）。
 * 与轮询解耦：窗口关闭瞬间（轮询已停）也可兜底调用，
 * 否则"返回列表"这类关闭前写入的动作会丢失（对齐单词模式 closed 时消费的做法）。
 */
export function consumeLatestTextFocusPendingAction() {
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
    console.log('[textFocus] 消费 DB pendingAction:', pending.type);
    dispatchAction(pending);
    // 处理后清理 pendingAction，避免进程重启后重复执行
    clearDbPendingAction();
  } catch (e) {
    console.error('[textFocus] 读取 DB pendingAction 失败:', e);
  }
}

function consumeDbPendingAction() {
  if (!focusWindow || focusWindow.isDestroyed?.()) {
    stopDbPendingPoll();
    return;
  }
  consumeLatestTextFocusPendingAction();
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

// ========== 即时通道：storage 事件 + utools.onMessage ==========

const FOCUS_MODE_ACTION_STORAGE_KEY = 'slowly-record-focus-mode-action';
let instantListenersBound = false;

// storage 通道：与单词模式 handleFocusModeStorageEvent 一致，只接管文本模式动作
function handleFocusActionStorageEvent(event: StorageEvent) {
  if (event.key !== FOCUS_MODE_ACTION_STORAGE_KEY || !event.newValue) return;
  try {
    const action = JSON.parse(event.newValue);
    if (!action || action.source !== 'text') return;
    const at = Number(action.at || 0);
    if (at && at <= lastHandledAt) return;
    if (at) lastHandledAt = at;
    console.log('[textFocus] storage 通道收到动作:', action.type);
    dispatchAction(action);
  } catch (e) {
    // ignore
  }
}

/**
 * 注册监听（模块级单例，幂等）。
 * DB-poll 由 setTextFocusWindow 触发；此处注册即时通道（storage + onMessage），
 * 让"返回列表"等动作在子窗口自关（100ms）前送达。
 */
export function setupTextFocusListeners() {
  if (instantListenersBound) return;
  instantListenersBound = true;
  window.addEventListener('storage', handleFocusActionStorageEvent);
  const hasOnMessage = isUtools() && typeof (window as any).utools?.onMessage === 'function';
  console.log('[textFocus] 即时通道已注册: storage=true onMessage=', hasOnMessage);
  if (hasOnMessage) {
    (window as any).utools.onMessage((message: any) => {
      const channel = typeof message === 'string' ? message : (message?.channel || message?.type);
      const payload = typeof message === 'object' ? (message?.payload ?? message?.args?.[0]) : undefined;
      console.log('[textFocus] onMessage 收到:', channel, '文本窗口存活:', textFocusWindowAlive());
      // 仅文本专注窗口存活时接管（否则是单词模式动作，交给 Word.vue）
      if (!channel || !textFocusWindowAlive()) return;
      dispatchAction({ type: channel, payload });
    });
  }
}

/** 注销监听并清理状态 */
export function teardownTextFocusListeners() {
  instantListenersBound = false;
  window.removeEventListener('storage', handleFocusActionStorageEvent);
  stopIgnoreMousePoll();
  stopDbPendingPoll();
  lastSyncedLocked = false;
}
