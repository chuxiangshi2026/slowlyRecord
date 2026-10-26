export interface MobilePalaceExample {
  id: string
  packId: string
  title: string
  description: string
  image: string
  usage: string
}

export const PALACE_EXAMPLES: MobilePalaceExample[] = [
  {
    id: 'home-route',
    packId: 'home-route-12',
    title: '家中路线',
    description: '12 个固定位置，适合购物清单、诗词分句和办事步骤。',
    image: '/subPackages/pages-memory/static/memory-palace/home-route.png',
    usage: '例：要记「牛奶」，想象牛奶从大门把手喷出来；下一件再挂到鞋柜。',
  },
  {
    id: 'body-pegs',
    packId: 'body-pegs-12',
    title: '身体路线',
    description: '从头顶到脚底，位置随时都在，适合 12 项以内的有序内容。',
    image: '/subPackages/pages-memory/static/memory-palace/body-pegs.png',
    usage: '例：要记「苹果」，想象头顶顶着一颗摇摇欲坠的苹果。',
  },
  {
    id: 'number-pegs',
    packId: 'number-pegs-12',
    title: '数字形象',
    description: '用蜡烛、鸭子等形象对应数字，适合按序号记知识点。',
    image: '/subPackages/pages-memory/static/memory-palace/number-pegs.png',
    usage: '例：第 1 项是「钥匙」，想象钥匙插进代表 1 的蜡烛里。',
  },
]
