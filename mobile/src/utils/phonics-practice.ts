/**
 * 自然拼读练习抽题纯逻辑
 *
 * - 拼读（blending）练习：题目 = (规则, 例词)，先抽到期的规则（轻量 SRS），一轮内不重复
 * - 听音选词：从全部例词里为目标词选 3 个干扰项（优先同规则/同首块），凑成 4 选 1
 */
import { isPracticeDue } from './practice-srs'
import { ALL_PHONICS_RULES, type PhonicsExample, type PhonicsRule } from './phonics-data'

/** 一轮题数 */
export const ROUND_SIZE = 10

export type Rng = () => number

export interface PhonicsQuestion {
    rule: PhonicsRule
    example: PhonicsExample
}

export interface RuleProgressLike {
    level?: number
    nextReview?: number
}

/**
 * 抽拼读题：优先到期规则；规则数不足一轮时允许重复规则（例词尽量不同）
 * @param progress 规则 id → 进度（无进度视为到期新规则）
 */
export function pickBlendingQuestions(
    progress: (ruleId: string) => RuleProgressLike | undefined,
    count: number = ROUND_SIZE,
    rng: Rng = Math.random,
): PhonicsQuestion[] {
    const rules = [...ALL_PHONICS_RULES]
    const due = rules.filter((r) => isPracticeDue(progress(r.id)?.nextReview))
    const picked: PhonicsQuestion[] = []
    const usedRules = new Set<string>()
    const usedWords = new Set<string>()
    const pool = due.length > 0 ? due : rules

    while (picked.length < count) {
        let candidates = pool.filter((r) => !usedRules.has(r.id))
        if (candidates.length === 0) {
            usedRules.clear()
            candidates = pool
        }
        const rule = candidates[Math.floor(rng() * candidates.length)]
        let examples = rule.examples.filter((e) => !usedWords.has(e.word))
        if (examples.length === 0) examples = rule.examples
        const example = examples[Math.floor(rng() * examples.length)]
        picked.push({ rule, example })
        usedRules.add(rule.id)
        usedWords.add(example.word)
    }
    return picked
}

/**
 * 为听音选词构造 4 个选项（含目标词）。
 * 干扰项优先：同规则的其它例词 → 同首块的词 → 随机词。
 * 返回乱序后的选项，目标词位置由调用方从返回值里找。
 */
export function buildListenOptions(
    target: PhonicsQuestion,
    optionCount: number = 4,
    rng: Rng = Math.random,
): PhonicsExample[] {
    const all = ALL_PHONICS_RULES.flatMap((r) => r.examples.map((example) => ({ rule: r, example })))
    const isTarget = (w: string) => w === target.example.word
    const sameRule = all.filter((x) => x.rule.id === target.rule.id && !isTarget(x.example.word))
    const sameFirstBlock = all.filter(
        (x) => x.rule.id !== target.rule.id && x.example.blocks[0] === target.example.blocks[0] && !isTarget(x.example.word),
    )
    const rest = all.filter(
        (x) => x.rule.id !== target.rule.id && x.example.blocks[0] !== target.example.blocks[0] && !isTarget(x.example.word),
    )
    const picked: PhonicsExample[] = [target.example]
    const seen = new Set<string>([target.example.word])
    for (const group of [sameRule, sameFirstBlock, rest]) {
        const shuffled = [...group].sort(() => rng() - 0.5)
        for (const item of shuffled) {
            if (picked.length >= optionCount) break
            if (seen.has(item.example.word)) continue
            seen.add(item.example.word)
            picked.push(item.example)
        }
        if (picked.length >= optionCount) break
    }
    return picked.sort(() => rng() - 0.5)
}

/** 拼读块的发音文本：块是规则 id 时用音素代理串（更准），否则直接读原串 */
export function blockSoundText(block: string, articulationOf: (ipa: string) => string | undefined): string {
    const rule = ALL_PHONICS_RULES.find((r) => r.id === block)
    if (rule) return articulationOf(rule.ipa) ?? block
    return block
}

/** 块的展示字形：magic-e 块 'a_e' → 'a-e'，其余原样 */
function displayBlockOf(block: string): string {
    return ALL_PHONICS_RULES.find((r) => r.id === block)?.grapheme ?? block
}

/** 正确分块标注，如 sh-o-p / c-a-e-k */
export function correctSplitOf(example: PhonicsExample): string {
    return example.blocks.map(displayBlockOf).join('-')
}

/**
 * 看词分块：构造 3 个切分选项（含正确答案）。
 * 干扰项：全字母拆开 + 前两块合并；不足时用后两块合并补齐。去重并乱序。
 */
export function buildSplitOptions(q: PhonicsQuestion, rng: Rng = Math.random): string[] {
    const answer = correctSplitOf(q.example)
    const word = q.example.word.replace(/[^a-zA-Z]/g, '')
    const distractors: string[] = []
    // 干扰项 1：全字母拆开
    distractors.push(word.split('').join('-'))
    // 干扰项 2/3：合并相邻块
    const blocks = q.example.blocks.map(displayBlockOf)
    if (blocks.length >= 3) {
        distractors.push([blocks[0] + blocks[1], ...blocks.slice(2)].join('-'))
        distractors.push([...blocks.slice(0, -2), blocks[blocks.length - 2] + blocks[blocks.length - 1]].join('-'))
    } else if (blocks.length === 2) {
        distractors.push(blocks.join(''))
    }
    const options = [answer]
    for (const d of distractors) {
        if (options.length >= 3) break
        if (d !== answer && !options.includes(d)) options.push(d)
    }
    return options.sort(() => rng() - 0.5)
}
