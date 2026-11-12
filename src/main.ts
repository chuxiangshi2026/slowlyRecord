// import './assets/main.css'
// 引入 Element Plus 暗黑主题
import 'element-plus/theme-chalk/dark/css-vars.css'
// 引入图标
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
// element国际化支持（locale 经 <el-config-provider> 提供，见 App.vue）
import zhCn from 'element-plus/es/locale/lang/zh-cn'
// 命令式组件（ElMessage/ElMessageBox/ElLoading）非模板组件，按需插件不注入其样式，这里集中引一次
import 'element-plus/es/components/message/style/css'
import 'element-plus/es/components/message-box/style/css'
import 'element-plus/es/components/loading/style/css'


import {createApp} from 'vue'

import App from './App.vue'
import router from './router'

import {createPinia} from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate';
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'
import VueVirtualScroller from 'vue-virtual-scroller'
import { initStats, trackRouterPageView, trackError, initErrorTracking } from '@/utils/stats'
import { registerScheduleTriggerHandler } from '@/utils/schedule-reminder'
import { useWordsStore } from '@/stores/words'
import {getDbAdapterAsync} from '@/adapters/db'
import {getPlatform} from '@/adapters/platform'
import {invalidateAppBgImageCache} from '@/utils/app-bg-db'

const app = createApp(App)

// ===== uTools 主题适配 =====
/**
 * 应用 uTools 主题
 * @param isDark 是否为暗黑主题
 */
function applyUToolsTheme(isDark: boolean) {
  const html = document.documentElement;
  if (isDark) {
    html.classList.add('utools-dark');
    html.classList.add('dark');
  } else {
    html.classList.remove('utools-dark');
    html.classList.remove('dark');
  }
}

/**
 * 初始化 uTools 主题监听
 */
function initUToolsTheme() {
  // 检查是否在 uTools 环境中
  const utoolsApi = (window as any).utools;
  if (utoolsApi && utoolsApi.onThemeChange) {
    // 应用初始主题 (uTools 会自动添加 utools-dark 类到 body)
    // 我们通过监听 body 的 class 变化来同步主题
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          const body = document.body;
          const isDark = body.classList.contains('utools-dark');
          applyUToolsTheme(isDark);
        }
      });
    });
    
    // 开始监听 body 的 class 变化
    if (document.body) {
      observer.observe(document.body, { attributes: true });
      // 初始检查
      const isDark = document.body.classList.contains('utools-dark');
      applyUToolsTheme(isDark);
    } else {
      // body 可能还未加载，等待加载完成
      window.addEventListener('DOMContentLoaded', () => {
        if (document.body) {
          observer.observe(document.body, { attributes: true });
          const isDark = document.body.classList.contains('utools-dark');
          applyUToolsTheme(isDark);
        }
      });
    }
    
    // 同时注册 uTools 主题变化回调（作为备用）
    try {
      utoolsApi.onThemeChange((type: 'light' | 'dark' | 'auto') => {
        const isDarkMode = type === 'dark' || 
          (type === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        applyUToolsTheme(isDarkMode);
      });
    } catch (e) {
      console.log('utools.onThemeChange not available, using MutationObserver');
    }
  } else {
    // 非 uTools 环境，使用系统主题
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    applyUToolsTheme(mediaQuery.matches);
    
    mediaQuery.addEventListener('change', (e) => {
      applyUToolsTheme(e.matches);
    });
  }
}

// 初始化主题
initUToolsTheme();

// 添加图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
    app.component(key, component)
}
let pinia = createPinia();
pinia.use(piniaPluginPersistedstate);
app.use(pinia)
app.use(router)
app.use(VueVirtualScroller)

// 初始化使用统计（umami，file:// 插件页可用）
initStats().catch((err) => {
  console.error('[App] 统计初始化失败:', err);
});

// 全局异常捕获 → umami bug.error 事件（去重、截断，不含用户数据；跟随统计开关）
// catch 兜底：上报自身异常绝不外抛，避免被自己的全局监听器接住形成循环
app.config.errorHandler = (err) => {
  trackError('vue', err).catch(() => {});
};
initErrorTracking();

// uTools 8.0+ 定时任务触发回调（定时复习/防断签提醒）：
// 触发时插件可能未运行、由 Runtime 冷启动唤起，必须尽早注册；
// 低版本无 API 时内部静默跳过
registerScheduleTriggerHandler();

// uTools 账号同步：其他设备的数据经云端拉取到本机后，刷新内存中的词列表与词集（避免陈旧数据窗口）。
// 非 uTools 环境无此 API，feature-detect 自然跳过；store 在回调触发时 Pinia 已就绪
{
  const utoolsApi = (window as any).utools;
  if (typeof utoolsApi?.onDbPull === 'function') {
    utoolsApi.onDbPull(() => {
      // 背景图进程内缓存同步失效并重应用（其他设备可能改了/删了自定义图）
      invalidateAppBgImageCache();
      void useWordsStore().applyAppBg();
      useWordsStore().listWords().catch((e: unknown) => console.error('[数据同步] 拉取后刷新词列表失败:', e));
      void import('@/stores/wordBook')
        .then(({ useWordBookStore }) => useWordBookStore().loadAll(true))
        .catch((e: unknown) => console.error('[数据同步] 拉取后刷新词集失败:', e));
    });
  }
  window.addEventListener('sr-wordbook-restored', () => {
    void import('@/stores/wordBook')
      .then(({ useWordBookStore }) => useWordBookStore().loadAll(true))
      .catch((e: unknown) => console.error('[数据同步] 还原后刷新词集失败:', e));
  });
}

// 路由切换时追踪页面浏览
router.afterEach((to) => {
    trackRouterPageView(to.fullPath);
});

/**
 * 本地存储不可用时的明确阻断页。
 *
 * 此时继续挂载应用会让界面看起来正常、写入却静默失败，用户以为进度已保存；
 * 对本地优先的工具来说这是数据丢失风险，因此宁可停在可解释的错误页。
 */
function renderStorageError(err: unknown) {
  const root = document.querySelector('#app')
  if (!root) return
  const platform = getPlatform()
  const isBrowser = platform === 'web'
  const reason = isBrowser
    ? '浏览器可能处于隐私模式、禁用了网站数据，或本地存储空间已满。'
    : '本地数据目录可能不可写，或磁盘空间不足。'

  const wrap = document.createElement('div')
  wrap.setAttribute('role', 'alert')
  wrap.style.cssText = [
    'max-width:560px',
    'margin:12vh auto 0',
    'padding:28px 26px',
    'border:1px solid #dbe6df',
    'border-radius:14px',
    'background:#fff',
    'color:#2f3e39',
    'font:15px/1.7 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif',
    'box-shadow:0 12px 40px rgba(0,0,0,.08)',
  ].join(';')

  const title = document.createElement('h1')
  title.textContent = '无法打开本地数据库'
  title.style.cssText = 'margin:0 0 8px;font-size:20px;color:#52796f'
  wrap.appendChild(title)

  const desc = document.createElement('p')
  desc.textContent = `${reason} 为避免学习进度悄悄丢失，慢记没有继续进入主界面。`
  desc.style.cssText = 'margin:0 0 8px'
  wrap.appendChild(desc)

  const hint = document.createElement('p')
  hint.textContent = isBrowser
    ? '请允许本站保存数据（地址栏左侧的站点设置），或清理出存储空间后重试。'
    : '请检查数据目录权限和磁盘空间后重试。'
  hint.style.cssText = 'margin:0 0 18px;color:#60716a'
  wrap.appendChild(hint)

  const retry = document.createElement('button')
  retry.type = 'button'
  retry.textContent = '重新加载'
  retry.style.cssText = [
    'padding:8px 18px',
    'border:0',
    'border-radius:8px',
    'background:#52796f',
    'color:#fff',
    'font-size:14px',
    'cursor:pointer',
  ].join(';')
  retry.addEventListener('click', () => location.reload())
  wrap.appendChild(retry)

  const detail = document.createElement('p')
  detail.textContent = String(err instanceof Error ? err.message : err || '').slice(0, 300)
  detail.style.cssText = 'margin:16px 0 0;color:#909399;font-size:12px;word-break:break-word'
  wrap.appendChild(detail)

  root.replaceChildren(wrap)
}

// 初始化数据库适配器（必须完成后再挂载应用，避免组件在初始化前调用 getDbAdapter()）
getDbAdapterAsync().then(() => {
  // console.info 不在生产构建的 pure 抹除名单内，保证打点可存活到生产
  console.info(`[启动耗时] 数据库适配器就绪: ${performance.now().toFixed(0)}ms`);
  app.mount('#app');
  console.info(`[启动耗时] 应用挂载完成: ${performance.now().toFixed(0)}ms`);
  // 应用界面背景（CSS 变量 + body class）：pinia 从 localStorage 同步水合即可得设置，
  // 自定义图片经 db 适配器读取（此时适配器已就绪，读取失败只影响背景）
  useWordsStore().applyAppBg();
}).catch((err) => {
  console.error('[App] 数据库适配器初始化失败:', err);
  renderStorageError(err);
});
