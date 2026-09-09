<template>
  <div class="sign-page">
    <!-- 顶部统计卡片 -->
    <div class="sign-stats">
      <div class="stat-card stat-main">
        <div class="stat-value">{{ signinStore.streakDays }}</div>
        <div class="stat-label">连续打卡（天）</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ signinStore.totalSignDays }}</div>
        <div class="stat-label">累计打卡（天）</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ monthDays }}</div>
        <div class="stat-label">本月打卡（天）</div>
      </div>
      <div class="stat-card stat-action">
        <el-tag v-if="signinStore.hasSignedToday" type="success" size="large" effect="light">
          今日已打卡
        </el-tag>
        <template v-else>
          <div class="stat-label">今天还没有打卡哦</div>
          <el-button type="primary" round @click="handleSignToday">立即打卡</el-button>
        </template>
      </div>
    </div>

    <!-- 近 12 周打卡热力图 -->
    <div class="heatmap-card">
      <div class="heatmap-title">近 12 周打卡记录</div>
      <div class="heatmap-body">
        <div class="heatmap-weekdays">
          <span v-for="d in ['一', '二', '三', '四', '五', '六', '日']" :key="d">{{ d }}</span>
        </div>
        <div class="heatmap-grid">
          <div v-for="(week, wi) in heatmapWeeks" :key="wi" class="heatmap-column">
            <div
              v-for="(cell, di) in week"
              :key="di"
              class="heatmap-cell"
              :class="{ signed: cell.signed, future: cell.future, today: cell.isToday }"
              :title="cell.date + (cell.signed ? ' 已打卡' : '')"
            ></div>
          </div>
        </div>
      </div>
      <div class="heatmap-legend">
        <span class="heatmap-cell"></span>
        <span class="legend-label">未打卡</span>
        <span class="heatmap-cell legend-signed"></span>
        <span class="legend-label">已打卡</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useSigninStore } from '@/stores/signin'

const signinStore = useSigninStore()

onMounted(() => {
  signinStore.loadRecords()
})

// 本月打卡天数
const monthDays = computed(() => {
  const now = new Date()
  return signinStore.monthSignDays(now.getFullYear(), now.getMonth())
})

/** 本地时区日期 → YYYY-MM-DD */
function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const WEEK_COUNT = 12

/**
 * 近 12 周热力图：每周一列为起点，行对应周一到周日，最后一列包含今天
 * 每格附带 signed / future / isToday 标记
 */
const heatmapWeeks = computed(() => {
  const signedSet = new Set(signinStore.signedDates)
  const today = new Date()
  // 回退到本周周一
  const monday = new Date(today)
  const dayOfWeek = (today.getDay() + 6) % 7 // 周一为 0
  monday.setDate(today.getDate() - dayOfWeek - (WEEK_COUNT - 1) * 7)

  const todayStr = formatDate(today)
  const weeks: Array<Array<{ date: string; signed: boolean; future: boolean; isToday: boolean }>> = []
  for (let w = 0; w < WEEK_COUNT; w++) {
    const column: Array<{ date: string; signed: boolean; future: boolean; isToday: boolean }> = []
    for (let d = 0; d < 7; d++) {
      const date = new Date(monday)
      date.setDate(monday.getDate() + w * 7 + d)
      const dateStr = formatDate(date)
      column.push({
        date: dateStr,
        signed: signedSet.has(dateStr),
        future: date.getTime() > today.getTime(),
        isToday: dateStr === todayStr,
      })
    }
    weeks.push(column)
  }
  return weeks
})

function handleSignToday() {
  if (signinStore.signToday()) {
    ElMessage.success('打卡成功，继续保持！')
  } else {
    ElMessage.info('今天已经打过卡啦')
  }
}
</script>

<style scoped lang="scss">
.sign-page {
  padding: 20px;
  min-height: 100vh;
  background-color: var(--utools-bg-secondary);
}

// 顶部统计卡片
.sign-stats {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 20px;

  .stat-card {
    flex: 1;
    min-width: 150px;
    padding: 20px;
    border-radius: 8px;
    background-color: var(--utools-bg-card);
    box-shadow: var(--utools-shadow-sm);
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;

    .stat-value {
      font-size: 36px;
      font-weight: 700;
      color: var(--utools-primary);
      line-height: 1.2;
    }

    .stat-label {
      font-size: 13px;
      color: var(--utools-text-secondary);
    }
  }

  .stat-main .stat-value {
    font-size: 48px;
  }
}

// 热力图卡片
.heatmap-card {
  padding: 20px;
  border-radius: 8px;
  background-color: var(--utools-bg-card);
  box-shadow: var(--utools-shadow-sm);

  .heatmap-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--utools-text-primary);
    margin-bottom: 16px;
  }

  .heatmap-body {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding-bottom: 4px;
  }

  .heatmap-weekdays {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding-top: 0;

    span {
      width: 14px;
      height: 14px;
      font-size: 10px;
      line-height: 14px;
      text-align: center;
      color: var(--utools-text-tertiary);
    }
  }

  .heatmap-grid {
    display: flex;
    gap: 4px;
  }

  .heatmap-column {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
}

// 单个热力格子：默认未打卡底色，打卡后按主题主色分档
.heatmap-cell {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  background-color: var(--utools-bg-hover);

  &.future {
    background-color: var(--utools-bg-secondary);
    opacity: 0.5;
  }

  &.signed {
    background-color: var(--utools-primary);
    opacity: 0.35;
  }

  &.today {
    outline: 1.5px solid var(--utools-primary);
    outline-offset: 1px;
  }
}

// 图例分档
.heatmap-legend {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  margin-top: 12px;

  .legend-label {
    font-size: 11px;
    color: var(--utools-text-tertiary);
    margin: 0 4px;
  }

  .legend-signed {
    background-color: var(--utools-primary);
    opacity: 0.35;
  }
}
</style>
