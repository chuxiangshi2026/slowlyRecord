<template>
  <div class="scene-animation">
    <canvas ref="canvasRef" class="scene-canvas" />
    <div class="scene-caption">{{ caption }}</div>
  </div>
</template>

<script setup lang="ts">
import {ref, computed, onMounted, onBeforeUnmount} from 'vue';
import type {SceneType} from '../scene-maps';

/** 粒子：位置、速度、半径、剩余寿命（帧）、透明度 */
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  alpha: number;
}

const props = defineProps<{
  /** 场景类型：气体逸出 / 沉淀生成 / 燃烧 */
  type: SceneType;
}>();

const CAPTIONS: Record<SceneType, string> = {
  gas: '现象：有气泡产生，气体不断逸出（↑）',
  precipitate: '现象：生成白色沉淀，逐渐沉降到容器底部（↓）',
  burn: '现象：剧烈燃烧，发光放热，火星四射',
};

const caption = computed(() => CAPTIONS[props.type]);

const canvasRef = ref<HTMLCanvasElement>();
let rafId = 0;
let particles: Particle[] = [];
let sediment = 0; // 沉淀层高度（像素），precipitate 场景用
let w = 0;
let h = 0;

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

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** 按场景类型生成一个新粒子 */
function spawn(): Particle {
  if (props.type === 'gas') {
    // 底部随机位置冒出气泡，上升带左右摆动
    return {x: rand(w * 0.2, w * 0.8), y: h - rand(4, 16), vx: rand(-0.2, 0.2), vy: rand(-1.4, -0.6), r: rand(2, 5), life: rand(160, 260), alpha: 0.8};
  }
  if (props.type === 'precipitate') {
    // 中上部生成白色颗粒，缓慢下沉
    return {x: rand(w * 0.1, w * 0.9), y: rand(h * 0.05, h * 0.5), vx: rand(-0.08, 0.08), vy: rand(0.25, 0.6), r: rand(1, 2.5), life: rand(300, 600), alpha: 0.9};
  }
  // burn：底部中心喷出火星，快速上窜后熄灭
  return {x: w / 2 + rand(-14, 14), y: h - rand(6, 20), vx: rand(-1.2, 1.2), vy: rand(-3.2, -1.2), r: rand(1, 3), life: rand(40, 90), alpha: 1};
}

/** 单帧：更新粒子并绘制 */
function tick() {
  const canvas = canvasRef.value;
  if (!canvas) return;
  if (!ensureSize()) {
    rafId = requestAnimationFrame(tick);
    return;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // 背景：燃烧为暗色夜空，沉淀为浅蓝液体，气体为浅绿液体
  ctx.fillStyle = props.type === 'burn' ? '#1b1b1f' : props.type === 'precipitate' ? '#dce8ee' : '#eef4f0';
  ctx.fillRect(0, 0, w, h);

  // 每帧按概率补充新粒子
  const spawnChance = props.type === 'burn' ? 0.7 : props.type === 'precipitate' ? 0.45 : 0.25;
  if (Math.random() < spawnChance && particles.length < 120) {
    particles.push(spawn());
  }

  // 沉淀层（precipitate）：颗粒落底后堆积成层
  if (props.type === 'precipitate' && sediment > 0) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fillRect(0, h - sediment, w, sediment);
    ctx.strokeStyle = '#b8c4c9';
    ctx.beginPath();
    ctx.moveTo(0, h - sediment);
    ctx.lineTo(w, h - sediment);
    ctx.stroke();
  }

  const floor = h - sediment;
  particles = particles.filter(p => p.life > 0);
  for (const p of particles) {
    p.life--;
    if (props.type === 'gas') {
      p.x += p.vx + Math.sin(p.life / 10) * 0.3; // 上升时左右摇摆
      p.y += p.vy;
      if (p.y < 6) p.life = 0; // 到液面破裂消失
    } else if (props.type === 'precipitate') {
      p.x += p.vx;
      p.y += p.vy;
      if (p.y >= floor - 2) {
        p.life = 0;
        sediment = Math.min(sediment + 0.3, h * 0.25); // 堆积，封顶 1/4 高度
      }
    } else {
      p.vy += 0.06; // 火星受重力减速
      p.x += p.vx;
      p.y += p.vy;
      p.alpha = Math.max(0, p.life / 90);
    }
  }

  for (const p of particles) {
    ctx.globalAlpha = p.alpha;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    if (props.type === 'gas') {
      ctx.strokeStyle = '#6ba8c9';
      ctx.stroke();
    } else if (props.type === 'precipitate') {
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#a8b6bd';
      ctx.stroke();
    } else {
      ctx.fillStyle = Math.random() < 0.5 ? '#ffb84d' : '#ff7a45';
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

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
