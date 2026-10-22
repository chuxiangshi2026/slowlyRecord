/**
 * 截图适配器 - 仅被分包页面引用
 * 从 adapters/ 迁移到分包目录，避免打入主包
 */

export interface CaptureResult {
  base64: string
  path?: string
}

export interface CaptureAdapter {
  capture(sourceType?: Array<'album' | 'camera'>): Promise<CaptureResult>
}

class UniAppCaptureAdapter implements CaptureAdapter {
  async capture(sourceType: Array<'album' | 'camera'> = ['album', 'camera']): Promise<CaptureResult> {
    return new Promise((resolve, reject) => {
      uni.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType,
        success: (res: any) => {
          const tempPath = res.tempFilePaths?.[0] || res.tempFiles?.[0]?.path
          if (!tempPath) {
            reject(new Error('获取图片失败'))
            return
          }

          // #ifdef MP-WEIXIN || MP-TOUTIAO
          try {
            const fs = uni.getFileSystemManager()
            const base64 = fs.readFileSync(tempPath, 'base64') as string
            resolve({ base64, path: tempPath })
          } catch (e) {
            reject(e)
          }
          // #endif

          // #ifdef H5 || APP-PLUS
          fetch(tempPath)
            .then(r => r.blob())
            .then(blob => {
              const reader = new FileReader()
              reader.onload = () => {
                const base64 = (reader.result as string).split(',')[1]
                resolve({ base64, path: tempPath })
              }
              reader.onerror = () => reject(new Error('读取图片失败'))
              reader.readAsDataURL(blob)
            })
            .catch(reject)
          // #endif
        },
        fail: (err: any) => reject(err || new Error('选择图片失败')),
      })
    })
  }
}

let _captureAdapter: CaptureAdapter | null = null

export function getCaptureAdapter(): CaptureAdapter {
  if (!_captureAdapter) {
    _captureAdapter = new UniAppCaptureAdapter()
  }
  return _captureAdapter
}
