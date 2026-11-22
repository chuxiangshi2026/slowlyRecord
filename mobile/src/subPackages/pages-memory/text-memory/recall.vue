<template>
  <view class="recall-page" :class="themeClass">
    <AppBackground variant="landscape" />
    <!-- 文章信息 -->
    <view class="article-head">
      <text class="article-title">{{ article?.title || '遮挡回忆' }}</text>
      <text v-if="article?.author" class="article-author">{{ article.author }}</text>
    </view>

    <!-- 操作条：行1 揭示控制，行2 练习与辅助 -->
    <view class="toolbar">
      <view class="toolbar-btn" @click="revealAll">
        <text>全部揭示</text>
      </view>
      <view class="toolbar-btn" @click="coverAll">
        <text>重新遮盖</text>
      </view>
      <view class="toolbar-btn" @click="randomReveal">
        <text>随机揭示</text>
      </view>
      <text class="progress-text">已揭示 {{ revealedCount }}/{{ blocks.length }}</text>
    </view>
    <view class="toolbar chips">
      <view
        v-if="hasPinyin"
        class="chip"
        :class="{ active: showPinyin }"
        @click="showPinyin = !showPinyin"
      >
        <text>拼音</text>
      </view>
      <view class="chip" :class="{ active: firstHint }" @click="firstHint = !firstHint">
        <text>首字提示</text>
      </view>
      <view class="chip" :class="{ playing }" @click="playFullArticle">
        <text>{{ playing ? '朗读中…' : '🔊 朗读全文' }}</text>
      </view>
      <view class="chip nav" @click="goFillBlanks">
        <text>填空练习 ›</text>
      </view>
      <view class="chip nav" @click="goWriteDictation">
        <text>默写对比 ›</text>
      </view>
    </view>

    <!-- 正文遮挡块 -->
    <scroll-view scroll-y class="content-scroll">
      <view class="block-list">
        <view
          v-for="(block, idx) in blocks"
          :key="idx"
          class="block"
          :class="{ revealed: revealed[idx] }"
          @click="toggleBlock(idx)"
        >
          <template v-if="revealed[idx]">
            <text v-if="showPinyin && block.pinyin" class="block-pinyin">{{ block.pinyin }}</text>
            <text class="block-text">{{ block.text }}</text>
          </template>
          <view v-else class="block-mask">
            <text v-if="firstHint && firstChars[idx]" class="mask-first-char">{{ firstChars[idx] }}</text>
            <text class="block-mask-hint">点击回忆</text>
          </view>
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
import { ref, computed, watch } from 'vue'
import { onLoad, onUnload } from '@dcloudio/uni-app'
import { useTextMemory } from '@/stores/useTextMemory'
import type { MobileTextArticle } from '@/stores/useUtils/types'
import { splitAnnotatedBlocks, firstCharHint } from './recall'
import { findBuiltinPoem } from './library'
import { getPoetryAudioUrl, buildPoetrySpeakText } from '@/utils/poetry-audio'
import { buildChineseAudioUrls } from '@/utils/youdao-tts'
import { getTtsAdapter } from '@/adapters/index'

const store = useTextMemory()

const article = ref<MobileTextArticle | null>(null)
const loaded = ref(false)
const revealed = ref<boolean[]>([])
// 旧版本导入的文章没有 pinyin 字段：运行时从内置库按标题+正文回填，无需删库重导
const builtinPinyin = ref('')

// 显示偏好：拼音默认开（无拼音数据时不显示开关），首字提示默认关；均记住选择
const showPinyin = ref(uni.getStorageSync('text-recall-show-pinyin') !== false)
const firstHint = ref(uni.getStorageSync('text-recall-first-hint') === true)
watch(showPinyin, (v) => { try { uni.setStorageSync('text-recall-show-pinyin', v) } catch { /* 忽略 */ } })
watch(firstHint, (v) => { try { uni.setStorageSync('text-recall-first-hint', v) } catch { /* 忽略 */ } })

const blocks = computed(() =>
  article.value
    ? splitAnnotatedBlocks(article.value.content, article.value.pinyin || builtinPinyin.value || undefined)
    : [],
)

const hasPinyin = computed(() => blocks.value.some((b) => b.pinyin))

// 各块首字提示字符（首字提示开关开启时展示在遮盖块上）
const firstChars = computed(() => blocks.value.map((b) => firstCharHint(b.text)))

const revealedCount = computed(() => revealed.value.filter(Boolean).length)

const playing = ref(false)

onLoad((opt: any) => {
  store.load()
  const id = opt?.id ? decodeURIComponent(opt.id) : ''
  const found = store.articles.find((a) => a._id === id)
  if (found) {
    article.value = found
    revealed.value = blocks.value.map(() => false)
    if (!found.pinyin) {
      findBuiltinPoem(found.title, found.content, found.dynasty)
        .then((poem) => { if (poem?.pinyin) builtinPinyin.value = poem.pinyin })
        .catch(() => { /* 回填失败静默 */ })
    }
  }
  loaded.value = true
})

// 离开页面停止朗读，避免后台继续播放
onUnload(() => {
  try { getTtsAdapter().stop() } catch { /* 忽略 */ }
})

function toggleBlock(idx: number) {
  revealed.value[idx] = !revealed.value[idx]
}

function revealAll() {
  revealed.value = blocks.value.map(() => true)
}

function coverAll() {
  revealed.value = blocks.value.map(() => false)
}

/** 随机揭示约三分之一的未揭示块（至少 1 块），卡壳时给台阶 */
function randomReveal() {
  const masked: number[] = []
  revealed.value.forEach((r, i) => { if (!r) masked.push(i) })
  if (!masked.length) return
  const count = Math.max(1, Math.ceil(masked.length / 3))
  for (let i = masked.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[masked[i], masked[j]] = [masked[j], masked[i]]
  }
  for (const idx of masked.slice(0, count)) revealed.value[idx] = true
}

/**
 * 朗读全文：始终优先尝试 CDN 预合成音频（按标题+作者+正文哈希定位，
 * 内置诗词不论新旧导入都能命中；非内置内容 404 后自动回退），
 * 再退回中文在线音源链（有道智云/百度/谷歌）。
 */
async function playFullArticle() {
  if (!article.value || playing.value) return
  const a = article.value
  const speakText = buildPoetrySpeakText(a.title, a.author, a.content)
  const urls: string[] = [getPoetryAudioUrl(a.title, a.author, a.content)]
  urls.push(...buildChineseAudioUrls(speakText))
  playing.value = true
  let ok = false
  for (const url of urls) {
    try {
      await getTtsAdapter().playAudio(url)
      ok = true
      break
    } catch { /* 尝试下一音源 */ }
  }
  playing.value = false
  if (!ok) uni.showToast({ title: '朗读失败，请检查网络后重试', icon: 'none' })
}

function onRate(remembered: boolean) {
  if (!article.value) return
  store.rateArticle(article.value._id, remembered)
  uni.showToast({ title: remembered ? '太棒了，已记录' : '没关系，下次再来', icon: 'none' })
  setTimeout(() => uni.navigateBack(), 600)
}

function goFillBlanks() {
  if (!article.value) return
  uni.navigateTo({
    url: `/subPackages/pages-memory/text-memory/fill-blanks?id=${encodeURIComponent(article.value._id)}`,
  })
}

function goWriteDictation() {
  if (!article.value) return
  uni.navigateTo({
    url: `/subPackages/pages-memory/text-memory/write-dictation?id=${encodeURIComponent(article.value._id)}`,
  })
}

function goBack() {
  uni.navigateBack()
}
</script>

<style scoped>
.recall-page {
  min-height: 100vh;
  background: var(--sr-bg);
  display: flex;
  flex-direction: column;
  /* 建立层叠上下文，让内部 z-index:-1 的水墨背景压在页面底色之上 */
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
.chip.playing {
  background: var(--sr-primary-bg);
  color: var(--sr-primary);
}
.chip.nav {
  color: var(--sr-primary);
}
.progress-text {
  margin-left: auto;
  font-size: 22rpx;
  color: var(--sr-text-3);
}

.content-scroll {
  flex: 1;
  height: calc(100vh - 460rpx);
}
.block-list {
  padding: 24rpx;
}
.block {
  margin-bottom: 16rpx;
}
.block-pinyin {
  font-size: 24rpx;
  color: var(--sr-text-3);
  line-height: 1.6;
  display: block;
  background: var(--sr-card);
  border-radius: 12rpx 12rpx 0 0;
  padding: 14rpx 24rpx 0;
}
.block-text {
  font-size: 30rpx;
  color: var(--sr-text-strong);
  line-height: 1.9;
  display: block;
  background: var(--sr-card);
  border-radius: 12rpx;
  padding: 20rpx 24rpx;
}
.block-pinyin + .block-text {
  border-radius: 0 0 12rpx 12rpx;
  padding-top: 8rpx;
}
.block-mask {
  min-height: 88rpx;
  border-radius: 12rpx;
  background: rgba(82, 121, 111, 0.18);
  border: 1rpx dashed rgba(82, 121, 111, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
  padding: 12rpx 0;
}
.theme-dark .block-mask {
  background: rgba(131, 197, 168, 0.15);
  border-color: rgba(131, 197, 168, 0.35);
}
.mask-first-char {
  font-size: 40rpx;
  font-weight: bold;
  color: var(--sr-primary);
}
.block-mask-hint {
  font-size: 24rpx;
  color: rgba(82, 121, 111, 0.6);
}
.theme-dark .block-mask-hint {
  color: rgba(131, 197, 168, 0.7);
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
