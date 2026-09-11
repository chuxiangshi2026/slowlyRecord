import {ref} from 'vue'
import {defineStore} from 'pinia'

/**
 * 全局 UI 状态：承载跨页面共享的弹窗可见性，避免各页面各自持有副本导致多重实例。
 */
export const useUiStore = defineStore('ui', () => {
  /** 同步与备份弹窗（Home 层渲染一次，头部状态点与「更多」抽屉共用） */
  const syncDialogVisible = ref(false)

  /** 设置抽屉（Home 层渲染一次，任意页面可直接打开） */
  const settingsDrawerVisible = ref(false)

  /** 「更多」抽屉（Home 层渲染一次，头部 ☰ 入口，所有页面共享） */
  const moreDrawerVisible = ref(false)

  /** 待执行的导入/导出指令（由「更多」抽屉发出，单词页消费执行） */
  const pendingImportCommand = ref<{ cmd: string; at: number } | null>(null)
  const pendingExportCommand = ref<{ cmd: string; at: number } | null>(null)

  function openSyncDialog() {
    syncDialogVisible.value = true
  }

  return {
    syncDialogVisible,
    settingsDrawerVisible,
    moreDrawerVisible,
    pendingImportCommand,
    pendingExportCommand,
    openSyncDialog,
  }
})
