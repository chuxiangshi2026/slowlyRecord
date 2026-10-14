/**
 * 内置知识包：左右（2 桩）（由 public/knowledgebanks/left-right-2.json 转换生成，请勿手改）
 */
import type { KnowledgePack } from '@/stores/useUtils/types'

const pack: KnowledgePack = {
  "id": "left-right-2",
  "name": "左右（2 桩）",
  "description": "左与右，以自身为参照的方位对",
  "ordered": true,
  "usableAsPeg": true,
  "items": [
    {
      "id": "left-right-2-1",
      "question": "左",
      "answer": "第 1 桩：左手一侧，古人以左为尊（虚左以待）",
      "order": 1,
      "imageUrl": "👈"
    },
    {
      "id": "left-right-2-2",
      "question": "右",
      "answer": "第 2 桩：右手一侧，写字行文从左到右的收尾方向",
      "order": 2,
      "imageUrl": "👉"
    }
  ]
}

export default pack
