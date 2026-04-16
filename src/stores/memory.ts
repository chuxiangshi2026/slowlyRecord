import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export interface TestRecord {
  mode: 'number' | 'word' | 'pattern';
  modeText: string;
  success: boolean;
  result: string;
  time: string;
}

export interface NumberStats {
  correct: number;
  wrong: number;
  maxDifficulty: number;
}

export interface WordStats {
  total: number;
  perfect: number;
  totalCorrect: number;
}

export interface PatternStats {
  correct: number;
  wrong: number;
}

// 测试结论和训练建议
export interface TestConclusion {
  level: 'excellent' | 'good' | 'average' | 'needs_improvement';
  levelText: string;
  summary: string;
  details: string[];
  recommendedTraining: TrainingRecommendation;
}

export interface TrainingRecommendation {
  method: string;
  description: string;
  steps: string[];
  frequency: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export const useMemoryStore = defineStore('memory', () => {
  // ========== State ==========
  const testHistory = ref<TestRecord[]>([]);

  const numberStats = ref<NumberStats>({
    correct: 0,
    wrong: 0,
    maxDifficulty: 4
  });

  const wordStats = ref<WordStats>({
    total: 0,
    perfect: 0,
    totalCorrect: 0
  });

  const patternStats = ref<PatternStats>({
    correct: 0,
    wrong: 0
  });

  // ========== Getters ==========
  const totalTests = computed(() => testHistory.value.length);

  const overallAccuracy = computed(() => {
    const totalCorrect = numberStats.value.correct + patternStats.value.correct + wordStats.value.perfect;
    const totalTests = numberStats.value.correct + numberStats.value.wrong +
                      patternStats.value.correct + patternStats.value.wrong +
                      wordStats.value.total;
    return totalTests === 0 ? 0 : Math.round((totalCorrect / totalTests) * 100);
  });

  // ========== Actions ==========
  function updateNumberStats(isCorrect: boolean, difficulty?: number) {
    if (isCorrect) {
      numberStats.value.correct++;
      if (difficulty && difficulty > numberStats.value.maxDifficulty) {
        numberStats.value.maxDifficulty = difficulty;
      }
    } else {
      numberStats.value.wrong++;
    }
    saveStats();
  }

  function updateWordStats(totalWords: number, correctCount: number) {
    wordStats.value.total++;
    wordStats.value.totalCorrect += correctCount;
    if (correctCount === totalWords) {
      wordStats.value.perfect++;
    }
    saveStats();
  }

  function updatePatternStats(isCorrect: boolean) {
    if (isCorrect) {
      patternStats.value.correct++;
    } else {
      patternStats.value.wrong++;
    }
    saveStats();
  }

  function addHistory(record: TestRecord) {
    testHistory.value.unshift(record);
    // 只保留最近50条记录
    if (testHistory.value.length > 50) {
      testHistory.value = testHistory.value.slice(0, 50);
    }
    saveHistory();
  }

  function saveStats() {
    try {
      const stats = {
        number: numberStats.value,
        word: wordStats.value,
        pattern: patternStats.value
      };
      localStorage.setItem('memoryTest_stats', JSON.stringify(stats));
    } catch (e) {
      console.error('保存统计数据失败:', e);
    }
  }

  function saveHistory() {
    try {
      localStorage.setItem('memoryTest_history', JSON.stringify(testHistory.value));
    } catch (e) {
      console.error('保存历史记录失败:', e);
    }
  }

  function loadStats() {
    try {
      const statsJson = localStorage.getItem('memoryTest_stats');
      if (statsJson) {
        const stats = JSON.parse(statsJson);
        if (stats.number) numberStats.value = { ...numberStats.value, ...stats.number };
        if (stats.word) wordStats.value = { ...wordStats.value, ...stats.word };
        if (stats.pattern) patternStats.value = { ...patternStats.value, ...stats.pattern };
      }
    } catch (e) {
      console.error('加载统计数据失败:', e);
    }
  }

  function loadHistory() {
    try {
      const historyJson = localStorage.getItem('memoryTest_history');
      if (historyJson) {
        testHistory.value = JSON.parse(historyJson);
      }
    } catch (e) {
      console.error('加载历史记录失败:', e);
    }
  }

  function clearAllData() {
    testHistory.value = [];
    numberStats.value = { correct: 0, wrong: 0, maxDifficulty: 4 };
    wordStats.value = { total: 0, perfect: 0, totalCorrect: 0 };
    patternStats.value = { correct: 0, wrong: 0 };
    localStorage.removeItem('memoryTest_stats');
    localStorage.removeItem('memoryTest_history');
  }

  /**
   * 生成测试结论
   * @param mode 测试模式
   * @param maxStage 最高通过轮数
   * @param difficulty 难度
   * @returns 测试结论
   */
  function generateConclusion(
    mode: 'number' | 'word' | 'pattern',
    maxStage: number,
    difficulty: 'easy' | 'medium' | 'hard'
  ): TestConclusion {
    // 根据难度和轮数评定等级
    const baseLevel = difficulty === 'easy' ? 3 : difficulty === 'medium' ? 5 : 7;
    let level: 'excellent' | 'good' | 'average' | 'needs_improvement';
    let levelText: string;

    if (maxStage >= baseLevel + 3) {
      level = 'excellent';
      levelText = '优秀';
    } else if (maxStage >= baseLevel) {
      level = 'good';
      levelText = '良好';
    } else if (maxStage >= Math.max(1, baseLevel - 2)) {
      level = 'average';
      levelText = '一般';
    } else {
      level = 'needs_improvement';
      levelText = '需加强';
    }

    // 生成详细信息
    const details = generateDetails(mode, maxStage, difficulty, level);

    // 生成训练建议
    const recommendedTraining = generateTrainingRecommendation(mode, level);

    return {
      level,
      levelText,
      summary: generateSummary(mode, level, maxStage),
      details,
      recommendedTraining
    };
  }

  /**
   * 生成结论摘要
   */
  function generateSummary(
    mode: 'number' | 'word' | 'pattern',
    level: string,
    maxStage: number
  ): string {
    const modeText = mode === 'number' ? '数字' : mode === 'word' ? '单词' : '图案';
    const summaries: Record<string, Record<string, string>> = {
      excellent: {
        number: '您的数字记忆能力出色，能够轻松记忆较长数字序列，这是超级记忆力的表现！',
        word: '您的单词记忆能力优秀，可以快速记忆多个单词，语言能力很强！',
        pattern: '您的空间记忆和图形记忆能力极佳，对视觉信息的捕捉能力很强！'
      },
      good: {
        number: '您的数字记忆能力良好，能够记住中等长度的数字序列，基础扎实。',
        word: '您的单词记忆能力不错，可以较好地完成单词记忆任务。',
        pattern: '您的图案记忆能力良好，能够较好地完成图形记忆任务。'
      },
      average: {
        number: '您的数字记忆能力一般，通过训练可以记住更长的数字序列。',
        word: '您的单词记忆能力尚可，但还有较大提升空间。',
        pattern: '您的图案记忆能力一般，需要更多练习来提高。'
      },
      needs_improvement: {
        number: '您的数字记忆需要加强，建议从简单的数字串开始练习。',
        word: '您的单词记忆能力需要提升，建议增加词汇量练习。',
        pattern: '您的图案记忆能力较弱，建议多进行视觉记忆训练。'
      }
    };
    return summaries[level]?.[mode] || summaries.average[mode];
  }

  /**
   * 生成详细分析
   */
  function generateDetails(
    mode: 'number' | 'word' | 'pattern',
    maxStage: number,
    difficulty: string,
    level: string
  ): string[] {
    const details: string[] = [];

    if (mode === 'number') {
      const length = (difficulty === 'easy' ? 4 : difficulty === 'medium' ? 6 : 8) + (maxStage - 1) * 2;
      details.push(`最高可记忆 ${Math.max(4, length)} 位数字序列`);
      details.push(`完成 ${maxStage} 轮测试，表现${level === 'excellent' ? '卓越' : level === 'good' ? '良好' : '稳定'}`);
      if (maxStage <= 2) {
        details.push('建议：尝试使用联想记忆法，将数字转化为图像');
      } else if (maxStage >= 5) {
        details.push('可以尝试更难的难度等级或使用宫格记忆法');
      }
    } else if (mode === 'word') {
      const count = (difficulty === 'easy' ? 3 : difficulty === 'medium' ? 5 : 7) + Math.floor((maxStage - 1) / 2);
      details.push(`可同时记忆 ${Math.min(12, count)} 个单词`);
      details.push(`完成 ${maxStage} 轮测试`);
      if (maxStage <= 2) {
        details.push('建议：将单词编成故事或图像来增强记忆');
      } else {
        details.push('可以尝试分类记忆法，将单词按主题分组');
      }
    } else if (mode === 'pattern') {
      const size = difficulty === 'easy' ? 3 : difficulty === 'medium' ? 4 : 5;
      const cells = (difficulty === 'easy' ? 3 : difficulty === 'medium' ? 5 : 7) + Math.floor((maxStage - 1) / 2);
      details.push(`可在 ${size}×${size} 网格中记忆 ${Math.min(size * size - 1, cells)} 个图案位置`);
      details.push(`空间记忆能力${level === 'excellent' ? '很强' : level === 'good' ? '较好' : '有待提升'}`);
      if (maxStage <= 2) {
        details.push('建议：使用轨迹法，将格子按顺序编号记忆');
      }
    }

    return details;
  }

  /**
   * 生成训练建议
   */
  function generateTrainingRecommendation(
    mode: 'number' | 'word' | 'pattern',
    level: string
  ): TrainingRecommendation {
    const recommendations: Record<string, Record<string, TrainingRecommendation>> = {
      number: {
        excellent: {
          method: '高级记忆宫殿法',
          description: '使用记忆宫殿技术，将长数字串转化为生动的空间场景',
          steps: [
            '构建自己的记忆宫殿（熟悉的建筑或房间）',
            '将数字00-99转化为固定的图像编码',
            '将数字图像放置在记忆宫殿的不同位置',
            '尝试记忆50位以上的数字序列',
            '每天练习30分钟，挑战更长序列'
          ],
          frequency: '每天30分钟',
          difficulty: 'hard'
        },
        good: {
          method: '数字编码法',
          description: '使用谐音和形状编码，将数字转化为容易记忆的图像',
          steps: [
            '学习0-9的基本数字编码（如1像树，2像鹅）',
            '练习将数字两两组合形成图像',
            '使用故事法将图像串联起来',
            '从10位数字开始，逐步增加到20位',
            '每天练习15-20分钟'
          ],
          frequency: '每天20分钟',
          difficulty: 'medium'
        },
        average: {
          method: '分组记忆法',
          description: '将长数字分成小组，分别记忆后再组合',
          steps: [
            '将数字每3-4位分成一组（如手机号记忆法）',
            '为每组数字找规律或联想',
            '先记住各组的顺序',
            '反复默念和回想',
            '从6位数字开始，逐步增加'
          ],
          frequency: '每天15分钟',
          difficulty: 'easy'
        },
        needs_improvement: {
          method: '基础数字记忆训练',
          description: '从简单的数字串开始，建立记忆信心',
          steps: [
            '从3-4位数字开始练习',
            '大声朗读数字3遍',
            '闭眼回想，尝试复述',
            '错误则重来，正确则增加1位',
            '记录每天能记住的最长数字'
          ],
          frequency: '每天10分钟',
          difficulty: 'easy'
        }
      },
      word: {
        excellent: {
          method: '主题联想记忆法',
          description: '将单词按主题分类，构建知识网络',
          steps: [
            '选择感兴趣的英语文章阅读',
            '将生词按主题整理成思维导图',
            '利用词根词缀批量记忆单词',
            '尝试记忆15个以上的单词序列',
            '定期复习，扩大词汇量'
          ],
          frequency: '每天40分钟',
          difficulty: 'hard'
        },
        good: {
          method: '图像联想法',
          description: '将单词转化为图像，用视觉记忆强化',
          steps: [
            '为每个单词构思一个生动的画面',
            '将多个单词的画面编成小故事',
            '使用闪卡进行间隔重复记忆',
            '每周学习50-100个新单词',
            '在语境中理解和使用单词'
          ],
          frequency: '每天30分钟',
          difficulty: 'medium'
        },
        average: {
          method: '重复朗读法',
          description: '通过多次重复和朗读加深记忆',
          steps: [
            '每次选择5-8个单词',
            '大声朗读单词和例句',
            '抄写单词2-3遍',
            '遮住单词尝试回忆',
            '每30分钟复习一次'
          ],
          frequency: '每天20分钟',
          difficulty: 'easy'
        },
        needs_improvement: {
          method: '基础单词积累',
          description: '从高频单词开始，逐步建立词汇基础',
          steps: [
            '从最常用的100个单词开始',
            '每天学习5个新单词',
            '制作单词卡片随时查看',
            '用单词造简单句子',
            '睡前复习当天所学'
          ],
          frequency: '每天15分钟',
          difficulty: 'easy'
        }
      },
      pattern: {
        excellent: {
          method: '复杂空间记忆训练',
          description: '挑战更复杂的空间模式和多维记忆',
          steps: [
            '使用5×5或更大的网格',
            '尝试记忆复杂的图案组合',
            '结合数字和图案进行双重记忆',
            '训练3D空间想象能力',
            '玩魔方、拼图等空间游戏'
          ],
          frequency: '每天25分钟',
          difficulty: 'hard'
        },
        good: {
          method: '轨迹记忆法',
          description: '为网格中的位置建立固定的轨迹顺序',
          steps: [
            '将网格格子按"Z"字形或"回"字形编号',
            '记住每个编号的轨迹位置',
            '按轨迹顺序回忆图案位置',
            '尝试4×4网格的记忆',
            '逐渐减少回忆时间'
          ],
          frequency: '每天20分钟',
          difficulty: 'medium'
        },
        average: {
          method: '分区记忆法',
          description: '将网格分区，逐个区域记忆',
          steps: [
            '将3×3网格分成3个区域',
            '先记忆第一个区域的图案',
            '再记忆第二、第三个区域',
            '最后整体回忆',
            '逐步增加每个区域的图案数量'
          ],
          frequency: '每天15分钟',
          difficulty: 'easy'
        },
        needs_improvement: {
          method: '基础视觉记忆训练',
          description: '从简单的视觉记忆开始',
          steps: [
            '从2-3个图案开始练习',
            '仔细观察每个图案的位置',
            '闭眼回想图案分布',
            '用手指指出图案位置',
            '使用九宫格键盘辅助记忆'
          ],
          frequency: '每天10分钟',
          difficulty: 'easy'
        }
      }
    };

    return recommendations[mode]?.[level] || recommendations[mode].average;
  }

  // 初始化时加载数据
  loadStats();
  loadHistory();

  return {
    // state
    testHistory,
    numberStats,
    wordStats,
    patternStats,
    // getters
    totalTests,
    overallAccuracy,
    // actions
    updateNumberStats,
    updateWordStats,
    updatePatternStats,
    addHistory,
    loadStats,
    loadHistory,
    clearAllData,
    generateConclusion
  };
});
