/**
 * 内置知识包：常用数学公式（由 public/knowledgebanks/math-formulas.json 转换生成，请勿手改）
 */
import type { KnowledgePack } from '@/stores/useUtils/types'

const pack: KnowledgePack = {
  "id": "math-formulas",
  "name": "常用数学公式",
  "description": "小学到高中入门常用数学公式与函数 33 条",
  "ordered": false,
  "usableAsPeg": false,
  "items": [
    {
      "id": "math-formulas-1",
      "question": "圆的面积",
      "answer": "S=πr²",
      "extras": {
        "说明": "r 为半径"
      }
    },
    {
      "id": "math-formulas-2",
      "question": "圆的周长",
      "answer": "C=2πr=πd",
      "extras": {
        "说明": "r 为半径，d 为直径"
      }
    },
    {
      "id": "math-formulas-3",
      "question": "长方形面积",
      "answer": "S=ab",
      "extras": {
        "说明": "a、b 为长和宽"
      }
    },
    {
      "id": "math-formulas-4",
      "question": "正方形面积",
      "answer": "S=a²",
      "extras": {
        "说明": "a 为边长"
      }
    },
    {
      "id": "math-formulas-5",
      "question": "三角形面积",
      "answer": "S=½ah",
      "extras": {
        "说明": "a 为底，h 为高"
      }
    },
    {
      "id": "math-formulas-6",
      "question": "平行四边形面积",
      "answer": "S=ah",
      "extras": {
        "说明": "a 为底，h 为高"
      }
    },
    {
      "id": "math-formulas-7",
      "question": "梯形面积",
      "answer": "S=½(a+b)h",
      "extras": {
        "说明": "a、b 为上底和下底，h 为高"
      }
    },
    {
      "id": "math-formulas-8",
      "question": "长方体体积",
      "answer": "V=abc",
      "extras": {
        "说明": "a、b、c 为长、宽、高"
      }
    },
    {
      "id": "math-formulas-9",
      "question": "正方体体积",
      "answer": "V=a³",
      "extras": {
        "说明": "a 为棱长"
      }
    },
    {
      "id": "math-formulas-10",
      "question": "圆柱体积",
      "answer": "V=πr²h",
      "extras": {
        "说明": "r 为底面半径，h 为高"
      }
    },
    {
      "id": "math-formulas-11",
      "question": "圆锥体积",
      "answer": "V=⅓πr²h",
      "extras": {
        "说明": "r 为底面半径，h 为高"
      }
    },
    {
      "id": "math-formulas-12",
      "question": "圆柱侧面积",
      "answer": "S=2πrh",
      "extras": {
        "说明": "r 为底面半径，h 为高"
      }
    },
    {
      "id": "math-formulas-13",
      "question": "勾股定理",
      "answer": "a²+b²=c²",
      "extras": {
        "说明": "直角三角形两直角边 a、b，斜边 c"
      }
    },
    {
      "id": "math-formulas-14",
      "question": "完全平方公式",
      "answer": "(a+b)²=a²+2ab+b²"
    },
    {
      "id": "math-formulas-15",
      "question": "平方差公式",
      "answer": "a²-b²=(a+b)(a-b)"
    },
    {
      "id": "math-formulas-16",
      "question": "一元二次方程求根公式",
      "answer": "x=[-b±√(b²-4ac)]/2a",
      "extras": {
        "说明": "ax²+bx+c=0（a≠0）"
      }
    },
    {
      "id": "math-formulas-17",
      "question": "行程问题",
      "answer": "路程=速度×时间"
    },
    {
      "id": "math-formulas-18",
      "question": "工程问题",
      "answer": "工作总量=工作效率×工作时间"
    },
    {
      "id": "math-formulas-19",
      "question": "浓度问题",
      "answer": "溶质质量=溶液质量×溶质质量分数"
    },
    {
      "id": "math-formulas-20",
      "question": "利润率",
      "answer": "利润率=利润÷成本×100%"
    },
    {
      "id": "math-formulas-21",
      "question": "一次函数",
      "answer": "y=kx+b（k≠0），如 y=2x+1",
      "extras": {
        "说明": "图像是一条直线"
      }
    },
    {
      "id": "math-formulas-22",
      "question": "二次函数",
      "answer": "y=ax²+bx+c（a≠0），如 y=x²-2x-3",
      "extras": {
        "说明": "图像是抛物线，对称轴 x=-b/2a"
      }
    },
    {
      "id": "math-formulas-23",
      "question": "反比例函数",
      "answer": "y=k/x（k≠0），如 y=1/x",
      "extras": {
        "说明": "图像是双曲线，x=0 为渐近线"
      }
    },
    {
      "id": "math-formulas-24",
      "question": "正弦函数",
      "answer": "y=sin x",
      "extras": {
        "说明": "周期为 2π"
      }
    },
    {
      "id": "math-formulas-25",
      "question": "余弦函数",
      "answer": "y=cos x",
      "extras": {
        "说明": "周期为 2π，偶函数"
      }
    },
    {
      "id": "math-formulas-26",
      "question": "正切函数",
      "answer": "y=tan x",
      "extras": {
        "说明": "周期为 π，x=π/2+kπ 处无定义"
      }
    },
    {
      "id": "math-formulas-27",
      "question": "弧度制",
      "answer": "180°=π rad，1 rad≈57.3°",
      "extras": {
        "说明": "弧长等于半径时的圆心角为 1 弧度"
      }
    },
    {
      "id": "math-formulas-28",
      "question": "指数函数",
      "answer": "y=a^x（a>0 且 a≠1），如 y=2^x",
      "extras": {
        "说明": "恒过点 (0,1)，x 轴为渐近线"
      }
    },
    {
      "id": "math-formulas-29",
      "question": "对数函数",
      "answer": "y=logₐx（a>0 且 a≠1），如 y=ln x",
      "extras": {
        "说明": "定义域 x>0，恒过点 (1,0)"
      }
    },
    {
      "id": "math-formulas-30",
      "question": "导数",
      "answer": "f'(x)=lim(Δx→0) Δy/Δx，如 (x²)'=2x",
      "extras": {
        "说明": "几何意义：曲线在该点处切线的斜率"
      }
    },
    {
      "id": "math-formulas-31",
      "question": "定积分",
      "answer": "∫ₐᵇf(x)dx，如 ∫₀¹x²dx=⅓",
      "extras": {
        "说明": "几何意义：曲线与 x 轴围成的有向面积"
      }
    },
    {
      "id": "math-formulas-32",
      "question": "一元一次方程",
      "answer": "ax+b=0 → x=-b/a（a≠0），如 3x-6=0 得 x=2",
      "extras": {
        "说明": "方程的解就是一次函数图像与 x 轴的交点"
      }
    },
    {
      "id": "math-formulas-33",
      "question": "二元一次方程组",
      "answer": "例：y=2x+1 与 y=-x+4 联立，解为 x=1, y=3",
      "extras": {
        "说明": "方程组的解就是两条直线的交点坐标"
      }
    }
  ]
}

export default pack
