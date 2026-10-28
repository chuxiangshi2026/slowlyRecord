<template>
  <div class="content">
    <h5 class="key-section-title">高级设置（自定义 API Key）</h5>
    <p class="key-section-hint">默认使用 B站 Index-Translate（免配置），额度耗尽或限流时会自动降级；仅切换其他引擎或需要更高额度时才需填写</p>
    <el-collapse v-model="activeTranslationKeys" class="key-collapse">
      <el-collapse-item v-for="engine in translationKeyEngines" :key="engine.value" :name="engine.value">
        <template #title>
          <span class="key-engine-name">{{ engine.label }}</span>
          <el-tag size="small" disable-transitions
                  :type="hasKey(wordsStore.userApiKeys, engine.value) ? 'success' : 'info'">
            {{ hasKey(wordsStore.userApiKeys, engine.value) ? '已配置' : '未配置' }}
          </el-tag>
        </template>
        <div class="key-field">
          <label>AppKey</label>
          <el-input v-model="wordsStore.userApiKeys[engine.value].appkey"
                    @update:model-value="(val: string) => updateKey(engine.value, 'appkey', val)"
                    :placeholder="keyPlaceholders(engine.value).appkey" clearable/>
        </div>
        <div class="key-field">
          <label>{{ keyFieldLabel(engine.value) }}</label>
          <el-select v-if="engine.value === 'siliconflow'"
                     :model-value="wordsStore.userApiKeys[engine.value].key"
                     :disabled="keyFieldDisabled(engine.value)"
                     :placeholder="keyPlaceholders(engine.value).key"
                     filterable allow-create default-first-option clearable
                     @update:model-value="(val: string) => updateKey(engine.value, 'key', val || '')">
            <el-option v-for="model in siliconflowModelOptions" :key="model" :label="model" :value="model"/>
          </el-select>
          <el-input v-else v-model="wordsStore.userApiKeys[engine.value].key"
                    :disabled="keyFieldDisabled(engine.value)"
                    @update:model-value="(val: string) => updateKey(engine.value, 'key', val)"
                    :placeholder="keyPlaceholders(engine.value).key" clearable/>
        </div>
        <div v-if="engine.value === 'siliconflow'" class="model-actions">
          <el-button size="small" :loading="siliconflowModelsLoading" @click="loadSiliconflowModels">获取可选模型</el-button>
          <span v-if="siliconflowModelsError" class="model-error">{{ siliconflowModelsError }}</span>
          <span v-else class="model-hint">可选择或手动输入模型 ID</span>
        </div>
        <div class="key-test-row">
          <el-button size="small" :loading="translationTesting[engine.value]" @click="runTranslationTest(engine.value)">测试配置</el-button>
          <span v-if="translationTestResults[engine.value]" :class="translationTestResults[engine.value]!.success ? 'test-success' : 'test-error'">
            {{ translationTestResults[engine.value]!.message }}
          </span>
          <span v-if="translationTestResults[engine.value]?.detail" class="test-detail">{{ translationTestResults[engine.value]!.detail }}</span>
        </div>
      </el-collapse-item>
    </el-collapse>

    <h5 class="key-section-title">OCR 图片识别密钥</h5>
    <p class="key-section-hint">默认使用 B站 Index 视觉识别（免配置）</p>
    <el-collapse v-model="activeOcrKeys" class="key-collapse">
      <el-collapse-item v-for="engine in ocrKeyEngines" :key="engine.value" :name="engine.value">
        <template #title>
          <span class="key-engine-name">{{ engine.label }}</span>
          <el-tag size="small" disable-transitions
                  :type="hasKey(wordsStore.userOcrApiKeys, engine.value) ? 'success' : 'info'">
            {{ hasKey(wordsStore.userOcrApiKeys, engine.value) ? '已配置' : '未配置' }}
          </el-tag>
        </template>
        <div class="key-field">
          <label>AppKey</label>
          <el-input v-model="wordsStore.userOcrApiKeys[engine.value].appkey"
                    @update:model-value="(val: string) => updateOcrKey(engine.value, 'appkey', val)"
                    placeholder="AppID / AppKey" clearable/>
        </div>
        <div class="key-field">
          <label>{{ engine.value === 'siliconflow' ? '视觉 / OCR 模型' : 'SecretKey' }}</label>
          <el-input v-model="wordsStore.userOcrApiKeys[engine.value].key"
                    @update:model-value="(val: string) => updateOcrKey(engine.value, 'key', val)"
                    :placeholder="engine.value === 'siliconflow' ? '留空默认 deepseek-ai/DeepSeek-OCR，可填写其他视觉模型' : 'SecretKey'" clearable/>
        </div>
        <div class="key-test-row">
          <el-button size="small" :loading="ocrTesting[engine.value]" @click="runOcrTest(engine.value)">测试配置</el-button>
          <span v-if="ocrTestResults[engine.value]" :class="ocrTestResults[engine.value]!.success ? 'test-success' : 'test-error'">
            {{ ocrTestResults[engine.value]!.message }}
          </span>
          <span v-if="ocrTestResults[engine.value]?.detail" class="test-detail">{{ ocrTestResults[engine.value]!.detail }}</span>
        </div>
      </el-collapse-item>
    </el-collapse>

    <!-- 申请密钥入口：与各引擎密钥配置放在一起，方便配置时直接跳转申请 -->
    <div class="apply-key-block">
      <h5 style="text-align:center;">申请密钥</h5>
      <p class="limit-info">
        由于截图翻译调用成本较高，优先使用本地功能，在没有配置自己密钥时，暂时限制直接使用次数每日{{ USAGE_LIMITS.OCR_DAILY_LIMIT }}次(方便测试自己密钥)，配置自己的密钥后不再限制，自己额度基本够用，截图主要使用者，希望尽量使用自己的免费额度</p>

      <div v-for="platform in TRANSLATION_PLATFORM_LINKS"
           :key="platform.key"
           class="titles">
        <div class="setting-item">
          <div class="content">{{ platform.content }}</div>
          <a href="#"
             @click.prevent="openUrl(platform.url)"
             class="external-link">跳转{{ platform.name }}</a>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {computed, ref} from 'vue'
import {useWordsStore} from "@/stores/words.ts";
import type {OcrPlatform, TranslationPlatform} from "@/types/words";
import {AppInfo, TRANSLATION_PLATFORM_LINKS} from "@/config.ts";
import {USAGE_LIMITS} from "@/constants";
import {isUtools} from "@/adapters/platform";
import {log} from "@/utils/logger.ts";
import {getOcrEngine, getTranslationEngine, OCR_KEY_PLATFORMS, TRANSLATION_KEY_PLATFORMS} from "@/utils/engine-options";
import {fetchSiliconflowModels} from "@/utils/translation-api";
import {testOcrConnection, testTranslationConnection, type ConnectionTestResult} from "@/utils/api-connection-test";

const openUrl = (url: string) => {
  if (isUtools()) {
    (window as any).utools?.shellOpenExternal?.(url);
  } else {
    window.open(url, '_blank');
  }
}

const wordsStore = useWordsStore();
const siliconflowModels = ref<string[]>([])
const siliconflowModelsLoading = ref(false)
const siliconflowModelsError = ref('')
const siliconflowModelOptions = computed(() => {
  const models = [AppInfo.siliconflow.key, wordsStore.userApiKeys.siliconflow?.key, ...siliconflowModels.value]
    .filter((model): model is string => Boolean(model))
  return [...new Set(models)]
})

const loadSiliconflowModels = async () => {
  const apiKey = wordsStore.userApiKeys.siliconflow?.appkey?.trim() || ''
  if (!apiKey) {
    siliconflowModelsError.value = '请先填写硅基流动 API Key'
    return
  }
  siliconflowModelsLoading.value = true
  siliconflowModelsError.value = ''
  try {
    siliconflowModels.value = await fetchSiliconflowModels(apiKey)
  } catch (error) {
    siliconflowModelsError.value = `${(error as Error).message}，仍可手动输入模型 ID`
  } finally {
    siliconflowModelsLoading.value = false
  }
}

const translationTesting = ref<Record<string, boolean>>({})
const translationTestResults = ref<Record<string, ConnectionTestResult>>({})
const ocrTesting = ref<Record<string, boolean>>({})
const ocrTestResults = ref<Record<string, ConnectionTestResult>>({})
const translationTestRuns: Record<string, number> = {}
const ocrTestRuns: Record<string, number> = {}

const runTranslationTest = async (platform: TranslationPlatform) => {
  if (!wordsStore.userApiKeys[platform]?.appkey?.trim()) {
    translationTestResults.value[platform] = {success: false, message: '请先填写 AppKey'}
    return
  }
  const run = (translationTestRuns[platform] || 0) + 1
  translationTestRuns[platform] = run
  translationTesting.value[platform] = true
  delete translationTestResults.value[platform]
  try {
    const result = await testTranslationConnection(platform)
    if (translationTestRuns[platform] === run) translationTestResults.value[platform] = result
  } finally {
    if (translationTestRuns[platform] === run) translationTesting.value[platform] = false
  }
}

const runOcrTest = async (platform: OcrPlatform) => {
  if (!wordsStore.userOcrApiKeys[platform]?.appkey?.trim()) {
    ocrTestResults.value[platform] = {success: false, message: '请先填写 AppKey'}
    return
  }
  const run = (ocrTestRuns[platform] || 0) + 1
  ocrTestRuns[platform] = run
  ocrTesting.value[platform] = true
  delete ocrTestResults.value[platform]
  try {
    const result = await testOcrConnection(platform)
    if (ocrTestRuns[platform] === run) ocrTestResults.value[platform] = result
  } finally {
    if (ocrTestRuns[platform] === run) ocrTesting.value[platform] = false
  }
}

const updateKey = (index: TranslationPlatform, field: 'appkey' | 'key', val: string) => {
  translationTestRuns[index] = (translationTestRuns[index] || 0) + 1
  translationTesting.value[index] = false
  delete translationTestResults.value[index]
  if (index === 'siliconflow' && field === 'appkey') {
    siliconflowModels.value = []
    siliconflowModelsError.value = ''
  }
  // 更新 store 中的 API 密钥
  wordsStore.setApiKey(index, field === 'appkey' ? val : wordsStore.userApiKeys[index].appkey, field === 'key' ? val : wordsStore.userApiKeys[index].key);
}
const updateOcrKey = (index: OcrPlatform, field: 'appkey' | 'key', val: string) => {
  ocrTestRuns[index] = (ocrTestRuns[index] || 0) + 1
  ocrTesting.value[index] = false
  delete ocrTestResults.value[index]
  log.i('updateOcrKey', index, field, val)
  // 更新 store 中的 API 密钥
  wordsStore.setOcrApiKey(index, field === 'appkey' ? val : wordsStore.userOcrApiKeys[index].appkey, field === 'key' ? val : wordsStore.userOcrApiKeys[index].key);
}

// ===== 密钥配置区块 =====
// 只需 AppKey、无需 SecretKey 的翻译引擎
const singleKeyPlatforms = ['deepseek', 'qwen', 'kimi', 'glm', 'minimax', 'hunyuan', 'deepl', 'qiniu', 'spark']
// AI 引擎的第二个字段是「模型名」，允许用户自定义模型版本（留空则用内置默认模型）
const modelEditablePlatforms = ['deepseek', 'qwen', 'kimi', 'glm', 'minimax', 'hunyuan', 'qiniu', 'ollama', 'spark', 'siliconflow']
type ApiKeyMap = Record<string, { appkey: string; key: string }>

const translationKeyEngines = computed(() =>
  Object.keys(wordsStore.userApiKeys)
    .filter(k => (TRANSLATION_KEY_PLATFORMS as string[]).includes(k))
    .map(k => ({ value: k as TranslationPlatform, label: getTranslationEngine(k)?.label || k }))
)
const ocrKeyEngines = computed(() =>
  Object.keys(wordsStore.userOcrApiKeys)
    .filter(k => (OCR_KEY_PLATFORMS as string[]).includes(k))
    .map(k => ({ value: k as OcrPlatform, label: getOcrEngine(k)?.label || k }))
)

const hasKey = (keys: ApiKeyMap, name: string) => !!(keys[name]?.appkey || keys[name]?.key)

// 第二个字段的标题：AI 引擎是模型名，其余是 SecretKey
const keyFieldLabel = (platform: string) =>
  modelEditablePlatforms.includes(platform) ? '模型名（可选）' : 'SecretKey'

// 第二个字段是否禁用：AI 引擎可编辑模型名，但使用内置共享 key 时锁死（防止改成付费模型扣内置 key 持有人的钱）
const userAppkeyOf = (platform: string) =>
  (wordsStore.userApiKeys as ApiKeyMap)[platform]?.appkey?.trim()

const keyFieldDisabled = (platform: string) => {
  if (modelEditablePlatforms.includes(platform)) {
    return !userAppkeyOf(platform)
  }
  return singleKeyPlatforms.includes(platform)
}

const keyPlaceholders = (platform: string) => {
  if (platform === 'ollama') return { appkey: '服务地址，如 http://localhost:11434', key: '模型名，如 qwen2.5:0.5b' }
  if (platform === 'azure') return { appkey: '必填，订阅 Key', key: '区域，如 eastasia' }
  if (platform === 'xftrans') return { appkey: '必填，APPID:APIKey（冒号分隔）', key: '必填，APISecret' }
  if (platform === 'spark') return { appkey: 'MaaS 平台填 ak- 开头的 APIKey；旧平台填 APIPassword', key: 'MaaS 必填服务卡片 modelId；旧平台留空默认 lite' }
  if (platform === 'siliconflow') return { appkey: '必填，硅基流动 API Key', key: '留空默认 tencent/Hunyuan-MT-7B' }
  if (modelEditablePlatforms.includes(platform)) {
    const defaultModel = (AppInfo as Record<string, { appkey: string; key: string }>)[platform]?.key
    const usingBuiltin = !userAppkeyOf(platform)
    if (usingBuiltin && defaultModel) {
      return { appkey: '必填，API Key', key: `使用内置 key 时模型固定为 ${defaultModel}` }
    }
    return { appkey: '必填，API Key', key: defaultModel ? `留空默认 ${defaultModel}` : '模型名（可选）' }
  }
  if (platform === 'deepl') return { appkey: '必填，API Key（免费版以 :fx 结尾）', key: '该引擎无需 SecretKey' }
  if (singleKeyPlatforms.includes(platform)) return { appkey: '必填，API Key', key: '该引擎无需 SecretKey' }
  return { appkey: 'AppID / AppKey', key: 'SecretKey' }
}

// 默认展开当前使用的引擎；从常规设置进入时可直接看到对应配置
const activeTranslationKeys = ref<string[]>(
  (TRANSLATION_KEY_PLATFORMS as string[]).includes(wordsStore.currentTranslationPlatform)
    ? [wordsStore.currentTranslationPlatform]
    : []
)
const activeOcrKeys = ref<string[]>(
  (OCR_KEY_PLATFORMS as string[]).includes(wordsStore.currentOcrPlatform)
    ? [wordsStore.currentOcrPlatform]
    : []
)
</script>

<style scoped lang="scss">
.content {
  padding: 0 20px;
  color: var(--utools-text-secondary);
  font-size: 12px;
}

/* 密钥配置折叠面板 */
.key-section-title {
  text-align: center;
  color: var(--utools-text-secondary);
  margin: 8px 0;
}

.key-section-hint {
  margin: 0 0 6px;
  text-align: center;
  font-size: 12px;
  line-height: 1.5;
  color: var(--utools-text-tertiary);
}

.key-collapse {
  --el-collapse-header-height: 40px;
  border-top: none;

  .key-engine-name {
    font-weight: 600;
    margin-right: 8px;
  }

  :deep(.el-collapse-item__header) {
    gap: 4px;
  }

  :deep(.el-collapse-item__content) {
    padding-bottom: 12px;
  }
}

.key-field {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 6px 0;

  label {
    flex: 0 0 72px;
    text-align: right;
    color: var(--utools-text-secondary);
    font-size: 13px;
  }

  .el-input,
  .el-select {
    flex: 1;
  }
}

.model-actions {
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 8px;
  margin: 4px 0 8px 80px;
  font-size: 12px;
  line-height: 1.5;

  .model-hint {
    color: var(--utools-text-tertiary);
  }

  .model-error {
    color: var(--el-color-danger);
  }
}

.key-test-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin: 8px 0 4px 80px;
  font-size: 12px;
  line-height: 1.5;

  .test-success {
    color: var(--el-color-success);
  }

  .test-error {
    color: var(--el-color-danger);
  }

  .test-detail {
    flex-basis: 100%;
    color: var(--utools-text-secondary);
    overflow-wrap: anywhere;
  }
}

:deep(.el-input.is-disabled .el-input__wrapper) {
  background-color: var(--utools-bg-tertiary);
  border-color: var(--utools-border-primary);
  color: var(--utools-text-disabled);
  cursor: not-allowed;
}

:deep(.el-input.is-disabled .el-input__inner) {
  color: var(--utools-text-disabled);
  cursor: not-allowed;
}

:deep(.el-input__wrapper) {
  background-color: var(--utools-bg-input);
}

:deep(.el-input__inner) {
  color: var(--utools-text-primary);
}

/* 申请密钥入口 */
.apply-key-block {
  margin-top: 16px;

  h5 {
    margin: 8px 0;
    color: var(--utools-text-secondary);
  }

  .limit-info {
    margin: 0 20px 10px;
    font-size: 12px;
    line-height: 1.5;
    color: var(--utools-text-tertiary);
  }

  .titles {
    .setting-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }

    & + .titles {
      margin-top: 10px;
    }
  }

  .setting-item .content {
    padding: 0;
  }

  .external-link {
    flex-shrink: 0;
    color: var(--utools-primary);
    font-size: 12px;
    text-decoration: none;
  }
}
</style>
