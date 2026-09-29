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
import { initBaiduStats, trackRouterPageView } from '@/utils/baidu-stats'
import {getDbAdapterAsync} from '@/adapters/db'

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

// 初始化百度统计
console.log('[App] 准备初始化百度统计...');
initBaiduStats().then(() => {
  console.log('[App] 百度统计初始化流程完成');
}).catch((err) => {
  console.error('[App] 百度统计初始化失败:', err);
});

// 路由切换时追踪页面浏览
router.afterEach((to) => {
    trackRouterPageView(to.fullPath);
});

// 初始化数据库适配器（必须完成后再挂载应用，避免组件在初始化前调用 getDbAdapter()）
getDbAdapterAsync().then(() => {
  // console.info 不在生产构建的 pure 抹除名单内，保证打点可存活到生产
  console.info(`[启动耗时] 数据库适配器就绪: ${performance.now().toFixed(0)}ms`);
  app.mount('#app');
  console.info(`[启动耗时] 应用挂载完成: ${performance.now().toFixed(0)}ms`);
}).catch((err) => {
  console.error('[App] 数据库适配器初始化失败:', err);
  // 即使初始化失败也挂载应用，避免白屏
  app.mount('#app');
});
