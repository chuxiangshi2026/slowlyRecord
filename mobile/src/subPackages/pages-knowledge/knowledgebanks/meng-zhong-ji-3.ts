/**
 * 内置知识包：孟仲季（3 桩）（由 public/knowledgebanks/meng-zhong-ji-3.json 转换生成，请勿手改）
 * 本文件同时输出到 pages-knowledge 与 pages-memory（桩库）两个分包
 */
import type { KnowledgePack } from '@/stores/useUtils/types'

const pack: KnowledgePack = {
  "id": "meng-zhong-ji-3",
  "name": "孟仲季（3 桩）",
  "description": "兄弟排行或季度三个月的次序：孟、仲、季",
  "ordered": true,
  "usableAsPeg": true,
  "items": [
    {
      "id": "meng-zhong-ji-3-1",
      "question": "孟",
      "answer": "第 1 桩：排行第一，如孟春为正月",
      "order": 1,
      "imageUrl": "🥇"
    },
    {
      "id": "meng-zhong-ji-3-2",
      "question": "仲",
      "answer": "第 2 桩：排行第二，如仲夏为五月",
      "order": 2,
      "imageUrl": "🥈"
    },
    {
      "id": "meng-zhong-ji-3-3",
      "question": "季",
      "answer": "第 3 桩：排行第三，如季秋为九月",
      "order": 3,
      "imageUrl": "🥉"
    }
  ]
}

export default pack
