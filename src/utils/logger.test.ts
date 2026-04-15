import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// 保存原始 console 方法
const originalConsole = {
  debug: console.debug,
  info: console.info,
  warn: console.warn,
  error: console.error
}

describe('logger', () => {
  let debugSpy: ReturnType<typeof vi.spyOn>
  let infoSpy: ReturnType<typeof vi.spyOn>
  let warnSpy: ReturnType<typeof vi.spyOn>
  let errorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    // 重置模块缓存以重新加载 logger
    vi.resetModules()
    
    // 创建 spy
    debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('应该导出 log 对象', async () => {
    const { log } = await import('./logger')
    
    expect(log).toBeDefined()
    expect(typeof log.d).toBe('function')
    expect(typeof log.i).toBe('function')
    expect(typeof log.w).toBe('function')
    expect(typeof log.e).toBe('function')
  })

  it('log.d 应该输出 debug 级别日志', async () => {
    const { log } = await import('./logger')
    
    log.d('debug message')
    
    expect(debugSpy).toHaveBeenCalled()
    const callArgs = debugSpy.mock.calls[0]
    expect(callArgs[0]).toMatch(/\[DBG \d{2}:\d{2}:\d{2}\.\d{3}\]/)
  })

  it('log.i 应该输出 info 级别日志', async () => {
    const { log } = await import('./logger')
    
    log.i('info message')
    
    expect(infoSpy).toHaveBeenCalled()
    const callArgs = infoSpy.mock.calls[0]
    expect(callArgs[0]).toMatch(/\[INF \d{2}:\d{2}:\d{2}\.\d{3}\]/)
  })

  it('log.w 应该输出 warn 级别日志', async () => {
    const { log } = await import('./logger')
    
    log.w('warning message')
    
    expect(warnSpy).toHaveBeenCalled()
    const callArgs = warnSpy.mock.calls[0]
    expect(callArgs[0]).toMatch(/\[WRN \d{2}:\d{2}:\d{2}\.\d{3}\]/)
  })

  it('log.e 应该输出 error 级别日志', async () => {
    const { log } = await import('./logger')
    
    log.e('error message')
    
    expect(errorSpy).toHaveBeenCalled()
    const callArgs = errorSpy.mock.calls[0]
    expect(callArgs[0]).toMatch(/\[ERR \d{2}:\d{2}:\d{2}\.\d{3}\]/)
  })

  it('应该支持多个参数', async () => {
    const { log } = await import('./logger')
    
    log.i('message', { key: 'value' }, 123, true)
    
    expect(infoSpy).toHaveBeenCalled()
    const callArgs = infoSpy.mock.calls[0]
    expect(callArgs[1]).toBe('message')
    expect(callArgs[2]).toEqual({ key: 'value' })
    expect(callArgs[3]).toBe(123)
    expect(callArgs[4]).toBe(true)
  })

  it('应该支持对象参数', async () => {
    const { log } = await import('./logger')
    const testObj = { name: 'test', data: [1, 2, 3] }
    
    log.d(testObj)
    
    expect(debugSpy).toHaveBeenCalled()
    const callArgs = debugSpy.mock.calls[0]
    expect(callArgs[1]).toEqual(testObj)
  })

  it('应该支持 Error 对象', async () => {
    const { log } = await import('./logger')
    const error = new Error('Test error')
    
    log.e('An error occurred:', error)
    
    expect(errorSpy).toHaveBeenCalled()
    const callArgs = errorSpy.mock.calls[0]
    expect(callArgs[1]).toBe('An error occurred:')
    expect(callArgs[2]).toBe(error)
  })

  it('时间戳应该符合格式', async () => {
    const { log } = await import('./logger')
    
    log.i('test')
    
    const callArgs = infoSpy.mock.calls[0]
    const prefix = callArgs[0] as string
    
    // 格式: [INF HH:MM:SS.mmm]
    expect(prefix).toMatch(/^\[INF \d{2}:\d{2}:\d{2}\.\d{3}\]$/)
  })
})
