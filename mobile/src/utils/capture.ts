/**
 * 截图适配器 - 主包共享能力，供 pages-tools 与 pages-memory 等分包引用。
 * 放在主包 utils，禁止分包之间互相引用运行时模块。
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
