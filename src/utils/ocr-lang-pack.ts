/**
 * OCR 语言包按需下载
 *
 * 英语（eng）语言数据已随插件内置（public/tessdata/eng.traineddata.fast），
 * 其他语言（jpn/rus/spa/fra 等）首次使用时从 CDN 下载 tessdata_fast，
 * 缓存到 IndexedDB（Electron/Web）/ 本地缓存文件（uTools，经 preload 写 userData 目录，
 * 不占随账号同步的 dbStorage——商店审核合规要求），
 * 体积红线：任何语言包不进 public/。
 */
import { getProfile } from '@/utils/language'
import { getCacheStorage, migrateCacheKeys } from '@/adapters/local-cache'
import { getKvCache } from '@/adapters/kv-cache'
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

/**
 * 各语言包（.gz 原始字节）的 SHA-256 已知值（审核建议：下载后校验，避免缓存被替换后直接喂给 OCR 引擎）。
 * 与上面固定版本的 CDN 文件一一对应；上游升级版本时需同步更新。
 */
export const LANG_PACK_SHA256: Record<string, string> = {
    jpn: '2b63ebfbf1484de4a08ce53b29ef98a1c17658a93cbd38acb665d7d316d0be88',
    rus: 'f51f5edc992249ff9b70a227b22f242dfa47b2b1bbc7ae0ea74908640c101f6a',
    spa: '40be52f97b5d4eb7460073dc1f94cd546b27150333c0bf854ed7e7132db6bceb',
    fra: 'd611139672b3752c7097e671e4a1d9209dfd37f2aeb081ef6487fba3351e9255',
}

/** 计算 SHA-256（hex）；环境不支持 crypto.subtle 时返回 null（退化为不校验并记录告警） */
async function sha256Hex(data: ArrayBuffer): Promise<string | null> {
    try {
        const subtle = globalThis.crypto?.subtle
        if (!subtle) return null
        const digest = await subtle.digest('SHA-256', data)
        return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')
    } catch {
        return null
    }
}

/** 下载完整字节（带进度回调），供校验与解压共用 */
async function downloadRaw(url: string, onProgress?: (p: number) => void): Promise<Uint8Array> {
    const resp = await fetch(url)
    if (!resp.ok) throw new Error(`语言包下载失败: HTTP ${resp.status}`)
    const total = Number(resp.headers.get('content-length') || 0)
    const reader = resp.body?.getReader()
    if (reader && total) {
        const chunks: Uint8Array[] = []
        let received = 0
        for (;;) {
            const {done, value} = await reader.read()
            if (done) break
            chunks.push(value)
            received += value.length
            onProgress?.(Math.min(received / total, 0.99))
        }
        const out = new Uint8Array(received)
        let off = 0
        for (const c of chunks) { out.set(c, off); off += c.length }
        return out
    }
    return new Uint8Array(await resp.arrayBuffer())
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

// IndexedDB 存取统一走 kv-cache 适配层
const idb = getKvCache(DB_NAME, STORE_NAME)

async function idbGet(key: string): Promise<ArrayBuffer | null> {
    return idb.get<ArrayBuffer>(key)
}

async function idbPut(key: string, data: ArrayBuffer): Promise<void> {
    return idb.put(key, data)
}

/** uTools 环境的本地文件兜底缓存（经 preload 写 userData，不进同步库） */
function lsGet(key: string): ArrayBuffer | null {
    try {
        const storage = getCacheStorage()
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
        getCacheStorage().setItem(LS_PREFIX + key, btoa(binary))
    } catch (e) {
        console.warn('[OCR语言包] 本地缓存写入失败:', e)
    }
}

// 旧版本曾把语言包缓存在随账号同步的 dbStorage，首次使用时迁出并删除
let legacyMigrated = false
function migrateLegacyCacheOnce(): void {
    if (legacyMigrated) return
    legacyMigrated = true
    migrateCacheKeys(Object.keys(LANG_CDN).map(k => LS_PREFIX + k))
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

    migrateLegacyCacheOnce()

    // 1) IndexedDB 缓存
    const cached = await idbGet(ocrLang) ?? lsGet(ocrLang)
    if (cached) return new Uint8Array(cached)

    // 2) 下载（gzip）+ SHA-256 校验：哈希不符时丢弃并重下一次，仍不符则拒绝入缓存
    options.onProgress?.(0)
    const expected = LANG_PACK_SHA256[ocrLang]
    let raw: Uint8Array | null = null
    for (let attempt = 0; attempt < 2 && !raw; attempt++) {
        const candidate = await downloadRaw(url, attempt === 0 ? options.onProgress : undefined)
        if (!expected) {
            raw = candidate
            break
        }
        const actual = await sha256Hex(
            candidate.buffer.slice(candidate.byteOffset, candidate.byteOffset + candidate.byteLength) as ArrayBuffer
        )
        if (actual === null) {
            console.warn('[OCR语言包] 当前环境不支持 SHA-256 校验，跳过校验')
            raw = candidate
            break
        }
        if (actual === expected) {
            raw = candidate
        } else {
            console.warn(`[OCR语言包] ${ocrLang} SHA-256 校验失败（第 ${attempt + 1} 次下载），丢弃后重试`)
        }
    }
    if (!raw) throw new Error('语言包下载内容校验失败，已丢弃')
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
