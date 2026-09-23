<template>
  <div class="content">
    <div class="config-buttons">
      <el-button type="primary" @click="exportConfig" :icon="Download">导出配置</el-button>
      <el-button type="success" @click="triggerImport" :icon="Upload">导入配置</el-button>
      <input
        type="file"
        ref="fileInput"
        style="display: none"
        accept=".json"
        @change="handleFileImport"
      />
    </div>
    <p class="config-hint">导出配置可保存您的 API 密钥、翻译引擎设置等个人配置</p>
  </div>
</template>

<script setup lang="ts">
import {ref} from 'vue'
import {useWordsStore} from "@/stores/words.ts";
import type {OcrPlatform, TranslationPlatform} from "@/types/words";
import {getSetDb} from "@/utils/user-set-db-util.ts";
import {Download, Upload} from '@element-plus/icons-vue'
import {ElMessage, ElMessageBox} from 'element-plus'

const wordsStore = useWordsStore();

// 配置文件导入导出
const fileInput = ref<HTMLInputElement | null>(null)

// 导出配置
const exportConfig = () => {
  const userSet = getSetDb()
  if (!userSet) {
    ElMessage.warning('暂无配置可导出')
    return
  }

  const configData = {
    version: '1.0',
    exportTime: new Date().toISOString(),
    settings: {
      pluginStatus: userSet.pluginStatus,
      shortcutEnabled: userSet.shortcutEnabled,
      translationPlatform: userSet.translationPlatform,
      ocrPlatform: userSet.ocrPlatform,
      memoryFirmness: userSet.memoryFirmness,
      mainWindowOpacity: userSet.mainWindowOpacity ?? 1.0,
      autoSpeak: userSet.autoSpeak ?? false,
      focusMode: userSet.focusMode || {},
      keys: userSet.keys || {},
      ocrKeys: userSet.ocrKeys || {}
    }
  }

  const blob = new Blob([JSON.stringify(configData, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `slowlyRecord-config-${new Date().toISOString().split('T')[0]}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)

  ElMessage.success('配置已导出')
}

// 触发文件选择
const triggerImport = () => {
  fileInput.value?.click()
}

// 处理文件导入
const handleFileImport = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]

  if (!file) {
    return
  }

  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const content = e.target?.result as string
      const configData = JSON.parse(content)

      // 验证配置文件格式
      if (!configData.settings) {
        throw new Error('配置文件格式错误')
      }

      ElMessageBox.confirm(
        '导入配置将覆盖当前的 API 密钥和设置，是否继续？',
        '确认导入',
        {
          confirmButtonText: '确认导入',
          cancelButtonText: '取消',
          type: 'warning'
        }
      ).then(() => {
        // 应用配置
        const settings = configData.settings

        // 更新 store
        if (settings.pluginStatus !== undefined) {
          wordsStore.setClosePlugin(settings.pluginStatus)
        }
        if (settings.shortcutEnabled !== undefined) {
          wordsStore.setShortcutEnabled(settings.shortcutEnabled)
        }
        if (settings.translationPlatform) {
          wordsStore.setTranslationPlatform(settings.translationPlatform)
        }
        if (settings.ocrPlatform) {
          wordsStore.setOcrPlatform(settings.ocrPlatform)
        }
        if (settings.memoryFirmness) {
          wordsStore.setMemoryFirmness(settings.memoryFirmness)
        }
        if (settings.mainWindowOpacity !== undefined) {
          wordsStore.setMainWindowOpacity(settings.mainWindowOpacity)
        }
        if (settings.autoSpeak !== undefined) {
          wordsStore.setAutoSpeak(settings.autoSpeak)
        }
        if (settings.focusMode) {
          wordsStore.setFocusMode(settings.focusMode)
        }

        // 更新 API Keys
        if (settings.keys) {
          Object.entries(settings.keys).forEach(([platform, keys]: [string, any]) => {
            if (keys.appkey !== undefined && keys.key !== undefined) {
              wordsStore.setApiKey(platform as TranslationPlatform, keys.appkey, keys.key)
            }
          })
        }

        // 更新 OCR Keys
        if (settings.ocrKeys) {
          Object.entries(settings.ocrKeys).forEach(([platform, keys]: [string, any]) => {
            if (keys.appkey !== undefined && keys.key !== undefined) {
              wordsStore.setOcrApiKey(platform as OcrPlatform, keys.appkey, keys.key)
            }
          })
        }

        ElMessage.success('配置导入成功')
      }).catch(() => {
        // 用户取消
      })
    } catch (error) {
      ElMessage.error('配置文件解析失败，请检查文件格式')
      console.error('导入配置错误:', error)
    }

    // 清空 input 值，允许重复导入同一文件
    target.value = ''
  }

  reader.readAsText(file)
}
</script>

<style scoped lang="scss">
.content {
  padding: 0 20px;
  color: var(--utools-text-secondary);
  font-size: 12px;
}

.config-buttons {
  display: flex;
  justify-content: center;
  gap: 16px;
  padding: 16px 0;

  :deep(.el-button--primary) {
    background-color: var(--utools-primary);
    border-color: var(--utools-primary);
    color: #fff;

    &:hover {
      background-color: var(--utools-primary-hover, var(--utools-primary));
      border-color: var(--utools-primary-hover, var(--utools-primary));
    }
  }

  :deep(.el-button--success) {
    background-color: var(--utools-success, #67c23a);
    border-color: var(--utools-success, #67c23a);
    color: #fff;

    &:hover {
      background-color: var(--utools-success-hover, #85ce61);
      border-color: var(--utools-success-hover, #85ce61);
    }
  }

  :deep(.el-button .el-icon) {
    color: inherit;
  }
}

.config-hint {
  text-align: center;
  color: var(--utools-text-tertiary);
  font-size: 12px;
  margin: 8px 0 0 0;
}
</style>
