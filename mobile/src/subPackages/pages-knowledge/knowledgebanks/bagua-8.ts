/**
 * 内置知识包：八卦（8 桩）（由 public/knowledgebanks/bagua-8.json 转换生成，请勿手改）
 */
import type { KnowledgePack } from '@/stores/useUtils/types'

const pack: KnowledgePack = {
  "id": "bagua-8",
  "name": "八卦（8 桩）",
  "description": "乾兑离震巽坎艮坤，按先天八卦序（乾一兑二离三震四巽五坎六艮七坤八）",
  "ordered": true,
  "usableAsPeg": true,
  "items": [
    {
      "id": "bagua-8-1",
      "question": "乾",
      "answer": "第 1 桩：乾一：三连，为天，象征刚健",
      "order": 1,
      "imageUrl": "☰"
    },
    {
      "id": "bagua-8-2",
      "question": "兑",
      "answer": "第 2 桩：兑二：上缺，为泽，象征喜悦",
      "order": 2,
      "imageUrl": "☱"
    },
    {
      "id": "bagua-8-3",
      "question": "离",
      "answer": "第 3 桩：离三：中虚，为火，象征光明",
      "order": 3,
      "imageUrl": "☲"
    },
    {
      "id": "bagua-8-4",
      "question": "震",
      "answer": "第 4 桩：震四：仰盂，为雷，象征行动",
      "order": 4,
      "imageUrl": "☳"
    },
    {
      "id": "bagua-8-5",
      "question": "巽",
      "answer": "第 5 桩：巽五：下断，为风，象征谦逊",
      "order": 5,
      "imageUrl": "☴"
    },
    {
      "id": "bagua-8-6",
      "question": "坎",
      "answer": "第 6 桩：坎六：中满，为水，象征险陷",
      "order": 6,
      "imageUrl": "☵"
    },
    {
      "id": "bagua-8-7",
      "question": "艮",
      "answer": "第 7 桩：艮七：覆碗，为山，象征静止",
      "order": 7,
      "imageUrl": "☶"
    },
    {
      "id": "bagua-8-8",
      "question": "坤",
      "answer": "第 8 桩：坤八：六断，为地，象征包容",
      "order": 8,
      "imageUrl": "☷"
    }
  ]
}

export default pack
