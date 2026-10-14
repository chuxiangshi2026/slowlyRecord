/**
 * 内置知识包：昼夜（2 桩）（由 public/knowledgebanks/day-night-2.json 转换生成，请勿手改）
 */
import type { KnowledgePack } from '@/stores/useUtils/types'

const pack: KnowledgePack = {
  "id": "day-night-2",
  "name": "昼夜（2 桩）",
  "description": "昼与夜，一日的时间两段",
  "ordered": true,
  "usableAsPeg": true,
  "items": [
    {
      "id": "day-night-2-1",
      "question": "昼",
      "answer": "第 1 桩：白天，日出到日落",
      "order": 1,
      "imageUrl": "🌞"
    },
    {
      "id": "day-night-2-2",
      "question": "夜",
      "answer": "第 2 桩：黑夜，日落到日出",
      "order": 2,
      "imageUrl": "🌃"
    }
  ]
}

export default pack
