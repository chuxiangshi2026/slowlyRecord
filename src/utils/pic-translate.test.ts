/**
 * pic-translate.ts 单元测试
 *
 * 覆盖点：
 *  - 有道/百度/阿里/腾讯 四家 OCR 响应解析（以 testdata/ 真实接口样本为基准）
 *  - 各家签名/请求串构造（有道 v3 SHA256、百度 MD5、阿里 HMAC-SHA1、腾讯 TC3-HMAC-SHA256）
 *  - ocrTranslateMultiPlatform 的分支调度、每日次数限制、截图取消/环境错误
 *  - ocrTranslateLocal 本地 Tesseract 识别 + 缓存 Worker 复用 + 各错误分支
 *
 * 所有网络（axios/fetch）、uTools API、IndexedDB（fake-indexeddb）、Tesseract Worker 均为 mock。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import 'fake-indexeddb/auto'
import CryptoJS from 'crypto-js'

/* ---------------- testdata 真实接口样本 ---------------- */
const loadSample = (name: string): any =>
  JSON.parse(readFileSync(resolve(process.cwd(), 'testdata', name), 'utf-8'))
const youdaoSample = loadSample('picdata.json') // 有道 ocrtransapi 原始响应
const baiduSample = loadSample('baidupicdata.json') // 百度（归一化后形状）
const aliSample = loadSample('picalidata.json') // 阿里（归一化后形状）
const tencentSample = loadSample('picTencentdata.json') // 腾讯（归一化后形状）

/* ---------------- hoisted mock 状态 ---------------- */
const {
  axiosMock,
  fetchMock,
  tessMock,
  translateMock,
  dictMock,
  storeState,
  platformState,
  langState,
  dbStorage,
} = vi.hoisted(() => ({
  axiosMock: { post: vi.fn() },
  fetchMock: vi.fn(),
  tessMock: { createWorker: vi.fn() },
  translateMock: { translateWithPlatform: vi.fn() },
  dictMock: { translateWithLocalDictionaryAsync: vi.fn() },
  storeState: {
    ocrPlatform: 'baidu' as string,
    translationPlatform: 'local' as string,
    apiKeys: {} as Record<string, { appkey: string; key: string }>,
    ocrKeys: {} as Record<string, { appkey: string; key: string }>,
  },
  platformState: { isUtools: false },
  langState: { active: 'en' as string, ocrLang: 'eng' as string },
  dbStorage: new Map<string, any>(),
}))

vi.mock('axios', () => ({ default: axiosMock }))
vi.mock('element-plus', () => ({
  ElMessage: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}))
vi.mock('tesseract.js', () => ({ createWorker: tessMock.createWorker }))
vi.mock('@/stores/words.ts', () => ({
  useWordsStore: () => ({
    get currentOcrPlatform() { return storeState.ocrPlatform },
    get currentTranslationPlatform() { return storeState.translationPlatform },
    getApiKey: (p: string) => storeState.apiKeys[p] ?? { appkey: '', key: '' },
    getOcrApiKey: (p: string) => storeState.ocrKeys[p] ?? { appkey: 'test-ak', key: 'test-sk' },
  }),
}))
vi.mock('@/adapters/platform', () => ({ isUtools: () => platformState.isUtools }))
vi.mock('@/adapters/db', () => ({
  getDbStorage: () => ({
    getItem: (k: string) => (dbStorage.has(k) ? dbStorage.get(k) : null),
    setItem: (k: string, v: any) => { dbStorage.set(k, v) },
    removeItem: (k: string) => { dbStorage.delete(k) },
  }),
}))
vi.mock('@/utils/language', () => ({
  getActiveLanguage: () => langState.active,
  getActiveProfile: () => ({ ocrLang: langState.ocrLang }),
  getProfile: () => ({ ocrLang: langState.ocrLang }),
}))
vi.mock('@/utils/ocr-lang-pack', () => ({ ensureTrainedData: vi.fn() }))
vi.mock('@/utils/translation-api', () => ({
  translateWithPlatform: translateMock.translateWithPlatform,
}))
vi.mock('@/utils/local-dictionary', () => ({
  translateWithLocalDictionaryAsync: dictMock.translateWithLocalDictionaryAsync,
}))

/* ---------------- 被测模块（静态实例，Worker 缓存不污染的函数用） ---------------- */
import {
  ocrTranslate,
  ocrTranslateBaidu,
  ocrTranslateAli,
  ocrTranslateTencent,
  ocrTranslateMultiPlatform,
} from './pic-translate'
import { default as axios } from 'axios'

/* ---------------- 工具 ---------------- */
const HELLO_BASE64 = 'aGVsbG8=' // "hello"

/** 测试内复刻的 rfc3986 编码（与被测实现一致） */
function rfc3986(str: string): string {
  return encodeURIComponent(str)
    .replace(/!/g, '%21')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\*/g, '%2A')
}

/** 测试内复刻的「截断」逻辑（有道签名输入） */
function truncate(q: string): string {
  const len = q.length
  return len <= 20 ? q : q.slice(0, 10) + len + q.slice(-10)
}

/** 与源码相同的 md5(字节数组) 计算 */
function md5Bytes(bytes: Uint8Array): string {
  const words: number[] = []
  for (let i = 0; i < bytes.length; i += 4) {
    words.push(
      ((bytes[i] ?? 0) << 24) |
      ((bytes[i + 1] ?? 0) << 16) |
      ((bytes[i + 2] ?? 0) << 8) |
      ((bytes[i + 3] ?? 0))
    )
  }
  return CryptoJS.MD5(CryptoJS.lib.WordArray.create(words, bytes.length)).toString()
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

const sha256hex = (m: string) => CryptoJS.SHA256(m).toString(CryptoJS.enc.Hex)

/** localStorage mock（usage-counter 直接使用全局 localStorage） */
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v },
    removeItem: (k: string) => { delete store[k] },
    clear: () => { store = {} },
    dump: () => ({ ...store }),
  }
})()
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, configurable: true })

const todayStr = () => new Date().toISOString().split('T')[0]

/** 构造 uTools 窗口环境 */
function setupUtoolsWindow(screenCapture?: (cb: (img: string) => void) => void) {
  const utoolsApi = {
    hideMainWindow: vi.fn(),
    showMainWindow: vi.fn(),
    sendToParent: vi.fn(),
    getPath: vi.fn(() => '/tmp'),
    screenCapture: screenCapture ?? ((cb: any) => cb(`data:image/png;base64,${HELLO_BASE64}`)),
  }
  ;(globalThis as any).window = {
    utools: utoolsApi,
    location: { href: 'file:///C:/plugins/slowlyRecord.asar/index.html' },
  }
  return utoolsApi
}

/* =====================================================================
 * 有道 ocrTranslate
 * ===================================================================== */
describe('ocrTranslate（有道）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('成功时原样返回 picdata.json 样本（errorCode=0，11 个文本区域）', async () => {
    axiosMock.post.mockResolvedValue({ data: youdaoSample })

    const result = await ocrTranslate(HELLO_BASE64, 'appKey-x', 'secret-x')

    expect(result.errorCode).toBe('0')
    expect(result.resRegions).toHaveLength(11)
    expect(result.resRegions![0].context).toBe("if (action.code === 'over') {")
    expect(result.resRegions![0].tranContent).toBeTruthy()
    expect(result).toEqual(youdaoSample)
  })

  it('errorCode 非 0 时返回错误码与空 resRegions', async () => {
    axiosMock.post.mockResolvedValue({ data: { errorCode: '102', some: 'payload' } })

    const result = await ocrTranslate(HELLO_BASE64, 'appKey-x', 'secret-x')

    expect(result).toEqual({ errorCode: '102', resRegions: [] })
  })

  it('请求串构造：URL/headers/业务参数齐全', async () => {
    axiosMock.post.mockResolvedValue({ data: { errorCode: '0', resRegions: [] } })

    await ocrTranslate(HELLO_BASE64, 'appKey-x', 'secret-x')

    expect(axiosMock.post).toHaveBeenCalledTimes(1)
    const [url, body, config] = axiosMock.post.mock.calls[0]
    expect(url).toBe('https://openapi.youdao.com/ocrtransapi')
    expect(config.headers['Content-Type']).toBe('application/x-www-form-urlencoded')
    const params = body as URLSearchParams
    expect(params.get('appKey')).toBe('appKey-x')
    expect(params.get('q')).toBe(HELLO_BASE64)
    expect(params.get('type')).toBe('1') // 1=图片base64
    expect(params.get('signType')).toBe('v3')
    expect(params.get('from')).toBe('auto')
    expect(params.get('to')).toBe('zh-CHS')
    expect(params.get('salt')).toBeTruthy()
    expect(params.get('curtime')).toBeTruthy()
    expect(params.get('sign')).toMatch(/^[0-9a-f]{64}$/)
  })

  it('v3 签名 = SHA256(appKey + 截断(q) + salt + curtime + secret)，q>20 时截断', async () => {
    axiosMock.post.mockResolvedValue({ data: { errorCode: '0', resRegions: [] } })
    // 长度 110：截断后应为前 10 + "110" + 后 10
    const longImg = 'A'.repeat(5) + 'x'.repeat(100) + 'Z'.repeat(5)

    await ocrTranslate(longImg, 'appKey-x', 'secret-x')

    const params = axiosMock.post.mock.calls[0][1] as URLSearchParams
    const salt = params.get('salt')!
    const curtime = params.get('curtime')!
    const expected = CryptoJS.SHA256(`appKey-x${truncate(longImg)}${salt}${curtime}secret-x`).toString(CryptoJS.enc.Hex)
    expect(params.get('sign')).toBe(expected)
    // 截断确实生效：签名输入不是原始串
    const notExpected = CryptoJS.SHA256(`appKey-x${longImg}${salt}${curtime}secret-x`).toString(CryptoJS.enc.Hex)
    expect(params.get('sign')).not.toBe(notExpected)
  })

  it('q≤20 时不截断；非法 base64 仅打印日志仍发请求（记录当前行为）', async () => {
    axiosMock.post.mockResolvedValue({ data: { errorCode: '0', resRegions: [] } })

    await ocrTranslate(HELLO_BASE64, 'appKey-x', 'secret-x') // 长度 8 ≤ 20
    const params = axiosMock.post.mock.calls[0][1] as URLSearchParams
    const expected = CryptoJS.SHA256(
      `appKey-x${HELLO_BASE64}${params.get('salt')}${params.get('curtime')}secret-x`
    ).toString(CryptoJS.enc.Hex)
    expect(params.get('sign')).toBe(expected)

    await ocrTranslate('!!!not-base64!!!', 'appKey-x', 'secret-x') // 非法字符仅 console 打印
    expect(axiosMock.post).toHaveBeenCalledTimes(2)
  })
})

/* =====================================================================
 * 百度 ocrTranslateBaidu
 * ===================================================================== */
describe('ocrTranslateBaidu（百度）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /** 用归一化样本反构百度原始响应：rect/src/dst -> boundingBox/context/tranContent */
  function buildBaiduRaw(sample: any) {
    return {
      errno: 0,
      data: {
        from: 'en',
        to: 'zh',
        content: sample.resRegions.map((r: any) => ({
          rect: r.boundingBox,
          src: r.context,
          dst: r.tranContent,
          points: 'ignored-field', // 多余字段应被忽略
        })),
      },
    }
  }

  it('成功解析 baidupicdata.json 样本：rect/src/dst 映射为归一化结果', async () => {
    axiosMock.post.mockResolvedValue({ data: buildBaiduRaw(baiduSample) })

    const result = await ocrTranslateBaidu(HELLO_BASE64, 'ak-1', 'sk-1')

    expect(result).toEqual({ errorCode: '0', resRegions: baiduSample.resRegions })
  })

  it('签名串 = md5(apiKey + md5(图片字节) + salt + APICUID + mac + secretKey)', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1700000000000)
    axiosMock.post.mockResolvedValue({ data: buildBaiduRaw(baiduSample) })

    await ocrTranslateBaidu(HELLO_BASE64, 'ak-1', 'sk-1')

    const [url] = axiosMock.post.mock.calls[0]
    const u = new URL(url)
    expect(u.origin + u.pathname).toBe('https://fanyi-api.baidu.com/api/trans/sdk/picture')
    const query = u.searchParams
    expect(query.get('appid')).toBe('ak-1')
    expect(query.get('salt')).toBe('1700000000000')
    expect(query.get('cuid')).toBe('APICUID')
    expect(query.get('mac')).toBe('mac')
    expect(query.get('version')).toBe('3')
    expect(query.get('from')).toBe('ENG') // toEngineLang('baidu', 'en', 'ocr')
    expect(query.get('to')).toBe('zh')

    const imgMd5 = md5Bytes(base64ToBytes(HELLO_BASE64))
    const expectedSign = CryptoJS.MD5(`ak-1${imgMd5}1700000000000APICUIDmacsk-1`).toString()
    expect(query.get('sign')).toBe(expectedSign)
    // 确认识别的是图片字节而非 base64 字符串本身
    expect(query.get('sign')).not.toBe(
      CryptoJS.MD5(`ak-1${CryptoJS.MD5(HELLO_BASE64).toString()}1700000000000APICUIDmacsk-1`).toString()
    )
  })

  it('以 multipart/form-data 上传图片字节，文件名 image.png', async () => {
    axiosMock.post.mockResolvedValue({ data: buildBaiduRaw(baiduSample) })

    await ocrTranslateBaidu(HELLO_BASE64, 'ak-1', 'sk-1')

    const [, body, config] = axiosMock.post.mock.calls[0]
    expect(body).toBeInstanceOf(FormData)
    expect(config.timeout).toBe(15000)
    const image = (body as FormData).get('image')
    expect(image).toBeInstanceOf(Blob)
    expect(image).not.toBeNull()
  })

  it('返回结构缺少 data.content 时走错误分支（error_code 透传）', async () => {
    axiosMock.post.mockResolvedValue({ data: { error_code: 54003, error_msg: 'LIMIT' } })

    const result = await ocrTranslateBaidu(HELLO_BASE64, 'ak-1', 'sk-1')

    expect(result).toEqual({ errorCode: '54003', resRegions: [] })
  })

  it('鉴权失败（52003/UNAUTHORIZED）映射为 BAIDU_AUTH_FAILED', async () => {
    axiosMock.post.mockResolvedValue({
      data: { error_code: '52003', error_msg: 'UNAUTHORIZED USER' },
    })

    const result = await ocrTranslateBaidu(HELLO_BASE64, 'ak-1', 'sk-1')

    expect(result).toEqual({ errorCode: 'BAIDU_AUTH_FAILED', resRegions: [] })
  })

  it('无 error_code 的错误响应兜底为 500', async () => {
    axiosMock.post.mockResolvedValue({ data: { error_msg: 'weird' } })

    const result = await ocrTranslateBaidu(HELLO_BASE64, 'ak-1', 'sk-1')

    expect(result).toEqual({ errorCode: '500', resRegions: [] })
  })
})

/* =====================================================================
 * 阿里 ocrTranslateAli
 * ===================================================================== */
describe('ocrTranslateAli（阿里）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', fetchMock)
  })

  /** 用归一化样本反构阿里 TemplateJson 元素 */
  function buildAliTemplateJson(sample: any, extraChildren: any[] = []): string {
    const children = [
      ...sample.resRegions.map((r: any) => {
        const [left, top, width, height] = r.boundingBox.split(',').map(Number)
        return { label: 'element', type: 'text', left, top, width, height, ocrContent: r.context, content: r.tranContent }
      }),
      ...extraChildren,
    ]
    return JSON.stringify({ children })
  }

  function mockAliJson(json: any) {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(json), { status: 200 }))
  }

  it('成功解析 picalidata.json 样本：element+text 过滤与坐标拼接', async () => {
    mockAliJson({
      Code: '200',
      Data: {
        TemplateJson: buildAliTemplateJson(aliSample, [
          { label: 'element', type: 'image' }, // type 非 text，应被过滤
          { label: 'block', type: 'text' }, // label 非 element，应被过滤
        ]),
      },
    })

    const result = await ocrTranslateAli(HELLO_BASE64, 'ak-id', 'ak-secret')

    expect(result.errorCode).toBe('200')
    expect(result.resRegions).toEqual(aliSample.resRegions)
    expect(result.resRegions).toHaveLength(4)
  })

  it('元素缺省坐标/文本时回退 0 与空串', async () => {
    mockAliJson({
      Code: '200',
      Data: { TemplateJson: JSON.stringify({ children: [{ label: 'element', type: 'text' }] }) },
    })

    const result = await ocrTranslateAli(HELLO_BASE64, 'ak-id', 'ak-secret')

    expect(result.resRegions).toEqual([{ boundingBox: '0,0,0,0', context: '', tranContent: '' }])
  })

  it('Data 无 TemplateJson 时返回空区域数组', async () => {
    mockAliJson({ Code: '200', Data: { SomethingElse: 1 } })

    const result = await ocrTranslateAli(HELLO_BASE64, 'ak-id', 'ak-secret')

    expect(result).toEqual({ errorCode: '200', resRegions: [] })
  })

  it('TemplateJson 非法 JSON 时不崩溃，返回空区域数组', async () => {
    mockAliJson({ Code: '200', Data: { TemplateJson: '{not-valid-json' } })

    const result = await ocrTranslateAli(HELLO_BASE64, 'ak-id', 'ak-secret')

    expect(result).toEqual({ errorCode: '200', resRegions: [] })
  })

  it('Code 非 200 / 缺失时的错误分支', async () => {
    mockAliJson({ Code: '500', Message: 'Internal' })
    let result = await ocrTranslateAli(HELLO_BASE64, 'ak-id', 'ak-secret')
    expect(result).toEqual({ errorCode: '500', resRegions: [] })

    mockAliJson({ RequestId: 'x' }) // 无 Code
    result = await ocrTranslateAli(HELLO_BASE64, 'ak-id', 'ak-secret')
    expect(result).toEqual({ errorCode: 'UnknownError', resRegions: [] })
  })

  it('签名管道：body 为排序 canonicalQueryString + HMAC-SHA1(secret&) 签名', async () => {
    mockAliJson({ Code: '200', Data: {} })

    await ocrTranslateAli(HELLO_BASE64, 'ak-id', 'ak-secret')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe('https://mt.cn-hangzhou.aliyuncs.com/')
    expect(opts.method).toBe('POST')

    const body: string = opts.body
    const parsed = new URLSearchParams(body)
    // 业务参数齐全
    expect(parsed.get('AccessKeyId')).toBe('ak-id')
    expect(parsed.get('Action')).toBe('TranslateImage')
    expect(parsed.get('ImageBase64')).toBe(HELLO_BASE64)
    expect(parsed.get('SourceLanguage')).toBe('auto')
    expect(parsed.get('TargetLanguage')).toBe('zh')
    expect(parsed.get('SignatureMethod')).toBe('HMAC-SHA1')
    expect(parsed.get('SignatureNonce')).toBeTruthy()
    expect(parsed.get('Timestamp')).toBeTruthy()

    // 重算 canonicalQueryString（排序 + rfc3986 编码）应与 body 前缀一致
    const entries = [...parsed.entries()].filter(([k]) => k !== 'Signature')
    const canonical = entries
      .map(([k, v]) => [k, v] as const)
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([k, v]) => `${rfc3986(k)}=${rfc3986(v)}`)
      .join('&')
    expect(body).toBe(`${canonical}&Signature=${rfc3986(parsed.get('Signature')!)}`)

    // 重算签名：HmacSHA1("POST&%2F&" + enc(canonical), secret + "&")
    const stringToSign = `POST&${rfc3986('/')}&${rfc3986(canonical)}`
    const expectedSig = CryptoJS.HmacSHA1(
      CryptoJS.enc.Utf8.parse(stringToSign),
      CryptoJS.enc.Utf8.parse('ak-secret&')
    ).toString(CryptoJS.enc.Base64)
    expect(parsed.get('Signature')).toBe(expectedSig)
  })
})

/* =====================================================================
 * 腾讯 ocrTranslateTencent
 * ===================================================================== */
describe('ocrTranslateTencent（腾讯）', () => {
  const FIXED_TS = 1700000000 // 2023-11-14T22:13:20.000Z

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  /** 用归一化样本反构腾讯 ImageRecord.Value */
  function buildTencentRaw(sample: any) {
    return {
      Response: {
        ImageRecord: {
          Value: sample.resRegions.map((r: any) => {
            const [X, Y, W, H] = r.boundingBox.split(',').map(Number)
            return { X, Y, W, H, SourceText: r.context, TargetText: r.tranContent }
          }),
        },
        RequestId: 'req-1',
      },
    }
  }

  function mockTencentJson(json: any) {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(json), { status: 200 }))
  }

  it('成功解析 picTencentdata.json 样本：X/Y/W/H 拼接坐标', async () => {
    mockTencentJson(buildTencentRaw(tencentSample))

    const result = await ocrTranslateTencent(HELLO_BASE64, 'secret-id', 'secret-key')

    expect(result).toEqual({ errorCode: '0', resRegions: tencentSample.resRegions })
    expect(result.resRegions).toHaveLength(6)
  })

  it('ImageRecord.Value 缺失时返回 errorCode=0 与空数组', async () => {
    mockTencentJson({ Response: { ImageRecord: {} } })

    const result = await ocrTranslateTencent(HELLO_BASE64, 'secret-id', 'secret-key')

    expect(result).toEqual({ errorCode: '0', resRegions: [] })
  })

  it('Response.Error 分支透传错误码', async () => {
    mockTencentJson({ Response: { Error: { Code: 'AuthFailure', Message: 'bad' } } })

    const result = await ocrTranslateTencent(HELLO_BASE64, 'secret-id', 'secret-key')

    expect(result).toEqual({ errorCode: 'AuthFailure', resRegions: [] })
  })

  it('无 Response 结构时兜底 500', async () => {
    mockTencentJson({})

    const result = await ocrTranslateTencent(HELLO_BASE64, 'secret-id', 'secret-key')

    expect(result).toEqual({ errorCode: '500', resRegions: [] })
  })

  it('TC3 签名全链路：Authorization 与规范请求串可确定性重算', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(FIXED_TS * 1000)
    mockTencentJson(buildTencentRaw(tencentSample))

    await ocrTranslateTencent(HELLO_BASE64, 'secret-id', 'secret-key')

    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe('https://tmt.tencentcloudapi.com')
    expect(opts.method).toBe('POST')

    const headers = opts.headers
    expect(headers['X-TC-Action']).toBe('ImageTranslate')
    expect(headers['X-TC-Version']).toBe('2018-03-21')
    expect(headers['X-TC-Region']).toBe('ap-beijing')
    expect(headers['X-TC-Timestamp']).toBe(FIXED_TS.toString())

    // 请求体业务参数
    const payload = JSON.parse(opts.body)
    expect(payload).toEqual({
      SessionUuid: (FIXED_TS * 1000).toString(),
      Scene: 'doc',
      Data: HELLO_BASE64,
      Source: 'auto',
      Target: 'zh',
      ProjectId: 0,
    })

    // 按官方算法重算 TC3-HMAC-SHA256
    const host = 'tmt.tencentcloudapi.com'
    const canonicalHeaders = `content-type:application/json; charset=utf-8\nhost:${host}\nx-tc-action:imagetranslate\n`
    const hashedPayload = sha256hex(opts.body)
    const canonicalRequest = ['POST', '/', '', canonicalHeaders, 'content-type;host;x-tc-action', hashedPayload].join('\n')
    const date = new Date(FIXED_TS * 1000).toISOString().slice(0, 10)
    const credentialScope = `${date}/tmt/tc3_request`
    const stringToSign = ['TC3-HMAC-SHA256', FIXED_TS.toString(), credentialScope, sha256hex(canonicalRequest)].join('\n')
    const secretDate = CryptoJS.HmacSHA256(date, `TC3secret-key`)
    const secretService = CryptoJS.HmacSHA256('tmt', secretDate)
    const secretSigning = CryptoJS.HmacSHA256('tc3_request', secretService)
    const signature = CryptoJS.HmacSHA256(stringToSign, secretSigning).toString(CryptoJS.enc.Hex)
    const expectedAuth =
      `TC3-HMAC-SHA256 Credential=secret-id/${credentialScope}, SignedHeaders=content-type;host;x-tc-action, Signature=${signature}`
    expect(headers['Authorization']).toBe(expectedAuth)
  })
})

/* =====================================================================
 * ocrTranslateMultiPlatform 调度 / 限次 / 环境分支
 * ===================================================================== */
describe('ocrTranslateMultiPlatform（多平台调度）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()
    dbStorage.clear()
    storeState.ocrPlatform = 'baidu'
    storeState.translationPlatform = 'local'
    storeState.apiKeys = {}
    storeState.ocrKeys = {}
    langState.active = 'en'
    platformState.isUtools = true
    vi.stubGlobal('fetch', fetchMock)
    setupUtoolsWindow()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('百度免费额度用尽时抛「每日上限」错误且不增加计数', async () => {
    localStorageMock.setItem('usage_ocr_counter', JSON.stringify({ date: todayStr(), count: 5 })) // OCR_DAILY_LIMIT=5

    await expect(ocrTranslateMultiPlatform()).rejects.toThrow(/每日免费截图翻译次数已达上限 \(5\/5 次\)/)
    expect(JSON.parse(localStorageMock.getItem('usage_ocr_counter')!).count).toBe(5)
  })

  it('腾讯使用独立计数器 tencent_ocr，超限文案含「腾讯」', async () => {
    storeState.ocrPlatform = 'tencent'
    localStorageMock.setItem('usage_tencent_ocr_counter', JSON.stringify({ date: todayStr(), count: 10 })) // TENCENT_OCR_DAILY_LIMIT=10
    localStorageMock.setItem('usage_ocr_counter', JSON.stringify({ date: todayStr(), count: 0 }))

    await expect(ocrTranslateMultiPlatform()).rejects.toThrow(/每日免费腾讯截图翻译次数已达上限 \(10\/10 次\)/)
  })

  it('设置自定义 API 密钥后跳过限次检查并正常调用', async () => {
    storeState.apiKeys.baidu = { appkey: 'my-ak', key: 'my-sk' }
    localStorageMock.setItem('usage_ocr_counter', JSON.stringify({ date: todayStr(), count: 5 }))
    axiosMock.post.mockResolvedValue({
      data: {
        data: { content: [{ rect: '0 0 1 1', src: 'hello', dst: '你好' }] },
      },
    })

    const result = await ocrTranslateMultiPlatform()

    expect(result.errorCode).toBe('0')
    expect(result.resRegions).toEqual([{ boundingBox: '0 0 1 1', context: 'hello', tranContent: '你好' }])
    // 限次被跳过：计数保持种子值 5，未增加
    expect(JSON.parse(localStorageMock.getItem('usage_ocr_counter')!).count).toBe(5)
  })

  it('local 平台不记次数：ocr 计数打满仍走到截图流程', async () => {
    storeState.ocrPlatform = 'local'
    localStorageMock.setItem('usage_ocr_counter', JSON.stringify({ date: todayStr(), count: 99 }))
    setupUtoolsWindow((cb) => cb('')) // 用户取消截图

    await expect(ocrTranslateMultiPlatform()).rejects.toThrow('截图取消')
    expect(localStorageMock.getItem('usage_ocr_counter')).not.toBeNull()
    expect(JSON.parse(localStorageMock.getItem('usage_ocr_counter')!).count).toBe(99) // 未增加
  })

  it('用户取消截图时 reject「截图取消」，但计数已在截图前增加（记录当前行为）', async () => {
    setupUtoolsWindow((cb) => cb(''))

    await expect(ocrTranslateMultiPlatform()).rejects.toThrow('截图取消')
    expect(JSON.parse(localStorageMock.getItem('usage_ocr_counter')!).count).toBe(1)
  })

  it('非 uTools 环境 reject「截图功能仅在 uTools 环境中可用」', async () => {
    platformState.isUtools = false

    await expect(ocrTranslateMultiPlatform()).rejects.toThrow('截图功能仅在 uTools 环境中可用')
  })

  it('youdao 分支：走 axios 并原样返回响应', async () => {
    storeState.ocrPlatform = 'youdao'
    axiosMock.post.mockResolvedValue({ data: youdaoSample })

    const result = await ocrTranslateMultiPlatform()

    expect(result).toEqual(youdaoSample)
    expect(axiosMock.post).toHaveBeenCalledTimes(1)
  })

  it('有道不支持当前语言时 reject', async () => {
    storeState.ocrPlatform = 'youdao'
    langState.active = 'zh' // OCR_MAPS.youdao 无 zh -> null

    await expect(ocrTranslateMultiPlatform()).rejects.toThrow('有道OCR不支持当前语言')
  })

  it('tencent 分支：fetch 成功解析', async () => {
    storeState.ocrPlatform = 'tencent'
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          Response: { ImageRecord: { Value: [{ X: 1, Y: 2, W: 3, H: 4, SourceText: 'a', TargetText: 'b' }] } },
        }),
        { status: 200 }
      )
    )

    const result = await ocrTranslateMultiPlatform()

    expect(result).toEqual({ errorCode: '0', resRegions: [{ boundingBox: '1,2,3,4', context: 'a', tranContent: 'b' }] })
  })

  it('deepseek 分支：视觉模型提取文本 + 大模型翻译', async () => {
    storeState.ocrPlatform = 'deepseek'
    storeState.apiKeys.deepseek = { appkey: 'sk-test', key: '' } // 模型名回退默认 deepseek-v4-flash
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: '识别出的文本' } }] }), { status: 200 })
    )
    translateMock.translateWithPlatform.mockResolvedValue({ explains: '译文内容' })

    const result = await ocrTranslateMultiPlatform()

    expect(result.errorCode).toBe('0')
    expect(result.resRegions).toEqual([{ boundingBox: '0,0,0,0', context: '识别出的文本', tranContent: '译文内容' }])
    // 视觉请求校验
    const [visionUrl, visionOpts] = fetchMock.mock.calls[0]
    expect(visionUrl).toBe('https://api.deepseek.com/v1/chat/completions')
    const visionBody = JSON.parse(visionOpts.body)
    expect(visionBody.model).toBe('deepseek-v4-flash')
    expect(visionBody.messages[1].content[1].image_url.url).toBe(`data:image/jpeg;base64,${HELLO_BASE64}`)
    // 翻译走 translation-api 且语言为当前激活语言
    expect(translateMock.translateWithPlatform).toHaveBeenCalledWith('识别出的文本', 'local', 'en')
  })

  it('deepseek 分支：翻译失败时回退显示原文', async () => {
    storeState.ocrPlatform = 'deepseek'
    storeState.apiKeys.deepseek = { appkey: 'sk-test', key: '' }
    storeState.translationPlatform = 'youdao'
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: '识别出的文本' } }] }), { status: 200 })
    )
    translateMock.translateWithPlatform.mockRejectedValue(new Error('翻译服务不可用'))

    const result = await ocrTranslateMultiPlatform()

    expect(result.resRegions![0].tranContent).toBe('识别出的文本')
  })

  it('未知平台返回 errorCode=500', async () => {
    storeState.ocrPlatform = 'not-a-platform'

    const result = await ocrTranslateMultiPlatform()

    expect(result).toEqual({ errorCode: '500', resRegions: [] })
  })
})

/* =====================================================================
 * ocrTranslateLocal（本地 Tesseract OCR）
 * ===================================================================== */
describe('ocrTranslateLocal（本地 OCR）', () => {
  let recognizeMock: ReturnType<typeof vi.fn>

  async function loadModule() {
    return await import('./pic-translate')
  }

  /** 组装一个假的 Tesseract Worker */
  function makeFakeWorker() {
    recognizeMock = vi.fn().mockResolvedValue({ data: { text: ' hello world ' } })
    return {
      recognize: recognizeMock,
      reinitialize: vi.fn().mockResolvedValue(undefined),
      terminate: vi.fn(),
    }
  }

  beforeEach(async () => {
    vi.resetModules() // 模块级 Worker 缓存需要隔离
    vi.clearAllMocks()
    localStorageMock.clear()
    dbStorage.clear()
    langState.ocrLang = 'eng'
    platformState.isUtools = false
    tessMock.createWorker.mockResolvedValue(makeFakeWorker())
    // readLocalFile 回退到 fetch：每次调用返回独立的假脚本内容（Response body 只能读一次）
    fetchMock.mockImplementation(() => Promise.resolve(new Response('fake-script-content')))
    vi.stubGlobal('fetch', fetchMock)
    dictMock.translateWithLocalDictionaryAsync.mockResolvedValue({ success: true, explains: '你好，世界' })
  })

  it('识别成功 + 本地词典翻译：单区域整体返回', async () => {
    const { ocrTranslateLocal } = await loadModule()

    const result = await ocrTranslateLocal(HELLO_BASE64, 'local')

    expect(result).toEqual({
      errorCode: '0',
      resRegions: [{ boundingBox: '0,0,0,0', context: 'hello world', tranContent: '你好，世界' }],
    })
    expect(recognizeMock).toHaveBeenCalledWith(`data:image/png;base64,${HELLO_BASE64}`)
    // worker 以内联 data URL 方式创建并 reinitialize
    expect(tessMock.createWorker).toHaveBeenCalledTimes(1)
    const workerUrl = tessMock.createWorker.mock.calls[0][2].workerPath
    expect(workerUrl).toMatch(/^data:application\/javascript;base64,/)
    expect(result.resRegions![0].tranContent).toBe('你好，世界')
  })

  it('缓存 Worker 复用：连续两次识别只创建一次 Worker', async () => {
    const { ocrTranslateLocal } = await loadModule()

    await ocrTranslateLocal(HELLO_BASE64, 'local')
    await ocrTranslateLocal(HELLO_BASE64, 'local')

    expect(tessMock.createWorker).toHaveBeenCalledTimes(1)
    expect(recognizeMock).toHaveBeenCalledTimes(2)
  })

  it('preloadWorker 预热后，正式识别直接复用缓存', async () => {
    const mod = await loadModule()
    mod.preloadWorker()
    await vi.waitFor(() => expect(tessMock.createWorker).toHaveBeenCalledTimes(1))

    await mod.ocrTranslateLocal(HELLO_BASE64, 'local')

    expect(tessMock.createWorker).toHaveBeenCalledTimes(1)
    expect(recognizeMock).toHaveBeenCalledTimes(1)
  })

  it('识别抛错时返回 LOCAL_OCR_RECOGNIZE_FAILED 并重置缓存（下次重建 Worker）', async () => {
    const { ocrTranslateLocal } = await loadModule()

    recognizeMock.mockRejectedValueOnce(new Error('boom'))
    const failed = await ocrTranslateLocal(HELLO_BASE64, 'local')
    expect(failed.errorCode).toBe('LOCAL_OCR_RECOGNIZE_FAILED')
    expect(failed.errorMessage).toContain('boom')
    expect(failed.resRegions).toEqual([])

    // 缓存已重置，再次调用会重新创建 Worker
    const ok = await ocrTranslateLocal(HELLO_BASE64, 'local')
    expect(ok.errorCode).toBe('0')
    expect(tessMock.createWorker).toHaveBeenCalledTimes(2)
  })

  it('识别结果无文本时返回 LOCAL_OCR_NO_TEXT', async () => {
    const { ocrTranslateLocal } = await loadModule()
    recognizeMock.mockResolvedValue({ data: { text: '   ' } })

    const result = await ocrTranslateLocal(HELLO_BASE64, 'local')

    expect(result).toEqual({ errorCode: 'LOCAL_OCR_NO_TEXT', resRegions: [] })
  })

  it('平台翻译失败时回退显示原文', async () => {
    const { ocrTranslateLocal } = await loadModule()
    translateMock.translateWithPlatform.mockRejectedValue(new Error('net down'))

    const result = await ocrTranslateLocal(HELLO_BASE64, 'youdao')

    expect(result.errorCode).toBe('0')
    expect(result.resRegions![0].tranContent).toBe('hello world')
    expect(translateMock.translateWithPlatform).toHaveBeenCalledWith('hello world', 'youdao', 'en')
  })

  // 注意：此用例验证 Worker 创建失败兜底；当前实现失败后模块内 cachedWorkerPromise
  // 会停留在 rejected 状态（后续调用将一直失败）——已知行为，放最后避免影响其他用例。
  it('Worker 创建失败时返回 LOCAL_OCR_FAILED', async () => {
    const { ocrTranslateLocal } = await loadModule()
    tessMock.createWorker.mockRejectedValue(new Error('cannot create worker'))

    const result = await ocrTranslateLocal(HELLO_BASE64, 'local')

    expect(result.errorCode).toBe('LOCAL_OCR_FAILED')
    expect(result.errorMessage).toContain('cannot create worker')
    expect(result.resRegions).toEqual([])
  })
})
