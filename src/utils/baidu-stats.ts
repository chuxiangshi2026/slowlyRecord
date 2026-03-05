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
 * 动态加载百度统计脚本
 * 从配置文件读取 AppKey
 * @returns Promise 脚本加载完成返回 true，失败返回 false
 */
function loadBaiduStatsScript(): Promise<boolean> {
  return new Promise((resolve) => {
    console.log('[百度统计] 配置信息:', BAIDU_STATS_CONFIG);
    if (!BAIDU_STATS_CONFIG.enabled) {
      console.log('[百度统计] enabled 为 false，跳过加载');
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
      resolve(true);
      return;
    }

    window._hmt = window._hmt || [];
    const hm = document.createElement('script');
    hm.async = true;
    hm.src = `https://hm.baidu.com/hm.js?${BAIDU_STATS_CONFIG.appKey}`;

    hm.onload = () => {
      console.log('[百度统计] 脚本加载完成');
      resolve(true);
    };

    hm.onerror = () => {
      console.error('[百度统计] 脚本加载失败');
      resolve(false);
    };

    const s = document.getElementsByTagName('script')[0];
    s.parentNode?.insertBefore(hm, s);
  });
}

/**
 * 追踪页面浏览
 * @param pageUrl 页面 URL（可选，默认当前页面）
 */
export function trackPageView(pageUrl?: string): void {
  if (!BAIDU_STATS_CONFIG.enabled || typeof window === 'undefined' || !window._hmt) {
    return;
  }

  if (pageUrl) {
    window._hmt.push(['_trackPageview', pageUrl]);
  } else {
    window._hmt.push(['_trackPageview']);
  }
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
  if (!BAIDU_STATS_CONFIG.enabled || typeof window === 'undefined' || !window._hmt) {
    return;
  }

  const eventData: any[] = ['_trackEvent', category, action];
  if (optLabel !== undefined) {
    eventData.push(optLabel);
  }
  if (optValue !== undefined) {
    eventData.push(optValue);
  }

  window._hmt.push(eventData);
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
  if (!BAIDU_STATS_CONFIG.enabled) {
    console.log('[百度统计] 当前环境未启用统计');
    return;
  }

  // 动态加载百度统计脚本
  const loaded = await loadBaiduStatsScript();

  if (loaded) {
    // 脚本加载完成后，延迟发送首页浏览统计
    setTimeout(() => {
      trackPageView();
      console.log('[百度统计] 已初始化并发送首页统计');
    }, 500);
  }
}
