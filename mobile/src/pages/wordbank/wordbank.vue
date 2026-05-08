<template>
  <view class="wordbank-container">
    <view class="header">
      <text class="title">📚 词库管理</text>
      <text class="subtitle">下载权威词库，高效备考</text>
    </view>

    <view class="wordbank-list">
      <view
        v-for="bank in wordbanks"
        :key="bank.id"
        class="bank-item"
      >
        <view class="bank-info">
          <text class="bank-name">{{ bank.name }}</text>
          <text class="bank-desc">{{ bank.description }}</text>
          <text class="bank-count">约 {{ bank.wordCount }} 词</text>
        </view>
        <view class="bank-actions">
          <text v-if="bank.cached" class="cached-badge">已缓存</text>
          <button
            class="action-btn"
            :class="{ cached: bank.cached }"
            :disabled="downloading === bank.id"
            @click="handleAction(bank)"
          >
            {{ downloading === bank.id ? '下载中...' : (bank.cached ? '重新下载' : '下载') }}
          </button>
        </view>
      </view>
    </view>

    <view class="tip">
      <text class="tip-text">💡 提示：下载的词库可用于听写练习</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  WORDBANK_LIST,
  type WordBankInfo,
  downloadWordBank,
  isWordBankCached
} from '@/utils/wordbank-service'

const wordbanks = ref<WordBankInfo[]>([])
const downloading = ref('')

onMounted(() => {
  // 检查缓存状态
  wordbanks.value = WORDBANK_LIST.map(bank => ({
    ...bank,
    cached: isWordBankCached(bank.id)
  }))
})

const handleAction = async (bank: WordBankInfo) => {
  if (downloading.value) return

  downloading.value = bank.id
  try {
    // #ifdef H5 || APP-PLUS
    await downloadWordBank(bank.id)
    bank.cached = true
    uni.showToast({ title: `${bank.name} 下载成功`, icon: 'success' })
    // #endif

    // #ifdef MP-WEIXIN
    uni.showModal({
      title: '提示',
      content: '小程序端词库需部署到服务器后使用',
      showCancel: false
    })
    // #endif
  } catch (e) {
    uni.showToast({ title: '下载失败', icon: 'none' })
  } finally {
    downloading.value = ''
  }
}
</script>

<style scoped>
.wordbank-container {
  min-height: 100vh;
  background: #f5f5f5;
}

.header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 60rpx 40rpx;
  text-align: center;
}

.title {
  font-size: 40rpx;
  font-weight: bold;
  color: #fff;
  display: block;
}

.subtitle {
  font-size: 26rpx;
  color: rgba(255,255,255,0.8);
  margin-top: 10rpx;
  display: block;
}

.wordbank-list {
  padding: 20rpx;
}

.bank-item {
  background: #fff;
  border-radius: 16rpx;
  padding: 30rpx;
  margin-bottom: 16rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.bank-info {
  flex: 1;
}

.bank-name {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
  display: block;
}

.bank-desc {
  font-size: 24rpx;
  color: #999;
  margin-top: 8rpx;
  display: block;
}

.bank-count {
  font-size: 22rpx;
  color: #667eea;
  margin-top: 8rpx;
  display: block;
}

.bank-actions {
  text-align: right;
}

.cached-badge {
  font-size: 20rpx;
  color: #4caf50;
  display: block;
  margin-bottom: 8rpx;
}

.action-btn {
  width: 160rpx;
  height: 64rpx;
  background: #667eea;
  color: #fff;
  border-radius: 32rpx;
  font-size: 26rpx;
  border: none;
}

.action-btn.cached {
  background: #f0f0f0;
  color: #666;
}

.tip {
  padding: 30rpx;
  text-align: center;
}

.tip-text {
  font-size: 24rpx;
  color: #999;
}
</style>
