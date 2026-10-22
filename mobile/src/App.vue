<template>
  <view class="app-container">
    <slot />
  </view>
</template>

<script setup lang="ts">
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app'
import { useMobileWords } from './stores/useMobileWords'
import { useTheme } from './stores/useTheme'
import { log } from './utils/logger'

const theme = useTheme()

/** 同步系统主题并重放原生配色（导航栏/tabBar/窗口背景） */
const syncAndApplyTheme = () => {
  theme.syncSystemTheme()
  theme.apply()
}

// 截屏引导：小程序拿不到截图内容，监听到截屏后引导用户从相册选刚截的图做 OCR 加词
let lastShotPromptAt = 0
const onUserCaptureScreen = () => {
  const now = Date.now()
  // 连截多张时只提示一次
  if (now - lastShotPromptAt < 5000) return
  lastShotPromptAt = now
  uni.showModal({
    title: '检测到截图',
    content: '是否识别截图中的单词并加入词库？',
    confirmText: '识别单词',
    confirmColor: '#52796f',
    success: (res) => {
      if (!res.confirm) return
      const pages = getCurrentPages()
      const current = pages[pages.length - 1]?.route || ''
      // 已在翻译页时直接触发识别，避免重复 navigateTo 同一页面报错
      if (current === 'subPackages/pages-tools/translate/translate') {
        uni.$emit('translate:autoCapture', 'album')
      } else {
        uni.navigateTo({ url: '/subPackages/pages-tools/translate/translate?autoCapture=album' })
      }
    },
  })
}

onLaunch(() => {
  log.i('App Launch')
  syncAndApplyTheme()

  // 跟随系统主题变化
  // #ifdef MP-WEIXIN || MP-TOUTIAO
  uni.onThemeChange?.(syncAndApplyTheme)
  // #endif
  // #ifdef APP-PLUS || H5
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', syncAndApplyTheme)
  // #endif

  // 截屏加词引导（仅小程序支持截屏事件）
  // #ifdef MP-WEIXIN || MP-TOUTIAO
  uni.onUserCaptureScreen?.(onUserCaptureScreen)
  // #endif
})

onShow(() => {
  log.i('App Show')
  syncAndApplyTheme()
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
  /* 主题变量（亮色默认）；暗色由 .theme-dark 覆盖（全局混入挂在每页根节点上） */
  --sr-bg: #f5f5f5;
  --sr-card: #ffffff;
  --sr-card-2: #f5f5f5;
  --sr-text: #333333;
  --sr-text-2: #666666;
  --sr-text-3: #999999;
  --sr-text-strong: #1a1a1a;
  --sr-border: #eeeeee;
  --sr-primary: #52796f;
  --sr-primary-2: #74937d;
  --sr-primary-bg: #eaf1ea;
  --sr-on-primary: #ffffff;
  --sr-mask: rgba(0, 0, 0, 0.5);
  background-color: var(--sr-bg);
  color: var(--sr-text);
}

/* 暗色变量覆盖：深绿灰基底 + 玉绿主色（与桌面端深色主题约定一致） */
.theme-dark {
  --sr-bg: #151a18;
  --sr-card: #222825;
  --sr-card-2: #2a302d;
  --sr-text: #e4eae7;
  --sr-text-2: #a7b2ad;
  --sr-text-3: #77847e;
  --sr-text-strong: #f0f4f2;
  --sr-border: #353d39;
  --sr-primary: #83c5a8;
  --sr-primary-2: #5f7a6f;
  --sr-primary-bg: #26332d;
  --sr-on-primary: #10241e;
  --sr-mask: rgba(0, 0, 0, 0.65);
}

/* 安全区适配 */
.app-container {
  min-height: 100vh;
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}
</style>
