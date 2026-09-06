/**
 * 截图/选图适配器接口
 *
 * 桌面端：uTools screenCapture / Electron desktopCapturer
 * 移动端 App：相机/相册选图
 * 小程序：wx.chooseImage
 */

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
let _captureAdapterInitPromise: Promise<CaptureAdapter> | null = null

/**
 * 获取截图适配器实例（异步）
 *
 * 首次调用会根据平台自动选择实现并动态加载对应模块。
 * 严格 ESM 环境（Web/Electron 构建）中不能使用 require，
 * 必须通过本方法初始化后再使用同步版 getCaptureAdapter()。
 *
 * @returns 截图适配器实例
 */
export async function getCaptureAdapterAsync(): Promise<CaptureAdapter> {
  if (_captureAdapter) return _captureAdapter
  if (_captureAdapterInitPromise) return _captureAdapterInitPromise

  _captureAdapterInitPromise = (async () => {
    const { getPlatform } = await import('./platform')
    const platform = getPlatform()

    let adapter: CaptureAdapter

    switch (platform) {
      case 'utools': {
        const { CaptureAdapterUtools } = await import('./impl/capture-utools')
        adapter = new CaptureAdapterUtools()
        break
      }
      case 'electron': {
        const { CaptureAdapterElectron } = await import('./impl/capture-electron')
        adapter = new CaptureAdapterElectron()
        break
      }
      case 'mp-weixin':
      case 'mp-douyin':
      case 'app-android':
      case 'app-ios': {
        const { CaptureAdapterMiniProgram } = await import('./impl/capture-miniprogram')
        adapter = new CaptureAdapterMiniProgram()
        break
      }
      default: {
        const { CaptureAdapterWeb } = await import('./impl/capture-web')
        adapter = new CaptureAdapterWeb()
        break
      }
    }

    _captureAdapter = adapter
    _captureAdapterInitPromise = null
    return adapter
  })()

  return _captureAdapterInitPromise
}

/**
 * 获取截图适配器实例（同步）
 *
 * 注意：必须先调用过 getCaptureAdapterAsync() 完成初始化，
 * 或通过 setCaptureAdapter() 手动注入。
 */
export function getCaptureAdapter(): CaptureAdapter {
  if (_captureAdapter) return _captureAdapter

  throw new Error(
    'CaptureAdapter not initialized. Call await getCaptureAdapterAsync() first.'
  )
}

/**
 * 设置截图适配器（用于测试或手动注入）
 */
export function setCaptureAdapter(adapter: CaptureAdapter): void {
  _captureAdapter = adapter
}

/**
 * 重置适配器缓存（用于测试）
 */
export function resetCaptureAdapter(): void {
  _captureAdapter = null
  _captureAdapterInitPromise = null
}
