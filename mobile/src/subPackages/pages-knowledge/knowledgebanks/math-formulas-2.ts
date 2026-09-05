/**
 * 内置知识包：常用数学公式（进阶篇）（由 public/knowledgebanks/math-formulas-2.json 转换生成，请勿手改）
 */
import type { KnowledgePack } from '@/stores/useUtils/types'

const pack: KnowledgePack = {
  "id": "math-formulas-2",
  "name": "常用数学公式（进阶篇）",
  "description": "高中与竞赛方向的数列、几何、圆锥曲线、微积分与概率公式",
  "ordered": false,
  "usableAsPeg": false,
  "items": [
    {
      "id": "math-formulas-2-1",
      "question": "等差数列求和",
      "answer": "Sₙ = n(a₁ + aₙ)/2 = n a₁ + n(n-1)d/2",
      "extras": {
        "适用": "等差数列",
        "变量说明": "a₁=首项, d=公差, aₙ=第n项"
      }
    },
    {
      "id": "math-formulas-2-2",
      "question": "等比数列通项",
      "answer": "aₙ = a₁ · qⁿ⁻¹",
      "extras": {
        "适用": "等比数列",
        "变量说明": "a₁=首项, q=公比"
      }
    },
    {
      "id": "math-formulas-2-3",
      "question": "等比数列求和",
      "answer": "Sₙ = a₁(1 - qⁿ)/(1 - q)（q ≠ 1）",
      "extras": {
        "适用": "等比数列",
        "变量说明": "a₁=首项, q=公比, q=1 时 Sₙ=na₁"
      }
    },
    {
      "id": "math-formulas-2-4",
      "question": "复利终值公式",
      "answer": "FV = P(1 + r/n)^(nt)；连续复利 FV = P·e^(rt)",
      "extras": {
        "适用": "复利计算",
        "变量说明": "P=本金, r=年利率, n=年复利次数, t=年数"
      }
    },
    {
      "id": "math-formulas-2-5",
      "question": "韦达定理",
      "answer": "x₁ + x₂ = -b/a，x₁·x₂ = c/a",
      "extras": {
        "适用": "一元二次方程",
        "变量说明": "ax²+bx+c=0（a≠0）"
      }
    },
    {
      "id": "math-formulas-2-6",
      "question": "判别式",
      "answer": "Δ = b² - 4ac；Δ>0 两不等实根，Δ=0 两相等实根，Δ<0 无实根",
      "extras": {
        "适用": "一元二次方程",
        "变量说明": "ax²+bx+c=0（a≠0）"
      }
    },
    {
      "id": "math-formulas-2-7",
      "question": "点到直线距离",
      "answer": "d = |Ax₀ + By₀ + C| / √(A² + B²)",
      "extras": {
        "适用": "点 P(x₀,y₀) 到直线 Ax+By+C=0",
        "变量说明": "A、B、C 为直线系数"
      }
    },
    {
      "id": "math-formulas-2-8",
      "question": "两平行线距离",
      "answer": "d = |C₁ - C₂| / √(A² + B²)",
      "extras": {
        "适用": "平行线 Ax+By+C₁=0 与 Ax+By+C₂=0",
        "变量说明": "两线系数 A、B 相同"
      }
    },
    {
      "id": "math-formulas-2-9",
      "question": "向量点积",
      "answer": "a·b = |a||b|cosθ = x₁x₂ + y₁y₂",
      "extras": {
        "适用": "向量夹角与投影",
        "变量说明": "θ 为 a、b 夹角"
      }
    },
    {
      "id": "math-formulas-2-10",
      "question": "向量叉积的模",
      "answer": "|a×b| = |a||b|sinθ = |x₁y₂ - x₂y₁|",
      "extras": {
        "适用": "平行四边形面积",
        "变量说明": "结果与 a、b 张成的平行四边形面积相等"
      }
    },
    {
      "id": "math-formulas-2-11",
      "question": "正弦定理",
      "answer": "a/sinA = b/sinB = c/sinC = 2R",
      "extras": {
        "适用": "解三角形",
        "变量说明": "R 为外接圆半径"
      }
    },
    {
      "id": "math-formulas-2-12",
      "question": "余弦定理",
      "answer": "c² = a² + b² - 2ab·cosC",
      "extras": {
        "适用": "解三角形",
        "变量说明": "C 为边 c 的对角"
      }
    },
    {
      "id": "math-formulas-2-13",
      "question": "海伦公式",
      "answer": "S = √(p(p-a)(p-b)(p-c))，其中 p = (a+b+c)/2",
      "extras": {
        "适用": "已知三边求三角形面积",
        "变量说明": "p 为半周长"
      }
    },
    {
      "id": "math-formulas-2-14",
      "question": "椭圆标准方程",
      "answer": "x²/a² + y²/b² = 1（a>b>0）；离心率 e = c/a，c² = a² - b²",
      "extras": {
        "适用": "椭圆（焦点在 x 轴）",
        "变量说明": "e∈(0,1)，2a 为长轴长"
      }
    },
    {
      "id": "math-formulas-2-15",
      "question": "双曲线标准方程",
      "answer": "x²/a² - y²/b² = 1；离心率 e = c/a，c² = a² + b²",
      "extras": {
        "适用": "双曲线（焦点在 x 轴）",
        "变量说明": "e>1，2a 为实轴长"
      }
    },
    {
      "id": "math-formulas-2-16",
      "question": "抛物线标准方程",
      "answer": "y² = 2px（p>0）；焦点 (p/2, 0)，准线 x = -p/2",
      "extras": {
        "适用": "抛物线（开口向右）",
        "变量说明": "p 为焦点到准线距离的一半的 2 倍"
      }
    },
    {
      "id": "math-formulas-2-17",
      "question": "球体体积与表面积",
      "answer": "V = 4/3·πr³；S = 4πr²",
      "extras": {
        "适用": "球体",
        "变量说明": "r 为球半径"
      }
    },
    {
      "id": "math-formulas-2-18",
      "question": "圆台体积",
      "answer": "V = (1/3)·π·h·(R² + r² + Rr)",
      "extras": {
        "适用": "圆台",
        "变量说明": "R=上底半径, r=下底半径, h=高"
      }
    },
    {
      "id": "math-formulas-2-19",
      "question": "旋转体体积积分",
      "answer": "V = π∫[a,b] f(x)² dx",
      "extras": {
        "适用": "曲线绕 x 轴旋转所得体积",
        "变量说明": "f(x)≥0 于 [a,b] 上"
      }
    },
    {
      "id": "math-formulas-2-20",
      "question": "对数运算法则",
      "answer": "logₐ(MN) = logₐM + logₐN；logₐ(M/N) = logₐM - logₐN；logₐMⁿ = n·logₐM",
      "extras": {
        "适用": "对数化简与求值",
        "变量说明": "a>0 且 a≠1, M>0, N>0"
      }
    },
    {
      "id": "math-formulas-2-21",
      "question": "指数运算法则",
      "answer": "aᵐ⁺ⁿ = aᵐ·aⁿ；aᵐ⁻ⁿ = aᵐ/aⁿ；(aᵐ)ⁿ = aᵐⁿ",
      "extras": {
        "适用": "指数化简",
        "变量说明": "a>0"
      }
    },
    {
      "id": "math-formulas-2-22",
      "question": "排列数公式",
      "answer": "Aₙᵐ = n!/(n-m)!",
      "extras": {
        "适用": "排列（有序选取）",
        "变量说明": "m ≤ n"
      }
    },
    {
      "id": "math-formulas-2-23",
      "question": "组合数公式",
      "answer": "Cₙᵐ = n!/([m]!(n-m)!)",
      "extras": {
        "适用": "组合（无序选取）",
        "变量说明": "Aₙᵐ = Cₙᵐ·m!"
      }
    },
    {
      "id": "math-formulas-2-24",
      "question": "二项式定理",
      "answer": "(a+b)ⁿ = Σ Cₙᵏ·aⁿ⁻ᵏ·bᵏ（k=0..n）",
      "extras": {
        "适用": "多项式展开",
        "变量说明": "通项 T(k+1) = Cₙᵏ·aⁿ⁻ᵏ·bᵏ"
      }
    },
    {
      "id": "math-formulas-2-25",
      "question": "导数基本公式",
      "answer": "(xⁿ)' = n·xⁿ⁻¹；(sin x)' = cos x；(cos x)' = -sin x；(eˣ)' = eˣ；(aˣ)' = aˣ·ln a",
      "extras": {
        "适用": "求导",
        "变量说明": "n 为常数"
      }
    },
    {
      "id": "math-formulas-2-26",
      "question": "泰勒展开（eˣ 与 sin x）",
      "answer": "eˣ = 1 + x + x²/2! + x³/3! + … = Σ xⁿ/n!；sin x = x - x³/3! + x⁵/5! - …",
      "extras": {
        "适用": "函数级数展开",
        "变量说明": "收敛域均为全体实数"
      }
    },
    {
      "id": "math-formulas-2-27",
      "question": "条件概率与全概率",
      "answer": "P(A|B) = P(AB)/P(B)；P(A) = Σ P(A|Bᵢ)·P(Bᵢ)",
      "extras": {
        "适用": "概率计算",
        "变量说明": "Bᵢ 为完备事件组，P(B)>0"
      }
    },
    {
      "id": "math-formulas-2-28",
      "question": "贝叶斯公式",
      "answer": "P(Bᵢ|A) = P(A|Bᵢ)·P(Bᵢ) / Σ P(A|Bⱼ)·P(Bⱼ)",
      "extras": {
        "适用": "逆概率推断",
        "变量说明": "Bᵢ 为完备事件组，P(A)>0"
      }
    }
  ]
}

export default pack
