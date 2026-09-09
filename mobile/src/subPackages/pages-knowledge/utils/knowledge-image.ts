/**
 * 知识条目公式图片路径工具（移动端）。
 *
 * 知识包 JSON 的 image 字段是「相对静态资源根」的路径（如 knowledgebanks/images/math-calculus-4.png）：
 * 桌面端 vite public 目录正好对应 URL 根，移动端 uni-app 的静态资源则编译到小程序包的 /static/ 下。
 * 因此两端共用同一份源数据，只有移动端需要在展示前补 /static 前缀。
 *
 * 另注：微信小程序 image 组件不支持 SVG，公式图必须是构建期预渲染好的 PNG
 * （见仓库根 scripts/render-formula-pngs.cjs）。
 */

/** uni-app 静态资源目录（编译后位于小程序包根目录） */
export const STATIC_PREFIX = '/static/'

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
