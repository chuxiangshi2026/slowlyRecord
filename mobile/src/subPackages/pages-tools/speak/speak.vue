<template>
  <view class="speak-page" :class="themeClass">
    <AppBackground />
    <view class="intro">
      <text class="intro-title">🗣️ AI 口语翻译</text>
      <text class="intro-desc">{{ currentMode.desc }}</text>
    </view>

    <!-- 模式切换：口语翻译（说自己想说的）/ 口语回复（回应对方说的） -->
    <view class="mode-tabs">
      <view
        v-for="m in modeList"
        :key="m.value"
        class="mode-tab"
        :class="{ on: mode === m.value }"
        @click="mode = m.value"
      >
        <text>{{ m.label }}</text>
      </view>
    </view>

    <view class="input-card">
      <textarea
        v-model="input"
        class="input-area"
        :placeholder="currentMode.placeholder"
        :maxlength="200"
        auto-height
      />
      <view class="example-chips">
        <view
          v-for="ex in currentMode.examples"
          :key="ex"
          class="ex-chip"
          @click="input = ex"
        >
          <text>{{ ex }}</text>
        </view>
      </view>
      <button class="btn-generate" :disabled="generating" @click="generate">
        {{ generating ? '生成中…' : currentMode.button }}
      </button>
    </view>

    <view v-if="replyEn" class="reply-card">
      <text class="reply-label">地道口语</text>
      <text class="reply-en" @click="speakReply">{{ replyEn }}</text>
      <text v-if="replyZh" class="reply-zh">{{ replyZh }}</text>
      <view class="reply-actions">
        <view class="action-chip" @click="speakReply"><text>🔊 再读一遍</text></view>
        <view class="action-chip" @click="generate"><text>🔁 换一句</text></view>
        <view class="action-chip" @click="copyReply"><text>📋 复制</text></view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onUnload } from '@dcloudio/uni-app'
import { askAi } from '@/utils/quick-translate'
import { speakWord, stopSpeaking } from '@/utils/word-audio'

type SpeakMode = 'translate' | 'reply'

const FORMAT_RULE =
  '严格按以下两行格式输出，不要输出其他任何内容：\nEN: <地道英文口语>\nZH: <中文意思>'

const MODES: Record<SpeakMode, {
  label: string
  desc: string
  placeholder: string
  button: string
  prompt: string
  examples: string[]
}> = {
  // 口语翻译：把自己想说的中文（或中式英文）译成母语者日常口语
  translate: {
    label: '口语翻译',
    desc: '输入你想说的中文，AI 翻译成地道英文口语并自动朗读，照着说即可。',
    placeholder: '例如：这家餐厅的菜真不错',
    button: '翻译成口语',
    prompt:
      '你是英语口语翻译官。把用户输入翻译成地道、自然的英文口语，像母语者日常聊天那样说，简短一两句，避免书面语；输入若是英文则改写成更地道的口语。\n' + FORMAT_RULE,
    examples: ['这家餐厅的菜真不错', '我迷路了，能帮我一下吗', '价格能便宜一点吗'],
  },
  // 口语回复：对方说了一句话（中文或英文），用英文口语自然回应
  reply: {
    label: '口语回复',
    desc: '输入对方说的话（中文或英文），AI 用地道英文口语帮你回应并自动朗读。',
    placeholder: '例如：周末要不要一起去看电影？',
    button: '生成口语回复',
    prompt:
      '你是英语口语教练。用户会给你一句别人对他说的话（中文或英文）。请给出一句地道、自然的英文口语回复，像母语者日常聊天那样简短（一两句），避免书面语。\n' + FORMAT_RULE,
    examples: ['周末要不要一起去看电影？', "How's it going?", '好久不见，最近怎么样？'],
  },
}

const modeList = [
  { value: 'translate' as SpeakMode, label: '口语翻译' },
  { value: 'reply' as SpeakMode, label: '口语回复' },
]

const mode = ref<SpeakMode>('translate')
const currentMode = computed(() => MODES[mode.value])

const input = ref('')
const generating = ref(false)
const replyEn = ref('')
const replyZh = ref('')

onUnload(() => stopSpeaking())

/** 解析 AI 输出：优先 EN:/ZH: 标记，退化取首个非空行当英文 */
function parseReply(text: string): { en: string; zh: string } {
  const en = text.match(/EN:\s*(.+)/i)?.[1]?.trim() || ''
  const zh = text.match(/ZH:\s*(.+)/i)?.[1]?.trim() || ''
  if (en) return { en, zh }
  const firstLine = text.split('\n').map((l) => l.trim()).find(Boolean) || ''
  return { en: firstLine, zh: '' }
}

async function generate() {
  const text = input.value.trim()
  if (!text) {
    uni.showToast({ title: mode.value === 'translate' ? '先输入想说的话' : '先输入对方说的话', icon: 'none' })
    return
  }
  if (generating.value) return
  generating.value = true
  try {
    const res = await askAi(currentMode.value.prompt, text)
    if (!res.ok) {
      uni.showModal({ title: '生成失败', content: res.error, showCancel: false })
      return
    }
    const { en, zh } = parseReply(res.text)
    if (!en) {
      uni.showToast({ title: '未解析到英文，请重试', icon: 'none' })
      return
    }
    replyEn.value = en
    replyZh.value = zh
    speakReply()
  } finally {
    generating.value = false
  }
}

function speakReply() {
  if (!replyEn.value) return
  // 明确按英语发音链播放（dictvoice → 谷歌 TTS），与当前词库语言无关
  speakWord(replyEn.value, { language: 'en', userInitiated: true })
}

function copyReply() {
  uni.setClipboardData({
    data: replyZh.value ? `${replyEn.value}\n${replyZh.value}` : replyEn.value,
  })
}
</script>

<style scoped>
.speak-page {
  min-height: 100vh;
  background: var(--sr-bg);
  padding: 24rpx;
}

.intro {
  padding: 16rpx 8rpx 20rpx;
}
.intro-title {
  font-size: 36rpx;
  font-weight: bold;
  color: var(--sr-text);
  display: block;
}
.intro-desc {
  font-size: 24rpx;
  color: var(--sr-text-3);
  margin-top: 10rpx;
  display: block;
  line-height: 1.6;
}

.mode-tabs {
  display: flex;
  gap: 12rpx;
  background: var(--sr-card-2);
  border-radius: 32rpx;
  padding: 6rpx;
  margin-bottom: 24rpx;
}
.mode-tab {
  flex: 1;
  text-align: center;
  font-size: 26rpx;
  color: var(--sr-text-2);
  padding: 14rpx 0;
  border-radius: 26rpx;
}
.mode-tab.on {
  background: var(--sr-primary);
  color: var(--sr-on-primary);
  font-weight: bold;
}

.input-card {
  background: var(--sr-card);
  border-radius: 20rpx;
  padding: 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
}
.input-area {
  width: 100%;
  min-height: 120rpx;
  font-size: 30rpx;
  color: var(--sr-text);
  background: var(--sr-card-2);
  border-radius: 12rpx;
  padding: 20rpx;
  box-sizing: border-box;
}
.example-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 16rpx;
}
.ex-chip {
  font-size: 22rpx;
  color: var(--sr-text-2);
  background: var(--sr-card-2);
  border: 1rpx solid var(--sr-border);
  border-radius: 24rpx;
  padding: 6rpx 18rpx;
}
.btn-generate {
  margin-top: 24rpx;
  height: 88rpx;
  line-height: 88rpx;
  border-radius: 44rpx;
  background: var(--sr-primary);
  color: var(--sr-on-primary);
  font-size: 30rpx;
  border: none;
}
.btn-generate[disabled] {
  opacity: 0.6;
}

.reply-card {
  margin-top: 24rpx;
  background: var(--sr-card);
  border-radius: 20rpx;
  padding: 32rpx 28rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
  border-left: 6rpx solid var(--sr-primary);
}
.reply-label {
  font-size: 22rpx;
  color: var(--sr-primary);
  display: block;
  margin-bottom: 12rpx;
}
.reply-en {
  font-size: 38rpx;
  font-weight: bold;
  color: var(--sr-text);
  line-height: 1.5;
  display: block;
}
.reply-zh {
  font-size: 26rpx;
  color: var(--sr-text-3);
  margin-top: 14rpx;
  display: block;
  line-height: 1.6;
}
.reply-actions {
  display: flex;
  gap: 16rpx;
  margin-top: 28rpx;
}
.action-chip {
  font-size: 24rpx;
  color: var(--sr-primary);
  background: var(--sr-primary-bg);
  border-radius: 28rpx;
  padding: 10rpx 24rpx;
}
</style>
