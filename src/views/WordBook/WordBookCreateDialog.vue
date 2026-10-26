<template>
  <el-dialog v-model="visible" title="筛选结果生成学习页" width="460px" :close-on-click-modal="false">
    <div class="create-summary">
      <strong>{{ words.length }} 个单词</strong>
      <span>每页 12 词 · 将生成 {{ pageCount }} 页</span>
    </div>
    <el-form label-position="top">
      <el-form-item v-if="store.chapters.length" label="整理到">
        <el-radio-group v-model="mode">
          <el-radio-button value="new">新建章节</el-radio-button>
          <el-radio-button value="append">追加到已有章节</el-radio-button>
        </el-radio-group>
      </el-form-item>
      <el-form-item v-if="mode === 'new'" label="章节名称">
        <el-input v-model="chapterName" maxlength="30" placeholder="如：词根词缀第一章" />
      </el-form-item>
      <el-form-item v-else label="选择章节">
        <el-select v-model="selectedChapter" style="width: 100%" placeholder="选择要追加的章节">
          <el-option v-for="chapter in store.chapters" :key="chapter._id" :label="chapter.name" :value="chapter._id" />
        </el-select>
      </el-form-item>
      <el-form-item label="学习页名称">
        <el-input v-model="pageTitle" maxlength="40" placeholder="如：词根 spect" />
      </el-form-item>
    </el-form>
    <p class="create-tip">单词按当前筛选顺序装页；完成一页解锁下一页，整章完成后解锁下一章。</p>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="saving" :disabled="!canSave" @click="confirm">生成并查看章节</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import {computed, ref, watch} from 'vue';
import {ElMessage} from 'element-plus';
import {useWordBookStore} from '@/stores/wordBook';
import {WORD_BOOK_PAGE_SIZE} from '@/utils/word-book';
import type {Word} from '@/types/words';

const props = defineProps<{
  modelValue: boolean;
  words: Word[];
  defaultName: string;
}>();
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'created', chapterId: string): void;
}>();

const store = useWordBookStore();
const mode = ref<'new' | 'append'>('new');
const chapterName = ref('');
const pageTitle = ref('');
const selectedChapter = ref('');
const saving = ref(false);

const visible = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value),
});
const pageCount = computed(() => Math.ceil(props.words.length / WORD_BOOK_PAGE_SIZE));
const canSave = computed(() => props.words.length > 0 && !!pageTitle.value.trim() && (mode.value === 'new' ? !!chapterName.value.trim() : !!selectedChapter.value));

watch(visible, open => {
  if (!open) return;
  mode.value = 'new';
  chapterName.value = props.defaultName;
  pageTitle.value = props.defaultName;
  selectedChapter.value = '';
  void store.loadChapters().catch(() => ElMessage.error('章节读取失败'));
});

async function confirm() {
  if (!canSave.value || saving.value) return;
  saving.value = true;
  try {
    const snapshots = props.words.map(word => ({
      sourceId: word._id,
      text: word.text,
      explains: word.explains,
      phonetic: word.phonetic,
    }));
    let chapterId = selectedChapter.value;
    if (mode.value === 'new') {
      const {result, chapter} = await store.createChapter(chapterName.value, pageTitle.value, snapshots);
      if (!result.ok) throw new Error(result.message || '章节创建失败');
      chapterId = chapter._id;
    } else {
      const result = await store.appendChapter(chapterId, pageTitle.value, snapshots);
      if (!result.ok) throw new Error(result.message || '学习页追加失败');
    }
    ElMessage.success(`已生成 ${pageCount.value} 个学习页`);
    visible.value = false;
    emit('created', chapterId);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '学习页生成失败');
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped lang="scss">
.create-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
  padding: 12px;
  color: var(--utools-text-secondary);
  background: var(--utools-bg-tertiary);
  border-radius: 6px;

  strong {
    color: var(--utools-primary);
    font-size: 18px;
  }

  span {
    font-size: 12px;
  }
}

.create-tip {
  margin: 0;
  color: var(--utools-text-tertiary);
  font-size: 12px;
  line-height: 1.6;
}
</style>
