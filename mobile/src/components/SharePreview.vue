<template>
  <view v-if="visible" class="share-mask" @click="close">
    <view class="share-dialog" @click.stop>
      <image class="share-preview" :src="image" mode="widthFix" />
      <view class="share-actions">
        <button class="share-action primary" @click="saveToAlbum">保存到相册</button>
        <button class="share-action" open-type="share">分享给好友</button>
      </view>
      <text class="share-close" @click="close">关闭</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  modelValue: boolean
  image: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
}>()

const visible = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v),
})

const close = () => {
  visible.value = false
}

/** 保存到相册：拒绝授权时引导去设置页开启 */
function saveToAlbum() {
  if (!props.image) return
  uni.saveImageToPhotosAlbum({
    filePath: props.image,
    success: () => uni.showToast({ title: '已保存到相册', icon: 'success' }),
    fail: (err: any) => {
      const msg: string = err?.errMsg || ''
      if (msg.includes('auth') || msg.includes('deny')) {
        uni.showModal({
          title: '需要相册权限',
          content: '请在设置中允许保存图片到相册',
          confirmText: '去设置',
          success: r => {
            if (r.confirm) uni.openSetting()
          },
        })
      } else {
        uni.showToast({ title: '保存失败，请重试', icon: 'none' })
      }
    },
  })
}
</script>

<style scoped>
.share-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40rpx;
  background: var(--sr-mask);
}

.share-dialog {
  width: 600rpx;
  max-width: 92vw;
  padding: 24rpx;
  border-radius: 24rpx;
  background: var(--sr-card);
  box-shadow: 0 12rpx 48rpx rgba(0, 0, 0, .18);
}

.share-preview {
  display: block;
  width: 100%;
  border-radius: 16rpx;
}

.share-actions {
  display: flex;
  gap: 16rpx;
  margin-top: 20rpx;
}

.share-action {
  flex: 1;
  height: 80rpx;
  line-height: 80rpx;
  border: none;
  border-radius: 40rpx;
  background: var(--sr-primary-bg);
  color: var(--sr-primary);
  font-size: 28rpx;
}

.share-action.primary {
  background: var(--sr-primary);
  color: var(--sr-on-primary);
}

.share-action::after {
  border: none;
}

.share-close {
  display: block;
  margin-top: 16rpx;
  text-align: center;
  font-size: 24rpx;
  color: var(--sr-text-3);
}
</style>
