/**
 * uTools 截图适配器实现
 *
 * capture() 包装 utools.screenCapture 系统级截图
 * ocr() 走 capture-shared 的共享 OCR 分派逻辑
 */
import type { CaptureAdapter, CaptureResult, OCRResult } from '../capture'
import { runOcr } from './capture-shared'

export class CaptureAdapterUtools implements CaptureAdapter {
  capture(): Promise<CaptureResult> {
    return new Promise((resolve, reject) => {
      const utools = (window as any).utools
      if (!utools?.screenCapture) {
        reject(new Error('当前环境不支持 uTools 截图'))
        return
      }
      utools.screenCapture((image: string) => {
        if (!image) {
          reject(new Error('截图取消'))
          return
        }
        // 去除 data:image/png;base64, 前缀
        const base64 = image.includes(',') ? image.split(',')[1] : image
        resolve({ base64 })
      })
    })
  }

  ocr(imageData: string): Promise<OCRResult[]> {
    return runOcr(imageData)
  }
}
