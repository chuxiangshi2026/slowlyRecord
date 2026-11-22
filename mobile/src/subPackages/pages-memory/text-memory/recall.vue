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
      <view v-if="englishText" class="chip" :class="{ active: showEnglish }" @click="showEnglish = !showEnglish">
        <text>英文</text>
      </view>
      <view v-else class="chip nav" @click="doTranslateEnglish">
        <text>{{ translating ? '翻译中…' : '译英文' }}</text>
      </view>
      <view class="chip" :class="{ active: firstHint }" @click="firstHint = !firstHint">
        <text>首字提示</text>
      </view>
      <view class="chip" :class="{ playing }" @click="playFullArticle">
        <text>{{ playing ? '朗读中…' : '🔊 朗读全文' }}</text>
      </view>
      <view class="chip" @click="cycleSpeechRate">
        <text>语速×{{ speechRate }}</text>
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
      <!-- 英文译文（人工英译/在线翻译缓存），显示在正文上方 -->
      <view v-if="showEnglish && englishText" class="english-panel">
        <text class="english-label">English{{ englishSourceLabel ? ` · ${englishSourceLabel}` : '' }}</text>
        <text class="english-text">{{ englishText }}</text>
      </view>
      <view class="block-list">
        <view
          v-for="(block, idx) in blocks"
          :key="idx"
          class="block"
          :class="{ revealed: revealed[idx] }"
          @click="toggleBlock(idx)"
        >
          <template v-if="revealed[idx]">
            <!-- 逐字注音：拼音在字正上方 -->
            <view v-if="rubyBlocks[idx]" class="ruby-line">
              <view v-for="(rc, ci) in rubyBlocks[idx]!" :key="ci" class="ruby-unit">
                <text class="ruby-py">{{ rc.pinyin || ' ' }}</text>
                <text class="ruby-char">{{ rc.char }}</text>
              </view>
            </view>
            <template v-else>
              <text v-if="showPinyin && block.pinyin" class="block-pinyin">{{ block.pinyin }}</text>
              <text class="block-text">{{ block.text }}</text>
            </template>
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
import { splitAnnotatedBlocks, firstCharHint, alignPinyinChars, type RubyChar } from './recall'
import { findBuiltinPoem } from './library'
import { getPoetryAudioUrl, buildPoetrySpeakText } from '@/utils/poetry-audio'
import { cdnUrlVariants } from '@/utils/cdn-mirror'
import { quickTranslateToEnglish } from '@/utils/quick-translate'
import { getTtsAdapter } from '@/adapters/index'
import { speakChineseLongText, stopSpeaking } from '@/utils/word-audio'

const store = useTextMemory()

const article = ref<MobileTextArticle | null>(null)
const loaded = ref(false)
const revealed = ref<boolean[]>([])
// 旧版本导入的文章没有 pinyin/translation 字段：运行时从内置库按标题+正文回填，无需删库重导
const builtinPinyin = ref('')
const builtinTranslation = ref('')
// 英文译文展示开关（有译文时出现「英文」chip）与在线翻译状态
const showEnglish = ref(uni.getStorageSync('text-recall-show-english') === true)
const translating = ref(false)

// 显示偏好：拼音默认开（无拼音数据时不显示开关），首字提示默认关；均记住选择
const showPinyin = ref(uni.getStorageSync('text-recall-show-pinyin') !== false)
const firstHint = ref(uni.getStorageSync('text-recall-first-hint') === true)
watch(showPinyin, (v) => { try { uni.setStorageSync('text-recall-show-pinyin', v) } catch { /* 忽略 */ } })
watch(firstHint, (v) => { try { uni.setStorageSync('text-recall-first-hint', v) } catch { /* 忽略 */ } })
watch(showEnglish, (v) => { try { uni.setStorageSync('text-recall-show-english', v) } catch { /* 忽略 */ } })

const blocks = computed(() =>
  article.value
    ? splitAnnotatedBlocks(article.value.content, article.value.pinyin || builtinPinyin.value || undefined)
    : [],
)

// 逐字注音序列（拼音显示在字正上方）；对齐失败或无拼音时为 null，模板退化为整行拼音
const rubyBlocks = computed<(RubyChar[] | null)[]>(() =>
  blocks.value.map((b) => (showPinyin.value && b.pinyin ? alignPinyinChars(b.text, b.pinyin) : null)),
)

// 英文译文（内置人工英译或在线翻译缓存）
const englishText = computed(() => article.value?.translation || builtinTranslation.value || '')

// 译文来源标注：人工英译显示来源，机器翻译不显示
const englishSourceLabel = computed(() => {
  const src = article.value?.translationSource || ''
  return src && src !== 'machine' ? src : ''
})

const hasPinyin = computed(() => blocks.value.some((b) => b.pinyin))

// 各块首字提示字符（首字提示开关开启时展示在遮盖块上）
const firstChars = computed(() => blocks.value.map((b) => firstCharHint(b.text)))

const revealedCount = computed(() => revealed.value.filter(Boolean).length)

const playing = ref(false)
// 页面已退出标记：连播被 stopSpeaking 中断时不弹「朗读失败」
let pageExited = false
// 内置库匹配结果（onLoad 时发起）：命中才探测 CDN 预合成音频，非内置文章直接分段连播
let builtinPoemPromise: Promise<Awaited<ReturnType<typeof findBuiltinPoem>> | null> = Promise.resolve(null)

// 朗读语速：0.75 / 1 / 1.25 循环切换，记住选择
const SPEECH_RATES = [1, 0.75, 1.25]
const speechRate = ref(Number(uni.getStorageSync('text-recall-speech-rate')) || 1)
function cycleSpeechRate() {
  const idx = SPEECH_RATES.indexOf(speechRate.value)
  speechRate.value = SPEECH_RATES[(idx + 1) % SPEECH_RATES.length]
  try { uni.setStorageSync('text-recall-speech-rate', speechRate.value) } catch { /* 忽略 */ }
}

onLoad((opt: any) => {
  store.load()
  const id = opt?.id ? decodeURIComponent(opt.id) : ''
  const found = store.articles.find((a) => a._id === id)
  if (found) {
    article.value = found
    revealed.value = blocks.value.map(() => false)
    // 内置库匹配结果同时用于：拼音/译文回填 + 朗读时是否值得探测 CDN 预合成音频
    builtinPoemPromise = findBuiltinPoem(found.title, found.content, found.dynasty).catch(() => null)
    builtinPoemPromise.then((poem) => {
      if (!poem) return
      if (!found.pinyin && poem.pinyin) builtinPinyin.value = poem.pinyin
      if (!found.translation && poem.translation) builtinTranslation.value = poem.translation
    })
  }
  loaded.value = true
})

// 离开页面停止朗读：stopSpeaking 同时作废连播代次，避免后台继续播放
onUnload(() => {
  pageExited = true
  stopSpeaking()
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
 * 朗读全文：内置库文章优先尝试 CDN 预合成音频（按标题+作者+正文哈希定位）；
 * 非内置文章跳过 CDN 探测（404 重试浪费数秒），直接中文在线音源链分段连播
 * （免费 TTS 对长文本会截断，分段规避；下一段边播边预取）。
 */
async function playFullArticle() {
  if (!article.value || playing.value) return
  const a = article.value
  const speakText = buildPoetrySpeakText(a.title, a.author, a.content)
  playing.value = true
  let ok = false
  // 仅内置库文章才可能有预合成音频：命中才探测 CDN（主域 + 镜像域）
  const poem = await builtinPoemPromise
  if (poem) {
    for (const url of cdnUrlVariants(getPoetryAudioUrl(a.title, a.author, a.content))) {
      try {
        // 静默探测：CDN 未命中时不弹错误提示，直接落到分段连播
        await getTtsAdapter().playAudio(url, { rate: speechRate.value, silent: true })
        ok = true
        break
      } catch { /* 尝试下一镜像 */ }
    }
  }
  // CDN 不适用/失败：在线中文音源链分段连播
  if (!ok) {
    ok = await speakChineseLongText(speakText, { rate: speechRate.value, userInitiated: true })
  }
  playing.value = false
  if (!ok && !pageExited) uni.showToast({ title: '朗读失败，请检查网络后重试', icon: 'none' })
}

/** 在线译英文：按当前翻译引擎设置翻译全文并缓存到文章（下次打开直接显示） */
async function doTranslateEnglish() {
  if (!article.value || translating.value) return
  const a = article.value
  translating.value = true
  try {
    const res = await quickTranslateToEnglish(a.content)
    if (!res.ok) {
      uni.showModal({ title: '译英文失败', content: res.error, showCancel: false })
      return
    }
    store.updateArticle(a._id, { translation: res.text, translationSource: 'machine' })
    article.value = { ...a, translation: res.text, translationSource: 'machine' }
    showEnglish.value = true
    uni.showToast({ title: '已生成英文译文', icon: 'none' })
  } finally {
    translating.value = false
  }
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

/* 逐字注音（拼音正上方） */
.ruby-line {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  background: var(--sr-card);
  border-radius: 12rpx;
  padding: 14rpx 20rpx 16rpx;
}
.ruby-unit {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-right: 12rpx;
}
.ruby-py {
  font-size: 20rpx;
  color: var(--sr-text-3);
  line-height: 1.4;
  white-space: nowrap;
}
.ruby-char {
  font-size: 32rpx;
  color: var(--sr-text-strong);
  line-height: 1.5;
}

/* 英文译文面板 */
.english-panel {
  margin: 24rpx 24rpx 0;
  background: var(--sr-card);
  border: 1rpx dashed var(--sr-border);
  border-radius: 16rpx;
  padding: 20rpx 24rpx;
}
.english-label {
  display: block;
  font-size: 22rpx;
  color: var(--sr-text-3);
  margin-bottom: 8rpx;
}
.english-text {
  display: block;
  font-size: 26rpx;
  color: var(--sr-text-2);
  line-height: 1.8;
  font-style: italic;
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
