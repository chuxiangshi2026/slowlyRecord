<template>
  <div class="palace-edit-page">
    <div class="edit-container">
      <h2 class="edit-title">{{ isEdit ? '编辑宫殿' : '新建宫殿' }}</h2>

      <el-form label-width="80px">
        <el-form-item label="宫殿名称" required>
          <el-input
            v-model="formName"
            placeholder="如：我的家、上班路线"
            maxlength="30"
            show-word-limit
          />
        </el-form-item>
      </el-form>

      <!-- 宫殿总图（可选）：整体一张大图，如户型图/路线图 -->
      <div class="overview-section">
        <div class="overview-header">
          <span>宫殿总图（可选）</span>
          <el-button size="small" @click="triggerOverviewInput">
            {{ overviewImage ? '更换总图' : '上传总图' }}
          </el-button>
        </div>
        <div v-if="overviewImage" class="overview-preview">
          <img :src="overviewImage" alt="宫殿总图" />
          <el-button size="small" text type="danger" @click="overviewImage = ''">移除总图</el-button>
        </div>
        <p v-else class="overview-tip">上传一张宫殿整体图（如户型图、路线图），辅助回忆桩的位置</p>
      </div>

      <!-- 桩列表编辑 -->
      <div class="loci-header">
        <span>地点桩（{{ loci.length }} 个，按巡视顺序排列）</span>
        <el-button size="small" type="primary" plain @click="addLocus">
          <el-icon><Plus /></el-icon>
          添加桩
        </el-button>
      </div>

      <el-empty v-if="loci.length === 0" description="暂无地点桩，点击右上角添加" />

      <div v-for="(locus, index) in loci" :key="index" class="locus-editor list-item">
        <div class="locus-order-badge">{{ index + 1 }}</div>

        <div class="locus-fields">
          <div class="locus-row">
            <el-input v-model="locus.name" placeholder="桩名称（如：大门）" maxlength="20" class="locus-name-input" />
            <el-tooltip v-if="locus.alternates?.length" effect="dark" content="换成备选桩" placement="top">
              <el-button size="small" text @click="rotateAlternate(locus)">
                <el-icon><Refresh /></el-icon>
              </el-button>
            </el-tooltip>
            <el-button size="small" @click="triggerImageInput(index)">
              {{ locus.imageUrl ? '更换图片' : '上传图片' }}
            </el-button>
          </div>
          <el-input
            v-model="locus.description"
            placeholder="桩描述（可选）"
            maxlength="100"
            class="locus-desc-input"
          />
          <div v-if="locus.imageUrl" class="locus-image-preview">
            <img :src="locus.imageUrl" alt="桩图片" />
            <el-button size="small" text type="danger" @click="locus.imageUrl = undefined">移除图片</el-button>
          </div>
        </div>

        <div class="locus-actions">
          <el-tooltip effect="dark" content="上移" placement="top">
            <el-icon class="iconHover" :class="{ disabled: index === 0 }" @click="moveLocus(index, -1)"><Top /></el-icon>
          </el-tooltip>
          <el-tooltip effect="dark" content="下移" placement="top">
            <el-icon class="iconHover" :class="{ disabled: index === loci.length - 1 }" @click="moveLocus(index, 1)"><Bottom /></el-icon>
          </el-tooltip>
          <el-tooltip effect="dark" content="删除" placement="top">
            <el-icon class="iconHover" @click="removeLocus(index)"><Delete /></el-icon>
          </el-tooltip>
        </div>
      </div>

      <!-- 底部操作 -->
      <div class="edit-actions">
        <el-button @click="goBack">取消</el-button>
        <el-button type="primary" :disabled="!canSave" :loading="saving" @click="save">
          保存
        </el-button>
      </div>
    </div>

    <!-- 隐藏的图片文件输入 -->
    <input
      ref="imageInput"
      type="file"
      accept="image/*"
      style="display: none"
      @change="handleImageChange"
    />
    <!-- 隐藏的总图文件输入 -->
    <input
      ref="overviewInput"
      type="file"
      accept="image/*"
      style="display: none"
      @change="handleOverviewChange"
    />
  </div>
</template>

<script setup lang="ts">
import {computed, onMounted, ref} from 'vue';
import {useRoute, useRouter} from 'vue-router';
import {ElMessage} from 'element-plus';
import {Bottom, Delete, Plus, Refresh, Top} from '@element-plus/icons-vue';
import {useMemoryPalaceStore} from '@/stores/memoryPalace';
import {compressImage, compressImageFromDataURL} from '@/utils/image-compress';
import type {DbReturn} from '@/adapters/db';
import type {PalaceLocus} from '@/types/memory-palace';

const route = useRoute();
const router = useRouter();
const store = useMemoryPalaceStore();

// 编辑目标宫殿 id（空串表示新建）
const palaceId = (route.params.id as string) || '';
const isEdit = !!palaceId;

const formName = ref('');
const loci = ref<PalaceLocus[]>([]);
const overviewImage = ref('');
const saving = ref(false);

// 图片上传
const imageInput = ref<HTMLInputElement | null>(null);
const overviewInput = ref<HTMLInputElement | null>(null);
const currentImageIndex = ref(-1);

const canSave = computed(() => {
  return formName.value.trim() && loci.value.some(l => l.name.trim());
});

onMounted(async () => {
  if (!isEdit) return;
  await store.loadPalaces();
  const palace = store.palaces.find(p => p._id === palaceId);
  if (!palace) {
    ElMessage.error('宫殿不存在');
    goBack();
    return;
  }
  formName.value = palace.name;
  overviewImage.value = palace.overviewImage || '';
  // 深拷贝桩列表，避免直接改 store 数据
  loci.value = palace.loci.map(l => ({...l, alternates: l.alternates ? [...l.alternates] : undefined}));
});

function addLocus() {
  loci.value.push({order: loci.value.length + 1, name: '', description: ''});
}

function removeLocus(index: number) {
  loci.value.splice(index, 1);
}

// 上移/下移调整顺序
function moveLocus(index: number, delta: number) {
  const target = index + delta;
  if (target < 0 || target >= loci.value.length) return;
  const temp = loci.value[index];
  loci.value[index] = loci.value[target];
  loci.value[target] = temp;
}

function triggerImageInput(index: number) {
  currentImageIndex.value = index;
  imageInput.value?.click();
}

// 总图上传：尺寸给大一些（总图需要看清整体布局）
function triggerOverviewInput() {
  overviewInput.value?.click();
}

async function handleOverviewChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;

  try {
    overviewImage.value = await compressImage(file, {maxWidth: 800, maxHeight: 800, maxSizeBytes: 300 * 1024});
  } catch {
    ElMessage.error('图片处理失败');
  }
}

// 换成备选桩：当前名与备选列表循环轮换（新名取第一个备选，旧名追加到末尾）
function rotateAlternate(locus: PalaceLocus) {
  if (!locus.alternates?.length) return;
  const [next, ...rest] = locus.alternates;
  locus.alternates = [...rest, locus.name];
  locus.name = next;
}

// 选择图片后压缩为 dataURL
async function handleImageChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file || currentImageIndex.value < 0) return;

  try {
    const dataUrl = await compressImage(file, {maxWidth: 400, maxHeight: 400, maxSizeBytes: 150 * 1024});
    loci.value[currentImageIndex.value].imageUrl = dataUrl;
  } catch {
    ElMessage.error('图片处理失败');
  }
}

async function save() {
  saving.value = true;
  try {
    const result = await doSave(loci.value);
    if (result.ok) {
      ElMessage.success(isEdit ? '保存成功' : '创建成功');
      goBack();
    } else if (result.message === '图片过多，请减少桩图片或改用文字描述') {
      // 超限后尝试进一步压缩图片再保存一次
      const retryResult = await retryCompressAndSave();
      if (retryResult.ok) {
        ElMessage.success(isEdit ? '保存成功（已自动压缩图片）' : '创建成功（已自动压缩图片）');
        goBack();
      } else {
        ElMessage.error(retryResult.message || '保存失败：图片仍过大，请减少桩图片或改用文字描述');
      }
    } else {
      ElMessage.error(result.message || '保存失败');
    }
  } finally {
    saving.value = false;
  }
}

/** 执行保存，loci 中的 imageUrl 可以是 dataURL */
async function doSave(lociToSave: PalaceLocus[]): Promise<DbReturn> {
  if (isEdit) {
    const palace = store.palaces.find(p => p._id === palaceId);
    if (!palace) {
      return {ok: false, id: '', error: true, message: '宫殿不存在'};
    }
    return store.updatePalace({
      ...palace,
      name: formName.value,
      loci: lociToSave,
      overviewImage: overviewImage.value || undefined,
      utime: Date.now(),
    });
  }
  const {result} = await store.createPalace(formName.value, lociToSave, undefined, overviewImage.value);
  return result;
}

/** 将所有图片进一步压缩后重试保存（桩图 200×200/60KB，总图 400×400/120KB） */
async function retryCompressAndSave(): Promise<DbReturn> {
  try {
    const recompressed = await Promise.all(
      loci.value.map(async locus => {
        if (!locus.imageUrl || !locus.imageUrl.startsWith('data:')) return locus;
        const compressed = await compressImageFromDataURL(locus.imageUrl, {
          maxWidth: 200,
          maxHeight: 200,
          maxSizeBytes: 60 * 1024,
        });
        return {...locus, imageUrl: compressed};
      }),
    );
    loci.value = recompressed;
    if (overviewImage.value && overviewImage.value.startsWith('data:')) {
      overviewImage.value = await compressImageFromDataURL(overviewImage.value, {
        maxWidth: 400,
        maxHeight: 400,
        maxSizeBytes: 120 * 1024,
      });
    }
    return doSave(recompressed);
  } catch {
    return {ok: false, id: '', error: true, message: '图片压缩失败'};
  }
}

function goBack() {
  // 宫殿列表已并入文本记忆的宫殿视图
  router.push('/text-memory?view=palace');
}
</script>

<style scoped lang="scss">
.palace-edit-page {
  width: 100%;
  min-height: 100vh;
  background-color: var(--utools-bg-secondary);
  box-sizing: border-box;
  padding: 16px 0;
}

.edit-container {
  width: 92%;
  max-width: 720px;
  margin: 0 auto;
}

.edit-title {
  font-size: 18px;
  color: var(--utools-text-primary);
  margin: 0 0 16px 0;
}

.overview-section {
  margin-bottom: 8px;
  padding: 12px;
  background: var(--utools-bg-card);
  border: 1px solid var(--utools-border-divider);
  border-radius: 6px;

  .overview-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 14px;
    color: var(--utools-text-secondary);
    margin-bottom: 8px;
  }

  .overview-preview {
    display: flex;
    align-items: flex-start;
    gap: 8px;

    img {
      max-width: 100%;
      max-height: 160px;
      object-fit: contain;
      border-radius: 4px;
      border: 1px solid var(--utools-border-divider);
    }
  }

  .overview-tip {
    margin: 0;
    font-size: 12px;
    color: var(--utools-text-tertiary);
  }
}

.loci-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 16px 0 10px 0;
  font-size: 14px;
  color: var(--utools-text-secondary);
}

.locus-editor {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
  min-height: auto;
  max-height: none;
  padding: 12px;
  margin-bottom: 8px;
  box-sizing: border-box;

  .locus-order-badge {
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--utools-primary);
    color: #fff;
    font-size: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: 4px;
  }

  .locus-fields {
    flex: 1;
    min-width: 0;

    .locus-row {
      display: flex;
      gap: 8px;
      margin-bottom: 8px;
    }

    .locus-desc-input {
      margin-bottom: 8px;
    }

    .locus-image-preview {
      display: flex;
      align-items: center;
      gap: 8px;

      img {
        width: 64px;
        height: 64px;
        object-fit: cover;
        border-radius: 4px;
        border: 1px solid var(--utools-border-divider);
      }
    }
  }

  .locus-actions {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;

    .iconHover {
      font-size: 18px;
      padding: 4px;
      border-radius: 4px;
      cursor: pointer;
      color: var(--utools-text-secondary);
      transition: all 0.2s;

      &:hover {
        background-color: var(--utools-bg-hover);
      }

      &.disabled {
        opacity: 0.3;
        pointer-events: none;
      }
    }
  }
}

.edit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 16px;
}
</style>
