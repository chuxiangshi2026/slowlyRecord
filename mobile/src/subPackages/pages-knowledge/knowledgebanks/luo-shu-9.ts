/**
 * 内置知识包：洛书九宫（9 桩）（由 public/knowledgebanks/luo-shu-9.json 转换生成，请勿手改）
 */
import type { KnowledgePack } from '@/stores/useUtils/types'

const pack: KnowledgePack = {
  "id": "luo-shu-9",
  "name": "洛书九宫（9 桩）",
  "description": "戴九履一、左三右七、二四为肩、六八为足、五居中央，按宫位数字 1-9 排列",
  "ordered": true,
  "usableAsPeg": true,
  "items": [
    {
      "id": "luo-shu-9-1",
      "question": "坎一宫",
      "answer": "第 1 桩：正北方，属水，一白",
      "order": 1,
      "imageUrl": "☵"
    },
    {
      "id": "luo-shu-9-2",
      "question": "坤二宫",
      "answer": "第 2 桩：西南方，属土，二黑",
      "order": 2,
      "imageUrl": "☷"
    },
    {
      "id": "luo-shu-9-3",
      "question": "震三宫",
      "answer": "第 3 桩：正东方，属木，三碧",
      "order": 3,
      "imageUrl": "☳"
    },
    {
      "id": "luo-shu-9-4",
      "question": "巽四宫",
      "answer": "第 4 桩：东南方，属木，四绿",
      "order": 4,
      "imageUrl": "☴"
    },
    {
      "id": "luo-shu-9-5",
      "question": "中五宫",
      "answer": "第 5 桩：中央，属土，五黄",
      "order": 5,
      "imageUrl": "⬜"
    },
    {
      "id": "luo-shu-9-6",
      "question": "乾六宫",
      "answer": "第 6 桩：西北方，属金，六白",
      "order": 6,
      "imageUrl": "☰"
    },
    {
      "id": "luo-shu-9-7",
      "question": "兑七宫",
      "answer": "第 7 桩：正西方，属金，七赤",
      "order": 7,
      "imageUrl": "☱"
    },
    {
      "id": "luo-shu-9-8",
      "question": "艮八宫",
      "answer": "第 8 桩：东北方，属土，八白",
      "order": 8,
      "imageUrl": "☶"
    },
    {
      "id": "luo-shu-9-9",
      "question": "离九宫",
      "answer": "第 9 桩：正南方，属火，九紫",
      "order": 9,
      "imageUrl": "☲"
    }
  ]
}

export default pack
