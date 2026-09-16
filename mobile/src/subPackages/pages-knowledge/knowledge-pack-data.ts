/**
 * 内置知识包数据模块（移动端）
 *
 * 静态 import 全部 knowledgebanks/*.ts 条目数据，并注册到 knowledge-pack-loader。
 * 仅在需要条目数据的页面（knowledge-detail / knowledge-practice / knowledge-table）引入；
 * 列表页只依赖 loader 的静态元数据清单（KNOWLEDGE_PACK_LIST），不解析任何条目数据。
 *
 * 本文件是生成数据（knowledgebanks/*.ts，由 mobile/scripts/convert-knowledgebanks.cjs 生成）
 * 与 loader 之间的注册桥接层；新增内置包时在下方补一行 import 与一条加载器映射。
 */
import type { KnowledgePack } from '@/stores/useUtils/types'
import { registerKnowledgePackData } from './utils/knowledge-pack-loader'
import multiplication9x9 from './knowledgebanks/multiplication-9x9'
import multiplication19x19 from './knowledgebanks/multiplication-19x19'
import elements from './knowledgebanks/elements'
import solarTerms24 from './knowledgebanks/solar-terms-24'
import zodiac12 from './knowledgebanks/zodiac-12'
import numberPegs12 from './knowledgebanks/number-pegs-12'
import homeRoute12 from './knowledgebanks/home-route-12'
import constellations12 from './knowledgebanks/constellations-12'
import ethnicGroups56 from './knowledgebanks/ethnic-groups-56'
import cuisines8 from './knowledgebanks/cuisines-8'
import provincesCapitals from './knowledgebanks/provinces-capitals'
import mathFormulas from './knowledgebanks/math-formulas'
import mathCalculus from './knowledgebanks/math-calculus'
import mathLinalg from './knowledgebanks/math-linalg'
import mathProbability from './knowledgebanks/math-probability'
import chemistryFormulas from './knowledgebanks/chemistry-formulas'
import physicsFormulas from './knowledgebanks/physics-formulas'
import physicsLaws from './knowledgebanks/physics-laws'
import physicsExperiments from './knowledgebanks/physics-experiments'
import biologyExperiments from './knowledgebanks/biology-experiments'
import geographyConcepts from './knowledgebanks/geography-concepts'
import bodyPegs12 from './knowledgebanks/body-pegs-12'
import earthlyBranches12 from './knowledgebanks/earthly-branches-12'
import roomPegs12 from './knowledgebanks/room-pegs-12'
import dynastiesChina from './knowledgebanks/dynasties-china'
import commonUnits from './knowledgebanks/common-units'
import colors12 from './knowledgebanks/colors-12'
import musicalNotes from './knowledgebanks/musical-notes'
import mathFormulas2 from './knowledgebanks/math-formulas-2'
import squaresCubesPowers from './knowledgebanks/squares-cubes-powers'
import primesUnder100 from './knowledgebanks/primes-under-100'
import pokerPegs52 from './knowledgebanks/poker-pegs-52'
import alphabetPegs26 from './knowledgebanks/alphabet-pegs-26'
import thirtySixStratagems from './knowledgebanks/thirty-six-stratagems'
import worldCapitals40 from './knowledgebanks/world-capitals-40'

const packDataLoaders: Record<string, () => KnowledgePack> = {
    'multiplication-9x9': () => multiplication9x9,
    'multiplication-19x19': () => multiplication19x19,
    'elements': () => elements,
    'solar-terms-24': () => solarTerms24,
    'zodiac-12': () => zodiac12,
    'number-pegs-12': () => numberPegs12,
    'home-route-12': () => homeRoute12,
    'constellations-12': () => constellations12,
    'ethnic-groups-56': () => ethnicGroups56,
    'cuisines-8': () => cuisines8,
    'provinces-capitals': () => provincesCapitals,
    'math-formulas': () => mathFormulas,
    'math-calculus': () => mathCalculus,
    'math-linalg': () => mathLinalg,
    'math-probability': () => mathProbability,
    'chemistry-formulas': () => chemistryFormulas,
    'physics-formulas': () => physicsFormulas,
    'physics-laws': () => physicsLaws,
    'physics-experiments': () => physicsExperiments,
    'biology-experiments': () => biologyExperiments,
    'geography-concepts': () => geographyConcepts,
    'body-pegs-12': () => bodyPegs12,
    'earthly-branches-12': () => earthlyBranches12,
    'room-pegs-12': () => roomPegs12,
    'dynasties-china': () => dynastiesChina,
    'common-units': () => commonUnits,
    'colors-12': () => colors12,
    'musical-notes': () => musicalNotes,
    'math-formulas-2': () => mathFormulas2,
    'squares-cubes-powers': () => squaresCubesPowers,
    'primes-under-100': () => primesUnder100,
    'poker-pegs-52': () => pokerPegs52,
    'alphabet-pegs-26': () => alphabetPegs26,
    'thirty-six-stratagems': () => thirtySixStratagems,
    'world-capitals-40': () => worldCapitals40,
}

registerKnowledgePackData(packDataLoaders)
