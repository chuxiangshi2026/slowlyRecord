// 预生成口语连读音频的定位工具
// 音频由 scripts/generate_speech_audio.py 离线生成，文件名与生成侧严格保持一致：
// md5(f"{voice}|{rate}|{归一化文本}")，归一化 = trim + 小写 + 连续空白折叠为单空格
import CryptoJS from "crypto-js";
import { getWordBankInfo, type WordBankType } from './wordbank-service';

// 与生成脚本默认参数一致；换音色/语速需重新生成全量音频并同步改这里
const SPEECH_VOICE = 'en-US-AvaNeural';
const SPEECH_RATE = '+5%';

export const normalizeSpeechText = (text: string): string =>
    text.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * 词库是否带预生成连读音频。
 */
export const isSpeechAudioBank = (bankId: string): boolean => {
    if (!bankId) return false;
    return !!getWordBankInfo(bankId as WordBankType)?.speechAudio;
};

/**
 * 预生成音频的内容哈希（含音色/语速/文本），同时用作音频缓存键：
 * 换音色或语速后哈希变化，旧缓存自动失效。
 */
export const getSpeechAudioHash = (bankId: string, text: string): string | null => {
    if (!text || !isSpeechAudioBank(bankId)) return null;
    return CryptoJS.MD5(`${SPEECH_VOICE}|${SPEECH_RATE}|${normalizeSpeechText(text)}`).toString();
};

/**
 * 词库带预生成连读音频（speechAudio）时返回音频 URL，否则返回 null。
 * URL 基于 public 目录相对路径，与词库 JSON 的加载方式一致。
 */
export const getSpeechAudioUrl = (bankId: string, text: string): string | null => {
    const hash = getSpeechAudioHash(bankId, text);
    if (!hash) return null;
    return `${import.meta.env.BASE_URL}speech-audio/${bankId}/${hash}.mp3`;
};
