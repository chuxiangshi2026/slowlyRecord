/**
 * 内置知识包：四方（4 桩）（由 public/knowledgebanks/four-directions-4.json 转换生成，请勿手改）
 * 本文件同时输出到 pages-knowledge 与 pages-memory（桩库）两个分包
 */
import type { KnowledgePack } from '@/stores/useUtils/types'

const pack: KnowledgePack = {
  "id": "four-directions-4",
  "name": "四方（4 桩）",
  "description": "东、南、西、北四方，按顺时针排列",
  "ordered": true,
  "usableAsPeg": true,
  "items": [
    {
      "id": "four-directions-4-1",
      "question": "东",
      "answer": "第 1 桩：东方，日出之方，对应春季、青龙",
      "order": 1,
      "imageUrl": "🌅"
    },
    {
      "id": "four-directions-4-2",
      "question": "南",
      "answer": "第 2 桩：南方，向阳之方，对应夏季、朱雀",
      "order": 2,
      "imageUrl": "☀️"
    },
    {
      "id": "four-directions-4-3",
      "question": "西",
      "answer": "第 3 桩：西方，日落之方，对应秋季、白虎",
      "order": 3,
      "imageUrl": "🌇"
    },
    {
      "id": "four-directions-4-4",
      "question": "北",
      "answer": "第 4 桩：北方，背阴之方，对应冬季、玄武",
      "order": 4,
      "imageUrl": "❄️"
    }
  ]
}

export default pack
