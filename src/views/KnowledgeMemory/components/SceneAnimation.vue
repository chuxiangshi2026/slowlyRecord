<template>
  <div class="scene-animation">
    <canvas ref="canvasRef" class="scene-canvas" />
    <div class="scene-caption">{{ config.caption }}</div>
  </div>
</template>

<script setup lang="ts">
import {ref, onMounted, onBeforeUnmount} from 'vue';
import type {SceneConfig} from '../scene-maps';

/** 粒子：位置、速度、半径、剩余寿命（帧）、透明度 */
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  alpha: number;
  color: string;
}

/** 容器在画布中的几何范围（随尺寸计算） */
interface VesselRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

const props = defineProps<{
  /** 专属场景配置 */
  config: SceneConfig;
}>();

const canvasRef = ref<HTMLCanvasElement>();
let rafId = 0;
let particles: Particle[] = [];
let sediment = 0; // 沉淀层高度（像素）
let w = 0;
let h = 0;
let frame = 0; // 帧计数，驱动火焰闪烁

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** 画布尺寸惰性初始化：对话框过渡动画期间 clientWidth 为 0，等首帧再量 */
function ensureSize(): boolean {
  const canvas = canvasRef.value;
  if (!canvas) return false;
  const cw = canvas.clientWidth;
  const ch = canvas.clientHeight;
  if (cw <= 0 || ch <= 0) return false;
  if (cw === w && ch === h) return true;
  w = cw;
  h = ch;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d');
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return true;
}

/** 容器几何：试管细长圆底居中，烧杯矮宽居中 */
function vesselRect(): VesselRect {
  if (props.config.vessel === 'testTube') {
    const vw = w * 0.18;
    return {left: w / 2 - vw / 2, right: w / 2 + vw / 2, top: h * 0.08, bottom: h * 0.78};
  }
  if (props.config.vessel === 'beaker') {
    return {left: w * 0.28, right: w * 0.72, top: h * 0.25, bottom: h * 0.88};
  }
  return {left: 0, right: w, top: 0, bottom: h};
}

/** 液面 y 坐标与液体内底部 y 坐标（沉淀堆积会抬高底面） */
function liquidTop(v: VesselRect): number {
  const level = props.config.liquidLevel ?? 0.65;
  return v.bottom - (v.bottom - v.top) * level;
}

/** 生成一个新粒子（按配置判断是气泡/沉淀/火星） */
function spawn(v: VesselRect): Particle | null {
  const c = props.config;
  const top = liquidTop(v);
  if (c.bubbleColor) {
    // 液体内底部冒泡，上升带摇摆
    return {x: rand(v.left + 8, v.right - 8), y: v.bottom - sediment - rand(4, 12), vx: rand(-0.15, 0.15), vy: rand(-1.3, -0.6), r: rand(2, 4.5), life: 9999, alpha: 0.8, color: c.bubbleColor};
  }
  if (c.sedimentColor) {
    // 液体内中上部生成颗粒，缓慢下沉
    return {x: rand(v.left + 6, v.right - 6), y: rand(top + 4, top + (v.bottom - top) * 0.5), vx: rand(-0.06, 0.06), vy: rand(0.25, 0.55), r: rand(1, 2.5), life: 9999, alpha: 0.95, color: c.sedimentColor};
  }
  if (c.sparkColors) {
    // 火焰顶部喷出火星，向外飞溅后熄灭
    const colors = c.sparkColors;
    return {x: w / 2 + rand(-12, 12), y: h * 0.72, vx: rand(-1.4, 1.4), vy: rand(-3.4, -1.2), r: rand(1, 2.8), life: rand(35, 80), alpha: 1, color: colors[Math.floor(Math.random() * colors.length)]};
  }
  return null;
}

/** 绘制容器轮廓（试管圆底 / 烧杯平底） */
function drawVessel(ctx: CanvasRenderingContext2D, v: VesselRect) {
  if (props.config.vessel === 'none') return;
  ctx.strokeStyle = '#9db3b8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (props.config.vessel === 'testTube') {
    const r = (v.right - v.left) / 2;
    ctx.moveTo(v.left, v.top);
    ctx.lineTo(v.left, v.bottom - r);
    ctx.arc(v.left + r, v.bottom - r, r, Math.PI, 0, true);
    ctx.lineTo(v.right, v.top);
  } else {
    ctx.moveTo(v.left, v.top);
    ctx.lineTo(v.left, v.bottom);
    ctx.lineTo(v.right, v.bottom);
    ctx.lineTo(v.right, v.top);
  }
  ctx.stroke();
  ctx.lineWidth = 1;
}

/** 绘制液体（容器内从底部到液面） */
function drawLiquid(ctx: CanvasRenderingContext2D, v: VesselRect) {
  const c = props.config;
  if (!c.liquidColor || c.vessel === 'none') return;
  const top = liquidTop(v);
  ctx.fillStyle = c.liquidColor;
  if (c.vessel === 'testTube') {
    // 试管内液体：矩形 + 底部圆弧近似
    const r = (v.right - v.left) / 2 - 2;
    ctx.fillRect(v.left + 2, top, v.right - v.left - 4, v.bottom - r - top);
    ctx.beginPath();
    ctx.arc(v.left + 2 + r, v.bottom - r, r, 0, Math.PI);
    ctx.fill();
  } else {
    ctx.fillRect(v.left + 2, top, v.right - v.left - 4, v.bottom - top - 2);
  }
  // 液面线
  ctx.strokeStyle = 'rgba(120, 150, 160, 0.5)';
  ctx.beginPath();
  ctx.moveTo(v.left + 2, top);
  ctx.lineTo(v.right - 2, top);
  ctx.stroke();
}

/** 绘制火焰（heating：容器底部小火苗；燃烧类：画面中央主火焰），随帧闪烁 */
function drawFlame(ctx: CanvasRenderingContext2D, v: VesselRect) {
  const c = props.config;
  if (!c.flameColor) return;
  const flicker = 1 + Math.sin(frame / 4) * 0.15 + Math.sin(frame / 7) * 0.1;
  if (c.heating) {
    // 容器正下方的加热小火焰
    const fx = (v.left + v.right) / 2;
    const fh = 22 * flicker;
    const fy = v.bottom + 30;
    ctx.fillStyle = c.flameColor;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.moveTo(fx - 10, fy);
    ctx.quadraticCurveTo(fx - 12, fy - fh * 0.6, fx, fy - fh);
    ctx.quadraticCurveTo(fx + 12, fy - fh * 0.6, fx + 10, fy);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    return;
  }
  if (c.vessel === 'none') {
    // 燃烧主火焰：内外两层泪滴
    const fy = h * 0.86;
    for (const [scale, alpha] of [[1, 0.55], [0.6, 0.9]] as const) {
      const fh = h * 0.3 * scale * flicker;
      const fw = w * 0.14 * scale * (2 - flicker);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = c.flameColor;
      ctx.beginPath();
      ctx.moveTo(w / 2 - fw, fy);
      ctx.quadraticCurveTo(w / 2 - fw * 1.2, fy - fh * 0.5, w / 2 + Math.sin(frame / 5) * 6, fy - fh);
      ctx.quadraticCurveTo(w / 2 + fw * 1.2, fy - fh * 0.5, w / 2 + fw, fy);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

/** 单帧：更新粒子并绘制完整场景 */
function tick() {
  const canvas = canvasRef.value;
  if (!canvas) return;
  if (!ensureSize()) {
    rafId = requestAnimationFrame(tick);
    return;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  frame++;
  const c = props.config;
  const v = vesselRect();

  // 背景
  ctx.fillStyle = c.vessel === 'none' ? '#1b1b1f' : '#f4f8f6';
  ctx.fillRect(0, 0, w, h);

  drawVessel(ctx, v);
  drawLiquid(ctx, v);

  // 沉淀层：颗粒落底后堆积，封顶液体的 1/3
  if (c.sedimentColor && sediment > 0) {
    ctx.fillStyle = c.sedimentColor;
    ctx.globalAlpha = 0.95;
    ctx.fillRect(v.left + 2, v.bottom - sediment - 2, v.right - v.left - 4, sediment);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#a8b6bd';
    ctx.beginPath();
    ctx.moveTo(v.left + 2, v.bottom - sediment - 2);
    ctx.lineTo(v.right - 2, v.bottom - sediment - 2);
    ctx.stroke();
  }

  // 补充新粒子
  const spawnChance = c.sparkColors ? 0.7 : c.sedimentColor ? 0.45 : 0.3;
  if (Math.random() < spawnChance && particles.length < 140) {
    const p = spawn(v);
    if (p) particles.push(p);
  }

  const top = liquidTop(v);
  const floor = v.bottom - sediment - 2;
  particles = particles.filter(p => p.life > 0);
  for (const p of particles) {
    if (c.bubbleColor) {
      p.x += p.vx + Math.sin((frame + p.r * 20) / 10) * 0.3;
      p.y += p.vy;
      if (p.y < top + 4) p.life = 0; // 到液面破裂
    } else if (c.sedimentColor) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.y >= floor) {
        p.life = 0;
        sediment = Math.min(sediment + 0.3, (v.bottom - top) / 3);
      }
    } else {
      p.life--;
      p.vy += 0.06; // 火星受重力减速
      p.x += p.vx;
      p.y += p.vy;
      p.alpha = Math.max(0, p.life / 70);
    }
  }

  // 绘制粒子
  for (const p of particles) {
    ctx.globalAlpha = p.alpha;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    if (c.bubbleColor) {
      ctx.strokeStyle = p.color;
      ctx.stroke();
    } else {
      ctx.fillStyle = p.color;
      ctx.fill();
      if (c.sedimentColor) {
        ctx.strokeStyle = '#a8b6bd';
        ctx.stroke();
      }
    }
  }
  ctx.globalAlpha = 1;

  drawFlame(ctx, v);

  rafId = requestAnimationFrame(tick);
}

onMounted(() => {
  particles = [];
  sediment = 0;
  rafId = requestAnimationFrame(tick);
});

onBeforeUnmount(() => {
  cancelAnimationFrame(rafId);
});
</script>

<style scoped lang="scss">
.scene-animation {
  width: 100%;

  .scene-canvas {
    display: block;
    width: 100%;
    height: 260px;
    border: 1px solid var(--utools-border-divider);
    border-radius: 8px;
  }

  .scene-caption {
    margin-top: 8px;
    font-size: 12.5px;
    color: var(--utools-text-secondary);
  }
}
</style>
