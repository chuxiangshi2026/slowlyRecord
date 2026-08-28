import { contextBridge, ipcRenderer } from 'electron'

// 子窗口数据快照：父窗口创建子窗口后，通过 executeJavaScript 调用
// window.electronAPI.initFocusData({...}) 推送，供 utools shim 的 db.get/allDocs 同步读取。
window.__focusData = { docs: {} }

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  initFocusData: (data) => { window.__focusData = data || { docs: {} } },
})

// 注入 utools shim：兼容 focus.html / input-method-helper.html 中的 utools.* 调用。
// db 用"父推送快照读 + 写转发父持久化"，保持 utools.db 的同步语义，子窗口业务代码无需改动。
contextBridge.exposeInMainWorld('utools', {
  db: {
    get: (id) => {
      const docs = (window.__focusData && window.__focusData.docs) || {}
      const doc = docs[id]
      return doc ? JSON.parse(JSON.stringify(doc)) : null
    },
    allDocs: (prefix) => {
      const docs = (window.__focusData && window.__focusData.docs) || {}
      const result = []
      for (const k of Object.keys(docs)) {
        if (k.startsWith(prefix)) result.push(JSON.parse(JSON.stringify(docs[k])))
      }
      return result
    },
    put: (doc) => {
      if (!window.__focusData) window.__focusData = { docs: {} }
      if (!window.__focusData.docs) window.__focusData.docs = {}
      window.__focusData.docs[doc._id] = JSON.parse(JSON.stringify(doc))
      ipcRenderer.send('childDbPut', doc)
      return { ok: true, id: doc._id, rev: (doc._rev || '1') + '-shim' }
    },
  },
  sendToParent: (channel, payload) => {
    ipcRenderer.send('focusChildAction', { channel, payload })
  },
  isDark: () => {
    try { return window.matchMedia('(prefers-color-scheme: dark)').matches } catch (e) { return false }
  },
  showMainWindow: () => {
    ipcRenderer.send('showMainWindow')
  },
})
