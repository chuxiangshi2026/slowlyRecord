/**
 * 内置知识包：三才（3 桩）（由 public/knowledgebanks/san-cai-3.json 转换生成，请勿手改）
 */
import type { KnowledgePack } from '@/stores/useUtils/types'

const pack: KnowledgePack = {
  "id": "san-cai-3",
  "name": "三才（3 桩）",
  "description": "天、地、人三才，《易经》宇宙观的三个层次",
  "ordered": true,
  "usableAsPeg": true,
  "items": [
    {
      "id": "san-cai-3-1",
      "question": "天",
      "answer": "第 1 桩：三才之首：天时，日月星辰运行",
      "order": 1,
      "imageUrl": "🌌"
    },
    {
      "id": "san-cai-3-2",
      "question": "地",
      "answer": "第 2 桩：三才之中：地利，山川土地承载",
      "order": 2,
      "imageUrl": "⛰️"
    },
    {
      "id": "san-cai-3-3",
      "question": "人",
      "answer": "第 3 桩：三才之末：人和，顶天立地",
      "order": 3,
      "imageUrl": "🧍"
    }
  ]
}

export default pack
