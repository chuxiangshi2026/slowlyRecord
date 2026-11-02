/**
 * 内置/远程词库导入的目标词库询问：与桌面端导入对话框行为对齐
 * ① 导入当前词库 ② 新建词库并导入 ③ 选择其他已有词库
 */

import { useMobileWords } from '@/stores/useMobileWords'
import type { LanguageCode } from '@/utils/language'

/** 弹出目标词库选择；用户取消（点遮罩 / 取消）返回 null */
export function askImportTargetBank(suggestedName: string, language: LanguageCode = 'en'): Promise<string | null> {
  const store = useMobileWords()
  const current = store.getBankById(store.currentBankId)
  const currentName = current?.name || '默认词库'
  const currentCompatible = (current?.language || 'en') === language
  const others = store.bankList.filter(b => b.id !== store.currentBankId && (b.language || 'en') === language)

  const items: string[] = []
  const actions: Array<() => string | null | Promise<string | null>> = []
  if (currentCompatible) {
    items.push(`导入当前词库「${currentName}」`)
    actions.push(() => store.currentBankId)
  }
  items.push('新建词库并导入')
  actions.push(() => askNewBankName(store, suggestedName, language))
  if (others.length > 0) {
    items.push('选择其他已有词库')
    actions.push(() => askOtherBank(store, others))
  }

  return new Promise((resolve) => {
    uni.showActionSheet({
      itemList: items,
      success: (res) => resolve(actions[res.tapIndex]?.() || null),
      fail: () => resolve(null),
    })
  })
}

/** 新建词库：输入名称（默认建议为被导入词库名），重名校验，创建后作为导入目标（不切换当前词库） */
function askNewBankName(store: ReturnType<typeof useMobileWords>, suggestedName: string, language: LanguageCode): Promise<string | null> {
  return new Promise((resolve) => {
    uni.showModal({
      title: '新建词库',
      content: suggestedName,
      editable: true,
      placeholderText: '请输入新词库名称',
      success: (res) => {
        if (!res.confirm) {
          resolve(null)
          return
        }
        const name = (res.content || '').trim()
        if (!name) {
          uni.showToast({ title: '已取消：未输入词库名称', icon: 'none' })
          resolve(null)
          return
        }
        if (store.bankList.some(b => b.name === name)) {
          uni.showToast({ title: '词库名称已存在', icon: 'none' })
          resolve(null)
          return
        }
        resolve(store.createBank(name, { language }).id)
      },
      fail: () => resolve(null),
    })
  })
}

/** 从其他已有词库中选择导入目标 */
function askOtherBank(
  store: ReturnType<typeof useMobileWords>,
  others: { id: string; name: string }[],
): Promise<string | null> {
  return new Promise((resolve) => {
    uni.showActionSheet({
      itemList: others.map(b => `导入到「${b.name}」`),
      success: (res) => {
        const bank = others[res.tapIndex]
        resolve(bank ? bank.id : null)
      },
      fail: () => resolve(null),
    })
  })
}
