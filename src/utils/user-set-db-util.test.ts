/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getSetDb, addAndUpdateSetDb, removeSetDb, updateSetDbWithRetry } from './user-set-db-util'

// Mock DB adapter
const mockAllDocs = vi.fn()
const mockGet = vi.fn()
const mockRemove = vi.fn()
const mockPromisesPut = vi.fn()
const mockPromisesRemove = vi.fn()

vi.mock('@/adapters/db', () => ({
  getDbAdapter: () => ({
    get: mockGet,
    allDocs: mockAllDocs,
    remove: mockRemove,
    promises: {
      put: mockPromisesPut,
      remove: mockPromisesRemove,
    },
  }),
}))

// Mock logger
vi.mock('@/utils/logger', () => ({
  log: {
    d: vi.fn(),
    i: vi.fn(),
    w: vi.fn(),
    e: vi.fn(),
  },
}))

const DB_KEY_USER_SET = 'user-set'

describe('user-set-db-util', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getSetDb', () => {
    it('应该返回用户设置', () => {
      const mockUserSet = {
        _id: DB_KEY_USER_SET,
        _rev: 'rev1',
        theme: 'dark',
        fontSize: 14,
      }
      mockAllDocs.mockReturnValue([mockUserSet])

      const result = getSetDb()

      expect(result).toEqual(mockUserSet)
      expect(mockAllDocs).toHaveBeenCalledWith(DB_KEY_USER_SET)
    })

    it('数据库为空时返回 null', () => {
      mockAllDocs.mockReturnValue([])

      const result = getSetDb()

      expect(result).toBeNull()
    })

    it('静默模式不输出日志', () => {
      const mockUserSet = { _id: DB_KEY_USER_SET }
      mockAllDocs.mockReturnValue([mockUserSet])

      const result = getSetDb(true)

      expect(result).toEqual(mockUserSet)
    })
  })

  describe('addAndUpdateSetDb', () => {
    it('应该成功保存设置', async () => {
      const userSet: any = {
        _id: DB_KEY_USER_SET,
        theme: 'light',
        fontSize: 16,
      }
      mockPromisesPut.mockResolvedValue({ ok: true, rev: 'new-rev' })

      const result = await addAndUpdateSetDb(userSet)

      expect(result.ok).toBe(true)
      expect(mockPromisesPut).toHaveBeenCalled()
      // 应更新 _rev
      expect(userSet._rev).toBe('new-rev')
    })

    it('userSet 为 null 时返回错误', async () => {
      const result = await addAndUpdateSetDb(null)

      expect(result.ok).toBe(false)
      expect(result.error).toBe(true)
      expect(mockPromisesPut).not.toHaveBeenCalled()
    })

    it('保存失败时返回错误信息', async () => {
      const userSet: any = { _id: DB_KEY_USER_SET }
      mockPromisesPut.mockResolvedValue({
        ok: false,
        error: true,
        message: 'Save error',
      })

      const result = await addAndUpdateSetDb(userSet)

      expect(result.ok).toBe(false)
      expect(result.error).toBe(true)
    })

    it('_rev 过期冲突时重读重试写入，不再静默丢掉本次设置', async () => {
      let latest: any = { _id: DB_KEY_USER_SET, _rev: 'r1', translationPlatform: 'siliconflow' }
      mockAllDocs.mockImplementation(() => [latest])
      mockPromisesPut
        .mockImplementationOnce(async () => ({ ok: false, error: true, message: 'Document update conflict' }))
        .mockImplementationOnce(async (doc: any) => {
          latest = { ...doc, _rev: 'r2' }
          return { ok: true, rev: 'r2' }
        })

      const userSet: any = { _id: DB_KEY_USER_SET, _rev: 'r1', translationPlatform: 'bilibili' }
      const result = await addAndUpdateSetDb(userSet)

      expect(result.ok).toBe(true)
      expect(mockPromisesPut).toHaveBeenCalledTimes(2)
      expect(latest.translationPlatform).toBe('bilibili')
    })
  })

  describe('updateSetDbWithRetry', () => {
    it('冲突后重新读取最新文档并重新应用修改，不覆盖并发字段', async () => {
      let latest: any = { _id: DB_KEY_USER_SET, _rev: 'r1', theme: 'light', focusMode: { opacity: 1 } }
      mockAllDocs.mockImplementation(() => [latest])
      mockPromisesPut
        .mockImplementationOnce(async (doc: any) => {
          latest = { ...doc, _rev: 'r2', theme: 'dark' }
          return { ok: false, message: 'conflict' }
        })
        .mockImplementationOnce(async (doc: any) => {
          latest = { ...doc, _rev: 'r3' }
          return { ok: true, rev: 'r3' }
        })

      const ok = await updateSetDbWithRetry((doc) => {
        doc.focusMode = { ...(doc.focusMode || {}), opacity: 0.5 }
      })

      expect(ok).toBe(true)
      expect(mockPromisesPut).toHaveBeenCalledTimes(2)
      expect(latest.theme).toBe('dark')
      expect(latest.focusMode.opacity).toBe(0.5)
    })

    it('连续冲突直到重试耗尽时返回 false', async () => {
      mockAllDocs.mockReturnValue([{ _id: DB_KEY_USER_SET, _rev: 'r1', theme: 'light' }])
      mockPromisesPut.mockResolvedValue({ ok: false, message: 'conflict' })

      await expect(updateSetDbWithRetry(() => {}, 3)).resolves.toBe(false)
      expect(mockPromisesPut).toHaveBeenCalledTimes(3)
    })

    it('非冲突错误不重试', async () => {
      mockAllDocs.mockReturnValue([{ _id: DB_KEY_USER_SET, _rev: 'r1', theme: 'light' }])
      mockPromisesPut.mockResolvedValue({ ok: false, message: 'quota exceeded' })

      await expect(updateSetDbWithRetry(() => {})).resolves.toBe(false)
      expect(mockPromisesPut).toHaveBeenCalledTimes(1)
    })
  })

  describe('removeSetDb', () => {
    it('应该成功删除设置', async () => {
      mockPromisesRemove.mockResolvedValue({ ok: true })

      removeSetDb('test-id')
      await Promise.resolve()

      expect(mockPromisesRemove).toHaveBeenCalledWith('test-id')
    })

    it('删除失败时输出错误日志', async () => {
      mockPromisesRemove.mockResolvedValue({
        ok: false,
        error: true,
        message: 'Remove error',
      })

      expect(() => removeSetDb('test-id')).not.toThrow()
      await Promise.resolve()
      expect(mockPromisesRemove).toHaveBeenCalledWith('test-id')
    })
  })
})
