/**
 * secret-crypto（user-set 密钥字段加密）单元测试
 * 密文形态、往返解密、明文/失败兜底
 */
import { describe, it, expect } from 'vitest'
import { decryptSecret, encryptSecret, hasSecretCrypto, isEncryptedSecret } from './secret-crypto'

describe('secret-crypto', () => {
  it('加密产出 enc:v1: 前缀密文，且同一明文两次加密结果不同（随机 IV）', async () => {
    const a = await encryptSecret('my-api-secret')
    const b = await encryptSecret('my-api-secret')
    expect(isEncryptedSecret(a)).toBe(true)
    expect(isEncryptedSecret(b)).toBe(true)
    expect(a).not.toBe(b)
    expect(a).not.toContain('my-api-secret')
  })

  it('加密-解密往返还原', async () => {
    const cipher = await encryptSecret('sk-1234567890abcdef')
    expect(await decryptSecret(cipher)).toBe('sk-1234567890abcdef')
  })

  it('空串与已是密文的值加密时原样返回', async () => {
    expect(await encryptSecret('')).toBe('')
    const cipher = await encryptSecret('abc')
    expect(await encryptSecret(cipher)).toBe(cipher)
  })

  it('非密文解密时原样返回（兼容历史明文）', async () => {
    expect(await decryptSecret('plain-key')).toBe('plain-key')
  })

  it('密文被篡改或损坏时解密返回空串（不会把密文当密钥用）', async () => {
    const cipher = await encryptSecret('secret')
    const tampered = cipher.slice(0, -4) + 'AAAA'
    expect(await decryptSecret(tampered)).toBe('')
    expect(await decryptSecret('enc:v1:not-valid-base64!!!')).toBe('')
  })

  it('测试环境具备 WebCrypto', () => {
    expect(hasSecretCrypto()).toBe(true)
  })
})
