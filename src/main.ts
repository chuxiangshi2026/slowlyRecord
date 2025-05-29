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

    // createApp(App).mount( ... ) // Vue
    // createRoot( ... ).render(App) // React
    app.mount('#app')
