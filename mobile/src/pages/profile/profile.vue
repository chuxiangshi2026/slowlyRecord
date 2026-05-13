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
      <!-- 同步 -->
      <view class="menu-item" @click="showSyncActionSheet">
        <text class="menu-icon sync">S</text>
        <text class="menu-text">数据同步</text>
        <text class="menu-arrow">›</text>
      </view>
      <!-- 翻译设置 -->
      <view class="menu-item" @click="showTranslationSetting">
        <text class="menu-icon">T</text>
        <text class="menu-text">翻译引擎</text>
        <text class="menu-value">{{ currentTranslationPlatform }}</text>
        <text class="menu-arrow">›</text>
      </view>
      <!-- 导出 -->
      <view class="menu-item" @click="exportData">
        <text class="menu-icon">E</text>
        <text class="menu-text">导出数据</text>
        <text class="menu-arrow">›</text>
      </view>
      <!-- 导入 -->
      <view class="menu-item" @click="importData">
        <text class="menu-icon">I</text>
        <text class="menu-text">导入数据</text>
        <text class="menu-arrow">›</text>
      </view>
      <!-- 清空 -->
      <view class="menu-item" @click="clearData">
        <text class="menu-icon danger">C</text>
        <text class="menu-text">清空数据</text>
        <text class="menu-arrow">›</text>
      </view>
      <!-- 关于 -->
      <view class="menu-item" @click="showAbout">
        <text class="menu-icon">A</text>
        <text class="menu-text">关于</text>
        <text class="menu-arrow">›</text>
      </view>
    </view>

    <!-- 推送结果弹窗 -->
    <view v-if="showPushResult" class="popup-overlay" @click="closePushResult">
      <view class="popup-content" @click.stop>
        <view class="popup-title">推送成功</view>
        <view class="sync-code-box">
          <text class="sync-code-label">同步码：</text>
          <text class="sync-code-value" selectable>{{ syncCode }}</text>
        </view>
        <view class="sync-qr-wrapper">
          <canvas ref="qrCanvas" canvas-id="syncQrCanvas" class="sync-qr-canvas" style="width: 180px; height: 180px;"></canvas>
          <text class="sync-qr-hint">在另一台设备输入同步码或扫码</text>
        </view>
        <view class="popup-actions">
          <button class="btn-confirm" @click="copySyncCode">复制同步码</button>
          <button class="btn-cancel" @click="closePushResult">关闭</button>
        </view>
      </view>
    </view>

    <!-- 拉取输入弹窗 -->
    <view v-if="showPullInput" class="popup-overlay" @click="closePullInput">
      <view class="popup-content" @click.stop>
        <view class="popup-title">拉取数据</view>
        <input
          class="popup-input"
          v-model="inputSyncCode"
          placeholder="输入同步码"
        />
        <view class="popup-actions">
          <button class="btn-confirm" @click="handlePull">拉取</button>
          <button class="btn-cancel" @click="closePullInput">取消</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { useMobileWords } from '@/stores/useMobileWords'
import { pushToServer, pullFromServer, drawQrCode, getTranslationPlatform, setTranslationPlatform } from '@/stores/useUtils'
// #ifdef H5
import QRCode from 'qrcode'
// #endif

const wordsStore = useMobileWords()

const showPushResult = ref(false)
const showPullInput = ref(false)
const syncCode = ref('')
const inputSyncCode = ref('')
const qrCanvas = ref<HTMLCanvasElement | null>(null)

// 翻译引擎显示名
const platformNames: Record<string, string> = {
  youdao: '有道翻译',
  baidu: '百度翻译',
  local: '仅离线词典'
}

const currentTranslationPlatform = computed(() => {
  return platformNames[getTranslationPlatform()] || '有道翻译'
})

// 翻译引擎设置
const showTranslationSetting = () => {
  uni.showActionSheet({
    itemList: ['有道翻译', '百度翻译', '仅离线词典'],
    success: (res) => {
      const platforms: ('youdao' | 'baidu' | 'local')[] = ['youdao', 'baidu', 'local']
      setTranslationPlatform(platforms[res.tapIndex])
      uni.showToast({ title: `已切换为${platformNames[platforms[res.tapIndex]]}`, icon: 'none' })
    }
  })
}

// 同步操作菜单
const showSyncActionSheet = () => {
  uni.showActionSheet({
    itemList: ['推送数据（上传）', '拉取数据（下载）', '扫码拉取'],
    success: (res) => {
      if (res.tapIndex === 0) handlePush()
      else if (res.tapIndex === 1) showPullInput.value = true
      else if (res.tapIndex === 2) scanAndPull()
    },
  })
}

// 推送
const handlePush = async () => {
  uni.showLoading({ title: '推送中...' })
  try {
    const result = await pushToServer(wordsStore.exportAllWords())
    uni.hideLoading()
    if (result.success && result.code) {
      syncCode.value = result.code
      showPushResult.value = true
      await nextTick()
      drawQRCode(result.code)
    } else {
      uni.showToast({ title: result.error || '推送失败', icon: 'none' })
    }
  } catch (e) {
    uni.hideLoading()
    uni.showToast({ title: '推送失败', icon: 'none' })
  }
}

// 拉取
const handlePull = async () => {
  if (!inputSyncCode.value.trim()) {
    uni.showToast({ title: '请输入同步码', icon: 'none' })
    return
  }
  uni.showLoading({ title: '拉取中...' })
  try {
    const result = await pullFromServer(inputSyncCode.value.trim())
    uni.hideLoading()
    if (result.success && result.words) {
      await wordsStore.importWords(result.words)
      uni.showModal({
        title: '拉取成功',
        content: `共 ${result.words.length} 个单词已同步`,
        showCancel: false,
      })
      closePullInput()
    } else {
      uni.showToast({ title: result.error || '拉取失败', icon: 'none' })
    }
  } catch (e) {
    uni.hideLoading()
    uni.showToast({ title: '拉取失败', icon: 'none' })
  }
}

// 扫码拉取
const scanAndPull = () => {
  // #ifdef MP-WEIXIN || APP-PLUS
  uni.scanCode({
    success: async (res) => {
      if (res.result) {
        uni.showLoading({ title: '拉取中...' })
        const result = await pullFromServer(res.result)
        uni.hideLoading()
        if (result.success && result.words) {
          await wordsStore.importWords(result.words)
          uni.showModal({
            title: '拉取成功',
            content: `共 ${result.words.length} 个单词已同步`,
            showCancel: false,
          })
        } else {
          uni.showToast({ title: result.error || '拉取失败', icon: 'none' })
        }
      }
    },
    fail: () => {
      uni.showToast({ title: '扫码取消', icon: 'none' })
    },
  })
  // #endif

  // #ifdef H5
  uni.showToast({ title: 'H5 不支持扫码，请手动输入', icon: 'none' })
  // #endif
}

// 绘制二维码
const drawQRCode = (text: string) => {
  // #ifdef MP-WEIXIN || APP-PLUS
  try {
    drawQrCode('syncQrCanvas', text, null, { size: 180, margin: 2 })
  } catch (e) {
    console.error('二维码生成失败', e)
  }
  // #endif

  // #ifdef H5
  try {
    QRCode.toCanvas(qrCanvas.value, text, { width: 180, margin: 2 }, (err: any) => {
      if (err) console.error('二维码生成失败', err)
    })
  } catch (e) {
    console.error('二维码生成失败', e)
  }
  // #endif
}

const copySyncCode = () => {
  uni.setClipboardData({
    data: syncCode.value,
    success: () => {
      uni.showToast({ title: '已复制', icon: 'success' })
    },
  })
}

const closePushResult = () => {
  showPushResult.value = false
  syncCode.value = ''
}

const closePullInput = () => {
  showPullInput.value = false
  inputSyncCode.value = ''
}

// 导出数据
const exportData = () => {
  const data = wordsStore.exportWords()
  uni.setClipboardData({
    data: JSON.stringify(data),
    success: () => {
      uni.showToast({ title: '数据已复制到剪贴板', icon: 'none' })
    },
  })
}

// 导入数据
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
    },
  })
}

const clearData = () => {
  const bankName = wordsStore.getBankById(wordsStore.currentBankId)?.name || '当前词库'
  uni.showActionSheet({
    itemList: [`清空「${bankName}」`, '清空所有词库'],
    success: (res) => {
      const confirmText = res.tapIndex === 0 ? `清空「${bankName}」中的所有单词？` : '清空所有词库中的所有单词？不可恢复！'
      uni.showModal({
        title: '确认清空',
        content: confirmText,
        confirmColor: '#ff5252',
        success: async (confirmRes) => {
          if (confirmRes.confirm) {
            if (res.tapIndex === 0) {
              await wordsStore.clearBankWords(wordsStore.currentBankId)
            } else {
              for (const bank of wordsStore.bankList) {
                await wordsStore.clearBankWords(bank.id)
              }
            }
            uni.showToast({ title: '已清空', icon: 'success' })
          }
        },
      })
    }
  })
}

const showAbout = () => {
  uni.showModal({
    title: '关于慢记',
    content: '慢记 v1.0.0\n\n一款专注于单词记忆与复习的工具应用',
    showCancel: false,
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

.menu-icon.sync {
  background: #e8f5e9;
  color: #4caf50;
}

.menu-icon.danger {
  background: #ffebee;
  color: #f44336;
}

.menu-text {
  flex: 1;
  font-size: 30rpx;
  color: #333;
}

.menu-value {
  font-size: 26rpx;
  color: #999;
  margin-right: 10rpx;
}

.menu-arrow {
  font-size: 36rpx;
  color: #999;
}

/* 弹窗 */
.popup-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.popup-content {
  background: #fff;
  border-radius: 16rpx;
  padding: 40rpx;
  width: 600rpx;
}

.popup-title {
  font-size: 36rpx;
  font-weight: bold;
  text-align: center;
  margin-bottom: 30rpx;
}

.popup-input {
  height: 80rpx;
  background: #f5f5f5;
  border-radius: 8rpx;
  padding: 0 20rpx;
  margin-bottom: 20rpx;
  font-size: 28rpx;
}

.popup-actions {
  display: flex;
  gap: 20rpx;
  margin-top: 20rpx;
}

.btn-cancel, .btn-confirm {
  flex: 1;
  height: 80rpx;
  border-radius: 8rpx;
  font-size: 28rpx;
  border: none;
}

.btn-cancel {
  background: #f5f5f5;
  color: #666;
}

.btn-confirm {
  background: #1976d2;
  color: #fff;
}

.sync-code-box {
  background: #f5f5f5;
  border-radius: 8rpx;
  padding: 20rpx;
  margin-bottom: 20rpx;
}

.sync-code-label {
  font-size: 26rpx;
  color: #666;
}

.sync-code-value {
  font-size: 26rpx;
  color: #1976d2;
  font-weight: bold;
  word-break: break-all;
}

.sync-qr-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 20rpx;
}

.sync-qr-canvas {
  border-radius: 8rpx;
}

.sync-qr-hint {
  font-size: 24rpx;
  color: #999;
}
</style>
