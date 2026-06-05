<template>
  <view class="profile-container">
    <view class="header">
      <view class="avatar">
        <text>U</text>
      </view>
      <text class="username">慢记用户</text>
    </view>

    <view class="stats-row">
      <view class="stat-box">
        <text class="stat-num">{{ wordsStore.wordCount }}</text>
        <text class="stat-label">单词总数</text>
      </view>
      <view class="stat-box">
        <text class="stat-num">{{ wordsStore.todayAdded }}</text>
        <text class="stat-label">今日添加</text>
      </view>
      <view class="stat-box">
        <text class="stat-num">{{ wordsStore.reviewWords.length }}</text>
        <text class="stat-label">待复习</text>
      </view>
    </view>

    <view class="menu-list">
      <!-- 同步 -->
      <view class="menu-item" @click="showSyncActionSheet">
        <text class="menu-icon sync">S</text>
        <text class="menu-text">数据同步</text>
        <text class="menu-arrow">›</text>
      </view>
      <!-- 同步服务器设置 -->
      <view class="menu-item" @click="showServerSetting">
        <text class="menu-icon server">V</text>
        <text class="menu-text">同步服务器</text>
        <text class="menu-value">{{ currentServerDisplay }}</text>
        <text class="menu-arrow">›</text>
      </view>
      <!-- 翻译设置 -->
      <view class="menu-item" @click="showTranslationSetting">
        <text class="menu-icon">T</text>
        <text class="menu-text">翻译引擎</text>
        <text class="menu-value">{{ currentTranslationPlatform }}</text>
        <text class="menu-arrow">›</text>
      </view>
      <!-- 导出 -->
      <view class="menu-item" @click="exportData">
        <text class="menu-icon">E</text>
        <text class="menu-text">导出数据</text>
        <text class="menu-arrow">›</text>
      </view>
      <!-- 导入 -->
      <view class="menu-item" @click="importData">
        <text class="menu-icon">I</text>
        <text class="menu-text">导入数据</text>
        <text class="menu-arrow">›</text>
      </view>
      <!-- 清空 -->
      <view class="menu-item" @click="clearData">
        <text class="menu-icon danger">C</text>
        <text class="menu-text">清空数据</text>
        <text class="menu-arrow">›</text>
      </view>
      <!-- 关于 -->
      <view class="menu-item" @click="showAbout">
        <text class="menu-icon">A</text>
        <text class="menu-text">关于</text>
        <text class="menu-arrow">›</text>
      </view>
    </view>

    <!-- 推送结果弹窗 -->
    <view v-if="showPushResult" class="popup-overlay" @click="closePushResult">
      <view class="popup-content" @click.stop>
        <view class="popup-title">推送成功</view>
        <view class="sync-code-box">
          <text class="sync-code-label">同步码：</text>
          <text class="sync-code-value" selectable>{{ syncCode }}</text>
        </view>
        <view class="sync-qr-wrapper">
          <canvas ref="qrCanvas" canvas-id="syncQrCanvas" class="sync-qr-canvas" style="width: 180px; height: 180px;"></canvas>
          <text class="sync-qr-hint">在另一台设备输入同步码或扫码</text>
        </view>
        <view class="popup-actions">
          <button class="btn-confirm" @click="copySyncCode">复制同步码</button>
          <button class="btn-cancel" @click="closePushResult">关闭</button>
        </view>
      </view>
    </view>

    <!-- 翻译引擎设置弹窗 -->
    <view v-if="showTranslationSettingsModal" class="popup-overlay" @click="showTranslationSettingsModal = false">
      <view class="popup-content translation-settings" @click.stop>
        <view class="popup-title">翻译引擎设置</view>

        <!-- 引擎切换 -->
        <view class="section-label">选择引擎</view>
        <picker :range="platformOptions" range-key="label" @change="(e: any) => { settingsPlatform = platformOptions[e.detail.value].value as TranslationPlatform; onTranslationPlatformSelect(settingsPlatform) }">
          <view class="bank-picker">
            <text class="bank-picker-text">{{ platformNames[settingsPlatform] }}</text>
            <text class="bank-picker-arrow">▼</text>
          </view>
        </picker>

        <!-- API 密钥配置 -->
        <view v-if="canConfigureApiKey" class="api-key-section">
          <view class="section-label">
            API 密钥配置
            <text class="link-text" v-if="getPlatformLink(settingsPlatform)" @click="openLink(getPlatformLink(settingsPlatform)!.url)">
              {{ getPlatformLink(settingsPlatform)!.content }} →
            </text>
          </view>
          <input class="dialog-input" v-model="apiKeyInput.appkey" :password="isAiPlatform ? false : true" :placeholder="isAiPlatform ? 'API Key (Bearer Token)，留空使用默认' : 'AppKey / SecretId，留空使用默认'" />
          <input class="dialog-input" v-model="apiKeyInput.key" :password="isAiPlatform ? false : true" :placeholder="isAiPlatform ? '模型名称 (默认自动)' : 'SecretKey / Key，留空使用默认'" />
        </view>

        <!-- 操作按钮 -->
        <view class="popup-actions">
          <button class="btn-cancel" @click="showTranslationSettingsModal = false">取消</button>
          <button v-if="canConfigureApiKey" class="btn-secondary" @click="resetApiKeyForPlatform">恢复默认</button>
          <button class="btn-confirm" @click="confirmTranslationPlatform">确认</button>
        </view>
      </view>
    </view>

    <!-- 拉取输入弹窗 -->
    <view v-if="showPullInput" class="popup-overlay" @click="closePullInput">
      <view class="popup-content" @click.stop>
        <view class="popup-title">拉取数据</view>
        <input
          class="popup-input"
          v-model="inputSyncCode"
          placeholder="输入同步码"
        />
        <view class="popup-actions">
          <button class="btn-confirm" @click="handlePull">拉取</button>
          <button class="btn-cancel" @click="closePullInput">取消</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { useMobileWords } from '@/stores/useMobileWords'
import { pushToServer, pullFromServer, drawQrCode, getTranslationPlatform, setTranslationPlatform, getTranslationApiKey, setTranslationApiKey, hasCustomTranslationApiKey, TRANSLATION_PLATFORM_LINKS, getSyncServerUrl, setSyncServerUrl, checkServerAvailable } from '@/stores/useUtils'
import type { TranslationPlatform } from '@/stores/useUtils'
// #ifdef H5
import QRCode from 'qrcode'
// #endif

const wordsStore = useMobileWords()

const showPushResult = ref(false)
const showPullInput = ref(false)
const syncCode = ref('')
const inputSyncCode = ref('')
const qrCanvas = ref<HTMLCanvasElement | null>(null)

// 翻译引擎显示名
const platformNames: Record<string, string> = {
  youdao: '有道翻译',
  baidu: '百度翻译',
  ali: '阿里翻译',
  tencent: '腾讯翻译',
  deepseek: 'DeepSeek AI',
  qwen: '通义千问',
  kimi: 'Kimi 月之暗面',
  glm: '智谱 GLM',
  ollama: 'Ollama 本地',
  local: '仅离线词典',
}

const platformOptions = Object.entries(platformNames).map(([value, label]) => ({ value, label }))

const currentTranslationPlatform = computed(() => {
  translationRefreshTick.value // 强制依赖
  return platformNames[getTranslationPlatform()] || '智谱 GLM'
})

// 翻译引擎设置弹窗
const showTranslationSettingsModal = ref(false)
const apiKeyInput = ref({ appkey: '', key: '' })
const settingsPlatform = ref<TranslationPlatform>('glm')
const translationRefreshTick = ref(0)

// 同步服务器显示（依赖 tick 强制刷新）
const serverRefreshTick = ref(0)
const currentServerDisplay = computed(() => {
  serverRefreshTick.value // 强制依赖
  const url = getSyncServerUrl()
  if (url.includes('tencentscf.com')) return '默认服务器'
  // 提取 IP 或域名简化显示
  try {
    const match = url.match(/https?:\/\/([^\/]+)/)
    return match ? match[1] : '自定义'
  } catch {
    return '自定义'
  }
})

// 同步服务器设置
const showServerSetting = () => {
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
        // 恢复默认
        setSyncServerUrl('')
        serverRefreshTick.value++
        uni.showToast({ title: '已恢复默认服务器', icon: 'success' })
      } else if (res.tapIndex === 1) {
        // 设置自定义服务器
        uni.showModal({
          title: '设置同步服务器',
          content: '请输入服务器地址，如：http://192.168.1.100:3000',
          editable: true,
          placeholderText: 'http://your-server:3000',
          success: (modalRes) => {
            if (modalRes.confirm && modalRes.content) {
              const url = modalRes.content.trim()
              // 简单验证 URL 格式
              if (!url.match(/^https?:\/\/[^\s]+/)) {
                uni.showToast({ title: '地址格式错误', icon: 'none' })
                return
              }
              setSyncServerUrl(url)
              serverRefreshTick.value++
              uni.showToast({ title: '已保存', icon: 'success' })
            }
          }
        })
      } else if (res.tapIndex === 2) {
        // 测试连接
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

// 翻译引擎设置
const showTranslationSetting = () => {
  settingsPlatform.value = getTranslationPlatform()
  if (hasCustomTranslationApiKey(settingsPlatform.value)) {
    const keys = getTranslationApiKey(settingsPlatform.value)
    apiKeyInput.value = { appkey: keys.appkey, key: keys.key }
  } else {
    apiKeyInput.value = { appkey: '', key: '' }
  }
  showTranslationSettingsModal.value = true
}

const onTranslationPlatformSelect = (platform: TranslationPlatform) => {
  if (hasCustomTranslationApiKey(platform)) {
    const keys = getTranslationApiKey(platform)
    apiKeyInput.value = { appkey: keys.appkey, key: keys.key }
  } else {
    apiKeyInput.value = { appkey: '', key: '' }
  }
}

const confirmTranslationPlatform = () => {
  setTranslationPlatform(settingsPlatform.value)
  if (apiKeyInput.value.appkey.trim() || apiKeyInput.value.key.trim()) {
    // 用户填写了自定义密钥，保存
    setTranslationApiKey(settingsPlatform.value, apiKeyInput.value.appkey.trim(), apiKeyInput.value.key.trim())
  } else {
    // 用户未填写，清除自定义密钥以回退到默认
    setTranslationApiKey(settingsPlatform.value, '', '')
  }
  translationRefreshTick.value++
  showTranslationSettingsModal.value = false
  uni.showToast({ title: `已切换为${platformNames[settingsPlatform.value]}`, icon: 'none' })
}

const resetApiKeyForPlatform = () => {
  setTranslationApiKey(settingsPlatform.value, '', '')
  apiKeyInput.value = { appkey: '', key: '' }
  uni.showToast({ title: '已恢复默认密钥', icon: 'success' })
}

// 获取平台的申请链接
const getPlatformLink = (platform: TranslationPlatform) => {
  const info = TRANSLATION_PLATFORM_LINKS.find(l => l.key === platform)
  return info || null
}

const canConfigureApiKey = computed(() => {
  const p = settingsPlatform.value
  return p !== 'local'
})

const isAiPlatform = computed(() => {
  const p = settingsPlatform.value
  return p === 'deepseek' || p === 'qwen' || p === 'kimi' || p === 'glm' || p === 'ollama'
})

// 同步操作菜单
const showSyncActionSheet = () => {
  uni.showActionSheet({
    itemList: ['推送数据（上传）', '拉取数据（下载）', '扫码拉取'],
    success: (res) => {
      if (res.tapIndex === 0) handlePush()
      else if (res.tapIndex === 1) showPullInput.value = true
      else if (res.tapIndex === 2) scanAndPull()
    },
  })
}

// 推送（按词库分组上传）
const handlePush = async () => {
  uni.showLoading({ title: '推送中...' })
  try {
    const banks = wordsStore.bankList.map(bank => ({
      id: bank.id,
      name: bank.name,
      words: wordsStore.allWords.filter(w => w.bankId === bank.id || (!w.bankId && bank.id === 'default')),
    })).filter(b => b.words.length > 0)
    const result = await pushToServer(banks)
    uni.hideLoading()
    if (result.success && result.code) {
      syncCode.value = result.code
      showPushResult.value = true
      await nextTick()
      drawQRCode(result.code)
    } else {
      uni.showToast({ title: result.error || '推送失败', icon: 'none' })
    }
  } catch (e) {
    uni.hideLoading()
    uni.showToast({ title: '推送失败', icon: 'none' })
  }
}

// 按词库分组导入同步数据
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

  // 一次性追加到内存
  if (allImportedWords.length > 0) {
    wordsStore.appendWordsToMemory(allImportedWords)
  }

  return allImportedWords.length
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
    if (result.success && result.banks) {
      uni.showLoading({ title: '导入中...' })
      const total = await importBanks(result.banks)
      uni.hideLoading()
      uni.showModal({
        title: '拉取成功',
        content: `共 ${total} 个单词已同步`,
        showCancel: false,
      })
      closePullInput()
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
  // #ifdef MP-WEIXIN || APP-PLUS
  uni.scanCode({
    success: async (res) => {
      if (res.result) {
        uni.showLoading({ title: '拉取中...' })
        try {
          const result = await pullFromServer(res.result)
          if (result.success && result.banks) {
            uni.showLoading({ title: '导入中...' })
            const total = await importBanks(result.banks)
            uni.hideLoading()
            uni.showModal({
              title: '拉取成功',
              content: `共 ${total} 个单词已同步`,
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

// 绘制二维码
const drawQRCode = (text: string) => {
  // #ifdef MP-WEIXIN || APP-PLUS
  try {
    drawQrCode('syncQrCanvas', text, null, { size: 180, margin: 2 })
  } catch (e) {
    console.error('二维码生成失败', e)
  }
  // #endif

  // #ifdef H5
  try {
    QRCode.toCanvas(qrCanvas.value, text, { width: 180, margin: 2 }, (err: any) => {
      if (err) console.error('二维码生成失败', err)
    })
  } catch (e) {
    console.error('二维码生成失败', e)
  }
  // #endif
}

const copySyncCode = () => {
  uni.setClipboardData({
    data: syncCode.value,
    success: () => {
      uni.showToast({ title: '已复制', icon: 'success' })
    },
  })
}

const closePushResult = () => {
  showPushResult.value = false
  syncCode.value = ''
}

const closePullInput = () => {
  showPullInput.value = false
  inputSyncCode.value = ''
}

// 导出数据
const exportData = () => {
  const data = wordsStore.exportWords()
  uni.setClipboardData({
    data: JSON.stringify(data),
    success: () => {
      uni.showToast({ title: '数据已复制到剪贴板', icon: 'none' })
    },
  })
}

// 导入数据
const importData = () => {
  uni.showModal({
    title: '导入数据',
    content: '请粘贴之前导出的数据',
    editable: true,
    success: (res) => {
      if (res.confirm && res.content) {
        try {
          const data = JSON.parse(res.content)
          wordsStore.importWords(data)
          uni.showToast({ title: '导入成功', icon: 'success' })
        } catch (e) {
          uni.showToast({ title: '数据格式错误', icon: 'none' })
        }
      }
    },
  })
}

const clearData = () => {
  const bankName = wordsStore.getBankById(wordsStore.currentBankId)?.name || '当前词库'
  uni.showActionSheet({
    itemList: [`清空「${bankName}」`, '清空所有词库'],
    success: (res) => {
      const confirmText = res.tapIndex === 0 ? `清空「${bankName}」中的所有单词？` : '清空所有词库中的所有单词？不可恢复！'
      uni.showModal({
        title: '确认清空',
        content: confirmText,
        confirmColor: '#ff5252',
        success: async (confirmRes) => {
          if (confirmRes.confirm) {
            if (res.tapIndex === 0) {
              await wordsStore.clearBankWords(wordsStore.currentBankId)
            } else {
              for (const bank of wordsStore.bankList) {
                await wordsStore.clearBankWords(bank.id)
              }
            }
            uni.showToast({ title: '已清空', icon: 'success' })
          }
        },
      })
    }
  })
}

const openLink = (url: string) => {
  // #ifdef H5
  window.open(url, '_blank')
  // #endif
  // #ifdef MP-WEIXIN
  uni.setClipboardData({ data: url, success: () => { uni.showToast({ title: '链接已复制，请在浏览器中打开', icon: 'none' }) } })
  // #endif
}

const showAbout = () => {
  uni.showModal({
    title: '关于慢记',
    content: '慢记 v1.0.0\n\n一款专注于单词记忆与复习的工具应用',
    showCancel: false,
  })
}
</script>

<style scoped>
.profile-container {
  min-height: 100vh;
  background: #f5f5f5;
}

.header {
  background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);
  padding: 80rpx 40rpx;
  text-align: center;
}

.avatar {
  width: 120rpx;
  height: 120rpx;
  background: rgba(255,255,255,0.3);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 20rpx;
  font-size: 48rpx;
  color: #fff;
  font-weight: bold;
}

.username {
  color: #fff;
  font-size: 36rpx;
  font-weight: bold;
}

.stats-row {
  display: flex;
  justify-content: space-around;
  padding: 30rpx 20rpx;
  background: #fff;
  margin: -30rpx 20rpx 20rpx;
  border-radius: 16rpx;
  box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.08);
  position: relative;
  z-index: 1;
}

.stat-box {
  text-align: center;
}

.stat-num {
  font-size: 40rpx;
  font-weight: bold;
  color: #1976d2;
  display: block;
}

.stat-label {
  font-size: 24rpx;
  color: #999;
  margin-top: 8rpx;
  display: block;
}

.menu-list {
  background: #fff;
  margin-top: 20rpx;
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
  background: #e3f2fd;
  border-radius: 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20rpx;
  font-size: 24rpx;
  color: #1976d2;
  font-weight: bold;
}

.menu-icon.sync {
  background: #e8f5e9;
  color: #4caf50;
}

.menu-icon.server {
  background: #fff3e0;
  color: #ff9800;
}

.menu-icon.danger {
  background: #ffebee;
  color: #f44336;
}

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

.menu-arrow {
  font-size: 36rpx;
  color: #999;
}

/* 弹窗 */
.popup-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.popup-content {
  background: #fff;
  border-radius: 16rpx;
  padding: 40rpx;
  width: 600rpx;
}

/* 翻译设置弹窗 */
.translation-settings {
  max-height: 80vh;
  overflow-y: auto;
}

.translation-settings .section-label {
  font-size: 26rpx;
  color: #999;
  margin: 16rpx 0 10rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.translation-settings .bank-picker {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16rpx 20rpx;
  background: #f0f2ff;
  border-radius: 12rpx;
  margin-bottom: 10rpx;
}

.translation-settings .bank-picker-text {
  font-size: 30rpx;
  font-weight: bold;
  color: #667eea;
}

.translation-settings .bank-picker-arrow {
  font-size: 24rpx;
  color: #667eea;
}

.translation-settings .api-key-section {
  margin-top: 20rpx;
}

.translation-settings .dialog-input {
  height: 80rpx;
  background: #f5f5f5;
  border-radius: 8rpx;
  padding: 0 20rpx;
  margin-bottom: 12rpx;
  font-size: 28rpx;
  width: 100%;
  box-sizing: border-box;
}

.translation-settings .link-text {
  font-size: 24rpx;
  color: #1976d2;
}

.translation-settings .popup-actions {
  margin-top: 20rpx;
}

.translation-settings .btn-secondary {
  background: #f5f5f5;
  color: #666;
  border: none;
  height: 80rpx;
  border-radius: 8rpx;
  font-size: 26rpx;
  padding: 0 16rpx;
}

.popup-title {
  font-size: 36rpx;
  font-weight: bold;
  text-align: center;
  margin-bottom: 30rpx;
}

.popup-input {
  height: 80rpx;
  background: #f5f5f5;
  border-radius: 8rpx;
  padding: 0 20rpx;
  margin-bottom: 20rpx;
  font-size: 28rpx;
}

.popup-actions {
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
</style>
