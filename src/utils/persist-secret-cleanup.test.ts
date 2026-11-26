// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { scrubPersistedStoreSecrets } from './persist-secret-cleanup'

function makeStorage(initial: string) {
  let value = initial
  return {
    getItem: () => value,
    setItem: (_key: string, next: string) => { value = next },
    read: () => value,
  }
}

describe('scrubPersistedStoreSecrets', () => {
  it('移除 words-store 中旧版持久化的翻译与 OCR 密钥', () => {
    const storage = makeStorage(JSON.stringify({
      currentTranslationPlatform: 'glm',
      userApiKeys: { glm: { appkey: 'plain-app', key: 'plain-key' } },
      userOcrApiKeys: { baidu: { appkey: 'ocr-app', key: 'ocr-key' } },
    }))

    expect(scrubPersistedStoreSecrets(storage)).toBe(true)
    const saved = JSON.parse(storage.read())
    expect(saved.currentTranslationPlatform).toBe('glm')
    expect(saved.userApiKeys).toBeUndefined()
    expect(saved.userOcrApiKeys).toBeUndefined()
    expect(storage.read()).not.toContain('plain-key')
    expect(storage.read()).not.toContain('ocr-key')
  })

  it('无密钥字段时不写回，损坏 JSON 不抛错', () => {
    const clean = makeStorage(JSON.stringify({ currentTranslationPlatform: 'glm' }))
    expect(scrubPersistedStoreSecrets(clean)).toBe(false)

    const broken = makeStorage('{broken')
    expect(() => scrubPersistedStoreSecrets(broken)).not.toThrow()
    expect(scrubPersistedStoreSecrets(broken)).toBe(false)
  })
})
