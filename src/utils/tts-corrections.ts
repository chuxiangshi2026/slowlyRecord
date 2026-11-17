/**
 * 中文 TTS 发音纠错表（R11）：机读多音字易错，把易错片段替换为同音字写法，
 * 仅作用于送給 TTS 的文本，界面显示仍用原文。
 * 全局生效：专注模式朗读文章时在 speechContent（文章级朗读文本）之后再套用本表。
 */
import { getDbAdapterAsync } from '@/adapters/db'

export interface TtsCorrection {
  /** 原文片段（如「委员长」） */
  from: string
  /** 朗读替换片段（如「伪装长」），通常为同音字 */
  to: string
}

export const TTS_CORRECTIONS_DOC_ID = 'tts-corrections'

interface TtsCorrectionsDoc {
  _id: string
  _rev?: string
  list?: TtsCorrection[]
}

function sanitize(list: unknown): TtsCorrection[] {
  if (!Array.isArray(list)) return []
  const seen = new Set<string>()
  const result: TtsCorrection[] = []
  for (const item of list as TtsCorrection[]) {
    const from = String(item?.from || '').trim()
    const to = String(item?.to || '').trim()
    if (!from || !to || from === to || seen.has(from)) continue
    seen.add(from)
    result.push({ from, to })
  }
  return result
}

export async function loadTtsCorrections(): Promise<TtsCorrection[]> {
  const db = await getDbAdapterAsync()
  const doc = db.get(TTS_CORRECTIONS_DOC_ID) as TtsCorrectionsDoc | null
  return sanitize(doc?.list)
}

export async function saveTtsCorrections(list: TtsCorrection[]): Promise<boolean> {
  const db = await getDbAdapterAsync()
  const existing = db.get(TTS_CORRECTIONS_DOC_ID) as TtsCorrectionsDoc | null
  const result = db.put({
    _id: TTS_CORRECTIONS_DOC_ID,
    ...(existing?._rev ? { _rev: existing._rev } : {}),
    list: sanitize(list),
  } as TtsCorrectionsDoc)
  return !!result?.ok
}

/** 把纠错表套用到待朗读文本：长的片段先替换，避免短词抢占长词 */
export function applyTtsCorrections(text: string, corrections: TtsCorrection[]): string {
  if (!text || !corrections.length) return text
  const sorted = sanitize(corrections).sort((a, b) => b.from.length - a.from.length)
  let out = text
  for (const item of sorted) {
    if (out.includes(item.from)) out = out.split(item.from).join(item.to)
  }
  return out
}
