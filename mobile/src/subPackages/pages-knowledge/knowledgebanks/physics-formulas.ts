/**
 * 内置知识包：初中物理公式（由 public/knowledgebanks/physics-formulas.json 转换生成，请勿手改）
 */
import type { KnowledgePack } from '@/stores/useUtils/types'

const pack: KnowledgePack = {
  "id": "physics-formulas",
  "name": "初中物理公式",
  "description": "初中物理常用公式 21 条",
  "ordered": false,
  "usableAsPeg": false,
  "items": [
    {
      "id": "physics-formulas-1",
      "question": "速度",
      "answer": "v=s/t",
      "extras": {
        "说明": "v 为速度，s 为路程，t 为时间；基本单位 m/s，1 m/s=3.6 km/h"
      }
    },
    {
      "id": "physics-formulas-2",
      "question": "密度",
      "answer": "ρ=m/V",
      "extras": {
        "说明": "ρ 为密度，m 为质量，V 为体积；单位 kg/m³，1 g/cm³=1×10³ kg/m³"
      }
    },
    {
      "id": "physics-formulas-3",
      "question": "重力",
      "answer": "G=mg",
      "extras": {
        "说明": "G 为重力（N），m 为质量（kg），g=9.8 N/kg（粗略计算可取 10 N/kg）"
      }
    },
    {
      "id": "physics-formulas-4",
      "question": "压强",
      "answer": "p=F/S",
      "extras": {
        "说明": "p 为压强（Pa），F 为压力（N），S 为受力面积（m²）"
      }
    },
    {
      "id": "physics-formulas-5",
      "question": "液体压强",
      "answer": "p=ρgh",
      "extras": {
        "说明": "ρ 为液体密度，g 为常数，h 为深度（液面到该点的竖直距离）；与液体重力、容器形状无关"
      }
    },
    {
      "id": "physics-formulas-6",
      "question": "浮力（阿基米德原理）",
      "answer": "F浮=G排=ρ液gV排",
      "extras": {
        "说明": "F浮 为浮力，G排 为排开液体所受的重力，ρ液 为液体密度，V排 为排开液体的体积；物体浸没后浮力与深度无关"
      }
    },
    {
      "id": "physics-formulas-7",
      "question": "杠杆平衡条件",
      "answer": "F₁L₁=F₂L₂",
      "extras": {
        "说明": "F₁ 为动力、L₁ 为动力臂，F₂ 为阻力、L₂ 为阻力臂；动力×动力臂=阻力×阻力臂"
      }
    },
    {
      "id": "physics-formulas-8",
      "question": "功",
      "answer": "W=Fs",
      "extras": {
        "说明": "W 为功（J），F 为力（N），s 为物体在力的方向上移动的距离（m）"
      }
    },
    {
      "id": "physics-formulas-9",
      "question": "功率",
      "answer": "P=W/t",
      "extras": {
        "说明": "P 为功率（W），W 为功（J），t 为时间（s）；匀速直线运动时可推得 P=Fv"
      }
    },
    {
      "id": "physics-formulas-10",
      "question": "机械效率",
      "answer": "η=W有用/W总×100%",
      "extras": {
        "说明": "W有用 为有用功，W总 为总功；由于额外功的存在，机械效率总小于 1"
      }
    },
    {
      "id": "physics-formulas-11",
      "question": "欧姆定律",
      "answer": "I=U/R",
      "extras": {
        "说明": "I 为电流（A），U 为电压（V），R 为电阻（Ω）；适用于同一导体的同一时刻"
      }
    },
    {
      "id": "physics-formulas-12",
      "question": "电功",
      "answer": "W=UIt",
      "extras": {
        "说明": "W 为电功（J），U 为电压，I 为电流，t 为通电时间；也等于 Pt，1 kW·h=3.6×10⁶ J"
      }
    },
    {
      "id": "physics-formulas-13",
      "question": "电功率",
      "answer": "P=UI",
      "extras": {
        "说明": "P 为电功率（W），U 为电压（V），I 为电流（A）；纯电阻电路可推得 P=U²/R=I²R"
      }
    },
    {
      "id": "physics-formulas-14",
      "question": "焦耳定律",
      "answer": "Q=I²Rt",
      "extras": {
        "说明": "Q 为电流产生的热量（J），I 为电流，R 为电阻，t 为通电时间；纯电阻电路中 Q=W=UIt"
      }
    },
    {
      "id": "physics-formulas-15",
      "question": "热量（比热容）",
      "answer": "Q=cmΔt",
      "extras": {
        "说明": "c 为比热容 J/(kg·℃)，m 为质量，Δt 为温度变化量；吸热放热均适用"
      }
    },
    {
      "id": "physics-formulas-16",
      "question": "串联电路总电阻",
      "answer": "R=R₁+R₂",
      "extras": {
        "说明": "串联总电阻等于各电阻之和；相当于增大了导体的长度"
      }
    },
    {
      "id": "physics-formulas-17",
      "question": "并联电路总电阻",
      "answer": "1/R=1/R₁+1/R₂",
      "extras": {
        "说明": "两个电阻并联也可写为 R=R₁R₂/(R₁+R₂)；并联总电阻小于其中任一个电阻，相当于增大了横截面积"
      }
    },
    {
      "id": "physics-formulas-18",
      "question": "凸透镜成像公式",
      "answer": "1/u+1/v=1/f",
      "extras": {
        "说明": "u 为物距，v 为像距，f 为焦距；初中主要要求成像的定性规律，此式供定量计算了解"
      }
    },
    {
      "id": "physics-formulas-19",
      "question": "燃料完全燃烧放出的热量",
      "answer": "Q=mq",
      "extras": {
        "说明": "Q 为放出的热量（J），m 为燃料的质量（kg），q 为燃料的热值（J/kg）"
      }
    },
    {
      "id": "physics-formulas-20",
      "question": "浮力（称重法）",
      "answer": "F浮=G−F拉",
      "extras": {
        "说明": "G 为物体在空气中的重力，F拉 为物体浸在液体中时弹簧测力计的示数"
      }
    },
    {
      "id": "physics-formulas-21",
      "question": "自由落体",
      "answer": "h=½gt²，v=gt（g≈9.8 m/s²）",
      "extras": {
        "说明": "下落高度与时间的平方成正比"
      }
    }
  ]
}

export default pack
