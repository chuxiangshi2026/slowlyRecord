/**
 * 内置知识包：九大行星（9 桩）（由 public/knowledgebanks/nine-planets-9.json 转换生成，请勿手改）
 */
import type { KnowledgePack } from '@/stores/useUtils/types'

const pack: KnowledgePack = {
  "id": "nine-planets-9",
  "name": "九大行星（9 桩）",
  "description": "按距日由近及远：水金地火木土天海冥（冥王星 2006 年降级为矮行星，此序仍是经典记忆口诀）",
  "ordered": true,
  "usableAsPeg": true,
  "items": [
    {
      "id": "nine-planets-9-1",
      "question": "水星",
      "answer": "第 1 桩：第 1 行星：离太阳最近，公转最快（88 天）",
      "order": 1,
      "imageUrl": "☿️"
    },
    {
      "id": "nine-planets-9-2",
      "question": "金星",
      "answer": "第 2 桩：第 2 行星：最亮的行星，古称太白",
      "order": 2,
      "imageUrl": "🌟"
    },
    {
      "id": "nine-planets-9-3",
      "question": "地球",
      "answer": "第 3 桩：第 3 行星：人类家园，唯一已知有生命",
      "order": 3,
      "imageUrl": "🌍"
    },
    {
      "id": "nine-planets-9-4",
      "question": "火星",
      "answer": "第 4 桩：第 4 行星：红色星球，古称荧惑",
      "order": 4,
      "imageUrl": "🔴"
    },
    {
      "id": "nine-planets-9-5",
      "question": "木星",
      "answer": "第 5 桩：第 5 行星：体积最大，古称岁星",
      "order": 5,
      "imageUrl": "🟠"
    },
    {
      "id": "nine-planets-9-6",
      "question": "土星",
      "answer": "第 6 桩：第 6 行星：光环最壮观，古称镇星",
      "order": 6,
      "imageUrl": "🪐"
    },
    {
      "id": "nine-planets-9-7",
      "question": "天王星",
      "answer": "第 7 桩：第 7 行星：躺着自转（自转轴几乎躺平）",
      "order": 7,
      "imageUrl": "🔵"
    },
    {
      "id": "nine-planets-9-8",
      "question": "海王星",
      "answer": "第 8 桩：第 8 行星：先算出来再观测到的行星",
      "order": 8,
      "imageUrl": "💙"
    },
    {
      "id": "nine-planets-9-9",
      "question": "冥王星",
      "answer": "第 9 桩：第 9 行星：2006 年被降级为矮行星",
      "order": 9,
      "imageUrl": "🤎"
    }
  ]
}

export default pack
