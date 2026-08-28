/**
 * 输入法悬浮键盘 - 窗口控制器
 *
 * 仿 text-focus-window.ts。子窗口（input-method-helper.html）发出的窗口动作
 * （置顶 / 锁定 / 关闭）需父窗口操作 BrowserWindow，由本控制器执行。
 *
 * 通信通道：仅 DB pendingAction 轮询（uTools 父子窗口 onMessage / storage 均不可靠，
 * 与专注模式一致）。
 *
 * 锁定时鼠标穿透：复用 @/utils/focus-lock 的判断 —— 顶部控制条（28px）不穿透可点，
 * 键盘内容区穿透，做到「浮着不挡手，按钮仍可点」。
 */
import { shouldIgnoreMouseInLockedFocusWindow } from '@/utils/focus-lock';
import { isUtools, isElectron } from '@/adapters/platform';
import { getDbAdapter } from '@/adapters/db';

const IGNORE_MOUSE_POLL_INTERVAL = 50;
const DB_PENDING_POLL_INTERVAL = 300;
const DB_PENDING_TTL = 15000;
const TOP_INTERACTIVE_HEIGHT = 28; // 控制条高度（不穿透区）

let helperWindow: any = null;
let lastSyncedLocked = false;
let ignoreMousePollTimer: any = null;
let lastPolledIgnoreMouse: boolean | null = null;
let warnedMissingApi = false;
let dbPollTimer: any = null;
let lastHandledAt = 0;

function getUtools() {
  return (window as any).utools;
}

/** user-set 的 _id 是 'user-set' 前缀（非精确 'user-set'），用 allDocs 查找 */
function getUserSetDoc(): any {
  try {
    const docs = getDbAdapter().allDocs('user-set') as any[];
    return docs.find(d => d && d._id && d._id.startsWith('user-set')) || null;
  } catch (e) {
    return null;
  }
}

/**
 * 打开悬浮键盘窗口并推送键盘数据。
 * @returns true 成功；false 非 uTools 环境（调用方应提示用户）
 */
export async function openInputMethodHelper(scheme: string, schemeName: string, items: any[]): Promise<boolean> {
  // Electron 分支：通过 IPC 创建子窗口 + preload-child 注入 utools shim，对齐 uTools 浮窗体验
  if (isElectron() && (window as any).electronAPI?.createBrowserWindow) {
    return openInputMethodHelperElectron(scheme, schemeName, items);
  }
  if (!isUtools() || !getUtools()?.createBrowserWindow) {
    return false;
  }
  const utools = getUtools();

  // 已存在则复用：重新传数据并聚焦
  if (helperWindow && !helperWindow.isDestroyed?.()) {
    helperWindow.focus?.();
    pushData(scheme, schemeName, items);
    return true;
  }

  // 读用户偏好（置顶/锁定），作为窗口初始状态，避免与子窗口通知时序冲突
  let initAlwaysOnTop = true;
  let initLocked = true;
  try {
    const h = getUserSetDoc()?.inputMethodHelper || {};
    if (typeof h.alwaysOnTop === 'boolean') initAlwaysOnTop = h.alwaysOnTop;
    if (typeof h.locked === 'boolean') initLocked = h.locked;
  } catch (e) {}

  helperWindow = utools.createBrowserWindow('input-method-helper.html', {
    width: 560,
    height: 220,
    minWidth: 360,
    minHeight: 180,
    alwaysOnTop: initAlwaysOnTop,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: true,
    modal: false,
    closable: true,
  }, () => {
    if (helperWindow && typeof helperWindow.show === 'function') {
      helperWindow.show();
    }
    // 子窗口脚本就绪后推送键盘数据
    setTimeout(() => pushData(scheme, schemeName, items), 400);
  });

  const created = helperWindow;
  created?.on?.('closed', () => {
    if (helperWindow === created) {
      helperWindow = null;
      lastSyncedLocked = false;
      stopIgnoreMousePoll();
      stopDbPendingPoll();
    }
  });
  // 浮窗获焦（用户正在操作浮窗）时立即处理积压动作 + 轮询穿透，
  // 绕过父窗口后台节流导致的“点了没反应”
  created?.on?.('focus', flushPendingAndPoll);
  // uTools 主窗口重新可见 / 获焦时同样立即处理
  bindParentLifecycleListeners();

  startDbPendingPoll();
  // 主动设初始置顶 + 锁定穿透（不依赖子窗口 DB 通知时序）
  setTimeout(() => {
    if (!helperWindow || helperWindow.isDestroyed?.()) return;
    applyAlwaysOnTop(initAlwaysOnTop);
    lastSyncedLocked = initLocked;
    if (initLocked) startIgnoreMousePoll();
    console.log('[输入法键盘] 初始状态', { alwaysOnTop: initAlwaysOnTop, locked: initLocked });
  }, 500);
  return true;
}

// ========== Electron 分支：子窗口代理 + ipc 通信 ==========
function createElectronWindowProxy(winId: number): any {
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

// 收集 user-set 文档供子窗口 utools shim 的 db.get/allDocs 同步读取
function collectUserSetDocsForChild(): Record<string, any> {
  const docs: Record<string, any> = {};
  try {
    const all = getDbAdapter().allDocs('user-set') as any[];
    for (const d of all) {
      if (d && d._id) docs[d._id] = d;
    }
  } catch (e) {
    console.error('[输入法键盘] 收集 user-set 失败:', e);
  }
  return docs;
}

// 子窗口 sendToParent 动作 -> 复用 dispatchAction
function handleChildMessageElectron(channel: string, payload: any) {
  dispatchAction({ type: channel, payload });
}

// 子窗口 db.put 转发 -> 父持久化（冲突时读最新 _rev 重试一次）
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
    console.error('[输入法键盘] 父窗口持久化子窗口 db.put 失败:', e);
  }
}

async function openInputMethodHelperElectron(scheme: string, schemeName: string, items: any[]): Promise<boolean> {
  const api = (window as any).electronAPI;
  // 已存在则复用
  if (helperWindow && !helperWindow.isDestroyed?.()) {
    helperWindow.focus?.();
    pushData(scheme, schemeName, items);
    return true;
  }

  let initAlwaysOnTop = true;
  let initLocked = true;
  try {
    const h = getUserSetDoc()?.inputMethodHelper || {};
    if (typeof h.alwaysOnTop === 'boolean') initAlwaysOnTop = h.alwaysOnTop;
    if (typeof h.locked === 'boolean') initLocked = h.locked;
  } catch (e) {}

  const winId = await api.createBrowserWindow('input-method-helper.html', {
    width: 560, height: 220, minWidth: 360, minHeight: 180,
    alwaysOnTop: initAlwaysOnTop, frame: false, transparent: true,
    backgroundColor: '#00000000', resizable: true, modal: false, closable: true,
  });
  helperWindow = createElectronWindowProxy(winId);
  const created = helperWindow;

  api.onFocusWindowEvent(({ winId: id, event }: { winId: number; event: string }) => {
    if (id !== winId) return;
    if (event === 'closed') {
      created._destroyed = true;
      if (helperWindow === created) {
        helperWindow = null;
        lastSyncedLocked = false;
        stopIgnoreMousePoll();
        stopDbPendingPoll();
      }
    } else if (event === 'focus') {
      flushPendingAndPoll();
    }
  });
  api.onFocusChildAction(({ channel, payload }: { channel: string; payload: any }) => {
    handleChildMessageElectron(channel, payload);
  });
  api.onChildDbPut((doc: any) => {
    handleChildDbPut(doc);
  });

  bindParentLifecycleListeners();
  startDbPendingPoll();

  setTimeout(async () => {
    if (!helperWindow || helperWindow.isDestroyed?.()) return;
    // 推送 user-set 快照给子窗口 utools shim（db.get/allDocs 同步读）
    const userSetDocs = collectUserSetDocsForChild();
    await api.focusWindowExecuteJS(winId, `window.electronAPI && window.electronAPI.initFocusData(${JSON.stringify({ docs: userSetDocs })})`);
    applyAlwaysOnTop(initAlwaysOnTop);
    lastSyncedLocked = initLocked;
    if (initLocked) startIgnoreMousePoll();
    pushData(scheme, schemeName, items);
    console.log('[输入法键盘] Electron 初始状态', { alwaysOnTop: initAlwaysOnTop, locked: initLocked });
  }, 500);
  return true;
}

function pushData(scheme: string, schemeName: string, items: any[]) {
  if (!helperWindow || helperWindow.isDestroyed?.()) return;
  const wc = helperWindow.webContents;  if (!wc) {
    console.warn('[输入法键盘] webContents 不可用，无法推送数据');
    return;
  }
  const payload = JSON.stringify({ scheme, schemeName, items });
  const js = `window.initKeyboard(${payload})`;
  console.log('[输入法键盘] 推送数据', scheme, '条目数', items.length);

  // 子窗口脚本可能尚未就绪，失败则递增重试
  const trySend = (delay: number) => {
    setTimeout(() => {
      if (!helperWindow || helperWindow.isDestroyed?.()) return;
      const w = helperWindow.webContents;
      if (!w) return;
      try {
        w.executeJavaScript(js)
          .then(() => console.log('[输入法键盘] 数据推送成功'))
          .catch((e: any) => {
            console.warn('[输入法键盘] 推送失败，将重试:', e);
            if (delay < 1200) trySend(delay + 400);
          });
      } catch (e) {
        console.error('[输入法键盘] 推送异常:', e);
      }
    }, delay);
  };
  trySend(200);
}

// ========== 置顶 ==========
function applyAlwaysOnTop(value: boolean): boolean {
  if (!helperWindow || helperWindow.isDestroyed?.()) return false;
  if (typeof helperWindow.setAlwaysOnTop !== 'function') {
    console.warn('[输入法键盘] setAlwaysOnTop API 不可用');
    return false;
  }
  try {
    helperWindow.setAlwaysOnTop(value);
    if (value && typeof helperWindow.moveTop === 'function') helperWindow.moveTop();
    const applied = typeof helperWindow.isAlwaysOnTop === 'function'
      ? helperWindow.isAlwaysOnTop()
      : value;
    console.log('[输入法键盘] setAlwaysOnTop', value, '实际生效', applied);
    return applied === value;
  } catch (e) {
    console.error('[输入法键盘] 应用置顶失败:', e);
    return false;
  }
}

// ========== 鼠标穿透（锁定） ==========
async function getCursorPointCandidates(): Promise<any[]> {
  try {
    const utools = getUtools();
    if (isUtools() && utools?.getCursorScreenPoint) {
      const point = utools.getCursorScreenPoint();
      const candidates = [point];
      if (utools.screenToDipPoint) candidates.push(utools.screenToDipPoint(point));
      return candidates;
    }
  } catch (e) {
    console.error('[输入法键盘] 获取鼠标坐标失败:', e);
  }
  return [];
}

function setMouseIgnore(shouldIgnore: boolean) {
  if (!helperWindow || helperWindow.isDestroyed?.()) return;
  if (typeof helperWindow.setIgnoreMouseEvents !== 'function') {
    if (!warnedMissingApi) {
      console.warn('[输入法键盘] 窗口未暴露 setIgnoreMouseEvents，无法穿透');
      warnedMissingApi = true;
    }
    return;
  }
  if (shouldIgnore === lastPolledIgnoreMouse) return;
  try {
    if (shouldIgnore) {
      helperWindow.setIgnoreMouseEvents(true, { forward: true });
    } else {
      helperWindow.setIgnoreMouseEvents(false);
      if (typeof helperWindow.focus === 'function') helperWindow.focus();
    }
    lastPolledIgnoreMouse = shouldIgnore;
  } catch (e) {
    console.error('[输入法键盘] 切换鼠标穿透失败:', e);
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
    if (!helperWindow || helperWindow.isDestroyed?.() || !lastSyncedLocked) {
      ignoreMousePollTimer = null;
      return;
    }
    try {
      const bounds = await helperWindow.getBounds?.();
      const cursorCandidates = await getCursorPointCandidates();
      if (!helperWindow || helperWindow.isDestroyed?.()) {
        ignoreMousePollTimer = null;
        return;
      }
      setMouseIgnore(shouldIgnoreMouseInLockedFocusWindow(bounds, cursorCandidates, TOP_INTERACTIVE_HEIGHT));
    } catch (e) {
      // ignore
    }
    if (helperWindow && !helperWindow.isDestroyed?.() && lastSyncedLocked) {
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

/**
 * 立即消费积压的 pendingAction 并轮询一次穿透状态。
 *
 * 用于浮窗获焦 / uTools 主窗口重新可见等“用户主动交互”时刻，绕过 300ms / 50ms
 * 轮询被后台节流带来的延迟——否则用户切走打字一段时间回来，点解锁/置顶会“点了没反应”。
 */
async function flushPendingAndPoll() {
  if (!helperWindow || helperWindow.isDestroyed?.()) return;
  // 1. 立即消费子窗口写入的按钮动作（解锁 / 置顶 / 关闭），不等下一个 300ms 周期
  consumeDbPendingAction();
  // 2. 立即检查一次穿透状态：鼠标可能已停在控制条上，需及时切回“可点”
  if (lastSyncedLocked) {
    try {
      const bounds = await helperWindow.getBounds?.();
      const candidates = await getCursorPointCandidates();
      if (!helperWindow || helperWindow.isDestroyed?.()) return;
      setMouseIgnore(shouldIgnoreMouseInLockedFocusWindow(bounds, candidates, TOP_INTERACTIVE_HEIGHT));
    } catch (e) {
      // ignore
    }
  }
}

let parentLifecycleListenersBound = false;
function onParentVisibilityChange() {
  if (!document.hidden) flushPendingAndPoll();
}
/** 绑定父窗口生命周期监听（幂等），重新可见/获焦时立即冲刷积压动作 */
function bindParentLifecycleListeners() {
  if (parentLifecycleListenersBound) return;
  parentLifecycleListenersBound = true;
  document.addEventListener('visibilitychange', onParentVisibilityChange);
  window.addEventListener('focus', flushPendingAndPoll);
  window.addEventListener('pageshow', flushPendingAndPoll);
}

function handleSetLocked(payload: any) {
  const locked = payload?.locked === true;
  console.log('[输入法键盘] 收到 setLocked:', locked);
  lastSyncedLocked = locked;
  if (!helperWindow || helperWindow.isDestroyed?.()) return;
  // 锁定后内容区鼠标穿透（顶部控制条不穿透可点）+ 禁用缩放，解锁后整窗可交互 + 可缩放
  if (locked) {
    setMouseIgnore(true);
    startIgnoreMousePoll();
    if (typeof helperWindow.setResizable === 'function') helperWindow.setResizable(false);
  } else {
    stopIgnoreMousePoll();
    if (typeof helperWindow.setResizable === 'function') helperWindow.setResizable(true);
  }
}

function handleClose() {
  if (helperWindow && !helperWindow.isDestroyed?.()) {
    try { helperWindow.close?.(); } catch (e) {}
  }
  helperWindow = null;
  lastSyncedLocked = false;
  stopIgnoreMousePoll();
  stopDbPendingPoll();
}

// ========== DB pendingAction 轮询（唯一可靠通道） ==========
function clearDbPendingAction() {
  for (let i = 0; i < 4; i++) {
    try {
      const doc = getUserSetDoc();
      if (!doc?.inputMethodHelper?.pendingAction) return;
      delete doc.inputMethodHelper.pendingAction;
      const res = getDbAdapter().put(doc);
      if (res?.ok) return;
    } catch (e) {
      console.error('[输入法键盘] 清理 pendingAction 失败:', e);
      return;
    }
  }
}

function dispatchAction(action: any) {
  if (!action) return;
  const type = typeof action.type === 'string' ? action.type : '';
  const payload = action.payload;
  console.log('[输入法键盘] dispatchAction:', type, payload);
  switch (type) {
    case 'setAlwaysOnTop': {
      const value = payload?.alwaysOnTop ?? true;
      const applied = applyAlwaysOnTop(value);
      // 置顶有时需要重试才生效
      if (value && !applied) {
        [80, 220].forEach((delay) => {
          setTimeout(() => {
            if (helperWindow && !helperWindow.isDestroyed?.()) applyAlwaysOnTop(true);
          }, delay);
        });
      }
      break;
    }
    case 'setLocked':
      handleSetLocked(payload);
      break;
    case 'closeHelper':
      handleClose();
      break;
    default:
      break;
  }
}

function consumeDbPendingAction() {
  if (!helperWindow || helperWindow.isDestroyed?.()) {
    stopDbPendingPoll();
    return;
  }
  try {
    const doc = getUserSetDoc();
    const pending = doc?.inputMethodHelper?.pendingAction;
    if (!pending) return;
    if (pending.source !== 'input-method-helper') return;
    console.log('[输入法键盘] 轮询读到 pendingAction:', pending.type);
    const at = Number(pending.at || 0);
    if (at && at <= lastHandledAt) return;
    if (at && Date.now() - at > DB_PENDING_TTL) return;
    lastHandledAt = at || Date.now();
    dispatchAction(pending);
    clearDbPendingAction();
  } catch (e) {
    console.error('[输入法键盘] 读取 pendingAction 失败:', e);
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

/** 当前悬浮键盘是否已打开 */
export function isInputMethodHelperOpen(): boolean {
  return !!(helperWindow && !helperWindow.isDestroyed?.());
}
