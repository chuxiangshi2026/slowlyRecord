<template>
  <div class="text-memory-container">
    <!-- 顶部筛选排序条（仿 WordFilter 风格） -->
    <div class="filter-bar">
      <!-- 搜索 -->
      <div class="filter-input-wrap">
        <el-icon class="filter-search-icon"><Search /></el-icon>
        <input
          v-model="searchKeyword"
          class="filter-input"
          placeholder="搜索标题或内容..."
          @keyup.enter="emitSearchChange"
        />
        <el-icon v-if="searchKeyword" class="filter-clear-icon" @click="searchKeyword = ''"><CircleClose /></el-icon>
      </div>

      <!-- 标签筛选 -->
      <el-popover
        :visible="tagPopoverVisible"
        placement="bottom-start"
        :width="200"
        :show-arrow="false"
        :offset="2"
      >
        <template #reference>
          <span :class="['ftag', { on: selectedTag }]" @click="tagPopoverVisible = !tagPopoverVisible">
            标签<template v-if="selectedTag">: {{ selectedTag }}</template>
          </span>
        </template>
        <div class="popover-body">
          <div class="tag-option-list">
            <span
              v-for="tag in textStore.allTags"
              :key="tag"
              :class="['tag-option-chip', { on: selectedTag === tag }]"
              @click="selectTag(tag)"
            >{{ tag }}</span>
          </div>
          <div v-if="!textStore.allTags.length" class="tag-empty">暂无标签</div>
          <el-button v-if="selectedTag" link size="small" class="tag-clear-btn" @click="selectedTag = ''">
            清除筛选
          </el-button>
        </div>
      </el-popover>

      <div class="filter-divider"></div>

      <!-- 排序 -->
      <div class="sort-chips">
        <span
          v-for="opt in sortOptions"
          :key="opt.key"
          :class="['schip', { on: sortBy === opt.key }]"
          @click="toggleSort(opt.key)"
        >
          {{ opt.label }}<template v-if="sortBy === opt.key">{{ sortAsc ? '↑' : '↓' }}</template>
        </span>
      </div>

      <!-- 统计信息（合并到顶部条） -->
      <div class="filter-stats">
        <el-tag type="info" size="small">{{ filteredArticles.length }} 篇</el-tag>
        <el-tag v-if="textStore.allTags.length > 0" type="success" size="small">{{ textStore.allTags.length }} 标签</el-tag>
        <el-tag v-if="textStore.articlesWithGeo.length > 0" type="warning" size="small">{{ textStore.articlesWithGeo.length }} 地点</el-tag>
        <el-tag v-if="timelineEventCount > 0" type="danger" size="small">{{ timelineEventCount }} 事件</el-tag>
      </div>

      <!-- 视图切换与添加导入 -->
      <div class="filter-actions">
        <!-- 多选模式开关（仅列表视图可用） -->
        <el-tooltip v-if="currentView === 'list'" effect="dark" content="多选（批量打印 / 存图）" placement="top" popper-class="small-tooltip">
          <el-button size="small" :type="multiSelectMode ? 'primary' : 'default'" @click="toggleMultiSelectMode">
            <el-icon><Finished /></el-icon>
          </el-button>
        </el-tooltip>
        <el-radio-group v-model="currentView" size="small">
          <el-radio-button label="list">
            <el-tooltip effect="dark" content="列表视图" placement="top" popper-class="small-tooltip">
              <el-icon><List /></el-icon>
            </el-tooltip>
          </el-radio-button>
          <el-radio-button label="map">
            <el-tooltip effect="dark" content="地图视图" placement="top" popper-class="small-tooltip">
              <el-icon><MapLocation /></el-icon>
            </el-tooltip>
          </el-radio-button>
          <el-radio-button label="timeline">
            <el-tooltip effect="dark" content="时间线视图" placement="top" popper-class="small-tooltip">
              <el-icon><Clock /></el-icon>
            </el-tooltip>
          </el-radio-button>
          <el-radio-button label="palace">
            <el-tooltip effect="dark" content="宫殿视图（记忆宫殿）" placement="top" popper-class="small-tooltip">
              <el-icon><OfficeBuilding /></el-icon>
            </el-tooltip>
          </el-radio-button>
          <el-radio-button label="knowledge">
            <el-tooltip effect="dark" content="知识库视图（文本类知识包）" placement="top" popper-class="small-tooltip">
              <el-icon><Notebook /></el-icon>
            </el-tooltip>
          </el-radio-button>
        </el-radio-group>
        <el-tooltip class="box-item" effect="dark" content="添加 / 导入" placement="top" popper-class="small-tooltip">
          <el-button type="primary" size="small" @click="openImportDialog('manual')">
            <el-icon><Plus /></el-icon>
          </el-button>
        </el-tooltip>
      </div>
    </div>

    <!-- 多选工具条（仅列表视图 + 多选模式显示） -->
    <div v-if="multiSelectMode && currentView === 'list'" class="multi-select-bar">
      <el-checkbox
        :model-value="isAllFilteredSelected"
        :indeterminate="isSelectionIndeterminate"
        @change="toggleSelectAllFiltered"
      >
        全选（当前筛选）
      </el-checkbox>
      <span class="selected-count">已选 {{ selectedIds.size }} 篇</span>
      <el-button size="small" :disabled="selectedIds.size === 0" @click="clearSelection">清空</el-button>
      <div class="multi-select-actions">
        <el-button size="small" type="primary" :disabled="selectedIds.size === 0" @click="handleBatchPrint">
          <el-icon><Printer /></el-icon> 打印
        </el-button>
        <el-button size="small" type="primary" :disabled="selectedIds.size === 0" @click="handleBatchSaveImage">
          <el-icon><Picture /></el-icon> 存图
        </el-button>
        <el-button size="small" @click="exitMultiSelectMode">退出多选</el-button>
      </div>
    </div>

    <!-- 文章列表 -->
    <div v-show="currentView === 'list'" class="articles-list" v-loading="textStore.loading">
      <el-empty v-if="filteredArticles.length === 0" description="暂无文章，点击添加按钮开始" />

      <div
        v-for="article in filteredArticles"
        :key="article._id"
        :class="['list-item', 'text-article-card', { 'select-mode': multiSelectMode, selected: multiSelectMode && selectedIds.has(article._id) }]"
        @click="handleCardClick(article)"
      >
        <!-- 多选勾选框（多选模式下点卡片任意位置均为选中/取消） -->
        <el-checkbox
          v-if="multiSelectMode"
          class="select-checkbox"
          :model-value="selectedIds.has(article._id)"
          @change="toggleSelect(article)"
          @click.stop
        />
        <div class="article-main">
          <h3 class="article-title">{{ article.title }}</h3>
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

        <!-- 多选模式下隐藏行内操作，避免误触 -->
        <div v-if="!multiSelectMode" class="article-actions" @click.stop>
          <el-tooltip class="box-item" effect="dark" content="跟打练习" placement="top" popper-class="small-tooltip">
            <el-icon class="action-icon" @click="handleTypingPractice(article)"><Pointer /></el-icon>
          </el-tooltip>
          <el-tooltip class="box-item" effect="dark" content="填空练习" placement="top" popper-class="small-tooltip">
            <el-icon class="action-icon" @click="handleFillBlanks(article)"><EditPen /></el-icon>
          </el-tooltip>
          <el-tooltip class="box-item" effect="dark" content="笔记" placement="top" popper-class="small-tooltip">
            <i class="iconfont icon-notebook-1 action-icon" @click="handleNotes(article)"></i>
          </el-tooltip>
          <el-tooltip class="box-item" effect="dark" content="编辑" placement="top" popper-class="small-tooltip">
            <i class="iconfont icon-edit action-icon" @click="handleEdit(article)"></i>
          </el-tooltip>
          <el-tooltip class="box-item" effect="dark" content="删除" placement="top" popper-class="small-tooltip">
            <i class="iconfont icon-delete action-icon action-danger" @click="handleDelete(article)"></i>
          </el-tooltip>

          <el-dropdown trigger="click">
            <el-icon class="action-icon action-more"><More /></el-icon>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item v-if="isUtoolsEnv || isElectronEnv" @click="openTextFocusMode(article)">
                  <el-icon><VideoPlay /></el-icon> 专注显示
                </el-dropdown-item>
                <el-dropdown-item v-if="article.geo" @click="handleLocateOnMap(article)">
                  <el-icon><MapLocation /></el-icon> 地图定位
                </el-dropdown-item>
                <el-dropdown-item @click="handlePrompts(article)">
                  <el-icon><Memo /></el-icon> 提示词
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>
    </div>

    <!-- 编辑对话框（添加已并入统一的「添加/导入」对话框） -->
    <TextEditDialog
      v-model="showEditDialog"
      :article="editingArticle"
      @save="handleUpdateArticle"
    />

    <!-- 添加/导入对话框（统一入口，initialTab/initialLibTab 定位到指定 tab） -->
    <TextImportDialog
      v-model="showImportDialog"
      :initial-tab="importInitialTab"
      :initial-lib-tab="importInitialLibTab"
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

    <!-- 宫殿视图（嵌入记忆宫殿列表，含新建/导入桩库/删除） -->
    <div v-if="currentView === 'palace'" class="palace-view">
      <MemoryPalace @open-peg-import="openImportDialog('library', 'pegPacks')" />
    </div>

    <!-- 知识库视图（文本类知识包卡片） -->
    <div v-if="currentView === 'knowledge'" class="knowledge-view">
      <KnowledgePackPanel category="text" use-external-import @open-import="openImportDialog('library', 'knowledge')" />
    </div>

    <!-- 批量打印专用容器：屏幕隐藏，打印时仅输出此区域（选中文章逐篇排版） -->
    <div v-if="printArticles.length > 0" class="article-print-area">
      <div class="print-title">文本记忆</div>
      <div class="print-date">{{ printDate }}</div>
      <div v-for="article in printArticles" :key="article._id" class="print-article">
        <h2 class="print-article-title">{{ article.title }}</h2>
        <div v-if="articleMetaLine(article)" class="print-article-meta">{{ articleMetaLine(article) }}</div>
        <p v-for="(para, pIdx) in splitParagraphs(article.content)" :key="pIdx" class="print-article-para">
          {{ para }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useTextMemoryStore } from '@/stores/textMemory';
import type { TextArticle } from '@/types/text-memory';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  Search, Plus, More, Edit, Delete,
  EditPen, QuestionFilled, Notebook, Memo,
  User, Clock, View, Pointer, List, MapLocation, VideoPlay, CircleClose, OfficeBuilding,
  Finished, Printer, Picture
} from '@element-plus/icons-vue';
import { isUtools, isElectron } from '@/adapters/platform';
import { log } from '@/utils/logger';
import { exportArticlesAsImage } from '@/utils/article-image-export';
import type { ArticleImageItem } from '@/utils/article-image-export';
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
import KnowledgePackPanel from './components/KnowledgePackPanel.vue';
// 记忆宫殿列表作为子组件嵌入「宫殿」视图
import MemoryPalace from '@/views/MemoryPalace/MemoryPalace.vue';

const route = useRoute();
const router = useRouter();
const textStore = useTextMemoryStore();

// 是否为 uTools 环境（专注滚动浮窗仅在 uTools 可用）
const isUtoolsEnv = isUtools();
const isElectronEnv = isElectron();

// 搜索和筛选
const searchKeyword = ref('');
const selectedTag = ref('');
const tagPopoverVisible = ref(false);

// 排序（默认按时间倒序，与 store.sortedArticles 行为一致）
type SortField = 'time' | 'title' | 'reviewCount';
const sortBy = ref<SortField>('time');
const sortAsc = ref(false);
const sortOptions = [
  { key: 'time' as SortField, label: '时间' },
  { key: 'title' as SortField, label: '标题' },
  { key: 'reviewCount' as SortField, label: '复习次数' }
];

// 当前视图：list | map | timeline | palace | knowledge
type TextMemoryView = 'list' | 'map' | 'timeline' | 'palace' | 'knowledge';
const currentView = ref<TextMemoryView>('list');

// 支持通过 query 定位视图，如 /text-memory?view=palace、?view=knowledge
const VALID_VIEWS: TextMemoryView[] = ['list', 'map', 'timeline', 'palace', 'knowledge'];
function applyViewFromQuery() {
  const qv = route.query.view;
  const v = Array.isArray(qv) ? qv[0] : qv;
  if (v && VALID_VIEWS.includes(v as TextMemoryView)) {
    currentView.value = v as TextMemoryView;
  }
}

// 对话框显示状态
const showEditDialog = ref(false);
const showImportDialog = ref(false);
// 统一「添加/导入」对话框的初始 tab（manual/batch/file/library）
const importInitialTab = ref('manual');
// initialTab 为 library 时定位到的内置库二级面板（poetry/idiom/timeline/knowledge/pegPacks）
const importInitialLibTab = ref('');
const showFillBlanksDialog = ref(false);
const showChoiceDialog = ref(false);
const showNotesDialog = ref(false);
const showPromptsDialog = ref(false);
const showTypingDialog = ref(false);

// 当前操作的文章
const editingArticle = ref<TextArticle | undefined>(undefined);
const currentExerciseArticle = ref<TextArticle | null>(null);
const focusArticleId = ref<string>('');

// 多选模式（列表视图批量打印 / 存图）
const multiSelectMode = ref(false);
// 已选文章 ID 集合
const selectedIds = ref<Set<string>>(new Set());
// 待打印的文章快照（打印时从选中项复制，避免打印期间选中态变化影响输出）
const printArticles = ref<TextArticle[]>([]);
// 打印区域顶部的日期
const printDate = ref('');

// 当前选中的文章（按当前筛选结果顺序排列）
const selectedArticles = computed(() => filteredArticles.value.filter(a => selectedIds.value.has(a._id)));

// 当前筛选结果是否已全部选中
const isAllFilteredSelected = computed(
  () => filteredArticles.value.length > 0 && filteredArticles.value.every(a => selectedIds.value.has(a._id))
);
// 部分选中（全选 checkbox 的半选态）
const isSelectionIndeterminate = computed(
  () => !isAllFilteredSelected.value && filteredArticles.value.some(a => selectedIds.value.has(a._id))
);

// 进入/退出多选模式
function toggleMultiSelectMode() {
  if (multiSelectMode.value) {
    exitMultiSelectMode();
  } else {
    multiSelectMode.value = true;
  }
}

function exitMultiSelectMode() {
  multiSelectMode.value = false;
  selectedIds.value = new Set();
}

// 选中/取消选中一篇文章
function toggleSelect(article: TextArticle) {
  const next = new Set(selectedIds.value);
  if (next.has(article._id)) {
    next.delete(article._id);
  } else {
    next.add(article._id);
  }
  selectedIds.value = next;
}

// 全选/取消全选（仅作用于当前筛选结果）
function toggleSelectAllFiltered() {
  if (isAllFilteredSelected.value) {
    const next = new Set(selectedIds.value);
    filteredArticles.value.forEach(a => next.delete(a._id));
    selectedIds.value = next;
  } else {
    const next = new Set(selectedIds.value);
    filteredArticles.value.forEach(a => next.add(a._id));
    selectedIds.value = next;
  }
}

// 清空选中
function clearSelection() {
  selectedIds.value = new Set();
}

// 卡片点击：多选模式下让位为选中/取消，否则走原有逻辑
function handleCardClick(article: TextArticle) {
  if (multiSelectMode.value) {
    toggleSelect(article);
    return;
  }
  handleArticleClick(article);
}

// 作者/朝代/来源拼接行（如「唐 · 李白」）
function articleMetaLine(article: TextArticle): string {
  return [article.dynasty, article.author, article.source].filter(Boolean).join(' · ');
}

// 正文分段（按换行拆分，去掉空段；空内容兜底为一个空行）
function splitParagraphs(content: string): string[] {
  const paras = (content || '').split(/\n+/).map(p => p.trim()).filter(Boolean);
  return paras.length > 0 ? paras : [''];
}

// 当前日期，如「2026年9月3日」
function formatPrintDate(d: Date = new Date()): string {
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

// 批量打印：渲染打印容器后调用系统打印
async function handleBatchPrint() {
  if (selectedArticles.value.length === 0) return;
  printArticles.value = [...selectedArticles.value];
  printDate.value = formatPrintDate();
  // 等 DOM 应用完打印容器后再触发打印
  await nextTick();
  window.print();
}

// 批量存图：选中文章竖向拼接渲染为一张长 PNG 下载
function handleBatchSaveImage() {
  if (selectedArticles.value.length === 0) return;
  const items: ArticleImageItem[] = selectedArticles.value.map(article => ({
    title: article.title,
    authorLine: articleMetaLine(article),
    paragraphs: splitParagraphs(article.content)
  }));
  try {
    exportArticlesAsImage(
      { title: '文本记忆', date: formatPrintDate(), articles: items },
      { filename: '文本记忆' }
    );
    ElMessage.success('图片已保存');
  } catch (e) {
    log.e('[文本记忆] 批量存图失败:', e);
    ElMessage.error('导出失败');
  }
}

// 过滤后的文章列表
const filteredArticles = computed(() => {
  let result = [...textStore.articles];

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

  // 排序
  result.sort((a, b) => {
    let cmp = 0;
    if (sortBy.value === 'time') {
      cmp = a.ctime - b.ctime;
    } else if (sortBy.value === 'title') {
      cmp = a.title.localeCompare(b.title, 'zh-CN');
    } else if (sortBy.value === 'reviewCount') {
      cmp = a.reviewCount - b.reviewCount;
    }
    return sortAsc.value ? cmp : -cmp;
  });

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
  document.addEventListener('click', onDocClick, true);
  applyViewFromQuery();
  await textStore.loadArticles();
});

onBeforeUnmount(() => {
  setReturnToListHandler(null);
  teardownTextFocusListeners();
  document.removeEventListener('click', onDocClick, true);
});

// 点击外部关闭标签 popover
const onDocClick = (e: MouseEvent) => {
  if (tagPopoverVisible.value) {
    const target = e.target as HTMLElement;
    if (!target.closest('.el-popover') && !target.closest('.ftag')) {
      tagPopoverVisible.value = false;
    }
  }
};

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

// 切换排序
function toggleSort(key: SortField) {
  if (sortBy.value === key) {
    sortAsc.value = !sortAsc.value;
  } else {
    sortBy.value = key;
    sortAsc.value = key === 'title';
  }
}

// 选择标签
function selectTag(tag: string) {
  selectedTag.value = selectedTag.value === tag ? '' : tag;
  tagPopoverVisible.value = false;
}

// 搜索框回车（实时过滤已生效，仅作为交互入口）
function emitSearchChange() {
  // 搜索框回车占位：筛选已实时响应，无需额外动作
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

// 打开统一的「添加/导入」对话框并定位到指定 tab（library 时用 libTab 定位二级面板）
function openImportDialog(tab: string, libTab: string = '') {
  importInitialTab.value = tab;
  importInitialLibTab.value = libTab;
  showImportDialog.value = true;
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

// 编辑对话框关闭后清理编辑中的文章引用，避免残留
watch(showEditDialog, (val) => {
  if (!val) {
    editingArticle.value = undefined;
  }
});

// 练习/笔记/提示词等对话框全部关闭后清理当前文章引用，避免残留
watch(
  [showFillBlanksDialog, showChoiceDialog, showNotesDialog, showPromptsDialog, showTypingDialog],
  () => {
    if (
      !showFillBlanksDialog.value &&
      !showChoiceDialog.value &&
      !showNotesDialog.value &&
      !showPromptsDialog.value &&
      !showTypingDialog.value
    ) {
      currentExerciseArticle.value = null;
    }
  }
);

// 离开列表视图时自动退出多选模式
watch(currentView, (v) => {
  if (v !== 'list' && multiSelectMode.value) exitMultiSelectMode();
});
</script>

<style scoped lang="scss">
.text-memory-container {
  padding: 0;
  height: 100%;
  overflow-y: auto;
}

// 顶部筛选排序条（仿 WordFilter.vue）
// 高度自适应 + 允许换行：视图增加到 5 个后单行会超出限宽
.filter-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  min-height: 36px;
  padding: 5px 10px;
  background: var(--utools-bg-card);
  border-bottom: 1px solid var(--utools-border-divider);
  position: relative;
  z-index: 10;
  font-size: 12px;
}

.filter-input-wrap {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 120px;
  max-width: 220px;
  height: 26px;
  background: var(--utools-bg-tertiary);
  border-radius: 4px;
  border: 1px solid var(--utools-border-divider);
  padding: 0 6px;
  transition: border-color 0.2s;

  &:focus-within {
    border-color: var(--utools-primary);
  }

  .filter-search-icon,
  .filter-clear-icon {
    font-size: 13px;
    color: var(--utools-text-tertiary);
    flex-shrink: 0;
  }

  .filter-clear-icon {
    cursor: pointer;
    &:hover { color: var(--utools-text-secondary); }
  }

  .filter-input {
    flex: 1;
    border: none;
    outline: none;
    background: transparent;
    font-size: 12px;
    color: var(--utools-text-primary);
    padding: 0 4px;
    height: 100%;
    min-width: 0;

    &::placeholder {
      color: var(--utools-text-tertiary);
    }
  }
}

.ftag {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 8px;
  border-radius: 3px;
  cursor: pointer;
  border: 1px solid var(--utools-border-divider);
  background: var(--utools-bg-tertiary);
  color: var(--utools-text-secondary);
  white-space: nowrap;
  user-select: none;
  transition: all 0.15s;

  &:hover {
    border-color: var(--utools-primary);
    color: var(--utools-primary);
  }

  &.on {
    background: var(--utools-primary);
    color: var(--utools-text-inverse);
    border-color: var(--utools-primary);
  }
}

.filter-divider {
  width: 1px;
  height: 16px;
  background: var(--utools-border-divider);
  flex-shrink: 0;
}

.sort-chips {
  display: flex;
  align-items: center;
  gap: 3px;
  flex-shrink: 0;
}

.schip {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 7px;
  border-radius: 3px;
  cursor: pointer;
  color: var(--utools-text-tertiary);
  user-select: none;
  white-space: nowrap;
  transition: all 0.15s;

  &:hover {
    color: var(--utools-text-primary);
    background: var(--utools-bg-hover);
  }

  &.on {
    color: var(--utools-primary);
    font-weight: 500;
  }
}

.filter-stats {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
  flex-shrink: 0;
}

.filter-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

// 多选工具条
.multi-select-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  padding: 6px 12px;
  background: var(--utools-bg-tertiary);
  border-bottom: 1px solid var(--utools-border-divider);
  font-size: 12px;

  .selected-count {
    color: var(--utools-text-secondary);
  }

  .multi-select-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-left: auto;
  }
}

// 多选模式下的卡片：左侧勾选框 + 选中高亮
.text-article-card {
  .select-checkbox {
    flex-shrink: 0;
    margin-top: 2px;
  }

  &.select-mode {
    cursor: default;
  }

  &.selected {
    border-color: var(--utools-primary);
    background: var(--utools-bg-hover);
  }
}

.articles-list {
  display: flex;
  flex-direction: column;
  padding: 12px;
  gap: 8px;
}

// 复用全局 list-item 卡片，并做文本记忆专用覆盖
.text-article-card {
  width: 100%;
  min-height: auto;
  max-height: none;
  padding: 12px 14px;
  margin: 0;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  box-sizing: border-box;

  &:hover {
    box-shadow: var(--utools-shadow-sm);
    border-color: var(--utools-primary);
  }

  .article-main {
    flex: 1;
    min-width: 0;
  }

  .article-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--utools-text-primary);
    margin: 0 0 8px 0;
    line-height: 1.4;
  }

  .article-content-preview {
    color: var(--utools-text-secondary);
    font-size: 14px;
    line-height: 1.6;
    margin-bottom: 10px;
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

  .article-actions {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
    opacity: 0.7;
    transition: opacity 0.2s;

    &:hover {
      opacity: 1;
    }

    .action-icon {
      font-size: 18px;
      padding: 6px;
      border-radius: 6px;
      cursor: pointer;
      color: var(--utools-text-secondary);
      transition: all 0.2s;

      &:hover {
        background-color: var(--utools-bg-hover);
        color: var(--utools-primary);
        transform: scale(1.1);
      }

      &.action-danger:hover {
        color: var(--utools-danger);
      }
    }
  }
}

// 标签 popover 内容
.popover-body {
  padding: 6px 8px;
}

.tag-option-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-height: 200px;
  overflow-y: auto;
}

.tag-option-chip {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 8px;
  border-radius: 3px;
  cursor: pointer;
  border: 1px solid var(--utools-border-divider);
  background: var(--utools-bg-tertiary);
  color: var(--utools-text-secondary);
  font-size: 12px;
  white-space: nowrap;
  user-select: none;
  transition: all 0.15s;

  &:hover {
    border-color: var(--utools-primary);
    color: var(--utools-primary);
  }

  &.on {
    background: var(--utools-primary);
    color: var(--utools-text-inverse);
    border-color: var(--utools-primary);
  }
}

.tag-empty {
  font-size: 12px;
  color: var(--utools-text-tertiary);
  padding: 8px 0;
}

.tag-clear-btn {
  margin-top: 8px;
}

.map-view {
  height: calc(100vh - 220px);
  min-height: 500px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--utools-border-color);
}
</style>

<!-- 打印样式（非 scoped，需覆盖全局布局）：
     屏幕隐藏打印容器，打印时隐藏页面其余内容、仅输出选中文章区域。
     类名用 .article-print-area，避免与知识包的 .print-area 全局样式冲突 -->
<style lang="scss">
.article-print-area {
  display: none;
}

@media print {
  body {
    background: #fff !important;
  }

  .text-memory-container {
    background: #fff !important;
    height: auto !important;
    overflow: visible !important;
    padding: 0 !important;
  }

  /* 只保留打印容器，其余（筛选条、多选条、列表）全部隐藏 */
  .text-memory-container > *:not(.article-print-area) {
    display: none !important;
  }

  .article-print-area {
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

    /* 每篇文章一个区块，尽量避免跨页截断 */
    .print-article {
      page-break-inside: avoid;
      break-inside: avoid;
      margin-bottom: 18px;
      padding-bottom: 12px;
      border-bottom: 1px solid #ccc;

      .print-article-title {
        font-size: 18px;
        font-weight: 700;
        text-align: center;
        margin: 0 0 4px;
      }

      .print-article-meta {
        font-size: 12px;
        color: #777;
        text-align: center;
        margin-bottom: 10px;
      }

      .print-article-para {
        font-size: 14px;
        line-height: 1.8;
        margin: 0 0 8px;
      }
    }
  }
}
</style>
