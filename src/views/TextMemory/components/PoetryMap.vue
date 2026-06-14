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

        <el-select
          v-model="selectedAuthor"
          placeholder="选择作者显示路线"
          clearable
          size="small"
          style="width: 160px; margin-left: 8px"
          @change="handleAuthorChange"
        >
          <el-option
            v-for="author in availableAuthors"
            :key="author"
            :label="author"
            :value="author"
          />
        </el-select>

        <el-button
          size="small"
          style="margin-left: 8px"
          @click="clearAllOverlays"
        >
          清除图层
        </el-button>
      </div>

      <div class="control-group map-legend">
        <span class="legend-item">
          <span class="legend-pin"></span>诗词
        </span>
        <span class="legend-item">
          <span class="legend-circle"></span>成语
        </span>
        <el-tag v-if="poetryCount > 0" size="small" type="info" style="margin-left: 8px">
          诗词 {{ poetryCount }} 首
        </el-tag>
        <el-tag v-if="idiomCount > 0" size="small" type="warning" style="margin-left: 6px">
          成语 {{ idiomCount }} 条
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
import type { TextArticle } from '@/types/text-memory';
import { Location } from '@element-plus/icons-vue';
import { DYNASTY_LIST } from '@/utils/poetry-service';
import { getTerritoryByDynasty, getDynastyCodeByName } from '@/utils/dynasty-territory';
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
let markerMap: Map<string, L.Marker> = new Map();

// 状态
const selectedCategory = ref<'' | 'poetry' | 'idiom'>('');
const selectedDynasty = ref('');
const selectedAuthor = ref('');
const detailVisible = ref(false);
const selectedPoetry = ref<TextArticle | null>(null);

// 是否为成语
function isIdiomArticle(article: TextArticle): boolean {
  if (article.category === 'idiom') return true;
  // 兼容旧数据（成语库导入时会带 "成语" 标签）
  return Array.isArray(article.tags) && article.tags.includes('成语');
}

// 当前类型筛选下生效的文章列表（用于渲染标记）
const filteredArticles = computed(() => {
  if (!selectedCategory.value) return props.articles;
  if (selectedCategory.value === 'idiom') {
    return props.articles.filter(isIdiomArticle);
  }
  return props.articles.filter(a => !isIdiomArticle(a));
});

// 计算属性
const poetryCount = computed(() => props.articles.filter(a => a.geo && !isIdiomArticle(a)).length);
const idiomCount = computed(() => props.articles.filter(a => a.geo && isIdiomArticle(a)).length);

const dynastyOptions = computed(() => {
  return DYNASTY_LIST.map(d => ({ code: d.code, name: d.name }));
});

// 从当前有地理坐标的诗词中提取作者（过滤后实时更新；成语一般无作者，自动跳过）
const availableAuthors = computed(() => {
  const set = new Set<string>();
  filteredArticles.value.forEach(a => {
    if (a.author && a.geo) {
      set.add(a.author);
    }
  });
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

  // 渲染标记
  renderMarkers();
}

// ==================== 标记渲染 ====================

function renderMarkers() {
  if (!markerLayer || !map) return;
  markerLayer.clearLayers();
  markerMap.clear();

  const articlesWithGeo = filteredArticles.value.filter(a => a.geo);
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

    // 成语用专属菱形图标，诗词用按朝代上色的水滴图标
    const isIdiom = isIdiomArticle(first);
    const color = isIdiom ? '#E6A23C' : getDynastyColor(first.dynasty);
    const customIcon = L.divIcon({
      className: isIdiom ? 'custom-marker idiom-marker' : 'custom-marker',
      html: `<div class="${isIdiom ? 'marker-square' : 'marker-pin'}" style="background:${color}">${group.length > 1 ? group.length : ''}</div>`,
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
      const tagHtml = isIdi
        ? `<span style="background:#fdf6ec;color:#e6a23c;padding:1px 6px;border-radius:3px;font-size:11px;margin-right:4px">成语</span>`
        : (article.dynasty
            ? `<span style="background:#ecf5ff;color:#409eff;padding:1px 6px;border-radius:3px;font-size:11px;margin-right:4px">${article.dynasty}</span>`
            : '');
      const subtitle = isIdi
        ? (article.location || '')
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
  return colorMap[dynasty || ''] || '#409EFF';
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

function handleAuthorChange() {
  if (!routeLayer || !map) return;
  routeLayer.clearLayers();

  if (!selectedAuthor.value) return;

  const authorArticles = filteredArticles.value
    .filter(a => a.author === selectedAuthor.value && a.geo)
    .sort((a, b) => (a.year || 0) - (b.year || 0));

  if (authorArticles.length === 0) {
    return;
  }

  const coords: [number, number][] = authorArticles.map(a => [a.geo!.lat, a.geo!.lng]);

  // 绘制路线
  if (coords.length >= 2) {
    const polyline = L.polyline(coords, {
      color: '#E6A23C',
      weight: 3,
      opacity: 0.8,
      dashArray: '10, 5',
      lineCap: 'round',
    });
    routeLayer.addLayer(polyline);
  }

  // 绘制站点标记
  authorArticles.forEach((article, index) => {
    if (!article.geo) return;

    const label = String(index + 1);
    const routeIcon = L.divIcon({
      className: 'route-marker',
      html: `<div class="route-pin">${label}</div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    const marker = L.marker([article.geo.lat, article.geo.lng], { icon: routeIcon });

    const popupHtml = `
      <div style="min-width:180px">
        <div style="font-weight:bold;margin-bottom:4px">${article.title}</div>
        <div style="font-size:12px;color:#666">${article.location || article.geo.name}</div>
        ${article.year ? `<div style="font-size:12px;color:#999">约 ${article.year} 年</div>` : ''}
      </div>
    `;

    marker.bindPopup(popupHtml);
    marker.on('click', () => {
      showPoetryDetail(article);
    });

    routeLayer!.addLayer(marker);
  });

  // 调整视野
  const bounds = L.latLngBounds(coords);
  map.fitBounds(bounds, { padding: [50, 50], maxZoom: 8 });
}

// ==================== 清除图层 ====================

function clearAllOverlays() {
  selectedCategory.value = '';
  selectedDynasty.value = '';
  selectedAuthor.value = '';
  territoryLayer?.clearLayers();
  routeLayer?.clearLayers();
  // 重新显示所有标记并调整视野
  renderMarkers();
}

// ==================== 监听数据变化 ====================

watch(() => props.articles, () => {
  renderMarkers();
}, { deep: true });

// 切换类型筛选时，若已选作者已不在范围内则清空，并重渲路线
watch(selectedCategory, () => {
  if (selectedAuthor.value && !availableAuthors.value.includes(selectedAuthor.value)) {
    selectedAuthor.value = '';
    routeLayer?.clearLayers();
  } else if (selectedAuthor.value) {
    handleAuthorChange();
  }
  renderMarkers();
});

// 监听激活状态，处理容器尺寸变化
watch(() => props.active, (isActive) => {
  if (isActive && map) {
    nextTick(() => {
      map?.invalidateSize();
      renderMarkers();
    });
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
    background: #409eff;
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
    background: #409eff;
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
