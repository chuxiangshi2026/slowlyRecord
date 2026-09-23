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
          <view class="bank-name-row">
            <text class="bank-name">{{ bank.name }}</text>
            <text v-if="bank.id === wordsStore.currentBankId" class="current-badge">当前</text>
          </view>
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

    <!-- 远程词库下载 -->
    <view class="section-header">
      <text class="section-title">下载词库</text>
      <text class="section-add" @click="refreshRemoteIndex">刷新</text>
    </view>
    <view class="remote-section">
      <view v-if="remoteList.length === 0" class="remote-loading">
        <text>{{ remoteError || '加载词库清单中…' }}</text>
      </view>
      <view
        v-for="bank in remoteList"
        :key="bank.id"
        class="remote-item"
        @click="onRemoteBankTap(bank)"
      >
        <view class="remote-info">
          <text class="remote-name">{{ bank.name }}</text>
          <text class="remote-desc">{{ bank.wordCount }} 词 · {{ bank.sizeKB }}KB</text>
        </view>
        <view class="remote-status">
          <text v-if="downloadingId === bank.id" class="downloading">{{ downloadProgress }}%</text>
          <text v-else-if="cachedIds.includes(bank.id)" class="cached">已下载</text>
          <text v-else class="not-cached">下载</text>
        </view>
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
import { fetchRemoteIndex, getWordBank, getCachedBankIds, removeCachedWordBank, type RemoteWordBankInfo } from '@/utils/remote-wordbank'
import { askImportTargetBank } from '@/utils/wordbank-import-target'

const wordsStore = useMobileWords()
const createDialogVisible = ref(false)
const newBankName = ref('')

// 远程词库下载
const remoteList = ref<RemoteWordBankInfo[]>([])
const remoteError = ref('')
const cachedIds = ref<string[]>([])
const downloadingId = ref('')
const downloadProgress = ref(0)

onMounted(async () => {
  await wordsStore.loadWords()
  // 词库管理页要展示各库词数：懒加载后内存只有当前词库，后台补读其余词库（不阻塞页面渲染）
  wordsStore.ensureAllBanksLoaded().catch(() => { /* 补读失败时词数显示 0，可刷新页面重试 */ })
  cachedIds.value = getCachedBankIds()
  refreshRemoteIndex()
})

async function refreshRemoteIndex() {
  remoteError.value = ''
  const list = await fetchRemoteIndex()
  if (list) {
    remoteList.value = list
  } else {
    remoteError.value = '词库清单加载失败，请检查网络后点"刷新"'
  }
}

// 点击远程词库：已缓存的直接导入，未缓存的先下载再导入；导入前询问目标词库
async function onRemoteBankTap(bank: RemoteWordBankInfo) {
  if (downloadingId.value) return
  try {
    downloadingId.value = bank.id
    downloadProgress.value = 0
    const rawWords = await getWordBank(bank.id, (p) => { downloadProgress.value = p })
    cachedIds.value = getCachedBankIds()
    // 询问目标词库：导入当前 / 新建并导入 / 选择其他已有词库；取消则保留下载缓存（显示"已下载"）
    const targetBankId = await askImportTargetBank(bank.name)
    if (!targetBankId) return
    await importToBank(bank, rawWords, targetBankId)
    // 导入成功后缓存已删（见 importToBank），刷新缓存标记
    cachedIds.value = getCachedBankIds()
  } catch (e: any) {
    uni.showToast({ title: e?.message || '下载失败', icon: 'none' })
  } finally {
    downloadingId.value = ''
    downloadProgress.value = 0
  }
}

// 把远程词库导入指定词库（与词库管理页导入内置词库同一口径）
async function importToBank(bank: RemoteWordBankInfo, rawWords: any[], bankId: string) {
  const now = Date.now()
  const mobileWords = rawWords.map(w => {
    const wordText = w.word || ''
    return {
      id: '',
      word: wordText,
      meaning: w.meaning || w.explains || '',
      phonetic: w.phonetic || undefined,
      example: w.example || undefined,
      itemType: wordText.includes(' ') ? 'phrase' : 'word',
      addTime: now,
      reviewCount: 0,
      nextReviewTime: now,
      bankId,
    }
  })
  const result = await wordsStore.importWords(mobileWords, bankId)
  if (!result.success) {
    uni.showToast({ title: result.message || '导入失败', icon: 'none' })
    return
  }
  // 导入成功后删除下载缓存：词库已进入分块存储，原始 JSON 缓存（GRE 级约 650KB）留着只占 storage 配额
  removeCachedWordBank(bank.id)
  uni.showToast({ title: `已导入 ${rawWords.length} 词`, icon: 'success' })
}

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
    uni.showToast({ title: `已切换到「${bank.name}」`, icon: 'none' })
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
.header { background: linear-gradient(135deg, #52796f 0%, #74937d 100%); padding: 60rpx 40rpx; text-align: center; }
.title { font-size: 40rpx; font-weight: bold; color: #fff; display: block; }
.subtitle { font-size: 26rpx; color: rgba(255,255,255,0.8); margin-top: 10rpx; display: block; }

.current-bank-section { margin: 20rpx; background: #fff; border-radius: 16rpx; padding: 30rpx; }
.section-label { font-size: 26rpx; color: #999; margin-bottom: 16rpx; display: block; }
.bank-picker { display: flex; justify-content: space-between; align-items: center; padding: 16rpx 20rpx; background: #eaf1ea; border-radius: 12rpx; }
.bank-picker-text { font-size: 32rpx; font-weight: bold; color: #52796f; }
.bank-picker-arrow { font-size: 24rpx; color: #52796f; }

.section-header { display: flex; justify-content: space-between; align-items: center; padding: 20rpx 30rpx 10rpx; }
.section-title { font-size: 30rpx; font-weight: bold; color: #333; }
.section-add { font-size: 28rpx; color: #52796f; }

.bank-list { padding: 0 20rpx; }
.bank-item { background: #fff; border-radius: 16rpx; padding: 24rpx 30rpx; margin-bottom: 12rpx; display: flex; justify-content: space-between; align-items: center; border-left: 16rpx solid transparent; box-sizing: border-box; }
.bank-item.active { border-left-color: #52796f; background: #f2f6f3; }
.bank-info { flex: 1; }
.bank-name-row { display: flex; align-items: center; gap: 14rpx; }
.bank-name { font-size: 30rpx; font-weight: bold; color: #333; }
.current-badge { font-size: 20rpx; color: #fff; background: #52796f; border-radius: 20rpx; padding: 4rpx 16rpx; }
.bank-count { font-size: 24rpx; color: #999; margin-top: 6rpx; display: block; }
.bank-actions { display: flex; gap: 20rpx; }
.action-text { font-size: 24rpx; color: #52796f; }
.action-text.danger { color: #c0564f; }
.action-text.muted { color: #ccc; }

.mapping-item {
  background: #eaf1ea;
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
  color: #52796f;
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

.remote-section { padding: 0 20rpx; }
.remote-loading { text-align: center; color: #999; font-size: 26rpx; padding: 40rpx 0; }
.remote-item {
  background: #fff;
  border-radius: 16rpx;
  padding: 30rpx;
  margin-bottom: 16rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.remote-info { flex: 1; }
.remote-name { font-size: 32rpx; font-weight: bold; color: #333; display: block; }
.remote-desc { font-size: 24rpx; color: #999; margin-top: 6rpx; display: block; }
.remote-status {
  font-size: 26rpx;
  padding: 10rpx 24rpx;
  border-radius: 28rpx;
  white-space: nowrap;
}
.remote-status .cached { color: #52796f; }
.remote-status .not-cached { color: #fff; background: #52796f; }
.remote-status .downloading { color: #74937d; }

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
.dialog-btn.confirm { background: #52796f; color: #fff; }
</style>
