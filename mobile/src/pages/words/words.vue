<template>
  <view class="words-container">
    <view class="search-bar">
      <input 
        class="search-input" 
        v-model="searchText"
        placeholder="搜索单词..."
        @confirm="handleSearch"
      />
      <button class="add-btn" @click="showAddDialog">+</button>
    </view>

    <view class="word-list">
      <view 
        v-for="word in filteredWords" 
        :key="word.id"
        class="word-item"
        @click="showWordDetail(word)"
      >
        <view class="word-info">
          <text class="word-text">{{ word.word }}</text>
          <text class="word-meaning">{{ word.meaning }}</text>
        </view>
        <view class="word-meta">
          <text v-if="word.needsReview" class="review-badge">待复习</text>
          <text class="word-date">{{ formatDate(word.addTime) }}</text>
        </view>
      </view>
    </view>

    <view v-if="filteredWords.length === 0" class="empty-state">
      <text class="empty-text">暂无单词</text>
      <text class="empty-hint">点击右上角 + 添加单词</text>
    </view>

    <!-- 添加单词弹窗 -->
    <view v-if="showAdd" class="popup-overlay" @click="closeAddDialog">
      <view class="popup-content" @click.stop>
        <view class="popup-title">添加单词</view>
        
        <!-- 输入单词 -->
        <view class="input-row">
          <input 
            class="popup-input" 
            v-model="newWord.word"
            placeholder="输入单词（如：apple）"
            @blur="autoTranslate"
            @confirm="autoTranslate"
          />
          <button class="btn-translate" :loading="translating" @click="autoTranslate">
            {{ translating ? '翻译中' : '翻译' }}
          </button>
        </view>
        
        <!-- 释义 -->
        <input 
          class="popup-input" 
          v-model="newWord.meaning"
          placeholder="释义（自动填充或手动输入）"
        />
        
        <!-- 音标（可选） -->
        <input 
          class="popup-input" 
          v-model="newWord.phonetic"
          placeholder="音标（可选）"
        />
        
        <!-- 例句（可选） -->
        <input 
          class="popup-input" 
          v-model="newWord.example"
          placeholder="例句（可选）"
        />

        <!-- 快捷操作 -->
        <view class="quick-actions">
          <button class="btn-quick" @click="pasteFromClipboard">
            <text class="quick-icon">📋</text>
            <text>粘贴</text>
          </button>
          <button class="btn-quick" @click="captureScreen">
            <text class="quick-icon">📷</text>
            <text>截屏识别</text>
          </button>
        </view>

        <view class="popup-actions">
          <button class="btn-cancel" @click="closeAddDialog">取消</button>
          <button class="btn-confirm" @click="addWord">确定</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useMobileWords } from '@/stores/useMobileWords'
import { translateText } from '@/utils/translation-api'

const wordsStore = useMobileWords()
const searchText = ref('')
const showAdd = ref(false)
const translating = ref(false)
const newWord = ref({ 
  word: '', 
  meaning: '',
  phonetic: '',
  example: ''
})

const filteredWords = computed(() => {
  if (!searchText.value) return wordsStore.words
  const keyword = searchText.value.toLowerCase()
  return wordsStore.words.filter(w => 
    w.word.toLowerCase().includes(keyword) ||
    w.meaning.toLowerCase().includes(keyword)
  )
})

onMounted(() => {
  wordsStore.loadWords()
})

const handleSearch = () => {
  // 搜索逻辑已在 computed 中处理
}

const showAddDialog = () => {
  newWord.value = { word: '', meaning: '', phonetic: '', example: '' }
  showAdd.value = true
}

const closeAddDialog = () => {
  showAdd.value = false
}

// 自动翻译
const autoTranslate = async () => {
  if (!newWord.value.word.trim() || translating.value) return
  
  // 如果已有释义，不覆盖
  if (newWord.value.meaning.trim()) return
  
  translating.value = true
  try {
    const result = await translateText(newWord.value.word.trim(), 'auto', 'zh')
    if (result.translatedText && result.translatedText !== newWord.value.word) {
      newWord.value.meaning = result.translatedText
    }
  } catch (e) {
    console.error('翻译失败:', e)
    // 静默失败，用户可手动输入
  } finally {
    translating.value = false
  }
}

// 从剪贴板粘贴
const pasteFromClipboard = async () => {
  try {
    // #ifdef H5
    const text = await navigator.clipboard.readText()
    if (text) {
      newWord.value.word = text.trim()
      autoTranslate()
    }
    // #endif
    
    // #ifdef MP-WEIXIN || APP-PLUS
    uni.getClipboardData({
      success: (res) => {
        if (res.data) {
          newWord.value.word = res.data.trim()
          autoTranslate()
        }
      },
      fail: () => {
        uni.showToast({ title: '剪贴板为空', icon: 'none' })
      }
    })
    // #endif
  } catch (e) {
    uni.showToast({ title: '粘贴失败', icon: 'none' })
  }
}

// 截屏识别（OCR）
const captureScreen = () => {
  // #ifdef APP-PLUS
  // App 端使用原生截屏
  const pages = getCurrentPages()
  const page = pages[pages.length - 1]
  const webview = page.$getAppWebview()
  const bitmap = new plus.nativeObj.Bitmap('screenshot')
  webview.draw(bitmap, () => {
    const base64 = bitmap.toBase64Data()
    bitmap.clear()
    // 调用 OCR 服务
    uni.showToast({ title: '识别中...', icon: 'loading' })
    // 这里可以接入 OCR API
    setTimeout(() => {
      uni.showToast({ title: '请手动输入', icon: 'none' })
    }, 1000)
  }, (err: any) => {
    uni.showToast({ title: '截屏失败', icon: 'none' })
  })
  // #endif

  // #ifdef MP-WEIXIN
  // 小程序端：选择图片然后 OCR
  uni.chooseImage({
    count: 1,
    sourceType: ['album', 'camera'],
    success: (res) => {
      const tempFilePath = res.tempFilePaths[0]
      uni.showLoading({ title: '识别中...' })
      // 使用微信 OCR 或第三方 OCR
      // 简化：提示用户手动输入
      setTimeout(() => {
        uni.hideLoading()
        uni.showModal({
          title: '提示',
          content: 'OCR 功能需要接入第三方服务，请手动输入单词',
          showCancel: false
        })
      }, 500)
    },
    fail: () => {
      uni.showToast({ title: '选择图片失败', icon: 'none' })
    }
  })
  // #endif

  // #ifdef H5
  // H5 端：选择图片
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = () => {
    const file = input.files?.[0]
    if (file) {
      uni.showLoading({ title: '识别中...' })
      // H5 端可用 Tesseract.js 等
      setTimeout(() => {
        uni.hideLoading()
        uni.showModal({
          title: '提示',
          content: 'H5 端 OCR 需要额外配置，请手动输入单词',
          showCancel: false
        })
      }, 500)
    }
  }
  input.click()
  // #endif
}

const addWord = async () => {
  if (!newWord.value.word || !newWord.value.meaning) {
    uni.showToast({ title: '请填写单词和释义', icon: 'none' })
    return
  }
  
  await wordsStore.addWord({
    word: newWord.value.word.trim(),
    meaning: newWord.value.meaning.trim(),
    phonetic: newWord.value.phonetic.trim() || undefined,
    example: newWord.value.example.trim() || undefined,
    addTime: Date.now(),
    reviewCount: 0,
    nextReviewTime: Date.now() + 24 * 60 * 60 * 1000
  })
  
  uni.showToast({ title: '添加成功', icon: 'success' })
  closeAddDialog()
}

const showWordDetail = (word: any) => {
  uni.showModal({
    title: word.word,
    content: `${word.meaning}\n${word.phonetic ? '[' + word.phonetic + ']' : ''}\n${word.example || ''}`,
    showCancel: true,
    confirmText: '删除',
    cancelText: '关闭',
    success: (res) => {
      if (res.confirm) {
        wordsStore.deleteWord(word.id)
        uni.showToast({ title: '已删除', icon: 'success' })
      }
    }
  })
}

const formatDate = (timestamp: number): string => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return `${date.getMonth() + 1}/${date.getDate()}`
}
</script>

<style scoped>
.words-container {
  min-height: 100vh;
  background: #f5f5f5;
}

.search-bar {
  display: flex;
  padding: 20rpx;
  background: #fff;
  gap: 20rpx;
}

.search-input {
  flex: 1;
  height: 72rpx;
  background: #f5f5f5;
  border-radius: 36rpx;
  padding: 0 30rpx;
  font-size: 28rpx;
}

.add-btn {
  width: 72rpx;
  height: 72rpx;
  background: #1976d2;
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40rpx;
  border: none;
  padding: 0;
  line-height: 72rpx;
}

.word-list {
  padding: 20rpx;
}

.word-item {
  background: #fff;
  border-radius: 12rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.word-info {
  flex: 1;
}

.word-text {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
  display: block;
}

.word-meaning {
  font-size: 26rpx;
  color: #666;
  margin-top: 8rpx;
  display: block;
}

.word-meta {
  text-align: right;
}

.review-badge {
  background: #ff5252;
  color: #fff;
  font-size: 20rpx;
  padding: 4rpx 12rpx;
  border-radius: 20rpx;
  display: inline-block;
}

.word-date {
  font-size: 22rpx;
  color: #999;
  margin-top: 8rpx;
  display: block;
}

.empty-state {
  text-align: center;
  padding: 100rpx 40rpx;
}

.empty-text {
  font-size: 32rpx;
  color: #999;
  display: block;
}

.empty-hint {
  font-size: 26rpx;
  color: #bbb;
  margin-top: 20rpx;
  display: block;
}

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
  max-height: 80vh;
  overflow-y: auto;
}

.popup-title {
  font-size: 36rpx;
  font-weight: bold;
  text-align: center;
  margin-bottom: 30rpx;
}

.input-row {
  display: flex;
  gap: 16rpx;
  margin-bottom: 20rpx;
}

.popup-input {
  flex: 1;
  height: 80rpx;
  background: #f5f5f5;
  border-radius: 8rpx;
  padding: 0 20rpx;
  font-size: 28rpx;
}

.btn-translate {
  width: 120rpx;
  height: 80rpx;
  background: #4caf50;
  color: #fff;
  border-radius: 8rpx;
  font-size: 26rpx;
  border: none;
  padding: 0;
}

.quick-actions {
  display: flex;
  gap: 16rpx;
  margin: 20rpx 0;
}

.btn-quick {
  flex: 1;
  height: 100rpx;
  background: #f5f5f5;
  border-radius: 12rpx;
  font-size: 24rpx;
  color: #666;
  border: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4rpx;
}

.quick-icon {
  font-size: 36rpx;
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
</style>
