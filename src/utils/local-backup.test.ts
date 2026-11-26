/**
 * local-backup 本地全量备份/恢复 单元测试
 *
 * 锁定行为：
 *  - 导出聚合：db 全量文档 + 商店版本机大体积存储（非商店版 bulk 为空）
 *  - 解析校验：非 JSON、缺标识、版本过新、缺 docs 一律明确报错
 *  - 恢复语义：按 _id 覆盖式 upsert（沿用本端现有 _rev），不删多余文档
 *  - 跨版本兼容（商店版备份 → 非商店端）：bulk: 引用递归还原、词典分块合并、
 *    宫殿图片文档以 bulk 完整版覆盖 refs 版
 */
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const hoisted = vi.hoisted(() => ({
  docsMap: new Map<string, any>(),
  downloaded: null as null | { data: any; fileName: string },
  whenIdle: vi.fn(async () => {}),
  decryptSecret: vi.fn(async (value: string) => value),
  encryptSecret: vi.fn(async (value: string) => value ? `enc:v1:${value}` : value),
  hasSecretCrypto: vi.fn(() => false),
}))

vi.mock('@/adapters/db', () => ({
  getDbAdapter: () => ({
    allDocs: (prefix = '') =>
      Array.from(hoisted.docsMap.values()).filter(d => String(d._id).startsWith(prefix)),
    get: (id: string) => hoisted.docsMap.get(id) ?? null,
    put: (doc: any) => {
      hoisted.docsMap.set(doc._id, doc)
      return { ok: true, id: doc._id }
    },
    whenIdle: hoisted.whenIdle,
  }),
}))
vi.mock('@/adapters/file', () => ({
  getFileAdapter: () => ({
    downloadFile: async (data: any, fileName: string) => {
      hoisted.downloaded = { data, fileName }
    },
  }),
}))
// 密钥解密路径与本功能正交，这里统一按无 WebCrypto 环境处理（跳过解密分支）
vi.mock('@/utils/secret-crypto', () => ({
  decryptSecret: hoisted.decryptSecret,
  encryptSecret: hoisted.encryptSecret,
  hasSecretCrypto: hoisted.hasSecretCrypto,
  isEncryptedSecret: (v: string) => typeof v === 'string' && v.startsWith('enc:v1:'),
}))

import {
  applyLocalBackup,
  buildLocalBackup,
  exportLocalBackupToFile,
  parseLocalBackup,
  type LocalBackupFile,
} from '@/utils/local-backup'
import {
  _setStoreLocalOnlyForTest,
  initLocalBulkStore,
  localBulkGet,
  localBulkSet,
} from '@/adapters/local-bulk-store'

function makeBackup(partial: Partial<LocalBackupFile>): LocalBackupFile {
  return {
    kind: 'slowlyrecord-local-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    platform: 'utools',
    storeBuild: true,
    docs: [],
    bulk: {},
    ...partial,
  }
}

describe('local-backup', () => {
  beforeEach(async () => {
    hoisted.docsMap.clear()
    hoisted.downloaded = null
    hoisted.whenIdle.mockClear()
    hoisted.whenIdle.mockResolvedValue(undefined)
    hoisted.hasSecretCrypto.mockReturnValue(false)
    hoisted.decryptSecret.mockImplementation(async (value: string) => value)
    _setStoreLocalOnlyForTest(true)
    await initLocalBulkStore()
  })

  it('导出聚合：商店版含本机大体积数据，文件经下载适配器落盘', async () => {
    hoisted.docsMap.set('user-set', { _id: 'user-set', pluginStatus: true })
    await localBulkSet('bulk:mapping:number:0', 'data:image/png;base64,AAA')

    const res = await exportLocalBackupToFile()

    expect(res.fileName).toMatch(/^slowlyrecord-backup-\d{8}-\d{4}\.json$/)
    expect(res.docs).toBe(1)
    expect(res.bulk).toBe(1)
    const saved = JSON.parse(hoisted.downloaded!.data as string)
    expect(saved.kind).toBe('slowlyrecord-local-backup')
    expect(saved.docs[0]._id).toBe('user-set')
    expect(saved.bulk['bulk:mapping:number:0']).toBe('data:image/png;base64,AAA')
  })

  it('导出聚合：非商店版 bulk 恒为空（图片本就在同步库文档里）', async () => {
    _setStoreLocalOnlyForTest(false)
    hoisted.docsMap.set('w1', { _id: 'w1', text: 'hello' })

    const backup = buildLocalBackup()

    expect(backup.docs).toHaveLength(1)
    expect(backup.bulk).toEqual({})
    expect(backup.storeBuild).toBe(false)
  })

  it('解析校验：非法文件一律明确报错', () => {
    expect(() => parseLocalBackup('not json')).toThrow('备份文件不是有效的 JSON')
    expect(() => parseLocalBackup('{"foo":1}')).toThrow('不是慢记备份文件')
    expect(() => parseLocalBackup(JSON.stringify(makeBackup({ version: 99 })))).toThrow('版本过新')
    expect(() => parseLocalBackup(JSON.stringify({ ...makeBackup({}), docs: null }))).toThrow('缺少数据文档')
    expect(parseLocalBackup(JSON.stringify(makeBackup({})))).toBeTruthy()
  })

  it('同构恢复（商店版→商店版）：文档 upsert + 本机大体积逐条恢复', async () => {
    // 本端已存在 user-set（带 _rev），备份覆盖它；w-new 为新增
    hoisted.docsMap.set('user-set', { _id: 'user-set', _rev: '9-local', pluginStatus: false })
    const backup = makeBackup({
      docs: [
        { _id: 'user-set', _rev: '3-remote', pluginStatus: true },
        { _id: 'w-new', text: 'apple' },
      ],
      bulk: { 'bulk:mapping:number:0': 'data:image/png;base64,BBB' },
    })

    const res = await applyLocalBackup(backup)

    expect(res).toEqual({ docs: 2, bulk: 1 })
    // 覆盖写沿用本端现有 _rev，丢弃备份里的旧 _rev
    const userSet = hoisted.docsMap.get('user-set')
    expect(userSet._rev).toBe('9-local')
    expect(userSet.pluginStatus).toBe(true)
    expect(hoisted.docsMap.get('w-new')).toBeTruthy()
    expect(localBulkGet('bulk:mapping:number:0')).toBe('data:image/png;base64,BBB')
  })

  it('跨版本恢复（商店版备份→非商店端）：bulk: 引用还原 + 词典分块合并 + 宫殿图覆盖 refs 版', async () => {
    _setStoreLocalOnlyForTest(false)
    const dataUrl = 'data:image/webp;base64,CCC'
    const backup = makeBackup({
      docs: [
        // 数字映射文档：imageUrl 是 bulk: 引用
        { _id: 'number-memory', items: [{ num: '0', imageUrl: 'bulk:mapping:number:0' }] },
        // 宫殿图片 refs 版（images 空），应被 bulk 完整版覆盖
        { _id: 'memory_palace_images:p1', type: 'memory_palace_images', images: {}, refs: { '0': 100 } },
      ],
      bulk: {
        'bulk:mapping:number:0': dataUrl,
        'memory_palace_images:p1': {
          _id: 'memory_palace_images:p1',
          type: 'memory_palace_images',
          images: { '0': dataUrl },
        },
        external_dictionary_meta: { version: '2.0', total: 2, chunks: 2 },
        external_dictionary_chunk_0: { apple: { explains: '苹果' } },
        external_dictionary_chunk_1: { banana: { explains: '香蕉' } },
      },
    })

    const res = await applyLocalBackup(backup)

    expect(res.docs).toBe(3) // number-memory + 宫殿完整版（替换 refs 版）+ 词典合并文档
    expect(res.bulk).toBe(0) // 非商店端不写本机存储
    // bulk: 引用递归还原
    expect(hoisted.docsMap.get('number-memory').items[0].imageUrl).toBe(dataUrl)
    // 宫殿图片：refs 版被完整版覆盖
    expect(hoisted.docsMap.get('memory_palace_images:p1').images['0']).toBe(dataUrl)
    // 词典分块合并回整文档
    const dict = hoisted.docsMap.get('external_dictionary')
    expect(dict.version).toBe('2.0')
    expect(Object.keys(dict.words).sort()).toEqual(['apple', 'banana'])
  })

  it('跨版本恢复（主分支备份→商店版）：dataURL 原文写回文档，读取侧既有迁移自动落本机', async () => {
    const backup = makeBackup({
      docs: [{ _id: 'memory_palace_images:p1', type: 'memory_palace_images', images: { '0': 'data:image/webp;base64,DDD' } }],
      bulk: {},
    })

    const res = await applyLocalBackup(backup)

    expect(res).toEqual({ docs: 1, bulk: 0 })
    // 文档按原样（含内联 dataURL）写回同步库——getPalaceImagesDoc 的旧版迁移会异步转本机
    expect(hoisted.docsMap.get('memory_palace_images:p1').images['0']).toBe('data:image/webp;base64,DDD')
  })

  it('恢复不删除本端多出的文档，且无 _id 的脏条目跳过', async () => {
    hoisted.docsMap.set('keep-me', { _id: 'keep-me', v: 1 })
    const backup = makeBackup({ docs: [{ _id: 'x', v: 2 }, { noId: true } as any] })

    await applyLocalBackup(backup)

    expect(hoisted.docsMap.get('keep-me')).toBeTruthy()
    expect(hoisted.docsMap.get('x').v).toBe(2)
  })

  it('恢复完成前等待数据库写队列空闲', async () => {
    await applyLocalBackup(makeBackup({ docs: [{ _id: 'x', v: 1 }] }))
    expect(hoisted.whenIdle).toHaveBeenCalledTimes(1)
  })

  it('非安全上下文遇到密文时中止恢复，不写密文也不清空原密钥', async () => {
    _setStoreLocalOnlyForTest(false)
    hoisted.docsMap.set('user-set', {
      _id: 'user-set',
      keys: { glm: { appkey: 'existing-app', key: 'existing-key' } },
    })
    const backup = makeBackup({
      docs: [{
        _id: 'user-set',
        keys: { glm: { appkey: 'enc:v1:cipher-app', key: 'enc:v1:cipher-key' } },
      }],
    })

    await expect(applyLocalBackup(backup)).rejects.toThrow('不支持密钥解密')
    expect(hoisted.docsMap.get('user-set').keys.glm.key).toBe('existing-key')
  })

  it('恢复明文备份时先加密再写回数据库', async () => {
    _setStoreLocalOnlyForTest(false)
    hoisted.hasSecretCrypto.mockReturnValue(true)
    const backup = makeBackup({
      docs: [{ _id: 'user-set', keys: { glm: { appkey: 'plain-app', key: 'plain-key' } } }],
    })

    await applyLocalBackup(backup)

    const stored = hoisted.docsMap.get('user-set')
    expect(stored.keys.glm.appkey).toBe('enc:v1:plain-app')
    expect(stored.keys.glm.key).toBe('enc:v1:plain-key')
  })

  it('无安全加密环境时拒绝把备份密钥写成本地明文', async () => {
    _setStoreLocalOnlyForTest(false)
    hoisted.hasSecretCrypto.mockReturnValue(false)
    const backup = makeBackup({
      docs: [{ _id: 'user-set', keys: { glm: { appkey: 'plain-app', key: 'plain-key' } } }],
    })

    await expect(applyLocalBackup(backup)).rejects.toThrow('不支持密钥加密')
    expect(hoisted.docsMap.has('user-set')).toBe(false)
  })

  it('bulk 引用不读取原型上的继承属性', async () => {
    _setStoreLocalOnlyForTest(false)
    ;(Object.prototype as any)['bulk:constructor'] = vi.fn()
    const backup = makeBackup({
      docs: [{ _id: 'number-memory', items: [{ imageUrl: 'bulk:constructor' }] }],
      bulk: { 'bulk:known': 'data:image/png;base64,AAA' },
    })

    try {
      await applyLocalBackup(backup)
      expect(hoisted.docsMap.get('number-memory').items[0].imageUrl).toBe('bulk:constructor')
    } finally {
      delete (Object.prototype as any)['bulk:constructor']
    }
  })
})
