/**
 * 百度移动统计工具模块
 * 用于封装百度统计的各种事件追踪功能
 */
import { BAIDU_STATS_CONFIG } from '@/config';

// 声明全局变量
declare global {
  interface Window {
    _hmt: any[];
  }
}

/**
 * 运行时检测是否应该启用统计
 * 在模块加载时 window 可能不可用，所以在运行时检测
 */
function shouldEnableStats(): boolean {
  if (typeof window === 'undefined') return false;

  const isUTools = !!(window as any).utools;
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
