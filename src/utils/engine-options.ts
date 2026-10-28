import type {OcrPlatform, TranslationPlatform} from '@/types/words'
import {AppInfo, OcrKeyInfo} from '../config'

export type EngineKind = 'traditional' | 'llm'
export type EngineConfig = 'none' | 'builtin' | 'required'

export interface EngineOption<T extends string = string> {
  value: T
  label: string
  kind: EngineKind
  config: EngineConfig
}

export interface EngineGroup<T extends string = string> {
  label: string
  options: EngineOption<T>[]
}

export const TRANSLATION_ENGINE_OPTIONS: EngineOption<TranslationPlatform>[] = [
  {value: 'spark', label: '讯飞星火', kind: 'llm', config: 'builtin'},
  {value: 'local', label: '本地词典（离线）', kind: 'traditional', config: 'none'},
  {value: 'youdao', label: '有道翻译', kind: 'traditional', config: 'builtin'},
  {value: 'baidu', label: '百度翻译', kind: 'traditional', config: 'builtin'},
  {value: 'ali', label: '阿里翻译', kind: 'traditional', config: 'builtin'},
  {value: 'google', label: 'Google', kind: 'traditional', config: 'none'},
  {value: 'bing', label: 'Bing 网页版', kind: 'traditional', config: 'none'},
  {value: 'glm', label: '智谱 GLM', kind: 'llm', config: 'builtin'},
  {value: 'bilibili', label: 'B站 Index-Translate', kind: 'llm', config: 'none'},
  {value: 'utoolsai', label: 'uTools AI', kind: 'llm', config: 'none'},
  {value: 'deepl', label: 'DeepL', kind: 'traditional', config: 'required'},
  {value: 'azure', label: '微软翻译', kind: 'traditional', config: 'required'},
  {value: 'xftrans', label: '讯飞机器翻译', kind: 'traditional', config: 'required'},
  {value: 'siliconflow', label: '硅基流动', kind: 'llm', config: 'required'},
  {value: 'deepseek', label: 'DeepSeek', kind: 'llm', config: 'required'},
  {value: 'qwen', label: '通义千问', kind: 'llm', config: 'required'},
  {value: 'kimi', label: 'Kimi', kind: 'llm', config: 'required'},
  {value: 'minimax', label: 'MiniMax', kind: 'llm', config: 'required'},
  {value: 'qiniu', label: '七牛 AI', kind: 'llm', config: 'required'},
  {value: 'ollama', label: 'Ollama（需本地服务）', kind: 'llm', config: 'required'},
]

export const OCR_ENGINE_OPTIONS: EngineOption<OcrPlatform>[] = [
  {value: 'local', label: '本地识别（离线）', kind: 'traditional', config: 'none'},
  {value: 'youdao', label: '有道 OCR', kind: 'traditional', config: 'builtin'},
  {value: 'baidu', label: '百度 OCR', kind: 'traditional', config: 'builtin'},
  {value: 'ali', label: '阿里 OCR', kind: 'traditional', config: 'builtin'},
  {value: 'bilibili', label: 'B站 Index（视觉）', kind: 'llm', config: 'none'},
  {value: 'glm', label: '智谱 GLM（视觉）', kind: 'llm', config: 'builtin'},
  {value: 'utoolsai', label: 'uTools AI（视觉）', kind: 'llm', config: 'none'},
  {value: 'siliconflow', label: '硅基流动 OCR', kind: 'llm', config: 'required'},
  {value: 'deepseek', label: 'DeepSeek（视觉）', kind: 'llm', config: 'required'},
]

export const TRANSLATION_KEY_PLATFORMS = TRANSLATION_ENGINE_OPTIONS
  .filter(option => option.config !== 'none')
  .map(option => option.value)
export const OCR_KEY_PLATFORMS: OcrPlatform[] = ['youdao', 'baidu', 'ali', 'siliconflow']

const hasBuiltinKey = (platform: string, ocr: boolean) => {
  const ocrKeys = OcrKeyInfo as Record<string, {appkey?: string}>
  const translationKeys = AppInfo as Record<string, {appkey?: string}>
  return Boolean((ocr ? ocrKeys[platform]?.appkey || translationKeys[platform]?.appkey : translationKeys[platform]?.appkey)?.trim())
}

export function engineRequiresKey<T extends string>(option: EngineOption<T>, ocr = false) {
  return option.config === 'required' || (option.config === 'builtin' && !hasBuiltinKey(option.value, ocr))
}

function groupEngines<T extends string>(options: EngineOption<T>[], ocr: boolean): EngineGroup<T>[] {
  const groups: EngineGroup<T>[] = []
  for (const requiresKey of [false, true]) {
    for (const kind of ['traditional', 'llm'] as const) {
      const groupOptions = options.filter(option => option.kind === kind && engineRequiresKey(option, ocr) === requiresKey)
      if (!groupOptions.length) continue
      const configLabel = requiresKey ? '需 Key' : '免配置'
      const kindLabel = ocr
        ? (kind === 'llm' ? '视觉大模型' : '传统识别')
        : (kind === 'llm' ? '大模型' : '传统翻译')
      groups.push({label: `${configLabel} · ${kindLabel}`, options: groupOptions})
    }
  }
  return groups
}

export const getTranslationEngineGroups = () => groupEngines(TRANSLATION_ENGINE_OPTIONS, false)
export const getOcrEngineGroups = () => groupEngines(OCR_ENGINE_OPTIONS, true)

export const getTranslationEngine = (platform: string) =>
  TRANSLATION_ENGINE_OPTIONS.find(option => option.value === platform)

export const getOcrEngine = (platform: string) =>
  OCR_ENGINE_OPTIONS.find(option => option.value === platform)
