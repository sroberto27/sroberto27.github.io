/**
 * Local save status.
 *
 * The workspace exists only in this browser profile, so the user has to be able
 * to see whether their work reached storage. Three states are shown:
 * `Saving…`, `Saved locally`, `Save failed`.
 *
 * A failure keeps the workspace open. Nothing is discarded, retry is offered,
 * and emergency export stays available, because the in-memory records are still
 * the user's work even when storage will not take them.
 *
 * Writes are counted rather than flagged, so several overlapping saves do not
 * let one completion report "saved" while another is still running.
 */

export const SAVE_STATES = Object.freeze(["idle", "saving", "saved", "failed"]);

export const SAVE_LABELS = Object.freeze({
  idle: "Local workspace",
  saving: "Saving…",
  saved: "Saved locally",
  failed: "Save failed",
});

/**
 * @param {object} [options]
 * @param {(status: object) => void} [options.onChange]
 * @param {() => string} [options.now] ISO timestamp source.
 */
export function createSaveStatus({ onChange = null, now = () => new Date().toISOString() } = {}) {
  let state = "idle";
  let lastSavedAt = null;
  let error = null;
  let inFlight = 0;
  let lastAttempt = null;

  function snapshot() {
    return Object.freeze({
      state,
      label: SAVE_LABELS[state],
      lastSavedAt,
      error,
      canRetry: state === "failed" && typeof lastAttempt === "function",
    });
  }

  function emit() {
    onChange?.(snapshot());
  }

  /**
   * Runs a write and reports its outcome.
   *
   * The operation is kept so a failure can be retried with the same work rather
   * than asking the user to repeat their edit.
   *
   * @param {() => Promise<unknown>} operation
   */
  async function track(operation) {
    lastAttempt = operation;
    inFlight += 1;
    state = "saving";
    error = null;
    emit();
    try {
      const result = await operation();
      inFlight -= 1;
      if (inFlight === 0) {
        state = "saved";
        lastSavedAt = now();
        emit();
      }
      return { ok: true, result };
    } catch (caught) {
      inFlight -= 1;
      state = "failed";
      error = { code: caught?.code ?? "save-failed", message: caught?.message ?? String(caught) };
      emit();
      return { ok: false, error };
    }
  }

  /** Re-runs the write that failed. */
  async function retry() {
    if (typeof lastAttempt !== "function") return { ok: false, error };
    return track(lastAttempt);
  }

  /** Records a failure that did not come from a tracked write. */
  function fail(caught) {
    state = "failed";
    error = { code: caught?.code ?? "save-failed", message: caught?.message ?? String(caught) };
    emit();
    return snapshot();
  }

  function reset() {
    state = "idle";
    error = null;
    inFlight = 0;
    lastAttempt = null;
    emit();
    return snapshot();
  }

  return { track, retry, fail, reset, get status() { return snapshot(); } };
}
