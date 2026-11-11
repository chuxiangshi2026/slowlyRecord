/**
 * 内置知识包：天地（2 桩）（由 public/knowledgebanks/tian-di-2.json 转换生成，请勿手改）
 * 本文件同时输出到 pages-knowledge 与 pages-memory（桩库）两个分包
 */
import type { KnowledgePack } from '@/stores/useUtils/types'

const pack: KnowledgePack = {
  "id": "tian-di-2",
  "name": "天地（2 桩）",
  "description": "天与地，上下两极的天然顺序",
  "ordered": true,
  "usableAsPeg": true,
  "items": [
    {
      "id": "tian-di-2-1",
      "question": "天",
      "answer": "第 1 桩：天在上，覆盖万物",
      "order": 1,
      "imageUrl": "🌌"
    },
    {
      "id": "tian-di-2-2",
      "question": "地",
      "answer": "第 2 桩：地在下，承载万物",
      "order": 2,
      "imageUrl": "🌍"
    }
  ]
}

export default pack
