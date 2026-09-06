/**
 * 桌面端（uTools/Electron/Web）截图适配器的共享逻辑
 *
 * - pickImageFile：文件选择降级方案（Electron/Web 的 capture() 复用）
 * - runOcr：按当前 OCR 平台（useWordsStore().currentOcrPlatform）分派到
 *   pic-translate.ts 中的有道/百度/阿里/腾讯/本地 Tesseract 引擎
 *
 * 注意：为避免适配器层与 Pinia store 产生循环依赖，
 * pic-translate / store 等模块全部在函数体内动态 import，
 * 本文件模块加载期不引入任何运行时依赖。
 */
import type { CaptureResult, OCRResult } from '../capture'
import type { OcrResult } from '../../utils/pic-translate'

/**
 * 弹出文件选择框，读取图片为 base64
 * 用于 Electron/Web 环境 capture() 的降级实现
 */
export function pickImageFile(): Promise<CaptureResult> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'

    input.addEventListener('change', () => {
      const file = input.files?.[0]
      if (!file) {
        reject(new Error('未选择图片'))
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        // 去除 data:image/png;base64, 前缀
        const base64WithPrefix = reader.result as string
        resolve({
          base64: base64WithPrefix.split(',')[1],
          // Electron 中 File 带有 path 属性
          path: (file as any).path,
        })
      }
      reader.onerror = () => reject(new Error('图片读取失败'))
      reader.readAsDataURL(file)
    })

    // 部分浏览器（Chrome 等）支持 cancel 事件：用户取消选择
    input.addEventListener('cancel', () => reject(new Error('已取消选择图片')))

    input.click()
  })
}

/**
 * 解析 boundingBox 字符串为区域坐标
 * 支持 "x,y,w,h"（逗号分隔，有道/阿里/腾讯）与 "x y w h"（空格分隔，百度）两种格式
 */
export function parseBoundingBox(box?: string): OCRResult['bounds'] {
  if (!box) return undefined
  const parts = box.split(/[,\s]+/).map(Number)
  if (parts.length < 4 || parts.some(n => isNaN(n))) return undefined
  return { x: parts[0], y: parts[1], width: parts[2], height: parts[3] }
}

/**
 * 把 pic-translate 的识别区域（resRegions）映射为适配器的 OCRResult[]
 * 过滤掉空文本区域；各引擎不返回置信度，统一置为 1
 */
export function mapOcrRegions(regions: OcrResult['resRegions']): OCRResult[] {
  if (!regions) return []
  return regions
    .filter(r => r.context && r.context.trim().length > 0)
    .map(r => ({
      text: r.context.trim(),
      confidence: 1,
      bounds: parseBoundingBox(r.boundingBox),
    }))
}

/**
 * 把 pic-translate 的整包返回映射为 OCRResult[]，失败时抛出带引导语的错误
 */
export function mapOcrResult(result: OcrResult): OCRResult[] {
  if (result.errorCode !== '0') {
    const detail = result.errorMessage || `错误码 ${result.errorCode}`
    throw new Error(`OCR 识别失败（${detail}），请检查 API 密钥配置是否正确`)
  }
  return mapOcrRegions(result.resRegions)
}

/**
 * 按当前 OCR 平台执行文字识别
 * @param base64 图片 base64（不含 data: 前缀）
 * @returns 识别结果
 */
export async function runOcr(base64: string): Promise<OCRResult[]> {
  const { useWordsStore } = await import('../../stores/words')
  const wordsStore = useWordsStore()
  const ocrPlatform = wordsStore.currentOcrPlatform || 'local'

  const picTranslate = await import('../../utils/pic-translate')

  let result: OcrResult

  if (ocrPlatform === 'local') {
    // 本地 OCR：Tesseract.js，无需密钥
    const translatePlatform = wordsStore.currentTranslationPlatform || 'local'
    result = await picTranslate.ocrTranslateLocal(base64, translatePlatform)
  } else if (ocrPlatform === 'deepseek' || ocrPlatform === 'glm') {
    throw new Error('视觉大模型 OCR 请使用截图翻译功能，暂不支持图片粘贴识别')
  } else {
    const { getOcrApiKey } = await import('../../utils/get-api-key')
    const { appkey, key } = getOcrApiKey(ocrPlatform)
    if (!appkey || !key) {
      throw new Error(`未配置 ${ocrPlatform} OCR 的 API 密钥，请在设置中配置后重试`)
    }

    if (ocrPlatform === 'youdao') {
      const { toEngineLang } = await import('../../utils/translation-lang-map')
      const { getActiveLanguage } = await import('../../utils/language')
      const from = toEngineLang('youdao', getActiveLanguage(), 'ocr')
      if (!from) throw new Error('有道OCR不支持当前语言')
      result = await picTranslate.ocrTranslate(base64, appkey, key, from, 'zh-CHS')
    } else if (ocrPlatform === 'baidu') {
      result = await picTranslate.ocrTranslateBaidu(base64, appkey, key)
    } else if (ocrPlatform === 'ali') {
      result = await picTranslate.ocrTranslateAli(base64, appkey, key)
    } else if (ocrPlatform === 'tencent') {
      result = await picTranslate.ocrTranslateTencent(base64, appkey, key)
    } else {
      throw new Error(`暂不支持的 OCR 平台: ${ocrPlatform}`)
    }
  }

  return mapOcrResult(result)
}
