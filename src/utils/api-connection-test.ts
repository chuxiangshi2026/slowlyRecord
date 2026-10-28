import type {OcrPlatform, TranslationPlatform} from '@/types/words'
import {translateWithPlatform} from '@/utils/translation-api'
import {ocrRecognizeWithPlatform} from '@/utils/pic-translate'

export interface ConnectionTestResult {
  success: boolean
  message: string
  detail?: string
}

const errorText = (error: unknown) => error instanceof Error ? error.message : String(error)

export async function testTranslationConnection(platform: TranslationPlatform): Promise<ConnectionTestResult> {
  try {
    const result = await translateWithPlatform('hello', platform, 'en', 'zh', {connectionTest: true})
    if (result.success && result.explains?.trim()) {
      return {success: true, message: '配置可用', detail: `hello → ${result.explains.trim()}`}
    }
    return {success: false, message: result.errorMsg || '引擎未返回译文，请检查配置'}
  } catch (error) {
    return {success: false, message: errorText(error)}
  }
}

function createOcrTestImage(): string {
  const canvas = document.createElement('canvas')
  canvas.width = 420
  canvas.height = 140
  const context = canvas.getContext('2d')
  if (!context) throw new Error('当前环境无法生成 OCR 测试图片')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = '#000000'
  context.font = '48px Arial, sans-serif'
  context.fillText('hello', 24, 92)
  return canvas.toDataURL('image/png').split(',')[1]
}

export async function testOcrConnection(platform: OcrPlatform): Promise<ConnectionTestResult> {
  try {
    const result = await ocrRecognizeWithPlatform(createOcrTestImage(), platform)
    const text = result.resRegions
      ?.map(region => region.context || region.tranContent)
      .filter(Boolean)
      .join(' ')
      .trim()
    if (result.errorCode === '0' && text) {
      return {success: true, message: '配置可用', detail: `识别结果：${text}`}
    }
    return {success: false, message: result.errorMessage || `OCR 请求失败（${result.errorCode || '未知错误'}）`}
  } catch (error) {
    return {success: false, message: errorText(error)}
  }
}
