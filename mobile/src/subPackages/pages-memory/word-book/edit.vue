<template>
  <view class="edit-container" :class="themeClass">
    <view class="summary-card">
      <text class="summary-count">{{ store.draftWords.length }} 个单词</text>
      <text class="summary-text">每页 12 词 · 将生成 {{ pageCount }} 页</text>
    </view>

    <view v-if="store.draftWords.length === 0" class="empty-state">
      <text class="empty-title">没有可生成的筛选结果</text>
      <button class="primary-btn" @click="goWords">返回单词页</button>
    </view>
    <view v-else class="form-card">
      <template v-if="store.chapters.length">
        <text class="form-label">整理到</text>
        <view class="mode-chips">
          <text :class="['mode-chip', {on: mode === 'new'}]" @click="mode = 'new'">新建章节</text>
          <text :class="['mode-chip', {on: mode === 'append'}]" @click="mode = 'append'">追加到已有章节</text>
        </view>
      </template>
      <template v-if="mode === 'new'">
        <text class="form-label">章节名称</text>
        <input v-model="chapterName" class="form-input" maxlength="30" placeholder="如：词根词缀第一章" />
      </template>
      <template v-else>
        <text class="form-label">选择章节</text>
        <picker :range="store.chapters" range-key="name" :value="selectedIndex" @change="selectChapter">
          <view class="form-input picker-value">{{ selectedChapter?.name || '请选择章节' }}</view>
        </picker>
      </template>
      <text class="form-label">学习页名称</text>
      <input v-model="pageTitle" class="form-input" maxlength="40" placeholder="如：词根 spect" />
      <text class="form-tip">完成一页解锁下一页，整章完成后解锁下一章。</text>
      <button class="primary-btn" :disabled="!canSave || saving" @click="confirm">{{ saving ? '正在生成…' : '生成并查看章节' }}</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import {computed, ref} from 'vue'
import {onLoad} from '@dcloudio/uni-app'
import {useWordBook} from '@/stores/useWordBook'
import {WORD_BOOK_PAGE_SIZE} from '@/utils/word-book'

const store = useWordBook()
const mode = ref<'new' | 'append'>('new')
const chapterName = ref('')
const pageTitle = ref('')
const selectedChapterId = ref('')
const saving = ref(false)
const pageCount = computed(() => Math.ceil(store.draftWords.length / WORD_BOOK_PAGE_SIZE))
const selectedChapter = computed(() => store.getChapter(selectedChapterId.value))
const selectedIndex = computed(() => Math.max(0, store.chapters.findIndex(chapter => chapter._id === selectedChapterId.value)))
const canSave = computed(() => store.draftWords.length > 0 && !!pageTitle.value.trim() && (mode.value === 'new' ? !!chapterName.value.trim() : !!selectedChapterId.value))

onLoad(() => {
  store.load()
  chapterName.value = store.draftName
  pageTitle.value = store.draftName
})

function selectChapter(event: any) {
  const chapter = store.chapters[Number(event.detail.value)]
  if (chapter) selectedChapterId.value = chapter._id
}

function confirm() {
  if (!canSave.value || saving.value) return
  saving.value = true
  try {
    let chapterId = selectedChapterId.value
    if (mode.value === 'new') {
      const {result, chapter} = store.createChapter(chapterName.value, pageTitle.value, store.draftWords)
      if (!result.ok) throw new Error(result.message || '章节创建失败')
      chapterId = chapter._id
    } else {
      const result = store.appendChapter(chapterId, pageTitle.value, store.draftWords)
      if (!result.ok) throw new Error(result.message || '学习页追加失败')
    }
    const createdPageCount = pageCount.value
    store.clearDraft()
    uni.showToast({title: `已生成 ${createdPageCount} 页`, icon: 'success'})
    uni.redirectTo({url: `/subPackages/pages-memory/word-book/chapter?id=${chapterId}`})
  } catch (error) {
    uni.showToast({title: error instanceof Error ? error.message : '生成失败', icon: 'none'})
  } finally {
    saving.value = false
  }
}

function goWords() {
  uni.switchTab({url: '/pages/words/words'})
}
</script>

<style scoped>
.edit-container { min-height: 100vh; padding: 24rpx; box-sizing: border-box; background: var(--sr-bg); }
.summary-card { display: flex; align-items: center; justify-content: space-between; padding: 24rpx; background: var(--sr-card-2); border-radius: 16rpx; }
.summary-count { color: var(--sr-primary); font-size: 32rpx; font-weight: bold; }
.summary-text { color: var(--sr-text-2); font-size: 22rpx; }
.form-card { margin-top: 20rpx; padding: 26rpx; background: var(--sr-card); border-radius: 18rpx; }
.form-label { display: block; margin: 22rpx 0 12rpx; color: var(--sr-text-2); font-size: 24rpx; }
.form-label:first-child { margin-top: 0; }
.form-input { padding: 18rpx 20rpx; color: var(--sr-text); background: var(--sr-card-2); border: 1rpx solid var(--sr-border); border-radius: 12rpx; font-size: 28rpx; }
.picker-value { line-height: 1.5; }
.mode-chips { display: flex; gap: 12rpx; }
.mode-chip { padding: 12rpx 22rpx; color: var(--sr-text-2); background: var(--sr-card-2); border: 1rpx solid var(--sr-border); border-radius: 26rpx; font-size: 24rpx; }
.mode-chip.on { color: var(--sr-on-primary); background: var(--sr-primary); border-color: var(--sr-primary); }
.form-tip { display: block; margin-top: 22rpx; color: var(--sr-text-3); font-size: 22rpx; line-height: 1.6; }
.primary-btn { margin-top: 28rpx; height: 76rpx; color: var(--sr-on-primary); background: var(--sr-primary); border-radius: 38rpx; font-size: 28rpx; line-height: 76rpx; }
.primary-btn::after { border: none; }
.primary-btn[disabled] { opacity: 0.5; }
.empty-state { padding: 100rpx 30rpx; text-align: center; }
.empty-title { color: var(--sr-text); font-size: 28rpx; }
</style>
