<template>
  <div class="number-mapping-page">
    <el-card class="main-card">
      <template #header>
        <div class="card-header">
          <span class="title">🖼️ 数字-图片映射设置</span>
          <div class="header-actions">
            <el-tag v-if="store.hasAssociations" type="success">
              已保存 {{ store.associationCount }} 个数字
            </el-tag>
            <el-button type="warning" @click="batchImportPresets">
              ⚡ 一键导入预设
            </el-button>
            <el-button type="primary" plain @click="handleExportImage">
              🖼️ 导出映射表图片
            </el-button>
            <el-button type="primary" plain @click="handlePrint">
              🖨️ 打印映射表
            </el-button>
            <el-button @click="goBack">
              返回
            </el-button>
          </div>
        </div>
      </template>

      <!-- 范围选择 -->
      <div class="range-selector">
        <el-radio-group v-model="numberRange" size="large">
          <el-radio-button label="single">个位数 (0-9)</el-radio-button>
          <el-radio-button label="zero-padded">前导零 (00-09)</el-radio-button>
          <el-radio-button label="double">两位数 (10-99)</el-radio-button>
          <el-radio-button label="all">全部 (0-99)</el-radio-button>
        </el-radio-group>
      </div>

      <!-- 输入区域 -->
      <div class="input-section">
        <el-row :gutter="20">
          <el-col :span="12">
            <div class="number-input-wrapper">
              <label class="section-label">
                选择数字
                <el-tag size="small" type="info">{{ rangeText }}</el-tag>
              </label>
              <div class="number-buttons" :class="{ 'double-digit': numberRange !== 'single', 'zero-padded': numberRange === 'zero-padded' || numberRange === 'all' }">
                <el-button
                  v-for="num in displayNumbers"
                  :key="num"
                  :type="selectedNumber === num ? 'primary' : 'default'"
                  size="large"
                  circle
                  @click="selectNumber(num)"
                  :class="{ 'has-image': associationMap.get(num) }"
                >
                  {{ formatNumberDisplay(num) }}
                  <el-icon v-if="associationMap.get(num)" class="check-icon"><Check /></el-icon>
                </el-button>
              </div>
            </div>
          </el-col>
          <el-col :span="12">
            <div class="current-association" v-if="selectedNumber !== null">
              <label class="section-label">
                数字 {{ selectedNumber }} 的关联
                <el-tag size="small" type="info">{{ keyword }}</el-tag>
              </label>
              <div class="current-image" v-if="currentAssociation">
                <!-- 用户上传的base64图片 -->
                <img v-if="isBase64Image(currentAssociation.imageUrl)" :src="currentAssociation.imageUrl" alt="已保存的图片" />
                <!-- 预设emoji图片 -->
                <div v-else class="emoji-display-large">{{ currentAssociation.imageUrl }}</div>
                <el-button
                  type="danger"
                  size="small"
                  @click="deleteCurrentAssociation"
                  class="delete-btn"
                >
                  <el-icon><Delete /></el-icon>
                  删除
                </el-button>
              </div>
              <div class="no-association" v-else>
                <el-empty description="暂无关联图片" :image-size="100" />
              </div>
            </div>
          </el-col>
        </el-row>
      </div>

      <el-divider />

      <!-- 图片选择区域 -->
      <div class="image-section" v-if="selectedNumber !== null">
        <label class="section-label">选择或上传图片</label>

        <!-- 预设推荐 -->
        <div class="preset-section">
          <h4>🎯 推荐图片（{{ keyword }}）</h4>
          <div class="preset-grid">
            <div
              v-for="item in recommendations"
              :key="item.name"
              class="preset-item"
              @click="selectPresetImage(item)"
              :class="{ selected: selectedImage === item.url }"
            >
              <div class="emoji-display">{{ item.url }}</div>
              <div class="preset-name">{{ item.name }}</div>
              <div class="preset-desc">{{ item.description }}</div>
            </div>
          </div>
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
              <el-button type="primary" plain>
                <el-icon><Upload /></el-icon>
                选择图片
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
        title="请先选择一个数字"
        type="info"
        :closable="false"
        center
        show-icon
      />
    </el-card>

    <!-- 已保存的关联列表 -->
    <el-card class="list-card" v-if="store.hasAssociations">
      <template #header>
        <span>📋 已保存的数字-图片关联</span>
      </template>
      <el-table :data="store.associations" style="width: 100%">
        <el-table-column prop="number" label="数字" width="80" align="center">
          <template #default="{ row }">
            <el-tag size="large">{{ row.number }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="图片" width="120" align="center">
          <template #default="{ row }">
            <!-- 用户上传的base64图片 -->
            <img v-if="isBase64Image(row.imageUrl)" :src="row.imageUrl" class="table-image" alt="图片" />
            <!-- 预设emoji图片 -->
            <span v-else class="table-emoji">{{ row.imageUrl }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="source" label="来源" width="100">
          <template #default="{ row }">
            <el-tag :type="row.source === 'preset' ? 'success' : 'warning'">
              {{ row.source === 'preset' ? '预设' : '上传' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button type="danger" size="small" @click="deleteAssociation(row.number)">
              <el-icon><Delete /></el-icon>
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 打印容器：屏幕隐藏，打印时显示的映射网格 -->
    <div class="print-area mapping-print-area">
      <div class="print-title">数字映射表</div>
      <div class="print-date">{{ printDate }} · {{ rangeText }}</div>
      <div class="print-grid">
        <div
          v-for="cell in printCells"
          :key="cell.number"
          class="print-cell"
          :class="{ empty: !cell.imageUrl }"
        >
          <div class="print-cell-number">{{ cell.number }}</div>
          <img
            v-if="cell.imageUrl && isBase64Image(cell.imageUrl)"
            :src="cell.imageUrl"
            class="print-cell-image"
            alt=""
          />
          <div v-else-if="cell.imageUrl" class="print-cell-emoji">{{ cell.imageUrl }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from "vue";
import { useRouter } from "vue-router";
import { useNumberMemoryStore } from "@/stores/numberMemory";
import { log } from "@/utils/logger";
import { ElMessage, ElMessageBox } from "element-plus";
import { Check, Delete, Upload } from "@element-plus/icons-vue";
import type { UploadFile } from "element-plus";
import { exportMappingAsImage, buildMappingGridCells } from "@/utils/mapping-image-export";

const router = useRouter();
const store = useNumberMemoryStore();

// State
const selectedNumber = ref<string | null>(null);
const selectedImage = ref<string>("");
const uploadedImage = ref<string>("");
const numberRange = ref<'single' | 'zero-padded' | 'double' | 'all'>('single');
const printDate = ref('');

// Computed
// 性能优化：缓存数字关联状态
const associationMap = computed(() => {
  const map = new Map<string, boolean>();
  displayNumbers.value.forEach(num => {
    map.set(num, store.hasAssociation(num));
  });
  return map;
});

const currentAssociation = computed(() => {
  if (selectedNumber.value === null) return null;
  return store.getAssociation(selectedNumber.value);
});

const recommendations = computed(() => {
  if (selectedNumber.value === null) return [];
  return store.getRecommendations(selectedNumber.value);
});

const keyword = computed(() => {
  if (selectedNumber.value === null) return "";
  return store.getKeyword(selectedNumber.value);
});

const displayNumbers = computed((): string[] => {
  switch (numberRange.value) {
    case 'single':
      return ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    case 'zero-padded':
      return ['00', '01', '02', '03', '04', '05', '06', '07', '08', '09'];
    case 'double':
      return Array.from({ length: 90 }, (_, i) => String(i + 10));
    case 'all':
    default:
      // 全部: 0-9, 00-09, 10-99
      return [
        '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
        '00', '01', '02', '03', '04', '05', '06', '07', '08', '09',
        ...Array.from({ length: 90 }, (_, i) => String(i + 10))
      ];
  }
});

const rangeText = computed(() => {
  switch (numberRange.value) {
    case 'single':
      return '0-9';
    case 'zero-padded':
      return '00-09';
    case 'double':
      return '10-99';
    case 'all':
    default:
      return '0-99';
  }
});

// 打印网格数据：当前范围内的全部数字（未配置的格子留空置灰）
const printCells = computed(() => buildMappingGridCells(displayNumbers.value, store.associations));

// Methods
function selectNumber(num: string) {
  selectedNumber.value = num;
  selectedImage.value = "";
  uploadedImage.value = "";
}

async function selectPresetImage(item: { name: string; url: string; description: string }) {
  if (selectedNumber.value === null) return;

  const result = await store.addAssociation(
    selectedNumber.value,
    item.url,
    "preset",
    item.description
  );

  if (result.ok) {
    ElMessage.success(`已保存数字 ${selectedNumber.value} 与 ${item.name} 的关联`);
    selectedImage.value = item.url;
  } else {
    ElMessage.error("保存失败");
  }
}

function handleImageChange(file: UploadFile) {
  if (!file.raw) return;

  // 检查文件大小（500KB 限制，避免 uTools DB 单条记录超限）
  if (file.raw.size > 500 * 1024) {
    ElMessage.warning('图片过大，建议压缩后上传');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    uploadedImage.value = e.target?.result as string;
  };
  reader.onerror = () => {
    ElMessage.error('图片读取失败');
    log.e('FileReader 读取图片失败');
  };
  reader.readAsDataURL(file.raw);
}

async function saveUploadedImage() {
  if (selectedNumber.value === null || !uploadedImage.value) return;

  const result = await store.addAssociation(
    selectedNumber.value,
    uploadedImage.value,
    "upload"
  );

  if (result.ok) {
    ElMessage.success(`已保存数字 ${selectedNumber.value} 的自定义图片`);
    uploadedImage.value = "";
  } else {
    ElMessage.error("保存失败");
  }
}

async function deleteAssociation(number: string) {
  try {
    await ElMessageBox.confirm(
      `确定要删除数字 ${number} 的图片关联吗？`,
      "确认删除",
      { type: "warning" }
    );

    const result = await store.deleteAssociation(number);
    if (result.ok) {
      ElMessage.success("删除成功");
      if (selectedNumber.value === number) {
        selectedNumber.value = null;
      }
    } else {
      ElMessage.error("删除失败");
    }
  } catch {
    // 用户取消
  }
}

async function deleteCurrentAssociation() {
  if (selectedNumber.value === null) return;
  await deleteAssociation(selectedNumber.value);
}

function goBack() {
  router.push("/number-memory");
}

/** 导出映射表图片：把当前范围的数字映射渲染成一张网格 PNG 下载 */
async function handleExportImage() {
  try {
    await exportMappingAsImage(displayNumbers.value, store.associations, {
      title: `数字映射表（${rangeText.value}）`,
    });
    ElMessage.success('图片已保存');
  } catch (e) {
    log.e('导出映射表图片失败', e);
    ElMessage.error('导出失败');
  }
}

/** 打印映射表：渲染打印容器后调用系统打印 */
async function handlePrint() {
  const now = new Date();
  printDate.value = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
  // 等 DOM 应用完打印样式后再触发打印
  await nextTick();
  window.print();
}

/**
 * 判断是否为base64格式的图片
 */
function isBase64Image(url: string): boolean {
  return url?.startsWith('data:image/') || false;
}

/**
 * 格式化数字显示
 * 直接返回数字字符串，因为 displayNumbers 已经格式化了
 */
function formatNumberDisplay(num: string): string {
  return num;
}

// 批量导入预设
async function batchImportPresets() {
  const rangeMap = {
    'single': { numbers: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'], text: '0-9' },
    'zero-padded': { numbers: ['00', '01', '02', '03', '04', '05', '06', '07', '08', '09'], text: '00-09' },
    'double': { numbers: Array.from({ length: 90 }, (_, i) => String(i + 10)), text: '10-99' },
    'all': {
      numbers: [
        '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
        '00', '01', '02', '03', '04', '05', '06', '07', '08', '09',
        ...Array.from({ length: 90 }, (_, i) => String(i + 10))
      ],
      text: '0-9, 00-09, 10-99'
    }
  };
  const { numbers, text } = rangeMap[numberRange.value];

  try {
    await ElMessageBox.confirm(
      `这将导入${text}所有数字的预设图片（每个数字第一个推荐），是否继续？`,
      "批量导入预设",
      { type: "info" }
    );

    const loading = ElMessage({
      message: "正在导入预设...",
      type: "info",
      duration: 0
    });

    let importedCount = 0;
    for (const num of numbers) {
      const recommendations = store.getRecommendations(num);
      if (recommendations.length > 0) {
        const first = recommendations[0];
        const result = await store.addAssociation(num, first.url, "preset", first.description);
        if (result.ok) {
          importedCount++;
        }
      }
    }

    loading.close();
    ElMessage.success(`成功导入 ${importedCount} 个数字的预设图片`);
  } catch {
    // 用户取消
  }
}
</script>

<style scoped lang="scss">
.number-mapping-page {
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

  .range-selector {
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

  .number-input-wrapper {
    .number-buttons {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      max-height: 300px;
      overflow-y: auto;
      padding: 5px;

      &.double-digit {
        .el-button {
          width: 56px;
          height: 56px;
          font-size: 16px;
        }
      }

      &.zero-padded {
        .el-button {
          width: 56px;
          height: 56px;
          font-size: 14px;
        }
      }

      .el-button {
        width: 50px;
        height: 50px;
        font-size: 18px;
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

<!-- 打印样式（非 scoped，需覆盖全局布局）：
     屏幕隐藏打印容器，打印时隐藏页面其余内容、仅输出映射网格 -->
<style lang="scss">
.mapping-print-area {
  display: none;
}

@media print {
  body {
    background: #fff !important;
  }

  .number-mapping-page {
    background: #fff !important;
    min-height: 0 !important;
    padding: 0 !important;
  }

  /* 只保留打印容器，其余（卡片、列表）全部隐藏 */
  .number-mapping-page > *:not(.mapping-print-area) {
    display: none !important;
  }

  .mapping-print-area {
    display: block;
    color: #000;

    .print-title {
      font-size: 20px;
      font-weight: 700;
      text-align: center;
      margin-bottom: 6px;
    }

    .print-date {
      font-size: 12px;
      color: #555;
      text-align: center;
      margin-bottom: 14px;
    }

    .print-grid {
      display: grid;
      grid-template-columns: repeat(10, 1fr);
      gap: 4px;
    }

    .print-cell {
      border: 1px solid #999;
      border-radius: 4px;
      padding: 2px;
      text-align: center;
      break-inside: avoid;

      &.empty {
        border-color: #ccc;
        background: #f5f5f5;

        .print-cell-number {
          color: #bbb;
        }
      }

      .print-cell-number {
        font-size: 11px;
        font-weight: 700;
        color: #333;
        line-height: 1.4;
      }

      .print-cell-emoji {
        font-size: 22px;
        line-height: 1.6;
      }

      .print-cell-image {
        width: 28px;
        height: 28px;
        object-fit: contain;
      }
    }
  }
}
</style>
