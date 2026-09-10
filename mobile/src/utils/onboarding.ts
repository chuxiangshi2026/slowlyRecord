/**
 * 首次启动引导相关纯函数
 *
 * 判定口径：storage 中 slowlyrecord-onboarded === '1' 视为已完成引导。
 * 引导完成后（导入词库或跳过）写标记，之后启动首页 onLoad 守卫直接放行，老用户完全无感。
 */

export const ONBOARDED_STORAGE_KEY = 'slowlyrecord-onboarded'

/** 引导页一键导入的起步词数（完整词库在分包中，可后续在词库管理页续导） */
export const STARTER_WORD_COUNT = 100

/** 行动屏推荐的内置词库（主包起步数据只含前 STARTER_WORD_COUNT 词） */
export interface RecommendedBank {
  /** 内置词库 sourceId（WordBankType），与词库管理页口径一致 */
  sourceId: string
  name: string
  emoji: string
  /** 一句话口语描述 */
  desc: string
}

export const RECOMMENDED_BANKS: RecommendedBank[] = [
  { sourceId: 'cet4', name: '四级词汇', emoji: '📘', desc: '大学英语四级核心词汇' },
  { sourceId: 'cet6', name: '六级词汇', emoji: '📗', desc: '大学英语六级核心词汇' },
  { sourceId: 'kaoyan', name: '考研词汇', emoji: '📙', desc: '研究生入学考试核心词汇' },
]

/** 解析 storage 中的标记：'1' 或 1 视为已引导，其余一律视为未引导 */
export function resolveOnboarded(raw: unknown): boolean {
  return raw === '1' || raw === 1
}

/** 从 storage 读取是否已引导（读失败按未引导处理，保证新用户一定看得到引导页） */
export function loadOnboarded(): boolean {
  try {
    return resolveOnboarded(uni.getStorageSync(ONBOARDED_STORAGE_KEY))
  } catch {
    return false
  }
}

/** 写入已引导标记（写失败静默：下次启动会再看一次引导，不影响本次使用） */
export function markOnboarded() {
  try {
    uni.setStorageSync(ONBOARDED_STORAGE_KEY, '1')
  } catch {
    // ignore
  }
}
