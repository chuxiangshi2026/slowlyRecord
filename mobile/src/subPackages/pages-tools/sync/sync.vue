<template>
  <view class="sync-container" :class="themeClass">
    <AppBackground />
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

    <!-- 坚果云备份面板 -->
    <view v-if="showWebdav && !showPushResult && !showPullInput" class="section">
      <view class="section-title">坚果云备份</view>
      <input class="popup-input" v-model="webdavUrl" placeholder="WebDAV 地址" />
      <view class="webdav-default-link" @click="useDefaultWebdavUrl">用默认地址（账号自带的「我的坚果云」文件夹）</view>
      <view class="webdav-target">备份文件将存放在：{{ webdavUrl || '（未填写地址）' }}slowlyRecord-sync.enc</view>
      <view v-if="diagVerdict" class="diag-banner" :class="diagLevel === 'ok' ? 'diag-ok' : 'diag-error'">
        <text class="diag-text">{{ diagVerdict }}</text>
      </view>
      <!-- #ifdef MP-WEIXIN -->
      <view class="webdav-guide">微信端受域名白名单限制，仅支持默认坚果云地址（dav.jianguoyun.com），改填其他域名会请求失败。</view>
      <!-- #endif -->
      <input class="popup-input" v-model="webdavUsername" placeholder="账号（坚果云注册邮箱）" />
      <input class="popup-input" v-model="webdavPassword" password placeholder="应用密码（不是登录密码）" />
      <view class="webdav-guide">
        获取应用密码：电脑登录坚果云官网 → 右上角头像 → 账户信息 → 安全选项 → 第三方应用管理 → 添加应用密码，生成后复制到上方。免费版每月 1GB 上传流量，同步包仅几十 KB，完全够用。数据经 XOR 兼容编码后存到你自己的网盘，默认不上传 API/OCR 密钥，可长期保留。
      </view>
      <view class="btn-row">
        <button class="btn-confirm" @click="handleWebdavPush">备份到云盘</button>
        <button class="btn-confirm" @click="handleWebdavPull">从云盘恢复</button>
      </view>
      <view class="btn-row">
        <button class="btn-cancel" @click="handleWebdavTest">测试连接</button>
        <button class="btn-cancel" @click="showWebdav = false">返回</button>
      </view>
    </view>

    <!-- 操作按钮 -->
    <view v-if="!showPushResult && !showPullInput && !showWebdav" class="menu-list">
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
      <view class="menu-item" @click="openWebdav">
        <text class="menu-icon webdav">☁</text>
        <text class="menu-text">坚果云备份（WebDAV）</text>
        <text class="menu-value">{{ webdavConfigured ? '已配置' : '' }}</text>
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
import { usePhoneticMemory } from '@/stores/usePhoneticMemory'
import { useSignin } from '@/stores/useSignin'
import { useMemoryPalace } from '@/stores/useMemoryPalace'
import { useSentences } from '@/stores/useSentences'
import { useWordBook } from '@/stores/useWordBook'
import { pushToServer, pullFromServer, getSyncServerUrl, setSyncServerUrl, checkServerAvailable, type PushPayload } from '../utils/sync'
import { getWebDavConfig, saveWebDavConfig, isWebDavConfigured, diagnoseWebDav, pushToWebDav, pullFromWebDav, NUTSTORE_WEBDAV_URL } from '../utils/sync-webdav'
import { collectKnowledgeSyncData, restoreKnowledgeSyncData } from '@/utils/knowledge-memory-db'
import { getTombstones } from '@/stores/useUtils/sync-tombstone'
import { drawQrCode } from '../utils/qrcode'

const wordsStore = useMobileWords()
const textMemoryStore = useTextMemory()
const numberMemoryStore = useNumberMemory()
const phoneticMemoryStore = usePhoneticMemory()
const signinStore = useSignin()
const memoryPalaceStore = useMemoryPalace()
const sentencesStore = useSentences()
const wordBookStore = useWordBook()

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

// 推送（与坚果云备份共用同一份数据收集）
const buildPushPayload = async (): Promise<PushPayload> => {
  // 冷启动直达本页时内存中无词库数据，先确保已加载，避免推送空词库；
  // 词库懒加载后内存可能只有当前词库，推送需要全量数据，再补读其余词库
  await wordsStore.loadWords()
  await wordsStore.ensureAllBanksLoaded()
  const banks = wordsStore.bankList.map(bank => ({
    id: bank.id,
    name: bank.name,
    words: wordsStore.allWords.filter(w => w.bankId === bank.id || (!w.bankId && bank.id === 'default')),
    createdAt: bank.createdAt,
    updatedAt: bank.updatedAt,
    isDefault: bank.isDefault,
    language: bank.language || 'en',
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
  // 收集知识库（导入清单+每包进度）与音标进度
  await phoneticMemoryStore.ensureLoaded()
  const knowledgeMemory = collectKnowledgeSyncData()
  const phoneticMemory = phoneticMemoryStore.collectSync()
  // 收集每日打卡记录
  const signin = signinStore.collectSync()
  // 收集记忆宫殿（查看版：桩图超大殿在桌面端同步时已剔除）
  memoryPalaceStore.load()
  const memoryPalace = memoryPalaceStore.collectSync()
  // 收集句子库（空库返回 null）
  const sentences = sentencesStore.collect()
  // 收集词集书/章/页（空库返回 null）
  const wordBook = wordBookStore.collectSync()
  return {
    banks,
    textMemory: hasTextMemory ? textMemory : undefined,
    numberMemory: hasNumberMemory ? numberMemory : undefined,
    knowledgeMemory: knowledgeMemory || undefined,
    phoneticMemory: phoneticMemory || undefined,
    signin: signin || undefined,
    memoryPalace: memoryPalace || undefined,
    sentences: sentences || undefined,
    wordBook: wordBook || undefined,
    // 同步墓碑：本机删除埋点随 payload 透传，对端拉取时过滤「删除复活」的条目
    tombstones: getTombstones(),
  }
}

const handlePush = async () => {
  uni.showLoading({ title: '推送中...' })
  try {
    const result = await pushToServer(await buildPushPayload())
    uni.hideLoading()
    if (result.skipped) {
      uni.showToast({ title: '数据未变更，已跳过', icon: 'none' })
    } else if (result.success && result.code) {
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
      const applied = await applyPullResult(result)
      uni.hideLoading()
      uni.showModal({
        title: applied.success ? '拉取成功' : '部分恢复失败',
        content: applied.summary,
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
            const applied = await applyPullResult(result)
            uni.hideLoading()
            uni.showModal({
              title: applied.success ? '拉取成功' : '部分恢复失败',
              content: applied.summary,
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

// ==================== 坚果云备份（WebDAV） ====================

const showWebdav = ref(false)
const webdavUrl = ref('')
const webdavUsername = ref('')
const webdavPassword = ref('')
const webdavConfigured = ref(isWebDavConfigured())

const openWebdav = () => {
  const cfg = getWebDavConfig()
  webdavUrl.value = cfg.url
  webdavUsername.value = cfg.username
  webdavPassword.value = cfg.password
  webdavConfigured.value = isWebDavConfigured()
  showWebdav.value = true
}

const saveWebdavForm = () => {
  saveWebDavConfig({ url: webdavUrl.value, username: webdavUsername.value, password: webdavPassword.value })
  // 回填规范化后的地址（补协议/补 /dav/），避免用户看到自己填的错地址以为已生效
  webdavUrl.value = getWebDavConfig().url
  webdavConfigured.value = isWebDavConfigured()
}

/** 一键恢复坚果云默认地址（填错地址导致 PUT 返回 404/409 时的兜底） */
const useDefaultWebdavUrl = () => {
  webdavUrl.value = NUTSTORE_WEBDAV_URL
  saveWebdavForm()
  uni.showToast({ title: '已恢复默认地址', icon: 'none' })
}

const diagVerdict = ref('')
const diagLevel = ref<'ok' | 'error'>('error')

const handleWebdavTest = async () => {
  saveWebdavForm()
  uni.showLoading({ title: '诊断中...' })
  // 逐步诊断（GET 备份文件 → PUT 探针 → DELETE 探针）：绿=可用，红=异常
  const report = await diagnoseWebDav(getWebDavConfig())
  uni.hideLoading()
  diagVerdict.value = report.verdict
  diagLevel.value = report.level
  uni.setClipboardData({ data: report.text, success: () => {} })
  uni.showToast({ title: '完整诊断已复制', icon: 'none' })
}

const handleWebdavPush = async () => {
  saveWebdavForm()
  if (!isWebDavConfigured()) {
    uni.showToast({ title: '请填写账号和应用密码', icon: 'none' })
    return
  }
  uni.showLoading({ title: '备份中...' })
  try {
    const result = await pushToWebDav(getWebDavConfig(), await buildPushPayload())
    uni.hideLoading()
    if (result.success) {
      const usedDir = (result as any).usedDir as string | undefined
      if (usedDir && usedDir !== webdavUrl.value) {
        // 根目录不可写时已自动写入默认个人空间目录：记入地址栏，后续操作直连
        webdavUrl.value = usedDir
        saveWebdavForm()
      }
      uni.showModal({
        title: '备份成功',
        content: `文件已存放于：\n${(usedDir || webdavUrl.value).replace(/\/+$/, '')}/slowlyRecord-sync.enc${usedDir ? '\n（已自动改用可写目录并记入地址栏）' : ''}`,
        showCancel: false,
      })
    } else {
      // 失败信息可能较长（含状态码与实际请求地址），用弹窗完整展示
      uni.showModal({ title: '备份失败', content: result.error || '备份失败', showCancel: false })
    }
  } catch (e) {
    uni.hideLoading()
    uni.showToast({ title: '备份失败', icon: 'none' })
  }
}

const handleWebdavPull = async () => {
  saveWebdavForm()
  if (!isWebDavConfigured()) {
    uni.showToast({ title: '请填写账号和应用密码', icon: 'none' })
    return
  }
  uni.showLoading({ title: '下载中...' })
  try {
    const result = await pullFromWebDav(getWebDavConfig())
    if (result.success) {
      uni.showLoading({ title: '导入中...' })
      const applied = await applyPullResult(result)
      uni.hideLoading()
      uni.showModal({
        title: applied.success ? '恢复成功' : '部分恢复失败',
        content: applied.summary,
        showCancel: false,
      })
    } else {
      uni.hideLoading()
      // 失败信息可能较长，用弹窗完整展示（toast 会截断）
      uni.showModal({ title: '恢复失败', content: result.error || '恢复失败', showCancel: false })
    }
  } catch (e) {
    uni.hideLoading()
    uni.showToast({ title: '恢复失败', icon: 'none' })
  }
}

/** 把 pullFromServer 结果分别写入各 store，返回摘要和真实入库结果 */
async function applyPullResult(result: any): Promise<{ success: boolean; summary: string }> {
  const parts: string[] = []
  const failedModules: string[] = []
  const tombstones = result.tombstones || {}

  // 墓碑必须独立于 banks 应用：删除全部词库时远端包可能就是 banks=[]
  let deleted = { words: 0, banks: 0 }
  try {
    await wordsStore.loadWords()
    await wordsStore.ensureAllBanksLoaded()
    deleted = await wordsStore.applySyncTombstones(tombstones)
  } catch (e) {
    console.error('[sync] 应用词库墓碑失败:', e)
    failedModules.push('词库删除')
  }

  if (Array.isArray(result.banks) && result.banks.length > 0) {
    const stats = await importBanks(result.banks)
    if (stats.added > 0) parts.push(`新增 ${stats.added} 个单词`)
    if (stats.updated > 0) parts.push(`更新 ${stats.updated} 个单词`)
    if (stats.failedBanks > 0) {
      failedModules.push(`${stats.failedBanks} 个词库写入`)
      parts.push(`${stats.failedBanks} 个词库写入失败`)
    }
  }
  if (deleted.words > 0) parts.push(`删除 ${deleted.words} 个单词`)
  if (deleted.banks > 0) parts.push(`删除 ${deleted.banks} 个词库`)

  if (result.textMemory) {
    textMemoryStore.load()
    const r = textMemoryStore.restore(result.textMemory, 'merge', tombstones)
    if ((r.addedArticles ?? 0) > 0) parts.push(`${r.addedArticles} 篇文章`)
    if ((r.updatedArticles ?? 0) > 0) parts.push(`更新 ${r.updatedArticles} 篇文章`)
    if ((r.addedNotes ?? 0) > 0) parts.push(`${r.addedNotes} 条笔记`)
    if ((r.addedPrompts ?? 0) > 0) parts.push(`${r.addedPrompts} 条提示词`)
  }
  if (result.numberMemory) {
    numberMemoryStore.load()
    const r = numberMemoryStore.restore(result.numberMemory, 'merge', tombstones)
    if (r.addedAssoc > 0) parts.push(`${r.addedAssoc} 个数字桩`)
    if (r.addedEntry > 0) parts.push(`${r.addedEntry} 个数字条目`)
    if (r.deletedAssoc > 0) parts.push(`删除 ${r.deletedAssoc} 个数字桩`)
    if (r.deletedEntry > 0) parts.push(`删除 ${r.deletedEntry} 个数字条目`)
  }
  if (result.knowledgeMemory) {
    const packCount = restoreKnowledgeSyncData(result.knowledgeMemory)
    if (packCount > 0) parts.push(`${packCount} 个知识包进度`)
  }
  if (result.phoneticMemory) {
    await phoneticMemoryStore.ensureLoaded()
    const merged = phoneticMemoryStore.restoreSync(result.phoneticMemory)
    if (merged > 0) parts.push(`${merged} 条音标进度`)
  }
  if (result.signin) {
    const added = signinStore.restoreSync(result.signin)
    if (added > 0) parts.push(`${added} 天打卡`)
  }
  if (result.memoryPalace) {
    const palaceCount = memoryPalaceStore.restoreSync(result.memoryPalace)
    if (palaceCount > 0) parts.push(`${palaceCount} 座记忆宫殿`)
  }
  if (result.sentences) {
    const added = sentencesStore.restore(result.sentences, tombstones)
    if (added > 0) parts.push(`${added} 条句子`)
  }
  if (result.wordBook) {
    const merged = wordBookStore.restoreSync(result.wordBook)
    if (merged > 0) parts.push(`${merged} 个词集条目`)
  }

  const summary = parts.length > 0 ? `已同步：${parts.join('、')}` : '本地数据已是最新'
  return {
    success: failedModules.length === 0,
    summary: failedModules.length > 0
      ? `${summary}\n失败模块：${failedModules.join('、')}`
      : summary,
  }
}

// 按词库分组导入；墓碑已在 applyPullResult 中统一应用
async function importBanks(banks: any[]) {
  await wordsStore.loadWords()
  await wordsStore.ensureAllBanksLoaded()
  let added = 0
  let updated = 0
  let failedBanks = 0
  let doneBanks = 0
  const totalBanks = banks.length

  for (const bank of banks) {
    const bankName = bank.name || '未命名词库'
    const pct = Math.round(doneBanks / totalBanks * 100)
    uni.showLoading({ title: `导入 ${pct}%` })

    const language = bank.language || 'en'
    const sameIdBank = wordsStore.bankList.find(b => b.id === bank.id)
    let targetBank = sameIdBank && (!sameIdBank.language || sameIdBank.language === language)
      ? sameIdBank
      : wordsStore.bankList.find(b => b.name === bankName && (b.language || 'en') === language)
    if (!targetBank) {
      targetBank = wordsStore.createBank(bankName, {
        id: bank.id,
        createdAt: bank.createdAt,
        updatedAt: bank.updatedAt,
        isDefault: bank.isDefault,
        language,
      })
    } else if (!targetBank.language) {
      wordsStore.setBankLanguage(targetBank.id, language)
    }
    const wordsArr = Array.isArray(bank.words) ? bank.words : []
    if (wordsArr.length > 0) {
      try {
        const result = await wordsStore.importWords(wordsArr, targetBank.id, { mergeExisting: true })
        if (result.success) {
          added += result.imported.length
          updated += result.updated
        } else {
          failedBanks++
        }
      } catch (e) {
        failedBanks++
        console.error(`导入词库 ${bankName} 失败:`, e)
      }
    }
    doneBanks++
  }

  return { added, updated, failedBanks }
}

// 服务器设置
const showServerSetting = async () => {
  const currentUrl = getSyncServerUrl()
  const isDefault = currentUrl.includes('tencentscf.com')

  uni.showActionSheet({
    itemList: [
      isDefault ? '✓ 默认服务器' : '默认服务器',
      '设置自定义服务器（开发者）',
      '测试连接'
    ],
    success: async (res) => {
      if (res.tapIndex === 0) {
        setSyncServerUrl('')
        serverUrlCache.value = getSyncServerUrl()
        uni.showToast({ title: '已恢复默认服务器', icon: 'success' })
      } else if (res.tapIndex === 1) {
        // #ifdef MP-WEIXIN
        uni.showModal({
          title: '设置同步服务器',
          content: '微信正式版只能访问后台白名单内的域名，自定义服务器地址大概率不可用，建议用默认服务器或坚果云备份',
          showCancel: false,
        })
        return
        // #endif
        // #ifndef MP-WEIXIN
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
        // #endif
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
  background: var(--sr-bg);
  padding: 20rpx;
}

.section {
  background: var(--sr-card);
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
  background: var(--sr-card);
  border-radius: 16rpx;
  overflow: hidden;
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 30rpx 40rpx;
  border-bottom: 1rpx solid var(--sr-border);
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

.menu-icon.push { background: var(--sr-primary-bg); color: var(--sr-primary); }
.menu-icon.pull { background: var(--sr-primary-bg); color: var(--sr-primary); }
.menu-icon.scan { background: var(--sr-primary-bg); color: var(--sr-primary-2); }
.menu-icon.server { background: var(--sr-primary-bg); color: var(--sr-primary-2); }
.menu-icon.webdav { background: var(--sr-primary-bg); color: var(--sr-primary); }

.webdav-guide {
  font-size: 24rpx;
  color: var(--sr-text-3);
  line-height: 1.6;
  margin-bottom: 20rpx;
}

.webdav-target {
  font-size: 22rpx;
  color: var(--sr-text-3);
  margin-bottom: 16rpx;
  word-break: break-all;
}

.diag-banner {
  padding: 16rpx 20rpx;
  border-radius: 10rpx;
  margin-bottom: 20rpx;
}

.diag-ok {
  background: var(--sr-primary-bg);
  border-left: 6rpx solid var(--sr-primary);
}

.diag-error {
  background: #fbeeee;
  border-left: 6rpx solid #d9534f;
}

.theme-dark .diag-error {
  background: rgba(217, 83, 79, 0.15);
}

.diag-text {
  font-size: 24rpx;
  line-height: 1.6;
  color: var(--sr-text);
}

.webdav-default-link {
  font-size: 24rpx;
  color: var(--sr-primary);
  margin-bottom: 16rpx;
  padding: 4rpx 0;
}

.menu-text {
  flex: 1;
  font-size: 30rpx;
  color: var(--sr-text);
}

.menu-value {
  font-size: 26rpx;
  color: var(--sr-text-3);
  margin-right: 10rpx;
}

.menu-divider {
  height: 16rpx;
  background: var(--sr-border);
}

.sync-code-box {
  background: var(--sr-card-2);
  border-radius: 8rpx;
  padding: 20rpx;
  margin-bottom: 20rpx;
}

.sync-code-label {
  font-size: 26rpx;
  color: var(--sr-text-2);
}

.sync-code-value {
  font-size: 26rpx;
  color: var(--sr-primary);
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
  color: var(--sr-text-3);
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
  background: var(--sr-card-2);
  color: var(--sr-text-2);
}

.btn-confirm {
  background: var(--sr-primary);
  color: var(--sr-on-primary);
}

.popup-input {
  height: 80rpx;
  background: var(--sr-card-2);
  color: var(--sr-text);
  border-radius: 8rpx;
  padding: 0 20rpx;
  margin-bottom: 20rpx;
  font-size: 28rpx;
}
</style>
