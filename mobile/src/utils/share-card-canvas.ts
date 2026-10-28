/**
 * 小程序 canvas 2d 分享卡导出辅助：节点查询、dpr 缩放、临时图片导出。
 * 页面仍需自行放置对应 id 的 <canvas> 节点。
 */

export function getShareDpr(): number {
  try {
    const info: any = (uni as any).getWindowInfo ? (uni as any).getWindowInfo() : uni.getSystemInfoSync()
    return info?.pixelRatio || 2
  } catch {
    return 2
  }
}

function getCanvasNode(instance: any, selector: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const query = uni.createSelectorQuery().in(instance?.proxy as any) as any
    query
      .select(selector)
      .fields({ node: true, size: true })
      .exec((res: any[]) => {
        const node = res?.[0]?.node
        if (node) resolve(node)
        else reject(new Error(`canvas 节点获取失败: ${selector}`))
      })
  })
}

function canvasToTemp(canvasNode: any, canvasId: string, destWidth: number, destHeight: number): Promise<string> {
  return new Promise((resolve, reject) => {
    uni.canvasToTempFilePath({
      canvas: canvasNode,
      canvasId,
      destWidth,
      destHeight,
      fileType: 'png',
      success: (res: any) => resolve(res.tempFilePath),
      fail: reject,
    } as any)
  })
}

/**
 * 按 dpr 绘制并导出临时图片。
 * @param instance 页面实例（getCurrentInstance()）
 * @param canvasId canvas 节点 id（不带 #）
 * @param width 逻辑宽
 * @param height 逻辑高
 * @param draw 在已完成 dpr scale 的 context 上绘制
 */
export async function renderCanvasCard(
  instance: any,
  canvasId: string,
  width: number,
  height: number,
  draw: (ctx: any) => void | Promise<void>
): Promise<string> {
  const node = await getCanvasNode(instance, `#${canvasId}`)
  const dpr = getShareDpr()
  node.width = width * dpr
  node.height = height * dpr
  const ctx = node.getContext('2d')
  ctx.scale(dpr, dpr)
  await draw(ctx)
  return canvasToTemp(node, canvasId, width * dpr, height * dpr)
}
