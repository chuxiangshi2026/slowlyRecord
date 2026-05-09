import { createSSRApp } from 'vue'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import App from './App.vue'
import { registerMobileAdapters } from './adapters/index'

export function createApp() {
  const app = createSSRApp(App)
  const pinia = createPinia()
  pinia.use(piniaPluginPersistedstate)
  
  app.use(pinia)
  
  // 注册移动端适配器
  registerMobileAdapters()
  
  return {
    app
  }
}
