/**
 * 主题适配器
 */
import { getPlatform } from './platform'

export type ThemeMode = 'light' | 'dark' | 'auto'

export interface ThemeAdapter {
  /** 获取当前主题模式 */
  getTheme(): ThemeMode
  /** 监听主题变化 */
  onThemeChange(callback: (theme: ThemeMode) => void): () => void
  /** 应用主题到 DOM */
  applyTheme(theme: ThemeMode): void
}

class UtoolsThemeAdapter implements ThemeAdapter {
  getTheme(): ThemeMode {
    const body = document.body
    if (body.classList.contains('utools-dark')) return 'dark'
    return 'light'
  }

  onThemeChange(callback: (theme: ThemeMode) => void): () => void {
    const observer = new MutationObserver(() => {
      callback(this.getTheme())
    })
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] })

    // 同时注册 uTools 回调
    try {
      utools.onThemeChange((type: string) => {
        const theme = type === 'dark' || (type === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)
          ? 'dark'
          : 'light'
        callback(theme)
      })
    } catch {
      // 忽略
    }

    return () => observer.disconnect()
  }

  applyTheme(theme: ThemeMode): void {
    const html = document.documentElement
    if (theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      html.classList.add('utools-dark')
      html.classList.add('dark')
    } else {
      html.classList.remove('utools-dark')
      html.classList.remove('dark')
    }
  }
}

class WebThemeAdapter implements ThemeAdapter {
  getTheme(): ThemeMode {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark'
    return 'light'
  }

  onThemeChange(callback: (theme: ThemeMode) => void): () => void {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => {
      callback(e.matches ? 'dark' : 'light')
    }
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }

  applyTheme(theme: ThemeMode): void {
    const html = document.documentElement
    if (theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      html.classList.add('dark')
    } else {
      html.classList.remove('dark')
    }
  }
}

let _themeAdapter: ThemeAdapter | null = null

export function getThemeAdapter(): ThemeAdapter {
  if (_themeAdapter) return _themeAdapter

  const platform = getPlatform()
  switch (platform) {
    case 'utools':
      _themeAdapter = new UtoolsThemeAdapter()
      break
    default:
      _themeAdapter = new WebThemeAdapter()
  }
  return _themeAdapter
}

export function setThemeAdapter(adapter: ThemeAdapter): void {
  _themeAdapter = adapter
}
