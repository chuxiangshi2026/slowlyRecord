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
      <!-- 同步（跳转分包页面） -->
      <view class="menu-item" @click="goSyncPage">
        <text class="menu-icon sync">S</text>
        <text class="menu-text">数据同步</text>
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
      <!-- 复习提醒（一次性订阅消息，仅微信小程序端可授权） -->
      <view class="menu-item" @click="showRemind">
        <text class="menu-icon remind">R</text>
        <text class="menu-text">复习提醒</text>
        <text class="menu-arrow">›</text>
      </view>
      <!-- 意见反馈（微信官方反馈页，仅微信小程序端） -->
      <!-- #ifdef MP-WEIXIN -->
      <button class="menu-item feedback-btn" open-type="feedback">
        <text class="menu-icon">F</text>
        <text class="menu-text">意见反馈</text>
        <text class="menu-arrow">›</text>
      </button>
      <!-- #endif -->
      <!-- 关于 -->
      <view class="menu-item" @click="showAbout">
        <text class="menu-icon">A</text>
        <text class="menu-text">关于</text>
        <text class="menu-arrow">›</text>
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

    <!-- 复习提醒弹窗 -->
    <view v-if="showRemindModal" class="popup-overlay" @click="showRemindModal = false">
      <view class="popup-content remind-popup" @click.stop>
        <view class="popup-title">复习提醒</view>
        <view class="remind-desc">
          <view class="remind-desc-item">· 受微信能力限制，工具类小程序只有「一次性订阅消息」：每授权一次，复习到期时收到一条提醒，不能自动天天推送。</view>
          <view class="remind-desc-item">· 提醒主战场是首页「今日待办」，订阅消息仅作辅助；授权仅在微信小程序内可用。</view>
          <view v-if="subscribeRecord.times > 0" class="remind-desc-item">· 已累计授权 {{ subscribeRecord.times }} 次，最近一次：{{ lastSubscribeText }}</view>
        </view>
        <!-- #ifdef MP-WEIXIN -->
        <view class="popup-actions">
          <button class="btn-cancel" @click="showRemindModal = false">取消</button>
          <button class="btn-confirm btn-remind" @click="enableRemind">开启提醒</button>
        </view>
        <!-- #endif -->
        <!-- #ifndef MP-WEIXIN -->
        <view class="remind-unsupported">当前平台暂不支持，请在微信小程序中使用</view>
        <view class="popup-actions">
          <button class="btn-confirm btn-remind" @click="showRemindModal = false">知道了</button>
        </view>
        <!-- #endif -->
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useMobileWords } from '@/stores/useMobileWords'
import { getTranslationPlatform, setTranslationPlatform, getTranslationApiKey, setTranslationApiKey, hasCustomTranslationApiKey, TRANSLATION_PLATFORM_LINKS } from '@/stores/useUtils/translation-settings'
import type { TranslationPlatform } from '@/stores/useUtils/types'
import { SUBSCRIBE_TEMPLATE_ID, getSubscribeRecord, recordSubscribeSuccess, type SubscribeRecord } from '@/utils/subscribe-remind'

const wordsStore = useMobileWords()

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

// 同步页面跳转（移至分包，避免主包体积膨胀）
const goSyncPage = () => {
  uni.navigateTo({ url: '/subPackages/pages-tools/sync/sync' })
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
    setTranslationApiKey(settingsPlatform.value, apiKeyInput.value.appkey.trim(), apiKeyInput.value.key.trim())
  } else {
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

// ==================== 复习提醒（一次性订阅消息） ====================

const showRemindModal = ref(false)
const subscribeRecord = ref<SubscribeRecord>({ times: 0, lastTime: 0 })

const lastSubscribeText = computed(() => {
  if (!subscribeRecord.value.lastTime) return ''
  const d = new Date(subscribeRecord.value.lastTime)
  return `${d.getMonth() + 1}月${d.getDate()}日`
})

const showRemind = () => {
  subscribeRecord.value = getSubscribeRecord()
  showRemindModal.value = true
}

// 开启提醒：拉起微信一次性订阅消息授权（仅微信小程序端进入此函数）
const enableRemind = () => {
  // 模板 ID 在小程序后台申请后配置；未配置时给出提示，不报错
  if (!SUBSCRIBE_TEMPLATE_ID) {
    uni.showToast({ title: '提醒功能尚未配置模板', icon: 'none' })
    return
  }
  uni.requestSubscribeMessage({
    tmplIds: [SUBSCRIBE_TEMPLATE_ID],
    success: (res) => {
      // 授权结果以模板 ID 为键：accept 接受 / reject 拒绝 / ban 被封禁
      const result = (res as any)[SUBSCRIBE_TEMPLATE_ID]
      if (result === 'accept') {
        subscribeRecord.value = recordSubscribeSuccess()
        showRemindModal.value = false
        // TODO（服务端）：一次授权对应一条可推送额度。当前授权记录仅保存本地，
        // 后续需扩展同步 payload 或新增上报接口，由服务端在复习到期时消费推送。
        uni.showToast({ title: '已开启，复习到期将提醒你', icon: 'success' })
      } else if (result === 'reject') {
        uni.showToast({ title: '已取消授权，可随时重新开启', icon: 'none' })
      } else {
        uni.showToast({ title: '暂时无法订阅提醒，请稍后再试', icon: 'none' })
      }
    },
    fail: () => {
      uni.showToast({ title: '授权未完成，可稍后再试', icon: 'none' })
    },
  })
}

const getPlatformLink = (platform: TranslationPlatform) => {
  const info = TRANSLATION_PLATFORM_LINKS.find(l => l.key === platform)
  return info || null
}

const canConfigureApiKey = computed(() => {
  return settingsPlatform.value !== 'local'
})

const isAiPlatform = computed(() => {
  const p = settingsPlatform.value
  return p === 'deepseek' || p === 'qwen' || p === 'kimi' || p === 'glm' || p === 'ollama'
})

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
  // #ifdef MP-WEIXIN || MP-TOUTIAO
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

/* button 版菜单项（意见反馈）：清除微信 button 默认样式，与其他菜单项对齐 */
button.menu-item.feedback-btn {
  width: 100%;
  background: transparent;
  border: none;
  border-bottom: 1rpx solid #f5f5f5;
  border-radius: 0;
  font-size: inherit;
  line-height: normal;
  text-align: left;
  margin: 0;
}

button.menu-item.feedback-btn::after {
  border: none;
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

.menu-icon.danger {
  background: #ffebee;
  color: #f44336;
}

/* 复习提醒入口：主色 #52796f */
.menu-icon.remind {
  background: #e8f1ec;
  color: #52796f;
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

/* 复习提醒弹窗 */
.remind-popup .remind-desc {
  margin-bottom: 20rpx;
}

.remind-popup .remind-desc-item {
  font-size: 26rpx;
  color: #666;
  line-height: 1.7;
  margin-bottom: 12rpx;
}

.remind-popup .btn-remind {
  background: #52796f;
  color: #fff;
}

.remind-popup .remind-unsupported {
  font-size: 26rpx;
  color: #999;
  text-align: center;
  margin-bottom: 20rpx;
}
</style>
