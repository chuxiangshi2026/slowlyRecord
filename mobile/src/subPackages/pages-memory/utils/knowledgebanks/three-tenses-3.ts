/**
 * 内置知识包：三时（3 桩）（由 public/knowledgebanks/three-tenses-3.json 转换生成，请勿手改）
 * 本文件同时输出到 pages-knowledge 与 pages-memory（桩库）两个分包
 */
import type { KnowledgePack } from '@/stores/useUtils/types'

const pack: KnowledgePack = {
  "id": "three-tenses-3",
  "name": "三时（3 桩）",
  "description": "过去、现在、未来，时间的三段",
  "ordered": true,
  "usableAsPeg": true,
  "items": [
    {
      "id": "three-tenses-3-1",
      "question": "过去",
      "answer": "第 1 桩：已经发生的时段，回忆之所在",
      "order": 1,
      "imageUrl": "⏪"
    },
    {
      "id": "three-tenses-3-2",
      "question": "现在",
      "answer": "第 2 桩：正在经历的时段，行动之所在",
      "order": 2,
      "imageUrl": "▶️"
    },
    {
      "id": "three-tenses-3-3",
      "question": "未来",
      "answer": "第 3 桩：尚未到来的时段，规划之所在",
      "order": 3,
      "imageUrl": "⏩"
    }
  ]
}

export default pack
