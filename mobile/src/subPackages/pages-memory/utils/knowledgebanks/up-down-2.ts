/**
 * 内置知识包：上下（2 桩）（由 public/knowledgebanks/up-down-2.json 转换生成，请勿手改）
 * 本文件同时输出到 pages-knowledge 与 pages-memory（桩库）两个分包
 */
import type { KnowledgePack } from '@/stores/useUtils/types'

const pack: KnowledgePack = {
  "id": "up-down-2",
  "name": "上下（2 桩）",
  "description": "上与下，垂直方向的天然顺序",
  "ordered": true,
  "usableAsPeg": true,
  "items": [
    {
      "id": "up-down-2-1",
      "question": "上",
      "answer": "第 1 桩：上方、高处",
      "order": 1,
      "imageUrl": "⬆️"
    },
    {
      "id": "up-down-2-2",
      "question": "下",
      "answer": "第 2 桩：下方、低处",
      "order": 2,
      "imageUrl": "⬇️"
    }
  ]
}

export default pack
