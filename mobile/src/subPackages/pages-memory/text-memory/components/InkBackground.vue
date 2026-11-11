<template>
  <!-- 固定淡墨背景：与主题底色一致的不透明 PNG，避免透明通道彩边；pointer-events 关闭不影响交互 -->
  <image class="ink-bg" :src="src" mode="aspectFill" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useTheme } from '@/stores/useTheme'

const theme = useTheme()

// 图片在 pages-memory 分包 static 目录（不占主包体积），PNG 由 scripts/render-ink-bg-pngs.cjs 预渲染
const src = computed(() =>
  theme.isDark
    ? '/subPackages/pages-memory/static/text-memory/ink-bg-dark.png'
    : '/subPackages/pages-memory/static/text-memory/ink-bg-light.png',
)
</script>

<style scoped>
.ink-bg {
  position: fixed;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  /* 沉到页面底色之上、内容之下（根元素背景绘制在最底层，负 z-index 内容仍在其上） */
  z-index: -1;
  pointer-events: none;
}
</style>
