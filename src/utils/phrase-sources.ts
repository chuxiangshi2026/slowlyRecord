import { fetchWordBank } from '@/utils/wordbank-service'
import { getAllWordBanks } from '@/utils/wordbank-manager'
import { isPhrase } from '@/utils/text-utils'

let phraseSourceCache: string[] | null = null

export async function loadLocalPhraseSources(): Promise<string[]> {
  if (phraseSourceCache) return phraseSourceCache

  const phraseTexts: string[] = []
  try {
    const builtinBanks = await Promise.all([
      fetchWordBank('phrasal-verbs'),
      fetchWordBank('collocations'),
      fetchWordBank('idioms'),
    ])
    builtinBanks.flat().forEach(word => {
      if (word?.text) phraseTexts.push(word.text)
    })
  } catch (e) {
    console.warn('[phraseSources] 加载内置词组词库失败:', e)
  }

  try {
    const userBanks = await getAllWordBanks()
    userBanks.forEach(bank => {
      bank.words.forEach(word => {
        if (isPhrase(word)) phraseTexts.push(word.text)
      })
    })
  } catch (e) {
    console.warn('[phraseSources] 加载用户词组失败:', e)
  }

  phraseSourceCache = phraseTexts
  return phraseSourceCache
}

export function clearLocalPhraseSourcesCache() {
  phraseSourceCache = null
}
