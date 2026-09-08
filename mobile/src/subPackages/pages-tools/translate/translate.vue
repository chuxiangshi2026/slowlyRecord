<template>
  <view class="translate-container">
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
      <button class="camera-btn" @click="handleCapture">
        📷 拍照
      </button>
    </view>

    <view v-if="ocrResult" class="ocr-section">
      <view class="result-header">
        <text class="result-title">识别结果</text>
      </view>
      <text class="result-text">{{ ocrResult }}</text>
      <!-- 识别文本分词后的词条列表，可一键加入当前词库 -->
      <view v-if="ocrTokens.length" class="token-list">
        <view v-for="token in ocrTokens" :key="token" class="token-item">
          <text class="token-word">{{ token }}</text>
          <button
            class="token-add-btn"
            :disabled="addingKey === getWordKey(token) || addedKeys.has(getWordKey(token))"
            @click="addTokenToBank(token)"
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
import { translateText } from '../utils/translation'
import { queryOfflineDict } from '@/stores/useUtils/offline-dict'
import { inferMobileItemType, normalizeMobileItemText } from '@/stores/useUtils/text'
import { useMobileWords } from '@/stores/useMobileWords'
import { getWordKey } from '@/utils/text-utils'
import { getCaptureAdapter } from '../utils/capture'

const wordsStore = useMobileWords()
const inputText = ref('')
const result = ref<any>(null)
const isTranslating = ref(false)
const ocrResult = ref('')
// OCR 文本分词后的词条列表
const ocrTokens = ref<string[]>([])
// 已加入词库的词条 key（getWordKey 规范化小写）
const addedKeys = ref<Set<string>>(new Set())
// 正在添加中的词条 key，防止重复点击
const addingKey = ref('')

// 翻译结果存在且输入不是超长文本时，允许整段加入词库
const canAddInput = computed(() => {
  const text = normalizeMobileItemText(inputText.value)
  return !!result.value && !!text && text.length <= 100
})

/** 从 OCR 识别文本中提取英文词条（去重、过滤单字母、最多 60 个） */
const extractWordTokens = (text: string): string[] => {
  const matches = text.match(/[A-Za-z][A-Za-z'-]{1,}/g) || []
  const seen = new Set<string>()
  const tokens: string[] = []
  for (const m of matches) {
    const key = getWordKey(m)
    if (seen.has(key)) continue
    seen.add(key)
    tokens.push(m)
    if (tokens.length >= 60) break
  }
  return tokens
}

/**
 * 把词条加入当前激活词库（复用 add-word 页的添加流程）。
 * 已有释义则直接传入；否则尝试调用翻译引擎补全，拿不到就只存单词。
 */
const addWordToBank = async (rawText: string, presetMeaning = '') => {
  const wordText = normalizeMobileItemText(rawText)
  if (!wordText || addingKey.value === getWordKey(wordText)) return

  // 确保词库数据已加载，否则判重会失效
  await wordsStore.loadWords()
  const key = getWordKey(wordText)
  if (wordsStore.words.some(w => getWordKey(w.word) === key)) {
    uni.showToast({ title: '已在词库中', icon: 'none' })
    return
  }

  addingKey.value = key
  try {
    let meaning = presetMeaning.trim()
    let phonetic = ''
    let example = ''
    if (!meaning) {
      // 尝试用当前翻译引擎补全释义；失败不阻断，只存单词
      try {
        const res = await translateText(wordText, 'auto', 'zh')
        if (res.success && res.translatedText && res.translatedText !== wordText) {
          meaning = res.translatedText
          phonetic = res.phonetic || ''
          if (res.examples && res.examples.length > 0) {
            const ex = res.examples[0]
            example = ex.english + (ex.chinese ? ' — ' + ex.chinese : '')
          }
        }
      } catch { /* 拿不到释义就只存单词 */ }
    } else {
      // 整段加入时复用翻译结果里的音标
      phonetic = result.value?.phonetic || ''
    }

    await wordsStore.addWord({
      word: wordText,
      itemType: inferMobileItemType(wordText),
      meaning,
      phonetic,
      example,
      addTime: Date.now(),
      reviewCount: 0,
      nextReviewTime: Date.now() + 24 * 60 * 60 * 1000
    })
    addedKeys.value.add(key)
    uni.showToast({ title: '已加入词库', icon: 'success' })
  } catch (e: any) {
    uni.showToast({ title: '添加失败: ' + (e.message || '未知错误'), icon: 'none' })
  } finally {
    addingKey.value = ''
  }
}

// OCR 词条加入词库
const addTokenToBank = (token: string) => addWordToBank(token)

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

const handleCapture = async () => {
  try {
    const adapter = getCaptureAdapter()
    const capture = await adapter.capture()
    uni.showToast({ title: '图片已获取', icon: 'success' })

    // 尝试 OCR
    try {
      const ocrRes = await adapter.ocr(capture.base64)
      if (ocrRes.length > 0) {
        ocrResult.value = ocrRes.map(r => r.text).join('\n')
        // 识别结果分词为词条列表，供一键加入词库
        ocrTokens.value = extractWordTokens(ocrResult.value)
        addedKeys.value = new Set()
        inputText.value = ocrResult.value
        // 自动翻译
        translate()
      } else {
        uni.showToast({ title: '未识别到文字', icon: 'none' })
      }
    } catch {
      // OCR 不可用，仅显示提示
      uni.showToast({ title: 'OCR 暂不可用', icon: 'none' })
    }
  } catch (e: any) {
    if (e.message !== '截图取消' && e.message !== '未选择图片') {
      uni.showToast({ title: e.message || '获取图片失败', icon: 'none' })
    }
  }
}
</script>

<style scoped>
.translate-container {
  padding: 30rpx;
  min-height: 100vh;
  background: #f5f5f5;
}

.input-section {
  position: relative;
  background: #fff;
  border-radius: 12rpx;
  padding: 20rpx;
  margin-bottom: 30rpx;
}

.input-area {
  width: 100%;
  height: 300rpx;
  font-size: 30rpx;
  line-height: 1.6;
}

.char-count {
  position: absolute;
  bottom: 20rpx;
  right: 20rpx;
  font-size: 24rpx;
  color: #999;
}

.action-row {
  display: flex;
  gap: 20rpx;
  margin-bottom: 30rpx;
}

.translate-btn {
  flex: 1;
  height: 90rpx;
  background: #1976d2;
  color: #fff;
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
  background: #4caf50;
  color: #fff;
  border-radius: 12rpx;
  font-size: 28rpx;
  border: none;
}

.ocr-section {
  background: #fff;
  border-radius: 12rpx;
  padding: 30rpx;
  margin-bottom: 30rpx;
  border-left: 8rpx solid #ff9800;
}

.result-section {
  background: #fff;
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
  color: #333;
}

.result-lang {
  font-size: 24rpx;
  color: #666;
}

.result-text {
  font-size: 34rpx;
  color: #1a1a1a;
  line-height: 1.6;
  display: block;
  font-weight: 500;
}

.phonetic {
  margin-top: 20rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid #eee;
  font-size: 26rpx;
  color: #444;
}

.offline-tag {
  margin-top: 20rpx;
  padding: 16rpx;
  background: #fff3e0;
  border-radius: 8rpx;
  font-size: 24rpx;
  color: #e65100;
}

.token-list {
  margin-top: 20rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid #eee;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.token-item {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.token-word {
  flex: 1;
  font-size: 28rpx;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.token-add-btn {
  width: 150rpx;
  height: 56rpx;
  line-height: 56rpx;
  background: #52796f;
  color: #fff;
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
  background: #52796f;
  color: #fff;
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
