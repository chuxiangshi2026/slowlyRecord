/**
 * 内置知识包：琴棋书画（4 桩）（由 public/knowledgebanks/four-arts-4.json 转换生成，请勿手改）
 * 本文件同时输出到 pages-knowledge 与 pages-memory（桩库）两个分包
 */
import type { KnowledgePack } from '@/stores/useUtils/types'

const pack: KnowledgePack = {
  "id": "four-arts-4",
  "name": "琴棋书画（4 桩）",
  "description": "古代文人四艺：琴、棋、书、画",
  "ordered": true,
  "usableAsPeg": true,
  "items": [
    {
      "id": "four-arts-4-1",
      "question": "琴",
      "answer": "第 1 桩：古琴，四艺之首，乐以修身",
      "order": 1,
      "imageUrl": "🎹"
    },
    {
      "id": "four-arts-4-2",
      "question": "棋",
      "answer": "第 2 桩：围棋，对弈养性",
      "order": 2,
      "imageUrl": "♟️"
    },
    {
      "id": "four-arts-4-3",
      "question": "书",
      "answer": "第 3 桩：书法，笔墨传神",
      "order": 3,
      "imageUrl": "🖌️"
    },
    {
      "id": "four-arts-4-4",
      "question": "画",
      "answer": "第 4 桩：国画，丹青写意",
      "order": 4,
      "imageUrl": "🖼️"
    }
  ]
}

export default pack
