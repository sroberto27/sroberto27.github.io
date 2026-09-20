/**
 * One authoritative state object with selector subscriptions.
 *
 * Adapters and views read state and emit intent; they never write. Every
 * mutation goes through `actions.js`, which calls `setState` here. That single
 * direction is what keeps map selection, list selection and route from each
 * trying to correct the others.
 *
 * Two properties matter for the synchronisation tests:
 *
 *  - A subscriber is called only when the value its selector returns actually
 *    changes, compared with `Object.is`. Re-rendering on every unrelated change
 *    is how a feedback loop starts.
 *  - A `setState` raised during notification is queued and applied after the
 *    current pass finishes, so listeners always observe a consistent state and
 *    a cycle terminates instead of recursing.
 *
 * Queueing bounds the recursion but not the total work: two subscribers that
 * keep writing values the other reacts to will drain the queue forever. A
 * subscriber writing a freshly built object every pass does the same, because
 * identity changes each time. That freezes the tab, which is indistinguishable
 * from a page that never loaded, so the pass count is capped and the cycle is
 * reported instead.
 */

/** Notification passes for one `setState` before a cycle is assumed. */
const MAX_NOTIFICATION_PASSES = 50;

/**
 * @param {object} initialState
 * @param {(error: Error, context: object) => void} [onSubscriberError]
 *   Called when a subscriber throws. One broken view must not stop the others
 *   from updating or leave the store mid-notification.
 */
export function createStore(initialState = {}, onSubscriberError = null) {
  let state = Object.freeze({ ...initialState });
  const subscribers = new Set();
  const pending = [];
  let notifying = false;

  function getState() {
    return state;
  }

  function notify(previous) {
    notifying = true;
    try {
      for (const subscriber of [...subscribers]) {
        if (!subscribers.has(subscriber)) continue;
        const next = subscriber.selector(state);
        if (Object.is(next, subscriber.last)) continue;
        const last = subscriber.last;
        subscriber.last = next;
        try {
          subscriber.fn(next, last, state);
        } catch (error) {
          if (onSubscriberError) onSubscriberError(error, { previous });
          else throw error;
        }
      }
    } finally {
      notifying = false;
    }
  }

  /**
   * Applies a patch, or the result of a function of the current state.
   * Returns the new state.
   */
  function setState(patch) {
    const previous = state;
    const changes = typeof patch === "function" ? patch(state) : patch;
    if (!changes) return state;

    let changed = false;
    for (const [key, value] of Object.entries(changes)) {
      if (!Object.is(state[key], value)) {
        changed = true;
        break;
      }
    }
    if (!changed) return state;

    state = Object.freeze({ ...state, ...changes });

    if (notifying) {
      pending.push(previous);
      return state;
    }

    notify(previous);
    let passes = 0;
    while (pending.length > 0) {
      passes += 1;
      if (passes > MAX_NOTIFICATION_PASSES) {
        pending.length = 0;
        throw new Error(
          `store: ${MAX_NOTIFICATION_PASSES} notification passes without settling. ` +
            "A subscriber is writing state that it, or another subscriber, reacts to. " +
            "A common cause is writing a newly built object when nothing has actually changed.",
        );
      }
      notify(pending.shift());
    }
    return state;
  }

  /**
   * Subscribes to a derived value.
   *
   * @param {(state: object) => unknown} selector
   * @param {(value: unknown, previous: unknown, state: object) => void} fn
   * @param {{immediate?: boolean}} [options] `immediate` calls `fn` once with
   *   the current value, which is how a view renders its first frame without a
   *   separate initialisation path.
   * @returns {() => void} Unsubscribe.
   */
  function subscribe(selector, fn, { immediate = false } = {}) {
    const subscriber = { selector, fn, last: selector(state) };
    subscribers.add(subscriber);
    if (immediate) fn(subscriber.last, undefined, state);
    return () => subscribers.delete(subscriber);
  }

  return { getState, setState, subscribe, get subscriberCount() { return subscribers.size; } };
}

/** Selects a top-level key. */
export function selectKey(key) {
  return (state) => state[key];
}
