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

  /** 界面字号档位对应的缩放比例（小/标准/大），localStorage 持久化 */
  const UI_ZOOM_KEY = 'slowlyrecord-ui-zoom'
  const uiZoom = ref<number>(Number(localStorage.getItem(UI_ZOOM_KEY)) || 1)

  /** 应用界面缩放（CSS zoom，Chromium 布局级缩放，无需改各处 px 样式） */
  function applyUiZoom(v: number) {
    uiZoom.value = v
    try {
      localStorage.setItem(UI_ZOOM_KEY, String(v))
      document.documentElement.style.zoom = v === 1 ? '' : String(v)
    } catch { /* 存储不可用（quota/禁用）时跳过，不影响后续初始化 */ }
  }

  function openSyncDialog() {
    syncDialogVisible.value = true
  }

  return {
    syncDialogVisible,
    settingsDrawerVisible,
    moreDrawerVisible,
    pendingImportCommand,
    pendingExportCommand,
    uiZoom,
    applyUiZoom,
    openSyncDialog,
  }
})
