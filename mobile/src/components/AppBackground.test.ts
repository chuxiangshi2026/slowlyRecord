/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'

const theme = { isDark: false }
vi.mock('../stores/useTheme', () => ({ useTheme: () => theme }))

import AppBackground from './AppBackground.vue'

describe('AppBackground', () => {
  beforeEach(() => {
    theme.isDark = false
    ;(globalThis as any).getCurrentPages = () => [{ route: 'pages/index/index' }]
  })

  it('显式指定意境与暗色主题时选择对应底图', () => {
    theme.isDark = true
    const wrapper = mount(AppBackground, { props: { variant: 'bamboo' } })
    expect(wrapper.find('image').attributes('src')).toBe('/static/theme-bg/bamboo-dark.png')
  })

  it('未指定意境时按路由稳定分配亮色底图', () => {
    const wrapper = mount(AppBackground)
    const src = wrapper.find('image').attributes('src')
    expect(src).toMatch(/^\/static\/theme-bg\/(landscape|bamboo|clouds)-light\.png$/)
    expect(wrapper.find('image').classes()).toContain('app-background')
  })
})
