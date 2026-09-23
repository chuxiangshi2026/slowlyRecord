#!/usr/bin/env node
/**
 * 坚果云 / WebDAV 独立诊断脚本（脱离 App 运行，用于定位「能读不能写」）
 *
 * 用法（凭据只留在本机环境变量里，不要写进任何文件或提交）：
 *   SLOWLY_WEBDAV_USER="你的坚果云注册邮箱" \
 *   SLOWLY_WEBDAV_PASS="应用密码" \
 *   node scripts/webdav-probe.cjs
 *
 * 可选：SLOWLY_WEBDAV_URL 覆盖地址（默认 https://dav.jianguoyun.com/dav/）
 *
 * 与 App 内诊断的区别：
 * 1) 直接用 Node 的 fetch，不经过系统代理（可判断问题是否出在代理/中间层）；
 * 2) 打印每一步的完整状态码、关键响应头与响应正文（正文常写明拒绝原因）；
 * 3) 完全独立于 App 代码，排除构建产物过旧的因素。
 *
 * 脚本只做三类写入：PUT 一个临时探针文件 → 立即 DELETE；不触碰正式备份文件。
 */

const FILE_NAME = 'slowlyRecord-sync.enc'
const PROBE_FILE = 'slowlyRecord-probe.txt'
const PROBE_BODY = 'slowlyRecord-webdav-probe'.repeat(2600) // 约 64KB

const url = process.env.SLOWLY_WEBDAV_URL || 'https://dav.jianguoyun.com/dav/'
const user = process.env.SLOWLY_WEBDAV_USER || ''
const pass = process.env.SLOWLY_WEBDAV_PASS || ''

if (!user || !pass) {
  console.error('缺少凭据：请设置 SLOWLY_WEBDAV_USER（注册邮箱）与 SLOWLY_WEBDAV_PASS（应用密码）两个环境变量后重跑')
  process.exit(1)
}

/** 规范化目录地址：补协议、折叠重复斜杠、补尾部斜杠 */
function normalizeDir(raw) {
  let s = String(raw || '').replace(/[\s\u3000]+/g, '').replace(/^[<"']+|[>"']+$/g, '')
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`
  s = s.replace(/([^:]\/)\/+/g, '$1')
  return s.endsWith('/') ? s : `${s}/`
}

const dir = normalizeDir(url)
const auth = `Basic ${Buffer.from(`${user}:${pass}`, 'utf8').toString('base64')}`

async function probe(step, target, init = {}) {
  const started = Date.now()
  try {
    const resp = await fetch(target, {
      ...init,
      headers: { Authorization: auth, ...(init.headers || {}) },
    })
    const body = await resp.text().catch(() => '')
    const allow = resp.headers.get('allow')
    const dav = resp.headers.get('dav')
    console.log(`\n—— ${step} ——`)
    console.log(`URL        : ${target}`)
    console.log(`HTTP       : ${resp.status} ${resp.statusText}（${Date.now() - started}ms）`)
    if (allow) console.log(`Allow      : ${allow}`)
    if (dav) console.log(`DAV        : ${dav}`)
    console.log(`Content-Len: ${resp.headers.get('content-length') ?? '-'}`)
    if (body) console.log(`响应正文   : ${body.replace(/\s+/g, ' ').slice(0, 400)}`)
    return resp.status
  } catch (e) {
    console.log(`\n—— ${step} ——`)
    console.log(`URL        : ${target}`)
    console.log(`请求失败   : ${e && e.message ? e.message : String(e)}（${Date.now() - started}ms）`)
    return null
  }
}

;(async () => {
  console.log('【慢记 · WebDAV 独立诊断】')
  console.log(`目录    : ${dir}`)
  console.log(`账号    : ${user.slice(0, 3)}***（已隐藏）`)
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy || ''
  console.log(`代理    : ${proxy || '未设置（直连）'}`)
  if (proxy) {
    console.log('          若结果异常，请绕过代理再跑一次做对照：')
    console.log('          HTTPS_PROXY= HTTP_PROXY= ALL_PROXY= node scripts/webdav-probe.cjs')
  }

  await probe('OPTIONS 目录', dir, { method: 'OPTIONS' })
  await probe('PROPFIND 目录（深度 0）', dir, { method: 'PROPFIND', headers: { Depth: '0' } })
  await probe('PROPFIND 目录（深度 1）', dir, { method: 'PROPFIND', headers: { Depth: '1' } })
  await probe('GET 备份文件', `${dir}${FILE_NAME}`, { method: 'GET' })

  const probeUrl = `${dir}${PROBE_FILE}`
  const tiny = await probe('PUT 探针（1 字节）', probeUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: 'ping',
  })
  const big = await probe('PUT 探针（64KB）', probeUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: PROBE_BODY,
  })
  if (tiny === 201 || tiny === 204 || big === 201 || big === 204) {
    await probe('DELETE 探针（清理）', probeUrl, { method: 'DELETE' })
  }

  console.log('\n【结论】')
  if ((tiny === 201 || tiny === 204) && (big === 201 || big === 204)) {
    console.log('读写都正常：账号没问题，请把上面输出发给开发者（问题应该在 App 侧或代理）')
  } else if (tiny === 201 || tiny === 204) {
    console.log('小文件能写、64KB 被拒：属于请求体积/中间层问题，不是账号权限')
  } else {
    console.log('连 1 字节都写不了：账号侧禁止写入。请检查坚果云「账户信息 → 安全选项 → 第三方应用管理」中该应用密码是否为「读写」，以及「流量明细」中本月上传流量是否用尽')
  }
})()
