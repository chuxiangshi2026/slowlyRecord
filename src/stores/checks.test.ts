import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useChecksStore } from './checks'

// Mock http
vi.mock('@/utils/http', () => ({
  default: {
    post: vi.fn()
  }
}))

import http from '@/utils/http'

describe('useChecksStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.resetAllMocks()
  })

  describe('login', () => {
    it('应该调用 http.post 并返回结果', async () => {
      const store = useChecksStore()
      const mockData = { success: true, token: 'auth-token' }
      vi.mocked(http.post).mockResolvedValue({ data: mockData } as any)
      
      const result = await store.login()
      
      expect(http.post).toHaveBeenCalledWith('/users/login')
      expect(result).toEqual(mockData)
    })

    it('应该处理登录失败', async () => {
      const store = useChecksStore()
      const mockError = new Error('Login failed')
      vi.mocked(http.post).mockRejectedValue(mockError)
      
      await expect(store.login()).rejects.toThrow('Login failed')
    })

    it('应该处理网络错误', async () => {
      const store = useChecksStore()
      vi.mocked(http.post).mockRejectedValue(new Error('Network error'))
      
      await expect(store.login()).rejects.toThrow('Network error')
    })

    it('应该处理 401 未授权', async () => {
      const store = useChecksStore()
      vi.mocked(http.post).mockRejectedValue(new Error('Unauthorized'))
      
      await expect(store.login()).rejects.toThrow('Unauthorized')
    })

    it('应该处理返回的用户数据', async () => {
      const store = useChecksStore()
      const mockData = { 
        success: true, 
        token: 'auth-token',
        user: { id: '1', name: '张三' }
      }
      vi.mocked(http.post).mockResolvedValue({ data: mockData } as any)
      
      const result = await store.login()
      
      expect(result.user).toEqual({ id: '1', name: '张三' })
    })
  })
})
