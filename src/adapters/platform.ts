/**
 * 平台检测模块
 * 
 * 用于检测当前运行环境，支持以下平台：
 * - uTools 插件
 * - Electron 桌面应用
 * - Web 浏览器
 * - 微信小程序
 * - UniApp (Android/iOS)
 */

export type Platform = 'utools' | 'electron' | 'web' | 'mp-weixin' | 'app-android' | 'app-ios'

// 缓存检测结果
let _platform: Platform | null = null

/**
 * 检测是否在 uTools 环境中
 */
export function isUtools(): boolean {
  return typeof window !== 'undefined' && 
    typeof (window as any).utools !== 'undefined' && 
    !!(window as any).utools.getPath
}

/**
 * 检测是否在 Electron 环境中
 */
export function isElectron(): boolean {
  if (typeof window === 'undefined') return false
  // 通过 window.electronAPI（preload 暴露）或 navigator.userAgent 判断
  return !!(window as any).electronAPI || 
    /electron/i.test(navigator.userAgent)
}

/**
 * 检测是否在 Web 浏览器环境中（非 uTools、非 Electron）
 */
export function isWeb(): boolean {
  if (typeof window === 'undefined') return false
  return !isUtools() && !isElectron() && !isMiniProgram() && !isApp()
}

/**
 * 检测是否在微信小程序环境中
 */
export function isMiniProgram(): boolean {
  if (typeof window === 'undefined') return false
  return typeof (window as any).wx !== 'undefined' && 
    typeof (window as any).wx.getSystemInfoSync !== 'undefined'
}

/**
 * 检测是否在 UniApp App 端（Android/iOS）
 */
export function isApp(): boolean {
  if (typeof window === 'undefined') return false
  // UniApp App 端通过 uni 对象和平台标识判断
  const uni = (window as any).uni
  if (!uni) return false
  const systemInfo = uni.getSystemInfoSync?.()
  if (!systemInfo) return false
  // UniApp App 端的 platform 为 'android' 或 'ios'
  return systemInfo.platform === 'android' || systemInfo.platform === 'ios'
}

/**
 * 检测是否为移动端（小程序或 App）
 */
export function isMobile(): boolean {
  return isMiniProgram() || isApp()
}

/**
 * 检测是否为桌面端（uTools 或 Electron）
 */
export function isDesktop(): boolean {
  return isUtools() || isElectron()
}

/**
 * 获取当前平台标识
 * 优先级：uTools > Electron > 小程序 > App > Web
 */
export function getPlatform(): Platform {
  if (_platform) return _platform
  
  if (isUtools()) {
    _platform = 'utools'
  } else if (isElectron()) {
    _platform = 'electron'
  } else if (isMiniProgram()) {
    _platform = 'mp-weixin'
  } else if (isApp()) {
    // 区分 Android 和 iOS
    const uni = (window as any).uni
    const systemInfo = uni?.getSystemInfoSync?.()
    _platform = systemInfo?.platform === 'ios' ? 'app-ios' : 'app-android'
  } else {
    _platform = 'web'
  }
  
  return _platform
}

/**
 * 重置平台检测缓存（用于测试或平台切换）
 */
export function resetPlatformCache(): void {
  _platform = null
}

/**
 * 强制设置当前平台（用于测试或特殊场景）
 */
export function setPlatform(platform: Platform): void {
  _platform = platform
}
