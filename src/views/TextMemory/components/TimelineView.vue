<template>
  <div class="timeline-view">
    <!-- 筛选条 -->
    <div class="timeline-toolbar">
      <el-select v-model="filter.category" placeholder="分类" clearable size="small" style="width: 110px">
        <el-option v-for="c in TIMELINE_CATEGORIES" :key="c.code" :label="c.label" :value="c.code" />
      </el-select>
      <el-select v-model="filter.region" placeholder="区域" clearable size="small" style="width: 110px; margin-left: 8px">
        <el-option v-for="r in TIMELINE_REGIONS" :key="r.code" :label="r.label" :value="r.code" />
      </el-select>
      <el-select v-model="filter.era" placeholder="朝代/时代" clearable filterable size="small" style="width: 160px; margin-left: 8px">
        <el-option v-for="e in availableEras" :key="e" :label="e" :value="e" />
      </el-select>
      <el-select v-model="filter.reign" placeholder="年号/时期" clearable filterable size="small" style="width: 160px; margin-left: 8px">
        <el-option v-for="r in availableReigns" :key="r" :label="r" :value="r" />
      </el-select>
      <el-input v-model="filter.yearFrom" placeholder="起始年" size="small" style="width: 100px; margin-left: 8px" type="number" />
      <span style="color: #909399; margin: 0 2px;">—</span>
      <el-input v-model="filter.yearTo" placeholder="结束年" size="small" style="width: 100px" type="number" />
      <el-input v-model="filter.keyword" placeholder="事件/人物/关键词..." clearable size="small" style="width: 220px; margin-left: 8px" />
      <el-button :icon="Sort" size="small" :type="filter.sortOrder === 'desc' ? 'primary' : 'default'" style="margin-left: 6px" @click="toggleSortOrder">
        {{ filter.sortOrder === 'asc' ? '↑ 正序' : '↓ 倒序' }}
      </el-button>
      <el-radio-group v-model="innerMode" size="small" style="margin-left: 6px">
        <el-radio-button label="vertical">纵向时间线</el-radio-button>
        <el-radio-button label="axis">横向时间轴</el-radio-button>
      </el-radio-group>
      <el-button size="small" style="margin-left: auto" @click="openRelationGraphAll">
        <el-icon><Connection /></el-icon> 人物关系图谱
      </el-button>
    </div>

    <div class="timeline-count">共 {{ filteredArticles.length }} 个事件</div>

    <!-- 纵向时间线 -->
    <div v-if="innerMode === 'vertical'" class="timeline-list">
      <el-empty v-if="filteredArticles.length === 0" description="暂无时间线事件，点击「导入」添加" />
      <el-timeline v-else>
        <el-timeline-item
          v-for="article in filteredArticles"
          :key="article._id"
          :timestamp="formatTimestamp(article)"
          placement="top"
          :color="getCategoryColor(article.category)"
        >
          <div class="tl-card" @click="$emit('select', article)">
            <div class="tl-card-header">
              <span class="tl-title">{{ article.title }}</span>
              <div class="tl-tags">
                <el-tag size="small" :color="getCategoryColor(article.category)" effect="dark" v-if="article.category">
                  {{ getCategoryLabel(article.category) }}
                </el-tag>
                <el-tag size="small" type="info" v-if="article.region">{{ getRegionLabel(article.region) }}</el-tag>
                <el-tag size="small" type="info" v-if="article.era">{{ article.era }}</el-tag>
              </div>
            </div>
            <div class="tl-content">{{ article.content.substring(0, 160) }}{{ article.content.length > 160 ? '...' : '' }}</div>
            <div class="tl-meta">
              <span v-if="article.location" class="tl-meta-item">📍 {{ article.location }}</span>
              <span v-if="article.figures?.length" class="tl-meta-item">
                👤
                <el-tag v-for="f in article.figures.slice(0, 5)" :key="f.name" size="small" effect="plain" style="margin-right: 4px">
                  {{ f.name }}
                </el-tag>
              </span>
            </div>
            <div class="tl-background" v-if="article.background">
              <span class="tl-bg-label">背景：</span>{{ article.background }}
            </div>
            <div class="tl-actions" v-if="article.geo || article.figures?.length">
              <el-button v-if="article.geo" link type="primary" size="small" @click.stop="$emit('locate', article)">
                <el-icon><MapLocation /></el-icon> 地图定位
              </el-button>
              <el-button v-if="article.figures?.length" link type="primary" size="small" @click.stop="openFigureGraphFor(article)">
                <el-icon><Connection /></el-icon> 人物关系
              </el-button>
            </div>
          </div>
        </el-timeline-item>
      </el-timeline>
    </div>

    <!-- 横向时间轴 -->
    <div v-else class="timeline-axis-wrap">
      <TimelineAxis :articles="filteredArticles" @select="$emit('select', $event)" @locate="$emit('locate', $event)" />
    </div>

    <!-- 人物关系图谱弹窗 -->
    <el-dialog v-model="showRelationGraph" :title="relationDialogTitle" width="90%" top="5vh" destroy-on-close>
      <div style="height: 70vh">
        <RelationGraph :articles="relationGraphArticles" @select="onRelationSelect" @locate="onRelationLocate" />
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch } from 'vue';
import { Connection, MapLocation, Sort } from '@element-plus/icons-vue';
import type { TextArticle, TimelineCategory, TimelineRegion } from '@/types/text-memory';
import {
  TIMELINE_CATEGORIES,
  TIMELINE_REGIONS,
  getTimelineCategoryMeta,
  getTimelineRegionMeta,
  collectEras,
  collectReigns,
} from '@/utils/timeline-service';
import TimelineAxis from './TimelineAxis.vue';
import RelationGraph from './RelationGraph.vue';

interface Props {
  articles: TextArticle[];
}
const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'select', article: TextArticle): void;
  (e: 'locate', article: TextArticle): void;
}>();

const innerMode = ref<'vertical' | 'axis'>('vertical');
const showRelationGraph = ref(false);
const relationDialogTitle = ref('人物关系图谱');
// 关系图谱展示的数据：默认全部筛选事件，或聚焦某事件时仅该事件
const relationGraphArticles = ref<TextArticle[]>([]);

const filter = reactive({
  category: '' as TimelineCategory | '',
  region: '' as TimelineRegion | '',
  era: '',
  reign: '',
  yearFrom: '',
  yearTo: '',
  keyword: '',
  sortOrder: 'asc' as 'asc' | 'desc',
});

function toggleSortOrder() {
  filter.sortOrder = filter.sortOrder === 'asc' ? 'desc' : 'asc';
}

// 仅保留时间线分类的条目
const timelineArticles = computed(() => {
  const cats = new Set<TimelineCategory>(['politics', 'literature', 'science', 'thought', 'society']);
  return props.articles.filter(a => a.category && cats.has(a.category as TimelineCategory));
});

// 可选朝代/时代列表（按区域级联：选中区域后只显示该区域的朝代）
const availableEras = computed(() => collectEras(timelineArticles.value as any, filter.region));

// 可选年号/时期列表（按朝代级联：选中朝代后只显示该朝代的年号）
const availableReigns = computed(() => collectReigns(timelineArticles.value as any, filter.era));

// 区域变化时清空朝代/年号；朝代变化时清空年号
watch(() => filter.region, () => {
  filter.era = '';
  filter.reign = '';
});
watch(() => filter.era, () => {
  filter.reign = '';
});

const filteredArticles = computed(() => {
  const kw = filter.keyword.trim().toLowerCase();
  const from = filter.yearFrom ? parseInt(filter.yearFrom, 10) : NaN;
  const to = filter.yearTo ? parseInt(filter.yearTo, 10) : NaN;
  const order = filter.sortOrder;

  return timelineArticles.value
    .filter(a => {
      if (filter.category && a.category !== filter.category) return false;
      if (filter.region && a.region !== filter.region) return false;
      if (filter.era && a.era !== filter.era) return false;
      // 年号/时期匹配：匹配 a.reign 或 a.era（如"维多利亚时期"→ era=维多利亚时代）
      if (filter.reign) {
        const reign = filter.reign.replace(/时期$/, '时代');
        if (a.reign !== filter.reign && a.era !== filter.reign && a.era !== reign) return false;
      }
      // 年份范围
      if (!isNaN(from) && a.year != null && a.year < from) return false;
      if (!isNaN(to) && a.year != null && a.year > to) return false;
      if (kw) {
        const hay = [a.title, a.content, a.era, a.reign, a.location, ...(a.figures?.map(f => f.name) || []), ...(a.tags || [])]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const ya = a.year ?? Infinity;
      const yb = b.year ?? Infinity;
      return order === 'asc' ? ya - yb : yb - ya;
    });
});

function formatYear(year?: number): string {
  if (year == null) return '年代未知';
  return year < 0 ? `公元前${Math.abs(year)}年` : `公元${year}年`;
}

function formatTimestamp(a: TextArticle): string {
  const parts = [formatYear(a.year)];
  if (a.reign) parts.push(a.reign);
  if (a.era) parts.push(a.era);
  return parts.join(' · ');
}

function getCategoryColor(category?: string): string {
  return getTimelineCategoryMeta(category as TimelineCategory)?.color || '#909399';
}

function getCategoryLabel(category?: string): string {
  return getTimelineCategoryMeta(category as TimelineCategory)?.label || '';
}

function getRegionLabel(region?: TimelineRegion): string {
  return getTimelineRegionMeta(region)?.label || '';
}

// 打开关系图谱（全部筛选事件）
function openRelationGraphAll() {
  relationDialogTitle.value = '人物关系图谱';
  relationGraphArticles.value = filteredArticles.value;
  showRelationGraph.value = true;
}

// 打开关系图谱（聚焦单个事件的人物）
function openFigureGraphFor(article: TextArticle) {
  relationDialogTitle.value = `人物关系 · ${article.title}`;
  relationGraphArticles.value = [article];
  showRelationGraph.value = true;
}

// 关系图谱中点击事件/节点跳转
function onRelationSelect(article: TextArticle) {
  showRelationGraph.value = false;
  emit('select', article);
}
function onRelationLocate(article: TextArticle) {
  showRelationGraph.value = false;
  emit('locate', article);
}
</script>

<style scoped lang="scss">
.timeline-view {
  padding: 4px 0;
}

.timeline-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
}

.timeline-count {
  font-size: 12px;
  color: var(--utools-text-secondary, #909399);
  margin-bottom: 12px;
}

.timeline-list {
  padding: 8px 4px;
  max-height: calc(100vh - 280px);
  overflow-y: auto;
}

.tl-card {
  cursor: pointer;
  padding: 12px 14px;
  border-radius: 8px;
  background: var(--utools-bg-secondary, #f5f7fa);
  border: 1px solid var(--utools-border-light, #ebeef5);
  transition: box-shadow 0.2s;

  &:hover {
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  }
}

.tl-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.tl-title {
  font-weight: bold;
  font-size: 15px;
  color: var(--utools-text-primary, #303133);
}

.tl-tags {
  display: flex;
  gap: 4px;
}

.tl-content {
  font-size: 13px;
  line-height: 1.7;
  color: var(--utools-text-primary, #606266);
  margin-bottom: 8px;
}

.tl-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 12px;
  color: var(--utools-text-secondary, #909399);
  margin-bottom: 6px;

  .tl-meta-item {
    display: inline-flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 2px;
  }
}

.tl-background {
  font-size: 12px;
  line-height: 1.6;
  color: var(--utools-text-secondary, #909399);
  background: var(--utools-bg-tertiary, #fafafa);
  padding: 6px 10px;
  border-radius: 4px;
  margin-top: 6px;

  .tl-bg-label {
    color: #e6a23c;
    font-weight: 500;
  }
}

.tl-actions {
  margin-top: 8px;
  display: flex;
  gap: 4px;
}

.timeline-axis-wrap {
  padding: 8px 4px;
}
</style>
