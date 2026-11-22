/**
 * 数字/字母映射图片的本机存储（仅 uTools 商店版启用）
 *
 * 用户上传的映射图片经压缩后是 dataURL（二进制内容），不应进入随账号同步的
 * 训练文档（与记忆宫殿桩图同一类问题）。商店版把图片本体落到本机大体积存储
 * （local-bulk-store，IndexedDB，不同步），训练文档的 imageUrl 只留 `bulk:` 引用；
 * 读取出口统一还原为 dataURL，业务层与同步负载（用户自有 WebDAV/服务器通道）无感。
 * 其他端不启用，文档原样读写。
 */

import { isStoreLocalOnly, localBulkGet, localBulkSet, localBulkRemove } from '@/adapters/local-bulk-store'

const BULK_PREFIX = 'bulk:mapping-image:'

interface WithImageUrl {
  imageUrl?: string
}

export function isBulkImageRef(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(BULK_PREFIX)
}

/** 引用键：同一数字/字母复用同一键，覆盖写不产生孤儿数据 */
function bulkKey(kind: string, itemKey: string): string {
  return `${BULK_PREFIX}${kind}:${encodeURIComponent(String(itemKey))}`
}

/** 是否含未外联的内联图片（旧数据迁移判定） */
export function hasInlineMappingImages(items: readonly WithImageUrl[] | undefined): boolean {
  if (!isStoreLocalOnly() || !items) return false
  return items.some((item) => typeof item?.imageUrl === 'string' && item.imageUrl.startsWith('data:'))
}

/**
 * 写入前外联：dataURL 图片落本机存储，imageUrl 改写为 bulk: 引用（就地修改）。
 * 已是引用的保持不变；非商店版原样返回。
 */
export async function externalizeMappingImages<T extends WithImageUrl>(
  items: T[],
  kind: string,
  keyOf: (item: T) => string,
): Promise<T[]> {
  if (!isStoreLocalOnly()) return items
  for (const item of items) {
    const url = item?.imageUrl
    if (typeof url === 'string' && url.startsWith('data:')) {
      const key = bulkKey(kind, keyOf(item))
      await localBulkSet(key, url)
      item.imageUrl = key
    }
  }
  return items
}

/**
 * 读取后还原：bulk: 引用还原为 dataURL（就地修改），本机缺失时置空串。
 * 非商店版原样返回。
 */
export function resolveMappingImages<T extends WithImageUrl>(items: T[]): T[] {
  if (!isStoreLocalOnly()) return items
  for (const item of items) {
    if (isBulkImageRef(item?.imageUrl)) {
      item.imageUrl = localBulkGet<string>(item.imageUrl) || ''
    }
  }
  return items
}

/** 删除关联条目时连带清理本机图片（仅当文档里还是引用形态时调用方传入原值） */
export async function removeMappingImageRef(kind: string, itemKey: string): Promise<void> {
  if (!isStoreLocalOnly()) return
  await localBulkRemove(bulkKey(kind, itemKey))
}
