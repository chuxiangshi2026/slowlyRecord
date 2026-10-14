/**
 * 内置知识包：九天（9 桩）（由 public/knowledgebanks/nine-heavens-9.json 转换生成，请勿手改）
 */
import type { KnowledgePack } from '@/stores/useUtils/types'

const pack: KnowledgePack = {
  "id": "nine-heavens-9",
  "name": "九天（9 桩）",
  "description": "《吕氏春秋》所载九天：中央钧天，四正四隅各一天",
  "ordered": true,
  "usableAsPeg": true,
  "items": [
    {
      "id": "nine-heavens-9-1",
      "question": "钧天",
      "answer": "第 1 桩：中央之天",
      "order": 1,
      "imageUrl": "🌌"
    },
    {
      "id": "nine-heavens-9-2",
      "question": "苍天",
      "answer": "第 2 桩：东方之天（苍天大地）",
      "order": 2,
      "imageUrl": "🌅"
    },
    {
      "id": "nine-heavens-9-3",
      "question": "旻天",
      "answer": "第 3 桩：东北方之天，读 mín",
      "order": 3,
      "imageUrl": "🍂"
    },
    {
      "id": "nine-heavens-9-4",
      "question": "玄天",
      "answer": "第 4 桩：北方之天（玄为黑，北方属水色黑）",
      "order": 4,
      "imageUrl": "❄️"
    },
    {
      "id": "nine-heavens-9-5",
      "question": "幽天",
      "answer": "第 5 桩：西北方之天",
      "order": 5,
      "imageUrl": "🌫️"
    },
    {
      "id": "nine-heavens-9-6",
      "question": "颢天",
      "answer": "第 6 桩：西方之天，读 hào（颢为白亮）",
      "order": 6,
      "imageUrl": "🌇"
    },
    {
      "id": "nine-heavens-9-7",
      "question": "朱天",
      "answer": "第 7 桩：西南方之天（朱为红，近南方火色）",
      "order": 7,
      "imageUrl": "🔥"
    },
    {
      "id": "nine-heavens-9-8",
      "question": "炎天",
      "answer": "第 8 桩：南方之天（南方属火，炎热）",
      "order": 8,
      "imageUrl": "☀️"
    },
    {
      "id": "nine-heavens-9-9",
      "question": "阳天",
      "answer": "第 9 桩：东南方之天",
      "order": 9,
      "imageUrl": "🌤️"
    }
  ]
}

export default pack
