<template>
  <!-- 全局古风背景：按页面分配山水/竹影/祥云，亮暗主题各自使用同色系底图 -->
  <image class="app-background" :src="src" mode="aspectFill" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useTheme } from '../stores/useTheme'

type BackgroundVariant = 'landscape' | 'bamboo' | 'clouds'

const props = defineProps<{
  /** 需要固定某种意境时显式指定；默认按当前路由稳定分配 */
  variant?: BackgroundVariant
}>()

const theme = useTheme()
const variants: BackgroundVariant[] = ['landscape', 'bamboo', 'clouds']

const pages = getCurrentPages()
const route = pages[pages.length - 1]?.route || ''
const routeVariant = computed<BackgroundVariant>(() => {
  // 同一路由始终得到同一背景，避免 onShow 时闪变
  const hash = Array.from(route).reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 0)
  return variants[hash % variants.length]
})
const activeVariant = computed(() => props.variant || routeVariant.value)
const src = computed(() => `/static/theme-bg/${activeVariant.value}-${theme.isDark ? 'dark' : 'light'}.png`)
</script>

<style scoped>
.app-background {
  position: fixed;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  /* 页面根节点由全局样式建立层叠上下文，背景位于页面底色之上、内容之下 */
  z-index: -1;
  pointer-events: none;
}
</style>
