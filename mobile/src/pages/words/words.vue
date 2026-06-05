<template>
  <view class="words-container">
    <view class="bank-selector" @click="goToWordBank" v-if="currentBankName">
      <text class="bank-label">当前词库：</text>
      <text class="bank-name-text">{{ currentBankName }}</text>
      <text class="bank-arrow">›</text>
    </view>

    <!-- 搜索栏 -->
    <view class="search-bar">
      <input 
        class="search-input" 
        v-model="filterState.pattern"
        placeholder="搜索单词/释义 (*通配符)"
      />
      <view class="search-actions">
        <view class="filter-toggle" :class="{ active: showFilterPanel }" @click="showFilterPanel = !showFilterPanel">
          <text class="filter-icon">◬</text>
        </view>
        <button class="add-btn" @click="showAddDialog">+</button>
      </view>
    </view>

    <!-- 筛选面板 -->
    <view v-if="showFilterPanel" class="filter-panel">
      <!-- 长度筛选 -->
      <view class="filter-row">
        <text class="filter-label">长度</text>
        <input class="filter-input" type="number" v-model.number="filterState.minLength" placeholder="最短" />
        <text class="filter-sep">~</text>
        <input class="filter-input" type="number" v-model.number="filterState.maxLength" placeholder="不限" />
      </view>
      <!-- 音标筛选 -->
      <view class="filter-row">
        <text class="filter-label">音标</text>
        <input class="filter-input wide" v-model="filterState.phonetic" placeholder="如 æ, ɪŋ" />
      </view>
      <!-- 排序 -->
      <view class="filter-row">
        <text class="filter-label">排序</text>
        <view class="sort-chips">
          <view
            v-for="opt in sortOptions"
            :key="opt.key"
            class="sort-chip"
            :class="{ on: filterState.sortBy === opt.key }"
            @click="toggleSort(opt.key)"
          >
            <text>{{ opt.label }}</text>
            <text v-if="filterState.sortBy === opt.key" class="sort-arrow">{{ filterState.sortAsc ? '↑' : '↓' }}</text>
          </view>
        </view>
      </view>
      <!-- 重置 -->
      <view class="filter-row" v-if="hasAnyFilter">
        <view class="reset-btn" @click="resetFilter">
          <text class="reset-text">清除筛选</text>
        </view>
      </view>
    </view>

    <!-- 列表模式切换（与桌面端对齐） -->
    <view class="mode-bar">
      <view class="mode-item" :class="{ active: listMode === 0 }" @click="listMode = 0">
        <text class="mode-num">{{ wordsStore.reviewWords.length }}</text>
        <text class="mode-label">待复习</text>
      </view>
      <view class="mode-item" :class="{ active: listMode === 1 }" @click="listMode = 1">
        <text class="mode-num">{{ wordsStore.words.filter(w => !w.needsReview && !w.remembered).length }}</text>
        <text class="mode-label">已复习</text>
      </view>
      <view class="mode-item" :class="{ active: listMode === 2 }" @click="listMode = 2">
        <text class="mode-num">{{ wordsStore.words.filter(w => w.remembered).length }}</text>
        <text class="mode-label">已记完</text>
      </view>
      <view class="mode-item" :class="{ active: listMode === 3 }" @click="listMode = 3">
        <text class="mode-num">{{ wordsStore.words.length }}</text>
        <text class="mode-label">全部</text>
      </view>
      <view class="mode-item" @click="goToReview">
        <text class="mode-action">去复习 →</text>
      </view>
    </view>

    <!-- 匹配数 -->
    <view v-if="hasAnyFilter || listMode !== 0" class="match-info">
      <text class="match-text">匹配 {{ filteredWords.length }} 个</text>
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
          <text v-else-if="word.remembered" class="remembered-badge">已记完</text>
          <text v-else class="reviewed-badge">已复习</text>
          <text class="word-level">Lv{{ word.level || 1 }}</text>
        </view>
      </view>
    </view>

    <view v-if="filteredWords.length === 0" class="empty-state">
      <text class="empty-text">暂无单词</text>
      <text class="empty-hint">点击右上角 + 添加单词，或去词库导入</text>
      <button class="btn-goto-bank" @click="goToWordBank">📚 去词库导入</button>
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
import { ref, computed, reactive, onMounted } from 'vue'
import { useMobileWords } from '@/stores/useMobileWords'
import { translateText } from '@/stores/useUtils'

const wordsStore = useMobileWords()
const showAdd = ref(false)
const translating = ref(false)
const newWord = ref({ 
  word: '', 
  meaning: '',
  phonetic: '',
  example: ''
})

// ========== 列表模式（与桌面端一致）==========
// 0=待复习 1=已复习 2=已记完 3=全部
const listMode = ref(0)

const currentBankName = computed(() => {
  const bank = wordsStore.getBankById(wordsStore.currentBankId)
  return bank?.name || ''
})

// ========== 筛选状态（与桌面端 WordFilter 对齐）==========
const filterState = reactive({
  minLength: 0,
  maxLength: 0,
  pattern: '',
  phonetic: '',
  sortBy: '',
  sortAsc: true
})

const showFilterPanel = ref(false)

// ========== 排序选项 ==========
const sortOptions = [
  { key: 'alpha', label: 'A-Z' },
  { key: 'length', label: '长度' },
  { key: 'time', label: '时间' },
  { key: 'level', label: '等级' }
]

function toggleSort(key: string) {
  if (filterState.sortBy === key) {
    filterState.sortAsc = !filterState.sortAsc
  } else {
    filterState.sortBy = key
    filterState.sortAsc = key === 'alpha' || key === 'level'
  }
}

// ========== 通配符转正则（与桌面端一致）==========
function patternToRegex(pattern: string): RegExp | null {
  if (!pattern.trim()) return null
  const trimmed = pattern.trim()
  try {
    if (trimmed.includes('*')) {
      const escaped = trimmed.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
      return new RegExp(`^${escaped}$`, 'i')
    }
    const escaped = trimmed.replace(/[.+^${}()|[\]\\]/g, '\\$&')
    return new RegExp(escaped, 'i')
  } catch {
    return null
  }
}

const hasAnyFilter = computed(() =>
  filterState.minLength > 0 || filterState.maxLength > 0 ||
  !!filterState.pattern || !!filterState.phonetic || !!filterState.sortBy
)

function resetFilter() {
  filterState.minLength = 0
  filterState.maxLength = 0
  filterState.pattern = ''
  filterState.phonetic = ''
  filterState.sortBy = ''
  filterState.sortAsc = true
}

// ========== 核心：筛选+排序 computed ==========
const filteredWords = computed(() => {
  // 第1步：根据 listMode 过滤
  let list = [...wordsStore.words]
  if (listMode.value === 0) {
    // 待复习
    list = list.filter(w => w.needsReview || !w.remembered)
  } else if (listMode.value === 1) {
    // 已复习（不需要复习但还没记完的）
    list = list.filter(w => !w.needsReview && !w.remembered)
  } else if (listMode.value === 2) {
    // 已记完
    list = list.filter(w => w.remembered)
  }
  // listMode === 3 全部，不过滤

  const f = filterState

  // 第2步：通配符/包含搜索（搜索单词+释义）
  if (f.pattern.trim()) {
    const regex = patternToRegex(f.pattern)
    if (regex) {
      // 通配符模式：仅匹配单词本身（与桌面端一致）
      list = list.filter(w => regex.test(w.word.replace(/\s+/g, '')))
    } else {
      // 普通搜索：同时搜索单词和释义
      const keyword = f.pattern.toLowerCase().trim()
      list = list.filter(w =>
        w.word.toLowerCase().includes(keyword) ||
        w.meaning.toLowerCase().includes(keyword)
      )
    }
  }

  // 第3步：长度筛选
  if (f.minLength > 0 || f.maxLength > 0) {
    list = list.filter(w => {
      const len = w.word.replace(/\s+/g, '').length
      if (f.minLength > 0 && len < f.minLength) return false
      if (f.maxLength > 0 && len > f.maxLength) return false
      return true
    })
  }

  // 第4步：音标筛选
  if (f.phonetic.trim()) {
    const ph = f.phonetic.trim().toLowerCase()
    list = list.filter(w => w.phonetic && w.phonetic.toLowerCase().includes(ph))
  }

  // 第5步：排序
  if (f.sortBy) {
    const dir = f.sortAsc ? 1 : -1
    list = [...list].sort((a, b) => {
      switch (f.sortBy) {
        case 'alpha': return dir * a.word.localeCompare(b.word, 'en')
        case 'length': return dir * (a.word.length - b.word.length)
        case 'time': return dir * (a.addTime - b.addTime)
        case 'level': return dir * ((a.level || 1) - (b.level || 1))
        default: return 0
      }
    })
  }

  return list
})

onMounted(() => {
  // 数据由首页 loadWords 加载，通过 Pinia 响应式共享
})

const goToReview = () => {
  // 将当前筛选后的单词列表设为自定义复习列表
  wordsStore.setCustomReviewWords(filteredWords.value.length > 0 ? [...filteredWords.value] : null)
  uni.switchTab({ url: '/pages/review/review' })
}

const goToWordBank = () => {
  uni.navigateTo({ url: '/subPackages/pages-data/wordbank/wordbank' })
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
  if (newWord.value.meaning.trim()) return
  translating.value = true
  try {
    const result = await translateText(newWord.value.word.trim(), 'auto', 'zh')
    if (result.translatedText && result.translatedText !== newWord.value.word) {
      newWord.value.meaning = result.translatedText
    }
  } catch (e) {
    console.error('翻译失败:', e)
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
  const pages = getCurrentPages()
  const page = pages[pages.length - 1]
  const webview = page.$getAppWebview()
  const bitmap = new plus.nativeObj.Bitmap('screenshot')
  webview.draw(bitmap, () => {
    bitmap.clear()
    uni.showToast({ title: '请手动输入', icon: 'none' })
  }, () => {
    uni.showToast({ title: '截屏失败', icon: 'none' })
  })
  // #endif
  // #ifdef MP-WEIXIN
  uni.chooseImage({
    count: 1,
    sourceType: ['album', 'camera'],
    success: () => {
      uni.showModal({
        title: '提示',
        content: 'OCR 功能需要接入第三方服务，请手动输入单词',
        showCancel: false
      })
    },
    fail: () => {
      uni.showToast({ title: '选择图片失败', icon: 'none' })
    }
  })
  // #endif
  // #ifdef H5
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = () => {
    uni.showModal({
      title: '提示',
      content: 'H5 端 OCR 需要额外配置，请手动输入单词',
      showCancel: false
    })
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

.bank-selector {
  display: flex;
  align-items: center;
  padding: 16rpx 24rpx;
  background: #fff;
  border-bottom: 1rpx solid #eee;
}

.bank-label {
  font-size: 26rpx;
  color: #999;
}

.bank-name-text {
  font-size: 28rpx;
  color: #667eea;
  font-weight: bold;
  margin: 0 8rpx;
}

.bank-arrow {
  font-size: 28rpx;
  color: #ccc;
}

.search-bar {
  display: flex;
  padding: 20rpx;
  background: #fff;
  gap: 16rpx;
  align-items: center;
}

.search-input {
  flex: 1;
  height: 72rpx;
  background: #f5f5f5;
  border-radius: 36rpx;
  padding: 0 30rpx;
  font-size: 28rpx;
}

.search-actions {
  display: flex;
  gap: 12rpx;
  align-items: center;
}

.filter-toggle {
  width: 72rpx;
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f0f2ff;
  border-radius: 50%;
  transition: all 0.2s;
}

.filter-toggle.active {
  background: #667eea;
}

.filter-toggle.active .filter-icon {
  color: #fff;
}

.filter-icon {
  font-size: 32rpx;
  color: #667eea;
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

/* 筛选面板 */
.filter-panel {
  background: #fff;
  padding: 20rpx 24rpx;
  border-bottom: 1rpx solid #eee;
}

.filter-row {
  display: flex;
  align-items: center;
  margin-bottom: 16rpx;
  gap: 12rpx;
}

.filter-row:last-child {
  margin-bottom: 0;
}

.filter-label {
  font-size: 26rpx;
  color: #666;
  width: 80rpx;
  flex-shrink: 0;
}

.filter-input {
  width: 140rpx;
  height: 60rpx;
  background: #f5f5f5;
  border-radius: 8rpx;
  padding: 0 16rpx;
  font-size: 26rpx;
}

.filter-input.wide {
  flex: 1;
  width: auto;
}

.filter-sep {
  font-size: 26rpx;
  color: #999;
}

.sort-chips {
  display: flex;
  gap: 12rpx;
  flex: 1;
  flex-wrap: wrap;
}

.sort-chip {
  display: flex;
  align-items: center;
  padding: 8rpx 20rpx;
  border-radius: 24rpx;
  background: #f0f2ff;
  font-size: 24rpx;
  color: #667eea;
}

.sort-chip.on {
  background: #667eea;
  color: #fff;
}

.sort-arrow {
  margin-left: 4rpx;
  font-size: 22rpx;
}

.reset-btn {
  padding: 8rpx 24rpx;
  border-radius: 24rpx;
  background: #fff0f0;
}

.reset-text {
  font-size: 24rpx;
  color: #e53935;
}

/* 列表模式切换 */
.mode-bar {
  display: flex;
  background: #fff;
  padding: 16rpx 0;
  border-bottom: 1rpx solid #eee;
}

.mode-item {
  flex: 1;
  text-align: center;
  border-right: 1rpx solid #eee;
}

.mode-item:last-child {
  border-right: none;
}

.mode-item.active {
  background: #f0f2ff;
}

.mode-num {
  font-size: 32rpx;
  font-weight: bold;
  color: #1976d2;
  display: block;
}

.mode-item.active .mode-num {
  color: #667eea;
}

.mode-label {
  font-size: 22rpx;
  color: #999;
  margin-top: 4rpx;
  display: block;
}

.mode-action {
  font-size: 26rpx;
  color: #4caf50;
  font-weight: bold;
  line-height: 80rpx;
}

/* 匹配数 */
.match-info {
  padding: 12rpx 24rpx;
  background: #fafafa;
}

.match-text {
  font-size: 24rpx;
  color: #999;
}

.btn-goto-bank {
  margin-top: 30rpx;
  background: #667eea;
  color: #fff;
  border-radius: 40rpx;
  font-size: 28rpx;
  border: none;
  padding: 0 40rpx;
  height: 80rpx;
  line-height: 80rpx;
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
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 420rpx;
}

.word-meta {
  text-align: right;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8rpx;
}

.review-badge {
  background: #ff5252;
  color: #fff;
  font-size: 20rpx;
  padding: 4rpx 12rpx;
  border-radius: 20rpx;
  display: inline-block;
}

.reviewed-badge {
  background: #e8f5e9;
  color: #4caf50;
  font-size: 20rpx;
  padding: 4rpx 12rpx;
  border-radius: 20rpx;
  display: inline-block;
}

.remembered-badge {
  background: #e3f2fd;
  color: #1976d2;
  font-size: 20rpx;
  padding: 4rpx 12rpx;
  border-radius: 20rpx;
  display: inline-block;
}

.word-level {
  font-size: 22rpx;
  color: #999;
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
