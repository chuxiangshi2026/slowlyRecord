/**
 * sync-server 加密与格式转换单元测试
 *
 * 只测纯函数/加解密往返，不触网、不碰 DB。
 * Node 20+ 全局提供 crypto.subtle / btoa / atob。
 */
import { describe, it, expect } from 'vitest'
import {
  toBase64Url,
  fromBase64Url,
  parseSyncCode,
  encrypt,
  decrypt,
  generateAesKey,
  exportKey,
  importKey,
  compressToJsonPayload,
  decompressFromJsonPayload,
  convertDesktopWordToMobile,
  convertMobileCompatToSyncData,
  type MobileCompatSyncData,
} from './sync-server'

describe('toBase64Url / fromBase64Url', () => {
  it('二进制数据往返一致', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255, 66, 128])
    const encoded = toBase64Url(bytes.buffer)
    const decoded = new Uint8Array(fromBase64Url(encoded))
    expect(decoded).toEqual(bytes)
  })

  it('输出为 base64url：不含 + / =，- _ 可还原', () => {
    // 0xfb 0xff 在标准 base64 中会产生 + 和 /
    const bytes = new Uint8Array([251, 255, 62, 63])
    const encoded = toBase64Url(bytes.buffer)
    expect(encoded).not.toMatch(/[+/=]/)
    expect(new Uint8Array(fromBase64Url(encoded))).toEqual(bytes)
  })

  it('空 buffer 往返', () => {
    const encoded = toBase64Url(new ArrayBuffer(0))
    expect(new Uint8Array(fromBase64Url(encoded)).length).toBe(0)
  })
})

describe('parseSyncCode', () => {
  it('正常解析 blobId.key', () => {
    expect(parseSyncCode('abc123.KeyBase64_-xxx')).toEqual({
      blobId: 'abc123',
      keyBase64: 'KeyBase64_-xxx',
    })
  })

  it('blobId 含点时按最后一个点分割', () => {
    expect(parseSyncCode('a.b.c.key')).toEqual({
      blobId: 'a.b.c',
      keyBase64: 'key',
    })
  })

  it('无点返回 null', () => {
    expect(parseSyncCode('nodots')).toBeNull()
  })

  it('末尾是点返回 null', () => {
    expect(parseSyncCode('blob.')).toBeNull()
  })

  it('开头是点（blobId 为空）返回 null', () => {
    expect(parseSyncCode('.keyonly')).toBeNull()
  })

  it('空字符串返回 null', () => {
    expect(parseSyncCode('')).toBeNull()
  })
})

describe('AES-256-GCM 加解密', () => {
  it('加密后可解密还原原文（含中文与 emoji）', async () => {
    const key = await generateAesKey()
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const plaintext = '你好, slowlyRecord! 🔒 同步数据'
    const encrypted = await encrypt(plaintext, key, iv)
    expect(encrypted).not.toContain(plaintext)
    expect(await decrypt(encrypted, key)).toBe(plaintext)
  })

  it('密钥导出/导入后可跨实例解密（同步码携带密钥的场景）', async () => {
    const key = await generateAesKey()
    const keyBase64 = await exportKey(key)
    const restoredKey = await importKey(keyBase64)

    const iv = crypto.getRandomValues(new Uint8Array(12))
    const encrypted = await encrypt('cross-device payload', restoredKey, iv)
    expect(await decrypt(encrypted, restoredKey)).toBe('cross-device payload')
  })

  it('相同明文不同 IV 产生不同密文', async () => {
    const key = await generateAesKey()
    const iv1 = crypto.getRandomValues(new Uint8Array(12))
    const iv2 = crypto.getRandomValues(new Uint8Array(12))
    const a = await encrypt('same text', key, iv1)
    const b = await encrypt('same text', key, iv2)
    expect(a).not.toBe(b)
  })

  it('密钥错误时解密失败（GCM 校验）', async () => {
    const key1 = await generateAesKey()
    const key2 = await generateAesKey()
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const encrypted = await encrypt('secret', key1, iv)
    await expect(decrypt(encrypted, key2)).rejects.toThrow()
  })
})

describe('pako 压缩往返', () => {
  it('压缩后可解压还原 JSON', async () => {
    const json = JSON.stringify({ a: 1, b: '中文文本', c: [1, 2, 3], d: { nested: true } })
    const payload = await compressToJsonPayload(json)
    expect(await decompressFromJsonPayload(payload)).toBe(json)
  })

  it('重复度高的 JSON 压缩后明显变小', async () => {
    const json = JSON.stringify({ words: new Array(200).fill('abbreviation /əˌbriːviˈeɪʃn/ n. 缩写') })
    const payload = await compressToJsonPayload(json)
    expect(payload.length).toBeLessThan(json.length / 3)
  })

  it('与加解密串联：压缩 → 加密 → 解密 → 解压', async () => {
    const json = JSON.stringify({ hello: 'world', list: [1, 2, 3] })
    const key = await generateAesKey()
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const encrypted = await encrypt(await compressToJsonPayload(json), key, iv)
    expect(await decompressFromJsonPayload(await decrypt(encrypted, key))).toBe(json)
  })
})

describe('convertDesktopWordToMobile', () => {
  it('字段映射：text→word、explains→meaning、learnDate→addTime', () => {
    const learnDate = '2026-01-02T03:04:05.000Z'
    const w = convertDesktopWordToMobile({
      text: 'hello',
      explains: '你好',
      phonetic: '/həˈləʊ/',
      itemType: 'word',
      isReview: true,
      remember: false,
      level: 3,
      learnDate,
    })
    expect(w.word).toBe('hello')
    expect(w.meaning).toBe('你好')
    expect(w.phonetic).toBe('/həˈləʊ/')
    expect(w.itemType).toBe('word')
    expect(w.needsReview).toBe(true)
    expect(w.remembered).toBe(false)
    expect(w.level).toBe(3)
    expect(w.addTime).toBe(new Date(learnDate).getTime())
    expect(w.lastReviewTime).toBe(w.addTime)
    expect(w.reviewCount).toBe(0)
  })

  it('无 itemType 时按是否含空格推断 word/phrase', () => {
    expect(convertDesktopWordToMobile({ text: 'apple' }).itemType).toBe('word')
    expect(convertDesktopWordToMobile({ text: 'good morning' }).itemType).toBe('phrase')
  })

  it('level 非数字时默认 0', () => {
    expect(convertDesktopWordToMobile({ text: 'x', level: undefined }).level).toBe(0)
    expect(convertDesktopWordToMobile({ text: 'x' }).level).toBe(0)
  })

  it('isReview/remember 缺省为 false', () => {
    const w = convertDesktopWordToMobile({ text: 'y' })
    expect(w.needsReview).toBe(false)
    expect(w.remembered).toBe(false)
  })
})

describe('convertMobileCompatToSyncData', () => {
  const exportedAt = 1720000000000

  function buildMobileData(): MobileCompatSyncData {
    return {
      version: 1,
      exportedAt,
      platform: 'mobile',
      banks: [
        {
          id: 'default',
          name: '默认词库',
          words: [
            {
              word: 'see you',
              meaning: '再见',
              itemType: 'sentence', // 特判：sentence 要归一化为 phrase
              phonetic: '/siː/',
              addTime: exportedAt - 1000,
              reviewCount: 2,
              nextReviewTime: 0,
              needsReview: true,
              remembered: false,
              level: 2,
              lastReviewTime: exportedAt - 500,
            },
            {
              word: 'plainword',
              meaning: '普通词',
              addTime: exportedAt,
              reviewCount: 0,
              nextReviewTime: 0,
              needsReview: false,
              remembered: true,
              level: undefined as unknown as number, // 缺省 → 默认 1
              lastReviewTime: exportedAt,
            },
          ],
        },
        { id: 'bank-2', name: '第二库', words: [] },
      ],
      userSettings: {
        translationPlatform: 'youdao',
        keys: { youdao: { appkey: 'a', key: 'b' } },
      },
      numberMemory: {
        entries: [],
        notes: [],
        prompts: [],
        associations: [
          { number: '1', imageUrl: '', description: '一棵大树' },
          { number: '2', imageUrl: 'data:image/png;base64,xx', description: '图片' },
        ],
        trainingResults: undefined as unknown as [],
      },
    }
  }

  it('顶层字段：version 用 SYNC_VERSION、exportedAt 保留、currentWordBankId 取第一个词库', () => {
    const data = convertMobileCompatToSyncData(buildMobileData())
    expect(data.version).toBe(1)
    expect(data.exportedAt).toBe(exportedAt)
    expect(data.platform).toBe('mobile')
    expect(data.currentWordBankId).toBe('default')
    expect(data.wordBanks.length).toBe(2)
  })

  it('sentence 特判归一化为 phrase；无空格普通词为 word', () => {
    const data = convertMobileCompatToSyncData(buildMobileData())
    const [sentenceWord, plainWord] = data.wordBanks[0].words as any[]
    expect(sentenceWord.itemType).toBe('phrase')
    expect(sentenceWord.text).toBe('see you')
    expect(sentenceWord.explains).toBe('再见')
    expect(sentenceWord.isReview).toBe(true)
    expect(sentenceWord.level).toBe(2)
    expect(sentenceWord.phonetic).toBe('/siː/')
    expect(sentenceWord._id).toContain('mobile-default-0-')
    expect(plainWord.itemType).toBe('word')
  })

  it('level 缺省默认 1；id 为 default 的词库标记 isDefault', () => {
    const data = convertMobileCompatToSyncData(buildMobileData())
    expect((data.wordBanks[0].words[1] as any).level).toBe(1)
    expect(data.wordBanks[0].isDefault).toBe(true)
    expect(data.wordBanks[1].isDefault).toBe(false)
  })

  it('userSettings 映射：翻译平台保留、keys 保留、其余给默认值', () => {
    const data = convertMobileCompatToSyncData(buildMobileData())
    expect(data.userSettings).not.toBeNull()
    expect(data.userSettings!.translationPlatform).toBe('youdao')
    expect(data.userSettings!.keys).toEqual({ youdao: { appkey: 'a', key: 'b' } })
    expect(data.userSettings!.ocrPlatform).toBe('local')
    expect(data.userSettings!.memoryFirmness).toBe('正常')
  })

  it('无 userSettings 时为 null', () => {
    const input = buildMobileData()
    delete input.userSettings
    expect(convertMobileCompatToSyncData(input).userSettings).toBeNull()
  })

  it('numberMemory：association 的 imageUrl 用 description 兜底、source 默认 upload、trainingResults 兜底空数组', () => {
    const data = convertMobileCompatToSyncData(buildMobileData())
    const [assoc1, assoc2] = data.numberMemory!.associations as any[]
    expect(assoc1.imageUrl).toBe('一棵大树')
    expect(assoc1.source).toBe('upload')
    expect(assoc2.imageUrl).toBe('data:image/png;base64,xx')
    expect(data.numberMemory!.trainingResults).toEqual([])
  })

  it('textMemory 缺省为 null；numberMemory 缺省为 null', () => {
    const input = buildMobileData()
    delete input.textMemory
    delete input.numberMemory
    const data = convertMobileCompatToSyncData(input)
    expect(data.textMemory).toBeNull()
    expect(data.numberMemory).toBeNull()
  })

  it('signin 字段原样透传（移动端推送 → 桌面端 SyncData）', () => {
    const input = buildMobileData()
    input.signin = { dates: ['2026-09-01', '2026-09-02'] }
    const data = convertMobileCompatToSyncData(input)
    expect(data.signin).toEqual({ dates: ['2026-09-01', '2026-09-02'] })
  })

  it('signin 缺省为 null（旧版移动端 payload 无打卡字段）', () => {
    const data = convertMobileCompatToSyncData(buildMobileData())
    expect(data.signin).toBeNull()
  })
})

describe('convertMobileCompatToSyncData memoryPalace 字段', () => {
  it('memoryPalace 字段原样透传（移动端推送 → 桌面端 SyncData）', async () => {
    const { convertMobileCompatToSyncData } = await import('./sync-server')
    const input: any = {
      version: 1,
      exportedAt: Date.now(),
      platform: 'mobile',
      banks: [],
      memoryPalace: {
        palaces: [{ _id: 'p1', name: '宫殿', loci: [{ order: 1, name: '大门' }], ctime: 1, utime: 1 }],
        pegs: { p1: [{ _id: 'peg_p1_1', palaceId: 'p1', locusOrder: 1, freeText: '内容', level: 4, learnDate: 100 }] },
      },
    }
    const data = convertMobileCompatToSyncData(input)
    expect(data.memoryPalace).toEqual(input.memoryPalace)
  })

  it('memoryPalace 缺省为 null（旧版移动端 payload 无宫殿字段）', async () => {
    const { convertMobileCompatToSyncData } = await import('./sync-server')
    const input: any = { version: 1, exportedAt: Date.now(), platform: 'mobile', banks: [] }
    expect(convertMobileCompatToSyncData(input).memoryPalace).toBeNull()
  })
})
