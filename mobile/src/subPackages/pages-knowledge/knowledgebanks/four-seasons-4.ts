/**
 * 内置知识包：四季（4 桩）（由 public/knowledgebanks/four-seasons-4.json 转换生成，请勿手改）
 * 本文件同时输出到 pages-knowledge 与 pages-memory（桩库）两个分包
 */
import type { KnowledgePack } from '@/stores/useUtils/types'

const pack: KnowledgePack = {
  "id": "four-seasons-4",
  "name": "四季（4 桩）",
  "description": "春、夏、秋、冬，一年的四个季节",
  "ordered": true,
  "usableAsPeg": true,
  "items": [
    {
      "id": "four-seasons-4-1",
      "question": "春",
      "answer": "第 1 桩：春季：万物复苏，对应五行之木、东方",
      "order": 1,
      "imageUrl": "🌸"
    },
    {
      "id": "four-seasons-4-2",
      "question": "夏",
      "answer": "第 2 桩：夏季：繁茂炎热，对应五行之火、南方",
      "order": 2,
      "imageUrl": "🌻"
    },
    {
      "id": "four-seasons-4-3",
      "question": "秋",
      "answer": "第 3 桩：秋季：收获肃杀，对应五行之金、西方",
      "order": 3,
      "imageUrl": "🍂"
    },
    {
      "id": "four-seasons-4-4",
      "question": "冬",
      "answer": "第 4 桩：冬季：收藏蛰伏，对应五行之水、北方",
      "order": 4,
      "imageUrl": "❄️"
    }
  ]
}

export default pack
