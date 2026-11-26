// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@shared/utils/sync-manager', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shared/utils/sync-manager')>()
  return { ...actual, collectSyncData: vi.fn() }
})

import { collectSyncData } from '@shared/utils/sync-manager'
import {
  decompressFromJsonPayload,
  decrypt,
  parseSyncCode,
  importKey,
  setSyncServerUrl,
  uploadToServer,
} from './sync-server'

const sensitiveData = {
  version: 1,
  exportedAt: 1,
  platform: 'test',
  wordBanks: [],
  currentWordBankId: '',
  userSettings: {
    keys: { glm: { appkey: 'private-app', key: 'private-key' } },
    ocrKeys: { tencent: { appkey: 'private-ocr', key: 'private-ocr-key' } },
  },
  textMemory: null,
  numberMemory: null,
  shortcutMemory: null,
  letterMemory: null,
} as any

async function readUploadedJson(fetchMock: ReturnType<typeof vi.fn>, index: number, code: string): Promise<any> {
  const options = fetchMock.mock.calls[index][1]
  const body = JSON.parse(options.body)
  const parsedCode = parseSyncCode(code)!
  const compressed = await decrypt(body.e, await importKey(parsedCode.keyBase64))
  return JSON.parse(await decompressFromJsonPayload(compressed))
}

describe('桌面同步码上传', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    vi.mocked(collectSyncData).mockResolvedValue(sensitiveData)
    setSyncServerUrl('https://sync.test')
  })

  it('加密上传前移除翻译与 OCR 密钥', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ code: 'blob-1' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await uploadToServer()

    expect(result.success).toBe(true)
    const uploaded = await readUploadedJson(fetchMock, 0, result.code!)
    expect(uploaded.userSettings.keys).toEqual({})
    expect(uploaded.userSettings.ocrKeys).toEqual({})
    expect(JSON.stringify(uploaded)).not.toContain('private-key')
    expect(JSON.stringify(uploaded)).not.toContain('private-ocr-key')
  })

  it('相同数据再次主动推送仍生成新同步码，不被永久哈希跳过', async () => {
    const fetchMock = vi.fn()
    for (const id of ['blob-1', 'blob-2']) {
      fetchMock.mockImplementationOnce(async () => new Response(JSON.stringify({ code: id }), { status: 200 }))
    }
    vi.stubGlobal('fetch', fetchMock)

    const first = await uploadToServer()
    const second = await uploadToServer()

    expect(first.success).toBe(true)
    expect(second.success).toBe(true)
    expect(second.skipped).not.toBe(true)
    expect(second.code).not.toBe(first.code)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
