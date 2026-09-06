/**
 * capture-shared 的 OCR 结果映射逻辑测试
 *
 * 只测纯函数（parseBoundingBox / mapOcrRegions / mapOcrResult），
 * 数据来源为 testdata/ 下各 OCR 引擎的真实响应样本
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { parseBoundingBox, mapOcrRegions, mapOcrResult } from '../capture-shared'
import type { OcrResult } from '../../../utils/pic-translate'

function loadSample(name: string): OcrResult {
  const raw = readFileSync(resolve(process.cwd(), 'testdata', name), 'utf-8')
  return JSON.parse(raw) as OcrResult
}

describe('parseBoundingBox', () => {
  it('解析逗号分隔格式（有道/阿里/腾讯）', () => {
    expect(parseBoundingBox('39,31,340,27')).toEqual({ x: 39, y: 31, width: 340, height: 27 })
  })

  it('解析空格分隔格式（百度）', () => {
    expect(parseBoundingBox('0 9 603 52')).toEqual({ x: 0, y: 9, width: 603, height: 52 })
  })

  it('缺失或非法输入返回 undefined', () => {
    expect(parseBoundingBox(undefined)).toBeUndefined()
    expect(parseBoundingBox('')).toBeUndefined()
    expect(parseBoundingBox('1,2,3')).toBeUndefined()
    expect(parseBoundingBox('a,b,c,d')).toBeUndefined()
  })
})

describe('mapOcrRegions', () => {
  it('腾讯样本：context 映射为 text，boundingBox 映射为 bounds', () => {
    const sample = loadSample('picTencentdata.json')
    const results = mapOcrRegions(sample.resRegions)
    expect(results.length).toBe(sample.resRegions!.length)
    expect(results[0].text).toBe("console.log('apprest:', result)")
    expect(results[0].confidence).toBe(1)
    expect(results[0].bounds).toEqual({ x: 39, y: 31, width: 340, height: 27 })
  })

  it('阿里样本（errorCode 为 200 的字符串）同样可映射', () => {
    const sample = loadSample('picalidata.json')
    const results = mapOcrRegions(sample.resRegions)
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].text).toBe('if')
    expect(results[0].bounds).toEqual({ x: 31, y: 0, width: 36, height: 21 })
  })

  it('百度样本：空格分隔的 boundingBox 也能解析', () => {
    const sample = loadSample('baidupicdata.json')
    const results = mapOcrRegions(sample.resRegions)
    expect(results.length).toBe(1)
    expect(results[0].bounds).toEqual({ x: 0, y: 9, width: 603, height: 52 })
  })

  it('过滤空文本区域，undefined 返回空数组', () => {
    expect(mapOcrRegions(undefined)).toEqual([])
    expect(
      mapOcrRegions([
        { boundingBox: '0,0,1,1', context: '', tranContent: '' },
        { boundingBox: '0,0,1,1', context: '  ', tranContent: '' },
        { boundingBox: '0,0,1,1', context: ' hello ', tranContent: '你好' },
      ])
    ).toEqual([{ text: 'hello', confidence: 1, bounds: { x: 0, y: 0, width: 1, height: 1 } }])
  })
})

describe('mapOcrResult', () => {
  it('errorCode 为 0 时返回映射结果', () => {
    const sample = loadSample('picTencentdata.json')
    expect(mapOcrResult(sample).length).toBe(sample.resRegions!.length)
  })

  it('errorCode 非 0 时抛出带引导语的错误', () => {
    expect(() =>
      mapOcrResult({ errorCode: '108', errorMessage: 'appKey无效', resRegions: [] })
    ).toThrow(/OCR 识别失败.*appKey无效.*检查 API 密钥/)
  })
})
