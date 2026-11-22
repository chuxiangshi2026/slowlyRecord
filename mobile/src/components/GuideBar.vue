<template>
  <view v-if="visible" class="guide-bar">
    <text class="guide-text">{{ text }}</text>
    <text class="guide-close" @click="dismiss">知道了</text>
  </view>
</template>

<script setup lang="ts">
/**
 * 首次使用引导条（全局组件）
 *
 * 各记忆模块主页统一风格：一句话讲清「先做什么、再做什么」，点「知道了」永久关闭
 * （按 storageKey 记 uni storage）。比数字记忆的 3 步 overlay 轻量，适合功能一眼能看懂的模块。
 */
import { ref, onMounted } from 'vue'

const props = defineProps<{
  /** 引导文案（给出明确的行动路径） */
  text: string
  /** 关闭状态持久化 key（各模块唯一） */
  storageKey: string
}>()

const visible = ref(false)

onMounted(() => {
  try {
    visible.value = !uni.getStorageSync(props.storageKey)
  } catch {
    visible.value = true
  }
})

function dismiss() {
  visible.value = false
  try {
    uni.setStorageSync(props.storageKey, 1)
  } catch {}
}
</script>

<style scoped>
.guide-bar {
  background: var(--sr-card);
  border-radius: 16rpx;
  padding: 20rpx 24rpx;
  margin-bottom: 20rpx;
  display: flex;
  align-items: center;
  gap: 16rpx;
  border: 2rpx solid var(--sr-primary);
}

.guide-text {
  flex: 1;
  font-size: 24rpx;
  color: var(--sr-text-2);
  line-height: 1.5;
}

.guide-close {
  font-size: 26rpx;
  color: var(--sr-primary);
  font-weight: bold;
  flex-shrink: 0;
}
</style>
