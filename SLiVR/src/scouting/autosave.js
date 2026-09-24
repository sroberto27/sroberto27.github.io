const pending = new Set();
let serial = Promise.resolve();
export function registerDraft(flush) { pending.add(flush); return () => pending.delete(flush); }
export function hasDrafts() { return pending.size > 0; }
export function flushDrafts() { return Promise.all([...pending].map(flush => flush())); }
export function orderedSave(operation) { const result = serial.then(operation); serial = result.catch(() => {}); return result; }
