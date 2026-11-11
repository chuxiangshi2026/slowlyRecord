/**
 * 内置知识包：五音（5 桩）（由 public/knowledgebanks/five-tones-5.json 转换生成，请勿手改）
 * 本文件同时输出到 pages-knowledge 与 pages-memory（桩库）两个分包
 */
import type { KnowledgePack } from '@/stores/useUtils/types'

const pack: KnowledgePack = {
  "id": "five-tones-5",
  "name": "五音（5 桩）",
  "description": "宫、商、角、徵、羽，古代五声音阶",
  "ordered": true,
  "usableAsPeg": true,
  "items": [
    {
      "id": "five-tones-5-1",
      "question": "宫",
      "answer": "第 1 桩：五音之首，相当于简谱 do（1），对应土",
      "order": 1,
      "imageUrl": "🎵"
    },
    {
      "id": "five-tones-5-2",
      "question": "商",
      "answer": "第 2 桩：相当于 re（2），对应金",
      "order": 2,
      "imageUrl": "🎶"
    },
    {
      "id": "five-tones-5-3",
      "question": "角",
      "answer": "第 3 桩：相当于 mi（3），对应木",
      "order": 3,
      "imageUrl": "🎼"
    },
    {
      "id": "five-tones-5-4",
      "question": "徵",
      "answer": "第 4 桩：相当于 sol（5），读 zhǐ，对应火",
      "order": 4,
      "imageUrl": "🎤"
    },
    {
      "id": "five-tones-5-5",
      "question": "羽",
      "answer": "第 5 桩：相当于 la（6），对应水",
      "order": 5,
      "imageUrl": "🪶"
    }
  ]
}

export default pack
