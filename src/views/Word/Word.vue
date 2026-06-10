  <template>

  <!--  <el-button type="primary" @click="clearWord">清空单词</el-button>-->
  <!--  <el-button type="primary" @click="initWord">初始化单词</el-button>-->

  <!--  <el-row>
      <el-col>
        <el-input :span="6" v-model="word" placeholder="请输入单词"></el-input>
                    <el-button :span="2" type="primary" @click="addWord(word)">添加单词</el-button>
        <el-button :span="2" type="primary" @click="scrollToWordByText(word)">滚动到单词</el-button>

      </el-col>
    </el-row>-->

  <div v-if="showWords">暂无数据,请在主界面输入框添加单词</div>
  <div v-else>
    <!-- 筛选排序面板 -->
    <WordFilter
        ref="wordFilterRef"
        :visible="filterPanelVisible"
        :match-count="showFilteredWords.length"
        @change="onFilterChange"
        @reset="onFilterReset"
    />
    <div class="words-cards-wrapper" ref="scrollContainer">
      <!--      虚拟滚动,只加载真实dom-->
      <!--      使用 currentWordBankId 作为 key，切换词库时强制重新渲染 -->
      <RecycleScroller
          ref="scrollerRef"
          :key="wordsStore.currentWordBankId"
          class="scroller"
          :items="showFilteredWords"
          :item-size="185"
          key-field="_id"

          :min-item-size="185"
          :item-secondary-size="390"
          v-slot="{ item, index }"
          :dynamic-size="true"
          :max-item-size="195"
          :grid-items="2"
      >
        <!--      <div class="grid-item">-->
        <MyListItem
            :word="item"
            :disable-actions="listMode"
            v-model="wordsStore.words[getIndexInOriginalList(item)]"
            @delete="deleteWord(getIndexInOriginalList(item))"
            @toggle-explained="showExplained = -1"
            :showExplained="showExplained"
            :word-index="index"
        />
        <!--      </div>-->
      </RecycleScroller>

      <!--      <MyListItem v-for="(item,index) in wordsStore.words"
                        :key="index"
                        :word="item"
                        :style="(showOnlyRemembered ? item.remember : item.isReview) ? '': 'display:none' "
                        :disable-actions="showOnlyRemembered"
                        v-model="wordsStore.words[index]"
                        @delete="deleteWord(index)"
                        :ref="(el) => setItemRef(el, index)"
            >
            </MyListItem>-->
    </div>
  </div>

  <div>
    <!-- 抽屉组件化   -->
    <DetailDrawer v-model="drawerVisible" :title="title" :detail-id="currentId"/>
  </div>

  <!-- 截图翻译结果预览对话框 -->
  <el-dialog
      v-model="ocrDialogVisible"
      title="截图识别结果"
      width="500px"
      :close-on-click-modal="false"
  >
    <div v-if="ocrLoading" class="ocr-loading">
      <el-icon class="is-loading">
        <Loading/>
      </el-icon>
      <span>正在识别...</span>
    </div>
    <div v-else-if="ocrError" class="ocr-error">
      <el-icon>
        <Warning/>
      </el-icon>
      <span>{{ ocrError }}</span>
    </div>
    <div v-else class="ocr-content">
      <!-- 识别到的原文 -->
      <div class="ocr-section" v-if="ocrOriginalText">
        <div class="section-title">识别内容：</div>
        <div class="ocr-text">{{ ocrOriginalText }}</div>
      </div>

      <!-- 提取的单词列表 -->
      <div class="ocr-section" v-if="ocrWords.length > 0">
        <div class="section-title">
          提取的单词 ({{ ocrSelectedWords.length }}/{{ ocrWords.length }}):
          <el-checkbox v-model="selectAllWords" @change="handleSelectAll">全选</el-checkbox>
        </div>
        <div class="word-list">
          <el-checkbox-group v-model="ocrSelectedWords">
            <el-checkbox
                v-for="word in ocrWords"
                :key="word"
                :label="word"
                :value="word"
                border
                size="small"
            >
              {{ word }}
            </el-checkbox>
          </el-checkbox-group>
        </div>
      </div>

      <div v-else-if="!ocrError" class="ocr-empty">
        <el-icon>
          <InfoFilled/>
        </el-icon>
        <span>未识别到有效的英文单词</span>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="ocrDialogVisible = false">取消</el-button>
        <el-button
            type="primary"
            @click="confirmAddOcrWords"
            :disabled="ocrSelectedWords.length === 0 || ocrLoading"
        >
          添加选中单词 ({{ ocrSelectedWords.length }})
        </el-button>
      </div>
    </template>
  </el-dialog>

  <!-- 词库选择对话框 -->
  <el-dialog
      v-model="wordBankSelectVisible"
      title="选择要导入的词库"
      width="400px"
      :close-on-click-modal="false"
  >
    <div class="wordbank-select-content">
      <el-radio-group v-model="selectedImportBank" class="wordbank-radio-group">
        <el-radio
            v-for="bank in wordBankOptions"
            :key="bank.value"
            :label="bank.value"
            border
            class="wordbank-radio"
        >
          {{ bank.label }}
          <span v-if="isWordBankCached(bank.value as WordBankType)" class="cached-tag">已缓存</span>
        </el-radio>
      </el-radio-group>
    </div>
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="wordBankSelectVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmImportFromBank" :disabled="!selectedImportBank">
          确认导入
        </el-button>
      </div>
    </template>
  </el-dialog>

  <!-- 词库管理对话框 -->
  <el-dialog
      v-model="wordBankManagerVisible"
      title="词库管理"
      width="500px"
      :close-on-click-modal="false"
  >
    <div class="wordbank-manager-content">
      <div class="wordbank-list">
        <div
            v-for="bank in customWordBanks"
            :key="bank.id"
            :class="['wordbank-item', { active: wordsStore.currentWordBankId === bank.id }]"
        >
          <div class="wordbank-info" @click="switchToWordBank(bank.id)">
            <span class="wordbank-name">{{ bank.name }}</span>
            <span class="wordbank-count">{{ bank.words.length }} 词</span>
            <el-tag v-if="bank.isDefault" size="small" type="success">默认</el-tag>
          </div>
          <div class="wordbank-actions">
            <el-button
                v-if="!bank.isDefault"
                type="danger"
                link
                size="small"
                @click="confirmDeleteWordBank(bank)"
            >
              <el-icon>
                <Delete/>
              </el-icon>
            </el-button>
          </div>
        </div>
      </div>
      <el-divider/>
      <div class="wordbank-actions-footer">
        <el-button type="primary" @click="showCreateWordBankDialog">
          <el-icon>
            <Plus/>
          </el-icon>
          新建词库
        </el-button>
      </div>
    </div>
  </el-dialog>

  <!-- 新建词库对话框 -->
  <el-dialog
      v-model="createWordBankVisible"
      title="新建词库"
      width="400px"
      :close-on-click-modal="false"
  >
    <div class="create-wordbank-content">
      <el-form :model="newWordBankForm" label-width="80px">
        <el-form-item label="词库名称">
          <el-input
              v-model="newWordBankForm.name"
              placeholder="请输入词库名称"
              maxlength="20"
              show-word-limit
          />
        </el-form-item>
        <el-form-item label="初始内容">
          <el-radio-group v-model="newWordBankForm.initType">
            <el-radio label="empty">空词库</el-radio>
            <el-radio label="import">从系统词库导入</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="newWordBankForm.initType === 'import'" label="选择词库">
          <el-select v-model="newWordBankForm.importBank" placeholder="请选择要导入的词库" style="width: 100%"
                     popper-class="wordbank-import-dropdown">
            <el-option
                v-for="bank in wordBankOptions"
                :key="bank.value"
                :label="bank.label"
                :value="bank.value"
            />
          </el-select>
        </el-form-item>
      </el-form>
    </div>
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="createWordBankVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmCreateWordBank" :disabled="!newWordBankForm.name.trim()">
          创建
        </el-button>
      </div>
    </template>
  </el-dialog>

  <!--     旧版本的写法 @forget="(childValue)=>forget(item,childValue)"-->

  <div class="home_footer">
    <div>
      <!-- 当前词库名称显示 -->
      <span class="current-bank-name" @click="openWordBankManager">
        <i class="iconfont icon-library"></i>
        {{ wordsStore.currentWordBank?.name || '默认词库' }}
      </span>
      <el-divider direction="vertical"/>
      <span :class="{ 'remembered-highlight': listMode==0 }" @click="showOnlyForget"> 待复习: {{
          wordsStore.forgetCount
        }} </span>
      <span :class="{ 'remembered-highlight': listMode==1 }" @click="showOnlyReview"> 已复习: {{
          wordsStore.reviewCount
        }} </span>
      <span :class="{ 'remembered-highlight': listMode==2 }"
            @click="showOnlyRemembered"> 已记完: {{ wordsStore.rememberCount }} </span>
      <span :class="{ 'remembered-highlight': listMode==3 }" @click="showAll"> 单词总数: {{ wordsStore.count }} </span>
    </div>
    <div>

      <!--            <i class="iconfont icon-time" @click="scrollToWordByText('disk')"></i>-->
      <el-tooltip class="box-item" effect="dark" content="置顶" placement="top" popper-class="small-tooltip">
        <i class="iconfont icon-top" @click="scrollToTop"></i>
      </el-tooltip>
      <el-tooltip class="box-item" effect="dark" content="置底" placement="top" popper-class="small-tooltip">
        <i class="iconfont icon-down" @click="scrollToBottom"></i>
      </el-tooltip>

      <el-tooltip class="box-item" effect="dark" content="显示释义" placement="top" popper-class="small-tooltip">
        <i class="iconfont icon-visible" @click="visibleExplained"></i>
      </el-tooltip>
      <el-tooltip class="box-item" effect="dark" content="隐藏释义" placement="top" popper-class="small-tooltip">
        <i class="iconfont icon-invisible" @click="invisibleExplained"></i>
      </el-tooltip>
      <el-tooltip class="box-item" effect="dark" content="筛选排序" placement="top" popper-class="small-tooltip">
        <i class="iconfont icon-level" :class="{ 'filter-active': filterPanelVisible }" style="cursor: pointer; font-size: 18px;" @click="toggleFilterPanel"></i>
      </el-tooltip>
<!--      <el-tooltip class="box-item" effect="dark" content="截图识别" placement="top" popper-class="small-tooltip">
        <i class="iconfont icon-translate" @click="startScreenCapture" style="font-weight: bold;"></i>
      </el-tooltip>-->

      <!--      <i class="iconfont icon-import" @click="importWords"></i>
            <i class="iconfont icon-export" @click="exportWords"></i-->

      <!-- 导入下拉菜单 -->
      <el-dropdown @command="handleImportCommand" :disabled="listMode==1||listMode==2">
        <i class="iconfont icon-import"></i>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="importJson">JSON导入</el-dropdown-item>
            <el-dropdown-item command="importText">TXT/CSV导入</el-dropdown-item>
            <el-dropdown-item divided command="importFromWordBank">从词库导入</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>

      <!-- 导出下拉菜单 -->
      <el-dropdown @command="handleExportCommand">
        <i class="iconfont icon-export"></i>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="exportJson">导出JSON</el-dropdown-item>
            <el-dropdown-item command="exportText">导出TXT</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>

      <el-tooltip class="box-item" effect="dark" content="听写练习" placement="top" popper-class="small-tooltip">
        <i class="iconfont icon-list" @click="goToDictation" style="font-weight: bold;"></i>
      </el-tooltip>
      <el-tooltip class="box-item" effect="dark" content="字母映射" placement="top" popper-class="small-tooltip">
        <el-icon :size="18" style="cursor: pointer;" @click="goToLetterMemory"><Tickets /></el-icon>
      </el-tooltip>
      <el-tooltip class="box-item" effect="dark" content="专注模式" placement="top" popper-class="small-tooltip">
        <i class="iconfont icon-card" @click="() => openFocusMode()"></i>
      </el-tooltip>

      <el-tooltip class="box-item" effect="dark" content="多端同步" placement="top" popper-class="small-tooltip">
        <el-icon :size="18" style="cursor: pointer;" @click="syncDialogVisible = true"><Connection /></el-icon>
      </el-tooltip>
      <el-tooltip class="box-item" effect="dark" content="设置" placement="top" popper-class="small-tooltip">
        <i class="iconfont icon-setting" @click="drawerVisible = true"></i>
      </el-tooltip>
      <SyncDialog v-model="syncDialogVisible" />
      <!--      </el-tooltip>
                  <a href="#/home/list" style="margin-left: 16px;">
                    &lt;!&ndash;        <i class="iconfont icon-list active"></i>&ndash;&gt;
                  </a>-->
      <!--      <a href="#/home/typing" style="margin-left: 16px;">-->
      <!--        <i class="iconfont icon-card "></i>-->
      <!--      </a>-->
    </div>
  </div>
</template>

<script setup lang="ts">


import {ElMessage, ElLoading, ElMessageBox} from "element-plus";
import { Tickets } from '@element-plus/icons-vue';
import {testData} from "@/testData";
import type {Word} from "@/types/words";

import {useWordsStore} from "@/stores/words.ts";
import DetailDrawer from "@/views/Word/components/DetailDrawer.vue";
import MyListItem from "@/views/Word/components/MyListItem.vue";
import WordFilter from "@/views/Word/components/WordFilter.vue";
import type { FilterState } from "@/views/Word/components/WordFilter.vue";
import SyncDialog from "@/components/SyncDialog.vue";
import {computed, nextTick, onMounted, onUnmounted, ref, watch, shallowRef} from "vue";
import {
  filterWordsForJsonExport,
  filterWordsForTextExport,
  parseFileContent,
  validateImportedWords
} from "@/utils/word-util.ts";

import {log} from "@/utils/logger.ts";
import {analyzeWord} from "@/utils/word-analysis.ts";
import {isPhrase, getWordCount} from "@/utils/text-utils";
import {RecycleScroller} from 'vue-virtual-scroller'
import {addWord, batchAddWords, batchTranslateAndAddWords} from "@/utils/str-util.ts";
import {ocrTranslateMultiPlatform} from "@/utils/pic-translate.ts";
import {
  Loading,
  Warning,
  InfoFilled,
  VideoPlay,
  CircleCheck,
  CircleClose,
  Trophy,
  Delete,
  Plus,
  Connection
} from '@element-plus/icons-vue';
import {useRouter, useRoute} from 'vue-router';
import {getSetDb} from '@/utils/user-set-db-util.ts';
import {getDbAdapter} from '@/adapters/db';
import {isUtools} from '@/adapters/platform';
import {mergeFocusModeSettings, shouldIgnoreMouseInLockedFocusWindow} from '@/utils/focus-lock';
import {
  fetchWordBank,
  WORDBANK_LIST,
  type WordBankType,
  isWordBankCached
} from '@/utils/wordbank-service';
import {
  getAllWordBanks,
  createWordBank as createNewWordBank,
  deleteWordBank as removeWordBank,
  type WordBank,
  importFromBuiltinWordBank,
  getCurrentWordBankId
} from '@/utils/wordbank-manager';

const FOCUS_MODE_ACTION_STORAGE_KEY = 'slowly-record-focus-mode-action';
const FOCUS_MODE_DB_ACTION_TTL = 15000;
const EDGE_RESTORE_OFFSET = 12;
const EDGE_RESTORE_COOLDOWN = 800;
const EDGE_STICK_THRESHOLD = 25;
const EDGE_VISIBLE_SIZE = 36;
const EDGE_DRAG_OUT_THRESHOLD = 24;


const word = ref('')
const wordsStore = useWordsStore();
const router = useRouter();
const route = useRoute();

// 如果 URL 携带 openFocus=1 参数（从听写等其他页面跳转过来），自动打开专注模式
const focusModeParam = ref(route.query.focusMode as string || '');
if (route.query.openFocus === '1') {
  // 延迟确保单词列表加载完毕
  nextTick(() => {
    setTimeout(() => {
      openFocusMode(focusModeParam.value);
      // 清理 query 参数，防止重复触发
      router.replace({ query: { ...route.query, openFocus: undefined, focusMode: undefined } });
    }, 300);
  });
}

// 切换词库选项
const wordBankOptions = [
  {label: '四级词汇', value: 'cet4'},
  {label: '六级词汇', value: 'cet6'},
  {label: '商务英语', value: 'bec'},
  {label: 'GMAT词汇', value: 'gmat'},
  {label: 'GRE词汇', value: 'gre'},
  {label: '雅思词汇', value: 'ielts'},
  {label: '考公词汇', value: 'kaogong'},
  {label: '考研词汇', value: 'kaoyan'},
  {label: '专业四级', value: 'level4'},
  {label: '专业八级', value: 'level8'},
  {label: 'SAT词汇', value: 'sat'},
  {label: '托福词汇', value: 'toefl'},
  {label: '专升本词汇', value: 'zsb'},
  {label: '词根词缀', value: 'roots'},
];

const drawerVisible = ref(false)
const syncDialogVisible = ref(false)
const title = ref('设置')
const currentId = ref<string | number | undefined>(undefined)

// ========== 词库管理功能 ==========
const wordBankManagerVisible = ref(false)
const createWordBankVisible = ref(false)
const customWordBanks = ref<WordBank[]>([])

// 新建词库表单
const newWordBankForm = ref({
  name: '',
  initType: 'empty' as 'empty' | 'import',
  importBank: '' as WordBankType | ''
})

// 加载自定义词库列表
const loadCustomWordBanks = async () => {
  customWordBanks.value = await getAllWordBanks()
}

// 打开词库管理器
const openWordBankManager = () => {
  loadCustomWordBanks()
  wordBankManagerVisible.value = true
}

// 监听词库管理器可见性变化，当打开时刷新数据
watch(() => wordBankManagerVisible.value, (visible) => {
  if (visible) {
    loadCustomWordBanks()
  }
})

// 监听当前词库的单词数量变化，如果词库管理器打开则刷新
watch(() => wordsStore.currentWordBank?.words.length, () => {
  if (wordBankManagerVisible.value) {
    loadCustomWordBanks()
  }
})

// 切换到指定词库
const switchToWordBank = async (bankId: string) => {
  const success = await wordsStore.switchWordBank(bankId)
  if (success) {
    ElMessage.success(`已切换到: ${wordsStore.currentWordBank?.name}`)
    wordBankManagerVisible.value = false
  } else {
    ElMessage.error('切换词库失败')
  }
}

// 确认删除词库
const confirmDeleteWordBank = (bank: WordBank) => {
  if (bank.isDefault) {
    ElMessage.warning('默认词库不能删除')
    return
  }
  if (bank.words.length > 0) {
    ElMessageBox.confirm(
        `词库 "${bank.name}" 包含 ${bank.words.length} 个单词，确定要删除吗？`,
        '删除确认',
        {
          confirmButtonText: '删除',
          cancelButtonText: '取消',
          type: 'warning',
        }
    ).then(() => {
      doDeleteWordBank(bank.id)
    }).catch(() => {
      // 取消删除
    })
  } else {
    doDeleteWordBank(bank.id)
  }
}

// 执行删除词库
const doDeleteWordBank = async (bankId: string) => {
  const success = await removeWordBank(bankId)
  if (success) {
    ElMessage.success('词库已删除')
    loadCustomWordBanks()
    // 如果删除的是当前词库，切换到默认词库并刷新
    if (wordsStore.currentWordBankId === bankId) {
      // 获取新的当前词库ID（已切换到默认词库）
      const newCurrentId = await getCurrentWordBankId()
      wordsStore.currentWordBankId = newCurrentId
      await wordsStore.listWords()
    }
  } else {
    ElMessage.error('删除失败')
  }
}

// 显示创建词库对话框
const showCreateWordBankDialog = () => {
  newWordBankForm.value = {
    name: '',
    initType: 'empty',
    importBank: ''
  }
  createWordBankVisible.value = true
}

// 确认创建词库
const confirmCreateWordBank = async () => {
  const name = newWordBankForm.value.name.trim()
  if (!name) {
    ElMessage.warning('请输入词库名称')
    return
  }

  // 检查名称是否重复
  const existing = customWordBanks.value.find(b => b.name === name)
  if (existing) {
    ElMessage.warning('词库名称已存在')
    return
  }

  // 创建词库
  const newBank = await createNewWordBank(name)

  // 如果从系统词库导入
  if (newWordBankForm.value.initType === 'import' && newWordBankForm.value.importBank) {
    const loading = ElLoading.service({
      lock: true,
      text: '正在导入词库...',
      background: 'rgba(0, 0, 0, 0.7)',
    })

    try {
      const result = await importFromBuiltinWordBank(newBank.id, newWordBankForm.value.importBank)
      loading.close()

      if (result.success && result.count > 0) {
        ElMessage.success(`成功创建词库 "${name}"，导入 ${result.count} 个单词`)
      } else if (result.success && result.count === 0) {
        ElMessage.warning(`词库 "${name}" 创建成功，但没有新单词可导入（可能已存在）`)
      } else {
        ElMessage.error(`词库 "${name}" 创建成功，但导入失败: ${result.error || '未知错误'}`)
      }
    } catch (error) {
      loading.close()
      console.error('导入失败:', error)
      ElMessage.error('导入失败')
    }
  } else {
    ElMessage.success(`成功创建空词库 "${name}"`)
  }

  createWordBankVisible.value = false
  loadCustomWordBanks()

  // 切换到新创建的词库
  switchToWordBank(newBank.id)
}

// 专注模式窗口实例
let focusWindow: any = null;
let focusModeSyncTimer: any = null;
let currentFocusMode = '';  // 当前专注模式（'dictation'=听写，''=标准）
let lastSyncedAlwaysOnTop: boolean | null = null;
let lastSyncedEdgeStickEnabled: boolean | null = null;
let lastSyncedLocked: boolean | null = null;
let lastHandledFocusModeActionAt = 0;
let ignoreMousePollTimer: any = null;
let lastPolledIgnoreMouse: boolean | null = null;
let warnedMissingIgnoreMouseApi = false;

// 处理子窗口状态保存
let focusWindowState = {
  currentIndex: 0,
  showExplains: false,
  opacity: 1.0,
  edgeStickEnabled: true,
};


const applyFocusWindowAlwaysOnTop = (targetWindow: any, alwaysOnTop: boolean, source: string) => {
  if (!targetWindow || typeof targetWindow.setAlwaysOnTop !== 'function') {
    return false;
  }

  try {
    targetWindow.setAlwaysOnTop(alwaysOnTop);
    if (alwaysOnTop && typeof targetWindow.moveTop === 'function') {
      targetWindow.moveTop();
    }
    const appliedState = typeof targetWindow.isAlwaysOnTop === 'function'
        ? targetWindow.isAlwaysOnTop()
        : alwaysOnTop;
    console.log(`[${source}] 专注窗口置顶状态已应用:`, alwaysOnTop, '当前实际状态:', appliedState);
    return appliedState === alwaysOnTop;
  } catch (e) {
    console.error(`[${source}] 应用置顶状态失败:`, e);
    return false;
  }
};


const clearFocusModeSync = () => {
  if (focusModeSyncTimer) {
    clearInterval(focusModeSyncTimer);
    focusModeSyncTimer = null;
  }
  stopIgnoreMousePoll();
};

const getCursorPointCandidates = async () => {
  try {
    if (isUtools() && (window as any).utools?.getCursorScreenPoint) {
      const point = (window as any).utools.getCursorScreenPoint();
      const candidates = [point];
      if ((window as any).utools.screenToDipPoint) {
        const dipPoint = (window as any).utools.screenToDipPoint(point);
        candidates.push(dipPoint);
      }
      return candidates;
    }
    if (window.electronAPI?.getCursorScreenPoint) {
      const point = await window.electronAPI.getCursorScreenPoint();
      return point ? [point] : [];
    }
  } catch (e) {
    console.error('[focusLock] 获取鼠标屏幕坐标失败:', e);
  }
  return [];
};

const setFocusWindowMouseIgnore = (shouldIgnore: boolean) => {
  if (!focusWindow || focusWindow.isDestroyed?.()) {
    return;
  }

  if (typeof focusWindow.setIgnoreMouseEvents !== 'function') {
    if (!warnedMissingIgnoreMouseApi) {
      console.warn('[focusLock] focusWindow 未暴露 setIgnoreMouseEvents API，无法穿透');
      warnedMissingIgnoreMouseApi = true;
    }
    return;
  }

  if (shouldIgnore === lastPolledIgnoreMouse) {
    return;
  }

  console.log('[focusLock] 切换鼠标穿透:', shouldIgnore ? '穿透' : '禁止穿透');
  if (shouldIgnore) {
    focusWindow.setIgnoreMouseEvents(true, { forward: true });
  } else {
    focusWindow.setIgnoreMouseEvents(false);
    if (typeof focusWindow.focus === 'function') {
      focusWindow.focus();
    }
  }
  lastPolledIgnoreMouse = shouldIgnore;
};

const startIgnoreMousePoll = () => {
  if (ignoreMousePollTimer) {
    clearTimeout(ignoreMousePollTimer);
    ignoreMousePollTimer = null;
  }
  lastPolledIgnoreMouse = null;
  setFocusWindowMouseIgnore(true);

  const poll = async () => {
    if (!focusWindow || focusWindow.isDestroyed?.() || !lastSyncedLocked) {
      ignoreMousePollTimer = null;
      return;
    }
    try {
      const bounds = focusWindow.getBounds?.();
      const cursorCandidates = await getCursorPointCandidates();
      if (!focusWindow || focusWindow.isDestroyed?.()) {
        ignoreMousePollTimer = null;
        return;
      }

      setFocusWindowMouseIgnore(
        shouldIgnoreMouseInLockedFocusWindow(bounds, cursorCandidates),
      );
    } catch (e) {
      // ignore
    }
    if (focusWindow && !focusWindow.isDestroyed?.() && lastSyncedLocked) {
      ignoreMousePollTimer = setTimeout(poll, 50);
    } else {
      ignoreMousePollTimer = null;
    }
  };
  poll();
};

const stopIgnoreMousePoll = () => {
  if (ignoreMousePollTimer) {
    clearTimeout(ignoreMousePollTimer);
    ignoreMousePollTimer = null;
  }
  setFocusWindowMouseIgnore(false);
  lastPolledIgnoreMouse = null;
};

const updateFocusModeDoc = (updater: (focusMode: any) => void) => {
  try {
    const userSetDoc = getSetDb(true);
    if (!userSetDoc) {
      return;
    }

    const nextFocusMode = mergeFocusModeSettings(wordsStore.focusMode, userSetDoc.focusMode);

    updater(nextFocusMode);

    if (nextFocusMode.pendingAction == null) {
      delete nextFocusMode.pendingAction;
    }

    userSetDoc.focusMode = nextFocusMode;
    getDbAdapter().put(userSetDoc);
  } catch (e) {
    console.error('[focusModeDoc] 更新专注模式文档失败:', e);
  }
};

const saveFocusModePendingAction = (type: string, payload?: any, at = Date.now()) => {
  updateFocusModeDoc((focusMode) => {
    focusMode.pendingAction = {
      type,
      payload,
      at,
    };
  });
};


const clearFocusModePendingAction = () => {
  updateFocusModeDoc((focusMode) => {
    delete focusMode.pendingAction;
  });
};

const consumeLatestFocusModePendingAction = (source = 'db') => {
  try {
    const focusMode = getSetDb(true)?.focusMode;
    const pendingAction = focusMode?.pendingAction;
    const pendingActionAt = Number(pendingAction?.at || 0);

    if (!pendingAction) {
      return false;
    }

    if (pendingActionAt && pendingActionAt <= lastHandledFocusModeActionAt) {
      return false;
    }

    if (pendingActionAt && Date.now() - pendingActionAt > FOCUS_MODE_DB_ACTION_TTL) {
      clearFocusModePendingAction();
      return false;
    }

    lastHandledFocusModeActionAt = pendingActionAt || Date.now();
    return processFocusModePendingAction(pendingAction, source);
  } catch (e) {
    console.error(`[focusModeAction] 读取待处理动作失败(${source}):`, e);
    return false;
  }
};

const handleSetAlwaysOnTop = (state: any) => {

  const newAlwaysOnTop = state?.alwaysOnTop ?? true;
  const newEdgeStickEnabled = state?.edgeStickEnabled ?? wordsStore.focusMode?.edgeStickEnabled ?? true;
  lastSyncedAlwaysOnTop = newAlwaysOnTop;
  lastSyncedEdgeStickEnabled = newEdgeStickEnabled;
  console.log('[handleSetAlwaysOnTop] 开始处理，目标状态:', newAlwaysOnTop, '当前窗口:', focusWindow);

  if (state) {
    focusWindowState = {
      currentIndex: state.currentIndex || 0,
      showExplains: state.showExplains || false,
      opacity: state.opacity || 1.0,
      edgeStickEnabled: newEdgeStickEnabled,
    };
  }

  if (wordsStore.focusMode) {
    wordsStore.focusMode.alwaysOnTop = newAlwaysOnTop;
    wordsStore.focusMode.edgeStickEnabled = newEdgeStickEnabled;
  }


  if (!focusWindow || focusWindow.isDestroyed?.()) {
    console.log('[handleSetAlwaysOnTop] 当前窗口不可用，回退为重建窗口');
    handleRecreateWindow(state);
    return;
  }

  if (typeof focusWindow.show === 'function') {
    focusWindow.show();
  }
  if (typeof focusWindow.focus === 'function') {
    focusWindow.focus();
  }

  const applied = applyFocusWindowAlwaysOnTop(focusWindow, newAlwaysOnTop, 'handleSetAlwaysOnTop');
  if (!newAlwaysOnTop) {
    return;
  }

  if (!applied) {
    console.log('[handleSetAlwaysOnTop] 首次直接置顶未生效，等待重试校验');
  }

  [80, 220].forEach((delay) => {
    setTimeout(() => {
      if (!focusWindow || focusWindow.isDestroyed?.()) {
        return;
      }
      const retryResult = applyFocusWindowAlwaysOnTop(focusWindow, true, `handleSetAlwaysOnTop:retry:${delay}`);
      if (!retryResult && delay === 220) {
        console.log('[handleSetAlwaysOnTop] 最终校验仍未置顶，回退为重建窗口');
        handleRecreateWindow(state);
      }
    }, delay);
  });
};


// 处理重新创建窗口请求（用于切换置顶状态）
const handleRecreateWindow = (state: any) => {


  console.log('[handleRecreateWindow] 开始处理，当前 focusWindow:', focusWindow, '状态:', state);

  // 保存状态
  const newEdgeStickEnabled = state?.edgeStickEnabled ?? wordsStore.focusMode?.edgeStickEnabled ?? true;
  if (state) {
    focusWindowState = {
      currentIndex: state.currentIndex || 0,
      showExplains: state.showExplains || false,
      opacity: state.opacity || 1.0,
      edgeStickEnabled: newEdgeStickEnabled,
    };
  }

  const newAlwaysOnTop = state?.alwaysOnTop ?? true;
  lastSyncedAlwaysOnTop = newAlwaysOnTop;
  lastSyncedEdgeStickEnabled = newEdgeStickEnabled;
  // 更新 store 状态以保证同一次启动内重新打开时不会闪烁
  if (wordsStore.focusMode) {
    wordsStore.focusMode.alwaysOnTop = newAlwaysOnTop;
    wordsStore.focusMode.edgeStickEnabled = newEdgeStickEnabled;
  }
  console.log('[handleRecreateWindow] 新的置顶状态:', newAlwaysOnTop, '贴边隐藏:', newEdgeStickEnabled);


  // 关闭旧窗口
  if (focusWindow) {
    console.log('[handleRecreateWindow] 准备关闭旧窗口');
    try {
      // 检查窗口是否已销毁
      const isDestroyed = focusWindow.isDestroyed?.();
      console.log('[handleRecreateWindow] 窗口是否已销毁:', isDestroyed);

      if (!isDestroyed) {
        console.log('[handleRecreateWindow] 调用 close()');
        focusWindow.close();
        console.log('[handleRecreateWindow] close() 已调用');
      }
    } catch (e) {
      console.error('[handleRecreateWindow] 关闭旧窗口失败:', e);
    }
  } else {
    console.log('[handleRecreateWindow] focusWindow 为空，无需关闭');
  }

  // 强制清空引用
  focusWindow = null;
  console.log('[handleRecreateWindow] focusWindow 已置为 null');

  // 清理贴边相关
  clearEdgeStickResources();
  isEdgeHidden = false;
  savedBounds = null;
  edgeHiddenSide = null;
  edgeRestoreSuspendedUntil = 0;
  isExpandedFromEdge = false;


  // 获取当前主题
  const isDark = document.body.classList.contains('utools-dark') ||
      document.documentElement.classList.contains('utools-dark') ||
      document.documentElement.classList.contains('dark');
  const themeParam = isDark ? 'dark' : 'light';

  // 延迟创建新窗口，确保旧窗口已关闭
  setTimeout(() => {
    console.log('[handleRecreateWindow] 延迟后创建新窗口');
    try {
      // @ts-ignore
      const currentBankId = encodeURIComponent(wordsStore.currentWordBankId || '');
      const filterPattern = encodeURIComponent(currentFilter.value.pattern || '');
      const filterMinLen = currentFilter.value.minLength > 0 ? currentFilter.value.minLength : '';
      const filterMaxLen = currentFilter.value.maxLength > 0 ? currentFilter.value.maxLength : '';
      const filterSortBy = encodeURIComponent(currentFilter.value.sortBy || '');
      const filterSortAsc = currentFilter.value.sortAsc ? '1' : '0';
      const recreateModeParam = currentFocusMode ? `&mode=${currentFocusMode}` : '';
      focusWindow = (window as any).utools?.createBrowserWindow(`focus.html?theme=${themeParam}&index=${focusWindowState.currentIndex}&showExplains=${focusWindowState.showExplains}&opacity=${focusWindowState.opacity}&alwaysOnTop=${newAlwaysOnTop}&edgeStickEnabled=${newEdgeStickEnabled}&bankId=${currentBankId}&listMode=${listMode.value}&pattern=${filterPattern}&minLen=${filterMinLen}&maxLen=${filterMaxLen}&sortBy=${filterSortBy}&sortAsc=${filterSortAsc}&autoSpeak=${wordsStore.autoSpeak ? '1' : '0'}${recreateModeParam}`, {

        width: 320,
        height: 100,
        minWidth: 200,
        minHeight: 80,
        maxWidth: 400,
        maxHeight: 150,
        alwaysOnTop: newAlwaysOnTop,
        frame: false,
        transparent: true,
        backgroundColor: '#00000000',
        resizable: true,
        modal: false,
        closable: true,
      }, () => {
        console.log('[handleRecreateWindow] 新专注窗口已创建，置顶状态:', newAlwaysOnTop);
        applyFocusWindowAlwaysOnTop(focusWindow, newAlwaysOnTop, 'handleRecreateWindow');
        if (focusWindow && typeof focusWindow.show === 'function') {
          focusWindow.show();
        }
      });


      // 窗口关闭时清理
      const recreatedWindow = focusWindow;
      recreatedWindow?.on?.('closed', () => {
        console.log('[handleRecreateWindow] 窗口 closed 事件');
        consumeLatestFocusModePendingAction('closed');

        if (focusWindow === recreatedWindow) {
          focusWindow = null;
          clearFocusModeSync();
          clearEdgeStickResources();
          isEdgeHidden = false;
          savedBounds = null;
          edgeHiddenSide = null;
          edgeRestoreSuspendedUntil = 0;
          isExpandedFromEdge = false;
        }
      });

      startFocusModeSync(newAlwaysOnTop, newEdgeStickEnabled);

      // 延迟启动贴边检测
      setTimeout(() => {
        setupEdgeStick();
      }, 500);

      // 重新设置消息监听
      setupMessageListener();

    } catch (e) {
      console.error('[handleRecreateWindow] 重新创建窗口失败:', e);
    }
  }, 200); // 延迟 200ms 确保旧窗口关闭
};

// 贴边隐藏相关
let edgeStickTimer: any = null;
let edgeStickCleanup: (() => void) | null = null;
let isEdgeHidden = false;
let savedBounds: any = null;
let edgeHiddenSide: 'left' | 'right' | null = null;
let edgeRestoreSuspendedUntil = 0;
let isExpandedFromEdge = false;
let edgeExpandCollapseTimer: any = null;

const clearEdgeExpandCollapseTimer = () => {
  if (edgeExpandCollapseTimer) {
    clearTimeout(edgeExpandCollapseTimer);
    edgeExpandCollapseTimer = null;
  }
};

const getFocusWindowScreenBounds = (referenceBounds?: any) => {
  const windowScreen: any = focusWindow?.screen || {};
  const browserScreen: any = typeof screen !== 'undefined' ? screen : {};

  const left = Number(windowScreen.workAreaX ?? windowScreen.x ?? windowScreen.left ?? browserScreen.availLeft ?? 0) || 0;
  const top = Number(windowScreen.workAreaY ?? windowScreen.y ?? windowScreen.top ?? browserScreen.availTop ?? 0) || 0;
  const width = Number(windowScreen.workAreaWidth ?? windowScreen.availWidth ?? windowScreen.width ?? browserScreen.availWidth ?? browserScreen.width ?? referenceBounds?.width ?? 0) || 0;
  const height = Number(windowScreen.workAreaHeight ?? windowScreen.availHeight ?? windowScreen.height ?? browserScreen.availHeight ?? browserScreen.height ?? referenceBounds?.height ?? 0) || 0;
  const right = left + Math.max(0, width);
  const bottom = top + Math.max(0, height);

  return {
    left,
    top,
    width: Math.max(0, width),
    height: Math.max(0, height),
    right,
    bottom,
  };
};

const getHiddenEdgeX = (side: 'left' | 'right', width: number, screenBounds = getFocusWindowScreenBounds()) => {
  return side === 'left'
      ? screenBounds.left - width + EDGE_VISIBLE_SIZE
      : screenBounds.right - EDGE_VISIBLE_SIZE;
};

const getExpandedEdgeBounds = (
    bounds: any,
    side: 'left' | 'right',
    screenBounds = getFocusWindowScreenBounds(bounds),
) => {
  const minX = screenBounds.left;
  const maxX = Math.max(minX, screenBounds.right - bounds.width);
  const minY = screenBounds.top;
  const maxY = Math.max(minY, screenBounds.bottom - bounds.height);
  const nextBounds = {...bounds};

  nextBounds.x = side === 'left'
      ? Math.min(maxX, Math.max(minX + EDGE_RESTORE_OFFSET, bounds.x))
      : Math.max(minX, Math.min(maxX - EDGE_RESTORE_OFFSET, bounds.x));
  nextBounds.y = Math.max(minY, Math.min(maxY, bounds.y));

  return nextBounds;
};


const resetEdgeHiddenState = (source = 'unknown') => {
  if (isEdgeHidden || isExpandedFromEdge || savedBounds || edgeHiddenSide) {
    console.log(`[resetEdgeHiddenState] 重置贴边状态，来源: ${source}`);
  }
  isEdgeHidden = false;
  savedBounds = null;
  edgeHiddenSide = null;
  isExpandedFromEdge = false;
  notifyChildEdgeState(false);
};

const clearEdgeStickResources = () => {
  if (edgeStickTimer) {
    clearInterval(edgeStickTimer);
    edgeStickTimer = null;
  }
  if (edgeStickCleanup) {
    edgeStickCleanup();
    edgeStickCleanup = null;
  }
  clearEdgeExpandCollapseTimer();
}

// 通知子窗口贴边状态变化
function notifyChildEdgeState(isStuck: boolean, side?: 'left' | 'right', expanded = false) {
  if (!focusWindow) return;
  try {
    if (focusWindow.webContents && focusWindow.webContents.executeJavaScript) {
      const sideValue = JSON.stringify(side || '');
      focusWindow.webContents.executeJavaScript(`
        if (typeof updateEdgeStuckState === 'function') {
          updateEdgeStuckState(${isStuck}, ${sideValue}, ${expanded});
        }
      `).catch(() => {
      });
    }
  } catch (e) {
    console.error('通知子窗口贴边状态失败:', e);
  }
}

const finalizeExpandedFromEdge = (bounds: any, source = 'dragOut') => {
  if (!bounds) {
    return false;
  }

  console.log('[finalizeExpandedFromEdge] 贴边预览已被拖出，转为正常显示:', source, bounds);
  resetEdgeHiddenState(`finalize:${source}`);
  edgeRestoreSuspendedUntil = Date.now() + EDGE_RESTORE_COOLDOWN;
  return true;
};

function restoreFromEdge(source = 'unknown') {
  console.log(`[restoreFromEdge] 收到恢复请求，来源: ${source}，当前状态:`, {
    isEdgeHidden,
    edgeHiddenSide,
    hasSavedBounds: !!savedBounds,
    isExpandedFromEdge
  });

  if (!focusWindow || focusWindow.isDestroyed?.()) {
    console.log('[restoreFromEdge] 窗口不存在');
    return false;
  }

  clearEdgeExpandCollapseTimer();

  if (!isEdgeHidden || !savedBounds || !edgeHiddenSide) {
    console.log('[restoreFromEdge] 当前不在贴边隐藏状态，直接重置本地状态');
    resetEdgeHiddenState(`restore:no-op:${source}`);
    edgeRestoreSuspendedUntil = Date.now() + EDGE_RESTORE_COOLDOWN;
    return false;
  }

  try {
    const screenBounds = getFocusWindowScreenBounds(savedBounds);
    const nextBounds = getExpandedEdgeBounds(savedBounds, edgeHiddenSide, screenBounds);

    console.log('[restoreFromEdge] 恢复窗口位置:', nextBounds);
    focusWindow.setBounds(nextBounds);

    resetEdgeHiddenState(`restore:${source}`);
    edgeRestoreSuspendedUntil = Date.now() + EDGE_RESTORE_COOLDOWN;
    console.log(`[${source}] 已从贴边隐藏恢复窗口`);
    return true;
  } catch (e) {
    console.error('恢复窗口失败:', e);
    return false;
  }
}

function expandFromEdge(source = 'hover') {
  console.log(`[expandFromEdge] 请求展开，来源: ${source}`);

  if (!focusWindow || focusWindow.isDestroyed?.()) {
    console.log('[expandFromEdge] 窗口不存在');
    return false;
  }

  if (!isEdgeHidden || !savedBounds || !edgeHiddenSide) {
    console.log('[expandFromEdge] 窗口未贴边，无需展开');
    return false;
  }

  try {
    const screenBounds = getFocusWindowScreenBounds(savedBounds);
    const expandedBounds = getExpandedEdgeBounds(savedBounds, edgeHiddenSide, screenBounds);

    focusWindow.setBounds(expandedBounds);

    isExpandedFromEdge = true;
    notifyChildEdgeState(true, edgeHiddenSide, true);
    console.log('[expandFromEdge] 窗口已展开到:', expandedBounds);

    return true;
  } catch (e) {
    console.error('[expandFromEdge] 展开失败:', e);
    return false;
  }
}

function collapseToEdge(source = 'mouseleave') {
  console.log(`[collapseToEdge] 请求恢复贴边，来源: ${source}`);

  if (!focusWindow || focusWindow.isDestroyed?.()) {
    console.log('[collapseToEdge] 窗口不存在');
    return false;
  }

  if (!isEdgeHidden || !savedBounds || !edgeHiddenSide) {
    console.log('[collapseToEdge] 当前不在贴边状态');
    return false;
  }

  if (!isExpandedFromEdge) {
    console.log('[collapseToEdge] 窗口已处于贴边隐藏状态');
    return true;
  }

  try {
    const screenBounds = getFocusWindowScreenBounds(savedBounds);
    const collapseX = getHiddenEdgeX(edgeHiddenSide, savedBounds.width, screenBounds);


    focusWindow.setBounds({
      x: collapseX,
      y: savedBounds.y,
      width: savedBounds.width,
      height: savedBounds.height,
    });

    isExpandedFromEdge = false;
    notifyChildEdgeState(true, edgeHiddenSide, false);
    console.log('[collapseToEdge] 窗口已恢复贴边隐藏');
    return true;
  } catch (e) {
    console.error('[collapseToEdge] 恢复贴边失败:', e);
    return false;
  }
}

const setupEdgeStick = () => {
  if (!focusWindow) return;

  clearEdgeStickResources();

  const edgeStickEnabled = wordsStore.focusMode?.edgeStickEnabled ?? true;
  if (!edgeStickEnabled) {
    if (isEdgeHidden) {
      restoreFromEdge('setupEdgeStick:disabled');
    }
    return;
  }

  let lastBounds: any = null;

  edgeStickTimer = setInterval(() => {
    if (!focusWindow || focusWindow.isDestroyed?.()) {
      clearInterval(edgeStickTimer);
      return;
    }

    try {
      const bounds = focusWindow.getBounds?.();
      if (!bounds) return;

      if (Date.now() < edgeRestoreSuspendedUntil && !isEdgeHidden) {
        lastBounds = {...bounds};
        return;
      }

      const screenBounds = getFocusWindowScreenBounds(bounds);

      if (isEdgeHidden && savedBounds && edgeHiddenSide) {
        if (isExpandedFromEdge) {
          const expandedBounds = getExpandedEdgeBounds(savedBounds, edgeHiddenSide, screenBounds);
          const draggedOut = Math.abs(bounds.x - expandedBounds.x) > EDGE_DRAG_OUT_THRESHOLD
              || Math.abs(bounds.y - expandedBounds.y) > EDGE_DRAG_OUT_THRESHOLD;


          if (draggedOut) {
            finalizeExpandedFromEdge(bounds, 'expandedDragOut');
          }
          return;
        }

        const hiddenX = getHiddenEdgeX(edgeHiddenSide, savedBounds.width, screenBounds);

        const hiddenStillValid = Math.abs(bounds.x - hiddenX) <= EDGE_VISIBLE_SIZE;

        if (!hiddenStillValid) {
          console.log('[setupEdgeStick] 隐藏窗口位置发生变化，退出贴边状态');
          resetEdgeHiddenState('hiddenPositionChanged');
          edgeRestoreSuspendedUntil = Date.now() + EDGE_RESTORE_COOLDOWN;
        }
        return;
      }

      if (lastBounds) {
        const moved = Math.abs(lastBounds.x - bounds.x) > 1 || Math.abs(lastBounds.y - bounds.y) > 1;
        if (moved) {
          lastBounds = {...bounds};
          return;
        }
      }
      lastBounds = {...bounds};

      if (bounds.x <= screenBounds.left + EDGE_STICK_THRESHOLD) {
        console.log('[setupEdgeStick] 检测到左边缘贴边:', bounds.x, '屏幕左边界:', screenBounds.left, '屏幕信息:', screenBounds);

        isEdgeHidden = true;
        isExpandedFromEdge = false;
        edgeHiddenSide = 'left';
        savedBounds = {...bounds};
        focusWindow.setBounds({
          x: getHiddenEdgeX('left', bounds.width, screenBounds),
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
        });

        notifyChildEdgeState(true, 'left', false);
        console.log('[setupEdgeStick] 窗口已贴边隐藏到左侧');
        return;
      }

      if (bounds.x + bounds.width >= screenBounds.right - EDGE_STICK_THRESHOLD) {
        console.log('[setupEdgeStick] 检测到右边缘贴边:', bounds.x + bounds.width, '屏幕右边界:', screenBounds.right, '屏幕信息:', screenBounds);

        isEdgeHidden = true;
        isExpandedFromEdge = false;
        edgeHiddenSide = 'right';
        savedBounds = {...bounds};
        focusWindow.setBounds({
          x: getHiddenEdgeX('right', bounds.width, screenBounds),
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
        });

        notifyChildEdgeState(true, 'right', false);
        console.log('[setupEdgeStick] 窗口已贴边隐藏到右侧');
      }
    } catch (e) {
      console.error('[setupEdgeStick] 错误:', e);
    }
  }, 150);
};

function applyEdgeStickEnabled(enabled: boolean, source: string) {
  lastSyncedEdgeStickEnabled = enabled;
  console.log(`[${source}] 更新贴边隐藏状态:`, enabled);

  if (wordsStore.focusMode) {
    wordsStore.focusMode.edgeStickEnabled = enabled;
  }

  focusWindowState = {
    ...focusWindowState,
    edgeStickEnabled: enabled,
  };

  if (!enabled) {
    if (isEdgeHidden) {
      restoreFromEdge('applyEdgeStickEnabled:disable');
    }
    clearEdgeStickResources();
    resetEdgeHiddenState('applyEdgeStickEnabled:disable');
    edgeRestoreSuspendedUntil = 0;
    return;
  }

  if (!focusWindow || focusWindow.isDestroyed?.()) {
    return;
  }

  setTimeout(() => {
    if (!focusWindow || focusWindow.isDestroyed?.()) {
      return;
    }
    setupEdgeStick();
  }, 80);
}


const startFocusModeSync = (initialAlwaysOnTop: boolean, initialEdgeStickEnabled: boolean) => {
  clearFocusModeSync();
  lastSyncedAlwaysOnTop = initialAlwaysOnTop;
  lastSyncedEdgeStickEnabled = initialEdgeStickEnabled;

  focusModeSyncTimer = setInterval(() => {
    consumeLatestFocusModePendingAction('db');

    if (!focusWindow || focusWindow.isDestroyed?.()) {
      clearFocusModeSync();
      return;
    }

    try {
      const focusMode = getSetDb(true)?.focusMode;
      const latestAlwaysOnTop = typeof focusMode?.alwaysOnTop === 'boolean'
          ? focusMode.alwaysOnTop
          : initialAlwaysOnTop;
      const latestEdgeStickEnabled = typeof focusMode?.edgeStickEnabled === 'boolean'
          ? focusMode.edgeStickEnabled
          : initialEdgeStickEnabled;

      if (latestAlwaysOnTop !== lastSyncedAlwaysOnTop) {
        console.log('[focusModeSync] 检测到 DB 置顶状态变化:', lastSyncedAlwaysOnTop, '=>', latestAlwaysOnTop);
        handleSetAlwaysOnTop({
          currentIndex: focusWindowState.currentIndex,
          showExplains: focusWindowState.showExplains,
          opacity: focusWindowState.opacity,
          edgeStickEnabled: latestEdgeStickEnabled,
          alwaysOnTop: latestAlwaysOnTop,
        });
        return;
      }

      if (latestEdgeStickEnabled !== lastSyncedEdgeStickEnabled) {
        console.log('[focusModeSync] 检测到 DB 贴边隐藏状态变化:', lastSyncedEdgeStickEnabled, '=>', latestEdgeStickEnabled);
        applyEdgeStickEnabled(latestEdgeStickEnabled, 'focusModeSync');
      }

      // 检测锁定状态变化（来自 focus.html 的持久化动作）
      const latestLocked = typeof focusMode?.locked === 'boolean' ? focusMode.locked : false;
      if (latestLocked !== lastSyncedLocked) {
        console.log('[focusModeSync] 检测到 DB 锁定状态变化:', lastSyncedLocked, '=>', latestLocked);
        lastSyncedLocked = latestLocked;
        if (wordsStore.focusMode) {
          wordsStore.focusMode.locked = latestLocked;
        }
        if (focusWindow && !focusWindow.isDestroyed?.()) {
          try {
            if (latestLocked) {
              if (typeof focusWindow.focus === 'function') {
                focusWindow.focus();
              }
              startIgnoreMousePoll();
            } else {
              stopIgnoreMousePoll();
            }
          } catch (e) {
            console.error('[focusModeSync] 设置鼠标穿透失败:', e);
          }
        }
      }

      if (latestLocked && !ignoreMousePollTimer) {
        lastSyncedLocked = true;
        startIgnoreMousePoll();
      }

      // 锁定状态下周期性帮子窗口保持焦点，确保快捷键可用
      if (lastSyncedLocked && focusWindow && !focusWindow.isDestroyed?.()) {
        try {
          if (typeof focusWindow.isFocused === 'function' && !focusWindow.isFocused()) {
            focusWindow.focus();
          }
        } catch (e) {}
      }
    } catch (e) {
      console.error('[focusModeSync] 同步专注模式设置失败:', e);
    }

  }, 300);
};


// 处理打开单词列表请求
const handleOpenWordList = async () => {
  console.log('父窗口处理打开列表请求');
  clearFocusModePendingAction();

  // 刷新单词列表数据 - 从数据库重新加载
  try {
    console.log('刷新单词列表数据...');
    await wordsStore.listWords();
  } catch (e) {
    console.error('刷新单词列表失败:', e);
  }

  // 先关闭专注窗口
  if (focusWindow && !focusWindow.isDestroyed?.()) {
    try {
      focusWindow.close();
    } catch (e) {
      console.error('关闭专注窗口失败:', e);
    }
    focusWindow = null;
  }

  // 清理贴边相关
  clearFocusModeSync();
  clearEdgeStickResources();
  isEdgeHidden = false;
  savedBounds = null;
  edgeHiddenSide = null;
  edgeRestoreSuspendedUntil = 0;
  isExpandedFromEdge = false;

  listMode.value = 0;
  router.replace('/word').catch(() => {
  });
  if (window.location.hash !== '#/word') {
    window.location.hash = '#/word';
  }

  // 显示主窗口并刷新
  if (isUtools() && (window as any).utools?.showMainWindow) {
    (window as any).utools.showMainWindow();
  }

  setTimeout(async () => {
    listMode.value = 0;
    await wordsStore.listWords();
    if (isUtools() && (window as any).utools?.showMainWindow) {
      (window as any).utools.showMainWindow();
    }
  }, 120);
};


/**
 * 处理专注模式中的单词变更通知
 * 专注模式修改了单词状态（记住/忘记/等级变化/释义切换），主窗口同步更新
 */
const handleWordChanged = async (payload: any) => {
  if (!payload || !payload.word) {
    console.log('[handleWordChanged] payload 无效:', payload);
    return;
  }

  const changedWord: Word = payload.word;
  console.log('[handleWordChanged] 专注模式单词变更:', changedWord.text, 'level:', changedWord.level, 'isReview:', changedWord.isReview);

  // 通过 store 同步更新单词（自动更新词库 + 旧数据库）
  await wordsStore.addAndUpdateWord(changedWord);

  // 重新计算待复习状态
  wordsStore.upReview();

  console.log('[handleWordChanged] 单词状态已同步:', changedWord.text);
};


/**
 * 处理从专注模式跳转到听写练习的请求
 */
const handleOpenDictation = async () => {
  console.log('专注模式请求跳转到听写练习');
  clearFocusModePendingAction();

  // 刷新单词列表数据
  try {
    await wordsStore.listWords();
  } catch (e) {
    console.error('刷新单词列表失败:', e);
  }

  // 先关闭专注窗口
  if (focusWindow && !focusWindow.isDestroyed?.()) {
    try {
      focusWindow.close();
    } catch (e) {
      console.error('关闭专注窗口失败:', e);
    }
    focusWindow = null;
  }

  // 清理相关资源
  clearFocusModeSync();
  clearEdgeStickResources();
  isEdgeHidden = false;
  savedBounds = null;
  edgeHiddenSide = null;
  edgeRestoreSuspendedUntil = 0;
  isExpandedFromEdge = false;

  // 跳转到听写页面
  router.push('/dictation');

  // 显示主窗口
  if (isUtools() && (window as any).utools?.showMainWindow) {
    (window as any).utools.showMainWindow();
  }

  // 延迟再次刷新，确保数据加载完毕
  setTimeout(async () => {
    await wordsStore.listWords();
    if (isUtools() && (window as any).utools?.showMainWindow) {
      (window as any).utools.showMainWindow();
    }
  }, 120);
};

const processFocusModePendingAction = (action: any, source = 'unknown') => {
  if (!action || typeof action !== 'object') {
    return false;
  }

  const type = typeof action.type === 'string'
      ? action.type
      : (typeof action.channel === 'string' ? action.channel : '');
  const payload = action.payload ?? action.args?.[0] ?? action.params?.[0] ?? action.data;

  if (!type) {
    return false;
  }

  console.log('[focusModeAction] 处理动作:', type, '来源:', source, 'payload:', payload);

  if (source === 'db') {
    clearFocusModePendingAction();
  }

  if (type === 'openWordList') {
    handleOpenWordList();
    return true;
  }

  handleChildMessage({channel: type, payload});
  return true;
};

const handleFocusModeStorageAction = (rawValue: string | null) => {
  if (!rawValue) {
    return;
  }

  try {
    const action = JSON.parse(rawValue);
    if (!action || typeof action !== 'object') {
      return;
    }

    const actionAt = Number(action.at || 0);
    if (actionAt && actionAt <= lastHandledFocusModeActionAt) {
      return;
    }
    lastHandledFocusModeActionAt = actionAt || Date.now();

    processFocusModePendingAction(action, 'storage');
  } catch (e) {
    console.error('[focusModeStorage] 处理本地动作失败:', e);
  }
};


const handleFocusModeStorageEvent = (event: StorageEvent) => {
  if (event.key !== FOCUS_MODE_ACTION_STORAGE_KEY) {
    return;
  }
  handleFocusModeStorageAction(event.newValue);
};

const unlockFocusWindowFromParent = () => {
  lastSyncedLocked = false;
  updateFocusModeDoc((focusMode) => {
    focusMode.locked = false;
  });
  stopIgnoreMousePoll();

  if (focusWindow && !focusWindow.isDestroyed?.()) {
    try {
      focusWindow.webContents?.executeJavaScript?.(`
        if (typeof setLocked === 'function') {
          setLocked(false);
        }
      `);
      if (typeof focusWindow.focus === 'function') {
        focusWindow.focus();
      }
    } catch (e) {
      console.error('[focusLock] 父窗口解锁失败:', e);
    }
  }
};

const handleFocusModeUnlockShortcut = (event: KeyboardEvent) => {
  if (event.ctrlKey && (event.key === 'l' || event.key === 'L') && lastSyncedLocked) {
    event.preventDefault();
    unlockFocusWindowFromParent();
  }
};

window.addEventListener('storage', handleFocusModeStorageEvent);
window.addEventListener('keydown', handleFocusModeUnlockShortcut);
onUnmounted(() => {
  window.removeEventListener('storage', handleFocusModeStorageEvent);
  window.removeEventListener('keydown', handleFocusModeUnlockShortcut);
  clearFocusModeSync();
  clearEdgeStickResources();
  isEdgeHidden = false;
  savedBounds = null;
  edgeHiddenSide = null;
  edgeRestoreSuspendedUntil = 0;
  isExpandedFromEdge = false;
});


// 处理子窗口消息的通用函数
const handleChildMessage = (message: any) => {
  console.log('[handleChildMessage] 收到消息:', message);
  if (!message) {
    console.log('[handleChildMessage] 消息为空，忽略');
    return;
  }

  const channel = typeof message === 'string' ? message : message.channel;
  const payload = typeof message === 'string'
      ? undefined
      : (message.payload ?? message.args?.[0] ?? message.params?.[0] ?? message.data);

  console.log('[handleChildMessage] 消息通道:', channel, 'payload:', payload);

  if (channel === 'openWordList') {
    console.log('[handleChildMessage] 处理 openWordList');
    handleOpenWordList();
  } else if (channel === 'restoreFromEdge') {
    console.log('[handleChildMessage] 处理 restoreFromEdge, payload:', payload);
    restoreFromEdge(payload?.reason || 'childRequest');
  } else if (channel === 'expandFromEdge') {
    console.log('[handleChildMessage] 处理 expandFromEdge');
    clearTimeout(edgeExpandCollapseTimer);
    expandFromEdge(payload?.reason || 'hover');
  } else if (channel === 'collapseToEdge') {
    console.log('[handleChildMessage] 处理 collapseToEdge');
    clearTimeout(edgeExpandCollapseTimer);
    edgeExpandCollapseTimer = setTimeout(() => {
      collapseToEdge(payload?.reason || 'mouseleave');
    }, 100);
  } else if (channel === 'setAlwaysOnTop') {
    console.log('[handleChildMessage] 处理 setAlwaysOnTop，payload:', payload);
    handleSetAlwaysOnTop(payload);
  } else if (channel === 'setEdgeStickEnabled') {
    console.log('[handleChildMessage] 处理 setEdgeStickEnabled，payload:', payload);
    applyEdgeStickEnabled(payload?.edgeStickEnabled ?? true, 'handleChildMessage');
  } else if (channel === 'recreateWindow') {
    console.log('[handleChildMessage] 处理 recreateWindow，payload:', payload);
    handleRecreateWindow(payload);
  } else if (channel === 'wordChanged') {
    console.log('[handleChildMessage] 处理 wordChanged，payload:', payload);
    handleWordChanged(payload);
  } else if (channel === 'openDictation') {
    console.log('[handleChildMessage] 处理 openDictation');
    handleOpenDictation();
  } else if (channel === 'setLocked') {
    console.log('[handleChildMessage] 处理 setLocked，payload:', payload);
    const locked = payload?.locked === true;
    if (focusWindow && !focusWindow.isDestroyed?.()) {
      try {
        lastSyncedLocked = locked;
        if (locked) {
          setFocusWindowMouseIgnore(true);
          startIgnoreMousePoll();
        } else {
          stopIgnoreMousePoll();
        }
        return;
      } catch (e) {
        console.error('[handleChildMessage] 设置鼠标穿透失败:', e);
      }
    }
  } else if (channel === 'focusLockWindow') {
    console.log('[handleChildMessage] 处理 focusLockWindow');
    if (focusWindow && !focusWindow.isDestroyed?.()) {
      try {
        if (typeof focusWindow.focus === 'function') {
          focusWindow.focus();
        }
      } catch (e) {
        console.error('[handleChildMessage] 聚焦专注窗口失败:', e);
      }
    }
  } else {
    console.log('[handleChildMessage] 未知通道:', channel);
  }
};


let messageListenerReady = false;

// 全局设置 uTools 消息监听
// @ts-ignore
function setupMessageListener() {
  if (messageListenerReady) {
    return;
  }

  // @ts-ignore
  if (isUtools() && (window as any).utools?.onMessage) {
    // @ts-ignore
    (window as any).utools.onMessage((message: any) => {
      console.log('【全局】父窗口 utools.onMessage 收到:', message);
      handleChildMessage(message);
    });
    messageListenerReady = true;
    console.log('【全局】父窗口 utools.onMessage 监听已设置');
  } else {
    console.log('【全局】utools.onMessage 不可用');
  }
}


// 立即设置监听
setupMessageListener();

// 打开专注模式 - 创建独立子窗口
const openFocusMode = (mode = '') => {
  currentFocusMode = mode;
  // 如果没有待复习单词，提示用户
  if (wordsStore.forgetCount === 0) {
    ElMessage.info('暂无待复习单词');
    return;
  }

  // 如果窗口已存在，聚焦它
  if (focusWindow && !focusWindow.isDestroyed?.()) {
    focusWindow.focus?.();
    return;
  }

  // 获取当前主题
  const isDark = document.body.classList.contains('utools-dark') ||
      document.documentElement.classList.contains('utools-dark') ||
      document.documentElement.classList.contains('dark');
  console.log('创建专注窗口，当前主题:', isDark ? '暗黑' : '亮色');

  // 从 store 获取用户设置
  clearFocusModePendingAction();
  isEdgeHidden = false;
  savedBounds = null;
  edgeHiddenSide = null;
  edgeRestoreSuspendedUntil = 0;

  const initAlwaysOnTop = wordsStore.focusMode?.alwaysOnTop ?? true;
  const initEdgeStickEnabled = wordsStore.focusMode?.edgeStickEnabled ?? true;
  focusWindowState = {

    ...focusWindowState,
    edgeStickEnabled: initEdgeStickEnabled,
  };
  console.log('[openFocusMode] 初始置顶状态:', initAlwaysOnTop, '贴边隐藏:', initEdgeStickEnabled);


  // 创建独立窗口
  console.log('[openFocusMode] 开始创建窗口');
  try {
    // @ts-ignore
    if (isUtools() && (window as any).utools?.createBrowserWindow) {
      // 通过 URL 参数传递主题和设置
      const themeParam = isDark ? 'dark' : 'light';
      console.log('[openFocusMode] 调用 createBrowserWindow');
      // @ts-ignore
      const currentBankId = encodeURIComponent(wordsStore.currentWordBankId || '');
      // 传递当前筛选状态，使专注模式与单词列表筛选一致
      const filterPattern = encodeURIComponent(currentFilter.value.pattern || '');
      const filterMinLen = currentFilter.value.minLength > 0 ? currentFilter.value.minLength : '';
      const filterMaxLen = currentFilter.value.maxLength > 0 ? currentFilter.value.maxLength : '';
      const filterSortBy = encodeURIComponent(currentFilter.value.sortBy || '');
      const filterSortAsc = currentFilter.value.sortAsc ? '1' : '0';
      const modeParam = mode ? `&mode=${mode}` : '';
      focusWindow = (window as any).utools.createBrowserWindow(`focus.html?theme=${themeParam}&alwaysOnTop=${initAlwaysOnTop}&edgeStickEnabled=${initEdgeStickEnabled}&bankId=${currentBankId}&listMode=${listMode.value}&pattern=${filterPattern}&minLen=${filterMinLen}&maxLen=${filterMaxLen}&sortBy=${filterSortBy}&sortAsc=${filterSortAsc}&autoSpeak=${wordsStore.autoSpeak ? '1' : '0'}${modeParam}`, {

        width: 320,
        height: 100,
        minWidth: 200,
        minHeight: 80,
        maxWidth: 400,
        maxHeight: 150,
        alwaysOnTop: initAlwaysOnTop,
        frame: false,
        transparent: true,
        // 透明背景色，确保正确接收透明效果
        backgroundColor: '#00000000',
        resizable: true,
        modal: false,
        // 允许关闭窗口
        closable: true,
      }, () => {
        console.log('[openFocusMode] 窗口创建回调执行，focusWindow:', focusWindow, '主题:', themeParam);
        applyFocusWindowAlwaysOnTop(focusWindow, initAlwaysOnTop, 'openFocusMode');
        // 显示窗口
        if (focusWindow && typeof focusWindow.show === 'function') {
          focusWindow.show();
        }
      });


      // 窗口关闭时清理引用
      const createdFocusWindow = focusWindow;
      createdFocusWindow?.on?.('closed', () => {
        consumeLatestFocusModePendingAction('closed');

        if (focusWindow === createdFocusWindow) {
          focusWindow = null;
          clearFocusModeSync();
          clearEdgeStickResources();
          isEdgeHidden = false;
          savedBounds = null;
          edgeHiddenSide = null;
          edgeRestoreSuspendedUntil = 0;
          isExpandedFromEdge = false;
        }
      });

      startFocusModeSync(initAlwaysOnTop, initEdgeStickEnabled);

      // 设置贴边隐藏检测（延迟一点确保窗口稳定）
      setTimeout(() => {
        setupEdgeStick();
      }, 500);

      // 重新设置消息监听（确保能收到子窗口消息）
      setupMessageListener();

    } else {
      // 回退：使用路由方式
      router.push('/focus');
    }
  } catch (e) {
    console.log('创建专注模式窗口失败:', e);
    // 回退：使用路由方式
    router.push('/focus');
  }
}

// 截图翻译相关状态
const ocrDialogVisible = ref(false)
const ocrLoading = ref(false)
const ocrError = ref('')
const ocrOriginalText = ref('')
const ocrWords = ref<string[]>([])
const ocrSelectedWords = ref<string[]>([])
const selectAllWords = ref(false)
/*const handleView = (id) => {
  currentId.value = id
  drawerVisible.value = true
}*/

/**
 * 显示添加单词
 */
const showWords = computed(() => {
  // 如果 待复习单词为0  且 状态为0 为true
  log.i('列表状态', listMode.value == 0);
  return wordsStore.forgetCount <= 0 && listMode.value == 0
})


// 控制是否只显示已记住的单词 0 待复习(正在显示)  1 已复习(暂时不需要复习的) 2 已记住
const listMode = ref(0);


const showOnlyForget = () => {
  listMode.value = 0;
}

const showOnlyReview = () => {
  listMode.value = listMode.value != 1 ? 1 : 0;
}

// 切换只显示已记住的单词
const showOnlyRemembered = () => {
  listMode.value = listMode.value != 2 ? 2 : 0;
}
const showAll = () => {
  listMode.value = listMode.value != 3 ? 3 : 0;
}

// ========== 筛选排序功能 ==========
const filterPanelVisible = ref(false)
const wordFilterRef = ref<InstanceType<typeof WordFilter> | null>(null)
const currentFilter = shallowRef<FilterState>({
  minLength: 0,
  maxLength: 0,
  pattern: '',
  affixType: '',
  affixText: '',
  phonetic: '',
  itemType: 'all',
  sortBy: '',
  sortAsc: true
})

const toggleFilterPanel = () => {
  filterPanelVisible.value = !filterPanelVisible.value
}

const onFilterChange = (state: FilterState) => {
  currentFilter.value = { ...state }
}

const onFilterReset = () => {
  currentFilter.value = {
    minLength: 0,
    maxLength: 0,
    pattern: '',
    affixType: '',
    affixText: '',
    phonetic: '',
    itemType: 'all',
    sortBy: '',
    sortAsc: true
  }
}

/** 将通配符模式转为正则
 * 无通配符 tion → /tion/i (包含匹配)
 * 有通配符 a*b → /^a.*b$/i, *tion → /^.*tion$/i
 */
const patternToRegex = (pattern: string): RegExp | null => {
  if (!pattern.trim()) return null
  const trimmed = pattern.trim()
  try {
    if (trimmed.includes('*')) {
      const escaped = trimmed.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
      return new RegExp(`^${escaped}$`, 'i')
    }
    // 无通配符：包含匹配
    const escaped = trimmed.replace(/[.+^${}()|[\]\\]/g, '\\$&')
    return new RegExp(escaped, 'i')
  } catch {
    return null
  }
}

/** 检查单词是否包含指定词根/词缀
 * 逻辑：
 * - 仅选类型无文本：筛选含该类型成分的单词（前缀→有前缀的词，后缀→有后缀的词，词根→有词根的词）
 * - 仅输入文本无类型：在整个词的所有成分中搜索匹配
 * - 类型+文本：在对应类型的成分中搜索匹配
 * - 都无：不过滤
 */
const matchesAffix = (wordText: string, affixType: string, affixText: string): boolean => {
  const hasType = !!affixType
  const hasText = !!affixText.trim()
  if (!hasType && !hasText) return true
  const lower = affixText.toLowerCase().trim()
  const components = analyzeWord(wordText)

  if (hasType && !hasText) {
    // 仅选类型：筛选包含该类型成分的单词
    return components.some(c => c.type === affixType)
  }

  if (!hasType && hasText) {
    // 仅输入文本：在整个词的所有成分中搜索
    return components.some(c => c.text.toLowerCase().includes(lower))
  }

  // 类型+文本：在对应类型的成分中搜索
  return components.some(c => c.type === affixType && c.text.toLowerCase().includes(lower))
}

// 计算过滤后的单词列表
const showFilteredWords = computed(() => {
  let list: Word[]
  if (listMode.value == 2) {
    list = wordsStore.words.filter(item => item.remember)
  } else if (listMode.value == 1) {
    list = wordsStore.words.filter(item => !item.isReview)
  } else if (listMode.value == 3) {
    list = [...wordsStore.words]
  } else {
    list = wordsStore.words.filter(item => item.isReview)
  }

  const f = currentFilter.value

  // 筛选：类型（单词/词组）
  if (f.itemType !== 'all') {
    list = list.filter(item => {
      if (f.itemType === 'phrase') return isPhrase(item)
      return !isPhrase(item)
    })
  }

  // 筛选：单词长度（词组按单词数计算）
  if (f.minLength > 0 || f.maxLength > 0) {
    list = list.filter(item => {
      const len = isPhrase(item) ? getWordCount(item.text) : item.text.length
      if (f.minLength > 0 && len < f.minLength) return false
      if (f.maxLength > 0 && len > f.maxLength) return false
      return true
    })
  }

  // 筛选：字母组合通配符（词组保留空格）
  const patternRegex = patternToRegex(f.pattern)
  if (patternRegex) {
    list = list.filter(item => {
      const searchText = isPhrase(item) ? item.text : item.text.replace(/\s+/g, '')
      return patternRegex.test(searchText)
    })
  }

  // 筛选：词根词缀（跳过词组）
  if (f.affixType || f.affixText.trim()) {
    list = list.filter(item => isPhrase(item) ? false : matchesAffix(item.text, f.affixType, f.affixText))
  }

  // 筛选：音标
  if (f.phonetic.trim()) {
    const ph = f.phonetic.trim().toLowerCase()
    list = list.filter(item => item.phonetic && item.phonetic.toLowerCase().includes(ph))
  }

  // 排序
  if (f.sortBy) {
    const dir = f.sortAsc ? 1 : -1
    list = [...list].sort((a, b) => {
      switch (f.sortBy) {
        case 'alpha':
          return dir * a.text.localeCompare(b.text, 'en')
        case 'length':
          const lenA = isPhrase(a) ? getWordCount(a.text) : a.text.length
          const lenB = isPhrase(b) ? getWordCount(b.text) : b.text.length
          return dir * (lenA - lenB)
        case 'time':
          return dir * (new Date(a.ctime).getTime() - new Date(b.ctime).getTime())
        case 'level':
          return dir * (a.level - b.level)
        default:
          return 0
      }
    })
  }

  return list
})

// 获取在原始列表中的索引
const getIndexInOriginalList = (item: Word) => {
  const index = wordsStore.words.findIndex(word => word._id === item._id);
  if (index === -1) {
    console.error('找不到单词索引:', item._id, item.text);
  }
  return index;
}

/*
  单词滚动模块
 */
const scrollContainer = ref<HTMLElement | null>(null)
const scrollerRef = ref<any>(null)
const itemRefs = ref<HTMLElement[]>([])

// 监听过滤列表变化，强制 RecycleScroller 刷新布局
// 解决 dynamic-size 模式下项目减少时出现空白占位的问题
watch(() => showFilteredWords.value.length, () => {
  nextTick(() => {
    scrollerRef.value?.updateVisibleItems?.()
  })
})

// 设置单项引用
const setItemRef = (el: any, index: number) => {

  // el 是组件实例，我们需要获取它的 $el 属性
  if (el && el.$el) {
    itemRefs.value[index] = el.$el;
  }
  /* if (el) {
     itemRefs.value[index] = el
   }*/
}

// 滚动到指定索引的单词
const scrollToWord = (index: number) => {
  // 检查索引是否有效，如果单词列表为空或索引无效，则不执行滚动
  if (index < 0 || !showFilteredWords.value || showFilteredWords.value.length === 0) {
    console.log("索引无效或单词列表为空，不执行滚动:", index);
    return;
  }

  nextTick(() => {
    // 优先使用 RecycleScroller 的原生 scrollToItem 方法，更准确且与虚拟滚动内部状态同步
    if (scrollerRef.value?.scrollToItem) {
      scrollerRef.value.scrollToItem(index);
      setTimeout(() => {
        wordsStore.setLastAddedWordText('');
      }, 100);
      return;
    }

    // 回退到手动计算滚动位置
    const scroller = document.querySelector('.scroller');
    if (scroller) {
      // 计算目标项的位置（考虑网格布局）
      const itemsPerRow = 2; // 从模板中的 :grid-items="2" 得知
      const rowIndex = Math.floor(index / itemsPerRow);
      const itemHeight = 185; // 与模板中的 :item-size="185" 保持一致

      // 滚动到目标行的位置，留出一些顶部空间便于查看
      scroller.scrollTop = Math.max(0, rowIndex * itemHeight - 50);

      // 延迟清空状态，确保滚动执行完成
      setTimeout(() => {
        wordsStore.setLastAddedWordText('');
      }, 100);
    } else if (itemRefs.value[index] && scrollContainer.value) {
      // 回退到原来的方法
      const container = scrollContainer.value;
      const targetElement = itemRefs.value[index];

      // 计算相对位置
      const containerRect = container.getBoundingClientRect();
      const targetRect = targetElement.getBoundingClientRect();

      // 滚动到目标元素位置
      container.scrollTop = container.scrollTop + targetRect.top - containerRect.top - 100;

      // 延迟清空状态，确保滚动执行完成
      setTimeout(() => {
        wordsStore.setLastAddedWordText('');
      }, 100);
    }
  });
};


// 滚动到顶部
const scrollToTop = () => {
  const scroller = document.querySelector('.scroller');
  if (scroller) {
    scroller.scrollTop = 0;
  } else if (scrollContainer.value) {
    scrollContainer.value.scrollTop = 0;
  } else {
    window.scrollTo({top: 0, behavior: 'smooth'});
  }
  /*  if (scrollContainer.value) {
      scrollContainer.value.scrollTop = 0
    } else {
      window.scrollTo({top: 0, behavior: 'smooth'})
    }*/
}

// 滚动到底部
const scrollToBottom = () => {
  const scroller = document.querySelector('.scroller');
  if (scroller) {
    scroller.scrollTop = scroller.scrollHeight;
  } else if (scrollContainer.value) {
    scrollContainer.value.scrollTop = scrollContainer.value.scrollHeight;
  } else {
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: 'smooth'
    });
  }

  /*if (scrollContainer.value) {
    scrollContainer.value.scrollTop = scrollContainer.value.scrollHeight
  } else {
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: 'smooth'
    })
  }*/
}

/**
 * 滚动到指定单词处
 */
const scrollToWordByText = (wordText: string) => {
  console.log("---------", wordText, wordsStore.lastAddedWordText)
  // const index = wordsStore.words.findIndex(word => word.text === wordText)
  let index = showFilteredWords.value.findIndex(word => word.text === wordText)
  if (index !== -1) {
    scrollToWord(index)
  } else {
    // 在当前过滤视图中未找到，检查是否存在于完整列表中
    const fullIndex = wordsStore.words.findIndex(word => word.text === wordText)
    if (fullIndex !== -1) {
      // 单词存在但被当前 listMode 过滤了，切换到"全部"模式使其可见
      console.log('单词存在但被过滤，切换到全部模式:', wordText, '当前模式:', listMode.value)
      listMode.value = 3
      // 等待视图更新后再滚动（RecycleScroller 需要更长时间完成渲染）
      nextTick(() => {
        setTimeout(() => {
          const newIndex = showFilteredWords.value.findIndex(word => word.text === wordText)
          if (newIndex !== -1) {
            scrollToWord(newIndex)
          }
        }, 200)
      })
    } else {
      // 完全未找到，延迟重试（等待异步数据更新）
      setTimeout(() => {
        const retryIndex = showFilteredWords.value.findIndex(word => word.text === wordText)
        if (retryIndex !== -1) {
          scrollToWord(retryIndex)
        }
      }, 500)
      log.i('未找到此单词，无法定位')
    }
  }
}


// 监听列表模式和单词数据变化，自动聚焦到第一个元素
watch([() => listMode.value, () => showFilteredWords.value], async () => {
  // 检查快捷键是否启用，只有启用时才聚焦到第一个元素
  if (!wordsStore.shortcutEnabled) {
    return
  }
  console.log('自动聚焦到元素');
  await nextTick(); // 等待DOM更新
  // 等待虚拟滚动器渲染完成
  setTimeout(() => {
    if (showFilteredWords.value.length > 0) {
      console.log('聚焦单词', wordsStore.lastFocusWordText, '操作前索引:', wordsStore.lastFocusWordIndex)
      if (wordsStore.lastFocusWordText.length > 0) {
        // 先尝试聚焦到当前单词（如果还在列表中）
        const element = document.querySelector('[data-word="' + wordsStore.lastFocusWordText + '"]');
        if (element) {
          // 单词还在列表中（忘记操作），聚焦到它
          focusElement('[data-word="' + wordsStore.lastFocusWordText + '"]');
        } else {
          // 单词已从列表中移除（如被记住），聚焦到相同索引位置的单词（后面的单词前移了）
          const targetIndex = Math.min(wordsStore.lastFocusWordIndex, showFilteredWords.value.length - 1);
          const targetWord = showFilteredWords.value[targetIndex];
          if (targetWord) {
            console.log('单词已移除，聚焦到索引', targetIndex, '单词:', targetWord.text);
            focusElement('[data-word="' + targetWord.text + '"]');
          }
        }
        // 清空保存的索引
        wordsStore.lastFocusWordIndex = -1;
      } else {
        focusElement('.list-item');
      }
    }
  }, 500);
}, {immediate: true});


// 监听抽屉可见性变化，当抽屉关闭且快捷键启用时聚焦到第一个卡片
watch(drawerVisible, (newValue, oldValue) => {
  // 只有当抽屉从开启变为关闭，且快捷键是启用的，才聚焦
  if (!newValue && oldValue && wordsStore.shortcutEnabled) {
    // 使用nextTick确保DOM更新完成
    focusElement('.list-item');
  }
});


// 聚焦到指定元素
// focusElement('.list-item') - 聚焦到第一个列表项（等同于原来的focusFirstItem）
// focusElement('.list-item:nth-child(5)') - 聚焦到第五个列表项
// focusElement('#specific-id') - 聚焦到具有特定ID的元素
// focusElement('[data-word="hello"]') - 聚焦到具有特定数据属性的元素
const focusElement = async (selector: string) => {
  // 检查快捷键是否启用，只有启用时才聚焦
  console.log('快捷键状态', wordsStore.shortcutEnabled)
  if (!wordsStore.shortcutEnabled) {
    return; // 如果快捷键被禁用，则不执行聚焦
  }
  await nextTick(); // 确保DOM已更新

  // 延迟一段时间以确保虚拟滚动器已渲染元素
  setTimeout(() => {
    let element = document.querySelector(selector);
    // 如果通过data-word选择器找不到元素（单词已从列表中移除），尝试聚焦到第一个列表项
    if (!element && selector.startsWith('[data-word=')) {
      console.log(`指定单词已不在列表中，尝试聚焦到第一个元素`);
      element = document.querySelector('.list-item');
    }
    if (element) {
      console.log(`已聚焦到指定元素: ${selector}`);
      (element as HTMLElement).focus();
      wordsStore.lastFocusWordText = ''
    }
  }, 500);
};

/**
 * 处理导入命令
 */
const handleImportCommand = (command: string) => {
  switch (command) {
    case 'importJson':
      importWords();
      break;
    case 'importText':
      importTextWords();
      break;
    case 'importFromWordBank':
      // 打开词库选择对话框
      wordBankSelectVisible.value = true;
      break;
  }
};

// 词库选择对话框
const wordBankSelectVisible = ref(false);
const selectedImportBank = ref<WordBankType | ''>('');

/**
 * 确认从选中词库导入
 */
const confirmImportFromBank = () => {
  if (!selectedImportBank.value) {
    ElMessage.warning('请选择一个词库');
    return;
  }
  wordBankSelectVisible.value = false;
  importFromWordBank(selectedImportBank.value);
  selectedImportBank.value = '';
};

/**
 * 处理导出命令
 */
const handleExportCommand = (command: string) => {
  switch (command) {
    case 'exportJson':
      exportWords();
      break;
    case 'exportText':
      exportTextWords();
      break;
  }
};


/**
 * 清空单词库
 * @since 2025/11/5
 */
const clearWord = () => {
  wordsStore.removeWords()
  ElMessage.success('清除成功');
}
/**
 * 初始化单词库
 * @since 2025/11/5
 */
const initWord = () => {
  clearWord()
  wordsStore.addAndUpdateWords(testData)
  ElMessage.success('初始化成功');
}

/**
 * 删除单词
 */
const deleteWord = (index: number) => {
  if (index < 0) {
    console.error('删除单词失败：无效的索引', index);
    return;
  }
  wordsStore.deleteWord(index)
}

/**
 * 导出单词到json文件
 */
const exportWords = () => {
  if (wordsStore.count === 0) {
    ElMessage.warning('没有单词可导出');
    return;
  }
  // wordsStore.words
  // 过滤为指定属性
  const filteredWords = filterWordsForJsonExport(showFilteredWords.value);


  // 将单词列表转换为JSON字符串
  const content = JSON.stringify(filteredWords, null, 2); // 格式化JSON

  // 创建Blob对象
  const blob = new Blob([content], {type: 'application/json;charset=utf-8'});


  // 创建下载链接
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  // link.download = 'words_export.txt'; // 文件名
  link.download = 'words_export.json'; // 文件名
  link.style.display = 'none';

  // 触发下载
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  ElMessage.success('导出成功');
}


/**
 * 批量导入单词（JSON格式，校验格式并补全属性）
 */
const importWords = () => {
  // 创建文件输入元素
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.json'; // 限制文件类型为JSON
  fileInput.onchange = (event) => {
    if (isUtools()) (window as any).utools?.showMainWindow?.();
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        try {
          // 解析JSON文件内容
          const importedWords: any[] = JSON.parse(content);

          // 校验数据格式并补全属性
          const validatedWords = validateImportedWords(importedWords);


          // 去重：基于word.text属性
          const uniqueWords = validatedWords.filter((importedWord) => {
            return !wordsStore.words.some((existingWord) => existingWord.text === importedWord.text);
          });

          if (uniqueWords.length > 0) {
            // 检查是否有需要翻译的单词（没有释义的）
            const wordsNeedingTranslation = uniqueWords.filter(word => !word.explains);
            const wordsWithExplains = uniqueWords.filter(word => !!word.explains);

            if (wordsNeedingTranslation.length > 0) {
              ElMessage.info(`检测到${wordsNeedingTranslation.length}个单词需要翻译，正在翻译中...`);

              // 先添加已有释义的单词
              if (wordsWithExplains.length > 0) {
                wordsStore.addAndUpdateWords(wordsWithExplains).then(() => {
                  scrollToBottom();
                });
              }

              // 使用公共的批量翻译和添加方法
              const wordsToTranslate = wordsNeedingTranslation.map(word => word.text);
              batchTranslateAndAddWords(wordsToTranslate, (processedCount, totalCount) => {
                if (totalCount > 0) {
                  ElMessage.info(`正在翻译: ${processedCount}/${totalCount}`);
                }
              });
            } else {
              // 所有单词都有释义，直接导入
              wordsStore.addAndUpdateWords(uniqueWords).then(() => {
                scrollToBottom()
                ElMessage.success(`成功导入${uniqueWords.length}个单词`);
              });
            }
          } else {
            ElMessage.warning('没有新单词需要导入');
          }
        } catch (error) {
          console.error(error);
          ElMessage.error('导入失败，请检查文件格式');
        }
      };
      reader.readAsText(file); // 读取文件内容
    }
  };
  fileInput.click(); // 触发文件选择
};


/**
 * 通过txt批量导入单词
 */
const importTextWords = () => {
// 创建文件输入元素
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.txt,.csv'; // 限制文件类型
  fileInput.onchange = async (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        ;(window as any).utools?.showMainWindow?.();
        try {
          const content = e.target?.result as string;
          const wordList = parseFileContent(content); // 解析文件内容

          if (wordList.length > 0) {
            // 校验导入的单词数据
            const validatedWords = wordList.filter(word => {
              // 校验必填字段
              return typeof word.text === 'string' && word.text.trim() !== '';
            });

            if (validatedWords.length === 0) {
              ElMessage.warning('文件中没有有效的单词');
              return;
            }

            // 去重：基于word.text属性
            const uniqueWords = validatedWords.filter((importedWord) => {
              return !wordsStore.words.some((existingWord) => existingWord.text === importedWord.text);
            });

            if (uniqueWords.length === 0) {
              ElMessage.warning('没有新单词需要导入');
              return;
            }

            // 检查是否有需要翻译的单词（没有释义或发音的）
            const wordsNeedingTranslation = uniqueWords.filter(word => !word.explains || !word.pronunciation);
            const wordsWithExplains = uniqueWords.filter(word => !!word.explains && !!word.pronunciation);

            if (wordsNeedingTranslation.length > 0) {
              ElMessage.info(`检测到${wordsNeedingTranslation.length}个单词需要翻译，正在翻译中...`);

              // 先添加已有释义的单词
              if (wordsWithExplains.length > 0) {
                wordsStore.addAndUpdateWords(wordsWithExplains).then(() => {
                  scrollToBottom();
                });
              }

              // 使用公共的批量翻译和添加方法
              const wordsToTranslate = wordsNeedingTranslation.map(word => word.text);
              batchTranslateAndAddWords(wordsToTranslate, (processedCount, totalCount) => {
                if (totalCount > 0) {
                  ElMessage.info(`正在翻译: ${processedCount}/${totalCount}`);
                }
              });
            } else {
              // 所有单词都有释义和发音，直接导入
              wordsStore.addAndUpdateWords(uniqueWords).then(() => {
                scrollToBottom();
                ElMessage.success(`成功导入${uniqueWords.length}个单词`);
              });
            }
          } else {
            ElMessage.warning('文件内容为空或格式不正确');
          }
        } catch (error) {
          console.error(error);
          ElMessage.error('导入失败，请检查文件格式');
        }
      };
      reader.readAsText(file); // 读取文件内容
    }
  };
  fileInput.click(); // 触发文件选择
}


/**
 * 从内置词库导入单词
 * @param bankType 词库类型
 */
const importFromWordBank = async (bankType: WordBankType) => {
  const info = WORDBANK_LIST.find(wb => wb.id === bankType);
  const bankName = info?.name || bankType;

  const loading = ElLoading.service({
    lock: true,
    text: `正在加载${bankName}...`,
    background: 'rgba(0, 0, 0, 0.7)',
  });

  try {
    const words = await fetchWordBank(bankType, {priority: 'local', useCache: true});
    loading.close();

    if (words.length === 0) {
      ElMessage.warning('词库加载失败，请检查词库文件是否存在');
      return;
    }

    // 去重：基于word.text属性
    const uniqueWords = words.filter((importedWord) => {
      return !wordsStore.words.some((existingWord) => existingWord.text === importedWord.text);
    });

    if (uniqueWords.length === 0) {
      ElMessage.warning('没有新单词需要导入');
      return;
    }

    // 检查是否有需要翻译的单词（没有释义的）
    const wordsNeedingTranslation = uniqueWords.filter(word => !word.explains);
    const wordsWithExplains = uniqueWords.filter(word => !!word.explains);

    if (wordsNeedingTranslation.length > 0) {
      ElMessage.info(`检测到${wordsNeedingTranslation.length}个单词需要翻译，正在翻译中...`);

      // 先添加已有释义的单词
      if (wordsWithExplains.length > 0) {
        wordsStore.addAndUpdateWords(wordsWithExplains).then(() => {
          scrollToBottom();
        });
      }

      // 使用公共的批量翻译和添加方法
      const wordsToTranslate = wordsNeedingTranslation.map(word => word.text);
      batchTranslateAndAddWords(wordsToTranslate, (processedCount, totalCount) => {
        if (totalCount > 0) {
          ElMessage.info(`正在翻译: ${processedCount}/${totalCount}`);
        }
      });
    } else {
      // 所有单词都有释义，直接导入
      wordsStore.addAndUpdateWords(uniqueWords).then(() => {
        scrollToBottom();
        ElMessage.success(`成功从${bankName}导入${uniqueWords.length}个单词`);
      });
    }
  } catch (error) {
    loading.close();
    console.error('从词库导入失败:', error);
    ElMessage.error('词库导入失败');
  }
};


/**
 * 导出单词到txt文件
 */
const exportTextWords = () => {
  if (wordsStore.count === 0) {
    ElMessage.warning('没有单词可导出');
    return;
  }


  // 过滤为指定属性
  // 将单词列表转换为字符串 (单词,释义 格式)
  // , ${word.pronunciation} 发音地址,先不对外导出了,key泄露了
  const content = filterWordsForTextExport(showFilteredWords.value);


  // 创建Blob对象
  const blob = new Blob([content], {type: 'text/plain;charset=utf-8'});

  // 创建下载链接
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'words_export.txt'; // 文件名
  link.style.display = 'none';

  // 触发下载
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  ElMessage.success('导出成功');
}


// 是否直接显示或隐藏全部释义（-1 原状态/单卡控制，1显示全部，0 隐藏全部）
const showExplained = ref(-1)
// 单独控制当前的卡片释义
// const hiddenExplain = ref('')
/**
 * 显示全部解释
 */
const visibleExplained = () => {
  showExplained.value = showExplained.value != 1 ? 1 : -1
  // wordsStore.words.forEach(x => x.explainedHidden = false)
  // wordsStore.hiddenExplain=''
  // hiddenExplain.value=''
}
/**
 * 隐藏全部解释
 */
const invisibleExplained = () => {
  // wordsStore.hiddenExplain = ''
  showExplained.value = showExplained.value != 0 ? 0 : -1
  // wordsStore.hiddenExplain=''
  // hiddenExplain.value=''
  // wordsStore.words.forEach(x => x.explainedHidden = true)
}

/**
 * 截图翻译 - 快速识别图片中的文字并添加
 */
const startScreenCapture = async () => {
  console.log('[截图添加] 开始截图识别流程');
  try {
    // 先隐藏弹窗（如果之前打开过），确保截图时界面干净
    ocrDialogVisible.value = false

    // 隐藏主窗口，确保截图时不会截到插件界面
    if (isUtools()) (window as any).utools?.hideMainWindow?.();

    // 调用截图翻译
    const result = await ocrTranslateMultiPlatform();

    if (isUtools()) (window as any).utools?.showMainWindow?.();
    // 截图完成后，显示弹窗并更新状态
    // 重置状态
    ocrLoading.value = false
    ocrError.value = ''
    ocrOriginalText.value = ''
    ocrWords.value = []
    ocrSelectedWords.value = []
    selectAllWords.value = false

    console.log('[截图添加] OCR识别结果:', result);

    if (result.errorCode !== '0') {
      // 显示具体的错误信息（如果有）
      if (result.errorMessage) {
        ocrError.value = result.errorMessage;
      } else {
        ocrError.value = '识别失败，请检查OCR配置或重试';
      }
      ocrDialogVisible.value = true
      return;
    }

    if (!result.resRegions || result.resRegions.length === 0) {
      ocrError.value = '未能识别到文字，请重试'
      ocrDialogVisible.value = true
      return;
    }

    // 提取所有识别到的文本
    const allTexts: string[] = [];
    const allWords: string[] = [];

    result.resRegions.forEach((region: any) => {
      const text = region.context || '';
      if (text.trim()) {
        allTexts.push(text.trim());
      }
      // 使用正则提取英文单词（支持带连字符的单词和数字）
      const words = text.match(/[a-zA-Z]+(?:[-'][a-zA-Z]+)*|[a-zA-Z0-9]+/g) || [];
      words.forEach((word: string) => {
        // 过滤合理长度的单词，且必须包含至少一个字母
        if (word.length >= 2 && word.length <= 25 && /[a-zA-Z]/.test(word)) {
          allWords.push(word.toLowerCase());
        }
      });
    });

    // 去重并保持顺序
    const uniqueWords = [...new Set(allWords)];

    ocrOriginalText.value = allTexts.join('\n');
    ocrWords.value = uniqueWords;

    // 默认全选
    if (uniqueWords.length > 0) {
      ocrSelectedWords.value = [...uniqueWords];
      selectAllWords.value = true;
    }

    // 显示弹窗
    ocrDialogVisible.value = true

  } catch (error: any) {
    console.error('截图翻译失败:', error);
    ocrLoading.value = false;
    if (error.message && error.message.includes('每日免费')) {
      ocrError.value = error.message;
    } else {
      ocrError.value = '截图翻译失败: ' + (error.message || '未知错误');
    }
    ocrDialogVisible.value = true
  }
}

/**
 * 处理全选/取消全选
 */
const handleSelectAll = (val: boolean) => {
  if (val) {
    ocrSelectedWords.value = [...ocrWords.value];
  } else {
    ocrSelectedWords.value = [];
  }
}

/**
 * 确认添加选中的单词
 */
const confirmAddOcrWords = async () => {
  if (ocrSelectedWords.value.length === 0) {
    ElMessage.warning('请至少选择一个单词');
    return;
  }

  ocrDialogVisible.value = false;

  // 批量添加单词
  let addedCount = 0;
  let existCount = 0;
  let failCount = 0;

  for (const word of ocrSelectedWords.value) {
    const result = await addWord(word);
    if (result.success) {
      addedCount++;
    } else if (result.message && result.message.includes('已存在')) {
      existCount++;
    } else {
      failCount++;
    }
  }

  // 显示添加结果
  if (addedCount > 0) {
    ElMessage.success(`成功添加 ${addedCount} 个单词`);
  }
  if (existCount > 0) {
    ElMessage.info(`${existCount} 个单词已存在`);
  }
  if (failCount > 0) {
    ElMessage.warning(`${failCount} 个单词添加失败`);
  }
}

// ========== 听写练习功能 ==========

/**
 * 跳转到听写练习页面（携带筛选参数同步）
 */
function goToDictation() {
  const filterPattern = encodeURIComponent(currentFilter.value.pattern || '');
  const filterMinLen = currentFilter.value.minLength > 0 ? currentFilter.value.minLength : '';
  const filterMaxLen = currentFilter.value.maxLength > 0 ? currentFilter.value.maxLength : '';
  const filterSortBy = encodeURIComponent(currentFilter.value.sortBy || '');
  const filterSortAsc = currentFilter.value.sortAsc ? '1' : '0';
  router.push(`/dictation?listMode=${listMode.value}&pattern=${filterPattern}&minLen=${filterMinLen}&maxLen=${filterMaxLen}&sortBy=${filterSortBy}&sortAsc=${filterSortAsc}`);
}

function goToLetterMemory() {
  router.push('/letter-memory')
}


// 当新数据更新时 自动滚动到单词处  放到最后
// 监听 Store 中的 lastAddedWordText 状态
watch(() => wordsStore.lastAddedWordText, (wordText) => {
  if (wordText) {
    log.i("数据更新，滚动到此单词处:", wordText);
    nextTick(() => {  // 等待 DOM 更新
      // 添加延时确保虚拟滚动器已渲染完成（dynamic-size 模式下需要更长时间）
      setTimeout(() => {
        scrollToWordByText(wordText)  // 调用组件内的滚动方法
        // 清空状态，避免重复触发
        // 延迟清空状态，确保滚动执行完成
        setTimeout(() => {
          wordsStore.setLastAddedWordText('')
        }, 100)
      }, 150) // 添加150ms延时，确保 RecycleScroller 完成内部布局计算
    })
  }
  log.i("清空滚动更新单词", wordText);
}, {immediate: true})
</script>

<style lang="scss">
// 词库导入下拉菜单高度限制 - 全局样式
.wordbank-import-dropdown {
  max-height: 200px !important;

  .el-select-dropdown__wrap {
    max-height: 200px !important;
  }

  .el-select-dropdown__list {
    max-height: 200px !important;
  }
}
</style>

<style scoped lang="scss">

.input-above-button {
  position: absolute;
  top: 0;
  right: 84%;
  width: 200px;
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
  border-radius: 0;
  height: 55px;
  border-top: 1px solid var(--utools-border-divider);
  padding: 0 12px;
  box-sizing: border-box;
  color: var(--utools-text-primary);

  /* 左侧区域 */
  > div:first-child {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  /* 右侧图标区域 */
  > div:last-child {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .iconfont {
    font-size: 20px;
    padding: 6px;
    border-radius: 6px;
    transition: all 0.2s;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    vertical-align: middle;

    &:hover {
      background-color: var(--utools-bg-hover);
      transform: scale(1.1);
    }
  }

  .filter-active {
    color: var(--utools-primary);
    background-color: var(--utools-bg-hover);
    border-radius: 6px;
  }

  .remembered-highlight {
    color: var(--utools-danger);
    cursor: pointer;
  }

  .focus-mode-active {
    color: var(--utools-primary);
    font-weight: bold;
  }

  .disabled {
    opacity: 0.5;
    pointer-events: none;

    i {
      color: var(--utools-text-disabled);
    }
  }
}

// 截图翻译对话框样式
.ocr-loading,
.ocr-error,
.ocr-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 40px 20px;
  color: var(--utools-text-secondary);
  font-size: 14px;

  .el-icon {
    font-size: 20px;
  }
}

.ocr-error {
  color: var(--utools-danger);
}

.ocr-empty {
  color: var(--utools-text-tertiary);
}

.ocr-content {
  max-height: 400px;
  overflow-y: auto;
}

.ocr-section {
  margin-bottom: 16px;

  .section-title {
    font-weight: bold;
    margin-bottom: 8px;
    color: var(--utools-text-primary);
    display: flex;
    align-items: center;
    justify-content: space-between;

    .el-checkbox {
      font-weight: normal;
    }
  }

  .ocr-text {
    background-color: var(--utools-bg-tertiary);
    padding: 12px;
    border-radius: 4px;
    font-size: 14px;
    line-height: 1.6;
    color: var(--utools-text-secondary);
    max-height: 120px;
    overflow-y: auto;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .word-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;

    .el-checkbox-group {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .el-checkbox {
      margin: 0;
    }
  }
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.words-cards-wrapper {
  width: 100%;
  height: calc(100vh - 70px);
  padding: 4px;
  background-color: var(--utools-bg-secondary);
  border-radius: 0;
  overflow: hidden;

  .scroller {
    width: 100% !important;
    height: 100% !important;
    grid-template-columns: repeat(2, 1fr);
    padding: 0;
    margin: 0;
  }

  .vue-recycle-scroller__item-wrapper {
    display: flex;
    justify-content: center;
  }
}

/* 隐藏滚动条 */
.scroller::-webkit-scrollbar {
  width: 0;
  height: 0;
}

.scroller {
  scrollbar-width: none;
  -ms-overflow-style: none;
}

// 词库选择对话框样式
.wordbank-select-content {
  padding: 10px 0;

  .wordbank-radio-group {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;

    .wordbank-radio {
      margin: 0;
      padding: 12px 16px;
      border-radius: 8px;

      :deep(.el-radio__label) {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
      }

      .cached-tag {
        font-size: 12px;
        color: var(--utools-success);
        background: var(--utools-success-light);
        padding: 2px 6px;
        border-radius: 4px;
      }
    }
  }
}

// 缓存状态小圆点
.cached-dot-inline {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--utools-success);
  margin-left: 4px;
}

// 当前词库名称样式
.current-bank-name {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  color: var(--utools-primary);
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 4px;
  transition: all 0.2s;

  &:hover {
    background: var(--utools-primary-light);
  }

  i {
    font-size: 14px;
  }
}

// 词库管理对话框样式
.wordbank-manager-content {
  .wordbank-list {
    max-height: 300px;
    overflow-y: auto;

    .wordbank-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
      margin-bottom: 8px;

      &:hover {
        background: var(--utools-bg-secondary);
      }

      &.active {
        background: var(--utools-primary-light);
        border-left: 3px solid var(--utools-primary);

        .wordbank-name {
          color: var(--utools-primary);
          font-weight: 500;
        }
      }

      .wordbank-info {
        display: flex;
        align-items: center;
        gap: 12px;
        flex: 1;

        .wordbank-name {
          font-size: 15px;
        }

        .wordbank-count {
          font-size: 13px;
          color: var(--utools-text-secondary);
        }
      }

      .wordbank-actions {
        opacity: 0;
        transition: opacity 0.2s;
      }

      &:hover .wordbank-actions {
        opacity: 1;
      }
    }
  }

  .wordbank-actions-footer {
    display: flex;
    justify-content: center;
    padding-top: 10px;
  }
}

// 新建词库对话框样式
.create-wordbank-content {
  padding: 10px 0;
}

</style>
