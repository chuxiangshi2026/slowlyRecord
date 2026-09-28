/**
 * 内置知识包：初中生物核心概念（由 public/knowledgebanks/biology-basics.json 转换生成，请勿手改）
 */
import type { KnowledgePack } from '@/stores/useUtils/types'

const pack: KnowledgePack = {
  "id": "biology-basics",
  "name": "初中生物核心概念",
  "description": "初中生物核心概念 20 条（细胞、生理、遗传、生态）",
  "ordered": false,
  "usableAsPeg": false,
  "items": [
    {
      "id": "biology-basics-1",
      "question": "细胞的基本结构",
      "answer": "细胞膜（保护、控制物质进出）、细胞质、细胞核（含遗传物质 DNA，是控制中心）；植物细胞还有细胞壁、液泡和叶绿体",
      "extras": {
        "类别": "细胞"
      }
    },
    {
      "id": "biology-basics-2",
      "question": "光合作用",
      "answer": "绿色植物通过叶绿体，利用光能把二氧化碳和水合成有机物并释放氧气：二氧化碳+水→（光能、叶绿体）→有机物+氧气；实质是制造有机物、储存能量",
      "extras": {
        "类别": "生理"
      }
    },
    {
      "id": "biology-basics-3",
      "question": "呼吸作用",
      "answer": "细胞利用氧将有机物分解成二氧化碳和水，并释放能量：有机物+氧→二氧化碳+水+能量；主要在线粒体中进行",
      "extras": {
        "类别": "生理"
      }
    },
    {
      "id": "biology-basics-4",
      "question": "消化系统的组成",
      "answer": "消化道（口腔、咽、食道、胃、小肠、大肠、肛门）和消化腺（唾液腺、胃腺、肝脏、胰腺、肠腺）；小肠是消化和吸收的主要场所",
      "extras": {
        "类别": "生理"
      }
    },
    {
      "id": "biology-basics-5",
      "question": "血液循环途径",
      "answer": "体循环：左心室→主动脉→全身毛细血管→上下腔静脉→右心房；肺循环：右心室→肺动脉→肺部毛细血管→肺静脉→左心房。动脉血含氧多、颜色鲜红",
      "extras": {
        "类别": "生理"
      }
    },
    {
      "id": "biology-basics-6",
      "question": "神经系统的基本单位",
      "answer": "神经元（神经细胞），由细胞体和突起组成；神经系统由脑、脊髓和神经组成，脑分大脑、小脑和脑干",
      "extras": {
        "类别": "生理"
      }
    },
    {
      "id": "biology-basics-7",
      "question": "反射与反射弧",
      "answer": "神经调节的基本方式是反射，结构基础是反射弧：感受器→传入神经→神经中枢→传出神经→效应器",
      "extras": {
        "类别": "生理"
      }
    },
    {
      "id": "biology-basics-8",
      "question": "遗传物质的关系",
      "answer": "染色体由 DNA 和蛋白质组成，DNA 是主要的遗传物质，基因是有遗传效应的 DNA 片段；包含关系：染色体＞DNA＞基因",
      "extras": {
        "类别": "遗传"
      }
    },
    {
      "id": "biology-basics-9",
      "question": "人的性别决定",
      "answer": "男性性染色体为 XY，女性为 XX；生男生女取决于父亲精子的类型（含 X 或含 Y），机会均等",
      "extras": {
        "类别": "遗传"
      }
    },
    {
      "id": "biology-basics-10",
      "question": "生物的变异",
      "answer": "可遗传变异（遗传物质改变引起，如杂交育种）与不可遗传变异（仅由环境影响引起，如晒黑）；前者能遗传给后代",
      "extras": {
        "类别": "遗传"
      }
    },
    {
      "id": "biology-basics-11",
      "question": "生态系统的组成",
      "answer": "生物部分（生产者、消费者、分解者）和非生物部分；食物链起于生产者，能量沿食物链单向流动、逐级递减",
      "extras": {
        "类别": "生态"
      }
    },
    {
      "id": "biology-basics-12",
      "question": "种子萌发的条件",
      "answer": "环境条件：适宜的温度、一定的水分、充足的空气；自身条件：胚是完整的、活的，且不在休眠期",
      "extras": {
        "类别": "植物"
      }
    },
    {
      "id": "biology-basics-13",
      "question": "花的结构与果实形成",
      "answer": "花的主要结构是雄蕊和雌蕊；受精后子房发育成果实，胚珠发育成种子，受精卵发育成胚",
      "extras": {
        "类别": "植物"
      }
    },
    {
      "id": "biology-basics-14",
      "question": "蒸腾作用",
      "answer": "水分以气体状态从叶片气孔散失到大气中的过程；能促进水分和无机盐的运输，并降低叶面温度",
      "extras": {
        "类别": "植物"
      }
    },
    {
      "id": "biology-basics-15",
      "question": "传染病的流行环节与预防",
      "answer": "三个环节：传染源、传播途径、易感人群；对应措施：控制传染源、切断传播途径、保护易感人群",
      "extras": {
        "类别": "健康"
      }
    },
    {
      "id": "biology-basics-16",
      "question": "免疫的类型",
      "answer": "非特异性免疫（生来就有，如皮肤屏障、吞噬细胞）与特异性免疫（后天获得，如接种疫苗产生抗体）",
      "extras": {
        "类别": "健康"
      }
    },
    {
      "id": "biology-basics-17",
      "question": "食物中的营养物质",
      "answer": "糖类（主要供能物质）、脂肪（备用能源）、蛋白质（构成细胞的基本物质）、水、无机盐、维生素（不构成细胞也不供能）",
      "extras": {
        "类别": "生理"
      }
    },
    {
      "id": "biology-basics-18",
      "question": "尿液的形成",
      "answer": "肾小球和肾小囊内壁的过滤作用形成原尿，肾小管的重吸收作用形成尿液；肾单位是肾脏结构和功能的基本单位",
      "extras": {
        "类别": "生理"
      }
    },
    {
      "id": "biology-basics-19",
      "question": "生物分类单位",
      "answer": "从大到小：界、门、纲、目、科、属、种；“种”是最基本的分类单位，同种生物亲缘关系最近",
      "extras": {
        "类别": "分类"
      }
    },
    {
      "id": "biology-basics-20",
      "question": "近视的成因与矫正",
      "answer": "晶状体曲度过大或眼球前后径过长，物像落在视网膜前方；佩戴凹透镜矫正",
      "extras": {
        "类别": "健康"
      }
    }
  ]
}

export default pack
