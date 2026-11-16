<template>
  <view class="page-container" :class="themeClass">
    <AppBackground />
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
        <view class="toolbar-switches">
          <view class="switch-row">
            <text class="switch-label">遮住释义</text>
            <switch :checked="hideMeaning" color="#52796f" @change="onHideChange"/>
          </view>
          <view v-if="hideMeaning" class="switch-row">
            <text class="switch-label">直接显示释义</text>
            <switch :checked="directMeaning" color="#52796f" @change="onDirectMeaningChange"/>
          </view>
        </view>
        <text class="link" @click="directoryVisible = !directoryVisible">章节目录</text>
        <text class="link" @click="restart">重新开始</text>
      </view>

      <view v-if="directoryVisible" class="chapter-directory">
        <view v-for="(item, index) in chapterDirectory" :key="item.chapter._id" class="chapter-directory-group">
          <view class="chapter-directory-title" :class="{ current: item.chapter._id === page.chapterId }"
                @click="openChapter(item.chapter._id)">
            <text>{{ index + 1 }}. {{ item.chapter.name }}</text>
            <text class="chapter-directory-count">{{ item.pageCount }} 页 · {{ item.wordCount }} 词{{ item.hasSameName ? ' · 同名' : '' }}</text>
          </view>
          <text v-for="itemPage in item.pages" :key="itemPage._id" class="chapter-directory-page"
                :class="{ current: itemPage._id === pageId }" @click="openDirectoryPage(itemPage._id)">
            P{{ itemPage.order }} · {{ itemPage.name }}
          </text>
        </view>
      </view>

      <view v-if="finished" class="finish-card">
        <text class="finish-title">本轮完成 · {{ page.lastScore ?? 0 }} 分</text>
        <text class="finish-desc">
          共 {{ page.lastRound?.total ?? page.words.length }} 词 · 首轮想起 {{ page.lastRound?.firstTryKnown ?? 0 }} · 重新回忆 {{ page.lastRound?.retriedCount ?? 0 }}
        </text>
        <text v-if="practiceRound" class="finish-desc">练习模式：已记录成绩，不调整正式复习时间</text>
        <text v-else class="finish-desc">下次复习：{{ dueLabel(page.nextReviewAt) }}</text>
        <button class="primary-btn" @click="restart">再记一遍</button>
        <button class="ghost-btn" @click="goBack">返回章节</button>
      </view>

      <template v-else>
        <view class="center-card">
          <text class="center-word">{{ page.key.value || '主题' }}</text>
          <text class="center-type">{{ keyTypeLabel }}</text>
        </view>

        <view v-if="saveError && marked.size === page.words.length" class="save-error">
          <text class="save-error-text">{{ saveError }}</text>
          <button size="mini" class="save-retry" @click="finish">重试保存</button>
        </view>

        <view class="node-grid">
          <view v-for="item in displayWords" :key="item.entryId"
                :class="['node-card', { marked: marked.has(item.entryId), wrong: firstWrong.has(item.entryId) }]"
                @click="reveal(item.entryId)">
            <text class="node-word"><text v-for="(part, partIndex) in rootParts(item.word.text)" :key="partIndex"
                  :class="{ 'root-match': part.matched }">{{ part.text }}</text></text>
            <text v-if="item.word.phonetic" class="node-phonetic">{{ item.word.phonetic }}</text>
            <text class="node-explains">{{ shouldHide(item.entryId) ? '点击显示释义' : (item.word.explains || '—') }}</text>
            <view class="node-actions">
              <text class="action ok" @click.stop="markRemembered(item.entryId)">✓ 记住了</text>
              <text class="action no" @click.stop="markForgot(item.entryId)">↺ 还没记住</text>
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
import { buildWordBookChapterDirectory, formatDueLabel } from '@/utils/word-book'

const store = useWordBook()
const pageId = ref('')
const hideMeaning = ref(false)
// R9：遮住释义时可再开「直接显示释义」，生词免点按（与桌面端复习模式同名开关同语义）
const directMeaning = ref(false)
// 学习状态一律按条目 ID（entryId）记录，增删排序后不串词；旧按下标的草稿（version 1）直接作废重开
const revealed = ref<Set<string>>(new Set())
const marked = ref<Set<string>>(new Set())
const firstWrong = ref<Set<string>>(new Set())
const finished = ref(false)
const practiceRound = ref(false)
const completedOnce = ref(false)
const directoryVisible = ref(false)
const saveError = ref('')
const order = ref<string[]>([])
const restored = ref(false)
const storageKey = computed(() => `sr_mobile_wordbook_round_${pageId.value}`)

const page = computed(() => store.getPage(pageId.value))

const entryMap = computed(() => new Map((page.value?.words || []).map(word => [word.entryId || '', word])))
const displayWords = computed(() => order.value.flatMap(entryId => {
  const word = entryMap.value.get(entryId)
  return word ? [{ entryId, word }] : []
}))

onLoad((options: any) => {
  pageId.value = String(options?.pageId || '')
})

onShow(() => {
  store.load()
  restoreRound()
})
const chapterDirectory = computed(() => page.value
  ? buildWordBookChapterDirectory(store.chaptersOf(page.value.bookId), store.pages)
  : [])
const keyTypeLabel = computed(() => {
  const map: Record<string, string> = { root: '词根', prefix: '前缀', suffix: '后缀', phonetic: '音标', text: '主题' }
  return map[page.value?.key.type || 'text'] || '主题'
})
const keyLabel = computed(() => (page.value?.key.value ? `${keyTypeLabel.value} ${page.value.key.value}` : keyTypeLabel.value))

function openChapter(chapterId: string) {
  directoryVisible.value = false
  if (chapterId === page.value?.chapterId) return
  uni.navigateTo({ url: `/subPackages/pages-memory/word-book/pages?bookId=${page.value?.bookId}&chapterId=${chapterId}` })
}

function openDirectoryPage(targetPageId: string) {
  directoryVisible.value = false
  if (targetPageId === pageId.value) return
  uni.navigateTo({ url: `/subPackages/pages-memory/word-book/page?pageId=${targetPageId}` })
}

function rootParts(text: string): Array<{ text: string; matched?: boolean }> {
  const root = String(page.value?.key.type === 'root' ? page.value.key.value : '').toLowerCase()
  const index = root ? text.toLowerCase().indexOf(root) : -1
  if (index < 0) return [{ text }]
  return [
    ...(index > 0 ? [{ text: text.slice(0, index) }] : []),
    { text: text.slice(index, index + root.length), matched: true },
    ...(index + root.length < text.length ? [{ text: text.slice(index + root.length) }] : []),
  ]
}

interface RoundDraft {
  version: 2
  order: string[]
  revealed: string[]
  marked: string[]
  wrong: string[]
  hideMeaning: boolean
  directMeaning: boolean
  practice: boolean
}

function pageEntryIds(): string[] {
  return (page.value?.words || []).map(word => word.entryId || '')
}

function shuffledEntryIds(): string[] {
  const list = pageEntryIds()
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[list[i], list[j]] = [list[j], list[i]]
  }
  return list
}

function persistRound() {
  if (!page.value || finished.value) return
  const draft: RoundDraft = {
    version: 2,
    order: order.value,
    revealed: [...revealed.value],
    marked: [...marked.value],
    wrong: [...firstWrong.value],
    hideMeaning: hideMeaning.value,
    directMeaning: directMeaning.value,
    practice: practiceRound.value,
  }
  try {
    uni.setStorageSync(storageKey.value, JSON.stringify(draft))
  } catch { /* 存储不可用时只保留在内存 */ }
}

function clearRoundStorage() {
  try {
    uni.removeStorageSync(storageKey.value)
  } catch { /* ignore */ }
}

function restoreRound() {
  if (restored.value || !page.value) return
  restored.value = true
  const ids = pageEntryIds()
  const fallback = () => {
    order.value = shuffledEntryIds()
  }
  try {
    const raw = uni.getStorageSync(storageKey.value)
    if (!raw) {
      fallback()
      return
    }
    const draft = (typeof raw === 'string' ? JSON.parse(raw) : raw) as RoundDraft
    if (draft.version !== 2 || !Array.isArray(draft.order)) throw new Error('invalid draft')
    const allIds = new Set(ids)
    const seen = new Set<string>()
    const validOrder: string[] = []
    for (const id of draft.order) {
      if (typeof id !== 'string' || !allIds.has(id) || seen.has(id)) continue
      seen.add(id)
      validOrder.push(id)
    }
    // 页面编辑过（增词）时把新词排到队尾，删词自然过滤，不再整轮作废
    order.value = [...validOrder, ...ids.filter(id => !seen.has(id))]
    const pickValid = (values: unknown) => new Set(
      (Array.isArray(values) ? values : []).filter((id): id is string => typeof id === 'string' && allIds.has(id)),
    )
    revealed.value = pickValid(draft.revealed)
    marked.value = pickValid(draft.marked)
    firstWrong.value = pickValid(draft.wrong)
    hideMeaning.value = !!draft.hideMeaning
    directMeaning.value = !!draft.directMeaning
    practiceRound.value = !!draft.practice
    saveError.value = ''
    if (ids.length > 0 && marked.value.size === ids.length) finish()
  } catch {
    clearRoundStorage()
    fallback()
  }
}

function onHideChange(event: any) {
  hideMeaning.value = !!event.detail.value
  persistRound()
}

function onDirectMeaningChange(event: any) {
  directMeaning.value = !!event.detail.value
  persistRound()
}

function shouldHide(entryId: string): boolean {
  return hideMeaning.value && !directMeaning.value && !revealed.value.has(entryId)
}

function reveal(entryId: string) {
  if (!shouldHide(entryId)) return
  const next = new Set(revealed.value)
  next.add(entryId)
  revealed.value = next
  persistRound()
}

function markRemembered(entryId: string) {
  const next = new Set(marked.value)
  if (next.has(entryId)) {
    next.delete(entryId)
    marked.value = next
    persistRound()
    return
  }
  next.add(entryId)
  marked.value = next
  if (next.size === (page.value?.words.length || 0)) finish()
  else persistRound()
}

function markForgot(entryId: string) {
  const next = new Set(marked.value)
  next.delete(entryId)
  marked.value = next
  const nextWrong = new Set(firstWrong.value)
  nextWrong.add(entryId)
  firstWrong.value = nextWrong
  const nextRevealed = new Set(revealed.value)
  nextRevealed.add(entryId)
  revealed.value = nextRevealed
  order.value = [...order.value.filter(item => item !== entryId), entryId]
  persistRound()
}

function finish() {
  if (!page.value || finished.value || marked.value.size !== page.value.words.length) return
  saveError.value = ''
  const total = page.value.words.length
  const result = store.completeRound(page.value._id, {
    total,
    firstTryKnown: Math.max(0, total - firstWrong.value.size),
    retriedCount: firstWrong.value.size,
    firstTryWrongEntryIds: [...firstWrong.value],
    finishedAt: Date.now(),
  }, { practice: practiceRound.value })
  if (!result.ok) {
    saveError.value = result.message || '保存失败'
    persistRound()
    uni.showToast({ title: saveError.value, icon: 'none' })
    return
  }
  finished.value = true
  completedOnce.value = true
  clearRoundStorage()
}

function restart() {
  revealed.value = new Set()
  marked.value = new Set()
  firstWrong.value = new Set()
  order.value = shuffledEntryIds()
  saveError.value = ''
  finished.value = false
  // 已完成过一轮后再练：只记录成绩，不调整正式复习时间
  practiceRound.value = completedOnce.value
  clearRoundStorage()
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

.toolbar-switches {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
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

.save-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  padding: 16rpx 20rpx;
  margin-bottom: 16rpx;
  color: var(--sr-danger, #d9534f);
  background: var(--sr-card);
  border: 1rpx solid var(--sr-danger, #d9534f);
  border-radius: 16rpx;
}

.save-error-text {
  flex: 1;
  font-size: 24rpx;
}

.save-retry {
  flex: none;
  margin: 0;
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

.root-match {
  color: var(--sr-danger, #d9534f);
  font-weight: 700;
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

.chapter-directory {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12rpx;
  margin-bottom: 16rpx;
  padding: 16rpx;
  border-radius: 16rpx;
  background: var(--sr-card);
  border: 1rpx solid var(--sr-border);
}

.chapter-directory-group {
  min-width: 0;
  padding: 12rpx;
  border-radius: 12rpx;
  background: var(--sr-bg);
}

.chapter-directory-title {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8rpx;
  padding-bottom: 8rpx;
  color: var(--sr-text);
  font-size: 24rpx;
  font-weight: 600;
  border-bottom: 1rpx solid var(--sr-border);

  &.current {
    color: var(--sr-primary);
  }
}

.chapter-directory-count {
  flex-shrink: 0;
  color: var(--sr-text-2);
  font-size: 18rpx;
  font-weight: 400;
}

.chapter-directory-page {
  display: block;
  padding: 10rpx 6rpx;
  color: var(--sr-text-2);
  font-size: 22rpx;
  line-height: 1.3;

  &.current {
    color: var(--sr-primary);
    font-weight: 600;
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
