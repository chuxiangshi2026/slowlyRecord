/**
 * 主题模式管理：跟随系统 / 浅色 / 深色 三档
 *
 * 页面内容配色由全局 CSS 变量负责（App.vue 中定义，每页根节点挂 :class="themeClass"），
 * 这里只负责模式状态、系统主题检测和原生导航栏/tabBar/窗口背景色同步。
 */
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

export type ThemeMode = 'system' | 'light' | 'dark'

const THEME_STORAGE_KEY = 'slowlyrecord-theme-mode'

// 微信小程序 / 抖音小程序无 localStorage，persistedstate 默认 storage 会静默失效，
// 统一用 uni storage 做持久化后端（同 useUserProfile）
const uniStorage = {
  getItem: (key: string): string | null => {
    try {
      const value = uni.getStorageSync(key)
      return typeof value === 'string' && value ? value : null
    } catch {
      return null
    }
  },
  setItem: (key: string, value: string) => {
    try {
      uni.setStorageSync(key, value)
    } catch {
      // 存储失败不影响本次使用
    }
  },
  removeItem: (key: string) => {
    try {
      uni.removeStorageSync(key)
    } catch {
      // ignore
    }
  },
}

/** 读取系统当前是否深色（微信小程序需在 app.json 开启 darkmode 才能拿到该字段） */
function getSystemDark(): boolean {
  try {
    // #ifdef MP-WEIXIN || MP-TOUTIAO
    return (uni.getSystemInfoSync() as any).theme === 'dark'
    // #endif
    // #ifdef H5 || APP-PLUS
    return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches
    // #endif
  } catch {
    return false
  }
  // eslint-disable-next-line no-unreachable
  return false
}

export const useTheme = defineStore('theme', () => {
  const mode = ref<ThemeMode>('system')
  const systemDark = ref(false)

  const isDark = computed(() => mode.value === 'dark' || (mode.value === 'system' && systemDark.value))
  /** 页面根节点类名：暗色时挂 theme-dark，触发全局 CSS 变量覆盖 */
  const themeClass = computed(() => (isDark.value ? 'theme-dark' : ''))
  const modeText = computed(() => ({ system: '跟随系统', light: '浅色', dark: '深色' } as Record<ThemeMode, string>)[mode.value])

  function setMode(m: ThemeMode) {
    mode.value = m
    apply()
  }

  /** 同步系统主题到 state，返回是否有变化 */
  function syncSystemTheme(): boolean {
    const dark = getSystemDark()
    const changed = dark !== systemDark.value
    systemDark.value = dark
    return changed
  }

  /** 套用原生导航栏 / tabBar / 窗口背景色（wx.setNavigationBarColor 只作用于当前页，需在页面 onShow 时重放） */
  function apply() {
    const dark = isDark.value
    try {
      uni.setNavigationBarColor({
        frontColor: dark ? '#ffffff' : '#000000',
        backgroundColor: dark ? '#151a18' : '#F8F8F8',
      })
    } catch { /* 平台不支持时忽略 */ }
    try {
      uni.setTabBarStyle({
        color: dark ? '#77847e' : '#999999',
        selectedColor: dark ? '#83c5a8' : '#52796f',
        backgroundColor: dark ? '#151a18' : '#FFFFFF',
        borderStyle: dark ? 'white' : 'black',
      })
    } catch { /* 非 tabBar 环境时忽略 */ }
    try {
      uni.setBackgroundColor({ backgroundColor: dark ? '#151a18' : '#f5f5f5' })
    } catch { /* 平台不支持时忽略 */ }
  }

  return { mode, systemDark, isDark, themeClass, modeText, setMode, syncSystemTheme, apply }
}, {
  persist: {
    key: THEME_STORAGE_KEY,
    storage: uniStorage,
  },
})
