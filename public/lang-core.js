/**
 * 多语言核心逻辑（单一实现，双端共享）
 *
 * 本文件是纯 JS、零依赖、无模块语法，通过两种方式被消费：
 *   1. Vue 主应用：index.html 以 <script src="lang-core.js"> 加载，
 *      src/utils/language/text.ts 仅做 TS 类型封装后调用 window.LangCore
 *   2. public/focus.html（专注模式独立窗口）：直接 <script src="lang-core.js">
 *
 * 修改本文件即同时改变两端行为，请勿在别处复制实现。
 */
(function (global) {
  'use strict';

  var DEFAULT_LANG = 'en';

  /** 各语言配置档案 */
  var PROFILES = {
    en: {
      code: 'en', name: 'English', nameZh: '英语',
      ttsLang: 'en-US', edgeVoice: 'en-US-AnaNeural',
      youdaoVoiceType: 1,
      script: 'latin', sortLocale: 'en',
      caseInsensitive: true, spellUnit: 'letter',
      ocrLang: 'eng', hasAffixData: true, hasLocalDict: true
    },
    ja: {
      code: 'ja', name: '日本語', nameZh: '日语',
      ttsLang: 'ja-JP', edgeVoice: 'ja-JP-NanamiNeural',
      youdaoVoiceType: null,
      script: 'japanese', sortLocale: 'ja',
      caseInsensitive: false, spellUnit: 'grapheme',
      ocrLang: 'jpn', hasAffixData: false, hasLocalDict: false
    },
    ru: {
      code: 'ru', name: 'Русский', nameZh: '俄语',
      ttsLang: 'ru-RU', edgeVoice: 'ru-RU-SvetlanaNeural',
      youdaoVoiceType: null,
      script: 'cyrillic', sortLocale: 'ru',
      caseInsensitive: true, spellUnit: 'letter',
      ocrLang: 'rus', hasAffixData: false, hasLocalDict: false
    },
    es: {
      code: 'es', name: 'Español', nameZh: '西班牙语',
      ttsLang: 'es-ES', edgeVoice: 'es-ES-ElviraNeural',
      youdaoVoiceType: null,
      script: 'latin', sortLocale: 'es',
      caseInsensitive: true, spellUnit: 'letter',
      ocrLang: 'spa', hasAffixData: false, hasLocalDict: false
    },
    fr: {
      code: 'fr', name: 'Français', nameZh: '法语',
      ttsLang: 'fr-FR', edgeVoice: 'fr-FR-DeniseNeural',
      youdaoVoiceType: null,
      script: 'latin', sortLocale: 'fr',
      caseInsensitive: true, spellUnit: 'letter',
      ocrLang: 'fra', hasAffixData: false, hasLocalDict: false
    }
  };

  var LANG_CODES = ['en', 'ja', 'ru', 'es', 'fr'];

  function getProfile(lang) {
    return PROFILES[lang] || PROFILES[DEFAULT_LANG];
  }

  function isValidLang(lang) {
    return Object.prototype.hasOwnProperty.call(PROFILES, lang);
  }

  // ---------- 字符集 ----------

  // 拉丁/西里尔词素：Unicode 字母(含重音组合符)+数字，允许内部连字符/撇号
  var LETTER_TOKEN_RE = /[\p{L}\p{M}0-9]+(?:[-'][\p{L}\p{M}0-9]+)*/gu;
  // CJK/假名：用于判定"非拉丁系文本"
  var CJK_RE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;
  // 日语词允许字符：汉字/假名/长音符/中点/拉丁字母/数字
  var JA_WORD_RE = /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}A-Za-z0-9ー・]+$/u;
  // 日语分词降级用的"词素连跑"正则
  var JA_RUN_RE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー]+[0-9]*/gu;

  var _segmenters = {};
  function getSegmenter(lang, granularity) {
    if (typeof Intl === 'undefined' || typeof Intl.Segmenter !== 'function') return null;
    var key = lang + '|' + granularity;
    if (!_segmenters[key]) {
      try {
        _segmenters[key] = new Intl.Segmenter(lang, { granularity: granularity });
      } catch (e) {
        _segmenters[key] = null;
      }
    }
    return _segmenters[key];
  }

  /**
   * 判断文本是否可作为"单词/词条"收录（按语言字符集）
   */
  function isWordText(text, profile) {
    if (!text) return false;
    var t = text.trim();
    if (!t) return false;
    if (profile.script === 'japanese') {
      if (/\s/.test(t)) return false;
      if (!CJK_RE.test(t)) return false;
      return JA_WORD_RE.test(t);
    }
    // 拉丁/西里尔：不允许混入 CJK（防止把日文收进英文词库）
    if (CJK_RE.test(t)) return false;
    if (!/[\p{L}]/u.test(t)) return false;
    return /^[\p{L}\p{M}0-9]+(?:[-'\s][\p{L}\p{M}0-9]+)*$/u.test(t);
  }

  /**
   * 从文本提取候选词（保留原大小写）
   */
  function tokenize(text, profile) {
    if (!text) return [];
    if (profile.script === 'japanese') {
      var seg = getSegmenter(profile.sortLocale, 'word');
      if (seg) {
        var out = [];
        var it = seg.segment(text)[Symbol.iterator]();
        var step;
        while (!(step = it.next()).done) {
          if (step.value.isWordLike) out.push(step.value.segment);
        }
        return out;
      }
      // 降级：按汉字/假名连跑切分
      return text.match(JA_RUN_RE) || [];
    }
    var matches = text.match(LETTER_TOKEN_RE) || [];
    return matches.filter(function (token) { return /[\p{L}]/u.test(token); });
  }

  /**
   * 词数（拉丁/西里尔按空格，日语按分词器）
   */
  function wordCount(text, profile) {
    if (!text) return 0;
    var normalized = text.trim().replace(/\s+/g, ' ');
    if (!normalized) return 0;
    if (profile.script === 'japanese') {
      return tokenize(normalized, profile).length;
    }
    return normalized.split(/\s+/).length;
  }

  /**
   * 是否词组（拉丁/西里尔看空格；日语看分词数量）
   */
  function isPhraseText(text, profile) {
    if (!text) return false;
    if (profile.script === 'japanese') {
      if (/\s/.test(text.trim())) return true;
      return wordCount(text, profile) > 1;
    }
    return text.trim().replace(/\s+/g, ' ').indexOf(' ') >= 0;
  }

  /**
   * 比对用规范化：NFC + 折叠空格 + 按语言决定是否小写化
   */
  function normalizeForCompare(text, profile) {
    if (!text) return '';
    var t = text.normalize ? text.normalize('NFC') : text;
    t = t.trim().replace(/\s+/g, ' ');
    return profile.caseInsensitive ? t.toLowerCase() : t;
  }

  /**
   * 按语言排序
   */
  function compareWords(a, b, profile) {
    return (a || '').localeCompare(b || '', profile.sortLocale);
  }

  /**
   * 听写/拼写切分单位
   * letter: 按码位（Array.from，对 BMP 内英文与 split('') 等价）
   * grapheme: Intl.Segmenter 字素，并把小假名（ゃゅょ等）并入前一个单位
   *           （きゃ/しゅ/ちょ 在听写中是一个音节单位）
   */
  var JA_SMALL_KANA_RE = /^[ぁぃぅぇぉゃゅょゎァィゥェォャュョヮ]$/;
  function splitSpellUnits(text, profile) {
    if (!text) return [];
    if (profile.spellUnit === 'grapheme') {
      var seg = getSegmenter(profile.sortLocale, 'grapheme');
      var raw = null;
      if (seg) {
        raw = [];
        var it = seg.segment(text)[Symbol.iterator]();
        var step;
        while (!(step = it.next()).done) raw.push(step.value.segment);
      } else {
        raw = Array.from(text);
      }
      // 小假名并入前一个单位
      var merged = [];
      for (var i = 0; i < raw.length; i++) {
        if (merged.length > 0 && JA_SMALL_KANA_RE.test(raw[i])) {
          merged[merged.length - 1] += raw[i];
        } else {
          merged.push(raw[i]);
        }
      }
      return merged;
    }
    return Array.from(text);
  }

  /**
   * 拼写模式单键是否有效（focus.html 逐键输入用）
   * 英语保持原有 /^[a-zA-Z]$/ 行为不变
   */
  function isSpellChar(ch, profile) {
    if (!ch || ch.length !== 1) return false;
    if (profile.code === 'en') return /^[a-zA-Z]$/.test(ch);
    if (profile.script === 'japanese') return false; // 日语禁用拼写模式（IME 无法逐键拦截）
    return /^[\p{L}]$/u.test(ch);
  }

  /**
   * 该语言是否支持拼写模式
   */
  function supportsSpelling(profile) {
    return profile.script !== 'japanese';
  }

  global.LangCore = {
    DEFAULT_LANG: DEFAULT_LANG,
    LANG_CODES: LANG_CODES,
    PROFILES: PROFILES,
    getProfile: getProfile,
    isValidLang: isValidLang,
    isWordText: isWordText,
    tokenize: tokenize,
    wordCount: wordCount,
    isPhraseText: isPhraseText,
    normalizeForCompare: normalizeForCompare,
    compareWords: compareWords,
    splitSpellUnits: splitSpellUnits,
    isSpellChar: isSpellChar,
    supportsSpelling: supportsSpelling
  };
})(typeof window !== 'undefined' ? window : globalThis);
