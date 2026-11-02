/**
 * 使用统计模块（umami）
 *
 * 为什么不用百度统计：uTools/Electron 生产插件页是 file:// 协议（无域名、cookie 不可写），
 * 百度统计 hm.js 依赖页面域名与 cookie，file:// 下数据会被丢弃（实测实时访客始终为 0）。
 * umami 的 /api/send 是纯 fetch 上报，服务端用 IP+UA 哈希识别访客，不依赖 cookie/域名，
 * 且 ACAO:* 允许 null origin，file:// 页面可正常工作。
 *
 * 排除规则（优先级从高到低）：
 * - localStorage `sr_stats_force` = '1'：强制启用（开发自测用，umami 后台有实时视图）
 * - localStorage `sr_stats_exclude` = '1'：永久跳过上报（设置页「匿名使用统计」开关即写此键）
 * - uTools 开发环境（utools.isDev()）自动排除
 * - 非 uTools 的 localhost/127.0.0.1（vite dev）自动排除
 *
 * 另一个坑：uTools 插件页的 UA 含 "uTools"，umami 的爬虫过滤会把含 "tools" 的 UA 判成 bot——
 * 事件整条丢弃，却仍回 200 且正文是 {"beep":"boop"}，客户端完全无感。浏览器 fetch 的
 * User-Agent 是禁止头改不了，所以 uTools 下改走 preload 的 Node https（window.services.httpPostJson）。
 */
import { UMAMI_STATS_CONFIG, APP_VERSION } from '@/config';

/** 自我排除标记键（值为 '1' 时不上报；设置页开关写此键） */
const STATS_EXCLUDE_KEY = 'sr_stats_exclude';
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
export type StatsStatus = 'enabled' | 'excluded' | 'dev' | 'localhost' | 'no-config';

/** 当前统计状态及停用原因；判定顺序与上报路径一致（force 优先于一切排除规则） */
export function getStatsStatus(): StatsStatus {
  if (!UMAMI_STATS_CONFIG.websiteId) return 'no-config';
  if (typeof window === 'undefined') return 'no-config';
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

/** 平台标识（同时用作 umami 的 hostname 维度，后台可按平台过滤） */
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

interface UmamiPayload {
  website: string;
  hostname: string;
  url: string;
  name?: string;
  data?: Record<string, string | number>;
}

type PostResponse = { status: number; body: string };

/**
 * uTools 下经 preload 的 Node https 发送。
 * 原因：uTools 插件页 UA 含 "uTools"，umami 的爬虫过滤会把它判成 bot——事件整条丢弃，
 * 但响应仍是 200 且正文为 {"beep":"boop"}，客户端完全无感。浏览器 fetch 的 User-Agent
 * 是禁止头，改不了，所以只能换 Node 通道显式带普通 Chrome UA。
 */
function postViaNode(url: string, headers: Record<string, string>, body: string): Promise<PostResponse> | null {
  const post = (window as any).services?.httpPostJson;
  return typeof post === 'function' ? post(url, headers, body) : null;
}

/** 是否真正入账：被判为 bot 的请求回 200 但正文是 {"beep":"boop"}，不会落库 */
function isAccepted(status: number, body: string): boolean {
  return status >= 200 && status < 300 && !body.includes('beep');
}

/**
 * 发送一条 umami 事件（pageview = 无 name 的事件）
 * 永不抛异常：失败只记日志，返回是否真正入账（2xx 且未被爬虫过滤丢弃）。
 * 常规埋点忽略返回值（失败静默）；force=true 跳过启用判定，仅用于用户主动提交反馈这类显式动作
 */
function send(payload: Omit<UmamiPayload, 'website' | 'hostname'>, force = false): Promise<boolean> {
  if (!force && !shouldEnableStats()) return Promise.resolve(false);
  const websiteId = UMAMI_STATS_CONFIG.websiteId;
  if (!websiteId) return Promise.resolve(false);

  const platform = getPlatform();
  const hostname = `slowlyrecord.${platform}`;
  const body: { type: string; payload: UmamiPayload } = {
    type: 'event',
    payload: {
      website: websiteId,
      hostname,
      url: payload.url,
      ...(payload.name ? { name: payload.name } : {}),
      ...(payload.data ? { data: payload.data } : {}),
    },
  };

  const url = `${UMAMI_STATS_CONFIG.host}/api/send`;
  const headers = {
    'Content-Type': 'application/json',
    'x-umami-website-id': websiteId,
    'x-umami-hostname': hostname,
  };
  const bodyText = JSON.stringify(body);

  const viaNode = postViaNode(url, headers, bodyText);
  if (viaNode) {
    return viaNode.then(res => {
      const ok = isAccepted(res.status, res.body);
      if (!ok) console.warn('[统计] 上报未被收录:', res.status, res.body.slice(0, 120));
      return ok;
    }).catch(err => {
      console.warn('[统计] 上报失败:', err);
      return false;
    });
  }

  return fetch(url, {
    method: 'POST',
    headers,
    body: bodyText,
    keepalive: true,
  }).then(async res => {
    // 4xx 多为 websiteId 错误；200 + beep 是被爬虫过滤静默丢弃，两者都要能看见
    const text = await res.text().catch(() => '');
    const ok = isAccepted(res.status, text);
    if (!ok) console.warn('[统计] 上报未被收录:', res.status, text.slice(0, 120));
    return ok;
  }).catch(err => {
    console.warn('[统计] 上报失败:', err);
    return false;
  });
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

/** 上报启动事件：平台、插件版本、uTools 客户端版本与匿名安装 ID */
async function reportAppLaunch(): Promise<void> {
  const platform = getPlatform();
  let clientVersion = '';
  try {
    if (platform === 'utools') clientVersion = (window as any).utools.getAppVersion?.() || '';
  } catch { /* 忽略 */ }
  const appVersion = await getPluginVersion();
  const attribution = getAttribution();
  send({
    url: currentUrl(),
    name: 'app.launch',
    data: {
      platform,
      appVersion,
      clientVersion,
      installId: getInstallId(),
      ...(attribution ? { source: attribution.source, landingPage: attribution.page } : {}),
    },
  });
}

/**
 * 追踪页面浏览
 * @param pageUrl 页面路径（可选，默认当前路由）
 */
export function trackPageView(pageUrl?: string): void {
  send({ url: pageUrl || currentUrl() });
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
  send({
    url: currentUrl(),
    name: `${category}.${action}`,
    ...(Object.keys(data).length ? { data } : {}),
  });
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
  if (!UMAMI_STATS_CONFIG.websiteId) {
    console.warn('[统计] 未配置 umami websiteId，跳过上报');
    return;
  }
  await reportAppLaunch();
  // 首次来源单独成事件，便于在 umami 直接看各渠道落地量，不必解析 app.launch 的 data
  if (attribution) {
    send({
      url: currentUrl(),
      name: 'source.landing',
      data: { source: attribution.source, page: attribution.page },
    });
  }
}

// ===== 异常上报与手动反馈 =====

/** 本次会话已上报的异常（同源同消息只报一次，防止错误风暴刷量） */
const reportedErrors = new Set<string>();

/**
 * 上报 JS/Vue/未捕获 Promise 异常（事件名 bug.error）
 * 只带错误消息（截断 200 字符）、来源、平台与版本，不带堆栈，避免携带用户数据
 */
export async function trackError(source: 'vue' | 'js' | 'promise', error: unknown): Promise<void> {
  const msg = String(error instanceof Error ? error.message : error || 'unknown').slice(0, 200);
  const key = `${source}:${msg}`;
  if (reportedErrors.has(key)) return;
  reportedErrors.add(key);
  send({
    url: currentUrl(),
    name: 'bug.error',
    data: { source, message: msg, platform: getPlatform(), appVersion: await getPluginVersion() },
  });
}

/** 注册全局异常捕获（error / unhandledrejection）；Vue 渲染异常在 main.ts 经 app.config.errorHandler 接入。
 *  catch 兜底：上报自身出问题绝不产生新的未捕获异常（否则会被自己的监听器接住造成循环） */
export function initErrorTracking(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('error', (e) => {
    trackError('js', e.message).catch(() => {});
  });
  window.addEventListener('unhandledrejection', (e) => {
    trackError('promise', e.reason).catch(() => {});
  });
}

/**
 * 提交用户手动反馈（事件名 feedback.submit，后台 Events 里查看）
 * 用户主动动作，不受统计开关限制；文本截断 500 字符，联系方式可选
 * @returns 是否真正送达（空文本/未配置 websiteId/网络失败均返回 false，调用方据此提示重试）
 */
export async function submitFeedback(text: string, contact = ''): Promise<boolean> {
  const content = text.trim().slice(0, 500);
  if (!content || !UMAMI_STATS_CONFIG.websiteId) return false;
  const data: Record<string, string | number> = {
    text: content,
    platform: getPlatform(),
    appVersion: await getPluginVersion(),
    installId: getInstallId(),
  };
  const c = contact.trim().slice(0, 100);
  if (c) data.contact = c;
  return send({ url: currentUrl(), name: 'feedback.submit', data }, true);
}
