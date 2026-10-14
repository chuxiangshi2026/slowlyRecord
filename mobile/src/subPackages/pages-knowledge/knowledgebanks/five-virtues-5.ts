/**
 * 内置知识包：五常（5 桩）（由 public/knowledgebanks/five-virtues-5.json 转换生成，请勿手改）
 */
import type { KnowledgePack } from '@/stores/useUtils/types'

const pack: KnowledgePack = {
  "id": "five-virtues-5",
  "name": "五常（5 桩）",
  "description": "仁、义、礼、智、信，儒家五种常德",
  "ordered": true,
  "usableAsPeg": true,
  "items": [
    {
      "id": "five-virtues-5-1",
      "question": "仁",
      "answer": "第 1 桩：五常之首：爱人，对应木",
      "order": 1,
      "imageUrl": "❤️"
    },
    {
      "id": "five-virtues-5-2",
      "question": "义",
      "answer": "第 2 桩：宜也：处事得当，对应金",
      "order": 2,
      "imageUrl": "⚖️"
    },
    {
      "id": "five-virtues-5-3",
      "question": "礼",
      "answer": "第 3 桩：行为规范与敬意，对应火",
      "order": 3,
      "imageUrl": "🙇"
    },
    {
      "id": "five-virtues-5-4",
      "question": "智",
      "answer": "第 4 桩：明辨是非，对应水",
      "order": 4,
      "imageUrl": "💡"
    },
    {
      "id": "five-virtues-5-5",
      "question": "信",
      "answer": "第 5 桩：言而有信，对应土",
      "order": 5,
      "imageUrl": "🤝"
    }
  ]
}

export default pack
