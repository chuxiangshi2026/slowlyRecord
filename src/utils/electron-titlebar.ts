/**
 * Electron 无边框窗口：右上角窗口按钮（最小化/最大化/关闭）的配色同步
 *
 * - 亚克力开启：overlay 透明，让页面背景/背板透出（Windows 上按钮 hover 底色可能有细微瑕疵）
 * - 否则：跟随明暗主题的头部底色，与 .app-header 无缝
 * 非 Electron 环境为空操作。
 */
export function syncElectronTitleBar(acrylic?: boolean): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  const api = (window as any).electronAPI
  if (!api?.setTitleBarOverlay) return
  const html = document.documentElement
  const dark = html.classList.contains('utools-dark')
  const isAcrylic = acrylic ?? !!document.body?.classList.contains('app-bg-acrylic')
  try {
    api.setTitleBarOverlay({
      // 注意：Electron 的 setTitleBarOverlay 不接受 'transparent' 关键字，透明要用 rgba(0,0,0,0)
      color: isAcrylic ? 'rgba(0,0,0,0)' : (dark ? '#1e1e1e' : '#eaf1ea'),
      symbolColor: dark ? '#d7e3dd' : '#2f3e39',
      height: 36,
    })?.catch?.(() => { /* 忽略：配色失败不影响功能 */ })
  } catch { /* 忽略 */ }
}
