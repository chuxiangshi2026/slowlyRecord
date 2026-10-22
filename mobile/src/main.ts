import { createSSRApp } from 'vue'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import App from './App.vue'
import { registerMobileAdapters } from './adapters/index'
import { useTheme } from './stores/useTheme'

export function createApp() {
  const app = createSSRApp(App)
  const pinia = createPinia()
  pinia.use(piniaPluginPersistedstate)

  app.use(pinia)

  // 全局主题混入：页面根节点统一挂 :class="themeClass" 即获得暗色 CSS 变量覆盖；
  // wx.setNavigationBarColor 只作用于当前页，借全局 onShow 在每次进页面时重放原生配色
  app.mixin({
    computed: {
      themeClass(): string {
        return useTheme().themeClass
      },
    },
    onShow() {
      useTheme().apply()
    },
  })

  // 注册移动端适配器
  registerMobileAdapters()

  return {
    app
  }
}
