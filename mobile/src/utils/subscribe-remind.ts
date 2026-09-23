/**
 * 复习提醒（一次性订阅消息）辅助模块
 *
 * 背景：微信工具类小程序只有「一次性订阅消息」——用户每授权一次，
 * 服务端只能推送一条提醒，无法做到"每天自动提醒"（长期订阅仅政务/医疗等类目开放）。
 * 因此提醒主战场是首页今日待办，本模块只是加分项：在用户主动点击时拉起授权，
 * 并把授权结果保存在本地，供后续服务端推送时消费。
 *
 * 模板 ID 不在代码里硬编码：微信订阅消息模板必须由小程序管理员在公众平台后台
 * （mp.weixin.qq.com → 功能 → 订阅消息）申请，开发无法代申请，
 * 故由用户在「我的 → 复习提醒」弹窗中自行填入，持久化到本地（见 get/setSubscribeTemplateId）。
 *
 * 落地分步（TODO）：
 * ① 客户端闭环【本次已完成】：模板 ID 本地可配置、能力检测、拉起授权、
 *    授权结果（接受/拒绝/封禁/过期）记录与拒绝后引导，记录存本地 storage。
 * ② 服务端推送【待办，需扩云函数，超出本次范围】：
 *    - 需要云函数定时触发器 + 微信 subscribeMessage.send（appsecret 换 access_token）；
 *    - 目前同步云函数（tencentscf.com）只有 /sync、/ping，无此能力；
 *    - 数据缺口：服务端推送需要用户 openid，目前没有 openid 上报通道
 *      （登录/同步均不带 openid），需新增上报接口并把本地授权记录一并上报，
 *      由服务端在复习到期时消费（一次授权消费一条）。
 */

/** 本地存储键：订阅消息模板 ID（用户在公众平台申请后自行填入） */
export const SUBSCRIBE_TEMPLATE_ID_KEY = 'review_remind_template_id'

/** 本地存储键：复习提醒授权记录 */
export const SUBSCRIBE_STORAGE_KEY = 'review_remind_subscribe'

/** 读取本地模板 ID（trim 后返回，未配置或数据损坏时返回空串） */
export function getSubscribeTemplateId(): string {
  try {
    const raw = uni.getStorageSync(SUBSCRIBE_TEMPLATE_ID_KEY)
    return typeof raw === 'string' ? raw.trim() : ''
  } catch {
    return ''
  }
}

/** 保存本地模板 ID（自动 trim） */
export function setSubscribeTemplateId(id: string): void {
  uni.setStorageSync(SUBSCRIBE_TEMPLATE_ID_KEY, id.trim())
}

/** 授权结果：accept 接受 / reject 拒绝 / ban 被微信封禁订阅能力 / expired 授权已过期 / unknown 结果未知 */
export type SubscribeStatus = 'accept' | 'reject' | 'ban' | 'expired' | 'unknown'

/** 授权记录：累计成功次数、最近一次结果与时间（一次 accept 对应服务端可推送的一条消息额度） */
export interface SubscribeRecord {
  times: number
  lastTime: number
  lastStatus: SubscribeStatus | ''
  rejectTimes: number
}

/** 读取本地授权记录，无记录或数据损坏时返回空记录 */
export function getSubscribeRecord(): SubscribeRecord {
  const empty: SubscribeRecord = { times: 0, lastTime: 0, lastStatus: '', rejectTimes: 0 }
  try {
    const raw = uni.getStorageSync(SUBSCRIBE_STORAGE_KEY)
    if (!raw) return { ...empty }
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (parsed && typeof parsed.times === 'number' && typeof parsed.lastTime === 'number') {
      return {
        times: parsed.times,
        lastTime: parsed.lastTime,
        lastStatus: parsed.lastStatus ?? '',
        rejectTimes: typeof parsed.rejectTimes === 'number' ? parsed.rejectTimes : 0,
      }
    }
    return { ...empty }
  } catch {
    return { ...empty }
  }
}

/** 记录一次授权结果：accept 累计可推送额度，reject 累计拒绝次数，其余只更新最近状态 */
export function recordSubscribeOutcome(status: SubscribeStatus, now: number = Date.now()): SubscribeRecord {
  const record = getSubscribeRecord()
  const next: SubscribeRecord = {
    times: status === 'accept' ? record.times + 1 : record.times,
    lastTime: now,
    lastStatus: status,
    rejectTimes: status === 'reject' ? record.rejectTimes + 1 : record.rejectTimes,
  }
  uni.setStorageSync(SUBSCRIBE_STORAGE_KEY, JSON.stringify(next))
  return next
}

/** 清空本地授权记录 */
export function clearSubscribeRecord(): void {
  uni.removeStorageSync(SUBSCRIBE_STORAGE_KEY)
}

/** 解析 requestSubscribeMessage 回调中模板 ID 对应的结果（结果以模板 ID 为键） */
export function parseSubscribeResult(res: Record<string, unknown>, templateId: string): SubscribeStatus {
  const r = res?.[templateId]
  return r === 'accept' || r === 'reject' || r === 'ban' || r === 'expired' ? r : 'unknown'
}

/** 能力检测：仅微信小程序提供 requestSubscribeMessage，抖音/App/H5 端不支持 */
export function isSubscribeMessageSupported(): boolean {
  return typeof (globalThis as any).uni?.requestSubscribeMessage === 'function'
}
