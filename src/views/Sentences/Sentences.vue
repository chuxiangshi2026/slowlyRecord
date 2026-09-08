<template>
  <div class="sentences-page">
    <!-- 顶部：搜索 + 添加 -->
    <div class="toolbar">
      <el-input
        v-model="keyword"
        placeholder="搜索原句 / 译文 / 备注 / 来源"
        clearable
        class="search-input"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>
      <el-button type="primary" @click="showAddDialog = true">
        <el-icon><Plus /></el-icon>&nbsp;添加句子
      </el-button>
    </div>

    <!-- 标签筛选 -->
    <div v-if="sentencesStore.allTags.length" class="tag-filter">
      <el-check-tag
        :checked="!activeTag"
        @change="activeTag = ''"
      >全部</el-check-tag>
      <el-check-tag
        v-for="tag in sentencesStore.allTags"
        :key="tag"
        :checked="activeTag === tag"
        @change="activeTag = activeTag === tag ? '' : tag"
      >{{ tag }}</el-check-tag>
    </div>

    <!-- 句子卡片列表 -->
    <div v-loading="sentencesStore.loading" class="sentence-list">
      <el-empty v-if="!filteredSentences.length" description="暂无句子，去添加或划句收录吧" />
      <div v-for="item in filteredSentences" :key="item.id" class="sentence-card">
        <div class="sentence-main">
          <div class="sentence-text">{{ item.text }}</div>
          <div v-if="item.translation" class="sentence-translation">{{ item.translation }}</div>
          <div class="sentence-meta">
            <el-tag v-for="tag in item.tags" :key="tag" size="small" class="meta-tag">{{ tag }}</el-tag>
            <span v-if="item.source" class="meta-source">—— {{ item.source }}</span>
            <span class="meta-time">{{ formatTime(item.createdAt) }}</span>
          </div>
          <div v-if="item.note" class="sentence-note">心得：{{ item.note }}</div>
        </div>
        <div class="sentence-actions">
          <el-tooltip :content="item.favorite ? '取消收藏' : '收藏'">
            <el-icon class="action-icon" :class="{ favorited: item.favorite }" @click="toggleFavorite(item)">
              <StarFilled v-if="item.favorite" />
              <Star v-else />
            </el-icon>
          </el-tooltip>
          <el-tooltip content="编辑">
            <el-icon class="action-icon" @click="openEdit(item)"><Edit /></el-icon>
          </el-tooltip>
          <el-tooltip content="删除">
            <el-icon class="action-icon" @click="removeSentence(item)"><Delete /></el-icon>
          </el-tooltip>
        </div>
      </div>
    </div>

    <!-- 添加对话框 -->
    <el-dialog v-model="showAddDialog" title="添加句子" width="560px">
      <el-form label-width="60px">
        <el-form-item label="句子" required>
          <el-input v-model="addForm.text" type="textarea" :rows="3" placeholder="看到的唯美句子、喜欢的心得……" />
        </el-form-item>
        <el-form-item label="译文">
          <el-input v-model="addForm.translation" placeholder="可选，英文句子留空则自动翻译" />
        </el-form-item>
        <el-form-item label="标签">
          <el-input v-model="addForm.tagsText" placeholder="多个标签用逗号分隔，如：唯美, 励志" />
        </el-form-item>
        <el-form-item label="来源">
          <el-input v-model="addForm.source" placeholder="可选，书名 / 网页等" />
        </el-form-item>
        <el-form-item label="心得">
          <el-input v-model="addForm.note" type="textarea" :rows="2" placeholder="可选" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddDialog = false">取消</el-button>
        <el-button type="primary" :loading="adding" @click="addSentence">保存</el-button>
      </template>
    </el-dialog>

    <!-- 编辑对话框 -->
    <el-dialog v-model="showEditDialog" title="编辑句子" width="560px">
      <el-form label-width="60px">
        <el-form-item label="句子">
          <el-input v-model="editForm.text" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="译文">
          <el-input v-model="editForm.translation" />
        </el-form-item>
        <el-form-item label="标签">
          <el-input v-model="editForm.tagsText" placeholder="多个标签用逗号分隔" />
        </el-form-item>
        <el-form-item label="来源">
          <el-input v-model="editForm.source" />
        </el-form-item>
        <el-form-item label="心得">
          <el-input v-model="editForm.note" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditDialog = false">取消</el-button>
        <el-button type="primary" :loading="editing" @click="saveEdit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Search, Plus, Star, StarFilled, Edit, Delete } from '@element-plus/icons-vue';
import { useSentencesStore } from '@/stores/sentences';
import { useWordsStore } from '@/stores/words';
import type { Sentence } from '@/types/sentences';

const sentencesStore = useSentencesStore();
const wordsStore = useWordsStore();

const keyword = ref('');
const activeTag = ref('');

const filteredSentences = computed(() => {
  let list = sentencesStore.search(keyword.value);
  if (activeTag.value) {
    list = list.filter(s => s.tags.includes(activeTag.value));
  }
  return [...list].sort((a, b) => {
    if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
    return b.createdAt - a.createdAt;
  });
});

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseTags(text: string): string[] {
  return text.split(/[,，]/).map(t => t.trim()).filter(Boolean);
}

// ============ 添加 ============
const showAddDialog = ref(false);
const adding = ref(false);
const addForm = ref({ text: '', translation: '', tagsText: '', source: '', note: '' });

async function addSentence() {
  const text = addForm.value.text.trim();
  if (!text) {
    ElMessage.warning('请输入句子');
    return;
  }
  adding.value = true;
  try {
    let translation = addForm.value.translation.trim();
    // 英文句子未填译文时自动翻译，失败静默留空
    if (!translation && !/[一-龥]/.test(text)) {
      try {
        const res = await wordsStore.translateWithPlatform(text);
        if (res.success && res.explains) translation = res.explains;
      } catch { /* 忽略翻译失败 */ }
    }
    const res = await sentencesStore.add(text, {
      translation: translation || undefined,
      tags: parseTags(addForm.value.tagsText),
      source: addForm.value.source.trim() || undefined,
      note: addForm.value.note.trim() || undefined
    });
    if (res.success) {
      ElMessage.success('已加入句子库');
      showAddDialog.value = false;
      addForm.value = { text: '', translation: '', tagsText: '', source: '', note: '' };
    } else {
      ElMessage.warning(res.message);
    }
  } finally {
    adding.value = false;
  }
}

// ============ 编辑 ============
const showEditDialog = ref(false);
const editing = ref(false);
const editingId = ref('');
const editForm = ref({ text: '', translation: '', tagsText: '', source: '', note: '' });

function openEdit(item: Sentence) {
  editingId.value = item.id;
  editForm.value = {
    text: item.text,
    translation: item.translation || '',
    tagsText: item.tags.join(', '),
    source: item.source || '',
    note: item.note || ''
  };
  showEditDialog.value = true;
}

async function saveEdit() {
  editing.value = true;
  try {
    const res = await sentencesStore.update(editingId.value, {
      text: editForm.value.text.trim(),
      translation: editForm.value.translation.trim() || undefined,
      tags: parseTags(editForm.value.tagsText),
      source: editForm.value.source.trim() || undefined,
      note: editForm.value.note.trim() || undefined
    });
    if (res.success) {
      ElMessage.success('已更新');
      showEditDialog.value = false;
    } else {
      ElMessage.warning(res.message);
    }
  } finally {
    editing.value = false;
  }
}

// ============ 收藏 / 删除 ============
async function toggleFavorite(item: Sentence) {
  await sentencesStore.update(item.id, { favorite: !item.favorite });
}

async function removeSentence(item: Sentence) {
  try {
    await ElMessageBox.confirm('确定删除这条句子吗？', '删除确认', { type: 'warning' });
  } catch {
    return;
  }
  const res = await sentencesStore.remove(item.id);
  if (res.success) {
    ElMessage.success('已删除');
  } else {
    ElMessage.warning(res.message);
  }
}

onMounted(() => {
  sentencesStore.load();
});
</script>

<style scoped lang="scss">
.sentences-page {
  padding: 16px;
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;

  .search-input {
    max-width: 420px;
  }
}

.tag-filter {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.sentence-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sentence-card {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  background: var(--utools-bg-card);
  border: 1px solid var(--utools-border-secondary);
  border-radius: 8px;

  &:hover {
    background: var(--utools-bg-hover);
  }
}

.sentence-main {
  flex: 1;
  min-width: 0;
}

.sentence-text {
  font-size: 15px;
  line-height: 1.7;
  color: var(--utools-text-primary);
}

.sentence-translation {
  margin-top: 6px;
  font-size: 13px;
  color: var(--utools-text-secondary);
}

.sentence-meta {
  margin-top: 8px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 12px;
  color: var(--utools-text-tertiary);

  .meta-tag {
    margin-right: 0;
  }
}

.sentence-note {
  margin-top: 6px;
  font-size: 12px;
  color: var(--utools-text-secondary);
  background: var(--utools-primary-light);
  border-radius: 4px;
  padding: 4px 8px;
  display: inline-block;
}

.sentence-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 2px;

  .action-icon {
    cursor: pointer;
    color: var(--utools-text-tertiary);

    &:hover {
      color: var(--utools-primary);
    }

    &.favorited {
      color: var(--utools-primary);
    }
  }
}
</style>
