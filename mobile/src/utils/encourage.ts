/**
 * 学习完成页的随机鼓励语文案池
 *
 * 各练习模块完成时统一引用，保持「一句鼓励语 + 本轮统计 + 下一步引导」的完成页范式。
 * random 可注入（默认 Math.random），便于测试时得到确定性结果。
 */

const ENCOURAGE_POOL: string[] = [
  '每一分钟的努力，都在悄悄重塑你的大脑。',
  '坚持本身就是最了不起的天赋。',
  '今天的积累，是明天脱口而出的底气。',
  '遗忘不可怕，可怕的是不再开始。你又赢了一次。',
  '大脑就像肌肉，越练越强。刚才那组就是一次漂亮的训练。',
  '不用追求完美，记住「再来一次」就赢了大部分人。',
  '你正在把「看过」变成「记住」，这一步最难也最值钱。',
  '学习是复利游戏，今天的 1% 会在某天变成惊喜。',
  '累了可以慢，但不要停。你走得比想象中远。',
  '刚完成的这一组，就是给未来的自己存的一笔款。',
]

/** 随机取一句鼓励语 */
export function getEncourageText(random: () => number = Math.random): string {
  const idx = Math.min(ENCOURAGE_POOL.length - 1, Math.floor(random() * ENCOURAGE_POOL.length))
  return ENCOURAGE_POOL[idx]
}

/** 鼓励语池（测试用：校验文案基本质量） */
export function getEncouragePool(): readonly string[] {
  return ENCOURAGE_POOL
}
