<template>
  <transition name="fade">
    <div v-if="visible" class="onboarding-overlay" @click.self="close">
      <div class="onboarding-card">
        <!-- 关闭按钮 -->
        <div class="close-btn" @click="close">×</div>

        <!-- 第一屏：欢迎 + 导入词库 -->
        <div v-if="currentScreen === 0" class="screen">
          <div class="hero">🧠</div>
          <h2>欢迎使用慢记</h2>
          <p class="slogan">基于艾宾浩斯遗忘曲线的记忆训练</p>
          <p class="slogan-sub">在快要忘记的时候提醒你复习</p>

          <div class="bank-section">
            <p class="section-title">从导入词库开始：</p>
            <div class="bank-list">
              <div
                v-for="bank in recommendedBanks"
                :key="bank.id"
                class="bank-item"
                :class="{ disabled: importing !== '' }"
                @click="importBank(bank.id)"
              >
                <span class="bank-emoji">{{ bank.emoji }}</span>
                <div class="bank-info">
                  <div class="bank-name">{{ bank.name }}</div>
                  <div class="bank-desc">{{ bank.desc }} · {{ bank.wordCount }} 词</div>
                </div>
                <span class="bank-action">{{ importing === bank.id ? '导入中…' : '导入' }}</span>
              </div>
            </div>
          </div>

          <div class="screen-footer">
            <el-button text @click="skip">跳过，随便看看</el-button>
            <el-button text @click="nextScreen">下一步 →</el-button>
          </div>
        </div>

        <!-- 第二屏：核心功能 -->
        <div v-else-if="currentScreen === 1" class="screen">
          <h2>核心功能</h2>
          <div class="feature-list">
            <div class="feature-item">
              <span class="feature-emoji">📅</span>
              <div class="feature-info">
                <div class="feature-name">复习</div>
                <div class="feature-desc">到点提醒，卡片过一遍就能记住</div>
              </div>
            </div>
            <div class="feature-item">
              <span class="feature-emoji">✏️</span>
              <div class="feature-info">
                <div class="feature-name">听写</div>
                <div class="feature-desc">看释义默写单词，专治拼不对</div>
              </div>
            </div>
            <div class="feature-item">
              <span class="feature-emoji">📸</span>
              <div class="feature-info">
                <div class="feature-name">截图取词</div>
                <div class="feature-desc">划词/截图自动翻译收集</div>
              </div>
            </div>
          </div>

          <div class="screen-footer">
            <el-button text @click="prevScreen">← 上一步</el-button>
            <el-button text @click="nextScreen">下一步 →</el-button>
          </div>
        </div>

        <!-- 第三屏：开始使用 -->
        <div v-else class="screen">
          <div class="hero">🎉</div>
          <h2>准备好了</h2>
          <p class="slogan">开始你的记忆之旅吧</p>

          <div class="tips">
            <p>💡 提示：在 uTools 输入框输入「划词添加」「截图添加」可快速收集单词</p>
          </div>

          <div class="screen-footer">
            <el-button type="primary" size="large" @click="close">开始使用</el-button>
          </div>
        </div>

        <!-- 进度指示 -->
        <div class="dots">
          <span
            v-for="i in 3"
            :key="i"
            class="dot"
            :class="{ active: i - 1 === currentScreen }"
            @click="goToScreen(i - 1)"
          ></span>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { importFromBuiltinWordBank } from '@/utils/wordbank-manager'
import { useWordsStore } from '@/stores/words'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'finish'): void
}>()

const wordsStore = useWordsStore()
const currentScreen = ref(0)
const importing = ref('')

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

// 推荐词库（与小程序端一致：四级/六级/考研）
const recommendedBanks = [
  { id: 'cet4', name: '四级词汇', emoji: '📘', desc: '大学英语四级核心词汇', wordCount: 3739 },
  { id: 'cet6', name: '六级词汇', emoji: '📗', desc: '大学英语六级核心词汇', wordCount: 2078 },
  { id: 'kaoyan', name: '考研词汇', emoji: '📙', desc: '研究生入学考试核心词汇', wordCount: 4533 },
]

const close = () => {
  visible.value = false
  emit('finish')
}

const skip = () => {
  close()
}

const nextScreen = () => {
  if (currentScreen.value < 2) {
    currentScreen.value++
  }
}

const prevScreen = () => {
  if (currentScreen.value > 0) {
    currentScreen.value--
  }
}

const goToScreen = (index: number) => {
  currentScreen.value = index
}

// 导入词库
async function importBank(bankId: string) {
  if (importing.value) return
  importing.value = bankId

  try {
    // 确保有当前词库
    await wordsStore.listWords()
    const currentBankId = wordsStore.currentWordBankId
    if (!currentBankId) {
      ElMessage.error('未找到当前词库，请先在设置中创建词库')
      return
    }

    // 导入内置词库（全量；如需前 100 词可在导入后由用户自行管理）
    const result = await importFromBuiltinWordBank(currentBankId, bankId)
    if (result.success) {
      ElMessage.success(`已导入 ${result.count} 词，开始吧！`)
      close()
    } else {
      ElMessage.error(result.error || '导入失败，请重试')
    }
  } catch (e: any) {
    console.error('导入词库失败:', e)
    ElMessage.error(e?.message || '导入失败，请重试')
  } finally {
    importing.value = ''
  }
}
</script>

<style scoped lang="scss">
.onboarding-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.onboarding-card {
  background: var(--utools-bg-primary);
  border-radius: 12px;
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
  overflow-y: auto;
  padding: 30px;
  position: relative;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.15);
}

.close-btn {
  position: absolute;
  top: 12px;
  right: 16px;
  font-size: 28px;
  color: var(--utools-text-tertiary);
  cursor: pointer;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 0.2s;

  &:hover {
    background: var(--utools-bg-hover);
    color: var(--utools-text-primary);
  }
}

.screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.hero {
  font-size: 64px;
  margin-bottom: 16px;
}

h2 {
  font-size: 24px;
  font-weight: 600;
  color: var(--utools-text-primary);
  margin-bottom: 8px;
}

.slogan {
  font-size: 15px;
  color: var(--utools-text-secondary);
  margin-bottom: 4px;
}

.slogan-sub {
  font-size: 13px;
  color: var(--utools-text-tertiary);
  margin-bottom: 24px;
}

.bank-section {
  width: 100%;
  margin-bottom: 20px;
}

.section-title {
  font-size: 14px;
  color: var(--utools-text-secondary);
  margin-bottom: 12px;
  text-align: left;
}

.bank-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bank-item {
  display: flex;
  align-items: center;
  background: var(--utools-bg-card);
  border-radius: 10px;
  padding: 14px 16px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;

  &:hover {
    border-color: var(--utools-primary);
    background: var(--utools-bg-hover);
  }

  &.disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.bank-emoji {
  font-size: 32px;
  margin-right: 12px;
}

.bank-info {
  flex: 1;
  text-align: left;
}

.bank-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--utools-text-primary);
}

.bank-desc {
  font-size: 12px;
  color: var(--utools-text-tertiary);
  margin-top: 2px;
}

.bank-action {
  font-size: 13px;
  color: #fff;
  background: var(--utools-primary);
  border-radius: 16px;
  padding: 6px 16px;
  white-space: nowrap;
}

.feature-list {
  width: 100%;
  margin-bottom: 20px;
}

.feature-item {
  display: flex;
  align-items: center;
  background: var(--utools-bg-card);
  border-radius: 10px;
  padding: 16px;
  margin-bottom: 12px;
  text-align: left;
}

.feature-emoji {
  font-size: 32px;
  margin-right: 14px;
}

.feature-info {
  flex: 1;
}

.feature-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--utools-text-primary);
}

.feature-desc {
  font-size: 13px;
  color: var(--utools-text-tertiary);
  margin-top: 4px;
}

.tips {
  background: var(--utools-bg-secondary);
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 20px;

  p {
    font-size: 13px;
    color: var(--utools-text-secondary);
    line-height: 1.6;
    margin: 0;
  }
}

.screen-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  margin-top: 10px;
}

.dots {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-top: 20px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--utools-border-divider);
  cursor: pointer;
  transition: all 0.2s;

  &.active {
    background: var(--utools-primary);
    width: 24px;
    border-radius: 4px;
  }
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s;
}

.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>
