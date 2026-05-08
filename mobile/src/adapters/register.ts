import { setDbAdapter } from '../../../src/adapters/db'
import { MiniProgramDbAdapter } from './db-miniprogram'

/**
 * 注册移动端适配器
 */
export function registerMobileAdapters() {
  // 注册小程序 Storage 适配器
  setDbAdapter(new MiniProgramDbAdapter())
}
