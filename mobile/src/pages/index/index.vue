<template>
  <view class="home-container">
    <view class="header">
      <text class="title">慢记</text>
      <text class="subtitle">高效记忆，轻松学习</text>
    </view>

    <!-- 今日任务区：打开即见"今天该学什么"，一步直达 -->
    <view class="today-task">
      <!-- 主任务卡：今日待复习 -->
      <view class="task-main" :class="{ done: reviewCount === 0 && !isLibraryEmpty }" @click="goToMainTask">
        <view class="task-main-info">
          <text class="task-main-title">{{ mainTitle }}</text>
          <text class="task-main-num">{{ mainNum }}</text>
          <text class="task-main-hint">{{ mainHint }}</text>
        </view>
        <view v-if="showMainAction" class="task-main-action">{{ mainActionText }}</view>
      </view>
      <!-- 次级任务：文本记忆 / 错题 / 连续打卡 -->
      <view class="task-sub-list">
        <view class="task-sub" @click="goToTextMemory">
          <text class="task-sub-num">{{ textDueCount }}</text>
          <text class="task-sub-label">待背文本</text>
        </view>
        <view class="task-sub" @click="goToWrongWords">
          <text class="task-sub-num">{{ wrongWordsCount }}</text>
          <text class="task-sub-label">错题</text>
        </view>
        <view class="task-sub" @click="goToSignin">
          <text class="task-sub-num">{{ streakDays }}</text>
          <text class="task-sub-label">连续打卡</text>
        </view>
      </view>
    </view>

    <view class="stats-grid">
      <view class="stat-card" @click="goToWords">
        <text class="stat-num">{{ wordCount }}</text>
        <text class="stat-label">单词总数</text>
      </view>
      <view class="stat-card" @click="goToReview">
        <text class="stat-num">{{ reviewCount }}</text>
        <text class="stat-label">待复习</text>
      </view>
      <view class="stat-card" @click="goToSignin">
        <text class="stat-num">{{ streakDays }}</text>
        <text class="stat-label">连续打卡</text>
      </view>
      <view class="stat-card" @click="goToWords">
        <text class="stat-num">{{ todayLearned }}</text>
        <text class="stat-label">今日学习</text>
      </view>
      <view class="stat-card bank-card" @click="goToWordbank">
        <text class="stat-num bank-name">{{ currentBankName }}</text>
        <text class="stat-label">词库管理 ›</text>
      </view>
    </view>

    <view class="quick-actions">
      <view class="action-title">快速入口</view>
      <view class="action-list">
        <!-- 宫格与今日任务区去重：开始复习（主任务卡）与每日打卡（次级条）不再出现在宫格 -->
        <view class="action-item" @click="goToDictation">
          <view class="action-icon dictation">✏️</view>
          <text class="action-text">拼写练习</text>
        </view>
        <view class="action-item" @click="goToTranslate">
          <view class="action-icon translate">🌐</view>
          <text class="action-text">翻译取词</text>
        </view>
        <view class="action-item" @click="goToTextMemory">
          <view class="action-icon text">📜</view>
          <text class="action-text">文本记忆</text>
        </view>
        <view class="action-item" @click="goToNumberMemory">
          <view class="action-icon memory">🔢</view>
          <text class="action-text">数字记忆</text>
        </view>
        <view class="action-item" @click="goToAddWord">
          <view class="action-icon addword">➕</view>
          <text class="action-text">添加单词</text>
        </view>
        <view class="action-item" @click="goToAllFeatures">
          <view class="action-icon all">⋯</view>
          <text class="action-text">全部功能</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useMobileWords } from '@/stores/useMobileWords'
import { useTextMemory } from '@/stores/useTextMemory'
import { useSignin } from '@/stores/useSignin'

const wordsStore = useMobileWords()
const textStore = useTextMemory()
const signinStore = useSignin()

const wordCount = ref(0)
const reviewCount = ref(0)

// 连续打卡天数来自打卡 store
const streakDays = computed(() => signinStore.streakDays)

// 词库是否为空：新用户（0 词）与"今日已学完"是两种完全不同的状态，文案必须区分
const isLibraryEmpty = computed(() => wordsStore.wordCount === 0)

const mainTitle = computed(() => {
  if (isLibraryEmpty.value) return '开始你的记忆之旅'
  return reviewCount.value > 0 ? '今日待复习' : '今日已完成'
})

const mainNum = computed(() => {
  if (isLibraryEmpty.value) return '词库还是空的'
  return reviewCount.value > 0 ? reviewCount.value + ' 词' : '🎉 全部搞定'
})

const mainHint = computed(() => {
  if (isLibraryEmpty.value) return '先导入一个内置词库，马上开始'
  return reviewCount.value > 0 ? '点击开始复习 →' : '太棒了，继续保持！'
})

const mainActionText = computed(() => (isLibraryEmpty.value ? '去选词库' : '开始复习'))
const showMainAction = computed(() => isLibraryEmpty.value || reviewCount.value > 0)

// 文本记忆待背篇数（已接入遮挡回忆 SRS；无到期篇目时显示总篇数，保持入口可发现）
const textDueCount = computed(() => textStore.dueArticleCount || textStore.totalArticles)

// 错题数：低等级且复习过（与错题本页口径一致）
const wrongWordsCount = computed(() => {
  return wordsStore.words.filter(w => (w.level || 1) <= 2 && (w.reviewCount || 0) > 0).length
})

// 今日学习 = 当天新增数 + 当天复习数（字段为 mobile 特有的 addTime/lastReviewTime）
const todayLearned = computed(() => {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const start = todayStart.getTime()
  const all = wordsStore.allWords
  const added = all.filter(w => w.addTime >= start).length
  const reviewed = all.filter(w => (w.lastReviewTime || 0) >= start).length
  return added + reviewed
})

const currentBankName = computed(() => {
  const bank = wordsStore.getBankById(wordsStore.currentBankId)
  return bank?.name || '默认词库'
})

onMounted(() => {
  // 不 await，避免阻塞首屏渲染；数据加载后通过 watch 自动更新 UI
  wordsStore.loadWords()
  signinStore.loadRecords()
  textStore.load()
})

// 数据加载完成后自动更新统计
watch(() => wordsStore.wordCount, (count) => {
  wordCount.value = count
})
watch(() => wordsStore.reviewWords.length, (count) => {
  reviewCount.value = count
})

const goToWords = () => {
  uni.switchTab({ url: '/pages/words/words' })
}

const goToReview = () => {
  uni.switchTab({ url: '/pages/review/review' })
}

// 主任务卡点击：空词库时引导去选词库，否则进入复习
const goToMainTask = () => {
  if (isLibraryEmpty.value) {
    goToWordbank()
  } else {
    goToReview()
  }
}

const goToDictation = () => {
  uni.navigateTo({ url: '/subPackages/pages-tools/dictation/dictation' })
}

const goToTranslate = () => {
  uni.navigateTo({ url: '/subPackages/pages-tools/translate/translate' })
}

const goToSignin = () => {
  uni.navigateTo({ url: '/subPackages/pages-data/signin/signin' })
}

const goToWordbank = () => {
  uni.navigateTo({ url: '/subPackages/pages-data/wordbank/wordbank' })
}

const goToNumberMemory = () => {
  uni.navigateTo({ url: '/subPackages/pages-memory/number-memory/number-memory' })
}

const goToAddWord = () => {
  uni.navigateTo({ url: '/subPackages/pages-tools/add-word/add-word' })
}

const goToTextMemory = () => {
  uni.navigateTo({ url: '/subPackages/pages-memory/text-memory/text-memory' })
}

const goToWrongWords = () => {
  uni.navigateTo({ url: '/subPackages/pages-data/wrong-words/wrong-words' })
}

const goToAllFeatures = () => {
  uni.navigateTo({ url: '/pages/features/features' })
}
</script>

<style scoped>
.home-container {
  padding: 20rpx;
  min-height: 100vh;
  background: linear-gradient(180deg, #eaf1ea 0%, #f5f7f5 100%);
}

.header {
  text-align: center;
  padding: 40rpx 0;
}

.title {
  font-size: 48rpx;
  font-weight: bold;
  color: #52796f;
  display: block;
}

.subtitle {
  font-size: 28rpx;
  color: #666;
  margin-top: 10rpx;
  display: block;
}

/* ===== 今日任务区 ===== */
.today-task {
  margin-bottom: 30rpx;
}

.task-main {
  background: linear-gradient(135deg, #52796f 0%, #3d5a52 100%);
  border-radius: 24rpx;
  padding: 50rpx 40rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 8rpx 24rpx rgba(82, 121, 111, 0.35);
}

.task-main.done {
  background: linear-gradient(135deg, #83c5a8 0%, #52796f 100%);
}

.task-main-title {
  font-size: 28rpx;
  color: rgba(255, 255, 255, 0.85);
  display: block;
}

.task-main-num {
  font-size: 56rpx;
  font-weight: bold;
  color: #fff;
  margin-top: 10rpx;
  display: block;
}

.task-main-hint {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.7);
  margin-top: 16rpx;
  display: block;
}

.task-main-action {
  background: rgba(255, 255, 255, 0.2);
  border: 2rpx solid rgba(255, 255, 255, 0.6);
  color: #fff;
  font-size: 28rpx;
  font-weight: bold;
  padding: 20rpx 36rpx;
  border-radius: 50rpx;
}

.task-sub-list {
  display: flex;
  gap: 20rpx;
  margin-top: 20rpx;
}

.task-sub {
  flex: 1;
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx 0;
  text-align: center;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
}

.task-sub-num {
  font-size: 40rpx;
  font-weight: bold;
  color: #52796f;
  display: block;
}

.task-sub-label {
  font-size: 24rpx;
  color: #999;
  margin-top: 8rpx;
  display: block;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20rpx;
  margin: 30rpx 0;
}

.bank-card {
  grid-column: span 2;
}

.bank-name {
  font-size: 36rpx !important;
  color: #52796f !important;
}

.stat-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 30rpx;
  text-align: center;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
}

.stat-num {
  font-size: 48rpx;
  font-weight: bold;
  color: #52796f;
  display: block;
}

.stat-label {
  font-size: 24rpx;
  color: #666;
  margin-top: 10rpx;
  display: block;
}

.quick-actions {
  background: #fff;
  border-radius: 16rpx;
  padding: 30rpx;
  margin-top: 20rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
}

.action-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 20rpx;
}

.action-list {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16rpx;
}

.action-item {
  text-align: center;
  padding: 20rpx 0;
}

.action-icon {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto;
  font-size: 32rpx;
  color: #fff;
  font-weight: bold;
}

/* 主色 #52796f 系列的低饱和同族色 */
.action-icon.dictation { background: #3d5a52; }
.action-icon.translate { background: #74937d; }
.action-icon.text { background: #6f9a8d; }
.action-icon.memory { background: #5c7a6b; }
.action-icon.addword { background: #74937d; }
.action-icon.all { background: #97b1a6; }

.action-text {
  font-size: 24rpx;
  color: #666;
  margin-top: 10rpx;
  display: block;
}
</style>
