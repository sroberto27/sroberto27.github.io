/**
 * Minimal DOM stand-in, enough to boot the application shell under `node --test`.
 *
 * It exists to answer one question without a browser: does the shell actually
 * build a page, or does it throw part-way and leave an empty body? That
 * failure looks identical to a misconfigured server, so it is worth being able
 * to rule out from the command line.
 *
 * It implements only the interface `shell.js` uses. It is not a browser: no
 * layout, no styling, no event dispatch beyond what a test triggers by hand,
 * and no rendering. A shell that builds correctly here can still be unusable
 * on screen, so this never substitutes for the live checks.
 */

const VOID_TEXT = Symbol("text");

class FakeNode {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.attributes = new Map();
    this.listeners = new Map();
    this.className = "";
    this.value = "";
    this[VOID_TEXT] = "";
    this.classList = {
      add: (name) => this.#setClasses([...this.#classes(), name]),
      remove: (name) => this.#setClasses(this.#classes().filter((c) => c !== name)),
      contains: (name) => this.#classes().includes(name),
      toggle: (name, force) => {
        const has = this.#classes().includes(name);
        const next = force === undefined ? !has : force;
        if (next) this.classList.add(name);
        else this.classList.remove(name);
        return next;
      },
    };
  }

  #classes() {
    return this.className.split(/\s+/).filter(Boolean);
  }

  #setClasses(names) {
    this.className = [...new Set(names)].join(" ");
  }

  get isConnected() {
    let node = this;
    while (node.parentNode) node = node.parentNode;
    return node.isDocumentRoot === true;
  }

  get textContent() {
    if (this.children.length === 0) return this[VOID_TEXT];
    return this.children.map((child) => child.textContent).join("");
  }

  set textContent(value) {
    this.children = [];
    this[VOID_TEXT] = String(value);
  }

  set innerHTML(value) {
    this.textContent = String(value);
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  addEventListener(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(fn);
  }

  removeEventListener(type, fn) {
    this.listeners.get(type)?.delete(fn);
  }

  /** Invokes the handlers a test wants to exercise. */
  dispatch(type, event = {}) {
    for (const fn of [...(this.listeners.get(type) ?? [])]) {
      fn({ type, target: this, preventDefault() {}, ...event });
    }
  }

  append(...nodes) {
    for (const node of nodes) {
      const child = typeof node === "string" ? textNode(node) : node;
      child.parentNode?.remove?.call?.(child);
      child.parentNode = this;
      this.children.push(child);
    }
  }

  replaceChildren(...nodes) {
    for (const child of this.children) child.parentNode = null;
    this.children = [];
    this.append(...nodes);
  }

  remove() {
    const siblings = this.parentNode?.children;
    if (!siblings) return;
    const index = siblings.indexOf(this);
    if (index !== -1) siblings.splice(index, 1);
    this.parentNode = null;
  }

  click() {
    this.dispatch("click");
  }

  focus() {
    this.focused = true;
  }

  /** Depth-first search by tag name or `.class`. */
  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  querySelectorAll(selector) {
    const matches = [];
    const wanted = selector.trim();
    const walk = (node) => {
      for (const child of node.children) {
        if (wanted.startsWith(".")) {
          if (child.classList.contains(wanted.slice(1))) matches.push(child);
        } else if (child.tagName === wanted.toUpperCase()) {
          matches.push(child);
        }
        walk(child);
      }
    };
    walk(this);
    return matches;
  }

  /** Every descendant, for assertions about what the shell produced. */
  descendants() {
    const all = [];
    const walk = (node) => {
      for (const child of node.children) {
        all.push(child);
        walk(child);
      }
    };
    walk(this);
    return all;
  }
}

function textNode(value) {
  const node = new FakeNode("#text");
  node.textContent = value;
  return node;
}

/**
 * Builds a document and window pair.
 *
 * @param {{hash?: string, indexedDB?: object, diagnostics?: object}} [options]
 */
export function createFakeDom({ hash = "", indexedDB = null, diagnostics = null } = {}) {
  const documentRoot = new FakeNode("#document");
  documentRoot.isDocumentRoot = true;

  const body = new FakeNode("body");
  documentRoot.append(body);
  const app = new FakeNode("div");
  app.setAttribute("id", "app");
  body.append(app);

  const doc = {
    readyState: "complete",
    body,
    createElement: (tag) => new FakeNode(tag),
    createTextNode: textNode,
    getElementById: (id) =>
      documentRoot.descendants().find((node) => node.getAttribute("id") === id) ?? null,
  };

  const store = new Map();
  if (diagnostics) store.set("slivr:diagnostics", JSON.stringify(diagnostics));

  const listeners = new Map();

  /*
   * A controllable clock. The veil over the immersive viewer escalates its
   * wording on timers, and a test that had to wait twenty-five real seconds to
   * see the escalation would not be written.
   */
  let clockNow = 0;
  let nextTimerId = 1;
  const timers = new Map();

  const opened = [];

  const win = {
    document: doc,
    setTimeout(fn, delay = 0) {
      const id = nextTimerId++;
      timers.set(id, { fn, at: clockNow + delay });
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    /** Records the request rather than performing it; nothing opens in a test. */
    open(url, target, features) {
      opened.push({ url, target, features });
      return null;
    },
    get opened() {
      return opened;
    },
    location: { hash, pathname: "/SLiVR/", search: "" },
    indexedDB,
    localStorage: {
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: (key) => store.delete(key),
    },
    history: {
      replaceState(_state, _title, url) {
        const index = String(url).indexOf("#");
        win.location.hash = index === -1 ? "" : String(url).slice(index);
      },
    },
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    },
    removeEventListener(type, fn) {
      listeners.get(type)?.delete(fn);
    },
    dispatch(type, event = undefined) {
      for (const fn of [...(listeners.get(type) ?? [])]) fn(event);
    },
  };

  /** Runs every timer now due, in the order they became due. */
  function advance(ms) {
    clockNow += ms;
    const due = [...timers.entries()]
      .filter(([, timer]) => timer.at <= clockNow)
      .sort((a, b) => a[1].at - b[1].at);
    for (const [id, timer] of due) {
      timers.delete(id);
      timer.fn();
    }
  }

  return { window: win, document: doc, app, body, documentRoot, advance };
}

/** All text the shell rendered, for coarse presence checks. */
export function renderedText(node) {
  return node.textContent;
}
