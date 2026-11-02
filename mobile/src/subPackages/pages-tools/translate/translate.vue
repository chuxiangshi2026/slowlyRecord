<template>
  <view class="translate-container" :class="themeClass">
    <view class="input-section">
      <textarea 
        class="input-area" 
        v-model="inputText"
        placeholder="输入要翻译的文本..."
        maxlength="500"
      />
      <text class="char-count">{{ inputText.length }}/500</text>
    </view>

    <view class="action-row">
      <button class="translate-btn" @click="translate" :disabled="isTranslating || !inputText">
        {{ isTranslating ? '翻译中...' : '翻译' }}
      </button>
      <button class="camera-btn" @click="handleCapture()">
        📷 拍照/相册
      </button>
    </view>

    <view v-if="ocrResult" class="ocr-section">
      <view class="result-header">
        <text class="result-title">识别结果</text>
      </view>
      <text class="result-text">{{ ocrResult }}</text>
      <!-- 识别文本分词后的词条列表，可选中并批量加入当前词库 -->
      <view v-if="ocrTokens.length" class="token-list">
        <!-- 批量操作条 -->
        <view class="token-toolbar">
          <text class="toolbar-action" @click="selectAllTokens">全选</text>
          <text class="toolbar-action" @click="clearSelectedTokens">清空</text>
          <button
            class="token-batch-btn"
            :disabled="isBatchAdding || selectedTokens.length === 0"
            @click="batchAddToBank"
          >
            {{ isBatchAdding ? '加入中...' : `批量加入词库（${selectedTokens.length}）` }}
          </button>
        </view>
        <view
          v-for="token in ocrTokens"
          :key="token"
          class="token-item"
          :class="{ selected: selectedKeys.has(getWordKey(token)) }"
          @click="toggleToken(token)"
        >
          <text class="token-word">{{ token }}</text>
          <text v-if="ocrWordMap.get(getWordKey(token))?.meaning" class="token-meaning">{{ ocrWordMap.get(getWordKey(token))?.meaning }}</text>
          <button
            class="token-add-btn"
            :disabled="addingKey === getWordKey(token) || addedKeys.has(getWordKey(token))"
            @click.stop="addTokenToBank(token)"
          >
            {{ addedKeys.has(getWordKey(token)) ? '已加入' : '加入词库' }}
          </button>
        </view>
      </view>
    </view>

    <view v-if="result" class="result-section">
      <view class="result-header">
        <text class="result-title">
          {{ result.offline ? '📴 离线翻译' : '翻译结果' }}
        </text>
        <text class="result-lang">{{ result.from }} → {{ result.to }}</text>
        <button
          v-if="canAddInput"
          class="result-add-btn"
          :disabled="addingKey === getWordKey(inputText)"
          @click="addInputToBank"
        >
          ＋ 加入词库
        </button>
      </view>
      <text class="result-text">{{ result.translation }}</text>
      <view v-if="result.phonetic" class="phonetic">
        <text>音标: {{ result.phonetic }}</text>
      </view>
      <view v-if="result.offline" class="offline-tag">
        <text>离线释义，仅供参考</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad, onUnload } from '@dcloudio/uni-app'
import { translateText } from '../utils/translation'
import { queryOfflineDict } from '@/stores/useUtils/offline-dict'
import { inferMobileItemType, normalizeMobileItemText } from '@/stores/useUtils/text'
import { useMobileWords } from '@/stores/useMobileWords'
import { getWordKey } from '@/utils/text-utils'
import { getCaptureAdapter } from '../utils/capture'
import { recognizeImageWords, type OcrWordResult } from '../utils/ocr'
import {
  defaultSelectedTokens,
  toggleTokenSelection,
  selectedTokenList,
  summarizeBatchAdd
} from './translate-tokens'

const wordsStore = useMobileWords()
const inputText = ref('')
const result = ref<any>(null)
const isTranslating = ref(false)
const ocrResult = ref('')
// OCR 文本分词后的词条列表
const ocrTokens = ref<string[]>([])
// OCR 识别出的词条详情（key 为 getWordKey 规范化小写），加入词库时复用释义/音标
const ocrWordMap = ref<Map<string, OcrWordResult>>(new Map())
// 词条选中态（key 为 getWordKey 规范化小写），新一次 OCR 识别后默认全选
const selectedKeys = ref<Set<string>>(new Set())
// 批量加入进行中，防止连点
const isBatchAdding = ref(false)
// 已加入词库的词条 key（getWordKey 规范化小写）
const addedKeys = ref<Set<string>>(new Set())
// 正在添加中的词条 key，防止重复点击
const addingKey = ref('')

// 当前选中的词条列表（保持原顺序，用于批量加入）
const selectedTokens = computed(() => selectedTokenList(ocrTokens.value, selectedKeys.value))

/** 点击词条本身切换选中态 */
const toggleToken = (token: string) => {
  selectedKeys.value = toggleTokenSelection(selectedKeys.value, token)
}

const selectAllTokens = () => {
  selectedKeys.value = defaultSelectedTokens(ocrTokens.value)
}

const clearSelectedTokens = () => {
  selectedKeys.value = new Set<string>()
}

// 翻译结果存在且输入不是超长文本时，允许整段加入词库
const canAddInput = computed(() => {
  const text = normalizeMobileItemText(inputText.value)
  return !!result.value && !!text && text.length <= 100
})

/**
 * 把词条加入当前激活词库（复用 add-word 页的添加流程）。
 * 已有释义则直接传入；否则尝试调用翻译引擎补全，拿不到就只存单词。
 * silent 为 true 时不弹 toast（批量加入模式），返回加入结果供汇总。
 */
const addWordToBank = async (
  rawText: string,
  presetMeaning = '',
  silent = false,
  presetPhonetic = ''
): Promise<'added' | 'duplicate' | 'failed'> => {
  const wordText = normalizeMobileItemText(rawText)
  const language = wordsStore.currentLanguage
  if (!wordText || addingKey.value === getWordKey(wordText, language)) return 'failed'

  // 确保词库数据已加载，否则判重会失效
  await wordsStore.loadWords()
  const key = getWordKey(wordText, language)
  if (wordsStore.words.some(w => getWordKey(w.word, language) === key)) {
    if (!silent) uni.showToast({ title: '已在词库中', icon: 'none' })
    return 'duplicate'
  }

  addingKey.value = key
  try {
    let meaning = presetMeaning.trim()
    let phonetic = presetPhonetic
    let example = ''
    if (!meaning) {
      // 尝试用当前翻译引擎补全释义；失败不阻断，只存单词
      try {
        const res = await translateText(wordText, language, 'zh')
        if (res.success && res.translatedText && res.translatedText !== wordText) {
          meaning = res.translatedText
          phonetic = phonetic || res.phonetic || ''
          if (res.examples && res.examples.length > 0) {
            const ex = res.examples[0]
            example = ex.english + (ex.chinese ? ' — ' + ex.chinese : '')
          }
        }
      } catch { /* 拿不到释义就只存单词 */ }
    } else {
      // 整段加入时复用翻译结果里的音标
      phonetic = phonetic || result.value?.phonetic || ''
    }

    await wordsStore.addWord({
      word: wordText,
      itemType: inferMobileItemType(wordText, language),
      meaning,
      phonetic,
      example,
      addTime: Date.now(),
      reviewCount: 0,
      nextReviewTime: Date.now() + 24 * 60 * 60 * 1000
    })
    addedKeys.value.add(key)
    if (!silent) uni.showToast({ title: '已加入词库', icon: 'success' })
    return 'added'
  } catch (e: any) {
    if (!silent) uni.showToast({ title: '添加失败: ' + (e.message || '未知错误'), icon: 'none' })
    return 'failed'
  } finally {
    addingKey.value = ''
  }
}

// OCR 词条加入词库（识别结果自带释义/音标，直接复用）
const addTokenToBank = (token: string) => {
  const detail = ocrWordMap.value.get(getWordKey(token))
  return addWordToBank(token, detail?.meaning || '', false, detail?.phonetic || '')
}

/** 批量加入选中词条：逐条走单条加入逻辑（判重 + 释义补全），完成后统一汇总 toast */
const batchAddToBank = async () => {
  if (isBatchAdding.value) return
  const tokens = selectedTokens.value
  if (tokens.length === 0) return
  isBatchAdding.value = true
  let added = 0
  let duplicated = 0
  let failed = 0
  try {
    for (const token of tokens) {
      const detail = ocrWordMap.value.get(getWordKey(token))
      const status = await addWordToBank(token, detail?.meaning || '', true, detail?.phonetic || '')
      if (status === 'added') added++
      else if (status === 'duplicate') duplicated++
      else failed++
    }
    uni.showToast({ title: summarizeBatchAdd(added, duplicated, failed), icon: 'none' })
  } finally {
    isBatchAdding.value = false
  }
}

// 输入的整段文本（翻译结果原文）加入词库，释义直接复用翻译结果
const addInputToBank = () => addWordToBank(inputText.value, result.value?.translation || '')

const translate = async () => {
  if (!inputText.value.trim()) return

  isTranslating.value = true
  try {
    const res = await translateText(inputText.value, 'auto', 'zh')
    result.value = {
      translation: res.explains,
      from: 'en',
      to: 'zh',
      phonetic: res.phonetic,
      offline: res.platform === 'local'
    }
    if (res.errorMsg) {
      uni.showToast({ title: res.errorMsg, icon: 'none' })
    }
  } catch (e) {
    // 网络失败时尝试离线词典
    const offline = queryOfflineDict(inputText.value.trim())
    if (offline) {
      result.value = {
        translation: offline,
        from: 'en',
        to: 'zh',
        offline: true
      }
      uni.showToast({ title: '使用离线词典', icon: 'none' })
    } else {
      uni.showToast({ title: '翻译失败', icon: 'none' })
    }
  } finally {
    isTranslating.value = false
  }
}

// 拍照/相册选图 → OCR 识别单词（腾讯云 OCR 或视觉大模型，密钥复用翻译设置）
const handleCapture = async (sourceType?: 'album' | 'camera') => {
  await wordsStore.loadWords()
  if (wordsStore.currentLanguage !== 'en') {
    uni.showToast({ title: '拍照加词暂仅支持英语词库', icon: 'none' })
    return
  }
  try {
    const capture = await getCaptureAdapter().capture(sourceType ? [sourceType] : undefined)
    uni.showLoading({ title: '识别中...', mask: true })
    let words: OcrWordResult[] = []
    try {
      words = await recognizeImageWords(capture.base64)
    } catch (e: any) {
      uni.showToast({ title: e.message || '识别失败', icon: 'none' })
      return
    } finally {
      uni.hideLoading()
    }
    if (!words.length) {
      uni.showToast({ title: '未识别到单词', icon: 'none' })
      return
    }
    ocrWordMap.value = new Map(words.map(w => [getWordKey(w.word), w]))
    ocrTokens.value = words.map(w => w.word)
    ocrResult.value = words.map(w => (w.meaning ? `${w.word}  ${w.meaning}` : w.word)).join('\n')
    // 新识别结果默认全选
    selectedKeys.value = defaultSelectedTokens(ocrTokens.value)
    addedKeys.value = new Set()
  } catch (e: any) {
    if (e.message !== '截图取消' && e.message !== '未选择图片') {
      uni.showToast({ title: e.message || '获取图片失败', icon: 'none' })
    }
  }
}

// 外部入口：添加单词页/截屏引导跳转过来时自动拉起识别（autoCapture=all|album）
onLoad((query) => {
  const auto = query?.autoCapture
  if (auto === 'album' || auto === 'camera') {
    handleCapture(auto)
  } else if (auto) {
    handleCapture()
  }
  uni.$on('translate:autoCapture', handleCapture)
})

onUnload(() => {
  uni.$off('translate:autoCapture', handleCapture)
})
</script>

<style scoped>
.translate-container {
  padding: 30rpx;
  min-height: 100vh;
  background: var(--sr-bg);
}

.input-section {
  position: relative;
  background: var(--sr-card);
  border-radius: 12rpx;
  padding: 20rpx;
  margin-bottom: 30rpx;
}

.input-area {
  width: 100%;
  height: 300rpx;
  font-size: 30rpx;
  line-height: 1.6;
  color: var(--sr-text);
}

.char-count {
  position: absolute;
  bottom: 20rpx;
  right: 20rpx;
  font-size: 24rpx;
  color: var(--sr-text-3);
}

.action-row {
  display: flex;
  gap: 20rpx;
  margin-bottom: 30rpx;
}

.translate-btn {
  flex: 1;
  height: 90rpx;
  background: var(--sr-primary);
  color: var(--sr-on-primary);
  border-radius: 12rpx;
  font-size: 32rpx;
  border: none;
}

.translate-btn:disabled {
  background: #ccc;
}

.camera-btn {
  width: 200rpx;
  height: 90rpx;
  background: var(--sr-primary-2);
  color: var(--sr-on-primary);
  border-radius: 12rpx;
  font-size: 28rpx;
  border: none;
}

.ocr-section {
  background: var(--sr-card);
  border-radius: 12rpx;
  padding: 30rpx;
  margin-bottom: 30rpx;
  border-left: 8rpx solid var(--sr-primary);
}

.result-section {
  background: var(--sr-card);
  border-radius: 12rpx;
  padding: 30rpx;
}

.result-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.result-title {
  font-size: 32rpx;
  font-weight: bold;
  color: var(--sr-text);
}

.result-lang {
  font-size: 24rpx;
  color: var(--sr-text-2);
}

.result-text {
  font-size: 34rpx;
  color: var(--sr-text-strong);
  line-height: 1.6;
  display: block;
  font-weight: 500;
}

.phonetic {
  margin-top: 20rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid var(--sr-border);
  font-size: 26rpx;
  color: var(--sr-text-2);
}

.offline-tag {
  margin-top: 20rpx;
  padding: 16rpx;
  background: #fdf6ec;
  border-radius: 8rpx;
  font-size: 24rpx;
  color: #c07a2b;
}

.theme-dark .offline-tag {
  background: rgba(255, 183, 77, 0.12);
  color: #e0a458;
}

.token-list {
  margin-top: 20rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid var(--sr-border);
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

/* 批量操作条 */
.token-toolbar {
  display: flex;
  align-items: center;
  gap: 24rpx;
  margin-bottom: 8rpx;
}

.toolbar-action {
  font-size: 26rpx;
  color: var(--sr-primary);
  padding: 8rpx 4rpx;
}

.toolbar-action:active {
  opacity: 0.6;
}

.token-batch-btn {
  margin-left: auto;
  height: 60rpx;
  line-height: 60rpx;
  background: var(--sr-primary);
  color: var(--sr-on-primary);
  border-radius: 30rpx;
  font-size: 24rpx;
  border: none;
  padding: 0 28rpx;
}

.token-batch-btn[disabled] {
  background: #b7c9c2;
  color: #fff;
}

.token-item {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 12rpx 16rpx;
  border-radius: 12rpx;
  border: 2rpx solid transparent;
}

/* 选中态：主色边框高亮 */
.token-item.selected {
  border-color: var(--sr-primary);
  background: rgba(82, 121, 111, 0.08);
}

.theme-dark .token-item.selected {
  background: rgba(131, 197, 168, 0.12);
}

.token-item:active {
  background: rgba(82, 121, 111, 0.05);
}

.theme-dark .token-item:active {
  background: rgba(131, 197, 168, 0.08);
}

.token-word {
  font-size: 28rpx;
  color: var(--sr-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex-shrink: 0;
  max-width: 40%;
}

.token-meaning {
  flex: 1;
  font-size: 24rpx;
  color: var(--sr-text-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.token-add-btn {
  width: 150rpx;
  height: 56rpx;
  line-height: 56rpx;
  background: var(--sr-primary);
  color: var(--sr-on-primary);
  border-radius: 28rpx;
  font-size: 24rpx;
  border: none;
  padding: 0;
  flex-shrink: 0;
}

.token-add-btn[disabled] {
  background: #b7c9c2;
  color: #fff;
}

.result-add-btn {
  height: 56rpx;
  line-height: 56rpx;
  background: var(--sr-primary);
  color: var(--sr-on-primary);
  border-radius: 28rpx;
  font-size: 24rpx;
  border: none;
  padding: 0 24rpx;
  flex-shrink: 0;
}

.result-add-btn[disabled] {
  background: #b7c9c2;
  color: #fff;
}
</style>
