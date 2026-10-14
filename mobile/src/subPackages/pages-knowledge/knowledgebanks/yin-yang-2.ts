/**
 * 内置知识包：阴阳两仪（2 桩）（由 public/knowledgebanks/yin-yang-2.json 转换生成，请勿手改）
 */
import type { KnowledgePack } from '@/stores/useUtils/types'

const pack: KnowledgePack = {
  "id": "yin-yang-2",
  "name": "阴阳两仪（2 桩）",
  "description": "太极生两仪：阴与阳，最基础的两元对立",
  "ordered": true,
  "usableAsPeg": true,
  "items": [
    {
      "id": "yin-yang-2-1",
      "question": "阴",
      "answer": "第 1 桩：两仪之一，主静、主暗、主柔，如月、夜、地",
      "order": 1,
      "imageUrl": "🌙"
    },
    {
      "id": "yin-yang-2-2",
      "question": "阳",
      "answer": "第 2 桩：两仪之一，主动、主明、主刚，如日、昼、天",
      "order": 2,
      "imageUrl": "☀️"
    }
  ]
}

export default pack
