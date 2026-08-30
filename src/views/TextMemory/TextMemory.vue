<template>
  <div class="text-memory-container">
    <!-- 头部工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索标题或内容..."
          clearable
          style="width: 250px"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        <el-select
          v-model="selectedTag"
          placeholder="选择标签"
          clearable
          style="width: 150px; margin-left: 10px"
        >
          <el-option
            v-for="tag in textStore.allTags"
            :key="tag"
            :label="tag"
            :value="tag"
          />
        </el-select>
      </div>
      <div class="toolbar-right">
        <el-button type="primary" @click="showAddDialog = true">
          <el-icon><Plus /></el-icon>
          添加文本
        </el-button>
        <el-button @click="showImportDialog = true">
          <el-icon><Upload /></el-icon>
          导入
        </el-button>
      </div>
    </div>

    <!-- 统计信息 -->
    <div class="stats-bar">
      <el-tag type="info">共 {{ filteredArticles.length }} 篇文章</el-tag>
      <el-tag type="success" v-if="textStore.allTags.length > 0">
        {{ textStore.allTags.length }} 个标签
      </el-tag>
      <el-tag type="warning" v-if="textStore.articlesWithGeo.length > 0">
        {{ textStore.articlesWithGeo.length }} 个地点
      </el-tag>
      <el-tag type="danger" v-if="timelineEventCount > 0">
        {{ timelineEventCount }} 个时间线事件
      </el-tag>
      <div class="view-toggle">
        <el-radio-group v-model="currentView" size="small">
          <el-radio-button label="list">
            <el-icon><List /></el-icon> 列表
          </el-radio-button>
          <el-radio-button label="map">
            <el-icon><MapLocation /></el-icon> 地图
          </el-radio-button>
          <el-radio-button label="timeline">
            <el-icon><Clock /></el-icon> 时间线
          </el-radio-button>
        </el-radio-group>
      </div>
    </div>

    <!-- 文章列表 -->
    <div v-show="currentView === 'list'" class="articles-list" v-loading="textStore.loading">
      <el-empty v-if="filteredArticles.length === 0" description="暂无文章，点击添加按钮开始" />

      <div
        v-for="article in filteredArticles"
        :key="article._id"
        class="article-card"
        @click="handleArticleClick(article)"
      >
        <div class="article-header">
          <h3 class="article-title">{{ article.title }}</h3>
          <div class="article-actions" @click.stop>
            <el-dropdown trigger="click">
              <el-button link>
                <el-icon><More /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item @click="handleEdit(article)">
                    <el-icon><Edit /></el-icon> 编辑
                  </el-dropdown-item>
                  <el-dropdown-item @click="handleTypingPractice(article)">
                    <el-icon><Pointer /></el-icon> 跟打练习
                  </el-dropdown-item>
                  <el-dropdown-item @click="handleFillBlanks(article)">
                    <el-icon><EditPen /></el-icon> 填空练习
                  </el-dropdown-item>
                  <el-dropdown-item v-if="isUtoolsEnv || isElectronEnv" @click="openTextFocusMode(article)">
                    <el-icon><VideoPlay /></el-icon> 专注显示
                  </el-dropdown-item>
                  <el-dropdown-item v-if="article.geo" @click="handleLocateOnMap(article)">
                    <el-icon><MapLocation /></el-icon> 地图定位
                  </el-dropdown-item>
<!--                  <el-dropdown-item @click="handleChoiceQuestions(article)">
                    <el-icon><QuestionFilled /></el-icon> 选择题
                  </el-dropdown-item>-->
                  <el-dropdown-item @click="handleNotes(article)">
                    <el-icon><Notebook /></el-icon> 笔记
                  </el-dropdown-item>
                  <el-dropdown-item @click="handlePrompts(article)">
                    <el-icon><Memo /></el-icon> 提示词
                  </el-dropdown-item>
                  <el-dropdown-item divided @click="handleDelete(article)" type="danger">
                    <el-icon><Delete /></el-icon> 删除
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>

        <div class="article-content-preview">
          {{ article.content.substring(0, 150) }}{{ article.content.length > 150 ? '...' : '' }}
        </div>

        <div class="article-footer">
          <div class="article-tags">
            <el-tag
              v-for="tag in article.tags"
              :key="tag"
              size="small"
              effect="plain"
            >
              {{ tag }}
            </el-tag>
          </div>
          <div class="article-meta">
            <span v-if="article.author" class="meta-item">
              <el-icon><User /></el-icon> {{ article.author }}
            </span>
            <span class="meta-item">
              <el-icon><Clock /></el-icon> {{ formatDate(article.ctime) }}
            </span>
            <span class="meta-item" v-if="article.reviewCount > 0">
              <el-icon><View /></el-icon> 已复习 {{ article.reviewCount }} 次
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 添加/编辑对话框 -->
    <TextEditDialog
      v-model="showAddDialog"
      @save="handleSaveArticle"
    />

    <TextEditDialog
      v-model="showEditDialog"
      :article="editingArticle"
      @save="handleUpdateArticle"
    />

    <!-- 导入对话框 -->
    <TextImportDialog
      v-model="showImportDialog"
      @import="handleImportArticles"
      @openWordSettings="handleOpenWordSettings"
    />

    <!-- 填空练习对话框 -->
    <FillBlanksDialog
      v-model="showFillBlanksDialog"
      :article="currentExerciseArticle"
    />

    <!-- 选择题对话框 -->
    <ChoiceQuestionsDialog
      v-model="showChoiceDialog"
      :article="currentExerciseArticle"
    />

    <!-- 笔记管理对话框 -->
    <NotesDialog
      v-model="showNotesDialog"
      :article="currentExerciseArticle"
    />

    <!-- 提示词对话框 -->
    <PromptsDialog
      v-model="showPromptsDialog"
      :article="currentExerciseArticle"
    />

    <!-- 跟打练习对话框 -->
    <TypingPracticeDialog
      v-model="showTypingDialog"
      :article="currentExerciseArticle"
    />

    <!-- 地图视图 -->
    <div v-show="currentView === 'map'" class="map-view">
      <PoetryMap
        :articles="filteredArticles"
        :authors="textStore.allAuthors"
        :active="currentView === 'map'"
        :focus-article-id="focusArticleId"
        @select="handleMapSelect"
        @focused="focusArticleId = ''"
      />
    </div>

    <!-- 时间线视图 -->
    <div v-show="currentView === 'timeline'" class="timeline-view-wrap">
      <TimelineView
        :articles="filteredArticles"
        @select="handleArticleClick"
        @locate="handleLocateArticle"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { useTextMemoryStore } from '@/stores/textMemory';
import type { TextArticle } from '@/types/text-memory';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  Search, Plus, Upload, More, Edit, Delete,
  EditPen, QuestionFilled, Notebook, Memo,
  User, Clock, View, Pointer, List, MapLocation, VideoPlay
} from '@element-plus/icons-vue';
import { isUtools, isElectron } from '@/adapters/platform';
import { log } from '@/utils/logger';
import {
  setupTextFocusListeners,
  setTextFocusWindow,
  setReturnToListHandler,
  teardownTextFocusListeners,
  createElectronWindowProxy,
  collectTextFocusDocsForChild
} from '@/utils/text-focus-window';

// 导入子组件
import TextEditDialog from './components/TextEditDialog.vue';
import TextImportDialog from './components/TextImportDialog.vue';
import FillBlanksDialog from './components/FillBlanksDialog.vue';
import ChoiceQuestionsDialog from './components/ChoiceQuestionsDialog.vue';
import NotesDialog from './components/NotesDialog.vue';
import PromptsDialog from './components/PromptsDialog.vue';
import TypingPracticeDialog from './components/TypingPracticeDialog.vue';
import PoetryMap from './components/PoetryMap.vue';
import TimelineView from './components/TimelineView.vue';

const router = useRouter();
const textStore = useTextMemoryStore();

// 是否为 uTools 环境（专注滚动浮窗仅在 uTools 可用）
const isUtoolsEnv = isUtools();
const isElectronEnv = isElectron();

// 搜索和筛选
const searchKeyword = ref('');
const selectedTag = ref('');

// 当前视图：list | map | timeline
const currentView = ref<'list' | 'map' | 'timeline'>('list');

// 对话框显示状态
const showAddDialog = ref(false);
const showEditDialog = ref(false);
const showImportDialog = ref(false);
const showFillBlanksDialog = ref(false);
const showChoiceDialog = ref(false);
const showNotesDialog = ref(false);
const showPromptsDialog = ref(false);
const showTypingDialog = ref(false);

// 当前操作的文章
const editingArticle = ref<TextArticle | undefined>(undefined);
const currentExerciseArticle = ref<TextArticle | null>(null);
const focusArticleId = ref<string>('');

// 过滤后的文章列表
const filteredArticles = computed(() => {
  let result = textStore.sortedArticles;

  // 按关键词搜索
  if (searchKeyword.value) {
    const keyword = searchKeyword.value.toLowerCase();
    result = result.filter(article =>
      article.title.toLowerCase().includes(keyword) ||
      article.content.toLowerCase().includes(keyword)
    );
  }

  // 按标签筛选
  if (selectedTag.value) {
    result = result.filter(article =>
      article.tags.includes(selectedTag.value)
    );
  }

  return result;
});

// 时间线事件数（category 属于时间线分类的条目）
const TIMELINE_CATS = new Set(['politics', 'literature', 'science', 'thought', 'society']);
const timelineEventCount = computed(() =>
  textStore.articles.filter(a => a.category && TIMELINE_CATS.has(a.category)).length
);

// 初始化加载
onMounted(async () => {
  // 先注册监听（不依赖文章数据），确保打开浮窗时动作通道已就绪
  setupTextFocusListeners();
  setReturnToListHandler(() => router.push('/text-memory'));
  await textStore.loadArticles();
});

onBeforeUnmount(() => {
  setReturnToListHandler(null);
  teardownTextFocusListeners();
});

// 打开文本专注滚动浮窗（uTools / Electron）
async function openTextFocusMode(article: TextArticle) {
  const isElectronAvailable = isElectronEnv && (window as any).electronAPI?.createBrowserWindow;
  const isUtoolAvailable = isUtoolsEnv && (window as any).utools?.createBrowserWindow;
  if (!isElectronAvailable && !isUtoolAvailable) {
    ElMessage.warning('专注显示仅在 uTools 桌面端可用');
    return;
  }
  const isDark = document.documentElement.classList.contains('dark');
  const themeParam = isDark ? 'dark' : 'light';
  const articleId = encodeURIComponent(article._id);
  // 文本模式禁用贴边隐藏（窗口较大，贴边不实用且需复杂父窗口逻辑）
  const url = `focus.html?mode=text&articleId=${articleId}&theme=${themeParam}&alwaysOnTop=true&edgeStickEnabled=false`;
  const windowOpts = {
    width: 400, height: 280, minWidth: 280, minHeight: 180, maxWidth: 640, maxHeight: 560,
    alwaysOnTop: true, frame: false, transparent: true, backgroundColor: '#00000000',
    resizable: true, modal: false, closable: true,
  };
  try {
    if (isElectronAvailable) {
      const api = (window as any).electronAPI;
      const winId = await api.createBrowserWindow(url, windowOpts);
      const win = createElectronWindowProxy(winId);
      setTextFocusWindow(win);
      // 推送文章 + user-set 快照给子窗口 utools shim，然后显示
      setTimeout(async () => {
        const docs = collectTextFocusDocsForChild();
        await api.focusWindowExecuteJS(winId, `window.electronAPI && window.electronAPI.initFocusData(${JSON.stringify({ docs })})`);
        api.focusWindowInvoke(winId, 'show', []);
      }, 500);
      return;
    }
    // uTools 分支：createBrowserWindow 返回 BrowserWindow 实例（回调本身不传 win 参数）
    const win = (window as any).utools.createBrowserWindow(
      url,
      windowOpts,
      () => {
        // 窗口就绪回调
        if (win && typeof win.show === 'function') win.show();
      }
    );
    // 立即注入窗口引用，使控制器能处理置顶/锁定等动作（storage 事件来时已就绪）
    log.d('[文本专注] createBrowserWindow 返回 win:', !!win, '类型:', typeof win, 'setAlwaysOnTop:', typeof win?.setAlwaysOnTop);
    setTextFocusWindow(win);
    // 窗口关闭后清理引用
    if (win && typeof win.on === 'function') {
      try {
        win.on('closed', () => setTextFocusWindow(null));
      } catch (e) {
        // 某些环境不支持事件监听，忽略；控制器已用 isDestroyed 兜底
      }
    }
  } catch (e) {
    log.e('[文本专注] 打开浮窗失败:', e);
    ElMessage.error('打开专注浮窗失败');
  }
}

// 格式化日期
function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString('zh-CN');
}

// 点击文章卡片
function handleArticleClick(article: TextArticle) {
  // 可以展开详情或直接进行练习
  textStore.setCurrentArticle(article);
}

// 从时间线跳转到地图定位该事件
function handleLocateArticle(article: TextArticle) {
  if (!article.geo) {
    ElMessage.warning('该事件无地理坐标，无法在地图定位');
    return;
  }
  focusArticleId.value = article._id;
  currentView.value = 'map';
}

// 编辑文章
function handleEdit(article: TextArticle) {
  editingArticle.value = article;
  showEditDialog.value = true;
}

// 保存新文章
async function handleSaveArticle(article: Omit<TextArticle, '_id' | '_rev' | 'ctime' | 'utime' | 'reviewCount'>) {
  const result = await textStore.addArticle(article);
  if (result.success) {
    ElMessage.success('添加成功');
    showAddDialog.value = false;
  } else {
    ElMessage.error(result.error || '添加失败');
  }
}

// 更新文章
async function handleUpdateArticle(article: TextArticle) {
  const result = await textStore.updateArticle(article);
  if (result.success) {
    ElMessage.success('更新成功');
    showEditDialog.value = false;
    editingArticle.value = undefined;
  } else {
    ElMessage.error(result.error || '更新失败');
  }
}

// 删除文章
async function handleDelete(article: TextArticle) {
  try {
    await ElMessageBox.confirm(
      `确定要删除文章 "${article.title}" 吗？相关的笔记和提示词也会被删除。`,
      '确认删除',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );

    const result = await textStore.deleteArticle(article._id);
    if (result.success) {
      ElMessage.success('删除成功');
    } else {
      ElMessage.error(result.error || '删除失败');
    }
  } catch {
    // 用户取消删除
  }
}

// 处理导入
async function handleImportArticles(articles: Omit<TextArticle, '_id' | '_rev' | 'ctime' | 'utime' | 'reviewCount'>[]) {
  let successCount = 0;
  let failCount = 0;

  let firstError = '';
  for (const article of articles) {
    const result = await textStore.addArticle(article);
    if (result.success) {
      successCount++;
    } else {
      failCount++;
      if (!firstError && result.error) {
        firstError = result.error;
      }
    }
  }

  if (successCount > 0) {
    ElMessage.success(`成功导入 ${successCount} 篇文章`);
  }
  if (failCount > 0) {
    const detail = firstError ? `：${firstError}` : '';
    ElMessage.warning(`${failCount} 篇文章导入失败${detail}`);
  }

  showImportDialog.value = false;
}

// 打开填空练习
function handleFillBlanks(article: TextArticle) {
  currentExerciseArticle.value = article;
  showFillBlanksDialog.value = true;
}

// 打开选择题
function handleChoiceQuestions(article: TextArticle) {
  currentExerciseArticle.value = article;
  showChoiceDialog.value = true;
}

// 打开笔记管理
function handleNotes(article: TextArticle) {
  currentExerciseArticle.value = article;
  showNotesDialog.value = true;
}

// 打开提示词管理
function handlePrompts(article: TextArticle) {
  currentExerciseArticle.value = article;
  showPromptsDialog.value = true;
}

// 打开跟打练习
function handleTypingPractice(article: TextArticle) {
  currentExerciseArticle.value = article;
  showTypingDialog.value = true;
}

// 在地图中定位文章
function handleLocateOnMap(article: TextArticle) {
  if (!article.geo) {
    ElMessage.warning('该文章没有地理位置信息');
    return;
  }
  focusArticleId.value = article._id;
  currentView.value = 'map';
}

// 打开单词列表设置
function handleOpenWordSettings() {
  showImportDialog.value = false;
  // 导航到单词列表页面
  router.push('/word');
}

// 地图选中诗词
function handleMapSelect(article: TextArticle) {
  textStore.setCurrentArticle(article);
}
</script>

<style scoped lang="scss">
.text-memory-container {
  padding: 16px;
  height: 100%;
  overflow-y: auto;
  max-width: 780px;
  margin: 0 auto;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.stats-bar {
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;

  .el-tag {
    margin-right: 10px;
  }

  .view-toggle {
    margin-left: auto;
  }
}

.articles-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.article-card {
  background: var(--utools-bg-secondary);
  border: 1px solid var(--utools-border-color);
  border-radius: 8px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.3s;

  &:hover {
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
    border-color: var(--utools-primary);
  }
}

.article-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.article-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--utools-text-primary);
  margin: 0;
}

.article-actions {
  .el-button {
    color: var(--utools-text-secondary);

    &:hover {
      color: var(--utools-primary);
    }
  }
}

.article-content-preview {
  color: var(--utools-text-secondary);
  font-size: 14px;
  line-height: 1.6;
  margin-bottom: 12px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.article-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.article-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.article-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--utools-text-secondary);

  .meta-item {
    display: flex;
    align-items: center;
    gap: 4px;
  }
}

.map-view {
  height: calc(100vh - 220px);
  min-height: 500px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--utools-border-color);
}
</style>
