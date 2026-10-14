/**
 * 内置知识包：四君子（4 桩）（由 public/knowledgebanks/four-gentlemen-4.json 转换生成，请勿手改）
 */
import type { KnowledgePack } from '@/stores/useUtils/types'

const pack: KnowledgePack = {
  "id": "four-gentlemen-4",
  "name": "四君子（4 桩）",
  "description": "梅、兰、竹、菊，花中四君子",
  "ordered": true,
  "usableAsPeg": true,
  "items": [
    {
      "id": "four-gentlemen-4-1",
      "question": "梅",
      "answer": "第 1 桩：梅花：凌寒独开，象征傲骨",
      "order": 1,
      "imageUrl": "🌺"
    },
    {
      "id": "four-gentlemen-4-2",
      "question": "兰",
      "answer": "第 2 桩：兰花：幽谷自芳，象征幽雅",
      "order": 2,
      "imageUrl": "🌷"
    },
    {
      "id": "four-gentlemen-4-3",
      "question": "竹",
      "answer": "第 3 桩：竹：中空有节，象征谦逊坚韧",
      "order": 3,
      "imageUrl": "🎋"
    },
    {
      "id": "four-gentlemen-4-4",
      "question": "菊",
      "answer": "第 4 桩：菊花：傲霜晚开，象征隐逸",
      "order": 4,
      "imageUrl": "🌼"
    }
  ]
}

export default pack
