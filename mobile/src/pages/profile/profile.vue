<template>
  <view class="profile-container">
    <view class="header">
      <view class="avatar">
        <text>{{ avatarText }}</text>
      </view>
      <text class="username" @click="editUsername">{{ displayUsername }} ✏️</text>
      <text class="username-hint">仅保存在本地，点击可修改</text>
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
      <!-- 每日目标：首页进度环的目标值，选中即存 -->
      <view class="menu-item" @click="showDailyGoalPicker">
        <text class="menu-icon goal">G</text>
        <text class="menu-text">每日目标</text>
        <text class="menu-value">{{ dailyGoal }} 词</text>
        <text class="menu-arrow">›</text>
      </view>
      <!-- 同步（跳转分包页面） -->
      <view class="menu-item" @click="goSyncPage">
        <text class="menu-icon sync">S</text>
        <text class="menu-text">数据同步</text>
        <text class="menu-arrow">›</text>
      </view>
      <!-- 我的成就（跳打卡页成就墙区域） -->
      <view class="menu-item" @click="goAchievements">
        <text class="menu-icon achievement">🏆</text>
        <text class="menu-text">我的成就</text>
        <text class="menu-value">{{ achievementStore.unlockedCount }}/{{ achievementStore.totalCount }}</text>
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
          <view v-if="subscribeRecord.times > 0" class="remind-desc-item">· 已开启提醒，当前还可接收 {{ subscribeRecord.times }} 条推送<template v-if="lastSubscribeText">，最近一次授权：{{ lastSubscribeText }}</template>。</view>
          <view v-if="subscribeStatusText" class="remind-desc-item">· 最近授权结果：{{ subscribeStatusText }}</view>
        </view>
        <!-- #ifdef MP-WEIXIN -->
        <!-- 模板 ID 由用户在公众平台申请后自行填入并本地持久化，未配置时无法开启订阅 -->
        <view class="remind-template-section">
          <view class="remind-template-label">订阅消息模板 ID</view>
          <view class="template-input-row">
            <input class="dialog-input" v-model="templateIdInput" placeholder="粘贴模板 ID，保存后生效" />
            <button class="btn-save-template" @click="saveTemplateId">保存</button>
          </view>
          <view class="remind-template-hint">
            模板需小程序管理员在 mp.weixin.qq.com → 功能 → 订阅消息 中申请：「选用模板」搜索"复习/学习提醒"类（如"每日学习提醒"），建议关键词：复习内容、提醒时间。申请通过后将模板 ID 粘贴到上方。
          </view>
        </view>
        <view v-if="!isTemplateConfigured" class="remind-template-hint">未配置模板 ID，无法开启订阅</view>
        <view class="popup-actions">
          <button class="btn-cancel" @click="showRemindModal = false">取消</button>
          <button class="btn-confirm btn-remind" :class="{ 'btn-disabled': !isTemplateConfigured }" @click="enableRemind">开启提醒</button>
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
import { onShow } from '@dcloudio/uni-app'
import { useMobileWords } from '@/stores/useMobileWords'
import { useUserProfile } from '@/stores/useUserProfile'
import { useAchievements } from '@/stores/useAchievements'
import { getTranslationPlatform, setTranslationPlatform, getTranslationApiKey, setTranslationApiKey, hasCustomTranslationApiKey, TRANSLATION_PLATFORM_LINKS } from '@/stores/useUtils/translation-settings'
import type { TranslationPlatform } from '@/stores/useUtils/types'
import { getSubscribeRecord, recordSubscribeOutcome, getSubscribeTemplateId, setSubscribeTemplateId, parseSubscribeResult, isSubscribeMessageSupported, type SubscribeRecord } from '@/utils/subscribe-remind'
import { loadDailyGoal, saveDailyGoal, DAILY_GOAL_OPTIONS } from '@/utils/daily-goal'

const wordsStore = useMobileWords()
const userProfile = useUserProfile()

// 本地用户名：未设置时回退默认展示名；头像取用户名首字符（未设置用 U）
const displayUsername = computed(() => userProfile.username || '慢记用户')
const avatarText = computed(() => (userProfile.username || 'U').charAt(0).toUpperCase())

// 编辑用户名：纯本地持久化（store 已接 persistedstate），不同步、不上传
const editUsername = () => {
  uni.showModal({
    title: '设置用户名',
    content: userProfile.username,
    editable: true,
    placeholderText: '输入用户名，留空恢复默认',
    success: (res) => {
      if (!res.confirm) return
      userProfile.setUsername(res.content || '')
      uni.showToast({ title: userProfile.username ? '已保存' : '已恢复默认用户名', icon: 'none' })
    },
  })
}

// 每日目标：首页进度环的目标值（默认 20 词），选中即存 storage
const dailyGoal = ref(loadDailyGoal())

const showDailyGoalPicker = () => {
  uni.showActionSheet({
    itemList: DAILY_GOAL_OPTIONS.map(n => `${n} 词`),
    success: (res) => {
      const goal = DAILY_GOAL_OPTIONS[res.tapIndex]
      if (goal) {
        dailyGoal.value = goal
        saveDailyGoal(goal)
        uni.showToast({ title: `每日目标已设为 ${goal} 词`, icon: 'none' })
      }
    }
  })
}
const achievementStore = useAchievements()

// 成就入口计数刷新 + 顺带做一次成就检查（复习完成等路径未逐一接入，这里兜底）
onShow(() => {
  achievementStore.load()
  achievementStore.checkNow().catch(() => {})
})

// 跳转打卡页（成就墙在打卡页下方区域）
const goAchievements = () => {
  uni.navigateTo({ url: '/subPackages/pages-data/signin/signin' })
}

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
const subscribeRecord = ref<SubscribeRecord>({ times: 0, lastTime: 0, lastStatus: '', rejectTimes: 0 })
// 模板 ID：从本地持久化设置读取（用户在公众平台申请后自行填入），输入框改动需先保存
const subscribeTemplateId = ref('')
const templateIdInput = ref('')
const isTemplateConfigured = computed(() => !!subscribeTemplateId.value)

const lastSubscribeText = computed(() => {
  if (!subscribeRecord.value.lastTime) return ''
  const d = new Date(subscribeRecord.value.lastTime)
  return `${d.getMonth() + 1}月${d.getDate()}日`
})

// 最近一次授权结果的中文展示
const subscribeStatusText = computed(() => {
  const s = subscribeRecord.value.lastStatus
  if (!s) return ''
  return ({ accept: '已接受', reject: '已拒绝（可到小程序设置中重新开启）', ban: '订阅能力被微信限制', expired: '授权已过期', unknown: '结果未知' } as Record<string, string>)[s] || ''
})

const showRemind = () => {
  subscribeRecord.value = getSubscribeRecord()
  subscribeTemplateId.value = getSubscribeTemplateId()
  templateIdInput.value = subscribeTemplateId.value
  showRemindModal.value = true
}

// 保存模板 ID（空值提示，不写入）
const saveTemplateId = () => {
  const id = templateIdInput.value.trim()
  if (!id) {
    uni.showToast({ title: '请先粘贴模板 ID', icon: 'none' })
    return
  }
  setSubscribeTemplateId(id)
  subscribeTemplateId.value = id
  uni.showToast({ title: '模板 ID 已保存', icon: 'success' })
}

// 开启提醒：拉起微信一次性订阅消息授权（仅微信小程序端可进入，此处再兜底做一次能力检测）
const enableRemind = () => {
  // 模板 ID 为本地用户配置；未配置时按钮置灰，点击也给提示兜底
  if (!subscribeTemplateId.value) {
    uni.showToast({ title: '请先配置模板 ID', icon: 'none' })
    return
  }
  if (!isSubscribeMessageSupported()) {
    uni.showToast({ title: '当前平台不支持订阅消息', icon: 'none' })
    return
  }
  uni.requestSubscribeMessage({
    tmplIds: [subscribeTemplateId.value],
    success: (res) => {
      const result = parseSubscribeResult(res as Record<string, unknown>, subscribeTemplateId.value)
      // 授权结果（接受/拒绝/封禁/过期）记录到本地
      subscribeRecord.value = recordSubscribeOutcome(result)
      if (result === 'accept') {
        showRemindModal.value = false
        // 一次授权对应一条可推送额度；服务端推送待办见 subscribe-remind.ts 顶部 TODO ②
        uni.showToast({ title: '已开启，复习到期将提醒你', icon: 'success' })
      } else if (result === 'reject' || result === 'ban') {
        // 拒绝/封禁后的引导：拒绝可在小程序设置里重新开启，封禁只能等待微信解除
        uni.showModal({
          title: result === 'reject' ? '已拒绝授权' : '订阅能力受限',
          content: result === 'reject'
            ? '如需接收复习提醒，请点小程序右上角「···」→ 设置 → 订阅消息，打开对应开关后重新授权。'
            : '微信限制了本小程序的订阅能力，暂时无法开启提醒，可稍后再试。',
          showCancel: false,
          confirmText: '知道了',
        })
      } else {
        uni.showToast({ title: '授权结果未知，可稍后再试', icon: 'none' })
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
  background: linear-gradient(135deg, #52796f 0%, #3d5a52 100%);
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

.username-hint {
  display: block;
  color: rgba(255,255,255,0.6);
  font-size: 22rpx;
  margin-top: 10rpx;
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
  color: #52796f;
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
  background: #eaf1ea;
  border-radius: 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20rpx;
  font-size: 24rpx;
  color: #52796f;
  font-weight: bold;
}

.menu-icon.sync {
  background: #eaf1ea;
  color: #52796f;
}

.menu-icon.danger {
  background: #ffebee;
  color: #c0564f;
}

/* 复习提醒入口：主色 #52796f */
.menu-icon.remind {
  background: #e8f1ec;
  color: #52796f;
}

/* 每日目标入口：同为 #52796f 主色 */
.menu-icon.goal {
  background: #e8f1ec;
  color: #52796f;
}

/* 成就入口：主色 #52796f */
.menu-icon.achievement {
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
  background: #eaf1ea;
  border-radius: 12rpx;
  margin-bottom: 10rpx;
}

.translation-settings .bank-picker-text {
  font-size: 30rpx;
  font-weight: bold;
  color: #52796f;
}

.translation-settings .bank-picker-arrow {
  font-size: 24rpx;
  color: #52796f;
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
  color: #52796f;
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
  background: #52796f;
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

/* 模板 ID 未配置时「开启提醒」置灰 */
.remind-popup .btn-remind.btn-disabled {
  background: #b8c8c2;
  color: #fff;
}

.remind-popup .remind-template-section {
  margin-bottom: 12rpx;
}

.remind-popup .remind-template-label {
  font-size: 26rpx;
  color: #999;
  margin-bottom: 10rpx;
}

.remind-popup .template-input-row {
  display: flex;
  gap: 16rpx;
  align-items: center;
}

.remind-popup .template-input-row .dialog-input {
  flex: 1;
  height: 80rpx;
  background: #f5f5f5;
  border-radius: 8rpx;
  padding: 0 20rpx;
  font-size: 26rpx;
  box-sizing: border-box;
}

.remind-popup .btn-save-template {
  height: 80rpx;
  line-height: 80rpx;
  background: #eaf1ea;
  color: #52796f;
  font-size: 26rpx;
  border: none;
  border-radius: 8rpx;
  padding: 0 28rpx;
  margin: 0;
}

.remind-popup .btn-save-template::after {
  border: none;
}

.remind-popup .remind-template-hint {
  font-size: 22rpx;
  color: #999;
  line-height: 1.6;
  margin-top: 10rpx;
}

.remind-popup .remind-unsupported {
  font-size: 26rpx;
  color: #999;
  text-align: center;
  margin-bottom: 20rpx;
}
</style>
