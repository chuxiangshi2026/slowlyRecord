/**
 * uTools 数据库适配器
 * 直接代理 utools.db 和 utools.db.promises
 */
import type { DbAdapter, DbDoc, DbReturn } from '../db'

export class DbAdapterUtools implements DbAdapter {
  get<T extends {} = Record<string, any>>(id: string): DbDoc<T> | null {
    return utools.db.get(id) as DbDoc<T> | null
  }

  put(doc: DbDoc): DbReturn {
    return utools.db.put(doc) as DbReturn
  }

  allDocs<T extends {} = Record<string, any>>(prefix?: string): DbDoc<T>[] {
    if (prefix) {
      return utools.db.allDocs(prefix) as DbDoc<T>[]
    }
    return utools.db.allDocs() as DbDoc<T>[]
  }

  remove(doc: string | DbDoc): DbReturn {
    return utools.db.remove(doc as any) as DbReturn
  }

  bulkDocs(docs: DbDoc[]): DbReturn[] {
    return utools.db.bulkDocs(docs) as DbReturn[]
  }

  promises = {
    get: async <T extends {} = Record<string, any>>(id: string): Promise<DbDoc<T> | null> => {
      return utools.db.get(id) as DbDoc<T> | null
    },

    put: async (doc: DbDoc): Promise<DbReturn> => {
      return utools.db.promises.put(doc) as Promise<DbReturn>
    },

    remove: async (doc: string | DbDoc): Promise<DbReturn> => {
      return utools.db.promises.remove(doc as any) as Promise<DbReturn>
    },

    bulkDocs: async (docs: DbDoc[]): Promise<DbReturn[]> => {
      return utools.db.promises.bulkDocs(docs) as Promise<DbReturn[]>
    },
  }
}
