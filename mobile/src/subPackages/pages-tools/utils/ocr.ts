/**
 * OCR 图片识别 - 重量级模块
 * 依赖 translation.ts 中的 tencentCloudRequest 和 translateText
 * 已迁移到分包目录
 */

import type { OcrWordResult } from '@/stores/useUtils/types'
export type { OcrWordResult }
import { tencentCloudRequest, getTranslationApiKey, translateText } from './translation'

async function tencentCloudOcr(base64Image: string): Promise<string[]> {
  const pureBase64 = base64Image.startsWith('data:') ? base64Image.substring(base64Image.indexOf(',') + 1) : base64Image
  const data = await tencentCloudRequest('ocr', 'ocr.tencentcloudapi.com', 'GeneralBasicOCR', '2018-11-19', 'ap-beijing', { ImageBase64: pureBase64 })
  if (data.Response?.Error) throw new Error(`腾讯云OCR错误[${data.Response.Error.Code}]: ${data.Response.Error.Message}`)
  const detections: Array<{ DetectedText: string }> = data.Response?.TextDetections || []
  return detections.map(d => d.DetectedText).filter(t => t && t.trim())
}

function extractEnglishWords(textLines: string[]): string[] {
  const wordSet = new Set<string>()
  for (const line of textLines) {
    const words = line.split(/[^a-zA-Z]+/).filter(w => w.length > 1)
    for (const w of words) wordSet.add(w.toLowerCase())
  }
  return Array.from(wordSet)
}

export async function recognizeImageWords(base64Image: string): Promise<OcrWordResult[]> {
  const { appkey: tencentId } = getTranslationApiKey('tencent')
  const { appkey: glmKey } = getTranslationApiKey('glm')
  const { appkey: qwenKey } = getTranslationApiKey('qwen')
  // 内置密钥已下线：三家 OCR 渠道都未配置时直接给出可操作的提示，避免走一遍网络再报模糊错误
  if (!tencentId && !glmKey && !qwenKey) {
    throw new Error('拍照取词需先配置密钥：请在「我的 → 翻译引擎」中填写腾讯云 OCR、GLM 或千问密钥')
  }
  if (tencentId) {
    try {
      const textLines = await tencentCloudOcr(base64Image)
      const words = extractEnglishWords(textLines)
      if (words.length > 0) {
        const results: OcrWordResult[] = []
        for (const word of words.slice(0, 10)) {
          try {
            const translation = await translateText(word, 'en', 'zh')
            results.push({ word, meaning: translation.explains || translation.translatedText || word, phonetic: translation.phonetic || undefined })
          } catch { results.push({ word, meaning: '' }) }
        }
        if (results.length > 0) return results
      }
    } catch (e: any) { console.warn('腾讯云OCR失败，降级到视觉模型:', e.message) }
  }
  const errors: string[] = []
  if (glmKey) { try { return await recognizeImageWithApi('https://open.bigmodel.cn/api/paas/v4/chat/completions', glmKey, 'glm-4v-flash', base64Image) } catch (e: any) { errors.push(`GLM: ${e.message}`) } }
  if (qwenKey) { try { return await recognizeImageWithApi('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', qwenKey, 'qwen-vl-max', base64Image) } catch (e: any) { errors.push(`Qwen: ${e.message}`) } }
  throw new Error('OCR识别失败（腾讯云OCR和视觉模型均不可用）: ' + errors.join('; '))
}

async function recognizeImageWithApi(url: string, apiKey: string, model: string, base64Image: string): Promise<OcrWordResult[]> {
  let dataUrl = base64Image.startsWith('data:') ? base64Image : `data:image/jpeg;base64,${base64Image}`
  const base64Size = base64Image.length * 0.75
  if (base64Size > 4 * 1024 * 1024) console.warn(`OCR 图片 base64 较大: ${(base64Size / 1024 / 1024).toFixed(1)}MB，可能影响识别效果`)
  return new Promise((resolve, reject) => {
    uni.request({
      url, method: 'POST',
      header: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      data: {
        model, messages: [{ role: 'user', content: [
          { type: 'image_url', image_url: { url: dataUrl } },
          { type: 'text', text: 'You are an OCR assistant specialized in recognizing English text from images. Please carefully identify ALL English words visible in this image. For each word, provide the word itself, its Chinese meaning, and its phonetic transcription (IPA). Return the result as a JSON array: [{"word":"the_word","meaning":"中文释义","phonetic":"音标"}]. Rules: 1) Only include real English words (not abbreviations, numbers, or symbols). 2) Correct any OCR errors - if a letter looks ambiguous, use context to determine the correct word. 3) Each word should be lowercase. 4) If no English words are found, return an empty array []. 5) Return ONLY the JSON array, no other text.' }
        ]}], stream: false, temperature: 0.1, max_tokens: 2000
      },
      success: (res) => {
        const data = res.data as any
        if (data.error) { reject(new Error(data.error.message || `API 错误: ${data.error.code || 'unknown'}`)); return }
        const content = data.choices?.[0]?.message?.content
        if (!content) { reject(new Error('识别结果为空')); return }
        try {
          const jsonMatch = content.match(/\[[\s\S]*\]/)
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0])
            if (Array.isArray(parsed)) {
              resolve(parsed.filter((item: any) => item && typeof item.word === 'string' && item.word.trim()).map((item: any) => ({ word: String(item.word).trim().toLowerCase(), meaning: String(item.meaning || '').trim(), phonetic: item.phonetic ? String(item.phonetic).trim() : undefined })).filter((item: OcrWordResult) => /^[a-z]+$/i.test(item.word) && item.word.length > 0))
            } else resolve([])
          } else {
            const singleMatch = content.match(/\{[\s\S]*"word"[\s\S]*\}/)
            if (singleMatch) { const parsed = JSON.parse(singleMatch[0]); if (parsed.word && typeof parsed.word === 'string') resolve([{ word: String(parsed.word).trim().toLowerCase(), meaning: String(parsed.meaning || '').trim(), phonetic: parsed.phonetic ? String(parsed.phonetic).trim() : undefined }]); else resolve([]) }
            else resolve([])
          }
        } catch { console.warn('OCR JSON 解析失败'); resolve([]) }
      },
      fail: (err) => reject(new Error('图片识别请求失败: ' + (err.errMsg || '网络错误')))
    })
  })
}
