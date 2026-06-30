<template>
  <div class="phonetic-memory">
    <!-- 顶部:返回 + 标题 -->
    <div class="header">
      <div class="left">
        <el-button text @click="goBack" :icon="ArrowLeft" size="large">返回</el-button>
      </div>
      <div class="center">
        <h2>音标学习</h2>
        <span class="subtitle">English IPA · 48 Phonemes</span>
      </div>
      <div class="right"></div>
    </div>

    <!-- 主体:统计 + 练习卡 + 音标表 -->
    <div class="table-wrap">
      <!-- 进度统计 -->
      <div class="progress-row">
        <div class="progress-stat">
          <div class="stat-num">{{ phoneticStore.masteredCount }}<span class="stat-total">/48</span></div>
          <div class="stat-label">已掌握音素</div>
        </div>
        <div class="progress-stat">
          <div class="stat-num" :class="{ active: phoneticStore.dueCount > 0 }">
            {{ phoneticStore.dueCount }}
          </div>
          <div class="stat-label">待练习音素</div>
        </div>
      </div>

      <!-- 3 张练习入口卡 -->
      <div class="practice-cards">
        <div class="practice-card recognition" @click="goRecognition('forward')">
          <div class="card-icon">🎯</div>
          <div class="card-title">音标识别</div>
          <div class="card-desc">看音标 → 选例词</div>
        </div>
        <div class="practice-card backward" @click="goRecognition('backward')">
          <div class="card-icon">🔁</div>
          <div class="card-title">反向识别</div>
          <div class="card-desc">看单词 → 选音标</div>
        </div>
        <div class="practice-card pairs" @click="goMinimalPairs">
          <div class="card-icon">🎧</div>
          <div class="card-title">最小对立对</div>
          <div class="card-desc">听音 → 二选一</div>
        </div>
        <div class="practice-card breakdown" @click="goBreakdown">
          <div class="card-icon">🧩</div>
          <div class="card-title">音素拆解</div>
          <div class="card-desc">单词 → 拼音素</div>
        </div>
      </div>

      <!-- 音标表 -->
      <div
          v-for="(group, gIdx) in PHONEME_TABLE"
          :key="gIdx"
          class="group"
          :class="`group--${gIdx === 0 ? 'vowel' : 'consonant'}`"
      >
        <div class="group-header">
          <h3>{{ group.title }}</h3>
          <span class="group-sub">{{ group.subtitle }}</span>
        </div>

        <div
            v-for="(section, sIdx) in group.sections"
            :key="sIdx"
            class="section"
        >
          <div class="section-label">
            <span class="cn">{{ section.label }}</span>
            <span class="en">{{ section.en }}</span>
            <span class="count">· {{ section.phonemes.length }}</span>
          </div>

          <div class="phoneme-grid">
            <div
                v-for="ph in section.phonemes"
                :key="ph.ipa"
                class="phoneme-card"
                :class="{ active: activeIpa === ph.ipa }"
                @click="selectPhoneme(ph)"
            >
              <div class="ipa">/{{ ph.ipa }}/</div>
              <div class="first-example">{{ ph.examples[0] }}</div>
              <span v-if="ph.voiced === true" class="badge badge-voiced">浊</span>
              <span v-if="ph.voiced === false" class="badge badge-voiceless">清</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 选中音素的详情抽屉 -->
    <el-drawer
        v-model="detailVisible"
        :title="activePhoneme ? `/${activePhoneme.ipa}/` : ''"
        size="380px"
        direction="rtl"
    >
      <div v-if="activePhoneme" class="detail">
        <div class="detail-ipa-row">
          <div class="detail-ipa" @click="speakArticulation(activePhoneme)" title="点击发音">
            /{{ activePhoneme.ipa }}/
            <el-icon class="detail-speaker" size="20"><VideoPlay/></el-icon>
          </div>
          <el-tag size="small" :type="activePhoneme.type === 'vowel' ? 'success' : 'warning'">
            {{ activePhoneme.type === 'vowel' ? '元音' : '辅音' }}
          </el-tag>
          <el-tag size="small" type="info">{{ activePhoneme.groupLabel }}</el-tag>
          <el-tag v-if="activePhoneme.voiced === true" size="small" type="primary">浊辅音</el-tag>
          <el-tag v-if="activePhoneme.voiced === false" size="small">清辅音</el-tag>
        </div>

        <div class="detail-block">
          <div class="detail-block-label">发音要点</div>
          <p class="tip">{{ activePhoneme.tip }}</p>
        </div>

        <div class="detail-block">
          <div class="detail-block-label">例词(点击发音)</div>
          <div class="examples">
            <el-button
                v-for="word in activePhoneme.examples"
                :key="word"
                class="example-btn"
                @click="speak(word)"
            >
              <el-icon size="14" style="margin-right: 4px;"><VideoPlay /></el-icon>
              {{ word }}
            </el-button>
          </div>
        </div>

        <div v-if="activePhoneme.similar?.length" class="detail-block">
          <div class="detail-block-label">易混淆</div>
          <div class="similar">
            <el-tag
                v-for="ipa in activePhoneme.similar"
                :key="ipa"
                class="similar-tag"
                @click="jumpToSimilar(ipa)"
            >/{{ ipa }}/</el-tag>
          </div>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import {ref, computed, onMounted} from 'vue';
import {useRouter} from 'vue-router';
import {ArrowLeft, VideoPlay} from '@element-plus/icons-vue';
import {PHONEME_TABLE, findPhoneme, type Phoneme} from '@/utils/phoneme-data';
import {speakWithEdgeTTS, speakWithWebSpeech} from '@/utils/translation-api';
import {usePhoneticMemoryStore} from '@/stores/phoneticMemory';

const router = useRouter();
const phoneticStore = usePhoneticMemoryStore();
const detailVisible = ref(false);
const activeIpa = ref('');

const activePhoneme = computed<Phoneme | undefined>(() =>
    activeIpa.value ? findPhoneme(activeIpa.value) : undefined,
);

onMounted(() => {
  phoneticStore.ensureLoaded();
});

function selectPhoneme(ph: Phoneme) {
  activeIpa.value = ph.ipa;
  detailVisible.value = true;
  // 进入详情时自动朗读音素本身(articulation),给用户立刻的听觉反馈
  speakArticulation(ph);
}

function jumpToSimilar(ipa: string) {
  const ph = findPhoneme(ipa);
  if (ph) selectPhoneme(ph);
}

async function speak(word: string) {
  const ok = await speakWithEdgeTTS(word).catch(() => false);
  if (!ok) speakWithWebSpeech(word);
}

/**
 * 朗读"音素本身":Web Speech 不支持 IPA,这里用 phonics 代理串
 * (如 /ɪ/→'it'、/p/→'puh'),并按音素类型调速让 TTS 拟音更接近真实音素。
 */
function speakArticulation(ph: Phoneme) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(ph.articulation);
  u.lang = 'en-US';
  // 短/长元音用语速区分:短促 0.95,拉长 0.5;辅音稍慢避免被读成字母名
  if (ph.group === 'short') u.rate = 0.95;
  else if (ph.group === 'long') u.rate = 0.5;
  else if (ph.group === 'diphthong') u.rate = 0.7;
  else u.rate = 0.75;
  u.pitch = 1;
  u.volume = 1;
  // 尽量挑一个英文女声
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(v => /en-US/i.test(v.lang) && /Aria|Jenny|Zira|Google/i.test(v.name))
      || voices.find(v => /^en/i.test(v.lang));
  if (preferred) u.voice = preferred;
  window.speechSynthesis.speak(u);
}

function goBack() {
  // 直接回单词列表,避免 uTools / 刷新等无 history 场景下 back 失效
  router.push('/word');
}

function goRecognition(direction: 'forward' | 'backward' = 'forward') {
  router.push({path: '/phonetic-memory/recognition', query: {direction}});
}

function goMinimalPairs() {
  router.push('/phonetic-memory/minimal-pairs');
}

function goBreakdown() {
  router.push('/phonetic-memory/breakdown');
}
</script>

<style scoped lang="scss">
.phonetic-memory {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--utools-bg-primary, #fafafa);
}

.header {
  display: flex;
  align-items: center;
  padding: 12px 20px;
  border-bottom: 1px solid var(--utools-border-primary, #eee);
  background: var(--utools-bg-secondary, #fff);
  flex-shrink: 0;

  .left, .right {
    flex: 1;
  }

  .right {
    text-align: right;
  }

  .center {
    text-align: center;
    h2 {
      margin: 0;
      font-size: 18px;
      color: var(--utools-text-primary, #333);
    }
    .subtitle {
      font-size: 12px;
      color: var(--utools-text-tertiary, #999);
      letter-spacing: 0.5px;
    }
  }
}

.table-wrap {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px 24px;
}

// ====== 顶部:进度统计 ======
.progress-row {
  display: flex;
  gap: 12px;
  margin-bottom: 14px;
}

.progress-stat {
  flex: 1;
  background: var(--utools-bg-secondary, #fff);
  border: 1px solid var(--utools-border-primary, #e4e7ed);
  border-radius: 10px;
  padding: 12px 16px;
  display: flex;
  align-items: baseline;
  gap: 10px;

  .stat-num {
    font-size: 22px;
    font-weight: 700;
    color: var(--utools-text-primary, #303133);
    line-height: 1;

    &.active {
      color: var(--utools-primary, #409eff);
    }
  }

  .stat-total {
    font-size: 13px;
    color: var(--utools-text-tertiary, #909399);
    font-weight: 400;
  }

  .stat-label {
    font-size: 12px;
    color: var(--utools-text-tertiary, #909399);
  }
}

// ====== 练习入口卡 ======
.practice-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 10px;
  margin-bottom: 22px;
}

.practice-card {
  background: var(--utools-bg-secondary, #fff);
  border: 1px solid var(--utools-border-primary, #e4e7ed);
  border-radius: 12px;
  padding: 14px;
  cursor: pointer;
  transition: all 0.15s;
  text-align: center;

  &:hover {
    transform: translateY(-2px);
    border-color: var(--utools-primary, #409eff);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.06);
  }

  .card-icon {
    font-size: 28px;
    line-height: 1;
    margin-bottom: 6px;
  }

  .card-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--utools-text-primary, #303133);
    margin-bottom: 2px;
  }

  .card-desc {
    font-size: 11px;
    color: var(--utools-text-tertiary, #909399);
  }
}

.group {
  margin-bottom: 24px;

  &--vowel .group-header {
    border-left-color: #67c23a;
  }

  &--consonant .group-header {
    border-left-color: #e6a23c;
  }
}

.group-header {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 4px 0 4px 10px;
  margin-bottom: 12px;
  border-left: 4px solid #67c23a;

  h3 {
    margin: 0;
    font-size: 17px;
    color: var(--utools-text-primary, #303133);
  }

  .group-sub {
    font-size: 12px;
    color: var(--utools-text-tertiary, #999);
    letter-spacing: 0.5px;
  }
}

.section {
  margin-bottom: 14px;
}

.section-label {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-bottom: 6px;
  padding-left: 4px;

  .cn {
    font-size: 13px;
    font-weight: 600;
    color: var(--utools-text-primary, #303133);
  }

  .en {
    font-size: 12px;
    color: var(--utools-text-tertiary, #999);
  }

  .count {
    font-size: 11px;
    color: var(--utools-text-tertiary, #aaa);
  }
}

.phoneme-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(82px, 1fr));
  gap: 8px;
}

.phoneme-card {
  position: relative;
  padding: 10px 6px 8px;
  background: var(--utools-bg-secondary, #fff);
  border: 1px solid var(--utools-border-primary, #e4e7ed);
  border-radius: 8px;
  cursor: pointer;
  text-align: center;
  transition: all 0.15s ease;
  user-select: none;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    border-color: var(--utools-primary, #409eff);
  }

  &.active {
    border-color: var(--utools-primary, #409eff);
    box-shadow: 0 0 0 2px var(--utools-primary-light, rgba(64, 158, 255, 0.2));
  }

  .ipa {
    font-size: 18px;
    font-weight: 600;
    color: var(--utools-text-primary, #303133);
    line-height: 1.2;
    font-family: "Charis SIL", "Doulos SIL", "Times New Roman", serif;
  }

  .first-example {
    margin-top: 4px;
    font-size: 11px;
    color: var(--utools-text-tertiary, #909399);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .badge {
    position: absolute;
    top: 4px;
    right: 4px;
    font-size: 9px;
    padding: 1px 4px;
    border-radius: 3px;
    line-height: 1;
  }

  .badge-voiced {
    background: #e1f3d8;
    color: #5daf34;
  }

  .badge-voiceless {
    background: #e9e9eb;
    color: #909399;
  }
}

// ====== 详情抽屉 ======
.detail {
  padding: 0 4px;
}

.detail-ipa-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 18px;
}

.detail-ipa {
  font-size: 32px;
  font-weight: 700;
  color: var(--utools-text-primary, #303133);
  margin-right: 8px;
  font-family: "Charis SIL", "Doulos SIL", "Times New Roman", serif;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 8px;
  border-radius: 6px;
  transition: background 0.15s;

  &:hover {
    background: var(--utools-bg-tertiary, #f0f2f5);
  }

  .detail-speaker {
    color: var(--utools-primary, #409eff);
  }
}

.detail-block {
  margin-bottom: 18px;
}

.detail-block-label {
  font-size: 12px;
  color: var(--utools-text-tertiary, #909399);
  margin-bottom: 8px;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.tip {
  margin: 0;
  font-size: 14px;
  color: var(--utools-text-secondary, #606266);
  line-height: 1.6;
}

.examples {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.example-btn {
  font-size: 13px;
}

.similar {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.similar-tag {
  cursor: pointer;
  font-family: "Charis SIL", "Doulos SIL", "Times New Roman", serif;
  font-size: 13px;

  &:hover {
    background: var(--el-color-primary-light-8);
  }
}
</style>
