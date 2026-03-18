<template>
  <el-dialog
    v-model="visible"
    title="🚀 快速开始"
    width="600px"
    :close-on-click-modal="false"
    :show-close="false"
  >
    <el-steps :active="currentStep" finish-status="success" simple>
      <el-step title="选择数字" />
      <el-step title="关联图片" />
      <el-step title="开始训练" />
    </el-steps>

    <div class="guide-content">
      <div v-if="currentStep === 0" class="step-content">
        <div class="step-icon">🔢</div>
        <h3>第一步：选择数字</h3>
        <p>点击下方数字按钮（0-9），选择你要记忆的数字。</p>
        <p>建议从 0-5 开始，循序渐进。</p>
        <div class="demo-numbers">
          <el-button v-for="n in 6" :key="n" size="large" circle disabled>{{ n - 1 }}</el-button>
        </div>
      </div>

      <div v-if="currentStep === 1" class="step-content">
        <div class="step-icon">🖼️</div>
        <h3>第二步：关联图片</h3>
        <p>为每个数字选择一个容易记忆的图片：</p>
        <ul>
          <li>🎯 <strong>推荐图片</strong>：系统根据数字谐音/外形推荐</li>
          <li>📤 <strong>自定义上传</strong>：上传你自己的图片</li>
        </ul>
        <div class="demo-images">
          <div class="demo-item">🔔<span>0像铃铛</span></div>
          <div class="demo-item">🌲<span>1像树</span></div>
          <div class="demo-item">🦢<span>2像鹅</span></div>
        </div>
      </div>

      <div v-if="currentStep === 2" class="step-content">
        <div class="step-icon">🎯</div>
        <h3>第三步：开始训练</h3>
        <p>保存至少4个数字后，即可开始训练：</p>
        <ul>
          <li>🔢➡️🖼️ <strong>数字→图片</strong>：看到数字选图片</li>
          <li>🖼️➡️🔢 <strong>图片→数字</strong>：看到图片选数字</li>
        </ul>
        <p class="tip">💡 提示：双向训练可以加深记忆效果！</p>
      </div>
    </div>

    <template #footer>
      <el-button v-if="currentStep > 0" @click="currentStep--">上一步</el-button>
      <el-button v-if="currentStep < 2" type="primary" @click="currentStep++">下一步</el-button>
      <el-button v-else type="success" @click="finish">开始体验</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
  (e: "finish"): void;
}>();

const visible = ref(props.modelValue);
const currentStep = ref(0);

watch(() => props.modelValue, (val) => {
  visible.value = val;
  if (val) {
    currentStep.value = 0;
  }
});

watch(visible, (val) => {
  emit("update:modelValue", val);
});

function finish() {
  visible.value = false;
  emit("finish");
  localStorage.setItem("numberMemoryGuideShown", "true");
}
</script>

<style scoped lang="scss">
.guide-content {
  padding: 30px 20px;
  min-height: 250px;

  .step-content {
    text-align: center;

    .step-icon {
      font-size: 64px;
      margin-bottom: 20px;
    }

    h3 {
      color: var(--utools-primary);
      margin-bottom: 15px;
    }

    p {
      color: var(--utools-text-secondary);
      margin-bottom: 10px;
      line-height: 1.6;
    }

    ul {
      text-align: left;
      display: inline-block;
      margin: 15px 0;
      padding-left: 20px;

      li {
        margin-bottom: 10px;
        color: var(--utools-text-secondary);
      }
    }

    .tip {
      background-color: var(--utools-primary-light);
      padding: 10px 15px;
      border-radius: 8px;
      color: var(--utools-success);
      margin-top: 20px;
    }

    .demo-numbers {
      margin-top: 20px;

      .el-button {
        margin: 0 5px;
        width: 50px;
        height: 50px;
        font-size: 18px;
      }
    }

    .demo-images {
      display: flex;
      justify-content: center;
      gap: 20px;
      margin-top: 20px;

      .demo-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        font-size: 40px;

        span {
          font-size: 14px;
          color: var(--utools-text-tertiary);
          margin-top: 5px;
        }
      }
    }
  }
}
</style>
