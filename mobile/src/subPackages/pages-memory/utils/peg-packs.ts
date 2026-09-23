/**
 * 记忆宫殿「导入桩库」数据源（pages-memory 分包）
 *
 * 桩库 = 桌面端 knowledge-pack-service.ts 中 usableAsPeg 标记的内置知识包。
 * 条目数据复用 pages-knowledge 分包的生成文件（mobile/scripts/convert-knowledgebanks.cjs 产物，请勿手改），
 * 这里按需静态 import 全部桩库；元数据清单复用 pages-knowledge 的 KNOWLEDGE_PACK_LIST 按 usableAsPeg 过滤，
 * 保证与知识包页单一来源、不会漂移。
 *
 * 注意：新增 usableAsPeg 桩库时，需先在 pages-knowledge/knowledge-pack-data.ts 注册生成数据
 * （跑 node mobile/scripts/convert-knowledgebanks.cjs <id>），再在下方补一条 import 与映射。
 */
import type { KnowledgePack, KnowledgePackInfo } from '@/stores/useUtils/types'
import { KNOWLEDGE_PACK_LIST } from '../../pages-knowledge/utils/knowledge-pack-loader'
import solarTerms24 from '../../pages-knowledge/knowledgebanks/solar-terms-24'
import zodiac12 from '../../pages-knowledge/knowledgebanks/zodiac-12'
import numberPegs12 from '../../pages-knowledge/knowledgebanks/number-pegs-12'
import homeRoute12 from '../../pages-knowledge/knowledgebanks/home-route-12'
import bodyPegs12 from '../../pages-knowledge/knowledgebanks/body-pegs-12'
import earthlyBranches12 from '../../pages-knowledge/knowledgebanks/earthly-branches-12'
import roomPegs12 from '../../pages-knowledge/knowledgebanks/room-pegs-12'
import dynastiesChina from '../../pages-knowledge/knowledgebanks/dynasties-china'
import musicalNotes from '../../pages-knowledge/knowledgebanks/musical-notes'
import pokerPegs52 from '../../pages-knowledge/knowledgebanks/poker-pegs-52'
import alphabetPegs26 from '../../pages-knowledge/knowledgebanks/alphabet-pegs-26'

/** 桩库 id → 条目数据（全部为 usableAsPeg 包，与 listPegPacks() 一一对应） */
const PEG_PACK_DATA: Record<string, KnowledgePack> = {
  'solar-terms-24': solarTerms24,
  'zodiac-12': zodiac12,
  'number-pegs-12': numberPegs12,
  'home-route-12': homeRoute12,
  'body-pegs-12': bodyPegs12,
  'earthly-branches-12': earthlyBranches12,
  'room-pegs-12': roomPegs12,
  'dynasties-china': dynastiesChina,
  'musical-notes': musicalNotes,
  'poker-pegs-52': pokerPegs52,
  'alphabet-pegs-26': alphabetPegs26,
}

/** 列出移动端可用的桩库元数据（usableAsPeg 的内置知识包） */
export function listPegPacks(): KnowledgePackInfo[] {
  return KNOWLEDGE_PACK_LIST
    .filter(p => p.usableAsPeg)
    .map(p => ({ ...p }))
}

/** 取桩库条目数据（未生成的桩库会抛错，属打包配置缺失而非运行期故障） */
export function getPegPack(id: string): KnowledgePack {
  const pack = PEG_PACK_DATA[id]
  if (!pack) {
    throw new Error(`[PegPack] 桩库数据未生成到移动端: ${id}（请跑 node mobile/scripts/convert-knowledgebanks.cjs ${id}）`)
  }
  return pack
}
