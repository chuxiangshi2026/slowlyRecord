/**
 * 精简 MD5（仅字符串输入，UTF-8 编码），输出 32 位小写 hex。
 * 用于与离线语音生成脚本对齐文件名哈希：python hashlib.md5(str.encode('utf-8'))。
 * 小程序不能用 crypto-js（依赖 Node 环境），故内置此实现，正确性由 md5.test.ts 的标准向量守护。
 */

/** 每轮循环的左循环移位量（RFC 1321） */
const S = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
]

/** K[i] = floor(abs(sin(i + 1)) * 2^32)，双精度足以精确到 32 位整数 */
const K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) | 0)

function utf8Encode(str: string): number[] {
  const bytes: number[] = []
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i)
    if (code < 0x80) {
      bytes.push(code)
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f))
    } else if (code >= 0xd800 && code < 0xdc00 && i + 1 < str.length) {
      // 代理对：合并为码点后按 4 字节编码
      code = 0x10000 + ((code & 0x3ff) << 10) + (str.charCodeAt(++i) & 0x3ff)
      bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f))
    } else {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f))
    }
  }
  return bytes
}

const rotl = (x: number, n: number): number => (x << n) | (x >>> (32 - n))

/** 32 位整数按小端序输出 8 位 hex */
function leHex(n: number): string {
  let s = ''
  for (let i = 0; i < 4; i++) s += ((n >>> (8 * i)) & 0xff).toString(16).padStart(2, '0')
  return s
}

export function md5Hex(input: string): string {
  const bytes = utf8Encode(input)
  const bitLen = bytes.length * 8
  bytes.push(0x80)
  while (bytes.length % 64 !== 56) bytes.push(0)
  // 附加 64 位小端长度（输入远小于 2^53 位，直接用双精度拆字节）
  for (let i = 0; i < 8; i++) bytes.push(Math.floor(bitLen / 2 ** (8 * i)) & 0xff)

  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476
  for (let off = 0; off < bytes.length; off += 64) {
    const M: number[] = []
    for (let j = 0; j < 16; j++) {
      M[j] = bytes[off + j * 4] | (bytes[off + j * 4 + 1] << 8) | (bytes[off + j * 4 + 2] << 16) | (bytes[off + j * 4 + 3] << 24)
    }
    let A = a0, B = b0, C = c0, D = d0
    for (let i = 0; i < 64; i++) {
      let F: number, k: number
      if (i < 16) { F = (B & C) | (~B & D); k = i }
      else if (i < 32) { F = (D & B) | (~D & C); k = (5 * i + 1) % 16 }
      else if (i < 48) { F = B ^ C ^ D; k = (3 * i + 5) % 16 }
      else { F = C ^ (B | ~D); k = (7 * i) % 16 }
      const tmp = D
      D = C
      C = B
      B = (B + rotl((A + F + K[i] + M[k]) | 0, S[i])) | 0
      A = tmp
    }
    a0 = (a0 + A) | 0
    b0 = (b0 + B) | 0
    c0 = (c0 + C) | 0
    d0 = (d0 + D) | 0
  }
  return leHex(a0) + leHex(b0) + leHex(c0) + leHex(d0)
}
