<template>
  <div>
    <div class="titles">
      <div class="setting-item">
        <div class="content">加入单词后退出插件</div>
        <el-switch class="shorcut-desc"
                   v-model="wordsStore.pluginStatus"
                   inline-prompt
                   size="large"
                   active-text="开"
                   inactive-text="关"
                   @change="onCloseAfterAddSwitchChange"
        />
      </div>
      <div class="setting-item">
        <div class="content">界面字号</div>
        <el-radio-group :model-value="uiStore.uiZoom"
                        @update:model-value="(v: string | number | boolean | undefined) => uiStore.applyUiZoom(Number(v) || 1)">
          <el-radio-button :value="0.9">小</el-radio-button>
          <el-radio-button :value="1">标准</el-radio-button>
          <el-radio-button :value="1.15">大</el-radio-button>
        </el-radio-group>
      </div>
    </div>
    <div>
      <!-- 当前翻译引擎卡片：第一屏只呈现当前引擎与免配置状态，切换走右侧下拉 -->
      <div class="engine-card">
        <div class="engine-card-main">
          <span class="engine-card-name">{{ currentEngineLabel }}</span>
          <span class="engine-card-hint">{{ currentEngineHint }}</span>
        </div>
        <el-select class="shorcut-desc" :model-value="wordsStore.currentTranslationPlatform"
                   @update:model-value="(val: TranslationPlatform) => wordsStore.setTranslationPlatform(val)"
                   placeholder="切换引擎"
                   style="width:150px">
          <el-option
              v-for="item in options"
              :key="item.value"
              :label="translationOptionLabel(item.value, item.label)"
              :value="item.value"
          />
        </el-select>
      </div>
    </div>
    <div>
      <div class="setting-item">
        <div class="content">ocr图片识别引擎</div>
        <el-select class="shorcut-desc" :model-value="wordsStore.currentOcrPlatform"
                   @update:model-value="(val: OcrPlatform) => wordsStore.setOcrPlatform(val)"
                   placeholder="选择"
                   style="width:100px">
          <el-option
              v-for="item in ocrOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
          />
        </el-select>
      </div>
    </div>

    <div>
      <div class="setting-item">
        <div class="content">记忆牢固度</div>
        <el-select class="shorcut-desc" :model-value="wordsStore.memoryFirmness"
                   @update:model-value="wordsStore.setMemoryFirmness"
                   placeholder="选择"
                   style="width:100px">
          <el-option
              v-for="item in memoryFirmnessOptions"
              :key="item"
              :label="item"
              :value="item"
          />
        </el-select>
      </div>
    </div>

    <div>
      <div class="setting-item">
        <div class="content">选中单词自动发音</div>
        <el-switch class="shorcut-desc"
                   :model-value="wordsStore.autoSpeak"
                   inline-prompt
                   size="large"
                   active-text="开"
                   inactive-text="关"
                   @update:model-value="wordsStore.setAutoSpeak"
        />
      </div>
    </div>

    <div>
      <div class="setting-item">
        <div class="content">新词加入</div>
        <el-radio-group class="shorcut-desc"
                        :model-value="wordsStore.addWordTarget"
                        @update:model-value="(v: string | number | boolean | undefined) => wordsStore.setAddWordTarget(v === 'default' ? 'default' : 'current')">
          <el-radio-button value="current">当前词库</el-radio-button>
          <el-radio-button value="default">默认词库</el-radio-button>
        </el-radio-group>
      </div>
    </div>

    <!-- 定时提醒：依赖 uTools 8.0+ 定时任务 API，低版本/其他平台隐藏（原有打开时提醒不受影响） -->
    <template v-if="scheduleSupported">
      <div>
        <div class="setting-item">
          <div class="content">定时复习提醒</div>
          <el-switch class="shorcut-desc"
                     :model-value="wordsStore.scheduleReminder.review"
                     inline-prompt
                     size="large"
                     active-text="开"
                     inactive-text="关"
                     @update:model-value="(v: string | number | boolean | undefined) => onScheduleToggle('review', v)"
          />
        </div>
        <div class="setting-item schedule-times" v-if="wordsStore.scheduleReminder.review">
          <el-checkbox-group
              :model-value="wordsStore.scheduleReminder.reviewTimes || ['09:00', '21:00']"
              :min="1"
              @update:model-value="onReviewTimesChange">
            <el-checkbox v-for="t in reviewTimeOptions" :key="t" :value="t">{{ t }}</el-checkbox>
          </el-checkbox-group>
        </div>
      </div>
      <div>
        <div class="setting-item">
          <div class="content">防断签提醒</div>
          <el-switch class="shorcut-desc"
                     :model-value="wordsStore.scheduleReminder.signin"
                     inline-prompt
                     size="large"
                     active-text="开"
                     inactive-text="关"
                     @update:model-value="(v: string | number | boolean | undefined) => onScheduleToggle('signin', v)"
          />
        </div>
        <div class="setting-item schedule-times" v-if="wordsStore.scheduleReminder.signin">
          <el-checkbox-group
              :model-value="signinSelectedTimes"
              :min="1"
              @update:model-value="onSigninTimesChange">
            <el-checkbox v-for="t in signinTimeOptions" :key="t" :value="t">{{ t }}</el-checkbox>
          </el-checkbox-group>
        </div>
      </div>
      <div>
        <div class="setting-item">
          <div class="content">定时自动备份</div>
          <el-switch class="shorcut-desc"
                     :model-value="!!wordsStore.scheduleReminder.sync"
                     inline-prompt
                     size="large"
                     active-text="开"
                     inactive-text="关"
                     @update:model-value="(v: string | number | boolean | undefined) => onScheduleToggle('sync', v)"
          />
        </div>
        <div class="setting-item schedule-times" v-if="wordsStore.scheduleReminder.sync">
          <span class="schedule-sync-hint">每天 22:00 静默备份到 WebDAV{{ syncConfigured ? '' : '（请先在「同步」面板配置 WebDAV 凭据，否则备份会被跳过）' }}</span>
        </div>
      </div>
    </template>

    <!-- 问题反馈：置于设置末尾的醒目卡片入口（主色按钮），鼓励用户反馈 -->
    <div class="feedback-card">
      <div class="feedback-card-main">
        <div class="feedback-card-title">遇到问题或有建议？</div>
        <div class="feedback-card-desc">欢迎反馈，内容经匿名通道提交，仅用于修复问题</div>
      </div>
      <el-button type="primary" @click="feedbackVisible = true">
        <el-icon style="margin-right: 4px;"><ChatDotRound/></el-icon>反馈问题
      </el-button>
    </div>

    <!-- 匿名统计开关：脚注行，文字在左（超宽自动换行）、对钩在行末（勾选=参与，与其他开关同向） -->
    <div class="stats-optout">
      <span class="stats-optout-text">匿名使用统计（仅统计功能使用与版本分布，不含词库内容与个人信息，用于改进插件）</span>
      <el-checkbox class="stats-optout-check" :model-value="statsOptIn" size="small"
                   aria-label="匿名使用统计"
                   @update:model-value="onStatsOptInChange"/>
    </div>

    <el-dialog v-model="feedbackVisible" title="问题反馈" width="420px" append-to-body>
      <el-input v-model="feedbackText" type="textarea" :rows="4" maxlength="500" show-word-limit
                placeholder="描述遇到的问题或建议（500 字以内）"/>
      <el-input v-model="feedbackContact" maxlength="100" style="margin-top: 12px"
                placeholder="联系方式（可选，方便回复时填写邮箱/QQ/微信）"/>
      <template #footer>
        <el-button @click="feedbackVisible = false">取消</el-button>
        <el-button type="primary" :loading="feedbackSubmitting" @click="onSubmitFeedback">提交</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import {computed, ref} from 'vue'
import {useWordsStore} from "@/stores/words.ts";
import {useUiStore} from "@/stores/ui.ts";
import type {OcrPlatform, TranslationPlatform} from "@/types/words";
import {AppInfo} from "@/config.ts";
import {isUtools} from "@/adapters/platform";
import {isStatsExcluded, setStatsExcluded, submitFeedback} from "@/utils/stats.ts";
import {ElMessage} from 'element-plus'
import {isScheduleSupported, applyScheduleSetting, applyScheduleTimes, REVIEW_TIME_OPTIONS, SIGNIN_TIME_OPTIONS} from "@/utils/schedule-reminder.ts";
import type {ReminderKind} from "@/utils/schedule-reminder.ts";
import {useSyncStore} from "@/stores/sync";

const wordsStore = useWordsStore();
const uiStore = useUiStore();
const syncStore = useSyncStore();

// 定时任务能力探测：仅 uTools 8.0+ 显示定时提醒开关
const scheduleSupported = isScheduleSupported();
const reviewTimeOptions = REVIEW_TIME_OPTIONS;
// 旧数据单时间点 signinTime 若不在新选项中，追加显示以保留用户原选择（改动后即被 signinTimes 取代）
const signinTimeOptions = computed(() => {
  const legacy = wordsStore.scheduleReminder.signinTime;
  return legacy && !SIGNIN_TIME_OPTIONS.includes(legacy)
    ? [...SIGNIN_TIME_OPTIONS, legacy].sort()
    : SIGNIN_TIME_OPTIONS;
});
// 防断签已选时间点：优先 signinTimes，旧字段 signinTime 兜底，缺省全选
const signinSelectedTimes = computed(() => {
  const pref = wordsStore.scheduleReminder;
  return pref.signinTimes?.length ? pref.signinTimes : pref.signinTime ? [pref.signinTime] : SIGNIN_TIME_OPTIONS;
});
// 自动备份依赖 WebDAV 凭据，未配置时提示用户先去同步面板配置
const syncConfigured = computed(() => syncStore.webdavConfigured);

// 开关切换：先落意向，再即时发起系统创建请求/删除任务
const onScheduleToggle = (kind: ReminderKind, val: string | number | boolean | undefined) => {
  const enabled = !!val
  wordsStore.setScheduleReminder({ [kind]: enabled })
  void applyScheduleSetting(kind, enabled)
}

// 修改提醒时间点：落意向后，任务开着时重建（删旧建新，会再弹一次系统授权框）
const onReviewTimesChange = (val: any) => {
  wordsStore.setScheduleReminder({ reviewTimes: [...(val as string[])].sort() })
  void applyScheduleTimes('review')
}
const onSigninTimesChange = (val: any) => {
  wordsStore.setScheduleReminder({ signinTimes: [...(val as string[])].sort() })
  void applyScheduleTimes('signin')
}

const onCloseAfterAddSwitchChange = () => {
  wordsStore.setClosePlugin(wordsStore.pluginStatus)
}

// 匿名使用统计开关：默认开；关闭即写自我排除标记，立即生效（生产环境无控制台，这是唯一排除入口）
const statsOptIn = ref(!isStatsExcluded())
const onStatsOptInChange = (v: string | number | boolean | undefined) => {
  const on = !!v
  setStatsExcluded(!on)
  statsOptIn.value = on
}

// 问题反馈：经 umami 事件通道提交（feedback.submit），用户主动动作不受统计开关限制
const feedbackVisible = ref(false)
const feedbackText = ref('')
const feedbackContact = ref('')
const feedbackSubmitting = ref(false)
const onSubmitFeedback = async () => {
  if (!feedbackText.value.trim()) {
    ElMessage.warning('请先填写反馈内容')
    return
  }
  feedbackSubmitting.value = true
  try {
    const ok = await submitFeedback(feedbackText.value, feedbackContact.value)
    if (ok) {
      ElMessage.success('已提交，感谢反馈')
      feedbackVisible.value = false
      feedbackText.value = ''
      feedbackContact.value = ''
    } else {
      ElMessage.warning('提交失败，请稍后重试')
    }
  } finally {
    feedbackSubmitting.value = false
  }
}

// 记忆牢固度选项
const memoryFirmnessOptions = ['正常' , '较强' , '极强'];

const ocrOptions = [
  // uTools AI 视觉 OCR：零配置但消耗用户 AI 能量，仅 uTools 环境且 AI 可用时提供（非默认选项）
  ...(isUtools() && typeof (window as any).utools?.ai === 'function'
    ? [{value: 'utoolsai', label: 'uToolsAI(视觉)'}]
    : []),
  {
    value: 'local',
    label: '本地词典(离线)',
  },
  {
    value: 'baidu',
    label: '百度',
  },
  {
    value: 'youdao',
    label: '有道',
  }, {
    value: 'ali',
    label: '阿里',
  }, {
    value: 'deepseek',
    label: '深度求索(视觉)',
  }, {
    value: 'glm',
    label: '智谱GLM(视觉)',
  }]
const options = [
  {
    value: 'utoolsai',
    label: 'utoolsAI',
  },
  {
    value: 'local',
    label: '本地词典(离线)',
  },
  {
    value: 'baidu',
    label: '百度',
  },
  {
    value: 'youdao',
    label: '有道',
  }, {
    value: 'ali',
    label: '阿里',
  }, {
    value: 'ollama',
    label: 'ollama',
  }, {
    value: 'deepseek',
    label: 'deepseek',
  }, {
    value: 'qwen',
    label: '千问',
  }, {
    value: 'kimi',
    label: 'kimi',
  }, {
    value: 'glm',
    label: '智谱GLM',
  }, {
    value: 'minimax',
    label: 'MiniMax',
  }, {
    value: 'deepl',
    label: 'DeepL',
  }, {
    value: 'azure',
    label: '微软翻译',
  }, {
    value: 'qiniu',
    label: '七牛AI',
  }, {
    value: 'google',
    label: 'Google',
  }, {
    value: 'spark',
    label: '讯飞星火',
  }, {
    value: 'xftrans',
    label: '讯飞机器翻译',
  }, {
    value: 'bing',
    label: '微软网页版',
  }
]

// 免配置标签：内置 key 非空的引擎零配置可用；google/bing 走免费网页接口免 key
const translationOptionLabel = (value: string, label: string) => {
  let suffix = ''
  if (value === 'google' || value === 'bing') {
    suffix = '（免费免key）'
  } else if ((AppInfo as Record<string, { appkey?: string }>)[value]?.appkey) {
    suffix = '（免配置）'
  }
  // 默认引擎 spark 额外标注推荐
  return value === 'spark' ? `${label}${suffix}·推荐` : `${label}${suffix}`
}

const engineLabel = (list: { value: string; label: string }[], value: string) =>
  list.find(o => o.value === value)?.label || value

// 当前引擎卡片文案：免配置引擎标出免费额度，其余提示需配置
const currentEngineLabel = computed(() => engineLabel(options, wordsStore.currentTranslationPlatform))
const currentEngineHint = computed(() => {
  const p = wordsStore.currentTranslationPlatform
  if (p === 'google' || p === 'bing') return '免配置'
  if ((AppInfo as Record<string, { appkey?: string }>)[p]?.appkey) return '免配置 · 每日 500 次'
  return '需配置 API Key'
})
</script>

<style scoped lang="scss">
.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  box-sizing: border-box;
}

.titles {
  .setting-item + .setting-item {
    margin-top: 10px;
  }
}

.content {
  color: var(--utools-text-secondary);
  font-size: 12px;
}

.schedule-times {
  margin-top: 4px;
  padding-left: 20px;
}

.schedule-sync-hint {
  font-size: 12px;
  color: var(--utools-text-secondary);
}

.shorcut-desc {
  margin-top: 10px;
  font-size: 12px;
  font-weight: 400;
  color: var(--utools-text-secondary);
}

.engine-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin: 6px 20px;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--utools-bg-card);
  border: 1px solid var(--utools-border-divider);

  .engine-card-main {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .engine-card-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--utools-text-primary);
  }

  .engine-card-hint {
    font-size: 12px;
    color: var(--utools-text-tertiary);
  }
}

.feedback-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin: 14px 20px 0;
  padding: 12px;
  border-radius: 10px;
  background: var(--utools-bg-card);
  border: 1px solid var(--utools-border-divider);

  .feedback-card-main {
    min-width: 0;
  }

  .feedback-card-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--utools-text-primary);
  }

  .feedback-card-desc {
    font-size: 12px;
    color: var(--utools-text-tertiary);
    margin-top: 2px;
  }
}

.stats-optout {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 12px 20px 4px;

  // 颜色/字号与其他设置描述（.content：secondary 灰、12px）一致；超宽自然换行
  .stats-optout-text {
    flex: 1;
    min-width: 0;
    font-size: 12px;
    line-height: 1.5;
    color: var(--utools-text-secondary);
  }

  // 对钩固定在行末，不随文字换行收缩
  .stats-optout-check {
    flex-shrink: 0;
    margin-right: 0;
  }
}

.el-switch {
  --el-switch-on-color: var(--utools-primary);
  --el-switch-off-color: var(--utools-text-tertiary);
}
</style>
