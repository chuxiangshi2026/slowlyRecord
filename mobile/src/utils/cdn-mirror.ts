/**
 * jsDelivr 镜像变体（音频/数据 CDN 容灾）
 *
 * 背景：cdn.jsdelivr.net 在境内网络时通时断，表现为「朗读失败，等一会又能读」。
 * 对 jsDelivr 的 gh 资源依次改用镜像域名重试：主域 → jsd.onmicrosoft.cn（境内镜像）
 * → fastly.jsdelivr.net。路径形状完全一致（/gh/user/repo@ref/path），可直接替换域名。
 */

const JSDELIVR_PREFIX = 'https://cdn.jsdelivr.net'
const MIRRORS = ['https://jsd.onmicrosoft.cn', 'https://fastly.jsdelivr.net']

/** 给 jsDelivr 资源 URL 生成镜像变体链（首个为原 URL）；非 jsDelivr URL 原样返回 */
export function cdnUrlVariants(url: string): string[] {
  if (!url.startsWith(`${JSDELIVR_PREFIX}/`)) return [url]
  const rest = url.slice(JSDELIVR_PREFIX.length)
  return [url, ...MIRRORS.map((m) => m + rest)]
}
