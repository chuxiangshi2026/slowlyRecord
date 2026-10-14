/**
 * 主界面背景图存取层（桌面端）
 *
 * 图片本体（压缩后的 dataURL）存独立文档 `app-bg-image`，而不是 user-set：
 * user-set 会被 WebDAV 同步全量携带，几百 KB 的图片不应跟着设置一起跑；
 * sync-manager 的 collectSyncData 按字段白名单收集，此文档天然排除在同步之外。
 */
import { getDbAdapter } from '@/adapters/db'
import { log } from '@/utils/logger'

export const APP_BG_DOC_ID = 'app-bg-image'

interface AppBgDoc {
  _id: string;
  _rev?: string;
  image: string;
  updatedAt: number;
}

/** 读取自定义背景图 dataURL（无图或读取失败返回空串） */
export function getAppBgImage(): string {
  try {
    const docs = getDbAdapter().allDocs(APP_BG_DOC_ID) as unknown as AppBgDoc[]
    return docs.find(d => d?._id === APP_BG_DOC_ID)?.image || ''
  } catch (e) {
    log.w('[背景图] 读取失败:', e)
    return ''
  }
}

/** 保存自定义背景图（固定 _id，带 _rev 冲突重试） */
export async function saveAppBgImage(image: string): Promise<boolean> {
  const db = getDbAdapter()
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const docs = db.allDocs(APP_BG_DOC_ID) as unknown as AppBgDoc[]
      const rev = docs.find(d => d?._id === APP_BG_DOC_ID)?._rev
      const result = await db.promises.put({
        _id: APP_BG_DOC_ID,
        ...(rev ? { _rev: rev } : {}),
        image,
        updatedAt: Date.now(),
      })
      if (result?.ok) return true
      log.e('[背景图] 保存失败:', result?.message)
    } catch (e) {
      log.e('[背景图] 保存异常:', e)
    }
  }
  return false
}

/** 删除自定义背景图（不存在时静默忽略） */
export function removeAppBgImage(): void {
  try {
    getDbAdapter().remove(APP_BG_DOC_ID)
  } catch (e) {
    log.w('[背景图] 删除失败:', e)
  }
}

/**
 * 把用户选择的图片文件压缩为 JPEG dataURL（最长边 1600px，质量 0.72，约 200~400KB）
 * 非图片或解码失败时 reject，由调用方提示
 */
export function fileToCompressedDataUrl(file: File, maxEdge = 1600, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('not an image'))
      return
    }
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      try {
        const scale = Math.min(1, maxEdge / Math.max(img.width, img.height))
        const w = Math.max(1, Math.round(img.width * scale))
        const h = Math.max(1, Math.round(img.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('canvas 2d context unavailable')
        ctx.drawImage(img, 0, 0, w, h)
        URL.revokeObjectURL(url)
        resolve(canvas.toDataURL('image/jpeg', quality))
      } catch (e) {
        URL.revokeObjectURL(url)
        reject(e)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('image decode failed'))
    }
    img.src = url
  })
}
