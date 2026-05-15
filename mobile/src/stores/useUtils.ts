/**
 * 移动端工具模块 - 统一入口
 * 合并所有工具到单文件，避免微信小程序模块注册问题
 */

// ==================== 翻译 API ====================
// 与桌面端保持一致：离线词典 + 国内API（有道/百度），去除 Google/ollama/utoolsAI

export interface TranslationResult {
  success: boolean
  explains: string
  /** 兼容旧代码 */
  translatedText: string
  phonetic?: string
  pronunciation?: string
  errorMsg?: string
  platform: string
}

let currentPlatform: 'youdao' | 'baidu' | 'local' = 'baidu'

export function setTranslationPlatform(platform: 'youdao' | 'baidu' | 'local') {
  currentPlatform = platform
}

export function getTranslationPlatform() {
  return currentPlatform
}

// ---- MD5 辅助函数（纯JS实现，用于国内API签名）----
function md5(input: string): string {
  const K = [0xd76aa478,0xe8c7b756,0x242070db,0xc1bdceee,0xf57c0faf,0x4787c62a,0xa8304613,0xfd469501,
    0x698098d8,0x8b44f7af,0xffff5bb1,0x895cd7be,0x6b901122,0xfd987193,0xa679438e,0x49b40821,
    0xf61e2562,0xc040b340,0x265e5a51,0xe9b6c7aa,0xd62f105d,0x02441453,0xd8a1e681,0xe7d3fbc8,
    0x21e1cde6,0xc33707d6,0xf4d50d87,0x455a14ed,0xa9e3e905,0xfcefa3f8,0x676f02d9,0x8d2a4c8a,
    0xfffa3942,0x8771f681,0x6d9d6122,0xfde5380c,0xa4beea44,0x4bdecfa9,0xf6bb4b60,0xbebfbc70,
    0x289b7ec6,0xeaa127fa,0xd4ef3085,0x04881d05,0xd9d4d039,0xe6db99e5,0x1fa27cf8,0xc4ac5665,
    0xf4292244,0x432aff97,0xab9423a7,0xfc93a039,0x655b59c3,0x8f0ccc92,0xffeff47d,0x85845dd1,
    0x6fa87e4f,0xfe2ce6e0,0xa3014314,0x4e0811a1,0xf7537e82,0xbd3af235,0x2ad7d2bb,0xeb86d391]
  const S = [7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,
    4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21]
  const hex = '0123456789abcdef'
  const bytes: number[] = []
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i)
    if (c < 0x80) bytes.push(c)
    else if (c < 0x800) bytes.push(0xc0|(c>>6),0x80|(c&0x3f))
    else if (c < 0xd800 || c > 0xdbff) bytes.push(0xe0|(c>>12),0x80|((c>>6)&0x3f),0x80|(c&0x3f))
    else { const c2=input.charCodeAt(++i); const cp=((c&0x3ff)<<10)|(c2&0x3ff); bytes.push(0xf0|(cp>>18),0x80|((cp>>12)&0x3f),0x80|((cp>>6)&0x3f),0x80|(cp&0x3f)) }
  }
  const origLen = bytes.length * 8
  bytes.push(0x80)
  while ((bytes.length % 64) !== 56) bytes.push(0)
  for (let i = 0; i < 8; i++) bytes.push((origLen >>> (i * 8)) & 0xff)
  let a=0x67452301,b=0xefcdab89,c=0x98badcfe,d=0x10325476
  for (let i=0;i<bytes.length;i+=64) {
    const w:number[]=[]
    for (let j=0;j<64;j+=4) w.push(bytes[i+j]|(bytes[i+j+1]<<8)|(bytes[i+j+2]<<16)|(bytes[i+j+3]<<24))
    let A=a,B=b,C=c,D=d
    for (let j=0;j<64;j++) {
      let f:number,g:number
      if (j<16){f=(B&C)|(~B&D);g=j}
      else if (j<32){f=(D&B)|(~D&C);g=(5*j+1)%16}
      else if (j<48){f=B^C^D;g=(3*j+5)%16}
      else {f=C^(B|~D);g=(7*j)%16}
      const x=((A+f+K[j]+w[g])|0)
      const tmp=D
      D=C;C=B;B=(B+((x<<S[j])|(x>>>(32-S[j]))))|0;A=tmp
    }
    a=(a+A)|0;b=(b+B)|0;c=(c+C)|0;d=(d+D)|0
  }
  let hash=''
  for (const n of [a,b,c,d]) for (let i=0;i<4;i++) { const v=(n>>>(i*8))&0xff; hash+=hex[v>>>4]+hex[v&0xf] }
  return hash
}

/**
 * 翻译文本
 * 策略：1. 离线词典 2. 有道/百度国内API
 */
export async function translateText(
  text: string,
  from: string = 'auto',
  to: string = 'zh'
): Promise<TranslationResult> {
  const trimmed = text.trim().toLowerCase()
  if (!trimmed) {
    return { success: false, explains: '', translatedText: '', errorMsg: '请输入要翻译的文本', platform: 'local' }
  }

  // 1. 先查离线词典（单个单词）
  if (!trimmed.includes(' ')) {
    const offline = queryOfflineDict(trimmed)
    if (offline) {
      return {
        success: true,
        explains: offline,
        translatedText: offline,
        pronunciation: getPronunciationUrl(trimmed),
        platform: 'local'
      }
    }
  }

  // 2. 使用国内API翻译
  try {
    switch (currentPlatform) {
      case 'youdao':
        return await translateWithYoudao(text, from, to)
      case 'baidu':
        return await translateWithBaidu(text, from, to)
      default:
        return await translateWithYoudao(text, from, to)
    }
  } catch (e) {
    return {
      success: false,
      explains: text,
      translatedText: text,
      errorMsg: '翻译服务暂不可用，显示原文',
      platform: 'fallback'
    }
  }
}

/** 有道翻译（v2 MD5签名） */
async function translateWithYoudao(
  text: string,
  from: string = 'auto',
  to: string = 'zh'
): Promise<TranslationResult> {
  const appKey = 'REDACTED_YOUDAO_APPKEY'
  const appSecret = 'REDACTED_YOUDAO_SECRET'
  const salt = '' + Date.now()
  const sign = md5(appKey + text + salt + appSecret)

  return new Promise((resolve) => {
    uni.request({
      url: 'https://openapi.youdao.com/api',
      method: 'GET',
      data: { q: text, appKey, salt, from: from === 'auto' ? 'auto' : from, to, sign },
      success: (res) => {
        const data = res.data as any
        if (data.errorCode === '0') {
          const explains = data.translation?.[0] || text
          resolve({
            success: true,
            explains,
            translatedText: explains,
            phonetic: data.basic?.phonetic || '',
            pronunciation: `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&type=1`,
            platform: 'youdao'
          })
        } else {
          resolve({
            success: false,
            explains: text,
            translatedText: text,
            errorMsg: `有道翻译错误: ${data.errorCode}`,
            platform: 'youdao'
          })
        }
      },
      fail: () => {
        resolve({
          success: false, explains: text, translatedText: text,
          errorMsg: '有道翻译请求失败', platform: 'youdao'
        })
      }
    })
  })
}

/** 百度翻译（MD5签名） */
async function translateWithBaidu(
  text: string,
  from: string = 'auto',
  to: string = 'zh'
): Promise<TranslationResult> {
  const appid = 'REDACTED_BAIDU_APPKEY'
  const secretKey = 'REDACTED_BAIDU_SECRET'
  const salt = '' + Date.now()
  const sign = md5(appid + text + salt + secretKey)

  return new Promise((resolve) => {
    uni.request({
      url: 'https://fanyi-api.baidu.com/api/trans/vip/translate',
      method: 'GET',
      data: { q: text, from: from === 'auto' ? 'auto' : from, to, appid, salt, sign },
      success: (res) => {
        const data = res.data as any
        if (!data.error_code || data.error_code === '52000') {
          const explains = data.trans_result?.[0]?.dst || text
          resolve({
            success: true, explains, translatedText: explains,
            pronunciation: `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&type=1`,
            platform: 'baidu'
          })
        } else {
          resolve({
            success: false, explains: text, translatedText: text,
            errorMsg: `百度翻译错误: ${data.error_code}`, platform: 'baidu'
          })
        }
      },
      fail: () => {
        resolve({
          success: false, explains: text, translatedText: text,
          errorMsg: '百度翻译请求失败', platform: 'baidu'
        })
      }
    })
  })
}

/**
 * 批量翻译
 */
export async function batchTranslate(
  texts: string[],
  from: string = 'auto',
  to: string = 'zh'
): Promise<string[]> {
  const results: string[] = []
  for (const text of texts) {
    try {
      const result = await translateText(text, from, to)
      results.push(result.explains || text)
    } catch {
      results.push(text)
    }
  }
  return results
}

/**
 * 获取发音 URL
 */
export function getPronunciationUrl(word: string, lang: 'en' | 'us' = 'us'): string {
  const type = lang === 'us' ? '1' : '2'
  return `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=${type}`
}

/**
 * 播放发音
 */
export function playPronunciation(word: string, lang: 'en' | 'us' = 'us'): void {
  const url = getPronunciationUrl(word, lang)
  const audio = uni.createInnerAudioContext()
  audio.src = url
  audio.play()
}

// ==================== 离线词典 ====================

const OFFLINE_DICT: Record<string, string> = {
  hello: '你好；问候',
  world: '世界；领域',
  apple: '苹果',
  book: '书；预订',
  car: '汽车',
  dog: '狗',
  eat: '吃',
  fish: '鱼；钓鱼',
  good: '好的；善良的',
  hand: '手；交给',
  ice: '冰',
  job: '工作',
  king: '国王',
  love: '爱；热爱',
  milk: '牛奶',
  name: '名字；命名',
  open: '打开；开放的',
  pen: '钢笔',
  question: '问题；质疑',
  run: '跑；经营',
  sun: '太阳',
  time: '时间；时代',
  up: '向上；起来',
  very: '非常；很',
  water: '水；浇水',
  yellow: '黄色；黄色的',
  zoo: '动物园',
  the: '这；那（定冠词）',
  a: '一（个）',
  an: '一（个，用于元音前）',
  is: '是',
  are: '是（复数）',
  am: '是（第一人称）',
  was: '是（过去式）',
  were: '是（过去复数）',
  be: '是；存在',
  been: '是（过去分词）',
  being: '是（现在分词）',
  have: '有；吃',
  has: '有（第三人称）',
  had: '有（过去式）',
  do: '做；助动词',
  does: '做（第三人称）',
  did: '做（过去式）',
  will: '将；愿意',
  would: '将（过去式）；愿意',
  shall: '将（用于第一人称）',
  should: '应该',
  may: '可能；可以',
  might: '可能（过去式）',
  can: '能；可以',
  could: '能（过去式）',
  must: '必须',
  need: '需要',
  dare: '敢',
  ought: '应该',
  used: '过去常常',
  about: '关于；大约',
  above: '在...上方',
  across: '穿过；在对面',
  after: '在...之后',
  against: '反对；靠着',
  along: '沿着',
  among: '在...之中',
  around: '围绕；大约',
  at: '在（地点/时间）',
  before: '在...之前',
  behind: '在...后面',
  below: '在...下方',
  beneath: '在...下面',
  beside: '在...旁边',
  besides: '除...之外还',
  between: '在...之间',
  beyond: '超过；在...那边',
  but: '但是；除了',
  by: '通过；在...旁边',
  down: '向下；沿着',
  during: '在...期间',
  except: '除了',
  for: '为了；因为',
  from: '从；来自',
  in: '在...里面',
  inside: '在...内部',
  into: '进入',
  like: '像；喜欢',
  near: '靠近',
  of: '...的',
  off: '离开；关掉',
  on: '在...上面',
  onto: '到...上面',
  out: '出去；向外',
  outside: '在...外面',
  over: '在...上方；越过',
  past: '经过；过去',
  since: '自从；因为',
  through: '穿过；通过',
  throughout: '遍及',
  till: '直到',
  to: '到；向',
  toward: '朝向',
  under: '在...下面',
  until: '直到',
  upon: '在...之上',
  with: '和...一起；用',
  within: '在...之内',
  without: '没有；在...外面',
}

export function queryOfflineDict(word: string): string | null {
  const normalized = word.toLowerCase().trim()
  return OFFLINE_DICT[normalized] || null
}

export function hasOfflineDict(word: string): boolean {
  return !!queryOfflineDict(word)
}

export function getOfflineDictSize(): number {
  return Object.keys(OFFLINE_DICT).length
}

// ==================== 同步服务 ====================

import { JSEncrypt } from 'jsencrypt'
import pako from 'pako'

// 动态服务器地址配置
const STORAGE_KEY_SERVER_URL = 'slowly_sync_server_url'

function getServerBase(): string {
  // 优先从本地存储读取用户配置的地址
  const customUrl = uni.getStorageSync(STORAGE_KEY_SERVER_URL)
  if (customUrl) {
    // 去除末尾的斜杠，统一处理
    return customUrl.replace(/\/$/, '')
  }
  // 默认使用 jsonblob.com
  return 'https://jsonblob.com/api/jsonBlob'
}

/**
 * 设置自定义同步服务器地址
 * @param url 服务器地址，如 'http://192.168.1.100:3000' 或 'https://sync.example.com'
 */
export function setSyncServerUrl(url: string): void {
  if (url && url.trim()) {
    const trimmedUrl = url.trim().replace(/\/$/, '')
    uni.setStorageSync(STORAGE_KEY_SERVER_URL, trimmedUrl)
  } else {
    // 清空则恢复默认
    uni.removeStorageSync(STORAGE_KEY_SERVER_URL)
  }
}

/**
 * 获取当前同步服务器地址
 */
export function getSyncServerUrl(): string {
  return getServerBase()
}

/**
 * 清除自定义服务器配置，恢复默认
 */
export function resetSyncServer(): void {
  uni.removeStorageSync(STORAGE_KEY_SERVER_URL)
}

function randomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

function generateAesKey(): string {
  return randomString(32)
}

/** 将 Uint8Array 转为 base64（分块避免栈溢出） */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000
  const chunks: string[] = []
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.subarray(i, Math.min(i + CHUNK, bytes.length))
    chunks.push(String.fromCharCode.apply(null, Array.from(slice)))
  }
  return btoa(chunks.join(''))
}

/** 将 base64 转为 Uint8Array */
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/** XOR 加密/解密 Uint8Array（对称操作） */
function xorCrypt(data: Uint8Array, key: string): Uint8Array {
  const keyBytes = new TextEncoder().encode(key)
  const keyLen = keyBytes.length
  const result = new Uint8Array(data.length)
  for (let i = 0; i < data.length; i++) {
    result[i] = data[i] ^ keyBytes[i % keyLen]
  }
  return result
}

function buildSyncCode(blobId: string, aesKey: string): string {
  return `${blobId}.${aesKey}`
}

function parseSyncCode(syncCode: string): { blobId: string; aesKey: string } | null {
  const lastDot = syncCode.lastIndexOf('.')
  if (lastDot < 1 || lastDot === syncCode.length - 1) return null
  return {
    blobId: syncCode.substring(0, lastDot),
    aesKey: syncCode.substring(lastDot + 1),
  }
}

function uploadRaw(encryptedPayload: string): Promise<string> {
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${getServerBase()}/sync`,
      method: 'POST',
      header: { 'Content-Type': 'application/json' },
      data: { e: encryptedPayload },
      success: (res) => {
        if (res.statusCode === 201 || res.statusCode === 200) {
          // 优先从 JSON body 读取（自定义服务器返回 { code: 'xxx' }）
          const data = res.data as any
          if (data && (data.code || data.id || data.key)) {
            resolve(data.code || data.id || data.key)
            return
          }
          // 兼容 jsonblob.com（从 Location header 提取）
          const location = (res.header?.Location || res.header?.location || '') as string
          const blobId = location.split('/').pop() || location
          if (blobId) {
            resolve(blobId)
          } else {
            reject(new Error('服务器未返回数据标识'))
          }
        } else {
          reject(new Error(`上传失败: ${res.statusCode}`))
        }
      },
      fail: (err) => {
        reject(new Error(`上传失败: ${err.errMsg || '网络错误'}`))
      },
    })
  })
}

function downloadRaw(blobId: string): Promise<string | null> {
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${getServerBase()}/sync/${blobId}`,
      method: 'GET',
      header: { 'Accept': 'application/json' },
      success: (res) => {
        if (res.statusCode === 200) {
          const data = res.data as any
          if (data && data.e) {
            resolve(data.e as string)
          } else {
            resolve(null)
          }
        } else if (res.statusCode === 404) {
          resolve(null)
        } else {
          reject(new Error(`下载失败: ${res.statusCode}`))
        }
      },
      fail: (err) => {
        reject(new Error(`下载失败: ${err.errMsg || '网络错误'}`))
      },
    })
  })
}

export function checkServerAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    uni.request({
      url: `${getServerBase()}/ping`,
      method: 'GET',
      success: (res) => {
        resolve(res.statusCode === 200)
      },
      fail: () => {
        resolve(false)
      },
    })
  })
}

export interface MobileSyncBank {
  id: string
  name: string
  words: any[]
}

export interface MobileSyncData {
  version: number
  exportedAt: number
  platform: string
  banks: MobileSyncBank[]
}

export interface SyncResult {
  success: boolean
  code?: string
  error?: string
}

export interface RestoreResult {
  success: boolean
  banks?: MobileSyncBank[]
  error?: string
}

function collectSyncData(banks: MobileSyncBank[]): MobileSyncData {
  return {
    version: 1,
    exportedAt: Date.now(),
    platform: 'mobile',
    banks,
  }
}

/**
 * 推送数据到服务器
 * 流程：JSON → pako 压缩 → XOR 加密 → base64 → 上传
 */
export async function pushToServer(banks: MobileSyncBank[]): Promise<SyncResult> {
  try {
    const data = collectSyncData(banks)
    const json = JSON.stringify(data)

    // 1. pako 压缩
    const jsonBytes = new TextEncoder().encode(json)
    const compressed = pako.deflate(jsonBytes)

    // 2. XOR 加密
    const aesKey = generateAesKey()
    const encrypted = xorCrypt(compressed, aesKey)

    // 3. base64 编码 + 上传
    const encryptedBase64 = uint8ArrayToBase64(encrypted)
    const blobId = await uploadRaw(encryptedBase64)
    const syncCode = buildSyncCode(blobId, aesKey)
    return { success: true, code: syncCode }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

/**
 * 从服务器拉取数据
 * 流程：下载 → base64 解码 → XOR 解密 → pako 解压 → JSON
 */
export async function pullFromServer(syncCode: string): Promise<RestoreResult> {
  try {
    const parsed = parseSyncCode(syncCode.trim())
    if (!parsed) {
      return { success: false, error: '同步码格式无效' }
    }
    const { blobId, aesKey } = parsed
    const encrypted = await downloadRaw(blobId)
    if (!encrypted) {
      return { success: false, error: '同步码无效或数据已过期' }
    }

    // 1. base64 解码 → XOR 解密
    const encryptedBytes = base64ToUint8Array(encrypted)
    const compressed = xorCrypt(encryptedBytes, aesKey)

    // 2. pako 解压
    const jsonBytes = pako.inflate(compressed)
    const json = new TextDecoder().decode(jsonBytes)

    // 3. 解析 JSON
    try {
      const data: MobileSyncData = JSON.parse(json)
      return { success: true, banks: data.banks }
    } catch {
      return { success: false, error: '数据解析失败' }
    }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

// ==================== 词库服务 ====================

export type WordBankType =
  | 'cet4'
  | 'cet6'
  | 'kaogong'
  | 'kaoyan'
  | 'ielts'
  | 'toefl'
  | 'gre'
  | 'gmat'
  | 'bec'
  | 'level4'
  | 'level8'
  | 'zsb'
  | 'sat'

export interface WordBankInfo {
  id: WordBankType
  name: string
  description: string
  wordCount: number
  icon?: string
}

export interface Word {
  word: string
  meaning: string
  phonetic?: string
  example?: string
}

export interface LoadStrategy {
  priority: 'local' | 'online'
  useCache: boolean
  timeout: number
}

export const DEFAULT_STRATEGY: LoadStrategy = {
  priority: 'local',
  useCache: true,
  timeout: 5000,
}

export const WORDBANK_LIST: WordBankInfo[] = [
  { id: 'cet4', name: '四级词汇', description: '大学英语四级核心词汇', wordCount: 3739 },
  { id: 'cet6', name: '六级词汇', description: '大学英语六级核心词汇', wordCount: 2078 },
  { id: 'bec', name: '商务英语', description: '商务英语考试核心词汇', wordCount: 2825 },
  { id: 'gmat', name: 'GMAT词汇', description: 'GMAT考试核心词汇', wordCount: 3254 },
  { id: 'gre', name: 'GRE词汇', description: 'GRE考试核心词汇', wordCount: 7199 },
  { id: 'ielts', name: '雅思词汇', description: '雅思考试核心词汇', wordCount: 3427 },
  { id: 'kaogong', name: '考公词汇', description: '公务员考试英语词汇', wordCount: 313 },
  { id: 'kaoyan', name: '考研词汇', description: '研究生入学考试核心词汇', wordCount: 4533 },
  { id: 'level4', name: '专业四级', description: '英语专业四级核心词汇', wordCount: 4025 },
  { id: 'level8', name: '专业八级', description: '英语专业八级核心词汇', wordCount: 12197 },
  { id: 'sat', name: 'SAT词汇', description: 'SAT考试核心词汇', wordCount: 4423 },
  { id: 'toefl', name: '托福词汇', description: '托福考试核心词汇', wordCount: 9213 },
  { id: 'zsb', name: '专升本词汇', description: '专升本英语考试核心词汇', wordCount: 297 },
]

const CACHE_KEY_PREFIX = 'wordbank_cache_v2_'
const CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1000

interface CacheData {
  timestamp: number
  words: Word[]
}

function getFromCache(type: WordBankType): Word[] | null {
  try {
    const cacheStr = uni.getStorageSync(CACHE_KEY_PREFIX + type)
    if (!cacheStr) return null
    const cache: CacheData = JSON.parse(cacheStr)
    if (Date.now() - cache.timestamp > CACHE_EXPIRY) {
      uni.removeStorageSync(CACHE_KEY_PREFIX + type)
      return null
    }
    return cache.words
  } catch {
    return null
  }
}

export function saveWordBankCache(type: WordBankType, words: Word[]): void {
  try {
    const cache: CacheData = {
      timestamp: Date.now(),
      words,
    }
    uni.setStorageSync(CACHE_KEY_PREFIX + type, JSON.stringify(cache))
  } catch (e) {
    console.error('缓存词库失败:', e)
  }
}

export async function loadWordBank(
  type: WordBankType,
  strategy: LoadStrategy = DEFAULT_STRATEGY
): Promise<Word[]> {
  if (strategy.useCache) {
    const cached = getFromCache(type)
    if (cached && cached.length > 0) {
      return cached
    }
  }

  try {
    let rawData: any
    // #ifdef MP-WEIXIN
    // 微信小程序：词库数据在分包中，主包只从缓存读取
    // 如果没有缓存，提示用户先在词库管理页面下载
    const cached = getFromCache(type)
    if (cached && cached.length > 0) {
      return cached
    }
    throw new Error('请先在"词库管理"页面下载词库')
    // #endif
    // #ifndef MP-WEIXIN
    const importLoaders: Record<string, () => Promise<any>> = {
      cet4: () => import('@/wordbanks/cet4.ts'),
      cet6: () => import('@/wordbanks/cet6.ts'),
      bec: () => import('@/wordbanks/bec.ts'),
      gre: () => import('@/wordbanks/gre.ts'),
      gmat: () => import('@/wordbanks/gmat.ts'),
      ielts: () => import('@/wordbanks/ielts.ts'),
      kaogong: () => import('@/wordbanks/kaogong.ts'),
      kaoyan: () => import('@/wordbanks/kaoyan.ts'),
      level4: () => import('@/wordbanks/level4.ts'),
      level8: () => import('@/wordbanks/level8.ts'),
      sat: () => import('@/wordbanks/sat.ts'),
      toefl: () => import('@/wordbanks/toefl.ts'),
      zsb: () => import('@/wordbanks/zsb.ts'),
    }
    const impLoader = importLoaders[type]
    if (!impLoader) throw new Error(`未知词库类型: ${type}`)
    const h5Module = await impLoader()
    rawData = h5Module.default || h5Module
    const words = (Array.isArray(rawData) ? rawData : []).map((w: any) => ({
      word: w.word || '',
      meaning: w.meaning || w.explains || '',
      phonetic: w.phonetic,
      example: w.example,
    }))
    if (strategy.useCache) saveWordBankCache(type, words)
    return words
    // #endif
  } catch (e: any) {
    const cache = getFromCache(type)
    if (cache) return cache
    throw new Error(`加载词库失败: ${e.message || '模块加载错误'}`)
  }
}

export async function getWordBankInfo(type: WordBankType): Promise<WordBankInfo | null> {
  const info = WORDBANK_LIST.find((w) => w.id === type)
  if (!info) return null
  try {
    const words = await loadWordBank(type, { ...DEFAULT_STRATEGY, useCache: true })
    return { ...info, wordCount: words.length }
  } catch {
    return info
  }
}

export async function getAllWordBankInfo(): Promise<WordBankInfo[]> {
  // 页面初始化时仅返回列表信息，不预加载词库内容（避免串行加载13个文件导致超时）
  return WORDBANK_LIST.map(info => info)
}

export function isWordBankCached(type: WordBankType): boolean {
  try {
    const cacheStr = uni.getStorageSync(CACHE_KEY_PREFIX + type)
    if (!cacheStr) return false
    const cache: CacheData = JSON.parse(cacheStr)
    return Date.now() - cache.timestamp < CACHE_EXPIRY && cache.words.length > 0
  } catch {
    return false
  }
}

export async function downloadWordBank(type: WordBankType): Promise<Word[]> {
  return loadWordBank(type, { ...DEFAULT_STRATEGY, useCache: true })
}

export function clearWordBankCache(type?: WordBankType): void {
  if (type) {
    uni.removeStorageSync(CACHE_KEY_PREFIX + type)
  } else {
    const keys = uni.getStorageInfoSync().keys || []
    for (const key of keys) {
      if (key.startsWith(CACHE_KEY_PREFIX)) {
        uni.removeStorageSync(key)
      }
    }
  }
}

export async function importWordsFromBank(
  type: WordBankType,
  count: number = 50
): Promise<Word[]> {
  const words = await loadWordBank(type)
  return words.slice(0, count)
}

// ==================== 二维码绘制 ====================

function encodeUTF8(str: string): number[] {
  const result: number[] = []
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i)
    if (code < 0x80) {
      result.push(code)
    } else if (code < 0x800) {
      result.push(0xC0 | (code >> 6), 0x80 | (code & 0x3F))
    } else if (code >= 0xD800 && code <= 0xDBFF) {
      const hi = code
      const lo = str.charCodeAt(++i)
      const cp = ((hi - 0xD800) << 10) + (lo - 0xDC00) + 0x10000
      result.push(0xF0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3F), 0x80 | ((cp >> 6) & 0x3F), 0x80 | (cp & 0x3F))
    } else {
      result.push(0xE0 | (code >> 12), 0x80 | ((code >> 6) & 0x3F), 0x80 | (code & 0x3F))
    }
  }
  return result
}

const BYTE_CAPACITY_M = [
  0, 14, 26, 42, 62, 84, 106, 122, 152, 180, 213,
  251, 287, 331, 362, 412, 450, 504, 560, 624, 666,
  711, 779, 857, 911, 997, 1059, 1125, 1190, 1264,
  1370, 1452, 1538, 1628, 1722, 1809, 1911, 1989, 2099, 2213
]

function getByteCapacity(version: number, ecl: number): number {
  return BYTE_CAPACITY_M[version] || 0
}

function drawFinderPattern(matrix: boolean[][], reserved: boolean[][], row: number, col: number) {
  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {
      const tr = row + r, tc = col + c
      if (tr < 0 || tc < 0 || tr >= matrix.length || tc >= matrix.length) continue
      reserved[tr][tc] = true
      if ((0 <= r && r <= 6 && (c === 0 || c === 6)) ||
          (0 <= c && c <= 6 && (r === 0 || r === 6)) ||
          (2 <= r && r <= 4 && 2 <= c && c <= 4)) {
        matrix[tr][tc] = true
      } else {
        matrix[tr][tc] = false
      }
    }
  }
}

function drawAlignmentPattern(matrix: boolean[][], reserved: boolean[][], row: number, col: number) {
  for (let r = -2; r <= 2; r++) {
    for (let c = -2; c <= 2; c++) {
      const tr = row + r, tc = col + c
      reserved[tr][tc] = true
      if (r === -2 || r === 2 || c === -2 || c === 2 || (r === 0 && c === 0)) {
        matrix[tr][tc] = true
      } else {
        matrix[tr][tc] = false
      }
    }
  }
}

function getAlignmentPositions(version: number): number[] {
  if (version === 1) return []
  const positions = [6]
  const size = version * 4 + 17
  const last = size - 7
  const count = Math.floor(version / 7) + 2
  const step = version === 32 ? 26 : Math.ceil((last - 6) / (count - 1) / 2) * 2
  for (let i = 1; i < count - 1; i++) {
    positions.push(6 + step * i)
  }
  positions.push(last)
  return positions
}

function encodeData(data: number[], version: number, ecl: number): number[] {
  const bits: number[] = []
  const dataLen = data.length
  bits.push(0, 1, 0, 0)
  const ccBits = version < 10 ? 8 : 16
  for (let i = ccBits - 1; i >= 0; i--) {
    bits.push((dataLen >> i) & 1)
  }
  for (const byte of data) {
    for (let i = 7; i >= 0; i--) {
      bits.push((byte >> i) & 1)
    }
  }
  const totalBits = getTotalDataBits(version, ecl)
  for (let i = 0; i < 4 && bits.length < totalBits; i++) bits.push(0)
  while (bits.length % 8 !== 0 && bits.length < totalBits) bits.push(0)
  const padBytes = [0xEC, 0x11]
  let pi = 0
  while (bits.length < totalBits) {
    for (let i = 7; i >= 0; i--) {
      bits.push((padBytes[pi] >> i) & 1)
    }
    pi = (pi + 1) % 2
  }
  return bits
}

function getTotalDataBits(version: number, ecl: number): number {
  const dataCodewords = BYTE_CAPACITY_M[version]
  return dataCodewords * 8
}

const RS_BLOCK_TABLE = [
  [1,26,19],[1,26,16],[1,26,13],[1,26,9],
  [1,44,34],[1,44,28],[1,44,22],[1,44,16],
  [1,70,55],[1,70,44],[2,35,17],[2,35,13],
  [1,100,80],[2,50,32],[2,50,24],[4,25,9],
  [1,134,108],[2,67,43],[2,33,15,2,34,16],[2,33,11,2,34,12],
  [2,86,68],[4,43,27],[4,43,19],[4,43,15],
  [2,98,78],[4,49,31],[2,32,14,4,33,15],[4,39,13,1,40,14],
  [2,121,97],[2,60,38,2,61,39],[4,40,18,2,41,19],[4,40,14,2,41,15],
  [2,146,116],[3,58,36,2,59,37],[4,36,16,4,37,17],[4,36,12,4,37,13],
  [2,86,68,2,87,69],[4,69,43,1,70,44],[6,43,19,2,44,20],[6,43,15,2,44,16],
  [4,101,81],[1,80,50,4,81,51],[4,50,22,4,51,23],[3,36,12,8,37,13],
  [2,116,92,2,117,93],[6,58,36,2,59,37],[4,46,20,6,47,21],[7,42,14,4,43,15],
  [4,133,107],[8,59,37,1,60,38],[8,44,20,4,45,21],[12,33,11,4,34,12],
  [3,145,115,1,146,116],[4,64,40,5,65,41],[11,36,16,5,37,17],[11,36,12,5,37,13],
  [5,109,87,1,110,88],[5,65,41,5,66,42],[5,54,24,7,55,25],[11,36,12,7,37,13],
  [5,122,98,1,123,99],[7,73,45,3,74,46],[15,43,19,2,44,20],[3,45,15,13,46,16],
  [1,135,107,5,136,108],[10,74,46,1,75,47],[1,50,22,15,51,23],[2,42,14,17,43,15],
  [5,150,120,1,151,121],[9,69,43,4,70,44],[17,50,22,1,51,23],[2,42,14,19,43,15],
  [3,141,113,4,142,114],[3,70,44,11,71,45],[17,47,21,4,48,22],[9,39,13,16,40,14],
  [3,135,107,5,136,108],[3,67,41,13,68,42],[15,54,24,5,55,25],[15,43,15,10,44,16],
  [4,144,116,4,145,117],[17,68,42],[17,50,22,6,51,23],[19,46,16,6,47,17],
  [2,139,111,7,140,112],[17,74,46],[7,54,24,16,55,25],[34,37,13],
  [4,151,121,5,152,122],[4,75,47,14,76,48],[11,54,24,14,55,25],[16,45,15,14,46,16],
  [6,147,117,4,148,118],[6,73,45,14,74,46],[11,54,24,16,55,25],[30,46,16,2,47,17],
  [8,132,106,4,133,107],[8,75,47,13,76,48],[7,54,24,22,55,25],[22,45,15,13,46,16],
  [10,142,114,2,143,115],[19,74,46,4,75,47],[28,50,22,6,51,23],[33,46,16,4,47,17],
  [8,152,122,4,153,123],[22,73,45,3,74,46],[8,53,23,26,54,24],[12,45,15,28,46,16],
  [3,147,117,10,148,118],[3,73,45,23,74,46],[4,54,24,31,55,25],[11,45,15,31,46,16],
  [7,146,116,7,147,117],[21,73,45,7,74,46],[1,53,23,37,54,24],[19,45,15,26,46,16],
  [5,145,115,10,146,116],[19,75,47,10,76,48],[15,54,24,25,55,25],[23,45,15,25,46,16],
  [13,145,115,3,146,116],[2,74,46,29,75,47],[42,54,24,1,55,25],[23,45,15,28,46,16],
  [17,145,115],[10,74,46,23,75,47],[10,54,24,35,55,25],[19,45,15,35,46,16],
  [17,145,115,1,146,116],[14,74,46,21,75,47],[29,54,24,19,55,25],[11,45,15,46,46,16],
  [13,145,115,6,146,116],[14,74,46,23,75,47],[44,54,24,7,55,25],[59,46,16,1,47,17],
  [12,151,121,7,152,122],[12,75,47,26,76,48],[39,54,24,14,55,25],[22,45,15,41,46,16],
  [6,151,121,14,152,122],[6,75,47,34,76,48],[46,54,24,10,55,25],[2,45,15,64,46,16],
  [17,152,122,4,153,123],[29,74,46,14,75,47],[49,54,24,10,55,25],[24,45,15,46,46,16],
  [4,152,122,18,153,123],[13,74,46,32,75,47],[48,54,24,14,55,25],[42,45,15,32,46,16],
  [20,147,117,4,148,118],[40,75,47,7,76,48],[43,54,24,22,55,25],[10,45,15,67,46,16],
  [19,148,118,6,149,119],[18,75,47,31,76,48],[34,54,24,34,55,25],[20,45,15,61,46,16]
]

function getFormatBits(ecl: number, maskPattern: number): number {
  const data = (ecl << 3) | maskPattern
  let bits = data << 10
  for (let i = 0; i < 15; i++) {
    if ((bits >>> (14 - i)) & 1) {
      bits ^= (0x537 << (9 - i))
    }
  }
  return ((data << 10) | bits) ^ 0x5412
}

function getVersionBits(version: number): number {
  let d = version << 12
  for (let i = 0; i < 18; i++) {
    if (d & (1 << (17 - i))) {
      d ^= (0x1F25 << (17 - i - 12))
    }
  }
  return (version << 12) | d
}

function writeFormatInfo(matrix: boolean[][], size: number, formatBits: number) {
  for (let i = 0; i < 15; i++) {
    const bit = ((formatBits >> i) & 1) === 1
    if (i < 6) matrix[8][i] = bit
    else if (i < 8) matrix[8][i + 1] = bit
    else if (i < 9) matrix[8][size - 15 + i] = bit
    else matrix[8][size - 15 + i] = bit
    if (i < 8) matrix[size - 1 - i][8] = bit
    else matrix[14 - i][8] = bit
  }
}

function writeVersionInfo(matrix: boolean[][], size: number, versionBits: number) {
  for (let i = 0; i < 18; i++) {
    const bit = ((versionBits >> i) & 1) === 1
    const r = Math.floor(i / 3)
    const c = size - 11 + (i % 3)
    matrix[r][c] = bit
    matrix[c][r] = bit
  }
}

export function generateQRMatrix(text: string): boolean[][] {
  const data = encodeUTF8(text)
  const ecl = 0
  let version = 1
  for (; version <= 40; version++) {
    const capacity = getByteCapacity(version, ecl)
    if (capacity >= data.length) break
  }
  if (version > 40) throw new Error('数据太长，无法生成二维码')
  const size = version * 4 + 17
  const matrix = Array.from({ length: size }, () => Array(size).fill(false))
  const reserved = Array.from({ length: size }, () => Array(size).fill(false))

  drawFinderPattern(matrix, reserved, 0, 0)
  drawFinderPattern(matrix, reserved, 0, size - 7)
  drawFinderPattern(matrix, reserved, size - 7, 0)

  const alignPos = getAlignmentPositions(version)
  for (const r of alignPos) {
    for (const c of alignPos) {
      if (reserved[r][c]) continue
      drawAlignmentPattern(matrix, reserved, r, c)
    }
  }

  for (let i = 8; i < size - 8; i++) {
    if (!reserved[6][i]) {
      matrix[6][i] = i % 2 === 0
      reserved[6][i] = true
    }
    if (!reserved[i][6]) {
      matrix[i][6] = i % 2 === 0
      reserved[i][6] = true
    }
  }

  for (let i = 0; i < 9; i++) {
    reserved[8][i] = true
    reserved[i][8] = true
    reserved[8][size - 8 + i] = true
    reserved[size - 8 + i][8] = true
  }
  reserved[size - 8][8] = true

  if (version >= 7) {
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 3; j++) {
        reserved[i][size - 11 + j] = true
        reserved[size - 11 + j][i] = true
      }
    }
  }

  const dataBits = encodeData(data, version, ecl)
  let bitIdx = 0
  let upward = true
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5
    for (let vert = 0; vert < size; vert++) {
      const row = upward ? size - 1 - vert : vert
      for (let c = 0; c < 2; c++) {
        const col = right - c
        if (col < 0 || reserved[row][col]) continue
        if (bitIdx < dataBits.length) {
          matrix[row][col] = dataBits[bitIdx] === 1
          bitIdx++
        }
      }
    }
    upward = !upward
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!reserved[r][c] && (r + c) % 2 === 0) {
        matrix[r][c] = !matrix[r][c]
      }
    }
  }

  const formatBits = getFormatBits(ecl, 0)
  writeFormatInfo(matrix, size, formatBits)

  if (version >= 7) {
    const versionBits = getVersionBits(version)
    writeVersionInfo(matrix, size, versionBits)
  }

  return matrix
}

export function drawQrCode(
  canvasId: string,
  text: string,
  componentInstance?: any,
  options?: { size?: number; margin?: number }
) {
  const size = options?.size || 180
  const margin = options?.margin || 2
  const matrix = generateQRMatrix(text)
  const cellSize = Math.floor((size - margin * 2) / matrix.length)
  const actualSize = cellSize * matrix.length + margin * 2

  const ctx = uni.createCanvasContext(canvasId, componentInstance)
  ctx.setFillStyle('#ffffff')
  ctx.fillRect(0, 0, actualSize, actualSize)
  ctx.setFillStyle('#000000')
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix[r].length; c++) {
      if (matrix[r][c]) {
        ctx.fillRect(margin + c * cellSize, margin + r * cellSize, cellSize, cellSize)
      }
    }
  }
  ctx.draw()
}
