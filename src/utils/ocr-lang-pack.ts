/**
 * OCR 语言包按需下载
 *
 * 英语（eng）语言数据已随插件内置（public/tessdata/eng.traineddata.fast），
 * 其他语言（jpn/rus/spa/fra 等）首次使用时从 CDN 下载 tessdata_fast，
 * 缓存到 IndexedDB（Electron/Web）/ localStorage（uTools，经 dbStorage），
 * 体积红线：任何语言包不进 public/。
 */
import { getProfile } from '@/utils/language'
import { getDbStorage } from '@/adapters/db'
import type { LanguageCode } from '@/utils/language/types'

/** CDN 地址（jsdelivr 的 tessdata_fast 镜像，.gz 压缩） */
const CDN_BASE = 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0'
const LANG_CDN: Record<string, string> = {
    // @tesseract.js-data 各语言包（tessdata_fast，gzip）
    jpn: 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/jpn@1.0.0/4.0.0_best_int/jpn.traineddata.gz',
    rus: 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/rus@1.0.0/4.0.0_best_int/rus.traineddata.gz',
    spa: 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/spa@1.0.0/4.0.0_best_int/spa.traineddata.gz',
    fra: 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/fra@1.0.0/4.0.0_best_int/fra.traineddata.gz',
}

const DB_NAME = 'SlowlyRecord_OCR_LangPack'
const STORE_NAME = 'traineddata'
const LS_PREFIX = 'ocr-traineddata:'

/** gzip 解压（DecompressionStream，Chromium 80+ 可用；失败返回 null） */
async function gunzip(data: ArrayBuffer): Promise<Uint8Array | null> {
    try {
        const DS = (globalThis as any).DecompressionStream
        if (!DS) return null
        const stream = new Blob([data]).stream().pipeThrough(new DS('gzip'))
        const buf = await new Response(stream).arrayBuffer()
        return new Uint8Array(buf)
    } catch {
        return null
    }
}

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1)
        req.onerror = () => reject(req.error)
        req.onsuccess = () => resolve(req.result)
        req.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME)
            }
        }
    })
}

async function idbGet(key: string): Promise<ArrayBuffer | null> {
    let db: IDBDatabase | null = null
    try {
        db = await openDB()
        return await new Promise((resolve, reject) => {
            const req = db!.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key)
            req.onsuccess = () => resolve(req.result ?? null)
            req.onerror = () => reject(req.error)
        })
    } catch {
        return null
    } finally {
        db?.close()
    }
}

async function idbPut(key: string, data: ArrayBuffer): Promise<void> {
    let db: IDBDatabase | null = null
    try {
        db = await openDB()
        await new Promise((resolve, reject) => {
            const req = db!.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(data, key)
            req.onsuccess = () => resolve(undefined)
            req.onerror = () => reject(req.error)
        })
    } catch (e) {
        console.warn('[OCR语言包] IndexedDB 缓存写入失败:', e)
    } finally {
        db?.close()
    }
}

/** uTools 环境的 localStorage 兜底缓存 */
function lsGet(key: string): ArrayBuffer | null {
    try {
        const storage = getDbStorage()
        const b64 = storage.getItem(LS_PREFIX + key)
        if (!b64) return null
        const bin = atob(b64)
        const bytes = new Uint8Array(bin.length)
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
        return bytes.buffer
    } catch {
        return null
    }
}

function lsPut(key: string, data: ArrayBuffer): void {
    try {
        const bytes = new Uint8Array(data)
        let binary = ''
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
        getDbStorage().setItem(LS_PREFIX + key, btoa(binary))
    } catch (e) {
        console.warn('[OCR语言包] localStorage 缓存写入失败（可能超出容量）:', e)
    }
}

export interface EnsureLangPackOptions {
    /** 下载进度回调（0~1） */
    onProgress?: (progress: number) => void
}

/**
 * 确保指定语言的 traineddata 可用：
 * - eng：直接返回 null（由调用方读取内置文件）
 * - 其他语言：查缓存 → 未命中则从 CDN 下载 → 解压 → 入缓存
 * @returns 解压后的 traineddata 字节；eng 或失败时返回 null（失败由调用方提示）
 */
export async function ensureTrainedData(
    lang: LanguageCode,
    options: EnsureLangPackOptions = {}
): Promise<Uint8Array | null> {
    const profile = getProfile(lang)
    const ocrLang = profile.ocrLang
    if (ocrLang === 'eng') return null // eng 走内置

    const url = LANG_CDN[ocrLang]
    if (!url) {
        console.warn(`[OCR语言包] 未注册语言包下载地址: ${ocrLang}`)
        return null
    }

    // 1) IndexedDB 缓存
    const cached = await idbGet(ocrLang) ?? lsGet(ocrLang)
    if (cached) return new Uint8Array(cached)

    // 2) 下载（gzip）
    options.onProgress?.(0)
    const resp = await fetch(url)
    if (!resp.ok) throw new Error(`语言包下载失败: HTTP ${resp.status}`)
    const total = Number(resp.headers.get('content-length') || 0)
    const reader = resp.body?.getReader()
    let raw: Uint8Array
    if (reader && total) {
        const chunks: Uint8Array[] = []
        let received = 0
        for (;;) {
            const {done, value} = await reader.read()
            if (done) break
            chunks.push(value)
            received += value.length
            options.onProgress?.(Math.min(received / total, 0.99))
        }
        raw = new Uint8Array(received)
        let off = 0
        for (const c of chunks) { raw.set(c, off); off += c.length }
    } else {
        raw = new Uint8Array(await resp.arrayBuffer())
    }
    options.onProgress?.(1)

    // 3) 解压
    const data = await gunzip(raw.buffer as ArrayBuffer)
    const bytes = data ?? raw
    if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
        throw new Error('当前环境不支持 gzip 解压，无法安装语言包')
    }

    // 4) 入缓存
    await idbPut(ocrLang, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))
    if (!data) lsPut(ocrLang, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))
    return bytes
}

/** 语言包是否需要下载（eng 返回 false） */
export function needsLangPack(lang: LanguageCode): boolean {
    return getProfile(lang).ocrLang !== 'eng'
}
