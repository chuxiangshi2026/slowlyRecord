<template>
  <view class="wordbank-container">
    <view class="header">
      <text class="title">我的词库</text>
      <text class="subtitle">管理你的词库，高效备考</text>
    </view>

    <!-- 当前词库切换 -->
<!--    <view class="current-bank-section">
      <view class="section-label">当前词库</view>
      <picker :range="bankNames" @change="onBankChange">
        <view class="bank-picker">
          <text class="bank-picker-text">{{ currentBankName }}</text>
          <text class="bank-picker-arrow">▼</text>
        </view>
      </picker>
    </view>-->

    <!-- 词库列表 -->
    <view class="section-header">
      <text class="section-title">我的词库</text>
      <text class="section-add" @click="showCreateDialog">+ 新建</text>
    </view>
    <view class="bank-list">
      <view v-for="bank in wordsStore.bankList" :key="bank.id" class="bank-item" :class="{ active: bank.id === wordsStore.currentBankId }" @click="onBankTap(bank)">
        <view class="bank-info">
          <text class="bank-name">{{ bank.name }}</text>
          <text class="bank-count">{{ getBankCount(bank.id) }} 个单词</text>
        </view>
        <view class="bank-actions" v-if="!bank.isDefault">
          <text class="action-text" @click.stop="onRenameBank(bank)">重命名</text>
          <text class="action-text danger" @click.stop="onDeleteBank(bank)">删除</text>
        </view>
        <view class="bank-actions" v-else>
          <text class="action-text muted">默认</text>
        </view>
      </view>
    </view>

    <!-- 已导入词库映射 -->
    <view v-if="bankMappings.length > 0" class="section-header">
      <text class="section-title">已导入内置词库</text>
    </view>
    <view v-for="mapping in bankMappings" :key="mapping.sourceId" class="mapping-item">
      <view class="mapping-left">
        <text class="mapping-source">{{ mapping.sourceName }}</text>
        <text class="mapping-arrow">→</text>
        <text class="mapping-bank">{{ mapping.bankName }}</text>
      </view>
      <text class="mapping-count">{{ mapping.wordCount }} 词</text>
    </view>

    <!-- 内置词库入口 -->
    <view class="section-header">
      <text class="section-title">导入内置词库</text>
    </view>
    <view class="builtin-section">
      <view class="section-item" @click="goTo('/subPackages/wordbank-b/wordbankB')">
        <view class="section-info">
          <text class="section-name">默认词库</text>
          <text class="section-desc">四六级、雅思、新概念、商务、考公、专升本、短语动词、固定搭配、习语等</text>
        </view>
        <text class="arrow">›</text>
      </view>
      <view class="section-item" @click="goTo('/subPackages/wordbank-a/wordbankA')">
        <view class="section-info">
          <text class="section-name">考研/GMAT词库</text>
          <text class="section-desc">考研、GMAT等</text>
        </view>
        <text class="arrow">›</text>
      </view>
      <view class="section-item" @click="goTo('/subPackages/wordbank-c/wordbankC')">
        <view class="section-info">
          <text class="section-name">进阶词库 II</text>
          <text class="section-desc">GRE、SAT、专四等</text>
        </view>
        <text class="arrow">›</text>
      </view>
      <view class="section-item" @click="goTo('/subPackages/wordbank-d/wordbankD')">
        <view class="section-info">
          <text class="section-name">进阶词库 III</text>
          <text class="section-desc">托福、词根词缀</text>
        </view>
        <text class="arrow">›</text>
      </view>
      <view class="section-item" @click="goTo('/subPackages/wordbank-level8/wordbankLevel8')">
        <view class="section-info">
          <text class="section-name">专业八级词库</text>
          <text class="section-desc">英语专业八级核心词汇</text>
        </view>
        <text class="arrow">›</text>
      </view>
    </view>

    <!-- 新建词库弹窗 -->
    <view v-if="createDialogVisible" class="dialog-mask" @click="createDialogVisible = false">
      <view class="dialog" @click.stop>
        <text class="dialog-title">新建词库</text>
        <input class="dialog-input" v-model="newBankName" placeholder="请输入词库名称" :focus="createDialogVisible" />
        <view class="dialog-buttons">
          <text class="dialog-btn cancel" @click="createDialogVisible = false">取消</text>
          <text class="dialog-btn confirm" @click="doCreateBank">创建</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useMobileWords, type WordBankMeta } from '@/stores/useMobileWords'

const wordsStore = useMobileWords()
const createDialogVisible = ref(false)
const newBankName = ref('')

onMounted(async () => {
  await wordsStore.loadWords()
})

const currentBankName = computed(() => {
  const bank = wordsStore.getBankById(wordsStore.currentBankId)
  return bank?.name || '默认词库'
})

const bankNames = computed(() => wordsStore.bankList.map(b => b.name))

// 已导入的内置词库映射列表
const bankMappings = computed(() => wordsStore.getBankMappings())

function getBankCount(bankId: string): number {
  return wordsStore.getBankWordCount(bankId)
}

function onBankChange(e: any) {
  const index = e.detail.value
  const bank = wordsStore.bankList[index]
  if (bank) {
    wordsStore.switchBank(bank.id)
  }
}

function onBankTap(bank: WordBankMeta) {
  if (bank.id !== wordsStore.currentBankId) {
    wordsStore.switchBank(bank.id)
  }
}

function showCreateDialog() {
  newBankName.value = ''
  createDialogVisible.value = true
}

function doCreateBank() {
  const name = newBankName.value.trim()
  if (!name) {
    uni.showToast({ title: '请输入词库名称', icon: 'none' })
    return
  }
  // 检查重名
  if (wordsStore.bankList.some(b => b.name === name)) {
    uni.showToast({ title: '词库名称已存在', icon: 'none' })
    return
  }
  const bank = wordsStore.createBank(name)
  wordsStore.switchBank(bank.id)
  createDialogVisible.value = false
  uni.showToast({ title: '创建成功', icon: 'success' })
}

function onRenameBank(bank: WordBankMeta) {
  uni.showModal({
    title: '重命名词库',
    editable: true,
    placeholderText: '请输入新名称',
    content: bank.name,
    success: (res) => {
      if (res.confirm && res.content?.trim()) {
        wordsStore.renameBank(bank.id, res.content.trim())
        uni.showToast({ title: '已重命名', icon: 'success' })
      }
    }
  })
}

function onDeleteBank(bank: WordBankMeta) {
  const count = getBankCount(bank.id)
  uni.showModal({
    title: '确认删除',
    content: `确定删除词库"${bank.name}"及其 ${count} 个单词吗？此操作不可恢复。`,
    confirmColor: '#e53935',
    success: async (res) => {
      if (res.confirm) {
        try {
          await wordsStore.deleteBank(bank.id)
          uni.showToast({ title: '已删除', icon: 'success' })
        } catch (e: any) {
          uni.showToast({ title: e.message || '删除失败', icon: 'none' })
        }
      }
    }
  })
}

const goTo = (url: string) => {
  uni.navigateTo({ url })
}
</script>

<style scoped>
.wordbank-container { min-height: 100vh; background: #f5f5f5; padding-bottom: 40rpx; }
.header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 60rpx 40rpx; text-align: center; }
.title { font-size: 40rpx; font-weight: bold; color: #fff; display: block; }
.subtitle { font-size: 26rpx; color: rgba(255,255,255,0.8); margin-top: 10rpx; display: block; }

.current-bank-section { margin: 20rpx; background: #fff; border-radius: 16rpx; padding: 30rpx; }
.section-label { font-size: 26rpx; color: #999; margin-bottom: 16rpx; display: block; }
.bank-picker { display: flex; justify-content: space-between; align-items: center; padding: 16rpx 20rpx; background: #f0f2ff; border-radius: 12rpx; }
.bank-picker-text { font-size: 32rpx; font-weight: bold; color: #667eea; }
.bank-picker-arrow { font-size: 24rpx; color: #667eea; }

.section-header { display: flex; justify-content: space-between; align-items: center; padding: 20rpx 30rpx 10rpx; }
.section-title { font-size: 30rpx; font-weight: bold; color: #333; }
.section-add { font-size: 28rpx; color: #667eea; }

.bank-list { padding: 0 20rpx; }
.bank-item { background: #fff; border-radius: 16rpx; padding: 24rpx 30rpx; margin-bottom: 12rpx; display: flex; justify-content: space-between; align-items: center; }
.bank-item.active { border-left: 16rpx solid #667eea; }
.bank-info { flex: 1; }
.bank-name { font-size: 30rpx; font-weight: bold; color: #333; display: block; }
.bank-count { font-size: 24rpx; color: #999; margin-top: 6rpx; display: block; }
.bank-actions { display: flex; gap: 20rpx; }
.action-text { font-size: 24rpx; color: #667eea; }
.action-text.danger { color: #e53935; }
.action-text.muted { color: #ccc; }

.mapping-item {
  background: #f0f2ff;
  border-radius: 12rpx;
  padding: 20rpx 30rpx;
  margin: 0 20rpx 12rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.mapping-left {
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.mapping-source {
  font-size: 26rpx;
  font-weight: bold;
  color: #667eea;
}
.mapping-arrow {
  font-size: 24rpx;
  color: #999;
}
.mapping-bank {
  font-size: 26rpx;
  color: #333;
}
.mapping-count {
  font-size: 24rpx;
  color: #999;
}

.builtin-section { padding: 0 20rpx; }
.section-item { background: #fff; border-radius: 16rpx; padding: 36rpx 30rpx; margin-bottom: 16rpx; display: flex; justify-content: space-between; align-items: center; }
.section-info { flex: 1; }
.section-name { font-size: 34rpx; font-weight: bold; color: #333; display: block; }
.section-desc { font-size: 24rpx; color: #999; margin-top: 8rpx; display: block; }
.arrow { font-size: 40rpx; color: #ccc; }

.dialog-mask { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 999; }
.dialog { background: #fff; border-radius: 24rpx; padding: 40rpx; width: 80%; }
.dialog-title { font-size: 34rpx; font-weight: bold; text-align: center; display: block; margin-bottom: 30rpx; }
.dialog-input { border: 2rpx solid #e0e0e0; border-radius: 12rpx; padding: 20rpx; font-size: 30rpx; width: 100%; box-sizing: border-box; height: 80rpx; line-height: 40rpx; }
.dialog-buttons { display: flex; justify-content: space-between; margin-top: 30rpx; gap: 20rpx; }
.dialog-btn { flex: 1; text-align: center; padding: 20rpx; border-radius: 12rpx; font-size: 30rpx; }
.dialog-btn.cancel { background: #f5f5f5; color: #666; }
.dialog-btn.confirm { background: #667eea; color: #fff; }
</style>
