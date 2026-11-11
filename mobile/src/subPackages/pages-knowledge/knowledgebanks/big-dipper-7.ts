/**
 * 内置知识包：北斗七星（7 桩）（由 public/knowledgebanks/big-dipper-7.json 转换生成，请勿手改）
 * 本文件同时输出到 pages-knowledge 与 pages-memory（桩库）两个分包
 */
import type { KnowledgePack } from '@/stores/useUtils/types'

const pack: KnowledgePack = {
  "id": "big-dipper-7",
  "name": "北斗七星（7 桩）",
  "description": "天枢到天权为斗魁，玉衡到摇光为斗柄，附星名别名",
  "ordered": true,
  "usableAsPeg": true,
  "items": [
    {
      "id": "big-dipper-7-1",
      "question": "天枢",
      "answer": "第 1 桩：北斗一，斗魁之首",
      "order": 1,
      "imageUrl": "⭐",
      "alternates": [
        "贪狼星"
      ]
    },
    {
      "id": "big-dipper-7-2",
      "question": "天璇",
      "answer": "第 2 桩：北斗二，斗魁",
      "order": 2,
      "imageUrl": "🌟",
      "alternates": [
        "巨门星"
      ]
    },
    {
      "id": "big-dipper-7-3",
      "question": "天玑",
      "answer": "第 3 桩：北斗三，斗魁",
      "order": 3,
      "imageUrl": "✨",
      "alternates": [
        "禄存星"
      ]
    },
    {
      "id": "big-dipper-7-4",
      "question": "天权",
      "answer": "第 4 桩：北斗四，斗魁之尾",
      "order": 4,
      "imageUrl": "💫",
      "alternates": [
        "文曲星"
      ]
    },
    {
      "id": "big-dipper-7-5",
      "question": "玉衡",
      "answer": "第 5 桩：北斗五，斗柄之首",
      "order": 5,
      "imageUrl": "🌠",
      "alternates": [
        "廉贞星"
      ]
    },
    {
      "id": "big-dipper-7-6",
      "question": "开阳",
      "answer": "第 6 桩：北斗六，斗柄",
      "order": 6,
      "imageUrl": "🔆",
      "alternates": [
        "武曲星"
      ]
    },
    {
      "id": "big-dipper-7-7",
      "question": "摇光",
      "answer": "第 7 桩：北斗七，斗柄之末",
      "order": 7,
      "imageUrl": "🌟",
      "alternates": [
        "破军星"
      ]
    }
  ]
}

export default pack
