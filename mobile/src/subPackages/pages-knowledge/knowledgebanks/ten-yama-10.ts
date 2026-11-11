/**
 * 内置知识包：十殿阎罗（10 桩）（由 public/knowledgebanks/ten-yama-10.json 转换生成，请勿手改）
 * 本文件同时输出到 pages-knowledge 与 pages-memory（桩库）两个分包
 */
import type { KnowledgePack } from '@/stores/useUtils/types'

const pack: KnowledgePack = {
  "id": "ten-yama-10",
  "name": "十殿阎罗（10 桩）",
  "description": "民间信仰地府十殿阎王，从一殿秦广王到十殿转轮王",
  "ordered": true,
  "usableAsPeg": true,
  "items": [
    {
      "id": "ten-yama-10-1",
      "question": "秦广王",
      "answer": "第 1 桩：一殿阎罗：专司人间寿夭生死册籍",
      "order": 1,
      "imageUrl": "📜"
    },
    {
      "id": "ten-yama-10-2",
      "question": "楚江王",
      "answer": "第 2 桩：二殿阎罗：司掌活大地狱（剥衣亭寒冰地狱）",
      "order": 2,
      "imageUrl": "🧊"
    },
    {
      "id": "ten-yama-10-3",
      "question": "宋帝王",
      "answer": "第 3 桩：三殿阎罗：司掌黑绳大地狱",
      "order": 3,
      "imageUrl": "⛓️"
    },
    {
      "id": "ten-yama-10-4",
      "question": "五官王",
      "answer": "第 4 桩：四殿阎罗：司掌合大地狱（血池地狱），一作仵官王",
      "order": 4,
      "imageUrl": "🩸"
    },
    {
      "id": "ten-yama-10-5",
      "question": "阎罗王",
      "answer": "第 5 桩：五殿阎罗：司掌叫唤大地狱，包拯为其化身之说最广",
      "order": 5,
      "imageUrl": "⚖️",
      "alternates": [
        "阎王爷"
      ]
    },
    {
      "id": "ten-yama-10-6",
      "question": "卞城王",
      "answer": "第 6 桩：六殿阎罗：司掌大叫唤大地狱及枉死城",
      "order": 6,
      "imageUrl": "🏯"
    },
    {
      "id": "ten-yama-10-7",
      "question": "泰山王",
      "answer": "第 7 桩：七殿阎罗：司掌热恼地狱（碓磨肉酱地狱）",
      "order": 7,
      "imageUrl": "🔥"
    },
    {
      "id": "ten-yama-10-8",
      "question": "都市王",
      "answer": "第 8 桩：八殿阎罗：司掌大热恼大地狱",
      "order": 8,
      "imageUrl": "🌋"
    },
    {
      "id": "ten-yama-10-9",
      "question": "平等王",
      "answer": "第 9 桩：九殿阎罗：司掌阿鼻大地狱（无间地狱）",
      "order": 9,
      "imageUrl": "😈"
    },
    {
      "id": "ten-yama-10-10",
      "question": "转轮王",
      "answer": "第 10 桩：十殿阎罗：司掌轮回转世，殿后投生",
      "order": 10,
      "imageUrl": "🎡"
    }
  ]
}

export default pack
