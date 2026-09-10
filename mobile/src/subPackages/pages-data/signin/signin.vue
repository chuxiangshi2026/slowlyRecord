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
      <!-- #ifdef MP-WEIXIN || MP-TOUTIAO -->
      <button class="share-btn" @click="handleShare">🎨 分享成就</button>
      <!-- #endif -->
    </view>

    <!-- 成就墙 -->
    <view class="achievement-wall">
      <view class="wall-header">
        <text class="wall-title">🏆 成就墙</text>
        <text class="wall-progress">{{ achievementStore.unlockedCount }}/{{ achievementStore.totalCount }}</text>
      </view>
      <view class="wall-grid">
        <view
          v-for="def in ACHIEVEMENTS"
          :key="def.id"
          class="achievement-cell"
          :class="{ unlocked: achievementStore.isUnlocked(def.id) }"
        >
          <text class="achievement-icon">{{ def.icon }}</text>
          <text class="achievement-name">{{ def.name }}</text>
          <text v-if="achievementStore.isUnlocked(def.id)" class="achievement-date">
            {{ formatUnlockDate(achievementStore.unlockedTime(def.id)) }}
          </text>
          <text v-else class="achievement-target">{{ def.target }}</text>
        </view>
      </view>
    </view>

    <!-- 成就解锁通知条（非模态，底部浮出 3 秒后消失） -->
    <view v-if="toastVisible" class="achievement-toast">
      <text class="toast-icon">{{ toastItem?.icon }}</text>
      <text class="toast-text">解锁成就：{{ toastItem?.name }}</text>
    </view>

    <!-- 分享卡离屏画布（canvas 2d，仅小程序端） -->
    <!-- #ifdef MP-WEIXIN || MP-TOUTIAO -->
    <canvas
      type="2d"
      id="signinShareCanvas"
      class="share-canvas"
      :style="{ width: CARD_WIDTH + 'px', height: CARD_HEIGHT + 'px' }"
    />
    <!-- #endif -->

    <!-- 分享卡预览弹窗 -->
    <view v-if="shareImage" class="share-mask" @click="shareImage = ''">
      <view class="share-dialog" @click.stop>
        <image class="share-preview" :src="shareImage" mode="widthFix" />
        <view class="share-actions">
          <button class="share-action primary" @click="saveToAlbum">保存到相册</button>
          <!-- #ifdef MP-WEIXIN -->
          <button class="share-action" open-type="share">分享给好友</button>
          <!-- #endif -->
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, getCurrentInstance } from 'vue'
import { onShow, onShareAppMessage } from '@dcloudio/uni-app'
import { useSignin } from '@/stores/useSignin'
import { useAchievements } from '@/stores/useAchievements'
import { ACHIEVEMENTS, type AchievementDef } from '@/utils/achievements'
import {
  buildCardInfo,
  drawSigninCard,
  CARD_WIDTH,
  CARD_HEIGHT,
  type ShareCardCtx,
} from './signin-card'

const signinStore = useSignin()
const achievementStore = useAchievements()
const signedDates = computed(() => signinStore.signedDates)
const hasSignedToday = computed(() => signinStore.hasSignedToday)
const streakDays = computed(() => signinStore.streakDays)
const totalSignDays = computed(() => signinStore.totalSignDays)

const currentYear = ref(new Date().getFullYear())
const currentMonth = ref(new Date().getMonth())

const weekdays = ['日', '一', '二', '三', '四', '五', '六']

const todayStr = computed(() => signinStore.todayStr)

const monthSignDays = computed(() =>
  signinStore.monthSignDays(currentYear.value, currentMonth.value)
)

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
  signinStore.loadRecords()
})

// ===== 成就检查与解锁通知 =====

/** 通知条状态：当前展示项与可见标志（队列逐个展示，每条 3 秒） */
const toastVisible = ref(false)
const toastItem = ref<AchievementDef | null>(null)
let _toastTimer: ReturnType<typeof setTimeout> | null = null
let _toastQueue: AchievementDef[] = []

/** 解锁时间戳 → YYYY-MM-DD（成就墙展示用） */
function formatUnlockDate(ts: number): string {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 展示下一条成就通知；队列空时隐藏 */
function showNextToast() {
  const next = _toastQueue.shift()
  if (!next) {
    toastVisible.value = false
    toastItem.value = null
    return
  }
  toastItem.value = next
  toastVisible.value = true
  _toastTimer = setTimeout(showNextToast, 3000)
}

/** 解锁成就入队通知（同一成就由 store 去重，这里只管展示） */
function notifyUnlocks(list: AchievementDef[]) {
  if (list.length === 0) return
  _toastQueue.push(...list)
  if (!toastVisible.value) showNextToast()
}

/** 检查成就并弹通知；供打卡成功与页面 onShow 调用 */
async function checkAndNotify() {
  try {
    notifyUnlocks(await achievementStore.checkNow())
  } catch (e) {
    console.error('成就检查失败:', e)
  }
}

// 每次进入打卡页检查一次（覆盖从复习页/我的页返回等路径）
onShow(() => {
  signinStore.loadRecords()
  achievementStore.load()
  checkAndNotify()
})

const handleSign = () => {
  if (signinStore.signToday()) {
    uni.showToast({ title: '打卡成功！', icon: 'success' })
    // 打卡可能触发连签类成就，立即检查一次
    checkAndNotify()
  }
}

// ===== 分享成就卡 =====

const instance = getCurrentInstance()
const shareImage = ref('')
const generating = ref(false)

/**
 * 页面级分享：标题带连续天数；
 * imageUrl 用已缓存的分享卡临时路径，未生成（或生成失败）时留空退化为默认截图分享。
 */
onShareAppMessage(() => ({
  title: `我在「慢记」已连续打卡 ${streakDays.value} 天，一起坚持！`,
  path: '/subPackages/pages-data/signin/signin',
  imageUrl: shareImage.value || '',
}))

/** 获取 canvas 2d 节点 */
function getCanvasNode(): Promise<any> {
  return new Promise((resolve, reject) => {
    // dcloudio 类型里 fields 需要回调参数，实际可选，这里整链放宽
    const query = uni.createSelectorQuery().in(instance?.proxy as any) as any
    query
      .select('#signinShareCanvas')
      .fields({ node: true, size: true })
      .exec((res: any[]) => {
        const node = res?.[0]?.node
        if (node) resolve(node)
        else reject(new Error('canvas 节点获取失败'))
      })
  })
}

/** canvas 节点导出为临时图片路径 */
function canvasToTemp(canvasNode: any, destWidth: number, destHeight: number): Promise<string> {
  return new Promise((resolve, reject) => {
    uni.canvasToTempFilePath({
      canvas: canvasNode,
      canvasId: 'signinShareCanvas',
      destWidth,
      destHeight,
      fileType: 'png',
      success: (res: any) => resolve(res.tempFilePath),
      fail: reject,
    } as any)
  })
}

/** 绘制分享卡并导出（微信/抖音 canvas 2d 基本对齐，异常由调用方兜底） */
async function generateShareImage(): Promise<string> {
  const node = await getCanvasNode()
  // 按设备 pixelRatio 放大导出，保证分享图清晰度
  let dpr = 2
  try {
    const info: any = (uni as any).getWindowInfo ? (uni as any).getWindowInfo() : uni.getSystemInfoSync()
    dpr = info.pixelRatio || 2
  } catch {
    dpr = 2
  }
  node.width = CARD_WIDTH * dpr
  node.height = CARD_HEIGHT * dpr
  const ctx = node.getContext('2d') as ShareCardCtx
  ctx.scale(dpr, dpr)
  drawSigninCard(
    ctx,
    buildCardInfo(new Date(), signedDates.value, streakDays.value, totalSignDays.value)
  )
  return canvasToTemp(node, CARD_WIDTH * dpr, CARD_HEIGHT * dpr)
}

/** 点击「分享成就」：生成图片并弹出预览 */
async function handleShare() {
  if (generating.value || shareImage.value) return
  generating.value = true
  uni.showLoading({ title: '生成中' })
  try {
    shareImage.value = await generateShareImage()
  } catch (e) {
    console.error('分享卡生成失败:', e)
    uni.showToast({ title: '分享图生成失败', icon: 'none' })
  } finally {
    uni.hideLoading()
    generating.value = false
  }
}

/** 保存到相册：拒绝授权时引导去设置页开启 */
function saveToAlbum() {
  if (!shareImage.value) return
  uni.saveImageToPhotosAlbum({
    filePath: shareImage.value,
    success: () => uni.showToast({ title: '已保存到相册', icon: 'success' }),
    fail: (err: any) => {
      const msg: string = err?.errMsg || ''
      if (msg.includes('auth') || msg.includes('deny')) {
        uni.showModal({
          title: '需要相册权限',
          content: '请在设置中允许保存图片到相册',
          confirmText: '去设置',
          success: r => {
            if (r.confirm) uni.openSetting()
          },
        })
      } else {
        uni.showToast({ title: '保存失败', icon: 'none' })
      }
    },
  })
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
  background: #eaf1ea;
}

.day-cell.signed {
  background: #eaf1ea;
}

.day-num {
  font-size: 28rpx;
  color: #333;
}

.sign-mark {
  font-size: 20rpx;
  color: #52796f;
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
  color: #52796f;
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
  background: linear-gradient(90deg, #52796f, #74937d);
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
  color: #52796f;
}

.share-btn {
  margin-top: 20rpx;
  background: #52796f;
  color: #fff;
  font-size: 30rpx;
  border-radius: 44rpx;
  border: none;
  width: 60%;
}

.share-btn::after {
  border: none;
}

.share-canvas {
  position: fixed;
  left: -9999px;
  top: -9999px;
}

.share-mask {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.share-dialog {
  width: 78%;
  background: #fff;
  border-radius: 24rpx;
  padding: 30rpx;
}

.share-preview {
  width: 100%;
  border-radius: 16rpx;
  background: #eaf1ea;
}

.share-actions {
  display: flex;
  gap: 20rpx;
  margin-top: 30rpx;
}

.share-action {
  flex: 1;
  font-size: 30rpx;
  border-radius: 44rpx;
  border: none;
  background: #f0f4f0;
  color: #52796f;
}

.share-action::after {
  border: none;
}

.share-action.primary {
  background: #52796f;
  color: #fff;
}

/* ===== 成就墙 ===== */

.achievement-wall {
  background: #fff;
  border-radius: 20rpx;
  padding: 30rpx;
  margin-top: 20rpx;
}

.wall-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24rpx;
}

.wall-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
}

.wall-progress {
  font-size: 26rpx;
  color: #52796f;
  font-weight: bold;
}

.wall-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20rpx;
}

.achievement-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24rpx 10rpx;
  border-radius: 16rpx;
  background: #f5f5f5;
  opacity: 0.55;
}

/* 已解锁：主色点亮 */
.achievement-cell.unlocked {
  background: #e8f1ec;
  opacity: 1;
  border: 1rpx solid #52796f;
}

.achievement-icon {
  font-size: 44rpx;
}

.achievement-cell.unlocked .achievement-icon {
  font-size: 48rpx;
}

.achievement-name {
  font-size: 24rpx;
  color: #333;
  font-weight: bold;
  margin-top: 10rpx;
}

.achievement-target {
  font-size: 20rpx;
  color: #999;
  margin-top: 6rpx;
  text-align: center;
}

.achievement-date {
  font-size: 20rpx;
  color: #52796f;
  margin-top: 6rpx;
}

/* ===== 成就解锁通知条（非模态，底部浮出） ===== */

.achievement-toast {
  position: fixed;
  left: 40rpx;
  right: 40rpx;
  bottom: 80rpx;
  background: #52796f;
  border-radius: 50rpx;
  padding: 24rpx 40rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
  box-shadow: 0 8rpx 30rpx rgba(82, 121, 111, 0.4);
}

.toast-icon {
  font-size: 36rpx;
  margin-right: 16rpx;
}

.toast-text {
  font-size: 28rpx;
  color: #fff;
  font-weight: bold;
}
</style>
