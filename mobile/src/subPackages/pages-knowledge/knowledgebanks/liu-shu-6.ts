/**
 * 内置知识包：六书（6 桩）（由 public/knowledgebanks/liu-shu-6.json 转换生成，请勿手改）
 * 本文件同时输出到 pages-knowledge 与 pages-memory（桩库）两个分包
 */
import type { KnowledgePack } from '@/stores/useUtils/types'

const pack: KnowledgePack = {
  "id": "liu-shu-6",
  "name": "六书（6 桩）",
  "description": "象形、指事、会意、形声、转注、假借，汉字造字用字六法",
  "ordered": true,
  "usableAsPeg": true,
  "items": [
    {
      "id": "liu-shu-6-1",
      "question": "象形",
      "answer": "第 1 桩：描画实物形状造字，如日、月、山",
      "order": 1,
      "imageUrl": "🖼️"
    },
    {
      "id": "liu-shu-6-2",
      "question": "指事",
      "answer": "第 2 桩：用符号指示抽象意义，如上、下、刃",
      "order": 2,
      "imageUrl": "👉"
    },
    {
      "id": "liu-shu-6-3",
      "question": "会意",
      "answer": "第 3 桩：合两字表新意，如明（日月）、休（人木）",
      "order": 3,
      "imageUrl": "💭"
    },
    {
      "id": "liu-shu-6-4",
      "question": "形声",
      "answer": "第 4 桩：形旁表义、声旁表音，如江、河",
      "order": 4,
      "imageUrl": "🔊"
    },
    {
      "id": "liu-shu-6-5",
      "question": "转注",
      "answer": "第 5 桩：同义字互相解释，如老与考",
      "order": 5,
      "imageUrl": "🔄"
    },
    {
      "id": "liu-shu-6-6",
      "question": "假借",
      "answer": "第 6 桩：借同音字表新义，如来、其",
      "order": 6,
      "imageUrl": "🔗"
    }
  ]
}

export default pack
