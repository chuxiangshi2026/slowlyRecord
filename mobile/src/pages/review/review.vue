<template>
  <view class="review-container" :class="themeClass">
    <AppBackground />
    <view v-if="!currentWord" class="empty-state">
      <text class="empty-text">{{ emptyTitle }}</text>
      <text class="empty-hint">{{ emptyHint }}</text>
      <button v-if="wordsStore.customReviewWords !== null" class="btn-start-review" @click="goToWords">
        返回搜索单词
      </button>
      <template v-else>
        <button v-if="canStartReview" class="btn-start-review" @click="onStartReviewClick">
          {{ earlyReviewText }}
        </button>
        <button v-else class="btn-start-review" @click="goToWords">
          去添加单词
        </button>
        <!-- 次要入口：练拼写不写入 SRS，不污染遗忘曲线 -->
        <button v-if="wordsStore.words.length > 0" class="btn-secondary" @click="goToDictation">
          ✏️ 练拼写
        </button>
      </template>
    </view>

    <view v-else class="review-area">
      <!-- 进度 + 自动发音开关 -->
      <view class="progress-bar-top">
        <view class="progress-row">
          <text class="progress-text">{{ currentIndex + 1 }} / {{ sessionWords.length }}</text>
          <view class="toggle-group">
            <view class="autoplay-toggle" @click="toggleAutoPlay">
              <text class="autoplay-icon">{{ autoPlay ? '🔊' : '🔇' }}</text>
              <text class="autoplay-label">自动发音</text>
            </view>
            <view class="autoplay-toggle" @click="toggleDirectMeaning">
              <text class="autoplay-icon">{{ directMeaning ? '👁' : '🙈' }}</text>
              <text class="autoplay-label">直接释义</text>
            </view>
          </view>
        </view>
        <view class="progress-track">
          <view class="progress-fill" :style="{ width: progressPercent + '%' }"></view>
        </view>
      </view>

      <!-- 升级飘字（Lv 提升时短暂展示于卡片区右上角） -->
      <LevelUpFloat v-if="levelUpFloat" :from="levelUpFloat.from" :to="levelUpFloat.to" />

      <!-- 手势提示（仅新手期显示，滑动判定满 10 次后自动隐藏） -->
      <view v-if="showGestureHints" class="gesture-hints">
        <text class="hint-left">左划 忘记</text>
        <text class="hint-down">下划 已记完</text>
        <text class="hint-right">右划 认识</text>
      </view>
      <!-- 手势说明找回入口（任何时期可查看） -->
      <view v-else class="gesture-help" @click="showGestureHelp">?</view>

      <!-- 卡片（微信小程序用 catchtouch 阻止页面滚动） -->
      <view class="card-wrapper">
        <!-- 正面（开启「直接释义」后不再渲染正面，卡片恒为释义面） -->
        <view
          v-if="!cardFlipped"
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
            <button class="btn-play" @tap.stop="playWord(true)">🔊 发音</button>
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

    <!-- 撤销浮动条：最近一次判定可撤销，几秒后自动消失 -->
    <view v-if="showUndoBar && !showComplete" class="undo-bar" @click="undoLastJudgement">
      <text class="undo-text">{{ undoLabel }}</text>
      <text class="undo-btn">撤销</text>
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
        <view class="complete-guides">
          <button
            v-if="canGoDictation"
            class="btn-guide"
            @click="goAfterReview('/subPackages/pages-tools/dictation/dictation')"
          >
            ✏️ 练拼写
          </button>
          <button
            v-if="wrongWordsCount > 0"
            class="btn-guide"
            @click="goAfterReview('/subPackages/pages-data/wrong-words/wrong-words')"
          >
            📕 看错题（{{ wrongWordsCount }}）
          </button>
          <button
            v-if="!signinStore.hasSignedToday"
            class="btn-guide"
            @click="goAfterReview('/subPackages/pages-data/signin/signin')"
          >
            📅 去打卡
          </button>
          <!-- #ifdef MP-WEIXIN || MP-TOUTIAO -->
          <button class="btn-guide" @click="handleShareResult">
            📤 分享战绩
          </button>
          <!-- #endif -->
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

    <!-- #ifdef MP-WEIXIN || MP-TOUTIAO -->
    <canvas
      type="2d"
      id="reviewShareCanvas"
      class="share-canvas"
      :style="{ width: REVIEW_CARD_WIDTH + 'px', height: REVIEW_CARD_HEIGHT + 'px' }"
    />
    <SharePreview v-model="sharePreviewVisible" :image="shareImage" />
    <!-- #endif -->
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, getCurrentInstance } from 'vue'
import { onShow, onShareAppMessage } from '@dcloudio/uni-app'
import { useMobileWords, type MobileWord, snapshotReviewState, type WordReviewState } from '@/stores/useMobileWords'
import { useSignin } from '@/stores/useSignin'
import { speakWord, stopSpeaking } from '@/utils/word-audio'
import { queryOfflineDict } from '@/stores/useUtils/offline-dict'
import { vibrateOnJudge } from '@/utils/practice-feedback'
import LevelUpFloat from '@/components/LevelUpFloat.vue'
import SharePreview from '@/components/SharePreview.vue'
import { renderCanvasCard } from '@/utils/share-card-canvas'
import {
  buildReviewShareInfo,
  drawReviewCard,
  REVIEW_CARD_WIDTH,
  REVIEW_CARD_HEIGHT,
} from '@/utils/review-share-card'
import { loadDailyGoal, countReviewedToday, checkGoalJustAchieved, DEFAULT_DAILY_GOAL } from '@/utils/daily-goal'
import { useAchievements } from '@/stores/useAchievements'

const instance = getCurrentInstance()
const wordsStore = useMobileWords()
const signinStore = useSignin()
const currentIndex = ref(0)
const isFlipped = ref(false)
const showComplete = ref(false)
const showDeleteConfirm = ref(false)
const rememberCount = ref(0)
const forgetCount = ref(0)
const shareImage = ref('')
const sharePreviewVisible = ref(false)
const sharing = ref(false)

// 每日目标：判定后据此给出"目标达成"轻反馈，进入页面时读取
const dailyGoal = ref(DEFAULT_DAILY_GOAL)

/** 判定后检查今日复习数是否恰好跨过目标线，跨过则轻 toast（不打断判定流程） */
const checkGoalReached = (before: number) => {
  const after = countReviewedToday(wordsStore.allWords)
  if (checkGoalJustAchieved(before, after, dailyGoal.value)) {
    uni.showToast({ title: '🎯 今日目标达成', icon: 'none' })
  }
}

// 翻面自动发音开关：默认开，持久化到 storage
const AUTOPLAY_STORAGE_KEY = 'slowlyrecord-review-autoplay'
const autoPlay = ref(true)

// 「直接显示释义」开关：默认关，持久化到 storage；开启后卡片无需点击即显示释义面
const DIRECT_MEANING_STORAGE_KEY = 'slowlyrecord-review-direct-meaning'
const directMeaning = ref(false)

// 卡片实际是否展示释义面：点击翻面 或 开启「直接释义」
const cardFlipped = computed(() => isFlipped.value || directMeaning.value)

const toggleAutoPlay = () => {
  autoPlay.value = !autoPlay.value
  try {
    uni.setStorageSync(AUTOPLAY_STORAGE_KEY, autoPlay.value)
  } catch {
    // 存储失败不影响本次使用
  }
}

const toggleDirectMeaning = () => {
  directMeaning.value = !directMeaning.value
  try {
    uni.setStorageSync(DIRECT_MEANING_STORAGE_KEY, directMeaning.value)
  } catch {
    // 存储失败不影响本次使用
  }
}

// 撤销：只保留最近一次的判定快照（字段快照 + 判定类型），配合浮动条撤回
interface LastJudgement {
  wordId: string
  state: WordReviewState
  label: string
  stat: 'remember' | 'forget' | 'forever'
}
const lastJudgement = ref<LastJudgement | null>(null)
const showUndoBar = ref(false)
const undoLabel = ref('')
let undoTimer: ReturnType<typeof setTimeout> | null = null

// 升级飘字：Lv 提升时短暂展示「Lv5 → 6」，1s 后消失（降级不飘，负反馈已有标红）
const levelUpFloat = ref<{ from: number; to: number } | null>(null)
let levelUpTimer: ReturnType<typeof setTimeout> | null = null
function triggerLevelUp(from: number, to: number) {
  levelUpFloat.value = { from, to }
  if (levelUpTimer) clearTimeout(levelUpTimer)
  levelUpTimer = setTimeout(() => {
    levelUpFloat.value = null
    levelUpTimer = null
  }, 1000)
}

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
const cardOffsetX = ref(0) // 保留声明兼容旧引用，实际使用 cardTransform
const cardOffsetY = ref(0)
const cardRotate = ref(0)
const cardRotateX = ref(0)
const cardRotateY = ref(0)
const isAnimating = ref(false)
const isSwiping = ref(false)

// 手势提示新手期：滑动判定满阈值后自动隐藏，减少常驻噪音
const SWIPE_HINT_THRESHOLD = 10
const swipeJudgeCount = ref(Number(uni.getStorageSync('slowlyrecord-review-swipe-count') || 0))
const showGestureHints = computed(() => swipeJudgeCount.value < SWIPE_HINT_THRESHOLD)
function showGestureHelp() {
  uni.showModal({ title: '手势说明', content: '左划=忘记，右划=认识，下划=已记完。底部按钮可随时点。', showCancel: false, confirmColor: '#52796f' })
}
function countSwipeJudge() {
  swipeJudgeCount.value++
  if (swipeJudgeCount.value === SWIPE_HINT_THRESHOLD) {
    uni.setStorageSync('slowlyrecord-review-swipe-count', swipeJudgeCount.value)
  }
}
const swipeDirection = ref<'left' | 'right' | 'down' | ''>('')

// 卡片变换状态：合并为一个对象，减少 touchmove 期间的 setData 次数
const cardTransform = ref({
  x: 0, y: 0, rotate: 0, rotateX: 0, rotateY: 0,
})

const reviewWords = computed(() => wordsStore.reviewWords)

// 错题数：低等级且复习过（与错题本页口径一致），>0 时完成页才显示"看错题"
const wrongWordsCount = computed(() => {
  return wordsStore.words.filter(w => (w.level || 1) <= 2 && (w.reviewCount || 0) > 0).length
})

// 拼写练习需要当前词库有单词才显示引导
const canGoDictation = computed(() => wordsStore.words.length > 0)

const canStartReview = computed(() => reviewWords.value.length > 0 || wordsStore.words.length > 0)

// 空态主按钮文案：如实说明会把全库未到期的词也纳入本次复习
const earlyReviewText = computed(() => `提前复习全部 ${wordsStore.words.length} 词`)

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

// 卡片样式：touchmove 期间高频更新，合并为单次对象赋值减少 setData
const cardStyle = computed(() => {
  const { x, y, rotate, rotateX, rotateY } = cardTransform.value
  const baseTransform = `translateX(${x}px) translateY(${y}px) rotate(${rotate}deg) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`
  if (isAnimating.value) {
    return {
      transform: baseTransform,
      transition: 'transform 0.3s ease-out',
      opacity: Math.max(0.3, 1 - Math.abs(x) / 300),
    }
  }
  return {
    transform: baseTransform,
    transition: x === 0 && y === 0 && rotateX === 0 && rotateY === 0 ? 'transform 0.3s ease-out' : 'none',
  }
})

// 记录上次用过的带筛选复习列表引用：同一引用（会话进行中切 tab 回来）不重置，新引用（再次「去复习」）才重开会话
let lastCustomWords: MobileWord[] | null = null

onShow(() => {
  // tab 页常驻不销毁：onShow 时若 store 中的带筛选列表是新引用，重开复习会话
  if (wordsStore.customReviewWords !== null && wordsStore.customReviewWords !== lastCustomWords) {
    lastCustomWords = wordsStore.customReviewWords
    initSessionFromReviewWords()
  }
})

onMounted(() => {
  // 打卡数据用于完成页"去打卡"引导判断
  signinStore.loadRecords()
  // 每日目标值（轻反馈用）
  dailyGoal.value = loadDailyGoal()
  // 恢复自动发音开关设置（默认开）
  try {
    const saved = uni.getStorageSync(AUTOPLAY_STORAGE_KEY)
    if (typeof saved === 'boolean') autoPlay.value = saved
  } catch {
    // 读取失败用默认值
  }
  // 恢复「直接显示释义」设置（默认关）
  try {
    const saved = uni.getStorageSync(DIRECT_MEANING_STORAGE_KEY)
    if (typeof saved === 'boolean') directMeaning.value = saved
  } catch {
    // 读取失败用默认值
  }
  // 数据由首页 loadWords 加载，通过 Pinia 响应式共享，无需重复调用
  // 等数据准备好后尝试恢复未完成的复习会话；恢复不到则自动按当前待复习列表新建会话
  const tryInit = () => {
    if (wordsStore.isLoading) return false
    if (wordsStore.allWords.length === 0 && wordsStore.customReviewWords === null) return false
    // 带筛选进入时优先使用 customReviewWords，覆盖任何保存的常规会话
    if (wordsStore.customReviewWords !== null) {
      lastCustomWords = wordsStore.customReviewWords
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

// 空态按钮：先弹确认说明"会绕过遗忘曲线"，确认后才强制全库待复习
const onStartReviewClick = () => {
  uni.showModal({
    title: '提前复习',
    content: '这会把还没到复习时间的单词也纳入本次复习，确认继续吗？',
    confirmText: '开始复习',
    cancelText: '再想想',
    success: (res) => {
      if (res.confirm) startReview()
    }
  })
}

const goToDictation = () => {
  uni.navigateTo({ url: '/subPackages/pages-tools/dictation/dictation' })
}

const startReview = () => {
  if (wordsStore.words.length > 0 && reviewWords.value.length === 0) {
    // 单次遍历批量标脏，避免逐词 updateWord 的 O(n²) 全量拷贝冻结大词库
    wordsStore.markAllNeedsReview()
  }
  // 把当前待复习单词冻结为本次会话
  initSessionFromReviewWords()
}

const goToWords = () => {
  uni.switchTab({ url: '/pages/words/words' })
}

const playWord = (userInitiated = false) => {
  const word = currentWord.value?.word
  if (!word) return
  // 全局统一发音入口：播前停旧音、代际防抢跑、预取下一词；自动发音失败静默
  speakWord(word, { userInitiated, prefetchNext: sessionWords.value[currentIndex.value + 1]?.word })
}

// 翻面显示释义时自动发音一次；新词出现（isFlipped 归 false）不播，先让用户回忆
watch(isFlipped, (flipped) => {
  if (flipped && autoPlay.value) playWord()
})

// 开启「直接释义」时新词一上卡释义即显示，视同翻面补一次自动发音
watch(currentWord, (word) => {
  if (word && directMeaning.value && autoPlay.value) playWord()
})

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
  const deltaY = t.clientY - touchStartY.value
  const absX = Math.abs(deltaX)
  const absY = Math.abs(deltaY)

  // 超过阈值才开始响应
  if (absX > 10 || absY > 10) {
    isSwiping.value = true
  }

  // 合并为单次赋值，减少 setData 触发次数
  const x = deltaX * 0.6
  const y = deltaY > 0 ? deltaY * 0.6 : deltaY * 0.3
  let rotate = deltaX * 0.03
  let rotateX = 0
  let rotateY = 0

  if (absX > absY) {
    rotateY = deltaX * 0.08
  } else if (deltaY > 0) {
    rotateX = deltaY * 0.08
  }

  cardTransform.value = { x, y, rotate, rotateX, rotateY }

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
    countSwipeJudge()
    if (deltaX > 0) {
      animateCard('right', () => handleRemember())
    } else {
      animateCard('left', () => handleForget())
    }
  } else if (absY > absX && absY > 80 && deltaY > 0) {
    countSwipeJudge()
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
    cardTransform.value = { x: 400, y: 0, rotate: 20, rotateX: 0, rotateY: 45 }
  } else if (direction === 'left') {
    cardTransform.value = { x: -400, y: 0, rotate: -20, rotateX: 0, rotateY: -45 }
  } else if (direction === 'down') {
    cardTransform.value = { x: 0, y: 500, rotate: 0, rotateX: 45, rotateY: 0 }
  }

  setTimeout(() => {
    callback()
    cardTransform.value = { x: 0, y: 0, rotate: 0, rotateX: 0, rotateY: 0 }
    isAnimating.value = false
  }, 300)
}

const resetCard = () => {
  cardTransform.value = { x: 0, y: 0, rotate: 0, rotateX: 0, rotateY: 0 }
}

// ==================== 操作处理 ====================

/** 判定前记录快照（供撤销），只保留最近一份 */
const captureJudgement = (word: MobileWord, label: string, stat: LastJudgement['stat']) => {
  lastJudgement.value = {
    wordId: word.id,
    state: snapshotReviewState(word),
    label,
    stat
  }
}

/** 判定后弹出可撤销浮动条；最后一张牌弹完成弹窗时不出现 */
const showUndoIfNeeded = () => {
  if (showComplete.value || !lastJudgement.value) return
  undoLabel.value = lastJudgement.value.label
  showUndoBar.value = true
  if (undoTimer) clearTimeout(undoTimer)
  undoTimer = setTimeout(() => {
    showUndoBar.value = false
    undoTimer = null
  }, 3500)
}

const handleRemember = () => {
  if (currentWord.value) {
    const wordId = currentWord.value.id
    const beforeLevel = currentWord.value.level || 1
    const reviewedBefore = countReviewedToday(wordsStore.allWords)
    captureJudgement(currentWord.value, '已标记为认识', 'remember')
    wordsStore.markAsRemembered(wordId)
    checkGoalReached(reviewedBefore)
    vibrateOnJudge('correct')
    // 升级判定：会话快照可能是旧引用，从 store 取判定后的最新 level 比较
    const afterLevel = wordsStore.words.find(w => w.id === wordId)?.level ?? beforeLevel
    if (afterLevel > beforeLevel) triggerLevelUp(beforeLevel, afterLevel)
    rememberCount.value++
    nextWord()
    showUndoIfNeeded()
  }
}

const handleForget = () => {
  if (currentWord.value) {
    const reviewedBefore = countReviewedToday(wordsStore.allWords)
    captureJudgement(currentWord.value, '已标记为忘记 · 降级', 'forget')
    wordsStore.markAsForgotten(currentWord.value.id)
    // 忘记不更新 lastReviewTime（store 口径），此处前后数一致，不会误触发目标达成
    checkGoalReached(reviewedBefore)
    vibrateOnJudge('wrong')
    forgetCount.value++
    nextWord()
    showUndoIfNeeded()
  }
}

const handleRememberForever = () => {
  if (currentWord.value) {
    const reviewedBefore = countReviewedToday(wordsStore.allWords)
    captureJudgement(currentWord.value, '已标记为已记完', 'forever')
    wordsStore.updateWord(currentWord.value.id, {
      remembered: true,
      needsReview: false,
      nextReviewTime: Date.now() + 100 * 365 * 24 * 60 * 60 * 1000,
      level: 12
    })
    // "已记完"同样不改 lastReviewTime，仅"认识"判定会计入今日目标进度
    checkGoalReached(reviewedBefore)
    vibrateOnJudge('correct')
    rememberCount.value++
    nextWord()
    showUndoIfNeeded()
  }
}

/** 撤销最近一次判定：恢复字段快照、卡片回到被判定位置（正面未答）、统计回退 */
const undoLastJudgement = () => {
  const j = lastJudgement.value
  if (!j) return
  if (undoTimer) {
    clearTimeout(undoTimer)
    undoTimer = null
  }
  wordsStore.updateWord(j.wordId, { ...j.state })
  if (j.stat === 'forget') {
    forgetCount.value = Math.max(0, forgetCount.value - 1)
  } else {
    rememberCount.value = Math.max(0, rememberCount.value - 1)
  }
  // nextWord 曾把下标推进一格，回退即插回队列当前位置
  currentIndex.value = Math.max(0, currentIndex.value - 1)
  isFlipped.value = false
  lastJudgement.value = null
  showUndoBar.value = false
  persistSession()
}

onUnmounted(() => {
  stopSpeaking()
  if (undoTimer) clearTimeout(undoTimer)
  if (levelUpTimer) clearTimeout(levelUpTimer)
})

const nextWord = () => {
  // 切词先停旧朗读，并作废旧词待完成的音源回退
  stopSpeaking()
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
  shareImage.value = ''
  sharePreviewVisible.value = false
  clearSession()
  // 清除自定义复习列表，下次进入时恢复默认
  wordsStore.setCustomReviewWords(null)
  uni.showToast({ title: '复习完成', icon: 'success' })
  // 复习完成后检查成就（累计复习词次、词库学完、错题清零等）
  useAchievements().checkNow()
}

/** 复习完成页分享：生成今日战绩卡并预览 */
async function handleShareResult() {
  if (sharing.value) return
  sharing.value = true
  uni.showLoading({ title: '生成中' })
  try {
    const reviewed = countReviewedToday(wordsStore.allWords) || sessionWords.value.length
    shareImage.value = await renderCanvasCard(
      instance,
      'reviewShareCanvas',
      REVIEW_CARD_WIDTH,
      REVIEW_CARD_HEIGHT,
      ctx => drawReviewCard(
        ctx,
        buildReviewShareInfo(
          new Date(),
          reviewed,
          signinStore.streakDays,
          dailyGoal.value,
          wordsStore.words.length
        )
      )
    )
    sharePreviewVisible.value = true
  } catch (e) {
    console.error('分享卡生成失败:', e)
    uni.showToast({ title: '分享图生成失败', icon: 'none' })
  } finally {
    uni.hideLoading()
    sharing.value = false
  }
}

onShareAppMessage(() => ({
  title: `今天我复习了 ${countReviewedToday(wordsStore.allWords) || sessionWords.value.length} 词，连续打卡 ${signinStore.streakDays} 天`,
  path: '/pages/index/index',
  imageUrl: shareImage.value || '',
}))

// 完成页引导：先收尾本次会话，再跳转到对应模块
const goAfterReview = (url: string) => {
  finishReview()
  uni.navigateTo({ url })
}
</script>

<style scoped>
.review-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #52796f 0%, #74937d 100%);
  padding: 20rpx;
  display: flex;
  flex-direction: column;
}

.empty-state {
  text-align: center;
  padding: 60rpx;
  background: var(--sr-card);
  border-radius: 24rpx;
  margin: auto;
}

.empty-text {
  font-size: 40rpx;
  color: var(--sr-text);
  display: block;
  font-weight: bold;
}

.empty-hint {
  font-size: 28rpx;
  color: var(--sr-text-3);
  margin-top: 20rpx;
  display: block;
}

.btn-start-review {
  margin-top: 40rpx;
  background: var(--sr-primary);
  color: var(--sr-on-primary);
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
  position: relative;
}

.progress-bar-top {
  padding: 20rpx 0;
}

.progress-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.toggle-group {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.autoplay-toggle {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 8rpx 20rpx;
  background: rgba(255,255,255,0.2);
  border-radius: 30rpx;
}

.autoplay-toggle:active {
  opacity: 0.7;
}

.autoplay-icon {
  font-size: 26rpx;
}

.autoplay-label {
  font-size: 22rpx;
  color: rgba(255,255,255,0.9);
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

/* 手势说明找回按钮（提示隐藏后显示） */
.gesture-help {
  align-self: flex-end;
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  background: rgba(255,255,255,0.25);
  color: #fff;
  font-size: 28rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 10rpx;
}

.hint-left, .hint-down, .hint-right {
  font-size: 22rpx;
  color: rgba(255,255,255,0.7);
}

.hint-left { color: #e6a23c; }
.hint-down { color: #83c5a8; }
.hint-right { color: var(--sr-primary); }

/* 卡片容器 */
.card-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20rpx;
  perspective: 1200rpx;
}

.review-card {
  background: var(--sr-card);
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
  background: linear-gradient(135deg, #52796f, #74937d);
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
  background: var(--sr-card);
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
  background: rgba(192, 86, 79, 0.15);
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
  color: var(--sr-text);
}

/* 离线词典释义 */
.offline-meaning {
  font-size: 28rpx;
  color: var(--sr-primary);
  margin-top: 20rpx;
  padding: 16rpx;
  background: var(--sr-primary-bg);
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
  color: var(--sr-text);
}

.phonetic {
  font-size: 32rpx;
  color: var(--sr-primary);
  margin-top: 20rpx;
  font-family: 'Times New Roman', serif;
}

.flip-hint {
  font-size: 26rpx;
  color: var(--sr-text-3);
  margin-top: 60rpx;
}

.word-meaning {
  font-size: 40rpx;
  color: var(--sr-text);
  margin-top: 40rpx;
  line-height: 1.6;
}

.word-example {
  font-size: 28rpx;
  color: var(--sr-text-3);
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
  background: var(--sr-card-2);
  color: var(--sr-primary);
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
  border-top: 1rpx solid var(--sr-border);
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
  color: var(--sr-text-2);
}

.guide-item.left .guide-arrow { color: #c0564f; }
.guide-item.down .guide-arrow { color: var(--sr-primary); }
.guide-item.right .guide-arrow { color: var(--sr-primary); }

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
  background: #c0564f;
  color: #fff;
}

.btn-remember-forever {
  background: #83c5a8;
  color: #333;
}

.btn-remember {
  background: var(--sr-primary);
  color: var(--sr-on-primary);
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
  background: var(--sr-mask);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.complete-card {
  background: var(--sr-card);
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
  color: var(--sr-text);
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
  color: var(--sr-text);
  display: block;
}

.stat-value.success {
  color: var(--sr-primary);
}

.stat-value.error {
  color: #c0564f;
}

.stat-label {
  font-size: 24rpx;
  color: var(--sr-text-3);
  margin-top: 8rpx;
  display: block;
}

.btn-done {
  background: linear-gradient(90deg, #52796f, #74937d);
  color: #fff;
  border-radius: 50rpx;
  height: 90rpx;
  font-size: 32rpx;
  border: none;
  width: 100%;
}

/* 完成页引导链：主色绿按钮 */
.complete-guides {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-bottom: 20rpx;
}

.btn-guide {
  background: var(--sr-primary);
  color: var(--sr-on-primary);
  border-radius: 50rpx;
  height: 84rpx;
  font-size: 30rpx;
  border: none;
  width: 100%;
  line-height: 84rpx;
}

/* 删除确认 */
.delete-word {
  font-size: 36rpx;
  font-weight: bold;
  color: var(--sr-text);
  margin: 20rpx 0;
  display: block;
}

.delete-hint {
  font-size: 26rpx;
  color: var(--sr-text-3);
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
  background: var(--sr-card-2);
  color: var(--sr-text-2);
}

.btn-confirm-delete {
  background: #c0564f;
  color: #fff;
}

/* 撤销浮动条：底部悬浮，点击整栏撤销 */
.undo-bar {
  position: fixed;
  left: 40rpx;
  right: 40rpx;
  bottom: 60rpx;
  background: rgba(51, 51, 51, 0.95);
  border-radius: 50rpx;
  padding: 24rpx 36rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  z-index: 900;
  box-shadow: 0 8rpx 30rpx rgba(0, 0, 0, 0.35);
}

.undo-text {
  font-size: 28rpx;
  color: rgba(255, 255, 255, 0.9);
}

.undo-btn {
  font-size: 28rpx;
  font-weight: bold;
  color: #83c5a8;
  padding: 0 10rpx;
}

/* 空态次要入口：练拼写不写入 SRS */
.btn-secondary {
  margin-top: 24rpx;
  background: rgba(82, 121, 111, 0.12);
  color: var(--sr-primary);
  border-radius: 50rpx;
  height: 84rpx;
  font-size: 30rpx;
  border: 2rpx solid var(--sr-primary);
}

/* 离屏画布：只用于生成分享图，不占布局 */
.share-canvas {
  position: fixed;
  left: -9999px;
  top: -9999px;
}
</style>
