<template>
  <view class="page-container" :class="themeClass">
    <view v-if="!page" class="empty-state">
      <text class="empty-title">学习页不存在</text>
      <button class="primary-btn" @click="goBack">返回</button>
    </view>

    <template v-else>
      <view class="page-header">
        <text class="back" @click="goBack">‹ 返回章节</text>
        <text class="page-title">{{ page.name }}</text>
        <text class="page-sub">{{ page.words.length }} 个单词 · {{ keyLabel }} · 已记住 {{ marked.size }}/{{ page.words.length }}</text>
      </view>

      <view class="toolbar">
        <view class="switch-row">
          <text class="switch-label">遮住释义</text>
          <switch :checked="hideMeaning" color="#52796f" @change="onHideChange"/>
        </view>
        <text class="link" @click="restart">重新开始</text>
      </view>

      <view v-if="finished" class="finish-card">
        <text class="finish-title">本轮完成 · {{ page.lastScore ?? 0 }} 分</text>
        <text class="finish-desc">{{ page.words.length }} 个单词已全部标记 · 下次复习：{{ dueLabel(page.nextReviewAt) }}</text>
        <button class="primary-btn" @click="restart">再记一遍</button>
        <button class="ghost-btn" @click="goBack">返回章节</button>
      </view>

      <template v-else>
        <view class="center-card">
          <text class="center-word">{{ page.key.value || '主题' }}</text>
          <text class="center-type">{{ keyTypeLabel }}</text>
        </view>

        <view class="node-grid">
          <view v-for="(word, index) in page.words" :key="`${word.sourceId}-${index}`"
                :class="['node-card', { marked: marked.has(index), wrong: wrongSet.has(index) }]"
                @click="reveal(index)">
            <text class="node-word">{{ word.text }}</text>
            <text v-if="word.phonetic" class="node-phonetic">{{ word.phonetic }}</text>
            <text class="node-explains">{{ shouldHide(index) ? '点击显示释义' : (word.explains || '—') }}</text>
            <view class="node-actions">
              <text class="action ok" @click.stop="markRemembered(index)">✓ 记住了</text>
              <text class="action no" @click.stop="markForgot(index)">↺ 还没记住</text>
            </view>
          </view>
        </view>
      </template>
    </template>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { useWordBook } from '@/stores/useWordBook'
import { formatDueLabel } from '@/utils/word-book'

const store = useWordBook()
const pageId = ref('')
const hideMeaning = ref(false)
const revealed = ref<Set<number>>(new Set())
const marked = ref<Set<number>>(new Set())
const wrongSet = ref<Set<number>>(new Set())
const finished = ref(false)

onLoad((options: any) => {
  pageId.value = String(options?.pageId || '')
})

onShow(() => store.load())

const page = computed(() => store.getPage(pageId.value))
const keyTypeLabel = computed(() => {
  const map: Record<string, string> = { root: '词根', prefix: '前缀', suffix: '后缀', phonetic: '音标', text: '主题' }
  return map[page.value?.key.type || 'text'] || '主题'
})
const keyLabel = computed(() => (page.value?.key.value ? `${keyTypeLabel.value} ${page.value.key.value}` : keyTypeLabel.value))

function onHideChange(event: any) {
  hideMeaning.value = !!event.detail.value
}

function shouldHide(index: number): boolean {
  return hideMeaning.value && !revealed.value.has(index)
}

function reveal(index: number) {
  if (!shouldHide(index)) return
  const next = new Set(revealed.value)
  next.add(index)
  revealed.value = next
}

function markRemembered(index: number) {
  const next = new Set(marked.value)
  next.add(index)
  marked.value = next
  const nextWrong = new Set(wrongSet.value)
  nextWrong.delete(index)
  wrongSet.value = nextWrong
  if (next.size === (page.value?.words.length || 0)) finish()
}

function markForgot(index: number) {
  const next = new Set(marked.value)
  next.delete(index)
  marked.value = next
  const nextWrong = new Set(wrongSet.value)
  nextWrong.add(index)
  wrongSet.value = nextWrong
  const nextRevealed = new Set(revealed.value)
  nextRevealed.add(index)
  revealed.value = nextRevealed
}

function finish() {
  if (!page.value) return
  const result = store.completePage(page.value._id, wrongSet.value.size)
  if (!result.ok) {
    uni.showToast({ title: result.message || '保存失败', icon: 'none' })
    return
  }
  finished.value = true
}

function restart() {
  revealed.value = new Set()
  marked.value = new Set()
  wrongSet.value = new Set()
  finished.value = false
}

function dueLabel(nextReviewAt: number): string {
  return formatDueLabel(nextReviewAt)
}

function goBack() {
  uni.navigateBack({ delta: 1 })
}
</script>

<style lang="scss" scoped>
.page-container {
  min-height: 100vh;
  padding: 24rpx;
  box-sizing: border-box;
  background: var(--sr-bg);
}

.page-header {
  margin-bottom: 16rpx;
}

.back {
  display: block;
  font-size: 24rpx;
  color: var(--sr-primary);
  margin-bottom: 8rpx;
}

.page-title {
  display: block;
  font-size: 34rpx;
  font-weight: 600;
  color: var(--sr-text);
}

.page-sub {
  display: block;
  margin-top: 6rpx;
  font-size: 24rpx;
  color: var(--sr-text-2);
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16rpx;
}

.switch-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.switch-label {
  font-size: 24rpx;
  color: var(--sr-text-2);
}

.link {
  font-size: 24rpx;
  color: var(--sr-primary);
}

.center-card {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  padding: 22rpx;
  margin-bottom: 16rpx;
  border-radius: 20rpx;
  background: var(--sr-card);
  border: 1rpx solid var(--sr-primary);
}

.center-word {
  font-size: 34rpx;
  font-weight: 600;
  color: var(--sr-primary);
}

.center-type {
  font-size: 22rpx;
  color: var(--sr-text-2);
}

.node-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.node-card {
  width: calc(50% - 8rpx);
  box-sizing: border-box;
  padding: 20rpx 18rpx;
  border-radius: 18rpx;
  background: var(--sr-card);
  border: 1rpx solid var(--sr-border);

  &.marked {
    border-color: var(--sr-primary);
  }

  &.wrong {
    border-color: var(--sr-danger, #d9534f);
  }
}

.node-word {
  display: block;
  font-size: 30rpx;
  font-weight: 600;
  color: var(--sr-text);
}

.node-phonetic {
  display: block;
  margin-top: 4rpx;
  font-size: 22rpx;
  color: var(--sr-text-2);
}

.node-explains {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: var(--sr-text-2);
  line-height: 1.4;
  min-height: 2.8em;
}

.node-actions {
  display: flex;
  gap: 16rpx;
  margin-top: 10rpx;
}

.action {
  font-size: 22rpx;

  &.ok {
    color: var(--sr-primary);
  }

  &.no {
    color: var(--sr-text-2);
  }
}

.finish-card {
  padding: 40rpx 24rpx;
  border-radius: 20rpx;
  background: var(--sr-card);
  border: 1rpx solid var(--sr-border);
  text-align: center;
}

.finish-title {
  display: block;
  font-size: 34rpx;
  color: var(--sr-text);
  font-weight: 600;
}

.finish-desc {
  display: block;
  margin: 14rpx 0 30rpx;
  font-size: 24rpx;
  color: var(--sr-text-2);
  line-height: 1.5;
}

.empty-state {
  padding: 100rpx 0;
  text-align: center;
}

.empty-title {
  display: block;
  font-size: 30rpx;
  color: var(--sr-text);
  margin-bottom: 24rpx;
}

.primary-btn {
  width: 100%;
  height: 76rpx;
  line-height: 76rpx;
  border-radius: 38rpx;
  background: var(--sr-primary);
  color: #fff;
  font-size: 28rpx;
  margin-bottom: 16rpx;
}

.ghost-btn {
  width: 100%;
  height: 76rpx;
  line-height: 76rpx;
  border-radius: 38rpx;
  background: transparent;
  border: 1rpx solid var(--sr-border);
  color: var(--sr-text-2);
  font-size: 28rpx;
}
</style>
