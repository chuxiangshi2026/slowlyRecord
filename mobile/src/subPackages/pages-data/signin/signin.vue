<template>
  <view class="signin-container">
    <view class="header">
      <text class="title">📅 每日打卡</text>
      <text class="subtitle">坚持学习，每天进步一点点</text>
    </view>

    <view class="calendar-card">
      <view class="month-nav">
        <text class="nav-btn" @click="prevMonth">‹</text>
        <text class="month-text">{{ currentYear }}年{{ currentMonth + 1 }}月</text>
        <text class="nav-btn" @click="nextMonth">›</text>
      </view>

      <view class="weekdays">
        <text v-for="day in weekdays" :key="day" class="weekday">{{ day }}</text>
      </view>

      <view class="days-grid">
        <view
          v-for="(day, index) in calendarDays"
          :key="index"
          class="day-cell"
          :class="{
            'other-month': !day.isCurrentMonth,
            'today': day.isToday,
            'signed': day.isSigned
          }"
        >
          <text class="day-num">{{ day.date }}</text>
          <text v-if="day.isSigned" class="sign-mark">✓</text>
        </view>
      </view>
    </view>

    <view class="stats-card">
      <view class="stat">
        <text class="stat-num">{{ streakDays }}</text>
        <text class="stat-label">连续打卡</text>
      </view>
      <view class="stat">
        <text class="stat-num">{{ totalSignDays }}</text>
        <text class="stat-label">累计打卡</text>
      </view>
      <view class="stat">
        <text class="stat-num">{{ monthSignDays }}</text>
        <text class="stat-label">本月打卡</text>
      </view>
    </view>

    <button
      class="sign-btn"
      :class="{ signed: hasSignedToday }"
      :disabled="hasSignedToday"
      @click="handleSign"
    >
      {{ hasSignedToday ? '今日已打卡' : '立即打卡' }}
    </button>

    <view v-if="hasSignedToday" class="sign-reward">
      <text class="reward-text">🎉 打卡成功！继续加油！</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

const currentYear = ref(new Date().getFullYear())
const currentMonth = ref(new Date().getMonth())
const signedDates = ref<string[]>([])
const hasSignedToday = ref(false)

const STORAGE_KEY = 'signin_records'

const weekdays = ['日', '一', '二', '三', '四', '五', '六']

const todayStr = computed(() => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})

const streakDays = computed(() => {
  let streak = 0
  const today = new Date()
  for (let i = 0; i < 365; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const str = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    if (signedDates.value.includes(str)) {
      streak++
    } else if (i > 0) {
      break
    }
  }
  return streak
})

const totalSignDays = computed(() => signedDates.value.length)

const monthSignDays = computed(() => {
  const prefix = `${currentYear.value}-${String(currentMonth.value + 1).padStart(2, '0')}`
  return signedDates.value.filter(d => d.startsWith(prefix)).length
})

const calendarDays = computed(() => {
  const days: { date: number; isCurrentMonth: boolean; isToday: boolean; isSigned: boolean }[] = []
  const firstDay = new Date(currentYear.value, currentMonth.value, 1)
  const lastDay = new Date(currentYear.value, currentMonth.value + 1, 0)
  const prevLastDay = new Date(currentYear.value, currentMonth.value, 0)

  // 上月填充
  const startWeekday = firstDay.getDay()
  for (let i = startWeekday - 1; i >= 0; i--) {
    const date = prevLastDay.getDate() - i
    days.push({ date, isCurrentMonth: false, isToday: false, isSigned: false })
  }

  // 当月
  const todayStr = `${currentYear.value}-${String(currentMonth.value + 1).padStart(2, '0')}`
  for (let i = 1; i <= lastDay.getDate(); i++) {
    const dateStr = `${todayStr}-${String(i).padStart(2, '0')}`
    const isToday = dateStr === todayStr
    days.push({
      date: i,
      isCurrentMonth: true,
      isToday,
      isSigned: signedDates.value.includes(dateStr)
    })
  }

  // 下月填充
  const remaining = 42 - days.length
  for (let i = 1; i <= remaining; i++) {
    days.push({ date: i, isCurrentMonth: false, isToday: false, isSigned: false })
  }

  return days
})

onMounted(() => {
  loadSignRecords()
})

const loadSignRecords = () => {
  try {
    const stored = uni.getStorageSync(STORAGE_KEY)
    if (stored) {
      signedDates.value = JSON.parse(stored)
      hasSignedToday.value = signedDates.value.includes(todayStr.value)
    }
  } catch {
    signedDates.value = []
  }
}

const saveSignRecords = () => {
  uni.setStorageSync(STORAGE_KEY, JSON.stringify(signedDates.value))
}

const handleSign = () => {
  if (hasSignedToday.value) return

  signedDates.value.push(todayStr.value)
  hasSignedToday.value = true
  saveSignRecords()

  uni.showToast({ title: '打卡成功！', icon: 'success' })
}

const prevMonth = () => {
  if (currentMonth.value === 0) {
    currentMonth.value = 11
    currentYear.value--
  } else {
    currentMonth.value--
  }
}

const nextMonth = () => {
  if (currentMonth.value === 11) {
    currentMonth.value = 0
    currentYear.value++
  } else {
    currentMonth.value++
  }
}
</script>

<style scoped>
.signin-container {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 20rpx;
}

.header {
  text-align: center;
  padding: 40rpx 0;
}

.title {
  font-size: 40rpx;
  font-weight: bold;
  color: #333;
  display: block;
}

.subtitle {
  font-size: 26rpx;
  color: #999;
  margin-top: 10rpx;
  display: block;
}

.calendar-card {
  background: #fff;
  border-radius: 20rpx;
  padding: 30rpx;
  margin-bottom: 20rpx;
}

.month-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30rpx;
}

.nav-btn {
  font-size: 40rpx;
  color: #666;
  padding: 0 20rpx;
}

.month-text {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
}

.weekdays {
  display: flex;
  justify-content: space-around;
  margin-bottom: 20rpx;
}

.weekday {
  font-size: 26rpx;
  color: #999;
  width: 80rpx;
  text-align: center;
}

.days-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 10rpx;
}

.day-cell {
  height: 80rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 12rpx;
  position: relative;
}

.day-cell.other-month {
  opacity: 0.3;
}

.day-cell.today {
  background: #e3f2fd;
}

.day-cell.signed {
  background: #e8f5e9;
}

.day-num {
  font-size: 28rpx;
  color: #333;
}

.sign-mark {
  font-size: 20rpx;
  color: #4caf50;
  position: absolute;
  bottom: 4rpx;
}

.stats-card {
  display: flex;
  justify-content: space-around;
  background: #fff;
  border-radius: 20rpx;
  padding: 30rpx;
  margin-bottom: 20rpx;
}

.stat {
  text-align: center;
}

.stat-num {
  font-size: 40rpx;
  font-weight: bold;
  color: #1976d2;
  display: block;
}

.stat-label {
  font-size: 24rpx;
  color: #999;
  margin-top: 8rpx;
  display: block;
}

.sign-btn {
  width: 100%;
  height: 100rpx;
  background: linear-gradient(90deg, #667eea, #764ba2);
  color: #fff;
  border-radius: 50rpx;
  font-size: 36rpx;
  border: none;
  margin: 20rpx 0;
}

.sign-btn.signed {
  background: #ccc;
}

.sign-reward {
  text-align: center;
  padding: 20rpx;
}

.reward-text {
  font-size: 28rpx;
  color: #4caf50;
}
</style>
