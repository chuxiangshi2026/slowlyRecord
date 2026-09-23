<template>
  <view class="graph-page">
    <!-- #ifdef H5 -->
    <view class="state-tip">函数图像功能请使用微信小程序、抖音小程序或 App 打开</view>
    <!-- #endif -->

    <!-- #ifdef MP-WEIXIN || MP-TOUTIAO || APP -->
    <!-- 表达式输入：y = f(x)，支持参数 a/b/c（下方滑条实时调节） -->
    <view class="card input-card">
      <view class="input-row">
        <text class="fx-label">y =</text>
        <input
          v-model="exprInput"
          class="expr-input"
          placeholder="如 a*x^2 + b*x + c"
          confirm-type="done"
        />
      </view>
      <view v-if="errorTip" class="error-tip">{{ errorTip }}</view>
    </view>

    <!-- 内置示例：一键填入表达式与推荐参数 -->
    <view class="card preset-card">
      <scroll-view scroll-x enhanced :show-scrollbar="false" class="preset-scroll">
        <view class="preset-list">
          <view
            v-for="p in presets"
            :key="p.name"
            class="preset-chip"
            :class="{ active: exprInput === p.expr }"
            @click="usePreset(p)"
          >{{ p.name }}</view>
          <view class="preset-chip ghost" @click="resetView">复位视图</view>
        </view>
      </scroll-view>
    </view>

    <!-- 图像画布：圆点为与 x 轴交点（方程视角），手指拖动可平移视图 -->
    <view
      class="card canvas-card"
      @touchstart="onTouchStart"
      @touchmove="onTouchMove"
      @touchend="onTouchEnd"
    >
      <canvas
        type="2d"
        id="graphCanvas"
        class="graph-canvas"
        :style="{ width: canvasW + 'px', height: canvasH + 'px' }"
      />
      <text class="canvas-hint">圆点为与 x 轴交点 · 拖动图像可平移</text>
    </view>

    <!-- 参数滑条：拖动实时重绘，即「动态展示交互」 -->
    <view class="card param-card">
      <view v-for="key in paramKeys" :key="key" class="param-row">
        <text class="param-name">{{ key }} = {{ formatParam(params[key]) }}</text>
        <slider
          class="param-slider"
          :min="-10"
          :max="10"
          :step="0.1"
          :value="params[key]"
          activeColor="#52796f"
          backgroundColor="#e3ece7"
          :block-size="20"
          @change="onParamChange(key, $event)"
        />
      </view>
    </view>
    <!-- #endif -->
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, watch, getCurrentInstance, nextTick } from 'vue'
import { onReady } from '@dcloudio/uni-app'
import { compileExpression, findRoots, sampleCurve, type ExprEvaluator } from './func-expr'
import { drawFunctionGraph, type GraphCtx } from './graph-draw'

/**
 * 函数图像工具页：输入表达式 → canvas 2d 绘制曲线与坐标轴，
 * 自动标出与 x 轴交点（方程视角），a/b/c 滑条拖动实时重绘，手指拖动平移视图。
 * 画布链路参照 pages-knowledge/knowledge-table.vue（canvas 2d + createSelectorQuery + dpr）。
 * H5 拿不到 canvas node，整页提示改用小程序 / App（模板经条件编译处理）。
 */

interface Preset {
  name: string
  expr: string
  a: number
  b: number
  c: number
}

const presets: Preset[] = [
  { name: '一次函数', expr: 'a*x + b', a: 1, b: 1, c: 0 },
  { name: '二次函数', expr: 'a*x^2 + b*x + c', a: 1, b: 0, c: -2 },
  { name: '反比例', expr: 'a/x', a: 2, b: 0, c: 0 },
  { name: '正弦', expr: 'a*sin(b*x) + c', a: 2, b: 1, c: 0 },
  { name: '指数', expr: 'a*exp(x/2) + c', a: 1, b: 0, c: 0 },
  { name: '对数', expr: 'a*ln(x) + c', a: 1, b: 0, c: 0 },
]

/** 默认表达式：c=-2 时恰有两个交点 ±√2，首屏即展示方程视角 */
const exprInput = ref('a*x^2 + b*x + c')
const params = reactive({ a: 1, b: 0, c: -2 })
const paramKeys = ['a', 'b', 'c'] as const
type ParamKey = (typeof paramKeys)[number]

const errorTip = ref('')

/** 视口窗口（数据坐标），手指拖动平移时整体平移 */
const view = reactive({ xMin: -10, xMax: 10, yMin: -10, yMax: 10 })
function resetView() {
  view.xMin = -10
  view.xMax = 10
  view.yMin = -10
  view.yMax = 10
  redraw()
}

/** 画布逻辑尺寸：宽度按窗口自适应（页面左右各 20rpx 边距），高度取 0.72 倍 */
const canvasW = ref(300)
const canvasH = ref(216)

let evaluator: ExprEvaluator | null = null
let canvasNode: any = null
let canvasCtx: GraphCtx | null = null
let dpr = 2

const instance = getCurrentInstance()

/** 解析当前输入；失败时保留上一份可用解析结果（避免输入过程图像闪烁消失） */
function parseCurrent(): boolean {
  try {
    evaluator = compileExpression(exprInput.value)
    errorTip.value = ''
    return true
  } catch (e: any) {
    errorTip.value = e?.message || '表达式解析失败'
    return false
  }
}

/** 解析成功则重绘（输入变化 / 滑条拖动共用入口） */
function applyAndRedraw() {
  if (parseCurrent()) redraw()
}

watch([exprInput, () => params.a, () => params.b, () => params.c], applyAndRedraw)

function usePreset(p: Preset) {
  exprInput.value = p.expr
  params.a = p.a
  params.b = p.b
  params.c = p.c
}

function formatParam(v: number): string {
  // 滑条步进 0.1，展示统一到 1 位小数，消除浮点尾巴
  return String(Math.round(v * 10) / 10)
}

function onParamChange(key: ParamKey, e: any) {
  params[key] = Number(e?.detail?.value ?? 0)
}

/** 重绘：采样 → 求根 → 绘制；设置 node.width 会重置变换，故每次都要先放大画布再 scale dpr */
function redraw() {
  if (!canvasNode || !canvasCtx || !evaluator) return
  canvasNode.width = Math.round(canvasW.value * dpr)
  canvasNode.height = Math.round(canvasH.value * dpr)
  canvasCtx.scale(dpr, dpr)
  const fn = (x: number) => evaluator!(x, params)
  const segments = sampleCurve(fn, view.xMin, view.xMax, view.yMin, view.yMax, canvasW.value)
  const roots = findRoots(fn, view.xMin, view.xMax)
  drawFunctionGraph(canvasCtx, {
    width: canvasW.value,
    height: canvasH.value,
    view: { ...view },
    segments,
    roots,
  })
}

/** 获取 canvas 2d 节点 */
function getCanvasNode(): Promise<any> {
  return new Promise((resolve, reject) => {
    const query = uni.createSelectorQuery().in(instance?.proxy as any) as any
    query
      .select('#graphCanvas')
      .fields({ node: true, size: true })
      .exec((res: any[]) => {
        const node = res?.[0]?.node
        if (node) resolve(node)
        else reject(new Error('canvas 节点获取失败'))
      })
  })
}

// ===== 手指拖动平移视图 =====

let lastTouch: { x: number; y: number } | null = null

function onTouchStart(e: any) {
  const t = e?.touches?.[0]
  if (t) lastTouch = { x: t.clientX, y: t.clientY }
}

function onTouchMove(e: any) {
  if (!lastTouch) return
  const t = e?.touches?.[0]
  if (!t) return
  const dx = t.clientX - lastTouch.x
  const dy = t.clientY - lastTouch.y
  lastTouch = { x: t.clientX, y: t.clientY }
  // 屏幕 x 右移 → 视口左移；屏幕 y 下移 → 视口上移（数据 y 向上增长）
  const dataPerPxX = (view.xMax - view.xMin) / canvasW.value
  const dataPerPxY = (view.yMax - view.yMin) / canvasH.value
  view.xMin -= dx * dataPerPxX
  view.xMax -= dx * dataPerPxX
  view.yMin += dy * dataPerPxY
  view.yMax += dy * dataPerPxY
  redraw()
}

function onTouchEnd() {
  lastTouch = null
}

onReady(async () => {
  // 画布尺寸按窗口宽度自适应，dpr 放大保证清晰
  try {
    const info: any = (uni as any).getWindowInfo ? (uni as any).getWindowInfo() : uni.getSystemInfoSync()
    canvasW.value = Math.floor((info.windowWidth || 375) * (710 / 750))
    canvasH.value = Math.round(canvasW.value * 0.72)
    dpr = info.pixelRatio || 2
  } catch {
    dpr = 2
  }
  try {
    await nextTick()
    canvasNode = await getCanvasNode()
    canvasCtx = canvasNode.getContext('2d') as GraphCtx
    parseCurrent()
    redraw()
  } catch (e) {
    console.warn('函数图像画布初始化失败:', e)
  }
})
</script>

<style scoped>
.graph-page {
  min-height: 100vh;
  background: #f5f7f5;
  padding: 20rpx;
  box-sizing: border-box;
}

.state-tip {
  padding: 120rpx 40rpx;
  text-align: center;
  font-size: 28rpx;
  color: #999;
}

.card {
  background: #fff;
  border-radius: 16rpx;
  box-shadow: 0 1rpx 4rpx rgba(0, 0, 0, 0.05);
  margin-bottom: 20rpx;
}

/* 表达式输入 */
.input-card {
  padding: 20rpx 24rpx;
}
.input-row {
  display: flex;
  align-items: center;
}
.fx-label {
  font-size: 30rpx;
  font-weight: 600;
  color: #3d5a52;
  margin-right: 16rpx;
}
.expr-input {
  flex: 1;
  font-size: 30rpx;
  color: #303030;
  background: #f2f6f3;
  border-radius: 12rpx;
  padding: 14rpx 20rpx;
}
.error-tip {
  margin-top: 12rpx;
  font-size: 24rpx;
  color: #c0764f;
  line-height: 1.5;
}

/* 内置示例 */
.preset-card {
  padding: 16rpx 0;
}
.preset-scroll {
  white-space: nowrap;
}
.preset-list {
  display: inline-flex;
  align-items: center;
  padding: 0 24rpx;
}
.preset-chip {
  flex-shrink: 0;
  padding: 10rpx 28rpx;
  margin-right: 16rpx;
  font-size: 26rpx;
  color: #52796f;
  background: rgba(82, 121, 111, 0.1);
  border-radius: 28rpx;
}
.preset-chip.active {
  color: #fff;
  background: #52796f;
}
.preset-chip.ghost {
  color: #999;
  background: #f2f3f5;
}
.preset-chip:active {
  opacity: 0.85;
}

/* 画布 */
.canvas-card {
  position: relative;
  padding: 16rpx;
}
.graph-canvas {
  display: block;
  border-radius: 8rpx;
  background: #fff;
}
.canvas-hint {
  display: block;
  margin-top: 12rpx;
  text-align: center;
  font-size: 22rpx;
  color: #b0b8b3;
}

/* 参数滑条 */
.param-card {
  padding: 10rpx 24rpx 20rpx;
}
.param-row {
  display: flex;
  align-items: center;
}
.param-name {
  width: 120rpx;
  flex-shrink: 0;
  font-size: 26rpx;
  color: #3d5a52;
  font-family: monospace;
}
.param-slider {
  flex: 1;
  margin-left: 20rpx;
}
</style>
