import {ref} from 'vue'
import {defineStore} from 'pinia'

/**
 * 全局 UI 状态：承载跨页面共享的弹窗可见性，避免各页面各自持有副本导致多重实例。
 */
export const useUiStore = defineStore('ui', () => {
  /** 同步与备份弹窗（Home 层渲染一次，头部状态点与「更多」抽屉共用） */
  const syncDialogVisible = ref(false)

  /** 请求打开设置抽屉（由 Word 页的 DetailDrawer 承载） */
  const settingsDrawerRequested = ref(false)

  function openSyncDialog() {
    syncDialogVisible.value = true
  }

  function requestSettings() {
    settingsDrawerRequested.value = true
  }

  return {
    syncDialogVisible,
    settingsDrawerRequested,
    openSyncDialog,
    requestSettings,
  }
})
