#!/usr/bin/env node
/**
 * 微信小程序 CI 工具（miniprogram-ci）
 *
 * 用法：
 *   node scripts/mp-ci.cjs preview [--build] [--page pages/xxx/xxx] [--query k=v] [--desc 说明]
 *       生成预览二维码，微信扫码后在真机上查看（预览码仅开发者微信号可扫，约 30 分钟内有效）
 *   node scripts/mp-ci.cjs upload <x.y.z> [--desc 说明] [--build]
 *       上传为体验版（需在 mp 后台将代码设为体验版）
 *
 * 前置：下载「小程序代码上传密钥」private.wxb66e4ebdae8d2e8e.key，
 *       放到 mobile/ 目录（已被 .gitignore 忽略），或设置环境变量 MP_PRIVATE_KEY_PATH。
 *
 * 产物目录默认 dist/dev/mp-weixin/（对应 project.config.json 的 miniprogramRoot）；
 * 加 --build 则临时切换到 dist/build/mp-weixin/（生产构建），结束后自动还原配置。
 */
const fs = require('fs');
const path = require('path');
const ci = require('miniprogram-ci');

const APPID = 'wxb66e4ebdae8d2e8e';
const MOBILE_DIR = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join(MOBILE_DIR, 'project.config.json');

function fail(msg) {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) args[a.slice(2)] = argv[++i] ?? true;
    else args._.push(a);
  }
  return args;
}

function findPrivateKey() {
  const candidates = [
    process.env.MP_PRIVATE_KEY_PATH,
    path.join(MOBILE_DIR, `private.${APPID}.key`),
    path.join(process.env.HOME || '~', '.mp-keys', `private.${APPID}.key`),
  ].filter(Boolean);
  return candidates.find(p => fs.existsSync(p));
}

function winPath(p) {
  return p.startsWith('/mnt/')
    ? p.replace(/^\/mnt\/([a-z])\//, (_, d) => `${d.toUpperCase()}:\\`).replace(/\//g, '\\')
    : p;
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);
  if (!['preview', 'upload'].includes(cmd)) {
    fail(`未知命令 "${cmd ?? ''}"\n${fs.readFileSync(__filename, 'utf8').split('\n').filter(l => l.startsWith(' *')).join('\n').replace(/^ \* ?/gm, '')}`);
  }

  // 按需切换 miniprogramRoot（--build = 生产产物）
  const targetRoot = args.build ? 'dist/build/mp-weixin/' : 'dist/dev/mp-weixin/';
  if (args.build) {
    const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    const original = JSON.stringify(cfg, null, 2);
    cfg.miniprogramRoot = targetRoot;
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
    process.on('exit', () => fs.writeFileSync(CONFIG_PATH, original));
  }
  if (!fs.existsSync(path.join(MOBILE_DIR, targetRoot, 'app.json'))) {
    fail(`未找到构建产物 ${targetRoot}\n请先构建：\n  开发版：cd mobile && npm run dev:mp-weixin（跑一次即可，产物留在 dist/dev）\n  生产版：cd mobile && npm run build:mp-weixin`);
  }

  const privateKeyPath = findPrivateKey();
  if (!privateKeyPath) {
    fail(`缺少小程序代码上传密钥。下载地址：https://mp.weixin.qq.com/ → 开发管理 → 开发设置 → 小程序代码上传密钥\n下载后放到：${path.join(MOBILE_DIR, `private.${APPID}.key`)}\n（注意保密，不要提交到仓库）`);
  }

  const project = new ci.Project({
    appid: APPID,
    type: 'miniProgram',
    projectPath: MOBILE_DIR,
    privateKeyPath,
    ignores: ['node_modules/**/*', 'scripts/**/*', '.ci-qr/**/*', `private.${APPID}.key`],
  });

  if (cmd === 'preview') {
    const dest = path.join(MOBILE_DIR, '.ci-qr', `preview-${Date.now()}.png`);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    await ci.preview({
      project,
      desc: args.desc || `CI 预览 ${new Date().toISOString()}`,
      // miniprogram-ci 2.x 参数名（1.x 的 qrOutput* 已废弃且静默忽略）
      qrcodeOutputDest: dest,
      qrcodeFormat: 'image',
      useCOS: true,
      ...(args.page ? { pagePath: args.page } : {}),
      ...(args.query ? { searchQuery: args.query } : {}),
    });
    console.log(`\n✓ 预览二维码已生成（约 30 分钟内有效，仅开发者微信号可扫）：\n  WSL:  ${dest}\n  Win:  ${winPath(dest)}`);
    if (args.page) console.log(`  直达页面：${args.page}${args.query ? `?${args.query}` : ''}`);
  } else {
    const version = args._[0];
    if (!/^\d+\.\d+\.\d+$/.test(version || '')) fail('upload 需要版本号参数，例如：node scripts/mp-ci.cjs upload 1.2.0');
    const result = await ci.upload({
      project,
      version,
      desc: args.desc || `CI 上传 ${new Date().toISOString()}`,
      threads: 5,
    });
    console.log(`\n✓ 已上传 v${version}，可到 mp 后台设置为体验版。`, result);
  }
}

main().catch(err => fail(err.message || err));
