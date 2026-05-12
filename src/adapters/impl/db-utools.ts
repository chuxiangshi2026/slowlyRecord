/**
 * uTools 数据库适配器
 * 直接代理 utools.db 和 utools.db.promises
 */
import type { DbAdapter, DbDoc, DbReturn } from '../db'

const _u = () => (window as any).utools

export class DbAdapterUtools implements DbAdapter {
  get<T extends {} = Record<string, any>>(id: string): DbDoc<T> | null {
    return _u().db.get(id) as DbDoc<T> | null
  }

  put(doc: DbDoc): DbReturn {
    return _u().db.put(doc) as DbReturn
  }

  allDocs<T extends {} = Record<string, any>>(prefix?: string): DbDoc<T>[] {
    if (prefix) {
      return _u().db.allDocs(prefix) as DbDoc<T>[]
    }
    return _u().db.allDocs() as DbDoc<T>[]
  }

  remove(doc: string | DbDoc): DbReturn {
    return _u().db.remove(doc as any) as DbReturn
  }

  bulkDocs(docs: DbDoc[]): DbReturn[] {
    return _u().db.bulkDocs(docs) as DbReturn[]
  }

  promises = {
    get: async <T extends {} = Record<string, any>>(id: string): Promise<DbDoc<T> | null> => {
      return _u().db.promises.get(id) as Promise<DbDoc<T> | null>
    },

    put: async (doc: DbDoc): Promise<DbReturn> => {
      return _u().db.promises.put(doc) as Promise<DbReturn>
    },

    remove: async (doc: string | DbDoc): Promise<DbReturn> => {
      return _u().db.promises.remove(doc as any) as Promise<DbReturn>
    },

    bulkDocs: async (docs: DbDoc[]): Promise<DbReturn[]> => {
      return _u().db.promises.bulkDocs(docs) as DbReturn[]
    },
  }
}
