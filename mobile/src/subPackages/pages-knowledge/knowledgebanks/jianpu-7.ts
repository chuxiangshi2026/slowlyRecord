/**
 * 内置知识包：简谱七音（7 桩）（由 public/knowledgebanks/jianpu-7.json 转换生成，请勿手改）
 */
import type { KnowledgePack } from '@/stores/useUtils/types'

const pack: KnowledgePack = {
  "id": "jianpu-7",
  "name": "简谱七音（7 桩）",
  "description": "do、re、mi、fa、sol、la、si，对应简谱 1-7",
  "ordered": true,
  "usableAsPeg": true,
  "items": [
    {
      "id": "jianpu-7-1",
      "question": "do",
      "answer": "第 1 桩：简谱 1（哆），音阶起点",
      "order": 1,
      "imageUrl": "🎵",
      "alternates": [
        "1（哆）"
      ]
    },
    {
      "id": "jianpu-7-2",
      "question": "re",
      "answer": "第 2 桩：简谱 2（来）",
      "order": 2,
      "imageUrl": "🎶",
      "alternates": [
        "2（来）"
      ]
    },
    {
      "id": "jianpu-7-3",
      "question": "mi",
      "answer": "第 3 桩：简谱 3（咪）",
      "order": 3,
      "imageUrl": "🎼",
      "alternates": [
        "3（咪）"
      ]
    },
    {
      "id": "jianpu-7-4",
      "question": "fa",
      "answer": "第 4 桩：简谱 4（发）",
      "order": 4,
      "imageUrl": "🎹",
      "alternates": [
        "4（发）"
      ]
    },
    {
      "id": "jianpu-7-5",
      "question": "sol",
      "answer": "第 5 桩：简谱 5（索）",
      "order": 5,
      "imageUrl": "🎺",
      "alternates": [
        "5（索）"
      ]
    },
    {
      "id": "jianpu-7-6",
      "question": "la",
      "answer": "第 6 桩：简谱 6（拉）",
      "order": 6,
      "imageUrl": "🎻",
      "alternates": [
        "6（拉）"
      ]
    },
    {
      "id": "jianpu-7-7",
      "question": "si",
      "answer": "第 7 桩：简谱 7（西）",
      "order": 7,
      "imageUrl": "🎷",
      "alternates": [
        "7（西）"
      ]
    }
  ]
}

export default pack
