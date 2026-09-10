<template>
  <view class="onboarding-container">
    <!-- 前 two 屏右上角的跳过入口 -->
    <text v-if="current < TOTAL - 1" class="skip-link" @click="skip">跳过</text>

    <swiper class="swiper" :current="current" @change="onSwiperChange">
      <!-- 第一屏：欢迎 -->
      <swiper-item>
        <view class="screen">
          <view class="hero">
            <text class="hero-emoji">🧠</text>
          </view>
          <text class="app-name">慢记</text>
          <text class="slogan">基于艾宾浩斯遗忘曲线的记忆训练</text>
          <text class="slogan-sub">在快要忘记的时候提醒你复习，记得更牢</text>
          <text class="next-hint">左滑了解能做什么 →</text>
        </view>
      </swiper-item>

      <!-- 第二屏：核心能力 -->
      <swiper-item>
        <view class="screen">
          <text class="screen-title">打开就能用</text>
          <view class="feature-list">
            <view v-for="f in FEATURES" :key="f.name" class="feature-item">
              <text class="feature-emoji">{{ f.emoji }}</text>
              <view class="feature-info">
                <text class="feature-name">{{ f.name }}</text>
                <text class="feature-desc">{{ f.desc }}</text>
              </view>
            </view>
          </view>
          <text class="next-hint">左滑开始 →</text>
        </view>
      </swiper-item>

      <!-- 第三屏：行动（多模块起点） -->
      <swiper-item>
        <view class="screen">
          <text class="screen-title">从哪儿开始？</text>
          <text class="screen-subtitle">选一个方向马上开始，其余功能之后随时可用</text>
          <scroll-view scroll-y class="start-scroll">
            <!-- 单词区 -->
            <view class="start-section">
              <text class="section-label">📖 背单词</text>
              <view
                v-for="bank in recommendedBanks"
                :key="bank.sourceId"
                class="start-card"
                :class="{ disabled: importing !== '' }"
                @click="importBank(bank)"
              >
                <text class="start-emoji">{{ bank.emoji }}</text>
                <view class="start-info">
                  <text class="start-name">{{ bank.name }}</text>
                  <text class="start-desc">{{ bank.desc }} · 前 {{ STARTER_WORD_COUNT }} 词</text>
                </view>
                <text class="start-action">{{ importing === bank.sourceId ? '导入中…' : '开始' }}</text>
              </view>
            </view>
            <!-- 文本背诵区 -->
            <view class="start-section">
              <text class="section-label">📜 背课文/诗词</text>
              <view class="start-card" @click="goTextMemory">
                <text class="start-emoji">📜</text>
                <view class="start-info">
                  <text class="start-name">文本背诵</text>
                  <text class="start-desc">遮挡分段背，先逛逛内置诗词库</text>
                </view>
                <text class="start-action plain">去看看</text>
              </view>
            </view>
            <!-- 公式/知识库区 -->
            <view class="start-section">
              <text class="section-label">📐 记公式/知识点</text>
              <view class="start-card" @click="goKnowledge">
                <text class="start-emoji">📐</text>
                <view class="start-info">
                  <text class="start-name">知识库</text>
                  <text class="start-desc">数学公式、元素周期表等 35 个知识包</text>
                </view>
                <text class="start-action plain">去看看</text>
              </view>
            </view>
          </scroll-view>
          <text class="skip-btn" @click="skip">跳过，随便看看</text>
        </view>
      </swiper-item>
    </swiper>

    <!-- 指示点 -->
    <view class="dots">
      <view v-for="i in TOTAL" :key="i" class="dot" :class="{ active: i - 1 === current }"></view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useMobileWords } from '@/stores/useMobileWords'
import { WORDBANK_LIST } from '@/stores/useUtils/wordbank'
import { inferMobileItemType, normalizeMobileItemText } from '@/stores/useUtils/text'
import { RECOMMENDED_BANKS, STARTER_WORD_COUNT, markOnboarded, type RecommendedBank } from '@/utils/onboarding'
import { STARTER_BANKS } from '@/utils/onboarding-starter-banks'

const TOTAL = 3
const current = ref(0)
const importing = ref('')

const wordsStore = useMobileWords()

// 核心能力列表：口语化一句话描述，第一次出现即解释
const FEATURES = [
  { emoji: '📅', name: '复习', desc: '到点提醒，卡片过一遍就能记住' },
  { emoji: '✏️', name: '拼写', desc: '看释义默写单词，专治拼不对' },
  { emoji: '📜', name: '文本背诵', desc: '课文、诗词分段遮挡，逐段背下来' },
  { emoji: '📚', name: '知识库', desc: '元素表、公式等知识包，边练边记' },
]

// 推荐词库：与词库管理页同一份元数据，展示总词数；起步只导入前 STARTER_WORD_COUNT 词
const recommendedBanks = computed(() =>
  RECOMMENDED_BANKS.map(bank => ({
    ...bank,
    wordCount: WORDBANK_LIST.find(w => w.id === bank.sourceId)?.wordCount || 0,
  }))
)

function onSwiperChange(e: any) {
  current.value = e.detail.current
}

// 完成引导：无论导入还是跳过都写标记，之后启动不再进入
function finish() {
  markOnboarded()
  uni.switchTab({ url: '/pages/index/index' })
}

function skip() {
  finish()
}

// 文本背诵/知识库入口：写标记后跳对应模块（分包页用 navigateTo）
function goTextMemory() {
  markOnboarded()
  uni.navigateTo({ url: '/subPackages/pages-memory/text-memory/import' })
}

function goKnowledge() {
  markOnboarded()
  uni.navigateTo({ url: '/subPackages/pages-knowledge/knowledge-list' })
}

// 一键导入推荐词库的前 STARTER_WORD_COUNT 词到默认词库，随后进首页
// 导入进度与 sourceId 按词库管理页的口径落库，用户之后可续导剩余部分
async function importBank(bank: RecommendedBank & { wordCount: number }) {
  if (importing.value) return
  importing.value = bank.sourceId
  try {
    await wordsStore.loadWords()
    const bankId = wordsStore.currentBankId
    const raw = STARTER_BANKS[bank.sourceId] || []
    const now = Date.now()
    const mobileWords = raw.map(w => {
      const wordText = normalizeMobileItemText(w.word || '')
      return {
        id: '',
        word: wordText,
        meaning: w.meaning || w.explains || '',
        phonetic: w.phonetic || undefined,
        example: w.example || undefined,
        itemType: inferMobileItemType(wordText),
        addTime: now,
        reviewCount: 0,
        nextReviewTime: now,
        bankId,
      }
    })
    wordsStore.setBankSource(bankId, 'builtin', bank.sourceId)
    await wordsStore.importWords(mobileWords, bankId)
    wordsStore.setImportProgress(bankId, bank.sourceId, raw.length)
    uni.showToast({ title: `已导入 ${raw.length} 词，开始吧`, icon: 'success' })
    setTimeout(finish, 600)
  } catch (e: any) {
    uni.showToast({ title: e?.message || '导入失败，请重试', icon: 'none' })
  } finally {
    importing.value = ''
  }
}
</script>

<style scoped>
.onboarding-container { position: relative; min-height: 100vh; background: linear-gradient(180deg, #eaf1ea 0%, #f5f8f5 100%); }
.skip-link { position: absolute; top: 40rpx; right: 40rpx; z-index: 10; font-size: 28rpx; color: #52796f; padding: 12rpx 24rpx; }
.swiper { height: 100vh; }
.screen { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80rpx 60rpx 160rpx; box-sizing: border-box; }

.hero { width: 220rpx; height: 220rpx; border-radius: 50%; background: #fff; display: flex; align-items: center; justify-content: center; box-shadow: 0 8rpx 32rpx rgba(82, 121, 111, 0.15); }
.hero-emoji { font-size: 110rpx; }
.app-name { font-size: 64rpx; font-weight: bold; color: #52796f; margin-top: 50rpx; }
.slogan { font-size: 34rpx; color: #333; margin-top: 24rpx; font-weight: bold; }
.slogan-sub { font-size: 28rpx; color: #888; margin-top: 16rpx; }
.next-hint { font-size: 24rpx; color: #a0b3ab; margin-top: 90rpx; }

.screen-title { font-size: 44rpx; font-weight: bold; color: #333; margin-bottom: 16rpx; }
.screen-subtitle { font-size: 24rpx; color: #888; margin-bottom: 40rpx; text-align: center; }
.feature-list { width: 100%; margin-top: 30rpx; }
.feature-item { display: flex; align-items: center; background: #fff; border-radius: 20rpx; padding: 30rpx; margin-bottom: 24rpx; box-shadow: 0 4rpx 16rpx rgba(82, 121, 111, 0.06); }
.feature-emoji { font-size: 48rpx; margin-right: 24rpx; }
.feature-info { flex: 1; }
.feature-name { font-size: 32rpx; font-weight: bold; color: #333; display: block; }
.feature-desc { font-size: 26rpx; color: #888; margin-top: 6rpx; display: block; }

.bank-list { width: 100%; }
.bank-card { display: flex; align-items: center; background: #fff; border-radius: 20rpx; padding: 30rpx; margin-bottom: 24rpx; box-shadow: 0 4rpx 16rpx rgba(82, 121, 111, 0.06); }
.bank-card.disabled { opacity: 0.6; }
.bank-emoji { font-size: 48rpx; margin-right: 24rpx; }
.bank-info { flex: 1; }
.bank-name { font-size: 32rpx; font-weight: bold; color: #333; display: block; }
.bank-desc { font-size: 24rpx; color: #888; margin-top: 6rpx; display: block; }
.bank-action { font-size: 26rpx; color: #fff; background: #52796f; border-radius: 32rpx; padding: 14rpx 28rpx; }
.skip-btn { font-size: 28rpx; color: #a0b3ab; margin-top: 20rpx; padding: 16rpx 40rpx; }

/* 行动屏多模块起点 */
.start-scroll { width: 100%; max-height: 55vh; }
.start-section { margin-bottom: 28rpx; }
.section-label { font-size: 26rpx; color: #74937d; font-weight: bold; margin-bottom: 12rpx; display: block; }
.start-card { display: flex; align-items: center; background: #fff; border-radius: 20rpx; padding: 24rpx 30rpx; margin-bottom: 16rpx; box-shadow: 0 4rpx 16rpx rgba(82, 121, 111, 0.06); }
.start-card.disabled { opacity: 0.6; }
.start-emoji { font-size: 44rpx; margin-right: 20rpx; }
.start-info { flex: 1; }
.start-name { font-size: 30rpx; font-weight: bold; color: #333; display: block; }
.start-desc { font-size: 24rpx; color: #888; margin-top: 4rpx; display: block; }
.start-action { font-size: 24rpx; color: #fff; background: #52796f; border-radius: 28rpx; padding: 10rpx 24rpx; }
.start-action.plain { background: #eaf1ea; color: #52796f; }

.dots { position: absolute; bottom: 60rpx; left: 0; right: 0; display: flex; justify-content: center; gap: 16rpx; }
.dot { width: 16rpx; height: 16rpx; border-radius: 50%; background: #c8d6d0; }
.dot.active { background: #52796f; width: 36rpx; border-radius: 8rpx; }
</style>
