<template>
  <view class="wordbank-container">
    <view class="header">
      <text class="title">进阶词库 II</text>
    </view>
    <!-- 目标词库选择 -->
    <view class="target-section">
      <text class="target-label">导入到：</text>
      <picker :range="bankNames" @change="onTargetBankChange">
        <view class="target-picker">
          <text class="target-text">{{ targetBankName }}</text>
          <text class="target-arrow">▼</text>
        </view>
      </picker>
    </view>
    <view class="wordbank-list">
      <view v-for="bank in wordbanks" :key="bank.id" class="bank-item">
        <view class="bank-info">
          <text class="bank-name">{{ bank.name }}</text>
          <text class="bank-desc">{{ bank.description }}</text>
          <text class="bank-count">约 {{ bank.wordCount }} 词</text>
        </view>
        <view class="bank-actions">
          <text v-if="bank.cached" class="cached-badge">已缓存</text>
          <button class="action-btn" :class="{ cached: bank.cached }" :disabled="downloading === bank.id" @click="handleAction(bank)">
            {{ downloading === bank.id ? '导入中...' : '导入' }}
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useMobileWords } from '@/stores/useMobileWords'
import { WORDBANK_LIST, isWordBankCached, saveWordBankCache } from '@/stores/useUtils/wordbank'
import type { WordBankInfo, Word } from '@/stores/useUtils/wordbank'
import { loadWordBankC, WORDBANK_C_IDS } from './loaderC'

interface LocalBankInfo extends WordBankInfo {
  cached: boolean
}

const wordsStore = useMobileWords()
const wordbanks = ref<LocalBankInfo[]>([])
const downloading = ref('')
const targetBankId = ref('')

onMounted(async () => {
  await wordsStore.loadWords()
  targetBankId.value = wordsStore.currentBankId
  wordbanks.value = WORDBANK_LIST
    .filter(bank => (WORDBANK_C_IDS as string[]).includes(bank.id))
    .map(bank => ({ ...bank, cached: isWordBankCached(bank.id) }))
})

const bankNames = computed(() => wordsStore.bankList.map(b => b.name))
const targetBankName = computed(() => {
  const bank = wordsStore.getBankById(targetBankId.value)
  return bank?.name || '默认词库'
})

function onTargetBankChange(e: any) {
  const index = e.detail.value
  const bank = wordsStore.bankList[index]
  if (bank) targetBankId.value = bank.id
}

const handleAction = async (bank: LocalBankInfo) => {
  if (downloading.value) return
  downloading.value = bank.id
  try {
    const words = loadWordBankC(bank.id as any)
    saveWordBankCache(bank.id, words)
    bank.cached = true
    const progress = wordsStore.getImportProgress(targetBankId.value, bank.id)
    const remaining = words.length - progress
    if (remaining <= 0) {
      uni.showToast({ title: '该词库已全部导入', icon: 'none' })
      return
    }
    uni.showActionSheet({
      itemList: [
        `续导10个（剩余${remaining}）`,
        `续导50个（剩余${remaining}）`,
        `续导100个（剩余${remaining}）`,
        `全部导入（${remaining}个）`
      ],
      success: async (res) => {
        const counts = [10, 50, 100, remaining]
        const count = Math.min(counts[res.tapIndex], remaining)
        if (count > 0) {
          wordsStore.setBankSource(targetBankId.value, 'builtin', bank.id)
          await importWords(words, progress, count, bank.name, bank.id)
        }
      }
    })
  } catch (e: any) {
    uni.showModal({ title: '导入失败', content: e?.message || String(e), showCancel: false })
  } finally {
    downloading.value = ''
  }
}

async function importWords(words: Word[], startIndex: number, count: number, _bankName: string, sourceId: string) {
  const toImport = words.slice(startIndex, startIndex + count)
  const bankId = targetBankId.value
  const now = Date.now()
  const mobileWords = toImport.map(w => ({
    id: '',
    word: w.word,
    meaning: w.meaning,
    phonetic: w.phonetic || undefined,
    example: w.example || undefined,
    itemType: w.itemType,
    addTime: now,
    reviewCount: 0,
    nextReviewTime: now,
    bankId
  }))
  const { imported, skippedCount } = await wordsStore.importWords(mobileWords, bankId)
  wordsStore.appendWordsToMemory(imported)
  const newProgress = startIndex + count
  wordsStore.setImportProgress(bankId, sourceId, newProgress)
  const msg = skippedCount > 0
    ? `已导入 ${imported.length} 个（跳过${skippedCount}个重复）`
    : `已导入 ${imported.length} 个单词`
  uni.showToast({ title: msg, icon: 'none' })
}
</script>

<style scoped>
.wordbank-container { min-height: 100vh; background: #f5f5f5; }
.header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 60rpx 40rpx; text-align: center; }
.title { font-size: 40rpx; font-weight: bold; color: #fff; display: block; }
.target-section { margin: 20rpx; background: #fff; border-radius: 16rpx; padding: 24rpx 30rpx; display: flex; align-items: center; }
.target-label { font-size: 28rpx; color: #666; margin-right: 16rpx; }
.target-picker { display: flex; align-items: center; padding: 10rpx 20rpx; background: #f0f2ff; border-radius: 10rpx; }
.target-text { font-size: 28rpx; color: #667eea; font-weight: bold; }
.target-arrow { font-size: 20rpx; color: #667eea; margin-left: 8rpx; }
.wordbank-list { padding: 0 20rpx; }
.bank-item { background: #fff; border-radius: 16rpx; padding: 30rpx; margin-bottom: 16rpx; display: flex; justify-content: space-between; align-items: center; }
.bank-info { flex: 1; }
.bank-name { font-size: 32rpx; font-weight: bold; color: #333; display: block; }
.bank-desc { font-size: 24rpx; color: #999; margin-top: 8rpx; display: block; }
.bank-count { font-size: 22rpx; color: #667eea; margin-top: 8rpx; display: block; }
.bank-actions { text-align: right; }
.cached-badge { font-size: 20rpx; color: #4caf50; display: block; margin-bottom: 8rpx; }
.action-btn { width: 160rpx; height: 64rpx; background: #667eea; color: #fff; border-radius: 32rpx; font-size: 26rpx; border: none; line-height: 64rpx; }
.action-btn.cached { background: #f0f0f0; color: #666; }
</style>
