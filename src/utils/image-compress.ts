/**
 * 图片压缩工具
 * 支持自动压缩和尺寸限制
 */

/** 压缩配置 */
export interface CompressOptions {
  /** 最大宽度，默认 200 */
  maxWidth?: number
  /** 最大高度，默认 200 */
  maxHeight?: number
  /** 压缩质量 0-1，默认 0.7 */
  quality?: number
  /** 最大文件大小（字节），默认 100KB */
  maxSizeBytes?: number
  /** 输出格式，默认 image/webp（更小），不支持时回退 image/jpeg */
  mimeType?: string
}

const DEFAULT_OPTIONS: Required<CompressOptions> = {
  maxWidth: 200,
  maxHeight: 200,
  quality: 0.7,
  maxSizeBytes: 100 * 1024, // 100KB
  mimeType: 'image/webp',
}

/**
 * 压缩图片文件，返回 base64 DataURL
 * 自动按比例缩小尺寸并降低质量以满足大小限制
 */
export function compressImage(file: File, options?: CompressOptions): Promise<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        try {
          const dataUrl = doCompress(img, opts)
          resolve(dataUrl)
        } catch (err) {
          reject(err)
        }
      }
      img.onerror = () => reject(new Error('图片加载失败'))
      img.src = e.target?.result as string
    }
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsDataURL(file)
  })
}

/**
 * 压缩 base64 DataURL 格式的图片
 */
export function compressImageFromDataURL(dataUrl: string, options?: CompressOptions): Promise<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      try {
        const result = doCompress(img, opts)
        resolve(result)
      } catch (err) {
        reject(err)
      }
    }
    img.onerror = () => reject(new Error('图片加载失败'))
    img.src = dataUrl
  })
}

function doCompress(img: HTMLImageElement, opts: Required<CompressOptions>): string {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!

  // 计算缩放后的尺寸
  let { width, height } = calculateSize(img.width, img.height, opts.maxWidth, opts.maxHeight)

  // 逐步压缩：先尝试目标格式，如果超大小则降低质量或进一步缩小
  let quality = opts.quality
  let finalMimeType = opts.mimeType

  // 检测是否支持 webp：仅在用户请求 webp 时才回退 jpeg；
  // 显式指定 png 等格式不能被探测结果覆盖，否则会丢失透明通道
  const testCanvas = document.createElement('canvas')
  testCanvas.width = 1
  testCanvas.height = 1
  if (opts.mimeType === 'image/webp' && !testCanvas.toDataURL('image/webp').startsWith('data:image/webp')) {
    finalMimeType = 'image/jpeg'
  }

  // 设置 canvas 尺寸
  canvas.width = width
  canvas.height = height

  // 白色背景（JPEG 不支持透明通道）
  if (finalMimeType === 'image/jpeg') {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
  }

  ctx.drawImage(img, 0, 0, width, height)

  let result = canvas.toDataURL(finalMimeType, quality)

  // 如果超过大小限制，逐步降低质量
  while (getDataUrlSize(result) > opts.maxSizeBytes && quality > 0.1) {
    quality -= 0.1
    // 重绘
    ctx.clearRect(0, 0, width, height)
    if (finalMimeType === 'image/jpeg') {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, width, height)
    }
    ctx.drawImage(img, 0, 0, width, height)
    result = canvas.toDataURL(finalMimeType, quality)
  }

  // 如果仍然超限，进一步缩小尺寸
  while (getDataUrlSize(result) > opts.maxSizeBytes && width > 20 && height > 20) {
    width = Math.floor(width * 0.8)
    height = Math.floor(height * 0.8)
    canvas.width = width
    canvas.height = height
    ctx.clearRect(0, 0, width, height)
    if (finalMimeType === 'image/jpeg') {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, width, height)
    }
    ctx.drawImage(img, 0, 0, width, height)
    result = canvas.toDataURL(finalMimeType, quality)
  }

  return result
}

/**
 * 按比例计算缩放尺寸
 */
function calculateSize(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  if (originalWidth <= maxWidth && originalHeight <= maxHeight) {
    return { width: originalWidth, height: originalHeight }
  }

  const ratio = Math.min(maxWidth / originalWidth, maxHeight / originalHeight)
  return {
    width: Math.floor(originalWidth * ratio),
    height: Math.floor(originalHeight * ratio),
  }
}

/**
 * 计算 DataURL 的字节大小
 */
function getDataUrlSize(dataUrl: string): number {
  // data:image/webp;base64,xxxxx -> 去掉前缀后计算 base64 字节
  const base64 = dataUrl.split(',')[1]
  if (!base64) return 0
  // base64 编码后每 4 个字符代表 3 字节
  return Math.floor(base64.length * 3 / 4)
}
