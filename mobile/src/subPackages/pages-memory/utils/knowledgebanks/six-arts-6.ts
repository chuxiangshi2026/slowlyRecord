/**
 * 内置知识包：六艺（6 桩）（由 public/knowledgebanks/six-arts-6.json 转换生成，请勿手改）
 * 本文件同时输出到 pages-knowledge 与 pages-memory（桩库）两个分包
 */
import type { KnowledgePack } from '@/stores/useUtils/types'

const pack: KnowledgePack = {
  "id": "six-arts-6",
  "name": "六艺（6 桩）",
  "description": "礼、乐、射、御、书、数，周代贵族教育六门功课",
  "ordered": true,
  "usableAsPeg": true,
  "items": [
    {
      "id": "six-arts-6-1",
      "question": "礼",
      "answer": "第 1 桩：六艺之首：礼仪制度与行为规范",
      "order": 1,
      "imageUrl": "🙇"
    },
    {
      "id": "six-arts-6-2",
      "question": "乐",
      "answer": "第 2 桩：音乐歌舞，陶冶性情",
      "order": 2,
      "imageUrl": "🎵"
    },
    {
      "id": "six-arts-6-3",
      "question": "射",
      "answer": "第 3 桩：射箭，武艺与礼仪的结合",
      "order": 3,
      "imageUrl": "🏹"
    },
    {
      "id": "six-arts-6-4",
      "question": "御",
      "answer": "第 4 桩：驾驭车马",
      "order": 4,
      "imageUrl": "🐎"
    },
    {
      "id": "six-arts-6-5",
      "question": "书",
      "answer": "第 5 桩：识字与书写",
      "order": 5,
      "imageUrl": "✍️"
    },
    {
      "id": "six-arts-6-6",
      "question": "数",
      "answer": "第 6 桩：算术与历数",
      "order": 6,
      "imageUrl": "🔢"
    }
  ]
}

export default pack
