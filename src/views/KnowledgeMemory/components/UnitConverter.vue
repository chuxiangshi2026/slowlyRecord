<template>
  <div class="unit-converter">
    <div class="uc-header">
      <el-icon :size="14"><Odometer /></el-icon>
      <span>单位换算器</span>
    </div>

    <!-- 类别切换 -->
    <div class="uc-categories">
      <span
        v-for="c in UNIT_CATEGORIES"
        :key="c.key"
        :class="['uc-chip', {on: categoryKey === c.key}]"
        @click="switchCategory(c.key)"
      >{{ c.label }}</span>
    </div>

    <!-- 换算区 -->
    <div class="uc-body">
      <div class="uc-input-row">
        <el-input
          v-model="inputValue"
          type="number"
          class="uc-value-input"
          placeholder="输入数值"
          @input="recompute"
        />
        <el-select v-model="fromUnit" class="uc-unit-select" @change="recompute">
          <el-option v-for="u in currentCategory.units" :key="u.name" :label="u.name" :value="u.name" />
        </el-select>
        <el-button
          class="uc-swap-btn"
          :icon="Sort"
          circle
          title="交换源/目标单位"
          @click="swapUnits"
        />
        <el-select v-model="toUnit" class="uc-unit-select" @change="recompute">
          <el-option v-for="u in currentCategory.units" :key="u.name" :label="u.name" :value="u.name" />
        </el-select>
      </div>

      <div class="uc-result">
        <span class="uc-result-num">{{ resultText }}</span>
        <span v-if="resultText !== '—'" class="uc-result-unit">{{ toUnit }}</span>
      </div>
      <div class="uc-result-hint">{{ resultHint }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {computed, ref} from 'vue';
import {Odometer, Sort} from '@element-plus/icons-vue';
import {convertUnit, UNIT_CATEGORIES} from '../unit-convert';

/** 当前类别 key */
const categoryKey = ref(UNIT_CATEGORIES[0].key);
const currentCategory = computed(() => UNIT_CATEGORIES.find(c => c.key === categoryKey.value)!);

/** 源/目标单位（类别切换时重置为该类别前两个单位） */
const fromUnit = ref(currentCategory.value.units[0].name);
const toUnit = ref(currentCategory.value.units[1].name);

/** 输入数值（el-input type=number 绑定出来是 string） */
const inputValue = ref('1');

/** 换算结果（null 表示无法换算） */
const result = ref<number | null>(null);

/** 避免浮点长尾：toPrecision(10) 后 parseFloat 去尾零 */
function formatNumber(n: number): string {
  return String(parseFloat(n.toPrecision(10)));
}

function recompute() {
  const v = Number(inputValue.value);
  if (inputValue.value === '' || !Number.isFinite(v)) {
    result.value = null;
    return;
  }
  result.value = convertUnit(categoryKey.value, fromUnit.value, toUnit.value, v);
}

function swapUnits() {
  const t = fromUnit.value;
  fromUnit.value = toUnit.value;
  toUnit.value = t;
  recompute();
}

function switchCategory(key: string) {
  if (categoryKey.value === key) return;
  categoryKey.value = key;
  const c = currentCategory.value;
  fromUnit.value = c.units[0].name;
  toUnit.value = c.units[1].name;
  recompute();
}

const resultText = computed(() => (result.value === null ? '—' : formatNumber(result.value)));
const resultHint = computed(() =>
  result.value === null
    ? '请输入有效数值'
    : `${inputValue.value} ${fromUnit.value} = ${formatNumber(result.value)} ${toUnit.value}`,
);

recompute();
</script>

<style scoped lang="scss">
.unit-converter {
  margin-bottom: 14px;
  padding: 10px 14px;
  border: 1px dashed var(--utools-border-primary);
  border-radius: 8px;
  background: var(--utools-bg-card);

  .uc-header {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    font-weight: 600;
    color: var(--utools-primary);
    margin-bottom: 8px;
  }

  .uc-categories {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 10px;

    .uc-chip {
      padding: 2px 10px;
      font-size: 12px;
      border-radius: 12px;
      border: 1px solid var(--utools-border-primary);
      color: var(--utools-text-secondary);
      cursor: pointer;
      user-select: none;

      &.on {
        background: var(--utools-primary);
        border-color: var(--utools-primary);
        color: #fff;
      }
    }
  }

  .uc-body {
    .uc-input-row {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;

      .uc-value-input {
        width: 160px;
      }

      .uc-unit-select {
        width: 120px;
      }
    }

    .uc-result {
      margin-top: 10px;
      display: flex;
      align-items: baseline;
      gap: 6px;

      .uc-result-num {
        font-size: 24px;
        font-weight: 700;
        color: var(--utools-primary);
      }

      .uc-result-unit {
        font-size: 14px;
        color: var(--utools-text-secondary);
      }
    }

    .uc-result-hint {
      margin-top: 4px;
      font-size: 12px;
      color: var(--utools-text-tertiary);
    }
  }
}
</style>
