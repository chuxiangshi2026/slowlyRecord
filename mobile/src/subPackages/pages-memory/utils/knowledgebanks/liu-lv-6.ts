/**
 * 内置知识包：六律（6 桩）（由 public/knowledgebanks/liu-lv-6.json 转换生成，请勿手改）
 * 本文件同时输出到 pages-knowledge 与 pages-memory（桩库）两个分包
 */
import type { KnowledgePack } from '@/stores/useUtils/types'

const pack: KnowledgePack = {
  "id": "liu-lv-6",
  "name": "六律（6 桩）",
  "description": "黄钟、太簇、姑洗、蕤宾、夷则、无射，古代十二律中的六个阳律",
  "ordered": true,
  "usableAsPeg": true,
  "items": [
    {
      "id": "liu-lv-6-1",
      "question": "黄钟",
      "answer": "第 1 桩：六律之首，音最低，对应十一月",
      "order": 1,
      "imageUrl": "🎵"
    },
    {
      "id": "liu-lv-6-2",
      "question": "太簇",
      "answer": "第 2 桩：六律之二，对应正月",
      "order": 2,
      "imageUrl": "🎶"
    },
    {
      "id": "liu-lv-6-3",
      "question": "姑洗",
      "answer": "第 3 桩：六律之三，读 gū xiǎn，对应三月",
      "order": 3,
      "imageUrl": "🎼"
    },
    {
      "id": "liu-lv-6-4",
      "question": "蕤宾",
      "answer": "第 4 桩：六律之四，读 ruí bīn，对应五月",
      "order": 4,
      "imageUrl": "🎹"
    },
    {
      "id": "liu-lv-6-5",
      "question": "夷则",
      "answer": "第 5 桩：六律之五，对应七月",
      "order": 5,
      "imageUrl": "🎺"
    },
    {
      "id": "liu-lv-6-6",
      "question": "无射",
      "answer": "第 6 桩：六律之六，读 wú yì，对应九月",
      "order": 6,
      "imageUrl": "🎻"
    }
  ]
}

export default pack
