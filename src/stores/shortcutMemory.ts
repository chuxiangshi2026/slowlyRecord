import { ref, computed } from "vue";
import { defineStore } from "pinia";
import type {
  ShortcutItem,
  ShortcutCategory,
  ShortcutTrainingRecord,
  TrainingPhase
} from "@/types/shortcut-memory";
import {
  getCategories,
  getShortcutsByCategory,
  getShortcutById,
  shuffleArray,
  generateDistractors,
  formatKeys,
  matchShortcut,
  normalizeKey,
  loadAllShortcuts,
  loadShortcutCategories,
  isCustomCategory
} from "@/utils/shortcut-memory-data";
import {
  getAllTrainingRecords,
  saveTrainingRecord,
  getLearningProgress,
  saveLearningProgress,
  clearLearningProgress,
  saveCustomShortcut,
  removeCustomShortcut,
  saveCustomCategory,
  removeCustomCategory,
  updateCustomShortcut
} from "@/utils/shortcut-memory-db";
import { log } from "@/utils/logger";

export const useShortcutMemoryStore = defineStore("shortcutMemory", () => {
  // State
  const categories = ref<ShortcutCategory[]>([]);
  const currentCategory = ref<string>('');
  const currentShortcuts = ref<ShortcutItem[]>([]);
  const isLoading = ref(false);

  // 训练状态
  const trainingPhase = ref<TrainingPhase>('ready');
  const currentQuestionIndex = ref(0);
  const questions = ref<ShortcutItem[]>([]);
  const pressedKeys = ref<Set<string>>(new Set());
  const correctCount = ref(0);
  const wrongCount = ref(0);
  const trainingStartTime = ref(0);
  const questionStartTime = ref(0);
  const trainingDetails = ref<{ itemId: string; correct: boolean; responseTime: number }[]>([]);

  // Getters
  const currentCategoryShortcuts = computed(() => currentShortcuts.value);
  
  const currentShortcutCount = computed(() => currentShortcuts.value.length);

  const progress = computed(() => {
    if (questions.value.length === 0) return 0;
    return Math.round((currentQuestionIndex.value / questions.value.length) * 100);
  });

  const currentQuestion = computed(() => {
    if (questions.value.length === 0) return null;
    return questions.value[currentQuestionIndex.value];
  });

  const isTrainingComplete = computed(() => {
    return currentQuestionIndex.value >= questions.value.length && questions.value.length > 0;
  });

  // Actions
  /**
   * 加载所有分类（优先从 public/shortcuts/ JSON 加载）
   */
  async function loadCategories() {
    isLoading.value = true;
    try {
      await loadAllShortcuts();
      categories.value = getCategories();
      log.i('加载快捷键分类', categories.value.length);
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * 选择分类并加载该分类下的快捷键
   */
  function selectCategory(category: string) {
    currentCategory.value = category;
    currentShortcuts.value = getShortcutsByCategory(category);
    log.i('选择快捷键分类', category, currentShortcuts.value.length);
  }

  /**
   * 获取格式化的按键显示
   */
  function getFormattedKeys(itemId: string): string {
    const item = getShortcutById(itemId);
    return item ? formatKeys(item.keys) : '';
  }

  /**
   * 初始化正向训练（按键训练）
   * @param category 分类名称
   * @param count 题目数量，0表示全部
   */
  function initKeyPressTraining(category: string, count: number = 0) {
    const shortcuts = getShortcutsByCategory(category);
    const selected = count > 0 && count < shortcuts.length 
      ? shuffleArray(shortcuts).slice(0, count) 
      : shuffleArray(shortcuts);
    
    questions.value = selected;
    currentQuestionIndex.value = 0;
    correctCount.value = 0;
    wrongCount.value = 0;
    trainingDetails.value = [];
    pressedKeys.value = new Set();
    trainingPhase.value = 'ready';
    trainingStartTime.value = Date.now();
    questionStartTime.value = 0;
    
    log.i('初始化按键训练', category, selected.length);
  }

  /**
   * 初始化反向训练（选择功能）
   * @param category 分类名称
   * @param count 题目数量，0表示全部
   */
  function initFunctionSelectTraining(category: string, count: number = 0) {
    const shortcuts = getShortcutsByCategory(category);
    const selected = count > 0 && count < shortcuts.length 
      ? shuffleArray(shortcuts).slice(0, count) 
      : shuffleArray(shortcuts);
    
    questions.value = selected;
    currentQuestionIndex.value = 0;
    correctCount.value = 0;
    wrongCount.value = 0;
    trainingDetails.value = [];
    trainingPhase.value = 'ready';
    trainingStartTime.value = Date.now();
    questionStartTime.value = 0;
    
    log.i('初始化功能选择训练', category, selected.length);
  }

  /**
   * 开始显示当前题目
   */
  function showCurrentQuestion() {
    trainingPhase.value = 'showing';
    questionStartTime.value = Date.now();
    pressedKeys.value = new Set();
  }

  /**
   * 进入监听按键状态
   */
  function startListening() {
    trainingPhase.value = 'listening';
    pressedKeys.value = new Set();
  }

  /**
   * 添加按下的按键
   */
  function addPressedKey(key: string) {
    pressedKeys.value.add(normalizeKey(key));
  }

  /**
   * 移除松开的按键
   */
  function removePressedKey(key: string) {
    pressedKeys.value.delete(normalizeKey(key));
  }

  /**
   * 清除所有按下的按键
   */
  function clearPressedKeys() {
    pressedKeys.value = new Set();
  }

  /**
   * 检查当前按下的按键是否匹配正确答案
   */
  function checkKeyPress(): boolean {
    const question = currentQuestion.value;
    if (!question) return false;

    const isMatch = matchShortcut(pressedKeys.value, question.keys);
    const responseTime = Date.now() - questionStartTime.value;

    if (isMatch) {
      trainingPhase.value = 'correct';
      correctCount.value++;
    } else {
      trainingPhase.value = 'wrong';
      wrongCount.value++;
    }

    trainingDetails.value.push({
      itemId: question.id,
      correct: isMatch,
      responseTime
    });

    return isMatch;
  }

  /**
   * 检查功能选择答案
   */
  function checkFunctionSelect(selectedId: string): boolean {
    const question = currentQuestion.value;
    if (!question) return false;

    const isCorrect = question.id === selectedId;
    const responseTime = Date.now() - questionStartTime.value;

    if (isCorrect) {
      trainingPhase.value = 'correct';
      correctCount.value++;
    } else {
      trainingPhase.value = 'wrong';
      wrongCount.value++;
    }

    trainingDetails.value.push({
      itemId: question.id,
      correct: isCorrect,
      responseTime
    });

    return isCorrect;
  }

  /**
   * 进入下一题
   */
  function nextQuestion() {
    currentQuestionIndex.value++;
    pressedKeys.value = new Set();
    
    if (currentQuestionIndex.value < questions.value.length) {
      trainingPhase.value = 'showing';
      questionStartTime.value = Date.now();
    } else {
      trainingPhase.value = 'ready';
    }
  }

  /**
   * 生成反向训练的选择题选项
   */
  function generateQuizOptions(): ShortcutItem[] {
    const question = currentQuestion.value;
    if (!question) return [];

    const categoryItems = getShortcutsByCategory(question.category);
    const distractors = generateDistractors(question, categoryItems, 3);
    return shuffleArray([question, ...distractors]);
  }

  /**
   * 保存训练结果
   */
  async function saveTrainingResult(mode: 'keyPress' | 'functionSelect') {
    const duration = Math.round((Date.now() - trainingStartTime.value) / 1000);
    
    const record: Omit<ShortcutTrainingRecord, '_id'> = {
      type: 'shortcut_training_record',
      category: currentCategory.value,
      mode,
      totalQuestions: questions.value.length,
      correctAnswers: correctCount.value,
      duration,
      details: trainingDetails.value,
      createdAt: Date.now()
    };

    const result = await saveTrainingRecord(record);
    
    // 更新学习进度
    const masteredIds = trainingDetails.value
      .filter(d => d.correct)
      .map(d => d.itemId);
    
    if (masteredIds.length > 0) {
      await saveLearningProgress(currentCategory.value, masteredIds);
    }

    return result;
  }

  /**
   * 获取某分类的学习进度
   */
  function getCategoryProgress(category: string): number {
    const progress = getLearningProgress(category);
    const total = getShortcutsByCategory(category).length;
    if (!progress || total === 0) return 0;
    return Math.round((progress.masteredItemIds.length / total) * 100);
  }

  /**
   * 获取某分类已掌握的快捷键ID列表
   */
  function getMasteredIds(category: string): string[] {
    const progress = getLearningProgress(category);
    return progress?.masteredItemIds || [];
  }

  /**
   * 清空某分类的学习进度
   */
  async function clearCategoryProgress(category: string) {
    return await clearLearningProgress(category);
  }

  /**
   * 获取训练历史
   */
  function getTrainingHistory(): ShortcutTrainingRecord[] {
    return getAllTrainingRecords();
  }

  /**
   * 保存自定义快捷键
   */
  async function addCustomShortcut(item: ShortcutItem) {
    const result = await saveCustomShortcut(item);
    if (result.ok) {
      // 重新加载数据
      await loadAllShortcuts();
      // 如果当前正在查看该分类，刷新列表
      if (currentCategory.value) {
        selectCategory(currentCategory.value);
      }
      // 刷新分类
      categories.value = getCategories();
    }
    return result;
  }

  /**
   * 删除自定义快捷键
   */
  async function deleteCustomShortcut(id: string) {
    const result = removeCustomShortcut(id);
    if (result.ok) {
      await loadAllShortcuts();
      if (currentCategory.value) {
        selectCategory(currentCategory.value);
      }
      categories.value = getCategories();
    }
    return result;
  }

  /**
   * 添加自定义分类
   */
  async function addCustomCategory(
    name: string,
    description: string,
    icon: string,
    sourceItems?: ShortcutItem[]
  ) {
    const result = await saveCustomCategory({ name, description, icon });
    if (!result.ok) return result;

    // 如果有源数据，复制为自定义快捷键
    if (sourceItems && sourceItems.length > 0) {
      for (const item of sourceItems) {
        const newItem: ShortcutItem = {
          ...item,
          id: 'custom-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
          category: name
        };
        await saveCustomShortcut(newItem);
      }
    }

    await loadAllShortcuts();
    categories.value = getCategories();
    return result;
  }

  /**
   * 重命名自定义分类
   */
  async function renameCustomCategory(oldName: string, newName: string) {
    // 获取旧分类
    const { getAllCustomCategories } = await import('@/utils/shortcut-memory-db');
    const allCats = getAllCustomCategories();
    const oldCat = allCats.find(c => c.name === oldName);
    if (!oldCat) return { ok: false, error: true, message: '分类不存在', id: '', rev: '' };

    // 保存新分类（旧分类保留 _id 改名）
    const result = await saveCustomCategory({
      _id: oldCat._id,
      name: newName,
      description: oldCat.description,
      icon: oldCat.icon
    });
    if (!result.ok) return result;

    // 更新该分类下所有快捷键的 category
    const shortcuts = getShortcutsByCategory(oldName);
    for (const item of shortcuts) {
      if (item.id.startsWith('custom-')) {
        await updateCustomShortcut({ ...item, category: newName });
      }
    }

    await loadAllShortcuts();
    if (currentCategory.value === oldName) {
      currentCategory.value = newName;
    }
    categories.value = getCategories();
    selectCategory(currentCategory.value || newName);
    return result;
  }

  /**
   * 删除自定义分类
   */
  async function deleteCustomCategory(name: string) {
    const result = removeCustomCategory(name);
    if (result.ok) {
      await loadAllShortcuts();
      if (currentCategory.value === name) {
        currentCategory.value = '';
        currentShortcuts.value = [];
      }
      categories.value = getCategories();
    }
    return result;
  }

  /**
   * 更新自定义分类（描述、图标）
   */
  async function updateCustomCategory(
    _id: string,
    name: string,
    description: string,
    icon: string
  ) {
    const result = await saveCustomCategory({ _id, name, description, icon });
    if (result.ok) {
      await loadAllShortcuts();
      categories.value = getCategories();
    }
    return result;
  }

  /**
   * 更新自定义快捷键
   */
  async function updateCustomShortcutItem(item: ShortcutItem) {
    const result = await updateCustomShortcut(item);
    if (result.ok) {
      await loadAllShortcuts();
      if (currentCategory.value) {
        selectCategory(currentCategory.value);
      }
    }
    return result;
  }

  // 初始化
  loadCategories();

  return {
    // State
    categories,
    currentCategory,
    currentShortcuts,
    isLoading,
    trainingPhase,
    currentQuestionIndex,
    questions,
    pressedKeys,
    correctCount,
    wrongCount,
    trainingStartTime,
    trainingDetails,
    
    // Getters
    currentCategoryShortcuts,
    currentShortcutCount,
    progress,
    currentQuestion,
    isTrainingComplete,
    
    // Actions
    loadCategories,
    selectCategory,
    getFormattedKeys,
    initKeyPressTraining,
    initFunctionSelectTraining,
    showCurrentQuestion,
    startListening,
    addPressedKey,
    removePressedKey,
    clearPressedKeys,
    checkKeyPress,
    checkFunctionSelect,
    nextQuestion,
    generateQuizOptions,
    saveTrainingResult,
    getCategoryProgress,
    getMasteredIds,
    clearCategoryProgress,
    getTrainingHistory,
    addCustomShortcut,
    deleteCustomShortcut,
    addCustomCategory,
    renameCustomCategory,
    deleteCustomCategory,
    updateCustomCategory,
    updateCustomShortcutItem,
    isCustomCategory
  };
});
