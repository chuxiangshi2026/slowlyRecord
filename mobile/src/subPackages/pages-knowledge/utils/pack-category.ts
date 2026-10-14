/**
 * 内置知识包的展示分类映射（供「内置知识库」tab 的分类筛选条使用）
 *
 * 注意：knowledgebanks/*.ts 数据文件由 public/knowledgebanks/*.json 生成、请勿手改，
 * 展示分类（桩库/数理化/文史常识/地理）单独维护在本文件，与桌面端 KnowledgeMemory 的四个 tab 保持一致。
 * 新增内置包时补充对应映射（缺省归入 liberal/文史常识）。
 */

/** 展示分类值 */
export type PackDisplayCategory =
  | 'pegs'     // 桩库（usableAsPeg 的包，跨 math/text/geo 大类）
  | 'science'  // 数理化（数学/物理/化学/生物/计量单位）
  | 'liberal'  // 文史常识（语文/传统文化/百科常识）
  | 'geo'      // 地理（中国/世界地理常识、行政区与首都等）

/** 分类筛选条选项（顺序即展示顺序） */
export const PACK_CATEGORY_OPTIONS: { value: PackDisplayCategory | 'all'; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'pegs', label: '桩库' },
  { value: 'science', label: '数理化' },
  { value: 'liberal', label: '文史常识' },
  { value: 'geo', label: '地理' },
]

/** 包 id → 展示分类（未列出的 id 一律归入 liberal/文史常识） */
const PACK_CATEGORY_MAP: Record<string, PackDisplayCategory> = {
  // 桩库：6 个命名桩包 + 注册表中 usableAsPeg=true 的有序常识包
  'number-pegs-12': 'pegs',
  'body-pegs-12': 'pegs',
  'home-route-12': 'pegs',
  'room-pegs-12': 'pegs',
  'poker-pegs-52': 'pegs',
  'alphabet-pegs-26': 'pegs',
  'solar-terms-24': 'pegs',
  'zodiac-12': 'pegs',
  'earthly-branches-12': 'pegs',
  'dynasties-china': 'pegs',
  'musical-notes': 'pegs',
  'constellations-12': 'pegs',
  // 小容量桩库（2-11 桩）
  'yin-yang-2': 'pegs',
  'tian-di-2': 'pegs',
  'day-night-2': 'pegs',
  'left-right-2': 'pegs',
  'up-down-2': 'pegs',
  'san-cai-3': 'pegs',
  'san-guang-3': 'pegs',
  'three-tenses-3': 'pegs',
  'three-primary-colors-3': 'pegs',
  'meng-zhong-ji-3': 'pegs',
  'four-seasons-4': 'pegs',
  'four-directions-4': 'pegs',
  'four-symbols-4': 'pegs',
  'four-gentlemen-4': 'pegs',
  'four-arts-4': 'pegs',
  'four-elements-4': 'pegs',
  'wuxing-5': 'pegs',
  'five-directions-5': 'pegs',
  'five-colors-5': 'pegs',
  'five-flavors-5': 'pegs',
  'five-virtues-5': 'pegs',
  'five-tones-5': 'pegs',
  'six-arts-6': 'pegs',
  'liu-shu-6': 'pegs',
  'six-roots-6': 'pegs',
  'liu-he-6': 'pegs',
  'six-fu-6': 'pegs',
  'liu-lv-6': 'pegs',
  'qi-yao-7': 'pegs',
  'big-dipper-7': 'pegs',
  'rainbow-7': 'pegs',
  'jianpu-7': 'pegs',
  'seven-emotions-7': 'pegs',
  'bagua-8': 'pegs',
  'eight-immortals-8': 'pegs',
  'eight-directions-8': 'pegs',
  'eight-solar-nodes-8': 'pegs',
  'ba-yin-8': 'pegs',
  'nine-planets-9': 'pegs',
  'nine-zhou-9': 'pegs',
  'luo-shu-9': 'pegs',
  'nine-stars-9': 'pegs',
  'nine-heavens-9': 'pegs',
  'heavenly-stems-10': 'pegs',
  'ten-directions-10': 'pegs',
  'ten-fingers-10': 'pegs',
  'ten-marshals-10': 'pegs',
  'ten-yama-10': 'pegs',
  'eleven-luminaries-11': 'pegs',
  'football-xi-11': 'pegs',

  // 数理化：数学/物理/化学各包 + 计量单位 + 生物实验
  'multiplication-9x9': 'science',
  'multiplication-19x19': 'science',
  'squares-cubes-powers': 'science',
  'primes-under-100': 'science',
  'math-formulas': 'science',
  'math-formulas-2': 'science',
  'math-calculus': 'science',
  'math-linalg': 'science',
  'math-probability': 'science',
  'physics-formulas': 'science',
  'physics-laws': 'science',
  'physics-experiments': 'science',
  'chemistry-formulas': 'science',
  'elements': 'science',
  'common-units': 'science',
  'biology-experiments': 'science',

  // 其余全部归文史常识：constellations-12 星座、ethnic-groups-56 民族、cuisines-8 菜系、
  //   colors-12 颜色、thirty-six-stratagems 三十六计

  // 地理：geography-concepts 地理概念、world-geography-records 世界地理之最、
  //   provinces-capitals 省级行政区、world-capitals-40 世界首都、geography-china 中国地理常识
  'geography-concepts': 'geo',
  'world-geography-records': 'geo',
  'provinces-capitals': 'geo',
  'world-capitals-40': 'geo',
  'geography-china': 'geo',
}

/** 查询包的展示分类（缺省 liberal/文史常识） */
export function getPackDisplayCategory(packId: string): PackDisplayCategory {
  return PACK_CATEGORY_MAP[packId] ?? 'liberal'
}
