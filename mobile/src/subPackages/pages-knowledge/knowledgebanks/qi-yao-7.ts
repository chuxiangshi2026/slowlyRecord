/**
 * 内置知识包：七曜（7 桩）（由 public/knowledgebanks/qi-yao-7.json 转换生成，请勿手改）
 * 本文件同时输出到 pages-knowledge 与 pages-memory（桩库）两个分包
 */
import type { KnowledgePack } from '@/stores/useUtils/types'

const pack: KnowledgePack = {
  "id": "qi-yao-7",
  "name": "七曜（7 桩）",
  "description": "日、月、火、水、木、金、土七曜，古代星期制度的来源",
  "ordered": true,
  "usableAsPeg": true,
  "items": [
    {
      "id": "qi-yao-7-1",
      "question": "日",
      "answer": "第 1 桩：日曜日：星期日",
      "order": 1,
      "imageUrl": "☀️"
    },
    {
      "id": "qi-yao-7-2",
      "question": "月",
      "answer": "第 2 桩：月曜日：星期一",
      "order": 2,
      "imageUrl": "🌙"
    },
    {
      "id": "qi-yao-7-3",
      "question": "火",
      "answer": "第 3 桩：火曜日：星期二（火星荧惑）",
      "order": 3,
      "imageUrl": "🔥"
    },
    {
      "id": "qi-yao-7-4",
      "question": "水",
      "answer": "第 4 桩：水曜日：星期三（水星辰星）",
      "order": 4,
      "imageUrl": "💧"
    },
    {
      "id": "qi-yao-7-5",
      "question": "木",
      "answer": "第 5 桩：木曜日：星期四（木星岁星）",
      "order": 5,
      "imageUrl": "🌳"
    },
    {
      "id": "qi-yao-7-6",
      "question": "金",
      "answer": "第 6 桩：金曜日：星期五（金星太白）",
      "order": 6,
      "imageUrl": "🪙"
    },
    {
      "id": "qi-yao-7-7",
      "question": "土",
      "answer": "第 7 桩：土曜日：星期六（土星镇星）",
      "order": 7,
      "imageUrl": "⛰️"
    }
  ]
}

export default pack
