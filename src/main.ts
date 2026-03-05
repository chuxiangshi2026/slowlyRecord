// import './assets/main.css'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
// 引入图标
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
// element国际化支持
import zhCn from 'element-plus/es/locale/lang/zh-cn'


import {createApp} from 'vue'

import App from './App.vue'
import router from './router'

import {createPinia} from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate';
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'
import VueVirtualScroller from 'vue-virtual-scroller'
import { initBaiduStats, trackRouterPageView } from '@/utils/baidu-stats'

const app = createApp(App)

// 添加图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
    app.component(key, component)
}
let pinia = createPinia();
pinia.use(piniaPluginPersistedstate);
app.use(pinia)
app.use(ElementPlus, {locale: zhCn})
app.use(router)
app.use(VueVirtualScroller)

// 初始化百度统计
// console.log('=== 开始初始化百度统计 ===');
initBaiduStats().then(() => {
  console.log('=== 百度统计初始化完成 ===');
}).catch((err) => {
  console.error('=== 百度统计初始化失败 ===', err);
});

// 路由切换时追踪页面浏览
router.afterEach((to) => {
    trackRouterPageView(to.fullPath);
});

    // createApp(App).mount( ... ) // Vue
    // createRoot( ... ).render(App) // React
    app.mount('#app')
