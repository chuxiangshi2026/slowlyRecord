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
    autoNext?: boolean; // 发音结束后自动切换到下一个单词（标准模式）
    repeatCount?: number; // 每个单词自动发音遍数（1-3，拼写模式表示每个词发音几遍）
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
    /** 新词加入目标词库：current=当前词库（缺省），default=默认词库 */
    addWordTarget?: 'current' | 'default';
    /**
     * 主界面背景（三端页内生效）：
     * preset='' 无背景 / 'custom' 自定义图（图片本体存 app-bg-image 独立文档，不随 user-set 同步）/ 预设标识（对应 public/bg/<preset>.svg）；
     * scrim=遮罩浓度 0~1（护眼绿罩住背景的程度，越高越接近纯色底）；
     * acrylic=毛玻璃总开关；acrylicBlur=背景图片层模糊半径 px（默认 18，整体磨砂）；
     * cardBlur=卡片/列表叠加模糊半径 px（默认 12，列表区域比背景更糊一层；0 或 acrylic=off 时不挂）；
     * headerEffect/footerEffect=透明与亚克力是否作用于页头/底栏（默认 true，false 时对应区域回落实底色）
     */
    appBg?: { preset?: string; scrim?: number; acrylic?: boolean; acrylicBlur?: number; cardBlur?: number; headerEffect?: boolean; footerEffect?: boolean };
    /**
     * 定时任务（uTools 8.0+，低版本自动降级不显示）：
     * review=定时复习提醒，signin=防断签提醒，sync=WebDAV 定时自动备份（默认关，依赖 WebDAV 配置）；
     * reviewTimes=复习提醒时间点（缺省 ['09:00','21:00']），signinTimes=防断签时间点（缺省 ['05:30','06:30','08:30','09:30','22:30']，signinTime 为旧版单时间点字段仅作读取兜底）；
     * reviewRequested/signinRequested/syncRequested=对应任务已发起过系统创建请求（用户拒绝后不再重复弹窗骚扰）
     */
    scheduleReminder?: {
        review: boolean;
        signin: boolean;
        sync?: boolean;
        reviewTimes?: string[];
        signinTimes?: string[];
        signinTime?: string;
        reviewRequested?: boolean;
        signinRequested?: boolean;
        syncRequested?: boolean;
    };
}>;



