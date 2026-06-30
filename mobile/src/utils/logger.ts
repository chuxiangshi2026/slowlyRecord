/**
 * 移动端轻量日志工具
 *
 * 与桌面端 src/utils/logger.ts 的 API 对齐：log.d/log.i/log.w/log.e。
 * 开发环境下输出到 console，生产环境只保留 warn/error。
 *
 * 注意：UniApp 没有 __LOG_LEVEL__ define，这里通过 NODE_ENV 简单切换；
 * 后续如果需要更细粒度（按 level / 按 tag）可在此扩展。
 */

const isDev = (() => {
  try {
    return typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production'
  } catch {
    return true
  }
})()

const noop = (..._args: unknown[]) => { /* noop */ }

export const log = {
  d: isDev ? (...args: unknown[]) => console.log('[DBG]', ...args) : noop,
  i: isDev ? (...args: unknown[]) => console.log('[INF]', ...args) : noop,
  w: (...args: unknown[]) => console.warn('[WRN]', ...args),
  e: (...args: unknown[]) => console.error('[ERR]', ...args),
}
