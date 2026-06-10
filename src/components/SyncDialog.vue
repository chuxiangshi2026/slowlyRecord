<template>
  <el-dialog
    v-model="visible"
    title="多端同步"
    width="560px"
    :close-on-click-modal="false"
    class="sync-dialog"
  >
    <el-tabs v-model="activeTab" class="sync-tabs">
      <!-- 服务器同步 Tab -->
      <el-tab-pane label="服务器同步" name="server">
        <el-alert
          title="端到端加密 · 临时传输"
          type="success"
          :closable="false"
          show-icon
          class="sync-alert"
        >
          <template #default>
            数据在本地 AES-256 加密后才上传，服务器只存密文无法解读。推送后生成同步码，在另一台设备输入即可拉取。
          </template>
        </el-alert>

        <div class="sync-miniprogram-card">
          <div class="sync-miniprogram-info">
            <h4>微信小程序</h4>
            <p>使用微信扫码可在小程序继续学习，通过服务器同步码拉取或推送数据。</p>
          </div>
          <img class="sync-miniprogram-code" src="/static/小程序码.png" alt="慢记单词本微信小程序码" />
        </div>

        <!-- 服务器状态 -->
        <div class="sync-server-status">
          <span>服务器状态：</span>
          <el-tag v-if="syncStore.serverAvailable === null" type="info" size="small">未检测</el-tag>
          <el-tag v-else-if="syncStore.serverAvailable" type="success" size="small">可用</el-tag>
          <el-tag v-else type="danger" size="small">不可用</el-tag>
          <el-button link type="primary" size="small" @click="syncStore.checkServer">检测</el-button>
        </div>

        <!-- 推送区域 -->
        <div class="sync-section">
          <h4>推送数据</h4>
          <p class="sync-desc">将当前设备数据加密上传，生成同步码供另一台设备拉取</p>
          <div class="sync-actions">
            <el-button
              type="primary"
              size="large"
              :loading="syncStore.status === 'uploading'"
              :disabled="!syncStore.serverAvailable"
              @click="handlePush"
            >
              <el-icon style="margin-right: 4px;"><Upload /></el-icon>
              推送到桌面端
            </el-button>
            <el-button
              type="warning"
              size="large"
              :loading="syncStore.status === 'uploading'"
              :disabled="!syncStore.serverAvailable"
              @click="handlePushMobile"
            >
              <el-icon style="margin-right: 4px;"><Upload /></el-icon>
              推送到移动端
            </el-button>
          </div>

          <!-- 同步码 + 二维码展示 -->
          <div v-if="syncStore.syncCode" class="sync-code-box">
            <div class="sync-code-text">
              <span class="sync-code-label">同步码：</span>
              <code class="sync-code-value">{{ syncStore.syncCode }}</code>
              <el-button type="primary" link @click="syncStore.copySyncCode">复制</el-button>
            </div>
            <div class="sync-qr-wrapper">
              <canvas ref="qrCanvas" class="sync-qr-canvas"></canvas>
              <p class="sync-qr-hint">扫码或复制同步码到另一台设备</p>
            </div>
          </div>
        </div>

        <el-divider />

        <!-- 拉取区域 -->
        <div class="sync-section">
          <h4>拉取数据</h4>
          <p class="sync-desc">输入在另一台设备获得的同步码，下载并还原数据</p>
          <div class="sync-download-row">
            <el-input
              v-model="syncStore.inputCode"
              placeholder="粘贴同步码"
              clearable
              class="sync-code-input"
            />
            <el-button
              type="success"
              size="large"
              :loading="syncStore.status === 'downloading'"
              :disabled="!syncStore.inputCode.trim() || !syncStore.serverAvailable"
              @click="handlePull"
            >
              <el-icon style="margin-right: 4px;"><Download /></el-icon>
              拉取
            </el-button>
          </div>
        </div>

        <el-divider />

        <!-- 自定义服务器 -->
        <div class="sync-section">
          <h4>自定义服务器</h4>
          <p class="sync-desc">数据已加密传输，也可替换为自建服务器</p>
          <div class="sync-download-row">
            <el-input
              v-model="customServerUrl"
              placeholder="https://your-server.com"
              clearable
              class="sync-code-input"
            />
            <el-button @click="handleSetCustomServer">设置</el-button>
            <el-button @click="handleResetServer">恢复默认</el-button>
          </div>
        </div>
      </el-tab-pane>

      <!-- 文件同步 Tab -->
      <el-tab-pane label="文件同步" name="file">
        <div class="sync-section">
          <h4>导出数据</h4>
          <p class="sync-desc">将所有数据导出为单个文件，可在另一台设备导入还原</p>
          <div class="sync-actions">
            <el-button type="primary" :loading="syncStore.isBusy" @click="handleExport('json')">
              导出 JSON
            </el-button>
            <el-button type="primary" :loading="syncStore.isBusy" @click="handleExport('binary')">
              导出二进制
            </el-button>
          </div>
        </div>

        <el-divider />

        <div class="sync-section">
          <h4>导入数据</h4>
          <p class="sync-desc">选择之前导出的文件，预览后确认还原</p>
          <div class="sync-actions">
            <el-button :loading="syncStore.isBusy" @click="handlePreviewFile">
              选择文件预览
            </el-button>
          </div>

          <!-- 预览信息 -->
          <div v-if="syncStore.previewSummary" class="sync-preview">
            <el-descriptions title="文件预览" :column="2" border size="small">
              <el-descriptions-item label="导出时间">{{ syncStore.previewSummary.exportedAt }}</el-descriptions-item>
              <el-descriptions-item label="来源平台">{{ syncStore.previewSummary.platform }}</el-descriptions-item>
              <el-descriptions-item label="词库数">{{ syncStore.previewSummary.wordBankCount }}</el-descriptions-item>
              <el-descriptions-item label="总单词数">{{ syncStore.previewSummary.totalWords }}</el-descriptions-item>
              <el-descriptions-item label="用户设置">{{ syncStore.previewSummary.hasUserSettings ? '有' : '无' }}</el-descriptions-item>
              <el-descriptions-item label="文本记忆">{{ syncStore.previewSummary.textArticleCount }} 篇</el-descriptions-item>
              <el-descriptions-item label="数字记忆">{{ syncStore.previewSummary.numberMemoryEntryCount }} 条</el-descriptions-item>
              <el-descriptions-item label="快捷键记忆">{{ syncStore.previewSummary.shortcutCategoryCount }} 分类</el-descriptions-item>
            </el-descriptions>

            <div class="sync-restore-options">
              <el-checkbox v-model="restoreOptions.restoreWordBanks">还原词库</el-checkbox>
              <el-checkbox v-model="restoreOptions.restoreUserSettings">还原用户设置</el-checkbox>
              <el-checkbox v-model="restoreOptions.restoreTextMemory">还原文本记忆</el-checkbox>
              <el-checkbox v-model="restoreOptions.restoreNumberMemory">还原数字记忆</el-checkbox>
              <el-checkbox v-model="restoreOptions.restoreShortcutMemory">还原快捷键记忆</el-checkbox>
              <el-checkbox v-model="restoreOptions.restoreLetterMemory">还原字母映射</el-checkbox>
            </div>

            <div class="sync-actions">
              <el-button type="success" :loading="syncStore.isBusy" @click="handleConfirmRestore">
                确认还原
              </el-button>
              <el-button @click="syncStore.clearPreview">取消</el-button>
            </div>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 结果消息 -->
    <div v-if="syncStore.resultMessage" class="sync-result-message">
      <el-alert
        :title="syncStore.resultMessage"
        :type="syncStore.lastRestoreResult?.success !== false ? 'success' : 'error'"
        show-icon
        :closable="true"
        @close="syncStore.resultMessage = ''"
      />
    </div>

    <template #footer>
      <el-button @click="visible = false">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useSyncStore } from '@/stores/sync'
import { ElMessage } from 'element-plus'
import { Upload, Download } from '@element-plus/icons-vue'
import QRCode from 'qrcode'
import type { SyncFormat } from '@/types/sync'
import type { RestoreOptions } from '@/utils/sync-manager'
import { DEFAULT_RESTORE_OPTIONS } from '@/utils/sync-manager'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const syncStore = useSyncStore()

const activeTab = ref('server')
const customServerUrl = ref(syncStore.savedServerUrl)
const restoreOptions = ref<RestoreOptions>({ ...DEFAULT_RESTORE_OPTIONS })
const qrCanvas = ref<HTMLCanvasElement | null>(null)

const visible = ref(props.modelValue)
watch(() => props.modelValue, (val) => { visible.value = val })
watch(visible, (val) => { emit('update:modelValue', val) })

// 打开时检测服务器
watch(visible, (val) => {
  if (val) {
    syncStore.checkServer()
    customServerUrl.value = syncStore.savedServerUrl
  }
})

// 同步码变化时生成二维码
watch(() => syncStore.syncCode, async (code) => {
  if (code) {
    await nextTick()
    await generateQR(code)
  }
})

async function generateQR(text: string) {
  if (!qrCanvas.value) return
  try {
    await QRCode.toCanvas(qrCanvas.value, text, {
      width: 180,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    })
  } catch (e) {
    console.error('二维码生成失败', e)
  }
}

// ===== 服务器同步 =====

async function handlePush() {
  const result = await syncStore.serverUpload()
  if (result.success) {
    ElMessage.success('推送成功，请在另一台设备输入同步码')
  } else {
    ElMessage.error(result.error || '推送失败')
  }
}

async function handlePushMobile() {
  const result = await syncStore.serverUploadMobileCompat()
  if (result.success) {
    ElMessage.success('推送成功，移动端可直接拉取')
  } else {
    ElMessage.error(result.error || '推送失败')
  }
}

async function handlePull() {
  const result = await syncStore.serverDownload()
  if (result.success) {
    ElMessage.success('拉取成功，部分数据需刷新页面后生效')
  } else {
    ElMessage.error(result.errors?.join('; ') || '拉取失败')
  }
}

function handleSetCustomServer() {
  if (!customServerUrl.value.trim()) {
    ElMessage.warning('请输入服务器地址')
    return
  }
  syncStore.setCustomServer(customServerUrl.value.trim())
  ElMessage.success('已设置自定义服务器')
  syncStore.checkServer()
}

function handleResetServer() {
  syncStore.setCustomServer('')
  customServerUrl.value = ''
  ElMessage.success('已恢复默认服务器')
  syncStore.checkServer()
}

// ===== 文件同步 =====

async function handleExport(format: SyncFormat) {
  await syncStore.exportFile(format)
  if (syncStore.resultMessage) {
    ElMessage.success(syncStore.resultMessage)
  }
}

async function handlePreviewFile() {
  await syncStore.previewFile()
  if (syncStore.resultMessage && !syncStore.previewData) {
    ElMessage.error(syncStore.resultMessage)
  }
}

async function handleConfirmRestore() {
  await syncStore.confirmRestore(restoreOptions.value)
  if (syncStore.lastRestoreResult?.success) {
    ElMessage.success('还原成功，部分数据需刷新页面后生效')
  } else if (syncStore.resultMessage) {
    ElMessage.error(syncStore.resultMessage)
  }
}
</script>

<style scoped lang="scss">
.sync-dialog {
  :deep(.el-dialog__body) {
    padding: 16px 20px;
  }
}

.sync-section {
  h4 {
    margin: 0 0 8px;
    font-size: 14px;
    color: var(--el-text-color-primary);
  }
}

.sync-desc {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin: 0 0 12px;
}

.sync-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.sync-preview {
  margin-top: 16px;

  .el-descriptions {
    margin-bottom: 12px;
  }
}

.sync-restore-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 12px 0;
}

.sync-alert {
  margin-bottom: 16px;
}

.sync-miniprogram-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
  padding: 12px 14px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-fill-color-extra-light);
}

.sync-miniprogram-info {
  min-width: 0;

  h4 {
    margin: 0 0 6px;
    font-size: 14px;
    color: var(--el-text-color-primary);
  }

  p {
    margin: 0;
    font-size: 12px;
    line-height: 1.5;
    color: var(--el-text-color-secondary);
  }
}

.sync-miniprogram-code {
  width: 92px;
  height: 92px;
  flex: none;
  border-radius: 6px;
  background: #fff;
}

.sync-server-status {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  font-size: 13px;
}

.sync-code-box {
  margin-top: 16px;
  padding: 16px;
  background: var(--el-fill-color-light);
  border-radius: 8px;

  .sync-code-text {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin-bottom: 12px;
  }

  .sync-code-label {
    font-size: 13px;
    color: var(--el-text-color-secondary);
    white-space: nowrap;
    line-height: 22px;
  }

  .sync-code-value {
    font-size: 13px;
    font-weight: 600;
    color: var(--el-color-primary);
    letter-spacing: 0.5px;
    user-select: all;
    word-break: break-all;
    flex: 1;
    line-height: 22px;
  }

  .sync-qr-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--el-border-color-lighter);
  }

  .sync-qr-canvas {
    border-radius: 4px;
  }

  .sync-qr-hint {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    margin: 0;
  }
}

.sync-download-row {
  display: flex;
  gap: 8px;

  .sync-code-input {
    flex: 1;
  }
}

.sync-result-message {
  margin-top: 12px;
}
</style>
