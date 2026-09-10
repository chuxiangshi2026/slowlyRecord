/**
 * 数字桩默认推荐（0-99），谐音/象形联想，供"一键填充"后逐格修改。
 * 覆盖前 30 个高频数字，其余留空由用户自定义。
 */
export const DEFAULT_PEG_SUGGESTIONS: Record<string, string> = {
  '00': '望远镜（两个圆）',
  '01': '小树（0 是土，1 是苗）',
  '02': '铃儿（02 像 02 分，铃声）',
  '03': '耳朵（3 像耳朵）',
  '04': '小旗（4 像旗子）',
  '05': '手套（5 个指头）',
  '06': '勺子（6 像勺子）',
  '07': '锄头（7 像锄头）',
  '08': '眼镜（8 像眼镜）',
  '09': '气球（9 像气球）',
  '0': '鸡蛋（0 像鸡蛋）',
  '1': '蜡烛（1 像蜡烛）',
  '2': '鸭子（2 像鸭子）',
  '3': '耳朵（3 像耳朵）',
  '4': '帆船（4 像帆船）',
  '5': '秤钩（5 像秤钩）',
  '6': '哨子（6 像哨子）',
  '7': '镰刀（7 像镰刀）',
  '8': '雪人（8 像雪人）',
  '9': '蝌蚪（9 像蝌蚪）',
  '10': '棒球（1 是棒，0 是球）',
  '11': '筷子（两根 1）',
  '12': '椅儿（12 谐音）',
  '13': '雨伞（13 谐音）',
  '14': '钥匙（14 谐音）',
  '15': '鹦鹉（15 谐音）',
  '16': '石榴（16 谐音）',
  '17': '仪器（17 谐音）',
  '18': '腰包（18 谐音）',
  '19': '药酒（19 谐音）',
  '20': '耳环（20 谐音）',
}

/** 获取推荐桩描述（无推荐返回空串） */
export function getPegSuggestion(num: string): string {
  return DEFAULT_PEG_SUGGESTIONS[num] || DEFAULT_PEG_SUGGESTIONS[num.replace(/^0/, '')] || ''
}

/** 一键填充：为还没有桩的数字填入推荐描述，返回填充数 */
export function fillDefaultPegs(
  existing: Record<string, { description: string }>,
  fill: (num: string, desc: string) => void,
): number {
  let filled = 0
  for (const [num, desc] of Object.entries(DEFAULT_PEG_SUGGESTIONS)) {
    const key = num.padStart(2, '0')
    if (!existing[key] || !existing[key].description) {
      fill(key, desc)
      filled++
    }
  }
  return filled
}
