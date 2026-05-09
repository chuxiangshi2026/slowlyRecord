<template>
  <view class="wordbank-container">
    <view class="header">
      <text class="title">📚 词库管理</text>
      <text class="subtitle">下载权威词库，高效备考</text>
    </view>

    <view class="wordbank-list">
      <view
        v-for="bank in wordbanks"
        :key="bank.id"
        class="bank-item"
      >
        <view class="bank-info">
          <text class="bank-name">{{ bank.name }}</text>
          <text class="bank-desc">{{ bank.description }}</text>
          <text class="bank-count">约 {{ bank.wordCount }} 词</text>
        </view>
        <view class="bank-actions">
          <text v-if="bank.cached" class="cached-badge">已缓存</text>
          <button
            class="action-btn"
            :class="{ cached: bank.cached }"
            :disabled="downloading === bank.id"
            @click="handleAction(bank)"
          >
            {{ downloading === bank.id ? '下载中...' : (bank.cached ? '重新下载' : '下载') }}
          </button>
        </view>
      </view>
    </view>

    <view class="tip">
      <text class="tip-text">💡 提示：下载的词库可用于听写练习</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useMobileWords } from '@/stores/useMobileWords'
import {
  WORDBANK_LIST,
  type WordBankInfo,
  type Word,
  downloadWordBank,
  isWordBankCached
} from '@/stores/useUtils'

const wordbanks = ref<WordBankInfo[]>([])
const downloading = ref('')

onMounted(() => {
  // 检查缓存状态
  wordbanks.value = WORDBANK_LIST.map(bank => ({
    ...bank,
    cached: isWordBankCached(bank.id)
  }))
})

const wordsStore = useMobileWords()

const handleAction = async (bank: WordBankInfo) => {
  if (downloading.value) return

  downloading.value = bank.id
  try {
    const words = await downloadWordBank(bank.id)
    bank.cached = true
    // 下载成功后询问导入数量
    uni.showActionSheet({
      itemList: ['导入10个', '导入50个', '导入100个', '全部导入', '仅缓存不导入'],
      success: async (res) => {
        const counts = [10, 50, 100, words.length, 0]
        const count = counts[res.tapIndex]
        if (count > 0) {
          await importWordsFromBank(words, count, bank.name)
        }
      }
    })
  } catch (e: any) {
    const msg = e?.message || String(e) || '下载失败'
    uni.showModal({ title: '下载失败', content: msg, showCancel: false })
  } finally {
    downloading.value = ''
  }
}

async function importWordsFromBank(words: Word[], count: number, bankName: string) {
  const toImport = words.slice(0, count)
  let success = 0
  for (const w of toImport) {
    try {
      await wordsStore.addWord({
        word: w.word,
        meaning: w.meaning,
        phonetic: w.phonetic,
        example: w.example,
        addTime: Date.now(),
        reviewCount: 0,
        nextReviewTime: Date.now()
      })
      success++
    } catch {
      // 单个失败继续
    }
  }
  uni.showToast({ title: `已导入 ${success} 个单词`, icon: 'success' })
}
</script>

<style scoped>
.wordbank-container {
  min-height: 100vh;
  background: #f5f5f5;
}

.header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 60rpx 40rpx;
  text-align: center;
}

.title {
  font-size: 40rpx;
  font-weight: bold;
  color: #fff;
  display: block;
}

.subtitle {
  font-size: 26rpx;
  color: rgba(255,255,255,0.8);
  margin-top: 10rpx;
  display: block;
}

.wordbank-list {
  padding: 20rpx;
}

.bank-item {
  background: #fff;
  border-radius: 16rpx;
  padding: 30rpx;
  margin-bottom: 16rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.bank-info {
  flex: 1;
}

.bank-name {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
  display: block;
}

.bank-desc {
  font-size: 24rpx;
  color: #999;
  margin-top: 8rpx;
  display: block;
}

.bank-count {
  font-size: 22rpx;
  color: #667eea;
  margin-top: 8rpx;
  display: block;
}

.bank-actions {
  text-align: right;
}

.cached-badge {
  font-size: 20rpx;
  color: #4caf50;
  display: block;
  margin-bottom: 8rpx;
}

.action-btn {
  width: 160rpx;
  height: 64rpx;
  background: #667eea;
  color: #fff;
  border-radius: 32rpx;
  font-size: 26rpx;
  border: none;
}

.action-btn.cached {
  background: #f0f0f0;
  color: #666;
}

.tip {
  padding: 30rpx;
  text-align: center;
}

.tip-text {
  font-size: 24rpx;
  color: #999;
}
</style>
