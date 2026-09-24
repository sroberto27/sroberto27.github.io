/**
 * Promise wrapper over IndexedDB.
 *
 * The only module that touches the IndexedDB API. Everything above it works
 * with plain records and promises, which is what allows a later authenticated
 * backend to replace one file.
 *
 * The factory is injected rather than read from the global scope, so the
 * repository can be exercised against an in-memory double under `node --test`.
 * A double proves the repository logic; it does not prove browser behaviour,
 * and the verification record keeps those two kinds of evidence apart.
 *
 * Failures are surfaced, never swallowed. A write that cannot complete has to
 * reach the save-status surface so the user can retry or export.
 */

export const IDB_ERROR_CODES = Object.freeze({
  unavailable: "idb-unavailable",
  blocked: "idb-blocked",
  openFailed: "idb-open-failed",
  transactionFailed: "idb-transaction-failed",
  writeFailed: "idb-write-failed",
});

/** Error carrying a stable code, so the interface can explain what failed. */
export class StorageError extends Error {
  constructor(code, message, options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = "StorageError";
    this.code = code;
    this.detail = options.detail ?? null;
  }
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        new StorageError(
          IDB_ERROR_CODES.writeFailed,
          request.error?.message ?? "the request failed",
          { cause: request.error ?? undefined },
        ),
      );
  });
}

/**
 * Opens the workspace database.
 *
 * @param {object} options
 * @param {IDBFactory} options.factory
 * @param {string} options.name
 * @param {number} options.version
 * @param {(db: IDBDatabase, transaction: IDBTransaction, fromVersion: number) => void} options.upgrade
 */
export function openDatabase({ factory, name, version, upgrade }) {
  if (!factory || typeof factory.open !== "function") {
    return Promise.reject(
      new StorageError(IDB_ERROR_CODES.unavailable, "IndexedDB is not available in this context"),
    );
  }

  return new Promise((resolve, reject) => {
    let request;
    try {
      request = factory.open(name, version);
    } catch (cause) {
      reject(
        new StorageError(IDB_ERROR_CODES.openFailed, `could not open "${name}"`, { cause }),
      );
      return;
    }

    request.onupgradeneeded = (event) => {
      try {
        upgrade(request.result, request.transaction, event.oldVersion ?? 0);
      } catch (cause) {
        // Abort rather than leave a half-created schema behind.
        request.transaction?.abort();
        reject(new StorageError(IDB_ERROR_CODES.openFailed, "the schema upgrade failed", { cause }));
      }
    };
    // Another tab holds an older version open. Reported rather than retried,
    // because closing someone else's session is not this module's decision.
    request.onblocked = () =>
      reject(
        new StorageError(
          IDB_ERROR_CODES.blocked,
          `another session is holding "${name}" open at an earlier version`,
        ),
      );
    request.onerror = () =>
      reject(
        new StorageError(IDB_ERROR_CODES.openFailed, request.error?.message ?? "open failed", {
          cause: request.error ?? undefined,
        }),
      );
    request.onsuccess = () => resolve(request.result);
  });
}

/**
 * Runs `body` inside one transaction and resolves once it has committed.
 *
 * Both the body and the commit have to finish: resolving on the last request
 * would report success before the records are durable, and resolving on commit
 * alone could return before the body has produced its value. A failure in
 * either aborts, so a batch is applied completely or not at all.
 *
 * @param {IDBDatabase} db
 * @param {string[]} storeNames
 * @param {"readonly"|"readwrite"} mode
 * @param {(stores: Record<string, IDBObjectStore>, tx: IDBTransaction) => unknown} body
 */
export function runTransaction(db, storeNames, mode, body) {
  let tx;
  try {
    tx = db.transaction(storeNames, mode);
  } catch (cause) {
    return Promise.reject(
      new StorageError(IDB_ERROR_CODES.transactionFailed, `could not start a transaction: ${cause?.name ?? "Error"}: ${cause?.message ?? cause}`, {
        cause,
      }),
    );
  }

  const stores = {};
  for (const storeName of storeNames) stores[storeName] = tx.objectStore(storeName);

  const committed = new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () =>
      reject(
        new StorageError(
          IDB_ERROR_CODES.transactionFailed,
          tx.error?.message ?? "the transaction was aborted",
          { cause: tx.error ?? undefined },
        ),
      );
  });

  const ran = (async () => body(stores, tx))();

  // A body failure aborts, so the commit promise settles instead of hanging.
  ran.catch(() => {
    try {
      tx.abort();
    } catch {
      // Already finished; the commit promise has settled.
    }
  });

  return Promise.all([ran, committed]).then(
    ([value]) => value,
    (cause) => {
      throw cause instanceof StorageError
        ? cause
        : new StorageError(IDB_ERROR_CODES.writeFailed, String(cause?.message ?? cause), { cause });
    },
  );
}

export const idbRequest = requestToPromise;

/** Reads one record by primary key. */
export function get(store, key) {
  return requestToPromise(store.get(key));
}

/** Reads every record in a store. */
export function getAll(store) {
  return requestToPromise(store.getAll());
}

/** Reads every record matching an index value. */
export function getAllByIndex(store, indexName, value) {
  return requestToPromise(store.index(indexName).getAll(value));
}

export function put(store, value) {
  return requestToPromise(store.put(value));
}

export function remove(store, key) {
  return requestToPromise(store.delete(key));
}
