<template>
  <div class="function-plot">
    <div v-if="title" class="plot-title">{{ title }}</div>
    <div class="plot-row">
      <div ref="wrapRef" class="plot-wrap" @wheel.prevent="onWheel" @pointerleave="hover = null">
        <canvas ref="canvasRef" class="plot-canvas" @pointerdown="onPointerDown" @pointermove="onPointerMove" @pointerup="onPointerUp" @pointercancel="onPointerUp" />
        <div v-if="hover" class="plot-tip" :style="tipStyle">
          ({{ hover.dx.toFixed(2) }}, {{ hover.dy.toFixed(2) }})
        </div>
      </div>
      <!-- 几何联动：图形随动点取值变化（如圆半径 r、正方形边长 a） -->
      <div v-if="geometry" class="geo-wrap">
        <canvas ref="geoCanvasRef" class="geo-canvas" />
        <div class="geo-caption">几何联动</div>
      </div>
    </div>

    <!-- 动点控制：输入数值 / 拖动滑块 / 播放动画，观察曲线上点与区域的变化；点击曲线也可取点 -->
    <div class="probe-bar">
      <span class="probe-label">{{ xLabel }} =</span>
      <input
        v-model.number="probeX"
        type="number"
        class="probe-input"
        :step="sliderStep"
        @input="stopPlay"
      />
      <input
        v-model.number="probeX"
        type="range"
        class="probe-slider"
        :min="range.xMin"
        :max="range.xMax"
        :step="sliderStep"
        @input="stopPlay"
      />
      <button type="button" class="probe-play" :title="playing ? '暂停' : '播放：动点沿曲线移动'" @click="togglePlay">
        {{ playing ? '⏸' : '▶' }}
      </button>
    </div>

    <!-- 函数分析：动点、围成面积、极值、零点、有趣值 -->
    <div class="plot-analysis">
      <div v-if="Number.isFinite(probeY)" class="analysis-row">
        <span class="tag tag-point">动点</span>
        <span>({{ fmt(probeX) }}, {{ fmt(probeY) }})</span>
        <span class="sep">·</span>
        <span>曲线与 x 轴在 [0, {{ fmt(probeX) }}] 围成的有向面积 ≈ {{ fmt(area) }}</span>
      </div>
      <div class="analysis-row">
        <span class="tag tag-extremum">极值</span>
        <span v-if="extrema.length === 0" class="muted">当前视野内无极值</span>
        <span v-for="(e, i) in extrema" :key="i" class="value">
          {{ e.kind === 'max' ? '极大值' : '极小值' }} {{ fmt(e.y) }}（x = {{ fmt(e.x) }}）{{ i < extrema.length - 1 ? '；' : '' }}
        </span>
      </div>
      <div class="analysis-row">
        <span class="tag tag-zero">零点</span>
        <span v-if="zeros.length === 0" class="muted">当前视野内与 x 轴无交点</span>
        <span v-else class="value">x = {{ zeros.map(fmt).join('，') }}</span>
        <template v-if="Number.isFinite(yIntercept)">
          <span class="sep">·</span>
          <span>y 轴截距 {{ fmt(yIntercept) }}</span>
        </template>
      </div>
      <div v-for="(note, i) in notes" :key="i" class="analysis-row">
        <span class="tag tag-note">有趣值</span>
        <span>{{ note }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {ref, computed, watch, onMounted, onBeforeUnmount} from 'vue';
import {
  calcViewRange,
  dataToPixel,
  findExtrema,
  findZeros,
  integrate,
  isDiscontinuity,
  pixelToData,
  type ViewRange,
} from '@/utils/function-plot-util';

/** 悬停信息：鼠标像素位置 + 数据横坐标 + 曲线上函数值 */
interface HoverInfo { px: number; py: number; dx: number; dy: number }

const props = withDefaults(defineProps<{
  /** 待绘制函数 y = f(x) */
  fn: (x: number) => number;
  /** 图表标题（可选） */
  title?: string;
  /** 初始可视范围（不传则按 f 在 [-10, 10] 上的取值自动计算） */
  initialRange?: ViewRange;
  /** 该公式的「有趣值」注解（顶点、周期、渐近线等），逐条展示 */
  notes?: string[];
  /** 自变量标签（如 r、a），默认 "x" */
  xLabel?: string;
  /** 几何联动图形：按动点取值同步画出对应图形（圆：半径 r；正方形：边长 a） */
  geometry?: 'circle' | 'square';
}>(), {notes: () => [], xLabel: 'x'});

const X_SPAN = 10; // 自动计算范围时的 x 采样半径
const SAMPLE = 600; // 曲线采样点数
const MIN_SPAN = 1e-6; // 缩放下限，防止范围塌缩
const MAX_SPAN = 1e6; // 缩放上限，防止范围过大
const TIP_WIDTH = 140; // 悬停浮层估算宽度
const TIP_HEIGHT = 24; // 悬停浮层估算高度
const AREA_SAMPLE = 120; // 区域阴影的采样点数
const PLAY_SECONDS = 8; // 动画扫过整个视野的时长（秒）

const wrapRef = ref<HTMLDivElement>();
const canvasRef = ref<HTMLCanvasElement>();
const geoCanvasRef = ref<HTMLCanvasElement>();
const hover = ref<HoverInfo | null>(null);
const range = ref<ViewRange>({xMin: -X_SPAN, xMax: X_SPAN, yMin: -8, yMax: 8});
/** 动点横坐标（输入框/滑块/动画驱动） */
const probeX = ref(0);
const playing = ref(false);

/** 视野内函数分析（随平移缩放实时重算） */
const extrema = computed(() => findExtrema(props.fn, range.value.xMin, range.value.xMax));
const zeros = computed(() => findZeros(props.fn, range.value.xMin, range.value.xMax));
const yIntercept = computed(() => props.fn(0));
const probeY = computed(() => props.fn(probeX.value));
/** 动点与 x 轴围成的有向面积 ∫₀ˣ f */
const area = computed(() => integrate(props.fn, 0, probeX.value));
const sliderStep = computed(() => (range.value.xMax - range.value.xMin) / 200 || 0.1);

/** 数字显示：保留至多 4 位小数 */
function fmt(v: number): string {
  return String(Number(v.toFixed(4)));
}

// 悬停浮层位置：靠近右/上边缘时翻转到另一侧
const tipStyle = computed(() => {
  if (!hover.value || !wrapRef.value) return {};
  const wrap = wrapRef.value;
  let left = hover.value.px + 12;
  let top = hover.value.py - TIP_HEIGHT - 8;
  if (left + TIP_WIDTH > wrap.clientWidth) {
    left = hover.value.px - TIP_WIDTH - 12;
  }
  if (top < 0) {
    top = hover.value.py + 12;
  }
  return {left: `${left}px`, top: `${top}px`};
});
let dragging = false;
let lastX = 0;
let lastY = 0;
let downX = 0; // 按下位置，用于区分单击取点与拖拽平移
let downY = 0;
let rafId = 0;
let playRafId = 0;
let lastPlayTime = 0;
let playDir = 1; // 动画方向：1 向右，-1 向左（到边缘折返）
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

/** 绘制动点区域阴影：曲线与 x 轴之间 [0, probeX] 的填充区（随 x 输入变化） */
function drawArea(ctx: CanvasRenderingContext2D, r: ViewRange, rect: {x: number; y: number; width: number; height: number}) {
  if (!Number.isFinite(probeY.value)) return;
  const xa = Math.max(Math.min(0, probeX.value), r.xMin);
  const xb = Math.min(Math.max(0, probeX.value), r.xMax);
  if (xb - xa <= 0) return;
  const y0Px = dataToPixel(0, 0, r, rect).y;
  ctx.beginPath();
  ctx.moveTo(dataToPixel(xa, 0, r, rect).x, y0Px);
  let started = true;
  let prevY: number | null = null;
  for (let i = 0; i <= AREA_SAMPLE; i++) {
    const dx = xa + ((xb - xa) * i) / AREA_SAMPLE;
    const dy = props.fn(dx);
    if (!Number.isFinite(dy) || (prevY !== null && isDiscontinuity(prevY, dy))) {
      started = false; prevY = null; continue;
    }
    const p = dataToPixel(dx, dy, r, rect);
    if (started) ctx.lineTo(p.x, p.y);
    else ctx.moveTo(p.x, p.y);
    started = true;
    prevY = dy;
  }
  ctx.lineTo(dataToPixel(xb, 0, r, rect).x, y0Px);
  ctx.closePath();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = cssVar('--utools-primary', '#409eff');
  ctx.fill();
  ctx.globalAlpha = 1;
}

/** 绘制极值点标记（视野内的局部极大/极小） */
function drawExtrema(ctx: CanvasRenderingContext2D, r: ViewRange, rect: {x: number; y: number; width: number; height: number}) {
  ctx.fillStyle = cssVar('--el-color-warning', '#e6a23c');
  ctx.strokeStyle = cssVar('--utools-bg-card', '#fff');
  for (const e of extrema.value) {
    const p = dataToPixel(e.x, e.y, r, rect);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

/** 绘制动点：x 处竖直虚线 + 曲线上的圆点 */
function drawProbe(ctx: CanvasRenderingContext2D, r: ViewRange, rect: {x: number; y: number; width: number; height: number}, h: number) {
  if (!Number.isFinite(probeY.value)) return;
  if (probeX.value < r.xMin || probeX.value > r.xMax) return;
  const p = dataToPixel(probeX.value, probeY.value, r, rect);
  ctx.strokeStyle = cssVar('--el-color-warning', '#e6a23c');
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(p.x, 0); ctx.lineTo(p.x, h);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = cssVar('--el-color-warning', '#e6a23c');
  ctx.beginPath();
  ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = cssVar('--utools-bg-card', '#fff');
  ctx.stroke();
}

/** 绘制几何联动图形：尺寸按动点取值等比缩放（圆半径 r / 正方形边长 a） */
function drawGeometry() {
  const canvas = geoCanvasRef.value;
  if (!canvas || !props.geometry) return;
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (w <= 0 || h <= 0) return;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = cssVar('--utools-bg-card', '#fff');
  ctx.fillRect(0, 0, w, h);

  const v = probeX.value;
  const vMax = Math.max(Math.abs(range.value.xMin), Math.abs(range.value.xMax)) || 1;
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  if (!Number.isFinite(v) || v <= 0) {
    ctx.fillStyle = cssVar('--utools-text-tertiary', '#8c8c8c');
    ctx.fillText(`${props.xLabel} 需为正数`, w / 2, h / 2);
    return;
  }
  const primary = cssVar('--utools-primary', '#409eff');
  const size = (v / vMax) * (Math.min(w, h) / 2 - 28); // 图形尺寸（半径/半边长，像素）
  ctx.strokeStyle = primary;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = primary;
  ctx.beginPath();
  if (props.geometry === 'circle') {
    ctx.arc(w / 2, h / 2, Math.max(size, 1), 0, Math.PI * 2);
  } else {
    ctx.rect(w / 2 - size, h / 2 - size, size * 2, size * 2);
  }
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.stroke();
  ctx.lineWidth = 1;
  // 标注：自变量与函数值
  ctx.fillStyle = cssVar('--utools-text-primary', '#262626');
  ctx.fillText(`${props.xLabel} = ${fmt(v)}`, w / 2, h - 24);
  ctx.fillStyle = primary;
  ctx.fillText(`y = ${fmt(probeY.value)}`, w / 2, h - 8);
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
  drawArea(ctx, r, rect);
  drawCurve(ctx, r, rect);
  drawExtrema(ctx, r, rect);
  drawProbe(ctx, r, rect, h);
  drawGeometry();

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

/** 播放动画：动点沿曲线在视野内往返移动，面积阴影跟随变化 */
function playStep(time: number) {
  if (!playing.value) return;
  const r = range.value;
  const span = r.xMax - r.xMin;
  if (lastPlayTime > 0) {
    probeX.value += (span / PLAY_SECONDS) * ((time - lastPlayTime) / 1000) * playDir;
    if (probeX.value >= r.xMax) { probeX.value = r.xMax; playDir = -1; }
    if (probeX.value <= r.xMin) { probeX.value = r.xMin; playDir = 1; }
  }
  lastPlayTime = time;
  playRafId = requestAnimationFrame(playStep);
}

function togglePlay() {
  playing.value = !playing.value;
  if (playing.value) {
    lastPlayTime = 0;
    playRafId = requestAnimationFrame(playStep);
  } else {
    cancelAnimationFrame(playRafId);
  }
}

function stopPlay() {
  playing.value = false;
  cancelAnimationFrame(playRafId);
}

function onPointerDown(e: PointerEvent) {
  dragging = true;
  lastX = e.offsetX;
  lastY = e.offsetY;
  downX = e.offsetX;
  downY = e.offsetY;
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
function onPointerUp(e: PointerEvent) {
  dragging = false;
  // 单击（位移 < 4px）：把动点设置到点击处的横坐标；拖拽则视为平移
  if (Math.hypot(e.offsetX - downX, e.offsetY - downY) < 4) {
    const wrap = wrapRef.value;
    if (!wrap) return;
    stopPlay();
    const d = pixelToData(e.offsetX, e.offsetY, range.value, {x: 0, y: 0, width: wrap.clientWidth, height: wrap.clientHeight});
    probeX.value = Number(d.x.toFixed(4));
  }
}
function onWheel(e: WheelEvent) {
  if (e.deltaY === 0) return;
  const wrap = wrapRef.value;
  if (!wrap) return;
  const r = range.value;
  const factor = e.deltaY < 0 ? 0.8 : 1.25; // 向上滚动放大，向下缩小
  const xSpan = (r.xMax - r.xMin) * factor;
  const ySpan = (r.yMax - r.yMin) * factor;
  if (xSpan < MIN_SPAN || ySpan < MIN_SPAN) return;
  if (xSpan > MAX_SPAN || ySpan > MAX_SPAN) return;
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
  stopPlay();
  range.value = props.initialRange ?? calcViewRange(fn, -X_SPAN, X_SPAN);
  // 动点默认放在视野 70% 处，让面积阴影立即可见
  probeX.value = range.value.xMin + (range.value.xMax - range.value.xMin) * 0.7;
}, {immediate: true});
// probeX 变化（输入/滑块/动画）时重绘
watch(probeX, () => scheduleDraw());
onMounted(() => {
  resizeObserver = new ResizeObserver(() => scheduleDraw());
  if (wrapRef.value) resizeObserver.observe(wrapRef.value);
  scheduleDraw();
});
onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  cancelAnimationFrame(rafId);
  cancelAnimationFrame(playRafId);
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

  .plot-row {
    display: flex;
    align-items: stretch;
    gap: 10px;
  }

  .plot-wrap {
    position: relative;
    flex: 1;
    min-width: 0;
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

  // ---- 几何联动面板 ----
  .geo-wrap {
    flex-shrink: 0;
    width: 180px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;

    .geo-canvas {
      width: 180px;
      height: 240px;
      border: 1px solid var(--utools-border-divider);
      border-radius: 8px;
    }

    .geo-caption {
      font-size: 11px;
      color: var(--utools-text-tertiary);
    }
  }

  // ---- 动点控制条 ----
  .probe-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 10px;

    .probe-label {
      font-size: 13px;
      font-family: 'Menlo', 'Consolas', monospace;
      color: var(--utools-text-secondary);
    }

    .probe-input {
      width: 80px;
      padding: 4px 8px;
      font-size: 13px;
      font-family: 'Menlo', 'Consolas', monospace;
      color: var(--utools-text-primary);
      background: var(--utools-bg-card);
      border: 1px solid var(--utools-border-primary);
      border-radius: 4px;
      outline: none;

      &:focus {
        border-color: var(--utools-primary);
      }
    }

    .probe-slider {
      flex: 1;
      accent-color: var(--utools-primary);
      cursor: pointer;
    }

    .probe-play {
      width: 32px;
      height: 28px;
      font-size: 13px;
      color: var(--utools-text-primary);
      background: var(--utools-bg-card);
      border: 1px solid var(--utools-border-primary);
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        border-color: var(--utools-primary);
        color: var(--utools-primary);
      }
    }
  }

  // ---- 函数分析面板 ----
  .plot-analysis {
    margin-top: 10px;
    padding: 8px 10px;
    border: 1px solid var(--utools-border-divider);
    border-radius: 8px;
    font-size: 12.5px;
    line-height: 1.8;
    color: var(--utools-text-secondary);

    .analysis-row {
      display: flex;
      align-items: baseline;
      flex-wrap: wrap;
      gap: 6px;

      .value {
        font-family: 'Menlo', 'Consolas', monospace;
        color: var(--utools-text-primary);
      }

      .muted {
        color: var(--utools-text-tertiary);
      }

      .sep {
        color: var(--utools-text-tertiary);
      }
    }

    .tag {
      flex-shrink: 0;
      padding: 0 6px;
      font-size: 11px;
      border-radius: 3px;
      line-height: 18px;
      color: var(--utools-primary);
      background: var(--utools-bg-secondary);
      border: 1px solid var(--utools-border-primary);
    }
  }
}
</style>
