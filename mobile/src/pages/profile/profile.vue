<template>
  <view class="profile-container">
    <view class="header">
      <view class="avatar">
        <text>U</text>
      </view>
      <text class="username">慢记用户</text>
    </view>

    <view class="stats-row">
      <view class="stat-box">
        <text class="stat-num">{{ wordsStore.wordCount }}</text>
        <text class="stat-label">单词总数</text>
      </view>
      <view class="stat-box">
        <text class="stat-num">{{ wordsStore.todayAdded }}</text>
        <text class="stat-label">今日添加</text>
      </view>
      <view class="stat-box">
        <text class="stat-num">{{ wordsStore.reviewWords.length }}</text>
        <text class="stat-label">待复习</text>
      </view>
    </view>

    <view class="menu-list">
      <view class="menu-item" @click="exportData">
        <text class="menu-icon">E</text>
        <text class="menu-text">导出数据</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @click="importData">
        <text class="menu-icon">I</text>
        <text class="menu-text">导入数据</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @click="clearData">
        <text class="menu-icon">C</text>
        <text class="menu-text">清空数据</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @click="showAbout">
        <text class="menu-icon">A</text>
        <text class="menu-text">关于</text>
        <text class="menu-arrow">›</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { useMobileWords } from '@/stores/useMobileWords'

const wordsStore = useMobileWords()

const exportData = () => {
  const data = wordsStore.exportWords()
  uni.setClipboardData({
    data: JSON.stringify(data),
    success: () => {
      uni.showToast({ title: '数据已复制到剪贴板', icon: 'none' })
    }
  })
}

const importData = () => {
  uni.showModal({
    title: '导入数据',
    content: '请粘贴之前导出的数据',
    editable: true,
    success: (res) => {
      if (res.confirm && res.content) {
        try {
          const data = JSON.parse(res.content)
          wordsStore.importWords(data)
          uni.showToast({ title: '导入成功', icon: 'success' })
        } catch (e) {
          uni.showToast({ title: '数据格式错误', icon: 'none' })
        }
      }
    }
  })
}

const clearData = () => {
  uni.showModal({
    title: '确认清空',
    content: '此操作将删除所有单词数据，不可恢复！',
    confirmColor: '#ff5252',
    success: (res) => {
      if (res.confirm) {
        wordsStore.clearAllWords()
        uni.showToast({ title: '已清空', icon: 'success' })
      }
    }
  })
}

const showAbout = () => {
  uni.showModal({
    title: '关于慢记',
    content: '慢记 v1.0.0\n\n一款专注于单词记忆与复习的工具应用',
    showCancel: false
  })
}
</script>

<style scoped>
.profile-container {
  min-height: 100vh;
  background: #f5f5f5;
}

.header {
  background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);
  padding: 80rpx 40rpx;
  text-align: center;
}

.avatar {
  width: 120rpx;
  height: 120rpx;
  background: rgba(255,255,255,0.3);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 20rpx;
  font-size: 48rpx;
  color: #fff;
  font-weight: bold;
}

.username {
  color: #fff;
  font-size: 36rpx;
  font-weight: bold;
}

.stats-row {
  display: flex;
  justify-content: space-around;
  padding: 30rpx 20rpx;
  background: #fff;
  margin: -30rpx 20rpx 20rpx;
  border-radius: 16rpx;
  box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.08);
  position: relative;
  z-index: 1;
}

.stat-box {
  text-align: center;
}

.stat-num {
  font-size: 40rpx;
  font-weight: bold;
  color: #1976d2;
  display: block;
}

.stat-label {
  font-size: 24rpx;
  color: #999;
  margin-top: 8rpx;
  display: block;
}

.menu-list {
  background: #fff;
  margin-top: 20rpx;
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 30rpx 40rpx;
  border-bottom: 1rpx solid #f5f5f5;
}

.menu-icon {
  width: 48rpx;
  height: 48rpx;
  background: #e3f2fd;
  border-radius: 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20rpx;
  font-size: 24rpx;
  color: #1976d2;
  font-weight: bold;
}

.menu-text {
  flex: 1;
  font-size: 30rpx;
  color: #333;
}

.menu-arrow {
  font-size: 36rpx;
  color: #999;
}
</style>
