/**
 * 小程序/UniApp 截图适配器实现
 *
 * 使用 wx.chooseImage / uni.chooseImage 调用相机/相册
 */
import type { CaptureAdapter, CaptureResult, OCRResult } from '../capture'

declare const uni: any

export class CaptureAdapterMiniProgram implements CaptureAdapter {
  async capture(): Promise<CaptureResult> {
    return new Promise((resolve, reject) => {
      const uniApi = (typeof uni !== 'undefined' ? uni : (window as any).wx) as any
      if (!uniApi?.chooseImage) {
        reject(new Error('chooseImage API 不可用'))
        return
      }

      uniApi.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: (res: any) => {
          const tempFilePath = res.tempFilePaths?.[0] || res.tempFiles?.[0]?.path
          if (!tempFilePath) {
            reject(new Error('获取图片失败'))
            return
          }

          // 读取文件为 base64
          const fs = uniApi.getFileSystemManager?.()
          if (fs) {
            try {
              const base64 = fs.readFileSync(tempFilePath, 'base64')
              resolve({ base64, path: tempFilePath })
            } catch (e) {
              reject(e)
            }
          } else {
            // H5 环境用 FileReader
            this._readH5File(tempFilePath, resolve, reject)
          }
        },
        fail: (err: any) => reject(err || new Error('选择图片失败')),
      })
    })
  }

  async ocr(_imageData: string): Promise<OCRResult[]> {
    // 小程序端 OCR 可调用微信 AI 接口或第三方云函数
    throw new Error('小程序端 OCR 请通过云函数或第三方 API 调用')
  }

  private _readH5File(
    filePath: string,
    resolve: (value: CaptureResult) => void,
    reject: (reason?: any) => void
  ) {
    fetch(filePath)
      .then(res => res.blob())
      .then(blob => {
        const reader = new FileReader()
        reader.onload = () => {
          const base64WithPrefix = reader.result as string
          resolve({ base64: base64WithPrefix.split(',')[1], path: filePath })
        }
        reader.onerror = () => reject(new Error('图片读取失败'))
        reader.readAsDataURL(blob)
      })
      .catch(reject)
  }
}
