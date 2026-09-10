/**
 * 练习判定即时反馈：答对/答错的触感震动统一封装。
 *
 * 能力探测与降级策略：
 * - 答对轻震（light），答错重震（medium）；
 * - `type` 参数仅部分平台（App、微信小程序真机等）支持，不支持的平台
 *   调用时抛错，自动退化为无参 `vibrateShort()`；
 * - 平台完全不支持震动（如 H5）时静默忽略，不影响练习流程。
 */

export type JudgeResult = 'correct' | 'wrong'

/** uni.vibrateShort 的最小签名（仅测试注入时需要） */
export type VibrateShortFn = (options?: { type?: string }) => void

/** 判定结果对应的震动强度：答对轻震，答错重震 */
export function vibrateTypeForResult(result: JudgeResult): 'light' | 'medium' {
  return result === 'correct' ? 'light' : 'medium'
}

/** 解析运行时可用的 vibrateShort（H5 等环境 uni 或无该方法） */
function resolveVibrateShort(injected?: VibrateShortFn): VibrateShortFn | undefined {
  if (injected) return injected
  try {
    const uniAny = (globalThis as { uni?: { vibrateShort?: VibrateShortFn } }).uni
    return uniAny?.vibrateShort?.bind(uniAny)
  } catch {
    return undefined
  }
}

/**
 * 判定震动统一入口。
 * @param result 判定结果
 * @param vibrateShort 可注入的震动实现（默认取全局 uni.vibrateShort），便于测试
 */
export function vibrateOnJudge(result: JudgeResult, vibrateShort?: VibrateShortFn): void {
  const fn = resolveVibrateShort(vibrateShort)
  if (!fn) return
  try {
    fn({ type: vibrateTypeForResult(result) })
  } catch {
    // type 参数不支持的平台退化为无参震动
    try {
      fn()
    } catch {
      // 平台不支持震动，静默忽略
    }
  }
}
