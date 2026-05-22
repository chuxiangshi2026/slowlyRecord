<template>
  <div class="letter-memory-page">
    <el-card class="main-card">
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <el-button @click="goBack" :icon="ArrowLeft" circle size="small" title="返回单词列表" />
            <span class="title">🔤 字母映射表</span>
          </div>
          <div class="header-actions">
            <el-tag v-if="store.hasAssociations" type="success">
              已映射 {{ store.associationCount }} 个
            </el-tag>
            <el-button @click="showAddDialog = true">
              ➕ 自定义组合
            </el-button>
            <el-button type="warning" @click="batchImportPresets">
              ⚡ 一键导入预设
            </el-button>
          </div>
        </div>
      </template>

      <!-- 字母选择模式 -->
      <div class="mode-selector">
        <el-radio-group v-model="displayMode" size="large">
          <el-radio-button label="alphabet">单字母 A-Z</el-radio-button>
          <el-radio-button label="combo">字母组合</el-radio-button>
          <el-radio-button label="all">全部</el-radio-button>
        </el-radio-group>
      </div>

      <!-- 字母/组合选择区域 -->
      <div class="input-section">
        <el-row :gutter="20">
          <el-col :span="12">
            <div class="letter-input-wrapper">
              <label class="section-label">
                选择{{ displayMode === 'alphabet' ? '字母' : displayMode === 'combo' ? '字母组合' : '字母/组合' }}
                <el-tag size="small" type="info">{{ displayLetters.length }} 个可选</el-tag>
              </label>
              <div class="letter-buttons">
                <el-button
                  v-for="item in displayLetters"
                  :key="item"
                  :type="selectedLetter === item ? 'primary' : 'default'"
                  size="large"
                  @click="selectLetter(item)"
                  :class="{ 'has-image': associationMap.get(item) }"
                >
                  {{ item.toUpperCase() }}
                  <el-icon v-if="associationMap.get(item)" class="check-icon"><Check /></el-icon>
                </el-button>
              </div>
            </div>
          </el-col>
          <el-col :span="12">
            <div class="current-association" v-if="selectedLetter !== null">
              <label class="section-label">
                {{ selectedLetter.toUpperCase() }} 的映射
                <el-tag size="small" type="info">{{ keyword }}</el-tag>
              </label>
              <div class="current-image" v-if="currentAssociation">
                <img v-if="isBase64Image(currentAssociation.imageUrl)" :src="currentAssociation.imageUrl" alt="已保存的图片" />
                <div v-else class="emoji-display-large">{{ currentAssociation.imageUrl }}</div>
                <div class="association-desc" v-if="currentAssociation.description">
                  {{ currentAssociation.description }}
                </div>
                <el-button
                  type="danger"
                  size="small"
                  @click="deleteCurrentAssociation"
                  class="delete-btn"
                >
                  <el-icon><Delete /></el-icon>
                  删除映射
                </el-button>
              </div>
              <div class="no-association" v-else>
                <el-empty description="暂无映射图片" :image-size="100" />
              </div>
            </div>
          </el-col>
        </el-row>
      </div>

      <el-divider />

      <!-- 图片选择区域 -->
      <div class="image-section" v-if="selectedLetter !== null">
        <label class="section-label">选择或上传映射图片</label>

        <!-- 预设推荐 -->
        <div class="preset-section">
          <h4>🎯 推荐映射（{{ keyword }}）</h4>
          <div class="preset-grid">
            <div
              v-for="item in recommendations"
              :key="item.name"
              class="preset-item"
              @click="selectPresetImage(item)"
              :class="{ selected: currentAssociation?.imageUrl === item.url }"
            >
              <div class="emoji-display">{{ item.url }}</div>
              <div class="preset-name">{{ item.name }}</div>
              <div class="preset-desc">{{ item.description }}</div>
            </div>
          </div>
        </div>

        <!-- Emoji 搜索选择 -->
        <div class="emoji-section">
          <h4>😀 Emoji 选择</h4>
          <el-input
            v-model="emojiSearchKeyword"
            placeholder="搜索 Emoji，如：苹果、猫、心..."
            clearable
            style="margin-bottom: 10px;"
          />
          <div class="emoji-grid" v-if="filteredEmojiList.length">
            <div
              v-for="emoji in filteredEmojiList"
              :key="emoji.emoji"
              class="emoji-item"
              :title="emoji.name"
              @click="selectEmoji(emoji.emoji)"
              :class="{ selected: customEmoji === emoji.emoji }"
            >
              <span class="emoji-char">{{ emoji.emoji }}</span>
              <span class="emoji-label">{{ emoji.name }}</span>
            </div>
          </div>
          <el-empty v-else description="未找到匹配的 Emoji" :image-size="40" />
        </div>

        <!-- 自定义上传 -->
        <div class="upload-section">
          <h4>📤 上传自定义图片</h4>
          <div class="upload-wrapper">
            <el-upload
              class="image-uploader"
              action="#"
              :auto-upload="false"
              :on-change="handleImageChange"
              :show-file-list="false"
              accept="image/*"
            >
              <el-button type="primary" plain :loading="isCompressing">
                <el-icon><Upload /></el-icon>
                {{ isCompressing ? '压缩中...' : '选择图片' }}
              </el-button>
            </el-upload>
            <div v-if="uploadedImage" class="upload-preview">
              <img :src="uploadedImage" alt="上传预览" />
              <el-button type="success" @click="saveUploadedImage">
                <el-icon><Check /></el-icon>
                保存此图片
              </el-button>
            </div>
          </div>
        </div>
      </div>

      <!-- 提示信息 -->
      <el-alert
        v-else
        title="请先选择一个字母或字母组合"
        type="info"
        :closable="false"
        center
        show-icon
      />
    </el-card>

    <!-- 已保存的映射列表 -->
    <el-card class="list-card" v-if="store.hasAssociations">
      <template #header>
        <div class="list-header">
          <span>📋 已保存的字母映射</span>
          <el-input
            v-model="searchKeyword"
            placeholder="搜索字母..."
            clearable
            style="width: 200px;"
            size="small"
          />
        </div>
      </template>
      <el-table :data="filteredAssociations" style="width: 100%">
        <el-table-column prop="letter" label="字母/组合" width="120" align="center">
          <template #default="{ row }">
            <el-tag size="large" :type="row.letter.length > 1 ? 'warning' : undefined">
              {{ row.letter.toUpperCase() }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="图片" width="120" align="center">
          <template #default="{ row }">
            <img v-if="isBase64Image(row.imageUrl)" :src="row.imageUrl" class="table-image" alt="图片" />
            <span v-else class="table-emoji">{{ row.imageUrl }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" min-width="150">
          <template #default="{ row }">
            {{ row.description || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="source" label="来源" width="100">
          <template #default="{ row }">
            <el-tag :type="row.source === 'preset' ? 'success' : row.source === 'emoji' ? undefined : 'warning'">
              {{ row.source === 'preset' ? '预设' : row.source === 'emoji' ? 'Emoji' : '上传' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button type="danger" size="small" @click="deleteAssociation(row.letter)">
              <el-icon><Delete /></el-icon>
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 自定义字母组合对话框 -->
    <el-dialog v-model="showAddDialog" title="添加自定义字母组合" width="400px">
      <el-form label-width="100px">
        <el-form-item label="字母组合">
          <el-input v-model="newComboLetter" placeholder="如: ch, sh, th" maxlength="10" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddDialog = false">取消</el-button>
        <el-button type="primary" @click="addComboLetter">添加</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useLetterMemoryStore } from "@/stores/letterMemory";
import { useWordsStore } from "@/stores/words";
import { ElMessage, ElMessageBox } from "element-plus";
import { Check, Delete, Upload, ArrowLeft } from "@element-plus/icons-vue";
import type { UploadFile } from "element-plus";
import { getAlphabetLetters, getComboLetters } from "@/utils/letter-memory-preset";
import { compressImage } from "@/utils/image-compress";
import { EMOJI_LIST } from "@/utils/emoji-data";
import { log } from "@/utils/logger";

const store = useLetterMemoryStore();
const wordsStore = useWordsStore();
const router = useRouter();

// State
const selectedLetter = ref<string | null>(null);
const uploadedImage = ref<string>("");
const isCompressing = ref(false);
const customEmoji = ref<string>("");
const emojiSearchKeyword = ref<string>("");
const displayMode = ref<'alphabet' | 'combo' | 'all'>('alphabet');
const searchKeyword = ref<string>("");
const showAddDialog = ref<boolean>(false);
const newComboLetter = ref<string>("");

// 自定义字母组合
const customCombos = ref<string[]>([]);

// Computed
const displayLetters = computed((): string[] => {
  const combos = getComboLetters();
  const customList = customCombos.value.filter(c => !combos.includes(c));
  switch (displayMode.value) {
    case 'alphabet':
      return getAlphabetLetters();
    case 'combo':
      return [...combos, ...customList];
    case 'all':
    default:
      return [...getAlphabetLetters(), ...combos, ...customList];
  }
});

const associationMap = computed(() => {
  const map = new Map<string, boolean>();
  displayLetters.value.forEach(letter => {
    map.set(letter, store.hasAssociation(letter));
  });
  return map;
});

const currentAssociation = computed(() => {
  if (selectedLetter.value === null) return null;
  return store.getAssociation(selectedLetter.value);
});

const recommendations = computed(() => {
  if (selectedLetter.value === null) return [];
  return store.getRecommendations(selectedLetter.value);
});

const keyword = computed(() => {
  if (selectedLetter.value === null) return "";
  return store.getKeyword(selectedLetter.value);
});

const filteredAssociations = computed(() => {
  if (!searchKeyword.value) return store.associations;
  const kw = searchKeyword.value.toLowerCase();
  return store.associations.filter(a =>
    a.letter.toLowerCase().includes(kw) ||
    (a.description && a.description.toLowerCase().includes(kw))
  );
});

// Emoji 搜索过滤
const filteredEmojiList = computed(() => {
  if (!emojiSearchKeyword.value.trim()) return EMOJI_LIST.slice(0, 60);
  const kw = emojiSearchKeyword.value.trim().toLowerCase();
  return EMOJI_LIST.filter(e =>
    e.name.includes(kw) ||
    e.keywords?.some(k => k.includes(kw))
  ).slice(0, 60);
});

// Methods
function goBack() {
  router.push('/word');
}

function selectLetter(letter: string) {
  selectedLetter.value = letter;
  uploadedImage.value = "";
  customEmoji.value = "";
  emojiSearchKeyword.value = "";
}

function selectEmoji(emoji: string) {
  customEmoji.value = emoji;
  saveCustomEmoji();
}

async function selectPresetImage(item: { name: string; url: string; description: string }) {
  if (selectedLetter.value === null) return;

  const result = await store.addAssociation(
    selectedLetter.value,
    item.url,
    "preset",
    item.description
  );

  if (result.ok) {
    ElMessage.success(`已保存 ${selectedLetter.value.toUpperCase()} → ${item.name} 的映射`);
  } else if ((result as any).error === 'duplicate') {
    ElMessage.warning((result as any).message);
  } else {
    ElMessage.error("保存失败");
  }
}

async function saveCustomEmoji() {
  if (selectedLetter.value === null || !customEmoji.value) return;

  const result = await store.addAssociation(
    selectedLetter.value,
    customEmoji.value,
    "emoji",
    `${selectedLetter.value.toUpperCase()} 自定义映射`
  );

  if (result.ok) {
    ElMessage.success(`已保存 ${selectedLetter.value.toUpperCase()} → ${customEmoji.value} 的映射`);
    customEmoji.value = "";
  } else if ((result as any).error === 'duplicate') {
    ElMessage.warning((result as any).message);
  } else {
    ElMessage.error("保存失败");
  }
}

function handleImageChange(file: UploadFile) {
  if (!file.raw) return;

  // 自动压缩图片，限制大小 100KB，最大尺寸 200x200
  isCompressing.value = true;
  compressImage(file.raw, {
    maxWidth: 200,
    maxHeight: 200,
    quality: 0.7,
    maxSizeBytes: 100 * 1024, // 100KB
  })
    .then((dataUrl) => {
      uploadedImage.value = dataUrl;
      ElMessage.success('图片已自动压缩');
    })
    .catch((err) => {
      ElMessage.error('图片处理失败：' + (err instanceof Error ? err.message : '未知错误'));
      log.e('图片压缩失败', err);
    })
    .finally(() => {
      isCompressing.value = false;
    });
}

async function saveUploadedImage() {
  if (selectedLetter.value === null || !uploadedImage.value) return;

  const result = await store.addAssociation(
    selectedLetter.value,
    uploadedImage.value,
    "upload"
  );

  if (result.ok) {
    ElMessage.success(`已保存 ${selectedLetter.value.toUpperCase()} 的自定义图片`);
    uploadedImage.value = "";
  } else if ((result as any).error === 'duplicate') {
    ElMessage.warning((result as any).message);
  } else {
    ElMessage.error("保存失败");
  }
}

async function deleteAssociation(letter: string) {
  try {
    await ElMessageBox.confirm(
      `确定要删除 ${letter.toUpperCase()} 的图片映射吗？`,
      "确认删除",
      { type: "warning" }
    );

    const result = await store.deleteAssociation(letter);
    if (result.ok) {
      ElMessage.success("删除成功");
      if (selectedLetter.value === letter) {
        selectedLetter.value = null;
      }
    } else {
      ElMessage.error("删除失败");
    }
  } catch {
    // 用户取消
  }
}

async function deleteCurrentAssociation() {
  if (selectedLetter.value === null) return;
  await deleteAssociation(selectedLetter.value);
}

async function batchImportPresets() {
  try {
    await ElMessageBox.confirm(
      `这将导入 A-Z 所有字母的预设映射图片（每个字母第一个推荐），是否继续？`,
      "批量导入预设",
      { type: "info" }
    );

    const loading = ElMessage({
      message: "正在导入预设...",
      type: "info",
      duration: 0
    });

    const importedCount = await store.batchImportPresets();

    loading.close();
    ElMessage.success(`成功导入 ${importedCount} 个字母的预设映射`);
  } catch {
    // 用户取消
  }
}

function addComboLetter() {
  const letter = newComboLetter.value.trim().toLowerCase();
  if (!letter) {
    ElMessage.warning("请输入字母组合");
    return;
  }
  if (!/^[a-zA-Z]+$/.test(letter)) {
    ElMessage.warning("只能输入英文字母");
    return;
  }
  if (letter.length < 2) {
    ElMessage.warning("字母组合至少需要2个字母");
    return;
  }
  if (customCombos.value.includes(letter) || getComboLetters().includes(letter)) {
    ElMessage.warning("该字母组合已存在");
    return;
  }

  customCombos.value.push(letter);
  showAddDialog.value = false;
  newComboLetter.value = "";
  ElMessage.success(`已添加字母组合 ${letter.toUpperCase()}`);

  // 自动切换到组合模式
  displayMode.value = 'combo';
}

function isBase64Image(url: string): boolean {
  return url?.startsWith('data:image/') || false;
}

onMounted(() => {
  wordsStore.setLastVisitedPage('/letter-memory');
});
</script>

<style scoped lang="scss">
.letter-memory-page {
  padding: 20px;
  width: 100%;
  box-sizing: border-box;
  min-height: 100vh;
  background-color: var(--utools-bg-secondary);

  .main-card {
    margin-bottom: 20px;
    background-color: var(--utools-bg-card);
    border-color: var(--utools-border-primary);
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .title {
      font-size: 18px;
      font-weight: bold;
      color: var(--utools-text-primary);
    }

    .header-actions {
      display: flex;
      gap: 10px;
      align-items: center;
      flex-wrap: wrap;
    }
  }

  .mode-selector {
    margin-bottom: 20px;
    text-align: center;
  }

  .section-label {
    display: block;
    font-weight: bold;
    margin-bottom: 15px;
    color: var(--utools-text-secondary);

    .el-tag {
      margin-left: 10px;
    }
  }

  .letter-input-wrapper {
    .letter-buttons {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      max-height: 400px;
      overflow-y: auto;
      padding: 5px;

      .el-button {
        width: 50px;
        height: 50px;
        font-size: 18px;
        font-weight: bold;
        position: relative;
        flex-shrink: 0;

        &.has-image {
          border-color: var(--utools-success);
          border-width: 2px;
        }

        .check-icon {
          position: absolute;
          top: -5px;
          right: -5px;
          font-size: 12px;
          color: var(--utools-success);
          background: var(--utools-bg-card);
          border-radius: 50%;
        }
      }
    }
  }

  .current-association {
    .current-image {
      text-align: center;

      img {
        width: 120px;
        height: 120px;
        object-fit: contain;
        border: 2px solid var(--utools-border-primary);
        border-radius: 8px;
        margin-bottom: 10px;
      }

      .emoji-display-large {
        font-size: 80px;
        line-height: 120px;
        margin-bottom: 10px;
      }

      .association-desc {
        font-size: 14px;
        color: var(--utools-text-secondary);
        margin-bottom: 10px;
      }

      .delete-btn {
        display: block;
        margin: 0 auto;
      }
    }

    .no-association {
      padding: 20px;
    }
  }

  .preset-section {
    margin-bottom: 30px;

    h4 {
      margin-bottom: 15px;
      color: var(--utools-primary);
    }

    .preset-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: 15px;

      .preset-item {
        border: 2px solid var(--utools-border-primary);
        border-radius: 8px;
        padding: 15px;
        text-align: center;
        cursor: pointer;
        transition: all 0.3s;
        background-color: var(--utools-bg-card);

        &:hover {
          border-color: var(--utools-primary);
          transform: translateY(-2px);
        }

        &.selected {
          border-color: var(--utools-success);
          background-color: var(--utools-primary-light);
        }

        .emoji-display {
          font-size: 48px;
          margin-bottom: 8px;
        }

        .preset-name {
          font-weight: bold;
          font-size: 14px;
          margin-bottom: 4px;
          color: var(--utools-text-primary);
        }

        .preset-desc {
          font-size: 12px;
          color: var(--utools-text-tertiary);
        }
      }
    }
  }

  .emoji-section {
    margin-bottom: 30px;

    h4 {
      margin-bottom: 15px;
      color: var(--utools-primary);
    }

    .emoji-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
      gap: 8px;
      max-height: 260px;
      overflow-y: auto;
      padding: 4px;

      .emoji-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 8px 4px;
        border: 2px solid var(--utools-border-primary);
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s;
        background-color: var(--utools-bg-card);

        &:hover {
          border-color: var(--utools-primary);
          transform: scale(1.05);
        }

        &.selected {
          border-color: var(--utools-success);
          background-color: var(--utools-primary-light);
        }

        .emoji-char {
          font-size: 32px;
          line-height: 1.2;
        }

        .emoji-label {
          font-size: 11px;
          color: var(--utools-text-tertiary);
          margin-top: 4px;
          text-align: center;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 100%;
        }
      }
    }
  }

  .upload-section {
    h4 {
      margin-bottom: 15px;
      color: var(--utools-primary);
    }

    .upload-wrapper {
      .upload-preview {
        margin-top: 15px;
        text-align: center;

        img {
          width: 150px;
          height: 150px;
          object-fit: contain;
          border: 2px solid var(--utools-border-primary);
          border-radius: 8px;
          margin-bottom: 10px;
          display: block;
          margin-left: auto;
          margin-right: auto;
        }
      }
    }
  }

  .list-card {
    background-color: var(--utools-bg-card);
    border-color: var(--utools-border-primary);

    .list-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .table-image {
      width: 50px;
      height: 50px;
      object-fit: contain;
      border-radius: 4px;
    }

    .table-emoji {
      font-size: 32px;
      line-height: 50px;
    }
  }
}
</style>
