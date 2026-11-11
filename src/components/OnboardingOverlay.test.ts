// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import OnboardingOverlay from './OnboardingOverlay.vue'

const mocks = vi.hoisted(() => ({ trackEvent: vi.fn() }))
vi.mock('@/utils/stats', () => ({
  trackEvent: mocks.trackEvent,
  getAttribution: () => null,
}))
vi.mock('@/utils/wordbank-manager', () => ({ importFromBuiltinWordBank: vi.fn() }))
vi.mock('@/adapters/platform', () => ({ isUtools: () => false, isWeb: () => true }))

describe('OnboardingOverlay', () => {
  it('首次展示时记录 onboarding.view', async () => {
    const wrapper = mount(OnboardingOverlay, {
      props: { modelValue: true },
      global: {
        plugins: [createTestingPinia()],
        stubs: {
          PrivacyDialog: true,
          'el-button': { template: '<button><slot /></button>' },
        },
      },
    })

    await wrapper.vm.$nextTick()
    expect(mocks.trackEvent).toHaveBeenCalledWith('onboarding', 'view')
    wrapper.unmount()
  })
})
