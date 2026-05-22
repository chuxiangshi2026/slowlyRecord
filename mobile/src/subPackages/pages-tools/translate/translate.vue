<template>
  <view class="translate-container">
    <view class="input-section">
      <textarea 
        class="input-area" 
        v-model="inputText"
        placeholder="输入要翻译的文本..."
        maxlength="500"
      />
      <text class="char-count">{{ inputText.length }}/500</text>
    </view>

    <view class="action-row">
      <button class="translate-btn" @click="translate" :disabled="isTranslating || !inputText">
        {{ isTranslating ? '翻译中...' : '翻译' }}
      </button>
      <button class="camera-btn" @click="handleCapture">
        📷 拍照
      </button>
    </view>

    <view v-if="ocrResult" class="ocr-section">
      <view class="result-header">
        <text class="result-title">识别结果</text>
      </view>
      <text class="result-text">{{ ocrResult }}</text>
    </view>

    <view v-if="result" class="result-section">
      <view class="result-header">
        <text class="result-title">
          {{ result.offline ? '📴 离线翻译' : '翻译结果' }}
        </text>
        <text class="result-lang">{{ result.from }} → {{ result.to }}</text>
      </view>
      <text class="result-text">{{ result.translation }}</text>
      <view v-if="result.phonetic" class="phonetic">
        <text>音标: {{ result.phonetic }}</text>
      </view>
      <view v-if="result.offline" class="offline-tag">
        <text>离线释义，仅供参考</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { translateText, queryOfflineDict } from '@/stores/useUtils'
import { getCaptureAdapter } from '@/adapters/index'

const inputText = ref('')
const result = ref<any>(null)
const isTranslating = ref(false)
const ocrResult = ref('')

const translate = async () => {
  if (!inputText.value.trim()) return

  isTranslating.value = true
  try {
    const res = await translateText(inputText.value, 'auto', 'zh')
    result.value = {
      translation: res.explains,
      from: 'en',
      to: 'zh',
      phonetic: res.phonetic,
      offline: res.platform === 'local'
    }
    if (res.errorMsg) {
      uni.showToast({ title: res.errorMsg, icon: 'none' })
    }
  } catch (e) {
    // 网络失败时尝试离线词典
    const offline = queryOfflineDict(inputText.value.trim())
    if (offline) {
      result.value = {
        translation: offline,
        from: 'en',
        to: 'zh',
        offline: true
      }
      uni.showToast({ title: '使用离线词典', icon: 'none' })
    } else {
      uni.showToast({ title: '翻译失败', icon: 'none' })
    }
  } finally {
    isTranslating.value = false
  }
}

const handleCapture = async () => {
  try {
    const adapter = getCaptureAdapter()
    const capture = await adapter.capture()
    uni.showToast({ title: '图片已获取', icon: 'success' })

    // 尝试 OCR
    try {
      const ocrRes = await adapter.ocr(capture.base64)
      if (ocrRes.length > 0) {
        ocrResult.value = ocrRes.map(r => r.text).join('\n')
        inputText.value = ocrResult.value
        // 自动翻译
        translate()
      } else {
        uni.showToast({ title: '未识别到文字', icon: 'none' })
      }
    } catch {
      // OCR 不可用，仅显示提示
      uni.showToast({ title: 'OCR 暂不可用', icon: 'none' })
    }
  } catch (e: any) {
    if (e.message !== '截图取消' && e.message !== '未选择图片') {
      uni.showToast({ title: e.message || '获取图片失败', icon: 'none' })
    }
  }
}
</script>

<style scoped>
.translate-container {
  padding: 30rpx;
  min-height: 100vh;
  background: #f5f5f5;
}

.input-section {
  position: relative;
  background: #fff;
  border-radius: 12rpx;
  padding: 20rpx;
  margin-bottom: 30rpx;
}

.input-area {
  width: 100%;
  height: 300rpx;
  font-size: 30rpx;
  line-height: 1.6;
}

.char-count {
  position: absolute;
  bottom: 20rpx;
  right: 20rpx;
  font-size: 24rpx;
  color: #999;
}

.action-row {
  display: flex;
  gap: 20rpx;
  margin-bottom: 30rpx;
}

.translate-btn {
  flex: 1;
  height: 90rpx;
  background: #1976d2;
  color: #fff;
  border-radius: 12rpx;
  font-size: 32rpx;
  border: none;
}

.translate-btn:disabled {
  background: #ccc;
}

.camera-btn {
  width: 200rpx;
  height: 90rpx;
  background: #4caf50;
  color: #fff;
  border-radius: 12rpx;
  font-size: 28rpx;
  border: none;
}

.ocr-section {
  background: #fff;
  border-radius: 12rpx;
  padding: 30rpx;
  margin-bottom: 30rpx;
  border-left: 8rpx solid #ff9800;
}

.result-section {
  background: #fff;
  border-radius: 12rpx;
  padding: 30rpx;
}

.result-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.result-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
}

.result-lang {
  font-size: 24rpx;
  color: #999;
}

.result-text {
  font-size: 34rpx;
  color: #333;
  line-height: 1.6;
  display: block;
}

.phonetic {
  margin-top: 20rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid #eee;
  font-size: 26rpx;
  color: #666;
}

.offline-tag {
  margin-top: 20rpx;
  padding: 16rpx;
  background: #fff3e0;
  border-radius: 8rpx;
  font-size: 24rpx;
  color: #e65100;
}
</style>
