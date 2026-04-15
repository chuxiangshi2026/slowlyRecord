import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useUsersStore } from './users'

// Mock http
vi.mock('@/utils/http', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn()
  }
}))

import http from '@/utils/http'

describe('useUsersStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.resetAllMocks()
  })

  describe('初始状态', () => {
    it('应该有正确的初始值', () => {
      const store = useUsersStore()

      expect(store.token).toBe('')
      expect(store.infos).toEqual({})
    })
  })

  describe('updateToken', () => {
    it('应该更新 token', () => {
      const store = useUsersStore()
      
      store.updateToken('test-token-123')
      
      expect(store.token).toBe('test-token-123')
    })

    it('应该支持空字符串 token', () => {
      const store = useUsersStore()
      
      store.updateToken('test-token')
      expect(store.token).toBe('test-token')
      
      store.updateToken('')
      expect(store.token).toBe('')
    })
  })

  describe('clearToken', () => {
    it('应该清除 token', () => {
      const store = useUsersStore()
      
      store.updateToken('test-token')
      store.clearToken()
      
      expect(store.token).toBe('')
    })

    it('多次调用应该保持 token 为空', () => {
      const store = useUsersStore()
      
      store.updateToken('test-token')
      store.clearToken()
      store.clearToken()
      
      expect(store.token).toBe('')
    })
  })

  describe('updateInfos', () => {
    it('应该更新 infos', () => {
      const store = useUsersStore()
      const userInfo = { name: '张三', age: 25 }
      
      store.updateInfos(userInfo)
      
      expect(store.infos).toEqual(userInfo)
    })

    it('应该合并新属性而不是替换', () => {
      const store = useUsersStore()
      
      store.updateInfos({ name: '张三' })
      store.updateInfos({ age: 25 })
      
      expect(store.infos).toEqual({ name: '张三', age: 25 })
    })

    it('应该更新已有属性', () => {
      const store = useUsersStore()
      
      store.updateInfos({ name: '张三', age: 25 })
      store.updateInfos({ name: '李四' })
      
      expect(store.infos).toEqual({ name: '李四', age: 25 })
    })

    it('应该支持空对象', () => {
      const store = useUsersStore()
      
      store.updateInfos({ name: '张三' })
      store.updateInfos({})
      
      expect(store.infos).toEqual({ name: '张三' })
    })
  })

  describe('login', () => {
    it('应该调用 http.post 并传递参数', async () => {
      const store = useUsersStore()
      const mockResponse = { token: 'abc123', user: { name: '张三' } }
      vi.mocked(http.post).mockResolvedValue(mockResponse)
      
      const payload = { username: 'test', password: '123456' }
      const result = await store.login(payload)
      
      expect(http.post).toHaveBeenCalledWith('/users/login', payload)
      expect(result).toEqual(mockResponse)
    })

    it('应该处理登录失败', async () => {
      const store = useUsersStore()
      const mockError = new Error('Invalid credentials')
      vi.mocked(http.post).mockRejectedValue(mockError)
      
      await expect(store.login({ username: 'test', password: 'wrong' }))
        .rejects.toThrow('Invalid credentials')
    })
  })

  describe('getInfos', () => {
    it('应该调用 http.get', async () => {
      const store = useUsersStore()
      const mockResponse = { name: '张三', email: 'zhangsan@example.com' }
      vi.mocked(http.get).mockResolvedValue(mockResponse)
      
      const result = await store.getInfos()
      
      expect(http.get).toHaveBeenCalledWith('/users/infos')
      expect(result).toEqual(mockResponse)
    })

    it('应该处理获取信息失败', async () => {
      const store = useUsersStore()
      vi.mocked(http.get).mockRejectedValue(new Error('Unauthorized'))
      
      await expect(store.getInfos()).rejects.toThrow('Unauthorized')
    })
  })

  describe('状态持久化场景', () => {
    it('应该支持完整的登录流程', async () => {
      const store = useUsersStore()
      const loginResponse = { token: 'auth-token-123', userId: 'user-1' }
      const userInfo = { name: '张三', email: 'zhangsan@test.com' }
      
      vi.mocked(http.post).mockResolvedValue(loginResponse)
      vi.mocked(http.get).mockResolvedValue(userInfo)
      
      // 登录
      const loginResult = await store.login({ username: 'zhangsan', password: '123456' })
      store.updateToken(loginResult.token)
      
      // 获取用户信息
      const infoResult = await store.getInfos()
      store.updateInfos(infoResult)
      
      expect(store.token).toBe('auth-token-123')
      expect(store.infos).toEqual(userInfo)
    })

    it('应该支持登出流程', () => {
      const store = useUsersStore()
      
      // 模拟登录状态
      store.updateToken('auth-token')
      store.updateInfos({ name: '张三' })
      
      // 登出
      store.clearToken()
      
      expect(store.token).toBe('')
      // infos 应该保留
      expect(store.infos).toEqual({ name: '张三' })
    })
  })
})
