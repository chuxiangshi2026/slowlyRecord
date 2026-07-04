<template>
  <div ref="chartRef" class="timeline-axis-chart"></div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick, shallowRef } from 'vue';
import type { TextArticle, TimelineCategory } from '@/types/text-memory';
import { getTimelineCategoryMeta } from '@/utils/timeline-service';

interface Props {
  articles: TextArticle[];
}
const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'select', article: TextArticle): void;
  (e: 'locate', article: TextArticle): void;
}>();

const chartRef = ref<HTMLDivElement>();
const chart = shallowRef<import('echarts/core').ECharts | null>(null);
let echartsLib: typeof import('echarts/core') | null = null;

function formatYear(year?: number): string {
  if (year == null) return '';
  return year < 0 ? `公元前${Math.abs(year)}年` : `公元${year}年`;
}

async function ensureEcharts() {
  if (echartsLib) return echartsLib;
  const core = await import('echarts/core');
  const [{ CustomChart }, { TooltipComponent, GridComponent }, { CanvasRenderer }] = await Promise.all([
    import('echarts/charts'),
    import('echarts/components'),
    import('echarts/renderers'),
  ]);
  core.use([CustomChart, TooltipComponent, GridComponent, CanvasRenderer]);
  echartsLib = core;
  return core;
}

async function render() {
  if (!chartRef.value) return;
  const ec = await ensureEcharts();
  if (!chart.value) {
    chart.value = ec.init(chartRef.value);
    // 点击事件点 → 打开详情
    chart.value.on('click', (e: any) => {
      const article = e?.data?.article;
      if (article) emit('select', article);
    });
  }

  const events = props.articles
    .filter(a => typeof a.year === 'number')
    .map(a => ({
      year: a.year as number,
      title: a.title,
      category: a.category as TimelineCategory | undefined,
      reign: a.reign,
      era: a.era,
      location: a.location,
      figures: a.figures,
      content: a.content,
      _article: a,
    }))
    .sort((a, b) => a.year - b.year);

  if (events.length === 0) {
    chart.value.clear();
    chart.value.setOption({
      title: { text: '暂无带年份的事件', left: 'center', top: 'middle', textStyle: { color: '#909399', fontSize: 14 } },
    });
    return;
  }

  const years = events.map(e => e.year);
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  // 横向留白
  const span = Math.max(maxYear - minYear, 1);
  const pad = Math.max(Math.floor(span * 0.08), 5);
  const axisMin = minYear - pad;
  const axisMax = maxYear + pad;

  // 每个事件点的高度交错（避免重叠堆叠在同一水平线）
  const laneCount = 5;

  const option: any = {
    tooltip: {
      trigger: 'item',
      formatter: (p: any) => {
        const d = p.data?.event;
        if (!d) return '';
        const figStr = d.figures?.length ? d.figures.map((f: any) => f.name).join('、') : '';
        return `<div style="max-width:280px">
          <div style="font-weight:bold;font-size:13px;margin-bottom:4px">${d.title}</div>
          <div style="font-size:12px;color:#e6a23c;margin-bottom:2px">${formatYear(d.year)}${d.reign ? ' · ' + d.reign : ''}${d.era ? ' · ' + d.era : ''}</div>
          ${d.location ? `<div style="font-size:12px;color:#666;margin-bottom:2px">📍 ${d.location}</div>` : ''}
          ${figStr ? `<div style="font-size:12px;color:#666;margin-bottom:2px">👤 ${figStr}</div>` : ''}
          <div style="font-size:12px;color:#999;margin-top:4px;line-height:1.5">${(d.content || '').substring(0, 80)}${d.content?.length > 80 ? '...' : ''}</div>
        </div>`;
      },
    },
    grid: { left: 30, right: 30, top: 40, bottom: 50, containLabel: true },
    xAxis: {
      type: 'value',
      min: axisMin,
      max: axisMax,
      axisLabel: {
        formatter: (v: number) => (v < 0 ? `前${Math.abs(v)}` : `${v}`),
        color: '#909399',
      },
      splitLine: { lineStyle: { type: 'dashed', color: '#ebeef5' } },
    },
    yAxis: { show: false, min: 0, max: laneCount + 1 },
    series: [
      {
        type: 'custom',
        renderItem: (params: any, api: any) => {
          const year = api.value(0);
          const idx = api.value(1);
          const point = api.coord([year, idx]);
          const event = events[params.dataIndex];
          const color = getTimelineCategoryMeta(event?.category)?.color || '#909399';
          return {
            type: 'circle',
            shape: { cx: point[0], cy: point[1], r: 7 },
            style: { fill: color, stroke: '#fff', lineWidth: 2 },
          };
        },
        encode: { x: 0, y: 1 },
        data: events.map((e, i) => ({
          value: [e.year, (i % laneCount) + 1],
          event: e,
          article: e._article,
        })),
      },
    ],
  };

  chart.value.setOption(option, true);
}

function handleResize() {
  chart.value?.resize();
}

onMounted(() => {
  nextTick(render);
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  chart.value?.dispose();
  chart.value = null;
});

watch(() => props.articles, render, { deep: true });
</script>

<style scoped>
.timeline-axis-chart {
  width: 100%;
  height: 360px;
}
</style>
