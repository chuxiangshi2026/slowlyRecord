<template>
  <view class="review-container">
    <view v-if="!currentWord" class="empty-state">
      <text class="empty-text">{{ emptyTitle }}</text>
      <text class="empty-hint">{{ emptyHint }}</text>
      <button v-if="wordsStore.customReviewWords !== null" class="btn-start-review" @click="goToWords">
        返回搜索单词
      </button>
      <button v-else-if="canStartReview" class="btn-start-review" @click="startReview">
        开始复习
      </button>
      <button v-else class="btn-start-review" @click="goToWords">
        去添加单词
      </button>
    </view>

    <view v-else class="review-area">
      <!-- 进度 -->
      <view class="progress-bar-top">
        <text class="progress-text">{{ currentIndex + 1 }} / {{ sessionWords.length }}</text>
        <view class="progress-track">
          <view class="progress-fill" :style="{ width: progressPercent + '%' }"></view>
        </view>
      </view>

      <!-- 手势提示 -->
      <view class="gesture-hints">
        <text class="hint-left">左划 忘记</text>
        <text class="hint-down">下划 已记完</text>
        <text class="hint-right">右划 认识</text>
      </view>

      <!-- 卡片（微信小程序用 catchtouch 阻止页面滚动） -->
      <view class="card-wrapper">
        <!-- 正面 -->
        <view
          v-if="!isFlipped"
          class="review-card card-front"
          :class="{ swiping: isSwiping }"
          :style="cardStyle"
          @touchstart.stop="handleTouchStart"
          @touchmove.stop="handleTouchMove"
          @touchend.stop="handleTouchEnd"
          @longpress.stop="handleLongPress"
          @tap="onCardTap"
        >
          <view class="card-top-bar">
            <view class="level-badge">Lv{{ currentWord.level || 1 }}</view>
          </view>
          <view class="word-section">
            <text class="word-text">{{ currentWord.word }}</text>
            <text class="phonetic" v-if="currentWord.phonetic">{{ currentWord.phonetic }}</text>
            <text class="flip-hint">点击翻转 / 长按删除</text>
          </view>
          <view class="quick-actions">
            <button class="btn-play" @tap.stop="playWord">🔊 发音</button>
          </view>
          <!-- 划动视觉反馈 -->
          <view v-if="swipeDirection === 'left'" class="swipe-overlay left">
            <text class="swipe-icon">❌</text>
            <text class="swipe-text">忘记</text>
          </view>
          <view v-if="swipeDirection === 'right'" class="swipe-overlay right">
            <text class="swipe-icon">✅</text>
            <text class="swipe-text">认识</text>
          </view>
          <view v-if="swipeDirection === 'down'" class="swipe-overlay down">
            <text class="swipe-icon">⭐</text>
            <text class="swipe-text">已记完</text>
          </view>
        </view>

        <!-- 背面 -->
        <view
          v-else
          class="review-card card-back"
          :class="{ swiping: isSwiping }"
          :style="cardStyle"
          @touchstart.stop="handleTouchStart"
          @touchmove.stop="handleTouchMove"
          @touchend.stop="handleTouchEnd"
          @longpress.stop="handleLongPress"
          @tap="onCardTap"
        >
          <view class="word-section">
            <text class="word-text">{{ currentWord.word }}</text>
            <text class="word-meaning">{{ displayMeaning }}</text>
            <text v-if="currentWord.example" class="word-example">{{ currentWord.example }}</text>
            <text v-if="offlineDictMeaning && offlineDictMeaning !== currentWord.meaning" class="offline-meaning">
              📚 离线释义：{{ offlineDictMeaning }}
            </text>
          </view>
          <view class="gesture-guide">
            <view class="guide-item left">
              <text class="guide-arrow">←</text>
              <text class="guide-label">忘记</text>
            </view>
            <view class="guide-item down">
              <text class="guide-arrow">↓</text>
              <text class="guide-label">已记完</text>
            </view>
            <view class="guide-item right">
              <text class="guide-arrow">→</text>
              <text class="guide-label">认识</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 操作按钮 -->
      <view class="action-buttons">
        <button class="btn-forget" @click="handleForget">
          <text class="btn-label">忘记</text>
        </button>
        <button class="btn-remember-forever" @click="handleRememberForever">
          <text class="btn-label">已记完</text>
        </button>
        <button class="btn-remember" @click="handleRemember">
          <text class="btn-label">认识</text>
        </button>
      </view>
    </view>

    <!-- 完成弹窗 -->
    <view v-if="showComplete" class="complete-overlay">
      <view class="complete-card">
        <text class="complete-icon">🎉</text>
        <text class="complete-title">复习完成</text>
        <view class="complete-stats">
          <view class="stat">
            <text class="stat-value">{{ sessionWords.length }}</text>
            <text class="stat-label">复习单词</text>
          </view>
          <view class="stat">
            <text class="stat-value success">{{ rememberCount }}</text>
            <text class="stat-label">认识</text>
          </view>
          <view class="stat">
            <text class="stat-value error">{{ forgetCount }}</text>
            <text class="stat-label">忘记</text>
          </view>
        </view>
        <button class="btn-done" @click="finishReview">完成</button>
      </view>
    </view>

    <!-- 长按删除确认 -->
    <view v-if="showDeleteConfirm" class="complete-overlay">
      <view class="complete-card">
        <text class="complete-title">确认删除</text>
        <text class="delete-word">{{ currentWord?.word }}</text>
        <text class="delete-hint">删除后将无法恢复</text>
        <view class="popup-actions">
          <button class="btn-cancel" @click="showDeleteConfirm = false">取消</button>
          <button class="btn-confirm-delete" @click="confirmDelete">删除</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useMobileWords, type MobileWord } from '@/stores/useMobileWords'
import { getTtsAdapter } from '@/adapters/index'
import { queryOfflineDict } from '@/stores/useUtils/offline-dict'

const wordsStore = useMobileWords()
const currentIndex = ref(0)
const isFlipped = ref(false)
const showComplete = ref(false)
const showDeleteConfirm = ref(false)
const rememberCount = ref(0)
const forgetCount = ref(0)

// 会话快照：本次复习的单词列表，进入页面时冻结
// 用快照而不是 store.reviewWords，确保：
// 1) 中途退出再回来能保留进度（结合 localStorage 持久化）
// 2) 点"认识"后单词从 reviewWords 中消失时，不会导致跳卡
const sessionWords = ref<MobileWord[]>([])
const sessionBankId = ref<string>('')

const SESSION_STORAGE_KEY = 'mobile_review_session'

interface ReviewSession {
  bankId: string
  isCustom: boolean
  wordIds: string[]
  currentIndex: number
  rememberCount: number
  forgetCount: number
  isFlipped: boolean
  updatedAt: number
}

// 手势状态
const touchStartX = ref(0)
const touchStartY = ref(0)
const touchStartTime = ref(0)
const cardOffsetX = ref(0)
const cardOffsetY = ref(0)
const cardRotate = ref(0)
const cardRotateX = ref(0)
const cardRotateY = ref(0)
const isAnimating = ref(false)
const isSwiping = ref(false)
const swipeDirection = ref<'left' | 'right' | 'down' | ''>('')

const reviewWords = computed(() => wordsStore.reviewWords)

const canStartReview = computed(() => reviewWords.value.length > 0 || wordsStore.words.length > 0)

const currentWord = computed(() => {
  return sessionWords.value[currentIndex.value]
})

const progressPercent = computed(() => {
  if (sessionWords.value.length === 0) return 0
  return Math.round(((currentIndex.value) / sessionWords.value.length) * 100)
})

const emptyTitle = computed(() => {
  if (wordsStore.customReviewWords !== null) return '筛选结果为空'
  return wordsStore.words.length === 0 ? '暂无单词' : '暂无待复习单词'
})

const emptyHint = computed(() => {
  if (wordsStore.customReviewWords !== null) return '当前筛选条件下没有单词，请返回调整筛选'
  return wordsStore.words.length === 0 ? '先去添加一些单词吧' : '所有单词都还没到复习时间'
})

// 离线词典释义（优先显示）
const offlineDictMeaning = computed(() => {
  if (!currentWord.value) return ''
  const dict = queryOfflineDict(currentWord.value.word)
  return dict || ''
})

// 显示的释义：优先离线词典，其次用户保存的释义
const displayMeaning = computed(() => {
  if (!currentWord.value) return ''
  return offlineDictMeaning.value || currentWord.value.meaning || '暂无释义'
})

// 卡片样式（手势位移 + 3D 翻转）
const cardStyle = computed(() => {
  const baseTransform = `translateX(${cardOffsetX.value}px) translateY(${cardOffsetY.value}px) rotate(${cardRotate.value}deg) rotateX(${cardRotateX.value}deg) rotateY(${cardRotateY.value}deg)`
  if (isAnimating.value) {
    return {
      transform: baseTransform,
      transition: 'transform 0.3s ease-out',
      opacity: Math.max(0.3, 1 - Math.abs(cardOffsetX.value) / 300),
    }
  }
  return {
    transform: baseTransform,
    transition: cardOffsetX.value === 0 && cardOffsetY.value === 0 && cardRotateX.value === 0 && cardRotateY.value === 0 ? 'transform 0.3s ease-out' : 'none',
  }
})

onMounted(() => {
  // 数据由首页 loadWords 加载，通过 Pinia 响应式共享，无需重复调用
  // 等数据准备好后尝试恢复未完成的复习会话；恢复不到则自动按当前待复习列表新建会话
  const tryInit = () => {
    if (wordsStore.isLoading) return false
    if (wordsStore.allWords.length === 0 && wordsStore.customReviewWords === null) return false
    // 带筛选进入时优先使用 customReviewWords，覆盖任何保存的常规会话
    if (wordsStore.customReviewWords !== null) {
      initSessionFromReviewWords()
      return true
    }
    if (!restoreSession()) {
      initSessionFromReviewWords()
    }
    return true
  }
  if (!tryInit()) {
    const stop = watch(
      () => [wordsStore.isLoading, wordsStore.allWords.length, wordsStore.customReviewWords] as const,
      () => {
        if (tryInit()) stop()
      }
    )
  }
})

/** 用当前 store.reviewWords 初始化一个新的复习会话 */
function initSessionFromReviewWords() {
  const list = reviewWords.value
  if (list.length === 0) {
    sessionWords.value = []
    sessionBankId.value = wordsStore.currentBankId
    clearSession()
    return
  }
  // 复制一份，避免引用 store 的响应式数组，单词被 store 移出 reviewWords 时不影响快照
  sessionWords.value = [...list]
  sessionBankId.value = wordsStore.currentBankId
  currentIndex.value = 0
  rememberCount.value = 0
  forgetCount.value = 0
  isFlipped.value = false
  persistSession()
}

/** 从存储恢复上一次未完成的复习会话；返回是否恢复成功 */
function restoreSession(): boolean {
  let saved: ReviewSession | null = null
  try {
    const raw = uni.getStorageSync(SESSION_STORAGE_KEY)
    if (raw && typeof raw === 'object') saved = raw as ReviewSession
  } catch {
    return false
  }
  if (!saved || !Array.isArray(saved.wordIds) || saved.wordIds.length === 0) return false

  // 自定义复习列表（从筛选页面跳转）由 store 维护，不在这里恢复
  if (saved.isCustom) return false
  if (saved.bankId !== wordsStore.currentBankId) {
    // 词库已切换，丢弃旧会话
    clearSession()
    return false
  }

  const idMap = new Map(wordsStore.allWords.map(w => [w.id, w]))
  const restored: MobileWord[] = []
  for (const id of saved.wordIds) {
    const w = idMap.get(id)
    if (w) restored.push(w)
  }
  if (restored.length === 0) {
    clearSession()
    return false
  }

  sessionWords.value = restored
  sessionBankId.value = saved.bankId
  // 防止恢复到一个越界 / 已被删的下标
  currentIndex.value = Math.min(saved.currentIndex || 0, restored.length - 1)
  rememberCount.value = saved.rememberCount || 0
  forgetCount.value = saved.forgetCount || 0
  isFlipped.value = !!saved.isFlipped
  return true
}

/** 把当前会话快照写入存储（custom 筛选模式下不持久化，因为筛选列表本身不持久化） */
function persistSession() {
  if (wordsStore.customReviewWords !== null) return
  if (sessionWords.value.length === 0) {
    clearSession()
    return
  }
  const session: ReviewSession = {
    bankId: sessionBankId.value,
    isCustom: false,
    wordIds: sessionWords.value.map(w => w.id),
    currentIndex: currentIndex.value,
    rememberCount: rememberCount.value,
    forgetCount: forgetCount.value,
    isFlipped: isFlipped.value,
    updatedAt: Date.now()
  }
  try {
    uni.setStorageSync(SESSION_STORAGE_KEY, session)
  } catch (e) {
    console.error('保存复习进度失败:', e)
  }
}

function clearSession() {
  try {
    uni.removeStorageSync(SESSION_STORAGE_KEY)
  } catch {
    // ignore
  }
}

const startReview = () => {
  if (wordsStore.words.length > 0 && reviewWords.value.length === 0) {
    const all = wordsStore.words
    for (let i = 0; i < all.length; i++) {
      const w = all[i]
      if (!w.needsReview) {
        wordsStore.updateWord(w.id, { needsReview: true })
      }
    }
  }
  // 把当前待复习单词冻结为本次会话
  initSessionFromReviewWords()
}

const goToWords = () => {
  uni.switchTab({ url: '/pages/words/words' })
}

const playWord = () => {
  if (currentWord.value?.word) {
    try {
      const tts = getTtsAdapter()
      tts.speak(currentWord.value.word, { lang: 'en-US', rate: 0.8 })
    } catch {
      // TTS 不可用，静默失败
    }
  }
}

// ==================== 手势处理（微信小程序兼容）====================

const handleTouchStart = (e: any) => {
  if (isAnimating.value) return
  const t = e.touches[0]
  touchStartX.value = t.clientX
  touchStartY.value = t.clientY
  touchStartTime.value = Date.now()
  isSwiping.value = false
  swipeDirection.value = ''
}

const handleTouchMove = (e: any) => {
  if (isAnimating.value) return
  const t = e.touches[0]
  const deltaX = t.clientX - touchStartX.value
  const deltaY = t.touches[0].clientY - touchStartY.value
  const absX = Math.abs(deltaX)
  const absY = Math.abs(deltaY)

  // 超过阈值才开始响应
  if (absX > 10 || absY > 10) {
    isSwiping.value = true
  }

  // 限制位移范围
  cardOffsetX.value = deltaX * 0.6
  cardOffsetY.value = deltaY > 0 ? deltaY * 0.6 : deltaY * 0.3
  cardRotate.value = deltaX * 0.03

  // 3D 翻转：根据划动方向动态旋转
  if (absX > absY) {
    // 左右划动：绕 Y 轴翻转
    cardRotateY.value = deltaX * 0.08
    cardRotateX.value = 0
  } else if (deltaY > 0) {
    // 向下划动：绕 X 轴翻转
    cardRotateX.value = deltaY * 0.08
    cardRotateY.value = 0
  } else {
    cardRotateX.value = 0
    cardRotateY.value = 0
  }

  // 实时显示划动方向
  if (absX > absY && absX > 40) {
    swipeDirection.value = deltaX > 0 ? 'right' : 'left'
  } else if (absY > absX && absY > 40 && deltaY > 0) {
    swipeDirection.value = 'down'
  } else {
    swipeDirection.value = ''
  }
}

const handleTouchEnd = (e: any) => {
  if (isAnimating.value) return
  const t = e.changedTouches[0]
  const deltaX = t.clientX - touchStartX.value
  const deltaY = t.clientY - touchStartY.value
  const absX = Math.abs(deltaX)
  const absY = Math.abs(deltaY)
  const duration = Date.now() - touchStartTime.value

  // 快速点击（短位移+短时间）= 翻转卡片
  if (absX < 30 && absY < 30 && duration < 300) {
    isSwiping.value = false
    swipeDirection.value = ''
    resetCard()
    flipCard()
    return
  }

  // 判断手势方向
  if (absX > absY && absX > 80) {
    if (deltaX > 0) {
      animateCard('right', () => handleRemember())
    } else {
      animateCard('left', () => handleForget())
    }
  } else if (absY > absX && absY > 80 && deltaY > 0) {
    animateCard('down', () => handleRememberForever())
  } else {
    resetCard()
  }
  isSwiping.value = false
  swipeDirection.value = ''
}

const onCardTap = () => {
  // tap 事件在划动时不应触发
  if (!isSwiping.value && !isAnimating.value) {
    flipCard()
  }
}

const flipCard = () => {
  isFlipped.value = !isFlipped.value
}

// 长按删除
const handleLongPress = () => {
  if (currentWord.value) {
    showDeleteConfirm.value = true
  }
}

const confirmDelete = () => {
  if (currentWord.value) {
    const deletedId = currentWord.value.id
    wordsStore.deleteWord(deletedId)
    showDeleteConfirm.value = false
    uni.showToast({ title: '已删除', icon: 'success' })
    // 同步从会话快照中移除
    sessionWords.value = sessionWords.value.filter(w => w.id !== deletedId)
    if (sessionWords.value.length === 0) {
      showComplete.value = true
    } else if (currentIndex.value >= sessionWords.value.length) {
      currentIndex.value = sessionWords.value.length - 1
    }
    isFlipped.value = false
    persistSession()
  }
}

// 动画卡片滑出
const animateCard = (direction: 'left' | 'right' | 'down', callback: () => void) => {
  isAnimating.value = true
  if (direction === 'right') {
    cardOffsetX.value = 400
    cardRotate.value = 20
    cardRotateY.value = 45
  } else if (direction === 'left') {
    cardOffsetX.value = -400
    cardRotate.value = -20
    cardRotateY.value = -45
  } else if (direction === 'down') {
    cardOffsetY.value = 500
    cardRotateX.value = 45
  }

  setTimeout(() => {
    callback()
    cardOffsetX.value = 0
    cardOffsetY.value = 0
    cardRotate.value = 0
    cardRotateX.value = 0
    cardRotateY.value = 0
    isAnimating.value = false
  }, 300)
}

const resetCard = () => {
  cardOffsetX.value = 0
  cardOffsetY.value = 0
  cardRotate.value = 0
  cardRotateX.value = 0
  cardRotateY.value = 0
}

// ==================== 操作处理 ====================

const handleRemember = () => {
  if (currentWord.value) {
    wordsStore.markAsRemembered(currentWord.value.id)
    rememberCount.value++
    nextWord()
  }
}

const handleForget = () => {
  if (currentWord.value) {
    wordsStore.markAsForgotten(currentWord.value.id)
    forgetCount.value++
    nextWord()
  }
}

const handleRememberForever = () => {
  if (currentWord.value) {
    wordsStore.updateWord(currentWord.value.id, {
      remembered: true,
      needsReview: false,
      nextReviewTime: Date.now() + 100 * 365 * 24 * 60 * 60 * 1000,
      level: 14
    })
    rememberCount.value++
    nextWord()
  }
}

const nextWord = () => {
  isFlipped.value = false
  if (currentIndex.value < sessionWords.value.length - 1) {
    currentIndex.value++
    persistSession()
  } else {
    showComplete.value = true
    clearSession()
  }
}

const finishReview = () => {
  showComplete.value = false
  currentIndex.value = 0
  rememberCount.value = 0
  forgetCount.value = 0
  sessionWords.value = []
  clearSession()
  // 清除自定义复习列表，下次进入时恢复默认
  wordsStore.setCustomReviewWords(null)
  uni.showToast({ title: '复习完成', icon: 'success' })
}
</script>

<style scoped>
.review-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20rpx;
  display: flex;
  flex-direction: column;
}

.empty-state {
  text-align: center;
  padding: 60rpx;
  background: rgba(255,255,255,0.95);
  border-radius: 24rpx;
  margin: auto;
}

.empty-text {
  font-size: 40rpx;
  color: #333;
  display: block;
  font-weight: bold;
}

.empty-hint {
  font-size: 28rpx;
  color: #999;
  margin-top: 20rpx;
  display: block;
}

.btn-start-review {
  margin-top: 40rpx;
  background: #667eea;
  color: #fff;
  border-radius: 50rpx;
  height: 90rpx;
  font-size: 32rpx;
  border: none;
}

/* 复习区域 */
.review-area {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.progress-bar-top {
  padding: 20rpx 0;
}

.progress-text {
  font-size: 26rpx;
  color: rgba(255,255,255,0.9);
  text-align: center;
  display: block;
}

.progress-track {
  height: 8rpx;
  background: rgba(255,255,255,0.3);
  border-radius: 4rpx;
  margin-top: 16rpx;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #fff;
  border-radius: 4rpx;
  transition: width 0.3s;
}

/* 手势提示 */
.gesture-hints {
  display: flex;
  justify-content: space-between;
  padding: 10rpx 20rpx;
  margin-bottom: 10rpx;
}

.hint-left, .hint-down, .hint-right {
  font-size: 22rpx;
  color: rgba(255,255,255,0.7);
}

.hint-left { color: #ffab40; }
.hint-down { color: #69f0ae; }
.hint-right { color: #4caf50; }

/* 卡片容器 */
.card-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20rpx;
  perspective: 1200rpx;
}

.review-card {
  background: #fff;
  border-radius: 24rpx;
  width: 100%;
  max-width: 600rpx;
  min-height: 700rpx;
  position: relative;
  overflow: hidden;
  box-shadow: 0 20rpx 60rpx rgba(0,0,0,0.3);
  transform-style: preserve-3d;
  backface-visibility: hidden;
}

/* 卡片顶部栏（等级徽章） */
.card-top-bar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 10rpx;
}

.level-badge {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  font-size: 22rpx;
  font-weight: bold;
  padding: 6rpx 16rpx;
  border-radius: 20rpx;
  display: inline-block;
}

.card-front, .card-back {
  padding: 60rpx 40rpx;
  min-height: 700rpx;
  display: flex;
  flex-direction: column;
  transition: transform 0.3s, opacity 0.3s;
}

.card-back {
  background: #fff;
}

/* 划动视觉反馈 */
.swipe-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 24rpx;
  pointer-events: none;
}

.swipe-overlay.left {
  background: rgba(255, 82, 82, 0.15);
}

.swipe-overlay.right {
  background: rgba(76, 175, 80, 0.15);
}

.swipe-overlay.down {
  background: rgba(105, 240, 174, 0.15);
}

.swipe-icon {
  font-size: 80rpx;
  margin-bottom: 20rpx;
}

.swipe-text {
  font-size: 40rpx;
  font-weight: bold;
  color: #333;
}

/* 离线词典释义 */
.offline-meaning {
  font-size: 28rpx;
  color: #4caf50;
  margin-top: 20rpx;
  padding: 16rpx;
  background: #e8f5e9;
  border-radius: 12rpx;
  line-height: 1.5;
}

.word-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  pointer-events: none; /* 让触摸事件穿透到卡片，确保划动手势在任意位置都能响应 */
}

.word-text {
  font-size: 72rpx;
  font-weight: bold;
  color: #333;
}

.phonetic {
  font-size: 32rpx;
  color: #667eea;
  margin-top: 20rpx;
  font-family: 'Times New Roman', serif;
}

.flip-hint {
  font-size: 26rpx;
  color: #bbb;
  margin-top: 60rpx;
}

.word-meaning {
  font-size: 40rpx;
  color: #333;
  margin-top: 40rpx;
  line-height: 1.6;
}

.word-example {
  font-size: 28rpx;
  color: #999;
  margin-top: 30rpx;
  font-style: italic;
}

.quick-actions {
  display: flex;
  justify-content: center;
  margin-top: 40rpx;
  pointer-events: none; /* 父容器穿透 */
}

.btn-play {
  background: #f0f0f0;
  color: #667eea;
  border-radius: 50rpx;
  padding: 16rpx 40rpx;
  font-size: 28rpx;
  border: none;
  pointer-events: auto; /* 发音按钮仍需可点击 */
}

/* 背面手势引导 */
.gesture-guide {
  display: flex;
  justify-content: space-around;
  margin-top: 40rpx;
  padding-top: 40rpx;
  border-top: 1rpx solid #eee;
  pointer-events: none; /* 让触摸事件穿透到卡片 */
}

.guide-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
}

.guide-arrow {
  font-size: 40rpx;
}

.guide-label {
  font-size: 24rpx;
  color: #666;
}

.guide-item.left .guide-arrow { color: #ff5252; }
.guide-item.down .guide-arrow { color: #4caf50; }
.guide-item.right .guide-arrow { color: #4caf50; }

/* 底部操作按钮 */
.action-buttons {
  display: flex;
  gap: 20rpx;
  padding: 20rpx;
  margin-top: auto;
}

.btn-forget, .btn-remember, .btn-remember-forever {
  flex: 1;
  height: 100rpx;
  border-radius: 16rpx;
  font-size: 28rpx;
  border: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.btn-forget {
  background: #ff5252;
  color: #fff;
}

.btn-remember-forever {
  background: #69f0ae;
  color: #333;
}

.btn-remember {
  background: #4caf50;
  color: #fff;
}

.btn-label {
  font-size: 28rpx;
  font-weight: bold;
}

/* 完成弹窗 */
.complete-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.complete-card {
  background: #fff;
  border-radius: 24rpx;
  padding: 60rpx;
  text-align: center;
  width: 560rpx;
}

.complete-icon {
  font-size: 80rpx;
  display: block;
}

.complete-title {
  font-size: 40rpx;
  font-weight: bold;
  color: #333;
  margin-top: 20rpx;
  display: block;
}

.complete-stats {
  display: flex;
  justify-content: center;
  gap: 40rpx;
  margin: 40rpx 0;
}

.stat {
  text-align: center;
}

.stat-value {
  font-size: 48rpx;
  font-weight: bold;
  color: #333;
  display: block;
}

.stat-value.success {
  color: #4caf50;
}

.stat-value.error {
  color: #ff5252;
}

.stat-label {
  font-size: 24rpx;
  color: #999;
  margin-top: 8rpx;
  display: block;
}

.btn-done {
  background: linear-gradient(90deg, #667eea, #764ba2);
  color: #fff;
  border-radius: 50rpx;
  height: 90rpx;
  font-size: 32rpx;
  border: none;
  width: 100%;
}

/* 删除确认 */
.delete-word {
  font-size: 36rpx;
  font-weight: bold;
  color: #333;
  margin: 20rpx 0;
  display: block;
}

.delete-hint {
  font-size: 26rpx;
  color: #999;
  margin-bottom: 30rpx;
  display: block;
}

.popup-actions {
  display: flex;
  gap: 20rpx;
}

.btn-cancel, .btn-confirm-delete {
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

.btn-confirm-delete {
  background: #ff5252;
  color: #fff;
}
</style>
