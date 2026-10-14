/**
 * 内置知识包：五味（5 桩）（由 public/knowledgebanks/five-flavors-5.json 转换生成，请勿手改）
 */
import type { KnowledgePack } from '@/stores/useUtils/types'

const pack: KnowledgePack = {
  "id": "five-flavors-5",
  "name": "五味（5 桩）",
  "description": "酸、甜、苦、辣、咸五味",
  "ordered": true,
  "usableAsPeg": true,
  "items": [
    {
      "id": "five-flavors-5-1",
      "question": "酸",
      "answer": "第 1 桩：五味之一，入肝，五行属木",
      "order": 1,
      "imageUrl": "🍋"
    },
    {
      "id": "five-flavors-5-2",
      "question": "甜",
      "answer": "第 2 桩：五味之一（甘），入脾，五行属土",
      "order": 2,
      "imageUrl": "🍬"
    },
    {
      "id": "five-flavors-5-3",
      "question": "苦",
      "answer": "第 3 桩：五味之一，入心，五行属火",
      "order": 3,
      "imageUrl": "☕"
    },
    {
      "id": "five-flavors-5-4",
      "question": "辣",
      "answer": "第 4 桩：五味之一（辛），入肺，五行属金",
      "order": 4,
      "imageUrl": "🌶️"
    },
    {
      "id": "five-flavors-5-5",
      "question": "咸",
      "answer": "第 5 桩：五味之一，入肾，五行属水",
      "order": 5,
      "imageUrl": "🧂"
    }
  ]
}

export default pack
