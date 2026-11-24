<template>
  <view class="focus-page" @touchmove.stop>
    <!-- 专注模式专属深色古风背景（不跟随主题，避免亮色主题下浅底浅字看不清） -->
    <image class="focus-bg" :src="bgSrc" mode="aspectFill" />
    <!-- 顶栏（右距/顶距按微信胶囊位置动态避让，防止设置按钮被胶囊盖住） -->
    <view class="top-bar" :style="topBarStyle">
      <text class="exit-btn" @click="exitFocus">✕ 退出</text>
      <text class="progress-text" v-if="wordList.length > 0">{{ currentIndex + 1 }} / {{ wordList.length }}</text>
      <text class="settings-btn" @click="showSettings = !showSettings">⚙ 设置</text>
    </view>

    <!-- 设置面板 -->
    <view v-if="showSettings" class="settings-panel">
      <view class="setting-row">
        <text class="setting-label">模式</text>
        <view class="setting-chips">
          <view
            v-for="m in modeOptions"
            :key="m.value"
            class="chip"
            :class="{ on: settings.mode === m.value }"
            @click="setMode(m.value)"
          >
            <text>{{ m.label }}</text>
          </view>
        </view>
      </view>
      <view class="setting-row">
        <text class="setting-label">自动翻页</text>
        <view class="setting-chips">
          <view
            v-for="opt in intervalOptions"
            :key="opt.value"
            class="chip"
            :class="{ on: settings.intervalSec === opt.value }"
            @click="setIntervalSec(opt.value)"
          >
            <text>{{ opt.label }}</text>
          </view>
        </view>
      </view>
      <view class="setting-row">
        <text class="setting-label">自动发音</text>
        <view class="setting-chips">
          <view class="chip" :class="{ on: settings.autoPlay }" @click="toggleAutoPlay">
            <text>{{ settings.autoPlay ? '开' : '关' }}</text>
          </view>
        </view>
      </view>
      <view class="setting-row">
        <text class="setting-label">发音遍数</text>
        <view class="setting-chips">
          <view
            v-for="n in repeatOptions"
            :key="n"
            class="chip"
            :class="{ on: settings.repeatCount === n }"
            @click="setRepeatCount(n)"
          >
            <text>{{ n }}遍</text>
          </view>
        </view>
      </view>
      <view class="setting-row">
        <text class="setting-label">语速</text>
        <view class="setting-chips">
          <view
            v-for="opt in speechRateOptions"
            :key="opt.value"
            class="chip"
            :class="{ on: settings.speechRate === opt.value }"
            @click="setSpeechRate(opt.value)"
          >
            <text>{{ opt.label }}</text>
          </view>
        </view>
      </view>
      <view class="setting-row">
        <text class="setting-label">盲操作</text>
        <view class="setting-chips">
          <view class="chip" :class="{ on: settings.tapMark }" @click="toggleTapMark">
            <text>双击记住</text>
          </view>
          <view class="chip" :class="{ on: settings.shakeMark }" @click="toggleShakeMark">
            <text>摇一摇记住</text>
          </view>
        </view>
      </view>
      <!-- 词间停顿：仅听词模式使用，与「自动翻页」相互独立 -->
      <view v-if="settings.mode === 'listen'" class="setting-row">
        <text class="setting-label">词间停顿</text>
        <view class="setting-chips">
          <view
            v-for="opt in listenPauseOptions"
            :key="opt.value"
            class="chip"
            :class="{ on: settings.listenPauseSec === opt.value }"
            @click="setListenPauseSec(opt.value)"
          >
            <text>{{ opt.label }}</text>
          </view>
        </view>
      </view>
      <!-- 读释义：单词（含重播）读完接着读中文释义，闭眼/锁屏也能跟上词义 -->
      <view v-if="settings.mode === 'listen'" class="setting-row">
        <text class="setting-label">读释义</text>
        <view class="setting-chips">
          <view class="chip" :class="{ on: settings.readMeaning }" @click="toggleReadMeaning">
            <text>{{ settings.readMeaning ? '开' : '关' }}</text>
          </view>
        </view>
      </view>
      <text class="settings-hint">当前词库：{{ bankName }} · 待复习 {{ wordList.length }} 词</text>
    </view>

    <!-- 空状态 -->
    <view v-if="wordList.length === 0" class="empty-state">
      <text class="empty-icon">🌙</text>
      <text class="empty-text">当前词库没有待复习单词</text>
      <text class="empty-hint">先去复习页或词库导入单词吧</text>
      <button class="btn-exit" @click="exitFocus">返回</button>
    </view>

    <!-- 标准模式：逐词轮播（释义直接显示，无需点击揭示） -->
    <view v-else-if="settings.mode === 'standard' && currentWord" class="stage">
      <view class="word-stage" @click="onStageTap">
        <text class="focus-word">{{ currentWord.word }}</text>
        <text v-if="currentWord.phonetic" class="focus-phonetic">{{ currentWord.phonetic }}</text>
        <text class="focus-meaning">{{ currentWord.meaning || '暂无释义' }}</text>
        <text v-if="currentWord.example" class="focus-example">{{ currentWord.example }}</text>
      </view>
      <view class="action-row">
        <button class="btn-forget" @click="markCurrent(false)">没记住</button>
        <button class="btn-play" @click.stop="playCurrent(true)">🔊</button>
        <button class="btn-remember" @click="markCurrent(true)">记住了</button>
      </view>
    </view>

    <!-- 连播听词模式：自动连续播放单词发音，屏幕大字显示释义 -->
    <view v-else-if="settings.mode === 'listen' && currentWord" class="stage">
      <view class="word-stage" @click="onStageTap">
        <text class="listen-state">{{ listenPlaying ? '🔊 连播中' : '⏸ 已暂停' }}</text>
        <text class="focus-word">{{ currentWord.word }}</text>
        <text v-if="currentWord.phonetic" class="focus-phonetic">{{ currentWord.phonetic }}</text>
        <text class="focus-meaning">{{ currentWord.meaning || '暂无释义' }}</text>
        <text v-if="currentWord.example" class="focus-example">{{ currentWord.example }}</text>
        <text class="listen-hint">{{ listenHint }}</text>
      </view>
      <view class="listen-controls">
        <button class="listen-btn" @click="listenPrev">⏮</button>
        <button class="listen-btn main" @click="toggleListenPlay">{{ listenPlaying ? '⏸' : '▶' }}</button>
        <button class="listen-btn" @click="listenNext">⏭</button>
      </view>
    </view>

    <!-- 拼写/听写模式 -->
    <view v-else-if="currentWord" class="stage">
      <view class="word-stage">
        <!-- 提示区 -->
        <template v-if="settings.mode === 'spelling'">
          <text class="focus-meaning prompt">{{ currentWord.meaning || '（无释义提示）' }}</text>
          <text v-if="currentWord.phonetic" class="focus-phonetic">{{ currentWord.phonetic }}</text>
        </template>
        <template v-else>
          <view class="audio-trigger" @click="playCurrent(true)">
            <text class="audio-icon">🔊</text>
            <text class="audio-text">{{ played ? '再听一遍' : '点击播放' }}</text>
          </view>
        </template>

        <!-- 作答区 -->
        <template v-if="!checked">
          <input
            class="spell-input"
            v-model="userInput"
            :focus="inputFocus"
            placeholder="输入单词后回车"
            confirm-type="done"
            @confirm="checkAnswer"
          />
          <button class="btn-check" @click="checkAnswer">确定</button>
        </template>

        <!-- 判定结果 -->
        <template v-else>
          <text class="result-icon" :class="{ ok: isCorrect }">{{ isCorrect ? '✓' : '✗' }}</text>
          <text class="focus-word answer">{{ currentWord.word }}</text>
          <text v-if="!isCorrect" class="wrong-input">你的答案：{{ userInput || '（空）' }}</text>
          <button class="btn-next" @click="nextWord">下一个</button>
        </template>
      </view>
    </view>

    <!-- 盲操作轻反馈：双击/摇一摇/耳机标记记住（不用 toast，避免连点排队） -->
    <view v-if="markFlash" class="mark-flash">
      <text>✓ 已记住</text>
    </view>

    <!-- 完成弹层 -->
    <view v-if="showComplete" class="complete-overlay">
      <view class="complete-card">
        <text class="complete-icon">🌙</text>
        <text class="complete-title">本轮完成</text>
        <view class="complete-stats">
          <view class="stat">
            <text class="stat-value">{{ wordList.length }}</text>
            <text class="stat-label">过词</text>
          </view>
          <view class="stat">
            <text class="stat-value ok">{{ rememberCount }}</text>
            <text class="stat-label">记住</text>
          </view>
          <view class="stat">
            <text class="stat-value bad">{{ forgetCount }}</text>
            <text class="stat-label">忘记</text>
          </view>
          <view class="stat">
            <text class="stat-value skip">{{ skipCount }}</text>
            <text class="stat-label">跳过</text>
          </view>
        </view>
        <button class="btn-restart" @click="restart">再来一轮</button>
        <button class="btn-exit wide" @click="exitFocus">退出专注</button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useMobileWords, type MobileWord } from '@/stores/useMobileWords'
import { getTtsAdapter } from '@/adapters/index'
import { speakWord, stopSpeaking, prefetchWords } from '@/utils/word-audio'
import { ListenPlayer } from './listen-play'
import { BackgroundWordPlayer } from './bg-audio-player'
import { normalizeForCompare } from '@/utils/language'
import { buildChineseAudioUrls, splitChineseSpeechText } from '@/utils/youdao-tts'

const wordsStore = useMobileWords()

// 背景图在 pages-tools 分包 static 目录（动态绑定避免构建期当模块解析），由 scripts/render-focus-bg-png.cjs 预渲染
const bgSrc = '/subPackages/pages-tools/static/focus/focus-bg.jpg'

// ========== 设置（持久化到 slowlyrecord-focus-settings） ==========
const SETTINGS_KEY = 'slowlyrecord-focus-settings'

type FocusMode = 'standard' | 'spelling' | 'dictation' | 'listen'

interface FocusSettings {
  mode: FocusMode
  intervalSec: number     // 标准模式自动翻页间隔，0 = 手动
  listenPauseSec: number  // 听词模式词间停顿（秒）
  autoPlay: boolean       // 自动发音
  repeatCount: number     // 每词发音遍数
  speechRate: number      // 发音语速（0.5–2.0）
  readMeaning: boolean    // 听词模式：单词播完后读中文释义
  tapMark: boolean        // 双击屏幕 = 记住（盲操作）
  shakeMark: boolean      // 摇一摇 = 记住（盲操作）
}

const modeOptions: { value: FocusMode; label: string }[] = [
  { value: 'standard', label: '标准' },
  { value: 'spelling', label: '拼写' },
  { value: 'dictation', label: '听写' },
  { value: 'listen', label: '听词' }
]

const intervalOptions = [
  { value: 0, label: '手动' },
  { value: 5, label: '5s' },
  { value: 10, label: '10s' },
  { value: 20, label: '20s' },
  { value: 60, label: '60s' }
]

const listenPauseOptions = [
  { value: 1, label: '1s' },
  { value: 1.5, label: '1.5s' },
  { value: 2, label: '2s' },
  { value: 3, label: '3s' },
  { value: 5, label: '5s' }
]

// 发音遍数与语速档位（语速受微信 playbackRate 0.5–2.0 范围约束）
const repeatOptions = [1, 2, 3, 5, 10, 20]
const speechRateOptions = [
  { value: 0.5, label: '0.5x' },
  { value: 0.75, label: '0.75x' },
  { value: 1, label: '1x' },
  { value: 1.25, label: '1.25x' },
  { value: 1.5, label: '1.5x' },
  { value: 2, label: '2x' }
]

function loadSettings(): FocusSettings {
  try {
    const raw = uni.getStorageSync(SETTINGS_KEY)
    if (raw && typeof raw === 'object') {
      return {
        mode: ['standard', 'spelling', 'dictation', 'listen'].includes(raw.mode) ? raw.mode : 'standard',
        intervalSec: typeof raw.intervalSec === 'number' ? raw.intervalSec : 0,
        // 旧版本用 intervalSec 兼作听词停顿：无独立设置时沿用原秒数，否则取默认 1.5s
        listenPauseSec: typeof raw.listenPauseSec === 'number'
          ? raw.listenPauseSec
          : (typeof raw.intervalSec === 'number' && raw.intervalSec > 0 ? raw.intervalSec : 1.5),
        autoPlay: !!raw.autoPlay,
        repeatCount: typeof raw.repeatCount === 'number' && raw.repeatCount >= 1 ? Math.floor(raw.repeatCount) : 1,
        speechRate: typeof raw.speechRate === 'number' && raw.speechRate >= 0.5 && raw.speechRate <= 2 ? raw.speechRate : 1,
        readMeaning: typeof raw.readMeaning === 'boolean' ? raw.readMeaning : true,
        tapMark: typeof raw.tapMark === 'boolean' ? raw.tapMark : true,
        shakeMark: typeof raw.shakeMark === 'boolean' ? raw.shakeMark : true
      }
    }
  } catch {}
  return { mode: 'standard', intervalSec: 0, listenPauseSec: 1.5, autoPlay: true, repeatCount: 1, speechRate: 1, readMeaning: true, tapMark: true, shakeMark: true }
}

const settings = ref<FocusSettings>(loadSettings())
const showSettings = ref(false)

// 微信胶囊避让：自定义导航下胶囊浮在页面右上角，顶栏按胶囊实际位置留出顶部与右侧空间
const topBarStyle = ref({ paddingTop: '100rpx', paddingRight: '30rpx' })

function measureCapsule() {
  try {
    const rect = uni.getMenuButtonBoundingClientRect?.()
    const winW = uni.getWindowInfo?.().windowWidth || uni.getSystemInfoSync().windowWidth || 375
    if (rect && rect.left > 0 && winW > 0) {
      const toRpx = (px: number) => Math.round((px * 750) / winW)
      topBarStyle.value = {
        paddingTop: `${toRpx(rect.top)}rpx`,
        paddingRight: `${toRpx(winW - rect.left + 8)}rpx`
      }
    }
  } catch { /* 低版本基础库无胶囊 API，沿用默认间距 */ }
}

function persistSettings() {
  try {
    uni.setStorageSync(SETTINGS_KEY, settings.value)
  } catch (e) {
    console.error('保存专注模式设置失败:', e)
  }
}

function setMode(mode: FocusMode) {
  settings.value.mode = mode
  persistSettings()
  applyKeepScreenOn()
  resetWordState()
}

/** 防熄屏只保到非听词模式：听词走后台音频，锁屏/息屏应可继续连播（常亮反而费电且挡住息屏听） */
function applyKeepScreenOn() {
  try {
    uni.setKeepScreenOn({ keepScreenOn: settings.value.mode !== 'listen' })
  } catch {}
}

function setIntervalSec(sec: number) {
  settings.value.intervalSec = sec
  persistSettings()
  scheduleAutoTimer()
}

function setListenPauseSec(sec: number) {
  settings.value.listenPauseSec = sec
  persistSettings()
  // 无需重启播放器：ListenPlayer 每次调度前都会重新读取停顿毫秒数
}

function setRepeatCount(count: number) {
  settings.value.repeatCount = count
  persistSettings()
}

function setSpeechRate(rate: number) {
  settings.value.speechRate = rate
  persistSettings()
}

function toggleAutoPlay() {
  settings.value.autoPlay = !settings.value.autoPlay
  persistSettings()
  if (settings.value.autoPlay) playCurrent()
}

function toggleTapMark() {
  settings.value.tapMark = !settings.value.tapMark
  persistSettings()
}

function toggleReadMeaning() {
  settings.value.readMeaning = !settings.value.readMeaning
  persistSettings()
}

function toggleShakeMark() {
  settings.value.shakeMark = !settings.value.shakeMark
  persistSettings()
}

// ========== 会话状态 ==========
const wordList = ref<MobileWord[]>([])
const currentIndex = ref(0)
const showComplete = ref(false)
const rememberCount = ref(0)
const forgetCount = ref(0)
const skipCount = ref(0)

// 拼写/听写状态
const userInput = ref('')
const checked = ref(false)
const isCorrect = ref(false)
const inputFocus = ref(false)
const played = ref(false)

const currentWord = computed(() => wordList.value[currentIndex.value] || null)

const bankName = computed(() =>
  wordsStore.getBankById(wordsStore.currentBankId)?.name || '默认词库'
)

// ========== 自动翻页定时器 ==========
let autoTimer: ReturnType<typeof setTimeout> | null = null

function clearAutoTimer() {
  if (autoTimer) {
    clearTimeout(autoTimer)
    autoTimer = null
  }
}

/** 标准模式自动翻页：释义恒显示，到点直接切下一词 */
function scheduleAutoTimer() {
  clearAutoTimer()
  if (settings.value.mode !== 'standard' || settings.value.intervalSec <= 0) return
  if (!currentWord.value || showComplete.value) return
  autoTimer = setTimeout(() => {
    advance(false)
  }, settings.value.intervalSec * 1000)
}

// ========== 发音（全局统一入口：播前停旧音、代际防抢跑、预取下一词） ==========
function playCurrent(userInitiated = false, repeatLeft = settings.value.repeatCount) {
  const word = currentWord.value
  if (!word?.word) return
  played.value = true
  const isLastRepeat = repeatLeft <= 1
  speakWord(word.word, {
    userInitiated,
    rate: settings.value.speechRate,
    // 口语句库词条优先播放预合成连读录音（含连读/弱读），失败回退在线 TTS
    speechBankId: word.speechBankId,
    // 还有重播遍数时不预取下一词（重播直接命中本次音频缓存）
    prefetchNext: isLastRepeat ? wordList.value[currentIndex.value + 1]?.word : undefined,
    prefetchNextSpeechBankId: wordList.value[currentIndex.value + 1]?.speechBankId,
    onEnded: () => {
      if (!isLastRepeat) {
        // 遍数未完：同词重播（切词/停止会作废旧代次，此回调不再触发）
        playCurrent(false, repeatLeft - 1)
      } else if (settings.value.autoPlay) {
        // 自动发音开启时，发音自然播完即切下一个并继续发音（自动连播）
        advanceByAudio()
      }
    }
  })
  // 再往后两个词也提前缓存（适配器按本地缓存去重），弱网连播不卡发音
  prefetchWords(wordList.value.slice(currentIndex.value + 2, currentIndex.value + 4))
}

/** 发音播完自动推进：仅标准/听写模式生效，与「自动翻页」定时器相互独立，先到者生效 */
function advanceByAudio() {
  if (!settings.value.autoPlay || showComplete.value) return
  if (settings.value.mode !== 'standard' && settings.value.mode !== 'dictation') return
  clearAutoTimer()
  if (currentIndex.value < wordList.value.length - 1) {
    currentIndex.value++
    resetWordState()
  } else {
    showComplete.value = true
  }
}

// ========== 连播听词（微信端走 BackgroundAudioManager：锁屏/退后台仍可连播，锁屏与耳机按键映射为复习操作；其他平台回退亮屏连播） ==========
let listenPlayer: ListenPlayer | null = null
const listenPlaying = ref(false)
/** 后台音频是否生效（决定听词页提示语与锁屏连播能力） */
const bgAudioActive = ref(false)
/** 单例后台播放器：BackgroundAudioManager 事件全局只能 on 一次，整个页面生命周期复用同一实例 */
let bgPlayer: BackgroundWordPlayer | null = null
/** 最近一次页面主动 stop() 的时间戳：异步 onStop 事件据此豁免对新连播链的误暂停 */
let lastProgrammaticStopAt = 0

const listenHint = computed(() =>
  bgAudioActive.value
    ? '锁屏/耳机可控：⏭=记住，⏮=重听，双击/摇一摇=记住'
    : '亮屏连播，锁屏/退后台会中断'
)

function getOrCreateBgPlayer(): BackgroundWordPlayer | null {
  if (bgPlayer) return bgPlayer.available ? bgPlayer : null
  if (!BackgroundWordPlayer.isSupported()) return null
  const player = new BackgroundWordPlayer(
    {
      // 锁屏/耳机「下一首」= 记住了并切下一词；「上一首」= 重听当前词
      onNext: () => markListenRemember(),
      onPrev: () => {
        if (listenPlayer) {
          listenPlayer.prev()
          listenPlaying.value = listenPlayer.isPlaying
        }
      },
      onPlay: () => {
        // 锁屏/耳机按播放：连播链处于暂停时续播当前词（正常起播也会触发，此时 isPlaying 已为 true 不重复调度）
        if (listenPlayer && !listenPlayer.isPlaying) listenPlayer.resume()
        listenPlaying.value = true
      },
      onPause: () => {
        // 锁屏/耳机暂停必须同时停掉连播调度（词间停顿定时器/推进），否则几秒后音频自动恢复
        listenPlayer?.pause()
        listenPlaying.value = false
      },
      onStop: () => {
        // 系统侧停止（锁屏停止键/被掐断）：连播链一并停下，否则播放失败回退会自动重播。
        // 页面自己调 stop()（重启/退出连播）也会异步触发本事件：1s 内的视作程序化停止，不动新连播链
        if (Date.now() - lastProgrammaticStopAt > 1000) listenPlayer?.pause()
        listenPlaying.value = false
      }
    },
    // 预取与 InnerAudioContext 播放器共用同一份本地缓存清单
    (url) => { try { getTtsAdapter().prefetchAudio?.(url) } catch { /* 静默 */ } }
  )
  if (!player.available) return null
  bgPlayer = player
  return player
}

/** 听词模式「记住」标记：双击/摇一摇/耳机下一首共用；标记 SRS 后切到下一词 */
function markListenRemember() {
  if (settings.value.mode !== 'listen' || showComplete.value) return
  const word = wordList.value[currentIndex.value]
  if (!word) return
  wordsStore.markAsRemembered(word.id)
  rememberCount.value++
  flashMark()
  if (listenPlayer) {
    listenPlayer.next()
    listenPlaying.value = listenPlayer.isPlaying
  }
}

/** 盲操作轻反馈：轻振动 + 屏上短暂「✓ 已记住」（锁屏时以振动为准，亮屏时以浮层为准） */
const markFlash = ref(false)
let markFlashTimer: ReturnType<typeof setTimeout> | null = null

function flashMark() {
  try { uni.vibrateShort?.({ type: 'light' } as any) } catch { /* 不支持振动的平台静默 */ }
  markFlash.value = true
  if (markFlashTimer) clearTimeout(markFlashTimer)
  markFlashTimer = setTimeout(() => { markFlash.value = false }, 600)
}

/** 双击舞台区/摇一摇的快速标记入口：标准模式走完整标记流程，听词模式标记并切词 */
function quickMarkRemember() {
  if (showComplete.value) return
  if (settings.value.mode === 'standard') {
    markCurrent(true)
    flashMark()
  } else if (settings.value.mode === 'listen') {
    markListenRemember()
  }
}

// 双击检测：小程序无双击事件，按时间窗口手动判定；单击不做任何事，避免误触
let lastStageTapAt = 0
function onStageTap() {
  if (!settings.value.tapMark) return
  if (settings.value.mode !== 'standard' && settings.value.mode !== 'listen') return
  const now = Date.now()
  if (now - lastStageTapAt < 350) {
    lastStageTapAt = 0
    quickMarkRemember()
  } else {
    lastStageTapAt = now
  }
}

// 摇一摇检测（仅前台亮屏可用；锁屏请用锁屏/耳机按键）
let lastShakeAt = 0
function onAccelerometer(res: { x: number; y: number; z: number }) {
  if (!settings.value.shakeMark) return
  if (settings.value.mode !== 'standard' && settings.value.mode !== 'listen') return
  if (showComplete.value) return
  const now = Date.now()
  if (now - lastShakeAt < 1000) return
  // 静止时三轴绝对值之和约为 1（重力），明显摇晃时显著超过阈值
  if (Math.abs(res.x) + Math.abs(res.y) + Math.abs(res.z) > 3.2) {
    lastShakeAt = now
    quickMarkRemember()
  }
}

/** 词间停顿：使用听词模式独立的停顿设置 */
function listenPauseMs(): number {
  return settings.value.listenPauseSec * 1000
}

/** 释义读音源单元：去掉词性缩写（n./v./adj. 等）后按句切段，每段给一条中文 TTS 回退链 */
function buildMeaningUnits(index: number): string[][] {
  if (!settings.value.readMeaning) return []
  const raw = wordList.value[index]?.meaning || ''
  // 去词性缩写：段首/分隔符后的 "n." "v." "adj." "prep." 等不读出来
  const text = raw.replace(/(^|[；;，,。！？\s])[a-zA-Z]{1,8}\.\s*/g, '$1').trim()
  if (!text) return []
  return splitChineseSpeechText(text).map(seg => buildChineseAudioUrls(seg))
}

function startListen() {
  if (settings.value.mode !== 'listen' || showComplete.value || wordList.value.length === 0) return
  stopListenPlayer()
  // 优先后台音频（锁屏可连播、锁屏/耳机按键可控）；不支持的平台回退亮屏连播
  const bg = getOrCreateBgPlayer()
  bgAudioActive.value = !!bg
  listenPlayer = new ListenPlayer(
    wordList.value.map(w => w.word),
    bg || getTtsAdapter(),
    listenPauseMs,
    {
      onIndexChange: (i) => { currentIndex.value = i },
      onFinished: () => {
        listenPlaying.value = false
        showComplete.value = true
      },
      onError: () => {
        // 连播失败静默跳过该词（降噪：不弹 toast），只留控制台告警便于排查
        console.warn('ListenPlayer: 单词发音全部音源失败，已跳过')
      }
    },
    wordsStore.currentLanguage,
    () => settings.value.speechRate,
    () => settings.value.repeatCount,
    wordList.value.map(w => w.speechBankId),
    buildMeaningUnits
  )
  listenPlaying.value = true
  listenPlayer.start()
}

function stopListenPlayer() {
  if (listenPlayer) {
    listenPlayer.destroy()
    listenPlayer = null
  }
  // 后台音频也要收掉（InnerAudioContext 由 getTtsAdapter().stop() 负责，两者互不影响）。
  // 程序化 stop 的异步 onStop 事件可能落在下一条连播链上，记录时间戳供事件侧豁免
  if (bgPlayer) lastProgrammaticStopAt = Date.now()
  bgPlayer?.stop()
  listenPlaying.value = false
}

function toggleListenPlay() {
  if (!listenPlayer) {
    startListen()
    return
  }
  if (listenPlaying.value) {
    listenPlayer.pause()
    try { getTtsAdapter().stop() } catch { /* 静默 */ }
    // 后台音频用 pause 而非 stop：保留锁屏控制条，从锁屏/耳机可直接恢复
    bgPlayer?.pause()
    listenPlaying.value = false
  } else {
    listenPlaying.value = true
    listenPlayer.resume()
  }
}

function listenPrev() {
  if (!listenPlayer) return
  listenPlayer.prev()
  listenPlaying.value = listenPlayer.isPlaying
}

function listenNext() {
  if (!listenPlayer) {
    startListen()
    return
  }
  listenPlayer.next()
  listenPlaying.value = listenPlayer.isPlaying
}

// ========== 流程控制 ==========
function resetWordState() {
  // 切词/切模式先停旧朗读，并作废旧词待完成的音源回退
  stopSpeaking()
  userInput.value = ''
  checked.value = false
  isCorrect.value = false
  played.value = false
  clearAutoTimer()
  stopListenPlayer()
  if (settings.value.mode === 'listen') {
    // 进入/重开听词：从当前下标自动连播
    nextTick(() => startListen())
    return
  }
  nextTick(() => {
    if (settings.value.mode !== 'standard') {
      inputFocus.value = true
    }
  })
  if (settings.value.mode === 'standard') {
    scheduleAutoTimer()
    if (settings.value.autoPlay) playCurrent()
  } else if (settings.value.mode === 'dictation' && settings.value.autoPlay) {
    playCurrent()
  }
}

/** 标准模式：记住/没记住，走 store 的 SRS 标准 */
function markCurrent(remembered: boolean) {
  const word = currentWord.value
  if (!word) return
  if (remembered) {
    wordsStore.markAsRemembered(word.id)
    rememberCount.value++
  } else {
    wordsStore.markAsForgotten(word.id)
    forgetCount.value++
  }
  advance(true)
}

/** 拼写/听写判定 */
function checkAnswer() {
  const word = currentWord.value
  if (!word || checked.value) return
  const profile = wordsStore.currentProfile
  const answer = normalizeForCompare(word.word, profile)
  const input = normalizeForCompare(userInput.value, profile)
  isCorrect.value = input === answer
  checked.value = true
  clearAutoTimer()
  if (isCorrect.value) {
    wordsStore.markAsRemembered(word.id)
    rememberCount.value++
    // 答对短暂停留后自动进入下一个
    if (settings.value.intervalSec > 0) {
      autoTimer = setTimeout(() => advance(true), 1200)
    }
  } else {
    wordsStore.markAsForgotten(word.id)
    forgetCount.value++
    if (settings.value.intervalSec > 0) {
      autoTimer = setTimeout(() => advance(true), 3000)
    }
  }
}

/** 进入下一个词；走完一轮弹出完成层。markDone 表示本词 SRS 已落盘 */
function advance(markDone: boolean) {
  if (!markDone) {
    // 自动翻页超时：记为"跳过"，不写 SRS 判定、不计入忘记
    skipCount.value++
  }
  if (currentIndex.value < wordList.value.length - 1) {
    currentIndex.value++
    resetWordState()
  } else {
    clearAutoTimer()
    showComplete.value = true
  }
}

function nextWord() {
  if (currentIndex.value < wordList.value.length - 1) {
    currentIndex.value++
    resetWordState()
  } else {
    clearAutoTimer()
    showComplete.value = true
  }
}

function restart() {
  showComplete.value = false
  currentIndex.value = 0
  rememberCount.value = 0
  forgetCount.value = 0
  skipCount.value = 0
  // 重新拉取最新的待复习列表（本轮标记会改变队列）
  wordList.value = [...wordsStore.reviewWords]
  if (wordList.value.length === 0) {
    uni.showToast({ title: '没有待复习单词了', icon: 'none' })
    exitFocus()
    return
  }
  resetWordState()
}

function exitFocus() {
  clearAutoTimer()
  stopListenPlayer()
  try { getTtsAdapter().stop() } catch { /* 静默 */ }
  uni.navigateBack()
}

// ========== 生命周期 ==========
onMounted(async () => {
  // 防熄屏（听词模式除外：留给后台音频，允许息屏连播）
  applyKeepScreenOn()
  // 摇一摇 = 记住（盲操作；页面卸载时注销）
  try { uni.onAccelerometerChange?.(onAccelerometer) } catch {}
  measureCapsule()
  // 数据由首页加载，这里兜底调用（幂等）
  await wordsStore.loadWords()
  wordList.value = [...wordsStore.reviewWords]
  resetWordState()
})

onUnmounted(() => {
  clearAutoTimer()
  stopListenPlayer()
  try { getTtsAdapter().stop() } catch { /* 静默 */ }
  try { uni.offAccelerometerChange?.(onAccelerometer) } catch {}
  if (markFlashTimer) clearTimeout(markFlashTimer)
  try {
    uni.setKeepScreenOn({ keepScreenOn: false })
  } catch {}
})
</script>

<style scoped>
.focus-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  color: #eaf1ea;
  /* 建立层叠上下文，让固定背景图压在本页底色之上、内容之下 */
  position: relative;
  z-index: 0;
}

.focus-bg {
  position: fixed;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  z-index: -1;
  pointer-events: none;
}

/* 顶栏 */
.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  /* 顶部与右侧间距由内联 style 按胶囊位置注入，这里只管左侧与底部 */
  padding: 0 30rpx 10rpx;
}

.exit-btn {
  font-size: 28rpx;
  color: rgba(234, 241, 234, 0.9);
  padding: 10rpx 20rpx;
}

.progress-text {
  font-size: 26rpx;
  color: rgba(234, 241, 234, 0.85);
}

.settings-btn {
  font-size: 28rpx;
  color: rgba(234, 241, 234, 0.9);
  padding: 10rpx 20rpx;
}

/* 设置面板 */
.settings-panel {
  margin: 10rpx 30rpx 0;
  background: rgba(16, 36, 30, 0.72);
  border: 1rpx solid rgba(131, 197, 168, 0.18);
  border-radius: 16rpx;
  padding: 24rpx;
}

.setting-row {
  display: flex;
  align-items: center;
  margin-bottom: 20rpx;
}

.setting-row:last-of-type {
  margin-bottom: 0;
}

.setting-label {
  width: 140rpx;
  font-size: 26rpx;
  color: rgba(234, 241, 234, 0.92);
  flex-shrink: 0;
}

.setting-chips {
  display: flex;
  gap: 14rpx;
  flex-wrap: wrap;
}

.chip {
  padding: 8rpx 26rpx;
  border-radius: 28rpx;
  background: rgba(255, 255, 255, 0.16);
  font-size: 24rpx;
  color: rgba(234, 241, 234, 0.9);
}

.chip.on {
  background: #83c5a8;
  color: #10241e;
  font-weight: bold;
}

.settings-hint {
  display: block;
  margin-top: 20rpx;
  font-size: 22rpx;
  color: rgba(234, 241, 234, 0.7);
}

/* 空状态 */
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60rpx;
}

.empty-icon {
  font-size: 90rpx;
}

.empty-text {
  font-size: 34rpx;
  color: rgba(234, 241, 234, 0.95);
  margin-top: 30rpx;
}

.empty-hint {
  font-size: 26rpx;
  color: rgba(234, 241, 234, 0.8);
  margin-top: 16rpx;
}

.btn-exit {
  margin-top: 50rpx;
  background: rgba(255, 255, 255, 0.16);
  color: #eaf1ea;
  border-radius: 44rpx;
  height: 84rpx;
  font-size: 28rpx;
  border: 1rpx solid rgba(131, 197, 168, 0.35);
  padding: 0 60rpx;
}

.btn-exit.wide {
  width: 100%;
  margin-top: 20rpx;
}

/* 主舞台 */
.stage {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 30rpx;
}

.word-stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 55vh;
  text-align: center;
  padding: 48rpx 32rpx;
  border: 1rpx solid rgba(131, 197, 168, 0.16);
  border-radius: 28rpx;
  box-shadow: inset 0 0 80rpx rgba(131, 197, 168, 0.045);
}

.focus-word {
  font-size: 88rpx;
  font-weight: bold;
  color: #f2f7f3;
  word-break: break-all;
}

.focus-word.answer {
  font-size: 64rpx;
  color: #8fd4b5;
}

.focus-phonetic {
  font-size: 32rpx;
  color: rgba(143, 212, 181, 0.95);
  margin-top: 24rpx;
  font-family: 'Times New Roman', serif;
}

.focus-meaning {
  font-size: 40rpx;
  color: rgba(234, 241, 234, 0.96);
  margin-top: 36rpx;
  line-height: 1.6;
}

.focus-meaning.prompt {
  color: #f2f7f3;
}

.focus-example {
  font-size: 28rpx;
  color: rgba(234, 241, 234, 0.82);
  margin-top: 30rpx;
  font-style: italic;
  line-height: 1.5;
}

.focus-hint {
  font-size: 26rpx;
  color: rgba(234, 241, 234, 0.75);
  margin-top: 70rpx;
}

/* 拼写/听写 */
.audio-trigger {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40rpx;
}

.audio-icon {
  font-size: 100rpx;
}

.audio-text {
  font-size: 26rpx;
  color: rgba(234, 241, 234, 0.8);
  margin-top: 16rpx;
}

.spell-input {
  width: 70%;
  height: 96rpx;
  margin-top: 60rpx;
  background: rgba(255, 255, 255, 0.16);
  border: 1rpx solid rgba(131, 197, 168, 0.3);
  border-radius: 16rpx;
  padding: 0 30rpx;
  font-size: 40rpx;
  color: #f2f7f3;
  text-align: center;
}

.btn-check {
  margin-top: 40rpx;
  background: #83c5a8;
  color: #10241e;
  border-radius: 44rpx;
  height: 84rpx;
  font-size: 30rpx;
  border: none;
  padding: 0 80rpx;
}

.result-icon {
  font-size: 80rpx;
  margin-top: 40rpx;
}

.result-icon.ok {
  color: #83c5a8;
}

.result-icon.bad,
.wrong-input {
  color: #d9a29c;
}

.wrong-input {
  font-size: 26rpx;
  margin-top: 20rpx;
}

.btn-next {
  margin-top: 50rpx;
  background: rgba(255, 255, 255, 0.18);
  color: #f2f7f3;
  border-radius: 44rpx;
  height: 84rpx;
  font-size: 30rpx;
  border: 1rpx solid rgba(131, 197, 168, 0.3);
  padding: 0 90rpx;
}

/* 标准模式操作按钮 */
.action-row {
  display: flex;
  gap: 20rpx;
  align-items: center;
  justify-content: center;
  padding-bottom: 40rpx;
}

.btn-forget,
.btn-remember {
  flex: 1;
  max-width: 260rpx;
  height: 92rpx;
  border-radius: 46rpx;
  font-size: 30rpx;
  border: none;
}

.btn-forget {
  background: rgba(192, 143, 138, 0.3);
  color: #d9a29c;
  border: 1rpx solid rgba(217, 162, 156, 0.8);
}

.btn-remember {
  background: rgba(131, 197, 168, 0.3);
  color: #8fd4b5;
  border: 1rpx solid rgba(143, 212, 181, 0.8);
}

.btn-play {
  width: 92rpx;
  height: 92rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.18);
  border: 1rpx solid rgba(131, 197, 168, 0.28);
  color: #f2f7f3;
  font-size: 36rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 92rpx;
  padding: 0;
}

/* 连播听词 */
.listen-state {
  font-size: 26rpx;
  color: rgba(143, 212, 181, 0.95);
  margin-bottom: 30rpx;
}

.listen-hint {
  font-size: 22rpx;
  color: rgba(234, 241, 234, 0.65);
  margin-top: 50rpx;
}

.listen-controls {
  display: flex;
  gap: 40rpx;
  align-items: center;
  justify-content: center;
  padding-bottom: 60rpx;
}

.listen-btn {
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.18);
  border: 1rpx solid rgba(131, 197, 168, 0.28);
  color: #f2f7f3;
  font-size: 36rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 96rpx;
  padding: 0;
}

.listen-btn.main {
  width: 120rpx;
  height: 120rpx;
  line-height: 120rpx;
  font-size: 48rpx;
  background: #83c5a8;
  color: #10241e;
}

/* 盲操作轻反馈：屏上短暂「✓ 已记住」（锁屏时以振动反馈为主） */
.mark-flash {
  position: fixed;
  left: 50%;
  top: 36%;
  transform: translate(-50%, -50%);
  z-index: 900;
  padding: 18rpx 44rpx;
  border-radius: 44rpx;
  background: rgba(131, 197, 168, 0.92);
  color: #10241e;
  font-size: 30rpx;
  font-weight: bold;
  pointer-events: none;
  box-shadow: 0 8rpx 30rpx rgba(0, 0, 0, 0.3);
}

/* 完成弹层 */
.complete-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(8, 20, 16, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.complete-card {
  background: #1a332b;
  border-radius: 24rpx;
  padding: 60rpx;
  text-align: center;
  width: 560rpx;
}

.complete-icon {
  font-size: 80rpx;
}

.complete-title {
  font-size: 40rpx;
  font-weight: bold;
  color: #eaf1ea;
  margin-top: 20rpx;
  display: block;
}

.complete-stats {
  display: flex;
  justify-content: center;
  gap: 40rpx;
  margin: 40rpx 0;
}

.stat {
  text-align: center;
}

.stat-value {
  font-size: 48rpx;
  font-weight: bold;
  color: #eaf1ea;
  display: block;
}

.stat-value.ok {
  color: #83c5a8;
}

.stat-value.bad {
  color: #d9a29c;
}

.stat-value.skip {
  color: rgba(234, 241, 234, 0.7);
}

.stat-label {
  font-size: 24rpx;
  color: rgba(234, 241, 234, 0.75);
  margin-top: 8rpx;
  display: block;
}

.btn-restart {
  background: #83c5a8;
  color: #10241e;
  border-radius: 44rpx;
  height: 88rpx;
  font-size: 30rpx;
  border: none;
  width: 100%;
}
</style>

<style>
/* 页面级底色兜底：背景图未就绪时保持深色沉浸（scoped 样式命中不了 page 元素） */
page {
  background: #10241e;
}
</style>
