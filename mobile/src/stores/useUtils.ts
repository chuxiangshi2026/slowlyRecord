/**
 * 移动端工具模块 - 重导出入口
 * 仅保留主包页面需要的导出
 * 
 * ⚠️ 翻译引擎、OCR、截图适配器已迁移到分包目录
 *   - 翻译引擎: import from '@/subPackages/pages-tools/utils/translation'
 *   - OCR: import from '@/subPackages/pages-tools/utils/ocr'
 *   - 截图适配器: import from '@/subPackages/pages-tools/utils/capture'
 */

// 类型
export type { TranslationPlatform, TranslationResult, WordBankType, WordBankInfo, Word, LoadStrategy, OcrWordResult, MobileSyncBank, MobileSyncData, SyncResult, RestoreResult } from './useUtils/types'

// 词库
export { WORDBANK_LIST, DEFAULT_STRATEGY, loadWordBank, isWordBankCached, saveWordBankCache, getWordBankInfo, getAllWordBankInfo, downloadWordBank, clearWordBankCache, importWordsFromBank } from './useUtils/wordbank'

// 离线词典
export { queryOfflineDict, hasOfflineDict, getOfflineDictSize, queryPhoneticFromCache, getPronunciationUrl, playPronunciation } from './useUtils/offline-dict'

// 翻译设置（轻量，主包安全）
export { setTranslationPlatform, getTranslationPlatform, getTranslationApiKey, setTranslationApiKey, hasCustomTranslationApiKey, hasUsableTranslationApiKey, resolveEffectiveTranslationPlatform, TRANSLATION_PLATFORM_LINKS } from './useUtils/translation-settings'

// 同步和二维码已迁移到分包：
//   import { pushToServer } from '@/subPackages/pages-tools/utils/sync'
//   import { drawQrCode } from '@/subPackages/pages-tools/utils/qrcode'
