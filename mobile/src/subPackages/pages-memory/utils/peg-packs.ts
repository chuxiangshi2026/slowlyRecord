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
import constellations12 from '../../pages-knowledge/knowledgebanks/constellations-12'
// ===== 小容量桩库（2-11 桩），与 knowledge-pack-data.ts 同一生成来源 =====
import yinYang2 from '../../pages-knowledge/knowledgebanks/yin-yang-2'
import tianDi2 from '../../pages-knowledge/knowledgebanks/tian-di-2'
import dayNight2 from '../../pages-knowledge/knowledgebanks/day-night-2'
import leftRight2 from '../../pages-knowledge/knowledgebanks/left-right-2'
import upDown2 from '../../pages-knowledge/knowledgebanks/up-down-2'
import sanCai3 from '../../pages-knowledge/knowledgebanks/san-cai-3'
import sanGuang3 from '../../pages-knowledge/knowledgebanks/san-guang-3'
import threeTenses3 from '../../pages-knowledge/knowledgebanks/three-tenses-3'
import threePrimaryColors3 from '../../pages-knowledge/knowledgebanks/three-primary-colors-3'
import mengZhongJi3 from '../../pages-knowledge/knowledgebanks/meng-zhong-ji-3'
import fourSeasons4 from '../../pages-knowledge/knowledgebanks/four-seasons-4'
import fourDirections4 from '../../pages-knowledge/knowledgebanks/four-directions-4'
import fourSymbols4 from '../../pages-knowledge/knowledgebanks/four-symbols-4'
import fourGentlemen4 from '../../pages-knowledge/knowledgebanks/four-gentlemen-4'
import fourArts4 from '../../pages-knowledge/knowledgebanks/four-arts-4'
import fourElements4 from '../../pages-knowledge/knowledgebanks/four-elements-4'
import wuxing5 from '../../pages-knowledge/knowledgebanks/wuxing-5'
import fiveDirections5 from '../../pages-knowledge/knowledgebanks/five-directions-5'
import fiveColors5 from '../../pages-knowledge/knowledgebanks/five-colors-5'
import fiveFlavors5 from '../../pages-knowledge/knowledgebanks/five-flavors-5'
import fiveVirtues5 from '../../pages-knowledge/knowledgebanks/five-virtues-5'
import fiveTones5 from '../../pages-knowledge/knowledgebanks/five-tones-5'
import sixArts6 from '../../pages-knowledge/knowledgebanks/six-arts-6'
import liuShu6 from '../../pages-knowledge/knowledgebanks/liu-shu-6'
import sixRoots6 from '../../pages-knowledge/knowledgebanks/six-roots-6'
import liuHe6 from '../../pages-knowledge/knowledgebanks/liu-he-6'
import sixFu6 from '../../pages-knowledge/knowledgebanks/six-fu-6'
import liuLv6 from '../../pages-knowledge/knowledgebanks/liu-lv-6'
import qiYao7 from '../../pages-knowledge/knowledgebanks/qi-yao-7'
import bigDipper7 from '../../pages-knowledge/knowledgebanks/big-dipper-7'
import rainbow7 from '../../pages-knowledge/knowledgebanks/rainbow-7'
import jianpu7 from '../../pages-knowledge/knowledgebanks/jianpu-7'
import sevenEmotions7 from '../../pages-knowledge/knowledgebanks/seven-emotions-7'
import bagua8 from '../../pages-knowledge/knowledgebanks/bagua-8'
import eightImmortals8 from '../../pages-knowledge/knowledgebanks/eight-immortals-8'
import eightDirections8 from '../../pages-knowledge/knowledgebanks/eight-directions-8'
import eightSolarNodes8 from '../../pages-knowledge/knowledgebanks/eight-solar-nodes-8'
import baYin8 from '../../pages-knowledge/knowledgebanks/ba-yin-8'
import ninePlanets9 from '../../pages-knowledge/knowledgebanks/nine-planets-9'
import nineZhou9 from '../../pages-knowledge/knowledgebanks/nine-zhou-9'
import luoShu9 from '../../pages-knowledge/knowledgebanks/luo-shu-9'
import nineStars9 from '../../pages-knowledge/knowledgebanks/nine-stars-9'
import nineHeavens9 from '../../pages-knowledge/knowledgebanks/nine-heavens-9'
import heavenlyStems10 from '../../pages-knowledge/knowledgebanks/heavenly-stems-10'
import tenDirections10 from '../../pages-knowledge/knowledgebanks/ten-directions-10'
import tenFingers10 from '../../pages-knowledge/knowledgebanks/ten-fingers-10'
import tenMarshals10 from '../../pages-knowledge/knowledgebanks/ten-marshals-10'
import tenYama10 from '../../pages-knowledge/knowledgebanks/ten-yama-10'
import elevenLuminaries11 from '../../pages-knowledge/knowledgebanks/eleven-luminaries-11'
import footballXi11 from '../../pages-knowledge/knowledgebanks/football-xi-11'

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
  'constellations-12': constellations12,
  // 小容量桩库（2-11 桩）
  'yin-yang-2': yinYang2,
  'tian-di-2': tianDi2,
  'day-night-2': dayNight2,
  'left-right-2': leftRight2,
  'up-down-2': upDown2,
  'san-cai-3': sanCai3,
  'san-guang-3': sanGuang3,
  'three-tenses-3': threeTenses3,
  'three-primary-colors-3': threePrimaryColors3,
  'meng-zhong-ji-3': mengZhongJi3,
  'four-seasons-4': fourSeasons4,
  'four-directions-4': fourDirections4,
  'four-symbols-4': fourSymbols4,
  'four-gentlemen-4': fourGentlemen4,
  'four-arts-4': fourArts4,
  'four-elements-4': fourElements4,
  'wuxing-5': wuxing5,
  'five-directions-5': fiveDirections5,
  'five-colors-5': fiveColors5,
  'five-flavors-5': fiveFlavors5,
  'five-virtues-5': fiveVirtues5,
  'five-tones-5': fiveTones5,
  'six-arts-6': sixArts6,
  'liu-shu-6': liuShu6,
  'six-roots-6': sixRoots6,
  'liu-he-6': liuHe6,
  'six-fu-6': sixFu6,
  'liu-lv-6': liuLv6,
  'qi-yao-7': qiYao7,
  'big-dipper-7': bigDipper7,
  'rainbow-7': rainbow7,
  'jianpu-7': jianpu7,
  'seven-emotions-7': sevenEmotions7,
  'bagua-8': bagua8,
  'eight-immortals-8': eightImmortals8,
  'eight-directions-8': eightDirections8,
  'eight-solar-nodes-8': eightSolarNodes8,
  'ba-yin-8': baYin8,
  'nine-planets-9': ninePlanets9,
  'nine-zhou-9': nineZhou9,
  'luo-shu-9': luoShu9,
  'nine-stars-9': nineStars9,
  'nine-heavens-9': nineHeavens9,
  'heavenly-stems-10': heavenlyStems10,
  'ten-directions-10': tenDirections10,
  'ten-fingers-10': tenFingers10,
  'ten-marshals-10': tenMarshals10,
  'ten-yama-10': tenYama10,
  'eleven-luminaries-11': elevenLuminaries11,
  'football-xi-11': footballXi11,
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
