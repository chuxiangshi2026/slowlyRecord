/**
 * 知识条目公式图片路径工具（移动端）。
 *
 * 知识包 JSON 的 image 字段是「相对静态资源根」的路径（如 knowledgebanks/images/math-calculus-4.png）：
 * 桌面端 vite public 目录正好对应 URL 根；移动端这些图片只被 pages-knowledge 分包使用，
 * 故放在分包 static 目录（编译后为 /subPackages/pages-knowledge/static/...），主包因此瘦约 320KB。
 *
 * 另注：微信小程序 image 组件不支持 SVG，公式图必须是构建期预渲染好的 PNG
 * （见仓库根 scripts/render-formula-pngs.cjs）。
 */

/** pages-knowledge 分包内静态资源前缀（编译后位于分包目录下） */
export const STATIC_PREFIX = '/subPackages/pages-knowledge/static/'

/**
 * 知识条目公式图相对路径 → 小程序可用的图片地址。
 * 已是绝对 URL / dataURL 时原样返回，无图返回空串。
 */
export function formulaImageSrc(image?: string): string {
  if (!image) return ''
  if (/^https?:\/\//.test(image) || image.startsWith('data:')) return image
  const trimmed = image.replace(/^\/+/, '')
  if (trimmed.startsWith('static/')) return `/${trimmed}`
  return STATIC_PREFIX + trimmed
}
