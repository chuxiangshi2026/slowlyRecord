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
      <!-- 当前翻译引擎卡片：第一屏只呈现当前引擎与配置状态，切换走右侧下拉 -->
      <div class="engine-card">
        <div class="engine-card-main">
          <span class="engine-card-name">{{ currentEngineLabel }}</span>
          <span class="engine-card-hint">{{ currentEngineHint }}</span>
        </div>
        <el-select class="shorcut-desc" :model-value="wordsStore.currentTranslationPlatform"
                   @update:model-value="(val: TranslationPlatform) => wordsStore.setTranslationPlatform(val)"
                   placeholder="切换引擎"
                   style="width:150px">
          <el-option-group v-for="group in translationEngineGroups" :key="group.label" :label="group.label">
            <el-option
                v-for="item in group.options"
                :key="item.value"
                :label="item.label"
                :value="item.value"
            />
          </el-option-group>
        </el-select>
      </div>
      <el-button v-if="canConfigureCurrentTranslation" class="engine-config-link" link type="primary" @click="openApiKeySettings">
        配置当前引擎 Key / 模型
      </el-button>
      <p v-if="isWebEnv" class="engine-web-hint">
        Web 端建议使用 B站 Index-Translate、Google 或本地词典；其他引擎可能受浏览器跨域限制。
      </p>
    </div>
    <div>
      <div class="setting-item">
        <div class="content">OCR 图片识别引擎</div>
        <div class="engine-setting-actions">
          <el-button v-if="canConfigureCurrentOcr" link type="primary" @click="openApiKeySettings">配置 Key / 模型</el-button>
          <el-select class="shorcut-desc" :model-value="wordsStore.currentOcrPlatform"
                     @update:model-value="(val: OcrPlatform) => wordsStore.setOcrPlatform(val)"
                     placeholder="选择"
                     style="width:150px">
            <el-option-group v-for="group in ocrEngineGroups" :key="group.label" :label="group.label">
              <el-option
                  v-for="item in group.options"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
              />
            </el-option-group>
          </el-select>
        </div>
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
          <div class="content">每日提醒</div>
          <el-switch class="shorcut-desc"
                     :model-value="wordsStore.scheduleReminder.daily"
                     inline-prompt
                     size="large"
                     active-text="开"
                     inactive-text="关"
                     @update:model-value="(v: string | number | boolean | undefined) => onScheduleToggle('daily', v)"
          />
        </div>
        <div class="setting-item schedule-times" v-if="wordsStore.scheduleReminder.daily">
          <el-select class="reminder-times-select"
                     :model-value="dailySelectedTimes"
                     multiple
                     collapse-tags
                     collapse-tags-tooltip
                     :multiple-limit="MAX_REMINDER_TIMES"
                     placeholder="选择提醒时间"
                     @update:model-value="onDailyTimesChange">
            <el-option v-for="t in reminderTimeOptions" :key="t" :label="t" :value="t"/>
          </el-select>
          <span class="schedule-sync-hint">到点提醒复习进度，并附带一个待复习词；最多选 {{ MAX_REMINDER_TIMES }} 个时间点</span>
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

    <!-- 微信小程序入口：放设置页而非同步弹窗，避免与「同步码」混淆 -->
    <div class="miniprogram-card">
      <div class="miniprogram-info">
        <div class="miniprogram-title">微信小程序</div>
        <div class="miniprogram-desc">微信扫码在小程序继续学习；与桌面端互传数据用「同步」功能</div>
      </div>
      <img class="miniprogram-code" src="/static/minicode.png" alt="慢记微信小程序码" />
    </div>

    <!-- 匿名统计开关：脚注行，文字在左（超宽自动换行）、对钩在行末（勾选=参与，与其他开关同向）；
         隐私说明与上报状态同属一条（都是"采什么/目前是否在采"），合并展示不再单列 -->
    <div class="stats-optout">
      <span class="stats-optout-text">匿名使用统计（仅统计功能使用与版本分布，不含词库内容与个人信息，用于改进插件）
        <span class="stats-status">当前：{{ statsStatusText }} · <a href="#"
              @click.prevent="privacyVisible = true">隐私说明</a></span>
      </span>
      <el-checkbox class="stats-optout-check" :model-value="statsOptIn" size="small"
                   aria-label="匿名使用统计"
                   @update:model-value="onStatsOptInChange"/>
    </div>

    <PrivacyDialog v-model="privacyVisible"/>

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
import {isUtools, isWeb} from "@/adapters/platform";
import {engineRequiresKey, getOcrEngineGroups, getTranslationEngine, getAvailableTranslationEngineGroups, OCR_KEY_PLATFORMS, TRANSLATION_KEY_PLATFORMS} from "@/utils/engine-options";
import {isStatsExcluded, setStatsExcluded, submitFeedback, getStatsStatus} from "@/utils/stats.ts";
import type {StatsStatus} from "@/utils/stats.ts";
import {ElMessage} from 'element-plus'
import {isScheduleSupported, applyScheduleSetting, applyScheduleTimes, REMINDER_TIME_OPTIONS, MAX_REMINDER_TIMES} from "@/utils/schedule-reminder.ts";
import type {ReminderKind} from "@/utils/schedule-reminder.ts";
import {useSyncStore} from "@/stores/sync";
import PrivacyDialog from "@/components/PrivacyDialog.vue";

const wordsStore = useWordsStore();
const uiStore = useUiStore();
const syncStore = useSyncStore();

// 定时任务能力探测：仅 uTools 8.0+ 显示定时提醒开关
const scheduleSupported = isScheduleSupported();
const reminderTimeOptions = REMINDER_TIME_OPTIONS;
// 已选时间点：新字段优先，旧数据兜底，缺省早/晚两次
const dailySelectedTimes = computed(() => {
  const pref = wordsStore.scheduleReminder;
  if (pref.dailyTimes?.length) return pref.dailyTimes;
  if (pref.reviewTimes?.length) return pref.reviewTimes;
  return ['09:00', '21:00'];
});
// 自动备份依赖 WebDAV 凭据，未配置时提示用户先去同步面板配置
const syncConfigured = computed(() => syncStore.webdavConfigured);

// 开关切换：先落意向，再即时发起系统创建请求/删除任务
const onScheduleToggle = (kind: ReminderKind, val: string | number | boolean | undefined) => {
  const enabled = !!val
  wordsStore.setScheduleReminder({ [kind]: enabled })
  void applyScheduleSetting(kind, enabled)
}

// 修改提醒时间点：落意向后，cron 真变了才重建（uTools 无修改 API，会再弹一次授权框）
const onDailyTimesChange = (val: any) => {
  const next = [...(val as string[])].sort()
  if (next.length === 0) return
  wordsStore.setScheduleReminder({ dailyTimes: next })
  void applyScheduleTimes('daily')
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

// 统计状态行：直接展示上报/停用原因（生产环境无控制台，排障就靠这行）
const statsStatusText = computed(() => {
  void statsOptIn.value // 开关切换时重算（getStatsStatus 直接读 localStorage）
  return ({
    enabled: '上报中',
    excluded: '已手动关闭',
    dev: '开发环境已停用',
    localhost: '本地调试已停用',
    'no-config': '未配置',
  } as Record<StatsStatus, string>)[getStatsStatus()]
})

// 问题反馈：经 umami 事件通道提交（feedback.submit），用户主动动作不受统计开关限制
const feedbackVisible = ref(false)
const privacyVisible = ref(false)
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

const isWebEnv = isWeb()
const translationEngineGroups = getAvailableTranslationEngineGroups()
const ocrEngineGroups = getOcrEngineGroups()
  .map(group => ({
    ...group,
    options: group.options.filter(option => option.value !== 'utoolsai' || (isUtools() && typeof (window as any).utools?.ai === 'function')),
  }))
  .filter(group => group.options.length > 0)

const currentEngineLabel = computed(() =>
  getTranslationEngine(wordsStore.currentTranslationPlatform)?.label || wordsStore.currentTranslationPlatform
)
const currentEngineHint = computed(() => {
  const option = getTranslationEngine(wordsStore.currentTranslationPlatform)
  if (!option) return '需 Key'
  return `${option.kind === 'llm' ? '大模型' : '传统 API'} · ${engineRequiresKey(option) ? '需 Key' : '免配置'}`
})

const emit = defineEmits<{(event: 'open-api-key'): void}>()
const openApiKeySettings = () => emit('open-api-key')
const canConfigureCurrentTranslation = computed(() =>
  (TRANSLATION_KEY_PLATFORMS as string[]).includes(wordsStore.currentTranslationPlatform)
)
const canConfigureCurrentOcr = computed(() =>
  (OCR_KEY_PLATFORMS as string[]).includes(wordsStore.currentOcrPlatform)
)
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

.engine-web-hint {
  margin: 6px 20px 0;
  color: var(--utools-text-tertiary);
  font-size: 11px;
  line-height: 1.5;
}

.engine-config-link {
  margin: 0 20px 4px;
  font-size: 12px;
}

.engine-setting-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.schedule-times {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 4px;
  padding-left: 20px;
}

.reminder-times-select {
  width: 100%;
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

.miniprogram-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin: 10px 20px 0;
  padding: 12px;
  border-radius: 10px;
  background: var(--utools-bg-card);
  border: 1px solid var(--utools-border-divider);

  .miniprogram-info {
    min-width: 0;
  }

  .miniprogram-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--utools-text-primary);
  }

  .miniprogram-desc {
    font-size: 12px;
    color: var(--utools-text-tertiary);
    margin-top: 2px;
    line-height: 1.5;
  }

  .miniprogram-code {
    width: 72px;
    height: 72px;
    flex: none;
    border-radius: 6px;
    background: #fff;
  }
}

.stats-optout {
  display: flex;
  align-items: center;
  gap: 8px;
  // 上下留白一致，合并后不贴边
  margin: 12px 20px 12px;

  // 颜色/字号与其他设置描述（.content：secondary 灰、12px）一致；超宽自然换行
  .stats-optout-text {
    flex: 1;
    min-width: 0;
    font-size: 12px;
    line-height: 1.5;
    color: var(--utools-text-secondary);
  }

  // 统计状态行（当前：上报中/已停用原因 · 隐私说明）
  .stats-status {
    display: block;
    font-size: 12px;
    color: var(--utools-text-tertiary);

    a {
      color: var(--utools-text-tertiary);
      text-decoration: underline;
      text-underline-offset: 2px;

      &:hover {
        color: var(--utools-primary);
      }
    }
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
