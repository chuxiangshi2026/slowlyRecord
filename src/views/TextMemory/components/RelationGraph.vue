<template>
  <div class="relation-graph-wrap">
    <div ref="chartRef" class="relation-graph-chart"></div>
    <div v-if="hasNoData" class="relation-empty">当前筛选范围内无人物关系数据</div>

    <!-- 人物参与事件列表弹窗 -->
    <el-dialog v-model="showFigureDialog" :title="figureDialogTitle" width="460px" append-to-body destroy-on-close>
      <div style="max-height: 380px; overflow-y: auto;">
        <div v-for="a in figureArticles" :key="a._id" class="figure-event-item">
          <div style="flex: 1; min-width: 0;">
            <div style="font-size: 14px; font-weight: bold; color: #303133;">{{ a.title }}</div>
            <div style="font-size: 12px; color: #e6a23c; margin-top: 2px;">
              {{ a.year != null ? (a.year < 0 ? `公元前${Math.abs(a.year)}年` : `公元${a.year}年`) : '年代未知' }}
              <span v-if="a.era" style="color: #606266; margin-left: 6px;">{{ a.era }}</span>
            </div>
            <div style="font-size: 12px; color: #909399; margin-top: 2px;">📍 {{ a.location || '地点未知' }}</div>
          </div>
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <el-button size="small" @click="emit('select', a)">详情</el-button>
            <el-button v-if="a.geo" size="small" type="primary" @click="emit('locate', a)">定位</el-button>
          </div>
        </div>
        <el-empty v-if="figureArticles.length === 0" description="该人物无关联事件" />
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick, shallowRef } from 'vue';
import type { TextArticle, TimelineFigure, TimelineRelation } from '@/types/text-memory';

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

// 人物事件弹窗
const showFigureDialog = ref(false);
const figureDialogTitle = ref('');
const figureArticles = ref<TextArticle[]>([]);

interface GraphNode {
  id: string;
  name: string;
  title?: string;
  desc?: string;
  value: number; // 出现次数
  symbolSize: number;
}
interface GraphLink {
  source: string;
  target: string;
  label?: string;
  value?: number;
}

const hasNoData = computed(() => {
  return props.articles.every(a => !a.relations?.length && !a.figures?.length);
});

function buildGraph() {
  const nodeMap = new Map<string, GraphNode>();
  const linkMap = new Map<string, GraphLink>();

  const ensureNode = (f: TimelineFigure) => {
    if (!nodeMap.has(f.name)) {
      nodeMap.set(f.name, {
        id: f.name,
        name: f.name,
        title: f.title,
        desc: f.desc,
        value: 1,
        symbolSize: 30,
      });
    } else {
      const node = nodeMap.get(f.name)!;
      node.value += 1;
      if (!node.title && f.title) node.title = f.title;
      if (!node.desc && f.desc) node.desc = f.desc;
    }
  };

  props.articles.forEach(a => {
    a.figures?.forEach(ensureNode);
    a.relations?.forEach((r: TimelineRelation) => {
      // 保证端点节点存在
      ensureNode({ name: r.from });
      ensureNode({ name: r.to });
      const key = `${r.from}->${r.to}:${r.type}`;
      if (!linkMap.has(key)) {
        linkMap.set(key, { source: r.from, target: r.to, label: r.type, value: 1 });
      } else {
        linkMap.get(key)!.value! += 1;
      }
    });
  });

  // 根据 value 调整节点大小
  const nodes = Array.from(nodeMap.values()).map(n => ({
    ...n,
    symbolSize: Math.min(30 + n.value * 8, 70),
  }));

  const links = Array.from(linkMap.values());
  return { nodes, links };
}

async function ensureEcharts() {
  if (echartsLib) return echartsLib;
  const core = await import('echarts/core');
  const [{ GraphChart }, { TooltipComponent, LegendComponent }, { CanvasRenderer }] = await Promise.all([
    import('echarts/charts'),
    import('echarts/components'),
    import('echarts/renderers'),
  ]);
  core.use([GraphChart, TooltipComponent, LegendComponent, CanvasRenderer]);
  echartsLib = core;
  return core;
}

async function render() {
  if (!chartRef.value) return;
  const ec = await ensureEcharts();
  if (!chart.value) {
    chart.value = ec.init(chartRef.value);
    // 点击人物节点 → 弹出该人物参与的事件列表
    chart.value.on('click', (e: any) => {
      if (e?.dataType !== 'node') return;
      const name = e.data?.name;
      if (!name) return;
      const list = props.articles.filter(a => a.figures?.some(f => f.name === name));
      figureDialogTitle.value = `「${name}」参与的事件`;
      figureArticles.value = list;
      showFigureDialog.value = true;
    });
  }

  const { nodes, links } = buildGraph();

  if (nodes.length === 0) {
    chart.value.clear();
    return;
  }

  const option: any = {
    tooltip: {
      formatter: (p: any) => {
        if (p.dataType === 'node') {
          const n = p.data;
          return `<div style="font-weight:bold">${n.name}</div>
            ${n.title ? `<div style="font-size:12px;color:#666">${n.title}</div>` : ''}
            ${n.desc ? `<div style="font-size:12px;color:#999;margin-top:2px">${n.desc}</div>` : ''}
            <div style="font-size:11px;color:#bbb;margin-top:2px">出现 ${n.value} 次</div>`;
        }
        if (p.dataType === 'edge') {
          return `<div style="font-size:12px">${p.data.source} ↔ ${p.data.target}</div>
            <div style="font-size:12px;color:#e6a23c;margin-top:2px">${p.data.label}</div>`;
        }
        return '';
      },
    },
    legend: [{ show: false }],
    series: [
      {
        type: 'graph',
        layout: 'force',
        roam: true,
        draggable: true,
        label: { show: true, position: 'right', fontSize: 12 },
        force: { repulsion: 220, edgeLength: [80, 180], gravity: 0.1 },
        edgeLabel: {
          show: true,
          fontSize: 11,
          color: '#e6a23c',
          formatter: (p: any) => p.data.label || '',
        },
        edgeSymbol: ['none', 'none'],
        lineStyle: { color: '#c0c4cc', width: 1.5, curveness: 0.1 },
        emphasis: { focus: 'adjacency', lineStyle: { width: 3 } },
        data: nodes,
        links,
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
.relation-graph-wrap {
  position: relative;
  width: 100%;
  height: 100%;
}
.relation-graph-chart {
  width: 100%;
  height: 100%;
  min-height: 420px;
}
.relation-empty {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #909399;
  font-size: 14px;
}

.figure-event-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  margin-bottom: 8px;
  border-radius: 6px;
  border: 1px solid #e4e7ed;
  background: #fff;
}
</style>
