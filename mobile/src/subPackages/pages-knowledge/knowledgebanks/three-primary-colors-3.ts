/**
 * 内置知识包：三原色（3 桩）（由 public/knowledgebanks/three-primary-colors-3.json 转换生成，请勿手改）
 */
import type { KnowledgePack } from '@/stores/useUtils/types'

const pack: KnowledgePack = {
  "id": "three-primary-colors-3",
  "name": "三原色（3 桩）",
  "description": "颜料三原色：红、黄、蓝，可调出万色",
  "ordered": true,
  "usableAsPeg": true,
  "items": [
    {
      "id": "three-primary-colors-3-1",
      "question": "红",
      "answer": "第 1 桩：三原色之一，最暖的颜色",
      "order": 1,
      "imageUrl": "🔴"
    },
    {
      "id": "three-primary-colors-3-2",
      "question": "黄",
      "answer": "第 2 桩：三原色之一，最亮的颜色",
      "order": 2,
      "imageUrl": "🟡"
    },
    {
      "id": "three-primary-colors-3-3",
      "question": "蓝",
      "answer": "第 3 桩：三原色之一，最冷的颜色",
      "order": 3,
      "imageUrl": "🔵"
    }
  ]
}

export default pack
