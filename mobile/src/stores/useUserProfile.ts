import { ref } from 'vue'
import { defineStore } from 'pinia'

// 用户名仅本地使用：不参与同步、不上传服务器
const USERNAME_STORAGE_KEY = 'slowlyrecord-user-profile'

// 微信小程序 / 抖音小程序无 localStorage，persistedstate 默认 storage 会静默失效，
// 这里统一用 uni storage 做持久化后端（H5 / App 同样适用）
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

export const useUserProfile = defineStore('userProfile', () => {
  // 本地用户名：空字符串表示未设置（展示侧回退默认名）
  const username = ref('')

  /** 设置用户名：自动去除首尾空白，传空串视为清除 */
  function setUsername(name: string) {
    username.value = name.trim()
  }

  return {
    username,
    setUsername,
  }
}, {
  persist: {
    key: USERNAME_STORAGE_KEY,
    storage: uniStorage,
  },
})
