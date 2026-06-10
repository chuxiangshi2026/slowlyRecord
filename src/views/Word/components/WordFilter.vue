<template>
  <transition name="filter-slide">
    <div v-if="visible" class="word-filter-bar">
      <!-- 搜索输入框 -->
      <div class="filter-input-wrap">
        <el-icon class="filter-search-icon"><Search /></el-icon>
        <input
          ref="mainInputRef"
          v-model="filterState.pattern"
          class="filter-input"
          placeholder="搜索 ( *通配符 )"
          @keyup.enter="emitChange"
        />
        <el-icon v-if="hasAnyFilter" class="filter-clear-icon" @click="resetAll"><CircleClose /></el-icon>
      </div>

      <!-- 筛选标签按钮 -->
      <div class="filter-tags">
        <el-popover
          :visible="popoverKey === 'length'"
          placement="bottom-start"
          :width="200"
          :show-arrow="false"
          :offset="2"
        >
          <template #reference>
            <span :class="['ftag', { on: isLengthActive }]" @click="openPopover('length')">
              长度<template v-if="isLengthActive"> {{ lengthLabel }}</template>
            </span>
          </template>
          <div class="popover-body">
            <div class="pop-row">
              <input
                v-model.number="filterState.minLength"
                type="number"
                :min="0"
                :max="50"
                class="pop-input"
                placeholder="最短"
                @input="emitChange"
              />
              <span class="pop-sep">~</span>
              <input
                v-model.number="filterState.maxLength"
                type="number"
                :min="0"
                :max="50"
                class="pop-input"
                placeholder="不限"
                @input="emitChange"
              />
            </div>
          </div>
        </el-popover>

        <el-popover
          :visible="popoverKey === 'affix'"
          placement="bottom-start"
          :width="240"
          :show-arrow="false"
          :offset="2"
        >
          <template #reference>
            <span :class="['ftag', { on: isAffixActive }]" @click="openPopover('affix')">
              词根词缀<template v-if="isAffixActive">: {{ affixLabel }}</template>
            </span>
          </template>
          <div class="popover-body">
            <div class="affix-type-row">
              <span
                v-for="opt in affixTypeOptions"
                :key="opt.value"
                :class="['affix-type-chip', { on: filterState.affixType === opt.value }]"
                @click="selectAffixType(opt.value)"
              >{{ opt.label }}</span>
            </div>
            <input
              v-model="filterState.affixText"
              class="pop-input full"
              placeholder="输入词缀，如 pre, un, tion"
              @input="emitChange"
              @keyup.enter="closePopover"
            />
          </div>
        </el-popover>

        <el-popover
          :visible="popoverKey === 'phonetic'"
          placement="bottom-start"
          :width="180"
          :show-arrow="false"
          :offset="2"
        >
          <template #reference>
            <span :class="['ftag', { on: filterState.phonetic }]" @click="openPopover('phonetic')">
              音标<template v-if="filterState.phonetic">: {{ filterState.phonetic }}</template>
            </span>
          </template>
          <div class="popover-body">
            <input
              v-model="filterState.phonetic"
              class="pop-input full"
              placeholder="如 æ, ɪŋ"
              @input="emitChange"
              @keyup.enter="closePopover"
            />
          </div>
        </el-popover>

        <!-- 类型筛选 -->
        <el-popover
          :visible="popoverKey === 'type'"
          placement="bottom-start"
          :width="140"
          :show-arrow="false"
          :offset="2"
        >
          <template #reference>
            <span :class="['ftag', { on: filterState.itemType !== 'all' }]" @click="openPopover('type')">
              类型<template v-if="filterState.itemType !== 'all'">: {{ filterState.itemType === 'phrase' ? '词组' : '单词' }}</template>
            </span>
          </template>
          <div class="popover-body">
            <div class="affix-type-row">
              <span
                v-for="opt in typeOptions"
                :key="opt.value"
                :class="['affix-type-chip', { on: filterState.itemType === opt.value }]"
                @click="selectType(opt.value)"
              >{{ opt.label }}</span>
            </div>
          </div>
        </el-popover>
      </div>

      <!-- 分隔 -->
      <div class="filter-divider"></div>

      <!-- 排序 -->
      <div class="sort-chips">
        <span
          v-for="opt in sortOptions"
          :key="opt.key"
          :class="['schip', { on: filterState.sortBy === opt.key }]"
          @click="toggleSort(opt.key)"
        >
          {{ opt.label }}<template v-if="filterState.sortBy === opt.key">{{ filterState.sortAsc ? '↑' : '↓' }}</template>
        </span>
      </div>

      <!-- 匹配数 -->
      <span class="match-count">{{ matchCount }}</span>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { reactive, ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { Search, CircleClose } from '@element-plus/icons-vue'

export interface FilterState {
  minLength: number  // 0 = 不限
  maxLength: number  // 0 = 不限
  pattern: string
  affixType: string  // '' | 'prefix' | 'suffix' | 'root' | 'all'
  affixText: string
  phonetic: string
  itemType: 'all' | 'word' | 'phrase'
  sortBy: string
  sortAsc: boolean
}

const props = defineProps<{
  visible: boolean
  matchCount: number
}>()

const emit = defineEmits<{
  (e: 'change', state: FilterState): void
  (e: 'reset'): void
}>()

const mainInputRef = ref<HTMLInputElement | null>(null)
const popoverKey = ref('')

const filterState = reactive<FilterState>({
  minLength: 0,
  maxLength: 0,
  pattern: '',
  affixType: '',
  affixText: '',
  phonetic: '',
  itemType: 'all',
  sortBy: '',
  sortAsc: true
})

const sortOptions = [
  { key: 'alpha', label: 'A-Z' },
  { key: 'length', label: '长度' },
  { key: 'time', label: '时间' },
  { key: 'level', label: '等级' }
]

const isLengthActive = computed(() => filterState.minLength > 0 || filterState.maxLength > 0)
const lengthLabel = computed(() => {
  if (filterState.minLength > 0 && filterState.maxLength > 0) return `${filterState.minLength}-${filterState.maxLength}`
  if (filterState.minLength > 0) return `≥${filterState.minLength}`
  if (filterState.maxLength > 0) return `≤${filterState.maxLength}`
  return ''
})

const affixTypeOptions = [
  { value: '', label: '全部' },
  { value: 'prefix', label: '前缀' },
  { value: 'suffix', label: '后缀' },
  { value: 'root', label: '词根' }
]

const typeOptions = [
  { value: 'all', label: '全部' },
  { value: 'word', label: '单词' },
  { value: 'phrase', label: '词组' }
]

const isAffixActive = computed(() => !!filterState.affixText || !!filterState.affixType)
const affixLabel = computed(() => {
  const typeLabel = affixTypeOptions.find(o => o.value === filterState.affixType)?.label || ''
  const parts: string[] = []
  if (filterState.affixType && filterState.affixType !== '') parts.push(typeLabel)
  if (filterState.affixText) parts.push(filterState.affixText)
  return parts.join(' ') || ''
})

const selectAffixType = (value: string) => {
  filterState.affixType = filterState.affixType === value ? '' : value
  emitChange()
}

const selectType = (value: 'all' | 'word' | 'phrase') => {
  filterState.itemType = filterState.itemType === value ? 'all' : value
  emitChange()
}

const hasAnyFilter = computed(() =>
  filterState.minLength > 0 || filterState.maxLength > 0 ||
  !!filterState.pattern || !!filterState.affixText || !!filterState.affixType || !!filterState.phonetic ||
  filterState.itemType !== 'all' || !!filterState.sortBy
)

const openPopover = (key: string) => {
  popoverKey.value = popoverKey.value === key ? '' : key
}

const closePopover = () => {
  popoverKey.value = ''
}

const toggleSort = (key: string) => {
  if (filterState.sortBy === key) {
    filterState.sortAsc = !filterState.sortAsc
  } else {
    filterState.sortBy = key
    filterState.sortAsc = key === 'alpha' || key === 'level'
  }
  emitChange()
}

const emitChange = () => {
  emit('change', { ...filterState })
}

const resetAll = () => {
  filterState.minLength = 0
  filterState.maxLength = 0
  filterState.pattern = ''
  filterState.affixType = ''
  filterState.affixText = ''
  filterState.phonetic = ''
  filterState.itemType = 'all'
  filterState.sortBy = ''
  filterState.sortAsc = true
  popoverKey.value = ''
  emit('reset')
}

// 筛选条件变化自动触发
watch(
  () => [
    filterState.minLength,
    filterState.maxLength,
    filterState.pattern,
    filterState.affixType,
    filterState.affixText,
    filterState.phonetic
  ],
  () => { emitChange() }
)

// 点击外部关闭 popover
const onDocClick = (e: MouseEvent) => {
  if (popoverKey.value) {
    const target = e.target as HTMLElement
    if (!target.closest('.el-popover') && !target.closest('.ftag')) {
      popoverKey.value = ''
    }
  }
}
onMounted(() => document.addEventListener('click', onDocClick, true))
onUnmounted(() => document.removeEventListener('click', onDocClick, true))

defineExpose({ filterState })
</script>

<style scoped lang="scss">
.word-filter-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 10px;
  background: var(--utools-bg-card);
  border-bottom: 1px solid var(--utools-border-divider);
  position: relative;
  z-index: 10;
  font-size: 12px;
}

// ---- 搜索输入 ----
.filter-input-wrap {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 120px;
  max-width: 260px;
  height: 24px;
  background: var(--utools-bg-tertiary);
  border-radius: 4px;
  border: 1px solid var(--utools-border-divider);
  padding: 0 6px;
  transition: border-color 0.2s;

  &:focus-within {
    border-color: var(--utools-primary);
  }

  .filter-search-icon,
  .filter-clear-icon {
    font-size: 13px;
    color: var(--utools-text-tertiary);
    flex-shrink: 0;
  }

  .filter-clear-icon {
    cursor: pointer;
    &:hover { color: var(--utools-text-secondary); }
  }

  .filter-input {
    flex: 1;
    border: none;
    outline: none;
    background: transparent;
    font-size: 12px;
    color: var(--utools-text-primary);
    padding: 0 4px;
    height: 100%;
    min-width: 0;

    &::placeholder {
      color: var(--utools-text-tertiary);
    }
  }
}

// ---- 筛选标签 ----
.filter-tags {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.ftag {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 8px;
  border-radius: 3px;
  cursor: pointer;
  border: 1px solid var(--utools-border-divider);
  background: var(--utools-bg-tertiary);
  color: var(--utools-text-secondary);
  white-space: nowrap;
  user-select: none;
  transition: all 0.15s;

  &:hover {
    border-color: var(--utools-primary);
    color: var(--utools-primary);
  }

  &.on {
    background: var(--utools-primary);
    color: #fff;
    border-color: var(--utools-primary);
  }
}

// ---- 分隔线 ----
.filter-divider {
  width: 1px;
  height: 16px;
  background: var(--utools-border-divider);
  flex-shrink: 0;
}

// ---- 排序 ----
.sort-chips {
  display: flex;
  align-items: center;
  gap: 3px;
  flex-shrink: 0;
}

.schip {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 7px;
  border-radius: 3px;
  cursor: pointer;
  color: var(--utools-text-tertiary);
  user-select: none;
  white-space: nowrap;
  transition: all 0.15s;

  &:hover {
    color: var(--utools-text-primary);
    background: var(--utools-bg-hover);
  }

  &.on {
    color: var(--utools-primary);
    font-weight: 500;
  }
}

// ---- 匹配数 ----
.match-count {
  margin-left: auto;
  font-size: 11px;
  color: var(--utools-text-tertiary);
  flex-shrink: 0;
}

// ---- Popover 内容 ----
.popover-body {
  padding: 6px 8px;
}

.affix-type-row {
  display: flex;
  gap: 4px;
  margin-bottom: 6px;
}

.affix-type-chip {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 8px;
  border-radius: 3px;
  cursor: pointer;
  border: 1px solid var(--utools-border-divider);
  background: var(--utools-bg-tertiary);
  color: var(--utools-text-secondary);
  font-size: 12px;
  white-space: nowrap;
  user-select: none;
  transition: all 0.15s;

  &:hover {
    border-color: var(--utools-primary);
    color: var(--utools-primary);
  }

  &.on {
    background: var(--utools-primary);
    color: #fff;
    border-color: var(--utools-primary);
  }
}

.pop-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.pop-input {
  width: 70px;
  height: 26px;
  border: 1px solid var(--utools-border-divider);
  border-radius: 3px;
  padding: 0 6px;
  font-size: 12px;
  outline: none;
  background: var(--utools-bg-card);
  color: var(--utools-text-primary);
  transition: border-color 0.2s;

  &:focus {
    border-color: var(--utools-primary);
  }

  &.full {
    width: 100%;
  }
}

.pop-sep {
  color: var(--utools-text-tertiary);
  font-size: 12px;
}

// ---- 过渡动画 ----
.filter-slide-enter-active,
.filter-slide-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}

.filter-slide-enter-from,
.filter-slide-leave-to {
  height: 0;
  opacity: 0;
  padding: 0 10px;
}
</style>
