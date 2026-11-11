/**
 * 内置知识包：八仙（8 桩）（由 public/knowledgebanks/eight-immortals-8.json 转换生成，请勿手改）
 * 本文件同时输出到 pages-knowledge 与 pages-memory（桩库）两个分包
 */
import type { KnowledgePack } from '@/stores/useUtils/types'

const pack: KnowledgePack = {
  "id": "eight-immortals-8",
  "name": "八仙（8 桩）",
  "description": "铁拐李到曹国舅，各执法器，八仙过海各显神通",
  "ordered": true,
  "usableAsPeg": true,
  "items": [
    {
      "id": "eight-immortals-8-1",
      "question": "铁拐李",
      "answer": "第 1 桩：八仙之首：拄铁拐、背葫芦，药到病除",
      "order": 1,
      "imageUrl": "🩼",
      "alternates": [
        "李铁拐"
      ]
    },
    {
      "id": "eight-immortals-8-2",
      "question": "汉钟离",
      "answer": "第 2 桩：手执芭蕉扇，袒腹笑呵呵",
      "order": 2,
      "imageUrl": "🪭",
      "alternates": [
        "钟离权"
      ]
    },
    {
      "id": "eight-immortals-8-3",
      "question": "张果老",
      "answer": "第 3 桩：倒骑白驴，渔鼓筒板",
      "order": 3,
      "imageUrl": "🫏"
    },
    {
      "id": "eight-immortals-8-4",
      "question": "吕洞宾",
      "answer": "第 4 桩：身背纯阳剑，点石成金",
      "order": 4,
      "imageUrl": "🗡️",
      "alternates": [
        "吕祖"
      ]
    },
    {
      "id": "eight-immortals-8-5",
      "question": "何仙姑",
      "answer": "第 5 桩：手持荷花，八仙中唯一女仙",
      "order": 5,
      "imageUrl": "🪷"
    },
    {
      "id": "eight-immortals-8-6",
      "question": "蓝采和",
      "answer": "第 6 桩：手提花篮，踏歌而行",
      "order": 6,
      "imageUrl": "🧺"
    },
    {
      "id": "eight-immortals-8-7",
      "question": "韩湘子",
      "answer": "第 7 桩：吹紫金箫，韩愈之侄孙",
      "order": 7,
      "imageUrl": "🪈"
    },
    {
      "id": "eight-immortals-8-8",
      "question": "曹国舅",
      "answer": "第 8 桩：手持玉板（笏板），皇亲国戚",
      "order": 8,
      "imageUrl": "👑"
    }
  ]
}

export default pack
