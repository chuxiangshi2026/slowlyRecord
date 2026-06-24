import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock axios
vi.mock('axios', () => {
  const mockAxios = {
    create: vi.fn(() => mockAxios),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  }
  return { default: mockAxios }
})

// Mock element-plus
vi.mock('element-plus', () => ({
  ElMessage: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}))

describe('http', () => {
  let http: any
  let axios: any

  beforeEach(async () => {
    vi.clearAllMocks()
    // 重置模块缓存，确保 http 模块每次都重新加载并触发 axios.create 的副作用
    // 否则 vitest 模块缓存命中后，第二次起 axios.create() 不会再被调用，
    // 「应使用正确的 baseURL 创建 axios 实例」断言会看到 0 次调用
    vi.resetModules()
    axios = (await import('axios')).default
    http = (await import('./http')).default
  })

  describe('get', () => {
    it('应使用 params 传递 GET 参数', async () => {
      const mockResponse = { data: { result: 'ok' }, status: 200 }
      axios.get.mockResolvedValueOnce(mockResponse)

      const result = await http.get('/test', { q: 'hello' })

      expect(axios.get).toHaveBeenCalledWith('/test', {
        params: { q: 'hello' },
      })
      expect(result).toEqual(mockResponse)
    })

    it('应合并 config 参数', async () => {
      const mockResponse = { data: {}, status: 200 }
      axios.get.mockResolvedValueOnce(mockResponse)

      await http.get('/test', { q: 'hello' }, { headers: { 'X-Custom': '1' } })

      expect(axios.get).toHaveBeenCalledWith('/test', {
        params: { q: 'hello' },
        headers: { 'X-Custom': '1' },
      })
    })

    it('无 data 参数时应正常调用', async () => {
      const mockResponse = { data: {}, status: 200 }
      axios.get.mockResolvedValueOnce(mockResponse)

      await http.get('/test')

      expect(axios.get).toHaveBeenCalledWith('/test', {
        params: undefined,
      })
    })
  })

  describe('post', () => {
    it('应传递 data 作为请求体', async () => {
      const mockResponse = { data: { id: 1 }, status: 201 }
      axios.post.mockResolvedValueOnce(mockResponse)

      const data = { name: 'test' }
      const result = await http.post('/api/create', data)

      expect(axios.post).toHaveBeenCalledWith('/api/create', data, undefined)
      expect(result).toEqual(mockResponse)
    })

    it('应传递 config', async () => {
      const mockResponse = { data: {}, status: 200 }
      axios.post.mockResolvedValueOnce(mockResponse)

      await http.post('/api/create', { name: 'test' }, { timeout: 3000 })

      expect(axios.post).toHaveBeenCalledWith('/api/create', { name: 'test' }, { timeout: 3000 })
    })
  })

  describe('put', () => {
    it('应调用 PUT 方法', async () => {
      const mockResponse = { data: {}, status: 200 }
      axios.put.mockResolvedValueOnce(mockResponse)

      await http.put('/api/update/1', { name: 'updated' })

      expect(axios.put).toHaveBeenCalledWith('/api/update/1', { name: 'updated' }, undefined)
    })

    it('应支持 config 参数', async () => {
      const mockResponse = { data: {}, status: 200 }
      axios.put.mockResolvedValueOnce(mockResponse)

      await http.put('/api/update/1', { name: 'updated' }, { headers: { 'Content-Type': 'application/json' } })

      expect(axios.put).toHaveBeenCalledWith('/api/update/1', { name: 'updated' }, { headers: { 'Content-Type': 'application/json' } })
    })
  })

  describe('patch', () => {
    it('应调用 PATCH 方法', async () => {
      const mockResponse = { data: {}, status: 200 }
      axios.patch.mockResolvedValueOnce(mockResponse)

      await http.patch('/api/patch/1', { field: 'partial' })

      expect(axios.patch).toHaveBeenCalledWith('/api/patch/1', { field: 'partial' }, undefined)
    })
  })

  describe('delete', () => {
    it('DELETE 请求应将 data 放入 config.data', async () => {
      const mockResponse = { data: {}, status: 200 }
      axios.delete.mockResolvedValueOnce(mockResponse)

      await http.delete('/api/delete/1', { id: 1 })

      expect(axios.delete).toHaveBeenCalledWith('/api/delete/1', {
        data: { id: 1 },
      })
    })

    it('应合并 config 参数', async () => {
      const mockResponse = { data: {}, status: 200 }
      axios.delete.mockResolvedValueOnce(mockResponse)

      await http.delete('/api/delete/1', { id: 1 }, { headers: { 'Authorization': 'Bearer token' } })

      expect(axios.delete).toHaveBeenCalledWith('/api/delete/1', {
        data: { id: 1 },
        headers: { 'Authorization': 'Bearer token' },
      })
    })
  })

  describe('axios 实例创建', () => {
    it('应使用正确的 baseURL 创建 axios 实例', () => {
      // http 模块在导入时已调用 axios.create 完成实例化
      // timeout 放宽到 30s 以适配 AI 翻译引擎的首响应延迟（之前 5s 会误超时）
      expect(axios.create).toHaveBeenCalledWith({
        baseURL: 'https://openapi.youdao.com/api',
        timeout: 30000,
      })
    })
  })
})
