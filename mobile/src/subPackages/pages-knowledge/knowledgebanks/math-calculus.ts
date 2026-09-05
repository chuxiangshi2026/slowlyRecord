/**
 * 内置知识包：高等数学·微积分基础（由 public/knowledgebanks/math-calculus.json 转换生成，请勿手改）
 */
import type { KnowledgePack } from '@/stores/useUtils/types'

const pack: KnowledgePack = {
  "id": "math-calculus",
  "name": "高等数学·微积分基础",
  "description": "极限、导数、微分、积分与级数入门 15 条",
  "ordered": false,
  "usableAsPeg": false,
  "items": [
    {
      "id": "math-calculus-1",
      "question": "极限的定义",
      "answer": "lim(x→a) f(x)=A：x 无限接近 a 时，f(x) 无限接近 A",
      "extras": {
        "说明": "ε-δ 语言是其严格化表述"
      }
    },
    {
      "id": "math-calculus-2",
      "question": "重要极限一",
      "answer": "lim(x→0) sin x / x = 1",
      "extras": {
        "说明": "x 必须用弧度；x 很小时 sin x≈x"
      }
    },
    {
      "id": "math-calculus-3",
      "question": "重要极限二",
      "answer": "lim(x→∞) (1+1/x)^x = e ≈ 2.71828",
      "extras": {
        "说明": "自然常数 e 的定义之一"
      }
    },
    {
      "id": "math-calculus-4",
      "question": "导数的定义",
      "answer": "f'(x₀)=lim(Δx→0) [f(x₀+Δx)-f(x₀)]/Δx",
      "extras": {
        "说明": "瞬时变化率，几何意义是切线斜率"
      }
    },
    {
      "id": "math-calculus-5",
      "question": "常用求导公式",
      "answer": "(xⁿ)'=nxⁿ⁻¹，(sin x)'=cos x，(eˣ)'=eˣ，(ln x)'=1/x",
      "extras": {
        "说明": "eˣ 求导后仍是自身"
      }
    },
    {
      "id": "math-calculus-6",
      "question": "求导法则",
      "answer": "(u±v)'=u'±v'；(uv)'=u'v+uv'；(u/v)'=(u'v-uv')/v²；[f(g(x))]'=f'(g)·g'(x)",
      "extras": {
        "说明": "末式为复合函数链式法则"
      }
    },
    {
      "id": "math-calculus-7",
      "question": "微分",
      "answer": "dy=f'(x)dx",
      "extras": {
        "说明": "切线近似：Δy≈dy，x 附近用直线代替曲线"
      }
    },
    {
      "id": "math-calculus-8",
      "question": "洛必达法则",
      "answer": "0/0 或 ∞/∞ 型极限：lim f/g = lim f'/g'",
      "extras": {
        "说明": "需满足可导等条件，可连续使用多次"
      }
    },
    {
      "id": "math-calculus-9",
      "question": "导数与单调性、极值",
      "answer": "f'(x)>0 单调增，f'(x)<0 单调减；f'(x)=0 且两侧变号处取极值",
      "extras": {
        "说明": "例：y=x³-3x 在 x=-1 取极大值、x=1 取极小值"
      }
    },
    {
      "id": "math-calculus-10",
      "question": "不定积分",
      "answer": "∫f(x)dx=F(x)+C，其中 F'(x)=f(x)",
      "extras": {
        "说明": "求导的逆运算，结果别丢常数 C"
      }
    },
    {
      "id": "math-calculus-11",
      "question": "牛顿-莱布尼茨公式",
      "answer": "∫ₐᵇf(x)dx=F(b)-F(a)",
      "extras": {
        "说明": "定积分 = 原函数在端点处取差"
      }
    },
    {
      "id": "math-calculus-12",
      "question": "微积分基本定理",
      "answer": "面积函数 A(x)=∫ₐˣf(t)dt 的导数 A'(x)=f(x)",
      "extras": {
        "说明": "积分与微分互为逆运算"
      }
    },
    {
      "id": "math-calculus-13",
      "question": "泰勒公式",
      "answer": "f(x)≈f(0)+f'(0)x+f″(0)x²/2!+…；如 eˣ≈1+x+x²/2",
      "extras": {
        "说明": "用多项式逼近函数，项数越多越精确"
      }
    },
    {
      "id": "math-calculus-14",
      "question": "等比级数求和",
      "answer": "1+r+r²+…=1/(1-r)（|r|<1），如 1+1/2+1/4+…=2",
      "extras": {
        "说明": "无穷项相加也可以等于有限值"
      }
    },
    {
      "id": "math-calculus-15",
      "question": "调和级数发散",
      "answer": "1+1/2+1/3+… 发散：增长极慢但趋向无穷",
      "extras": {
        "说明": "通项趋于 0 不足以保证级数收敛"
      }
    }
  ]
}

export default pack
