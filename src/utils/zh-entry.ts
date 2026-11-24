/**
 * 中文加词方向（桌面端 / Web / uTools 共用）
 *
 * 添加单词或短句时，中文输入默认反向转成英文：
 *  - zh2en（默认）：中文译成英文作主词，原中文作释义
 *  - keep-zh：保留中文主词，英文译文作释义
 *
 * 与移动端 mobile/src/utils/zh-entry.ts 行为一致（设置项同名同取值）。
 */
import { translateWithPlatform } from '@/utils/translation-api'
import { useWordsStore } from '@/stores/words'

export type ZhEntryMode = 'zh2en' | 'keep-zh'

const MODE_STORAGE_KEY = 'slowlyrecord_zh_entry_mode'
let modeCache: ZhEntryMode | null = null

export function getZhEntryMode(): ZhEntryMode {
  if (modeCache) return modeCache
  try {
    modeCache = localStorage.getItem(MODE_STORAGE_KEY) === 'keep-zh' ? 'keep-zh' : 'zh2en'
  } catch {
    modeCache = 'zh2en'
  }
  return modeCache
}

export function setZhEntryMode(mode: ZhEntryMode): void {
  modeCache = mode
  try {
    localStorage.setItem(MODE_STORAGE_KEY, mode)
  } catch { /* 存储失败不影响本次行为 */ }
}

export function containsChinese(text: string): boolean {
  return /[\u4e00-\u9fff\u3400-\u4dbf]/.test(text)
}

/** 从英译结果取词头：多义项取第一段，去括号注释与标点，压成小写 */
export function pickEnglishHeadword(text: string): string {
  const seg = text.split(/[\n;；,，。！!?？/、]/).map(s => s.trim()).find(s => /[a-zA-Z]/.test(s))
  if (!seg) return ''
  return seg
    .replace(/[（(][^）)]*[）)]/g, '')
    .replace(/[^a-zA-Z' -]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export interface ZhEntry {
  /** 最终入库的主词 */
  word: string
  /** 最终入库的释义 */
  explains: string
  mode: ZhEntryMode
}

/** 句子型输入判定：有句读标点或超过 4 字（单词/词组不会这么长） */
export function looksSentenceLike(text: string): boolean {
  const t = text.trim()
  return t.length > 4 || /[，。！？；、,.!?]/.test(t)
}

/**
 * 中文词条/句子反查：仅英语词库且输入含中文时生效。
 * 单词/词组取第一个义项作主词；句子保留完整英译（单词列表也支持句子条目）。
 * 翻译失败返回 null，调用方回退原流程。
 */
export async function resolveZhEntry(text: string): Promise<ZhEntry | null> {
  if (!containsChinese(text)) return null
  let store: ReturnType<typeof useWordsStore>
  try {
    store = useWordsStore()
  } catch {
    return null
  }
  if (store.currentLanguage !== 'en') return null
  let translated = ''
  try {
    const res = await translateWithPlatform(text, store.currentTranslationPlatform, 'zh', 'en')
    if (res?.success) translated = res.explains || ''
  } catch {
    return null
  }
  const isSentence = looksSentenceLike(text)
  const english = isSentence
    ? translated.trim().replace(/\s*\n+\s*/g, ' ')
    : pickEnglishHeadword(translated)
  if (!english) return null
  const mode = getZhEntryMode()
  return mode === 'zh2en'
    ? { word: english, explains: text.trim(), mode }
    : { word: text.trim(), explains: english, mode }
}
