import type { ShortcutItem, ShortcutCategory, CustomCategoryDoc, CategoryConfigMap } from "@/types/shortcut-memory";
import { getAllCustomShortcuts, getAllCustomCategories, getHiddenCategories } from "@/utils/shortcut-memory-db";

/**
 * 分类配置映射（描述和图标）
 */
export const CATEGORY_CONFIG: CategoryConfigMap = {
  'Windows': { description: 'Windows 操作系统常用快捷键', icon: '🪟' },
  'VS Code': { description: 'Visual Studio Code 编辑器快捷键', icon: '📝' },
  'Chrome': { description: 'Chrome 浏览器快捷键', icon: '🌐' },
  'IntelliJ IDEA': { description: 'IntelliJ IDEA 开发工具快捷键', icon: '☕' },
  'Claude Code CLI': { description: 'Claude Code 命令行交互快捷键', icon: '🤖' },
  'Photoshop': { description: 'Adobe Photoshop 图像处理快捷键', icon: '🎨' },
  'Vim': { description: 'Vim 文本编辑器常用快捷键', icon: '🧙' },
  'Illustrator': { description: 'Adobe Illustrator 矢量设计快捷键', icon: '✒️' },
  'CAD': { description: 'AutoCAD 工程制图常用快捷键', icon: '📐' },
  'Obsidian': { description: 'Obsidian 笔记软件常用快捷键', icon: '📝' },
  '思源笔记': { description: '思源笔记本地块级笔记快捷键', icon: '📔' },
  'Word': { description: 'Microsoft Word 文档编辑快捷键', icon: '📘' },
  'Excel': { description: 'Microsoft Excel 表格处理快捷键', icon: '📗' },
  'PowerPoint': { description: 'Microsoft PowerPoint 演示文稿快捷键', icon: '📙' },
  'Outlook': { description: 'Microsoft Outlook 邮件与日程快捷键', icon: '📧' },
  '五笔86版': { description: '五笔输入法86版字根键位练习（逐个字根）', icon: '🖊️' },
  '五笔98版': { description: '五笔输入法98版字根键位练习（逐个字根）', icon: '✒️' },
  '双拼 · 小鹤': { description: '小鹤双拼声韵母键位练习', icon: '🕊️' },
  '双拼 · 自然码': { description: '自然码双拼声韵母键位练习', icon: '🌿' },
  '双拼 · 微软': { description: '微软双拼声韵母键位练习', icon: '🪟' },
  '双拼 · 搜狗': { description: '搜狗双拼声韵母键位练习', icon: '🐾' },
  '键位练习': { description: '随机练习键盘上的任意按键', icon: '⌨️' },
  '数字小键盘练习': { description: '专门练习数字小键盘区域按键', icon: '🔢' }
};

/**
 * 键位显示名称映射
 */
const KEY_DISPLAY_MAP: Record<string, string> = {
  'esc': 'Esc', 'f1': 'F1', 'f2': 'F2', 'f3': 'F3', 'f4': 'F4', 'f5': 'F5',
  'f6': 'F6', 'f7': 'F7', 'f8': 'F8', 'f9': 'F9', 'f10': 'F10', 'f11': 'F11', 'f12': 'F12',
  'tab': 'Tab', 'capslock': 'Caps Lock', 'enter': 'Enter', 'shift': 'Shift',
  'ctrl': 'Ctrl', 'alt': 'Alt', 'win': 'Win', 'space': 'Space',
  'backspace': 'Backspace', 'ins': 'Ins', 'del': 'Del',
  'home': 'Home', 'end': 'End', 'pageup': 'PgUp', 'pagedown': 'PgDn',
  'up': '↑', 'down': '↓', 'left': '←', 'right': '→',
  'numlock': 'NumLock', 'numpaddivide': '/', 'numpadmultiply': '*',
  'numpadsubtract': '-', 'numpadadd': '+', 'numpadenter': 'Enter',
  'numpaddecimal': '.', 'numpad0': '0', 'numpad1': '1', 'numpad2': '2',
  'numpad3': '3', 'numpad4': '4', 'numpad5': '5', 'numpad6': '6',
  'numpad7': '7', 'numpad8': '8', 'numpad9': '9',
};

/**
 * 键位练习默认键列表（不含数字小键盘键）
 */
export const DEFAULT_KEYBOARD_PRACTICE_KEYS = [
  'esc', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12',
  '`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', 'backspace',
  'tab', 'q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '[', ']', '\\',
  'capslock', 'a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', "'", 'enter',
  'shift', 'z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/',
  'ctrl', 'win', 'alt', 'space',
  'ins', 'home', 'pageup', 'del', 'end', 'pagedown',
  'up', 'left', 'down', 'right'
];

/**
 * 数字小键盘练习默认键列表
 */
export const DEFAULT_NUMPAD_PRACTICE_KEYS = [
  'numlock', 'numpaddivide', 'numpadmultiply', 'numpadsubtract',
  'numpad7', 'numpad8', 'numpad9', 'numpadadd',
  'numpad4', 'numpad5', 'numpad6',
  'numpad1', 'numpad2', 'numpad3',
  'numpadenter', 'numpad0', 'numpaddecimal'
];

/**
 * 根据默认键列表生成分类练习数据
 */
function generatePracticeItems(category: string, keys: string[], prefix: string): ShortcutItem[] {
  return keys.map((key, index) => {
    const display = KEY_DISPLAY_MAP[key] || key.toUpperCase();
    return {
      id: `${prefix}-${index}`,
      category,
      functionName: `请按下 ${display} 键`,
      description: `认识并按下 ${display} 键`,
      keys: [key],
      platform: 'common'
    };
  });
}

/**
 * 内置预设快捷键数据（作为 fallback）
 */
export const PRESET_SHORTCUTS: ShortcutItem[] = [
  { id: 'win-1', category: 'Windows', functionName: '复制', description: '复制选中的内容到剪贴板', keys: ['Ctrl', 'C'], platform: 'win' },
  { id: 'win-2', category: 'Windows', functionName: '粘贴', description: '将剪贴板内容粘贴到当前位置', keys: ['Ctrl', 'V'], platform: 'win' },
  { id: 'win-3', category: 'Windows', functionName: '剪切', description: '剪切选中的内容到剪贴板', keys: ['Ctrl', 'X'], platform: 'win' },
  { id: 'win-4', category: 'Windows', functionName: '撤销', description: '撤销上一步操作', keys: ['Ctrl', 'Z'], platform: 'win' },
  { id: 'win-5', category: 'Windows', functionName: '保存', description: '保存当前文件', keys: ['Ctrl', 'S'], platform: 'win' },
  { id: 'win-6', category: 'Windows', functionName: '全选', description: '选中当前页面或窗口中的所有内容', keys: ['Ctrl', 'A'], platform: 'win' },
  { id: 'win-7', category: 'Windows', functionName: '查找', description: '在当前页面或文档中查找内容', keys: ['Ctrl', 'F'], platform: 'win' },
  { id: 'win-8', category: 'Windows', functionName: '打印', description: '打开打印对话框', keys: ['Ctrl', 'P'], platform: 'win' },
  { id: 'win-9', category: 'Windows', functionName: '新建', description: '新建文件或窗口', keys: ['Ctrl', 'N'], platform: 'win' },
  { id: 'win-10', category: 'Windows', functionName: '打开', description: '打开文件对话框', keys: ['Ctrl', 'O'], platform: 'win' },
  { id: 'win-11', category: 'Windows', functionName: '关闭窗口', description: '关闭当前窗口', keys: ['Alt', 'F4'], platform: 'win' },
  { id: 'win-12', category: 'Windows', functionName: '切换窗口', description: '在打开的应用之间切换', keys: ['Alt', 'Tab'], platform: 'win' },
  { id: 'win-13', category: 'Windows', functionName: '锁定电脑', description: '锁定计算机屏幕', keys: ['Win', 'L'], platform: 'win' },
  { id: 'win-14', category: 'Windows', functionName: '打开资源管理器', description: '打开文件资源管理器', keys: ['Win', 'E'], platform: 'win' },
  { id: 'win-15', category: 'Windows', functionName: '显示桌面', description: '最小化所有窗口显示桌面', keys: ['Win', 'D'], platform: 'win' },
  { id: 'win-16', category: 'Windows', functionName: '截图', description: '打开截图工具', keys: ['Win', 'Shift', 'S'], platform: 'win' },
  { id: 'win-17', category: 'Windows', functionName: '任务管理器', description: '打开任务管理器', keys: ['Ctrl', 'Shift', 'Esc'], platform: 'win' },
  { id: 'win-18', category: 'Windows', functionName: '刷新', description: '刷新当前页面或窗口', keys: ['F5'], platform: 'win' },
  { id: 'win-19', category: 'Windows', functionName: '重命名', description: '重命名选中的文件或文件夹', keys: ['F2'], platform: 'win' },
  { id: 'win-20', category: 'Windows', functionName: '新建文件夹', description: '新建文件夹', keys: ['Ctrl', 'Shift', 'N'], platform: 'win' },
  { id: 'win-21', category: 'Windows', functionName: '运行', description: '打开运行对话框', keys: ['Win', 'R'], platform: 'win' },
  { id: 'win-22', category: 'Windows', functionName: '设置', description: '打开Windows设置', keys: ['Win', 'I'], platform: 'win' },
  { id: 'win-23', category: 'Windows', functionName: '搜索', description: '打开Windows搜索', keys: ['Win', 'S'], platform: 'win' },
  { id: 'win-24', category: 'Windows', functionName: '多任务视图', description: '打开多任务视图', keys: ['Win', 'Tab'], platform: 'win' },
  { id: 'win-25', category: 'Windows', functionName: '撤销关闭标签', description: '在浏览器中恢复刚关闭的标签页', keys: ['Ctrl', 'Shift', 'T'], platform: 'win' },

  { id: 'vscode-1', category: 'VS Code', functionName: '命令面板', description: '打开命令面板，快速执行命令', keys: ['Ctrl', 'Shift', 'P'], platform: 'common' },
  { id: 'vscode-2', category: 'VS Code', functionName: '快速打开文件', description: '通过文件名快速打开文件', keys: ['Ctrl', 'P'], platform: 'common' },
  { id: 'vscode-3', category: 'VS Code', functionName: '多光标选择', description: '在下一个匹配处添加光标', keys: ['Ctrl', 'D'], platform: 'common' },
  { id: 'vscode-4', category: 'VS Code', functionName: '格式化代码', description: '格式化当前文档或选中的代码', keys: ['Shift', 'Alt', 'F'], platform: 'common' },
  { id: 'vscode-5', category: 'VS Code', functionName: '切换注释', description: '注释或取消注释当前行', keys: ['Ctrl', '/'], platform: 'common' },
  { id: 'vscode-6', category: 'VS Code', functionName: '跳转行', description: '跳转到指定行号', keys: ['Ctrl', 'G'], platform: 'common' },
  { id: 'vscode-7', category: 'VS Code', functionName: '全局搜索', description: '在工作区所有文件中搜索', keys: ['Ctrl', 'Shift', 'F'], platform: 'common' },
  { id: 'vscode-8', category: 'VS Code', functionName: '切换侧边栏', description: '显示或隐藏侧边栏', keys: ['Ctrl', 'B'], platform: 'common' },
  { id: 'vscode-9', category: 'VS Code', functionName: '拆分编辑器', description: '将当前编辑器拆分为两个', keys: ['Ctrl', '\\'], platform: 'common' },
  { id: 'vscode-10', category: 'VS Code', functionName: '关闭编辑器', description: '关闭当前编辑器标签', keys: ['Ctrl', 'W'], platform: 'common' },
  { id: 'vscode-11', category: 'VS Code', functionName: '转到定义', description: '跳转到符号的定义位置', keys: ['F12'], platform: 'common' },
  { id: 'vscode-12', category: 'VS Code', functionName: '重命名符号', description: '重构重命名当前符号', keys: ['F2'], platform: 'common' },
  { id: 'vscode-13', category: 'VS Code', functionName: '展开/折叠', description: '折叠或展开代码块', keys: ['Ctrl', 'Shift', '['], platform: 'common' },
  { id: 'vscode-14', category: 'VS Code', functionName: '移动行', description: '将当前行向上移动', keys: ['Alt', 'Up'], platform: 'common' },
  { id: 'vscode-15', category: 'VS Code', functionName: '复制行', description: '向下复制当前行', keys: ['Shift', 'Alt', 'Down'], platform: 'common' },
  { id: 'vscode-16', category: 'VS Code', functionName: '终端', description: '打开或关闭集成终端', keys: ['Ctrl', '`'], platform: 'common' },
  { id: 'vscode-17', category: 'VS Code', functionName: '新建终端', description: '创建新的终端实例', keys: ['Ctrl', 'Shift', '`'], platform: 'common' },
  { id: 'vscode-18', category: 'VS Code', functionName: '转到文件', description: '快速导航到文件中的符号', keys: ['Ctrl', 'Shift', 'O'], platform: 'common' },
  { id: 'vscode-19', category: 'VS Code', functionName: '显示问题', description: '打开问题面板查看错误和警告', keys: ['Ctrl', 'Shift', 'M'], platform: 'common' },
  { id: 'vscode-20', category: 'VS Code', functionName: 'Emmet展开', description: '展开 Emmet 缩写', keys: ['Tab'], platform: 'common' },
  { id: 'vscode-21', category: 'VS Code', functionName: '查找替换', description: '在当前文件中查找并替换', keys: ['Ctrl', 'H'], platform: 'common' },
  { id: 'vscode-22', category: 'VS Code', functionName: '撤销', description: '撤销上一步操作', keys: ['Ctrl', 'Z'], platform: 'common' },
  { id: 'vscode-23', category: 'VS Code', functionName: '重做', description: '重做被撤销的操作', keys: ['Ctrl', 'Shift', 'Z'], platform: 'common' },
  { id: 'vscode-24', category: 'VS Code', functionName: '保存全部', description: '保存所有打开的文件', keys: ['Ctrl', 'K', 'S'], platform: 'common' },
  { id: 'vscode-25', category: 'VS Code', functionName: 'Zen模式', description: '进入禅模式全屏编辑', keys: ['Ctrl', 'K', 'Z'], platform: 'common' },

  { id: 'chrome-1', category: 'Chrome', functionName: '新标签页', description: '打开一个新的浏览器标签页', keys: ['Ctrl', 'T'], platform: 'common' },
  { id: 'chrome-2', category: 'Chrome', functionName: '关闭标签页', description: '关闭当前标签页', keys: ['Ctrl', 'W'], platform: 'common' },
  { id: 'chrome-3', category: 'Chrome', functionName: '恢复标签页', description: '重新打开刚关闭的标签页', keys: ['Ctrl', 'Shift', 'T'], platform: 'common' },
  { id: 'chrome-4', category: 'Chrome', functionName: '下一个标签页', description: '切换到右侧的标签页', keys: ['Ctrl', 'Tab'], platform: 'common' },
  { id: 'chrome-5', category: 'Chrome', functionName: '上一个标签页', description: '切换到左侧的标签页', keys: ['Ctrl', 'Shift', 'Tab'], platform: 'common' },
  { id: 'chrome-6', category: 'Chrome', functionName: '地址栏', description: '聚焦到地址栏', keys: ['Ctrl', 'L'], platform: 'common' },
  { id: 'chrome-7', category: 'Chrome', functionName: '刷新', description: '刷新当前页面', keys: ['Ctrl', 'R'], platform: 'common' },
  { id: 'chrome-8', category: 'Chrome', functionName: '强制刷新', description: '强制刷新页面并清除缓存', keys: ['Ctrl', 'Shift', 'R'], platform: 'common' },
  { id: 'chrome-9', category: 'Chrome', functionName: '开发者工具', description: '打开或关闭开发者工具', keys: ['F12'], platform: 'common' },
  { id: 'chrome-10', category: 'Chrome', functionName: '无痕窗口', description: '打开新的无痕浏览窗口', keys: ['Ctrl', 'Shift', 'N'], platform: 'common' },
  { id: 'chrome-11', category: 'Chrome', functionName: '书签', description: '为当前页面添加书签', keys: ['Ctrl', 'D'], platform: 'common' },
  { id: 'chrome-12', category: 'Chrome', functionName: '历史记录', description: '打开历史记录页面', keys: ['Ctrl', 'H'], platform: 'common' },
  { id: 'chrome-13', category: 'Chrome', functionName: '下载内容', description: '打开下载内容页面', keys: ['Ctrl', 'J'], platform: 'common' },
  { id: 'chrome-14', category: 'Chrome', functionName: '查找', description: '在页面中查找内容', keys: ['Ctrl', 'F'], platform: 'common' },
  { id: 'chrome-15', category: 'Chrome', functionName: '全屏', description: '切换全屏模式', keys: ['F11'], platform: 'common' },
  { id: 'chrome-16', category: 'Chrome', functionName: '放大', description: '放大页面内容', keys: ['Ctrl', '+'], platform: 'common' },
  { id: 'chrome-17', category: 'Chrome', functionName: '缩小', description: '缩小页面内容', keys: ['Ctrl', '-'], platform: 'common' },
  { id: 'chrome-18', category: 'Chrome', functionName: '恢复缩放', description: '将页面缩放恢复为默认', keys: ['Ctrl', '0'], platform: 'common' },
  { id: 'chrome-19', category: 'Chrome', functionName: '另存为', description: '保存当前网页到本地', keys: ['Ctrl', 'S'], platform: 'common' },
  { id: 'chrome-20', category: 'Chrome', functionName: '打印', description: '打印当前网页', keys: ['Ctrl', 'P'], platform: 'common' },
  { id: 'chrome-21', category: 'Chrome', functionName: '查看源码', description: '查看页面源代码', keys: ['Ctrl', 'U'], platform: 'common' },
  { id: 'chrome-22', category: 'Chrome', functionName: '开发者控制台', description: '打开开发者工具控制台', keys: ['Ctrl', 'Shift', 'J'], platform: 'common' },
  { id: 'chrome-23', category: 'Chrome', functionName: '切换第1个标签', description: '切换到第1个标签页', keys: ['Ctrl', '1'], platform: 'common' },
  { id: 'chrome-24', category: 'Chrome', functionName: '切换到最后标签', description: '切换到最后一个标签页', keys: ['Ctrl', '9'], platform: 'common' },
  { id: 'chrome-25', category: 'Chrome', functionName: '清除浏览数据', description: '打开清除浏览数据对话框', keys: ['Ctrl', 'Shift', 'Delete'], platform: 'common' },

  { id: 'idea-1', category: 'IntelliJ IDEA', functionName: '查找类', description: '通过类名查找并打开类文件', keys: ['Ctrl', 'N'], platform: 'common' },
  { id: 'idea-2', category: 'IntelliJ IDEA', functionName: '查找文件', description: '通过文件名查找任意文件', keys: ['Ctrl', 'Shift', 'N'], platform: 'common' },
  { id: 'idea-3', category: 'IntelliJ IDEA', functionName: '查找符号', description: '查找任意符号（类、方法、变量等）', keys: ['Ctrl', 'Alt', 'Shift', 'N'], platform: 'common' },
  { id: 'idea-4', category: 'IntelliJ IDEA', functionName: '转到定义', description: '跳转到光标下符号的定义', keys: ['Ctrl', 'B'], platform: 'common' },
  { id: 'idea-5', category: 'IntelliJ IDEA', functionName: '实现方法', description: '查看接口或抽象类的实现', keys: ['Ctrl', 'Alt', 'B'], platform: 'common' },
  { id: 'idea-6', category: 'IntelliJ IDEA', functionName: '重构重命名', description: '安全地重命名符号', keys: ['Shift', 'F6'], platform: 'common' },
  { id: 'idea-7', category: 'IntelliJ IDEA', functionName: '提取变量', description: '将选中的表达式提取为变量', keys: ['Ctrl', 'Alt', 'V'], platform: 'common' },
  { id: 'idea-8', category: 'IntelliJ IDEA', functionName: '提取方法', description: '将选中的代码提取为方法', keys: ['Ctrl', 'Alt', 'M'], platform: 'common' },
  { id: 'idea-9', category: 'IntelliJ IDEA', functionName: '智能补全', description: '基于上下文的智能代码补全', keys: ['Ctrl', 'Shift', 'Space'], platform: 'common' },
  { id: 'idea-10', category: 'IntelliJ IDEA', functionName: '快速修复', description: '显示当前问题的快速修复建议', keys: ['Alt', 'Enter'], platform: 'common' },
  { id: 'idea-11', category: 'IntelliJ IDEA', functionName: '格式化代码', description: '格式化当前文件或选中的代码', keys: ['Ctrl', 'Alt', 'L'], platform: 'common' },
  { id: 'idea-12', category: 'IntelliJ IDEA', functionName: '优化导入', description: '自动优化并整理 import 语句', keys: ['Ctrl', 'Alt', 'O'], platform: 'common' },
  { id: 'idea-13', category: 'IntelliJ IDEA', functionName: 'Surround With', description: '用 if、try-catch 等包裹选中的代码', keys: ['Ctrl', 'Alt', 'T'], platform: 'common' },
  { id: 'idea-14', category: 'IntelliJ IDEA', functionName: '生成代码', description: '生成 getter、setter、构造器等代码', keys: ['Alt', 'Insert'], platform: 'common' },
  { id: 'idea-15', category: 'IntelliJ IDEA', functionName: '运行', description: '运行当前配置', keys: ['Shift', 'F10'], platform: 'common' },
  { id: 'idea-16', category: 'IntelliJ IDEA', functionName: '调试', description: '以调试模式运行当前配置', keys: ['Shift', 'F9'], platform: 'common' },
  { id: 'idea-17', category: 'IntelliJ IDEA', functionName: '单步跳过', description: '执行当前行并进入下一行', keys: ['F8'], platform: 'common' },
  { id: 'idea-18', category: 'IntelliJ IDEA', functionName: '单步进入', description: '进入当前行调用的方法内部', keys: ['F7'], platform: 'common' },
  { id: 'idea-19', category: 'IntelliJ IDEA', functionName: '注释代码', description: '注释或取消注释当前行或选中代码', keys: ['Ctrl', '/'], platform: 'common' },
  { id: 'idea-20', category: 'IntelliJ IDEA', functionName: '最近文件', description: '显示最近打开的文件列表', keys: ['Ctrl', 'E'], platform: 'common' },
  { id: 'idea-21', category: 'IntelliJ IDEA', functionName: '扩展选择', description: '扩大当前选中的代码范围', keys: ['Ctrl', 'W'], platform: 'common' },
  { id: 'idea-22', category: 'IntelliJ IDEA', functionName: '缩小选择', description: '缩小当前选中的代码范围', keys: ['Ctrl', 'Shift', 'W'], platform: 'common' },
  { id: 'idea-23', category: 'IntelliJ IDEA', functionName: '查找动作', description: '通过名称查找并执行动作', keys: ['Ctrl', 'Shift', 'A'], platform: 'common' },
  { id: 'idea-24', category: 'IntelliJ IDEA', functionName: '文件结构', description: '弹出当前文件结构（类/方法列表）', keys: ['Ctrl', 'F12'], platform: 'common' },
  { id: 'idea-25', category: 'IntelliJ IDEA', functionName: '复制路径', description: '复制当前文件的完整路径', keys: ['Ctrl', 'Shift', 'C'], platform: 'common' },
  { id: 'idea-26', category: 'IntelliJ IDEA', functionName: '查找用法', description: '查找符号在项目中的所有使用位置', keys: ['Alt', 'F7'], platform: 'common' },
  { id: 'idea-27', category: 'IntelliJ IDEA', functionName: '全局搜索', description: 'Search Everywhere 全局搜索一切', keys: ['Shift', 'Shift'], platform: 'common' },
  { id: 'idea-28', category: 'IntelliJ IDEA', functionName: '补全语句', description: '补全当前语句（自动加分号/括号）', keys: ['Ctrl', 'Shift', 'Enter'], platform: 'common' },
  { id: 'idea-29', category: 'IntelliJ IDEA', functionName: '下方新行', description: '从当前行任意位置在下方开始新行', keys: ['Shift', 'Enter'], platform: 'common' },
  { id: 'idea-30', category: 'IntelliJ IDEA', functionName: '最大化编辑器', description: '切换编辑器最大化（隐藏工具窗口）', keys: ['Ctrl', 'Shift', 'F12'], platform: 'common' },

  // Photoshop 快捷键
  { id: 'ps-1', category: 'Photoshop', functionName: '新建', description: '创建新的图像文档', keys: ['Ctrl', 'N'], platform: 'common' },
  { id: 'ps-2', category: 'Photoshop', functionName: '打开', description: '打开已有的图像文件', keys: ['Ctrl', 'O'], platform: 'common' },
  { id: 'ps-3', category: 'Photoshop', functionName: '保存', description: '保存当前文档', keys: ['Ctrl', 'S'], platform: 'common' },
  { id: 'ps-4', category: 'Photoshop', functionName: '另存为', description: '将文档另存为新文件', keys: ['Ctrl', 'Shift', 'S'], platform: 'common' },
  { id: 'ps-5', category: 'Photoshop', functionName: '撤销', description: '撤销上一步操作', keys: ['Ctrl', 'Z'], platform: 'common' },
  { id: 'ps-6', category: 'Photoshop', functionName: '重做', description: '重做被撤销的操作', keys: ['Ctrl', 'Shift', 'Z'], platform: 'common' },
  { id: 'ps-7', category: 'Photoshop', functionName: '剪切', description: '剪切选区内容到剪贴板', keys: ['Ctrl', 'X'], platform: 'common' },
  { id: 'ps-8', category: 'Photoshop', functionName: '复制', description: '复制选区内容到剪贴板', keys: ['Ctrl', 'C'], platform: 'common' },
  { id: 'ps-9', category: 'Photoshop', functionName: '粘贴', description: '粘贴剪贴板内容', keys: ['Ctrl', 'V'], platform: 'common' },
  { id: 'ps-10', category: 'Photoshop', functionName: '自由变换', description: '对图层进行自由变换', keys: ['Ctrl', 'T'], platform: 'common' },
  { id: 'ps-11', category: 'Photoshop', functionName: '取消选区', description: '取消当前的选区', keys: ['Ctrl', 'D'], platform: 'common' },
  { id: 'ps-12', category: 'Photoshop', functionName: '反向选择', description: '反选当前选区', keys: ['Ctrl', 'Shift', 'I'], platform: 'common' },
  { id: 'ps-13', category: 'Photoshop', functionName: '全选', description: '选中整个画布', keys: ['Ctrl', 'A'], platform: 'common' },
  { id: 'ps-14', category: 'Photoshop', functionName: '羽化', description: '对选区边缘进行羽化处理', keys: ['Shift', 'F6'], platform: 'common' },
  { id: 'ps-15', category: 'Photoshop', functionName: '填充前景色', description: '用前景色填充选区或图层', keys: ['Alt', 'Delete'], platform: 'common' },
  { id: 'ps-16', category: 'Photoshop', functionName: '填充背景色', description: '用背景色填充选区或图层', keys: ['Ctrl', 'Delete'], platform: 'common' },
  { id: 'ps-17', category: 'Photoshop', functionName: '色阶', description: '打开色阶调整对话框', keys: ['Ctrl', 'L'], platform: 'common' },
  { id: 'ps-18', category: 'Photoshop', functionName: '曲线', description: '打开曲线调整对话框', keys: ['Ctrl', 'M'], platform: 'common' },
  { id: 'ps-19', category: 'Photoshop', functionName: '色相/饱和度', description: '打开色相饱和度调整', keys: ['Ctrl', 'U'], platform: 'common' },
  { id: 'ps-20', category: 'Photoshop', functionName: '色彩平衡', description: '打开色彩平衡调整', keys: ['Ctrl', 'B'], platform: 'common' },
  { id: 'ps-21', category: 'Photoshop', functionName: '液化', description: '打开液化滤镜对话框', keys: ['Ctrl', 'Shift', 'X'], platform: 'common' },
  { id: 'ps-22', category: 'Photoshop', functionName: '放大画布', description: '放大显示画布', keys: ['Ctrl', '+'], platform: 'common' },
  { id: 'ps-23', category: 'Photoshop', functionName: '缩小画布', description: '缩小显示画布', keys: ['Ctrl', '-'], platform: 'common' },
  { id: 'ps-24', category: 'Photoshop', functionName: '实际像素', description: '以100%比例显示图像', keys: ['Ctrl', '1'], platform: 'common' },
  { id: 'ps-25', category: 'Photoshop', functionName: '抓手工具', description: '临时切换到抓手工具移动画布', keys: ['Space'], platform: 'common' },
  { id: 'ps-26', category: 'Photoshop', functionName: '移动工具', description: '切换到移动工具', keys: ['V'], platform: 'common' },
  { id: 'ps-27', category: 'Photoshop', functionName: '选框工具', description: '切换到矩形选框工具', keys: ['M'], platform: 'common' },
  { id: 'ps-28', category: 'Photoshop', functionName: '画笔工具', description: '切换到画笔工具', keys: ['B'], platform: 'common' },
  { id: 'ps-29', category: 'Photoshop', functionName: '橡皮擦工具', description: '切换到橡皮擦工具', keys: ['E'], platform: 'common' },
  { id: 'ps-30', category: 'Photoshop', functionName: '撤销多步', description: '连续撤销多步操作', keys: ['Ctrl', 'Alt', 'Z'], platform: 'common' },

  // Vim 快捷键
  { id: 'vim-1', category: 'Vim', functionName: '返回 normal 模式', description: '从插入/可视模式返回 normal 模式', keys: ['Esc'], platform: 'common' },
  { id: 'vim-2', category: 'Vim', functionName: '插入模式', description: '在光标处进入插入模式', keys: ['I'], platform: 'common' },
  { id: 'vim-3', category: 'Vim', functionName: '光标后插入', description: '在光标后进入插入模式', keys: ['A'], platform: 'common' },
  { id: 'vim-4', category: 'Vim', functionName: '下方新行', description: '在光标下方插入新行并进入插入模式', keys: ['O'], platform: 'common' },
  { id: 'vim-5', category: 'Vim', functionName: '可视模式', description: '进入字符可视模式', keys: ['V'], platform: 'common' },
  { id: 'vim-6', category: 'Vim', functionName: '粘贴', description: '在光标后粘贴剪贴板内容', keys: ['P'], platform: 'common' },
  { id: 'vim-7', category: 'Vim', functionName: '撤销', description: '撤销上一步操作', keys: ['U'], platform: 'common' },
  { id: 'vim-8', category: 'Vim', functionName: '删除字符', description: '删除光标处字符', keys: ['X'], platform: 'common' },
  { id: 'vim-9', category: 'Vim', functionName: '替换字符', description: '替换光标处单个字符', keys: ['R'], platform: 'common' },
  { id: 'vim-10', category: 'Vim', functionName: '重复修改', description: '重复上次修改操作', keys: ['.'], platform: 'common' },
  { id: 'vim-11', category: 'Vim', functionName: '左移', description: '光标向左移动一个字符', keys: ['H'], platform: 'common' },
  { id: 'vim-12', category: 'Vim', functionName: '下移', description: '光标向下移动一行', keys: ['J'], platform: 'common' },
  { id: 'vim-13', category: 'Vim', functionName: '上移', description: '光标向上移动一行', keys: ['K'], platform: 'common' },
  { id: 'vim-14', category: 'Vim', functionName: '右移', description: '光标向右移动一个字符', keys: ['L'], platform: 'common' },
  { id: 'vim-15', category: 'Vim', functionName: '下一个单词', description: '光标跳到下一个单词开头', keys: ['W'], platform: 'common' },
  { id: 'vim-16', category: 'Vim', functionName: '上一个单词', description: '光标跳到上一个单词开头', keys: ['B'], platform: 'common' },
  { id: 'vim-17', category: 'Vim', functionName: '单词尾部', description: '光标跳到当前单词尾部', keys: ['E'], platform: 'common' },
  { id: 'vim-18', category: 'Vim', functionName: '下一个搜索', description: '跳到下一个搜索结果', keys: ['N'], platform: 'common' },
  { id: 'vim-19', category: 'Vim', functionName: '重复搜索', description: '重复上次字符搜索', keys: [';'], platform: 'common' },
  { id: 'vim-20', category: 'Vim', functionName: '反向搜索', description: '反向重复上次字符搜索', keys: [','], platform: 'common' },
  { id: 'vim-21', category: 'Vim', functionName: '行首', description: '光标跳到行首', keys: ['0'], platform: 'common' },
  { id: 'vim-22', category: 'Vim', functionName: '自动缩进', description: '对选区或行自动缩进', keys: ['='], platform: 'common' },
  { id: 'vim-23', category: 'Vim', functionName: '搜索', description: '进入搜索模式', keys: ['/'], platform: 'common' },
  { id: 'vim-24', category: 'Vim', functionName: '重做', description: '重做被撤销的操作', keys: ['Ctrl', 'R'], platform: 'common' },
  { id: 'vim-25', category: 'Vim', functionName: '跳到文件尾', description: '光标跳到文件最后一行', keys: ['G'], platform: 'common' },

  // Illustrator 快捷键
  { id: 'ai-1', category: 'Illustrator', functionName: '选择工具', description: '切换到选择工具', keys: ['V'], platform: 'common' },
  { id: 'ai-2', category: 'Illustrator', functionName: '直接选择工具', description: '切换到直接选择工具', keys: ['A'], platform: 'common' },
  { id: 'ai-3', category: 'Illustrator', functionName: '矩形工具', description: '切换到矩形工具', keys: ['M'], platform: 'common' },
  { id: 'ai-4', category: 'Illustrator', functionName: '椭圆工具', description: '切换到椭圆工具', keys: ['L'], platform: 'common' },
  { id: 'ai-5', category: 'Illustrator', functionName: '钢笔工具', description: '切换到钢笔工具', keys: ['P'], platform: 'common' },
  { id: 'ai-6', category: 'Illustrator', functionName: '文字工具', description: '切换到文字工具', keys: ['T'], platform: 'common' },
  { id: 'ai-7', category: 'Illustrator', functionName: '吸管工具', description: '切换到吸管工具吸取颜色', keys: ['I'], platform: 'common' },
  { id: 'ai-8', category: 'Illustrator', functionName: '新建', description: '新建文档', keys: ['Ctrl', 'N'], platform: 'common' },
  { id: 'ai-9', category: 'Illustrator', functionName: '打开', description: '打开已有文件', keys: ['Ctrl', 'O'], platform: 'common' },
  { id: 'ai-10', category: 'Illustrator', functionName: '保存', description: '保存当前文档', keys: ['Ctrl', 'S'], platform: 'common' },
  { id: 'ai-11', category: 'Illustrator', functionName: '撤销', description: '撤销上一步操作', keys: ['Ctrl', 'Z'], platform: 'common' },
  { id: 'ai-12', category: 'Illustrator', functionName: '重做', description: '重做被撤销的操作', keys: ['Ctrl', 'Shift', 'Z'], platform: 'common' },
  { id: 'ai-13', category: 'Illustrator', functionName: '复制', description: '复制选中对象到剪贴板', keys: ['Ctrl', 'C'], platform: 'common' },
  { id: 'ai-14', category: 'Illustrator', functionName: '粘贴', description: '粘贴剪贴板内容', keys: ['Ctrl', 'V'], platform: 'common' },
  { id: 'ai-15', category: 'Illustrator', functionName: '原位粘贴', description: '在原始位置粘贴对象', keys: ['Ctrl', 'Shift', 'V'], platform: 'common' },
  { id: 'ai-16', category: 'Illustrator', functionName: '编组', description: '将选中对象编组', keys: ['Ctrl', 'G'], platform: 'common' },
  { id: 'ai-17', category: 'Illustrator', functionName: '取消编组', description: '取消选中对象的编组', keys: ['Ctrl', 'Shift', 'G'], platform: 'common' },
  { id: 'ai-18', category: 'Illustrator', functionName: '锁定', description: '锁定所选对象', keys: ['Ctrl', '2'], platform: 'common' },
  { id: 'ai-19', category: 'Illustrator', functionName: '再次变换', description: '重复上一次变换操作', keys: ['Ctrl', 'D'], platform: 'common' },
  { id: 'ai-20', category: 'Illustrator', functionName: '轮廓模式', description: '切换轮廓/预览显示模式', keys: ['Ctrl', 'Y'], platform: 'common' },
  { id: 'ai-21', category: 'Illustrator', functionName: '建立剪贴蒙版', description: '用上层对象建立剪贴蒙版', keys: ['Ctrl', '7'], platform: 'common' },
  { id: 'ai-22', category: 'Illustrator', functionName: '创建轮廓', description: '将文字转换为可编辑路径', keys: ['Ctrl', 'Shift', 'O'], platform: 'common' },
  { id: 'ai-23', category: 'Illustrator', functionName: '置于顶层', description: '将选中对象移到最上层', keys: ['Ctrl', 'Shift', ']'], platform: 'common' },
  { id: 'ai-24', category: 'Illustrator', functionName: '适合窗口', description: '将画面缩放至适合窗口大小', keys: ['Ctrl', '0'], platform: 'common' },
  { id: 'ai-25', category: 'Illustrator', functionName: '切换填充/描边', description: '切换填充和描边的编辑状态', keys: ['X'], platform: 'common' },

  // CAD 快捷键
  { id: 'cad-1', category: 'CAD', functionName: '直线', description: '绘制直线', keys: ['L'], platform: 'common' },
  { id: 'cad-2', category: 'CAD', functionName: '圆', description: '绘制圆', keys: ['C'], platform: 'common' },
  { id: 'cad-3', category: 'CAD', functionName: '矩形', description: '绘制矩形', keys: ['REC'], platform: 'common' },
  { id: 'cad-4', category: 'CAD', functionName: '多边形', description: '绘制正多边形', keys: ['POL'], platform: 'common' },
  { id: 'cad-5', category: 'CAD', functionName: '移动', description: '移动选中对象', keys: ['M'], platform: 'common' },
  { id: 'cad-6', category: 'CAD', functionName: '复制', description: '复制选中对象', keys: ['CO'], platform: 'common' },
  { id: 'cad-7', category: 'CAD', functionName: '旋转', description: '旋转选中对象', keys: ['RO'], platform: 'common' },
  { id: 'cad-8', category: 'CAD', functionName: '缩放', description: '缩放选中对象', keys: ['SC'], platform: 'common' },
  { id: 'cad-9', category: 'CAD', functionName: '镜像', description: '镜像复制选中对象', keys: ['MI'], platform: 'common' },
  { id: 'cad-10', category: 'CAD', functionName: '修剪', description: '修剪对象到边界', keys: ['TR'], platform: 'common' },
  { id: 'cad-11', category: 'CAD', functionName: '延伸', description: '延伸对象到边界', keys: ['EX'], platform: 'common' },
  { id: 'cad-12', category: 'CAD', functionName: '偏移', description: '创建等距偏移对象', keys: ['O'], platform: 'common' },
  { id: 'cad-13', category: 'CAD', functionName: '阵列', description: '创建对象阵列', keys: ['AR'], platform: 'common' },
  { id: 'cad-14', category: 'CAD', functionName: '拉伸', description: '拉伸对象', keys: ['S'], platform: 'common' },
  { id: 'cad-15', category: 'CAD', functionName: '倒角', description: '为对象添加倒角', keys: ['CHA'], platform: 'common' },
  { id: 'cad-16', category: 'CAD', functionName: '圆角', description: '为对象添加圆角', keys: ['F'], platform: 'common' },
  { id: 'cad-17', category: 'CAD', functionName: '打断', description: '在两点之间打断对象', keys: ['BR'], platform: 'common' },
  { id: 'cad-18', category: 'CAD', functionName: '删除', description: '删除选中对象', keys: ['E'], platform: 'common' },
  { id: 'cad-19', category: 'CAD', functionName: '撤销', description: '撤销上一步操作', keys: ['Ctrl', 'Z'], platform: 'common' },
  { id: 'cad-20', category: 'CAD', functionName: '重做', description: '重做被撤销的操作', keys: ['Ctrl', 'Y'], platform: 'common' },
  { id: 'cad-21', category: 'CAD', functionName: '特性匹配', description: '将源对象特性复制到目标对象', keys: ['MA'], platform: 'common' },
  { id: 'cad-22', category: 'CAD', functionName: '全选', description: '选中全部对象', keys: ['Ctrl', 'A'], platform: 'common' },
  { id: 'cad-23', category: 'CAD', functionName: '保存', description: '保存当前图纸', keys: ['Ctrl', 'S'], platform: 'common' },
  { id: 'cad-24', category: 'CAD', functionName: '正交模式', description: '开启/关闭正交模式', keys: ['F8'], platform: 'common' },
  { id: 'cad-25', category: 'CAD', functionName: '对象捕捉', description: '开启/关闭对象捕捉', keys: ['F3'], platform: 'common' },

  // Obsidian 快捷键
  { id: 'obsidian-1', category: 'Obsidian', functionName: '命令面板', description: '打开命令面板，快速执行命令', keys: ['Ctrl', 'P'], platform: 'common' },
  { id: 'obsidian-2', category: 'Obsidian', functionName: '快速打开', description: '快速打开文件或跳转到标题', keys: ['Ctrl', 'O'], platform: 'common' },
  { id: 'obsidian-3', category: 'Obsidian', functionName: '新建笔记', description: '创建新的笔记文件', keys: ['Ctrl', 'N'], platform: 'common' },
  { id: 'obsidian-4', category: 'Obsidian', functionName: '保存文件', description: '保存当前笔记', keys: ['Ctrl', 'S'], platform: 'common' },
  { id: 'obsidian-5', category: 'Obsidian', functionName: '关闭当前标签', description: '关闭当前打开的标签页', keys: ['Ctrl', 'W'], platform: 'common' },
  { id: 'obsidian-6', category: 'Obsidian', functionName: '删除当前文件', description: '删除当前笔记文件', keys: ['Delete'], platform: 'common' },
  { id: 'obsidian-7', category: 'Obsidian', functionName: '搜索', description: '在所有文件中搜索内容', keys: ['Ctrl', 'Shift', 'F'], platform: 'common' },
  { id: 'obsidian-8', category: 'Obsidian', functionName: '替换', description: '在当前文件中查找替换', keys: ['Ctrl', 'H'], platform: 'common' },
  { id: 'obsidian-9', category: 'Obsidian', functionName: '切换编辑/预览', description: '在编辑模式和预览模式间切换', keys: ['Ctrl', 'E'], platform: 'common' },
  { id: 'obsidian-10', category: 'Obsidian', functionName: '切换侧边栏', description: '显示或隐藏左侧边栏', keys: ['Ctrl', 'B'], platform: 'common' },
  { id: 'obsidian-11', category: 'Obsidian', functionName: '切换右侧边栏', description: '显示或隐藏右侧边栏', keys: ['Ctrl', 'Shift', 'R'], platform: 'common' },
  { id: 'obsidian-12', category: 'Obsidian', functionName: '新建标签页', description: '新建一个标签页', keys: ['Ctrl', 'T'], platform: 'common' },
  { id: 'obsidian-13', category: 'Obsidian', functionName: '切换到上一个标签', description: '切换到左侧标签页', keys: ['Ctrl', 'Shift', 'Tab'], platform: 'common' },
  { id: 'obsidian-14', category: 'Obsidian', functionName: '切换到下一个标签', description: '切换到右侧标签页', keys: ['Ctrl', 'Tab'], platform: 'common' },
  { id: 'obsidian-15', category: 'Obsidian', functionName: '分割面板', description: '将当前面板向右分割', keys: ['Ctrl', '\\'], platform: 'common' },
  { id: 'obsidian-16', category: 'Obsidian', functionName: '撤销', description: '撤销上一步操作', keys: ['Ctrl', 'Z'], platform: 'common' },
  { id: 'obsidian-17', category: 'Obsidian', functionName: '重做', description: '重做被撤销的操作', keys: ['Ctrl', 'Shift', 'Z'], platform: 'common' },
  { id: 'obsidian-18', category: 'Obsidian', functionName: '复制', description: '复制选中的内容', keys: ['Ctrl', 'C'], platform: 'common' },
  { id: 'obsidian-19', category: 'Obsidian', functionName: '粘贴', description: '粘贴剪贴板内容', keys: ['Ctrl', 'V'], platform: 'common' },
  { id: 'obsidian-20', category: 'Obsidian', functionName: '剪切', description: '剪切选中的内容', keys: ['Ctrl', 'X'], platform: 'common' },
  { id: 'obsidian-21', category: 'Obsidian', functionName: '全选', description: '选中所有内容', keys: ['Ctrl', 'A'], platform: 'common' },
  { id: 'obsidian-22', category: 'Obsidian', functionName: '加粗', description: '将选中文本加粗', keys: ['Ctrl', 'B'], platform: 'common' },
  { id: 'obsidian-23', category: 'Obsidian', functionName: '斜体', description: '将选中文本设为斜体', keys: ['Ctrl', 'I'], platform: 'common' },
  { id: 'obsidian-24', category: 'Obsidian', functionName: '插入链接', description: '插入或编辑链接', keys: ['Ctrl', 'K'], platform: 'common' },
  { id: 'obsidian-25', category: 'Obsidian', functionName: '插入代码块', description: '插入代码块', keys: ['Ctrl', 'Shift', 'C'], platform: 'common' },
  { id: 'obsidian-26', category: 'Obsidian', functionName: '切换复选框', description: '切换任务列表复选框状态', keys: ['Ctrl', 'Enter'], platform: 'common' },
  { id: 'obsidian-27', category: 'Obsidian', functionName: '向上移动行', description: '将当前行向上移动', keys: ['Alt', 'Up'], platform: 'common' },
  { id: 'obsidian-28', category: 'Obsidian', functionName: '向下移动行', description: '将当前行向下移动', keys: ['Alt', 'Down'], platform: 'common' },
  { id: 'obsidian-29', category: 'Obsidian', functionName: '折叠', description: '折叠当前标题或列表', keys: ['Ctrl', 'Shift', '['], platform: 'common' },
  { id: 'obsidian-30', category: 'Obsidian', functionName: '展开', description: '展开当前标题或列表', keys: ['Ctrl', 'Shift', ']'], platform: 'common' },

  // Word 快捷键
  { id: 'word-1', category: 'Word', functionName: '新建文档', description: '创建新的Word文档', keys: ['Ctrl', 'N'], platform: 'common' },
  { id: 'word-2', category: 'Word', functionName: '打开文档', description: '打开已有文档', keys: ['Ctrl', 'O'], platform: 'common' },
  { id: 'word-3', category: 'Word', functionName: '保存', description: '保存当前文档', keys: ['Ctrl', 'S'], platform: 'common' },
  { id: 'word-4', category: 'Word', functionName: '另存为', description: '将文档另存为新文件', keys: ['F12'], platform: 'common' },
  { id: 'word-5', category: 'Word', functionName: '打印', description: '打开打印对话框', keys: ['Ctrl', 'P'], platform: 'common' },
  { id: 'word-6', category: 'Word', functionName: '关闭文档', description: '关闭当前文档', keys: ['Ctrl', 'W'], platform: 'common' },
  { id: 'word-7', category: 'Word', functionName: '撤销', description: '撤销上一步操作', keys: ['Ctrl', 'Z'], platform: 'common' },
  { id: 'word-8', category: 'Word', functionName: '重做', description: '重做被撤销的操作', keys: ['Ctrl', 'Y'], platform: 'common' },
  { id: 'word-9', category: 'Word', functionName: '复制', description: '复制选中的内容', keys: ['Ctrl', 'C'], platform: 'common' },
  { id: 'word-10', category: 'Word', functionName: '粘贴', description: '粘贴剪贴板内容', keys: ['Ctrl', 'V'], platform: 'common' },
  { id: 'word-11', category: 'Word', functionName: '加粗', description: '将选中文本加粗', keys: ['Ctrl', 'B'], platform: 'common' },
  { id: 'word-12', category: 'Word', functionName: '斜体', description: '将选中文本设为斜体', keys: ['Ctrl', 'I'], platform: 'common' },
  { id: 'word-13', category: 'Word', functionName: '下划线', description: '为选中文本添加下划线', keys: ['Ctrl', 'U'], platform: 'common' },
  { id: 'word-14', category: 'Word', functionName: '居中对齐', description: '将段落居中对齐', keys: ['Ctrl', 'E'], platform: 'common' },
  { id: 'word-15', category: 'Word', functionName: '左对齐', description: '将段落左对齐', keys: ['Ctrl', 'L'], platform: 'common' },
  { id: 'word-16', category: 'Word', functionName: '右对齐', description: '将段落右对齐', keys: ['Ctrl', 'R'], platform: 'common' },
  { id: 'word-17', category: 'Word', functionName: '两端对齐', description: '将段落两端对齐', keys: ['Ctrl', 'J'], platform: 'common' },
  { id: 'word-18', category: 'Word', functionName: '全选', description: '选中整个文档内容', keys: ['Ctrl', 'A'], platform: 'common' },
  { id: 'word-19', category: 'Word', functionName: '查找', description: '在文档中查找内容', keys: ['Ctrl', 'F'], platform: 'common' },
  { id: 'word-20', category: 'Word', functionName: '替换', description: '查找并替换文本', keys: ['Ctrl', 'H'], platform: 'common' },
  { id: 'word-21', category: 'Word', functionName: '插入超链接', description: '插入或编辑超链接', keys: ['Ctrl', 'K'], platform: 'common' },
  { id: 'word-22', category: 'Word', functionName: '插入分页符', description: '在当前位置插入分页符', keys: ['Ctrl', 'Enter'], platform: 'common' },
  { id: 'word-23', category: 'Word', functionName: '字体对话框', description: '打开字体设置对话框', keys: ['Ctrl', 'D'], platform: 'common' },
  { id: 'word-24', category: 'Word', functionName: '字数统计', description: '打开字数统计对话框', keys: ['Ctrl', 'Shift', 'G'], platform: 'common' },
  { id: 'word-25', category: 'Word', functionName: '修订模式', description: '开启或关闭修订模式', keys: ['Ctrl', 'Shift', 'E'], platform: 'common' },

  // Excel 快捷键
  { id: 'excel-1', category: 'Excel', functionName: '新建工作簿', description: '创建新的Excel工作簿', keys: ['Ctrl', 'N'], platform: 'common' },
  { id: 'excel-2', category: 'Excel', functionName: '打开工作簿', description: '打开已有工作簿', keys: ['Ctrl', 'O'], platform: 'common' },
  { id: 'excel-3', category: 'Excel', functionName: '保存', description: '保存当前工作簿', keys: ['Ctrl', 'S'], platform: 'common' },
  { id: 'excel-4', category: 'Excel', functionName: '撤销', description: '撤销上一步操作', keys: ['Ctrl', 'Z'], platform: 'common' },
  { id: 'excel-5', category: 'Excel', functionName: '重做', description: '重做被撤销的操作', keys: ['Ctrl', 'Y'], platform: 'common' },
  { id: 'excel-6', category: 'Excel', functionName: '复制', description: '复制选中的单元格', keys: ['Ctrl', 'C'], platform: 'common' },
  { id: 'excel-7', category: 'Excel', functionName: '粘贴', description: '粘贴剪贴板内容', keys: ['Ctrl', 'V'], platform: 'common' },
  { id: 'excel-8', category: 'Excel', functionName: '全选', description: '选中整个工作表', keys: ['Ctrl', 'A'], platform: 'common' },
  { id: 'excel-9', category: 'Excel', functionName: '查找', description: '在工作表中查找内容', keys: ['Ctrl', 'F'], platform: 'common' },
  { id: 'excel-10', category: 'Excel', functionName: '替换', description: '查找并替换内容', keys: ['Ctrl', 'H'], platform: 'common' },
  { id: 'excel-11', category: 'Excel', functionName: '自动求和', description: '对选中单元格自动求和', keys: ['Alt', '='], platform: 'common' },
  { id: 'excel-12', category: 'Excel', functionName: '编辑单元格', description: '编辑选中的单元格', keys: ['F2'], platform: 'common' },
  { id: 'excel-13', category: 'Excel', functionName: '绝对引用', description: '切换单元格引用方式', keys: ['F4'], platform: 'common' },
  { id: 'excel-14', category: 'Excel', functionName: '填充向下', description: '向下填充内容', keys: ['Ctrl', 'D'], platform: 'common' },
  { id: 'excel-15', category: 'Excel', functionName: '填充向右', description: '向右填充内容', keys: ['Ctrl', 'R'], platform: 'common' },
  { id: 'excel-16', category: 'Excel', functionName: '插入新工作表', description: '插入新的工作表', keys: ['Shift', 'F11'], platform: 'common' },
  { id: 'excel-17', category: 'Excel', functionName: '切换到下一个工作表', description: '切换到右侧工作表', keys: ['Ctrl', 'PageDown'], platform: 'common' },
  { id: 'excel-18', category: 'Excel', functionName: '切换到上一个工作表', description: '切换到左侧工作表', keys: ['Ctrl', 'PageUp'], platform: 'common' },
  { id: 'excel-19', category: 'Excel', functionName: '选择整行', description: '选中整行', keys: ['Shift', 'Space'], platform: 'common' },
  { id: 'excel-20', category: 'Excel', functionName: '选择整列', description: '选中整列', keys: ['Ctrl', 'Space'], platform: 'common' },
  { id: 'excel-21', category: 'Excel', functionName: '打开筛选', description: '启用或关闭筛选', keys: ['Ctrl', 'Shift', 'L'], platform: 'common' },
  { id: 'excel-22', category: 'Excel', functionName: '创建图表', description: '基于选中数据创建图表', keys: ['F11'], platform: 'common' },
  { id: 'excel-23', category: 'Excel', functionName: '设置单元格格式', description: '打开单元格格式对话框', keys: ['Ctrl', '1'], platform: 'common' },
  { id: 'excel-24', category: 'Excel', functionName: '插入超链接', description: '插入或编辑超链接', keys: ['Ctrl', 'K'], platform: 'common' },
  { id: 'excel-25', category: 'Excel', functionName: '计算工作表', description: '重新计算整个工作表', keys: ['F9'], platform: 'common' },

  // PowerPoint 快捷键
  { id: 'ppt-1', category: 'PowerPoint', functionName: '新建演示文稿', description: '创建新的PPT演示文稿', keys: ['Ctrl', 'N'], platform: 'common' },
  { id: 'ppt-2', category: 'PowerPoint', functionName: '打开演示文稿', description: '打开已有演示文稿', keys: ['Ctrl', 'O'], platform: 'common' },
  { id: 'ppt-3', category: 'PowerPoint', functionName: '保存', description: '保存当前演示文稿', keys: ['Ctrl', 'S'], platform: 'common' },
  { id: 'ppt-4', category: 'PowerPoint', functionName: '新建幻灯片', description: '插入新的幻灯片', keys: ['Ctrl', 'M'], platform: 'common' },
  { id: 'ppt-5', category: 'PowerPoint', functionName: '复制幻灯片', description: '复制选中的幻灯片', keys: ['Ctrl', 'D'], platform: 'common' },
  { id: 'ppt-6', category: 'PowerPoint', functionName: '删除幻灯片', description: '删除选中的幻灯片', keys: ['Delete'], platform: 'common' },
  { id: 'ppt-7', category: 'PowerPoint', functionName: '撤销', description: '撤销上一步操作', keys: ['Ctrl', 'Z'], platform: 'common' },
  { id: 'ppt-8', category: 'PowerPoint', functionName: '重做', description: '重做被撤销的操作', keys: ['Ctrl', 'Y'], platform: 'common' },
  { id: 'ppt-9', category: 'PowerPoint', functionName: '复制', description: '复制选中的对象', keys: ['Ctrl', 'C'], platform: 'common' },
  { id: 'ppt-10', category: 'PowerPoint', functionName: '粘贴', description: '粘贴剪贴板内容', keys: ['Ctrl', 'V'], platform: 'common' },
  { id: 'ppt-11', category: 'PowerPoint', functionName: '全选', description: '选中所有对象', keys: ['Ctrl', 'A'], platform: 'common' },
  { id: 'ppt-12', category: 'PowerPoint', functionName: '加粗', description: '将选中文本加粗', keys: ['Ctrl', 'B'], platform: 'common' },
  { id: 'ppt-13', category: 'PowerPoint', functionName: '斜体', description: '将选中文本设为斜体', keys: ['Ctrl', 'I'], platform: 'common' },
  { id: 'ppt-14', category: 'PowerPoint', functionName: '下划线', description: '为选中文本添加下划线', keys: ['Ctrl', 'U'], platform: 'common' },
  { id: 'ppt-15', category: 'PowerPoint', functionName: '居中对齐', description: '将文本居中对齐', keys: ['Ctrl', 'E'], platform: 'common' },
  { id: 'ppt-16', category: 'PowerPoint', functionName: '左对齐', description: '将文本左对齐', keys: ['Ctrl', 'L'], platform: 'common' },
  { id: 'ppt-17', category: 'PowerPoint', functionName: '右对齐', description: '将文本右对齐', keys: ['Ctrl', 'R'], platform: 'common' },
  { id: 'ppt-18', category: 'PowerPoint', functionName: '组合对象', description: '将选中对象组合', keys: ['Ctrl', 'G'], platform: 'common' },
  { id: 'ppt-19', category: 'PowerPoint', functionName: '取消组合', description: '取消对象组合', keys: ['Ctrl', 'Shift', 'G'], platform: 'common' },
  { id: 'ppt-20', category: 'PowerPoint', functionName: '从当前放映', description: '从当前页开始放映', keys: ['Shift', 'F5'], platform: 'common' },
  { id: 'ppt-21', category: 'PowerPoint', functionName: '从头放映', description: '从第一张开始放映', keys: ['F5'], platform: 'common' },
  { id: 'ppt-22', category: 'PowerPoint', functionName: '结束放映', description: '退出放映模式', keys: ['Esc'], platform: 'common' },
  { id: 'ppt-23', category: 'PowerPoint', functionName: '上一张幻灯片', description: '切换到上一张幻灯片', keys: ['PageUp'], platform: 'common' },
  { id: 'ppt-24', category: 'PowerPoint', functionName: '下一张幻灯片', description: '切换到下一张幻灯片', keys: ['PageDown'], platform: 'common' },
  { id: 'ppt-25', category: 'PowerPoint', functionName: '插入超链接', description: '插入或编辑超链接', keys: ['Ctrl', 'K'], platform: 'common' },

  // 思源笔记快捷键
  { id: 'siyuan-1', category: '思源笔记', functionName: '新建文档', description: '创建新的文档或子文档', keys: ['Ctrl', 'N'], platform: 'common' },
  { id: 'siyuan-2', category: '思源笔记', functionName: '快速打开', description: '搜索并快速打开文档', keys: ['Ctrl', 'O'], platform: 'common' },
  { id: 'siyuan-3', category: '思源笔记', functionName: '命令面板', description: '打开命令面板，快速执行命令', keys: ['Ctrl', 'P'], platform: 'common' },
  { id: 'siyuan-4', category: '思源笔记', functionName: '保存', description: '保存当前文档', keys: ['Ctrl', 'S'], platform: 'common' },
  { id: 'siyuan-5', category: '思源笔记', functionName: '关闭标签', description: '关闭当前标签页', keys: ['Ctrl', 'W'], platform: 'common' },
  { id: 'siyuan-6', category: '思源笔记', functionName: '下一个标签', description: '切换到下一个标签页', keys: ['Ctrl', 'Tab'], platform: 'common' },
  { id: 'siyuan-7', category: '思源笔记', functionName: '上一个标签', description: '切换到上一个标签页', keys: ['Ctrl', 'Shift', 'Tab'], platform: 'common' },
  { id: 'siyuan-8', category: '思源笔记', functionName: '加粗', description: '将选中文本加粗', keys: ['Ctrl', 'B'], platform: 'common' },
  { id: 'siyuan-9', category: '思源笔记', functionName: '斜体', description: '将选中文本设为斜体', keys: ['Ctrl', 'I'], platform: 'common' },
  { id: 'siyuan-10', category: '思源笔记', functionName: '下划线', description: '为选中文本添加下划线', keys: ['Ctrl', 'U'], platform: 'common' },
  { id: 'siyuan-11', category: '思源笔记', functionName: '删除线', description: '为选中文本添加删除线', keys: ['Ctrl', 'Shift', 'X'], platform: 'common' },
  { id: 'siyuan-12', category: '思源笔记', functionName: '高亮', description: '高亮标记选中文本', keys: ['Ctrl', 'Shift', 'H'], platform: 'common' },
  { id: 'siyuan-13', category: '思源笔记', functionName: '插入链接', description: '插入或编辑链接', keys: ['Ctrl', 'L'], platform: 'common' },
  { id: 'siyuan-14', category: '思源笔记', functionName: '插入代码', description: '插入内联代码或代码块', keys: ['Ctrl', 'K'], platform: 'common' },
  { id: 'siyuan-15', category: '思源笔记', functionName: '公式', description: '插入或编辑数学公式', keys: ['Ctrl', 'Shift', 'M'], platform: 'common' },
  { id: 'siyuan-16', category: '思源笔记', functionName: '块引用', description: '引用其他文档块', keys: ['Ctrl', 'D'], platform: 'common' },
  { id: 'siyuan-17', category: '思源笔记', functionName: '创建新块', description: '在下方创建新块', keys: ['Ctrl', 'Enter'], platform: 'common' },
  { id: 'siyuan-18', category: '思源笔记', functionName: '块菜单', description: '触发斜杠菜单选择块类型', keys: ['/'], platform: 'common' },
  { id: 'siyuan-19', category: '思源笔记', functionName: '查找', description: '在当前文档中查找', keys: ['Ctrl', 'F'], platform: 'common' },
  { id: 'siyuan-20', category: '思源笔记', functionName: '替换', description: '查找并替换', keys: ['Ctrl', 'R'], platform: 'common' },
  { id: 'siyuan-21', category: '思源笔记', functionName: '撤销', description: '撤销上一步操作', keys: ['Ctrl', 'Z'], platform: 'common' },
  { id: 'siyuan-22', category: '思源笔记', functionName: '重做', description: '重做被撤销的操作', keys: ['Ctrl', 'Shift', 'Z'], platform: 'common' },
  { id: 'siyuan-23', category: '思源笔记', functionName: '全选', description: '选中当前块全部内容', keys: ['Ctrl', 'A'], platform: 'common' },
  { id: 'siyuan-24', category: '思源笔记', functionName: '切换侧边栏', description: '显示或隐藏侧边栏', keys: ['Ctrl', '\\'], platform: 'common' },
  { id: 'siyuan-25', category: '思源笔记', functionName: '全屏聚焦', description: '进入/退出全屏聚焦模式', keys: ['Alt', 'Enter'], platform: 'common' },
  { id: 'siyuan-26', category: '思源笔记', functionName: '导出', description: '导出当前文档', keys: ['Ctrl', 'Shift', 'E'], platform: 'common' },
  { id: 'siyuan-27', category: '思源笔记', functionName: '无序列表', description: '转为无序列表', keys: ['Ctrl', 'Shift', 'L'], platform: 'common' },
  { id: 'siyuan-28', category: '思源笔记', functionName: '有序列表', description: '转为有序列表', keys: ['Ctrl', 'Shift', 'O'], platform: 'common' },
  { id: 'siyuan-29', category: '思源笔记', functionName: '任务列表', description: '转为任务列表', keys: ['Ctrl', 'Shift', 'T'], platform: 'common' },
  { id: 'siyuan-30', category: '思源笔记', functionName: '标题', description: '设为标题（按多次切换级别）', keys: ['Ctrl', 'Shift', '1'], platform: 'common' },

  // Outlook 快捷键
  { id: 'outlook-1', category: 'Outlook', functionName: '新建邮件', description: '创建一封新邮件', keys: ['Ctrl', 'Shift', 'M'], platform: 'common' },
  { id: 'outlook-2', category: 'Outlook', functionName: '回复', description: '回复当前邮件发件人', keys: ['Ctrl', 'R'], platform: 'common' },
  { id: 'outlook-3', category: 'Outlook', functionName: '全部回复', description: '回复当前邮件所有人', keys: ['Ctrl', 'Shift', 'R'], platform: 'common' },
  { id: 'outlook-4', category: 'Outlook', functionName: '转发', description: '转发当前邮件', keys: ['Ctrl', 'F'], platform: 'common' },
  { id: 'outlook-5', category: 'Outlook', functionName: '发送', description: '发送当前邮件', keys: ['Ctrl', 'Enter'], platform: 'common' },
  { id: 'outlook-6', category: 'Outlook', functionName: '发送（备选）', description: '发送邮件（Alt+S）', keys: ['Alt', 'S'], platform: 'common' },
  { id: 'outlook-7', category: 'Outlook', functionName: '删除', description: '删除选中邮件', keys: ['Ctrl', 'D'], platform: 'common' },
  { id: 'outlook-8', category: 'Outlook', functionName: '保存草稿', description: '保存当前邮件为草稿', keys: ['Ctrl', 'S'], platform: 'common' },
  { id: 'outlook-9', category: 'Outlook', functionName: '标记已读', description: '将邮件标记为已读', keys: ['Ctrl', 'Q'], platform: 'common' },
  { id: 'outlook-10', category: 'Outlook', functionName: '标记未读', description: '将邮件标记为未读', keys: ['Ctrl', 'U'], platform: 'common' },
  { id: 'outlook-11', category: 'Outlook', functionName: '发送/接收', description: '发送/接收所有邮件', keys: ['F9'], platform: 'common' },
  { id: 'outlook-12', category: 'Outlook', functionName: '切换到邮件', description: '切换到邮件视图', keys: ['Ctrl', '1'], platform: 'common' },
  { id: 'outlook-13', category: 'Outlook', functionName: '切换到日历', description: '切换到日历视图', keys: ['Ctrl', '2'], platform: 'common' },
  { id: 'outlook-14', category: 'Outlook', functionName: '切换到联系人', description: '切换到联系人视图', keys: ['Ctrl', '3'], platform: 'common' },
  { id: 'outlook-15', category: 'Outlook', functionName: '切换到任务', description: '切换到任务视图', keys: ['Ctrl', '4'], platform: 'common' },
  { id: 'outlook-16', category: 'Outlook', functionName: '新建约会', description: '创建新的日程约会', keys: ['Ctrl', 'Shift', 'A'], platform: 'common' },
  { id: 'outlook-17', category: 'Outlook', functionName: '新建会议', description: '创建新的会议邀请', keys: ['Ctrl', 'Shift', 'Q'], platform: 'common' },
  { id: 'outlook-18', category: 'Outlook', functionName: '新建任务', description: '创建新的待办任务', keys: ['Ctrl', 'Shift', 'K'], platform: 'common' },
  { id: 'outlook-19', category: 'Outlook', functionName: '新建联系人', description: '创建新的联系人', keys: ['Ctrl', 'Shift', 'C'], platform: 'common' },
  { id: 'outlook-20', category: 'Outlook', functionName: '通讯簿', description: '打开通讯簿', keys: ['Ctrl', 'Shift', 'B'], platform: 'common' },
  { id: 'outlook-21', category: 'Outlook', functionName: '查找邮件', description: '在当前文件夹查找', keys: ['Ctrl', 'Shift', 'F'], platform: 'common' },
  { id: 'outlook-22', category: 'Outlook', functionName: '转到文件夹', description: '弹出文件夹选择对话框', keys: ['Ctrl', 'Y'], platform: 'common' },
  { id: 'outlook-23', category: 'Outlook', functionName: '搜索', description: '光标跳转到搜索框', keys: ['Ctrl', 'E'], platform: 'common' },
  { id: 'outlook-24', category: 'Outlook', functionName: '归档', description: '将邮件移到归档文件夹', keys: ['Backspace'], platform: 'common' },
  { id: 'outlook-25', category: 'Outlook', functionName: '撤销', description: '撤销上一步操作', keys: ['Ctrl', 'Z'], platform: 'common' },
  { id: 'outlook-26', category: 'Outlook', functionName: '复制', description: '复制选中内容', keys: ['Ctrl', 'C'], platform: 'common' },
  { id: 'outlook-27', category: 'Outlook', functionName: '粘贴', description: '粘贴剪贴板内容', keys: ['Ctrl', 'V'], platform: 'common' },
  { id: 'outlook-28', category: 'Outlook', functionName: '全选', description: '选中所有邮件', keys: ['Ctrl', 'A'], platform: 'common' },
  { id: 'outlook-29', category: 'Outlook', functionName: '打印', description: '打印当前邮件', keys: ['Ctrl', 'P'], platform: 'common' },
  { id: 'outlook-30', category: 'Outlook', functionName: '查找下一个', description: '查找下一个匹配项', keys: ['F3'], platform: 'common' },

  // 五笔86版字根快捷键（逐个字根）
  { id: 'wubi86-G-1', category: '五笔86版', functionName: 'G键 · 王', description: '【横区一键】字根：王', keys: ['G'], platform: 'common' },
  { id: 'wubi86-G-2', category: '五笔86版', functionName: 'G键 · 五', description: '【横区一键】字根：五', keys: ['G'], platform: 'common' },
  { id: 'wubi86-G-3', category: '五笔86版', functionName: 'G键 · 一', description: '【横区一键】字根：一', keys: ['G'], platform: 'common' },
  { id: 'wubi86-G-4', category: '五笔86版', functionName: 'G键 · 戋', description: '【横区一键】字根：戋', keys: ['G'], platform: 'common' },
  { id: 'wubi86-F-1', category: '五笔86版', functionName: 'F键 · 土', description: '【横区二键】字根：土', keys: ['F'], platform: 'common' },
  { id: 'wubi86-F-2', category: '五笔86版', functionName: 'F键 · 士', description: '【横区二键】字根：士', keys: ['F'], platform: 'common' },
  { id: 'wubi86-F-3', category: '五笔86版', functionName: 'F键 · 二', description: '【横区二键】字根：二', keys: ['F'], platform: 'common' },
  { id: 'wubi86-F-4', category: '五笔86版', functionName: 'F键 · 干', description: '【横区二键】字根：干', keys: ['F'], platform: 'common' },
  { id: 'wubi86-F-5', category: '五笔86版', functionName: 'F键 · 十', description: '【横区二键】字根：十', keys: ['F'], platform: 'common' },
  { id: 'wubi86-F-6', category: '五笔86版', functionName: 'F键 · 寸', description: '【横区二键】字根：寸', keys: ['F'], platform: 'common' },
  { id: 'wubi86-F-7', category: '五笔86版', functionName: 'F键 · 雨', description: '【横区二键】字根：雨', keys: ['F'], platform: 'common' },
  { id: 'wubi86-D-1', category: '五笔86版', functionName: 'D键 · 大', description: '【横区三键】字根：大', keys: ['D'], platform: 'common' },
  { id: 'wubi86-D-2', category: '五笔86版', functionName: 'D键 · 犬', description: '【横区三键】字根：犬', keys: ['D'], platform: 'common' },
  { id: 'wubi86-D-3', category: '五笔86版', functionName: 'D键 · 三', description: '【横区三键】字根：三', keys: ['D'], platform: 'common' },
  { id: 'wubi86-D-4', category: '五笔86版', functionName: 'D键 · 古', description: '【横区三键】字根：古', keys: ['D'], platform: 'common' },
  { id: 'wubi86-D-5', category: '五笔86版', functionName: 'D键 · 石', description: '【横区三键】字根：石', keys: ['D'], platform: 'common' },
  { id: 'wubi86-D-6', category: '五笔86版', functionName: 'D键 · 厂', description: '【横区三键】字根：厂', keys: ['D'], platform: 'common' },
  { id: 'wubi86-D-7', category: '五笔86版', functionName: 'D键 · 丆', description: '【横区三键】字根：丆（羊字底）', keys: ['D'], platform: 'common' },
  { id: 'wubi86-S-1', category: '五笔86版', functionName: 'S键 · 木', description: '【横区四键】字根：木', keys: ['S'], platform: 'common' },
  { id: 'wubi86-S-2', category: '五笔86版', functionName: 'S键 · 丁', description: '【横区四键】字根：丁', keys: ['S'], platform: 'common' },
  { id: 'wubi86-S-3', category: '五笔86版', functionName: 'S键 · 西', description: '【横区四键】字根：西', keys: ['S'], platform: 'common' },
  { id: 'wubi86-A-1', category: '五笔86版', functionName: 'A键 · 工', description: '【横区五键】字根：工', keys: ['A'], platform: 'common' },
  { id: 'wubi86-A-2', category: '五笔86版', functionName: 'A键 · 戈', description: '【横区五键】字根：戈', keys: ['A'], platform: 'common' },
  { id: 'wubi86-A-3', category: '五笔86版', functionName: 'A键 · 艹', description: '【横区五键】字根：艹（草头）', keys: ['A'], platform: 'common' },
  { id: 'wubi86-A-4', category: '五笔86版', functionName: 'A键 · 匚', description: '【横区五键】字根：匚（右框）', keys: ['A'], platform: 'common' },
  { id: 'wubi86-A-5', category: '五笔86版', functionName: 'A键 · 七', description: '【横区五键】字根：七', keys: ['A'], platform: 'common' },
  { id: 'wubi86-A-6', category: '五笔86版', functionName: 'A键 · 弋', description: '【横区五键】字根：弋', keys: ['A'], platform: 'common' },
  { id: 'wubi86-A-7', category: '五笔86版', functionName: 'A键 · 廿', description: '【横区五键】字根：廿', keys: ['A'], platform: 'common' },
  { id: 'wubi86-A-8', category: '五笔86版', functionName: 'A键 · 廾', description: '【横区五键】字根：廾', keys: ['A'], platform: 'common' },
  { id: 'wubi86-H-1', category: '五笔86版', functionName: 'H键 · 目', description: '【竖区一键】字根：目', keys: ['H'], platform: 'common' },
  { id: 'wubi86-H-2', category: '五笔86版', functionName: 'H键 · 丨', description: '【竖区一键】字根：丨（竖）', keys: ['H'], platform: 'common' },
  { id: 'wubi86-H-3', category: '五笔86版', functionName: 'H键 · 上', description: '【竖区一键】字根：上', keys: ['H'], platform: 'common' },
  { id: 'wubi86-H-4', category: '五笔86版', functionName: 'H键 · 止', description: '【竖区一键】字根：止', keys: ['H'], platform: 'common' },
  { id: 'wubi86-H-5', category: '五笔86版', functionName: 'H键 · 卜', description: '【竖区一键】字根：卜', keys: ['H'], platform: 'common' },
  { id: 'wubi86-H-6', category: '五笔86版', functionName: 'H键 · 虍', description: '【竖区一键】字根：虍（虎皮）', keys: ['H'], platform: 'common' },
  { id: 'wubi86-J-1', category: '五笔86版', functionName: 'J键 · 日', description: '【竖区二键】字根：日', keys: ['J'], platform: 'common' },
  { id: 'wubi86-J-2', category: '五笔86版', functionName: 'J键 · 早', description: '【竖区二键】字根：早', keys: ['J'], platform: 'common' },
  { id: 'wubi86-J-3', category: '五笔86版', functionName: 'J键 · 刂', description: '【竖区二键】字根：刂（立刀）', keys: ['J'], platform: 'common' },
  { id: 'wubi86-J-4', category: '五笔86版', functionName: 'J键 · 虫', description: '【竖区二键】字根：虫', keys: ['J'], platform: 'common' },
  { id: 'wubi86-J-5', category: '五笔86版', functionName: 'J键 · 曰', description: '【竖区二键】字根：曰', keys: ['J'], platform: 'common' },
  { id: 'wubi86-K-1', category: '五笔86版', functionName: 'K键 · 口', description: '【竖区三键】字根：口', keys: ['K'], platform: 'common' },
  { id: 'wubi86-K-2', category: '五笔86版', functionName: 'K键 · 川', description: '【竖区三键】字根：川', keys: ['K'], platform: 'common' },
  { id: 'wubi86-L-1', category: '五笔86版', functionName: 'L键 · 田', description: '【竖区四键】字根：田', keys: ['L'], platform: 'common' },
  { id: 'wubi86-L-2', category: '五笔86版', functionName: 'L键 · 甲', description: '【竖区四键】字根：甲', keys: ['L'], platform: 'common' },
  { id: 'wubi86-L-3', category: '五笔86版', functionName: 'L键 · 囗', description: '【竖区四键】字根：囗（方框）', keys: ['L'], platform: 'common' },
  { id: 'wubi86-L-4', category: '五笔86版', functionName: 'L键 · 四', description: '【竖区四键】字根：四', keys: ['L'], platform: 'common' },
  { id: 'wubi86-L-5', category: '五笔86版', functionName: 'L键 · 车', description: '【竖区四键】字根：车', keys: ['L'], platform: 'common' },
  { id: 'wubi86-L-6', category: '五笔86版', functionName: 'L键 · 力', description: '【竖区四键】字根：力', keys: ['L'], platform: 'common' },
  { id: 'wubi86-L-7', category: '五笔86版', functionName: 'L键 · 皿', description: '【竖区四键】字根：皿', keys: ['L'], platform: 'common' },
  { id: 'wubi86-L-8', category: '五笔86版', functionName: 'L键 · 罒', description: '【竖区四键】字根：罒（四字头）', keys: ['L'], platform: 'common' },
  { id: 'wubi86-M-1', category: '五笔86版', functionName: 'M键 · 山', description: '【竖区五键】字根：山', keys: ['M'], platform: 'common' },
  { id: 'wubi86-M-2', category: '五笔86版', functionName: 'M键 · 由', description: '【竖区五键】字根：由', keys: ['M'], platform: 'common' },
  { id: 'wubi86-M-3', category: '五笔86版', functionName: 'M键 · 贝', description: '【竖区五键】字根：贝', keys: ['M'], platform: 'common' },
  { id: 'wubi86-M-4', category: '五笔86版', functionName: 'M键 · 冂', description: '【竖区五键】字根：冂（下框）', keys: ['M'], platform: 'common' },
  { id: 'wubi86-M-5', category: '五笔86版', functionName: 'M键 · 几', description: '【竖区五键】字根：几', keys: ['M'], platform: 'common' },
  { id: 'wubi86-T-1', category: '五笔86版', functionName: 'T键 · 禾', description: '【撇区一键】字根：禾', keys: ['T'], platform: 'common' },
  { id: 'wubi86-T-2', category: '五笔86版', functionName: 'T键 · 竹', description: '【撇区一键】字根：竹', keys: ['T'], platform: 'common' },
  { id: 'wubi86-T-3', category: '五笔86版', functionName: 'T键 · 丿', description: '【撇区一键】字根：丿（撇）', keys: ['T'], platform: 'common' },
  { id: 'wubi86-T-4', category: '五笔86版', functionName: 'T键 · 彳', description: '【撇区一键】字根：彳（双人）', keys: ['T'], platform: 'common' },
  { id: 'wubi86-T-5', category: '五笔86版', functionName: 'T键 · 攵', description: '【撇区一键】字根：攵（反文）', keys: ['T'], platform: 'common' },
  { id: 'wubi86-T-6', category: '五笔86版', functionName: 'T键 · 夂', description: '【撇区一键】字根：夂', keys: ['T'], platform: 'common' },
  { id: 'wubi86-R-1', category: '五笔86版', functionName: 'R键 · 白', description: '【撇区二键】字根：白', keys: ['R'], platform: 'common' },
  { id: 'wubi86-R-2', category: '五笔86版', functionName: 'R键 · 手', description: '【撇区二键】字根：手', keys: ['R'], platform: 'common' },
  { id: 'wubi86-R-3', category: '五笔86版', functionName: 'R键 · 扌', description: '【撇区二键】字根：扌（提手）', keys: ['R'], platform: 'common' },
  { id: 'wubi86-R-4', category: '五笔86版', functionName: 'R键 · 斤', description: '【撇区二键】字根：斤', keys: ['R'], platform: 'common' },
  { id: 'wubi86-R-5', category: '五笔86版', functionName: 'R键 · 看', description: '【撇区二键】字根：𠂎（看头）', keys: ['R'], platform: 'common' },
  { id: 'wubi86-E-1', category: '五笔86版', functionName: 'E键 · 月', description: '【撇区三键】字根：月', keys: ['E'], platform: 'common' },
  { id: 'wubi86-E-2', category: '五笔86版', functionName: 'E键 · 彡', description: '【撇区三键】字根：彡', keys: ['E'], platform: 'common' },
  { id: 'wubi86-E-3', category: '五笔86版', functionName: 'E键 · 乃', description: '【撇区三键】字根：乃', keys: ['E'], platform: 'common' },
  { id: 'wubi86-E-4', category: '五笔86版', functionName: 'E键 · 用', description: '【撇区三键】字根：用', keys: ['E'], platform: 'common' },
  { id: 'wubi86-E-5', category: '五笔86版', functionName: 'E键 · 豕', description: '【撇区三键】字根：豕（家衣底）', keys: ['E'], platform: 'common' },
  { id: 'wubi86-E-6', category: '五笔86版', functionName: 'E键 · 彐', description: '【撇区三键】字根：彐', keys: ['E'], platform: 'common' },
  { id: 'wubi86-W-1', category: '五笔86版', functionName: 'W键 · 人', description: '【撇区四键】字根：人', keys: ['W'], platform: 'common' },
  { id: 'wubi86-W-2', category: '五笔86版', functionName: 'W键 · 八', description: '【撇区四键】字根：八', keys: ['W'], platform: 'common' },
  { id: 'wubi86-W-3', category: '五笔86版', functionName: 'W键 · 癶', description: '【撇区四键】字根：癶（登头）', keys: ['W'], platform: 'common' },
  { id: 'wubi86-Q-1', category: '五笔86版', functionName: 'Q键 · 金', description: '【撇区五键】字根：金', keys: ['Q'], platform: 'common' },
  { id: 'wubi86-Q-2', category: '五笔86版', functionName: 'Q键 · 勹', description: '【撇区五键】字根：勹（勺缺）', keys: ['Q'], platform: 'common' },
  { id: 'wubi86-Q-3', category: '五笔86版', functionName: 'Q键 · 鱼', description: '【撇区五键】字根：鱼（无尾鱼）', keys: ['Q'], platform: 'common' },
  { id: 'wubi86-Q-4', category: '五笔86版', functionName: 'Q键 · 乂', description: '【撇区五键】字根：乂', keys: ['Q'], platform: 'common' },
  { id: 'wubi86-Q-5', category: '五笔86版', functionName: 'Q键 · 儿', description: '【撇区五键】字根：儿', keys: ['Q'], platform: 'common' },
  { id: 'wubi86-Q-6', category: '五笔86版', functionName: 'Q键 · 夕', description: '【撇区五键】字根：夕', keys: ['Q'], platform: 'common' },
  { id: 'wubi86-Q-7', category: '五笔86版', functionName: 'Q键 · 钅', description: '【撇区五键】字根：钅（金字旁）', keys: ['Q'], platform: 'common' },
  { id: 'wubi86-Y-1', category: '五笔86版', functionName: 'Y键 · 言', description: '【捺区一键】字根：言', keys: ['Y'], platform: 'common' },
  { id: 'wubi86-Y-2', category: '五笔86版', functionName: 'Y键 · 文', description: '【捺区一键】字根：文', keys: ['Y'], platform: 'common' },
  { id: 'wubi86-Y-3', category: '五笔86版', functionName: 'Y键 · 方', description: '【捺区一键】字根：方', keys: ['Y'], platform: 'common' },
  { id: 'wubi86-Y-4', category: '五笔86版', functionName: 'Y键 · 广', description: '【捺区一键】字根：广', keys: ['Y'], platform: 'common' },
  { id: 'wubi86-Y-5', category: '五笔86版', functionName: 'Y键 · 亠', description: '【捺区一键】字根：亠（高头）', keys: ['Y'], platform: 'common' },
  { id: 'wubi86-Y-6', category: '五笔86版', functionName: 'Y键 · 丶', description: '【捺区一键】字根：丶（点）', keys: ['Y'], platform: 'common' },
  { id: 'wubi86-U-1', category: '五笔86版', functionName: 'U键 · 立', description: '【捺区二键】字根：立', keys: ['U'], platform: 'common' },
  { id: 'wubi86-U-2', category: '五笔86版', functionName: 'U键 · 辛', description: '【捺区二键】字根：辛', keys: ['U'], platform: 'common' },
  { id: 'wubi86-U-3', category: '五笔86版', functionName: 'U键 · 冫', description: '【捺区二键】字根：冫（两点水）', keys: ['U'], platform: 'common' },
  { id: 'wubi86-U-4', category: '五笔86版', functionName: 'U键 · 六', description: '【捺区二键】字根：六', keys: ['U'], platform: 'common' },
  { id: 'wubi86-U-5', category: '五笔86版', functionName: 'U键 · 门', description: '【捺区二键】字根：门', keys: ['U'], platform: 'common' },
  { id: 'wubi86-U-6', category: '五笔86版', functionName: 'U键 · 疒', description: '【捺区二键】字根：疒（病字头）', keys: ['U'], platform: 'common' },
  { id: 'wubi86-U-7', category: '五笔86版', functionName: 'U键 · 丬', description: '【捺区二键】字根：丬', keys: ['U'], platform: 'common' },
  { id: 'wubi86-I-1', category: '五笔86版', functionName: 'I键 · 水', description: '【捺区三键】字根：水', keys: ['I'], platform: 'common' },
  { id: 'wubi86-I-2', category: '五笔86版', functionName: 'I键 · 氵', description: '【捺区三键】字根：氵（三点水）', keys: ['I'], platform: 'common' },
  { id: 'wubi86-I-3', category: '五笔86版', functionName: 'I键 · 小', description: '【捺区三键】字根：小', keys: ['I'], platform: 'common' },
  { id: 'wubi86-I-4', category: '五笔86版', functionName: 'I键 · ⺳', description: '【捺区三键】字根：⺳（兴头）', keys: ['I'], platform: 'common' },
  { id: 'wubi86-O-1', category: '五笔86版', functionName: 'O键 · 火', description: '【捺区四键】字根：火', keys: ['O'], platform: 'common' },
  { id: 'wubi86-O-2', category: '五笔86版', functionName: 'O键 · 业', description: '【捺区四键】字根：业（业头）', keys: ['O'], platform: 'common' },
  { id: 'wubi86-O-3', category: '五笔86版', functionName: 'O键 · 灬', description: '【捺区四键】字根：灬（四点底）', keys: ['O'], platform: 'common' },
  { id: 'wubi86-O-4', category: '五笔86版', functionName: 'O键 · 米', description: '【捺区四键】字根：米', keys: ['O'], platform: 'common' },
  { id: 'wubi86-P-1', category: '五笔86版', functionName: 'P键 · 之', description: '【捺区五键】字根：之', keys: ['P'], platform: 'common' },
  { id: 'wubi86-P-2', category: '五笔86版', functionName: 'P键 · 宀', description: '【捺区五键】字根：宀（宝盖头）', keys: ['P'], platform: 'common' },
  { id: 'wubi86-P-3', category: '五笔86版', functionName: 'P键 · 冖', description: '【捺区五键】字根：冖（秃宝盖）', keys: ['P'], platform: 'common' },
  { id: 'wubi86-P-4', category: '五笔86版', functionName: 'P键 · 辶', description: '【捺区五键】字根：辶（走之）', keys: ['P'], platform: 'common' },
  { id: 'wubi86-P-5', category: '五笔86版', functionName: 'P键 · 廴', description: '【捺区五键】字根：廴（建之底）', keys: ['P'], platform: 'common' },
  { id: 'wubi86-N-1', category: '五笔86版', functionName: 'N键 · 已', description: '【折区一键】字根：已', keys: ['N'], platform: 'common' },
  { id: 'wubi86-N-2', category: '五笔86版', functionName: 'N键 · 己', description: '【折区一键】字根：己', keys: ['N'], platform: 'common' },
  { id: 'wubi86-N-3', category: '五笔86版', functionName: 'N键 · 巳', description: '【折区一键】字根：巳', keys: ['N'], platform: 'common' },
  { id: 'wubi86-N-4', category: '五笔86版', functionName: 'N键 · 尸', description: '【折区一键】字根：尸', keys: ['N'], platform: 'common' },
  { id: 'wubi86-N-5', category: '五笔86版', functionName: 'N键 · コ', description: '【折区一键】字根：コ（左框）', keys: ['N'], platform: 'common' },
  { id: 'wubi86-N-6', category: '五笔86版', functionName: 'N键 · 心', description: '【折区一键】字根：心', keys: ['N'], platform: 'common' },
  { id: 'wubi86-N-7', category: '五笔86版', functionName: 'N键 · 忄', description: '【折区一键】字根：忄（竖心旁）', keys: ['N'], platform: 'common' },
  { id: 'wubi86-B-1', category: '五笔86版', functionName: 'B键 · 子', description: '【折区二键】字根：子', keys: ['B'], platform: 'common' },
  { id: 'wubi86-B-2', category: '五笔86版', functionName: 'B键 · 耳', description: '【折区二键】字根：耳', keys: ['B'], platform: 'common' },
  { id: 'wubi86-B-3', category: '五笔86版', functionName: 'B键 · 了', description: '【折区二键】字根：了', keys: ['B'], platform: 'common' },
  { id: 'wubi86-B-4', category: '五笔86版', functionName: 'B键 · 也', description: '【折区二键】字根：也', keys: ['B'], platform: 'common' },
  { id: 'wubi86-B-5', category: '五笔86版', functionName: 'B键 · 凵', description: '【折区二键】字根：凵（框向上）', keys: ['B'], platform: 'common' },
  { id: 'wubi86-B-6', category: '五笔86版', functionName: 'B键 · 卩', description: '【折区二键】字根：卩（单耳）', keys: ['B'], platform: 'common' },
  { id: 'wubi86-B-7', category: '五笔86版', functionName: 'B键 · 阝', description: '【折区二键】字根：阝（双耳）', keys: ['B'], platform: 'common' },
  { id: 'wubi86-B-8', category: '五笔86版', functionName: 'B键 · 乃', description: '【折区二键】字根：乃', keys: ['B'], platform: 'common' },
  { id: 'wubi86-V-1', category: '五笔86版', functionName: 'V键 · 女', description: '【折区三键】字根：女', keys: ['V'], platform: 'common' },
  { id: 'wubi86-V-2', category: '五笔86版', functionName: 'V键 · 刀', description: '【折区三键】字根：刀', keys: ['V'], platform: 'common' },
  { id: 'wubi86-V-3', category: '五笔86版', functionName: 'V键 · 九', description: '【折区三键】字根：九', keys: ['V'], platform: 'common' },
  { id: 'wubi86-V-4', category: '五笔86版', functionName: 'V键 · 臼', description: '【折区三键】字根：臼', keys: ['V'], platform: 'common' },
  { id: 'wubi86-V-5', category: '五笔86版', functionName: 'V键 · 彐', description: '【折区三键】字根：彐（山朝西）', keys: ['V'], platform: 'common' },
  { id: 'wubi86-V-6', category: '五笔86版', functionName: 'V键 · 巛', description: '【折区三键】字根：巛（三折）', keys: ['V'], platform: 'common' },
  { id: 'wubi86-C-1', category: '五笔86版', functionName: 'C键 · 又', description: '【折区四键】字根：又', keys: ['C'], platform: 'common' },
  { id: 'wubi86-C-2', category: '五笔86版', functionName: 'C键 · 巴', description: '【折区四键】字根：巴', keys: ['C'], platform: 'common' },
  { id: 'wubi86-C-3', category: '五笔86版', functionName: 'C键 · 马', description: '【折区四键】字根：马', keys: ['C'], platform: 'common' },
  { id: 'wubi86-C-4', category: '五笔86版', functionName: 'C键 · 厶', description: '【折区四键】字根：厶（私字边）', keys: ['C'], platform: 'common' },
  { id: 'wubi86-X-1', category: '五笔86版', functionName: 'X键 · 纟', description: '【折区五键】字根：纟（绞丝旁）', keys: ['X'], platform: 'common' },
  { id: 'wubi86-X-2', category: '五笔86版', functionName: 'X键 · 弓', description: '【折区五键】字根：弓', keys: ['X'], platform: 'common' },
  { id: 'wubi86-X-3', category: '五笔86版', functionName: 'X键 · 匕', description: '【折区五键】字根：匕', keys: ['X'], platform: 'common' },
  { id: 'wubi86-X-4', category: '五笔86版', functionName: 'X键 · 幺', description: '【折区五键】字根：幺', keys: ['X'], platform: 'common' },
  { id: 'wubi86-X-5', category: '五笔86版', functionName: 'X键 · 母', description: '【折区五键】字根：母', keys: ['X'], platform: 'common' },
  { id: 'wubi86-Z-1', category: '五笔86版', functionName: 'Z键 · 万能键', description: '万能学习键，可代替任何字根进行查询', keys: ['Z'], platform: 'common' },

  // 五笔98版字根快捷键（逐个字根）
  { id: 'wubi98-G-1', category: '五笔98版', functionName: 'G键 · 王', description: '【横区一键】字根：王', keys: ['G'], platform: 'common' },
  { id: 'wubi98-G-2', category: '五笔98版', functionName: 'G键 · 五', description: '【横区一键】字根：五', keys: ['G'], platform: 'common' },
  { id: 'wubi98-G-3', category: '五笔98版', functionName: 'G键 · 一', description: '【横区一键】字根：一', keys: ['G'], platform: 'common' },
  { id: 'wubi98-G-4', category: '五笔98版', functionName: 'G键 · 夫', description: '【横区一键】字根：夫', keys: ['G'], platform: 'common' },
  { id: 'wubi98-G-5', category: '五笔98版', functionName: 'G键 · 牛', description: '【横区一键】字根：牛（牛字底）', keys: ['G'], platform: 'common' },
  { id: 'wubi98-G-6', category: '五笔98版', functionName: 'G键 · 戋', description: '【横区一键】字根：戋', keys: ['G'], platform: 'common' },
  { id: 'wubi98-F-1', category: '五笔98版', functionName: 'F键 · 土', description: '【横区二键】字根：土', keys: ['F'], platform: 'common' },
  { id: 'wubi98-F-2', category: '五笔98版', functionName: 'F键 · 士', description: '【横区二键】字根：士', keys: ['F'], platform: 'common' },
  { id: 'wubi98-F-3', category: '五笔98版', functionName: 'F键 · 二', description: '【横区二键】字根：二', keys: ['F'], platform: 'common' },
  { id: 'wubi98-F-4', category: '五笔98版', functionName: 'F键 · 干', description: '【横区二键】字根：干', keys: ['F'], platform: 'common' },
  { id: 'wubi98-F-5', category: '五笔98版', functionName: 'F键 · 十', description: '【横区二键】字根：十', keys: ['F'], platform: 'common' },
  { id: 'wubi98-F-6', category: '五笔98版', functionName: 'F键 · 寸', description: '【横区二键】字根：寸', keys: ['F'], platform: 'common' },
  { id: 'wubi98-F-7', category: '五笔98版', functionName: 'F键 · 雨', description: '【横区二键】字根：雨', keys: ['F'], platform: 'common' },
  { id: 'wubi98-F-8', category: '五笔98版', functionName: 'F键 · 未', description: '【横区二键】字根：未（98新增）', keys: ['F'], platform: 'common' },
  { id: 'wubi98-D-1', category: '五笔98版', functionName: 'D键 · 大', description: '【横区三键】字根：大', keys: ['D'], platform: 'common' },
  { id: 'wubi98-D-2', category: '五笔98版', functionName: 'D键 · 犬', description: '【横区三键】字根：犬', keys: ['D'], platform: 'common' },
  { id: 'wubi98-D-3', category: '五笔98版', functionName: 'D键 · 三', description: '【横区三键】字根：三', keys: ['D'], platform: 'common' },
  { id: 'wubi98-D-4', category: '五笔98版', functionName: 'D键 · 戌', description: '【横区三键】字根：戌（98新增）', keys: ['D'], platform: 'common' },
  { id: 'wubi98-D-5', category: '五笔98版', functionName: 'D键 · 古', description: '【横区三键】字根：古', keys: ['D'], platform: 'common' },
  { id: 'wubi98-D-6', category: '五笔98版', functionName: 'D键 · 石', description: '【横区三键】字根：石', keys: ['D'], platform: 'common' },
  { id: 'wubi98-D-7', category: '五笔98版', functionName: 'D键 · 厂', description: '【横区三键】字根：厂', keys: ['D'], platform: 'common' },
  { id: 'wubi98-S-1', category: '五笔98版', functionName: 'S键 · 木', description: '【横区四键】字根：木', keys: ['S'], platform: 'common' },
  { id: 'wubi98-S-2', category: '五笔98版', functionName: 'S键 · 丁', description: '【横区四键】字根：丁', keys: ['S'], platform: 'common' },
  { id: 'wubi98-S-3', category: '五笔98版', functionName: 'S键 · 西', description: '【横区四键】字根：西', keys: ['S'], platform: 'common' },
  { id: 'wubi98-S-4', category: '五笔98版', functionName: 'S键 · 甫', description: '【横区四键】字根：甫（98新增）', keys: ['S'], platform: 'common' },
  { id: 'wubi98-A-1', category: '五笔98版', functionName: 'A键 · 工', description: '【横区五键】字根：工', keys: ['A'], platform: 'common' },
  { id: 'wubi98-A-2', category: '五笔98版', functionName: 'A键 · 戈', description: '【横区五键】字根：戈', keys: ['A'], platform: 'common' },
  { id: 'wubi98-A-3', category: '五笔98版', functionName: 'A键 · 艹', description: '【横区五键】字根：艹（草头）', keys: ['A'], platform: 'common' },
  { id: 'wubi98-A-4', category: '五笔98版', functionName: 'A键 · 匚', description: '【横区五键】字根：匚（右框）', keys: ['A'], platform: 'common' },
  { id: 'wubi98-A-5', category: '五笔98版', functionName: 'A键 · 七', description: '【横区五键】字根：七', keys: ['A'], platform: 'common' },
  { id: 'wubi98-A-6', category: '五笔98版', functionName: 'A键 · 廿', description: '【横区五键】字根：廿', keys: ['A'], platform: 'common' },
  { id: 'wubi98-H-1', category: '五笔98版', functionName: 'H键 · 目', description: '【竖区一键】字根：目', keys: ['H'], platform: 'common' },
  { id: 'wubi98-H-2', category: '五笔98版', functionName: 'H键 · 丨', description: '【竖区一键】字根：丨（竖）', keys: ['H'], platform: 'common' },
  { id: 'wubi98-H-3', category: '五笔98版', functionName: 'H键 · 上', description: '【竖区一键】字根：上', keys: ['H'], platform: 'common' },
  { id: 'wubi98-H-4', category: '五笔98版', functionName: 'H键 · 止', description: '【竖区一键】字根：止', keys: ['H'], platform: 'common' },
  { id: 'wubi98-H-5', category: '五笔98版', functionName: 'H键 · 卜', description: '【竖区一键】字根：卜', keys: ['H'], platform: 'common' },
  { id: 'wubi98-H-6', category: '五笔98版', functionName: 'H键 · 虎', description: '【竖区一键】字根：虎', keys: ['H'], platform: 'common' },
  { id: 'wubi98-H-7', category: '五笔98版', functionName: 'H键 · 虍', description: '【竖区一键】字根：虍（虎皮）', keys: ['H'], platform: 'common' },
  { id: 'wubi98-J-1', category: '五笔98版', functionName: 'J键 · 日', description: '【竖区二键】字根：日', keys: ['J'], platform: 'common' },
  { id: 'wubi98-J-2', category: '五笔98版', functionName: 'J键 · 早', description: '【竖区二键】字根：早', keys: ['J'], platform: 'common' },
  { id: 'wubi98-J-3', category: '五笔98版', functionName: 'J键 · 虫', description: '【竖区二键】字根：虫', keys: ['J'], platform: 'common' },
  { id: 'wubi98-J-4', category: '五笔98版', functionName: 'J键 · 刂', description: '【竖区二键】字根：刂（立刀）', keys: ['J'], platform: 'common' },
  { id: 'wubi98-J-5', category: '五笔98版', functionName: 'J键 · 曰', description: '【竖区二键】字根：曰', keys: ['J'], platform: 'common' },
  { id: 'wubi98-K-1', category: '五笔98版', functionName: 'K键 · 口', description: '【竖区三键】字根：口', keys: ['K'], platform: 'common' },
  { id: 'wubi98-K-2', category: '五笔98版', functionName: 'K键 · 川', description: '【竖区三键】字根：川', keys: ['K'], platform: 'common' },
  { id: 'wubi98-L-1', category: '五笔98版', functionName: 'L键 · 田', description: '【竖区四键】字根：田', keys: ['L'], platform: 'common' },
  { id: 'wubi98-L-2', category: '五笔98版', functionName: 'L键 · 甲', description: '【竖区四键】字根：甲', keys: ['L'], platform: 'common' },
  { id: 'wubi98-L-3', category: '五笔98版', functionName: 'L键 · 囗', description: '【竖区四键】字根：囗（方框）', keys: ['L'], platform: 'common' },
  { id: 'wubi98-L-4', category: '五笔98版', functionName: 'L键 · 四', description: '【竖区四键】字根：四', keys: ['L'], platform: 'common' },
  { id: 'wubi98-L-5', category: '五笔98版', functionName: 'L键 · 车', description: '【竖区四键】字根：车', keys: ['L'], platform: 'common' },
  { id: 'wubi98-L-6', category: '五笔98版', functionName: 'L键 · 力', description: '【竖区四键】字根：力', keys: ['L'], platform: 'common' },
  { id: 'wubi98-L-7', category: '五笔98版', functionName: 'L键 · 罒', description: '【竖区四键】字根：罒（四字头）', keys: ['L'], platform: 'common' },
  { id: 'wubi98-L-8', category: '五笔98版', functionName: 'L键 · 皿', description: '【竖区四键】字根：皿', keys: ['L'], platform: 'common' },
  { id: 'wubi98-M-1', category: '五笔98版', functionName: 'M键 · 山', description: '【竖区五键】字根：山', keys: ['M'], platform: 'common' },
  { id: 'wubi98-M-2', category: '五笔98版', functionName: 'M键 · 由', description: '【竖区五键】字根：由', keys: ['M'], platform: 'common' },
  { id: 'wubi98-M-3', category: '五笔98版', functionName: 'M键 · 贝', description: '【竖区五键】字根：贝', keys: ['M'], platform: 'common' },
  { id: 'wubi98-M-4', category: '五笔98版', functionName: 'M键 · 冂', description: '【竖区五键】字根：冂（下框）', keys: ['M'], platform: 'common' },
  { id: 'wubi98-M-5', category: '五笔98版', functionName: 'M键 · 几', description: '【竖区五键】字根：几', keys: ['M'], platform: 'common' },
  { id: 'wubi98-T-1', category: '五笔98版', functionName: 'T键 · 禾', description: '【撇区一键】字根：禾', keys: ['T'], platform: 'common' },
  { id: 'wubi98-T-2', category: '五笔98版', functionName: 'T键 · 竹', description: '【撇区一键】字根：竹', keys: ['T'], platform: 'common' },
  { id: 'wubi98-T-3', category: '五笔98版', functionName: 'T键 · 丿', description: '【撇区一键】字根：丿（撇）', keys: ['T'], platform: 'common' },
  { id: 'wubi98-T-4', category: '五笔98版', functionName: 'T键 · 父', description: '【撇区一键】字根：父（98调整）', keys: ['T'], platform: 'common' },
  { id: 'wubi98-R-1', category: '五笔98版', functionName: 'R键 · 白', description: '【撇区二键】字根：白', keys: ['R'], platform: 'common' },
  { id: 'wubi98-R-2', category: '五笔98版', functionName: 'R键 · 手', description: '【撇区二键】字根：手', keys: ['R'], platform: 'common' },
  { id: 'wubi98-R-3', category: '五笔98版', functionName: 'R键 · 扌', description: '【撇区二键】字根：扌（提手）', keys: ['R'], platform: 'common' },
  { id: 'wubi98-R-4', category: '五笔98版', functionName: 'R键 · 斤', description: '【撇区二键】字根：斤', keys: ['R'], platform: 'common' },
  { id: 'wubi98-R-5', category: '五笔98版', functionName: 'R键 · 看', description: '【撇区二键】字根：𠂎（看头）', keys: ['R'], platform: 'common' },
  { id: 'wubi98-E-1', category: '五笔98版', functionName: 'E键 · 月', description: '【撇区三键】字根：月', keys: ['E'], platform: 'common' },
  { id: 'wubi98-E-2', category: '五笔98版', functionName: 'E键 · 彡', description: '【撇区三键】字根：彡', keys: ['E'], platform: 'common' },
  { id: 'wubi98-E-3', category: '五笔98版', functionName: 'E键 · 乃', description: '【撇区三键】字根：乃', keys: ['E'], platform: 'common' },
  { id: 'wubi98-E-4', category: '五笔98版', functionName: 'E键 · 用', description: '【撇区三键】字根：用', keys: ['E'], platform: 'common' },
  { id: 'wubi98-E-5', category: '五笔98版', functionName: 'E键 · 豕', description: '【撇区三键】字根：豕（家衣底）', keys: ['E'], platform: 'common' },
  { id: 'wubi98-E-6', category: '五笔98版', functionName: 'E键 · 毛', description: '【撇区三键】字根：毛（98调整）', keys: ['E'], platform: 'common' },
  { id: 'wubi98-W-1', category: '五笔98版', functionName: 'W键 · 人', description: '【撇区四键】字根：人', keys: ['W'], platform: 'common' },
  { id: 'wubi98-W-2', category: '五笔98版', functionName: 'W键 · 八', description: '【撇区四键】字根：八', keys: ['W'], platform: 'common' },
  { id: 'wubi98-W-3', category: '五笔98版', functionName: 'W键 · 癶', description: '【撇区四键】字根：癶（登头）', keys: ['W'], platform: 'common' },
  { id: 'wubi98-W-4', category: '五笔98版', functionName: 'W键 · 几', description: '【撇区四键】字根：几（98调整）', keys: ['W'], platform: 'common' },
  { id: 'wubi98-Q-1', category: '五笔98版', functionName: 'Q键 · 金', description: '【撇区五键】字根：金', keys: ['Q'], platform: 'common' },
  { id: 'wubi98-Q-2', category: '五笔98版', functionName: 'Q键 · 勹', description: '【撇区五键】字根：勹（勺缺）', keys: ['Q'], platform: 'common' },
  { id: 'wubi98-Q-3', category: '五笔98版', functionName: 'Q键 · 鱼', description: '【撇区五键】字根：鱼（无尾鱼）', keys: ['Q'], platform: 'common' },
  { id: 'wubi98-Q-4', category: '五笔98版', functionName: 'Q键 · 乂', description: '【撇区五键】字根：乂', keys: ['Q'], platform: 'common' },
  { id: 'wubi98-Q-5', category: '五笔98版', functionName: 'Q键 · 夕', description: '【撇区五键】字根：夕', keys: ['Q'], platform: 'common' },
  { id: 'wubi98-Q-6', category: '五笔98版', functionName: 'Q键 · 儿', description: '【撇区五键】字根：儿（98调整）', keys: ['Q'], platform: 'common' },
  { id: 'wubi98-Q-7', category: '五笔98版', functionName: 'Q键 · 钅', description: '【撇区五键】字根：钅（金字旁）', keys: ['Q'], platform: 'common' },
  { id: 'wubi98-Y-1', category: '五笔98版', functionName: 'Y键 · 言', description: '【捺区一键】字根：言', keys: ['Y'], platform: 'common' },
  { id: 'wubi98-Y-2', category: '五笔98版', functionName: 'Y键 · 文', description: '【捺区一键】字根：文', keys: ['Y'], platform: 'common' },
  { id: 'wubi98-Y-3', category: '五笔98版', functionName: 'Y键 · 方', description: '【捺区一键】字根：方', keys: ['Y'], platform: 'common' },
  { id: 'wubi98-Y-4', category: '五笔98版', functionName: 'Y键 · 广', description: '【捺区一键】字根：广', keys: ['Y'], platform: 'common' },
  { id: 'wubi98-Y-5', category: '五笔98版', functionName: 'Y键 · 亠', description: '【捺区一键】字根：亠（高头）', keys: ['Y'], platform: 'common' },
  { id: 'wubi98-U-1', category: '五笔98版', functionName: 'U键 · 立', description: '【捺区二键】字根：立', keys: ['U'], platform: 'common' },
  { id: 'wubi98-U-2', category: '五笔98版', functionName: 'U键 · 辛', description: '【捺区二键】字根：辛', keys: ['U'], platform: 'common' },
  { id: 'wubi98-U-3', category: '五笔98版', functionName: 'U键 · 冫', description: '【捺区二键】字根：冫（两点水）', keys: ['U'], platform: 'common' },
  { id: 'wubi98-U-4', category: '五笔98版', functionName: 'U键 · 六', description: '【捺区二键】字根：六', keys: ['U'], platform: 'common' },
  { id: 'wubi98-U-5', category: '五笔98版', functionName: 'U键 · 门', description: '【捺区二键】字根：门', keys: ['U'], platform: 'common' },
  { id: 'wubi98-U-6', category: '五笔98版', functionName: 'U键 · 疒', description: '【捺区二键】字根：疒（病字头）', keys: ['U'], platform: 'common' },
  { id: 'wubi98-U-7', category: '五笔98版', functionName: 'U键 · 羊', description: '【捺区二键】字根：羊（98新增）', keys: ['U'], platform: 'common' },
  { id: 'wubi98-I-1', category: '五笔98版', functionName: 'I键 · 水', description: '【捺区三键】字根：水', keys: ['I'], platform: 'common' },
  { id: 'wubi98-I-2', category: '五笔98版', functionName: 'I键 · 氵', description: '【捺区三键】字根：氵（三点水）', keys: ['I'], platform: 'common' },
  { id: 'wubi98-I-3', category: '五笔98版', functionName: 'I键 · 小', description: '【捺区三键】字根：小', keys: ['I'], platform: 'common' },
  { id: 'wubi98-I-4', category: '五笔98版', functionName: 'I键 · ⺳', description: '【捺区三键】字根：⺳（兴头）', keys: ['I'], platform: 'common' },
  { id: 'wubi98-O-1', category: '五笔98版', functionName: 'O键 · 火', description: '【捺区四键】字根：火', keys: ['O'], platform: 'common' },
  { id: 'wubi98-O-2', category: '五笔98版', functionName: 'O键 · 业', description: '【捺区四键】字根：业（业头）', keys: ['O'], platform: 'common' },
  { id: 'wubi98-O-3', category: '五笔98版', functionName: 'O键 · 灬', description: '【捺区四键】字根：灬（四点底）', keys: ['O'], platform: 'common' },
  { id: 'wubi98-O-4', category: '五笔98版', functionName: 'O键 · 米', description: '【捺区四键】字根：米', keys: ['O'], platform: 'common' },
  { id: 'wubi98-P-1', category: '五笔98版', functionName: 'P键 · 之', description: '【捺区五键】字根：之', keys: ['P'], platform: 'common' },
  { id: 'wubi98-P-2', category: '五笔98版', functionName: 'P键 · 宀', description: '【捺区五键】字根：宀（宝盖头）', keys: ['P'], platform: 'common' },
  { id: 'wubi98-P-3', category: '五笔98版', functionName: 'P键 · 冖', description: '【捺区五键】字根：冖（秃宝盖）', keys: ['P'], platform: 'common' },
  { id: 'wubi98-P-4', category: '五笔98版', functionName: 'P键 · 辶', description: '【捺区五键】字根：辶（走之）', keys: ['P'], platform: 'common' },
  { id: 'wubi98-P-5', category: '五笔98版', functionName: 'P键 · 廴', description: '【捺区五键】字根：廴（建之底）', keys: ['P'], platform: 'common' },
  { id: 'wubi98-N-1', category: '五笔98版', functionName: 'N键 · 已', description: '【折区一键】字根：已', keys: ['N'], platform: 'common' },
  { id: 'wubi98-N-2', category: '五笔98版', functionName: 'N键 · 己', description: '【折区一键】字根：己', keys: ['N'], platform: 'common' },
  { id: 'wubi98-N-3', category: '五笔98版', functionName: 'N键 · 巳', description: '【折区一键】字根：巳', keys: ['N'], platform: 'common' },
  { id: 'wubi98-N-4', category: '五笔98版', functionName: 'N键 · 尸', description: '【折区一键】字根：尸', keys: ['N'], platform: 'common' },
  { id: 'wubi98-N-5', category: '五笔98版', functionName: 'N键 · コ', description: '【折区一键】字根：コ（左框）', keys: ['N'], platform: 'common' },
  { id: 'wubi98-N-6', category: '五笔98版', functionName: 'N键 · 心', description: '【折区一键】字根：心', keys: ['N'], platform: 'common' },
  { id: 'wubi98-N-7', category: '五笔98版', functionName: 'N键 · 忄', description: '【折区一键】字根：忄（竖心旁）', keys: ['N'], platform: 'common' },
  { id: 'wubi98-B-1', category: '五笔98版', functionName: 'B键 · 子', description: '【折区二键】字根：子', keys: ['B'], platform: 'common' },
  { id: 'wubi98-B-2', category: '五笔98版', functionName: 'B键 · 耳', description: '【折区二键】字根：耳', keys: ['B'], platform: 'common' },
  { id: 'wubi98-B-3', category: '五笔98版', functionName: 'B键 · 了', description: '【折区二键】字根：了', keys: ['B'], platform: 'common' },
  { id: 'wubi98-B-4', category: '五笔98版', functionName: 'B键 · 也', description: '【折区二键】字根：也', keys: ['B'], platform: 'common' },
  { id: 'wubi98-B-5', category: '五笔98版', functionName: 'B键 · 乃', description: '【折区二键】字根：乃（98调整）', keys: ['B'], platform: 'common' },
  { id: 'wubi98-B-6', category: '五笔98版', functionName: 'B键 · 凵', description: '【折区二键】字根：凵（框向上）', keys: ['B'], platform: 'common' },
  { id: 'wubi98-B-7', category: '五笔98版', functionName: 'B键 · 卩', description: '【折区二键】字根：卩（单耳）', keys: ['B'], platform: 'common' },
  { id: 'wubi98-B-8', category: '五笔98版', functionName: 'B键 · 阝', description: '【折区二键】字根：阝（双耳）', keys: ['B'], platform: 'common' },
  { id: 'wubi98-V-1', category: '五笔98版', functionName: 'V键 · 女', description: '【折区三键】字根：女', keys: ['V'], platform: 'common' },
  { id: 'wubi98-V-2', category: '五笔98版', functionName: 'V键 · 刀', description: '【折区三键】字根：刀', keys: ['V'], platform: 'common' },
  { id: 'wubi98-V-3', category: '五笔98版', functionName: 'V键 · 九', description: '【折区三键】字根：九', keys: ['V'], platform: 'common' },
  { id: 'wubi98-V-4', category: '五笔98版', functionName: 'V键 · 臼', description: '【折区三键】字根：臼', keys: ['V'], platform: 'common' },
  { id: 'wubi98-V-5', category: '五笔98版', functionName: 'V键 · 彐', description: '【折区三键】字根：彐（山朝西）', keys: ['V'], platform: 'common' },
  { id: 'wubi98-V-6', category: '五笔98版', functionName: 'V键 · 巛', description: '【折区三键】字根：巛（三折）', keys: ['V'], platform: 'common' },
  { id: 'wubi98-C-1', category: '五笔98版', functionName: 'C键 · 又', description: '【折区四键】字根：又', keys: ['C'], platform: 'common' },
  { id: 'wubi98-C-2', category: '五笔98版', functionName: 'C键 · 巴', description: '【折区四键】字根：巴', keys: ['C'], platform: 'common' },
  { id: 'wubi98-C-3', category: '五笔98版', functionName: 'C键 · 马', description: '【折区四键】字根：马', keys: ['C'], platform: 'common' },
  { id: 'wubi98-C-4', category: '五笔98版', functionName: 'C键 · 厶', description: '【折区四键】字根：厶（私字边）', keys: ['C'], platform: 'common' },
  { id: 'wubi98-X-1', category: '五笔98版', functionName: 'X键 · 纟', description: '【折区五键】字根：纟（绞丝旁）', keys: ['X'], platform: 'common' },
  { id: 'wubi98-X-2', category: '五笔98版', functionName: 'X键 · 弓', description: '【折区五键】字根：弓', keys: ['X'], platform: 'common' },
  { id: 'wubi98-X-3', category: '五笔98版', functionName: 'X键 · 匕', description: '【折区五键】字根：匕', keys: ['X'], platform: 'common' },
  { id: 'wubi98-X-4', category: '五笔98版', functionName: 'X键 · 幺', description: '【折区五键】字根：幺', keys: ['X'], platform: 'common' },
  { id: 'wubi98-X-5', category: '五笔98版', functionName: 'X键 · 母', description: '【折区五键】字根：母', keys: ['X'], platform: 'common' },
  { id: 'wubi98-Z-1', category: '五笔98版', functionName: 'Z键 · 万能键', description: '万能学习键，可代替任何字根进行查询', keys: ['Z'], platform: 'common' },

  // 小鹤双拼快捷键（键位为主）
  { id: 'sp-xh-Q', category: '双拼 · 小鹤', functionName: 'Q键', description: '韵母：iu', keys: ['Q'], platform: 'common' },
  { id: 'sp-xh-W', category: '双拼 · 小鹤', functionName: 'W键', description: '韵母：ei', keys: ['W'], platform: 'common' },
  { id: 'sp-xh-E', category: '双拼 · 小鹤', functionName: 'E键', description: '零声母：e', keys: ['E'], platform: 'common' },
  { id: 'sp-xh-R', category: '双拼 · 小鹤', functionName: 'R键', description: '韵母：uan', keys: ['R'], platform: 'common' },
  { id: 'sp-xh-T', category: '双拼 · 小鹤', functionName: 'T键', description: '韵母：ue / ve', keys: ['T'], platform: 'common' },
  { id: 'sp-xh-Y', category: '双拼 · 小鹤', functionName: 'Y键', description: '韵母：un', keys: ['Y'], platform: 'common' },
  { id: 'sp-xh-U', category: '双拼 · 小鹤', functionName: 'U键', description: '声母：sh', keys: ['U'], platform: 'common' },
  { id: 'sp-xh-I', category: '双拼 · 小鹤', functionName: 'I键', description: '声母：ch', keys: ['I'], platform: 'common' },
  { id: 'sp-xh-O', category: '双拼 · 小鹤', functionName: 'O键', description: '韵母：uo / o', keys: ['O'], platform: 'common' },
  { id: 'sp-xh-P', category: '双拼 · 小鹤', functionName: 'P键', description: '韵母：ie', keys: ['P'], platform: 'common' },
  { id: 'sp-xh-A', category: '双拼 · 小鹤', functionName: 'A键', description: '零声母：a', keys: ['A'], platform: 'common' },
  { id: 'sp-xh-S', category: '双拼 · 小鹤', functionName: 'S键', description: '韵母：ong / iong', keys: ['S'], platform: 'common' },
  { id: 'sp-xh-D', category: '双拼 · 小鹤', functionName: 'D键', description: '韵母：iang / uang', keys: ['D'], platform: 'common' },
  { id: 'sp-xh-F', category: '双拼 · 小鹤', functionName: 'F键', description: '韵母：en', keys: ['F'], platform: 'common' },
  { id: 'sp-xh-G', category: '双拼 · 小鹤', functionName: 'G键', description: '韵母：eng', keys: ['G'], platform: 'common' },
  { id: 'sp-xh-H', category: '双拼 · 小鹤', functionName: 'H键', description: '韵母：ang', keys: ['H'], platform: 'common' },
  { id: 'sp-xh-J', category: '双拼 · 小鹤', functionName: 'J键', description: '韵母：an', keys: ['J'], platform: 'common' },
  { id: 'sp-xh-K', category: '双拼 · 小鹤', functionName: 'K键', description: '韵母：ao', keys: ['K'], platform: 'common' },
  { id: 'sp-xh-L', category: '双拼 · 小鹤', functionName: 'L键', description: '韵母：ai', keys: ['L'], platform: 'common' },
  { id: 'sp-xh-Z', category: '双拼 · 小鹤', functionName: 'Z键', description: '韵母：ou', keys: ['Z'], platform: 'common' },
  { id: 'sp-xh-X', category: '双拼 · 小鹤', functionName: 'X键', description: '韵母：ia / ua', keys: ['X'], platform: 'common' },
  { id: 'sp-xh-C', category: '双拼 · 小鹤', functionName: 'C键', description: '韵母：iao', keys: ['C'], platform: 'common' },
  { id: 'sp-xh-V', category: '双拼 · 小鹤', functionName: 'V键', description: '声母：zh / 韵母：ui', keys: ['V'], platform: 'common' },
  { id: 'sp-xh-B', category: '双拼 · 小鹤', functionName: 'B键', description: '韵母：in', keys: ['B'], platform: 'common' },
  { id: 'sp-xh-N', category: '双拼 · 小鹤', functionName: 'N键', description: '韵母：ing', keys: ['N'], platform: 'common' },
  { id: 'sp-xh-M', category: '双拼 · 小鹤', functionName: 'M键', description: '韵母：ian', keys: ['M'], platform: 'common' },

  // 自然码双拼快捷键（键位为主）
  { id: 'sp-zrm-Q', category: '双拼 · 自然码', functionName: 'Q键', description: '韵母：iu', keys: ['Q'], platform: 'common' },
  { id: 'sp-zrm-W', category: '双拼 · 自然码', functionName: 'W键', description: '韵母：ua / ia', keys: ['W'], platform: 'common' },
  { id: 'sp-zrm-E', category: '双拼 · 自然码', functionName: 'E键', description: '零声母：e', keys: ['E'], platform: 'common' },
  { id: 'sp-zrm-R', category: '双拼 · 自然码', functionName: 'R键', description: '韵母：uan / üan', keys: ['R'], platform: 'common' },
  { id: 'sp-zrm-T', category: '双拼 · 自然码', functionName: 'T键', description: '韵母：ue / ve', keys: ['T'], platform: 'common' },
  { id: 'sp-zrm-Y', category: '双拼 · 自然码', functionName: 'Y键', description: '韵母：uai / ing', keys: ['Y'], platform: 'common' },
  { id: 'sp-zrm-U', category: '双拼 · 自然码', functionName: 'U键', description: '声母：sh', keys: ['U'], platform: 'common' },
  { id: 'sp-zrm-I', category: '双拼 · 自然码', functionName: 'I键', description: '声母：ch', keys: ['I'], platform: 'common' },
  { id: 'sp-zrm-O', category: '双拼 · 自然码', functionName: 'O键', description: '韵母：uo / o', keys: ['O'], platform: 'common' },
  { id: 'sp-zrm-P', category: '双拼 · 自然码', functionName: 'P键', description: '韵母：un', keys: ['P'], platform: 'common' },
  { id: 'sp-zrm-A', category: '双拼 · 自然码', functionName: 'A键', description: '零声母：a', keys: ['A'], platform: 'common' },
  { id: 'sp-zrm-S', category: '双拼 · 自然码', functionName: 'S键', description: '韵母：ong / iong', keys: ['S'], platform: 'common' },
  { id: 'sp-zrm-D', category: '双拼 · 自然码', functionName: 'D键', description: '韵母：uang / iang', keys: ['D'], platform: 'common' },
  { id: 'sp-zrm-F', category: '双拼 · 自然码', functionName: 'F键', description: '韵母：en', keys: ['F'], platform: 'common' },
  { id: 'sp-zrm-G', category: '双拼 · 自然码', functionName: 'G键', description: '韵母：eng / ng', keys: ['G'], platform: 'common' },
  { id: 'sp-zrm-H', category: '双拼 · 自然码', functionName: 'H键', description: '韵母：ang', keys: ['H'], platform: 'common' },
  { id: 'sp-zrm-J', category: '双拼 · 自然码', functionName: 'J键', description: '韵母：an', keys: ['J'], platform: 'common' },
  { id: 'sp-zrm-K', category: '双拼 · 自然码', functionName: 'K键', description: '韵母：ao', keys: ['K'], platform: 'common' },
  { id: 'sp-zrm-L', category: '双拼 · 自然码', functionName: 'L键', description: '韵母：ai', keys: ['L'], platform: 'common' },
  { id: 'sp-zrm-Z', category: '双拼 · 自然码', functionName: 'Z键', description: '韵母：ei', keys: ['Z'], platform: 'common' },
  { id: 'sp-zrm-X', category: '双拼 · 自然码', functionName: 'X键', description: '韵母：ie', keys: ['X'], platform: 'common' },
  { id: 'sp-zrm-C', category: '双拼 · 自然码', functionName: 'C键', description: '韵母：iao', keys: ['C'], platform: 'common' },
  { id: 'sp-zrm-V', category: '双拼 · 自然码', functionName: 'V键', description: '声母：zh / 韵母：ui', keys: ['V'], platform: 'common' },
  { id: 'sp-zrm-B', category: '双拼 · 自然码', functionName: 'B键', description: '韵母：ou', keys: ['B'], platform: 'common' },
  { id: 'sp-zrm-N', category: '双拼 · 自然码', functionName: 'N键', description: '韵母：in', keys: ['N'], platform: 'common' },
  { id: 'sp-zrm-M', category: '双拼 · 自然码', functionName: 'M键', description: '韵母：ian', keys: ['M'], platform: 'common' },

  // 微软双拼快捷键（键位为主）
  { id: 'sp-ms-Q', category: '双拼 · 微软', functionName: 'Q键', description: '韵母：iu', keys: ['Q'], platform: 'common' },
  { id: 'sp-ms-W', category: '双拼 · 微软', functionName: 'W键', description: '韵母：ua / ia', keys: ['W'], platform: 'common' },
  { id: 'sp-ms-E', category: '双拼 · 微软', functionName: 'E键', description: '零声母：e', keys: ['E'], platform: 'common' },
  { id: 'sp-ms-R', category: '双拼 · 微软', functionName: 'R键', description: '韵母：uan / er', keys: ['R'], platform: 'common' },
  { id: 'sp-ms-T', category: '双拼 · 微软', functionName: 'T键', description: '韵母：ue', keys: ['T'], platform: 'common' },
  { id: 'sp-ms-Y', category: '双拼 · 微软', functionName: 'Y键', description: '韵母：uai / v', keys: ['Y'], platform: 'common' },
  { id: 'sp-ms-U', category: '双拼 · 微软', functionName: 'U键', description: '声母：sh', keys: ['U'], platform: 'common' },
  { id: 'sp-ms-I', category: '双拼 · 微软', functionName: 'I键', description: '声母：ch', keys: ['I'], platform: 'common' },
  { id: 'sp-ms-O', category: '双拼 · 微软', functionName: 'O键', description: '韵母：uo / o', keys: ['O'], platform: 'common' },
  { id: 'sp-ms-P', category: '双拼 · 微软', functionName: 'P键', description: '韵母：un', keys: ['P'], platform: 'common' },
  { id: 'sp-ms-A', category: '双拼 · 微软', functionName: 'A键', description: '零声母：a', keys: ['A'], platform: 'common' },
  { id: 'sp-ms-S', category: '双拼 · 微软', functionName: 'S键', description: '韵母：ong / iong', keys: ['S'], platform: 'common' },
  { id: 'sp-ms-D', category: '双拼 · 微软', functionName: 'D键', description: '韵母：iang / uang', keys: ['D'], platform: 'common' },
  { id: 'sp-ms-F', category: '双拼 · 微软', functionName: 'F键', description: '韵母：en', keys: ['F'], platform: 'common' },
  { id: 'sp-ms-G', category: '双拼 · 微软', functionName: 'G键', description: '韵母：eng', keys: ['G'], platform: 'common' },
  { id: 'sp-ms-H', category: '双拼 · 微软', functionName: 'H键', description: '韵母：ang', keys: ['H'], platform: 'common' },
  { id: 'sp-ms-J', category: '双拼 · 微软', functionName: 'J键', description: '韵母：an', keys: ['J'], platform: 'common' },
  { id: 'sp-ms-K', category: '双拼 · 微软', functionName: 'K键', description: '韵母：ao', keys: ['K'], platform: 'common' },
  { id: 'sp-ms-L', category: '双拼 · 微软', functionName: 'L键', description: '韵母：ai', keys: ['L'], platform: 'common' },
  { id: 'sp-ms-Z', category: '双拼 · 微软', functionName: 'Z键', description: '韵母：ei', keys: ['Z'], platform: 'common' },
  { id: 'sp-ms-X', category: '双拼 · 微软', functionName: 'X键', description: '韵母：ie', keys: ['X'], platform: 'common' },
  { id: 'sp-ms-C', category: '双拼 · 微软', functionName: 'C键', description: '韵母：iao', keys: ['C'], platform: 'common' },
  { id: 'sp-ms-V', category: '双拼 · 微软', functionName: 'V键', description: '声母：zh / 韵母：ui', keys: ['V'], platform: 'common' },
  { id: 'sp-ms-B', category: '双拼 · 微软', functionName: 'B键', description: '韵母：ou', keys: ['B'], platform: 'common' },
  { id: 'sp-ms-N', category: '双拼 · 微软', functionName: 'N键', description: '韵母：in', keys: ['N'], platform: 'common' },
  { id: 'sp-ms-M', category: '双拼 · 微软', functionName: 'M键', description: '韵母：ian', keys: ['M'], platform: 'common' },

  // 搜狗双拼快捷键（键位为主）
  { id: 'sp-sg-Q', category: '双拼 · 搜狗', functionName: 'Q键', description: '韵母：iu', keys: ['Q'], platform: 'common' },
  { id: 'sp-sg-W', category: '双拼 · 搜狗', functionName: 'W键', description: '韵母：ei', keys: ['W'], platform: 'common' },
  { id: 'sp-sg-E', category: '双拼 · 搜狗', functionName: 'E键', description: '零声母：e', keys: ['E'], platform: 'common' },
  { id: 'sp-sg-R', category: '双拼 · 搜狗', functionName: 'R键', description: '韵母：uan / er', keys: ['R'], platform: 'common' },
  { id: 'sp-sg-T', category: '双拼 · 搜狗', functionName: 'T键', description: '韵母：ue / ve', keys: ['T'], platform: 'common' },
  { id: 'sp-sg-Y', category: '双拼 · 搜狗', functionName: 'Y键', description: '韵母：uai / v', keys: ['Y'], platform: 'common' },
  { id: 'sp-sg-U', category: '双拼 · 搜狗', functionName: 'U键', description: '声母：sh', keys: ['U'], platform: 'common' },
  { id: 'sp-sg-I', category: '双拼 · 搜狗', functionName: 'I键', description: '声母：ch', keys: ['I'], platform: 'common' },
  { id: 'sp-sg-O', category: '双拼 · 搜狗', functionName: 'O键', description: '韵母：uo / o', keys: ['O'], platform: 'common' },
  { id: 'sp-sg-P', category: '双拼 · 搜狗', functionName: 'P键', description: '韵母：un', keys: ['P'], platform: 'common' },
  { id: 'sp-sg-A', category: '双拼 · 搜狗', functionName: 'A键', description: '零声母：a', keys: ['A'], platform: 'common' },
  { id: 'sp-sg-S', category: '双拼 · 搜狗', functionName: 'S键', description: '韵母：ong / iong', keys: ['S'], platform: 'common' },
  { id: 'sp-sg-D', category: '双拼 · 搜狗', functionName: 'D键', description: '韵母：iang / uang', keys: ['D'], platform: 'common' },
  { id: 'sp-sg-F', category: '双拼 · 搜狗', functionName: 'F键', description: '韵母：en', keys: ['F'], platform: 'common' },
  { id: 'sp-sg-G', category: '双拼 · 搜狗', functionName: 'G键', description: '韵母：eng', keys: ['G'], platform: 'common' },
  { id: 'sp-sg-H', category: '双拼 · 搜狗', functionName: 'H键', description: '韵母：ang', keys: ['H'], platform: 'common' },
  { id: 'sp-sg-J', category: '双拼 · 搜狗', functionName: 'J键', description: '韵母：an', keys: ['J'], platform: 'common' },
  { id: 'sp-sg-K', category: '双拼 · 搜狗', functionName: 'K键', description: '韵母：ao', keys: ['K'], platform: 'common' },
  { id: 'sp-sg-L', category: '双拼 · 搜狗', functionName: 'L键', description: '韵母：ai', keys: ['L'], platform: 'common' },
  { id: 'sp-sg-Z', category: '双拼 · 搜狗', functionName: 'Z键', description: '韵母：ou', keys: ['Z'], platform: 'common' },
  { id: 'sp-sg-X', category: '双拼 · 搜狗', functionName: 'X键', description: '韵母：ie', keys: ['X'], platform: 'common' },
  { id: 'sp-sg-C', category: '双拼 · 搜狗', functionName: 'C键', description: '韵母：iao', keys: ['C'], platform: 'common' },
  { id: 'sp-sg-V', category: '双拼 · 搜狗', functionName: 'V键', description: '声母：zh / 韵母：ui', keys: ['V'], platform: 'common' },
  { id: 'sp-sg-B', category: '双拼 · 搜狗', functionName: 'B键', description: '韵母：in', keys: ['B'], platform: 'common' },
  { id: 'sp-sg-N', category: '双拼 · 搜狗', functionName: 'N键', description: '韵母：ing', keys: ['N'], platform: 'common' },
  { id: 'sp-sg-M', category: '双拼 · 搜狗', functionName: 'M键', description: '韵母：ian', keys: ['M'], platform: 'common' },

  // 键位练习数据（从默认键列表动态生成）
  ...generatePracticeItems('键位练习', DEFAULT_KEYBOARD_PRACTICE_KEYS, 'kp'),
  // 数字小键盘练习数据（从默认键列表动态生成）
  ...generatePracticeItems('数字小键盘练习', DEFAULT_NUMPAD_PRACTICE_KEYS, 'np'),
];

// 运行时缓存，优先从 JSON 文件加载
let _cachedShortcuts: ShortcutItem[] | null = null;
let _cachedCategories: ShortcutCategory[] | null = null;
let _cachedCustomCategories: CustomCategoryDoc[] | null = null;
let _jsonLoaded = false;

interface ShortcutIndexItem {
  name: string;
  file: string;
  icon: string;
  description: string;
}

/**
 * 从 public/shortcuts/ 目录加载所有快捷键 JSON 文件
 * 如果加载失败，使用内置预设数据
 */
export async function loadAllShortcuts(force: boolean = false): Promise<ShortcutItem[]> {
  if (!force && _jsonLoaded && _cachedShortcuts) {
    return _cachedShortcuts;
  }

  if (force) {
    _jsonLoaded = false;
    _cachedShortcuts = null;
    _cachedCategories = null;
    _cachedCustomCategories = null;
  }

  let allShortcuts: ShortcutItem[] = [];

  try {
    const indexRes = await fetch('/shortcuts/index.json');
    if (indexRes.ok) {
      const index: ShortcutIndexItem[] = await indexRes.json();
      for (const item of index) {
        try {
          const res = await fetch(`/shortcuts/${item.file}`);
          if (!res.ok) continue;
          const data: ShortcutItem[] = await res.json();
          allShortcuts.push(...data);
        } catch (e) {
          console.warn(`加载快捷键文件失败: ${item.file}`, e);
        }
      }
    }
  } catch (e) {
    console.warn('从 JSON 加载快捷键失败', e);
  }

  // 如果 JSON 没加载到，使用内置预设数据
  if (allShortcuts.length === 0) {
    allShortcuts = [...PRESET_SHORTCUTS];
  }

  // 合并用户自定义快捷键
  try {
    const customShortcuts = getAllCustomShortcuts();
    allShortcuts = allShortcuts.filter(
      s => !customShortcuts.some(c => c.id === s.id)
    );
    allShortcuts.push(...customShortcuts);
  } catch (e) {
    console.warn('加载自定义快捷键失败', e);
  }

  // 合并 JSON 中没有的内置分类数据（如键位练习、数字小键盘练习）
  const loadedCategories = new Set(allShortcuts.map(s => s.category));
  const missingBuiltin = PRESET_SHORTCUTS.filter(s => !loadedCategories.has(s.category));
  if (missingBuiltin.length > 0) {
    allShortcuts.push(...missingBuiltin);
  }

  _cachedShortcuts = allShortcuts;
  _jsonLoaded = true;

  // 加载自定义分类
  _cachedCustomCategories = getAllCustomCategories();
  // 刷新分类缓存
  _cachedCategories = buildCategories();

  return allShortcuts;
}

/**
 * 从 public/shortcuts/ 加载分类索引
 */
export async function loadShortcutCategories(): Promise<ShortcutCategory[]> {
  try {
    const indexRes = await fetch('/shortcuts/index.json');
    if (!indexRes.ok) throw new Error('无法加载索引文件');

    const index: ShortcutIndexItem[] = await indexRes.json();
    const shortcuts = await loadAllShortcuts();

    const categoryMap = new Map<string, number>();
    shortcuts.forEach(item => {
      categoryMap.set(item.category, (categoryMap.get(item.category) || 0) + 1);
    });

    return index.map(item => ({
      name: item.name,
      count: categoryMap.get(item.name) || 0,
      description: item.description,
      icon: item.icon
    }));
  } catch (e) {
    console.warn('加载分类索引失败，使用内置数据', e);
    return getCategoriesFromPreset();
  }
}

/**
 * 获取所有快捷键（同步，使用缓存或内置数据）
 */
export function getAllShortcuts(): ShortcutItem[] {
  if (_cachedShortcuts) return _cachedShortcuts;
  return [...PRESET_SHORTCUTS];
}

/**
 * 构建分类列表（内置 + 自定义），过滤隐藏的示例分类
 */
function buildCategories(): ShortcutCategory[] {
  // 获取隐藏的示例分类
  const hiddenCategories = getHiddenCategories();

  // 内置分类（优先用实际加载到的快捷键统计；尚未加载时退回 PRESET_SHORTCUTS）
  const builtinMap = new Map<string, ShortcutCategory>();
  const categoryCountMap = new Map<string, number>();
  const sourceShortcuts = _cachedShortcuts && _cachedShortcuts.length > 0
    ? _cachedShortcuts
    : PRESET_SHORTCUTS;
  const customNames = new Set((_cachedCustomCategories || []).map(c => c.name));
  sourceShortcuts.forEach(item => {
    // 自定义分类由后续步骤合并，这里只统计内置分类
    if (customNames.has(item.category)) return;
    categoryCountMap.set(item.category, (categoryCountMap.get(item.category) || 0) + 1);
  });
  categoryCountMap.forEach((count, name) => {
    // 过滤隐藏的示例分类
    if (!hiddenCategories.includes(name)) {
      builtinMap.set(name, {
        name,
        count,
        description: getCategoryDescription(name),
        icon: getCategoryIcon(name)
      });
    }
  });

  // 合并自定义分类
  if (_cachedCustomCategories && _cachedCustomCategories.length > 0) {
    _cachedCustomCategories.forEach(cat => {
      const count = getShortcutsByCategory(cat.name).length;
      builtinMap.set(cat.name, {
        name: cat.name,
        description: cat.description,
        icon: cat.icon,
        count
      });
    });
  }

  return Array.from(builtinMap.values());
}

/**
 * 获取所有分类（基于当前缓存的数据）
 */
export function getCategories(): ShortcutCategory[] {
  if (_cachedCategories) return _cachedCategories;
  return buildCategories();
}

function getCategoriesFromPreset(): ShortcutCategory[] {
  const categoryMap = new Map<string, number>();
  PRESET_SHORTCUTS.forEach(item => {
    categoryMap.set(item.category, (categoryMap.get(item.category) || 0) + 1);
  });

  return Array.from(categoryMap.entries()).map(([name, count]) => ({
    name,
    count,
    description: getCategoryDescription(name),
    icon: getCategoryIcon(name)
  }));
}

/**
 * 获取分类描述
 */
function getCategoryDescription(name: string): string {
  return CATEGORY_CONFIG[name]?.description || `${name} 快捷键`;
}

/**
 * 获取内置分类图标
 */
function getCategoryIcon(name: string): string {
  return CATEGORY_CONFIG[name]?.icon || '⌨️';
}

/**
 * 判断是否为内置分类
 */
export function isBuiltinCategory(name: string): boolean {
  const builtinNames = new Set(PRESET_SHORTCUTS.map(s => s.category));
  return builtinNames.has(name);
}

/**
 * 判断是否为自定义分类
 */
export function isCustomCategory(name: string): boolean {
  return _cachedCustomCategories ? _cachedCustomCategories.some(c => c.name === name) : false;
}

/**
 * 根据分类获取快捷键列表
 */
export function getShortcutsByCategory(category: string): ShortcutItem[] {
  const data = getAllShortcuts();
  return data.filter(item => item.category === category);
}

/**
 * 根据ID获取快捷键
 */
export function getShortcutById(id: string): ShortcutItem | undefined {
  const data = getAllShortcuts();
  return data.find(item => item.id === id);
}

/**
 * 洗牌算法，随机打乱数组
 */
export function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * 为选择题生成干扰项
 * @param correctItem 正确答案
 * @param categoryItems 同一分类的所有项目
 * @param count 干扰项数量
 */
export function generateDistractors(
  correctItem: ShortcutItem,
  categoryItems: ShortcutItem[],
  count: number = 3
): ShortcutItem[] {
  const others = categoryItems.filter(item => item.id !== correctItem.id);
  if (others.length === 0) return [];

  const shuffled = shuffleArray(others);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

/**
 * 将按键数组格式化为显示字符串
 */
export function formatKeys(keys: string[]): string {
  return keys.join(' + ');
}

/**
 * 标准化按键名称，用于比较
 */
export function normalizeKey(key: string): string {
  const keyMap: Record<string, string> = {
    'control': 'ctrl',
    'ctrl': 'ctrl',
    'alt': 'alt',
    'shift': 'shift',
    'meta': 'win',
    'win': 'win',
    'command': 'win',
    'cmd': 'win',
    'escape': 'esc',
    'esc': 'esc',
    'delete': 'del',
    'del': 'del',
    'insert': 'ins',
    'ins': 'ins',
    'pageup': 'pageup',
    'pagedown': 'pagedown',
    'home': 'home',
    'end': 'end',
    'arrowup': 'up',
    'arrowdown': 'down',
    'arrowleft': 'left',
    'arrowright': 'right',
    'up': 'up',
    'down': 'down',
    'left': 'left',
    'right': 'right',
    'backspace': 'backspace',
    'tab': 'tab',
    'enter': 'enter',
    'return': 'enter',
    'space': 'space',
    ' ': 'space',
    'spacebar': 'space',
    // Shift 符号映射为基础符号（组合键中 Shift 会影响 event.key）
    '{': '[',
    '}': ']',
    '|': '\\',
    ':': ';',
    '"': "'",
    '<': ',',
    '>': '.',
    '?': '/',
    '~': '`',
    '!': '1',
    '@': '2',
    '#': '3',
    '$': '4',
    '%': '5',
    '^': '6',
    '&': '7',
    '*': '8',
    '(': '9',
    ')': '0',
    '_': '-',
    '+': '=',
  };

  const lower = key.toLowerCase().trim();
  // 先对原始 key（trim 前）做映射查找，避免空格被 trim 成空字符串
  return keyMap[key.toLowerCase()] || keyMap[lower] || lower;
}

/**
 * 判断用户按下的按键组合是否与目标快捷键匹配
 */
export function matchShortcut(
  pressedKeys: Set<string>,
  targetKeys: string[]
): boolean {
  const normalizedTarget = targetKeys.map(k => normalizeKey(k));
  const normalizedPressed = Array.from(pressedKeys).map(k => normalizeKey(k));

  if (normalizedPressed.length !== normalizedTarget.length) {
    return false;
  }

  const sortedTarget = [...normalizedTarget].sort();
  const sortedPressed = [...normalizedPressed].sort();

  return sortedTarget.every((key, index) => key === sortedPressed[index]);
}

/**
 * 检查按键是否是修饰键
 */
export function isModifierKey(key: string): boolean {
  const modifiers = ['ctrl', 'alt', 'shift', 'win', 'meta', 'command', 'cmd'];
  return modifiers.includes(normalizeKey(key));
}
