/**
 * 内置知识包：十二星座（由 public/knowledgebanks/constellations-12.json 转换生成，请勿手改）
 */
import type { KnowledgePack } from '@/stores/useUtils/types'

const pack: KnowledgePack = {
  "id": "constellations-12",
  "name": "十二星座",
  "description": "十二星座及其日期范围，顺序本身是考点",
  "ordered": true,
  "usableAsPeg": false,
  "items": [
    {
      "id": "constellations-12-1",
      "question": "白羊座",
      "answer": "3月21日~4月19日",
      "order": 1,
      "imageUrl": "♈"
    },
    {
      "id": "constellations-12-2",
      "question": "金牛座",
      "answer": "4月20日~5月20日",
      "order": 2,
      "imageUrl": "♉"
    },
    {
      "id": "constellations-12-3",
      "question": "双子座",
      "answer": "5月21日~6月21日",
      "order": 3,
      "imageUrl": "♊"
    },
    {
      "id": "constellations-12-4",
      "question": "巨蟹座",
      "answer": "6月22日~7月22日",
      "order": 4,
      "imageUrl": "♋"
    },
    {
      "id": "constellations-12-5",
      "question": "狮子座",
      "answer": "7月23日~8月22日",
      "order": 5,
      "imageUrl": "♌"
    },
    {
      "id": "constellations-12-6",
      "question": "处女座",
      "answer": "8月23日~9月22日",
      "order": 6,
      "imageUrl": "♍"
    },
    {
      "id": "constellations-12-7",
      "question": "天秤座",
      "answer": "9月23日~10月23日",
      "order": 7,
      "imageUrl": "♎"
    },
    {
      "id": "constellations-12-8",
      "question": "天蝎座",
      "answer": "10月24日~11月22日",
      "order": 8,
      "imageUrl": "♏"
    },
    {
      "id": "constellations-12-9",
      "question": "射手座",
      "answer": "11月23日~12月21日",
      "order": 9,
      "imageUrl": "♐"
    },
    {
      "id": "constellations-12-10",
      "question": "摩羯座",
      "answer": "12月22日~1月19日",
      "order": 10,
      "imageUrl": "♑"
    },
    {
      "id": "constellations-12-11",
      "question": "水瓶座",
      "answer": "1月20日~2月18日",
      "order": 11,
      "imageUrl": "♒"
    },
    {
      "id": "constellations-12-12",
      "question": "双鱼座",
      "answer": "2月19日~3月20日",
      "order": 12,
      "imageUrl": "♓"
    }
  ]
}

export default pack
