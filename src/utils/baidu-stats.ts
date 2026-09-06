/**
 * 百度移动统计工具模块
 * 用于封装百度统计的各种事件追踪功能
 */
import { BAIDU_STATS_CONFIG, APP_VERSION } from '@/config';

// 声明全局变量
declare global {
  interface Window {
    _hmt: any[];
  }
}

/**
 * 自我排除标记的 localStorage 键：开发者本机执行
 *   localStorage.setItem('sr_stats_exclude', '1')
 * 后刷新即永久跳过上报（不受 IP 变动影响）；配合百度统计后台「排除 IP」双保险。
 */
const STATS_EXCLUDE_KEY = 'sr_stats_exclude';

/** 匿名安装 ID 的 localStorage 键（仅用于统计独立安装量，不关联任何账号信息） */
const INSTALL_ID_KEY = 'sr_install_id';

/**
 * 运行时检测是否应该启用统计
 * 在模块加载时 window 可能不可用，所以在运行时检测
 */
function shouldEnableStats(): boolean {
  if (typeof window === 'undefined') return false;

  // 开发者本机自我排除（优先于一切环境判断）
  try {
    if (window.localStorage?.getItem(STATS_EXCLUDE_KEY) === '1') return false;
  } catch { /* localStorage 不可用时忽略 */ }

  const isUTools = !!(window as any).utools;

  // uTools 开发环境（开发者工具接入运行）自动排除
  try {
    if (isUTools && (window as any).utools.isDev?.()) return false;
  } catch { /* 旧版本无 isDev 时忽略 */ }

  const isLocalhost = window.location.hostname === 'localhost' ||
                      window.location.hostname === '127.0.0.1';

  // uTools 环境：启用（打包后运行）
  // 非 localhost：启用（生产环境）
  // localhost：禁用（开发环境）
  const shouldEnable = isUTools || !isLocalhost;

  console.log('[百度统计] 环境检测:', {
    isUTools,
    hostname: window.location.hostname,
    isLocalhost,
    shouldEnable
  });

  return shouldEnable;
}

/**
 * 获取（或首次生成）匿名安装 ID
 * uTools 环境优先使用 utools.getNativeId()（设备 ID，重装插件/清 localStorage 不变），
 * 其他环境退化为 localStorage 随机 UUID（卸载/清除数据即重置）
 */
function getInstallId(): string {
  try {
    const utoolsApi = (window as any).utools;
    if (utoolsApi?.getNativeId) {
      const nativeId = utoolsApi.getNativeId();
      if (nativeId) return `dev_${nativeId}`.slice(0, 32);
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

/**
 * 上报应用启动维度：平台_版本（事件 label）与匿名安装 ID
 * 在统计脚本加载成功后调用一次
 */
function reportAppLaunch(): void {
  if (!shouldEnableStats() || !window._hmt) return;
  let platform = 'web';
  let clientVersion = '';
  try {
    // 动态 require 避免模块加载顺序问题
    platform = (window as any).utools ? 'utools'
      : (window as any).electronAPI ? 'electron'
      : 'web';
    if (platform === 'utools') {
      clientVersion = (window as any).utools.getAppVersion?.() || '';
    }
  } catch { /* 忽略 */ }
  const label = clientVersion ? `${platform}_${APP_VERSION}_u${clientVersion}` : `${platform}_${APP_VERSION}`;
  window._hmt.push(['_trackEvent', 'app', 'launch', label]);
  window._hmt.push(['_trackEvent', 'app', 'install', getInstallId()]);
  console.log('[百度统计] 上报启动维度:', platform, APP_VERSION);
}

/**
 * 动态加载百度统计脚本
 * 从配置文件读取 AppKey
 * @returns Promise 脚本加载完成返回 true，失败返回 false
 */
function loadBaiduStatsScript(): Promise<boolean> {
  return new Promise((resolve) => {
    const isEnabled = BAIDU_STATS_CONFIG.enabled && shouldEnableStats();

    console.log('[百度统计] 配置信息:', BAIDU_STATS_CONFIG);
    console.log('[百度统计] 当前环境:', {
      isUTools: typeof window !== 'undefined' && !!(window as any).utools,
      hostname: typeof window !== 'undefined' ? window.location.hostname : 'unknown',
      protocol: typeof window !== 'undefined' ? window.location.protocol : 'unknown',
      enabled: isEnabled
    });

    if (!isEnabled) {
      console.log('[百度统计] 当前环境未启用统计，跳过加载');
      resolve(false);
      return;
    }
    if (!BAIDU_STATS_CONFIG.appKey || BAIDU_STATS_CONFIG.appKey === 'YOUR_BAIDU_APP_KEY') {
      console.log('[百度统计] 未配置 AppKey，跳过加载');
      resolve(false);
      return;
    }

    // 避免重复加载
    if (document.querySelector('script[src*="hm.baidu.com"]')) {
      console.log('[百度统计] 脚本已存在，跳过加载');
      resolve(true);
      return;
    }

    // 初始化 _hmt 数组
    window._hmt = window._hmt || [];

    // 先发送一个测试事件，确保 _hmt 可用
    window._hmt.push(['_setAccount', BAIDU_STATS_CONFIG.appKey]);

    const hm = document.createElement('script');
    hm.async = true;
    hm.defer = true;
    hm.src = `https://hm.baidu.com/hm.js?${BAIDU_STATS_CONFIG.appKey}`;

    hm.onload = () => {
      console.log('[百度统计] 脚本加载完成，AppKey:', BAIDU_STATS_CONFIG.appKey);
      // 脚本加载后再次确认 _hmt 存在
      if (window._hmt) {
        console.log('[百度统计] _hmt 已就绪，当前队列:', window._hmt);
      }
      // 上报平台/版本/匿名安装 ID 维度，用于区分真实用户与自己的测试量
      reportAppLaunch();
      resolve(true);
    };

    hm.onerror = (err) => {
      console.error('[百度统计] 脚本加载失败:', err);
      resolve(false);
    };

    // 将脚本插入到 document.head 中，确保更早加载
    document.head.appendChild(hm);
  });
}

/**
 * 追踪页面浏览
 * @param pageUrl 页面 URL（可选，默认当前页面）
 */
export function trackPageView(pageUrl?: string): void {
  if (!shouldEnableStats() || typeof window === 'undefined') {
    console.log('[百度统计] 统计未启用或环境不支持');
    return;
  }

  // 确保 _hmt 存在
  if (!window._hmt) {
    window._hmt = [];
  }

  const trackData = pageUrl ? ['_trackPageview', pageUrl] : ['_trackPageview'];
  window._hmt.push(trackData);
  console.log('[百度统计] 追踪页面浏览:', trackData);
}

/**
 * 追踪自定义事件
 * @param category 事件类别
 * @param action 事件操作
 * @param optLabel 事件标签（可选）
 * @param optValue 事件值（可选）
 */
export function trackEvent(
  category: string,
  action: string,
  optLabel?: string,
  optValue?: number
): void {
  if (!shouldEnableStats() || typeof window === 'undefined') {
    return;
  }

  // 确保 _hmt 存在
  if (!window._hmt) {
    window._hmt = [];
  }

  const eventData: any[] = ['_trackEvent', category, action];
  if (optLabel !== undefined) {
    eventData.push(optLabel);
  }
  if (optValue !== undefined) {
    eventData.push(optValue);
  }

  window._hmt.push(eventData);
  console.log('[百度统计] 追踪事件:', eventData);
}

/**
 * 追踪翻译相关事件
 */
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

/**
 * 追踪用户行为事件
 */
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

/**
 * 功能模块使用事件（用于观察各功能的真实使用情况）
 */
export const FeatureEvents = {
  /** 打开专注模式（label 为模式：standard/spell/dictation/text 等） */
  focusOpen: (mode: string) => {
    trackEvent('feature', 'focus_open', mode || 'standard');
  },
  /** 听写练习 */
  dictation: (action: string) => {
    trackEvent('feature', 'dictation', action);
  },
  /** 通用功能使用入口 */
  use: (feature: string, action: string) => {
    trackEvent('feature', feature, action);
  }
};

/**
 * 在 Vue Router 中使用百度统计
 * 示例用法：
 * router.afterEach((to) => {
 *   trackRouterPageView(to.path);
 * });
 */
export function trackRouterPageView(path: string): void {
  // 等待页面渲染完成后再发送统计
  setTimeout(() => {
    trackPageView(path);
  }, 100);
}

/**
 * 初始化百度统计
 * 在应用启动时调用
 */
export async function initBaiduStats(): Promise<void> {
  console.log('[百度统计] 开始初始化...');

  if (!shouldEnableStats()) {
    console.log('[百度统计] 当前环境未启用统计，跳过初始化');
    return;
  }

  console.log('[百度统计] 统计已启用，准备加载脚本...');

  // 动态加载百度统计脚本
  const loaded = await loadBaiduStatsScript();

  if (loaded) {
    console.log('[百度统计] 脚本加载成功，准备发送首页统计...');
    // 脚本加载完成后，延迟发送首页浏览统计
    setTimeout(() => {
      trackPageView();
      console.log('[百度统计] 已初始化并发送首页统计');
    }, 1000);
  } else {
    console.log('[百度统计] 脚本加载失败或未加载');
  }
}
