<template>
  <div class="function-plot">
    <div v-if="title" class="plot-title">{{ title }}</div>
    <div ref="wrapRef" class="plot-wrap" @wheel.prevent="onWheel" @pointerleave="hover = null">
      <canvas ref="canvasRef" class="plot-canvas" @pointerdown="onPointerDown" @pointermove="onPointerMove" @pointerup="onPointerUp" @pointercancel="onPointerUp" />
      <div v-if="hover" class="plot-tip" :style="{left: hover.px + 12 + 'px', top: hover.py - 30 + 'px'}">
        ({{ hover.dx.toFixed(2) }}, {{ hover.dy.toFixed(2) }})
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {ref, watch, onMounted, onBeforeUnmount} from 'vue';
import {calcViewRange, dataToPixel, isDiscontinuity, pixelToData, type ViewRange} from '@/utils/function-plot-util';

/** 悬停信息：鼠标像素位置 + 数据横坐标 + 曲线上函数值 */
interface HoverInfo { px: number; py: number; dx: number; dy: number }

const props = withDefaults(defineProps<{
  /** 待绘制函数 y = f(x) */
  fn: (x: number) => number;
  /** 图表标题（可选） */
  title?: string;
  /** 初始可视范围（不传则按 f 在 [-10, 10] 上的取值自动计算） */
  initialRange?: ViewRange;
}>(), {});

const X_SPAN = 10; // 自动计算范围时的 x 采样半径
const SAMPLE = 600; // 曲线采样点数
const MIN_SPAN = 1e-6; // 缩放下限，防止范围塌缩

const wrapRef = ref<HTMLDivElement>();
const canvasRef = ref<HTMLCanvasElement>();
const hover = ref<HoverInfo | null>(null);
const range = ref<ViewRange>({xMin: -X_SPAN, xMax: X_SPAN, yMin: -8, yMax: 8});
let dragging = false;
let lastX = 0;
let lastY = 0;
let rafId = 0;
let resizeObserver: ResizeObserver | null = null;

/** 读取 CSS 主题变量（随深色模式自动变化） */
function cssVar(name: string, fallback: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}
/** 取整刻度步长（1/2/5 × 10^n），使视口内网格线数量适中 */
function niceStep(span: number): number {
  if (!Number.isFinite(span) || span <= 0) return 1;
  const rough = span / 32;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const m = rough / pow;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * pow;
}
/** 刻度标签：过大/过小的数用科学计数法 */
function formatTick(v: number): string {
  if (Math.abs(v) >= 1e5 || (Math.abs(v) > 0 && Math.abs(v) < 1e-3)) return v.toExponential(0);
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

/** 绘制刻度网格与坐标轴 */
function drawGrid(ctx: CanvasRenderingContext2D, r: ViewRange, w: number, h: number, rect: {x: number; y: number; width: number; height: number}) {
  ctx.font = '11px sans-serif';
  ctx.strokeStyle = cssVar('--utools-border-divider', '#e8e8e8');
  // 画一组等距网格线 + 刻度标签（vertical：纵向网格，横向反之）
  const lines = (step: number, vertical: boolean) => {
    ctx.fillStyle = cssVar('--utools-text-tertiary', '#8c8c8c');
    ctx.textAlign = vertical ? 'center' : 'right';
    ctx.textBaseline = vertical ? 'top' : 'middle';
    const from = Math.ceil((vertical ? r.xMin : r.yMin) / step);
    for (let i = from; i * step <= (vertical ? r.xMax : r.yMax) + step * 1e-3; i++) {
      const v = i * step;
      const p = dataToPixel(vertical ? v : 0, vertical ? 0 : v, r, rect);
      ctx.beginPath();
      if (vertical) { ctx.moveTo(p.x, 0); ctx.lineTo(p.x, h); } else { ctx.moveTo(0, p.y); ctx.lineTo(w, p.y); }
      ctx.stroke();
      ctx.fillText(formatTick(v), vertical ? p.x : 4, vertical ? h - 16 : p.y);
    }
  };
  lines(niceStep(r.xMax - r.xMin), true);
  lines(niceStep(r.yMax - r.yMin), false);
  // 坐标轴（x=0 / y=0）
  ctx.strokeStyle = cssVar('--utools-text-secondary', '#595959');
  ctx.lineWidth = 1.2;
  if (r.yMin <= 0 && r.yMax >= 0) {
    const p = dataToPixel(0, 0, r, rect);
    ctx.beginPath(); ctx.moveTo(0, p.y); ctx.lineTo(w, p.y); ctx.stroke();
  }
  if (r.xMin <= 0 && r.xMax >= 0) {
    const p = dataToPixel(0, 0, r, rect);
    ctx.beginPath(); ctx.moveTo(p.x, 0); ctx.lineTo(p.x, h); ctx.stroke();
  }
  ctx.lineWidth = 1;
}

/** 绘制函数曲线（断点/非有限值处断开，不跨渐近线连线） */
function drawCurve(ctx: CanvasRenderingContext2D, r: ViewRange, rect: {x: number; y: number; width: number; height: number}) {
  ctx.strokeStyle = cssVar('--utools-primary', '#409eff');
  ctx.lineWidth = 2;
  ctx.beginPath();
  let started = false;
  let prevY: number | null = null;
  for (let i = 0; i <= SAMPLE; i++) {
    const dx = r.xMin + ((r.xMax - r.xMin) * i) / SAMPLE;
    const dy = props.fn(dx);
    if (!Number.isFinite(dy)) { started = false; prevY = null; continue; }
    if (prevY !== null && isDiscontinuity(prevY, dy)) started = false;
    const p = dataToPixel(dx, dy, r, rect);
    if (started) ctx.lineTo(p.x, p.y);
    else ctx.moveTo(p.x, p.y);
    started = true;
    prevY = dy;
  }
  ctx.stroke();
  ctx.lineWidth = 1;
}

function draw() {
  const wrap = wrapRef.value;
  const canvas = canvasRef.value;
  if (!wrap || !canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const w = wrap.clientWidth;
  const h = wrap.clientHeight;
  if (w <= 0 || h <= 0) return;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const r = range.value;
  const rect = {x: 0, y: 0, width: w, height: h};
  ctx.fillStyle = cssVar('--utools-bg-card', '#fff');
  ctx.fillRect(0, 0, w, h);
  drawGrid(ctx, r, w, h, rect);
  drawCurve(ctx, r, rect);

  // 悬停标记：十字虚线 + 曲线上的圆点
  if (hover.value) {
    const d = pixelToData(hover.value.px, hover.value.py, r, rect);
    const dy = props.fn(d.x);
    if (!Number.isFinite(dy)) return;
    const p = dataToPixel(d.x, dy, r, rect);
    ctx.strokeStyle = cssVar('--utools-text-secondary', '#595959');
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(p.x, 0); ctx.lineTo(p.x, h);
    ctx.moveTo(0, p.y); ctx.lineTo(w, p.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = cssVar('--utools-primary', '#409eff');
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** 合并绘制调用，避免高频事件下重复渲染 */
function scheduleDraw() {
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(draw);
}

function onPointerDown(e: PointerEvent) {
  dragging = true;
  lastX = e.offsetX;
  lastY = e.offsetY;
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
}
function onPointerMove(e: PointerEvent) {
  const wrap = wrapRef.value;
  if (!wrap) return;
  if (dragging) {
    // 拖拽平移：窗口范围跟随鼠标反向移动
    const r = range.value;
    const dx = ((e.offsetX - lastX) / wrap.clientWidth) * (r.xMax - r.xMin);
    const dy = ((e.offsetY - lastY) / wrap.clientHeight) * (r.yMax - r.yMin);
    range.value = {xMin: r.xMin - dx, xMax: r.xMax - dx, yMin: r.yMin + dy, yMax: r.yMax + dy};
    lastX = e.offsetX;
    lastY = e.offsetY;
    scheduleDraw();
    return;
  }
  // 悬停：显示鼠标处数据坐标与函数值
  const r = range.value;
  const d = pixelToData(e.offsetX, e.offsetY, r, {x: 0, y: 0, width: wrap.clientWidth, height: wrap.clientHeight});
  const dy = props.fn(d.x);
  if (Number.isFinite(dy)) {
    hover.value = {px: e.offsetX, py: e.offsetY, dx: d.x, dy};
    scheduleDraw();
  } else if (hover.value) {
    hover.value = null;
    scheduleDraw();
  }
}
function onPointerUp() {
  dragging = false;
}
function onWheel(e: WheelEvent) {
  const wrap = wrapRef.value;
  if (!wrap) return;
  const r = range.value;
  const factor = e.deltaY < 0 ? 0.8 : 1.25; // 向上滚动放大，向下缩小
  if ((r.xMax - r.xMin) * factor < MIN_SPAN || (r.yMax - r.yMin) * factor < MIN_SPAN) return;
  // 以鼠标位置为缩放中心：保持焦点数据坐标映射到的像素位置不变
  const focus = pixelToData(e.offsetX, e.offsetY, r, {x: 0, y: 0, width: wrap.clientWidth, height: wrap.clientHeight});
  range.value = {
    xMin: focus.x - (focus.x - r.xMin) * factor,
    xMax: focus.x + (r.xMax - focus.x) * factor,
    yMin: focus.y - (focus.y - r.yMin) * factor,
    yMax: focus.y + (r.yMax - focus.y) * factor,
  };
  scheduleDraw();
}

watch(() => props.fn, (fn) => {
  range.value = props.initialRange ?? calcViewRange(fn, -X_SPAN, X_SPAN);
}, {immediate: true});
onMounted(() => {
  resizeObserver = new ResizeObserver(() => scheduleDraw());
  if (wrapRef.value) resizeObserver.observe(wrapRef.value);
  scheduleDraw();
});
onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  cancelAnimationFrame(rafId);
});
</script>

<style scoped lang="scss">
.function-plot {
  width: 100%;

  .plot-title {
    font-size: 13px;
    color: var(--utools-text-secondary);
    margin-bottom: 8px;
  }

  .plot-wrap {
    position: relative;
    width: 100%;
    height: 300px;
    border: 1px solid var(--utools-border-divider);
    border-radius: 8px;
    overflow: hidden;
    touch-action: none;

    .plot-canvas {
      display: block;
      width: 100%;
      height: 100%;
      cursor: crosshair;
    }
  }

  .plot-tip {
    position: absolute;
    z-index: 2;
    pointer-events: none;
    padding: 3px 8px;
    font-size: 12px;
    font-family: 'Menlo', 'Consolas', monospace;
    color: var(--utools-text-primary);
    background: var(--utools-bg-overlay);
    border: 1px solid var(--utools-border-primary);
    border-radius: 4px;
    white-space: nowrap;
  }
}
</style>
