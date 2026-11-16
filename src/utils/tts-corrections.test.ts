import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setDbAdapter, resetDbAdapter, type DbAdapter } from '@/adapters/db'
import { applyTtsCorrections, loadTtsCorrections, saveTtsCorrections, TTS_CORRECTIONS_DOC_ID } from './tts-corrections'

const createMockDb = (): DbAdapter => {
  const storage = new Map<string, any>()
  return {
    get: vi.fn((id: string) => storage.get(id) || null),
    put: vi.fn((doc: any) => {
      const rev = `${(storage.has(doc._id) ? 2 : 1)}-rev`
      storage.set(doc._id, { ...doc, _rev: rev })
      return { ok: true, id: doc._id, rev }
    }),
    remove: vi.fn(),
    allDocs: vi.fn(() => []),
    bulkDocs: vi.fn(),
    promises: {} as any,
  }
}

describe('tts-corrections', () => {
  let mockDb: DbAdapter

  beforeEach(() => {
    mockDb = createMockDb()
    setDbAdapter(mockDb)
  })

  afterEach(() => {
    resetDbAdapter()
  })

  describe('applyTtsCorrections', () => {
    it('替换命中片段，未命中保持原文', () => {
      const text = '他在银行工作，每天步行上班。'
      expect(applyTtsCorrections(text, [{ from: '银行', to: '银杭' }])).toBe('他在银杭工作，每天步行上班。')
      expect(applyTtsCorrections(text, [{ from: '重庆', to: '虫庆' }])).toBe(text)
    })

    it('长片段优先替换，避免短词抢占', () => {
      const text = '银行行长'
      const result = applyTtsCorrections(text, [
        { from: '银行', to: '银杭' },
        { from: '银行行长', to: '银杭形长' },
      ])
      expect(result).toBe('银杭形长')
    })

    it('忽略空条目与原文等于替换的条目', () => {
      const text = '重逢'
      expect(applyTtsCorrections(text, [
        { from: '', to: 'x' },
        { from: '重逢', to: '' },
        { from: '重逢', to: '重逢' },
      ] as any)).toBe(text)
      expect(applyTtsCorrections(text, [])).toBe(text)
      expect(applyTtsCorrections('', [{ from: 'a', to: 'b' }])).toBe('')
    })
  })

  describe('load/save 往返', () => {
    it('保存后可读回；二次保存携带 _rev', async () => {
      expect(await loadTtsCorrections()).toEqual([])

      const list = [{ from: '银行', to: '银杭' }, { from: '重量', to: '种量' }]
      expect(await saveTtsCorrections(list)).toBe(true)
      expect(await loadTtsCorrections()).toEqual(list)

      expect(await saveTtsCorrections([{ from: '银行', to: '银杭' }])).toBe(true)
      const putDoc = (mockDb.put as any).mock.calls[1][0]
      expect(putDoc._id).toBe(TTS_CORRECTIONS_DOC_ID)
      expect(putDoc._rev).toBe('1-rev')
    })

    it('保存时清洗空条目与重复 from', async () => {
      await saveTtsCorrections([
        { from: '银行', to: '银杭' },
        { from: ' ', to: 'x' },
        { from: '银行', to: '银河' },
      ])
      expect(await loadTtsCorrections()).toEqual([{ from: '银行', to: '银杭' }])
    })
  })
})
