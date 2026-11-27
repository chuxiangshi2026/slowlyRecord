// @vitest-environment jsdom
/**
 * 输入法悬浮键盘窗口控制器（src/utils/input-method-helper-window.ts）
 *
 * 覆盖：平台门控、uTools 建窗参数与复用、Electron IPC 委托、user-set 偏好读取与降级、
 * 子窗口 pendingAction 轮询分发、错误路径（按源码实际行为断言，不改生产代码）。
 *
 * 该模块用模块级单例持有窗口引用与轮询定时器，因此每个用例都走过
 * `vi.resetModules()` + 动态 import，保证互不串味；窗口清理统一走 closed 事件。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { platformState, dbState, windowAdapter } = vi.hoisted(() => {
  const platformState = { utools: true, electron: false };

  const dbState: any = {
    docs: [] as any[],
    allDocsError: null as any,
    updateResult: true,
    updateCalls: [] as any[],
    adapter: null as any,
  };

  const windowAdapter = {
    createElectronWindowProxy: vi.fn(),
    getCursorPointCandidates: vi.fn(),
    applyChildWindowAlwaysOnTop: vi.fn(),
    persistChildDbPut: vi.fn(),
  };

  return { platformState, dbState, windowAdapter };
});

vi.mock('@/adapters/platform', () => ({
  isUtools: () => platformState.utools,
  isElectron: () => platformState.electron,
}));

vi.mock('@/adapters/db', () => ({
  getDbAdapter: () => dbState.adapter,
}));

vi.mock('@/adapters/window', () => windowAdapter);

// 只替换 updateSetDbWithRetry：其它导出保持源码语义（本模块只用到这一个）
vi.mock('@/utils/user-set-db-util', () => ({
  updateSetDbWithRetry: async (mutator: (doc: any) => void) => {
    const base = dbState.docs[0]
      ? JSON.parse(JSON.stringify(dbState.docs[0]))
      : { _id: 'user-set' };
    mutator(base);
    dbState.docs = [base];
    dbState.updateCalls.push(base);
    return dbState.updateResult;
  },
}));

type AnyObj = Record<string, any>;

let createdUtoolsWindows: AnyObj[] = [];
let electronSessions: { api: AnyObj; winId: number; proxy: AnyObj }[] = [];
let warnSpy: any;
let errorSpy: any;

function makeUtoolsWindow() {
  const handlers: Record<string, ((...args: any[]) => void)[]> = {};
  const win: AnyObj = {
    focus: vi.fn(),
    show: vi.fn(),
    close: vi.fn(),
    isDestroyed: vi.fn(() => false),
    setAlwaysOnTop: vi.fn(),
    isAlwaysOnTop: vi.fn(() => true),
    moveTop: vi.fn(),
    setIgnoreMouseEvents: vi.fn(),
    setResizable: vi.fn(),
    getBounds: vi.fn(async () => ({ x: 0, y: 0, width: 560, height: 220 })),
    webContents: { executeJavaScript: vi.fn(async () => true) },
    on: vi.fn((event: string, cb: (...args: any[]) => void) => {
      (handlers[event] ||= []).push(cb);
    }),
    emit(event: string) {
      (handlers[event] || []).forEach((cb) => cb());
    },
  };
  return win;
}

function makeElectronProxy(winId: number) {
  const proxy: AnyObj = {
    _winId: winId,
    _destroyed: false,
    focus: vi.fn(),
    show: vi.fn(),
    close: vi.fn(),
    isDestroyed: () => proxy._destroyed,
    setAlwaysOnTop: vi.fn(),
    isAlwaysOnTop: () => true,
    setIgnoreMouseEvents: vi.fn(),
    setResizable: vi.fn(),
    getBounds: vi.fn(async () => ({ x: 0, y: 0, width: 560, height: 220 })),
    webContents: { executeJavaScript: vi.fn(async () => true) },
  };
  return proxy;
}

function makeElectronApi(winId = 77) {
  const api: AnyObj = {
    createBrowserWindow: vi.fn(async () => winId),
    onFocusWindowEvent: vi.fn(),
    onFocusChildAction: vi.fn(),
    onChildDbPut: vi.fn(),
    focusWindowExecuteJS: vi.fn(async () => true),
    focusWindowInvoke: vi.fn(async () => ({})),
    getCursorScreenPoint: vi.fn(async () => ({ x: 0, y: 0 })),
  };
  electronSessions.push({ api, winId, proxy: null as any });
  return api;
}

/** 重新加载被测模块，重置模块级单例（窗口引用 / 定时器 / 去重状态） */
async function loadModule() {
  vi.resetModules();
  return import('@/utils/input-method-helper-window');
}

function installUtools(createBrowserWindow?: AnyObj) {
  const utools: AnyObj = {
    getPath: vi.fn(() => '/fake'),
    createBrowserWindow:
      createBrowserWindow ||
      vi.fn(() => {
        const win = makeUtoolsWindow();
        createdUtoolsWindows.push(win);
        return win;
      }),
  };
  (window as any).utools = utools;
  return utools;
}

function seedUserSet(doc: AnyObj | null) {
  dbState.docs = doc ? [doc] : [];
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-27T10:00:00+08:00'));

  platformState.utools = true;
  platformState.electron = false;
  dbState.docs = [];
  dbState.allDocsError = null;
  dbState.updateResult = true;
  dbState.updateCalls = [];
  dbState.adapter = {
    allDocs: (prefix: string) => {
      if (dbState.allDocsError) throw dbState.allDocsError;
      return dbState.docs.filter(
        (d: AnyObj) => d && typeof d._id === 'string' && d._id.startsWith(prefix),
      );
    },
    get: (id: string) => dbState.docs.find((d: AnyObj) => d._id === id) || null,
    put: vi.fn(async () => ({ ok: true, rev: '1-x' })),
    promises: {
      put: vi.fn(async () => ({ ok: true, rev: '1-x' })),
      remove: vi.fn(async () => ({ ok: true })),
    },
  };

  createdUtoolsWindows = [];
  electronSessions = [];

  windowAdapter.createElectronWindowProxy.mockImplementation((winId: number) => {
    const proxy = makeElectronProxy(winId);
    const session = electronSessions[electronSessions.length - 1];
    if (session) session.proxy = proxy;
    return proxy;
  });
  windowAdapter.getCursorPointCandidates.mockResolvedValue([]);
  windowAdapter.applyChildWindowAlwaysOnTop.mockReturnValue(true);
  windowAdapter.persistChildDbPut.mockResolvedValue(undefined);

  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  // 通过 closed 事件让每个模块实例自行清理窗口引用与轮询定时器
  for (const win of createdUtoolsWindows) {
    try {
      win.emit('closed');
    } catch {
      /* 忽略清理期异常 */
    }
  }
  for (const session of electronSessions) {
    const handler = session.api.onFocusWindowEvent.mock.calls[0]?.[0];
    try {
      handler?.({ winId: session.winId, event: 'closed' });
    } catch {
      /* 忽略清理期异常 */
    }
  }
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete (window as any).utools;
  delete (window as any).electronAPI;
});

// ========== 平台门控 ==========
describe('平台门控', () => {
  it('web / 小程序环境（非 uTools 非 Electron）返回 false 且不创建窗口', async () => {
    platformState.utools = false;
    platformState.electron = false;
    const utools = installUtools();

    const { openInputMethodHelper } = await loadModule();
    const ok = await openInputMethodHelper('en', 'qwerty', []);

    expect(ok).toBe(false);
    expect(utools.createBrowserWindow).not.toHaveBeenCalled();
  });

  it('uTools 环境缺少 createBrowserWindow 时返回 false', async () => {
    platformState.utools = true;
    platformState.electron = false;
    (window as any).utools = { getPath: vi.fn(() => '/fake') };

    const { openInputMethodHelper } = await loadModule();
    expect(await openInputMethodHelper('en', 'qwerty', [])).toBe(false);
  });

  it('Electron 环境缺少 electronAPI.createBrowserWindow 时返回 false', async () => {
    platformState.utools = false;
    platformState.electron = true;
    (window as any).electronAPI = {};

    const { openInputMethodHelper } = await loadModule();
    expect(await openInputMethodHelper('en', 'qwerty', [])).toBe(false);
  });

  it('初始 isInputMethodHelperOpen() 为 false', async () => {
    installUtools();
    const { isInputMethodHelperOpen } = await loadModule();
    expect(isInputMethodHelperOpen()).toBe(false);
  });
});

// ========== uTools 分支 ==========
describe('uTools 分支：创建窗口与参数', () => {
  it('按源码参数创建子窗口，默认置顶 + 锁定穿透', async () => {
    const utools = installUtools();
    seedUserSet(null); // 无 user-set 文档 -> 默认 alwaysOnTop/locked

    const { openInputMethodHelper, isInputMethodHelperOpen } = await loadModule();
    const ok = await openInputMethodHelper('en', 'qwerty', [{ k: 1 }]);

    expect(ok).toBe(true);
    expect(isInputMethodHelperOpen()).toBe(true);
    expect(utools.createBrowserWindow).toHaveBeenCalledTimes(1);

    const [url, options, callback] = utools.createBrowserWindow.mock.calls[0];
    expect(url).toBe('input-method-helper.html');
    expect(options).toEqual(
      expect.objectContaining({
        width: 560,
        height: 220,
        minWidth: 360,
        minHeight: 180,
        alwaysOnTop: true,
        frame: false,
        transparent: true,
        backgroundColor: '#00000000',
        resizable: true,
        modal: false,
        closable: true,
      }),
    );
    expect(typeof callback).toBe('function');

    // 500ms 后主动应用初始置顶 + 锁定穿透
    const win = createdUtoolsWindows[0];
    await vi.advanceTimersByTimeAsync(500);
    expect(windowAdapter.applyChildWindowAlwaysOnTop).toHaveBeenCalledWith(win, true, '输入法键盘');
    expect(win.setIgnoreMouseEvents).toHaveBeenCalledWith(true, { forward: true });
  });

  it('读取 user-set 偏好：alwaysOnTop=false / locked=false 生效', async () => {
    const utools = installUtools();
    seedUserSet({
      _id: 'user-set',
      inputMethodHelper: { alwaysOnTop: false, locked: false },
    });

    const { openInputMethodHelper } = await loadModule();
    await openInputMethodHelper('en', 'qwerty', []);

    expect(utools.createBrowserWindow.mock.calls[0][1]).toEqual(
      expect.objectContaining({ alwaysOnTop: false }),
    );

    const win = createdUtoolsWindows[0];
    await vi.advanceTimersByTimeAsync(500);
    expect(windowAdapter.applyChildWindowAlwaysOnTop).toHaveBeenCalledWith(win, false, '输入法键盘');
    // locked=false 时不启动穿透轮询
    expect(win.setIgnoreMouseEvents).not.toHaveBeenCalled();
  });

  it('历史 _id 前缀（user-set<uuid>）也能读到偏好', async () => {
    const utools = installUtools();
    seedUserSet({
      _id: 'user-set0f3a2b',
      inputMethodHelper: { alwaysOnTop: false, locked: true },
    });

    const { openInputMethodHelper } = await loadModule();
    await openInputMethodHelper('en', 'qwerty', []);
    expect(utools.createBrowserWindow.mock.calls[0][1]).toEqual(
      expect.objectContaining({ alwaysOnTop: false }),
    );
  });

  it('user-set 读取异常 / 字段损坏时回退默认值（置顶 + 锁定）且不抛错', async () => {
    const utools = installUtools();
    dbState.allDocsError = new Error('db boom');

    const { openInputMethodHelper } = await loadModule();
    const ok = await openInputMethodHelper('en', 'qwerty', []);
    expect(ok).toBe(true);
    expect(utools.createBrowserWindow.mock.calls[0][1]).toEqual(
      expect.objectContaining({ alwaysOnTop: true }),
    );

    // 字段类型不是 boolean 时同样忽略
    dbState.allDocsError = null;
    seedUserSet({ _id: 'user-set', inputMethodHelper: { alwaysOnTop: 'yes', locked: 1 } });
    const second = await loadModule();
    await second.openInputMethodHelper('en', 'qwerty', []);
    expect(utools.createBrowserWindow.mock.calls[1][1]).toEqual(
      expect.objectContaining({ alwaysOnTop: true }),
    );
  });

  it('窗口已存在时复用：不重复创建，focus 并重新推送数据', async () => {
    const utools = installUtools();
    seedUserSet(null);

    const { openInputMethodHelper } = await loadModule();
    await openInputMethodHelper('en', 'qwerty', [{ k: 1 }]);
    const win = createdUtoolsWindows[0];
    // 首次打开只挂创建回调，不在这里推数据
    expect(win.webContents.executeJavaScript).not.toHaveBeenCalled();

    const ok = await openInputMethodHelper('ja', 'kana', []);
    expect(ok).toBe(true);
    expect(utools.createBrowserWindow).toHaveBeenCalledTimes(1);
    expect(win.focus).toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(200);
    expect(win.webContents.executeJavaScript).toHaveBeenCalledTimes(1);
    expect(win.webContents.executeJavaScript.mock.calls[0][0]).toContain(
      'window.initKeyboard({"scheme":"ja","schemeName":"kana"',
    );
  });

  it('子窗口就绪回调触发 show 并在 400ms 后补推数据', async () => {
    const utools = installUtools();
    const { openInputMethodHelper } = await loadModule();
    await openInputMethodHelper('en', 'qwerty', [{ k: 1 }]);

    const win = createdUtoolsWindows[0];
    const callback = utools.createBrowserWindow.mock.calls[0][2];
    callback();
    expect(win.show).toHaveBeenCalledTimes(1);

    // 回调内 setTimeout 400 触发 pushData，再等 trySend 200
    await vi.advanceTimersByTimeAsync(600);
    expect(win.webContents.executeJavaScript).toHaveBeenCalledTimes(1);
    expect(win.webContents.executeJavaScript.mock.calls[0][0]).toContain(
      'window.initKeyboard({"scheme":"en","schemeName":"qwerty"',
    );
  });

  it('closed 事件清理窗口引用，再次打开会重新创建', async () => {
    const utools = installUtools();
    const { openInputMethodHelper, isInputMethodHelperOpen } = await loadModule();
    await openInputMethodHelper('en', 'qwerty', []);
    expect(isInputMethodHelperOpen()).toBe(true);

    createdUtoolsWindows[0].emit('closed');
    expect(isInputMethodHelperOpen()).toBe(false);

    await openInputMethodHelper('en', 'qwerty', []);
    expect(utools.createBrowserWindow).toHaveBeenCalledTimes(2);
    expect(isInputMethodHelperOpen()).toBe(true);
  });

  it('webContents 不可用时只 warn，不抛错', async () => {
    installUtools();
    const { openInputMethodHelper } = await loadModule();
    await openInputMethodHelper('en', 'qwerty', []);

    const win = createdUtoolsWindows[0];
    delete win.webContents;
    // 复用路径会立即 pushData，此时 webContents 缺失
    await openInputMethodHelper('en', 'qwerty', []);

    expect(warnSpy).toHaveBeenCalledWith('[输入法键盘] webContents 不可用，无法推送数据');
  });

  it('推送失败按 delay + 400 递增重试，delay 超过 1200ms 后停止', async () => {
    installUtools();
    const { openInputMethodHelper } = await loadModule();
    await openInputMethodHelper('en', 'qwerty', []);
    // 复用路径立即 pushData -> 起一轮 200ms 重试链
    await openInputMethodHelper('en', 'qwerty', []);

    const win = createdUtoolsWindows[0];
    win.webContents.executeJavaScript.mockRejectedValue(new Error('page not ready'));

    // 重试链在 Promise catch（微任务）里排下一拍，且 delay 相对当前时刻累加：
    // 实际落点 200 / 800 / 1800 / 3200ms（1400 时已超过 1200 阈值，不再排期）
    for (let i = 0; i < 8; i++) {
      await vi.advanceTimersByTimeAsync(500);
    }
    expect(win.webContents.executeJavaScript).toHaveBeenCalledTimes(4);
    expect(warnSpy).toHaveBeenCalledWith('[输入法键盘] 推送失败，将重试:', expect.any(Error));
  });
});

// ========== Electron 分支 ==========
describe('Electron 分支', () => {
  it('委托 electronAPI 建窗、注册 IPC、推送 user-set 快照', async () => {
    platformState.utools = false;
    platformState.electron = true;
    const api = makeElectronApi(77);
    (window as any).electronAPI = api;
    seedUserSet({
      _id: 'user-set-abc',
      inputMethodHelper: { alwaysOnTop: false, locked: false },
    });

    const { openInputMethodHelper, isInputMethodHelperOpen } = await loadModule();
    const ok = await openInputMethodHelper('en', 'qwerty', [{ k: 1 }]);

    expect(ok).toBe(true);
    expect(isInputMethodHelperOpen()).toBe(true);

    const [url, options] = api.createBrowserWindow.mock.calls[0];
    expect(url).toBe('input-method-helper.html');
    expect(options).toEqual(
      expect.objectContaining({
        width: 560,
        height: 220,
        minWidth: 360,
        minHeight: 180,
        alwaysOnTop: false,
        frame: false,
        transparent: true,
        backgroundColor: '#00000000',
        resizable: true,
        modal: false,
        closable: true,
      }),
    );

    expect(windowAdapter.createElectronWindowProxy).toHaveBeenCalledWith(77);
    expect(api.onFocusWindowEvent).toHaveBeenCalledTimes(1);
    expect(api.onFocusChildAction).toHaveBeenCalledTimes(1);
    expect(api.onChildDbPut).toHaveBeenCalledTimes(1);

    const [winId, initJs] = api.focusWindowExecuteJS.mock.calls[0];
    expect(winId).toBe(77);
    expect(initJs).toContain('window.electronAPI.initFocusData(');
    expect(initJs).toContain('user-set-abc');

    // locked=false -> 不启动穿透
    expect(windowAdapter.applyChildWindowAlwaysOnTop).toHaveBeenCalledWith(
      electronSessions[0].proxy,
      false,
      '输入法键盘',
    );

    // pushData 走 proxy.webContents.executeJavaScript（模拟代理不转发到 api）
    const proxy = electronSessions[0].proxy;
    await vi.advanceTimersByTimeAsync(200);
    expect(proxy.webContents.executeJavaScript).toHaveBeenCalledTimes(1);
    expect(proxy.webContents.executeJavaScript.mock.calls[0][0]).toContain('window.initKeyboard(');
    expect(api.focusWindowExecuteJS).toHaveBeenCalledTimes(1);
  });

  it('窗口已存在时复用：focus 透传且不重复建窗', async () => {
    platformState.utools = false;
    platformState.electron = true;
    const api = makeElectronApi(88);
    (window as any).electronAPI = api;

    const { openInputMethodHelper } = await loadModule();
    await openInputMethodHelper('en', 'qwerty', []);
    await vi.advanceTimersByTimeAsync(200);

    const ok = await openInputMethodHelper('ja', 'kana', []);
    expect(ok).toBe(true);
    expect(api.createBrowserWindow).toHaveBeenCalledTimes(1);
    expect(electronSessions[0].proxy.focus).toHaveBeenCalled();
  });

  it('初始化推送失败：warn + close + 返回 false', async () => {
    platformState.utools = false;
    platformState.electron = true;
    const api = makeElectronApi(99);
    api.focusWindowExecuteJS.mockRejectedValue(new Error('ipc boom'));
    (window as any).electronAPI = api;

    const { openInputMethodHelper, isInputMethodHelperOpen } = await loadModule();
    const ok = await openInputMethodHelper('en', 'qwerty', []);

    expect(ok).toBe(false);
    expect(isInputMethodHelperOpen()).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith('[输入法键盘] 子窗口初始化推送失败', expect.any(Error));
    expect(electronSessions[0].proxy.close).toHaveBeenCalledTimes(1);
  });

  it('winId 匹配的 closed 事件清理引用，不匹配的忽略', async () => {
    platformState.utools = false;
    platformState.electron = true;
    const api = makeElectronApi(100);
    (window as any).electronAPI = api;

    const { openInputMethodHelper, isInputMethodHelperOpen } = await loadModule();
    await openInputMethodHelper('en', 'qwerty', []);
    const focusHandler = api.onFocusWindowEvent.mock.calls[0][0];

    focusHandler({ winId: 999, event: 'closed' });
    expect(isInputMethodHelperOpen()).toBe(true);

    focusHandler({ winId: 100, event: 'closed' });
    expect(isInputMethodHelperOpen()).toBe(false);
  });

  it('onFocusChildAction 转 dispatchAction：closeHelper 与 setLocked', async () => {
    platformState.utools = false;
    platformState.electron = true;
    const api = makeElectronApi(101);
    (window as any).electronAPI = api;

    const { openInputMethodHelper } = await loadModule();
    await openInputMethodHelper('en', 'qwerty', []);
    const actionHandler = api.onFocusChildAction.mock.calls[0][0];
    const proxy = electronSessions[0].proxy;

    actionHandler({ channel: 'setLocked', payload: { locked: false } });
    expect(proxy.setIgnoreMouseEvents).toHaveBeenCalled();
    expect(proxy.setResizable).toHaveBeenCalledWith(true);

    actionHandler({ channel: 'closeHelper', payload: {} });
    expect(proxy.close).toHaveBeenCalledTimes(1);
  });

  it('createBrowserWindow 失败时透传给调用方（源码未捕获，记录现状）', async () => {
    platformState.utools = false;
    platformState.electron = true;
    const api = makeElectronApi(103);
    api.createBrowserWindow.mockRejectedValue(new Error('create boom'));
    (window as any).electronAPI = api;

    const { openInputMethodHelper } = await loadModule();
    await expect(openInputMethodHelper('en', 'qwerty', [])).rejects.toThrow('create boom');
  });

  it(
    '关闭后重新打开只注册一次 IPC 监听（preload 为 ipcRenderer.on 追加语义）',
    async () => {
      platformState.utools = false;
      platformState.electron = true;
      const api = makeElectronApi(104);
      (window as any).electronAPI = api;

      const { openInputMethodHelper } = await loadModule();
      await openInputMethodHelper('en', 'qwerty', []);
      // 关闭窗口，引用清空
      api.onFocusWindowEvent.mock.calls[0][0]({ winId: 104, event: 'closed' });
      expect(api.onFocusChildAction).toHaveBeenCalledTimes(1);
      // 再次打开不应追加监听，否则同一子窗口动作会被分发多次
      await openInputMethodHelper('en', 'qwerty', []);
      expect(api.onFocusChildAction).toHaveBeenCalledTimes(1);
    },
  );

  it('onChildDbPut 转发给 persistChildDbPut（带「输入法键盘」标签）', async () => {
    platformState.utools = false;
    platformState.electron = true;
    const api = makeElectronApi(102);
    (window as any).electronAPI = api;

    const { openInputMethodHelper } = await loadModule();
    await openInputMethodHelper('en', 'qwerty', []);
    const dbPutHandler = api.onChildDbPut.mock.calls[0][0];
    const doc = { _id: 'user-set', inputMethodHelper: { pendingAction: { type: 'closeHelper' } } };

    dbPutHandler(doc);
    expect(windowAdapter.persistChildDbPut).toHaveBeenCalledWith(doc, '输入法键盘');
  });
});

// ========== 偏好清理与保存降级 ==========
describe('pendingAction 清理与保存降级', () => {
  it('消费动作后删除 user-set.inputMethodHelper.pendingAction 并写回', async () => {
    installUtools();
    seedUserSet({
      _id: 'user-set',
      inputMethodHelper: {
        locked: true,
        pendingAction: { type: 'setLocked', payload: { locked: true }, at: Date.now(), source: 'input-method-helper' },
      },
    });

    const { openInputMethodHelper } = await loadModule();
    await openInputMethodHelper('en', 'qwerty', []);
    await vi.advanceTimersByTimeAsync(0);

    expect(dbState.updateCalls.length).toBe(1);
    expect(dbState.updateCalls[0].inputMethodHelper.pendingAction).toBeUndefined();
    expect(dbState.updateCalls[0].inputMethodHelper.locked).toBe(true);
  });

  it('写库失败只记录 error 日志，不向调用方抛错', async () => {
    installUtools();
    dbState.updateResult = false;
    seedUserSet({
      _id: 'user-set',
      inputMethodHelper: {
        pendingAction: { type: 'closeHelper', at: Date.now(), source: 'input-method-helper' },
      },
    });

    const { openInputMethodHelper } = await loadModule();
    const ok = await openInputMethodHelper('en', 'qwerty', []);
    await vi.advanceTimersByTimeAsync(0);

    expect(ok).toBe(true);
    expect(errorSpy).toHaveBeenCalledWith('[输入法键盘] 清理 pendingAction 失败');
  });
});

// ========== DB pendingAction 轮询 ==========
describe('DB pendingAction 轮询', () => {
  it('source 不是 input-method-helper 时不分发', async () => {
    installUtools();
    seedUserSet({
      _id: 'user-set',
      inputMethodHelper: {
        pendingAction: { type: 'closeHelper', at: Date.now(), source: 'focus-mode' },
      },
    });

    const { openInputMethodHelper, isInputMethodHelperOpen } = await loadModule();
    await openInputMethodHelper('en', 'qwerty', []);
    await vi.advanceTimersByTimeAsync(600);

    expect(isInputMethodHelperOpen()).toBe(true);
    expect(createdUtoolsWindows[0].close).not.toHaveBeenCalled();
  });

  it('超过 15s TTL 的残留动作不分发', async () => {
    installUtools();
    seedUserSet({
      _id: 'user-set',
      inputMethodHelper: {
        pendingAction: { type: 'closeHelper', at: Date.now() - 20000, source: 'input-method-helper' },
      },
    });

    const { openInputMethodHelper, isInputMethodHelperOpen } = await loadModule();
    await openInputMethodHelper('en', 'qwerty', []);
    await vi.advanceTimersByTimeAsync(600);

    expect(isInputMethodHelperOpen()).toBe(true);
    expect(createdUtoolsWindows[0].close).not.toHaveBeenCalled();
  });

  it('相同 at 的动作不重复分发（lastHandledAt 去重）', async () => {
    installUtools();
    const at = Date.now();
    seedUserSet({
      _id: 'user-set',
      inputMethodHelper: {
        pendingAction: { type: 'setLocked', payload: { locked: false }, at, source: 'input-method-helper' },
      },
    });

    const { openInputMethodHelper } = await loadModule();
    await openInputMethodHelper('en', 'qwerty', []);
    await vi.advanceTimersByTimeAsync(0);

    const win = createdUtoolsWindows[0];
    expect(win.setResizable).toHaveBeenCalledTimes(1);

    // 模拟子窗口旧快照回流同一动作
    dbState.docs[0].inputMethodHelper.pendingAction = {
      type: 'setLocked',
      payload: { locked: false },
      at,
      source: 'input-method-helper',
    };
    await vi.advanceTimersByTimeAsync(300);

    expect(win.setResizable).toHaveBeenCalledTimes(1);
  });

  it('setLocked(locked=false) 解锁：停止穿透 + 恢复可缩放', async () => {
    installUtools();
    seedUserSet({
      _id: 'user-set',
      inputMethodHelper: {
        pendingAction: { type: 'setLocked', payload: { locked: false }, at: Date.now(), source: 'input-method-helper' },
      },
    });

    const { openInputMethodHelper } = await loadModule();
    await openInputMethodHelper('en', 'qwerty', []);

    const win = createdUtoolsWindows[0];
    expect(win.setIgnoreMouseEvents).toHaveBeenCalledWith(false);
    expect(win.focus).toHaveBeenCalled();
    expect(win.setResizable).toHaveBeenCalledWith(true);
  });

  it('setAlwaysOnTop 未生效时按 80/220ms 重试', async () => {
    installUtools();
    windowAdapter.applyChildWindowAlwaysOnTop.mockReturnValue(false);
    seedUserSet({
      _id: 'user-set',
      inputMethodHelper: {
        alwaysOnTop: false,
        locked: false,
        pendingAction: { type: 'setAlwaysOnTop', payload: { alwaysOnTop: true }, at: Date.now(), source: 'input-method-helper' },
      },
    });

    const { openInputMethodHelper } = await loadModule();
    await openInputMethodHelper('en', 'qwerty', []);
    // 首次应用（立即）+ 80ms + 220ms 两次重试；500ms 初始应用尚未到点
    await vi.advanceTimersByTimeAsync(250);

    expect(windowAdapter.applyChildWindowAlwaysOnTop).toHaveBeenCalledTimes(3);
    expect(windowAdapter.applyChildWindowAlwaysOnTop.mock.calls.map((c: any[]) => c[1])).toEqual([true, true, true]);
  });
});

// ========== 错误路径 ==========
describe('错误路径', () => {
  it('uTools createBrowserWindow 同步抛错时透传给调用方（源码未捕获，记录现状）', async () => {
    installUtools(
      vi.fn(() => {
        throw new Error('create boom');
      }),
    );

    const { openInputMethodHelper } = await loadModule();
    await expect(openInputMethodHelper('en', 'qwerty', [])).rejects.toThrow('create boom');
  });

  it('setIgnoreMouseEvents 抛错只记录 error 日志，不中断流程', async () => {
    installUtools();
    const { openInputMethodHelper, isInputMethodHelperOpen } = await loadModule();
    await openInputMethodHelper('en', 'qwerty', []);

    const win = createdUtoolsWindows[0];
    win.setIgnoreMouseEvents.mockImplementation(() => {
      throw new Error('no access');
    });

    await vi.advanceTimersByTimeAsync(500);

    expect(errorSpy).toHaveBeenCalledWith('[输入法键盘] 切换鼠标穿透失败:', expect.any(Error));
    expect(isInputMethodHelperOpen()).toBe(true);
  });

  it('窗口缺少 setIgnoreMouseEvents 时只警告一次', async () => {
    installUtools();
    const { openInputMethodHelper } = await loadModule();
    await openInputMethodHelper('en', 'qwerty', []);

    const win = createdUtoolsWindows[0];
    delete win.setIgnoreMouseEvents;

    await vi.advanceTimersByTimeAsync(1500); // 覆盖多轮 50ms 穿透轮询
    const warns = warnSpy.mock.calls.filter(
      (c: any[]) => c[0] === '[输入法键盘] 窗口未暴露 setIgnoreMouseEvents，无法穿透',
    );
    expect(warns.length).toBe(1);
  });
});
