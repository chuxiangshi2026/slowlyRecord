/**
 * Web 浏览器截图适配器实现
 *
 * 浏览器环境无法直接调起系统截图，capture() 降级为文件选择；
 * ocr() 走 capture-shared 的共享 OCR 分派逻辑
 */
import type { CaptureAdapter, CaptureResult, OCRResult } from '../capture'
import { pickImageFile, runOcr } from './capture-shared'

export class CaptureAdapterWeb implements CaptureAdapter {
  capture(): Promise<CaptureResult> {
    return pickImageFile()
  }

  ocr(imageData: string): Promise<OCRResult[]> {
    return runOcr(imageData)
  }
}
