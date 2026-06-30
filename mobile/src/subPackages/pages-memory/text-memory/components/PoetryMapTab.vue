<template>
  <view class="map-tab">
    <!-- 筛选工具栏 -->
    <view class="map-toolbar">
      <picker
        mode="selector"
        :range="categoryLabels"
        :value="categoryIndex"
        @change="onCategoryChange"
      >
        <view class="picker-chip">
          <text class="picker-label">类型</text>
          <text class="picker-value">{{ categoryLabels[categoryIndex] }}</text>
        </view>
      </picker>

      <picker
        mode="selector"
        :range="dynastyLabels"
        :value="dynastyIndex"
        :disabled="categoryValue === 'idiom'"
        @change="onDynastyChange"
      >
        <view class="picker-chip" :class="{ disabled: categoryValue === 'idiom' }">
          <text class="picker-label">朝代</text>
          <text class="picker-value">{{ dynastyLabels[dynastyIndex] }}</text>
        </view>
      </picker>

      <picker
        mode="selector"
        :range="authorLabels"
        :value="authorIndex"
        :disabled="categoryValue === 'idiom' || availableAuthors.length === 0"
        @change="onAuthorChange"
      >
        <view
          class="picker-chip"
          :class="{ disabled: categoryValue === 'idiom' || availableAuthors.length === 0 }"
        >
          <text class="picker-label">作者</text>
          <text class="picker-value">{{ authorLabels[authorIndex] }}</text>
        </view>
      </picker>

      <view class="stat-info">
        <text class="stat-text">{{ statText }}</text>
      </view>
    </view>

    <!-- 路线开关（仅选了作者时显示） -->
    <view v-if="selectedAuthor" class="route-bar" @click="toggleRoute">
      <view class="route-checkbox" :class="{ checked: showRoute }">
        <text v-if="showRoute" class="check-mark">✓</text>
      </view>
      <text class="route-label">显示「{{ selectedAuthor }}」的生平路线</text>
      <text class="route-hint" v-if="showRoute && routePoints.length > 1">
        共 {{ routePoints.length }} 站
      </text>
    </view>

    <!-- 加载提示 -->
    <view v-if="loading" class="loading-mask">
      <text>加载诗词库中...</text>
    </view>

    <!-- 空状态：筛选后无任何作品 -->
    <view v-else-if="locationGroups.length === 0" class="empty-state">
      <text class="empty-icon">🗺️</text>
      <text class="empty-title">当前筛选下没有带位置的作品</text>
      <text class="empty-hint">{{ emptyHint }}</text>
    </view>

    <!-- 地图 -->
    <map
      v-else
      id="poetryMap"
      class="map-area"
      :latitude="centerLat"
      :longitude="centerLng"
      :scale="mapScale"
      :markers="markers"
      :polyline="polylines"
      :include-points="includePoints"
      show-compass
      enable-3D
      enable-overlooking
      @markertap="onMarkerTap"
      @regionchange="onRegionChange"
    />

    <!-- 图例 -->
    <view class="legend">
      <view class="legend-item">
        <view class="legend-dot poetry" />
        <text>诗词</text>
      </view>
      <view class="legend-item">
        <view class="legend-dot idiom" />
        <text>成语</text>
      </view>
      <view class="legend-item">
        <view class="legend-dot cluster" />
        <text>聚合点</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, shallowRef, computed, watch, onMounted } from 'vue'
import {
  loadAllPoetry,
  loadAllIdioms,
  DYNASTIES,
  type MobilePoetryItem,
  type MobileIdiomItem,
} from '../library'
import { parseLocation, type LocationCoord } from '@/utils/poetry-location'
import type { MarkerTapPayload } from './map-types'

// ===== Props / Emits =====
interface Props {
  /** 已选中的诗词 ID 列表（与父组件双向绑定） */
  selectedPoetryIds: Set<string>
  /** 已选中的成语 ID 列表（与父组件双向绑定） */
  selectedIdiomIds: Set<string>
}

const props = defineProps<Props>()
const emit = defineEmits<{
  /** 点击标记时触发，父组件可弹出详情 sheet */
  (e: 'tapMarker', payload: MarkerTapPayload): void
}>()

// ===== 数据加载 =====

const loading = ref(true)
// 大数组用 shallowRef：诗词/成语条目本身不会被修改，避免深度响应式开销
const allPoetry = shallowRef<MobilePoetryItem[]>([])
const allIdioms = shallowRef<MobileIdiomItem[]>([])

async function load() {
  loading.value = true
  try {
    const [poetry, idioms] = await Promise.all([loadAllPoetry(), loadAllIdioms()])
    allPoetry.value = poetry
    allIdioms.value = idioms
  } catch (e) {
    uni.showToast({ title: '加载诗词库失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

onMounted(load)

// ===== 筛选状态 =====

const categoryOptions: { value: 'all' | 'poetry' | 'idiom'; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'poetry', label: '诗词' },
  { value: 'idiom', label: '成语' },
]
const categoryLabels = categoryOptions.map((o) => o.label)
const categoryIndex = ref(0)
const categoryValue = computed(() => categoryOptions[categoryIndex.value].value)

const dynastyLabels = ['全部', ...DYNASTIES.map((d) => d.name)]
const dynastyIndex = ref(0)
const dynastyCode = computed(() =>
  dynastyIndex.value > 0 ? DYNASTIES[dynastyIndex.value - 1].code : '',
)

// ===== 作者筛选 =====

/** 当前类型 + 朝代下，有 location 的诗词作者列表（去重 + 排序） */
const availableAuthors = computed<string[]>(() => {
  if (categoryValue.value === 'idiom') return []
  const set = new Set<string>()
  for (const p of allPoetry.value) {
    if (!p.location || !p.author || p.author === '佚名') continue
    if (dynastyCode.value && p.dynastyCode !== dynastyCode.value) continue
    set.add(p.author)
  }
  return Array.from(set).sort()
})

const authorIndex = ref(0)
const authorLabels = computed(() => ['全部', ...availableAuthors.value])
const selectedAuthor = computed(() =>
  authorIndex.value > 0 ? availableAuthors.value[authorIndex.value - 1] : '',
)

const showRoute = ref(false)

function onAuthorChange(e: any) {
  authorIndex.value = Number(e.detail.value)
  // 切换作者时重置路线显示，避免误读
  showRoute.value = false
}

function toggleRoute() {
  showRoute.value = !showRoute.value
}

// 当 author 列表变化时（如切换朝代/类型），若当前选中的 author 不在新列表中则重置
watch(availableAuthors, (list) => {
  if (authorIndex.value === 0) return
  const cur = list[authorIndex.value - 1]
  if (!cur) {
    authorIndex.value = 0
    showRoute.value = false
  }
})

function onCategoryChange(e: any) {
  categoryIndex.value = Number(e.detail.value)
  // 切到成语时，朝代和作者筛选无效，重置
  if (categoryValue.value === 'idiom') {
    dynastyIndex.value = 0
    authorIndex.value = 0
    showRoute.value = false
  }
}

function onDynastyChange(e: any) {
  dynastyIndex.value = Number(e.detail.value)
  // 朝代变化时作者列表会变，由 watch(availableAuthors) 兜底
}

// ===== 标记计算 =====

interface LocationGroup {
  coord: LocationCoord
  poems: MobilePoetryItem[]
  idioms: MobileIdiomItem[]
}

/** 当前筛选下要显示的所有条目，按坐标聚合 */
const locationGroups = computed<LocationGroup[]>(() => {
  if (loading.value) return []

  // 1. 筛选诗词
  let poems: MobilePoetryItem[] = []
  if (categoryValue.value !== 'idiom') {
    poems = allPoetry.value.filter((p) => !!p.location)
    if (dynastyCode.value) {
      poems = poems.filter((p) => p.dynastyCode === dynastyCode.value)
    }
    if (selectedAuthor.value) {
      poems = poems.filter((p) => p.author === selectedAuthor.value)
    }
  }

  // 2. 筛选成语（成语不受朝代/作者影响）
  let idioms: MobileIdiomItem[] = []
  if (categoryValue.value !== 'poetry' && !selectedAuthor.value) {
    idioms = allIdioms.value.filter((it) => !!it.location)
  }

  // 3. 按坐标分组
  const groupMap = new Map<string, LocationGroup>()
  const addToGroup = (coord: LocationCoord, poem?: MobilePoetryItem, idiom?: MobileIdiomItem) => {
    const key = `${coord.lng.toFixed(4)},${coord.lat.toFixed(4)}`
    let g = groupMap.get(key)
    if (!g) {
      g = { coord, poems: [], idioms: [] }
      groupMap.set(key, g)
    }
    if (poem) g.poems.push(poem)
    if (idiom) g.idioms.push(idiom)
  }

  for (const p of poems) {
    const c = parseLocation(p.location)
    if (c) addToGroup(c, p, undefined)
  }
  for (const it of idioms) {
    const c = parseLocation(it.location)
    if (c) addToGroup(c, undefined, it)
  }

  return Array.from(groupMap.values())
})

// ===== 标记图标路径 =====
// 注意：小程序原生 map 的 iconPath 必须是绝对/相对路径，不能是 base64
// 放在主包 static 目录，编译后路径为 /static/map-icons/*.png

const ICON_BASE = '/static/map-icons'
const ICONS = {
  poetry: `${ICON_BASE}/poetry.png`,
  poetryActive: `${ICON_BASE}/poetry-active.png`,
  poetryCluster: `${ICON_BASE}/poetry-cluster.png`,
  idiom: `${ICON_BASE}/idiom.png`,
  idiomActive: `${ICON_BASE}/idiom-active.png`,
  idiomCluster: `${ICON_BASE}/idiom-cluster.png`,
}

/** 计算分组的图标 */
function pickIcon(g: LocationGroup): string {
  const total = g.poems.length + g.idioms.length
  const isCluster = total > 1
  // 哪类占主导？
  const dominantPoetry = g.poems.length >= g.idioms.length

  // 选中状态：组内所有条目都被选中
  const allPoemSelected = g.poems.length > 0 && g.poems.every((p) => props.selectedPoetryIds.has(p.id))
  const allIdiomSelected = g.idioms.length > 0 && g.idioms.every((it) => props.selectedIdiomIds.has(it.id))
  const fullySelected =
    (g.poems.length === 0 || allPoemSelected) &&
    (g.idioms.length === 0 || allIdiomSelected) &&
    total > 0

  if (isCluster) {
    return dominantPoetry ? ICONS.poetryCluster : ICONS.idiomCluster
  }
  if (fullySelected) {
    return dominantPoetry ? ICONS.poetryActive : ICONS.idiomActive
  }
  return dominantPoetry ? ICONS.poetry : ICONS.idiom
}

// ===== 生成 markers =====

interface UniMarker {
  id: number
  latitude: number
  longitude: number
  iconPath: string
  width: number
  height: number
  anchor?: { x: number; y: number }
  callout?: {
    content: string
    color: string
    fontSize: number
    bgColor: string
    padding: number
    borderRadius: number
    display: 'BYCLICK' | 'ALWAYS'
    textAlign: 'left' | 'center'
  }
}

/** marker.id 是 number 类型，需建立索引以便回查 */
const markerIndexMap = ref<Map<number, LocationGroup>>(new Map())

const markers = computed<UniMarker[]>(() => {
  const groups = locationGroups.value
  const useCull =
    groups.length > VIEWPORT_CULL_THRESHOLD && viewportBounds.value !== null
  const visibleGroups = useCull
    ? groups.filter((g) => isInBounds(g.coord.lat, g.coord.lng, viewportBounds.value))
    : groups

  const list: UniMarker[] = []
  const indexMap = new Map<number, LocationGroup>()
  visibleGroups.forEach((g, idx) => {
    const total = g.poems.length + g.idioms.length
    const isCluster = total > 1
    const size = isCluster ? 36 : 26
    const title = isCluster
      ? `${g.coord.name} · ${total}首`
      : g.poems[0]?.title || g.idioms[0]?.title || g.coord.name

    list.push({
      id: idx,
      latitude: g.coord.lat,
      longitude: g.coord.lng,
      iconPath: pickIcon(g),
      width: size,
      height: size,
      anchor: { x: 0.5, y: 0.5 },
      callout: {
        content: title,
        color: '#303133',
        fontSize: 12,
        bgColor: '#ffffff',
        padding: 6,
        borderRadius: 6,
        display: 'BYCLICK',
        textAlign: 'center',
      },
    })
    indexMap.set(idx, g)
  })
  markerIndexMap.value = indexMap
  // 冻结数组以阻止 Vue 在传给小程序 map 组件前做深 proxy
  return Object.freeze(list) as UniMarker[]
})

// ===== 路线 polyline =====

interface RoutePoint {
  latitude: number
  longitude: number
  /** 携带原始诗以便后续 Tooltip 等扩展 */
  poem: MobilePoetryItem
  /** 排序所用的年份（无年份排到末尾） */
  sortYear: number
}

/**
 * 提取作者生平路线的所有节点：
 * 同坐标的诗只算一次（取最早一首），按年份排序
 */
const routePoints = computed<RoutePoint[]>(() => {
  if (!selectedAuthor.value || !showRoute.value) return []

  const poems = allPoetry.value.filter(
    (p) =>
      p.author === selectedAuthor.value &&
      !!p.location &&
      (!dynastyCode.value || p.dynastyCode === dynastyCode.value),
  )
  if (poems.length === 0) return []

  // 按坐标分组，取每组最早的一首
  const byLoc = new Map<string, RoutePoint>()
  for (const p of poems) {
    const c = parseLocation(p.location)
    if (!c) continue
    const key = `${c.lng.toFixed(4)},${c.lat.toFixed(4)}`
    const sortYear = extractSortYear(p.year)
    const existing = byLoc.get(key)
    if (!existing || sortYear < existing.sortYear) {
      byLoc.set(key, {
        latitude: c.lat,
        longitude: c.lng,
        poem: p,
        sortYear,
      })
    }
  }

  return Array.from(byLoc.values()).sort((a, b) => a.sortYear - b.sortYear)
})

interface UniPolyline {
  points: { latitude: number; longitude: number }[]
  color: string
  width: number
  dottedLine?: boolean
  arrowLine?: boolean
  borderColor?: string
  borderWidth?: number
}

const polylines = computed<UniPolyline[]>(() => {
  if (routePoints.value.length < 2) return []
  return [
    {
      points: routePoints.value.map((p) => ({
        latitude: p.latitude,
        longitude: p.longitude,
      })),
      color: '#43a047cc',
      width: 4,
      dottedLine: true,
      arrowLine: true,
      borderColor: '#ffffff',
      borderWidth: 1,
    },
  ]
})

function extractSortYear(year?: string | number): number {
  if (year == null) return Number.MAX_SAFE_INTEGER
  if (typeof year === 'number') return year
  const m = String(year).match(/(-?\d+)/)
  return m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER
}

// ===== 地图视野 =====

const centerLat = ref(35.0)
const centerLng = ref(105.0)
const mapScale = ref(4)

/**
 * 自动框选视野的坐标列表：
 * - 路线显示时优先框选路线点（看完整路线）
 * - 否则框选所有标记
 */
const includePoints = computed(() => {
  if (routePoints.value.length > 0) {
    return routePoints.value.map((p) => ({
      latitude: p.latitude,
      longitude: p.longitude,
    }))
  }
  if (locationGroups.value.length === 0) return []
  return locationGroups.value.map((g) => ({
    latitude: g.coord.lat,
    longitude: g.coord.lng,
  }))
})

// ===== 事件 =====

function onMarkerTap(e: any) {
  const markerId = e.detail.markerId as number
  const group = markerIndexMap.value.get(markerId)
  if (!group) return
  // 把视野中心移到点击的坐标，避免被底部 sheet 遮挡
  centerLat.value = group.coord.lat
  centerLng.value = group.coord.lng
  emit('tapMarker', {
    poems: group.poems,
    idioms: group.idioms,
    locationName: group.coord.name,
  })
}

// ===== 视野裁剪（性能优化） =====
// 当 marker 总数超过阈值时，仅渲染当前视野内的标记，避免小程序 map 渲染卡顿

/** 标记数超过此阈值才开启视野裁剪 */
const VIEWPORT_CULL_THRESHOLD = 200

interface MapBounds {
  southwest: { latitude: number; longitude: number }
  northeast: { latitude: number; longitude: number }
}

const viewportBounds = ref<MapBounds | null>(null)

/** 根据 regionchange 事件读取当前视野 */
function onRegionChange(e: any) {
  // type=end 时才更新（type=begin 时还在拖动中）
  if (e.type !== 'end') return
  // 不同小程序平台事件结构略有不同，尽量兼容
  const detail = e.detail || {}
  const region: MapBounds | undefined = detail.region
  if (region && region.southwest && region.northeast) {
    viewportBounds.value = region
    return
  }
  // H5 / 旧版本可能没 region，用 mapCtx 读
  // 这里直接忽略，落到无裁剪逻辑（仍然能跑，只是性能没优化）
}

function isInBounds(lat: number, lng: number, bounds: MapBounds | null): boolean {
  if (!bounds) return true
  const { southwest: sw, northeast: ne } = bounds
  // 给点 padding，避免边缘标记闪烁（约 1° ~ 100km）
  return lat >= sw.latitude - 0.5 && lat <= ne.latitude + 0.5 && lng >= sw.longitude - 0.5 && lng <= ne.longitude + 0.5
}

// ===== 统计 =====

const statText = computed(() => {
  const totalLocations = locationGroups.value.length
  const totalPoems = locationGroups.value.reduce((sum, g) => sum + g.poems.length, 0)
  const totalIdioms = locationGroups.value.reduce((sum, g) => sum + g.idioms.length, 0)
  const selected = props.selectedPoetryIds.size + props.selectedIdiomIds.size
  const parts = [`${totalLocations}地`]
  if (totalPoems) parts.push(`${totalPoems}诗`)
  if (totalIdioms) parts.push(`${totalIdioms}语`)
  if (selected) parts.push(`已选${selected}`)
  return parts.join(' · ')
})

/** 空状态时给一句具体的提示 */
const emptyHint = computed(() => {
  if (loading.value) return ''
  if (selectedAuthor.value) {
    return `「${selectedAuthor.value}」在当前朝代下没有带位置的作品`
  }
  if (dynastyCode.value) {
    const name = DYNASTIES.find((d) => d.code === dynastyCode.value)?.name || ''
    return `${name}没有带位置的诗词`
  }
  if (categoryValue.value === 'idiom') {
    return '当前没有带位置的成语条目'
  }
  return '尝试切换类型或朝代'
})
</script>

<style scoped>
.map-tab {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f5f6fa;
}

/* 工具栏 */
.map-toolbar {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 16rpx 20rpx;
  background: #fff;
  border-bottom: 1rpx solid #eee;
}

.picker-chip {
  display: flex;
  align-items: center;
  gap: 6rpx;
  padding: 10rpx 18rpx;
  background: #f5f6fa;
  border-radius: 30rpx;
  font-size: 24rpx;
}
.picker-chip.disabled {
  opacity: 0.4;
}
.picker-label {
  color: #999;
}
.picker-value {
  color: #43a047;
  font-weight: 600;
}

.stat-info {
  margin-left: auto;
  font-size: 22rpx;
  color: #888;
}
.stat-text {
  font-variant-numeric: tabular-nums;
}

/* 路线开关条 */
.route-bar {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 14rpx 24rpx;
  background: #f4faf5;
  border-bottom: 1rpx solid #e8f5e9;
  font-size: 24rpx;
  color: #2e7d32;
}
.route-checkbox {
  width: 30rpx;
  height: 30rpx;
  border: 2rpx solid #66bb6a;
  border-radius: 6rpx;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
}
.route-checkbox.checked {
  background: #43a047;
  border-color: #43a047;
}
.route-checkbox .check-mark {
  color: #fff;
  font-size: 20rpx;
  line-height: 1;
}
.route-label {
  flex: 1;
}
.route-hint {
  color: #66bb6a;
  font-size: 22rpx;
  font-variant-numeric: tabular-nums;
}

/* 地图 */
.map-area {
  flex: 1;
  width: 100%;
}

.loading-mask {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26rpx;
  color: #888;
}

/* 空状态 */
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80rpx 40rpx;
  gap: 16rpx;
}
.empty-icon {
  font-size: 96rpx;
  line-height: 1;
}
.empty-title {
  font-size: 28rpx;
  color: #555;
}
.empty-hint {
  font-size: 24rpx;
  color: #aaa;
  text-align: center;
  line-height: 1.6;
}

/* 图例 */
.legend {
  display: flex;
  justify-content: center;
  gap: 28rpx;
  padding: 12rpx 20rpx 16rpx;
  background: #fff;
  border-top: 1rpx solid #eee;
  font-size: 22rpx;
  color: #666;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6rpx;
}

.legend-dot {
  width: 18rpx;
  height: 18rpx;
  border-radius: 50%;
  border: 2rpx solid #fff;
  box-shadow: 0 0 0 1rpx rgba(0, 0, 0, 0.1);
}
.legend-dot.poetry {
  background: #409eff;
}
.legend-dot.idiom {
  background: #e6a23c;
}
.legend-dot.cluster {
  background: #f56c6c;
}
</style>
