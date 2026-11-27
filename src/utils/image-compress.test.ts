// @vitest-environment jsdom
/**
 * image-compress 单元测试（真实驱动压缩逻辑，而非自造 base64 字符串）
 *
 * 被测源码：src/utils/image-compress.ts
 *
 * 覆盖范围：
 * 1. 两条入口：compressImage(File) 经 FileReader 读成 dataURL；compressImageFromDataURL 直读 dataURL
 * 2. 尺寸计算：未超限保持原尺寸、宽超限、高超限、双向超限取更小比例、极端宽/窄、自定义 maxWidth/maxHeight
 * 3. 绘制：canvas 尺寸、drawImage 参数、JPEG 白色底 fillRect、webp 探测画布为 1x1
 * 4. 格式与质量：默认 webp + quality 0.7、浏览器不支持 webp 时回退 jpeg、显式 mimeType 优先
 * 5. 体积阈值：首次即达标不重试、逐级降 quality 循环、quality 撞到 0.1 下限后缩小尺寸循环、
 *    质量本身 ≤0.1 时跳过质量循环、缩到 20px 下限后停止、0 字节 payload 视为 0 字节
 * 6. 边界与错误：0 尺寸图片、非图片 MIME（源码不校验）、Image onerror、FileReader onerror、
 *    getContext 返回 null、主画布/webp 探测画布 toDataURL 抛错
 *
 * 所有浏览器 API（Image / FileReader / document.createElement('canvas') / canvas context）
 * 均为 fake，每个用例独立安装，afterEach 统一恢复，不依赖真实图片解码。
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { compressImage, compressImageFromDataURL } from './image-compress'

/** 画布 2d context 的调用记录（fillStyle 取调用瞬间的快照） */
interface CtxCall {
  name: 'fillRect' | 'drawImage' | 'clearRect'
  args: unknown[]
  fillStyle: string
}

interface FakeCtx {
  fillStyle: string
  calls: CtxCall[]
  fillRect: (...args: unknown[]) => void
  drawImage: (...args: unknown[]) => void
  clearRect: (...args: unknown[]) => void
}

interface FakeCanvas {
  width: number
  height: number
  getContext: (type: string) => FakeCtx | null
  toDataURL: (type?: string, quality?: number) => string
}

interface ToDataURLCall {
  canvasIndex: number
  canvas: FakeCanvas
  type?: string
  quality?: number
  /** 调用瞬间的画布宽高快照（画布对象后续还会被改写，不能按引用断言） */
  width: number
  height: number
  /** 本次调用返回的字符串，便于断言「最终结果 === 最后一次调用」 */
  value: string
}

interface FakeImageInstance {
  src: string
  width: number
  height: number
  onload: (() => void) | null
  onerror: (() => void) | null
}

interface FakeReaderInstance {
  file: unknown
  result: string | null
  onload: ((e: { target: { result: string | null } }) => void) | null
  onerror: (() => void) | null
}

type DataUrlBuilder = (
  canvas: FakeCanvas,
  type: string | undefined,
  quality: number | undefined,
  callIndex: number
) => string

interface FakeDomOptions {
  /** fake Image 的 width/height（即「原图尺寸」） */
  imageWidth?: number
  imageHeight?: number
  /** 设置 src 时触发 onerror 而不是 onload */
  imageError?: boolean
  /** getContext('2d') 返回 null */
  ctxUnavailable?: boolean
  /** 浏览器是否支持 webp（影响 webp 探测画布的返回值） */
  webpSupported?: boolean
  /** FileReader 触发 onerror */
  fileReadError?: boolean
  /** FileReader.readAsDataURL 产出的 dataURL */
  fileReaderResult?: string
  /** 默认 toDataURL 返回的 base64 payload 长度（决定「压缩后字节数」） */
  payloadLength?: number
  /** 自定义 toDataURL 返回值 */
  toDataURL?: DataUrlBuilder
}

/** 构造「解码后恰好 N 字节」的 dataURL（getDataUrlSize 按 floor(len*3/4) 估算） */
function dataUrlWithBytes(mime: string, bytes: number): string {
  const base64Length = Math.ceil((bytes * 4) / 3)
  return `data:${mime};base64,${'A'.repeat(base64Length)}`
}

function createFakeCtx(): FakeCtx {
  const calls: CtxCall[] = []
  const ctx: FakeCtx = {
    fillStyle: '#000000',
    calls,
    fillRect(...args) {
      calls.push({ name: 'fillRect', args, fillStyle: ctx.fillStyle })
    },
    drawImage(...args) {
      calls.push({ name: 'drawImage', args, fillStyle: ctx.fillStyle })
    },
    clearRect(...args) {
      calls.push({ name: 'clearRect', args, fillStyle: ctx.fillStyle })
    },
  }
  return ctx
}

/** 安装 fake 浏览器环境，返回可断言的句柄 */
function installFakeDom(options: FakeDomOptions = {}) {
  const {
    imageWidth = 400,
    imageHeight = 100,
    imageError = false,
    ctxUnavailable = false,
    webpSupported = true,
    fileReadError = false,
    fileReaderResult = 'data:image/png;base64,RklMRQ==',
    payloadLength = 8,
  } = options

  const canvases: FakeCanvas[] = []
  const contexts: FakeCtx[] = []
  const toDataURLCalls: ToDataURLCall[] = []
  const images: FakeImageInstance[] = []
  const readers: FakeReaderInstance[] = []

  const buildDataUrl: DataUrlBuilder =
    options.toDataURL ??
    ((canvas, type) => {
      // 不支持 webp 时，真实浏览器对 'image/webp' 的请求会静默返回 png
      const mime = !webpSupported && type === 'image/webp' ? 'image/png' : (type ?? 'image/png')
      // webp 探测画布固定 1x1，避免与原图尺寸混淆
      const payload = canvas.width === 1 && canvas.height === 1 ? 4 : payloadLength
      return `data:${mime};base64,${'A'.repeat(payload)}`
    })

  vi.spyOn(document, 'createElement').mockImplementation(((
    tagName: string
  ) => {
    if (tagName !== 'canvas') {
      throw new Error(`测试未预期 createElement('${tagName}')`)
    }
    const canvasIndex = canvases.length
    const ctx = createFakeCtx()
    const canvas: FakeCanvas = {
      width: 0,
      height: 0,
      getContext: () => (ctxUnavailable ? null : ctx),
      toDataURL(type?: string, quality?: number) {
        const value = buildDataUrl(canvas, type, quality, toDataURLCalls.length)
        toDataURLCalls.push({ canvasIndex, canvas, type, quality, width: canvas.width, height: canvas.height, value })
        return value
      },
    }
    canvases.push(canvas)
    contexts.push(ctx)
    return canvas as unknown as HTMLElement
  }) as typeof document.createElement)

  class FakeImage implements FakeImageInstance {
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    width = imageWidth
    height = imageHeight
    private _src = ''

    constructor() {
      images.push(this)
    }

    get src(): string {
      return this._src
    }

    set src(value: string) {
      this._src = value
      // onload/onerror 在赋值 src 之前已挂好，这里同步触发
      if (imageError) this.onerror?.()
      else this.onload?.()
    }
  }
  vi.stubGlobal('Image', FakeImage)

  class FakeFileReader implements FakeReaderInstance {
    onload: ((e: { target: { result: string | null } }) => void) | null = null
    onerror: (() => void) | null = null
    result: string | null = null
    file: unknown = null

    constructor() {
      readers.push(this)
    }

    readAsDataURL(file: unknown) {
      this.file = file
      this.result = fileReaderResult
      if (fileReadError) this.onerror?.()
      else this.onload?.({ target: { result: this.result } })
    }
  }
  vi.stubGlobal('FileReader', FakeFileReader)

  const mainToDataURLCalls = () => toDataURLCalls.filter((c) => c.canvasIndex === 0)

  return {
    canvases,
    contexts,
    /** contexts 在安装后才被填充，必须延迟取值 */
    get mainCtx(): FakeCtx {
      return contexts[0]
    },
    toDataURLCalls,
    mainToDataURLCalls,
    images,
    readers,
  }
}

const SRC_DATA_URL = 'data:image/png;base64,QQ=='

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('尺寸计算与绘制', () => {
  const scaleCases: Array<{
    name: string
    input: [number, number]
    options?: { maxWidth?: number; maxHeight?: number }
    expected: [number, number]
  }> = [
    { name: '未超限时保持原始尺寸', input: [120, 80], expected: [120, 80] },
    { name: '宽度超限时按宽等比缩小（400x100 -> 200x50）', input: [400, 100], expected: [200, 50] },
    { name: '高度超限时按高等比缩小（100x400 -> 50x200）', input: [100, 400], expected: [50, 200] },
    { name: '宽高均超限时取更小比例（800x200 -> 200x50）', input: [800, 200], expected: [200, 50] },
    { name: '极端宽图（1000x10 -> 200x2）', input: [1000, 10], expected: [200, 2] },
    { name: '极端窄图（10x1000 -> 2x200）', input: [10, 1000], expected: [2, 200] },
    { name: '正方形按比例缩小（400x400 -> 200x200）', input: [400, 400], expected: [200, 200] },
    {
      name: '自定义 maxWidth/maxHeight（400x200 + 100x50 -> 100x50）',
      input: [400, 200],
      options: { maxWidth: 100, maxHeight: 50 },
      expected: [100, 50],
    },
  ]

  for (const testCase of scaleCases) {
    it(testCase.name, async () => {
      const dom = installFakeDom({ imageWidth: testCase.input[0], imageHeight: testCase.input[1] })
      const result = await compressImageFromDataURL(SRC_DATA_URL, testCase.options)

      const [mainCanvas, probeCanvas] = dom.canvases
      expect(dom.canvases).toHaveLength(2)
      expect([mainCanvas.width, mainCanvas.height]).toEqual(testCase.expected)
      // 主画布按缩放后尺寸绘制，且保持宽高比
      expect(dom.mainCtx.calls).toEqual([
        { name: 'drawImage', args: [dom.images[0], 0, 0, testCase.expected[0], testCase.expected[1]], fillStyle: '#000000' },
      ])
      // webp 探测画布固定 1x1，且只探测一次
      expect([probeCanvas.width, probeCanvas.height]).toEqual([1, 1])
      const probeCalls = dom.toDataURLCalls.filter((c) => c.canvasIndex === 1)
      expect(probeCalls).toHaveLength(1)
      expect(probeCalls[0].type).toBe('image/webp')
      expect(result).toBe(dom.mainToDataURLCalls()[0].value)
    })
  }
})

describe('输出格式与质量', () => {
  it('默认输出 image/webp，quality 使用默认 0.7，且不填白底', async () => {
    const dom = installFakeDom()
    const result = await compressImageFromDataURL(SRC_DATA_URL)

    const calls = dom.mainToDataURLCalls()
    expect(calls).toHaveLength(1)
    expect(calls[0].type).toBe('image/webp')
    expect(calls[0].quality).toBe(0.7)
    expect(calls[0].value.startsWith('data:image/webp')).toBe(true)
    expect(result).toBe(calls[0].value)
    // webp 支持透明通道，不应出现 fillRect
    expect(dom.mainCtx.calls.map((c) => c.name)).toEqual(['drawImage'])
  })

  it('浏览器不支持 webp 时回退 image/jpeg，并铺白色底', async () => {
    const dom = installFakeDom({ imageWidth: 120, imageHeight: 80, webpSupported: false })
    const result = await compressImageFromDataURL(SRC_DATA_URL)

    const calls = dom.mainToDataURLCalls()
    expect(calls).toHaveLength(1)
    expect(calls[0].type).toBe('image/jpeg')
    expect(result.startsWith('data:image/jpeg')).toBe(true)

    const names = dom.mainCtx.calls.map((c) => c.name)
    expect(names).toEqual(['fillRect', 'drawImage'])
    const fillRect = dom.mainCtx.calls[0]
    expect(fillRect.fillStyle).toBe('#ffffff')
    expect(fillRect.args).toEqual([0, 0, 120, 80])
    expect(dom.mainCtx.calls[1].args).toEqual([dom.images[0], 0, 0, 120, 80])
  })

  it('显式 mimeType 优先于默认值（image/png 不铺白底）', async () => {
    const dom = installFakeDom({ imageWidth: 120, imageHeight: 80 })
    const result = await compressImageFromDataURL(SRC_DATA_URL, { mimeType: 'image/png', quality: 0.5 })

    const calls = dom.mainToDataURLCalls()
    expect(calls[0].type).toBe('image/png')
    expect(calls[0].quality).toBe(0.5)
    expect(result.startsWith('data:image/png')).toBe(true)
    expect(dom.mainCtx.calls.map((c) => c.name)).toEqual(['drawImage'])
  })

  it(
    '显式 mimeType 不被 webp 探测覆盖（浏览器不支持 webp 时仍输出 png）',
    async () => {
      // 只有请求 webp 且浏览器不支持时才回退 jpeg；显式 png 必须保留（透明通道）
      const dom = installFakeDom({ imageWidth: 120, imageHeight: 80, webpSupported: false })
      await compressImageFromDataURL(SRC_DATA_URL, { mimeType: 'image/png' })

      expect(dom.mainToDataURLCalls()[0].type).toBe('image/png')
    }
  )
})

describe('体积阈值与重试循环', () => {
  it('首次压缩即小于阈值时不重试', async () => {
    const dom = installFakeDom({ imageWidth: 200, imageHeight: 200 })
    const result = await compressImageFromDataURL(SRC_DATA_URL)

    expect(dom.mainToDataURLCalls()).toHaveLength(1)
    expect(dom.mainCtx.calls.map((c) => c.name)).toEqual(['drawImage'])
    expect(result).toBe(dom.mainToDataURLCalls()[0].value)
  })

  it('超阈值时逐级降低 quality（0.7 -> 0.6 -> 0.5 -> 0.4）直到达标', async () => {
    const dom = installFakeDom({
      imageWidth: 100,
      imageHeight: 100,
      toDataURL: (canvas, type, quality) => {
        if (canvas.width === 1) return 'data:image/webp;base64,AAAA'
        // quality > 0.45 时返回 200KB，之后返回 1KB
        return dataUrlWithBytes(type!, quality! > 0.45 ? 200_000 : 1_000)
      },
    })

    const result = await compressImageFromDataURL(SRC_DATA_URL, { maxSizeBytes: 10_000 })

    const calls = dom.mainToDataURLCalls()
    expect(calls).toHaveLength(4)
    expect(calls.map((c) => Number(c.quality!.toFixed(2)))).toEqual([0.7, 0.6, 0.5, 0.4])
    expect(calls.every((c) => c.type === 'image/webp')).toBe(true)
    // 每次重试都 clearRect + 重绘，尺寸不变
    expect(dom.mainCtx.calls.filter((c) => c.name === 'clearRect')).toHaveLength(3)
    const draws = dom.mainCtx.calls.filter((c) => c.name === 'drawImage')
    expect(draws).toHaveLength(4)
    expect(draws.every((c) => JSON.stringify(c.args) === JSON.stringify([dom.images[0], 0, 0, 100, 100]))).toBe(true)
    expect(result).toBe(calls[3].value)
  })

  it('quality 降到 0.1 仍超限时转为缩小尺寸，缩到 20px 停止并返回最后结果', async () => {
    const dom = installFakeDom({
      imageWidth: 100,
      imageHeight: 100,
      toDataURL: (canvas, type) => {
        if (canvas.width === 1) return 'data:image/webp;base64,AAAA'
        return dataUrlWithBytes(type!, 200_000) // 始终超限
      },
    })

    const result = await compressImageFromDataURL(SRC_DATA_URL, { maxSizeBytes: 10_000 })

    const calls = dom.mainToDataURLCalls()
    // 质量循环：0.7 起每次 -0.1，浮点累积使 0.1 略大于 0.1，共 8 次；之后尺寸缩小 7 次
    expect(calls).toHaveLength(15)
    expect(calls.map((c) => c.width)).toEqual([100, 100, 100, 100, 100, 100, 100, 100, 80, 64, 51, 40, 32, 25, 20])
    expect(Number(calls[6].quality!.toFixed(4))).toBe(0.1)
    // 浮点累积后最后一次 quality 已降到约 0
    expect(calls[14].quality!).toBeLessThan(0.001)
    // 触底后不再继续缩（width > 20 的守卫）
    expect([dom.canvases[0].width, dom.canvases[0].height]).toEqual([20, 20])
    expect(dom.mainCtx.calls.filter((c) => c.name === 'clearRect')).toHaveLength(14)
    expect(dom.mainCtx.calls[dom.mainCtx.calls.length - 1]).toEqual({
      name: 'drawImage',
      args: [dom.images[0], 0, 0, 20, 20],
      fillStyle: '#000000',
    })
    // 仍未达标时把最后一次结果原样返回（不抛错）
    expect(result).toBe(calls[14].value)
  })

  it('quality 本身 ≤0.1 时跳过质量循环，直接缩小尺寸', async () => {
    const dom = installFakeDom({
      imageWidth: 100,
      imageHeight: 100,
      toDataURL: (canvas, type) => {
        if (canvas.width === 1) return 'data:image/webp;base64,AAAA'
        return dataUrlWithBytes(type!, 200_000)
      },
    })

    await compressImageFromDataURL(SRC_DATA_URL, { maxSizeBytes: 10_000, quality: 0.05 })

    const calls = dom.mainToDataURLCalls()
    expect(calls).toHaveLength(8)
    expect(calls.map((c) => c.width)).toEqual([100, 80, 64, 51, 40, 32, 25, 20])
    expect(calls.every((c) => c.quality === 0.05)).toBe(true)
    // 首轮绘制 + 7 次重绘
    expect(dom.mainCtx.calls.filter((c) => c.name === 'drawImage')).toHaveLength(8)
  })

  it('尺寸已到 20px 下限后即使超限也不再缩小', async () => {
    const dom = installFakeDom({
      imageWidth: 30,
      imageHeight: 30,
      toDataURL: (canvas, type) => {
        if (canvas.width === 1) return 'data:image/webp;base64,AAAA'
        return dataUrlWithBytes(type!, 200_000)
      },
    })

    await compressImageFromDataURL(SRC_DATA_URL, { maxSizeBytes: 10_000, quality: 0.05 })

    const calls = dom.mainToDataURLCalls()
    expect(calls.map((c) => c.width)).toEqual([30, 24, 19])
    expect(dom.canvases[0].width).toBe(19)
  })

  it('0 字节 payload 视为 0 字节，不触发任何重试', async () => {
    const dom = installFakeDom({
      imageWidth: 200,
      imageHeight: 200,
      toDataURL: (canvas) =>
        canvas.width === 1 ? 'data:image/webp;base64,AAAA' : 'data:image/webp;base64,',
    })

    const result = await compressImageFromDataURL(SRC_DATA_URL)

    expect(dom.mainToDataURLCalls()).toHaveLength(1)
    expect(result).toBe('data:image/webp;base64,')
    expect(dom.mainCtx.calls.map((c) => c.name)).toEqual(['drawImage'])
  })
})

describe('入口与输入类型', () => {
  it('compressImage(File) 经 FileReader 读出 dataURL 再交给 Image', async () => {
    const dom = installFakeDom({ imageWidth: 300, imageHeight: 150 })
    const file = new File(['fake-bytes'], 'photo.png', { type: 'image/png' })

    const result = await compressImage(file)

    expect(dom.readers).toHaveLength(1)
    expect(dom.readers[0].file).toBe(file)
    expect(dom.images).toHaveLength(1)
    expect(dom.images[0].src).toBe('data:image/png;base64,RklMRQ==')
    expect([dom.canvases[0].width, dom.canvases[0].height]).toEqual([200, 100])
    expect(result.startsWith('data:image/')).toBe(true)
  })

  it('compressImageFromDataURL 直接把入参作为 Image.src', async () => {
    const dom = installFakeDom({ imageWidth: 50, imageHeight: 50 })
    const input = 'data:image/jpeg;base64,/9j/4AAQSkZJRg=='

    const result = await compressImageFromDataURL(input)

    expect(dom.images[0].src).toBe(input)
    expect(dom.readers).toHaveLength(0) // 不经过 FileReader
    expect([dom.canvases[0].width, dom.canvases[0].height]).toEqual([50, 50])
    expect(typeof result).toBe('string')
    expect(result).toBe(dom.mainToDataURLCalls()[0].value)
  })

  it('两个入口都返回 dataURL 字符串（不返回 Blob），MIME 与 toDataURL 入参一致', async () => {
    const dom = installFakeDom({ imageWidth: 100, imageHeight: 100 })
    const fromDataUrl = compressImageFromDataURL(SRC_DATA_URL, { mimeType: 'image/jpeg' })
    const fromFile = compressImage(new File(['x'], 'a.png', { type: 'image/png' }), { mimeType: 'image/jpeg' })

    const [a, b] = await Promise.all([fromDataUrl, fromFile])
    for (const value of [a, b]) {
      expect(typeof value).toBe('string')
      expect(value.startsWith('data:image/jpeg;base64,')).toBe(true)
    }
    expect(dom.mainToDataURLCalls().every((c) => c.type === 'image/jpeg')).toBe(true)
  })

  it('图片尺寸为 0 时不缩放、不崩溃', async () => {
    const dom = installFakeDom({ imageWidth: 0, imageHeight: 0 })

    await expect(compressImageFromDataURL(SRC_DATA_URL)).resolves.toBe(dom.mainToDataURLCalls()[0].value)

    expect([dom.canvases[0].width, dom.canvases[0].height]).toEqual([0, 0])
    expect(dom.mainCtx.calls[0].args).toEqual([dom.images[0], 0, 0, 0, 0])
    expect(dom.mainToDataURLCalls()).toHaveLength(1)
  })

  it('不校验输入 MIME：非图片 dataURL 也按图片尺寸压缩（源码无 MIME 白名单）', async () => {
    const dom = installFakeDom({ imageWidth: 300, imageHeight: 300 })

    const result = await compressImageFromDataURL('data:text/plain;base64,SGVsbG8=')

    expect(dom.images[0].src).toBe('data:text/plain;base64,SGVsbG8=')
    expect([dom.canvases[0].width, dom.canvases[0].height]).toEqual([200, 200])
    expect(result.startsWith('data:image/webp')).toBe(true)
  })
})

describe('错误路径', () => {
  it('Image 触发 onerror 时 compressImageFromDataURL reject「图片加载失败」', async () => {
    installFakeDom({ imageError: true })
    await expect(compressImageFromDataURL(SRC_DATA_URL)).rejects.toThrow('图片加载失败')
  })

  it('Image 触发 onerror 时 compressImage reject「图片加载失败」', async () => {
    installFakeDom({ imageError: true })
    await expect(compressImage(new File(['x'], 'a.png', { type: 'image/png' }))).rejects.toThrow('图片加载失败')
  })

  it('FileReader 触发 onerror 时 reject「文件读取失败」', async () => {
    const dom = installFakeDom({ fileReadError: true })

    await expect(compressImage(new File(['x'], 'a.png', { type: 'image/png' }))).rejects.toThrow('文件读取失败')
    // 读取失败后不再创建 Image
    expect(dom.images).toHaveLength(0)
    expect(dom.canvases).toHaveLength(0)
  })

  it('getContext("2d") 返回 null 时因空指针 reject（源码用非空断言 !）', async () => {
    installFakeDom({ ctxUnavailable: true })
    // 源码 src/utils/image-compress.ts:78 用 `!` 断言 context 非空，null 会在 drawImage 处抛 TypeError
    await expect(compressImageFromDataURL(SRC_DATA_URL)).rejects.toThrow(TypeError)
  })

  it('主画布 toDataURL 抛错时把该错误透传给 reject', async () => {
    const error = new Error('toDataURL 失败')
    const dom = installFakeDom({
      toDataURL: (canvas, type) => {
        if (canvas === dom.canvases[0]) throw error
        return type === 'image/webp' ? 'data:image/webp;base64,AAAA' : 'data:image/png;base64,AAAA'
      },
    })

    await expect(compressImageFromDataURL(SRC_DATA_URL)).rejects.toThrow('toDataURL 失败')
  })

  it('webp 探测画布 toDataURL 抛错时直接 reject（不回退 jpeg）', async () => {
    const dom = installFakeDom({
      toDataURL: (canvas) => {
        if (canvas === dom.canvases[1]) throw new Error('webp 探测失败')
        return 'data:image/webp;base64,AAAA'
      },
    })

    await expect(compressImageFromDataURL(SRC_DATA_URL)).rejects.toThrow('webp 探测失败')
  })
})
