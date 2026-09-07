/**
 * Vitest 全局 setup：
 * 将 public/lang-core.js 注入 globalThis.LangCore，
 * 使依赖语言配置层的模块在测试环境无需逐文件手动加载。
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const langCorePath = resolve(process.cwd(), 'public/lang-core.js')
const code = readFileSync(langCorePath, 'utf-8')
// lang-core.js 是 IIFE，直接执行即挂载到 globalThis
;(new Function(code))()
