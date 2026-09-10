<template>
  <!-- 升级飘字：Lv 提升时由父级 v-if 挂载，播完（1s）由父级移除，动画随挂载自动重放 -->
  <view class="level-up-float">
    <text class="level-up-text">Lv{{ from }} → {{ to }}</text>
  </view>
</template>

<script setup lang="ts">
defineProps<{
  /** 升级前等级 */
  from: number
  /** 升级后等级 */
  to: number
}>()
</script>

<style scoped>
/* 定位基准为父级最近的有 position 祖先（各页面自行指定卡片/练习区） */
.level-up-float {
  position: absolute;
  top: 24rpx;
  right: 24rpx;
  z-index: 60;
  pointer-events: none;
  animation: level-up-float-anim 1s ease forwards;
}

.level-up-text {
  background: linear-gradient(135deg, #52796f, #83c5a8);
  color: #fff;
  font-size: 24rpx;
  font-weight: bold;
  padding: 8rpx 20rpx;
  border-radius: 24rpx;
  box-shadow: 0 6rpx 20rpx rgba(82, 121, 111, 0.35);
}

/* 淡入 → 停留 → 上移淡出，整体约 1s 与父级移除时机一致 */
@keyframes level-up-float-anim {
  0% {
    opacity: 0;
    transform: translateY(16rpx) scale(0.8);
  }
  20% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  70% {
    opacity: 1;
    transform: translateY(-24rpx);
  }
  100% {
    opacity: 0;
    transform: translateY(-48rpx);
  }
}
</style>
