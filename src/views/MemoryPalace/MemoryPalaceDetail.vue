<template>
  <div class="palace-detail-page">
    <!-- 顶部信息条 -->
    <div class="detail-header">
      <span class="palace-title">{{ palace?.name || '记忆宫殿' }}</span>
      <span class="palace-sub">{{ palace?.loci.length || 0 }} 桩 · 已挂载 {{ store.pegs.length }}</span>
    </div>

    <!-- 桩列表 -->
    <div class="loci-list-wrapper" v-loading="store.loading">
      <el-empty v-if="!palace" description="宫殿不存在或已被删除" />
      <el-empty v-else-if="palace.loci.length === 0" description="该宫殿还没有地点桩，请先编辑添加" />

      <div
        v-for="locus in sortedLoci"
        :key="locus.order"
        class="list-item locus-card"
      >
        <div class="locus-main">
          <img v-if="locus.imageUrl" :src="locus.imageUrl" class="locus-image" alt="桩图片" />
          <div class="locus-info">
            <p class="locus-title-line">
              <span class="locus-order">#{{ locus.order }}</span>
              <span class="locus-name">{{ locus.name }}</span>
              <el-tag v-if="pegOf(locus.order)" size="small" :type="pegLevelTagType(locus.order)">
                L{{ pegLevel(locus.order) }}
              </el-tag>
            </p>
            <p v-if="locus.description" class="locus-desc">{{ locus.description }}</p>

            <!-- 挂载内容 -->
            <div v-if="pegOf(locus.order)" class="peg-content">
              <template v-if="resolvePeg(locus.order).deleted">
                <span class="peg-deleted">内容已删除</span>
              </template>
              <template v-else>
                <span class="peg-text">{{ resolvePeg(locus.order).text }}</span>
                <span v-if="resolvePeg(locus.order).articleTitle" class="peg-source">
                  —— 《{{ resolvePeg(locus.order).articleTitle }}》
                </span>
              </template>
              <p v-if="pegOf(locus.order)?.mnemonic" class="peg-mnemonic">
                助记：{{ pegOf(locus.order)?.mnemonic }}
              </p>
            </div>
            <div v-else class="peg-empty">未挂载内容</div>
          </div>
        </div>

        <div class="operate">
          <div class="operate-group">
            <el-tooltip effect="dark" content="挂载自由文本" placement="top" popper-class="small-tooltip">
              <el-icon class="iconHover" :size="20" @click="openFreeTextDialog(locus.order)"><EditPen /></el-icon>
            </el-tooltip>
            <el-tooltip effect="dark" content="挂载文章切块" placement="top" popper-class="small-tooltip">
              <el-icon class="iconHover" :size="20" @click="openArticleDialog"><Collection /></el-icon>
            </el-tooltip>
          </div>
          <div class="operate-group">
            <el-tooltip v-if="pegOf(locus.order)" effect="dark" content="解除挂载" placement="top" popper-class="small-tooltip">
              <el-icon class="iconHover" :size="20" @click="handleUnmount(locus.order)"><Close /></el-icon>
            </el-tooltip>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部工具栏 -->
    <div class="home_footer">
      <div>
        <span class="footer-stat" @click="goBack">
          <el-icon><ArrowLeft /></el-icon>
          返回
        </span>
      </div>
      <div>
        <el-tooltip effect="dark" content="编辑宫殿" placement="top" popper-class="small-tooltip">
          <el-icon :size="20" class="footer-icon" @click="goEdit"><Edit /></el-icon>
        </el-tooltip>
        <el-tooltip effect="dark" content="开始巡视" placement="top" popper-class="small-tooltip">
          <el-icon :size="20" class="footer-icon" @click="goReview"><View /></el-icon>
        </el-tooltip>
      </div>
    </div>

    <!-- 挂载自由文本对话框 -->
    <el-dialog v-model="showFreeTextDialog" title="挂载自由文本" width="520px">
      <el-form label-width="80px">
        <el-form-item label="内容" required>
          <el-input
            v-model="freeTextForm.text"
            type="textarea"
            :rows="3"
            placeholder="要记忆的内容"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="助记">
          <el-input
            v-model="freeTextForm.mnemonic"
            type="textarea"
            :rows="2"
            placeholder="联想线索（可选）"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showFreeTextDialog = false">取消</el-button>
        <el-button type="primary" :disabled="!freeTextForm.text.trim()" @click="saveFreeText">保存</el-button>
      </template>
    </el-dialog>

    <!-- 挂载文章对话框 -->
    <el-dialog v-model="showArticleDialog" title="挂载文本记忆文章" width="560px">
      <el-form label-width="80px">
        <el-form-item label="文章" required>
          <el-select v-model="articleForm.articleId" placeholder="选择文章" style="width: 100%" filterable>
            <el-option
              v-for="article in textStore.articles"
              :key="article._id"
              :label="article.title"
              :value="article._id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="切块方式">
          <el-radio-group v-model="articleForm.mode">
            <el-radio value="sentence">按句</el-radio>
            <el-radio value="paragraph">按段</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <p v-if="selectedArticle" class="chunk-preview">
        将切为 {{ chunkCount }} 块，挂载到 {{ mountableCount }} 个空桩
        <template v-if="chunkCount > mountableCount">（块数超出空桩，多余部分不挂载）</template>
      </p>
      <template #footer>
        <el-button @click="showArticleDialog = false">取消</el-button>
        <el-button type="primary" :disabled="!selectedArticle || mountableCount === 0" @click="saveArticle">
          挂载
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import {computed, onMounted, ref} from 'vue';
import {useRoute, useRouter} from 'vue-router';
import {ElMessage, ElMessageBox} from 'element-plus';
import {ArrowLeft, Close, Collection, Edit, EditPen, View} from '@element-plus/icons-vue';
import {useMemoryPalaceStore} from '@/stores/memoryPalace';
import {useTextMemoryStore} from '@/stores/textMemory';
import {chunkArticleContent, resolvePegContent} from '@/utils/memory-palace-util';
import {getPegLevel, isMastered} from '@/utils/memory-palace-srs';
import type {ChunkMode, PalaceLocus, ResolvedPegContent} from '@/types/memory-palace';

const route = useRoute();
const router = useRouter();
const store = useMemoryPalaceStore();
const textStore = useTextMemoryStore();

const palaceId = route.params.id as string;

// 对话框状态
const showFreeTextDialog = ref(false);
const showArticleDialog = ref(false);
const freeTextForm = ref({locusOrder: 0, text: '', mnemonic: ''});
const articleForm = ref<{articleId: string; mode: ChunkMode}>({articleId: '', mode: 'sentence'});

const palace = computed(() => store.currentPalace);

const sortedLoci = computed<PalaceLocus[]>(() => {
  if (!palace.value) return [];
  return [...palace.value.loci].sort((a, b) => a.order - b.order);
});

const selectedArticle = computed(() => {
  return textStore.articles.find(a => a._id === articleForm.value.articleId) || null;
});

// 选中文章的切块数
const chunkCount = computed(() => {
  if (!selectedArticle.value) return 0;
  return chunkArticleContent(selectedArticle.value.content, articleForm.value.mode).length;
});

// 可挂载的空桩数
const mountableCount = computed(() => {
  if (!palace.value) return 0;
  const occupied = new Set(store.pegs.map(p => p.locusOrder));
  return palace.value.loci.filter(l => !occupied.has(l.order)).length;
});

onMounted(async () => {
  await store.loadPalaces();
  await store.loadPegs(palaceId);
  // 只读加载文章列表用于解析引用
  await textStore.loadArticles();
});

function pegOf(locusOrder: number) {
  return store.getPegByLocus(locusOrder);
}

function resolvePeg(locusOrder: number): ResolvedPegContent {
  const peg = pegOf(locusOrder);
  if (!peg) return {text: '', deleted: false};
  return resolvePegContent(peg, textStore.articles);
}

function pegLevel(locusOrder: number): number {
  const peg = pegOf(locusOrder);
  return peg ? getPegLevel(peg) : 0;
}

function pegLevelTagType(locusOrder: number): 'success' | 'info' {
  const peg = pegOf(locusOrder);
  return peg && isMastered(peg) ? 'success' : 'info';
}

// 自由文本挂载
function openFreeTextDialog(locusOrder: number) {
  const existing = pegOf(locusOrder);
  freeTextForm.value = {
    locusOrder,
    text: existing?.freeText || '',
    mnemonic: existing?.mnemonic || '',
  };
  showFreeTextDialog.value = true;
}

async function saveFreeText() {
  const result = await store.mountFreeText(
    palaceId,
    freeTextForm.value.locusOrder,
    freeTextForm.value.text,
    freeTextForm.value.mnemonic,
  );
  if (result.ok) {
    ElMessage.success('挂载成功');
    showFreeTextDialog.value = false;
  } else {
    ElMessage.error('挂载失败');
  }
}

// 文章切块挂载
function openArticleDialog() {
  articleForm.value = {articleId: '', mode: 'sentence'};
  showArticleDialog.value = true;
}

async function saveArticle() {
  if (!palace.value || !selectedArticle.value) return;
  const {result, mounted} = await store.mountArticle(palace.value, selectedArticle.value, articleForm.value.mode);
  if (result.ok) {
    ElMessage.success(`已挂载 ${mounted} 块`);
    showArticleDialog.value = false;
  } else {
    ElMessage.error(result.message || '挂载失败');
  }
}

// 解除挂载
async function handleUnmount(locusOrder: number) {
  const peg = pegOf(locusOrder);
  if (!peg) return;
  try {
    await ElMessageBox.confirm('确定解除该桩的挂载吗？', '确认', {
      confirmButtonText: '解除',
      cancelButtonText: '取消',
      type: 'warning',
    });
    const result = await store.unmountPeg(peg);
    if (result.ok) {
      ElMessage.success('已解除');
    } else {
      ElMessage.error('操作失败');
    }
  } catch {
    // 用户取消
  }
}

function goBack() {
  router.push('/memory-palace');
}

function goEdit() {
  router.push(`/memory-palace/edit/${palaceId}`);
}

function goReview() {
  router.push(`/memory-palace/${palaceId}/review`);
}
</script>

<style scoped lang="scss">
.palace-detail-page {
  width: 100%;
  min-height: 100vh;
  background-color: var(--utools-bg-secondary);
  padding-bottom: 55px;
  box-sizing: border-box;
}

.detail-header {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 0 12px;
  height: 40px;
  background: var(--utools-bg-card);
  border-bottom: 1px solid var(--utools-border-divider);

  .palace-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--utools-text-primary);
    line-height: 40px;
  }

  .palace-sub {
    font-size: 12px;
    color: var(--utools-text-tertiary);
  }
}

.loci-list-wrapper {
  width: 100%;
  min-height: calc(100vh - 40px - 55px);
  padding: 10px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.locus-card {
  width: 92%;
  min-height: auto;
  max-height: none;
  padding: 12px;
  margin-bottom: 8px;

  .locus-main {
    display: flex;
    gap: 10px;
    margin-bottom: 8px;

    .locus-image {
      flex-shrink: 0;
      width: 72px;
      height: 72px;
      object-fit: cover;
      border-radius: 6px;
      border: 1px solid var(--utools-border-divider);
    }

    .locus-info {
      flex: 1;
      min-width: 0;
    }
  }

  .locus-title-line {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 4px 0;

    .locus-order {
      font-size: 12px;
      color: var(--utools-text-tertiary);
    }

    .locus-name {
      font-size: 15px;
      font-weight: 600;
      color: var(--utools-text-primary);
    }
  }

  .locus-desc {
    font-size: 12px;
    color: var(--utools-text-tertiary);
    margin: 0 0 6px 0;
  }

  .peg-content {
    font-size: 13px;
    color: var(--utools-text-secondary);
    background: var(--utools-bg-tertiary);
    border-radius: 4px;
    padding: 6px 8px;

    .peg-text {
      word-break: break-all;
    }

    .peg-source {
      font-size: 12px;
      color: var(--utools-text-tertiary);
    }

    .peg-deleted {
      color: var(--utools-warning);
    }

    .peg-mnemonic {
      margin: 4px 0 0 0;
      font-size: 12px;
      color: var(--utools-warning);
    }
  }

  .peg-empty {
    font-size: 12px;
    color: var(--utools-text-tertiary);
  }

  .operate {
    margin-top: 4px;

    .operate-group {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }

    .iconHover {
      font-size: 20px;
      padding: 6px;
      border-radius: 6px;
      transition: all 0.2s;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;

      &:hover {
        background-color: var(--utools-bg-hover);
        transform: scale(1.1);
      }
    }
  }
}

.chunk-preview {
  font-size: 12px;
  color: var(--utools-text-secondary);
  margin: 0;
}

.home_footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: var(--utools-bg-card);
  height: 55px;
  border-top: 1px solid var(--utools-border-divider);
  padding: 0 12px;
  box-sizing: border-box;
  color: var(--utools-text-primary);
  z-index: 20;

  > div:first-child,
  > div:last-child {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .footer-stat {
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;
    color: var(--utools-text-secondary);

    &:hover {
      color: var(--utools-primary);
    }
  }

  .footer-icon {
    font-size: 20px;
    cursor: pointer;
    padding: 6px;
    border-radius: 6px;
    color: var(--utools-text-primary);
    transition: all 0.2s;

    &:hover {
      background-color: var(--utools-bg-hover);
    }
  }
}
</style>
