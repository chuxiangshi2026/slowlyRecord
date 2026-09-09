import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { formulaImageSrc } from './knowledge-image'
import { fetchKnowledgePack } from './knowledge-pack-loader'

/** 仓库根目录（本文件位于 mobile/src/subPackages/pages-knowledge/utils/） */
const REPO_ROOT = fileURLToPath(new URL('../../../../../', import.meta.url))

/** 读取 public/knowledgebanks 下所有知识包 JSON */
function readAllPacks(): Record<string, any>[] {
  const dir = join(REPO_ROOT, 'public', 'knowledgebanks')
  return readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(readFileSync(join(dir, f), 'utf8')))
}

describe('formulaImageSrc', () => {
  it('相对路径补 /static 前缀', () => {
    expect(formulaImageSrc('knowledgebanks/images/math-calculus-4.png')).toBe(
      '/static/knowledgebanks/images/math-calculus-4.png',
    )
  })

  it('已带斜杠或 static 前缀时不重复拼接', () => {
    expect(formulaImageSrc('/knowledgebanks/images/a.png')).toBe('/static/knowledgebanks/images/a.png')
    expect(formulaImageSrc('static/knowledgebanks/images/a.png')).toBe('/static/knowledgebanks/images/a.png')
  })

  it('绝对 URL 与 dataURL 原样返回', () => {
    expect(formulaImageSrc('https://cdn.example.com/a.png')).toBe('https://cdn.example.com/a.png')
    expect(formulaImageSrc('data:image/png;base64,AAA')).toBe('data:image/png;base64,AAA')
  })

  it('无图返回空串', () => {
    expect(formulaImageSrc()).toBe('')
    expect(formulaImageSrc('')).toBe('')
  })
})

describe('公式图片数据链路', () => {
  it('带 image 的条目都有 latex，且路径与条目 id 一致', () => {
    const packs = readAllPacks()
    let count = 0
    for (const pack of packs) {
      for (const item of pack.items ?? []) {
        if (!item.image) continue
        count++
        expect(item.latex, `${item.id} 缺少 latex`).toBeTruthy()
        expect(item.image).toBe(`knowledgebanks/images/${item.id}.png`)
      }
    }
    expect(count).toBeGreaterThan(0)
  })

  it('每个公式 PNG 都同时存在于桌面端 public 与移动端 static', () => {
    for (const pack of readAllPacks()) {
      for (const item of pack.items ?? []) {
        if (!item.image) continue
        expect(existsSync(join(REPO_ROOT, 'public', item.image)), `${item.image} 缺桌面端产物`).toBe(true)
        expect(
          existsSync(join(REPO_ROOT, 'mobile', 'src', 'static', item.image)),
          `${item.image} 缺移动端产物`,
        ).toBe(true)
      }
    }
  })

  it('内置包经 loader 标准化后仍保留 image 字段（缓存/校验环节不丢图）', async () => {
    const pack = await fetchKnowledgePack('math-calculus')
    const withImage = pack.items.filter(i => i.image)
    expect(withImage.length).toBeGreaterThan(0)
    for (const item of withImage) {
      expect(item.latex).toBeTruthy()
      expect(formulaImageSrc(item.image)).toBe(`/static/${item.image}`)
    }
  })
})
