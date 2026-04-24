import type { ShortcutItem, ShortcutCategory, CustomCategoryDoc } from "@/types/shortcut-memory";
import { getAllCustomShortcuts, getAllCustomCategories, getHiddenCategories } from "@/utils/shortcut-memory-db";

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
  { id: 'idea-24', category: 'IntelliJ IDEA', functionName: '跳转声明', description: '跳转到符号的声明处', keys: ['Ctrl', 'B'], platform: 'common' },
  { id: 'idea-25', category: 'IntelliJ IDEA', functionName: '复制路径', description: '复制当前文件的完整路径', keys: ['Ctrl', 'Shift', 'C'], platform: 'common' },

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
  
  // 内置分类
  const builtinMap = new Map<string, ShortcutCategory>();
  const categoryCountMap = new Map<string, number>();
  PRESET_SHORTCUTS.forEach(item => {
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
  const descMap: Record<string, string> = {
    'Windows': 'Windows 操作系统常用快捷键',
    'VS Code': 'Visual Studio Code 编辑器快捷键',
    'Chrome': 'Chrome 浏览器快捷键',
    'IntelliJ IDEA': 'IntelliJ IDEA 开发工具快捷键',
    'Photoshop': 'Adobe Photoshop 图像处理快捷键',
    '键位练习': '随机练习键盘上的任意按键',
    '数字小键盘练习': '专门练习数字小键盘区域按键'
  };
  return descMap[name] || `${name} 快捷键`;
}

/**
 * 获取内置分类图标
 */
function getCategoryIcon(name: string): string {
  const iconMap: Record<string, string> = {
    'Windows': '🪟',
    'VS Code': '📝',
    'Chrome': '🌐',
    'IntelliJ IDEA': '☕',
    'Photoshop': '🎨',
    '键位练习': '⌨️',
    '数字小键盘练习': '🔢'
  };
  return iconMap[name] || '⌨️';
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
