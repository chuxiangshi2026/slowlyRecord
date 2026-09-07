import { ref, computed } from "vue";
import { defineStore } from "pinia";
import type { LetterImageAssociation } from "@/types/letter-memory";
import {
  getAllAssociations,
  saveAssociation,
  removeAssociation,
} from "@/utils/letter-memory-db";
import {getActiveLanguage} from '@/utils/language/profiles';
import {
  getRecommendedImages,
  getLetterKeyword,
  shuffleArray,
  getAlphabetLetters,
  getComboLetters,
} from "@/utils/letter-memory-preset";
import { log } from "@/utils/logger";

export const useLetterMemoryStore = defineStore("letterMemory", () => {
  // State
  const associations = ref<LetterImageAssociation[]>([]);
  const isLoading = ref(false);

  // Getters
  const associationCount = computed(() => associations.value.length);

  const hasAssociations = computed(() => associations.value.length > 0);

  const getAssociation = (letter: string) => {
    return associations.value.find(a => a.letter === letter);
  };

  const hasAssociation = (letter: string) => {
    return associations.value.some(a => a.letter === letter);
  };

  // 字母列表
  const alphabetLetters = computed(() => getAlphabetLetters(getActiveLanguage()));
  const comboLetters = computed(() => getComboLetters());

  // 统计已映射的字母数
  const mappedLetterCount = computed(() => {
    return associations.value.filter(a => a.letter.length === 1).length;
  });

  const mappedComboCount = computed(() => {
    return associations.value.filter(a => a.letter.length > 1).length;
  });

  // Actions
  /**
   * 加载所有字母-图片关联
   */
  function loadAssociations() {
    isLoading.value = true;
    try {
      associations.value = getAllAssociations();
      log.i('加载字母映射关联', associations.value.length);
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * 添加或更新字母-图片关联（唯一校验：同一字母不允许重复添加，更新需先删除）
   */
  async function addAssociation(letter: string, imageUrl: string, source: 'upload' | 'preset' | 'emoji', description?: string) {
    // 唯一校验：如果已存在该字母的映射，返回错误
    const existing = associations.value.find(a => a.letter === letter);
    if (existing) {
      return { ok: false, error: 'duplicate', message: `字母 ${letter.toUpperCase()} 已存在映射，请先删除后再添加` };
    }

    const association: LetterImageAssociation = {
      letter,
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
   * 删除字母-图片关联
   */
  async function deleteAssociation(letter: string) {
    const result = await removeAssociation(letter);
    if (result.ok) {
      loadAssociations();
    }
    return result;
  }

  /**
   * 获取字母的推荐图片
   */
  function getRecommendations(letter: string) {
    return getRecommendedImages(letter);
  }

  /**
   * 获取字母关键词
   */
  function getKeyword(letter: string) {
    return getLetterKeyword(letter);
  }

  /**
   * 生成字母→图片测试题目
   */
  function generateLetterToImageQuiz(count: number = 5) {
    if (associations.value.length === 0) return [];

    const shuffled = shuffleArray(associations.value);
    const selected = shuffled.slice(0, Math.min(count, shuffled.length));

    return selected.map(correct => {
      const otherImages = associations.value
        .filter(a => a.letter !== correct.letter)
        .map(a => ({ letter: a.letter, imageUrl: a.imageUrl }));

      const distractors = shuffleArray(otherImages).slice(0, 3);
      const options = shuffleArray([...distractors, { letter: correct.letter, imageUrl: correct.imageUrl }]);

      return {
        question: correct.letter,
        correctAnswer: correct.imageUrl,
        options: options.map(o => o.imageUrl)
      };
    });
  }

  /**
   * 生成图片→字母测试题目
   */
  function generateImageToLetterQuiz(count: number = 5) {
    if (associations.value.length === 0) return [];

    const shuffled = shuffleArray(associations.value);
    const selected = shuffled.slice(0, Math.min(count, shuffled.length));

    return selected.map(correct => {
      const otherLetters = associations.value
        .filter(a => a.letter !== correct.letter)
        .map(a => a.letter);

      const distractors = shuffleArray(otherLetters).slice(0, 3);
      const options = shuffleArray([...distractors, correct.letter]);

      return {
        question: correct.imageUrl,
        correctAnswer: correct.letter,
        options
      };
    });
  }

  /**
   * 批量导入预设（跳过已存在的映射）
   */
  async function batchImportPresets(letters?: string[]) {
    const targets = letters || getAlphabetLetters(getActiveLanguage());
    let importedCount = 0;

    for (const letter of targets) {
      // 跳过已存在映射的字母
      if (associations.value.some(a => a.letter === letter)) continue;

      const recommendations = getRecommendedImages(letter);
      if (recommendations.length > 0) {
        const first = recommendations[0];
        const result = await addAssociation(letter, first.url, "preset", first.description);
        if (result.ok) {
          importedCount++;
        }
      }
    }

    return importedCount;
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
    alphabetLetters,
    comboLetters,
    mappedLetterCount,
    mappedComboCount,
    loadAssociations,
    addAssociation,
    deleteAssociation,
    getRecommendations,
    getKeyword,
    generateLetterToImageQuiz,
    generateImageToLetterQuiz,
    batchImportPresets,
  };
});
