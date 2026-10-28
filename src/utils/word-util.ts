import type {Word} from "@/types/words";
import {DB_KEY} from "@/constants";
import {v4 as uuidv4} from "uuid";
import {formatDateTime} from "@/utils/date-util";
import {normalizeItemText, inferItemType} from "@/utils/text-utils";

/**
 * 解析带引号的 CSV/TSV 内容（支持字段内换行、"" 转义）
 */
function parseDelimited(content: string, delimiter: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  const endField = () => {
    row.push(field)
    field = ''
  }
  const endRow = () => {
    endField()
    rows.push(row)
    row = []
  }

  for (let i = 0; i < content.length; i++) {
    const ch = content[i]
    if (inQuotes) {
      if (ch === '"') {
        if (content[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
      continue
    }

    if (ch === '"' && field.length === 0) {
      inQuotes = true
    } else if (ch === delimiter) {
      endField()
    } else if (ch === '\n') {
      endRow()
    } else if (ch === '\r') {
      if (content[i + 1] === '\n') i++
      endRow()
    } else {
      field += ch
    }
  }

  // 文件末尾没有换行时补最后一行
  if (field.length > 0 || row.length > 0) endRow()
  return rows
}

const HTML_ENTITIES: Record<string, string> = {
  '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>',
  '&quot;': '"', '&#39;': "'", '&apos;': "'",
}

/** Anki 的 HTML 字段转纯文本：保留换行，去掉标签与常见实体 */
function stripAnkiHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&(nbsp|amp|lt|gt|quot|#39|apos);/g, entity => HTML_ENTITIES[entity] || entity)
}

/** 表头行（Anki / 通用表格导出）识别 */
function isHeaderRow(row: string[]): boolean {
  const cells = row.map(cell => cell.trim().toLowerCase())
  if (cells.length < 2) return false
  const first = new Set(['word', 'front', 'text', '单词', '词条', '词汇'])
  const rest = new Set(['translation', 'back', 'explains', 'meaning', '释义', '意思', '音标', 'phonetic'])
  return first.has(cells[0]) && cells.slice(1).some(cell => rest.has(cell))
}

/** 解析 Anki 文件头部的 #separator / #html 等指令，返回剩余正文 */
function splitAnkiPreamble(content: string): { body: string; separator: string; html: boolean } {
  const lines = content.split(/\r?\n/)
  let separator = ''
  let html = false
  while (lines.length > 0 && lines[0].startsWith('#')) {
    const line = lines.shift() || ''
    const match = /^#([a-zA-Z]+):(.*)$/.exec(line)
    if (!match) continue
    const key = match[1].toLowerCase()
    const value = match[2].trim().toLowerCase()
    if (key === 'separator') separator = value
    if (key === 'html') html = value === 'true' || value === '1'
  }
  return { body: lines.join('\n'), separator, html }
}

/**
 * 解析文件内容为单词列表
 * 兼容慢记自身 CSV/TXT、Anki 的 #separator/#html 头、TSV、带引号换行与 HTML 字段。
 * @param content 文件内容
 * @returns 单词列表
 */
export const parseFileContent = (content: string): Word[] => {
    const { body, separator, html: htmlMode } = splitAnkiPreamble(content.replace(/^\uFEFF/, ''))
    let delimiter = ','
    if (separator === 'tab' || separator === '\\t') {
        delimiter = '\t'
    } else if (separator === 'semicolon' || separator === ';') {
        delimiter = ';'
    } else {
        const firstLine = body.split(/\r?\n/).find(line => line.trim().length > 0) || ''
        if (firstLine.includes('\t') && !firstLine.includes(',')) delimiter = '\t'
        else if (firstLine.includes(';') && !firstLine.includes(',')) delimiter = ';'
    }

    const rows = parseDelimited(body, delimiter)
    if (rows.length > 0 && isHeaderRow(rows[0])) rows.shift()

    return rows
        .map(row => row.map(cell => {
            const trimmed = cell.trim()
            return htmlMode || /<br\s*\/?>|<\/?[a-z][^>]*>/i.test(trimmed) ? stripAnkiHtml(trimmed) : trimmed
        }))
        .filter(parts => parts.some(part => part.length > 0))
        .map(parts => {
            // 解析创建时间和学习时间
            let ctime: Date | string = new Date();
            let learnDate: Date | string = new Date();
            // 如果parts数组长度足够，且对应位置有时间字符串，则尝试解析
            if (parts.length >= 5 && parts[4]) {
                // 检查是否为格式化的时间字符串 YYYY-MM-DD HH:mm:ss
                const timeRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
                if (timeRegex.test(parts[4].trim())) {
                    ctime = parts[4].trim();
                } else {
                    // 尝试解析为日期对象
                    const parsedDate = new Date(parts[4].trim());
                    if (!isNaN(parsedDate.getTime())) {
                        ctime = parsedDate;
                    }
                }
            }

            if (parts.length >= 6 && parts[5]) {
                // 检查是否为格式化的时间字符串 YYYY-MM-DD HH:mm:ss
                const timeRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
                if (timeRegex.test(parts[5].trim())) {
                    learnDate = parts[5].trim();
                } else {
                    // 尝试解析为日期对象
                    const parsedDate = new Date(parts[5].trim());
                    if (!isNaN(parsedDate.getTime())) {
                        learnDate = parsedDate;
                    }
                }
            }

            // 解析等级，确保它是 0-12 之间的有效值
            const levelStr = parts[6] ? parts[6].trim() : '1';
            let level: 0|1|2|3|4|5|6|7|8|9|10|11|12 = 1;
            const parsedLevel = parseInt(levelStr);
            if (!isNaN(parsedLevel) && parsedLevel >= 0 && parsedLevel <= 12) {
                level = parsedLevel as 0|1|2|3|4|5|6|7|8|9|10|11|12;
            }

            // 第三列在慢记格式里是 explainedHidden；在 Anki 三列文件里可能是音标
            const third = parts[2] ? parts[2].trim() : '';
            const thirdIsPhonetic = /^\/.*\/$|^\[.*\]$/.test(third);
            const text = normalizeItemText((parts[0] || '').trim());
            return {
                text: text,
                itemType: inferItemType(text),
                explains: parts[1] ? parts[1].trim() : '', // 第二列作为释义（如果有）
                explainedHidden: third === 'true',
                isReview: parts[3] ? parts[3].trim() === 'true' : true,
                ctime: new Date(ctime), // 确保是Date对象
                learnDate: new Date(learnDate), // 确保是Date对象
                level: level,
                _id: DB_KEY + uuidv4(), // 生成唯一ID
                image: '',
                phonetic: thirdIsPhonetic ? third : '',
                remember: false
            };
        })
        .filter(word => word.text.length > 0);
};


/**
 * 过滤单词属性用于JSON导出
 * @param words 单词列表
 * @returns 过滤后的单词列表
 */
export const filterWordsForJsonExport = (words: Word[]): any[] => {
    return words.map(word => ({
        text: word.text,
        itemType: word.itemType,
        explains: word.explains,
        explainedHidden: word.explainedHidden,
        isReview: word.isReview,
        ctime: formatDateTime(word.ctime),
        learnDate: formatDateTime(word.learnDate),
        level: word.level
    }));
};

/**
 * 转义CSV字段（含逗号/引号/换行时加引号）
 */
function escapeCSV(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
}


/**
 * 过滤单词属性用于文本导出
 * @param words 单词列表
 * @returns 格式化后的字符串
 */
export const filterWordsForTextExport = (words: Word[]): string => {
    return words.map(word =>
        `${escapeCSV(word.text)}, ${escapeCSV(word.explains)},${word.explainedHidden},${word.isReview}, ${formatDateTime(word.ctime)},${formatDateTime(word.learnDate)}, ${word.level}`
    ).join('\n');
};

/**
 * 导出为 Anki 可导入的两列 CSV（正面 / 背面）。
 * 不带表头和记忆等级，Anki 导入时映射为 Front / Back 即可。
 */
export const filterWordsForAnkiCsv = (words: Word[]): string => {
    return words.map(word =>
        `${escapeCSV(word.text)},${escapeCSV(word.explains)}`
    ).join('\n');
};


/**
 * 验证导入的单词数据
 * @param words 导入的单词列表
 * @returns 验证后的单词列表
 */
export const validateImportedWords = (words: any[]): any[] => {
    return words
        .filter((word) => {
            // 校验必填字段
            return (
                typeof word.text === 'string'
            );
        })
        .map((word) => ({
            ...word,
            _id: word._id || DB_KEY + uuidv4(), // 添加_id属性
            image: word.image || '', // 补全image属性
            phonetic: word.phonetic || '', // 补全phonetic属性
            explainedHidden: word.explainedHidden ?? false, // 补全explainedHidden属性
            isReview: word.isReview ?? true, // 补全isReview属性
            ctime: word.ctime ? new Date(word.ctime) : new Date(), // 确保是Date对象
            learnDate: word.learnDate ? new Date(word.learnDate) : new Date(), // 确保是Date对象
            level: (word.level >= 0 && word.level <= 12 ? word.level : 1) as 0|1|2|3|4|5|6|7|8|9|10|11|12, // 补全level属性
            remember: word.remember ?? false, // 补全remember属性
            itemType: word.itemType || inferItemType(word.text), // 保留或推断itemType
            explains: word.explains || '', // 确保有explains属性
            pronunciation: word.pronunciation || '' // 确保有发音属性
        }));
};

