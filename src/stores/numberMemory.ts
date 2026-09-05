import { ref, computed } from "vue";
import { defineStore } from "pinia";
import type {
  NumberImageAssociation,
  TrainingResult,
  NumberMemoryEntry,
  NumberMemoryKind,
  NumberMemoryNote,
  NumberMemoryPrompt
} from "@/types/number-memory";
import {
  getAllAssociations,
  getAssociationByNumber,
  saveAssociation,
  removeAssociation,
  saveTrainingResult,
  getAllTrainingResults
} from "@/utils/number-memory-db";
import {
  getRecommendedImages,
  getNumberKeyword,
  getRandomNumbers,
  shuffleArray
} from "@/utils/number-memory-preset";
import { log } from "@/utils/logger";
import {
  getAllEntries,
  createEntry,
  updateEntry,
  deleteEntry,
  getNotesByEntryId,
  createNote,
  updateNote,
  deleteNote,
  getPromptsByEntryId,
  createPrompt,
  updatePrompt,
  deletePrompt,
  reorderPrompts
} from "@/utils/number-memory-entries-db";
import {DEFAULT_LEVEL, getEntryLevel, isDue, isRemembered, markCorrect, markWrong} from "@/utils/number-memory-srs";
import {useWordsStore} from "@/stores/words";

export const useNumberMemoryStore = defineStore("numberMemory", () => {
  // State
  const associations = ref<NumberImageAssociation[]>([]);
  const isLoading = ref(false);
  
  // 数字记忆条目相关
  const entries = ref<NumberMemoryEntry[]>([]);
  const currentEntry = ref<NumberMemoryEntry | null>(null);
  const currentNotes = ref<NumberMemoryNote[]>([]);
  const currentPrompts = ref<NumberMemoryPrompt[]>([]);
  const entriesLoading = ref(false);

  // Getters
  const associationCount = computed(() => associations.value.length);
  
  const hasAssociations = computed(() => associations.value.length > 0);
  
  const getAssociation = (number: string) => {
    return associations.value.find(a => a.number === number);
  };
  
  const hasAssociation = (number: string) => {
    return associations.value.some(a => a.number === number);
  };
  
  // 条目相关 getters
  const sortedEntries = computed(() => {
    return [...entries.value].sort((a, b) => b.createdAt - a.createdAt);
  });
  
  const allTags = computed(() => {
    const tagSet = new Set<string>();
    entries.value.forEach(entry => {
      entry.tags.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  });

  const dueEntries = computed(() => {
    const now = Date.now();
    return entries.value.filter(entry => isDue(entry, now));
  });

  const rememberedCount = computed(() => {
    return entries.value.filter(entry => isRemembered(entry)).length;
  });

  // Actions
  /**
   * 加载所有数字-图片关联
   */
  function loadAssociations() {
    isLoading.value = true;
    try {
      associations.value = getAllAssociations();
      log.i('加载数字记忆关联', associations.value.length);
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * 添加或更新数字-图片关联
   */
  async function addAssociation(number: string, imageUrl: string, source: 'upload' | 'preset', description?: string) {
    const association: NumberImageAssociation = {
      number,
      imageUrl,
      source,
      description
    };
    
    const result = await saveAssociation(association);
    if (result.ok) {
      loadAssociations();
    }
    return result;
  }

  /**
   * 删除数字-图片关联
   */
  async function deleteAssociation(number: string) {
    const result = await removeAssociation(number);
    if (result.ok) {
      loadAssociations();
    }
    return result;
  }

  /**
   * 获取数字的推荐图片
   */
  function getRecommendations(number: string) {
    const num = parseInt(number, 10);
    return getRecommendedImages(num);
  }

  /**
   * 获取数字关键词
   */
  function getKeyword(number: string) {
    const num = parseInt(number, 10);
    return getNumberKeyword(num);
  }

  /**
   * 生成数字→图片测试题目
   * @param count 题目数量
   */
  function generateNumberToImageQuiz(count: number = 5) {
    if (associations.value.length === 0) {
      return [];
    }
    
    // 随机选择已保存的数字
    const shuffled = shuffleArray(associations.value);
    const selected = shuffled.slice(0, Math.min(count, shuffled.length));
    
    return selected.map(correct => {
      // 生成干扰项（其他数字的图片）。预设中多个数字可能共用同一 emoji，
      // 需排除与正确答案相同的图片并按 imageUrl 去重，避免出现"选谁都判对"的重复选项；
      // 去重后不足 3 个时允许选项少于 4 个
      const seen = new Set<string>([correct.imageUrl]);
      const distractors: { number: string; imageUrl: string }[] = [];
      for (const a of shuffleArray(associations.value.filter(x => x.number !== correct.number))) {
        if (seen.has(a.imageUrl)) continue;
        seen.add(a.imageUrl);
        distractors.push({ number: a.number, imageUrl: a.imageUrl });
        if (distractors.length >= 3) break;
      }
      const options = shuffleArray([...distractors, { number: correct.number, imageUrl: correct.imageUrl }]);

      return {
        question: correct.number,
        correctAnswer: correct.imageUrl,
        options: options.map(o => o.imageUrl)
      };
    });
  }

  /**
   * 生成图片→数字测试题目
   * @param count 题目数量
   */
  function generateImageToNumberQuiz(count: number = 5) {
    if (associations.value.length === 0) {
      return [];
    }
    
    // 随机选择已保存的数字
    const shuffled = shuffleArray(associations.value);
    const selected = shuffled.slice(0, Math.min(count, shuffled.length));
    
    return selected.map(correct => {
      // 生成干扰项（其他数字）
      const otherNumbers = associations.value
        .filter(a => a.number !== correct.number)
        .map(a => a.number);
      
      const distractors = shuffleArray(otherNumbers).slice(0, 3);
      const options = shuffleArray([...distractors, correct.number]);
      
      return {
        question: correct.imageUrl,
        correctAnswer: correct.number,
        options
      };
    });
  }

  /**
   * 保存训练结果
   */
  async function saveResult(
    mode: TrainingResult['mode'],
    totalQuestions: number,
    correctAnswers: number,
    duration: number,
    details: { number: string; correct: boolean; responseTime: number }[]
  ) {
    const result: Omit<TrainingResult, '_id'> = {
      type: 'number_memory_result',
      mode,
      totalQuestions,
      correctAnswers,
      duration,
      details,
      createdAt: Date.now()
    };
    
    return await saveTrainingResult(result);
  }

  /**
   * 获取训练历史
   */
  function getTrainingHistory() {
    return getAllTrainingResults();
  }

  /**
   * 获取随机数字（用于练习）
   * @param count 数量
   * @param range 范围: 'single' (0-9), 'double' (10-99), 'all' (0-99), 默认 'all'
   */
  function getRandomPresetNumbers(count: number, range: 'single' | 'double' | 'all' = 'all') {
    return getRandomNumbers(count, range);
  }

  // ========== 数字记忆条目相关 Actions ==========
  
  /**
   * 加载所有条目
   */
  async function loadEntries() {
    entriesLoading.value = true;
    try {
      entries.value = getAllEntries();
      log.i('加载数字记忆条目', entries.value.length);
    } finally {
      entriesLoading.value = false;
    }
  }
  
  /**
   * 添加条目
   */
  async function addEntry(
    title: string,
    numbers: string,
    tags: string[] = [],
    description?: string,
    kind?: NumberMemoryKind,
    mnemonic?: string
  ) {
    const result = await createEntry(title, numbers, tags, description, kind, mnemonic);
    if (result.ok && result.doc) {
      entries.value.unshift(result.doc);
    }
    return result;
  }
  
  /**
   * 更新条目
   */
  async function updateEntryItem(entry: NumberMemoryEntry) {
    const result = await updateEntry(entry);
    if (result.ok) {
      const index = entries.value.findIndex(e => e._id === entry._id);
      if (index >= 0) {
        entries.value[index] = entry;
      }
    }
    return result;
  }
  
  /**
   * 删除条目
   */
  async function deleteEntryItem(id: string) {
    const result = await deleteEntry(id);
    if (result.ok) {
      entries.value = entries.value.filter(e => e._id !== id);
      if (currentEntry.value?._id === id) {
        currentEntry.value = null;
      }
    }
    return result;
  }
  
  /**
   * 设置当前条目
   */
  function setCurrentEntry(entry: NumberMemoryEntry | null) {
    currentEntry.value = entry;
  }
  
  /**
   * 更新复习次数
   */
  async function updateReviewCount(entryId: string) {
    const entry = entries.value.find(e => e._id === entryId);
    if (entry) {
      entry.reviewCount++;
      entry.lastReviewTime = Date.now();
      return await updateEntry(entry);
    }
    return { ok: false };
  }
  
  /**
   * 标记条目答对（窗口内升级；未到期或超窗也刷新 learnDate 并写库）
   */
  async function markEntryCorrect(entryId: string) {
    const entry = entries.value.find(e => e._id === entryId);
    if (!entry) return {ok: false};
    const wordsStore = useWordsStore();
    const firmness = wordsStore.memoryFirmness ?? '正常';
    const updated = markCorrect(entry, Date.now(), firmness);
    const result = await updateEntry(updated);
    if (result.ok) {
      const index = entries.value.findIndex(e => e._id === entryId);
      if (index >= 0) {
        entries.value[index] = updated;
      }
    }
    return {...result, entry: updated};
  }

  /**
   * 标记条目答错（降级）
   */
  async function markEntryWrong(entryId: string) {
    const entry = entries.value.find(e => e._id === entryId);
    if (!entry) return {ok: false};
    const updated = markWrong(entry);
    const result = await updateEntry(updated);
    if (result.ok) {
      const index = entries.value.findIndex(e => e._id === entryId);
      if (index >= 0) {
        entries.value[index] = updated;
      }
    }
    return {...result, entry: updated};
  }

  /**
   * 获取条目当前等级
   */
  function getEntryLevelById(entryId: string): number {
    const entry = entries.value.find(e => e._id === entryId);
    return entry ? getEntryLevel(entry) : DEFAULT_LEVEL;
  }

  /**
   * 加载条目的笔记
   */
  async function loadNotes(entryId: string) {
    currentNotes.value = getNotesByEntryId(entryId);
  }
  
  /**
   * 添加笔记
   */
  async function addNote(note: Omit<NumberMemoryNote, '_id' | 'type' | 'createdAt'>) {
    const result = await createNote(note.entryId, note.content);
    if (result.ok && result.doc) {
      currentNotes.value.unshift(result.doc);
    }
    return result;
  }
  
  /**
   * 更新笔记
   */
  async function updateNoteItem(note: NumberMemoryNote) {
    const result = await updateNote(note);
    if (result.ok) {
      const index = currentNotes.value.findIndex(n => n._id === note._id);
      if (index >= 0) {
        currentNotes.value[index] = note;
      }
    }
    return result;
  }
  
  /**
   * 删除笔记
   */
  async function deleteNoteItem(id: string) {
    const result = await deleteNote(id);
    if (result.ok) {
      currentNotes.value = currentNotes.value.filter(n => n._id !== id);
    }
    return result;
  }
  
  /**
   * 加载条目的提示词
   */
  async function loadPrompts(entryId: string) {
    currentPrompts.value = getPromptsByEntryId(entryId);
  }
  
  /**
   * 添加提示词
   */
  async function addPrompt(prompt: Omit<NumberMemoryPrompt, '_id' | 'type' | 'createdAt'>) {
    const result = await createPrompt(
      prompt.entryId, 
      prompt.title, 
      prompt.content, 
      prompt.order,
      prompt.enabled
    );
    if (result.ok && result.doc) {
      currentPrompts.value.push(result.doc);
    }
    return result;
  }
  
  /**
   * 更新提示词
   */
  async function updatePromptItem(prompt: NumberMemoryPrompt) {
    const result = await updatePrompt(prompt);
    if (result.ok) {
      const index = currentPrompts.value.findIndex(p => p._id === prompt._id);
      if (index >= 0) {
        currentPrompts.value[index] = prompt;
      }
    }
    return result;
  }
  
  /**
   * 删除提示词
   */
  async function deletePromptItem(id: string) {
    const result = await deletePrompt(id);
    if (result.ok) {
      currentPrompts.value = currentPrompts.value.filter(p => p._id !== id);
    }
    return result;
  }
  
  /**
   * 重新排序提示词
   */
  async function reorderPromptsList(prompts: NumberMemoryPrompt[]) {
    const success = await reorderPrompts(prompts);
    if (success) {
      currentPrompts.value = [...prompts];
    }
    return success;
  }

  // 初始化时加载数据
  loadAssociations();

  return {
    associations,
    isLoading,
    associationCount,
    hasAssociations,
    getAssociation,
    hasAssociation,
    loadAssociations,
    addAssociation,
    deleteAssociation,
    getRecommendations,
    getKeyword,
    generateNumberToImageQuiz,
    generateImageToNumberQuiz,
    saveResult,
    getTrainingHistory,
    getRandomPresetNumbers,
    // 条目相关
    entries,
    currentEntry,
    currentNotes,
    currentPrompts,
    entriesLoading,
    sortedEntries,
    allTags,
    dueEntries,
    rememberedCount,
    loadEntries,
    addEntry,
    updateEntryItem,
    deleteEntryItem,
    setCurrentEntry,
    updateReviewCount,
    markEntryCorrect,
    markEntryWrong,
    getEntryLevelById,
    // 笔记相关
    loadNotes,
    addNote,
    updateNoteItem,
    deleteNoteItem,
    // 提示词相关
    loadPrompts,
    addPrompt,
    updatePromptItem,
    deletePromptItem,
    reorderPromptsList
  };
});
