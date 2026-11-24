/**
 * 中文加词方向（移动端主包版）
 *
 * 添加单词/短句时，中文输入默认反向转成英文：
 *  - zh2en（默认）：中文译成英文作主词，原中文作释义
 *  - keep-zh：保留中文主词，英文译文作释义
 *
 * 翻译走主包轻量中译英（quick-translate，与文本记忆同一实现），
 * 不依赖 pages-tools 分包，主包页面与各分包页面均可引用。
 */
import { quickTranslateToEnglish } from './quick-translate'
import { containsChinese } from './youdao-tts'

export { containsChinese }

export type ZhEntryMode = 'zh2en' | 'keep-zh'

const MODE_STORAGE_KEY = 'slowlyrecord_zh_entry_mode'
let modeCache: ZhEntryMode | null = null

export function getZhEntryMode(): ZhEntryMode {
  if (modeCache) return modeCache
  try {
    modeCache = uni.getStorageSync(MODE_STORAGE_KEY) === 'keep-zh' ? 'keep-zh' : 'zh2en'
  } catch {
    modeCache = 'zh2en'
  }
  return modeCache
}

export function setZhEntryMode(mode: ZhEntryMode): void {
  modeCache = mode
  try {
    uni.setStorageSync(MODE_STORAGE_KEY, mode)
  } catch { /* 存储失败不影响本次行为 */ }
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
  /** 最终入库的主词（词库列表显示的内容） */
  word: string
  /** 最终入库的释义 */
  meaning: string
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
 * 翻译失败或取不到内容返回 null，调用方回退原有流程。
 */
export async function resolveZhEntry(text: string, language: string): Promise<ZhEntry | null> {
  if (language !== 'en' || !containsChinese(text)) return null
  let translated = ''
  try {
    const res = await quickTranslateToEnglish(text)
    if (res.ok) translated = res.text
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
    ? { word: english, meaning: text.trim(), mode }
    : { word: text.trim(), meaning: english, mode }
}
