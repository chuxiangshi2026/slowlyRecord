<template>
  <view class="page-container" :class="themeClass">
    <view v-if="page" class="page-header">
      <text class="page-title">{{ page.title }}</text>
      <text class="page-subtitle">{{ chapter?.name }} · {{ page.words.length }} 个单词</text>
    </view>
    <view v-if="!store.loaded" class="empty-tip">加载中...</view>
    <view v-else-if="!chapter || !page" class="empty-tip">学习页不存在或已删除</view>
    <view v-else-if="!allowed" class="empty-state">
      <text class="empty-title">本页尚未解锁</text>
      <text class="empty-desc">先完成前一页，再来挑战这里</text>
      <button class="plain-btn" @click="goChapter">返回章节</button>
    </view>

    <template v-else>
      <view v-if="mode === 'learn'" class="learn-view">
        <view class="map-root">
          <text class="map-root-title">{{ page.title }}</text>
          <text class="map-root-tip">点击单词卡查看释义与词根词缀</text>
        </view>
        <view class="map-trunk"></view>
        <view class="word-map">
          <button
            v-for="(word, index) in page.words"
            :key="`${word.sourceId}-${index}`"
            class="word-node"
            :class="{revealed: revealed.has(index)}"
            @click="toggleReveal(index)"
          >
            <view class="word-spelling">
              <text v-for="(component, componentIndex) in components(word.text)" :key="componentIndex" :class="`affix-${component.type}`">{{ component.text }}</text>
            </view>
            <text v-if="word.phonetic" class="word-phonetic">{{ word.phonetic }}</text>
            <text class="word-explains">{{ revealed.has(index) ? word.explains : '点击显示释义' }}</text>
            <text v-if="revealed.has(index) && affixMeanings(word.text)" class="word-affixes">{{ affixMeanings(word.text) }}</text>
          </button>
        </view>
        <button class="primary-btn" @click="startPractice">开始本页闯关</button>
        <text class="practice-tip">没记住的词会在本轮末尾重出，全部记住一次即过关</text>
      </view>

      <view v-else-if="mode === 'practice'" class="practice-view">
        <view class="practice-progress">
          <text>已记住 <text class="progress-strong">{{ masteredCount }}</text> / {{ page.words.length }}</text>
          <text>重出 {{ wrongAttempts }} 次</text>
        </view>
        <view v-if="currentWord" class="practice-card">
          <text class="practice-label">看单词，回忆释义</text>
          <text class="practice-word">{{ currentWord.text }}</text>
          <text v-if="currentWord.phonetic" class="practice-phonetic">{{ currentWord.phonetic }}</text>
          <view v-if="answerVisible" class="practice-answer">
            <view class="practice-components">
              <text v-for="(component, index) in components(currentWord.text)" :key="index" :class="`affix-${component.type}`">{{ component.text }}</text>
            </view>
            <text class="practice-explains">{{ currentWord.explains }}</text>
            <text v-if="affixMeanings(currentWord.text)" class="practice-affixes">{{ affixMeanings(currentWord.text) }}</text>
            <view class="practice-actions">
              <button class="wrong-btn" @click="assess(false)">没记住</button>
              <button class="right-btn" @click="assess(true)">记住了</button>
            </view>
          </view>
          <button v-else class="plain-btn reveal-btn" @click="answerVisible = true">显示释义</button>
        </view>
        <view v-else class="empty-state">
          <text class="empty-title">成绩尚未保存</text>
          <button class="primary-btn" :disabled="saving" @click="finishPractice">重试保存</button>
        </view>
        <button class="back-learn" @click="mode = 'learn'">返回词图</button>
      </view>

      <view v-else class="finish-view">
        <text class="finish-badge">✓</text>
        <text class="finish-title">本页过关 · {{ finishedScore }} 分</text>
        <text class="finish-desc">{{ page.words.length }} 个单词均已记住一次 · 重出 {{ wrongAttempts }} 次</text>
        <button class="primary-btn" @click="goNext">{{ nextActionText }}</button>
        <button class="plain-btn" @click="startPractice">再练一遍</button>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import {computed, ref} from 'vue'
import {onLoad} from '@dcloudio/uni-app'
import {useWordBook} from '@/stores/useWordBook'
import {advanceWordBookPractice} from '@/utils/word-book'
import {analyzeWord, generateSimpleTooltip} from '@/utils/word-analysis'
import type {WordBookWord} from '@/types/word-book'

const store = useWordBook()
const chapterId = ref('')
const pageId = ref('')
const chapter = computed(() => store.getChapter(chapterId.value))
const page = computed(() => chapter.value?.pages.find(item => item.id === pageId.value))
const allowed = computed(() => store.pageUnlocked(chapterId.value, pageId.value))
const mode = ref<'learn' | 'practice' | 'finished'>('learn')
const revealed = ref<Set<number>>(new Set())
const remaining = ref<WordBookWord[]>([])
const masteredCount = ref(0)
const wrongAttempts = ref(0)
const answerVisible = ref(false)
const saving = ref(false)
const finishedScore = ref(0)
const currentWord = computed(() => remaining.value[0])
const nextPage = computed(() => {
  const index = chapter.value?.pages.findIndex(item => item.id === pageId.value) ?? -1
  return index >= 0 ? chapter.value?.pages[index + 1] : undefined
})
const nextChapter = computed(() => {
  const index = store.chapters.findIndex(item => item._id === chapterId.value)
  return index >= 0 ? store.chapters[index + 1] : undefined
})
const nextActionText = computed(() => nextPage.value ? '进入下一页' : nextChapter.value ? '进入下一章' : '返回章节列表')

onLoad(query => {
  chapterId.value = String(query?.chapterId || '')
  pageId.value = String(query?.pageId || '')
  store.load()
})

function components(text: string) {
  if (/\s/.test(text.trim())) return [{text, type: 'whole' as const}]
  return analyzeWord(text)
}

function affixMeanings(text: string): string {
  return generateSimpleTooltip(analyzeWord(text))
}

function toggleReveal(index: number) {
  const next = new Set(revealed.value)
  if (next.has(index)) next.delete(index)
  else next.add(index)
  revealed.value = next
}

function startPractice() {
  if (!page.value) return
  remaining.value = page.value.words.map(word => ({...word}))
  masteredCount.value = 0
  wrongAttempts.value = 0
  answerVisible.value = false
  finishedScore.value = 0
  mode.value = 'practice'
}

function assess(remembered: boolean) {
  if (!answerVisible.value || !currentWord.value || !page.value) return
  remaining.value = advanceWordBookPractice(remaining.value, remembered)
  if (remembered) masteredCount.value += 1
  else wrongAttempts.value += 1
  answerVisible.value = false
  if (masteredCount.value === page.value.words.length) finishPractice()
}

function finishPractice() {
  if (!page.value || saving.value) return
  saving.value = true
  const total = page.value.words.length
  try {
    const result = store.completePage(chapterId.value, pageId.value, wrongAttempts.value)
    if (!result.ok) {
      uni.showToast({title: result.message || '成绩保存失败', icon: 'none'})
      return
    }
    finishedScore.value = Math.round(total / (total + wrongAttempts.value) * 100)
    mode.value = 'finished'
  } catch {
    uni.showToast({title: '成绩保存失败，请重试', icon: 'none'})
  } finally {
    saving.value = false
  }
}

function goChapter() {
  uni.redirectTo({url: `/subPackages/pages-memory/word-book/chapter?id=${chapterId.value}`})
}

function goNext() {
  if (nextPage.value) {
    uni.redirectTo({url: `/subPackages/pages-memory/word-book/page?chapterId=${chapterId.value}&pageId=${nextPage.value.id}`})
  } else if (nextChapter.value) {
    uni.redirectTo({url: `/subPackages/pages-memory/word-book/chapter?id=${nextChapter.value._id}`})
  } else {
    uni.redirectTo({url: '/subPackages/pages-memory/word-book/list'})
  }
}
</script>

<style scoped>
.page-container { min-height: 100vh; padding: 24rpx 24rpx 50rpx; box-sizing: border-box; background: var(--sr-bg); }
.page-header { display: flex; flex-direction: column; align-items: center; margin-bottom: 24rpx; }
.page-title { color: var(--sr-text); font-size: 32rpx; font-weight: bold; }
.page-subtitle { margin-top: 8rpx; color: var(--sr-text-3); font-size: 22rpx; }
.empty-tip, .empty-state { padding: 100rpx 30rpx; text-align: center; color: var(--sr-text-3); }
.empty-state { display: flex; flex-direction: column; align-items: center; }
.empty-title { color: var(--sr-text); font-size: 30rpx; }
.empty-desc { margin-top: 14rpx; font-size: 24rpx; }
.map-root { display: flex; flex-direction: column; align-items: center; margin: 0 70rpx; padding: 20rpx; background: var(--sr-card); border: 2rpx solid var(--sr-primary); border-radius: 16rpx; }
.map-root-title { color: var(--sr-text); font-size: 28rpx; font-weight: bold; text-align: center; }
.map-root-tip { margin-top: 8rpx; color: var(--sr-text-3); font-size: 20rpx; }
.map-trunk { width: 2rpx; height: 30rpx; margin: 0 auto; background: var(--sr-primary); }
.word-map { margin-left: 24rpx; padding-left: 30rpx; border-left: 2rpx solid var(--sr-primary); }
.word-node { position: relative; display: flex; flex-direction: column; align-items: flex-start; width: 100%; margin: 0 0 20rpx; padding: 22rpx; box-sizing: border-box; color: var(--sr-text); background: var(--sr-card); border: 1rpx solid var(--sr-border); border-radius: 14rpx; font: inherit; text-align: left; }
.word-node::before { content: ''; position: absolute; left: -32rpx; top: 42rpx; width: 30rpx; height: 2rpx; background: var(--sr-primary); }
.word-node::after { border: none; }
.word-node.revealed { border-color: var(--sr-primary); }
.word-spelling { font-size: 32rpx; line-height: 1.4; word-break: break-word; }
.affix-root { color: var(--sr-primary); font-weight: bold; border-bottom: 2rpx solid var(--sr-primary); }
.affix-prefix, .affix-suffix { color: var(--sr-text-2); text-decoration: underline dotted; }
.word-phonetic { margin-top: 6rpx; color: var(--sr-text-3); font-size: 22rpx; }
.word-explains { margin-top: 12rpx; color: var(--sr-text-2); font-size: 26rpx; line-height: 1.5; }
.word-affixes { margin-top: 10rpx; color: var(--sr-primary); font-size: 22rpx; line-height: 1.5; }
.primary-btn { width: 100%; height: 78rpx; margin-top: 20rpx; color: var(--sr-on-primary); background: var(--sr-primary); border-radius: 40rpx; font-size: 28rpx; line-height: 78rpx; }
.primary-btn::after, .plain-btn::after, .back-learn::after, .wrong-btn::after, .right-btn::after { border: none; }
.practice-tip { display: block; margin-top: 14rpx; color: var(--sr-text-3); font-size: 22rpx; line-height: 1.5; text-align: center; }
.practice-progress { display: flex; justify-content: center; gap: 40rpx; margin-bottom: 24rpx; color: var(--sr-text-2); font-size: 24rpx; }
.progress-strong { color: var(--sr-primary); font-size: 34rpx; font-weight: bold; }
.practice-card { display: flex; flex-direction: column; align-items: center; padding: 44rpx 28rpx; background: var(--sr-card); border: 1rpx solid var(--sr-border); border-radius: 18rpx; }
.practice-label { color: var(--sr-text-3); font-size: 22rpx; }
.practice-word { margin-top: 28rpx; color: var(--sr-text); font-size: 48rpx; font-weight: bold; word-break: break-word; }
.practice-phonetic { margin: 12rpx 0 24rpx; color: var(--sr-text-3); font-size: 24rpx; }
.practice-answer { width: 100%; margin-top: 24rpx; padding-top: 24rpx; border-top: 1rpx solid var(--sr-border); text-align: center; }
.practice-components { font-size: 34rpx; }
.practice-explains { display: block; margin-top: 20rpx; color: var(--sr-text); font-size: 30rpx; line-height: 1.6; }
.practice-affixes { display: block; margin-top: 12rpx; color: var(--sr-primary); font-size: 22rpx; }
.practice-actions { display: flex; gap: 16rpx; margin-top: 30rpx; }
.wrong-btn, .right-btn { flex: 1; height: 70rpx; margin: 0; font-size: 26rpx; line-height: 70rpx; }
.wrong-btn { color: #c0564f; background: var(--sr-card-2); border: 1rpx solid #c0564f; }
.right-btn { color: var(--sr-on-primary); background: var(--sr-primary); }
.plain-btn { height: 70rpx; margin-top: 20rpx; padding: 0 34rpx; color: var(--sr-primary); background: var(--sr-card-2); border: 1rpx solid var(--sr-primary); border-radius: 36rpx; font-size: 26rpx; line-height: 68rpx; }
.reveal-btn { margin-top: 20rpx; }
.back-learn { margin-top: 20rpx; color: var(--sr-text-3); background: transparent; font-size: 24rpx; }
.finish-view { display: flex; flex-direction: column; align-items: center; padding: 70rpx 30rpx; }
.finish-badge { display: flex; align-items: center; justify-content: center; width: 100rpx; height: 100rpx; color: var(--sr-on-primary); background: var(--sr-primary); border-radius: 50%; font-size: 54rpx; }
.finish-title { margin-top: 28rpx; color: var(--sr-text); font-size: 36rpx; font-weight: bold; }
.finish-desc { margin-top: 16rpx; color: var(--sr-text-3); font-size: 24rpx; line-height: 1.6; text-align: center; }
.finish-view .primary-btn, .finish-view .plain-btn { width: 100%; box-sizing: border-box; }
</style>
