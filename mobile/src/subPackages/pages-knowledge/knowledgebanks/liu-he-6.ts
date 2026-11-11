/**
 * 内置知识包：六合（6 桩）（由 public/knowledgebanks/liu-he-6.json 转换生成，请勿手改）
 * 本文件同时输出到 pages-knowledge 与 pages-memory（桩库）两个分包
 */
import type { KnowledgePack } from '@/stores/useUtils/types'

const pack: KnowledgePack = {
  "id": "liu-he-6",
  "name": "六合（6 桩）",
  "description": "天地四方：上（天）、下（地）、东、南、西、北，整个空间",
  "ordered": true,
  "usableAsPeg": true,
  "items": [
    {
      "id": "liu-he-6-1",
      "question": "上（天）",
      "answer": "第 1 桩：六合之天：上方苍穹",
      "order": 1,
      "imageUrl": "🌌"
    },
    {
      "id": "liu-he-6-2",
      "question": "下（地）",
      "answer": "第 2 桩：六合之地：下方大地",
      "order": 2,
      "imageUrl": "🌍"
    },
    {
      "id": "liu-he-6-3",
      "question": "东",
      "answer": "第 3 桩：六合之东：日出之方",
      "order": 3,
      "imageUrl": "🌅"
    },
    {
      "id": "liu-he-6-4",
      "question": "南",
      "answer": "第 4 桩：六合之南：向阳之方",
      "order": 4,
      "imageUrl": "☀️"
    },
    {
      "id": "liu-he-6-5",
      "question": "西",
      "answer": "第 5 桩：六合之西：日落之方",
      "order": 5,
      "imageUrl": "🌇"
    },
    {
      "id": "liu-he-6-6",
      "question": "北",
      "answer": "第 6 桩：六合之北：背阴之方",
      "order": 6,
      "imageUrl": "❄️"
    }
  ]
}

export default pack
