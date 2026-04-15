import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSignsStore } from './signs'

// Mock http
vi.mock('@/utils/http', () => ({
  default: {
    get: vi.fn()
  }
}))

import http from '@/utils/http'

describe('useSignsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.resetAllMocks()
  })

  describe('初始状态', () => {
    it('应该有正确的初始值', () => {
      const store = useSignsStore()

      expect(store.infos).toEqual({})
    })
  })

  describe('updateInfos', () => {
    it('应该更新 infos', () => {
      const store = useSignsStore()
      const signInfo = { checkInTime: '09:00', status: 'present' }
      
      store.updateInfos(signInfo)
      
      expect(store.infos).toEqual(signInfo)
    })

    it('应该合并新属性而不是替换', () => {
      const store = useSignsStore()
      
      store.updateInfos({ checkInTime: '09:00' })
      store.updateInfos({ location: 'Office' })
      
      expect(store.infos).toEqual({ checkInTime: '09:00', location: 'Office' })
    })

    it('应该更新已有属性', () => {
      const store = useSignsStore()
      
      store.updateInfos({ checkInTime: '09:00', status: 'present' })
      store.updateInfos({ status: 'late' })
      
      expect(store.infos).toEqual({ checkInTime: '09:00', status: 'late' })
    })

    it('应该支持空对象', () => {
      const store = useSignsStore()
      
      store.updateInfos({ checkInTime: '09:00' })
      store.updateInfos({})
      
      expect(store.infos).toEqual({ checkInTime: '09:00' })
    })

    it('应该支持复杂对象', () => {
      const store = useSignsStore()
      const complexInfo = {
        today: { checked: true, time: '09:00' },
        history: [
          { date: '2024-01-01', status: 'present' },
          { date: '2024-01-02', status: 'late' }
        ]
      }
      
      store.updateInfos(complexInfo)
      
      expect(store.infos).toEqual(complexInfo)
    })
  })

  describe('getTime', () => {
    it('应该调用 http.get 并传递参数', async () => {
      const store = useSignsStore()
      const mockData = { serverTime: '2024-01-15 09:30:00', timestamp: 1705312200000 }
      vi.mocked(http.get).mockResolvedValue({ data: mockData } as any)
      
      const payload = { userId: 'user-1' }
      const result = await store.getTime(payload)
      
      expect(http.get).toHaveBeenCalledWith('/signs/time', payload)
      expect(result).toEqual(mockData)
    })

    it('应该处理空参数', async () => {
      const store = useSignsStore()
      const mockData = { serverTime: '2024-01-15 09:30:00' }
      vi.mocked(http.get).mockResolvedValue({ data: mockData } as any)
      
      const result = await store.getTime({})
      
      expect(http.get).toHaveBeenCalledWith('/signs/time', {})
      expect(result).toEqual(mockData)
    })

    it('应该处理请求失败', async () => {
      const store = useSignsStore()
      vi.mocked(http.get).mockRejectedValue(new Error('Network error'))
      
      await expect(store.getTime({})).rejects.toThrow('Network error')
    })

    it('应该处理 401 未授权错误', async () => {
      const store = useSignsStore()
      vi.mocked(http.get).mockRejectedValue(new Error('Unauthorized'))
      
      await expect(store.getTime({})).rejects.toThrow('Unauthorized')
    })
  })

  describe('综合场景', () => {
    it('应该支持完整的签到流程', async () => {
      const store = useSignsStore()
      const serverTimeData = { serverTime: '2024-01-15 09:00:00' }
      
      vi.mocked(http.get).mockResolvedValue({ data: serverTimeData } as any)
      
      // 获取服务器时间
      const timeResult = await store.getTime({ userId: 'user-1' })
      
      // 更新签到信息
      store.updateInfos({
        checkInTime: timeResult.serverTime,
        status: 'present',
        location: 'Office'
      })
      
      expect(store.infos).toEqual({
        checkInTime: '2024-01-15 09:00:00',
        status: 'present',
        location: 'Office'
      })
    })

    it('应该支持多次更新签到信息', () => {
      const store = useSignsStore()
      
      // 第一次签到
      store.updateInfos({ checkInTime: '09:00', status: 'present' })
      expect(store.infos.checkInTime).toBe('09:00')
      
      // 更新签退时间
      store.updateInfos({ checkOutTime: '18:00' })
      expect(store.infos.checkInTime).toBe('09:00')
      expect(store.infos.checkOutTime).toBe('18:00')
      
      // 更新状态
      store.updateInfos({ status: 'completed' })
      expect(store.infos.status).toBe('completed')
      expect(store.infos.checkInTime).toBe('09:00')
      expect(store.infos.checkOutTime).toBe('18:00')
    })
  })
})
