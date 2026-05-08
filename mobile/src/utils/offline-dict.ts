/**
 * 移动端离线词典
 * 提供常用单词的本地释义，作为网络不可用时的降级方案
 */

const OFFLINE_DICT: Record<string, string> = {
  hello: '你好；问候',
  world: '世界；领域',
  apple: '苹果',
  book: '书；预订',
  car: '汽车',
  dog: '狗',
  eat: '吃',
  fish: '鱼；钓鱼',
  good: '好的；善良的',
  hand: '手；交给',
  ice: '冰',
  job: '工作',
  king: '国王',
  love: '爱；热爱',
  milk: '牛奶',
  name: '名字；命名',
  open: '打开；开放的',
  pen: '钢笔',
  question: '问题；质疑',
  run: '跑；经营',
  sun: '太阳',
  time: '时间；时代',
  up: '向上；起来',
  very: '非常；很',
  water: '水；浇水',
  yellow: '黄色；黄色的',
  zoo: '动物园',
  the: '这；那（定冠词）',
  a: '一（个）',
  an: '一（个，用于元音前）',
  is: '是',
  are: '是（复数）',
  am: '是（第一人称）',
  was: '是（过去式）',
  were: '是（过去复数）',
  be: '是；存在',
  been: '是（过去分词）',
  being: '是（现在分词）',
  have: '有；吃',
  has: '有（第三人称）',
  had: '有（过去式）',
  do: '做；助动词',
  does: '做（第三人称）',
  did: '做（过去式）',
  will: '将；愿意',
  would: '将（过去式）；愿意',
  shall: '将（用于第一人称）',
  should: '应该',
  may: '可能；可以',
  might: '可能（过去式）',
  can: '能；可以',
  could: '能（过去式）',
  must: '必须',
  need: '需要',
  dare: '敢',
  ought: '应该',
  used: '过去常常',
  about: '关于；大约',
  above: '在...上方',
  across: '穿过；在对面',
  after: '在...之后',
  against: '反对；靠着',
  along: '沿着',
  among: '在...之中',
  around: '围绕；大约',
  at: '在（地点/时间）',
  before: '在...之前',
  behind: '在...后面',
  below: '在...下方',
  beneath: '在...下面',
  beside: '在...旁边',
  besides: '除...之外还',
  between: '在...之间',
  beyond: '超过；在...那边',
  but: '但是；除了',
  by: '通过；在...旁边',
  down: '向下；沿着',
  during: '在...期间',
  except: '除了',
  for: '为了；因为',
  from: '从；来自',
  in: '在...里面',
  inside: '在...内部',
  into: '进入',
  like: '像；喜欢',
  near: '靠近',
  of: '...的',
  off: '离开；关掉',
  on: '在...上面',
  onto: '到...上面',
  out: '出去；向外',
  outside: '在...外面',
  over: '在...上方；越过',
  past: '经过；过去',
  since: '自从；因为',
  through: '穿过；通过',
  throughout: '遍及',
  till: '直到',
  to: '到；向',
  toward: '朝向',
  under: '在...下面',
  until: '直到',
  upon: '在...之上',
  with: '和...一起；用',
  within: '在...之内',
  without: '没有；在...外面',
}

/**
 * 查询离线词典
 */
export function queryOfflineDict(word: string): string | null {
  const normalized = word.toLowerCase().trim()
  return OFFLINE_DICT[normalized] || null
}

/**
 * 检查是否支持离线查询
 */
export function hasOfflineDict(word: string): boolean {
  return !!queryOfflineDict(word)
}

/**
 * 获取所有离线词条数
 */
export function getOfflineDictSize(): number {
  return Object.keys(OFFLINE_DICT).length
}
