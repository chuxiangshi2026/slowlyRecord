/**
 * 截图/选图适配器接口
 *
 * 桌面端：uTools screenCapture / Electron desktopCapturer
 * 移动端 App：相机/相册选图
 * 小程序：wx.chooseImage
 */

import { getPlatform } from './platform'

export interface CaptureResult {
  /** 图片 Base64 数据 */
  base64: string
  /** 本地文件路径（桌面端有，小程序没有） */
  path?: string
  /** 图片宽度 */
  width?: number
  /** 图片高度 */
  height?: number
}

export interface OCRResult {
  /** 识别的文本 */
  text: string
  /** 置信度 0-1 */
  confidence: number
  /** 文本区域位置 */
  bounds?: {
    x: number
    y: number
    width: number
    height: number
  }
}

export interface CaptureAdapter {
  /**
   * 调起截图或选图
   * - 桌面端：调起屏幕截图工具
   * - 移动端：调起相机/相册
   * - 小程序：调起 wx.chooseImage
   */
  capture(): Promise<CaptureResult>

  /**
   * OCR 文字识别
   * @param imageData 图片数据（Base64）
   * @returns 识别结果
   */
  ocr(imageData: string): Promise<OCRResult[]>
}

let _captureAdapter: CaptureAdapter | null = null

export function getCaptureAdapter(): CaptureAdapter {
  if (_captureAdapter) return _captureAdapter

  const platform = getPlatform()
  switch (platform) {
    case 'utools': {
      const { CaptureAdapterUtools } = require('./impl/capture-utools')
      _captureAdapter = new CaptureAdapterUtools()
      break
    }
    case 'electron': {
      const { CaptureAdapterElectron } = require('./impl/capture-electron')
      _captureAdapter = new CaptureAdapterElectron()
      break
    }
    case 'mp-weixin':
    case 'app-android':
    case 'app-ios': {
      const { CaptureAdapterMiniProgram } = require('./impl/capture-miniprogram')
      _captureAdapter = new CaptureAdapterMiniProgram()
      break
    }
    default: {
      const { CaptureAdapterWeb } = require('./impl/capture-web')
      _captureAdapter = new CaptureAdapterWeb()
      break
    }
  }
  return _captureAdapter
}

export function setCaptureAdapter(adapter: CaptureAdapter): void {
  _captureAdapter = adapter
}
