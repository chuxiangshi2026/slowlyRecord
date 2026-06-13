 <template>
  <div class="dictation-page">
    <!-- 顶部栏 -->
    <div class="dictation-header">
      <div class="header-left">
        <span class="title">听写练习</span>
      </div>
      <div class="header-right">
        <span class="progress" v-if="wordList.length > 0">
          {{ currentIndex + 1 }} / {{ wordList.length }}
        </span>
      </div>
    </div>

    <!-- 筛选排序面板（顶部显示） -->
    <WordFilter
      ref="wordFilterRef"
      :visible="filterPanelVisible"
      :match-count="wordList.length"
      @change="onFilterChange"
      @reset="onFilterReset"
    />

    <!-- 听写界面 -->
    <div class="review-panel" ref="reviewPanelRef" @keydown="handleDictationKeydown" tabindex="0">
      <div class="word-display" v-if="currentWord">
        <!-- 提示区域 -->
        <div class="hints-area">
          <div v-if="options.showPhonetic" class="hint phonetic-hint">
            <span class="hint-label">音标</span>
            <span class="hint-content">{{ currentWord.phonetic || '/' + getSimplePhonetic(currentWord.text) + '/' }}</span>
          </div>
          <div v-if="options.showMeaning" class="hint meaning-hint">
            <span class="hint-label">释义</span>
            <span class="hint-content">{{ currentWord.explains }}</span>
          </div>
        </div>

        <!-- 输入区域 -->
        <div class="input-area" :class="{ shaking: isShaking }">
          <!-- 全盲模式 -->
          <div v-if="displayMode === 'blank'" class="blank-mode">
            <div class="input-slots">
              <div
                v-for="i in currentWord.text.length"
                :key="i"
                class="input-slot"
                :class="{ filled: userInput[i-1] }"
              >
                {{ userInput[i-1] || '' }}
              </div>
            </div>
            <input
              ref="hiddenInput"
              v-model="rawInput"
              class="hidden-input"
              @input="handleInput"
              :maxlength="currentWord.text.length"
            />
          </div>

          <!-- 部分提示模式 -->
          <div v-else class="partial-mode">
            <div class="letter-slots">
              <div
                v-for="(slot, index) in partialSlots"
                :key="index"
                class="letter-slot"
                :class="{
                  fixed: slot.fixed,
                  empty: !slot.fixed,
                  filled: !slot.fixed && slot.value,
                  flashing: flashingSlotIndex === index || (flashingSlotIndex === -2 && !slot.fixed),
                }"
              >
                <span v-if="slot.fixed">{{ slot.letter }}</span>
                <input
                  v-else
                  v-model="slot.value"
                  maxlength="1"
                  class="letter-input"
                  @input="handlePartialInput(index)"
                  @keydown="handlePartialKeydown($event, index)"
                  :ref="(el: any) => setSlotRef(el, index)"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- 错误提示 -->
        <div v-if="canShowHint" class="hint-area">
          <el-alert
            v-if="hintType === 'full'"
            :title="`正确答案: ${currentWord?.text}`"
            type="info"
            :closable="false"
            show-icon
            class="hint-alert"
          />
          <el-button v-else type="warning" size="small" @click="showLetterHint">
            显示提示 (已错{{ getCurrentErrorCount }}次)
          </el-button>
        </div>

        <!-- 控制按钮 -->
        <div class="control-area">
          <el-button circle size="small" @click="prevWord" :disabled="currentIndex === 0">
            <el-icon><ArrowLeft /></el-icon>
          </el-button>
          <el-button circle size="small" @click="replayWord">
            <el-icon><VideoPlay /></el-icon>
          </el-button>
          <el-button circle size="small" @click="handleForget" title="忘记（降级）">
            <el-icon><CircleClose /></el-icon>
          </el-button>
          <el-button circle size="small" @click="handleSkip" title="跳过">
            <el-icon><Right /></el-icon>
          </el-button>
          <el-button circle size="small" type="info" @click="showHintDialog" title="显示提示">
            <el-icon><QuestionFilled /></el-icon>
          </el-button>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-if="wordList.length === 0" class="empty-state">
        <el-icon :size="48" color="var(--utools-text-quaternary)"><CircleCheck /></el-icon>
        <p>当前词库没有待复习单词</p>
      </div>
    </div>

    <!-- 底部操作栏（与单词列表 home_footer 样式一致） -->
    <div class="home_footer">
      <div>
        <!-- 当前词库名称（与单词列表一致） -->
        <span class="current-bank-name" @click="openWordBankManager">
          <i class="iconfont icon-library"></i>
          {{ currentBankName }}
        </span>
        <el-divider direction="vertical"/>
        <span :class="['stat-item', { 'remembered-highlight': filterListMode === 0 }]"> 待复习: {{ forgetCount }} </span>
        <span :class="['stat-item', { 'remembered-highlight': filterListMode === 1 }]"> 已复习: {{ reviewCount }} </span>
        <span :class="['stat-item', { 'remembered-highlight': filterListMode === 2 }]"> 已记完: {{ rememberCount }} </span>
        <span :class="['stat-item', { 'remembered-highlight': filterListMode === 3 }]"> 单词总数: {{ totalCount }} </span>
      </div>

      <div>
        <el-tooltip class="box-item" effect="dark" content="返回单词列表" placement="top" popper-class="small-tooltip">
          <i class="iconfont icon-left footer-icon" @click="goToWordList"></i>
        </el-tooltip>
        <el-tooltip class="box-item" effect="dark" content="自动发音" placement="top" popper-class="small-tooltip">
          <i class="iconfont icon-player footer-icon" :class="{ active: options.autoPlay }" @click="options.autoPlay = !options.autoPlay"></i>
        </el-tooltip>
        <el-tooltip class="box-item" effect="dark" content="音标" placement="top" popper-class="small-tooltip">
          <i class="iconfont icon-notebook-1 footer-icon" :class="{ active: options.showPhonetic }" @click="options.showPhonetic = !options.showPhonetic"></i>
        </el-tooltip>
        <el-tooltip class="box-item" effect="dark" content="释义" placement="top" popper-class="small-tooltip">
          <i class="iconfont icon-visible footer-icon" :class="{ active: options.showMeaning }" @click="options.showMeaning = !options.showMeaning"></i>
        </el-tooltip>
        <el-tooltip class="box-item" effect="dark" content="半提示" placement="top" popper-class="small-tooltip">
          <i class="iconfont icon-edit footer-icon" :class="{ active: partialMode }" @click="partialMode = !partialMode"></i>
        </el-tooltip>
        <el-divider direction="vertical"/>
        <!-- 导入下拉菜单 -->
        <el-dropdown @command="handleImportCommand">
          <i class="iconfont icon-import footer-icon"></i>
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
          <i class="iconfont icon-export footer-icon"></i>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="exportJson">导出JSON</el-dropdown-item>
              <el-dropdown-item command="exportText">导出TXT</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-tooltip class="box-item" effect="dark" content="筛选排序" placement="top" popper-class="small-tooltip">
          <i class="iconfont icon-level footer-icon" :class="{ 'filter-active': filterPanelVisible }" @click="toggleFilterPanel"></i>
        </el-tooltip>
        <el-tooltip class="box-item" effect="dark" content="专注模式" placement="top" popper-class="small-tooltip">
          <i class="iconfont icon-card footer-icon" @click="openFocusMode"></i>
        </el-tooltip>
        <el-tooltip class="box-item" effect="dark" content="设置" placement="top" popper-class="small-tooltip">
          <i class="iconfont icon-setting footer-icon" @click="drawerVisible = true"></i>
        </el-tooltip>
      </div>
    </div>

    <!-- 设置抽屉 -->
    <DetailDrawer v-model="drawerVisible" title="设置" :detail-id="currentId"/>

    <!-- 词库管理对话框 -->
    <el-dialog v-model="wordBankManagerVisible" title="词库管理" width="500px" :close-on-click-modal="false">
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
              <el-button v-if="!bank.isDefault" type="danger" link size="small" @click="confirmDeleteWordBank(bank)">
                <el-icon><Delete/></el-icon>
              </el-button>
            </div>
          </div>
        </div>
        <el-divider/>
        <div class="wordbank-actions-footer">
          <el-button type="primary" @click="showCreateWordBankDialog">
            <el-icon><Plus/></el-icon> 新建词库
          </el-button>
        </div>
      </div>
    </el-dialog>

    <!-- 新建词库对话框 -->
    <el-dialog v-model="createWordBankVisible" title="新建词库" width="400px" :close-on-click-modal="false">
      <div class="create-wordbank-content">
        <el-form :model="newWordBankForm" label-width="80px">
          <el-form-item label="词库名称">
            <el-input v-model="newWordBankForm.name" placeholder="请输入词库名称" maxlength="20" show-word-limit/>
          </el-form-item>
          <el-form-item label="初始内容">
            <el-radio-group v-model="newWordBankForm.initType">
              <el-radio label="empty">空词库</el-radio>
              <el-radio label="import">从系统词库导入</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item v-if="newWordBankForm.initType === 'import'" label="选择词库">
            <el-select v-model="newWordBankForm.importBank" placeholder="请选择要导入的词库" style="width: 100%" popper-class="wordbank-import-dropdown">
              <el-option v-for="bank in wordBankOptions" :key="bank.value" :label="bank.label" :value="bank.value"/>
            </el-select>
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="createWordBankVisible = false">取消</el-button>
          <el-button type="primary" @click="confirmCreateWordBank" :disabled="!newWordBankForm.name.trim()">创建</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 词库选择对话框（从词库导入） -->
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
          </el-radio>
        </el-radio-group>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="wordBankSelectVisible = false">取消</el-button>
          <el-button type="primary" @click="confirmImportFromBank" :disabled="!selectedImportBank">确认导入</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, watch, shallowRef } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ElMessage, ElMessageBox, ElLoading } from 'element-plus';
import { CircleCheck, Right, QuestionFilled, CircleClose, Delete, Plus } from '@element-plus/icons-vue';
import { useWordsStore } from '@/stores/words';
import type { Word } from '@/types/words';
import { getCurrentWordBankId, getAllWordBanks, type WordBank, createWordBank as createNewWordBank, deleteWordBank as removeWordBank, importFromBuiltinWordBank } from '@/utils/wordbank-manager';
import { filterWordsForJsonExport, filterWordsForTextExport, parseFileContent, validateImportedWords } from '@/utils/word-util';
import { batchTranslateAndAddWords } from '@/utils/str-util';
import { fetchWordBank, WORDBANK_LIST, type WordBankType } from '@/utils/wordbank-service';
import { isUtools } from '@/adapters/platform';
import DetailDrawer from '@/views/Word/components/DetailDrawer.vue';
import WordFilter from '@/views/Word/components/WordFilter.vue';
import type { FilterState } from '@/views/Word/components/WordFilter.vue';

const router = useRouter();
const route = useRoute();
const wordsStore = useWordsStore();

// ========== 常量 ==========
const MAX_ERRORS_BEFORE_HINT = 3;

// ========== 词库相关 ==========
const selectedBankId = ref('');

// 当前词库名称
const currentBankName = computed(() => wordsStore.currentWordBank?.name || '默认词库');

// ========== 设置抽屉 ==========
const drawerVisible = ref(false);
const currentId = ref<string | number | undefined>(undefined);

// ========== 词库选择（从词库导入） ==========
const wordBankSelectVisible = ref(false);
const selectedImportBank = ref<WordBankType | ''>('');

// ========== 词库管理功能 ==========
const wordBankManagerVisible = ref(false);
const createWordBankVisible = ref(false);
const customWordBanks = ref<WordBank[]>([]);

// 新建词库表单
const newWordBankForm = ref({
  name: '',
  initType: 'empty' as 'empty' | 'import',
  importBank: '' as string
});

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
  {label: '短语动词', value: 'phrasal-verbs'},
  {label: '固定搭配', value: 'collocations'},
  {label: '习语', value: 'idioms'},
];

// 是否有活跃筛选
const hasActiveFilter = computed(() => {
  const f = currentFilter.value;
  return filterListMode.value !== 0 || !!f.pattern || f.minLength > 0 || f.maxLength > 0 || !!f.sortBy || !!f.affixText || !!f.phonetic;
});

// 统计（从 store 计算）
const forgetCount = computed(() => wordsStore.forgetCount);
const reviewCount = computed(() => wordsStore.reviewCount);
const rememberCount = computed(() => wordsStore.rememberCount);
const totalCount = computed(() => wordsStore.count);

// ========== 筛选排序功能 ==========
const filterPanelVisible = ref(false);
const wordFilterRef = ref<InstanceType<typeof WordFilter> | null>(null);
const currentFilter = shallowRef<FilterState>({
  minLength: 0,
  maxLength: 0,
  pattern: '',
  affixType: '',
  affixText: '',
  phonetic: '',
  sortBy: '',
  sortAsc: true
});

const toggleFilterPanel = () => {
  filterPanelVisible.value = !filterPanelVisible.value;
};

const onFilterChange = (state: FilterState) => {
  currentFilter.value = { ...state };
  // 同步到URL参数
  filterPattern.value = state.pattern;
  filterMinLen.value = state.minLength;
  filterMaxLen.value = state.maxLength;
  filterSortBy.value = state.sortBy;
  filterSortAsc.value = state.sortAsc;
};

const onFilterReset = () => {
  currentFilter.value = {
    minLength: 0,
    maxLength: 0,
    pattern: '',
    affixType: '',
    affixText: '',
    phonetic: '',
    sortBy: '',
    sortAsc: true
  };
  filterPattern.value = '';
  filterMinLen.value = 0;
  filterMaxLen.value = 0;
  filterSortBy.value = '';
  filterSortAsc.value = true;
};

// ========== 筛选参数（从URL同步） ==========
const filterListMode = ref(0);
const filterPattern = ref('');
const filterMinLen = ref(0);
const filterMaxLen = ref(0);
const filterSortBy = ref('');
const filterSortAsc = ref(true);

function readFilterFromUrl() {
  filterListMode.value = parseInt(route.query.listMode as string || '0');
  filterPattern.value = (route.query.pattern as string) || '';
  filterMinLen.value = parseInt(route.query.minLen as string || '0');
  filterMaxLen.value = parseInt(route.query.maxLen as string || '0');
  filterSortBy.value = (route.query.sortBy as string) || '';
  filterSortAsc.value = (route.query.sortAsc as string) !== '0';
}

// 通配符模式转正则
function patternToRegex(pattern: string): RegExp | null {
  if (!pattern || !pattern.trim()) return null;
  const trimmed = pattern.trim();
  try {
    if (trimmed.includes('*')) {
      const escaped = trimmed.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
      return new RegExp('^' + escaped + '$', 'i');
    }
    return new RegExp(trimmed.replace(/[.+^${}()|[\]\\]/g, '\\$&'), 'i');
  } catch (e) {
    return null;
  }
}

// 对单词列表应用筛选
function applyFilters(list: Word[]): Word[] {
  let result = list.slice();

  // listMode 筛选（与主窗口一致）
  if (filterListMode.value === 2) {
    result = result.filter(w => w.remember);
  } else if (filterListMode.value === 1) {
    result = result.filter(w => !w.isReview);
  } else if (filterListMode.value === 3) {
    // 全部
  } else {
    result = result.filter(w => w.isReview);
  }

  // 长度筛选
  if (currentFilter.value.minLength > 0 || currentFilter.value.maxLength > 0) {
    result = result.filter(w => {
      const len = (w.text || '').replace(/\s+/g, '').length;
      if (currentFilter.value.minLength > 0 && len < currentFilter.value.minLength) return false;
      if (currentFilter.value.maxLength > 0 && len > currentFilter.value.maxLength) return false;
      return true;
    });
  }

  // 通配符筛选
  const regex = patternToRegex(currentFilter.value.pattern);
  if (regex) {
    result = result.filter(w => regex.test((w.text || '').replace(/\s+/g, '')));
  }

  // 词根词缀筛选
  if (currentFilter.value.affixText) {
    const affixText = currentFilter.value.affixText.toLowerCase();
    result = result.filter(w => {
      const word = (w.text || '').toLowerCase();
      const affixType = currentFilter.value.affixType;
      if (affixType === 'prefix') return word.startsWith(affixText);
      if (affixType === 'suffix') return word.endsWith(affixText);
      if (affixType === 'root') return word.includes(affixText);
      return word.includes(affixText);
    });
  }

  // 音标筛选
  if (currentFilter.value.phonetic) {
    const ph = currentFilter.value.phonetic;
    result = result.filter(w => (w.pronunciation || '').includes(ph));
  }

  // 排序
  if (currentFilter.value.sortBy) {
    const dir = currentFilter.value.sortAsc ? 1 : -1;
    result = result.sort((a, b) => {
      switch (currentFilter.value.sortBy) {
        case 'alpha': return dir * (a.text || '').localeCompare(b.text || '', 'en');
        case 'length': return dir * ((a.text || '').length - (b.text || '').length);
        case 'time': return dir * (new Date(a.ctime || 0).getTime() - new Date(b.ctime || 0).getTime());
        case 'level': return dir * ((a.level || 0) - (b.level || 0));
        default: return 0;
      }
    });
  }

  return result;
}

// 打开词库管理器（筛选/排序） → 回单词列表
function goToWordList() {
  router.push('/word');
}

// ========== 选项 ==========
const partialMode = ref(true); // true=半提示模式, false=全盲模式
const displayMode = computed<'blank' | 'partial'>(() => partialMode.value ? 'partial' : 'blank');
const options = ref({
  autoPlay: true,
  showPhonetic: true,
  showMeaning: true,
});

// ========== 单词列表 ==========
const wordList = ref<Word[]>([]);
const currentIndex = ref(0);
const userInput = ref<string[]>([]);
const rawInput = ref('');
const isShaking = ref(false);
const errorCountMap = ref<Record<number, number>>({});
const showHint = ref(false);
const hintType = ref<'none' | 'letter' | 'full'>('none');
const flashingSlotIndex = ref<number>(-1);
const reviewPanelRef = ref<HTMLDivElement>();

const partialSlots = ref<{ fixed: boolean; letter: string; value?: string }[]>([]);
const slotRefs = ref<Record<number, HTMLInputElement>>({});
const hiddenInput = ref<HTMLInputElement>();

// ========== 计算属性 ==========
const currentWord = computed(() => wordList.value[currentIndex.value] || null);

const getCurrentErrorCount = computed(() => {
  return errorCountMap.value[currentIndex.value] || 0;
});

const canShowHint = computed(() => {
  const count = errorCountMap.value[currentIndex.value] || 0;
  return count >= MAX_ERRORS_BEFORE_HINT;
});

// ========== 词库加载 ==========
async function loadBanks() {
  const currentId = await getCurrentWordBankId();
  selectedBankId.value = currentId;
  wordsStore.currentWordBankId = currentId;
  // 同步 store 的词库信息
  await wordsStore.listWords();
}

async function loadWords() {
  // 从 store 直接获取单词（避免 DB 重新加载导致数据不一致）
  const allWords = wordsStore.words;
  if (allWords.length === 0) {
    wordList.value = [];
    return;
  }
  // 只取纯英文单词，应用筛选条件，随机打乱
  const englishWords = allWords.filter(w => w.text && /^[a-zA-Z]+$/.test(w.text));
  wordList.value = applyFilters(englishWords).sort(() => Math.random() - 0.5);
  currentIndex.value = 0;
}

/** 更新单词后刷新列表（移除不再匹配筛选条件的单词） */
function refreshWordList() {
  // 从 store 重新构建列表
  const allWords = wordsStore.words.filter(w => w.text && /^[a-zA-Z]+$/.test(w.text));
  const newList = applyFilters(allWords);
  // 如果当前单词还在新列表中，保持位置
  const curWord = currentWord.value;
  if (curWord) {
    const newIdx = newList.findIndex(w => w._id === curWord._id);
    if (newIdx >= 0) {
      wordList.value = newList;
      currentIndex.value = newIdx;
      return;
    }
  }
  // 当前单词已不在筛选结果中，跳转到新列表的合适位置
  wordList.value = [...newList].sort(() => Math.random() - 0.5);
  currentIndex.value = Math.min(currentIndex.value, wordList.value.length - 1);
}

// ========== 初始化 ==========
onMounted(async () => {
  readFilterFromUrl();
  wordsStore.setLastVisitedPage('/dictation');
  await loadBanks();
  await loadWords();
  if (wordList.value.length > 0) {
    prepareWord();
  }
});

// 当 store 的词库变化时同步刷新
watch(() => wordsStore.currentWordBankId, async (newId) => {
  if (newId && newId !== selectedBankId.value) {
    selectedBankId.value = newId;
    await loadWords();
    if (wordList.value.length > 0) prepareWord();
  }
});

// ========== 词库管理方法 ==========
// 加载自定义词库列表
const loadCustomWordBanks = async () => {
  customWordBanks.value = await getAllWordBanks();
};

// 打开词库管理器
const openWordBankManager = () => {
  loadCustomWordBanks();
  wordBankManagerVisible.value = true;
};

// 监听词库管理器可见性变化，当打开时刷新数据
watch(() => wordBankManagerVisible.value, (visible) => {
  if (visible) {
    loadCustomWordBanks();
  }
});

// 切换到指定词库
const switchToWordBank = async (bankId: string) => {
  const success = await wordsStore.switchWordBank(bankId);
  if (success) {
    ElMessage.success(`已切换到: ${wordsStore.currentWordBank?.name}`);
    wordBankManagerVisible.value = false;
    await loadWords();
    prepareWord();
  } else {
    ElMessage.error('切换词库失败');
  }
};

// 确认删除词库
const confirmDeleteWordBank = (bank: WordBank) => {
  if (bank.isDefault) {
    ElMessage.warning('默认词库不能删除');
    return;
  }
  ElMessageBox.confirm(`确定要删除词库 "${bank.name}" 吗？此操作不可恢复！`, '删除确认', {
    confirmButtonText: '删除',
    cancelButtonText: '取消',
    type: 'warning',
  }).then(async () => {
    const success = await removeWordBank(bank.id);
    if (success) {
      ElMessage.success('词库已删除');
      loadCustomWordBanks();
      // 如果删除的是当前词库，切换到默认词库并刷新
      if (wordsStore.currentWordBankId === bank.id) {
        await wordsStore.listWords();
        await loadWords();
        prepareWord();
      }
    } else {
      ElMessage.error('删除失败');
    }
  }).catch(() => {});
};

// 显示创建词库对话框
const showCreateWordBankDialog = () => {
  newWordBankForm.value = {
    name: '',
    initType: 'empty',
    importBank: ''
  };
  createWordBankVisible.value = true;
};

// 确认创建词库
const confirmCreateWordBank = async () => {
  const name = newWordBankForm.value.name.trim();
  if (!name) {
    ElMessage.warning('请输入词库名称');
    return;
  }
  // 检查名称是否重复
  const existing = customWordBanks.value.find(b => b.name === name);
  if (existing) {
    ElMessage.warning('词库名称已存在');
    return;
  }
  // 创建词库
  const newBank = await createNewWordBank(name);
  // 如果从系统词库导入
  if (newWordBankForm.value.initType === 'import' && newWordBankForm.value.importBank) {
    const loading = ElLoading.service({
      lock: true,
      text: '正在导入词库...',
      background: 'rgba(0, 0, 0, 0.7)',
    });
    try {
      const result = await importFromBuiltinWordBank(newBank.id, newWordBankForm.value.importBank);
      loading.close();
      if (result.success && result.count > 0) {
        ElMessage.success(`成功创建词库 "${name}"，导入 ${result.count} 个单词`);
      } else if (result.success && result.count === 0) {
        ElMessage.warning(`词库 "${name}" 创建成功，但没有新单词可导入`);
      } else {
        ElMessage.error(`词库 "${name}" 创建成功，但导入失败: ${result.error || '未知错误'}`);
      }
    } catch (error) {
      loading.close();
      ElMessage.error('导入失败');
    }
  } else {
    ElMessage.success(`成功创建空词库 "${name}"`);
  }
  createWordBankVisible.value = false;
  loadCustomWordBanks();
  // 切换到新创建的词库
  switchToWordBank(newBank.id);
};

// ========== 方法 ==========
function openFocusMode() {
  router.push('/word?openFocus=1&focusMode=dictation');
}

// ========== 导入导出功能 ==========
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
      wordBankSelectVisible.value = true;
      break;
  }
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
 * 导出单词到JSON文件
 */
const exportWords = () => {
  if (wordsStore.count === 0) {
    ElMessage.warning('没有单词可导出');
    return;
  }
  const filteredWords = filterWordsForJsonExport(wordList.value);
  const content = JSON.stringify(filteredWords, null, 2);
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'words_export.json';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  ElMessage.success('导出成功');
};

/**
 * 导出单词到TXT文件
 */
const exportTextWords = () => {
  if (wordsStore.count === 0) {
    ElMessage.warning('没有单词可导出');
    return;
  }
  const content = filterWordsForTextExport(wordList.value);
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'words_export.txt';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  ElMessage.success('导出成功');
};

/**
 * JSON导入
 */
const importWords = () => {
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.json';
  fileInput.onchange = (event) => {
    if (isUtools()) (window as any).utools?.showMainWindow?.();
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        try {
          const importedWords: any[] = JSON.parse(content);
          const validatedWords = validateImportedWords(importedWords);
          const uniqueWords = validatedWords.filter((importedWord) => {
            return !wordsStore.words.some((existingWord) => existingWord.text === importedWord.text);
          });
          if (uniqueWords.length > 0) {
            const wordsNeedingTranslation = uniqueWords.filter(word => !word.explains);
            const wordsWithExplains = uniqueWords.filter(word => !!word.explains);
            if (wordsNeedingTranslation.length > 0) {
              ElMessage.info(`检测到${wordsNeedingTranslation.length}个单词需要翻译，正在翻译中...`);
              if (wordsWithExplains.length > 0) {
                wordsStore.addAndUpdateWords(wordsWithExplains);
              }
              const wordsToTranslate = wordsNeedingTranslation.map(word => word.text);
              batchTranslateAndAddWords(wordsToTranslate, (processedCount, totalCount) => {
                if (totalCount > 0) {
                  ElMessage.info(`正在翻译: ${processedCount}/${totalCount}`);
                }
              });
            } else {
              wordsStore.addAndUpdateWords(uniqueWords).then(() => {
                ElMessage.success(`成功导入${uniqueWords.length}个单词`);
              });
            }
          } else {
            ElMessage.warning('没有新单词需要导入');
          }
        } catch (error) {
          ElMessage.error('导入失败，请检查文件格式');
        }
      };
      reader.readAsText(file);
    }
  };
  fileInput.click();
};

/**
 * TXT/CSV导入
 */
const importTextWords = () => {
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.txt,.csv';
  fileInput.onchange = async (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        (window as any).utools?.showMainWindow?.();
        try {
          const content = e.target?.result as string;
          const wordListFromFile = parseFileContent(content);
          if (wordListFromFile.length > 0) {
            const validatedWords = wordListFromFile.filter(word => typeof word.text === 'string' && word.text.trim() !== '');
            if (validatedWords.length === 0) {
              ElMessage.warning('文件中没有有效的单词');
              return;
            }
            const uniqueWords = validatedWords.filter((importedWord) => {
              return !wordsStore.words.some((existingWord) => existingWord.text === importedWord.text);
            });
            if (uniqueWords.length === 0) {
              ElMessage.warning('没有新单词需要导入');
              return;
            }
            const wordsNeedingTranslation = uniqueWords.filter(word => !word.explains || !word.pronunciation);
            const wordsWithExplains = uniqueWords.filter(word => !!word.explains && !!word.pronunciation);
            if (wordsNeedingTranslation.length > 0) {
              ElMessage.info(`检测到${wordsNeedingTranslation.length}个单词需要翻译，正在翻译中...`);
              if (wordsWithExplains.length > 0) {
                wordsStore.addAndUpdateWords(wordsWithExplains);
              }
              const wordsToTranslate = wordsNeedingTranslation.map(word => word.text);
              batchTranslateAndAddWords(wordsToTranslate, (processedCount, totalCount) => {
                if (totalCount > 0) {
                  ElMessage.info(`正在翻译: ${processedCount}/${totalCount}`);
                }
              });
            } else {
              wordsStore.addAndUpdateWords(uniqueWords).then(() => {
                ElMessage.success(`成功导入${uniqueWords.length}个单词`);
              });
            }
          } else {
            ElMessage.warning('文件内容为空或格式不正确');
          }
        } catch (error) {
          ElMessage.error('导入失败，请检查文件格式');
        }
      };
      reader.readAsText(file);
    }
  };
  fileInput.click();
};

/**
 * 从内置词库导入单词
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
    const words = await fetchWordBank(bankType, { priority: 'local', useCache: true });
    loading.close();
    if (words.length === 0) {
      ElMessage.warning('词库加载失败，请检查词库文件是否存在');
      return;
    }
    const uniqueWords = words.filter((importedWord) => {
      return !wordsStore.words.some((existingWord) => existingWord.text === importedWord.text);
    });
    if (uniqueWords.length === 0) {
      ElMessage.warning('没有新单词需要导入');
      return;
    }
    const wordsNeedingTranslation = uniqueWords.filter(word => !word.explains);
    const wordsWithExplains = uniqueWords.filter(word => !!word.explains);
    if (wordsNeedingTranslation.length > 0) {
      ElMessage.info(`检测到${wordsNeedingTranslation.length}个单词需要翻译，正在翻译中...`);
      if (wordsWithExplains.length > 0) {
        wordsStore.addAndUpdateWords(wordsWithExplains);
      }
      const wordsToTranslate = wordsNeedingTranslation.map(word => word.text);
      batchTranslateAndAddWords(wordsToTranslate, (processedCount, totalCount) => {
        if (totalCount > 0) {
          ElMessage.info(`正在翻译: ${processedCount}/${totalCount}`);
        }
      });
    } else {
      wordsStore.addAndUpdateWords(uniqueWords).then(() => {
        ElMessage.success(`成功从${bankName}导入${uniqueWords.length}个单词`);
      });
    }
  } catch (error) {
    loading.close();
    ElMessage.error('词库导入失败');
  }
};

function getSimplePhonetic(text: string): string {
  return text;
}

function prepareWord() {
  userInput.value = [];
  rawInput.value = '';
  isShaking.value = false;
  partialSlots.value = [];
  hintType.value = 'none';
  showHint.value = false;

  const word = currentWord.value;
  if (!word) return;

  if (displayMode.value === 'partial') {
    const letters = word.text.split('');
    const len = letters.length;
    let hideCount = Math.floor(len * 0.5);
    if (hideCount < 1) hideCount = 1;
    if (hideCount >= len) hideCount = len - 1;

    const hideIndices = new Set<number>();
    while (hideIndices.size < hideCount) {
      hideIndices.add(Math.floor(Math.random() * len));
    }

    partialSlots.value = letters.map((letter, index) => ({
      fixed: !hideIndices.has(index),
      letter,
      value: hideIndices.has(index) ? '' : undefined
    }));

    nextTick(() => {
      setTimeout(() => {
        const firstEmpty = partialSlots.value.findIndex(s => !s.fixed);
        if (firstEmpty >= 0) slotRefs.value[firstEmpty]?.focus();
      }, 100);
    });
  } else {
    nextTick(() => {
      setTimeout(() => {
        hiddenInput.value?.focus();
      }, 100);
    });
  }

  // 自动播放
  if (options.value.autoPlay) {
    setTimeout(() => playWord(), 300);
  }
}

function handleInput() {
  const word = currentWord.value;
  if (!word) return;

  userInput.value = rawInput.value.split('').slice(0, word.text.length);

  if (userInput.value.length === word.text.length) {
    checkAnswer();
  }
}

function handlePartialInput(index: number) {
  const slot = partialSlots.value[index];
  if (slot?.value) {
    slot.value = slot.value.toLowerCase();
    const nextIndex = partialSlots.value.findIndex((s, i) => i > index && !s.fixed && !s.value);
    if (nextIndex >= 0) {
      slotRefs.value[nextIndex]?.focus();
    } else {
      const allFilled = partialSlots.value.every(s => s.fixed || s.value);
      if (allFilled) {
        checkAnswer();
      }
    }
  }
}

function handlePartialKeydown(e: KeyboardEvent, index: number) {
  if (e.key === 'Backspace' && !partialSlots.value[index]?.value) {
    e.preventDefault();
    const prevIndices = partialSlots.value
      .map((s, i) => ({ s, i }))
      .filter(({ s, i }) => i < index && !s.fixed)
      .map(({ i }) => i);
    if (prevIndices.length > 0) {
      slotRefs.value[prevIndices[prevIndices.length - 1]]?.focus();
    }
  }
}

function setSlotRef(el: any, index: number) {
  if (el) slotRefs.value[index] = el;
}

function playWord() {
  const word = currentWord.value;
  if (!word?.text) return;

  const utterance = new SpeechSynthesisUtterance(word.text);
  utterance.lang = 'en-US';
  utterance.rate = 0.8;
  window.speechSynthesis.speak(utterance);
}

function replayWord() {
  playWord();
}

// ========== 单词操作 ==========

/**
 * 检查答案 → 正确=记住, 错误=忘记
 */
async function checkAnswer() {
  const word = currentWord.value;
  if (!word) return;

  let userAnswer = '';
  if (displayMode.value === 'blank') {
    userAnswer = userInput.value.join('').toLowerCase();
  } else {
    userAnswer = partialSlots.value.map(s => s.value || s.letter).join('').toLowerCase();
  }

  const isCorrect = userAnswer === word.text.toLowerCase();

  if (isCorrect) {
    // 正确：记一次记住（等级+1）
    word.level = Math.min(7, (word.level || 1) + 1) as Word['level'];
    word.isReview = word.level < 7;
    if (word.level >= 7) word.remember = true;
    word.learnDate = new Date();

    await wordsStore.addAndUpdateWord(word);
    wordsStore.upReview();

    // 清除该单词的错误记录
    delete errorCountMap.value[currentIndex.value];
    refreshWordList();
    nextWord();
  } else {
    // 错误：触发忘记（等级-1）
    word.level = Math.max(1, (word.level || 1) - 1) as Word['level'];
    word.isReview = true;

    await wordsStore.addAndUpdateWord(word);
    wordsStore.upReview();

    // 记录错误次数
    errorCountMap.value[currentIndex.value] = (errorCountMap.value[currentIndex.value] || 0) + 1;
    refreshWordList();

    // 晃动提示
    isShaking.value = true;
    setTimeout(() => {
      isShaking.value = false;
    }, 500);

    // 如果错误次数达到阈值，自动显示完整提示
    if (errorCountMap.value[currentIndex.value] >= MAX_ERRORS_BEFORE_HINT + 2) {
      hintType.value = 'full';
      showHint.value = true;
    }
  }
}

/**
 * 忘记按钮：直接降级当前单词
 */
async function handleForget() {
  const word = currentWord.value;
  if (!word) return;

  word.level = Math.max(1, (word.level || 1) - 1) as Word['level'];
  word.isReview = true;

  await wordsStore.addAndUpdateWord(word);
  wordsStore.upReview();

  ElMessage.info(`已忘记: ${word.text}`);
  refreshWordList();
  nextWord();
}

/**
 * 跳过：不改变等级，直接下一个
 */
function handleSkip() {
  nextWord();
}

function prevWord() {
  if (currentIndex.value > 0) {
    currentIndex.value--;
    prepareWord();
  }
}

function nextWord() {
  // 如果列表已被清空（所有单词均已记住/不匹配筛选），重新加载
  if (wordList.value.length === 0) {
    loadWords().then(() => {
      if (wordList.value.length > 0) {
        prepareWord();
        ElMessage.success('新一轮单词');
      }
    });
    return;
  }

  if (currentIndex.value < wordList.value.length - 1) {
    currentIndex.value++;
    prepareWord();
  } else {
    // 一轮结束，重新加载打乱
    loadWords().then(() => {
      if (wordList.value.length > 0) {
        prepareWord();
        ElMessage.success('新一轮单词');
      }
    });
  }
}

// ========== 提示功能 ==========
function showLetterHint() {
  if (!currentWord.value) return;

  hintType.value = 'full';
  showHint.value = true;

  if (displayMode.value === 'partial') {
    const emptySlots = partialSlots.value
      .map((s, i) => ({ slot: s, index: i }))
      .filter(({ slot }) => !slot.fixed && !slot.value);

    if (emptySlots.length > 0) {
      const randomSlot = emptySlots[Math.floor(Math.random() * emptySlots.length)];
      partialSlots.value[randomSlot.index].value = randomSlot.slot.letter;

      const allFilled = partialSlots.value.every(s => s.fixed || s.value);
      if (allFilled) {
        hintType.value = 'full';
      }
    }
  }
}

// ========== 提示闪烁 ==========
const tempSlotValues = ref<{ index: number; originalValue: string }[]>([]);
const isShowingHint = ref(false);

function showPartialHint() {
  if (!currentWord.value || isShowingHint.value) return;

  tempSlotValues.value = [];
  const emptySlots: number[] = [];

  partialSlots.value.forEach((slot, index) => {
    if (!slot.fixed) {
      tempSlotValues.value.push({ index, originalValue: slot.value || '' });
      if (!slot.value) {
        emptySlots.push(index);
      }
    }
  });

  if (emptySlots.length === 0) return;

  isShowingHint.value = true;

  emptySlots.forEach(index => {
    partialSlots.value[index].value = partialSlots.value[index].letter;
  });

  flashingSlotIndex.value = -2;

  setTimeout(() => {
    flashingSlotIndex.value = -1;
    tempSlotValues.value.forEach(({ index, originalValue }) => {
      partialSlots.value[index].value = originalValue;
    });
    isShowingHint.value = false;
    nextTick(() => {
      const firstEmpty = partialSlots.value.findIndex(s => !s.fixed && !s.value);
      if (firstEmpty >= 0) slotRefs.value[firstEmpty]?.focus();
    });
  }, 900);
}

function showBlankHint() {
  if (!currentWord.value || isShowingHint.value) return;

  const originalInput = [...userInput.value];
  const emptyIndices: number[] = [];

  userInput.value.forEach((char, index) => {
    if (!char) {
      emptyIndices.push(index);
    }
  });

  if (emptyIndices.length === 0) return;

  isShowingHint.value = true;

  const word = currentWord.value.text;
  emptyIndices.forEach(index => {
    userInput.value[index] = word[index];
  });

  const inputSlots = document.querySelectorAll('.blank-mode .input-slot');
  inputSlots.forEach(slot => slot.classList.add('flashing'));

  setTimeout(() => {
    inputSlots.forEach(slot => slot.classList.remove('flashing'));
    userInput.value = [...originalInput];
    isShowingHint.value = false;
    nextTick(() => {
      hiddenInput.value?.focus();
    });
  }, 900);
}

function showHintDialog() {
  if (!currentWord.value) return;

  if (displayMode.value === 'partial') {
    showPartialHint();
  } else {
    showBlankHint();
  }
}

// ========== 键盘快捷键 ==========
function handleDictationKeydown(e: KeyboardEvent) {
  if (!wordsStore.shortcutEnabled) return;

  if (e.shiftKey && e.key.toLowerCase() === 'h') {
    e.preventDefault();
    showHintDialog();
    return;
  }

  if (e.shiftKey && e.key === 'ArrowLeft') {
    e.preventDefault();
    prevWord();
    return;
  }

  if (e.shiftKey && e.key === 'ArrowRight') {
    e.preventDefault();
    handleSkip();
    return;
  }

  if (e.key === ' ') {
    e.preventDefault();
    replayWord();
    return;
  }

  if (e.key === 'Enter') {
    e.preventDefault();
    handleSkip();
    return;
  }

  if (e.shiftKey && e.key.toLowerCase() === 'f') {
    e.preventDefault();
    handleForget();
    return;
  }
}
</script>

<style scoped lang="scss">
.dictation-page {
  min-height: 100vh;
  background: var(--utools-bg-secondary);
  display: flex;
  flex-direction: column;
}

// 顶部栏
.dictation-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background: var(--utools-bg-card);
  border-bottom: 1px solid var(--utools-border-divider);

  .header-left {
    display: flex;
    align-items: center;
    gap: 16px;

    .title {
      font-size: 18px;
      font-weight: 500;
      color: var(--utools-text-primary);
    }
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 8px;

    .progress {
      font-size: 14px;
      color: var(--utools-text-secondary);
    }
  }
}

// 底部操作栏（与单词列表 home_footer 样式一致）
.home_footer {
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

  > div:first-child {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  > div:last-child {
    display: flex;
    align-items: center;
    gap: 2px;
  }

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

  .stat-item {
    padding: 2px 6px;
    border-radius: 4px;
    cursor: default;
    color: var(--utools-text-secondary);
    font-size: 13px;
  }

  .remembered-highlight {
    color: var(--utools-danger);
  }

  .iconfont,
  .footer-icon {
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

    &.active {
      color: #ffffff;
    }
  }

  .filter-active {
    color: var(--utools-primary);
    background-color: var(--utools-bg-hover);
    border-radius: 6px;
  }
}

// 听写面板
.review-panel {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;

  .word-display {
    width: 100%;
    max-width: 800px;
    text-align: center;
    position: relative;
  }

  .hints-area {
    margin-bottom: 48px;

    .hint {
      margin-bottom: 16px;

      .hint-label {
        display: inline-block;
        width: 60px;
        font-size: 14px;
        color: var(--utools-text-tertiary);
        text-align: right;
        margin-right: 16px;
      }

      .hint-content {
        font-size: 18px;
        color: var(--utools-text-primary);
      }

      &.phonetic-hint .hint-content {
        color: var(--utools-primary);
      }

      &.meaning-hint .hint-content {
        color: var(--utools-text-secondary);
      }
    }
  }

  .input-area {
    margin-bottom: 32px;

    &.shaking {
      animation: shake 0.5s ease-in-out;
    }

    .blank-mode {
      position: relative;

      .input-slots {
        display: flex;
        justify-content: center;
        gap: 8px;
        flex-wrap: wrap;

        .input-slot {
          width: 56px;
          height: 56px;
          border: 2px solid var(--utools-border-primary);
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          font-weight: 500;
          color: var(--utools-text-primary);
          background: var(--utools-bg-card);
          transition: all 0.2s;

          &.filled {
            border-color: var(--utools-primary);
            background: var(--utools-primary-light);
          }
        }
      }

      .hidden-input {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        opacity: 0;
        cursor: default;
      }
    }

    .partial-mode {
      .letter-slots {
        display: flex;
        justify-content: center;
        gap: 8px;
        flex-wrap: wrap;

        .letter-slot {
          width: 56px;
          height: 56px;
          border: 2px solid var(--utools-border-primary);
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          font-weight: 500;
          transition: all 0.2s;

          &.fixed {
            background: var(--utools-bg-tertiary);
            border-color: var(--utools-border-primary);
            color: var(--utools-text-tertiary);
          }

          &.empty {
            background: var(--utools-bg-card);
            border-color: var(--utools-primary);
            border-style: dashed;
          }

          &.filled {
            background: var(--utools-primary-light);
          }

          .letter-input {
            width: 100%;
            height: 100%;
            border: none;
            background: transparent;
            text-align: center;
            font-size: 28px;
            font-weight: 500;
            color: var(--utools-text-primary);
            text-transform: lowercase;
            outline: none;
          }
        }
      }
    }
  }

  .control-area {
    display: flex;
    justify-content: center;
    gap: 12px;
  }

  .hint-area {
    margin-bottom: 24px;

    .hint-alert {
      max-width: 400px;
      margin: 0 auto;
    }
  }

  .empty-state {
    text-align: center;
    color: var(--utools-text-quaternary);

    p {
      margin-top: 16px;
      font-size: 16px;
    }
  }
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-8px); }
  20%, 40%, 60%, 80% { transform: translateX(8px); }
}

// 闪烁动画
@keyframes flash {
  0%, 100% {
    background-color: var(--utools-warning);
    box-shadow: 0 0 0 0 var(--utools-warning);
  }
  50% {
    background-color: var(--utools-warning-light);
    box-shadow: 0 0 10px 2px var(--utools-warning);
  }
}

.letter-slot.flashing {
  animation: flash 0.3s ease-in-out 3;
}

.input-slot.flashing {
  animation: flash 0.3s ease-in-out 3;
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
      padding: 10px 12px;
      border-radius: 6px;
      cursor: pointer;
      transition: background 0.2s;

      &:hover {
        background: var(--utools-bg-hover);
      }

      &.active {
        background: var(--utools-primary-light);

        .wordbank-name {
          color: var(--utools-primary);
          font-weight: 500;
        }
      }

      .wordbank-info {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 1;
      }

      .wordbank-name {
        font-size: 14px;
        color: var(--utools-text-primary);
      }

      .wordbank-count {
        font-size: 12px;
        color: var(--utools-text-tertiary);
      }

      .wordbank-actions {
        display: flex;
        align-items: center;
      }
    }
  }

  .wordbank-actions-footer {
    display: flex;
    justify-content: center;
    padding-top: 8px;
  }
}

.create-wordbank-content {
  padding: 8px 0;
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
    }
  }
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>

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
