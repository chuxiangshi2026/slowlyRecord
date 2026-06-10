import type {MemoryFirmnessTpye} from "./words";

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
    type: 'openWordList' | 'openDictation' | 'setAlwaysOnTop' | 'setEdgeStickEnabled' | 'restoreFromEdge' | 'expandFromEdge' | 'collapseToEdge' | 'setLocked' | 'focusLockWindow' | 'wordChanged' | string;
    payload?: any;
    at: number;
}

/**
 * 专注模式设置（存储窗口相关配置）
 */
export interface FocusModeSettings {
    alwaysOnTop: boolean;
    opacity: number; // 窗口透明度 0.3-1.0
    edgeStickEnabled: boolean; // 是否启用贴边隐藏
    locked?: boolean; // 锁定后内容区鼠标穿透
    pendingAction?: FocusModePendingAction;
}



/**
 * 用户设置类型
 */
export type UserSetType = DbDoc<{
    pluginStatus: boolean;
    shortcutEnabled: boolean;
    translationPlatform: TranslationPlatform;
    ocrPlatform: OcrPlatform;
    memoryFirmness: MemoryFirmnessTpye;
    keys: KeyType;
    ocrKeys: OcrKeyType;
    focusMode: FocusModeSettings;
    /** 主窗口透明度 (0.3 - 1.0)，仅 Electron 有效 */
    mainWindowOpacity: number;
    /** 选中单词时自动发音 */
    autoSpeak: boolean;
}>;



