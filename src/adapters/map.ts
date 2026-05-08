/**
 * 地图适配器接口
 *
 * 桌面端/App 端使用 Leaflet 实现
 * 小程序端使用腾讯地图 <map> 组件实现
 */

import { getPlatform } from './platform'

export interface MapOptions {
  center?: [number, number]  // [lat, lng]
  zoom?: number
  minZoom?: number
  maxZoom?: number
}

export interface MarkerOptions {
  title?: string
  icon?: string
}

export interface PolygonStyle {
  color?: string
  weight?: number
  opacity?: number
  fillColor?: string
  fillOpacity?: number
}

export interface MapAdapter {
  /**
   * 初始化地图
   * @param container DOM 容器元素或选择器
   * @param options 地图选项
   */
  init(container: HTMLElement | string, options?: MapOptions): void

  /**
   * 添加标记点
   * @param lat 纬度
   * @param lng 经度
   * @param popup 弹出内容
   * @param options 标记选项
   * @returns 标记 ID
   */
  addMarker(lat: number, lng: number, popup: string, options?: MarkerOptions): string

  /**
   * 添加多边形
   * @param coords 坐标数组 [lat, lng]
   * @param style 样式
   * @returns 图层 ID
   */
  addPolygon(coords: [number, number][], style?: PolygonStyle): string

  /**
   * 飞到指定位置
   * @param lat 纬度
   * @param lng 经度
   * @param zoom 缩放级别
   */
  flyTo(lat: number, lng: number, zoom?: number): void

  /**
   * 移除图层
   * @param id 图层 ID
   */
  removeLayer(id: string): void

  /**
   * 销毁地图
   */
  destroy(): void
}

let _mapAdapter: MapAdapter | null = null

export function getMapAdapter(): MapAdapter {
  if (_mapAdapter) return _mapAdapter

  const platform = getPlatform()
  switch (platform) {
    case 'utools':
    case 'electron':
    case 'web': {
      const { MapAdapterLeaflet } = require('./impl/map-leaflet')
      _mapAdapter = new MapAdapterLeaflet()
      break
    }
    default: {
      const { MapAdapterLeaflet } = require('./impl/map-leaflet')
      _mapAdapter = new MapAdapterLeaflet()
      break
    }
  }
  return _mapAdapter
}

export function setMapAdapter(adapter: MapAdapter): void {
  _mapAdapter = adapter
}
