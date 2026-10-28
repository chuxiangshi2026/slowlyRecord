import {beforeEach, describe, expect, it, vi} from 'vitest'

const {translateMock, ocrMock} = vi.hoisted(() => ({translateMock: vi.fn(), ocrMock: vi.fn()}))
vi.mock('@/utils/translation-api', () => ({translateWithPlatform: translateMock}))
vi.mock('@/utils/pic-translate', () => ({ocrRecognizeWithPlatform: ocrMock}))

import {testOcrConnection, testTranslationConnection} from './api-connection-test'

describe('API 配置测试', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const context = {fillRect: vi.fn(), fillText: vi.fn(), fillStyle: '', font: ''}
    vi.stubGlobal('document', {
      createElement: vi.fn(() => ({
        width: 0,
        height: 0,
        getContext: () => context,
        toDataURL: () => 'data:image/png;base64,aGVsbG8=',
      })),
    })
  })

  it('翻译测试使用独立测试模式并返回实际译文', async () => {
    translateMock.mockResolvedValue({success: true, explains: '你好'})
    const result = await testTranslationConnection('siliconflow')
    expect(translateMock).toHaveBeenCalledWith('hello', 'siliconflow', 'en', 'zh', {connectionTest: true})
    expect(result).toEqual({success: true, message: '配置可用', detail: 'hello → 你好'})
  })

  it('翻译测试直接展示当前引擎错误', async () => {
    translateMock.mockResolvedValue({success: false, errorMsg: 'API Key 无效'})
    expect((await testTranslationConnection('deepseek')).message).toBe('API Key 无效')
    translateMock.mockRejectedValue(new Error('网络连接失败'))
    expect((await testTranslationConnection('deepseek')).message).toBe('网络连接失败')
  })

  it('OCR 测试只调用识别链路并返回识别文本', async () => {
    ocrMock.mockResolvedValue({errorCode: '0', resRegions: [{context: 'hello', tranContent: '你好'}]})
    const result = await testOcrConnection('siliconflow')
    expect(ocrMock).toHaveBeenCalledWith('aGVsbG8=', 'siliconflow')
    expect(result).toEqual({success: true, message: '配置可用', detail: '识别结果：hello'})
  })

  it('OCR 测试透传鉴权错误并拒绝空结果', async () => {
    ocrMock.mockResolvedValueOnce({errorCode: '401', errorMessage: 'API Key 无效', resRegions: []})
    expect((await testOcrConnection('siliconflow')).message).toBe('API Key 无效')
    ocrMock.mockResolvedValueOnce({errorCode: '0', resRegions: []})
    expect((await testOcrConnection('siliconflow')).success).toBe(false)
  })
})
