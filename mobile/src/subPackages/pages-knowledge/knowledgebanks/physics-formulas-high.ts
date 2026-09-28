/**
 * 内置知识包：高中物理公式（由 public/knowledgebanks/physics-formulas-high.json 转换生成，请勿手改）
 */
import type { KnowledgePack } from '@/stores/useUtils/types'

const pack: KnowledgePack = {
  "id": "physics-formulas-high",
  "name": "高中物理公式",
  "description": "高中物理必修主干公式 28 条（直线运动、力学、电磁学）",
  "ordered": false,
  "usableAsPeg": false,
  "items": [
    {
      "id": "physics-formulas-high-1",
      "question": "匀变速直线运动速度公式",
      "answer": "v=v₀+at",
      "extras": {
        "章节": "直线运动",
        "说明": "v₀ 为初速度，a 为加速度，t 为时间"
      }
    },
    {
      "id": "physics-formulas-high-2",
      "question": "匀变速直线运动位移公式",
      "answer": "x=v₀t+½at²",
      "extras": {
        "章节": "直线运动",
        "说明": "x 为位移；与速度公式联立可消元求解"
      }
    },
    {
      "id": "physics-formulas-high-3",
      "question": "速度—位移关系式",
      "answer": "v²−v₀²=2ax",
      "extras": {
        "章节": "直线运动",
        "说明": "不涉及时间时使用最简便"
      }
    },
    {
      "id": "physics-formulas-high-4",
      "question": "匀变速直线运动的平均速度",
      "answer": "v̄=(v₀+vₜ)/2=x/t",
      "extras": {
        "章节": "直线运动",
        "说明": "仅适用于匀变速直线运动"
      }
    },
    {
      "id": "physics-formulas-high-5",
      "question": "自由落体运动",
      "answer": "v=gt，h=½gt²",
      "extras": {
        "章节": "直线运动",
        "说明": "g 取 9.8 m/s²，粗略计算取 10 m/s²"
      }
    },
    {
      "id": "physics-formulas-high-6",
      "question": "重力",
      "answer": "G=mg",
      "extras": {
        "章节": "力学",
        "说明": "g 为重力加速度，随纬度和高度略有变化"
      }
    },
    {
      "id": "physics-formulas-high-7",
      "question": "滑动摩擦力",
      "answer": "Ff=μFN",
      "extras": {
        "章节": "力学",
        "说明": "μ 为动摩擦因数，FN 为正压力"
      }
    },
    {
      "id": "physics-formulas-high-8",
      "question": "胡克定律",
      "answer": "F=kx",
      "extras": {
        "章节": "力学",
        "说明": "x 为弹簧形变量，k 为劲度系数，弹性限度内成立"
      }
    },
    {
      "id": "physics-formulas-high-9",
      "question": "牛顿第二定律",
      "answer": "F=ma",
      "extras": {
        "章节": "力学",
        "说明": "F 为合外力；力是改变物体运动状态（产生加速度）的原因"
      }
    },
    {
      "id": "physics-formulas-high-10",
      "question": "平抛运动",
      "answer": "水平方向 x=v₀t；竖直方向 y=½gt²",
      "extras": {
        "章节": "曲线运动",
        "说明": "分解为水平匀速直线运动与竖直自由落体两个分运动"
      }
    },
    {
      "id": "physics-formulas-high-11",
      "question": "匀速圆周运动",
      "answer": "v=ωr；a=ω²r=v²/r；F=ma",
      "extras": {
        "章节": "曲线运动",
        "说明": "ω 为角速度，向心力由合外力提供"
      }
    },
    {
      "id": "physics-formulas-high-12",
      "question": "万有引力定律",
      "answer": "F=GMm/r²",
      "extras": {
        "章节": "万有引力",
        "说明": "G=6.67×10⁻¹¹ N·m²/kg²，r 为两质点间的距离"
      }
    },
    {
      "id": "physics-formulas-high-13",
      "question": "第一宇宙速度",
      "answer": "v=√(gR)≈7.9 km/s",
      "extras": {
        "章节": "万有引力",
        "说明": "贴近地面做圆周运动的环绕速度，是最小发射速度"
      }
    },
    {
      "id": "physics-formulas-high-14",
      "question": "功",
      "answer": "W=Flcosα",
      "extras": {
        "章节": "机械能",
        "说明": "α 为力与位移方向的夹角；α=90° 时不做功"
      }
    },
    {
      "id": "physics-formulas-high-15",
      "question": "功率",
      "answer": "P=W/t=Fv",
      "extras": {
        "章节": "机械能",
        "说明": "P=Fv 中 v 为瞬时速度时是瞬时功率"
      }
    },
    {
      "id": "physics-formulas-high-16",
      "question": "动能定理",
      "answer": "W合=ΔEk=½mv²−½mv₀²",
      "extras": {
        "章节": "机械能",
        "说明": "合外力做的功等于物体动能的变化量"
      }
    },
    {
      "id": "physics-formulas-high-17",
      "question": "重力势能",
      "answer": "Ep=mgh",
      "extras": {
        "章节": "机械能",
        "说明": "h 为相对零势能面的高度"
      }
    },
    {
      "id": "physics-formulas-high-18",
      "question": "机械能守恒定律",
      "answer": "Ek₁+Ep₁=Ek₂+Ep₂",
      "extras": {
        "章节": "机械能",
        "说明": "只有重力或弹力做功时机械能守恒"
      }
    },
    {
      "id": "physics-formulas-high-19",
      "question": "动量与动量守恒",
      "answer": "p=mv；m₁v₁+m₂v₂=m₁v₁′+m₂v₂′",
      "extras": {
        "章节": "动量",
        "说明": "系统不受外力或合外力为零时动量守恒"
      }
    },
    {
      "id": "physics-formulas-high-20",
      "question": "库仑定律",
      "answer": "F=kq₁q₂/r²",
      "extras": {
        "章节": "电场",
        "说明": "k=9.0×10⁹ N·m²/C²，适用于真空中的点电荷"
      }
    },
    {
      "id": "physics-formulas-high-21",
      "question": "电场强度",
      "answer": "E=F/q；点电荷场强 E=kQ/r²",
      "extras": {
        "章节": "电场",
        "说明": "电场强度是矢量，正电荷受力方向即场强方向"
      }
    },
    {
      "id": "physics-formulas-high-22",
      "question": "电势差与电场力做功",
      "answer": "UAB=WAB/q；匀强电场中 U=Ed",
      "extras": {
        "章节": "电场",
        "说明": "d 为沿电场方向的距离"
      }
    },
    {
      "id": "physics-formulas-high-23",
      "question": "电容",
      "answer": "C=Q/U",
      "extras": {
        "章节": "电场",
        "说明": "平行板电容器 C=εS/(4πkd)，电容与 Q、U 无关"
      }
    },
    {
      "id": "physics-formulas-high-24",
      "question": "闭合电路欧姆定律",
      "answer": "I=E/(R+r)；路端电压 U=E−Ir",
      "extras": {
        "章节": "恒定电流",
        "说明": "E 为电源电动势，r 为电源内阻"
      }
    },
    {
      "id": "physics-formulas-high-25",
      "question": "焦耳定律",
      "answer": "Q=I²Rt",
      "extras": {
        "章节": "恒定电流",
        "说明": "纯电阻电路中 Q=W=UIt"
      }
    },
    {
      "id": "physics-formulas-high-26",
      "question": "安培力与洛伦兹力",
      "answer": "F=BIL（B⊥I）；f=qvB（v⊥B）",
      "extras": {
        "章节": "磁场",
        "说明": "方向用左手定则判断"
      }
    },
    {
      "id": "physics-formulas-high-27",
      "question": "法拉第电磁感应定律",
      "answer": "E=nΔΦ/Δt；切割磁感线时 E=BLv",
      "extras": {
        "章节": "电磁感应",
        "说明": "n 为线圈匝数，Φ 为磁通量"
      }
    },
    {
      "id": "physics-formulas-high-28",
      "question": "交变电流有效值与变压器",
      "answer": "正弦交流电 U=Um/√2；理想变压器 U₁/U₂=n₁/n₂",
      "extras": {
        "章节": "交变电流",
        "说明": "Um 为峰值；变压器不改变交流电的频率"
      }
    }
  ]
}

export default pack
