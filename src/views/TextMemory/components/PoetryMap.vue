<template>
  <div class="poetry-map-container">
    <!-- 地图控制栏 -->
    <div class="map-controls">
      <div class="control-group">
        <el-select
          v-model="selectedCategory"
          placeholder="类型"
          size="small"
          style="width: 110px"
        >
          <el-option label="全部" value="" />
          <el-option label="诗词" value="poetry" />
          <el-option label="成语" value="idiom" />
          <el-option label="时间线" value="timeline" />
        </el-select>

        <el-select
          v-model="selectedDynasty"
          placeholder="选择朝代显示疆域"
          clearable
          size="small"
          style="width: 160px; margin-left: 8px"
          @change="handleDynastyChange"
        >
          <el-option
            v-for="d in dynastyOptions"
            :key="d.code"
            :label="d.name"
            :value="d.code"
          />
        </el-select>

        <!-- 作者筛选：只过滤标记，画路线由「生平路线」按钮触发 -->
        <el-select
          v-model="selectedAuthor"
          placeholder="按作者筛选"
          clearable
          size="small"
          style="width: 140px; margin-left: 8px"
        >
          <el-option
            v-for="author in availableAuthors"
            :key="author"
            :label="author"
            :value="author"
          />
        </el-select>

        <el-button
          v-if="selectedAuthor"
          size="small"
          :type="showRoute ? 'primary' : 'default'"
          style="margin-left: 8px"
          @click="toggleRoute"
        >
          生平路线
        </el-button>

        <el-button size="small" style="margin-left: 8px" @click="showDefaultLayers">
          默认图层
        </el-button>

        <el-button size="small" @click="clearAllOverlays">
          清空图层
        </el-button>

        <!-- 可导入对钩：勾选显示题库黄点图层，类型筛选同样作用于该图层 -->
        <el-checkbox v-model="showLibrary" size="small" style="margin-left: 8px">可导入</el-checkbox>
        <el-tag v-if="showLibrary" size="small" type="warning" style="margin-left: 8px">
          {{ libraryLoading ? '库内容加载中…' : `可导入 ${filteredLibraryItems.length} 项` }}
        </el-tag>
      </div>

      <div class="control-group map-legend">
        <span class="legend-item">
          <span class="legend-pin"></span>诗词
        </span>
        <span class="legend-item">
          <span class="legend-circle"></span>成语
        </span>
        <span class="legend-item">
          <span class="legend-timeline"></span>时间线
        </span>
        <span v-if="showLibrary" class="legend-item">
          <span class="legend-library"></span>可导入
        </span>
        <el-tag v-if="poetryCount > 0" size="small" type="info" style="margin-left: 8px">
          诗词 {{ poetryCount }} 首
        </el-tag>
        <el-tag v-if="idiomCount > 0" size="small" type="warning" style="margin-left: 6px">
          成语 {{ idiomCount }} 条
        </el-tag>
        <el-tag v-if="timelineCount > 0" size="small" type="danger" style="margin-left: 6px">
          时间线 {{ timelineCount }} 事件
        </el-tag>
      </div>
    </div>

    <!-- 地图容器 -->
    <div ref="mapContainer" class="map-container"></div>

    <!-- 详情弹窗 -->
    <el-dialog
      v-model="detailVisible"
      :title="selectedPoetry?.title"
      width="500px"
      destroy-on-close
    >
      <div v-if="selectedPoetry" class="poetry-detail">
        <div class="poetry-meta">
          <el-tag v-if="isIdiomArticle(selectedPoetry)" size="small" type="warning">成语</el-tag>
          <template v-else-if="isTimelineArticle(selectedPoetry)">
            <el-tag size="small" type="danger">时间线</el-tag>
            <el-tag size="small" type="info" style="margin-left: 8px">{{ formatYear(selectedPoetry.year) }}</el-tag>
            <el-tag v-if="getTimelineCategoryMeta(selectedPoetry.category as any)" size="small" type="info" style="margin-left: 8px">
              {{ getTimelineCategoryMeta(selectedPoetry.category as any)?.label }}
            </el-tag>
          </template>
          <el-tag v-else size="small">{{ selectedPoetry.dynasty || '诗词' }}</el-tag>
          <el-tag v-if="selectedPoetry.author" size="small" type="info" style="margin-left: 8px">
            {{ selectedPoetry.author }}
          </el-tag>
          <el-tag v-if="selectedPoetry.location" size="small" type="success" style="margin-left: 8px">
            <el-icon><Location /></el-icon> {{ selectedPoetry.location }}
          </el-tag>
        </div>
        <div class="poetry-content">{{ selectedPoetry.content }}</div>
        <div v-if="selectedPoetry.source" class="poetry-source">
          来源：{{ selectedPoetry.source }}
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import type { TextArticle, GeoLocation } from '@/types/text-memory';
import { Location } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { DYNASTY_LIST, fetchAllPoetry } from '@/utils/poetry-service';
import type { PoetryItem } from '@/utils/poetry-service';
import { fetchAllIdioms } from '@/utils/idiom-service';
import type { IdiomItem } from '@/utils/idiom-service';
import { fetchAllTimelineEvents, TIMELINE_CATEGORIES, getTimelineCategoryMeta } from '@/utils/timeline-service';
import type { LibraryTimelineEvent } from '@/utils/timeline-service';
import { getTerritoryByDynasty, getDynastyCodeByName } from '@/utils/dynasty-territory';
import { useTextMemoryStore } from '@/stores/textMemory';
import { buildLibraryMapItems, type LibraryMapItem } from './library-map';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface Props {
  articles: TextArticle[];
  authors: string[];
  active?: boolean;
  focusArticleId?: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'select', article: TextArticle): void;
  (e: 'focused'): void;
}>();

// DOM 引用
const mapContainer = ref<HTMLDivElement>();

// Leaflet 实例
let map: L.Map | null = null;
let markerLayer: L.LayerGroup | null = null;
let territoryLayer: L.FeatureGroup | null = null;
let routeLayer: L.LayerGroup | null = null;
let libraryLayer: L.LayerGroup | null = null;
let markerMap: Map<string, L.Marker> = new Map();

// 状态
const selectedCategory = ref<'' | 'poetry' | 'idiom' | 'timeline'>('');
const selectedDynasty = ref('');
const selectedAuthor = ref('');
// 是否绘制所选作者的生平路线（由「生平路线」按钮切换）
const showRoute = ref(false);
// 可导入图层对钩：与类型筛选叠加显示题库黄点
const showLibrary = ref(false);
const detailVisible = ref(false);
const selectedPoetry = ref<TextArticle | null>(null);

// ==================== 可导入库内容图层 ====================
const textStore = useTextMemoryStore();
const libraryLoading = ref(false);
// 当前可导入条目（已按文章标题去重、只含有坐标的）
const libraryItems = ref<LibraryMapItem[]>([]);
// 题库原始数据（首次进入可导入模式时懒加载，之后复用）
let libraryRaw: { poems: PoetryItem[]; idioms: IdiomItem[]; events: LibraryTimelineEvent[] } | null = null;
// 正在导入中的条目 key（防重复点击）
const importingKeys = new Set<string>();

// 是否为成语
function isIdiomArticle(article: TextArticle): boolean {
  if (article.category === 'idiom') return true;
  // 兼容旧数据（成语库导入时会带 "成语" 标签）
  return Array.isArray(article.tags) && article.tags.includes('成语');
}

// 时间线事件的合法分类集合（与 TimelineView 的识别口径一致）
const TIMELINE_CATEGORY_SET = new Set<string>(TIMELINE_CATEGORIES.map(c => c.code));

// 是否为时间线事件（category 命中时间线分类）
function isTimelineArticle(article: TextArticle): boolean {
  return !!article.category && TIMELINE_CATEGORY_SET.has(article.category);
}

// 当前类型筛选下生效的文章列表
const categoryFiltered = computed(() => {
  if (selectedCategory.value === 'idiom') {
    return props.articles.filter(isIdiomArticle);
  }
  if (selectedCategory.value === 'timeline') {
    return props.articles.filter(isTimelineArticle);
  }
  if (selectedCategory.value === 'poetry') {
    // 诗词：排除成语与时间线事件
    return props.articles.filter(a => !isIdiomArticle(a) && !isTimelineArticle(a));
  }
  return props.articles;
});

// 类型 + 朝代筛选（不含作者：供作者下拉与渲染共用，避免选中后下拉坍缩；
// 朝代经 getDynastyCodeByName 归一化为 code 比较，无朝代字段的条目在朝代筛选下隐藏）
const dynastyFiltered = computed(() => {
  if (!selectedDynasty.value) return categoryFiltered.value;
  return categoryFiltered.value.filter(a => !!a.dynasty && getDynastyCodeByName(a.dynasty) === selectedDynasty.value);
});

// 再叠加作者筛选，得到实际渲染标记的文章列表
const displayedArticles = computed(() => {
  if (!selectedAuthor.value) return dynastyFiltered.value;
  return dynastyFiltered.value.filter(a => a.author === selectedAuthor.value);
});

// 计算属性
const poetryCount = computed(() => props.articles.filter(a => a.geo && !isIdiomArticle(a) && !isTimelineArticle(a)).length);const idiomCount = computed(() => props.articles.filter(a => a.geo && isIdiomArticle(a)).length);
const timelineCount = computed(() => props.articles.filter(a => a.geo && isTimelineArticle(a)).length);

// 可导入图层筛选：类型 + 朝代（不含作者，供作者下拉共用，同样避免坍缩）
const libraryBaseItems = computed(() => {
  let items = libraryItems.value;
  const cat = selectedCategory.value;
  if (cat) items = items.filter(i => i.kind === cat);
  if (selectedDynasty.value) {
    items = items.filter(i => !!i.article.dynasty && getDynastyCodeByName(i.article.dynasty) === selectedDynasty.value);
  }
  return items;
});

// 再叠加作者筛选，得到实际渲染的题库黄点（作者筛选下成语/时间线无作者字段自然隐藏，与已导入标记口径一致）
const filteredLibraryItems = computed(() => {
  if (!selectedAuthor.value) return libraryBaseItems.value;
  return libraryBaseItems.value.filter(i => i.article.author === selectedAuthor.value);
});

// 时间线事件年份展示（与 TimelineView 口径一致）
function formatYear(year?: number): string {
  if (year == null) return '年代未知';
  return year < 0 ? `公元前${Math.abs(year)}年` : `公元${year}年`;
}

const dynastyOptions = computed(() => {
  return DYNASTY_LIST.map(d => ({ code: d.code, name: d.name }));
});

// 从当前类型+朝代筛选下有地理坐标的诗词中提取作者（不含作者筛选本身，避免选中后下拉坍缩）；
// 勾选可导入后并入题库诗词作者，未导入的作者也能作为筛选条件
const availableAuthors = computed(() => {
  const set = new Set<string>();
  dynastyFiltered.value.forEach(a => {
    if (a.author && a.geo) {
      set.add(a.author);
    }
  });
  if (showLibrary.value) {
    for (const i of libraryBaseItems.value) {
      if (i.article.author) set.add(i.article.author);
    }
  }
  return Array.from(set).sort();
});

// ==================== 地图初始化 ====================

function initMap() {
  if (!mapContainer.value) return;

  // 修复 Leaflet 默认图标路径问题
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });

  map = L.map(mapContainer.value).setView([35.0, 105.0], 4);

  // 使用高德地图瓦片（国内可访问）
  L.tileLayer(
    'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
    {
      maxZoom: 18,
      minZoom: 3,
      attribution: '&copy; 高德地图',
      subdomains: '1234',
    }
  ).addTo(map);

  // 初始化图层组
  markerLayer = L.layerGroup().addTo(map);
  territoryLayer = L.featureGroup().addTo(map);
  routeLayer = L.layerGroup().addTo(map);
  libraryLayer = L.layerGroup().addTo(map);

  // 渲染标记
  renderMarkers();
}

// ==================== 标记渲染 ====================

function renderMarkers() {
  if (!markerLayer || !map) return;
  markerLayer.clearLayers();
  markerMap.clear();

  const articlesWithGeo = displayedArticles.value.filter(a => a.geo);
  if (articlesWithGeo.length === 0) return;

  // 按坐标聚合，同一地点的文章放在一起
  const clusterMap = new Map<string, TextArticle[]>();
  for (const article of articlesWithGeo) {
    if (!article.geo) continue;
    const key = `${article.geo.lng.toFixed(2)},${article.geo.lat.toFixed(2)}`;
    if (!clusterMap.has(key)) {
      clusterMap.set(key, []);
    }
    clusterMap.get(key)!.push(article);
  }

  for (const [_, group] of clusterMap) {
    const first = group[0];
    if (!first.geo) continue;

    // 成语用圆形章戳、时间线事件用菱形、诗词用按朝代上色的水滴图标
    const isIdiom = isIdiomArticle(first);
    const isTimeline = !isIdiom && isTimelineArticle(first);
    const color = isIdiom
      ? '#E6A23C'
      : (isTimeline ? (getTimelineCategoryMeta(first.category as any)?.color ?? '#9b59b6') : getDynastyColor(first.dynasty));
    const shapeClass = isIdiom ? 'marker-square' : (isTimeline ? 'marker-diamond' : 'marker-pin');
    // 菱形内数字反向旋转保持正显示
    const countHtml = group.length > 1
      ? (isTimeline ? `<span style="transform:rotate(-45deg)">${group.length}</span>` : `${group.length}`)
      : '';
    const customIcon = L.divIcon({
      className: isIdiom ? 'custom-marker idiom-marker' : (isTimeline ? 'custom-marker timeline-marker' : 'custom-marker'),
      html: `<div class="${shapeClass}" style="background:${color}">${countHtml}</div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 30],
    });

    const marker = L.marker([first.geo.lat, first.geo.lng], { icon: customIcon });

    // 为每个文章保存标记引用（用于定位）
    for (const article of group) {
      markerMap.set(article._id, marker);
    }

    // 弹出内容
    const popupContent = group.map((article, idx) => {
      const title = article.title.length > 12 ? article.title.substring(0, 12) + '...' : article.title;
      const isIdi = isIdiomArticle(article);
      const isTl = !isIdi && isTimelineArticle(article);
      const tlColor = isTl ? (getTimelineCategoryMeta(article.category as any)?.color ?? '#9b59b6') : '';
      const tagHtml = isIdi
        ? `<span style="background:#fdf6ec;color:#e6a23c;padding:1px 6px;border-radius:3px;font-size:11px;margin-right:4px">成语</span>`
        : isTl
          ? `<span style="background:#f4f0f7;color:${tlColor};padding:1px 6px;border-radius:3px;font-size:11px;margin-right:4px">时间线</span>`
          : (article.dynasty
              ? `<span style="background:#f0f0f0;color:#595959;padding:1px 6px;border-radius:3px;font-size:11px;margin-right:4px">${article.dynasty}</span>`
              : '');
      const subtitle = isIdi
        ? (article.location || '')
        : isTl
          ? formatYear(article.year)
          : (article.author || '佚名');
      return `<div class="popup-item" data-id="${article._id}" style="cursor:pointer;padding:4px 0;border-bottom:${idx < group.length - 1 ? '1px solid #eee' : 'none'}">
        ${tagHtml}<strong>${title}</strong>
        ${subtitle ? `<div style="color:#666;font-size:12px;margin-top:2px"> ${subtitle}</div>` : ''}
      </div>`;
    }).join('');

    const headerHtml = first.geo.name
      ? `<div style="font-size:12px;color:#909399;margin-bottom:6px;border-bottom:1px solid #f0f0f0;padding-bottom:4px">📍 ${first.geo.name}</div>`
      : '';

    marker.bindPopup(`<div class="poetry-popup">${headerHtml}${popupContent}</div>`);
    marker.on('popupopen', () => {
      // 绑定点击事件
      nextTick(() => {
        const items = document.querySelectorAll('.popup-item');
        items.forEach(item => {
          item.addEventListener('click', () => {
            const id = item.getAttribute('data-id');
            const article = group.find(a => a._id === id);
            if (article) {
              showPoetryDetail(article);
              map?.closePopup();
            }
          });
        });
      });
    });

    markerLayer.addLayer(marker);
  }

  // 调整视野
  if (articlesWithGeo.length > 0) {
    const bounds = L.latLngBounds(articlesWithGeo.map(a => [a.geo!.lat, a.geo!.lng]));
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 10 });
  }
}

function getDynastyColor(dynasty?: string): string {
  const colorMap: Record<string, string> = {
    '先秦': '#8B4513', 'xianqin': '#8B4513',
    '两汉': '#CD853F', 'han': '#CD853F',
    '魏晋': '#9370DB', '魏晋南北朝': '#9370DB', 'weijin': '#9370DB',
    '隋': '#6B8E23', 'sui': '#6B8E23',
    '唐': '#DC143C', 'tang': '#DC143C',
    '宋': '#4169E1', 'song': '#4169E1',
    '元': '#2E8B57', 'yuan': '#2E8B57',
    '明': '#FF8C00', 'ming': '#FF8C00',
    '清': '#800080', 'qing': '#800080',
    '近现代': '#C0C0C0', '现代': '#C0C0C0', 'xiandai': '#C0C0C0',
  };
  return colorMap[dynasty || ''] || '#8c8c8c';
}

// ==================== 可导入库内容图层 ====================

/** 按当前已导入文章标题重新计算可导入条目（去重） */
function refreshLibraryItems() {
  if (!libraryRaw) return;
  const importedTitles = new Set(props.articles.map(a => a.title.trim()));
  libraryItems.value = buildLibraryMapItems(
    libraryRaw.poems,
    libraryRaw.idioms,
    libraryRaw.events,
    importedTitles
  );
}

/** 懒加载内置题库（诗词 + 成语 + 时间线事件），只在首次进入可导入模式时执行 */
async function ensureLibraryLoaded() {
  if (libraryRaw || libraryLoading.value) return;
  // 地图未激活时不加载
  if (props.active === false) return;
  libraryLoading.value = true;
  try {
    const [poetryMap, idioms, events] = await Promise.all([
      fetchAllPoetry(),
      fetchAllIdioms(),
      fetchAllTimelineEvents(),
    ]);
    libraryRaw = {
      poems: Object.values(poetryMap).flat(),
      idioms,
      events,
    };
    refreshLibraryItems();
  } catch (error) {
    console.error('[PoetryMap] 加载可导入库内容失败:', error);
    ElMessage.error('库内容加载失败，请稍后重试');
  } finally {
    libraryLoading.value = false;
  }
}

/** 渲染可导入条目标记（黄色圆点，与已导入文章样式区分）；需勾选「可导入」对钩 */
function renderLibraryMarkers() {
  if (!libraryLayer || !map) return;
  libraryLayer.clearLayers();
  if (!showLibrary.value) return;

  const items = filteredLibraryItems.value;
  if (items.length === 0) return;

  // 按坐标聚合，同一地点的条目放在一起
  const clusterMap = new Map<string, LibraryMapItem[]>();
  for (const item of items) {
    const key = `${item.geo.lng.toFixed(2)},${item.geo.lat.toFixed(2)}`;
    if (!clusterMap.has(key)) {
      clusterMap.set(key, []);
    }
    clusterMap.get(key)!.push(item);
  }

  for (const [, group] of clusterMap) {
    const first = group[0];
    const libraryIcon = L.divIcon({
      className: 'library-marker',
      html: `<div class="library-dot">${group.length > 1 ? group.length : ''}</div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });

    const marker = L.marker([first.geo.lat, first.geo.lng], { icon: libraryIcon });

    const kindLabel: Record<LibraryMapItem['kind'], string> = {
      poetry: '诗词',
      idiom: '成语',
      timeline: '事件',
    };
    const popupContent = group.map((item, idx) => {
      const title = item.title.length > 14 ? item.title.substring(0, 14) + '...' : item.title;
      return `<div class="lib-popup-item" style="padding:6px 0;border-bottom:${idx < group.length - 1 ? '1px solid #eee' : 'none'};display:flex;align-items:center;gap:8px">
        <div style="flex:1;min-width:0">
          <span style="background:#fdf6ec;color:#b88230;padding:1px 6px;border-radius:3px;font-size:11px;margin-right:4px">${kindLabel[item.kind]}</span><strong>${title}</strong>
          ${item.subtitle ? `<div style="color:#666;font-size:12px;margin-top:2px">${item.subtitle}</div>` : ''}
          ${item.location ? `<div style="color:#999;font-size:11px;margin-top:1px">📍 ${item.location}</div>` : ''}
        </div>
        <button class="lib-import-btn" data-key="${item.key}">导入</button>
      </div>`;
    }).join('');

    const headerHtml = first.geo.name
      ? `<div style="font-size:12px;color:#909399;margin-bottom:6px;border-bottom:1px solid #f0f0f0;padding-bottom:4px">📍 ${first.geo.name}</div>`
      : '';

    marker.bindPopup(`<div class="poetry-popup library-popup">${headerHtml}${popupContent}</div>`, { maxWidth: 300 });
    marker.on('popupopen', () => {
      nextTick(() => {
        const buttons = document.querySelectorAll('.lib-import-btn');
        buttons.forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const key = btn.getAttribute('data-key');
            if (key) importLibraryItem(key);
          });
        });
      });
    });

    libraryLayer.addLayer(marker);
  }
}

/** 导入单条库内容：落库成功后从库图层移除（articles 变化会同步重渲已导入标记） */
async function importLibraryItem(key: string) {
  const item = libraryItems.value.find(i => i.key === key);
  if (!item || importingKeys.has(key)) return;
  importingKeys.add(key);
  try {
    const result = await textStore.addArticle(item.article);
    if (result.success) {
      ElMessage.success(`已导入「${item.title}」`);
      libraryItems.value = libraryItems.value.filter(i => i.key !== key);
      map?.closePopup();
      renderLibraryMarkers();
    } else {
      ElMessage.error(result.error || '导入失败');
    }
  } catch (error) {
    console.error('[PoetryMap] 导入库内容失败:', error);
    ElMessage.error('导入失败，请重试');
  } finally {
    importingKeys.delete(key);
  }
}

// ==================== 详情展示 ====================

function showPoetryDetail(article: TextArticle) {
  selectedPoetry.value = article;
  detailVisible.value = true;
  emit('select', article);
}

// ==================== 朝代疆域 ====================

/**
 * 计算多边形近似中心（取坐标平均值）
 */
function getPolygonCenter(coords: [number, number][]): [number, number] {
  let sumLat = 0, sumLng = 0;
  for (const [lng, lat] of coords) {
    sumLat += lat;
    sumLng += lng;
  }
  return [sumLat / coords.length, sumLng / coords.length];
}

/**
 * 在地图上添加疆域名称标签
 */
function addTerritoryLabel(
  lat: number,
  lng: number,
  name: string,
  color: string,
  isMain = false
) {
  if (!territoryLayer) return;
  const labelIcon = L.divIcon({
    className: 'territory-label',
    html: `<div class="label-text" style="color:${color};font-size:${isMain ? '14px' : '12px'};font-weight:${isMain ? 'bold' : 'normal'}">${name}</div>`,
    iconSize: [120, 20],
    iconAnchor: [60, 10],
  });
  const marker = L.marker([lat, lng], { icon: labelIcon, interactive: false });
  territoryLayer.addLayer(marker);
}

function handleDynastyChange() {
  // 朝代同时作为筛选条件作用于已导入标记与可导入黄点（renderLibraryMarkers 内部有 showLibrary 门控）；
  // 与类型筛选同口径：路线重置，已选作者不在新范围内则清空
  showRoute.value = false;
  routeLayer?.clearLayers();
  if (selectedAuthor.value && !availableAuthors.value.includes(selectedAuthor.value)) {
    selectedAuthor.value = '';
  }
  renderMarkers();
  renderLibraryMarkers();
  if (!territoryLayer || !map) return;
  territoryLayer.clearLayers();

  if (!selectedDynasty.value) return;

  const dynastyData = getTerritoryByDynasty(selectedDynasty.value);
  if (!dynastyData) return;

  // ---------- 绘制主疆域 ----------
  const main = dynastyData.main;
  const mainLatLngs = main.coords.map(([lng, lat]) => L.latLng(lat, lng));
  const mainPolygon = L.polygon(mainLatLngs, {
    color: main.color,
    fillColor: main.fillColor,
    fillOpacity: 0.3,
    weight: 2,
    dashArray: '5, 5',
  }).bindPopup(`<strong>${main.name}疆域（示意）</strong>`);
  territoryLayer.addLayer(mainPolygon);

  for (const center of main.centers) {
    const cityMarker = L.circleMarker([center.lat, center.lng], {
      radius: 5,
      fillColor: main.color,
      color: '#fff',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.9,
    }).bindTooltip(center.name, { permanent: false, direction: 'top' });
    territoryLayer.addLayer(cityMarker);
  }

  // 主疆域名称标签
  const mainCenter = main.centers[0]
    ? [main.centers[0].lat, main.centers[0].lng] as [number, number]
    : getPolygonCenter(main.coords);
  addTerritoryLabel(mainCenter[0], mainCenter[1], main.name, main.color, true);

  // ---------- 绘制同时期其他国家/政权 ----------
  for (const other of dynastyData.others) {
    const otherLatLngs = other.coords.map(([lng, lat]) => L.latLng(lat, lng));
    const otherPolygon = L.polygon(otherLatLngs, {
      color: other.color,
      fillColor: other.fillColor,
      fillOpacity: 0.25,
      weight: 2,
      dashArray: '8, 4',
    }).bindPopup(`<strong>${other.name}</strong><br><span style="font-size:12px;color:#666">${main.name}时期并存政权</span>`);
    territoryLayer.addLayer(otherPolygon);

    for (const center of other.centers) {
      const cityMarker = L.circleMarker([center.lat, center.lng], {
        radius: 4,
        fillColor: other.color,
        color: '#fff',
        weight: 1.5,
        opacity: 1,
        fillOpacity: 0.8,
      }).bindTooltip(center.name, { permanent: false, direction: 'top' });
      territoryLayer.addLayer(cityMarker);
    }

    // 名称标签
    const center = other.centers[0]
      ? [other.centers[0].lat, other.centers[0].lng] as [number, number]
      : getPolygonCenter(other.coords);
    addTerritoryLabel(center[0], center[1], other.name, other.color, false);
  }

  // ---------- 调整视野到所有疆域范围 ----------
  map.fitBounds(territoryLayer.getBounds(), { padding: [50, 50] });
}

function getDynastyName(code: string): string {
  const d = DYNASTY_LIST.find(item => item.code === code);
  return d?.name || code;
}

// ==================== 作者路线图 ====================

/** 切换生平路线显隐（按钮触发；切换作者/类型时会重置为隐藏） */
function toggleRoute() {
  showRoute.value = !showRoute.value;
  if (showRoute.value) {
    renderRoute();
  } else {
    routeLayer?.clearLayers();
  }
}

/** 绘制当前所选作者的生平路线：站点按年份排序连线。
 *  站点来源 = 已导入文章（displayedArticles）+ 勾选可导入时题库中该作者的条目（filteredLibraryItems），
 *  两者均已按朝代/作者过滤；题库按标题去重不含已导入，不会产生重复站点。
 *  未导入的题库站点点击只弹概要，不开详情。 */
function renderRoute() {
  if (!routeLayer || !map) return;
  routeLayer.clearLayers();

  if (!selectedAuthor.value) return;

  interface RouteStop {
    title: string;
    location?: string;
    year?: number;
    geo: GeoLocation;
    article?: TextArticle;
  }
  const stops: RouteStop[] = displayedArticles.value
    .filter(a => a.geo)
    .map(a => ({ title: a.title, location: a.location, year: a.year, geo: a.geo!, article: a }));
  if (showLibrary.value) {
    for (const i of filteredLibraryItems.value) {
      stops.push({ title: i.title, location: i.location, year: i.year, geo: i.geo });
    }
  }
  stops.sort((a, b) => (a.year || 0) - (b.year || 0));

  if (stops.length === 0) {
    return;
  }

  const coords: [number, number][] = stops.map(s => [s.geo.lat, s.geo.lng]);

  // 绘制路线（虚线流动动画，视觉上指示前进方向）
  if (coords.length >= 2) {
    const polyline = L.polyline(coords, {
      color: '#E6A23C',
      weight: 3,
      opacity: 0.85,
      dashArray: '10, 6',
      lineCap: 'round',
      className: 'route-line-anim',
    });
    routeLayer.addLayer(polyline);

    // 沿线段中点放置方向箭头（三角随线段方位旋转）
    for (let i = 0; i < coords.length - 1; i++) {
      const [lat1, lng1] = coords[i];
      const [lat2, lng2] = coords[i + 1];
      if (lat1 === lat2 && lng1 === lng2) continue;
      const midLat = (lat1 + lat2) / 2;
      const midLng = (lng1 + lng2) / 2;
      // 以正北为 0°、顺时针的方位角（经度差按纬度做 cos 修正）
      const angle = Math.atan2((lng2 - lng1) * Math.cos((midLat * Math.PI) / 180), lat2 - lat1) * (180 / Math.PI);
      const arrowIcon = L.divIcon({
        className: 'route-arrow',
        html: `<div class="route-arrow-tri" style="transform:rotate(${angle.toFixed(1)}deg)"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      routeLayer.addLayer(L.marker([midLat, midLng], { icon: arrowIcon, interactive: false }));
    }
  }

  // 绘制站点标记（起点绿色「始」、终点红色「终」，脉冲高亮；未导入的题库站点标注「未导入」且不开详情）
  stops.forEach((stop, index) => {
    const isStart = index === 0;
    const isEnd = index === stops.length - 1 && !isStart;
    const label = isStart ? '始' : isEnd ? '终' : String(index + 1);
    const extraCls = isStart ? ' is-start' : isEnd ? ' is-end' : '';
    const routeIcon = L.divIcon({
      className: 'route-marker',
      html: `<div class="route-pin${extraCls}">${label}</div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    const marker = L.marker([stop.geo.lat, stop.geo.lng], { icon: routeIcon });

    const popupHtml = `
      <div style="min-width:180px">
        <div style="font-weight:bold;margin-bottom:4px">${stop.title}${stop.article ? '' : ' <span style="font-size:12px;color:#E6A23C">（未导入）</span>'}</div>
        <div style="font-size:12px;color:#666">${stop.location || stop.geo.name}</div>
        ${stop.year ? `<div style="font-size:12px;color:#999">约 ${stop.year} 年</div>` : ''}
      </div>
    `;

    marker.bindPopup(popupHtml);
    if (stop.article) {
      marker.on('click', () => {
        showPoetryDetail(stop.article!);
      });
    }

    routeLayer!.addLayer(marker);
  });

  // 调整视野
  const bounds = L.latLngBounds(coords);
  map.fitBounds(bounds, { padding: [50, 50], maxZoom: 8 });
}

// ==================== 图层重置 / 清空 ====================

/** 默认图层：恢复默认展示（已导入标记），清除疆域/路线/可导入图层与全部筛选 */
function showDefaultLayers() {
  selectedCategory.value = '';
  selectedDynasty.value = '';
  selectedAuthor.value = '';
  showRoute.value = false;
  showLibrary.value = false;
  territoryLayer?.clearLayers();
  routeLayer?.clearLayers();
  libraryLayer?.clearLayers();
  // 重新显示所有标记并调整视野
  renderMarkers();
}

/** 清空图层：只保留底图，连已导入标记也一并清掉（点「默认图层」可恢复） */
function clearAllOverlays() {
  selectedCategory.value = '';
  selectedDynasty.value = '';
  selectedAuthor.value = '';
  showRoute.value = false;
  showLibrary.value = false;
  markerLayer?.clearLayers();
  markerMap.clear();
  territoryLayer?.clearLayers();
  routeLayer?.clearLayers();
  libraryLayer?.clearLayers();
}

// ==================== 监听数据变化 ====================

watch(() => props.articles, () => {
  renderMarkers();
  // 已导入列表变化时，同步从可导入图层中去掉同标题条目
  if (libraryRaw && showLibrary.value) {
    refreshLibraryItems();
    renderLibraryMarkers();
  }
}, { deep: true });

// 切换类型筛选：
// - 勾选「可导入」时按类型重渲黄点图层（筛选同样作用于可导入）
// - 已选作者不在新范围内则清空；路线显示重置，避免误读
watch(selectedCategory, async () => {
  showRoute.value = false;
  routeLayer?.clearLayers();
  if (selectedAuthor.value && !availableAuthors.value.includes(selectedAuthor.value)) {
    selectedAuthor.value = '';
  }
  renderMarkers();
  if (showLibrary.value) {
    await ensureLibraryLoaded();
    refreshLibraryItems();
    renderLibraryMarkers();
  }
});

// 勾选/取消「可导入」对钩：勾选时懒加载题库并渲染黄点，视野联动到全部可导入条目
watch(showLibrary, async (on) => {
  if (!on) {
    libraryLayer?.clearLayers();
    // 取消可导入后，仅存在于题库的作者选择失效，一并清掉（与类型/朝代筛选同口径）
    if (selectedAuthor.value && !availableAuthors.value.includes(selectedAuthor.value)) {
      selectedAuthor.value = '';
    }
    // 路线中的题库站点同步移除（作者被清空时其 watch 已重置路线，此处跳过）
    if (showRoute.value) renderRoute();
    return;
  }
  await ensureLibraryLoaded();
  // 加载期间用户可能已取消勾选，直接退出，避免误渲染/误缩放视野
  if (!showLibrary.value) return;
  refreshLibraryItems();
  renderLibraryMarkers();
  if (filteredLibraryItems.value.length > 0 && map) {
    const bounds = L.latLngBounds(filteredLibraryItems.value.map(i => [i.geo.lat, i.geo.lng]));
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 8 });
  }
});

// 切换作者：作者即筛选，重渲已导入标记与可导入黄点（内部有 showLibrary 门控）；路线显示重置，避免误读
watch(selectedAuthor, () => {
  showRoute.value = false;
  routeLayer?.clearLayers();
  renderMarkers();
  renderLibraryMarkers();
});

// 监听激活状态，处理容器尺寸变化
watch(() => props.active, (isActive) => {
  if (isActive && map) {
    nextTick(() => {
      map?.invalidateSize();
      renderMarkers();
      renderLibraryMarkers();
    });
    // 重新激活时若已勾选可导入但题库尚未加载（上次处于未激活状态），补加载
    if (showLibrary.value && !libraryRaw) {
      ensureLibraryLoaded().then(() => renderLibraryMarkers());
    }
  }
});

// 监听聚焦文章ID
watch(() => props.focusArticleId, (id) => {
  if (!id || !map) return;
  nextTick(() => {
    const marker = markerMap.get(id);
    const article = props.articles.find(a => a._id === id);
    if (marker && article?.geo) {
      map!.flyTo([article.geo.lat, article.geo.lng], 10, { duration: 1.5 });
      marker.openPopup();
      emit('focused');
    }
  });
});

// ==================== 生命周期 ====================

onMounted(() => {
  nextTick(() => {
    initMap();
  });
});

onUnmounted(() => {
  map?.remove();
  map = null;
});
</script>

<style scoped lang="scss">
.poetry-map-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
}

.map-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background: var(--utools-bg-secondary);
  border-bottom: 1px solid var(--utools-border-color);
  flex-wrap: wrap;
  gap: 8px;
}

.control-group {
  display: flex;
  align-items: center;
}

.map-legend {
  gap: 8px;

  .legend-item {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: var(--utools-text-secondary);
  }

  .legend-pin {
    display: inline-block;
    width: 10px;
    height: 10px;
    background: #595959;
    border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
  }

  .legend-circle {
    display: inline-block;
    width: 10px;
    height: 10px;
    background: #e6a23c;
    border-radius: 50%;
    border: 1px solid #fef3e0;
    box-shadow: 0 0 0 1px #e6a23c;
  }

  .legend-library {
    display: inline-block;
    width: 10px;
    height: 10px;
    background: #f7ba2a;
    border-radius: 50%;
    border: 1px solid #fff;
    box-shadow: 0 0 0 1px rgba(247, 186, 42, 0.6);
  }

  .legend-timeline {
    display: inline-block;
    width: 10px;
    height: 10px;
    background: #9b59b6;
    transform: rotate(45deg);
    border-radius: 2px;
  }
}

.map-container {
  flex: 1;
  min-height: 400px;
  background: #f0f0f0;
}

.poetry-detail {
  .poetry-meta {
    margin-bottom: 12px;
  }
  .poetry-content {
    white-space: pre-line;
    line-height: 1.8;
    font-size: 15px;
    color: var(--utools-text-primary);
    padding: 12px;
    background: var(--utools-bg-tertiary);
    border-radius: 6px;
  }
  .poetry-source {
    margin-top: 12px;
    font-size: 13px;
    color: var(--utools-text-secondary);
    text-align: right;
  }
}
</style>

<style lang="scss">
/* Leaflet 自定义标记样式 */
.custom-marker {
  .marker-pin {
    width: 30px;
    height: 30px;
    border-radius: 50% 50% 50% 0;
    background: #595959;
    position: absolute;
    transform: rotate(-45deg);
    left: 50%;
    top: 50%;
    margin: -15px 0 0 -15px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 12px;
    font-weight: bold;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
  }

  /* 成语用圆形章戳样式与诗词水滴形区分 */
  .marker-square {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: #e6a23c;
    position: absolute;
    left: 50%;
    top: 50%;
    margin: -14px 0 0 -14px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 12px;
    font-weight: bold;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
    border: 2px solid #fef3e0;
    outline: 2px solid #e6a23c;
    outline-offset: -1px;
  }

  /* 时间线事件用菱形标记，颜色按事件分类（政治/文学/科学/思想/社会） */
  .marker-diamond {
    width: 24px;
    height: 24px;
    border-radius: 4px;
    background: #9b59b6;
    position: absolute;
    left: 50%;
    top: 50%;
    margin: -12px 0 0 -12px;
    transform: rotate(45deg);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 11px;
    font-weight: bold;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
    border: 2px solid #f4f0f7;
  }
}

.route-marker {
  .route-pin {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: #e6a23c;
    color: #fff;
    font-size: 12px;
    font-weight: bold;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
    border: 2px solid #fff;
  }

  /* 起点绿色「始」、终点红色「终」，脉冲高亮 */
  .route-pin.is-start {
    background: #67c23a;
    animation: route-pulse-g 1.6s ease-out infinite;
  }

  .route-pin.is-end {
    background: #f56c6c;
    animation: route-pulse-r 1.6s ease-out infinite;
  }
}

/* 生平路线：虚线流动动画（stroke-dashoffset 前移，与 dashArray '10,6' 周期 16 匹配） */
.route-line-anim {
  animation: route-dash-move 0.9s linear infinite;
}

@keyframes route-dash-move {
  to {
    stroke-dashoffset: -16;
  }
}

/* 路线方向箭头：线段中点放置、随方位角旋转的三角（flex 居中使旋转中心与锚点重合） */
.route-arrow {
  display: flex;
  align-items: center;
  justify-content: center;

  .route-arrow-tri {
    width: 0;
    height: 0;
    border-left: 5px solid transparent;
    border-right: 5px solid transparent;
    border-bottom: 9px solid #e6a23c;
    filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.35));
  }
}

@keyframes route-pulse-g {
  0% {
    box-shadow: 0 0 0 0 rgba(103, 194, 58, 0.55), 0 2px 5px rgba(0, 0, 0, 0.3);
  }
  70% {
    box-shadow: 0 0 0 12px rgba(103, 194, 58, 0), 0 2px 5px rgba(0, 0, 0, 0.3);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(103, 194, 58, 0), 0 2px 5px rgba(0, 0, 0, 0.3);
  }
}

@keyframes route-pulse-r {
  0% {
    box-shadow: 0 0 0 0 rgba(245, 108, 108, 0.55), 0 2px 5px rgba(0, 0, 0, 0.3);
  }
  70% {
    box-shadow: 0 0 0 12px rgba(245, 108, 108, 0), 0 2px 5px rgba(0, 0, 0, 0.3);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(245, 108, 108, 0), 0 2px 5px rgba(0, 0, 0, 0.3);
  }
}

/* 可导入库内容标记：黄色小圆点，与已导入文章（水滴/圆形章戳）区分 */
.library-marker {
  .library-dot {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #f7ba2a;
    border: 2px solid #fff;
    box-shadow: 0 0 0 2px rgba(247, 186, 42, 0.5), 0 1px 4px rgba(0, 0, 0, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #7a4f01;
    font-size: 10px;
    font-weight: bold;
  }
}

/* 库内容弹出框的导入按钮 */
.lib-import-btn {
  flex-shrink: 0;
  padding: 3px 10px;
  font-size: 12px;
  color: #fff;
  background: #f7ba2a;
  border: none;
  border-radius: 4px;
  cursor: pointer;

  &:hover {
    background: #eba618;
  }
}

.poetry-popup {
  max-height: 200px;
  overflow-y: auto;
  min-width: 160px;
}

/* Leaflet 弹出框样式微调 */
.leaflet-popup-content-wrapper {
  border-radius: 8px;
}

.leaflet-popup-content {
  margin: 8px 12px;
}

/* 疆域名称标签 */
.territory-label {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  pointer-events: none;
}

.territory-label .label-text {
  text-shadow:
    -1px -1px 0 #fff,
    1px -1px 0 #fff,
    -1px 1px 0 #fff,
    1px 1px 0 #fff,
    0 1px 3px rgba(0,0,0,0.4);
  white-space: nowrap;
  text-align: center;
  letter-spacing: 1px;
}
</style>
