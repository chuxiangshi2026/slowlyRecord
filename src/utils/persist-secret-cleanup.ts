/**
 * 清理旧版 words-store 持久化中残留的明文密钥。
 *
 * 新版不再把 userApiKeys/userOcrApiKeys 写入 Pinia 持久化，密钥只在加密的
 * user-set 文档中保存；首次升级时删除旧 localStorage 副本。
 */

const WORDS_STORE_KEY = 'words-store'

interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export function scrubPersistedStoreSecrets(storage: StorageLike = localStorage): boolean {
  try {
    const raw = storage.getItem(WORDS_STORE_KEY)
    if (!raw) return false
    const state = JSON.parse(raw)
    if (!state || typeof state !== 'object') return false
    const hasSecrets = 'userApiKeys' in state || 'userOcrApiKeys' in state
    if (!hasSecrets) return false
    delete state.userApiKeys
    delete state.userOcrApiKeys
    storage.setItem(WORDS_STORE_KEY, JSON.stringify(state))
    return true
  } catch {
    return false
  }
}
