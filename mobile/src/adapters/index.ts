/**
 * 移动端适配器统一入口
 * 合并所有适配器到单文件，避免微信小程序模块加载顺序问题
 */

// ==================== 类型定义 ====================

export type DbDoc<T extends {} = Record<string, any>> = {
  _id: string
  _rev?: string
} & T

export interface DbReturn {
  id: string
  rev?: string
  ok?: boolean
  error?: boolean
  name?: string
  message?: string
}

export interface DbAdapter {
  get<T extends {} = Record<string, any>>(id: string): DbDoc<T> | null
  put(doc: DbDoc): DbReturn
  allDocs<T extends {} = Record<string, any>>(prefix?: string): DbDoc<T>[]
  remove(doc: string | DbDoc): DbReturn
  bulkDocs(docs: DbDoc[]): DbReturn[]
  promises: {
    get<T extends {} = Record<string, any>>(id: string): Promise<DbDoc<T> | null>
    put(doc: DbDoc): Promise<DbReturn>
    remove(doc: string | DbDoc): Promise<DbReturn>
    bulkDocs(docs: DbDoc[]): Promise<DbReturn[]>
  }
}

export interface DbStorageAdapter {
  setItem(key: string, value: any): void
  getItem(key: string): any
  removeItem(key: string): void
}

// ==================== DbAdapter 注册 ====================

let _dbAdapter: DbAdapter | null = null

export function getDbAdapter(): DbAdapter {
  if (!_dbAdapter) {
    throw new Error('DbAdapter not initialized. Call setDbAdapter() first.')
  }
  return _dbAdapter
}

export function setDbAdapter(adapter: DbAdapter): void {
  _dbAdapter = adapter
}

export function resetDbAdapter(): void {
  _dbAdapter = null
}

// ==================== MiniProgramDbAdapter ====================

const STORAGE_PREFIX = 'slowlyrecord_'
const CHUNK_SIZE = 900 * 1024

export class MiniProgramDbAdapter implements DbAdapter {
  private prefix: string

  promises = {
    get: <T extends {} = Record<string, any>>(id: string): Promise<DbDoc<T> | null> => {
      return Promise.resolve(this.get<T>(id))
    },
    put: (doc: DbDoc): Promise<DbReturn> => {
      return Promise.resolve(this.put(doc))
    },
    remove: (doc: string | DbDoc): Promise<DbReturn> => {
      return Promise.resolve(this.remove(doc))
    },
    bulkDocs: (docs: DbDoc[]): Promise<DbReturn[]> => {
      return Promise.resolve(this.bulkDocs(docs))
    },
  }

  constructor(prefix: string = STORAGE_PREFIX) {
    this.prefix = prefix
  }

  private getKey(id: string): string {
    return `${this.prefix}${id}`
  }

  private saveWithChunks<T>(doc: DbDoc<T>): DbReturn {
    const key = this.getKey(doc._id)
    const dataStr = JSON.stringify(doc)

    if (dataStr.length <= CHUNK_SIZE) {
      try {
        uni.setStorageSync(key, doc)
        return { id: doc._id, rev: doc._rev || '1', ok: true }
      } catch (e) {
        return { id: doc._id, rev: doc._rev || '1', ok: false, error: true, message: String(e) }
      }
    }

    const chunks: string[] = []
    for (let i = 0; i < dataStr.length; i += CHUNK_SIZE) {
      chunks.push(dataStr.slice(i, i + CHUNK_SIZE))
    }

    const chunkInfo = {
      _id: doc._id,
      _rev: doc._rev || '1',
      _chunks: chunks.length,
      _chunkKeys: chunks.map((_, index) => `${key}__chunk__${index}`)
    }

    try {
      uni.setStorageSync(key, chunkInfo)
      chunks.forEach((chunk, index) => {
        uni.setStorageSync(`${key}__chunk__${index}`, chunk)
      })
      return { id: doc._id, rev: chunkInfo._rev, ok: true }
    } catch (e) {
      return { id: doc._id, rev: doc._rev || '1', ok: false, error: true, message: String(e) }
    }
  }

  private readWithChunksSync<T>(key: string): DbDoc<T> | null {
    try {
      const data = uni.getStorageSync(key)
      if (!data) return null

      if (data._chunks && data._chunkKeys) {
        let fullData = ''
        for (const chunkKey of data._chunkKeys) {
          const chunk = uni.getStorageSync(chunkKey)
          if (chunk === undefined || chunk === null) return null
          fullData += chunk
        }
        return JSON.parse(fullData) as DbDoc<T>
      }

      return data as DbDoc<T>
    } catch (e) {
      console.error('读取数据失败:', e)
      return null
    }
  }

  get<T extends {} = Record<string, any>>(id: string): DbDoc<T> | null {
    return this.readWithChunksSync<T>(this.getKey(id))
  }

  put(doc: DbDoc): DbReturn {
    return this.saveWithChunks(doc)
  }

  remove(doc: string | DbDoc): DbReturn {
    const id = typeof doc === 'string' ? doc : doc._id
    const key = this.getKey(id)
    try {
      const existing = uni.getStorageSync(key)
      if (existing && existing._chunks && existing._chunkKeys) {
        for (const chunkKey of existing._chunkKeys) {
          uni.removeStorageSync(chunkKey)
        }
      }
      uni.removeStorageSync(key)
      return { id, rev: '1', ok: true }
    } catch (e) {
      return { id, rev: '1', ok: false, error: true, message: String(e) }
    }
  }

  allDocs<T extends {} = Record<string, any>>(key?: string): DbDoc<T>[] {
    const items: DbDoc<T>[] = []
    try {
      const res = uni.getStorageInfoSync()
      const keys = res.keys || []

      for (const k of keys) {
        if (k.startsWith(this.prefix) && !k.includes('__chunk__')) {
          const doc = this.readWithChunksSync<T>(k)
          if (doc && (!key || doc._id.startsWith(key))) {
            items.push(doc)
          }
        }
      }
    } catch (e) {
      console.error('获取所有文档失败:', e)
    }
    return items
  }

  bulkDocs(docs: DbDoc[]): DbReturn[] {
    return docs.map(doc => this.put(doc))
  }
}

// ==================== CaptureAdapter ====================

export interface CaptureResult {
  base64: string
  path?: string
}

export interface OCRResult {
  text: string
  confidence: number
}

export interface CaptureAdapter {
  capture(): Promise<CaptureResult>
  ocr(imageData: string): Promise<OCRResult[]>
}

class UniAppCaptureAdapter implements CaptureAdapter {
  async capture(): Promise<CaptureResult> {
    return new Promise((resolve, reject) => {
      uni.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: (res: any) => {
          const tempPath = res.tempFilePaths?.[0] || res.tempFiles?.[0]?.path
          if (!tempPath) {
            reject(new Error('获取图片失败'))
            return
          }

          // #ifdef MP-WEIXIN
          try {
            const fs = uni.getFileSystemManager()
            const base64 = fs.readFileSync(tempPath, 'base64')
            resolve({ base64, path: tempPath })
          } catch (e) {
            reject(e)
          }
          // #endif

          // #ifdef H5 || APP-PLUS
          fetch(tempPath)
            .then(r => r.blob())
            .then(blob => {
              const reader = new FileReader()
              reader.onload = () => {
                const base64 = (reader.result as string).split(',')[1]
                resolve({ base64, path: tempPath })
              }
              reader.onerror = () => reject(new Error('读取图片失败'))
              reader.readAsDataURL(blob)
            })
            .catch(reject)
          // #endif
        },
        fail: (err: any) => reject(err || new Error('选择图片失败')),
      })
    })
  }

  async ocr(_imageData: string): Promise<OCRResult[]> {
    uni.showToast({ title: 'OCR 功能需配置云服务', icon: 'none' })
    return []
  }
}

let _captureAdapter: CaptureAdapter | null = null

export function getCaptureAdapter(): CaptureAdapter {
  if (!_captureAdapter) {
    _captureAdapter = new UniAppCaptureAdapter()
  }
  return _captureAdapter
}

// ==================== TtsAdapter ====================

export interface TtsAdapter {
  speak(text: string, options?: { lang?: string; rate?: number; pitch?: number }): void
  stop(): void
  playAudio(url: string): Promise<void>
}

class WxTtsAdapter implements TtsAdapter {
  private innerAudio: WechatMiniprogram.InnerAudioContext | null = null

  speak(_text: string, _options?: { lang?: string; rate?: number; pitch?: number }): void {
    console.warn('WxTtsAdapter.speak: Use playAudio with TTS URL instead')
  }

  stop(): void {
    if (this.innerAudio) {
      this.innerAudio.stop()
      this.innerAudio = null
    }
  }

  async playAudio(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.innerAudio = uni.createInnerAudioContext()
      this.innerAudio!.src = url
      this.innerAudio!.onEnded(() => { this.innerAudio = null; resolve() })
      this.innerAudio!.onError((err) => { this.innerAudio = null; reject(err) })
      this.innerAudio!.play()
    })
  }
}

let _ttsAdapter: TtsAdapter | null = null

export function getTtsAdapter(): TtsAdapter {
  if (!_ttsAdapter) {
    _ttsAdapter = new WxTtsAdapter()
  }
  return _ttsAdapter
}

export function setTtsAdapter(adapter: TtsAdapter): void {
  _ttsAdapter = adapter
}

// ==================== 适配器注册 ====================

export function registerMobileAdapters() {
  setDbAdapter(new MiniProgramDbAdapter())
}
