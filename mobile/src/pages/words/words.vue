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
        <input 
          class="popup-input" 
          v-model="newWord.word"
          placeholder="输入单词"
        />
        <input 
          class="popup-input" 
          v-model="newWord.meaning"
          placeholder="输入释义"
        />
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

const wordsStore = useMobileWords()
const searchText = ref('')
const showAdd = ref(false)
const newWord = ref({ word: '', meaning: '' })

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
  newWord.value = { word: '', meaning: '' }
  showAdd.value = true
}

const closeAddDialog = () => {
  showAdd.value = false
}

const addWord = async () => {
  if (!newWord.value.word || !newWord.value.meaning) {
    uni.showToast({ title: '请填写完整信息', icon: 'none' })
    return
  }
  
  await wordsStore.addWord({
    word: newWord.value.word,
    meaning: newWord.value.meaning,
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
    content: word.meaning,
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
  width: 560rpx;
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
</style>
