/**
 * 内置知识包：四大元素（4 桩）（由 public/knowledgebanks/four-elements-4.json 转换生成，请勿手改）
 * 本文件同时输出到 pages-knowledge 与 pages-memory（桩库）两个分包
 */
import type { KnowledgePack } from '@/stores/useUtils/types'

const pack: KnowledgePack = {
  "id": "four-elements-4",
  "name": "四大元素（4 桩）",
  "description": "地、水、火、风，古印度与古希腊共通的四元素说",
  "ordered": true,
  "usableAsPeg": true,
  "items": [
    {
      "id": "four-elements-4-1",
      "question": "地",
      "answer": "第 1 桩：地大：坚固承载，对应固态",
      "order": 1,
      "imageUrl": "⛰️"
    },
    {
      "id": "four-elements-4-2",
      "question": "水",
      "answer": "第 2 桩：水大：流动滋润，对应液态",
      "order": 2,
      "imageUrl": "💧"
    },
    {
      "id": "four-elements-4-3",
      "question": "火",
      "answer": "第 3 桩：火大：温暖燃烧，对应能量",
      "order": 3,
      "imageUrl": "🔥"
    },
    {
      "id": "four-elements-4-4",
      "question": "风",
      "answer": "第 4 桩：风大：运动不息，对应气态",
      "order": 4,
      "imageUrl": "🌪️"
    }
  ]
}

export default pack
