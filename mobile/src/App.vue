<template>
  <view class="app-container">
    <slot />
  </view>
</template>

<script setup lang="ts">
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app'
import { useMobileWords } from './stores/useMobileWords'
import { log } from './utils/logger'

onLaunch(() => {
  log.i('App Launch')
  // 监听系统主题变化
  // #ifdef APP-PLUS || H5
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  if (mediaQuery) {
    mediaQuery.addEventListener?.('change', (e) => {
      const pages = getCurrentPages()
      const page = pages[pages.length - 1]
      if (page) {
        uni.$emit('themeChange', e.matches ? 'dark' : 'light')
      }
    })
  }
  // #endif
})

onShow(() => {
  log.i('App Show')
})

onHide(() => {
  log.i('App Hide')
  useMobileWords().flushDirtyBanks().catch((err) => {
    log.e('App Hide 持久化单词失败:', err)
  })
})
</script>

<style>
/* 全局样式 */
page {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background-color: #f5f5f5;
}

/* 安全区适配 */
.app-container {
  min-height: 100vh;
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}

/* 暗色模式支持 */
@media (prefers-color-scheme: dark) {
  page {
    background-color: #1a1a1a;
    color: #e0e0e0;
  }
}
</style>
