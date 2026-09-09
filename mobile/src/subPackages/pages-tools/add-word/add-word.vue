<template>
  <view class="add-word-container">
    <!-- 落点提示：告知词将加入哪个词库，可点击切换 -->
    <view class="bank-tip" @click="goToWordbank">
      <text class="bank-tip-text">添加到：{{ currentBankName }}</text>
      <text class="bank-tip-arrow">切换 ›</text>
    </view>

    <!-- 输入单词/词组/句子 -->
    <view class="form-group">
      <text class="form-label">单词/词组/句子</text>
      <view class="input-row">
        <input 
          class="form-input" 
          v-model="newWord.word"
          placeholder="输入单词/词组/句子（如：take care）"
          @confirm="autoTranslate"
          focus
        />
        <button class="btn-translate" :loading="translating" @click="autoTranslate">
          {{ translating ? '翻译中' : '翻译' }}
        </button>
      </view>
    </view>

    <!-- 释义 -->
    <view class="form-group">
      <text class="form-label">释义</text>
      <textarea
        class="form-textarea"
        v-model="newWord.meaning"
        placeholder="释义（自动填充或手动输入）"
        :auto-height="true"
        :maxlength="-1"
      />
    </view>

    <!-- 音标 -->
    <view class="form-group">
      <text class="form-label">音标（可选）</text>
      <input 
        class="form-input" 
        v-model="newWord.phonetic"
        placeholder="如 /ˈæp.əl/"
      />
    </view>

    <!-- 例句（仅 AI 引擎可自动填充时显示） -->
    <view v-if="showExampleField" class="form-group">
      <text class="form-label">例句（可选）</text>
      <textarea
        class="form-textarea"
        v-model="newWord.example"
        placeholder="例句（自动填充或手动输入）"
        :auto-height="true"
        :maxlength="-1"
      />
    </view>

    <view class="form-actions">
      <button class="btn-cancel" @click="goBack">取消</button>
      <button class="btn-confirm" @click="addWord">确定添加</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useMobileWords } from '@/stores/useMobileWords'
import { translateText } from '../utils/translation'
import { inferMobileItemType, normalizeMobileItemText } from '@/stores/useUtils/text'
import { getWordKey } from '@/utils/text-utils'

const wordsStore = useMobileWords()
const translating = ref(false)
const showExampleField = ref(false)
const newWord = ref({ 
  word: '', 
  meaning: '',
  phonetic: '',
  example: ''
})

// 当前词库名（词库切换后返回时通过 onShow 重新加载刷新）
const currentBankName = computed(() => {
  const bank = wordsStore.getBankById(wordsStore.currentBankId)
  return bank?.name || '默认词库'
})

onShow(() => {
  wordsStore.loadWords()
})

// 执行翻译并填充释义（调用方已处理覆盖确认）
const doTranslate = async (wordText: string) => {
  translating.value = true
  try {
    const result = await translateText(wordText, 'auto', 'zh')
    if (result.success && result.translatedText && result.translatedText !== newWord.value.word) {
      newWord.value.meaning = result.translatedText
      if (result.phonetic && !newWord.value.phonetic.trim()) {
        newWord.value.phonetic = result.phonetic
      }
      if (result.examples && result.examples.length > 0 && !newWord.value.example.trim()) {
        const ex = result.examples[0]
        newWord.value.example = ex.english + (ex.chinese ? ' — ' + ex.chinese : '')
        showExampleField.value = true
      }
    } else if (!result.success) {
      console.warn('翻译失败:', result.errorMsg, 'platform:', result.platform)
      uni.showToast({ title: result.errorMsg || '翻译失败，请手动输入释义', icon: 'none', duration: 2000 })
    }
  } catch (e: any) {
    console.error('翻译异常:', e)
    uni.showToast({ title: '翻译异常: ' + (e.message || '未知错误'), icon: 'none', duration: 2000 })
  } finally {
    translating.value = false
  }
}

// 自动翻译：释义框已有内容时先确认覆盖，避免静默无反应
const autoTranslate = async () => {
  const wordText = normalizeMobileItemText(newWord.value.word)
  if (!wordText || translating.value) return
  if (newWord.value.meaning.trim()) {
    uni.showModal({
      title: '重新翻译',
      content: '释义框已有内容，重新翻译将覆盖当前释义，是否继续？',
      confirmText: '覆盖',
      confirmColor: '#52796f',
      success: (res) => {
        if (res.confirm) doTranslate(wordText)
      }
    })
    return
  }
  await doTranslate(wordText)
}

const addWord = async () => {
  const wordText = normalizeMobileItemText(newWord.value.word)
  if (!wordText || !newWord.value.meaning.trim()) {
    uni.showToast({ title: '请填写单词/词组/句子和释义', icon: 'none' })
    return
  }
  // 查重：同词（忽略大小写与空白差异）已在当前词库时阻止添加
  const key = getWordKey(wordText)
  if (wordsStore.words.some(w => getWordKey(w.word) === key)) {
    uni.showToast({ title: '该词已在词库中', icon: 'none' })
    return
  }
  try {
    await wordsStore.addWord({
      word: wordText,
      itemType: inferMobileItemType(wordText),
      meaning: newWord.value.meaning.trim(),
      phonetic: newWord.value.phonetic.trim() || undefined,
      example: newWord.value.example.trim() || undefined,
      addTime: Date.now(),
      reviewCount: 0,
      nextReviewTime: Date.now() + 24 * 60 * 60 * 1000
    })
    uni.showToast({ title: '添加成功', icon: 'success' })
    setTimeout(() => {
      uni.navigateBack()
    }, 500)
  } catch (e: any) {
    console.error('添加单词失败:', e)
    uni.showToast({ title: '添加失败: ' + (e.message || '未知错误'), icon: 'none' })
  }
}

const goToWordbank = () => {
  uni.navigateTo({ url: '/subPackages/pages-data/wordbank/wordbank' })
}

const goBack = () => {
  uni.navigateBack()
}
</script>

<style scoped>
.add-word-container {
  padding: 30rpx;
  min-height: 100vh;
  background: #f5f5f5;
}

/* 落点提示条 */
.bank-tip {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #fff;
  border-radius: 12rpx;
  padding: 22rpx 24rpx;
  margin-bottom: 30rpx;
}

.bank-tip-text {
  font-size: 26rpx;
  color: #333;
}

.bank-tip-arrow {
  font-size: 24rpx;
  color: #52796f;
}

.form-group {
  margin-bottom: 30rpx;
}

.form-label {
  font-size: 28rpx;
  color: #666;
  margin-bottom: 12rpx;
  display: block;
}

.form-input {
  height: 80rpx;
  background: #fff;
  border-radius: 12rpx;
  padding: 0 24rpx;
  font-size: 28rpx;
}

.input-row {
  display: flex;
  gap: 16rpx;
  align-items: center;
}

.input-row .form-input {
  flex: 1;
}

.btn-translate {
  width: 140rpx;
  height: 80rpx;
  background: #74937d;
  color: #fff;
  border-radius: 12rpx;
  font-size: 26rpx;
  border: none;
  padding: 0;
  flex-shrink: 0;
}

.form-textarea {
  width: 100%;
  min-height: 80rpx;
  background: #fff;
  border-radius: 12rpx;
  padding: 20rpx 24rpx;
  font-size: 28rpx;
  line-height: 1.5;
  box-sizing: border-box;
}

.form-actions {
  display: flex;
  gap: 20rpx;
  margin-top: 40rpx;
}

.btn-cancel, .btn-confirm {
  flex: 1;
  height: 88rpx;
  border-radius: 12rpx;
  font-size: 30rpx;
  border: none;
}

.btn-cancel {
  background: #f5f5f5;
  color: #666;
}

.btn-confirm {
  background: #52796f;
  color: #fff;
}
</style>
