/**
 * ID 生成工具：返回单调递增的毫秒时间戳。
 *
 * 用于本地 DB _id 后缀，避免同毫秒内多次创建时 _id 冲突。
 * 全局共用一份计数器，跨模块也能保持单调，安全性高于各自维护。
 */

let _lastIdTimestamp = 0;

export function nextIdTimestamp(): number {
  const now = Date.now();
  _lastIdTimestamp = now > _lastIdTimestamp ? now : _lastIdTimestamp + 1;
  return _lastIdTimestamp;
}
