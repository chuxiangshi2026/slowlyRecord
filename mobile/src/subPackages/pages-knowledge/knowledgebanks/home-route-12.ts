/**
 * 内置知识包：家居路线桩（12 桩）（由 public/knowledgebanks/home-route-12.json 转换生成，请勿手改）
 */
import type { KnowledgePack } from '@/stores/useUtils/types'

const pack: KnowledgePack = {
  "id": "home-route-12",
  "name": "家居路线桩（12 桩）",
  "description": "按进门后的巡视路线排列的家居地点桩",
  "ordered": true,
  "usableAsPeg": true,
  "items": [
    {
      "id": "home-route-12-1",
      "question": "大门",
      "answer": "进门第一站",
      "order": 1,
      "imageUrl": "🚪"
    },
    {
      "id": "home-route-12-2",
      "question": "鞋柜",
      "answer": "放下随身物品",
      "order": 2,
      "imageUrl": "👟"
    },
    {
      "id": "home-route-12-3",
      "question": "玄关",
      "answer": "过渡缓冲的位置",
      "order": 3,
      "imageUrl": "🧥"
    },
    {
      "id": "home-route-12-4",
      "question": "客厅沙发",
      "answer": "会客休息",
      "order": 4,
      "imageUrl": "🛋️"
    },
    {
      "id": "home-route-12-5",
      "question": "茶几",
      "answer": "沙发前的置物点",
      "order": 5,
      "imageUrl": "☕"
    },
    {
      "id": "home-route-12-6",
      "question": "电视墙",
      "answer": "客厅视觉中心",
      "order": 6,
      "imageUrl": "📺"
    },
    {
      "id": "home-route-12-7",
      "question": "餐桌",
      "answer": "用餐区",
      "order": 7,
      "imageUrl": "🍽️"
    },
    {
      "id": "home-route-12-8",
      "question": "厨房灶台",
      "answer": "烹饪区",
      "order": 8,
      "imageUrl": "🔥"
    },
    {
      "id": "home-route-12-9",
      "question": "阳台",
      "answer": "采光晾晒区",
      "order": 9,
      "imageUrl": "🪟"
    },
    {
      "id": "home-route-12-10",
      "question": "卧室床",
      "answer": "休息区",
      "order": 10,
      "imageUrl": "🛏️"
    },
    {
      "id": "home-route-12-11",
      "question": "书桌",
      "answer": "工作学习区",
      "order": 11,
      "imageUrl": "📚"
    },
    {
      "id": "home-route-12-12",
      "question": "衣柜",
      "answer": "卧室收纳终点",
      "order": 12,
      "imageUrl": "👔"
    }
  ]
}

export default pack
