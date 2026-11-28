/**
 * 使用统计模块（自建采集端点）
 *
 * 链路：页面 fetch 直发 mp.slowrecap.cn/collect（自有服务器 collector，格式校验后写本机 JSONL，
 *       不再走 SCF/CLS 云日志）。不经过任何第三方统计平台。
 *
 * 为什么不用第三方统计：uTools/Electron 生产插件页是 file:// 协议（无域名、cookie 不可写），
 * 百度统计 hm.js 依赖页面域名与 cookie，file:// 下数据会被丢弃；umami 欧区网关国内不可达，
 * 且第三方统计平台涉及合规告知成本。自建端点字段自控、不记录 IP，叙事最简单。
 *
 * 合规约定：
 * - 默认开启（最小合规集）：仅上报操作计数（启动、页面浏览、添词等）、平台/版本/匿名安装 ID
 *   与错误指纹（类型+哈希，不含错误原文），不含词库内容与个人信息；设置页一键关闭立即停发，关闭选择持久化（opt-out 口径）
 * - 需要额外授权的数据单独开关：来源归因（推广渠道/落地页）默认关闭，用户显式开启才记录与上报
 * - 程序异常始终只记录在本机（sr_error_log 环形缓冲，调试面板可查看）；随统计开启仅上传错误指纹，原文永不离开设备
 * - 不伪造、不设置 User-Agent；端点固定为 config.ts 的 STATS_ENDPOINT
 * - 只发 JSON 事件：事件名/页面路径/平台/版本/匿名安装 ID/少量事件数据，不含用户词库内容
 */
import { STATS_ENDPOINT, APP_VERSION } from '@/config';

/** 关闭标记键（'1' = 用户已关闭；缺省即默认开启的最小合规口径） */
const STATS_OPTOUT_KEY = 'sr_stats_optout';
/** 强制启用标记键（开发自测用，优先于一切排除规则） */
const STATS_FORCE_KEY = 'sr_stats_force';
/** 匿名安装 ID 的 localStorage 键（仅用于统计独立安装量，不关联任何账号信息） */
const INSTALL_ID_KEY = 'sr_install_id';
/** 来源归因（额外授权）标记键：'1' = 允许记录与上报首次来源（默认关闭） */
const ATTRIBUTION_OPTIN_KEY = 'sr_attribution_optin';

function getFlag(key: string): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage?.getItem(key) === '1';
  } catch {
    return false;
  }
}

/**
 * 当前是否被用户关闭（设置页开关取反即用）。
 * 最小合规口径：默认开启，仅当存在 sr_stats_optout 关闭标记时停发；
 * 旧版显式关闭（user-set statsExcluded===true）经 applyPersistedStatsPrefs 恢复后同样命中此标记。
 */
export function isStatsExcluded(): boolean {
  return getFlag(STATS_OPTOUT_KEY);
}

/**
 * 设置统计开关（设置页「匿名使用统计」开关调用；立即生效，无需重启）。
 * 关闭 = 写 sr_stats_optout 标记；开启 = 清除标记（恢复默认开启）。
 */
export function setStatsExcluded(excluded: boolean): void {
  try {
    if (excluded) window.localStorage?.setItem(STATS_OPTOUT_KEY, '1');
    else window.localStorage?.removeItem(STATS_OPTOUT_KEY);
  } catch { /* localStorage 不可用时忽略 */ }
  // 持久化到 user-set：uTools 插件更新可能清空 localStorage，用户的关闭选择不能因此丢失；
  // statsOptedIn 继续同步写以兼容旧版本读取侧（旧读侧按 statsExcluded===false 判定显式开启）
  void import('@/utils/user-set-db-util')
    .then(({ upsertSetDbFields }) => upsertSetDbFields({ statsExcluded: excluded, statsOptedIn: !excluded }))
    .catch(() => { /* DB 未就绪时仅 localStorage 生效 */ });
}

/**
 * 把 user-set 中持久化的统计偏好同步回 localStorage（插件更新清空 localStorage 后恢复用户选择）。
 * 在启动读取 user-set 后调用。
 * 迁移规则：旧版默认关闭口径下 statsExcluded===true 表示用户显式关闭（保持关闭）；
 * false/undefined 均按新口径默认开启处理（undefined = 旧版从未选择）。
 */
export function applyPersistedStatsPrefs(prefs: { excluded?: boolean; attribution?: boolean }): void {
  try {
    if (prefs.excluded === true) window.localStorage?.setItem(STATS_OPTOUT_KEY, '1');
    else window.localStorage?.removeItem(STATS_OPTOUT_KEY);
    if (prefs.attribution === true) window.localStorage?.setItem(ATTRIBUTION_OPTIN_KEY, '1');
    else window.localStorage?.removeItem(ATTRIBUTION_OPTIN_KEY);
  } catch { /* localStorage 不可用时忽略 */ }
}

/** 来源归因是否开启（额外授权项，默认关闭） */
export function isAttributionEnabled(): boolean {
  return getFlag(ATTRIBUTION_OPTIN_KEY);
}

/** 设置来源归因开关（设置页调用；立即生效） */
export function setAttributionEnabled(enabled: boolean): void {
  try {
    if (enabled) window.localStorage?.setItem(ATTRIBUTION_OPTIN_KEY, '1');
    else window.localStorage?.removeItem(ATTRIBUTION_OPTIN_KEY);
  } catch { /* localStorage 不可用时忽略 */ }
  void import('@/utils/user-set-db-util')
    .then(({ upsertSetDbFields }) => upsertSetDbFields({ attributionEnabled: enabled }))
    .catch(() => { /* DB 未就绪时仅 localStorage 生效 */ });
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

/**
 * 当前统计状态及停用原因；判定顺序与上报路径一致（force 优先于一切排除规则）。
 * 'excluded' 表示用户已主动关闭（默认开启口径下无「未开启」态）
 */
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
 * 只在首次使用时于本机生成一次随机 UUID 存 localStorage（卸载/清除数据即重置），
 * 不读取宿主环境的任何设备级标识
 */
function getInstallId(): string {
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

/** 上报前收敛页面路径：剥掉查询串与 hash 片段，避免把划词/翻译原文等 query 参数带进日志 */
function sanitizePageUrl(url: string): string {
  return (url || '/').split(/[?#]/)[0] || '/';
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
      url: sanitizePageUrl(url),
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

/** 读取已记录的首次来源；未开启归因（额外授权项）、没有或数据损坏时返回 null */
export function getAttribution(): Attribution | null {
  if (typeof window === 'undefined') return null;
  if (!isAttributionEnabled()) return null;
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
 * 额外授权项：用户未开启「来源归因」开关时不记录、不上报。
 * @returns 当前生效的首次来源
 */
export function initAttribution(): Attribution | null {
  if (typeof window === 'undefined') return null;
  if (!isAttributionEnabled()) return null;
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
  // 归因受自身授权开关约束：未开启来源归因时 initAttribution 返回 null，不记录不上报
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

/** 错误消息脱敏：去掉 URL 与接口 JSON 回显、只保留首行，避免带出翻译/OCR 的原文或响应体 */
function sanitizeErrorMessage(raw: string): string {
  const cleaned = raw
    .replace(/https?:\/\/\S+/gi, '[url]')
    .split(/[\n{]/)[0]
    .trim();
  return (cleaned || 'unknown').slice(0, 200);
}

/** 错误指纹：稳定哈希（djb2），同消息同指纹。仅用于聚合错误波次，原文永不离开设备 */
function errorFingerprint(msg: string): string {
  let h = 5381;
  for (let i = 0; i < msg.length; i++) h = ((h << 5) + h + msg.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

// ===== 本地错误日志（始终记录，不上传） =====

/** 本地错误日志键：环形缓冲，调试面板（Ctrl+Shift+D）可查看与复制 */
const LOCAL_ERROR_KEY = 'sr_error_log';
const LOCAL_ERROR_CAP = 50;

export interface LocalErrorEntry {
  ts: number;
  source: string;
  message: string;
  page: string;
}

function readLocalErrors(): LocalErrorEntry[] {
  try {
    const parsed = JSON.parse(window.localStorage?.getItem(LOCAL_ERROR_KEY) || '[]') as LocalErrorEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** 读取本机记录的最近错误（新在前，最多 50 条；纯本地，从不自动上传） */
export function getLocalErrors(): LocalErrorEntry[] {
  if (typeof window === 'undefined') return [];
  return readLocalErrors();
}

/** 清空本机错误日志 */
export function clearLocalErrors(): void {
  try {
    window.localStorage?.removeItem(LOCAL_ERROR_KEY);
  } catch { /* ignore */ }
}

function recordLocalError(source: string, message: string, page: string): void {
  try {
    const list = readLocalErrors();
    list.unshift({ ts: Date.now(), source, message, page });
    window.localStorage?.setItem(LOCAL_ERROR_KEY, JSON.stringify(list.slice(0, LOCAL_ERROR_CAP)));
  } catch { /* localStorage 不可用（隐私模式/配额满）时放弃本地记录 */ }
}

/**
 * 记录 JS/Vue/未捕获 Promise 异常（事件名 bug.error）——苹果诊断模式：
 * 本地错误日志始终记录完整脱敏消息（纯本机、无授权要求，调试面板可查看与复制）；
 * 上传仅在统计开启时发生（send 内部判定），且只带错误指纹（类型+稳定哈希）与来源/版本/运行时，
 * 不带消息原文、不带堆栈——报错文本可能嵌入用户数据（如 undefined 属性名恰为用户输入），
 * 原文留存本地，出网内容不含任何问题详情。
 */
export async function trackError(source: 'vue' | 'js' | 'promise', error: unknown, pageUrl?: string): Promise<void> {
  const msg = sanitizeErrorMessage(String(error instanceof Error ? error.message : error || 'unknown'));
  const key = `${source}:${msg}`;
  if (reportedErrors.has(key)) return;
  reportedErrors.add(key);
  const page = pageUrl || currentUrl();
  recordLocalError(source, msg, page);
  send('bug.error', page, {
    source,
    errorHash: errorFingerprint(msg),
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
