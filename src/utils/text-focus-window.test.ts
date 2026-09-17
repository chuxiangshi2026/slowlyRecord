/**
 * @vitest-environment jsdom
 *
 * 文本专注窗口控制器：验证「返回列表」动作的消费链路。
 * 核心回归：子窗口自关前写入的 pendingAction，在窗口已销毁后的
 * 第一拍轮询仍会被消费（先消费再检查存活，对齐 Word.vue），
 * 且导航由控制器常驻负责，不依赖 TextMemory.vue 挂载。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { replaceMock, loadArticlesMock, putMock } = vi.hoisted(() => ({
  replaceMock: vi.fn().mockResolvedValue(undefined),
  loadArticlesMock: vi.fn().mockResolvedValue(undefined),
  putMock: vi.fn().mockReturnValue({ ok: true }),
}));

vi.mock('@/router', () => ({ default: { replace: replaceMock } }));
vi.mock('@/stores/textMemory', () => ({
  useTextMemoryStore: () => ({ loadArticles: loadArticlesMock }),
}));
vi.mock('@/adapters/platform', () => ({ isUtools: () => false }));
// user-set 文档由 getSetDb 返回，clearDbPendingAction 会原地删除 pendingAction
let userSetDoc: any;
vi.mock('@/utils/user-set-db-util', () => ({
  getSetDb: () => userSetDoc,
  // putSetDbWithRetry 经 db.promises.put 写入，mock 透传到 putMock
  putSetDbWithRetry: (doc: any) => {
    putMock(doc);
    return true;
  },
}));

vi.mock('@/adapters/db', () => ({
  getDbAdapter: () => ({
    get: () => null,
    allDocs: () => [],
    put: putMock,
    promises: { put: vi.fn().mockResolvedValue({ ok: true }) },
  }),
}));

import {
  setTextFocusWindow,
  consumeLatestTextFocusPendingAction,
} from '@/utils/text-focus-window';

function makePendingAction(source = 'text') {
  userSetDoc = {
    _id: 'user-set',
    focusMode: { pendingAction: { type: 'openTextMemory', at: Date.now(), source } },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  makePendingAction();
  // 置空窗口引用并停掉上一轮遗留轮询
  setTextFocusWindow(null);
});

describe('文本专注「返回列表」动作消费', () => {
  it('窗口已销毁时轮询第一拍仍消费动作（uTools 子窗口自关后 ~100ms 写入的动作不丢失）', () => {
    const destroyedWin = { isDestroyed: () => true, close: vi.fn() };
    // setTextFocusWindow 启动轮询时立即执行一拍 consumeDbPendingAction
    setTextFocusWindow(destroyedWin);

    expect(replaceMock).toHaveBeenCalledWith('/text-memory');
    expect(loadArticlesMock).toHaveBeenCalled();
    // 已销毁的窗口不再尝试 close
    expect(destroyedWin.close).not.toHaveBeenCalled();
  });

  it('窗口存活时关闭窗口并跳转文本记忆页', () => {
    const aliveWin = { isDestroyed: () => false, close: vi.fn() };
    setTextFocusWindow(aliveWin);
    consumeLatestTextFocusPendingAction();

    expect(aliveWin.close).toHaveBeenCalled();
    expect(replaceMock).toHaveBeenCalledWith('/text-memory');
    // 清理后动作不重复分发
    consumeLatestTextFocusPendingAction();
    expect(replaceMock).toHaveBeenCalledTimes(1);
    setTextFocusWindow(null);
  });

  it('单词模式动作（source=word）不接管、不清理', () => {
    makePendingAction('word');
    const aliveWin = { isDestroyed: () => false, close: vi.fn() };
    setTextFocusWindow(aliveWin);
    consumeLatestTextFocusPendingAction();

    expect(replaceMock).not.toHaveBeenCalled();
    expect(aliveWin.close).not.toHaveBeenCalled();
    // pendingAction 未被清理，留给 Word.vue 处理
    expect(userSetDoc.focusMode.pendingAction).toBeTruthy();
    setTextFocusWindow(null);
  });
});

describe('文本专注 settingsChanged 设置持久化', () => {
  it('设置写入 user-set.focusMode，且携带 locked 时联动鼠标穿透（子窗口单槽覆盖 setLocked 的兜底）', async () => {
    userSetDoc = {
      _id: 'user-set',
      focusMode: {
        opacity: 1,
        pendingAction: { type: 'settingsChanged', payload: { opacity: 0.5, locked: true }, at: Date.now(), source: 'text' },
      },
    };
    const aliveWin = {
      isDestroyed: () => false,
      close: vi.fn(),
      setIgnoreMouseEvents: vi.fn(),
      focus: vi.fn(),
      getBounds: () => ({ x: 0, y: 0, width: 100, height: 100 }),
    };
    setTextFocusWindow(aliveWin);
    consumeLatestTextFocusPendingAction();
    // putSetDbWithRetry 走 db.promises.put（异步），等微任务队列排空后断言
    await Promise.resolve();
    await Promise.resolve();

    // 设置被合并进 focusMode 并落库
    const lastPut = putMock.mock.calls[putMock.mock.calls.length - 1]?.[0];
    expect(lastPut.focusMode.opacity).toBe(0.5);
    expect(lastPut.focusMode.locked).toBe(true);
    expect(lastPut.focusMode.pendingAction).toBeUndefined();
    // locked 联动：锁定后内容区鼠标穿透
    expect(aliveWin.setIgnoreMouseEvents).toHaveBeenCalledWith(true, { forward: true });
    expect(replaceMock).not.toHaveBeenCalled();
    setTextFocusWindow(null);
  });
});
