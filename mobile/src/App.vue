<template>
  <view class="app-container">
    <slot />
  </view>
</template>

<script setup lang="ts">
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app'

onLaunch(() => {
  console.log('App Launch')
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
  console.log('App Show')
})

onHide(() => {
  console.log('App Hide')
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
