<template>
  <div class="content">
    <h5 class="key-section-title">高级设置（自定义 API Key）</h5>
    <p class="key-section-hint">默认使用讯飞星火（免配置 · 每日 500 次），额度耗尽或限流时会自动降级到有道/百度/Google/Bing/GLM；仅切换其他引擎或需要更高额度时才需填写</p>
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
          <el-input v-model="wordsStore.userApiKeys[engine.value].key"
                    :disabled="keyFieldDisabled(engine.value)"
                    @update:model-value="(val: string) => updateKey(engine.value, 'key', val)"
                    :placeholder="keyPlaceholders(engine.value).key" clearable/>
        </div>
      </el-collapse-item>
    </el-collapse>

    <h5 class="key-section-title">OCR 图片识别密钥</h5>
    <p class="key-section-hint">默认本地识别无需配置</p>
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
          <label>SecretKey</label>
          <el-input v-model="wordsStore.userOcrApiKeys[engine.value].key"
                    @update:model-value="(val: string) => updateOcrKey(engine.value, 'key', val)"
                    placeholder="SecretKey" clearable/>
        </div>
      </el-collapse-item>
    </el-collapse>
  </div>
</template>

<script setup lang="ts">
import {computed, ref} from 'vue'
import {useWordsStore} from "@/stores/words.ts";
import type {OcrPlatform, TranslationPlatform} from "@/types/words";
import {AppInfo} from "@/config.ts";
import {log} from "@/utils/logger.ts";

const wordsStore = useWordsStore();

const updateKey = (index: TranslationPlatform, field: 'appkey' | 'key', val: string) => {
  // 更新 store 中的 API 密钥
  wordsStore.setApiKey(index, field === 'appkey' ? val : wordsStore.userApiKeys[index].appkey, field === 'key' ? val : wordsStore.userApiKeys[index].key);
}
const updateOcrKey = (index: OcrPlatform, field: 'appkey' | 'key', val: string) => {
  log.i('updateOcrKey', index, field, val)
  // 更新 store 中的 API 密钥
  wordsStore.setOcrApiKey(index, field === 'appkey' ? val : wordsStore.userOcrApiKeys[index].appkey, field === 'key' ? val : wordsStore.userOcrApiKeys[index].key);
}

const ocrOptions = [
  {
    value: 'local',
    label: '本地词典(离线)',
  },
  {
    value: 'baidu',
    label: '百度',
  },
  {
    value: 'youdao',
    label: '有道',
  }, {
    value: 'ali',
    label: '阿里',
  }, {
    value: 'deepseek',
    label: '深度求索(视觉)',
  }, {
    value: 'glm',
    label: '智谱GLM(视觉)',
  }]
const options = [
  {
    value: 'utoolsai',
    label: 'utoolsAI',
  },
  {
    value: 'local',
    label: '本地词典(离线)',
  },
  {
    value: 'baidu',
    label: '百度',
  },
  {
    value: 'youdao',
    label: '有道',
  }, {
    value: 'ali',
    label: '阿里',
  }, {
    value: 'ollama',
    label: 'ollama',
  }, {
    value: 'deepseek',
    label: 'deepseek',
  }, {
    value: 'qwen',
    label: '千问',
  }, {
    value: 'kimi',
    label: 'kimi',
  }, {
    value: 'glm',
    label: '智谱GLM',
  }, {
    value: 'minimax',
    label: 'MiniMax',
  }, {
    value: 'deepl',
    label: 'DeepL',
  }, {
    value: 'azure',
    label: '微软翻译',
  }, {
    value: 'qiniu',
    label: '七牛AI',
  }, {
    value: 'google',
    label: 'Google',
  }, {
    value: 'spark',
    label: '讯飞星火',
  }, {
    value: 'xftrans',
    label: '讯飞机器翻译',
  }, {
    value: 'bing',
    label: '微软网页版',
  }
]

// ===== 密钥配置区块 =====
// 只需 AppKey、无需 SecretKey 的翻译引擎
const singleKeyPlatforms = ['deepseek', 'qwen', 'kimi', 'glm', 'minimax', 'hunyuan', 'deepl', 'qiniu', 'spark']
// AI 引擎的第二个字段是「模型名」，允许用户自定义模型版本（留空则用内置默认模型）
const modelEditablePlatforms = ['deepseek', 'qwen', 'kimi', 'glm', 'minimax', 'hunyuan', 'qiniu', 'ollama', 'spark']
// 不展示密钥配置的引擎（内置免费/本地）
const hiddenTranslationKeyPlatforms = ['utoolsai', 'local', 'hunyuan', 'google', 'bing', 'tencent']
const hiddenOcrKeyPlatforms = ['local', 'deepseek', 'glm', 'tencent']

type ApiKeyMap = Record<string, { appkey: string; key: string }>

const engineLabel = (list: { value: string; label: string }[], value: string) =>
  list.find(o => o.value === value)?.label || value

const translationKeyEngines = computed(() =>
  Object.keys(wordsStore.userApiKeys)
    .filter(k => !hiddenTranslationKeyPlatforms.includes(k))
    .map(k => ({ value: k as TranslationPlatform, label: engineLabel(options, k) }))
)
const ocrKeyEngines = computed(() =>
  Object.keys(wordsStore.userOcrApiKeys)
    .filter(k => !hiddenOcrKeyPlatforms.includes(k))
    .map(k => ({ value: k as OcrPlatform, label: engineLabel(ocrOptions, k) }))
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

// 折叠面板默认收起；用户展开后再单独填写对应引擎的 API Key
const activeTranslationKeys = ref<string[]>([])
const activeOcrKeys = ref<string[]>([])
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

  .el-input {
    flex: 1;
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
</style>
