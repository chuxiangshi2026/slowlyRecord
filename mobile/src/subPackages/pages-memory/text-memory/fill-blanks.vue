<template>
  <view class="fill-page" :class="themeClass">
    <AppBackground variant="landscape" />
    <!-- 文章信息 -->
    <view class="article-head">
      <text class="article-title">{{ article?.title || '填空练习' }}</text>
      <text v-if="article?.author" class="article-author">{{ article.author }}</text>
    </view>

    <!-- 操作条 -->
    <view class="toolbar">
      <view class="toolbar-btn" @click="rebuild">
        <text>换一批</text>
      </view>
      <view class="toolbar-btn" @click="revealAll">
        <text>全部揭示</text>
      </view>
      <text class="progress-text">已揭示 {{ revealedCount }}/{{ blankedCount }}</text>
    </view>
    <view class="toolbar chips">
      <view
        v-for="d in DIFFICULTIES"
        :key="d.rate"
        class="chip"
        :class="{ active: difficulty === d.rate }"
        @click="setDifficulty(d.rate)"
      >
        <text>{{ d.label }}</text>
      </view>
      <text class="hint-text">点空字格揭示，回忆全文后到底部自评</text>
    </view>

    <!-- 填空区 -->
    <scroll-view scroll-y class="content-scroll">
      <view class="cloze-list">
        <view v-for="(line, li) in lines" :key="li" class="cloze-line">
          <template v-for="item in line" :key="item.idx">
            <text
              v-if="item.unit.blanked"
              class="cloze-blank"
              :class="{ revealed: revealed[item.idx] }"
              @click="revealUnit(item.idx)"
            >{{ revealed[item.idx] ? item.unit.text : '＿' }}</text>
            <text v-else class="cloze-text">{{ item.unit.text }}</text>
          </template>
        </view>
      </view>
      <view class="bottom-placeholder" />
    </scroll-view>

    <!-- 底部自评 -->
    <view class="rate-bar">
      <button class="rate-btn forgot" @click="onRate(false)">
        <text>😅 还没记住</text>
      </button>
      <button class="rate-btn remembered" @click="onRate(true)">
        <text>✅ 记住了</text>
      </button>
    </view>

    <!-- 文章不存在 -->
    <view v-if="!article && loaded" class="empty-state">
      <text class="empty-icon">📭</text>
      <text class="empty-title">文章不存在或已删除</text>
      <button class="empty-back" @click="goBack">返回</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useTextMemory } from '@/stores/useTextMemory'
import type { MobileTextArticle } from '@/stores/useUtils/types'
import { buildClozeUnits, type ClozeUnit } from './fill-blanks'

const store = useTextMemory()

/** 难度档位：挖空比例 */
const DIFFICULTIES = [
  { label: '简单 15%', rate: 0.15 },
  { label: '中等 30%', rate: 0.3 },
  { label: '困难 50%', rate: 0.5 },
] as const

const article = ref<MobileTextArticle | null>(null)
const loaded = ref(false)
const units = ref<ClozeUnit[]>([])
const revealed = ref<boolean[]>([])
const difficulty = ref<number>(0.3)

interface LineItem {
  idx: number
  unit: ClozeUnit
}

/** 按换行分组渲染（换行符本身不渲染） */
const lines = computed<LineItem[][]>(() => {
  const out: LineItem[][] = [[]]
  units.value.forEach((unit, idx) => {
    if (unit.text === '\n') {
      out.push([])
    } else {
      out[out.length - 1].push({ idx, unit })
    }
  })
  return out.filter((l) => l.length > 0)
})

const blankedCount = computed(() => units.value.filter((u) => u.blanked).length)
const revealedCount = computed(() => revealed.value.filter(Boolean).length)

onLoad((opt: any) => {
  store.load()
  const id = opt?.id ? decodeURIComponent(opt.id) : ''
  const found = store.articles.find((a) => a._id === id)
  if (found) {
    article.value = found
    rebuild()
  }
  loaded.value = true
})

function rebuild() {
  if (!article.value) return
  units.value = buildClozeUnits(article.value.content, difficulty.value)
  revealed.value = units.value.map(() => false)
}

function setDifficulty(rate: number) {
  if (difficulty.value === rate) return
  difficulty.value = rate
  rebuild()
}

function revealUnit(idx: number) {
  revealed.value[idx] = true
}

function revealAll() {
  revealed.value = revealed.value.map(() => true)
}

function onRate(remembered: boolean) {
  if (!article.value) return
  store.rateArticle(article.value._id, remembered)
  uni.showToast({ title: remembered ? '太棒了，已记录' : '没关系，下次再来', icon: 'none' })
  setTimeout(() => uni.navigateBack(), 600)
}

function goBack() {
  uni.navigateBack()
}
</script>

<style scoped>
.fill-page {
  min-height: 100vh;
  background: var(--sr-bg);
  display: flex;
  flex-direction: column;
  position: relative;
  z-index: 0;
}

.article-head {
  background: linear-gradient(135deg, #52796f 0%, #3d5a52 100%);
  padding: 50rpx 40rpx 32rpx;
}
.article-title {
  font-size: 36rpx;
  font-weight: bold;
  color: #fff;
  display: block;
}
.article-author {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.85);
  margin-top: 8rpx;
  display: block;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 16rpx 24rpx;
  background: var(--sr-card);
  border-bottom: 1rpx solid var(--sr-border);
}
.toolbar.chips {
  flex-wrap: wrap;
  gap: 12rpx;
  padding-top: 14rpx;
}
.toolbar-btn {
  padding: 10rpx 26rpx;
  background: var(--sr-primary-bg);
  color: var(--sr-primary);
  border-radius: 28rpx;
  font-size: 24rpx;
}
.chip {
  padding: 8rpx 24rpx;
  background: var(--sr-card-2);
  color: var(--sr-text-2);
  border-radius: 28rpx;
  font-size: 24rpx;
  border: 1rpx solid transparent;
}
.chip.active {
  background: var(--sr-primary-bg);
  color: var(--sr-primary);
  border-color: var(--sr-primary);
}
.progress-text {
  margin-left: auto;
  font-size: 22rpx;
  color: var(--sr-text-3);
}
.hint-text {
  font-size: 22rpx;
  color: var(--sr-text-3);
}

.content-scroll {
  flex: 1;
  height: calc(100vh - 480rpx);
}
.cloze-list {
  padding: 24rpx;
}
.cloze-line {
  background: var(--sr-card);
  border-radius: 12rpx;
  padding: 20rpx 24rpx;
  margin-bottom: 16rpx;
  line-height: 2;
}
.cloze-text {
  font-size: 30rpx;
  color: var(--sr-text-strong);
}
.cloze-blank {
  display: inline-block;
  min-width: 56rpx;
  text-align: center;
  font-size: 30rpx;
  color: var(--sr-primary);
  border-bottom: 3rpx solid var(--sr-primary);
  margin: 0 2rpx;
}
.cloze-blank.revealed {
  color: var(--sr-primary);
  font-weight: bold;
  border-bottom-color: transparent;
  background: var(--sr-primary-bg);
  border-radius: 8rpx;
  padding: 0 6rpx;
}
.bottom-placeholder {
  height: 160rpx;
}

.rate-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  gap: 20rpx;
  padding: 20rpx 24rpx calc(20rpx + env(safe-area-inset-bottom));
  background: var(--sr-card);
  box-shadow: 0 -2rpx 12rpx rgba(0, 0, 0, 0.06);
}
.rate-btn {
  flex: 1;
  height: 88rpx;
  line-height: 88rpx;
  border-radius: 44rpx;
  font-size: 28rpx;
  border: none;
  margin: 0;
}
.rate-btn.forgot {
  background: var(--sr-card-2);
  color: var(--sr-text-2);
}
.rate-btn.remembered {
  background: var(--sr-primary);
  color: var(--sr-on-primary);
}

.empty-state {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--sr-bg);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.empty-icon {
  font-size: 80rpx;
  margin-bottom: 16rpx;
}
.empty-title {
  font-size: 28rpx;
  color: var(--sr-text-2);
  margin-bottom: 24rpx;
}
.empty-back {
  width: 240rpx;
  height: 76rpx;
  line-height: 76rpx;
  border-radius: 38rpx;
  background: var(--sr-primary);
  color: var(--sr-on-primary);
  font-size: 28rpx;
  border: none;
}
</style>
