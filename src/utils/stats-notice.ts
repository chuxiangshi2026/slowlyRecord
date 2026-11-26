import { ElMessageBox } from 'element-plus'
import { getSetDb, upsertSetDbFields } from '@/utils/user-set-db-util'
import { applyPersistedStatsPrefs, isStatsEnvEligible, setStatsExcluded, STATS_NOTICE_KEY } from '@/utils/stats'

/**
 * 首次启动告知匿名使用统计（默认关闭）：明确说明「默认关闭，主动开启后才发送」、
 * 上报内容与关闭入口。只在统计本可启用的环境提示（有端点、非开发/本地），每个安装只提示一次。
 * 「已提示」与「用户开启选择」都持久化到 user-set，插件更新清空 localStorage 后不会重弹/重置。
 *
 * 调用时机由页面决定：必须排在首启引导（OnboardingOverlay，z-index 9999）结算之后，
 * 否则 ElMessageBox（z-index ~2000）会被浮层挡住。
 */
export function maybeShowStatsNotice() {
  try {
    // 先用 user-set 里持久化的偏好校正 localStorage（更新后 localStorage 可能已被清空）
    try {
      const setDb = getSetDb()
      if (setDb) applyPersistedStatsPrefs({ excluded: setDb.statsExcluded, noticeShown: setDb.statsNoticeShown, optedIn: setDb.statsOptedIn })
    } catch { /* DB 未就绪时按 localStorage 判断 */ }

    if (window.localStorage?.getItem(STATS_NOTICE_KEY) === '1') return
    // 环境不可用（dev/localhost/无端点）不打扰；是否已开启不影响本次告知
    if (!isStatsEnvEligible()) return
    window.localStorage?.setItem(STATS_NOTICE_KEY, '1')
    void upsertSetDbFields({ statsNoticeShown: true }).catch(() => { /* 忽略：localStorage 已记，仅影响跨更新去重 */ })
    ElMessageBox.confirm(
      '慢记默认关闭匿名使用统计，主动开启后才会发送。\n\n' +
      '上报内容仅限操作事件（启动、添词、导入导出、设置修改等）与一个随机安装标识，绝不采集你的单词、释义、笔记或任何输入内容，也不包含账号信息；程序异常只上报脱敏后的短消息。\n\n' +
      '你可以随时在「设置 → 常规设置 → 匿名使用统计」关闭，关闭立即生效。',
      '匿名使用统计（默认关闭）',
      {
        confirmButtonText: '开启统计',
        cancelButtonText: '暂不开启',
        type: 'info',
      }
    ).then(() => {
      setStatsExcluded(false);
    }).catch(() => { /* 取消或关闭弹窗：保持默认关闭 */ });
  } catch { /* localStorage/弹窗不可用时忽略，不影响启动 */ }
}
