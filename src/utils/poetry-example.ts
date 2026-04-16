/**
 * 诗词库使用示例
 * 展示如何使用 poetry-service 进行各种操作
 */

import type { PoetryDynasty, PoetryItem } from './poetry-service';
import poetryService, {
  fetchPoetryByDynasty,
  fetchAllPoetry,
  searchPoetry,
  getClassicPoetry,
  getRandomPoetry,
  getPoetryStatistics,
  DYNASTY_LIST,
} from './poetry-service';

// ==================== 基础使用示例 ====================

/**
 * 示例1：加载指定朝代的诗词
 */
async function example1_loadByDynasty() {
  console.log('=== 示例1：加载唐诗 ===');
  const tangPoems = await fetchPoetryByDynasty('tang');
  console.log(`加载了 ${tangPoems.length} 首唐诗`);
  console.log('第一首：', tangPoems[0]?.title, '-', tangPoems[0]?.author);
}

/**
 * 示例2：搜索诗词
 */
async function example2_search() {
  console.log('=== 示例2：搜索含"月"的诗词 ===');
  const results = await searchPoetry('月', {
    dynasty: 'tang',  // 只在唐诗中搜索
    isClassic: true,  // 只搜索经典诗词
  });
  console.log(`找到 ${results.length} 首含"月"的唐诗`);
  results.forEach(p => console.log(`- ${p.title} (${p.author})`));
}

/**
 * 示例3：获取经典必背诗词
 */
async function example3_getClassics() {
  console.log('=== 示例3：获取经典必背诗词 ===');
  const classics = await getClassicPoetry();
  console.log(`共有 ${classics.length} 首经典诗词`);

  // 按难度分组
  const byDifficulty = {
    easy: classics.filter(p => p.difficulty === 'easy'),
    medium: classics.filter(p => p.difficulty === 'medium'),
    hard: classics.filter(p => p.difficulty === 'hard'),
  };
  console.log(`简单: ${byDifficulty.easy.length}, 中等: ${byDifficulty.medium.length}, 困难: ${byDifficulty.hard.length}`);
}

/**
 * 示例4：随机获取诗词
 */
async function example4_random() {
  console.log('=== 示例4：随机获取诗词 ===');

  // 随机获取任意朝代
  const random1 = await getRandomPoetry();
  console.log('随机诗词：', random1?.title, '-', random1?.author);

  // 随机获取宋词
  const random2 = await getRandomPoetry('song');
  console.log('随机宋词：', random2?.title, '-', random2?.author);
}

/**
 * 示例5：获取统计信息
 */
async function example5_statistics() {
  console.log('=== 示例5：获取统计信息 ===');
  const stats = await getPoetryStatistics();
  console.log('总诗词数：', stats.total);
  console.log('按朝代分布：', stats.byDynasty);
  console.log('按类型分布：', stats.byType);
}

/**
 * 示例6：加载所有诗词（带进度）
 */
async function example6_loadAll() {
  console.log('=== 示例6：加载所有诗词 ===');
  const allPoetry = await fetchAllPoetry((loaded, total, dynasty) => {
    console.log(`加载进度：${loaded}/${total} - ${dynasty}`);
  });

  // 统计总数
  let totalCount = 0;
  for (const [dynasty, poems] of Object.entries(allPoetry)) {
    console.log(`${dynasty}: ${poems.length} 首`);
    totalCount += poems.length;
  }
  console.log(`总计：${totalCount} 首`);
}

/**
 * 示例7：按标签筛选
 */
async function example7_filterByTags() {
  console.log('=== 示例7：按标签筛选 ===');

  // 获取所有宋词中的豪放派词
  const songPoems = await fetchPoetryByDynasty('song');
  const haofang = songPoems.filter(p => p.tags.includes('豪放派'));
  console.log(`豪放派宋词：${haofang.length} 首`);
  haofang.forEach(p => console.log(`- ${p.title} (${p.author})`));

  // 获取所有必背诗词
  const mustLearn = songPoems.filter(p =>
    p.tags.includes('小学必背') ||
    p.tags.includes('初中必背') ||
    p.tags.includes('高中必背')
  );
  console.log(`必背宋词：${mustLearn.length} 首`);
}

/**
 * 示例8：获取诗词详情
 */
async function example8_getDetail() {
  console.log('=== 示例8：获取诗词详情 ===');
  const poems = await fetchPoetryByDynasty('tang');
  const poem = poems.find(p => p.title === '静夜思');

  if (poem) {
    console.log('标题：', poem.title);
    console.log('作者：', poem.author);
    console.log('朝代：', poem.dynasty);
    console.log('类型：', poem.contentType);
    console.log('标签：', poem.tags.join(', '));
    console.log('字数：', poem.wordCount);
    console.log('是否经典：', poem.isClassic ? '是' : '否');
    console.log('难度：', poem.difficulty);
    console.log('内容：\n', poem.content);

    if (poem.annotation) {
      console.log('注释：', poem.annotation);
    }
    if (poem.translation) {
      console.log('译文：', poem.translation);
    }
    if (poem.appreciation) {
      console.log('赏析：', poem.appreciation);
    }
  }
}

// ==================== 实际应用场景 ====================

/**
 * 场景1：每日推荐
 */
export async function getDailyRecommendation(): Promise<PoetryItem | null> {
  // 优先推荐经典诗词
  const classics = await getClassicPoetry();
  if (classics.length > 0) {
    const today = new Date().getDate();
    return classics[today % classics.length];
  }
  return getRandomPoetry();
}

/**
 * 场景2：学习模式 - 按难度获取诗词
 */
export async function getPoemsForLearning(
  difficulty: 'easy' | 'medium' | 'hard',
  count: number = 5
): Promise<PoetryItem[]> {
  const allPoems = await fetchAllPoetry();
  const filtered = Object.values(allPoems)
    .flat()
    .filter(p => p.difficulty === difficulty && p.isClassic)
    .slice(0, count);
  return filtered;
}

/**
 * 场景3：考试复习 - 获取必背篇目
 */
export async function getMustLearnPoems(
  level: 'primary' | 'junior' | 'senior'
): Promise<PoetryItem[]> {
  const tagMap = {
    primary: '小学必背',
    junior: '初中必背',
    senior: '高中必背',
  };

  const allPoems = await fetchAllPoetry();
  return Object.values(allPoems)
    .flat()
    .filter(p => p.tags.includes(tagMap[level]));
}

/**
 * 场景4：主题搜索
 */
export async function searchByTheme(theme: string): Promise<PoetryItem[]> {
  const themeKeywords: Record<string, string[]> = {
    '春天': ['春', '花', '柳', '燕'],
    '秋天': ['秋', '月', '落叶', '雁'],
    '思乡': ['故乡', '归', '乡愁', '家书'],
    '爱情': ['相思', '情', '恋', '爱'],
    '壮志': ['志', '豪', '壮', '天下'],
  };

  const keywords = themeKeywords[theme] || [theme];
  const allPoems = await fetchAllPoetry();

  return Object.values(allPoems)
    .flat()
    .filter(poem =>
      keywords.some(kw =>
        poem.title.includes(kw) ||
        poem.content.includes(kw) ||
        poem.tags.includes(kw)
      )
    );
}

// ==================== 导出所有示例 ====================

export const poetryExamples = {
  example1_loadByDynasty,
  example2_search,
  example3_getClassics,
  example4_random,
  example5_statistics,
  example6_loadAll,
  example7_filterByTags,
  example8_getDetail,
  getDailyRecommendation,
  getPoemsForLearning,
  getMustLearnPoems,
  searchByTheme,
};

export default poetryExamples;
