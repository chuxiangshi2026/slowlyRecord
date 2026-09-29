<template>
  <view class="table-page">
    <view v-if="loading" class="state-tip">加载中…</view>
    <view v-else-if="!pack" class="state-tip">知识包不存在或加载失败</view>
    <template v-else>
      <!-- 元素周期表：专属布局在详情页「完整表格」tab -->
      <view v-if="packId === 'elements'" class="notice-bar">
        周期表布局请用详情页的「完整表格」tab，本页为纯表格预览
      </view>

      <!-- 记忆口诀（与详情页同款拆段对齐；横屏地方小，超 4 行折叠） -->
      <view v-if="pack.mnemonics?.length" class="mnemonics-card">
        <text class="section-label">🧠 记忆口诀</text>
        <view v-for="(row, i) in visibleMnemonicRows" :key="i" class="mnemonic-row">
          <text
            v-for="(seg, j) in row"
            :key="j"
            class="koujue"
            :style="{ minWidth: mnemonicSegWidth * 28 + 16 + 'rpx' }"
          >{{ seg }}</text>
        </view>
        <text
          v-if="mnemonicRows.length > MNEMONIC_COLLAPSE_LINES"
          class="mnemonic-toggle"
          @click="mnemonicExpanded = !mnemonicExpanded"
        >{{ mnemonicExpanded ? '收起' : `展开全部 ${mnemonicRows.length} 行` }}</text>
      </view>

      <!-- 操作区：保存为图片（表格 PNG，完整表 / 填空自测表） -->
      <!-- #ifdef MP-WEIXIN || MP-TOUTIAO || APP -->
      <view class="action-bar">
        <view class="action-btn" @click="handleSaveImage">保存为图片</view>
      </view>
      <!-- #endif -->

      <!-- 横竖双向滚动表格 -->
      <scroll-view scroll-x scroll-y enhanced class="table-scroll">
        <view class="table-inner">
          <view class="tr tr-head">
            <view v-for="col in columns" :key="col.key" class="td th" :style="colStyle(col)">
              {{ col.label }}
            </view>
          </view>
          <view v-for="(item, idx) in pack.items" :key="item.id" class="tr" :class="{ zebra: idx % 2 === 1 }">
            <view v-for="col in columns" :key="col.key" class="td" :style="colStyle(col)">
              {{ cellText(item, col.key) }}
            </view>
          </view>
        </view>
      </scroll-view>
    </template>

    <!-- 表格导出离屏画布（canvas 2d，仅小程序/App 端；H5 无 canvas node 不支持） -->
    <!-- #ifdef MP-WEIXIN || MP-TOUTIAO || APP -->
    <canvas
      type="2d"
      id="tableExportCanvas"
      class="export-canvas"
      :style="{ width: exportSize.w + 'px', height: exportSize.h + 'px' }"
    />
    <!-- #endif -->
  </view>
</template>

<script setup lang="ts">
import { ref, computed, getCurrentInstance, nextTick } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useKnowledgeMemory } from './useKnowledgeMemory'
import './knowledge-pack-data'
import {
  buildTableImageData,
  computeTableLayout,
  createMeasure,
  drawTableImage,
  exportDpr,
  type TableForm,
} from './table-image'
import type { KnowledgeItem } from '@/stores/useUtils/types'

/**
 * 通用横屏表格预览页
 * 所有知识包共用：列 = 问题/答案 + extras 键并集（按出现顺序，最多 4 个 extras 列）。
 * pages.json 声明 pageOrientation: landscape（微信生效，抖音自动降级竖屏宽表）。
 */

const store = useKnowledgeMemory()
const packId = ref('')
const loading = ref(true)

const pack = computed(() => (packId.value ? store.getPack(packId.value) : undefined))

// ===== 记忆口诀：拆段对齐 + 超长折叠（与详情页同款） =====

/** 口诀每行按全角空格（U+3000）拆成段（string[][]），空段丢弃 */
const mnemonicRows = computed<string[][]>(() =>
  (pack.value?.mnemonics ?? []).map(line => line.split(/　+/).filter(Boolean)),
)

/** 最长段的字符数：统一每段最小宽度，实现逐列阶梯对齐 */
const mnemonicSegWidth = computed(() =>
  Math.max(1, ...mnemonicRows.value.flat().map(s => s.length)),
)

/** 口诀超过该行数时默认折叠 */
const MNEMONIC_COLLAPSE_LINES = 4

// 口诀展开/收起状态（超 4 行时默认折叠为前 4 行）
const mnemonicExpanded = ref(false)

const visibleMnemonicRows = computed(() =>
  mnemonicRows.value.length > MNEMONIC_COLLAPSE_LINES && !mnemonicExpanded.value
    ? mnemonicRows.value.slice(0, MNEMONIC_COLLAPSE_LINES)
    : mnemonicRows.value,
)

interface Column {
  key: string
  label: string
  /** 列宽 rpx */
  width: number
}

const columns = computed<Column[]>(() => {
  if (!pack.value) return []
  const cols: Column[] = [
    { key: '__question', label: '问题', width: 220 },
    { key: '__answer', label: '答案', width: 220 },
  ]
  const extraKeys: string[] = []
  for (const item of pack.value.items) {
    for (const k of Object.keys(item.extras || {})) {
      if (!extraKeys.includes(k)) extraKeys.push(k)
    }
  }
  for (const k of extraKeys.slice(0, 4)) {
    cols.push({ key: k, label: k, width: 180 })
  }
  return cols
})

function colStyle(col: Column) {
  return { width: col.width + 'rpx' }
}

function cellText(item: KnowledgeItem, key: string): string {
  if (key === '__question') return item.question
  if (key === '__answer') return item.answer
  return item.extras?.[key] ?? ''
}

onLoad(async (options) => {
  packId.value = options?.packId || ''
  if (!packId.value) {
    loading.value = false
    return
  }
  try {
    if (!store.isPackLoaded(packId.value)) {
      await store.loadPack(packId.value)
    }
  } catch (e) {
    console.warn('表格页加载知识包失败:', e)
  } finally {
    loading.value = false
  }
  if (pack.value) {
    uni.setNavigationBarTitle({ title: `${pack.value.name} · 表格` })
  }
})

// ===== 保存为图片 =====
// 用 canvas 2d 按桌面端导出的表格 PNG 风格绘制（见 table-image.ts），
// 导出链路：绘制 → uni.canvasToTempFilePath → uni.saveImageToPhotosAlbum。
// 小程序无打印 API，保存成功后提示用户可自行打印。

const instance = getCurrentInstance()
const savingImage = ref(false)
/** 离屏画布样式尺寸（跟随表格布局，单位 px） */
const exportSize = ref({ w: 0, h: 0 })

/** 获取 canvas 2d 节点 */
function getCanvasNode(): Promise<any> {
  return new Promise((resolve, reject) => {
    // dcloudio 类型里 fields 需要回调参数，实际可选，这里整链放宽
    const query = uni.createSelectorQuery().in(instance?.proxy as any) as any
    query
      .select('#tableExportCanvas')
      .fields({ node: true, size: true })
      .exec((res: any[]) => {
        const node = res?.[0]?.node
        if (node) resolve(node)
        else reject(new Error('canvas 节点获取失败'))
      })
  })
}

/** canvas 节点导出为临时图片路径 */
function canvasToTemp(canvasNode: any, destWidth: number, destHeight: number): Promise<string> {
  return new Promise((resolve, reject) => {
    uni.canvasToTempFilePath({
      canvas: canvasNode,
      canvasId: 'tableExportCanvas',
      destWidth,
      destHeight,
      fileType: 'png',
      success: (res: any) => resolve(res.tempFilePath),
      fail: reject,
    } as any)
  })
}

/** 选择表格形态：完整表 / 填空自测表（与桌面端一致） */
function chooseTableForm(): Promise<TableForm | null> {
  return new Promise(resolve => {
    uni.showActionSheet({
      itemList: ['完整表（含答案）', '填空自测表（答案留空）'],
      success: res => resolve(res.tapIndex === 0 ? 'full' : 'blank'),
      fail: () => resolve(null),
    })
  })
}

/** 点击「保存为图片」：选择形态 → 绘制 → 导出 → 保存到相册 */
async function handleSaveImage() {
  const p = pack.value
  if (!p || p.items.length === 0 || savingImage.value) return
  const form = await chooseTableForm()
  if (!form) return
  savingImage.value = true
  uni.showLoading({ title: '生成中', mask: true })
  try {
    const data = buildTableImageData(p, form)
    const node = await getCanvasNode()
    // 按设备 pixelRatio 放大画布与导出尺寸，保证图片清晰
    let dpr = 2
    try {
      const info: any = (uni as any).getWindowInfo ? (uni as any).getWindowInfo() : uni.getSystemInfoSync()
      dpr = info.pixelRatio || 2
    } catch {
      dpr = 2
    }
    const ctx = node.getContext('2d')
    const measure = createMeasure(ctx)
    const layout = computeTableLayout(data, measure)
    // 样式尺寸同步为逻辑尺寸，避免个别端按样式尺寸裁剪
    exportSize.value = { w: layout.canvasWidth, h: layout.canvasHeight }
    await nextTick()
    // 长表（如 81/100 行乘法表）在高分屏上物理尺寸会超微信 canvas 稳定上限，自动降 dpr
    const effDpr = exportDpr(layout.canvasWidth, layout.canvasHeight, dpr)
    if (effDpr < dpr) console.info(`[表格导出] 画布 ${layout.canvasWidth}×${layout.canvasHeight}，dpr ${dpr}→${effDpr}`)
    node.width = Math.round(layout.canvasWidth * effDpr)
    node.height = Math.round(layout.canvasHeight * effDpr)
    ctx.scale(effDpr, effDpr)
    drawTableImage(ctx, data, layout, measure)
    const tempPath = await canvasToTemp(node, node.width, node.height)
    await saveToAlbum(tempPath)
  } catch (e) {
    console.error('表格图片生成失败:', e)
    uni.showToast({ title: '图片生成失败', icon: 'none' })
  } finally {
    uni.hideLoading()
    savingImage.value = false
  }
}

/** 保存到相册：拒绝授权时引导去设置页开启（结果以 toast 呈现，不向上抛错） */
function saveToAlbum(filePath: string): Promise<void> {
  return new Promise(resolve => {
    uni.saveImageToPhotosAlbum({
      filePath,
      success: () => {
        // 小程序无打印 API，保存后提示用户可自行打印
        uni.showToast({ title: '已保存到相册，可自行打印', icon: 'none' })
        resolve()
      },
      fail: (err: any) => {
        const msg: string = err?.errMsg || ''
        if (msg.includes('auth') || msg.includes('deny')) {
          uni.showModal({
            title: '需要相册权限',
            content: '请在设置中允许保存图片到相册',
            confirmText: '去设置',
            success: r => {
              if (r.confirm) uni.openSetting()
            },
          })
          resolve()
        } else {
          uni.showToast({ title: '保存失败', icon: 'none' })
          resolve()
        }
      },
    })
  })
}
</script>

<style scoped>
.table-page {
  height: 100vh;
  background: #f5f6fa;
  display: flex;
  flex-direction: column;
}

.state-tip {
  padding: 120rpx 40rpx;
  text-align: center;
  font-size: 28rpx;
  color: #999;
}

.notice-bar {
  margin: 16rpx 20rpx 0;
  padding: 14rpx 20rpx;
  background: #fef3e0;
  color: #b97d2a;
  font-size: 22rpx;
  border-radius: 12rpx;
}

.mnemonics-card {
  margin: 16rpx 20rpx 0;
  padding: 20rpx;
  background: #fff;
  border-radius: 16rpx;
  box-shadow: 0 1rpx 4rpx rgba(0, 0, 0, 0.05);
}
.section-label {
  font-size: 26rpx;
  font-weight: 600;
  color: #3d5a52;
  display: block;
  margin-bottom: 12rpx;
}
.mnemonic-row {
  display: flex;
  flex-wrap: wrap;
  line-height: 1.8;
}

/* 口诀段：min-width 按最长段绑定（rpx），逐列对齐；长行自动换行不溢出 */
.koujue {
  font-size: 26rpx;
  color: #303030;
  text-align: center;
  padding: 0 8rpx;
  box-sizing: border-box;
  word-break: break-all;
}

.mnemonic-toggle {
  display: block;
  text-align: center;
  font-size: 24rpx;
  color: #52796f;
  margin-top: 10rpx;
}

.action-bar {
  margin: 16rpx 20rpx 0;
  display: flex;
  justify-content: flex-end;
}
.action-btn {
  padding: 12rpx 32rpx;
  background: #52796f;
  color: #fff;
  font-size: 26rpx;
  border-radius: 32rpx;
}
.action-btn:active {
  opacity: 0.85;
}
.export-canvas {
  position: fixed;
  left: -9999px;
  top: -9999px;
}

.table-scroll {
  flex: 1;
  margin: 16rpx 20rpx 20rpx;
  background: #fff;
  border-radius: 16rpx;
  box-shadow: 0 1rpx 4rpx rgba(0, 0, 0, 0.05);
}
.table-inner {
  display: inline-block;
  min-width: 100%;
}
.tr {
  display: flex;
}
.tr-head {
  position: sticky;
  top: 0;
  z-index: 2;
  background: #52796f;
}
.tr.zebra {
  background: #f7f9f7;
}
.td {
  flex-shrink: 0;
  padding: 16rpx 20rpx;
  font-size: 26rpx;
  color: #303030;
  line-height: 1.5;
  border-bottom: 1rpx solid #eef0ee;
  box-sizing: border-box;
}
.th {
  color: #fff;
  font-weight: 600;
  border-bottom: none;
}
</style>
