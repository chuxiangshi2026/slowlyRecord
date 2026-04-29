<template>
  <div class="shortcut-memory-page">
    <el-card class="main-card">
      <template #header>
        <div class="card-header">
          <span class="title">⌨️ 快捷键记忆训练</span>
          <div class="header-actions">
            <el-button @click="openCategoryDialog()">
              ➕ 新增分类
            </el-button>
            <el-button @click="showHistory = true">
              📊 训练历史
            </el-button>
          </div>
        </div>
      </template>

      <!-- 分类选择 -->
      <div class="category-section" v-if="!selectedCategory">
        <h3 class="section-title">选择快捷键分类</h3>
        <div class="category-grid">
          <div
            v-for="category in store.categories"
            :key="category.name"
            class="category-card"
            @click="selectCategory(category.name)"
          >
            <div class="category-actions" @click.stop>
              <el-button
                type="primary"
                size="small"
                text
                @click="openCategoryDialog(category.name)"
              >
                编辑
              </el-button>
              <el-button
                type="danger"
                size="small"
                text
                @click="deleteCategory(category.name)"
              >
                删除
              </el-button>
            </div>
            <div class="category-icon">{{ getCategoryIcon(category.name) }}</div>
            <div class="category-name">{{ category.name }}</div>
            <div class="category-desc">{{ category.description }}</div>
            <div class="category-count">{{ category.count }} 个快捷键</div>
            <el-progress
              :percentage="store.getCategoryProgress(category.name)"
              :stroke-width="6"
              :show-text="true"
              class="category-progress"
            />
          </div>
        </div>
      </div>

      <!-- 快捷键列表 -->
      <div class="shortcut-list-section" v-else>
        <div class="list-header">
          <el-button @click="selectedCategory = ''">
            <el-icon><ArrowLeft /></el-icon>
            返回分类
          </el-button>
          <span class="list-title">{{ selectedCategory }} - 快捷键列表</span>
          <div class="list-actions">
            <el-button type="danger" plain @click="clearProgress">
              重置进度
            </el-button>
            <el-button @click="openAddDialog">
              ➕ 新增快捷键
            </el-button>
            <el-button type="primary" @click="startKeyPressTraining">
              🎯 按键训练
            </el-button>
            <el-button type="success" @click="startFunctionSelectTraining">
              🧩 功能选择
            </el-button>
          </div>
        </div>

        <el-table
          :data="store.currentShortcuts"
          style="width: 100%"
          stripe
          class="shortcut-table"
        >
          <el-table-column type="index" width="45" align="center" />
          <el-table-column prop="functionName" label="功能" min-width="80">
            <template #default="{ row }">
              <el-tag size="small" type="primary" class="wrap-tag">{{ row.functionName }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="description" label="功能描述" min-width="100">
            <template #default="{ row }">
              <span class="desc-text">{{ row.description }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="keys" label="快捷键" width="160" align="center">
            <template #default="{ row }">
              <div class="keys-display">
                <el-tag
                  v-for="(key, index) in row.keys"
                  :key="index"
                  size="small"
                  type="warning"
                  class="key-tag"
                >
                  {{ key }}
                </el-tag>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="80" align="center">
            <template #default="{ row }">
              <el-tag
                v-if="isMastered(row.id)"
                type="success"
                size="small"
              >
                已掌握
              </el-tag>
              <el-tag
                v-else
                type="info"
                size="small"
              >
                未掌握
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="135" align="center">
            <template #default="{ row }">
              <el-button
                type="primary"
                size="small"
                @click="openMemoryCard(row)"
              >
                记忆
              </el-button>
              <el-button
                type="warning"
                size="small"
                @click="openEditShortcutDialog(row)"
              >
                编辑
              </el-button>
              <el-button
                v-if="isCustomItem(row.id)"
                type="danger"
                size="small"
                @click="deleteCustomItem(row)"
              >
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-card>

    <!-- 记忆卡片弹窗 -->
    <el-dialog
      v-model="showMemoryCard"
      :title="currentItem?.functionName"
      width="420px"
      align-center
      class="memory-card-dialog"
    >
      <div class="memory-card" v-if="currentItem">
        <div class="card-description">
          <p>{{ currentItem.description }}</p>
        </div>
        <div class="card-keys">
          <div
            v-for="(key, index) in currentItem.keys"
            :key="index"
            class="card-key"
          >
            {{ key }}
          </div>
        </div>
        <div class="card-hint">
          <el-tag type="info" size="small">{{ currentItem.category }}</el-tag>
          <el-tag type="warning" size="small">{{ currentItem.platform }}</el-tag>
        </div>
        <KeyboardVisual
          :pressed-keys="new Set()"
          :target-keys="currentItem.keys"
          class="card-keyboard"
        />
      </div>
    </el-dialog>

    <!-- 新增快捷键弹窗 -->
    <el-dialog
      v-model="showAddDialog"
      title="新增快捷键"
      width="480px"
      align-center
    >
      <el-form
        ref="addFormRef"
        :model="addForm"
        :rules="addRules"
        label-width="90px"
      >
        <el-form-item label="所属分类" prop="category">
          <el-select
            v-model="addForm.category"
            placeholder="选择或输入分类"
            allow-create
            filterable
          >
            <el-option
              v-for="cat in store.categories"
              :key="cat.name"
              :label="cat.name"
              :value="cat.name"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="功能名称" prop="functionName">
          <el-input v-model="addForm.functionName" placeholder="如：复制、粘贴" />
        </el-form-item>
        <el-form-item label="功能描述" prop="description">
          <el-input
            v-model="addForm.description"
            type="textarea"
            :rows="2"
            placeholder="描述这个快捷键的作用"
          />
        </el-form-item>
        <el-form-item label="快捷键" prop="keysText">
          <el-input
            v-model="addForm.keysText"
            placeholder="如：Ctrl + C，用 + 分隔"
          />
          <div class="form-tip">用 + 分隔各个按键，如：Ctrl + Shift + N</div>
        </el-form-item>
        <el-form-item label="平台" prop="platform">
          <el-radio-group v-model="addForm.platform">
            <el-radio-button label="common">通用</el-radio-button>
            <el-radio-button label="win">Windows</el-radio-button>
            <el-radio-button label="mac">Mac</el-radio-button>
            <el-radio-button label="linux">Linux</el-radio-button>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddDialog = false">取消</el-button>
        <el-button type="primary" @click="submitAdd">确定</el-button>
      </template>
    </el-dialog>

    <!-- 编辑快捷键弹窗 -->
    <el-dialog
      v-model="showEditShortcutDialog"
      title="编辑快捷键"
      width="480px"
      align-center
    >
      <el-form
        ref="editShortcutFormRef"
        :model="editShortcutForm"
        :rules="editShortcutRules"
        label-width="90px"
      >
        <el-form-item label="功能名称" prop="functionName">
          <el-input v-model="editShortcutForm.functionName" />
        </el-form-item>
        <el-form-item label="功能描述" prop="description">
          <el-input
            v-model="editShortcutForm.description"
            type="textarea"
            :rows="2"
          />
        </el-form-item>
        <el-form-item label="快捷键" prop="keysText">
          <el-input v-model="editShortcutForm.keysText" />
          <div class="form-tip">用 + 分隔各个按键，如：Ctrl + Shift + N</div>
        </el-form-item>
        <el-form-item label="平台" prop="platform">
          <el-radio-group v-model="editShortcutForm.platform">
            <el-radio-button label="common">通用</el-radio-button>
            <el-radio-button label="win">Windows</el-radio-button>
            <el-radio-button label="mac">Mac</el-radio-button>
            <el-radio-button label="linux">Linux</el-radio-button>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditShortcutDialog = false">取消</el-button>
        <el-button type="primary" @click="submitEditShortcut">确定</el-button>
      </template>
    </el-dialog>

    <!-- 分类管理弹窗 -->
    <el-dialog
      v-model="showCategoryDialog"
      :title="isEditCategory ? '编辑分类' : '新增分类'"
      width="520px"
      align-center
    >
      <el-form
        ref="categoryFormRef"
        :model="categoryForm"
        :rules="categoryRules"
        label-width="100px"
      >
        <el-form-item label="分类名称" prop="name">
          <el-input
            v-model="categoryForm.name"
            placeholder="如：MyApp 快捷键"
          />
        </el-form-item>
        <el-form-item label="分类描述" prop="description">
          <el-input
            v-model="categoryForm.description"
            type="textarea"
            :rows="2"
            placeholder="描述该分类的用途"
          />
        </el-form-item>
        <el-form-item label="图标" prop="icon">
          <el-input v-model="categoryForm.icon" placeholder="如：⌨️、📝、🎨" />
        </el-form-item>

        <template v-if="!isEditCategory">
          <el-form-item label="数据来源">
            <el-radio-group v-model="categoryForm.sourceType">
              <el-radio-button label="empty">空白分类</el-radio-button>
              <el-radio-button label="copy">导入现有</el-radio-button>
              <el-radio-button label="import">导入 JSON</el-radio-button>
            </el-radio-group>
          </el-form-item>

          <el-form-item
            v-if="categoryForm.sourceType === 'copy'"
            label="选择分类"
          >
            <el-select v-model="copyFromCategory" placeholder="选择要复制的分类">
              <el-option
                v-for="cat in store.categories"
                :key="cat.name"
                :label="cat.name"
                :value="cat.name"
              />
            </el-select>
          </el-form-item>

          <el-form-item
            v-if="categoryForm.sourceType === 'import'"
            label="JSON 数据"
          >
            <el-input
              v-model="importJsonText"
              type="textarea"
              :rows="6"
              placeholder="粘贴 JSON 数据"
            />
            <div class="form-tip json-tip">
              <div>格式示例：</div>
              <pre>
[
  {
    "functionName": "复制",
    "description": "复制选中的内容",
    "keys": ["Ctrl", "C"],
    "platform": "common"
  }
]</pre>
              <div>platform 可选：common / win / mac / linux</div>
            </div>
          </el-form-item>
        </template>
      </el-form>
      <template #footer>
        <el-button @click="showCategoryDialog = false">取消</el-button>
        <el-button type="primary" @click="submitCategory">确定</el-button>
      </template>
    </el-dialog>

    <!-- 训练历史弹窗 -->
    <el-dialog
      v-model="showHistory"
      title="训练历史"
      width="600px"
    >
      <el-empty v-if="trainingHistory.length === 0" description="暂无训练记录" />
      <el-timeline v-else>
        <el-timeline-item
          v-for="record in trainingHistory"
          :key="record._id"
          :type="record.correctAnswers >= record.totalQuestions * 0.8 ? 'success' : 'warning'"
        >
          <div class="history-item">
            <div class="history-header">
              <span class="history-category">{{ record.category }}</span>
              <span class="history-mode">
                {{ record.mode === 'keyPress' ? '按键训练' : '功能选择' }}
              </span>
              <el-tag
                :type="record.correctAnswers >= record.totalQuestions * 0.8 ? 'success' : 'warning'"
                size="small"
              >
                {{ record.correctAnswers }}/{{ record.totalQuestions }}
              </el-tag>
            </div>
            <div class="history-detail">
              <span>用时 {{ record.duration }} 秒</span>
              <span>{{ formatDate(record.createdAt) }}</span>
            </div>
          </div>
        </el-timeline-item>
      </el-timeline>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useShortcutMemoryStore } from '@/stores/shortcutMemory';
import { ElMessage, ElMessageBox } from 'element-plus';
import { ArrowLeft } from '@element-plus/icons-vue';
import type { ShortcutItem } from '@/types/shortcut-memory';
import type { FormInstance, FormRules } from 'element-plus';
import KeyboardVisual from './components/KeyboardVisual.vue';
import { getShortcutsByCategory } from '@/utils/shortcut-memory-data';
import { getAllCustomCategories } from '@/utils/shortcut-memory-db';

const router = useRouter();
const store = useShortcutMemoryStore();

const selectedCategory = ref('');
const showMemoryCard = ref(false);
const currentItem = ref<ShortcutItem | null>(null);
const showHistory = ref(false);
const showAddDialog = ref(false);
const addFormRef = ref<FormInstance>();

const addForm = ref({
  category: '',
  functionName: '',
  description: '',
  keysText: '',
  platform: 'common' as 'common' | 'win' | 'mac' | 'linux'
});

const addRules: FormRules = {
  category: [{ required: true, message: '请输入分类', trigger: 'blur' }],
  functionName: [{ required: true, message: '请输入功能名称', trigger: 'blur' }],
  description: [{ required: true, message: '请输入功能描述', trigger: 'blur' }],
  keysText: [{ required: true, message: '请输入快捷键', trigger: 'blur' }]
};

// 编辑快捷键
const showEditShortcutDialog = ref(false);
const editShortcutFormRef = ref<FormInstance>();
const editShortcutForm = ref({
  id: '',
  category: '',
  functionName: '',
  description: '',
  keysText: '',
  platform: 'common' as 'common' | 'win' | 'mac' | 'linux'
});
const editShortcutRules: FormRules = {
  functionName: [{ required: true, message: '请输入功能名称', trigger: 'blur' }],
  description: [{ required: true, message: '请输入功能描述', trigger: 'blur' }],
  keysText: [{ required: true, message: '请输入快捷键', trigger: 'blur' }]
};

// 分类管理
const showCategoryDialog = ref(false);
const isEditCategory = ref(false);
const categoryFormRef = ref<FormInstance>();
const categoryForm = ref({
  name: '',
  description: '',
  icon: '⌨️',
  sourceType: 'empty' as 'empty' | 'copy' | 'import'
});
const categoryRules: FormRules = {
  name: [{ required: true, message: '请输入分类名称', trigger: 'blur' }]
};
const copyFromCategory = ref('');
const importJsonText = ref('');
const editingCategoryId = ref('');
const editingCategoryOldName = ref('');

const trainingHistory = computed(() => {
  return store.getTrainingHistory();
});

const masteredIds = computed(() => {
  if (!selectedCategory.value) return new Set<string>();
  return new Set(store.getMasteredIds(selectedCategory.value));
});

function getCategoryIcon(name: string): string {
  const icons: Record<string, string> = {
    'Windows': '🪟',
    'VS Code': '📝',
    'Chrome': '🌐',
    'IntelliJ IDEA': '☕',
    'Photoshop': '🎨',
    '键位练习': '⌨️',
    '数字小键盘练习': '🔢'
  };
  return icons[name] || '⌨️';
}

function isCustomItem(id: string): boolean {
  return id.startsWith('custom-');
}

function openAddDialog() {
  addForm.value = {
    category: selectedCategory.value || '',
    functionName: '',
    description: '',
    keysText: '',
    platform: 'common'
  };
  showAddDialog.value = true;
}

async function submitAdd() {
  if (!addFormRef.value) return;
  await addFormRef.value.validate(async (valid) => {
    if (!valid) return;

    const keys = addForm.value.keysText.split('+').map(k => k.trim()).filter(Boolean);
    if (keys.length === 0) {
      ElMessage.warning('快捷键格式不正确');
      return;
    }

    const newItem: ShortcutItem = {
      id: 'custom-' + Date.now(),
      category: addForm.value.category,
      functionName: addForm.value.functionName,
      description: addForm.value.description,
      keys,
      platform: addForm.value.platform
    };

    const result = await store.addCustomShortcut(newItem);
    if (result.ok) {
      ElMessage.success('新增成功');
      showAddDialog.value = false;
    } else {
      ElMessage.error('保存失败');
    }
  });
}

async function deleteCustomItem(row: ShortcutItem) {
  try {
    await ElMessageBox.confirm(
      `确定要删除「${row.functionName}」吗？`,
      '确认删除',
      { type: 'warning' }
    );
    const result = await store.deleteCustomShortcut(row.id);
    if (result.ok) {
      ElMessage.success('删除成功');
    } else {
      ElMessage.error('删除失败');
    }
  } catch {
    // 用户取消
  }
}

function selectCategory(name: string) {
  selectedCategory.value = name;
  store.selectCategory(name);
}

function isMastered(id: string): boolean {
  return masteredIds.value.has(id);
}

function openMemoryCard(item: ShortcutItem) {
  currentItem.value = item;
  showMemoryCard.value = true;
}

function startKeyPressTraining() {
  if (store.currentShortcutCount === 0) {
    ElMessage.warning('当前分类没有快捷键');
    return;
  }
  store.selectCategory(selectedCategory.value);
  router.push('/shortcut-memory/training?mode=keyPress');
}

function startFunctionSelectTraining() {
  if (store.currentShortcutCount === 0) {
    ElMessage.warning('当前分类没有快捷键');
    return;
  }
  store.selectCategory(selectedCategory.value);
  router.push('/shortcut-memory/training?mode=functionSelect');
}

async function clearProgress() {
  try {
    await ElMessageBox.confirm(
      `确定要重置 ${selectedCategory.value} 的学习进度吗？`,
      '确认重置',
      { type: 'warning' }
    );
    await store.clearCategoryProgress(selectedCategory.value);
    ElMessage.success('进度已重置');
  } catch {
    // 用户取消
  }
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN');
}

// 编辑快捷键
function openEditShortcutDialog(row: ShortcutItem) {
  editShortcutForm.value = {
    id: row.id,
    category: row.category,
    functionName: row.functionName,
    description: row.description,
    keysText: row.keys.join(' + '),
    platform: row.platform || 'common'
  };
  showEditShortcutDialog.value = true;
}

async function submitEditShortcut() {
  if (!editShortcutFormRef.value) return;
  await editShortcutFormRef.value.validate(async (valid) => {
    if (!valid) return;

    const keys = editShortcutForm.value.keysText.split('+').map(k => k.trim()).filter(Boolean);
    if (keys.length === 0) {
      ElMessage.warning('快捷键格式不正确');
      return;
    }

    // 判断是否为自定义快捷键
    const isCustom = editShortcutForm.value.id.startsWith('custom-');

    const item: ShortcutItem = {
      id: isCustom ? editShortcutForm.value.id : 'custom-' + Date.now(),
      category: editShortcutForm.value.category,
      functionName: editShortcutForm.value.functionName,
      description: editShortcutForm.value.description,
      keys,
      platform: editShortcutForm.value.platform
    };

    const result = await store.addCustomShortcut(item);
    if (result.ok) {
      ElMessage.success(isCustom ? '更新成功' : '已创建自定义副本');
      showEditShortcutDialog.value = false;
    } else {
      ElMessage.error('保存失败：' + (result.message || '未知错误'));
    }
  });
}

// 分类管理
function openCategoryDialog(editName?: string) {
  if (editName) {
    isEditCategory.value = true;
    const cat = store.categories.find(c => c.name === editName);
    const customCats = getAllCustomCategories();
    const customCat = customCats.find(c => c.name === editName);
    categoryForm.value = {
      name: editName,
      description: cat?.description || '',
      icon: getCategoryIcon(editName),
      sourceType: 'empty'
    };
    editingCategoryId.value = customCat?._id || '';
    editingCategoryOldName.value = editName;
  } else {
    isEditCategory.value = false;
    categoryForm.value = {
      name: '',
      description: '',
      icon: '⌨️',
      sourceType: 'empty'
    };
    copyFromCategory.value = '';
    importJsonText.value = '';
    editingCategoryId.value = '';
    editingCategoryOldName.value = '';
  }
  showCategoryDialog.value = true;
}

async function submitCategory() {
  if (!categoryFormRef.value) return;
  await categoryFormRef.value.validate(async (valid) => {
    if (!valid) return;

    if (isEditCategory.value) {
      const isCustom = store.isCustomCategory(editingCategoryOldName.value);

      // 如果是示例分类（非自定义），先创建为自定义分类
      if (!isCustom) {
        // 获取原分类下的所有快捷键
        const items = getShortcutsByCategory(editingCategoryOldName.value);
        const sourceItems = items.map(item => ({
          ...item,
          id: 'custom-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
          category: categoryForm.value.name
        }));

        // 创建自定义分类
        const result = await store.addCustomCategory(
          categoryForm.value.name,
          categoryForm.value.description,
          categoryForm.value.icon,
          sourceItems
        );
        if (result.ok) {
          ElMessage.success('已保存为自定义分类');
          showCategoryDialog.value = false;
        } else {
          ElMessage.error('保存失败');
        }
        return;
      }

      // 如果是自定义分类，执行原有逻辑
      // 如果名称变了，先重命名
      if (categoryForm.value.name !== editingCategoryOldName.value) {
        const renameResult = await store.renameCustomCategory(
          editingCategoryOldName.value,
          categoryForm.value.name
        );
        if (!renameResult.ok) {
          ElMessage.error('重命名失败');
          return;
        }
      }
      // 更新描述和图标
      const result = await store.updateCustomCategory(
        editingCategoryId.value,
        categoryForm.value.name,
        categoryForm.value.description,
        categoryForm.value.icon
      );
      if (result.ok) {
        ElMessage.success('修改成功');
        showCategoryDialog.value = false;
      } else {
        ElMessage.error('修改失败');
      }
      return;
    }

    // 新增分类
    let sourceItems: ShortcutItem[] | undefined;

    if (categoryForm.value.sourceType === 'copy' && copyFromCategory.value) {
      const items = getShortcutsByCategory(copyFromCategory.value);
      sourceItems = items.map(item => ({
        ...item,
        id: 'custom-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6)
      }));
    } else if (categoryForm.value.sourceType === 'import' && importJsonText.value.trim()) {
      try {
        const parsed = JSON.parse(importJsonText.value.trim());
        if (!Array.isArray(parsed)) {
          throw new Error('数据必须是数组');
        }
        sourceItems = parsed.map((item: any, index: number) => ({
          id: 'custom-' + Date.now() + '-' + index,
          category: categoryForm.value.name,
          functionName: item.functionName || '',
          description: item.description || '',
          keys: Array.isArray(item.keys) ? item.keys : [],
          platform: item.platform || 'common'
        }));
      } catch (e: any) {
        ElMessage.error('JSON 格式错误：' + e.message);
        return;
      }
    }

    const result = await store.addCustomCategory(
      categoryForm.value.name,
      categoryForm.value.description,
      categoryForm.value.icon,
      sourceItems
    );

    if (result.ok) {
      ElMessage.success('新增分类成功');
      showCategoryDialog.value = false;
    } else {
      ElMessage.error('新增分类失败');
    }
  });
}

async function deleteCategory(name: string) {
  const isCustom = store.isCustomCategory(name);
  const message = isCustom
    ? `确定要删除分类「${name}」吗？该分类下的所有快捷键也将被删除。`
    : `确定要删除分类「${name}」吗？删除后可以在新增分类时重新导入。`;

  try {
    await ElMessageBox.confirm(message, '确认删除', { type: 'warning' });
    const result = await store.removeCategory(name);
    if (result.ok) {
      ElMessage.success('删除成功');
    } else {
      ElMessage.error('删除失败');
    }
  } catch {
    // 用户取消
  }
}

onMounted(async () => {
  await store.loadCategories();
});
</script>

<style scoped lang="scss">
.shortcut-memory-page {
  padding: 20px;
  width: 100%;
  box-sizing: border-box;
  min-height: 100vh;
  background-color: var(--utools-bg-secondary);

  .main-card {
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
    }
  }

  .section-title {
    text-align: center;
    margin-bottom: 20px;
    color: var(--utools-text-primary);
  }

  .category-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 20px;
  }

  .category-card {
    border: 2px solid var(--utools-border-primary);
    border-radius: 12px;
    padding: 24px;
    text-align: center;
    cursor: pointer;
    transition: all 0.3s;
    background: var(--utools-bg-card);
    position: relative;

    &:hover {
      border-color: var(--utools-primary);
      transform: translateY(-4px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
    }

    .category-actions {
      position: absolute;
      top: 8px;
      right: 8px;
      display: flex;
      gap: 4px;
    }

    .category-icon {
      font-size: 48px;
      margin-bottom: 12px;
    }

    .category-name {
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 8px;
      color: var(--utools-text-primary);
    }

    .category-desc {
      font-size: 13px;
      color: var(--utools-text-secondary);
      margin-bottom: 12px;
    }

    .category-count {
      font-size: 14px;
      color: var(--utools-text-tertiary);
      margin-bottom: 12px;
    }

    .category-progress {
      :deep(.el-progress__text) {
        font-size: 12px;
      }
    }
  }

  .list-header {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 20px;
    flex-wrap: wrap;

    .list-title {
      font-size: 16px;
      font-weight: bold;
      color: var(--utools-text-primary);
      flex: 1;
    }

    .list-actions {
      display: flex;
      gap: 10px;
    }
  }

  .shortcut-table {
    .keys-display {
      display: flex;
      gap: 4px;
      justify-content: center;
      flex-wrap: wrap;

      .key-tag {
        font-family: monospace;
        font-weight: bold;
      }
    }

    .wrap-tag {
      white-space: normal;
      word-break: break-all;
      line-height: 1.4;
      height: auto;
      padding: 2px 6px;
    }

    .desc-text {
      white-space: normal;
      word-break: break-word;
      line-height: 1.4;
      display: inline-block;
    }
  }
}

.memory-card-dialog {
  .memory-card {
    text-align: center;

    .card-description {
      font-size: 15px;
      color: var(--utools-text-secondary);
      margin-bottom: 20px;
      line-height: 1.6;
    }

    .card-keys {
      display: flex;
      justify-content: center;
      gap: 12px;
      margin-bottom: 16px;

      .card-key {
        min-width: 56px;
        height: 56px;
        border: 2px solid var(--utools-warning);
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        font-weight: bold;
        color: var(--utools-text-primary);
        background: var(--utools-bg-secondary);
      }
    }

    .card-hint {
      display: flex;
      justify-content: center;
      gap: 8px;
      margin-bottom: 16px;
    }

    .card-keyboard {
      margin-top: 16px;
    }
  }
}

.form-tip {
  font-size: 12px;
  color: var(--utools-text-tertiary);
  margin-top: 4px;
}

.json-tip {
  pre {
    background: var(--utools-bg-secondary);
    padding: 8px;
    border-radius: 4px;
    margin: 4px 0;
    font-size: 11px;
    line-height: 1.4;
    overflow-x: auto;
  }
}

.history-item {
  .history-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 6px;

    .history-category {
      font-weight: bold;
      color: var(--utools-text-primary);
    }

    .history-mode {
      font-size: 13px;
      color: var(--utools-text-secondary);
    }
  }

  .history-detail {
    display: flex;
    gap: 16px;
    font-size: 12px;
    color: var(--utools-text-tertiary);
  }
}
</style>
