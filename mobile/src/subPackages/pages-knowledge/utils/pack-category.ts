/**
 * 内置知识包的展示分类映射（供「内置知识库」tab 的分类筛选条使用）
 *
 * 注意：knowledgebanks/*.ts 数据文件由 public/knowledgebanks/*.json 生成、请勿手改，
 * 分类归属单独维护在本文件中。新增内置包时补充对应映射（缺省归入 other/其他）。
 */

/** 展示分类值 */
export type PackDisplayCategory =
  | 'math'      // 数学
  | 'physics'   // 物理
  | 'chemistry' // 化学
  | 'chinese'   // 语文（传统文化/人文常识）
  | 'pegs'      // 记忆桩
  | 'geography' // 地理
  | 'other'     // 其他

/** 分类筛选条选项（顺序即展示顺序） */
export const PACK_CATEGORY_OPTIONS: { value: PackDisplayCategory | 'all'; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'math', label: '数学' },
  { value: 'physics', label: '物理' },
  { value: 'chemistry', label: '化学' },
  { value: 'chinese', label: '语文' },
  { value: 'pegs', label: '记忆桩' },
  { value: 'geography', label: '地理' },
  { value: 'other', label: '其他' },
]

/** 包 id → 展示分类（未列出的 id 一律归入 other） */
const PACK_CATEGORY_MAP: Record<string, PackDisplayCategory> = {
  // 数学
  'multiplication-9x9': 'math',
  'multiplication-19x19': 'math',
  'squares-cubes-powers': 'math',
  'primes-under-100': 'math',
  'math-formulas': 'math',
  'math-formulas-2': 'math',
  'math-calculus': 'math',
  'math-linalg': 'math',
  'math-probability': 'math',

  // 物理
  'physics-formulas': 'physics',
  'physics-laws': 'physics',
  'physics-experiments': 'physics',

  // 化学
  'chemistry-formulas': 'chemistry',
  'elements': 'chemistry',

  // 语文（传统文化/人文常识）
  'solar-terms-24': 'chinese',
  'zodiac-12': 'chinese',
  'earthly-branches-12': 'chinese',
  'ethnic-groups-56': 'chinese',
  'cuisines-8': 'chinese',
  'thirty-six-stratagems': 'chinese',

  // 记忆桩
  'number-pegs-12': 'pegs',
  'body-pegs-12': 'pegs',
  'home-route-12': 'pegs',
  'room-pegs-12': 'pegs',
  'poker-pegs-52': 'pegs',
  'alphabet-pegs-26': 'pegs',

  // 地理
  'provinces-capitals': 'geography',
  'world-capitals-40': 'geography',
  'dynasties-china': 'geography',
  'geography-concepts': 'geography',

  // 其余（colors-12 颜色、musical-notes 音律、constellations-12 星座、
  //       common-units 计量单位、biology-experiments 生物实验）归入 other
}

/** 查询包的展示分类（缺省 other） */
export function getPackDisplayCategory(packId: string): PackDisplayCategory {
  return PACK_CATEGORY_MAP[packId] ?? 'other'
}
