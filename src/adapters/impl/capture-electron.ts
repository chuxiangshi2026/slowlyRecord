/**
 * Electron 截图适配器实现
 *
 * Electron 环境暂无系统级截图能力（未接入 desktopCapturer），
 * capture() 降级为文件选择；ocr() 走 capture-shared 的共享 OCR 分派逻辑
 */
import type { CaptureAdapter, CaptureResult, OCRResult } from '../capture'
import { pickImageFile, runOcr } from './capture-shared'

export class CaptureAdapterElectron implements CaptureAdapter {
  capture(): Promise<CaptureResult> {
    return pickImageFile()
  }

  ocr(imageData: string): Promise<OCRResult[]> {
    return runOcr(imageData)
  }
}
