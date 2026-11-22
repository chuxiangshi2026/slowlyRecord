<template>
  <view class="dictation-page" :class="themeClass">
    <AppBackground variant="landscape" />
    <!-- 文章信息 -->
    <view class="article-head">
      <text class="article-title">{{ article?.title || '默写对比' }}</text>
      <text v-if="article?.author" class="article-author">{{ article.author }}</text>
    </view>

    <!-- 默写输入区 -->
    <view v-if="!result" class="input-area">
      <textarea
        v-model="input"
        class="dictation-input"
        :placeholder="`不看原文，默写《${article?.title || ''}》全文，写完点下方「对比」`"
        :maxlength="-1"
        auto-height
      />
      <view class="input-footer">
        <text class="char-count">{{ input.trim().length }}/{{ article?.content.trim().length || 0 }} 字</text>
        <view class="input-actions">
          <view class="toolbar-btn plain" @click="peekOriginal">
            <text>{{ peeking ? '隐藏原文' : '偷看原文' }}</text>
          </view>
          <view class="toolbar-btn primary" @click="doCompare">
            <text>对比</text>
          </view>
        </view>
      </view>
      <view v-if="peeking" class="peek-box">
        <text class="peek-text">{{ article?.content }}</text>
      </view>
    </view>

    <!-- 对比结果区 -->
    <scroll-view v-else scroll-y class="result-scroll">
      <view class="score-card">
        <text class="score-num" :class="scoreClass">{{ result.accuracy }}</text>
        <text class="score-label">正确率 %</text>
        <view class="score-stats">
          <text class="stat error">错 {{ result.errors.length }}</text>
          <text class="stat missing">漏 {{ result.missing.length }}</text>
          <text class="stat extra">多 {{ result.extra.length }}</text>
        </view>
      </view>

      <!-- 逐字标注 -->
      <view class="compare-card">
        <text class="card-label">✏️ 我的默写（红=错字，黄=多写）</text>
        <view class="compare-text">
          <text
            v-for="(ch, i) in markedChars"
            :key="i"
            class="ch"
            :class="ch.status"
          >{{ ch.char }}</text>
        </view>
        <view v-if="result.missing.length" class="missing-box">
          <text class="missing-label">遗漏 {{ result.missing.length }} 字：</text>
          <text class="missing-chars">{{ missingCharsText }}</text>
        </view>
      </view>

      <!-- 原文对照 -->
      <view class="compare-card">
        <text class="card-label">📄 原文</text>
        <text class="original-text">{{ article?.content }}</text>
      </view>

      <view class="result-actions">
        <button class="action-btn plain" @click="retry">再默一遍</button>
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
import { compareText, type CompareResult } from '@/utils/text-compare'

const store = useTextMemory()

const article = ref<MobileTextArticle | null>(null)
const loaded = ref(false)
const input = ref('')
const peeking = ref(false)
const result = ref<CompareResult | null>(null)

type CharStatus = 'normal' | 'error' | 'extra'
interface MarkedChar {
  char: string
  status: CharStatus
}

/** 逐字状态标注：错字红、多字黄、其余正常 */
const markedChars = computed<MarkedChar[]>(() => {
  if (!result.value) return []
  const errorSet = new Set(result.value.errors.map((e) => e.position))
  const extraSet = new Set(result.value.extra.map((e) => e.position))
  return input.value.trim().split('').map((char, i) => ({
    char,
    status: errorSet.has(i) ? 'error' : extraSet.has(i) ? 'extra' : 'normal',
  }))
})

const missingCharsText = computed(() =>
  result.value ? result.value.missing.map((m) => m.char).join('、') : '',
)

const scoreClass = computed(() => {
  const acc = result.value?.accuracy ?? 0
  if (acc >= 90) return 'good'
  if (acc >= 60) return 'mid'
  return 'bad'
})

onLoad((opt: any) => {
  store.load()
  const id = opt?.id ? decodeURIComponent(opt.id) : ''
  const found = store.articles.find((a) => a._id === id)
  if (found) article.value = found
  loaded.value = true
})

function peekOriginal() {
  peeking.value = !peeking.value
}

function doCompare() {
  if (!article.value) return
  if (!input.value.trim()) {
    uni.showToast({ title: '先默写内容再对比', icon: 'none' })
    return
  }
  result.value = compareText(article.value.content, input.value)
}

function retry() {
  result.value = null
  input.value = ''
  peeking.value = false
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
.dictation-page {
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

/* 输入区 */
.input-area {
  padding: 24rpx;
}
.dictation-input {
  width: 100%;
  min-height: 360rpx;
  background: var(--sr-card);
  border-radius: 16rpx;
  padding: 24rpx;
  font-size: 30rpx;
  color: var(--sr-text-strong);
  line-height: 1.9;
  box-sizing: border-box;
}
.input-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16rpx;
}
.char-count {
  font-size: 22rpx;
  color: var(--sr-text-3);
}
.input-actions {
  display: flex;
  gap: 16rpx;
}
.toolbar-btn {
  padding: 12rpx 32rpx;
  border-radius: 28rpx;
  font-size: 26rpx;
}
.toolbar-btn.plain {
  background: var(--sr-card-2);
  color: var(--sr-text-2);
}
.toolbar-btn.primary {
  background: var(--sr-primary);
  color: var(--sr-on-primary);
}
.peek-box {
  margin-top: 16rpx;
  background: var(--sr-card-2);
  border-radius: 16rpx;
  padding: 24rpx;
}
.peek-text {
  font-size: 28rpx;
  color: var(--sr-text-2);
  line-height: 1.9;
}

/* 结果区 */
.result-scroll {
  flex: 1;
  height: calc(100vh - 380rpx);
}
.score-card {
  margin: 24rpx;
  background: var(--sr-card);
  border-radius: 20rpx;
  padding: 40rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.score-num {
  font-size: 88rpx;
  font-weight: bold;
}
.score-num.good {
  color: var(--sr-primary);
}
.score-num.mid {
  color: #e6a23c;
}
.score-num.bad {
  color: #e64340;
}
.score-label {
  font-size: 24rpx;
  color: var(--sr-text-3);
  margin-top: 4rpx;
}
.score-stats {
  display: flex;
  gap: 40rpx;
  margin-top: 24rpx;
}
.stat {
  font-size: 26rpx;
}
.stat.error {
  color: #e64340;
}
.stat.missing {
  color: #e6a23c;
}
.stat.extra {
  color: #8c6dd9;
}

.compare-card {
  margin: 0 24rpx 24rpx;
  background: var(--sr-card);
  border-radius: 20rpx;
  padding: 28rpx;
}
.card-label {
  font-size: 24rpx;
  color: var(--sr-text-3);
  display: block;
  margin-bottom: 16rpx;
}
.compare-text {
  line-height: 2;
}
.ch {
  font-size: 32rpx;
  color: var(--sr-text-strong);
}
.ch.error {
  color: #e64340;
  background: rgba(230, 67, 64, 0.12);
  text-decoration: line-through;
  border-radius: 4rpx;
}
.ch.extra {
  color: #b8860b;
  background: rgba(230, 162, 60, 0.18);
  border-radius: 4rpx;
}
.missing-box {
  margin-top: 20rpx;
  padding: 16rpx 20rpx;
  background: rgba(230, 162, 60, 0.1);
  border-radius: 12rpx;
}
.missing-label {
  font-size: 24rpx;
  color: #e6a23c;
}
.missing-chars {
  font-size: 26rpx;
  color: var(--sr-text);
  font-weight: bold;
}
.original-text {
  font-size: 28rpx;
  color: var(--sr-text-2);
  line-height: 1.9;
}

.result-actions {
  padding: 0 24rpx;
}
.action-btn {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  border-radius: 44rpx;
  font-size: 28rpx;
  border: none;
  margin: 0;
}
.action-btn.plain {
  background: var(--sr-card-2);
  color: var(--sr-text-2);
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
