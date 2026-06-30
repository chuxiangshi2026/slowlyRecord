/**
 * 地图组件共享类型
 *
 * 单独抽出来是因为 Vue 3 `<script setup>` 内的 export 受限，
 * 父组件和子组件需要的共享类型应该写在普通 ts 文件中。
 */

import type { MobilePoetryItem, MobileIdiomItem } from '../library'

/** 点击地图标记时携带的载荷 */
export interface MarkerTapPayload {
  /** 该坐标下的诗词列表（可能为空） */
  poems: MobilePoetryItem[]
  /** 该坐标下的成语列表（可能为空） */
  idioms: MobileIdiomItem[]
  /** 标准化后的地点显示名（如"扬州"） */
  locationName: string
}
