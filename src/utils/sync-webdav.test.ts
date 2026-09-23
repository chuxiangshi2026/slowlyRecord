/**
 * WebDAV 同步（sync-webdav.ts）单元测试
 *
 * collectSyncData / restoreSyncData 依赖数据库，这里用 vi.mock 替换，
 * 聚焦验证：加解密闭环、URL 拼接、认证头、HTTP 状态翻译、传输往返、
 * 完整 SyncData 格式上传与新旧格式恢复分流。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RestoreResult } from '@/utils/sync-manager'
import { SYNC_VERSION } from '@shared/types/sync'

const restoreSyncDataMock = vi.fn(async (): Promise<RestoreResult> => ({
  success: true,
  wordBanksRestored: 1,
  userSettingsRestored: false,
  textMemoryRestored: false,
  numberMemoryRestored: false,
  shortcutMemoryRestored: false,
  letterMemoryRestored: false,
  knowledgeMemoryRestored: false,
  phoneticMemoryRestored: false,
  signinRestored: false,
  memoryPalaceRestored: false,
  sentencesRestored: false,
  errors: [],
}))

/** 完整 SyncData 样本（含四模块，验证 WebDAV 备份走完整格式） */
const fullSyncDataSample = {
  version: SYNC_VERSION,
  exportedAt: 789,
  platform: 'desktop',
  wordBanks: [{ id: 'b1', name: '测试词库', words: [], createdAt: 1, updatedAt: 1 }],
  currentWordBankId: 'b1',
  userSettings: null,
  textMemory: null,
  numberMemory: null,
  shortcutMemory: { customCategories: [], trainingRecords: [], learningProgress: [] },
  letterMemory: { associations: [], trainingResults: [] },
  knowledgeMemory: null,
  phoneticMemory: null,
  signin: null,
  memoryPalace: null,
  sentences: null,
  tombstones: {},
}

vi.mock('@/utils/sync-manager', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/utils/sync-manager')>()
  return {
    ...mod,
    restoreSyncData: (...args: unknown[]) => restoreSyncDataMock(...args),
    // 避免测试触库：上传时的数据收集换成固定样本
    collectSyncData: vi.fn(async () => fullSyncDataSample as any),
  }
})

import {
  NUTSTORE_WEBDAV_URL,
  buildWebDavVerdict,
  decodeWebDavFile,
  diagnoseWebDav,
  downloadFromWebDav,
  encodeWebDavFile,
  formatWebDavDiagnosis,
  normalizeWebDavUrl,
  checkDirWritable,
  parseChildCollections,
  probeCandidateDirs,
  testWebDavConnection,
  uploadToWebDav,
  webDavFileUrl,
} from './sync-webdav'

const cfg = { url: NUTSTORE_WEBDAV_URL, username: 'user@example.com', password: 'app-password' }
const key = `${cfg.username}:${cfg.password}`

function mockFetchOnce(impl: (...args: unknown[]) => unknown) {
  ;(globalThis.fetch as ReturnType<typeof vi.fn>) = vi.fn(impl)
}

beforeEach(() => {
  restoreSyncDataMock.mockClear()
})

describe('WebDAV 文件加解密', () => {
  it('加密打包后可按相同凭据还原（含中文）', () => {
    const json = JSON.stringify({ hello: '世界', n: 42 })
    const body = encodeWebDavFile(json, key)
    expect(decodeWebDavFile(body, key)).toBe(json)
  })

  it('凭据不一致时解码失败', () => {
    const body = encodeWebDavFile('{"a":1}', key)
    expect(() => decodeWebDavFile(body, 'wrong-key')).toThrow()
  })
})

describe('webDavFileUrl', () => {
  it('规范化结尾斜杠并拼接固定文件名', () => {
    expect(webDavFileUrl(cfg)).toBe(`${NUTSTORE_WEBDAV_URL}slowlyRecord-sync.enc`)
    expect(webDavFileUrl({ ...cfg, url: 'https://example.com/dav///' }))
      .toBe('https://example.com/dav/slowlyRecord-sync.enc')
  })
})

describe('normalizeWebDavUrl：用户手填地址的容错', () => {
  it('只填坚果云主机时自动补 /dav/（否则 PUT 打到不存在的集合，报「目录不存在」）', () => {
    expect(normalizeWebDavUrl('dav.jianguoyun.com')).toBe(NUTSTORE_WEBDAV_URL)
    expect(normalizeWebDavUrl('https://dav.jianguoyun.com')).toBe(NUTSTORE_WEBDAV_URL)
    expect(normalizeWebDavUrl('https://dav.jianguoyun.com/')).toBe(NUTSTORE_WEBDAV_URL)
  })

  it('缺协议时补 https://', () => {
    expect(normalizeWebDavUrl('example.com/dav')).toBe('https://example.com/dav/')
  })

  it('去掉零宽字符、全角空格与首尾误带的引号/尖括号', () => {
    expect(normalizeWebDavUrl('  "https://example.com/dav"  ')).toBe('https://example.com/dav/')
    expect(normalizeWebDavUrl('https://example.com\u3000/dav')).toBe('https://example.com/dav/')
    expect(normalizeWebDavUrl('\u200Bhttps://example.com/dav\uFEFF')).toBe('https://example.com/dav/')
  })

  it('误把同步文件全路径粘进来时去掉文件名', () => {
    expect(normalizeWebDavUrl('https://example.com/dav/slowlyRecord-sync.enc'))
      .toBe('https://example.com/dav/')
  })

  it('空地址回退默认地址；重复斜杠折叠', () => {
    expect(normalizeWebDavUrl('')).toBe(NUTSTORE_WEBDAV_URL)
    expect(normalizeWebDavUrl('https://example.com//dav//sub'))
      .toBe('https://example.com/dav/sub/')
  })

  it('中文子文件夹逐段编码，路径结构保留', () => {
    expect(webDavFileUrl({ ...cfg, url: 'https://example.com/dav/我的备份' }))
      .toBe(`https://example.com/dav/${encodeURIComponent('我的备份')}/slowlyRecord-sync.enc`)
  })
})

describe('buildWebDavVerdict / diagnoseWebDav：能读不能写的诊断', () => {
  it('认证通过但 PUT 被拒（404）→ 判定为账号侧写权限受限，而非地址问题（用户实际场景）', async () => {
    globalThis.fetch = vi.fn(async (_url: unknown, init: any) => {
      const method = init?.method
      if (method === 'GET') return { ok: false, status: 404, headers: new Headers() }
      if (method === 'PUT') return { ok: false, status: 404, headers: new Headers() }
      return { ok: true, status: 207, headers: new Headers() }
    }) as any

    const d = await diagnoseWebDav(cfg)
    expect(d.canRead).toBe(true)
    expect(d.canWrite).toBe(false)
    expect(d.verdict).toContain('创建不了')
    const text = formatWebDavDiagnosis(d)
    expect(text).toContain('PUT 探针（1 字节）：HTTP 404')
    expect(text).toContain('PUT 探针（64KB）：HTTP 404')
    expect(text).toContain('PROPFIND 目录：HTTP 207')
  })

  it('当前目录不可写、存在可写子目录 → 黄色（config）并给出 resolvedDir', async () => {
    globalThis.fetch = vi.fn(async (url: unknown, init: any) => {
      const u = String(url)
      const headers = new Headers()
      if (init?.method === 'PUT') {
        return u.includes(encodeURIComponent('我的坚果云'))
          ? { ok: true, status: 201, headers, text: async () => '' }
          : { ok: false, status: 404, headers, text: async () => '<d:error><s:exception>ObjectNotFound</s:exception></d:error>' }
      }
      if (init?.method === 'PROPFIND') return { ok: true, status: 207, headers, text: async () => PROPFIND_XML }
      return { ok: true, status: 204, headers, text: async () => '' }
    }) as any

    const d = await diagnoseWebDav(cfg)
    expect(d.level).toBe('config')
    expect(d.resolvedDir).toBe('https://dav.jianguoyun.com/dav/我的坚果云/')
    expect(d.candidates).toEqual(['https://dav.jianguoyun.com/dav/我的坚果云/'])
    expect(formatWebDavDiagnosis(d)).toContain('分级：改配置即可（黄）')
  })

  it('当前目录可写 → 绿色（ok）', async () => {
    globalThis.fetch = vi.fn(async (_url: unknown, init: any) => {
      const headers = new Headers()
      if (init?.method === 'PUT') return { ok: true, status: 201, headers, text: async () => '' }
      if (init?.method === 'PROPFIND') return { ok: true, status: 207, headers, text: async () => PROPFIND_XML }
      return { ok: true, status: 200, headers, text: async () => '' }
    }) as any

    const d = await diagnoseWebDav(cfg)
    expect(d.level).toBe('ok')
    expect(d.resolvedDir).toBeUndefined()
    expect(formatWebDavDiagnosis(d)).toContain('分级：正常（绿）')
  })

  it('1 字节探针成功、64KB 被拒 → 判定为体积/中间层拦截而非账号权限', async () => {
    globalThis.fetch = vi.fn(async (_url: unknown, init: any) => {
      if (init?.method === 'PUT') {
        const len = String(init?.body ?? '').length
        return { ok: len < 10, status: len < 10 ? 201 : 404, headers: new Headers() }
      }
      if (init?.method === 'DELETE') return { ok: true, status: 204, headers: new Headers() }
      if (init?.method === 'GET') return { ok: false, status: 404, headers: new Headers() }
      return { ok: true, status: 207, headers: new Headers() }
    }) as any

    const d = await diagnoseWebDav(cfg)
    expect(d.verdict).toContain('64KB 上传被拒')
    expect(d.verdict).toContain('中间层')
  })

  it('PUT 探针成功（201）→ 读写正常，且自动清理探针文件', async () => {
    const methods: string[] = []
    globalThis.fetch = vi.fn(async (_url: unknown, init: any) => {
      methods.push(String(init?.method))
      if (init?.method === 'PUT') return { ok: true, status: 201, headers: new Headers() }
      if (init?.method === 'DELETE') return { ok: true, status: 204, headers: new Headers() }
      if (init?.method === 'GET') return { ok: false, status: 404, headers: new Headers() }
      return { ok: true, status: 207, headers: new Headers() }
    }) as any

    const d = await diagnoseWebDav(cfg)
    expect(d.canWrite).toBe(true)
    expect(d.verdict).toContain('读写均正常')
    expect(methods).toContain('DELETE')
  })

  it('PUT 404 且正文为 ObjectNotFound → 结论指向「需写入子目录」并列出可用子目录', async () => {
    globalThis.fetch = vi.fn(async (_url: unknown, init: any) => {
      const headers = new Headers()
      if (init?.method === 'PUT') return { ok: false, status: 404, headers, text: async () => '<d:error><s:exception>ObjectNotFound</s:exception></d:error>' }
      if (init?.method === 'PROPFIND') return { ok: true, status: 207, headers, text: async () => PROPFIND_XML }
      return { ok: true, status: 200, headers, text: async () => '' }
    }) as any

    const d = await diagnoseWebDav(cfg)
    expect(d.verdict).toContain('ObjectNotFound')
    expect(d.verdict).toContain('子目录')
    expect(formatWebDavDiagnosis(d)).toContain('可用子目录：https://dav.jianguoyun.com/dav/我的坚果云/')
  })

  it('全部 401 → 判定认证失败（而非目录不存在）', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: false, status: 401, headers: new Headers() })) as any
    const d = await diagnoseWebDav(cfg)
    expect(d.verdict).toContain('认证失败')
    expect(d.verdict).not.toContain('目录不存在')
  })

  it('网络不可达 → 提示未到达网盘', () => {
    const { verdict } = buildWebDavVerdict([
      { step: 'PROPFIND 目录', status: null, detail: 'TypeError: Failed to fetch' },
      { step: 'PUT 探针文件', status: null },
    ])
    expect(verdict).toContain('未能到达网盘')
  })
})

const PROPFIND_XML = `<?xml version="1.0" encoding="UTF-8"?>
<d:multistatus xmlns:d="DAV:">
  <d:response><d:href>/dav/</d:href></d:response>
  <d:response><d:href>/dav/%E6%88%91%E7%9A%84%E5%9D%9A%E6%9E%9C%E4%BA%91/</d:href></d:response>
  <d:response><d:href>/dav/notes.txt</d:href></d:response>
</d:multistatus>`

describe('parseChildCollections：从 PROPFIND 找可写目录', () => {
  it('取出子集合完整 URL（解码中文），排除根自身与文件', () => {
    expect(parseChildCollections(PROPFIND_XML, NUTSTORE_WEBDAV_URL))
      .toEqual(['https://dav.jianguoyun.com/dav/我的坚果云/'])
  })

  it('无子目录时返回空数组', () => {
    expect(parseChildCollections('<d:multistatus><d:response><d:href>/dav/</d:href></d:response></d:multistatus>', NUTSTORE_WEBDAV_URL))
      .toEqual([])
  })
})

describe('uploadToWebDav：根目录不可写时自动改用子目录', () => {
  it('根目录 PUT 404(ObjectNotFound) → 找到可写子目录并重传成功，返回 resolvedDir', async () => {
    const putUrls: string[] = []
    globalThis.fetch = vi.fn(async (url: unknown, init: any) => {
      const u = String(url)
      const headers = new Headers()
      if (init?.method === 'PUT') {
        putUrls.push(u)
        return u.includes(encodeURIComponent('我的坚果云'))
          ? { ok: true, status: 201, headers, text: async () => '' }
          : { ok: false, status: 404, headers, text: async () => '<d:error><s:exception>ObjectNotFound</s:exception></d:error>' }
      }
      if (init?.method === 'PROPFIND') return { ok: true, status: 207, headers, text: async () => PROPFIND_XML }
      if (init?.method === 'DELETE') return { ok: true, status: 204, headers, text: async () => '' }
      return { ok: true, status: 200, headers, text: async () => '' }
    }) as any

    const r = await uploadToWebDav(cfg)
    expect(r.success).toBe(true)
    expect(r.resolvedDir).toBe('https://dav.jianguoyun.com/dav/我的坚果云/')
    // 根目录正式上传 1 次 + 子目录探针 1 次 + 子目录正式上传 1 次
    expect(putUrls.length).toBe(3)
  })

  it('子目录也写不进去 → 返回失败并带 HTTP 状态与目录', async () => {
    globalThis.fetch = vi.fn(async (_url: unknown, init: any) => {
      const headers = new Headers()
      if (init?.method === 'PUT') return { ok: false, status: 404, headers, text: async () => '<d:error><s:exception>ObjectNotFound</s:exception></d:error>' }
      if (init?.method === 'PROPFIND') return { ok: true, status: 207, headers, text: async () => PROPFIND_XML }
      return { ok: true, status: 200, headers, text: async () => '' }
    }) as any

    const r = await uploadToWebDav(cfg)
    expect(r.success).toBe(false)
    expect(r.error).toContain('HTTP 404')
  })
})

describe('checkDirWritable / probeCandidateDirs：逐个目录试写', () => {
  it('各目录可写性分别返回（可写目录会清理探针）', async () => {
    const deleted: string[] = []
    globalThis.fetch = vi.fn(async (url: unknown, init: any) => {
      const u = String(url)
      const headers = new Headers()
      if (init?.method === 'DELETE') {
        deleted.push(u)
        return { ok: true, status: 204, headers, text: async () => '' }
      }
      const okDir = u.includes(encodeURIComponent('我的坚果云'))
      return { ok: okDir, status: okDir ? 201 : 403, headers, text: async () => '' }
    }) as any

    const dirs = ['https://dav.jianguoyun.com/dav/我的坚果云/', 'https://dav.jianguoyun.com/dav/只读目录/']
    const probed = await probeCandidateDirs(cfg, dirs)
    expect(probed).toEqual([
      { dir: dirs[0], writable: true },
      { dir: dirs[1], writable: false },
    ])
    expect(deleted.some(u => u.includes(encodeURIComponent('我的坚果云')))).toBe(true)
    expect(deleted.some(u => u.includes(encodeURIComponent('只读目录')))).toBe(false)
  })

  it('checkDirWritable：请求抛错视为不可写（不抛异常）', async () => {
    globalThis.fetch = vi.fn(async () => { throw new TypeError('Failed to fetch') }) as any
    await expect(checkDirWritable(cfg, NUTSTORE_WEBDAV_URL)).resolves.toBe(false)
  })
})

describe('testWebDavConnection', () => {
  it('200 → 已有数据；404 → 连接正常但首次使用；401 → 凭据错误提示', async () => {
    mockFetchOnce(async () => ({ ok: true, status: 200 }))
    expect((await testWebDavConnection(cfg)).ok).toBe(true)

    mockFetchOnce(async () => ({ ok: false, status: 404 }))
    const notFound = await testWebDavConnection(cfg)
    expect(notFound.ok).toBe(true)
    expect(notFound.message).toContain('首次使用')

    mockFetchOnce(async () => ({ ok: false, status: 401 }))
    const authed = await testWebDavConnection(cfg)
    expect(authed.ok).toBe(false)
    expect(authed.message).toContain('应用密码')
  })

  it('网络异常（如浏览器跨域拦截）给出可读提示', async () => {
    mockFetchOnce(async () => { throw new TypeError('Failed to fetch') })
    const result = await testWebDavConnection(cfg)
    expect(result.ok).toBe(false)
    expect(result.message).toContain('跨域')
  })
})

describe('uploadToWebDav', () => {
  it('PUT 到固定路径，带 Basic 认证头，body 可用凭据密钥解码', async () => {
    let seenUrl = ''
    let seenInit: RequestInit | undefined
    mockFetchOnce(async (url: unknown, init: unknown) => {
      seenUrl = String(url)
      seenInit = init as RequestInit
      return { ok: true, status: 201 }
    })

    const result = await uploadToWebDav(cfg)
    expect(result.success).toBe(true)
    expect(seenUrl).toBe(`${NUTSTORE_WEBDAV_URL}slowlyRecord-sync.enc`)
    expect(seenInit?.method).toBe('PUT')
    expect(String((seenInit?.headers as Record<string, string>).Authorization)).toMatch(/^Basic /)

    const decoded = JSON.parse(decodeWebDavFile(String(seenInit?.body), key))
    expect(decoded.version).toBe(SYNC_VERSION)
    expect(decoded.wordBanks[0].name).toBe('测试词库')
  })

  it('备份内容为完整 SyncData 格式（快捷键/字母映射等四模块齐全）', async () => {
    let seenBody = ''
    mockFetchOnce(async (_url: unknown, init: unknown) => {
      seenBody = String((init as RequestInit).body)
      return { ok: true, status: 201 }
    })

    const result = await uploadToWebDav(cfg)
    expect(result.success).toBe(true)

    const decoded = JSON.parse(decodeWebDavFile(seenBody, key))
    // 完整格式标识：version + wordBanks 数组（区别于 MobileCompat 的 banks）
    expect(decoded.version).toBe(SYNC_VERSION)
    expect(Array.isArray(decoded.wordBanks)).toBe(true)
    // MobileCompat 缺失的四个模块都在
    expect(decoded.shortcutMemory).toEqual(fullSyncDataSample.shortcutMemory)
    expect(decoded.letterMemory).toEqual(fullSyncDataSample.letterMemory)
    expect(decoded).toHaveProperty('knowledgeMemory')
    expect(decoded).toHaveProperty('phoneticMemory')
    // 附带墓碑表
    expect(decoded.tombstones).toEqual({})
  })

  it('401 时返回应用密码错误提示', async () => {
    mockFetchOnce(async () => ({ ok: false, status: 401 }))
    const result = await uploadToWebDav(cfg)
    expect(result.success).toBe(false)
    expect(result.error).toContain('应用密码')
  })

  it('404/409 时提示检查 WebDAV 地址（PUT 会创建文件，4xx 是父目录不存在）', async () => {
    mockFetchOnce(async () => ({ ok: false, status: 404 }))
    const notFound = await uploadToWebDav(cfg)
    expect(notFound.success).toBe(false)
    expect(notFound.error).toContain('目录不存在')
    expect(notFound.error).not.toContain('首次使用')

    mockFetchOnce(async () => ({ ok: false, status: 409 }))
    const conflict = await uploadToWebDav(cfg)
    expect(conflict.success).toBe(false)
    expect(conflict.error).toContain('目录不存在')
  })
})

describe('downloadFromWebDav', () => {
  it('404 → 失败并提示先备份', async () => {
    mockFetchOnce(async () => ({ ok: false, status: 404 }))
    const result = await downloadFromWebDav(cfg)
    expect(result.success).toBe(false)
    expect(result.errors[0]).toContain('首次使用')
  })

  it('下载完整 SyncData 格式 → 直通 restoreSyncData（不经过转换）', async () => {
    const body = encodeWebDavFile(JSON.stringify(fullSyncDataSample), key)
    mockFetchOnce(async () => ({ ok: true, status: 200, text: async () => body }))

    const result = await downloadFromWebDav(cfg)
    expect(result.success).toBe(true)
    expect(restoreSyncDataMock).toHaveBeenCalledTimes(1)

    // 直通：restoreSyncData 收到的就是解析后的原对象（四模块数据原样保留）
    const syncData = restoreSyncDataMock.mock.calls[0][0] as any
    expect(syncData.version).toBe(SYNC_VERSION)
    expect(syncData.wordBanks[0].name).toBe('测试词库')
    expect(syncData.shortcutMemory).toEqual(fullSyncDataSample.shortcutMemory)
    expect(syncData.letterMemory).toEqual(fullSyncDataSample.letterMemory)
  })

  it('下载密文 → 解密 → 转 SyncData 后走合并还原', async () => {
    const mobileData = {
      version: 1,
      exportedAt: 456,
      platform: 'mobile',
      banks: [{
        id: 'b1',
        name: '测试词库',
        words: [{
          word: 'hello', meaning: '你好', addTime: 1, reviewCount: 0,
          nextReviewTime: 2, needsReview: false, remembered: false, level: 3, lastReviewTime: 1,
        }],
      }],
    }
    const body = encodeWebDavFile(JSON.stringify(mobileData), key)
    mockFetchOnce(async () => ({ ok: true, status: 200, text: async () => body }))

    const result = await downloadFromWebDav(cfg)
    expect(result.success).toBe(true)
    expect(restoreSyncDataMock).toHaveBeenCalledTimes(1)

    const syncData = restoreSyncDataMock.mock.calls[0][0] as any
    expect(syncData.wordBanks[0].name).toBe('测试词库')
    expect(syncData.wordBanks[0].words[0].text).toBe('hello')
    expect(syncData.wordBanks[0].words[0].level).toBe(3)
  })

  it('密文损坏时给出解密失败提示', async () => {
    mockFetchOnce(async () => ({ ok: true, status: 200, text: async () => 'not-valid-base64!!!' }))
    const result = await downloadFromWebDav(cfg)
    expect(result.success).toBe(false)
    expect(result.errors[0]).toContain('解密失败')
  })
})
