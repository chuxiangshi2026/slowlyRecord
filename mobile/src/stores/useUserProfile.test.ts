/**
 * useUserProfile 本地用户名 store 测试
 * 重点：trim、空串清除；持久化由 persistedstate 插件负责（测试中未注册插件，仅验证内存行为）
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useUserProfile } from './useUserProfile'

describe('useUserProfile', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('初始用户名为空', () => {
    const store = useUserProfile()
    expect(store.username).toBe('')
  })

  it('setUsername 保存并去除首尾空白', () => {
    const store = useUserProfile()
    store.setUsername('  小明  ')
    expect(store.username).toBe('小明')
  })

  it('setUsername 传空串视为清除', () => {
    const store = useUserProfile()
    store.setUsername('小明')
    store.setUsername('   ')
    expect(store.username).toBe('')
  })
})
