/**
 * 内置知识包：三光（3 桩）（由 public/knowledgebanks/san-guang-3.json 转换生成，请勿手改）
 */
import type { KnowledgePack } from '@/stores/useUtils/types'

const pack: KnowledgePack = {
  "id": "san-guang-3",
  "name": "三光（3 桩）",
  "description": "日、月、星三光，天空三种光源",
  "ordered": true,
  "usableAsPeg": true,
  "items": [
    {
      "id": "san-guang-3-1",
      "question": "日",
      "answer": "第 1 桩：太阳，昼之光源",
      "order": 1,
      "imageUrl": "☀️"
    },
    {
      "id": "san-guang-3-2",
      "question": "月",
      "answer": "第 2 桩：月亮，夜之光源",
      "order": 2,
      "imageUrl": "🌙"
    },
    {
      "id": "san-guang-3-3",
      "question": "星",
      "answer": "第 3 桩：星辰，夜空的点缀",
      "order": 3,
      "imageUrl": "⭐"
    }
  ]
}

export default pack
