/**
 * 内置知识包：十大元帅（10 桩）（由 public/knowledgebanks/ten-marshals-10.json 转换生成，请勿手改）
 * 本文件同时输出到 pages-knowledge 与 pages-memory（桩库）两个分包
 */
import type { KnowledgePack } from '@/stores/useUtils/types'

const pack: KnowledgePack = {
  "id": "ten-marshals-10",
  "name": "十大元帅（10 桩）",
  "description": "1955 年授衔的十位元帅，按授衔名单顺序",
  "ordered": true,
  "usableAsPeg": true,
  "items": [
    {
      "id": "ten-marshals-10-1",
      "question": "朱德",
      "answer": "第 1 桩：十大元帅之首：红军总司令，四川仪陇人",
      "order": 1,
      "imageUrl": "🎖️"
    },
    {
      "id": "ten-marshals-10-2",
      "question": "彭德怀",
      "answer": "第 2 桩：百团大战、抗美援朝总司令，湖南湘潭人",
      "order": 2,
      "imageUrl": "🏅"
    },
    {
      "id": "ten-marshals-10-3",
      "question": "林彪",
      "answer": "第 3 桩：四野统帅，指挥辽沈、平津战役，湖北黄冈人",
      "order": 3,
      "imageUrl": "⭐"
    },
    {
      "id": "ten-marshals-10-4",
      "question": "刘伯承",
      "answer": "第 4 桩：军事学院首任院长，川中名将，重庆开州人",
      "order": 4,
      "imageUrl": "📚"
    },
    {
      "id": "ten-marshals-10-5",
      "question": "贺龙",
      "answer": "第 5 桩：两把菜刀闹革命，八一南昌起义总指挥，湖南桑植人",
      "order": 5,
      "imageUrl": "🔪"
    },
    {
      "id": "ten-marshals-10-6",
      "question": "陈毅",
      "answer": "第 6 桩：诗人元帅，上海市首任市长，四川乐至人",
      "order": 6,
      "imageUrl": "✒️"
    },
    {
      "id": "ten-marshals-10-7",
      "question": "罗荣桓",
      "answer": "第 7 桩：政工元帅，四野政委，湖南衡山人",
      "order": 7,
      "imageUrl": "🛡️"
    },
    {
      "id": "ten-marshals-10-8",
      "question": "徐向前",
      "answer": "第 8 桩：红四方面军总指挥，山西五台人",
      "order": 8,
      "imageUrl": "🚩"
    },
    {
      "id": "ten-marshals-10-9",
      "question": "聂荣臻",
      "answer": "第 9 桩：两弹一星元勋组织者，重庆江津人",
      "order": 9,
      "imageUrl": "🚀"
    },
    {
      "id": "ten-marshals-10-10",
      "question": "叶剑英",
      "answer": "第 10 桩：参谋元帅，屡在关键时刻立功，广东梅县人",
      "order": 10,
      "imageUrl": "🗡️"
    }
  ]
}

export default pack
