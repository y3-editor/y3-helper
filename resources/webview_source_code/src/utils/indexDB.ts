class LocalIndexDB {
  private dbName = 'codeMarker'
  private version = 8//数据库版本
  private tableList: string[] = []//表单列表
  private db: IDBDatabase | null = null

  public constructor() {
    this.tableList = Object.keys(IndexDatabaseName)
  }

  private createTable(idb: IDBDatabase, tableName: string) {
    if (!idb.objectStoreNames.contains(tableName)) {
      const objStore = idb.createObjectStore(tableName, { keyPath: 'id', autoIncrement: true })
      objStore.createIndex('id', 'id', { unique: true })
    }
  }

  public connect() {
    return new Promise<LocalIndexDB>((resolve, reject) => {
      const request = window.indexedDB.open(this.dbName, this.version)
      request.onerror = e => {
        reject(e)
      }
      request.onsuccess = (event: any) => {
        this.db = event.target.result
        resolve(this)
      }
      request.onupgradeneeded = e => {
        this.tableList.map((table) => this.createTable((e.target as any).result, table))
      }
    })
  }

  public close() {
    return new Promise((resolve, reject) => {
      try {
        if (!this.db) {
          return resolve('请开启数据库')
        }
        this.db!.close()
        this.db = null
        resolve(null)
      } catch (error) {
        reject(error)
      }
    })
  }

  private getStore(tableName: string): IDBObjectStore {
    if (!this.db) throw new Error('数据库未连接')
    const transaction = this.db.transaction([tableName], 'readwrite')
    return transaction.objectStore(tableName)
  }

  public add(tableName: IndexDatabaseName, data: IIndexDBData) {
    return new Promise((resolve, reject) => {
      if (!tableName || !this.db) return reject()
      const store = this.getStore(tableName)
      const request = store.add(data)
      request.onsuccess = function () {
        resolve(this)
      }
      request.onerror = function (event: Event) {
        reject(event)
      }
    })
  }

  public remove(tableName: IndexDatabaseName, id: number) {
    return new Promise((resolve, reject) => {
      if (!tableName || !this.db) return reject()
      const store = this.getStore(tableName)
      const request = store.delete(id)
      request.onsuccess = function () {
        resolve(this)
      }
      request.onerror = function (event: Event) {
        reject(event)
      }
    })
  }

  public async save(tableName: IndexDatabaseName, rawData: IIndexDBData, key: number) {
    return new Promise((resolve, reject) => {
      if (!tableName || !this.db) return reject()
      const store = this.getStore(tableName)
      const request = store.get(key)
      request.onsuccess = function (event: any) {
        const data = event.target.result;
        Object.assign(data, rawData||{})
        console.log('data请求成果', data)
        store.put(data);
        resolve(null)
      }
      request.onerror = function (event: Event) {
        reject(event)
      }
      // const request = store.put(rawData, key)
      // request.onsuccess = function () {
      //   resolve(this)
      // }
      // request.onerror = function (event: Event) {
      //   reject(event)
      // }
    })
  }

  public selectKey(tableName: IndexDatabaseName, id: string): Promise<number> {
    return new Promise((resolve, reject) => {
      if (!tableName || !this.db) return reject()
      const store = this.getStore(tableName)
      const index = store.index('id')
      const request = index.getKey(id)
      request.onsuccess = function () {
        resolve(request.result as number)
      }
      request.onerror = function (event: Event) {
        reject(event)
      }
    })
  }

  public select(tableName: IndexDatabaseName, key: string): Promise<IIndexDBData> {
    return new Promise((resolve, reject) => {
      if (!tableName || !this.db) return reject()
      const store = this.getStore(tableName)
      const index = store.index('id')
      const request = index.get(key)
      request.onsuccess = function () {
        resolve(request.result)
      }
      request.onerror = function (event: Event) {
        reject(event)
      }
    })
  }
}

export class IndexDBCache implements IndexDBCache {
  private static _ins: IndexDBCache
  private localIndexDB: LocalIndexDB
  
  public constructor() {
    this.localIndexDB = new LocalIndexDB()
  }

  public static get instance(): IndexDBCache {
    if (!this._ins) {
      this._ins = new IndexDBCache()
    }
    return this._ins
  }

  public async get(cacheName: IndexDatabaseName, condition?: any) {
    let result = null
    try {
      await this.localIndexDB.connect()
      result = await this.localIndexDB.select(cacheName, condition)
      result = result.data
      this.localIndexDB.close()
      return result
    } catch(e) {
      return ''
    }
  }

  public async set(cacheName: IndexDatabaseName, rawData: IIndexDBData) {
    try {
      if (!(typeof rawData === 'object' && rawData?.id && rawData?.data)) {
        throw new Error('正确的数据格式是{id: string, data: any}')
      }
      await this.localIndexDB.connect()
      const key = await this.localIndexDB.selectKey(cacheName, rawData?.id)
      if (key >= 0 && key !== undefined) {
        await this.localIndexDB.save(cacheName, rawData, key)
      } else {
        await this.localIndexDB.add(cacheName, rawData)
      }
      this.localIndexDB.close()
    } catch(e) {
      console.error(e)
    }
  }

  public async clear(cacheName: IndexDatabaseName, id: string) {
    try {
      await this.localIndexDB.connect()
      const key = await this.localIndexDB.selectKey(cacheName, id)
      if (key >= 0 && key !== undefined) {
        await this.localIndexDB.remove(cacheName, key)
      }
      this.localIndexDB.close()
    } catch(e) {
      console.error(e)
    }
  }
}


// 记录indexDB表名
export enum IndexDatabaseName {
    AppliedCodeBlock = 'AppliedCodeBlock',
}


export interface IIndexDBData {
    id: string
    data: any
}

