/**
 * 内置知识包：二十四节气（由 public/knowledgebanks/solar-terms-24.json 转换生成，请勿手改）
 */
import type { KnowledgePack } from '@/stores/useUtils/types'

const pack: KnowledgePack = {
  "id": "solar-terms-24",
  "name": "二十四节气",
  "description": "二十四节气及其日期与物候，顺序本身是考点",
  "ordered": true,
  "usableAsPeg": true,
  "mnemonics": [
    "春雨惊春清谷天",
    "夏满芒夏暑相连",
    "秋处露秋寒霜降",
    "冬雪雪冬小大寒"
  ],
  "items": [
    {
      "id": "solar-terms-24-1",
      "question": "立春",
      "answer": "2月3日~5日，春季开始，东风解冻，万物复苏",
      "extras": {
        "季节": "春"
      },
      "order": 1,
      "imageUrl": "🌱"
    },
    {
      "id": "solar-terms-24-2",
      "question": "雨水",
      "answer": "2月18日~20日，降雨渐增，草木萌动，鸿雁北来",
      "extras": {
        "季节": "春"
      },
      "order": 2,
      "imageUrl": "🌧️"
    },
    {
      "id": "solar-terms-24-3",
      "question": "惊蛰",
      "answer": "3月5日~7日，春雷始鸣，蛰虫惊醒，气温回升",
      "extras": {
        "季节": "春"
      },
      "order": 3,
      "imageUrl": "⚡"
    },
    {
      "id": "solar-terms-24-4",
      "question": "春分",
      "answer": "3月20日~22日，昼夜平分，莺飞草长",
      "extras": {
        "季节": "春"
      },
      "order": 4,
      "imageUrl": "🌸"
    },
    {
      "id": "solar-terms-24-5",
      "question": "清明",
      "answer": "4月4日~6日，天气清明，草木繁茂，宜祭扫踏青",
      "extras": {
        "季节": "春"
      },
      "order": 5,
      "imageUrl": "🍃"
    },
    {
      "id": "solar-terms-24-6",
      "question": "谷雨",
      "answer": "4月19日~21日，雨生百谷，是播种移苗的最佳时节",
      "extras": {
        "季节": "春"
      },
      "order": 6,
      "imageUrl": "🌾"
    },
    {
      "id": "solar-terms-24-7",
      "question": "立夏",
      "answer": "5月5日~7日，夏季开始，万物繁茂，雷雨增多",
      "extras": {
        "季节": "夏"
      },
      "order": 7,
      "imageUrl": "🌿"
    },
    {
      "id": "solar-terms-24-8",
      "question": "小满",
      "answer": "5月20日~22日，夏熟作物籽粒渐满而未熟",
      "extras": {
        "季节": "夏"
      },
      "order": 8,
      "imageUrl": "🌾"
    },
    {
      "id": "solar-terms-24-9",
      "question": "芒种",
      "answer": "6月5日~7日，有芒之谷可种，麦收稻种正忙",
      "extras": {
        "季节": "夏"
      },
      "order": 9,
      "imageUrl": "🌟"
    },
    {
      "id": "solar-terms-24-10",
      "question": "夏至",
      "answer": "6月21日~22日，白昼最长，盛夏自此开始",
      "extras": {
        "季节": "夏"
      },
      "order": 10,
      "imageUrl": "☀️"
    },
    {
      "id": "solar-terms-24-11",
      "question": "小暑",
      "answer": "7月6日~8日，暑气渐盛，即将入伏",
      "extras": {
        "季节": "夏"
      },
      "order": 11,
      "imageUrl": "🔥"
    },
    {
      "id": "solar-terms-24-12",
      "question": "大暑",
      "answer": "7月22日~24日，一年中最热的时期，雷暴频繁",
      "extras": {
        "季节": "夏"
      },
      "order": 12,
      "imageUrl": "♨️"
    },
    {
      "id": "solar-terms-24-13",
      "question": "立秋",
      "answer": "8月7日~9日，秋季开始，暑去凉来，禾谷渐熟",
      "extras": {
        "季节": "秋"
      },
      "order": 13,
      "imageUrl": "🍂"
    },
    {
      "id": "solar-terms-24-14",
      "question": "处暑",
      "answer": "8月22日~24日，暑气渐消，秋意初显",
      "extras": {
        "季节": "秋"
      },
      "order": 14,
      "imageUrl": "🌦️"
    },
    {
      "id": "solar-terms-24-15",
      "question": "白露",
      "answer": "9月7日~9日，天气转凉，清晨露珠凝白",
      "extras": {
        "季节": "秋"
      },
      "order": 15,
      "imageUrl": "💧"
    },
    {
      "id": "solar-terms-24-16",
      "question": "秋分",
      "answer": "9月22日~24日，昼夜平分，秋色平分",
      "extras": {
        "季节": "秋"
      },
      "order": 16,
      "imageUrl": "🍁"
    },
    {
      "id": "solar-terms-24-17",
      "question": "寒露",
      "answer": "10月7日~9日，露气寒冷，将凝结为霜",
      "extras": {
        "季节": "秋"
      },
      "order": 17,
      "imageUrl": "🌫️"
    },
    {
      "id": "solar-terms-24-18",
      "question": "霜降",
      "answer": "10月23日~24日，天气渐冷，清晨始见霜冻",
      "extras": {
        "季节": "秋"
      },
      "order": 18,
      "imageUrl": "❄️"
    },
    {
      "id": "solar-terms-24-19",
      "question": "立冬",
      "answer": "11月7日~8日，冬季开始，万物收藏",
      "extras": {
        "季节": "冬"
      },
      "order": 19,
      "imageUrl": "🌨️"
    },
    {
      "id": "solar-terms-24-20",
      "question": "小雪",
      "answer": "11月22日~23日，气温下降，开始降雪",
      "extras": {
        "季节": "冬"
      },
      "order": 20,
      "imageUrl": "🌨️"
    },
    {
      "id": "solar-terms-24-21",
      "question": "大雪",
      "answer": "12月6日~8日，降雪增多，寒气加重",
      "extras": {
        "季节": "冬"
      },
      "order": 21,
      "imageUrl": "🌨️"
    },
    {
      "id": "solar-terms-24-22",
      "question": "冬至",
      "answer": "12月21日~23日，白昼最短，数九寒天开始",
      "extras": {
        "季节": "冬"
      },
      "order": 22,
      "imageUrl": "🌚"
    },
    {
      "id": "solar-terms-24-23",
      "question": "小寒",
      "answer": "1月5日~7日，进入严寒，腊月最冷时段之一",
      "extras": {
        "季节": "冬"
      },
      "order": 23,
      "imageUrl": "🥶"
    },
    {
      "id": "solar-terms-24-24",
      "question": "大寒",
      "answer": "1月20日~21日，一年中最冷时段，寒极而暖将至",
      "extras": {
        "季节": "冬"
      },
      "order": 24,
      "imageUrl": "🧊"
    }
  ]
}

export default pack
