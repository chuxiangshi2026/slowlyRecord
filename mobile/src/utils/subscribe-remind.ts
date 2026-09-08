/**
 * 复习提醒（一次性订阅消息）辅助模块
 *
 * 背景：微信工具类小程序只有「一次性订阅消息」——用户每授权一次，
 * 服务端只能推送一条提醒，无法做到"每天自动提醒"（长期订阅仅政务/医疗等类目开放）。
 * 因此提醒主战场是首页今日待办，本模块只是加分项：在用户主动点击时拉起授权，
 * 并把授权记录保存在本地，供后续服务端推送时消费。
 *
 * TODO（服务端，属小程序后台配置，客户端无法独立完成）：
 * - 需要在微信公众平台申请「复习提醒」模板，拿到模板 ID 填入 SUBSCRIBE_TEMPLATE_ID；
 * - 服务端推送需要 appsecret 换 access_token 后调用微信订阅消息接口，
 *   同步服务器（tencentscf.com 云函数）目前只有 /sync、/ping，无此能力；
 * - 授权记录目前只存本地，后续可将记录扩展进同步 payload 或新增上报接口，
 *   由服务端在复习到期时消费（一次授权消费一条）。
 */

/** 订阅消息模板 ID：在微信公众平台申请模板后填入，留空表示功能未配置 */
export const SUBSCRIBE_TEMPLATE_ID = ''

/** 本地存储键：复习提醒授权记录 */
export const SUBSCRIBE_STORAGE_KEY = 'review_remind_subscribe'

/** 授权记录：累计授权次数与最近一次授权时间 */
export interface SubscribeRecord {
  times: number
  lastTime: number
}

/** 读取本地授权记录，无记录或数据损坏时返回空记录 */
export function getSubscribeRecord(): SubscribeRecord {
  try {
    const raw = uni.getStorageSync(SUBSCRIBE_STORAGE_KEY)
    if (!raw) return { times: 0, lastTime: 0 }
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (parsed && typeof parsed.times === 'number' && typeof parsed.lastTime === 'number') {
      return { times: parsed.times, lastTime: parsed.lastTime }
    }
    return { times: 0, lastTime: 0 }
  } catch {
    return { times: 0, lastTime: 0 }
  }
}

/** 记录一次授权成功（一次授权对应服务端可推送的一条消息额度） */
export function recordSubscribeSuccess(now: number = Date.now()): SubscribeRecord {
  const record = getSubscribeRecord()
  const next: SubscribeRecord = { times: record.times + 1, lastTime: now }
  uni.setStorageSync(SUBSCRIBE_STORAGE_KEY, JSON.stringify(next))
  return next
}

/** 清空本地授权记录 */
export function clearSubscribeRecord(): void {
  uni.removeStorageSync(SUBSCRIBE_STORAGE_KEY)
}
