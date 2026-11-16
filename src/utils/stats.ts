/**
 * 使用统计模块（自建采集端点）
 *
 * 链路：页面 fetch 直发 → 腾讯云函数（只校验格式后写一行日志）→ CLS 日志服务
 *       → 本地 scripts/pull-stats-logs.mjs 定期拉取分析。不经过任何第三方统计平台。
 *
 * 为什么不用第三方统计：uTools/Electron 生产插件页是 file:// 协议（无域名、cookie 不可写），
 * 百度统计 hm.js 依赖页面域名与 cookie，file:// 下数据会被丢弃；umami 欧区网关国内不可达，
 * 且第三方统计平台涉及合规告知成本。自建端点字段自控、不记录 IP，叙事最简单。
 *
 * 排除规则（优先级从高到低）：
 * - localStorage `sr_stats_force` = '1'：强制启用（开发自测用）
 * - localStorage `sr_stats_exclude` = '1'：永久跳过上报（设置页「匿名使用统计」开关即写此键）
 * - uTools 开发环境（utools.isDev()）自动排除
 * - 非 uTools 的 localhost/127.0.0.1（vite dev）自动排除
 *
 * 合规约定：
 * - 默认开启，但首次启动会明确告知上报内容并提供关闭入口（设置页开关）
 * - 不伪造、不设置 User-Agent；端点固定为 config.ts 的 STATS_ENDPOINT
 * - 只发 JSON 事件：事件名/页面路径/平台/版本/匿名安装 ID/少量事件数据，不含用户词库内容
 */
import { STATS_ENDPOINT, APP_VERSION } from '@/config';

/** 自我排除标记键（值为 '1' 时不上报；设置页开关写此键，并在 user-set 持久化） */
const STATS_EXCLUDE_KEY = 'sr_stats_exclude';
/** 首次启动告知弹窗已展示标记键（同时持久化到 user-set，插件更新清空 localStorage 后不重弹） */
export const STATS_NOTICE_KEY = 'sr_stats_notice_v1';
/** 强制启用标记键（开发自测用，优先于一切排除规则） */
const STATS_FORCE_KEY = 'sr_stats_force';
/** 匿名安装 ID 的 localStorage 键（仅用于统计独立安装量，不关联任何账号信息） */
const INSTALL_ID_KEY = 'sr_install_id';

function getFlag(key: string): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage?.getItem(key) === '1';
  } catch {
    return false;
  }
}

/** 当前是否已排除统计（设置页开关的显示值取反即用） */
export function isStatsExcluded(): boolean {
  return getFlag(STATS_EXCLUDE_KEY);
}

/** 设置统计排除标记（设置页「匿名使用统计」开关调用；立即生效，无需重启） */
export function setStatsExcluded(excluded: boolean): void {
  try {
    if (excluded) window.localStorage?.setItem(STATS_EXCLUDE_KEY, '1');
    else window.localStorage?.removeItem(STATS_EXCLUDE_KEY);
  } catch { /* localStorage 不可用时忽略 */ }
  // 持久化到 user-set：uTools 插件更新可能清空 localStorage，用户的选择不能因此丢失
  void import('@/utils/user-set-db-util')
    .then(({ upsertSetDbFields }) => upsertSetDbFields({ statsExcluded: excluded }))
    .catch(() => { /* DB 未就绪时仅 localStorage 生效 */ });
}

/**
 * 把 user-set 中持久化的统计偏好同步回 localStorage（插件更新清空 localStorage 后恢复用户选择）。
 * 在启动读取 user-set 后调用。
 */
export function applyPersistedStatsPrefs(prefs: { excluded?: boolean; noticeShown?: boolean }): void {
  try {
    if (prefs.excluded === true) window.localStorage?.setItem(STATS_EXCLUDE_KEY, '1');
    else if (prefs.excluded === false) window.localStorage?.removeItem(STATS_EXCLUDE_KEY);
    if (prefs.noticeShown) window.localStorage?.setItem(STATS_NOTICE_KEY, '1');
  } catch { /* localStorage 不可用时忽略 */ }
}

/** 运行时检测是否应该启用统计（模块加载时 window 可能不可用，故每次调用时检测） */
function shouldEnableStats(): boolean {
  if (typeof window === 'undefined') return false;
  if (getFlag(STATS_FORCE_KEY)) return true;
  if (isStatsExcluded()) return false;

  const isUTools = !!(window as any).utools;
  try {
    if (isUTools && (window as any).utools.isDev?.()) return false;
  } catch { /* 旧版本无 isDev 时忽略 */ }

  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  // uTools 环境或非 localhost（file:// 协议 hostname 为空串）：启用
  return isUTools || !isLocalhost;
}

/** 统计状态：上报中 / 各停用原因（设置页状态行展示用，生产环境无控制台时的排障入口） */
export type StatsStatus = 'enabled' | 'excluded' | 'dev' | 'localhost' | 'no-endpoint';

/** 当前统计状态及停用原因；判定顺序与上报路径一致（force 优先于一切排除规则） */
export function getStatsStatus(): StatsStatus {
  if (!STATS_ENDPOINT) return 'no-endpoint';
  if (typeof window === 'undefined') return 'no-endpoint';
  if (getFlag(STATS_FORCE_KEY)) return 'enabled';
  if (isStatsExcluded()) return 'excluded';

  const isUTools = !!(window as any).utools;
  try {
    if (isUTools && (window as any).utools.isDev?.()) return 'dev';
  } catch { /* 忽略 */ }

  const hostname = window.location.hostname;
  if (!isUTools && (hostname === 'localhost' || hostname === '127.0.0.1')) return 'localhost';
  return 'enabled';
}

/**
 * 获取（或首次生成）匿名安装 ID
 * uTools 环境优先用 utools.getNativeId()（设备 ID，重装插件/清 localStorage 不变），
 * 其他环境退化为 localStorage 随机 UUID（卸载/清除数据即重置）
 */
function getInstallId(): string {
  try {
    const utoolsApi = (window as any).utools;
    if (utoolsApi?.getNativeId) {
      const nativeId = utoolsApi.getNativeId();
      if (nativeId) return nativeId.slice(0, 32);
    }
  } catch { /* 忽略，回退到随机 UUID */ }
  try {
    let id = window.localStorage?.getItem(INSTALL_ID_KEY);
    if (!id) {
      id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`).slice(0, 16);
      window.localStorage?.setItem(INSTALL_ID_KEY, id);
    }
    return id;
  } catch {
    return 'unknown';
  }
}

/** 平台标识（事件公共字段，聚合时按平台过滤） */
function getPlatform(): 'utools' | 'electron' | 'web' {
  return (window as any).utools ? 'utools' : (window as any).electronAPI ? 'electron' : 'web';
}

/**
 * 读取插件版本：优先取构建产物根目录 plugin.json 的 version（uTools 构建含此文件，
 * 发版前只需改 public/plugin.json 一处）；file:// 下 fetch 失败或无此文件时回退编译期常量。
 * 会话内缓存（版本运行期不变），避免每次异常/反馈上报都重复读文件
 */
let pluginVersionCache: Promise<string> | null = null;
function getPluginVersion(): Promise<string> {
  if (!pluginVersionCache) {
    pluginVersionCache = (async () => {
      try {
        const res = await fetch('plugin.json');
        if (res.ok) {
          const json = await res.json();
          if (json?.version) return json.version;
        }
      } catch { /* file:// 协议下 fetch 必败，走兜底 */ }
      return APP_VERSION;
    })();
  }
  return pluginVersionCache;
}

/** 事件信封：公共字段在客户端一次带齐，服务端只做格式校验后原样落日志 */
interface StatsEvent {
  /** 事件名（<类别>.<操作>）；页面浏览固定为 page.view */
  name: string;
  /** 页面路径（hash 路由） */
  url: string;
  platform: 'utools' | 'electron' | 'web';
  appVersion: string;
  installId: string;
  /** 客户端毫秒时间戳（服务端另有接收时间，双向便于发现时钟漂移） */
  ts: number;
  data?: Record<string, string | number>;
}

/**
 * 发送一条统计事件到自建采集端点（纯 fetch，file:// 插件页可用，无需 preload 通道）。
 * 永不抛异常：失败只记日志，返回是否送达（2xx）。
 * 常规埋点忽略返回值（失败静默）；force=true 跳过启用判定，仅用于用户主动提交反馈这类显式动作
 */
function send(name: string, url: string, data?: Record<string, string | number>, force = false): Promise<boolean> {
  if (!force && !shouldEnableStats()) return Promise.resolve(false);
  if (!STATS_ENDPOINT) return Promise.resolve(false);

  return (async () => {
    const event: StatsEvent = {
      name,
      url,
      platform: getPlatform(),
      appVersion: await getPluginVersion(),
      installId: getInstallId(),
      ts: Date.now(),
      ...(data && Object.keys(data).length ? { data } : {}),
    };
    return fetch(STATS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
      keepalive: true,
    }).then(res => {
      if (!res.ok) console.warn('[统计] 上报未被收录:', res.status);
      return res.ok;
    }).catch(err => {
      console.warn('[统计] 上报失败:', err);
      return false;
    });
  })();
}

/** 当前路由路径（hash 路由取 hash，否则取 pathname），供事件附带页面维度 */
function currentUrl(): string {
  // 非浏览器上下文（测试/后台任务）没有 window：直接退化，避免埋点把业务逻辑带崩
  if (typeof window === 'undefined') return '/';
  return (window.location.hash || window.location.pathname || '/').replace(/^#/, '') || '/';
}

// ===== 首次来源归因（SEO / 分享链接） =====
//
// 静态页 CTA 形如 /?from=seo&page=cet4#/word?...：来源参数在 hash 之前，
// 而 currentUrl() 只读 hash，单靠页面浏览会丢失归因，故单独落本地首次来源。

const ATTRIBUTION_KEY = 'sr_first_attribution';

export interface Attribution {
  source: string;
  page: string;
  at: number;
}

const SLUG_RE = /^[a-zA-Z0-9_-]{1,32}$/;

/** 读取已记录的首次来源；没有或数据损坏时返回 null */
export function getAttribution(): Attribution | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage?.getItem(ATTRIBUTION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Attribution;
    if (!SLUG_RE.test(parsed?.source || '')) return null;
    return {
      source: parsed.source,
      page: SLUG_RE.test(parsed.page || '') ? parsed.page : '',
      at: Number(parsed.at) || 0,
    };
  } catch {
    return null;
  }
}

/**
 * 从落地 URL 记录首次来源（只记第一次，后续不覆盖）。
 * @returns 当前生效的首次来源
 */
export function initAttribution(): Attribution | null {
  if (typeof window === 'undefined') return null;
  const existing = getAttribution();
  if (existing) return existing;

  let params: URLSearchParams;
  try {
    params = new URLSearchParams(window.location.search || '');
  } catch {
    return null;
  }
  const source = (params.get('utm_source') || params.get('from') || '').trim();
  const page = (params.get('page') || '').trim();
  if (!SLUG_RE.test(source)) return null;

  const attribution: Attribution = {
    source,
    page: SLUG_RE.test(page) ? page : '',
    at: Date.now(),
  };
  try {
    window.localStorage?.setItem(ATTRIBUTION_KEY, JSON.stringify(attribution));
  } catch { /* localStorage 不可用时本次会话仍可上报，只是不持久化 */ }
  return attribution;
}

/** 读取 uTools 客户端版本，启动事件与异常上报共用 */
function getClientVersion(): string {
  if (getPlatform() !== 'utools') return '';
  try {
    return (window as any).utools.getAppVersion?.() || '';
  } catch {
    return '';
  }
}

/** 上报启动事件：平台、插件版本、uTools 客户端版本与匿名安装 ID */
async function reportAppLaunch(): Promise<void> {
  const attribution = getAttribution();
  send('app.launch', currentUrl(), {
    clientVersion: getClientVersion(),
    ...(attribution ? { source: attribution.source, landingPage: attribution.page } : {}),
  });
}

/**
 * 追踪页面浏览
 * @param pageUrl 页面路径（可选，默认当前路由）
 */
export function trackPageView(pageUrl?: string): void {
  send('page.view', pageUrl || currentUrl());
}

/**
 * 追踪自定义事件（事件名格式 <类别>.<操作>，如 word.add；label/value 作为事件数据）
 */
export function trackEvent(
  category: string,
  action: string,
  optLabel?: string,
  optValue?: number
): void {
  const data: Record<string, string | number> = {};
  if (optLabel !== undefined) data.label = optLabel;
  if (optValue !== undefined) data.value = optValue;
  send(`${category}.${action}`, currentUrl(), Object.keys(data).length ? data : undefined);
}

/** 追踪翻译相关事件 */
export const TranslationEvents = {
  /** 翻译请求 */
  translate: (platform: string, sourceLang: string, targetLang: string) => {
    trackEvent('translation', 'translate', `${platform}_${sourceLang}_${targetLang}`);
  },
  /** OCR 识别 */
  ocr: (platform: string) => {
    trackEvent('ocr', 'recognize', platform);
  },
  /** 批量翻译 */
  batchTranslate: (count: number) => {
    trackEvent('translation', 'batch', `count_${count}`);
  },
  /** 切换翻译平台 */
  switchPlatform: (platform: string) => {
    trackEvent('translation', 'switch_platform', platform);
  }
};

/** 追踪用户行为事件 */
export const UserActionEvents = {
  /** 添加单词 */
  addWord: () => {
    trackEvent('word', 'add');
  },
  /** 删除单词 */
  deleteWord: () => {
    trackEvent('word', 'delete');
  },
  /** 导出数据 */
  exportData: (format: string) => {
    trackEvent('data', 'export', format);
  },
  /** 导入数据 */
  importData: (format: string) => {
    trackEvent('data', 'import', format);
  },
  /** 打开设置 */
  openSettings: () => {
    trackEvent('settings', 'open');
  },
  /** 修改设置 */
  changeSettings: (settingName: string) => {
    trackEvent('settings', 'change', settingName);
  }
};

/** 功能模块使用事件（用于观察各功能的真实使用情况） */
export const FeatureEvents = {
  /** 打开专注模式（label 为模式：standard/spell/dictation/text 等） */
  focusOpen: (mode: string) => {
    trackEvent('feature', 'focus_open', mode || 'standard');
  },
  /** 拼写练习 */
  dictation: (action: string) => {
    trackEvent('feature', 'dictation', action);
  },
  /** 通用功能使用入口 */
  use: (feature: string, action: string) => {
    trackEvent('feature', feature, action);
  }
};

/** 路由切换时追踪页面浏览（等待渲染完成后发送） */
export function trackRouterPageView(path: string): void {
  setTimeout(() => {
    trackPageView(path);
  }, 100);
}

/** 初始化统计：启动事件 + 首次来源。应用启动时调用一次
 *  首页浏览不在这里发：router.afterEach 对首次导航同样触发，这里再发会重复记一条 */
export async function initStats(): Promise<void> {
  // 归因先于启用判定落库：用户本次关闭统计、日后开启时，首次来源仍可回溯
  const attribution = initAttribution();
  if (!shouldEnableStats()) {
    console.log('[统计] 当前环境未启用统计，跳过初始化');
    return;
  }
  if (!STATS_ENDPOINT) {
    console.warn('[统计] 未配置采集端点 STATS_ENDPOINT，跳过上报');
    return;
  }
  await reportAppLaunch();
  // 首次来源单独成事件，便于直接按渠道聚合落地量，不必解析 app.launch 的 data
  if (attribution) {
    send('source.landing', currentUrl(), { source: attribution.source, page: attribution.page });
  }
}

// ===== 异常上报与手动反馈 =====

/** 本次会话已上报的异常（同源同消息只报一次，防止错误风暴刷量） */
const reportedErrors = new Set<string>();

/** 当前浏览器/Chromium 版本，只用于判断运行时兼容性 */
function getRuntimeVersion(): string {
  if (typeof navigator === 'undefined') return '';
  const match = navigator.userAgent?.match(/(?:Chrome|Chromium)\/([\d.]+)/i);
  return match?.[1] || '';
}

/**
 * 上报 JS/Vue/未捕获 Promise 异常（事件名 bug.error）
 * 只带错误消息（截断 200 字符）、来源、平台、版本与非敏感运行时信息，不带堆栈，避免携带用户数据
 */
export async function trackError(source: 'vue' | 'js' | 'promise', error: unknown, pageUrl?: string): Promise<void> {
  const msg = String(error instanceof Error ? error.message : error || 'unknown').slice(0, 200);
  const key = `${source}:${msg}`;
  if (reportedErrors.has(key)) return;
  reportedErrors.add(key);
  send('bug.error', pageUrl || currentUrl(), {
    source,
    message: msg,
    clientVersion: getClientVersion(),
    runtime: getRuntimeVersion(),
    errorName: error instanceof Error ? error.name : error == null ? 'UnknownError' : typeof error,
  });
}

/** 注册全局异常捕获（error / unhandledrejection）；Vue 渲染异常在 main.ts 经 app.config.errorHandler 接入。
 *  catch 兜底：上报自身出问题绝不产生新的未捕获异常（否则会被自己的监听器接住造成循环） */
export function initErrorTracking(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('error', (e) => {
    trackError('js', e.error || e.message).catch(() => {});
  });
  window.addEventListener('unhandledrejection', (e) => {
    trackError('promise', e.reason).catch(() => {});
  });
}

/**
 * 提交用户手动反馈（事件名 feedback.submit，经同一采集端点落入日志）
 * 用户主动动作，不受统计开关限制；文本截断 500 字符，联系方式可选
 * @returns 是否送达（空文本/未配置端点/网络失败均返回 false，调用方据此提示重试）
 */
export async function submitFeedback(text: string, contact = ''): Promise<boolean> {
  const content = text.trim().slice(0, 500);
  if (!content || !STATS_ENDPOINT) return false;
  const data: Record<string, string | number> = { text: content };
  const c = contact.trim().slice(0, 100);
  if (c) data.contact = c;
  return send('feedback.submit', currentUrl(), data, true);
}
