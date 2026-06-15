<template>
  <view class="sync-container">
    <!-- 推送结果 -->
    <view v-if="showPushResult" class="section">
      <view class="section-title">推送成功</view>
      <view class="sync-code-box">
        <text class="sync-code-label">同步码：</text>
        <text class="sync-code-value" selectable>{{ syncCode }}</text>
      </view>
      <view class="sync-qr-wrapper">
        <canvas canvas-id="syncQrCanvas" class="sync-qr-canvas" style="width: 180px; height: 180px;"></canvas>
        <text class="sync-qr-hint">在另一台设备输入同步码或扫码</text>
      </view>
      <view class="btn-row">
        <button class="btn-confirm" @click="copySyncCode">复制同步码</button>
        <button class="btn-cancel" @click="showPushResult = false">关闭</button>
      </view>
    </view>

    <!-- 拉取输入 -->
    <view v-if="showPullInput && !showPushResult" class="section">
      <view class="section-title">拉取数据</view>
      <input class="popup-input" v-model="inputSyncCode" placeholder="输入同步码" />
      <view class="btn-row">
        <button class="btn-confirm" @click="handlePull">拉取</button>
        <button class="btn-cancel" @click="showPullInput = false">取消</button>
      </view>
    </view>

    <!-- 操作按钮 -->
    <view v-if="!showPushResult && !showPullInput" class="menu-list">
      <view class="menu-item" @click="handlePush">
        <text class="menu-icon push">↑</text>
        <text class="menu-text">推送数据（上传）</text>
      </view>
      <view class="menu-item" @click="showPullInput = true">
        <text class="menu-icon pull">↓</text>
        <text class="menu-text">拉取数据（输入同步码）</text>
      </view>
      <view class="menu-item" @click="scanAndPull">
        <text class="menu-icon scan">◎</text>
        <text class="menu-text">扫码拉取</text>
      </view>
      <view class="menu-divider"></view>
      <view class="menu-item" @click="showServerSetting">
        <text class="menu-icon server">⚙</text>
        <text class="menu-text">同步服务器设置</text>
        <text class="menu-value">{{ currentServerDisplay }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useMobileWords } from '@/stores/useMobileWords'
import { useTextMemory } from '@/stores/useTextMemory'
import { useNumberMemory } from '@/stores/useNumberMemory'
import { pushToServer, pullFromServer, getSyncServerUrl, setSyncServerUrl, checkServerAvailable } from '../utils/sync'
import { drawQrCode } from '../utils/qrcode'

const wordsStore = useMobileWords()
const textMemoryStore = useTextMemory()
const numberMemoryStore = useNumberMemory()

const showPushResult = ref(false)
const showPullInput = ref(false)
const syncCode = ref('')
const inputSyncCode = ref('')

// 服务器显示
const serverUrlCache = ref(getSyncServerUrl())
const currentServerDisplay = computed(() => {
  return serverUrlCache.value.includes('tencentscf.com') ? '默认服务器' : (() => {
    try { const match = serverUrlCache.value.match(/https?:\/\/([^\/]+)/); return match ? match[1] : '自定义' } catch { return '自定义' }
  })()
})

// 推送
const handlePush = async () => {
  uni.showLoading({ title: '推送中...' })
  try {
    const banks = wordsStore.bankList.map(bank => ({
      id: bank.id,
      name: bank.name,
      words: wordsStore.allWords.filter(w => w.bankId === bank.id || (!w.bankId && bank.id === 'default')),
    })).filter(b => b.words.length > 0)
    // 收集文本/数字记忆（懒加载确保数据已读取）
    textMemoryStore.load()
    numberMemoryStore.load()
    const textMemory = textMemoryStore.collect()
    const numberMemory = numberMemoryStore.collect()
    // 仅有数据时才带上字段，避免无意义负载
    const hasTextMemory =
      textMemory.articles.length || textMemory.notes.length || textMemory.prompts.length
    const hasNumberMemory =
      numberMemory.associations.length ||
      numberMemory.entries.length ||
      numberMemory.notes.length ||
      numberMemory.prompts.length
    const result = await pushToServer({
      banks,
      textMemory: hasTextMemory ? textMemory : undefined,
      numberMemory: hasNumberMemory ? numberMemory : undefined,
    })
    uni.hideLoading()
    if (result.success && result.code) {
      syncCode.value = result.code
      showPushResult.value = true
      setTimeout(() => {
        drawQrCode('syncQrCanvas', result.code!, null, { size: 180, margin: 2 })
      }, 300)
    } else {
      uni.showToast({ title: result.error || '推送失败', icon: 'none' })
    }
  } catch (e) {
    uni.hideLoading()
    uni.showToast({ title: '推送失败', icon: 'none' })
  }
}

// 拉取
const handlePull = async () => {
  if (!inputSyncCode.value.trim()) {
    uni.showToast({ title: '请输入同步码', icon: 'none' })
    return
  }
  uni.showLoading({ title: '拉取中...' })
  try {
    const result = await pullFromServer(inputSyncCode.value.trim())
    if (result.success) {
      uni.showLoading({ title: '导入中...' })
      const summary = await applyPullResult(result)
      uni.hideLoading()
      uni.showModal({
        title: '拉取成功',
        content: summary,
        showCancel: false,
      })
      showPullInput.value = false
    } else {
      uni.hideLoading()
      uni.showToast({ title: result.error || '拉取失败', icon: 'none' })
    }
  } catch (e) {
    uni.hideLoading()
    uni.showToast({ title: '拉取失败', icon: 'none' })
  }
}

// 扫码拉取
const scanAndPull = () => {
  // #ifdef MP-WEIXIN || MP-TOUTIAO || APP-PLUS
  uni.scanCode({
    success: async (res) => {
      if (res.result) {
        uni.showLoading({ title: '拉取中...' })
        try {
          const result = await pullFromServer(res.result)
          if (result.success) {
            uni.showLoading({ title: '导入中...' })
            const summary = await applyPullResult(result)
            uni.hideLoading()
            uni.showModal({
              title: '拉取成功',
              content: summary,
              showCancel: false,
            })
          } else {
            uni.hideLoading()
            uni.showToast({ title: result.error || '拉取失败', icon: 'none' })
          }
        } catch (e) {
          uni.hideLoading()
          uni.showToast({ title: '拉取失败', icon: 'none' })
        }
      }
    },
    fail: () => {
      uni.showToast({ title: '扫码取消', icon: 'none' })
    },
  })
  // #endif

  // #ifdef H5
  uni.showToast({ title: 'H5 不支持扫码，请手动输入', icon: 'none' })
  // #endif
}

/** 把 pullFromServer 结果分别写入各 store，返回中文摘要 */
async function applyPullResult(result: any): Promise<string> {
  const parts: string[] = []
  if (Array.isArray(result.banks) && result.banks.length > 0) {
    const total = await importBanks(result.banks)
    parts.push(`${total} 个单词`)
  }
  if (result.textMemory) {
    textMemoryStore.load()
    const r = textMemoryStore.restore(result.textMemory, 'merge')
    if (r.added > 0) parts.push(`${r.added} 篇文章`)
  }
  if (result.numberMemory) {
    numberMemoryStore.load()
    const r = numberMemoryStore.restore(result.numberMemory, 'merge')
    if (r.addedAssoc > 0) parts.push(`${r.addedAssoc} 个数字桩`)
    if (r.addedEntry > 0) parts.push(`${r.addedEntry} 个数字条目`)
  }
  return parts.length > 0 ? `已同步：${parts.join('、')}` : '本地数据已是最新'
}

// 按词库分组导入
async function importBanks(banks: any[]) {
  const allImportedWords: any[] = []
  let doneBanks = 0
  const totalBanks = banks.length

  for (const bank of banks) {
    const bankName = bank.name || '未命名词库'
    const pct = Math.round(doneBanks / totalBanks * 100)
    uni.showLoading({ title: `导入 ${pct}%` })

    let targetBank = wordsStore.bankList.find(b => b.name === bankName)
    if (!targetBank) {
      targetBank = wordsStore.createBank(bankName)
    }
    const wordsArr = Array.isArray(bank.words) ? bank.words : []
    if (wordsArr.length > 0) {
      try {
        const imported = await wordsStore.importWords(wordsArr, targetBank.id)
        for (const w of imported) allImportedWords.push(w)
      } catch (e) {
        console.error(`导入词库 ${bankName} 失败:`, e)
      }
    }
    doneBanks++
  }

  if (allImportedWords.length > 0) {
    wordsStore.appendWordsToMemory(allImportedWords)
  }

  return allImportedWords.length
}

// 服务器设置
const showServerSetting = async () => {
  const currentUrl = getSyncServerUrl()
  const isDefault = currentUrl.includes('tencentscf.com')

  uni.showActionSheet({
    itemList: [
      isDefault ? '✓ 默认服务器' : '默认服务器',
      '设置自定义服务器',
      '测试连接'
    ],
    success: async (res) => {
      if (res.tapIndex === 0) {
        setSyncServerUrl('')
        serverUrlCache.value = getSyncServerUrl()
        uni.showToast({ title: '已恢复默认服务器', icon: 'success' })
      } else if (res.tapIndex === 1) {
        uni.showModal({
          title: '设置同步服务器',
          content: '请输入服务器地址，如：http://192.168.1.100:3000',
          editable: true,
          placeholderText: 'http://your-server:3000',
          success: (modalRes) => {
            if (modalRes.confirm && modalRes.content) {
              const url = modalRes.content.trim()
              if (!url.match(/^https?:\/\/[^\s]+/)) {
                uni.showToast({ title: '地址格式错误', icon: 'none' })
                return
              }
              setSyncServerUrl(url)
              serverUrlCache.value = getSyncServerUrl()
              uni.showToast({ title: '已保存', icon: 'success' })
            }
          }
        })
      } else if (res.tapIndex === 2) {
        uni.showLoading({ title: '测试中...' })
        const ok = await checkServerAvailable()
        uni.hideLoading()
        uni.showToast({
          title: ok ? '连接成功' : '连接失败',
          icon: ok ? 'success' : 'none'
        })
      }
    }
  })
}

const copySyncCode = () => {
  uni.setClipboardData({
    data: syncCode.value,
    success: () => {
      uni.showToast({ title: '已复制', icon: 'success' })
    },
  })
}
</script>

<style scoped>
.sync-container {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 20rpx;
}

.section {
  background: #fff;
  border-radius: 16rpx;
  padding: 40rpx;
}

.section-title {
  font-size: 36rpx;
  font-weight: bold;
  text-align: center;
  margin-bottom: 30rpx;
}

.menu-list {
  background: #fff;
  border-radius: 16rpx;
  overflow: hidden;
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 30rpx 40rpx;
  border-bottom: 1rpx solid #f5f5f5;
}

.menu-icon {
  width: 48rpx;
  height: 48rpx;
  border-radius: 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20rpx;
  font-size: 24rpx;
  font-weight: bold;
}

.menu-icon.push { background: #e8f5e9; color: #4caf50; }
.menu-icon.pull { background: #e3f2fd; color: #1976d2; }
.menu-icon.scan { background: #fff3e0; color: #ff9800; }
.menu-icon.server { background: #f3e5f5; color: #9c27b0; }

.menu-text {
  flex: 1;
  font-size: 30rpx;
  color: #333;
}

.menu-value {
  font-size: 26rpx;
  color: #999;
  margin-right: 10rpx;
}

.menu-divider {
  height: 16rpx;
  background: #f5f5f5;
}

.sync-code-box {
  background: #f5f5f5;
  border-radius: 8rpx;
  padding: 20rpx;
  margin-bottom: 20rpx;
}

.sync-code-label {
  font-size: 26rpx;
  color: #666;
}

.sync-code-value {
  font-size: 26rpx;
  color: #1976d2;
  font-weight: bold;
  word-break: break-all;
}

.sync-qr-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 20rpx;
}

.sync-qr-canvas {
  border-radius: 8rpx;
}

.sync-qr-hint {
  font-size: 24rpx;
  color: #999;
}

.btn-row {
  display: flex;
  gap: 20rpx;
  margin-top: 20rpx;
}

.btn-cancel, .btn-confirm {
  flex: 1;
  height: 80rpx;
  border-radius: 8rpx;
  font-size: 28rpx;
  border: none;
}

.btn-cancel {
  background: #f5f5f5;
  color: #666;
}

.btn-confirm {
  background: #1976d2;
  color: #fff;
}

.popup-input {
  height: 80rpx;
  background: #f5f5f5;
  border-radius: 8rpx;
  padding: 0 20rpx;
  margin-bottom: 20rpx;
  font-size: 28rpx;
}
</style>
