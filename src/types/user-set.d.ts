import type {MemoryFirmnessType} from "./words";

/*
* 加入单词后退出插件
* */
export interface ExitSwitchType {
    pluginStatus: boolean
}

/*
* 快捷键开关
* */
export interface ShortcutsSwitchType {
    shortcutEnabled: boolean
}

// 密钥
export type KeyType = Record<TranslationPlatform, {
    appkey: string;
    key: string;
}>;
export type OcrKeyType = Record<OcrPlatform, {
    appkey: string;
    key: string;
}>;

/**
 * 专注模式待处理动作
 */
export interface FocusModePendingAction {
    type: 'openWordList' | 'openDictation' | 'openTextMemory' | 'setAlwaysOnTop' | 'setEdgeStickEnabled' | 'restoreFromEdge' | 'expandFromEdge' | 'collapseToEdge' | 'setLocked' | 'focusLockWindow' | 'wordChanged' | string;
    payload?: any;
    at: number;
    /** 动作来源：'word'=单词专注模式，'text'=文本专注模式，用于父窗口区分处理 */
    source?: 'word' | 'text';
}

/**
 * 专注模式设置（存储窗口相关配置）
 */
export interface FocusModeSettings {
    alwaysOnTop: boolean;
    opacity: number; // 窗口透明度 0.3-1.0
    edgeStickEnabled: boolean; // 是否启用贴边隐藏
    fontColor: string; // 字体颜色，空值表示跟随主题
    fontSize: number; // 单词字号，单位 px
    explainFontSize: number; // 释义字号，单位 px
    backgroundImage: string; // 背景图片 data URL / URL，空值表示无背景
    backgroundImageOpacity: number; // 背景图片透明度 0-1
    locked?: boolean; // 锁定后内容区鼠标穿透
    pendingAction?: FocusModePendingAction;
}

/**
 * 输入法悬浮键盘设置
 */
export interface InputMethodHelperSettings {
    alwaysOnTop?: boolean;   // 是否置顶
    opacity?: number;        // 透明度 0.3-1.0
    locked?: boolean;        // 锁定后键盘区鼠标穿透（默认 true）
    pendingAction?: {
        type: 'setAlwaysOnTop' | 'setLocked' | 'closeHelper' | string;
        payload?: any;
        at: number;
        source?: 'input-method-helper';
    };
}



/**
 * 用户设置类型
 */
export type UserSetType = DbDoc<{
    pluginStatus: boolean;
    shortcutEnabled: boolean;
    translationPlatform: TranslationPlatform;
    ocrPlatform: OcrPlatform;
    memoryFirmness: MemoryFirmnessType;
    keys: KeyType;
    ocrKeys: OcrKeyType;
    focusMode: FocusModeSettings;
    /** 输入法悬浮键盘设置 */
    inputMethodHelper?: InputMethodHelperSettings;
    /** 主窗口透明度 (0.3 - 1.0)，仅 Electron 有效 */
    mainWindowOpacity: number;
    /** 选中单词时自动发音 */
    autoSpeak: boolean;
    /** 护眼模式（浅绿背景基底），默认开启 */
    eyeCare?: boolean;
}>;



