/**
 * In-memory stand-in for the subset of IndexedDB that `src/data/idb.js` uses.
 *
 * It exists so repository, transfer and conflict logic can be exercised under
 * `node --test`, which has no IndexedDB. It reproduces the request/event shape,
 * key paths, compound index keys, the copy-on-write behaviour, and the two
 * properties the repository depends on: a transaction commits when the task
 * ends with no request outstanding, and an aborted transaction leaves the
 * database exactly as it was.
 *
 * It is a test double, not a conformance implementation. Passing against it
 * shows the repository logic is correct; it does not show browser behaviour,
 * quota handling or durability, which need a live browser run recorded as
 * separate evidence.
 *
 * `failWrites` makes every write fail, which is how the storage-failure
 * recovery path is exercised deterministically.
 */

class FakeRequest {
  constructor() {
    this.result = undefined;
    this.error = null;
    this.onsuccess = null;
    this.onerror = null;
    this.onupgradeneeded = null;
    this.onblocked = null;
    this.transaction = null;
  }

  _succeed(result) {
    this.result = result;
    queueMicrotask(() => this.onsuccess?.({ target: this }));
  }

  _fail(error) {
    this.error = error;
    queueMicrotask(() => this.onerror?.({ target: this }));
  }
}

function valueAt(record, keyPath) {
  if (Array.isArray(keyPath)) return keyPath.map((path) => valueAt(record, path));
  return keyPath.split(".").reduce((value, key) => value?.[key], record);
}

function keyOf(value) {
  return Array.isArray(value) ? JSON.stringify(value) : String(value);
}

function nameList(names) {
  return { contains: (name) => names.includes(name), length: names.length };
}

class FakeIndex {
  constructor(store, name, keyPath) {
    this.store = store;
    this.name = name;
    this.keyPath = keyPath;
  }

  getAll(query) {
    const request = new FakeRequest();
    const wanted = keyOf(query);
    this.store._transaction._enqueue(request, () =>
      this.store
        ._visibleRecords()
        .filter((record) => keyOf(valueAt(record, this.keyPath)) === wanted)
        .map((record) => structuredClone(record)),
    );
    return request;
  }
}

class FakeObjectStore {
  constructor(name, keyPath) {
    this.name = name;
    this.keyPath = keyPath;
    this._data = new Map();
    this._indexes = new Map();
    this._transaction = null;
  }

  get indexNames() {
    return nameList([...this._indexes.keys()]);
  }

  createIndex(name, keyPath) {
    this._indexes.set(name, keyPath);
    return new FakeIndex(this, name, keyPath);
  }

  index(name) {
    if (!this._indexes.has(name)) throw new Error(`unknown index ${this.name}.${name}`);
    return new FakeIndex(this, name, this._indexes.get(name));
  }

  /** Committed records with this transaction's own uncommitted writes applied. */
  _visibleRecords() {
    const merged = new Map(this._data);
    for (const write of this._transaction?._pending.values() ?? []) {
      if (write.storeName !== this.name) continue;
      if (write.value === undefined) merged.delete(write.key);
      else merged.set(write.key, write.value);
    }
    return [...merged.values()];
  }

  _visible(key) {
    const pending = this._transaction?._pending.get(`${this.name}\u0000${key}`);
    if (pending) return pending.value;
    return this._data.get(key);
  }

  get(key) {
    const request = new FakeRequest();
    this._transaction._enqueue(request, () => {
      const found = this._visible(keyOf(key));
      return found ? structuredClone(found) : undefined;
    });
    return request;
  }

  getAll() {
    const request = new FakeRequest();
    this._transaction._enqueue(request, () => this._visibleRecords().map((record) => structuredClone(record)));
    return request;
  }

  put(value) {
    const request = new FakeRequest();
    this._transaction._enqueue(request, () => {
      if (this._transaction.db._failWrites) throw new Error("simulated write failure");
      if (this._transaction.mode === "readonly") {
        throw new Error("a write was attempted in a readonly transaction");
      }
      const key = valueAt(value, this.keyPath);
      if (key === undefined || key === null) throw new Error(`record has no ${this.keyPath}`);
      this._transaction._stage(this.name, keyOf(key), structuredClone(value));
      return key;
    });
    return request;
  }

  delete(key) {
    const request = new FakeRequest();
    this._transaction._enqueue(request, () => {
      if (this._transaction.mode === "readonly") {
        throw new Error("a delete was attempted in a readonly transaction");
      }
      this._transaction._stage(this.name, keyOf(key), undefined);
      return undefined;
    });
    return request;
  }
}

/**
 * A transaction that buffers writes and applies them on commit.
 *
 * Buffering is what makes an abort leave the database untouched, which is the
 * property the all-or-nothing import depends on. Commit is scheduled on a task
 * boundary rather than a microtask, matching the real rule that a transaction
 * stays usable across awaited requests but closes once the task ends.
 */
class FakeTransaction {
  constructor(db, storeNames, mode) {
    this.db = db;
    this.mode = mode;
    this.error = null;
    this.oncomplete = null;
    this.onerror = null;
    this.onabort = null;
    this._stores = new Map();
    this._pending = new Map();
    this._active = 0;
    this._finished = false;
    this._settleTimer = null;

    for (const name of storeNames) {
      const store = db._stores.get(name);
      if (!store) throw new Error(`unknown store ${name}`);
      // One view per transaction, so buffered writes stay isolated.
      const view = Object.create(store);
      view._transaction = this;
      this._stores.set(name, view);
    }
  }

  objectStore(name) {
    const store = this._stores.get(name);
    if (!store) throw new Error(`store ${name} is not in this transaction`);
    return store;
  }

  _stage(storeName, key, value) {
    this._pending.set(`${storeName}\u0000${key}`, { storeName, key, value });
  }

  _enqueue(request, work) {
    if (this._finished) throw new Error("the transaction has already finished");
    this._active += 1;
    queueMicrotask(() => {
      if (this._finished) return;
      try {
        request._succeed(work());
      } catch (error) {
        this.error = error;
        request._fail(error);
        queueMicrotask(() => this.abort());
      } finally {
        this._active -= 1;
        this._scheduleSettle();
      }
    });
  }

  _scheduleSettle() {
    if (this._settleTimer || this._finished) return;
    this._settleTimer = setTimeout(() => {
      this._settleTimer = null;
      if (this._finished || this._active > 0) return;
      this._commit();
    }, 0);
  }

  _commit() {
    this._finished = true;
    clearTimeout(this._settleTimer);
    for (const { storeName, key, value } of this._pending.values()) {
      const target = this.db._stores.get(storeName);
      if (value === undefined) target._data.delete(key);
      else target._data.set(key, value);
    }
    this._pending.clear();
    queueMicrotask(() => this.oncomplete?.({ target: this }));
  }

  abort() {
    if (this._finished) return;
    this._finished = true;
    clearTimeout(this._settleTimer);
    this._settleTimer = null;
    this._pending.clear();
    queueMicrotask(() => {
      this.onerror?.({ target: this });
      this.onabort?.({ target: this });
    });
  }
}

class FakeDatabase {
  constructor(name, version) {
    this.name = name;
    this.version = version;
    this._stores = new Map();
    this._closed = false;
    this._failWrites = false;
  }

  get objectStoreNames() {
    return nameList([...this._stores.keys()]);
  }

  createObjectStore(name, { keyPath }) {
    const store = new FakeObjectStore(name, keyPath);
    this._stores.set(name, store);
    return store;
  }

  transaction(storeNames, mode = "readonly") {
    if (this._closed) throw new Error("the database is closed");
    const tx = new FakeTransaction(this, [].concat(storeNames), mode);
    // Settle even when no request is ever made against it.
    tx._scheduleSettle();
    return tx;
  }

  close() {
    this._closed = true;
  }
}

/**
 * Creates a factory plus the handle used to steer it from a test.
 *
 * @returns {{factory: object, databases: Map<string, FakeDatabase>, failWrites: (on: boolean) => void}}
 */
export function createFakeIndexedDB() {
  const databases = new Map();

  const factory = {
    open(name, version) {
      const request = new FakeRequest();
      queueMicrotask(() => {
        let db = databases.get(name);
        const previousVersion = db?.version ?? 0;
        if (!db) {
          db = new FakeDatabase(name, version);
          databases.set(name, db);
        }
        db._closed = false;
        if (version > previousVersion) {
          db.version = version;
          const upgrade = new FakeTransaction(db, [...db._stores.keys()], "versionchange");
          request.transaction = upgrade;
          request.result = db;
          try {
            request.onupgradeneeded?.({ target: request, oldVersion: previousVersion });
          } catch (error) {
            request._fail(error);
            return;
          }
          upgrade._commit();
        }
        request._succeed(db);
      });
      return request;
    },
  };

  return {
    factory,
    databases,
    failWrites(on) {
      for (const db of databases.values()) db._failWrites = on;
    },
  };
}
