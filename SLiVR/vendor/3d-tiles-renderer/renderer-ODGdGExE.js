//#region \0rolldown/runtime.js
var e = Object.defineProperty, t = (t, n) => {
	let r = {};
	for (var i in t) e(r, i, {
		get: t[i],
		enumerable: !0
	});
	return n || e(r, Symbol.toStringTag, { value: "Module" }), r;
};
//#endregion
//#region src/core/renderer/utilities/urlExtension.js
function n(e) {
	if (!e) return null;
	let t = e.length, n = e.indexOf("?"), r = e.indexOf("#");
	n !== -1 && (t = Math.min(t, n)), r !== -1 && (t = Math.min(t, r));
	let i = e.lastIndexOf(".", t), a = e.lastIndexOf("/", t), o = e.indexOf("://");
	return o !== -1 && o + 2 === a || i === -1 || i < a ? null : e.substring(i + 1, t) || null;
}
//#endregion
//#region src/core/renderer/utilities/Scheduler.js
var r = class {
	static pending = /* @__PURE__ */ new Map();
	static session = null;
	static setXRSession(e) {
		e !== this.session && (this.flushPending(), this.session = e);
	}
	static requestAnimationFrame(e) {
		let { session: t, pending: n } = this, r, i = () => {
			n.delete(r), e();
		};
		return r = t ? t.requestAnimationFrame(i) : requestAnimationFrame(i), n.set(r, e), r;
	}
	static cancelAnimationFrame(e) {
		let { pending: t, session: n } = this;
		t.delete(e), n ? n.cancelAnimationFrame(e) : cancelAnimationFrame(e);
	}
	static flushPending() {
		this.pending.forEach((e, t) => {
			e(), this.cancelAnimationFrame(t);
		});
	}
}, i = 2 ** 30, a = class {
	get unloadPriorityCallback() {
		return this._unloadPriorityCallback;
	}
	set unloadPriorityCallback(e) {
		e.length === 1 ? (console.warn("LRUCache: \"unloadPriorityCallback\" function has been changed to take two arguments."), this._unloadPriorityCallback = (t, n) => {
			let r = e(t), i = e(n);
			return r < i ? -1 : +(r > i);
		}) : this._unloadPriorityCallback = e;
	}
	constructor() {
		this.minSize = 6e3, this.maxSize = 8e3, this.minBytesSize = .3 * i, this.maxBytesSize = .4 * i, this.unloadPercent = .05, this.autoMarkUnused = !0, this.itemSet = /* @__PURE__ */ new Map(), this.itemList = [], this.usedSet = /* @__PURE__ */ new Set(), this.callbacks = /* @__PURE__ */ new Map(), this.unloadingHandle = -1, this.cachedBytes = 0, this.bytesMap = /* @__PURE__ */ new Map(), this.loadedSet = /* @__PURE__ */ new Set(), this._unloadPriorityCallback = null;
		let e = this.itemSet;
		this.defaultPriorityCallback = (t) => e.get(t);
	}
	isFull() {
		return this.itemSet.size >= this.maxSize || this.cachedBytes >= this.maxBytesSize;
	}
	getMemoryUsage(e) {
		return this.bytesMap.get(e) || 0;
	}
	setMemoryUsage(e, t) {
		let { bytesMap: n, itemSet: r } = this;
		r.has(e) && (this.cachedBytes -= n.get(e) || 0, n.set(e, t), this.cachedBytes += t);
	}
	add(e, t) {
		let n = this.itemSet;
		if (n.has(e) || this.isFull()) return !1;
		let r = this.usedSet, i = this.itemList, a = this.callbacks;
		return i.push(e), r.add(e), n.set(e, Date.now()), a.set(e, t), !0;
	}
	has(e) {
		return this.itemSet.has(e);
	}
	remove(e) {
		let t = this.usedSet, n = this.itemSet, r = this.itemList, i = this.bytesMap, a = this.callbacks, o = this.loadedSet;
		if (n.has(e)) {
			this.cachedBytes -= i.get(e) || 0, i.delete(e), a.get(e)(e);
			let s = r.indexOf(e);
			return r.splice(s, 1), t.delete(e), n.delete(e), a.delete(e), o.delete(e), !0;
		}
		return !1;
	}
	setLoaded(e, t) {
		let { itemSet: n, loadedSet: r } = this;
		n.has(e) && (t === !0 ? r.add(e) : r.delete(e));
	}
	markUsed(e) {
		let t = this.itemSet, n = this.usedSet;
		t.has(e) && !n.has(e) && (t.set(e, Date.now()), n.add(e));
	}
	markUnused(e) {
		this.usedSet.delete(e);
	}
	markAllUnused() {
		this.usedSet.clear();
	}
	isUsed(e) {
		return this.usedSet.has(e);
	}
	unloadUnusedContent() {
		let { unloadPercent: e, minSize: t, maxSize: n, itemList: i, itemSet: a, usedSet: o, loadedSet: s, callbacks: c, bytesMap: l, minBytesSize: u, maxBytesSize: d } = this, f = i.length - o.size, p = i.length - s.size, m = Math.max(Math.min(i.length - t, f), 0), h = this.cachedBytes - u, g = this.unloadPriorityCallback || this.defaultPriorityCallback, _ = !1, v = m > 0 && f > 0 || p && i.length > n;
		if (f && this.cachedBytes > u || p && this.cachedBytes > d || v) {
			i.sort((e, t) => {
				let n = o.has(e);
				if (n === o.has(t)) {
					let n = s.has(e);
					return n === s.has(t) ? -g(e, t) : n ? 1 : -1;
				} else return n ? 1 : -1;
			});
			let r = Math.max(t * e, m * e), p = Math.ceil(Math.min(r, f, m)), v = Math.max(e * h, e * u), y = Math.min(v, h), b = 0, x = 0;
			for (; this.cachedBytes - x > d || i.length - b > n;) {
				let e = i[b], t = l.get(e) || 0;
				if (o.has(e) && s.has(e) || this.cachedBytes - x - t < d && i.length - b <= n) break;
				x += t, b++;
			}
			for (; x < y || b < p;) {
				let e = i[b], t = l.get(e) || 0;
				if (o.has(e) || this.cachedBytes - x - t < u && b >= p) break;
				x += t, b++;
			}
			i.splice(0, b).forEach((e) => {
				this.cachedBytes -= l.get(e) || 0, c.get(e)(e), l.delete(e), a.delete(e), c.delete(e), s.delete(e), o.delete(e);
			}), _ = b < m || x < h && b < f, _ &&= b > 0;
		}
		_ && (this.unloadingHandle = r.requestAnimationFrame(() => this.scheduleUnload()));
	}
	scheduleUnload() {
		r.cancelAnimationFrame(this.unloadingHandle), this.scheduled || (this.scheduled = !0, queueMicrotask(() => {
			this.scheduled = !1, this.unloadUnusedContent();
		}));
	}
}, o = class extends DOMException {
	constructor() {
		super("PriorityQueue: Item removed", "AbortError");
	}
}, s = class {
	get running() {
		return this.items.length !== 0 || this.currJobs !== 0;
	}
	constructor() {
		this.maxJobs = 6, this.items = [], this.callbacks = /* @__PURE__ */ new Map(), this.currJobs = 0, this.scheduled = !1, this.autoUpdate = !0, this.priorityCallback = null, this._schedulingCallback = (e) => {
			r.requestAnimationFrame(e);
		}, this._runjobs = () => {
			this.scheduled = !1, this.tryRunJobs();
		};
	}
	sort() {
		let e = this.priorityCallback, t = this.items;
		e !== null && t.sort(e);
	}
	has(e) {
		return this.callbacks.has(e);
	}
	add(e, t) {
		let n = {
			callback: t,
			reject: null,
			resolve: null,
			promise: null
		};
		return n.promise = new Promise((t, r) => {
			let i = this.items, a = this.callbacks;
			n.resolve = t, n.reject = r, i.unshift(e), a.set(e, n), this.autoUpdate && this.scheduleJobRun();
		}), n.promise;
	}
	remove(e) {
		let t = this.items, n = this.callbacks, r = t.indexOf(e);
		if (r !== -1) {
			let i = n.get(e);
			i.promise.catch((e) => {
				if (e.name !== "AbortError") throw e;
			}), i.reject(new o()), t.splice(r, 1), n.delete(e);
		}
	}
	removeByFilter(e) {
		let { items: t } = this;
		for (let n = 0; n < t.length; n++) {
			let r = t[n];
			e(r) && (this.remove(r), n--);
		}
	}
	tryRunJobs() {
		this.sort();
		let e = this.items, t = this.callbacks, n = this.maxJobs, r = 0, i = () => {
			this.currJobs--, this.autoUpdate && this.scheduleJobRun();
		};
		for (; n > this.currJobs && e.length > 0 && r < n;) {
			this.currJobs++, r++;
			let n = e.pop(), { callback: a, resolve: o, reject: s } = t.get(n);
			t.delete(n);
			let c;
			try {
				c = a(n);
			} catch (e) {
				s(e), i();
			}
			c instanceof Promise ? c.then(o).catch(s).finally(i) : (o(c), i());
		}
	}
	flush(e) {
		let { items: t, callbacks: n } = this, r = t.indexOf(e);
		if (!n.has(e)) return;
		let { callback: i, resolve: a, reject: o } = n.get(e);
		n.delete(e), t.splice(r, 1);
		let s;
		try {
			s = i(e);
		} catch (e) {
			o(e);
			return;
		}
		return s instanceof Promise ? s.then(a).catch(o) : a(s), s;
	}
	scheduleJobRun() {
		this.scheduled ||= (this._schedulingCallback(this._runjobs), !0);
	}
}, c = -1, l = 0, u = 1, d = 2, f = 3, p = 4, m = 6378137, h = 1 / 298.257223563, g = 6356752.314245179, _ = {
	inView: !1,
	error: Infinity,
	distanceFromCamera: Infinity
};
function v(e) {
	return e === 4 || e === -1;
}
function y(e, t) {
	return b(e) && e.traversal.lastFrameVisited === t && e.traversal.used;
}
function b(e) {
	return !!e.traversal;
}
function x(e) {
	let { children: t } = e, n = t.length === 0 || b(t[t.length - 1]), r = !e.internal.hasUnrenderableContent || v(e.internal.loadingState);
	return n && r;
}
function S(e) {
	return e.traversal.unconditionallyRefine;
}
function C(e, t) {
	if (b(e) && (t.ensureChildrenArePreprocessed(e), e.traversal.lastFrameVisited !== t.frameCount && (e.traversal.wasInFrustum = e.traversal.inFrustum, e.traversal.wasSetActive = e.traversal.active, e.traversal.wasSetVisible = e.traversal.visible, e.traversal.usedLastFrame = e.traversal.used, e.traversal.lastFrameVisited = t.frameCount, e.traversal.used = !1, e.traversal.inFrustum = !1, e.traversal.isLeaf = !1, e.traversal.visible = !1, e.traversal.active = !1, e.traversal.error = Infinity, e.traversal.distanceFromCamera = Infinity, e.traversal.allChildrenReady = !1, e.traversal.allChildrenLoaded = !1, e.traversal.kicked = !1, e.traversal.allUsedChildrenProcessed = !1, t.calculateTileViewErrorWithPlugin(e, _), e.traversal.inFrustum = _.inView, e.traversal.error = _.error, e.traversal.distanceFromCamera = _.distanceFromCamera, e.traversal.unconditionallyRefine = e.internal.hasUnrenderableContent, !e.traversal.unconditionallyRefine))) {
		let t = e.parent;
		for (; t && t.traversal.unconditionallyRefine;) t = t.parent;
		t && t.geometricError <= e.geometricError && (e.traversal.unconditionallyRefine = !0);
	}
}
function w(e, t, n = !1) {
	if (C(e, t), n ? t.markTileUsed(e) : E(e), S(e) && x(e)) {
		let r = e.children;
		for (let e = 0, i = r.length; e < i; e++) w(r[e], t, n);
	}
}
function T(e, t) {
	if (C(e, t), e.traversal.usedLastFrame && (E(e), e.traversal.wasSetActive && (e.traversal.active = !0), (!e.traversal.active || S(e)) && x(e))) {
		let n = e.children;
		for (let e = 0, r = n.length; e < r; e++) T(n[e], t);
	}
}
function E(e) {
	e.traversal.used = !0;
}
function ee(e, t) {
	return !(e.traversal.error <= t.errorTarget && !S(e) || t.maxDepth > 0 && e.internal.depth + 1 >= t.maxDepth || !x(e));
}
function D(e, t) {
	let { frameCount: n } = t, { children: r } = e;
	for (let e = 0, i = r.length; e < i; e++) {
		let i = r[e];
		y(i, n) && (i.traversal.active && (i.traversal.kicked = !0, i.traversal.active = !1), D(i, t));
	}
}
function O(e) {
	return !S(e) && (!e.internal.hasContent || v(e.internal.loadingState));
}
function k(e, t) {
	if (C(e, t), !e.traversal.inFrustum) return;
	let n = e.parent;
	if (n && n.refine === "ADD" && e.geometricError > 0 && e.traversal.error * (n.geometricError / e.geometricError) <= t.errorTarget) return;
	if (!ee(e, t)) {
		E(e);
		return;
	}
	let r = !1, i = !1, a = e.children;
	for (let e = 0, n = a.length; e < n; e++) {
		let n = a[e];
		k(n, t), r ||= y(n, t.frameCount), i ||= n.traversal.inFrustum;
	}
	if (e.refine === "REPLACE" && !i && a.length !== 0) {
		e.traversal.inFrustum = !1, t.markTileUsed(e);
		for (let e = 0, n = a.length; e < n; e++) w(a[e], t, !0);
		return;
	}
	if (E(e), e.refine === "REPLACE" && r && (t.loadSiblings || t.loadAncestors)) for (let e = 0, n = a.length; e < n; e++) w(a[e], t);
}
function A(e, t) {
	let n = t.frameCount;
	if (!y(e, n)) return;
	let r = e.children, i = !1;
	for (let e = 0, t = r.length; e < t; e++) {
		let t = r[e];
		i ||= y(t, n);
	}
	if (!i) e.traversal.isLeaf = !0;
	else {
		for (let e = 0, n = r.length; e < n; e++) A(r[e], t);
		let i = !0;
		for (let e = 0, t = r.length; e < t; e++) {
			let t = r[e];
			if (y(t, n)) {
				let e = !S(t), n = !t.internal.hasContent || v(t.internal.loadingState);
				e && n || t.traversal.allChildrenLoaded || (i = !1);
			}
		}
		e.traversal.allChildrenLoaded = i;
	}
	let a = !0;
	for (let e = 0, n = r.length; e < n; e++) {
		let n = r[e];
		y(n, t.frameCount) && !n.traversal.allUsedChildrenProcessed && (a = !1);
	}
	e.traversal.allUsedChildrenProcessed = a && x(e);
}
function j(e, t) {
	if (!y(e, t.frameCount)) return;
	let n = e.children;
	if (e.refine === "REPLACE" && t.loadAncestors && !e.traversal.allChildrenLoaded && !S(e) && (e.traversal.isLeaf = !0), e.traversal.isLeaf) {
		if (!S(e) && (e.traversal.active = !0, x(e) && e.internal.hasContent && !v(e.internal.loadingState))) for (let e = 0, r = n.length; e < r; e++) T(n[e], t);
		return;
	}
	let r = n.length > 0;
	for (let e = 0, i = n.length; e < i; e++) {
		let i = n[e];
		j(i, t), y(i, t.frameCount) && !(i.traversal.active && O(i)) && !i.traversal.allChildrenReady && (r = !1);
	}
	e.traversal.allChildrenReady = r, e.refine === "REPLACE" && !r && e.traversal.wasSetActive && O(e) && (e.traversal.active = !0, D(e, t));
}
function M(e, t) {
	C(e, t);
	let n = y(e, t.frameCount);
	if (n && (e.internal.hasUnrenderableContent && (t.markTileUsed(e), t.queueTileForDownload(e)), e.internal.hasRenderableContent && e.refine === "ADD" && (e.traversal.active = !0), (e.traversal.active || e.traversal.kicked) && e.internal.hasContent && (t.markTileUsed(e), e.traversal.allUsedChildrenProcessed && t.queueTileForDownload(e), e.internal.loadingState !== 4 && (e.traversal.active = !1)), t.loadAncestors && e.internal.hasContent && (t.markTileUsed(e), t.queueTileForDownload(e)), e.internal.virtualChildCount > 0 && e.internal.hasContent && t.markTileUsed(e), e.traversal.visible = e.internal.hasRenderableContent && e.traversal.active && e.traversal.inFrustum && e.internal.loadingState === 4, t.stats.used++, e.traversal.inFrustum && t.stats.inFrustum++), n || b(e) && e.traversal.usedLastFrame) {
		let r = !1, i = !1;
		n ? (r = e.traversal.active, i = t.displayActiveTiles && e.traversal.active || e.traversal.visible) : C(e, t), e.internal.hasRenderableContent && e.internal.loadingState === 4 ? (r && t.stats.active++, i && t.stats.visible++, e.traversal.wasSetActive !== r && t.invokeOnePlugin((t) => t.setTileActive && t.setTileActive(e, r)), e.traversal.wasSetVisible !== i && t.invokeOnePlugin((t) => t.setTileVisible && t.setTileVisible(e, i))) : e.internal.hasRenderableContent || (i = e.traversal.isLeaf, e.traversal.wasSetVisible !== i && t.invokeOnePlugin((t) => t.setEmptyTileVisible && t.setEmptyTileVisible(e, i))), e.traversal.visible = i, e.traversal.active = r;
		let a = e.children;
		for (let e = 0, n = a.length; e < n; e++) {
			let n = a[e];
			M(n, t);
		}
	}
}
function te(e, t) {
	k(e, t), A(e, t), j(e, t), M(e, t);
}
//#endregion
//#region src/core/renderer/utilities/throttle.js
function ne(e) {
	let t = null;
	return () => {
		t === null && (t = r.requestAnimationFrame(() => {
			t = null, e();
		}));
	};
}
//#endregion
//#region src/core/renderer/utilities/TraversalUtils.js
var re = /* @__PURE__ */ t({
	traverseAncestors: () => P,
	traverseSet: () => N
});
function N(e, t = null, n = null) {
	let r = [];
	for (r.push(e), r.push(null), r.push(0); r.length > 0;) {
		let e = r.pop(), i = r.pop(), a = r.pop();
		if (t && t(a, i, e)) {
			n && n(a, i, e);
			return;
		}
		let o = a.children;
		if (o) for (let t = o.length - 1; t >= 0; t--) r.push(o[t]), r.push(a), r.push(e + 1);
		n && n(a, i, e);
	}
}
function P(e, t = null) {
	let n = e;
	for (; n;) {
		let e = n.internal.depth, r = n.parent;
		t && t(n, r, e), n = r;
	}
}
//#endregion
//#region src/core/renderer/tiles/TilesRendererBase.js
var F = Symbol("PLUGIN_REGISTERED"), I = {
	inView: !0,
	error: 0,
	distance: Infinity
}, L = (e, t) => {
	let n = e.priority || 0, r = t.priority || 0;
	return n === r ? !e.traversal || !t.traversal ? 0 : e.traversal.used === t.traversal.used ? e.traversal.error === t.traversal.error ? e.traversal.distanceFromCamera === t.traversal.distanceFromCamera ? e.internal.depthFromRenderedParent === t.internal.depthFromRenderedParent ? 0 : e.internal.depthFromRenderedParent > t.internal.depthFromRenderedParent ? -1 : 1 : e.traversal.distanceFromCamera > t.traversal.distanceFromCamera ? -1 : 1 : e.traversal.error > t.traversal.error ? 1 : -1 : e.traversal.used ? 1 : -1 : n > r ? 1 : -1;
}, R = (e, t) => e.traversal.used === t.traversal.used ? e.traversal.inFrustum === t.traversal.inFrustum ? e.internal.hasUnrenderableContent === t.internal.hasUnrenderableContent ? e.traversal.distanceFromCamera === t.traversal.distanceFromCamera ? e.internal.depthFromRenderedParent === t.internal.depthFromRenderedParent ? 0 : e.internal.depthFromRenderedParent > t.internal.depthFromRenderedParent ? -1 : 1 : e.traversal.distanceFromCamera > t.traversal.distanceFromCamera ? -1 : 1 : e.internal.hasUnrenderableContent ? 1 : -1 : e.traversal.inFrustum ? 1 : -1 : e.traversal.used ? 1 : -1, z = (e, t) => e.traversal.lastFrameVisited === t.traversal.lastFrameVisited ? e.internal.depthFromRenderedParent === t.internal.depthFromRenderedParent ? e.internal.loadingState === t.internal.loadingState ? e.internal.hasUnrenderableContent === t.internal.hasUnrenderableContent ? e.traversal.error === t.traversal.error ? 0 : e.traversal.error > t.traversal.error ? -1 : 1 : e.internal.hasUnrenderableContent ? -1 : 1 : e.internal.loadingState > t.internal.loadingState ? -1 : 1 : e.internal.depthFromRenderedParent > t.internal.depthFromRenderedParent ? 1 : -1 : e.traversal.lastFrameVisited > t.traversal.lastFrameVisited ? -1 : 1, B = (e, t) => {
	let n = e.priority ?? Infinity, r = t.priority ?? Infinity;
	if (n !== r) return n > r ? 1 : -1;
	if (!e.internal || !t.internal) return 0;
	let i = e.internal.renderer, a = t.internal.renderer, o = !i.loadAncestors, s = !a.loadAncestors;
	return o && s ? R(e, t) : L(e, t);
}, V = new a();
V.unloadPriorityCallback = z;
var H = new s();
H.maxJobs = 25, H.priorityCallback = B;
var U = new s();
U.maxJobs = 5, U.priorityCallback = B;
var W = new s();
W.maxJobs = 25, W.priorityCallback = (e, t) => {
	let n = e.parent, r = t.parent;
	return n === r ? 0 : n ? r ? B(n, r) : -1 : 1;
};
var G = class {
	get root() {
		let e = this.rootTileset;
		return e ? e.root : null;
	}
	get loadProgress() {
		let { stats: e, isLoading: t } = this, n = e.queued + e.downloading + e.parsing, r = e.inCacheSinceLoad + +!!t;
		return r === 0 ? 1 : 1 - n / r;
	}
	constructor(e = null) {
		this.rootLoadingState = 0, this.rootTileset = null, this.rootURL = e, this.fetchOptions = {}, this.plugins = [], this.queuedTiles = [], this.cachedSinceLoadComplete = /* @__PURE__ */ new Set(), this.isLoading = !1, this.processedTiles = /* @__PURE__ */ new WeakSet(), this.visibleTiles = /* @__PURE__ */ new Set(), this.activeTiles = /* @__PURE__ */ new Set(), this.usedSet = /* @__PURE__ */ new Set(), this.loadingTiles = /* @__PURE__ */ new Set(), this.lruCache = V, this.downloadQueue = H, this.parseQueue = U, this.processNodeQueue = W, this.stats = {
			inCacheSinceLoad: 0,
			inCache: 0,
			queued: 0,
			downloading: 0,
			parsing: 0,
			loaded: 0,
			failed: 0,
			inFrustum: 0,
			used: 0,
			active: 0,
			visible: 0,
			tilesProcessed: 0
		}, this.frameCount = 0, this._dispatchNeedsUpdateEvent = ne(() => {
			this.dispatchEvent({ type: "needs-update" });
		}), this.errorTarget = 16, this.displayActiveTiles = !1, this.maxDepth = Infinity, this.loadSiblings = !0, this.loadAncestors = !0, this.maxTilesProcessed = 250;
	}
	registerPlugin(e) {
		if (e[F] === !0) throw Error("TilesRendererBase: A plugin can only be registered to a single tileset");
		let t = this.plugins, n = e.priority || 0, r = t.length;
		for (let e = 0; e < t.length; e++) if ((t[e].priority || 0) > n) {
			r = e;
			break;
		}
		t.splice(r, 0, e), e[F] = !0, e.init && e.init(this);
	}
	unregisterPlugin(e) {
		let t = this.plugins;
		if (typeof e == "string" && (e = this.getPluginByName(e)), t.includes(e)) {
			let n = t.indexOf(e);
			return t.splice(n, 1), e.dispose && e.dispose(), !0;
		}
		return !1;
	}
	getPluginByName(e) {
		return this.plugins.find((t) => t.name === e) || null;
	}
	invokeOnePlugin(e) {
		let t = [...this.plugins, this];
		for (let n = 0; n < t.length; n++) {
			let r = e(t[n]);
			if (r) return r;
		}
		return null;
	}
	invokeAllPlugins(e) {
		let t = [...this.plugins, this], n = [];
		for (let r = 0; r < t.length; r++) {
			let i = e(t[r]);
			i && n.push(i);
		}
		return n.length === 0 ? null : Promise.all(n);
	}
	traverse(e, t, n = !0) {
		this.root && N(this.root, (t, ...r) => (n && this.ensureChildrenArePreprocessed(t, !0), e ? e(t, ...r) : !1), t);
	}
	getAttributions(e = []) {
		return this.invokeAllPlugins((t) => t !== this && t.getAttributions && t.getAttributions(e)), e;
	}
	update() {
		let { lruCache: e, usedSet: t, stats: n, root: r, downloadQueue: i, parseQueue: a, processNodeQueue: o } = this;
		if (this.rootLoadingState === 0 && (this.rootLoadingState = 2, this.invokeOnePlugin((e) => e.loadRootTileset && e.loadRootTileset()).then((e) => {
			let t = this.rootURL;
			t !== null && this.invokeAllPlugins((e) => t = e.preprocessURL ? e.preprocessURL(t, null) : t), this.rootLoadingState = 4, this.rootTileset = e, this.dispatchEvent({ type: "needs-update" }), this.dispatchEvent({
				type: "load-tileset",
				tileset: e,
				url: t
			}), this.dispatchEvent({
				type: "load-root-tileset",
				tileset: e,
				url: t
			});
		}).catch((e) => {
			this.rootLoadingState = -1, console.error(e), this.rootTileset = null, this.dispatchEvent({
				type: "load-error",
				tile: null,
				error: e,
				url: this.rootURL
			});
		})), !r) return;
		let s = null;
		if (this.invokeAllPlugins((e) => {
			if (e.doTilesNeedUpdate) {
				let t = e.doTilesNeedUpdate();
				s = s === null ? t : !!(s || t);
			}
		}), s === !1) {
			this.dispatchEvent({ type: "update-before" }), this.dispatchEvent({ type: "update-after" });
			return;
		}
		this.dispatchEvent({ type: "update-before" }), n.inFrustum = 0, n.used = 0, n.active = 0, n.visible = 0, n.tilesProcessed = 0, this.frameCount++, t.forEach((t) => e.markUnused(t)), t.clear(), this.prepareForTraversal(), te(r, this), this.removeUnusedPendingTiles();
		let c = this.queuedTiles;
		c.sort(e.unloadPriorityCallback);
		for (let t = 0, n = c.length; t < n && !e.isFull(); t++) this.requestTileContents(c[t]);
		c.length = 0, e.scheduleUnload(), (i.running || a.running || o.running) === !1 && this.isLoading === !0 && (this.cachedSinceLoadComplete.clear(), n.inCacheSinceLoad = 0, this.dispatchEvent({ type: "tiles-load-end" }), this.isLoading = !1), this.dispatchEvent({ type: "update-after" });
	}
	resetFailedTiles() {
		this.rootLoadingState === -1 && (this.rootLoadingState = 0);
		let e = this.stats;
		e.failed !== 0 && (this.traverse((e) => {
			e.internal.loadingState === -1 && (e.internal.loadingState = 0);
		}, null, !1), e.failed = 0);
	}
	calculateTileViewErrorWithPlugin(e, t) {
		this.calculateTileViewError(e, t);
		let n = null, r = 0, i = Infinity;
		this.invokeAllPlugins((t) => {
			t !== this && t.calculateTileViewError && (I.inView = !0, I.error = 0, I.distance = Infinity, t.calculateTileViewError(e, I) && (n === null && (n = !0), n &&= I.inView, I.inView && (i = Math.min(i, I.distance), r = Math.max(r, I.error))));
		}), t.inView && n !== !1 ? (t.error = Math.max(t.error, r), t.distanceFromCamera = Math.min(t.distanceFromCamera, i)) : n ? (t.inView = !0, t.error = r, t.distanceFromCamera = i) : t.inView = !1;
	}
	dispose() {
		[...this.plugins].forEach((e) => {
			this.unregisterPlugin(e);
		});
		let e = this.lruCache, t = [];
		this.traverse((e) => (t.push(e), !1), null, !1);
		for (let n = 0, r = t.length; n < r; n++) e.remove(t[n]);
		this.stats = {
			queued: 0,
			parsing: 0,
			downloading: 0,
			failed: 0,
			inFrustum: 0,
			traversed: 0,
			used: 0,
			active: 0,
			visible: 0
		}, this.frameCount = 0, this.loadingTiles.clear();
	}
	calculateBytesUsed(e, t) {
		return 0;
	}
	dispatchEvent(e) {}
	addEventListener(e, t) {}
	removeEventListener(e, t) {}
	parseTile(e, t, n) {
		return null;
	}
	prepareForTraversal() {}
	disposeTile(e) {
		e.traversal.visible && (e.internal.hasRenderableContent ? this.invokeOnePlugin((t) => t.setTileVisible && t.setTileVisible(e, !1)) : this.invokeOnePlugin((t) => t.setEmptyTileVisible && t.setEmptyTileVisible(e, !1)), e.traversal.visible = !1), e.traversal.active && e.internal.hasRenderableContent && this.invokeOnePlugin((t) => t.setTileActive && t.setTileActive(e, !1)), e.traversal.active = !1;
		let { scene: t } = e.engineData;
		t && this.dispatchEvent({
			type: "dispose-model",
			scene: t,
			tile: e
		});
	}
	preprocessNode(e, t, r = null) {
		if (this.processedTiles.add(e), this.stats.tilesProcessed++, e.content && (!("uri" in e.content) && "url" in e.content && (e.content.uri = e.content.url, delete e.content.url), e.content.boundingVolume && !("box" in e.content.boundingVolume || "sphere" in e.content.boundingVolume || "region" in e.content.boundingVolume) && delete e.content.boundingVolume), e.parent = r, e.children = e.children || [], e.internal = {
			hasContent: !1,
			hasRenderableContent: !1,
			hasUnrenderableContent: !1,
			loadingState: 0,
			basePath: t,
			depth: -1,
			depthFromRenderedParent: -1,
			isVirtual: !1,
			virtualChildCount: 0,
			renderer: this,
			...e.internal
		}, e.content?.uri) {
			let t = n(e.content.uri), r = !!(t && /json$/.test(t));
			e.internal.hasContent = !0, e.internal.hasUnrenderableContent = r, e.internal.hasRenderableContent = !r;
		} else e.internal.hasContent = !1, e.internal.hasUnrenderableContent = !1, e.internal.hasRenderableContent = !1;
		r ? (e.internal.depth = r.internal.depth + 1, e.internal.depthFromRenderedParent = r.internal.depthFromRenderedParent + +!!e.internal.hasRenderableContent) : (e.internal.depth = 0, e.internal.depthFromRenderedParent = +!!e.internal.hasRenderableContent), e.traversal = {
			distanceFromCamera: Infinity,
			error: Infinity,
			inFrustum: !1,
			wasInFrustum: !1,
			isLeaf: !1,
			used: !1,
			usedLastFrame: !1,
			visible: !1,
			wasSetVisible: !1,
			active: !1,
			wasSetActive: !1,
			allChildrenReady: !1,
			allChildrenLoaded: !1,
			kicked: !1,
			allUsedChildrenProcessed: !1,
			lastFrameVisited: -1
		}, r === null ? e.refine = e.refine || "REPLACE" : e.refine = e.refine || r.refine, e.engineData = {
			scene: null,
			metadata: null,
			boundingVolume: null
		}, Object.defineProperty(e, "cached", {
			get() {
				return console.warn("TilesRenderer: \"tile.cached\" field has been renamed to \"tile.engineData\"."), this.engineData;
			},
			enumerable: !1,
			configurable: !0
		}), this.invokeAllPlugins((n) => {
			n !== this && n.preprocessNode && n.preprocessNode(e, t, r);
		});
	}
	setTileActive(e, t) {
		t ? this.activeTiles.add(e) : this.activeTiles.delete(e);
	}
	setTileVisible(e, t) {
		t ? this.visibleTiles.add(e) : this.visibleTiles.delete(e), this.dispatchEvent({
			type: "tile-visibility-change",
			scene: e.engineData.scene,
			tile: e,
			visible: t
		});
	}
	calculateTileViewError(e, t) {}
	removeUnusedPendingTiles() {
		let { lruCache: e, loadingTiles: t } = this, n = [];
		for (let r of t) !e.isUsed(r) && r.internal.loadingState === 1 && n.push(r);
		for (let t = 0; t < n.length; t++) e.remove(n[t]);
	}
	queueTileForDownload(e) {
		e.internal.loadingState !== 0 || this.lruCache.isFull() || this.queuedTiles.push(e);
	}
	markTileUsed(e) {
		this.usedSet.add(e), this.lruCache.markUsed(e);
	}
	fetchData(e, t) {
		return fetch(e, t);
	}
	ensureChildrenArePreprocessed(e, t = this.stats.tilesProcessed < this.maxTilesProcessed) {
		let n = e.children;
		if (n.length === 0 || n[n.length - 1].traversal) return;
		let r = (t) => {
			for (let n = 0, r = t.length; n < r; n++) {
				let r = t[n];
				r && !r.traversal && this.preprocessNode(r, e.internal.basePath, e);
			}
		};
		t ? (this.processNodeQueue.remove(e), r(n)) : this.processNodeQueue.has(e) || this.processNodeQueue.add(e, (e) => {
			r(e.children), this._dispatchNeedsUpdateEvent();
		});
	}
	getBytesUsed(e) {
		let t = 0;
		return this.invokeAllPlugins((n) => {
			n.calculateBytesUsed && (t += n.calculateBytesUsed(e, e.engineData.scene) || 0);
		}), t;
	}
	recalculateBytesUsed(e = null) {
		let { lruCache: t, processedTiles: n } = this;
		e === null ? t.itemSet.forEach((e) => {
			n.has(e) && t.setMemoryUsage(e, this.getBytesUsed(e));
		}) : t.setMemoryUsage(e, this.getBytesUsed(e));
	}
	preprocessTileset(e, t, n = null) {
		let [r, i] = e.asset.version.split(".").map((e) => parseInt(e));
		console.assert(r <= 1, "TilesRenderer: asset.version is expected to be a 1.x or a compatible version."), r === 1 && i > 0 && console.warn("TilesRenderer: tiles versions at 1.1 or higher have limited support. Some new extensions and features may not be supported.");
		let a = t.replace(/\/[^/]*$/, "");
		a = new URL(a, window.location.href).toString(), this.preprocessNode(e.root, a, n);
	}
	loadRootTileset() {
		let e = this.rootURL;
		return this.invokeAllPlugins((t) => e = t.preprocessURL ? t.preprocessURL(e, null) : e), this.invokeOnePlugin((t) => t.fetchData && t.fetchData(e, this.fetchOptions)).then((t) => {
			if (!(t instanceof Response)) return t;
			if (t.ok) return t.json();
			throw Error(`TilesRenderer: Failed to load tileset "${e}" with status ${t.status} : ${t.statusText}`);
		}).then((t) => (this.preprocessTileset(t, e), t));
	}
	requestTileContents(e) {
		if (e.internal.loadingState !== 0) return;
		let t = !1, r = null, i = new URL(e.content.uri, e.internal.basePath + "/").toString();
		this.invokeAllPlugins((t) => i = t.preprocessURL ? t.preprocessURL(i, e) : i);
		let a = this.stats, o = this.lruCache, s = this.downloadQueue, c = this.parseQueue, l = this.loadingTiles, u = n(i), d = new AbortController(), f = d.signal;
		if (o.add(e, (n) => {
			d.abort(), t ? n.children.length = 0 : this.invokeAllPlugins((e) => {
				e.disposeTile && e.disposeTile(n);
			}), a.inCache--, this.cachedSinceLoadComplete.has(e) && (this.cachedSinceLoadComplete.delete(e), a.inCacheSinceLoad--), n.internal.loadingState === 1 ? a.queued-- : n.internal.loadingState === 2 ? a.downloading-- : n.internal.loadingState === 3 ? a.parsing-- : n.internal.loadingState === 4 && a.loaded--, n.internal.loadingState = 0, c.remove(n), s.remove(n), l.delete(n);
		})) return this.isLoading || (this.isLoading = !0, this.dispatchEvent({ type: "tiles-load-start" })), o.setMemoryUsage(e, this.getBytesUsed(e)), this.cachedSinceLoadComplete.add(e), a.inCacheSinceLoad++, a.inCache++, a.queued++, e.internal.loadingState = 1, l.add(e), s.add(e, (t) => {
			if (f.aborted) return Promise.resolve();
			e.internal.loadingState = 2, a.downloading++, a.queued--;
			let n = this.invokeOnePlugin((e) => e.fetchData && e.fetchData(i, {
				...this.fetchOptions,
				signal: f
			}));
			return this.dispatchEvent({
				type: "tile-download-start",
				tile: e,
				url: i,
				get uri() {
					return console.warn("tile-download-start event: \"uri\" has been renamed to \"url\"."), this.url;
				}
			}), n;
		}).then((e) => {
			if (!f.aborted) {
				if (!(e instanceof Response)) return e;
				if (e.ok) return u === "json" ? e.json() : e.arrayBuffer();
				throw Error(`Failed to load model with error code ${e.status}`);
			}
		}).then((n) => {
			if (!f.aborted) return a.downloading--, a.parsing++, e.internal.loadingState = 3, c.add(e, (a) => f.aborted ? Promise.resolve() : u === "json" && n.root ? (this.preprocessTileset(n, i, e), e.children.push(n.root), r = n, t = !0, Promise.resolve()) : this.invokeOnePlugin((e) => e.parseTile && e.parseTile(n, a, u, i, f)));
		}).then(() => {
			if (f.aborted) return;
			a.parsing--, a.loaded++, e.internal.loadingState = 4, l.delete(e), o.setLoaded(e, !0);
			let n = this.getBytesUsed(e);
			if (o.getMemoryUsage(e) === 0 && n > 0 && o.isFull()) {
				o.remove(e);
				return;
			}
			o.setMemoryUsage(e, n), this.dispatchEvent({ type: "needs-update" }), t && this.dispatchEvent({
				type: "load-tileset",
				tileset: r,
				url: i
			}), e.engineData.scene && this.dispatchEvent({
				type: "load-model",
				scene: e.engineData.scene,
				tile: e,
				url: i
			});
		}).catch((t) => {
			f.aborted || (t.name === "AbortError" ? o.remove(e) : (c.remove(e), s.remove(e), e.internal.loadingState === 1 ? a.queued-- : e.internal.loadingState === 2 ? a.downloading-- : e.internal.loadingState === 3 ? a.parsing-- : e.internal.loadingState === 4 && a.loaded--, a.failed++, console.error(`TilesRenderer : Failed to load tile at url "${e.content.uri}".`), console.error(t), e.internal.loadingState = -1, l.delete(e), o.setLoaded(e, !0), this.dispatchEvent({
				type: "load-error",
				tile: e,
				error: t,
				url: i
			})));
		});
	}
}, K = /* @__PURE__ */ t({
	arrayToString: () => J,
	getWorkingPath: () => Y,
	readMagicBytes: () => q
});
function q(e) {
	if (e === null || e.byteLength < 4) return "";
	let t;
	if (t = e instanceof DataView ? e : new DataView(e), String.fromCharCode(t.getUint8(0)) === "{") return null;
	let n = "";
	for (let e = 0; e < 4; e++) n += String.fromCharCode(t.getUint8(e));
	return n;
}
var ie = new TextDecoder();
function J(e) {
	return ie.decode(e);
}
function Y(e) {
	return e.replace(/[\\/][^\\/]+$/, "") + "/";
}
//#endregion
//#region src/core/renderer/loaders/LoaderBase.js
var X = class {
	constructor() {
		this.fetchOptions = {}, this.workingPath = "";
	}
	loadAsync(e) {
		return fetch(e, this.fetchOptions).then((t) => {
			if (!t.ok) throw Error(`Failed to load file "${e}" with status ${t.status} : ${t.statusText}`);
			return t.arrayBuffer();
		}).then((t) => (this.workingPath === "" && (this.workingPath = Y(e)), this.parse(t)));
	}
	resolveExternalURL(e) {
		return new URL(e, this.workingPath).href;
	}
	parse(e) {
		throw Error("LoaderBase: Parse not implemented.");
	}
};
//#endregion
//#region src/core/renderer/utilities/FeatureTable.js
function Z(e, t, n, r, i, a) {
	let o;
	switch (r) {
		case "SCALAR":
			o = 1;
			break;
		case "VEC2":
			o = 2;
			break;
		case "VEC3":
			o = 3;
			break;
		case "VEC4":
			o = 4;
			break;
		default: throw Error(`FeatureTable : Feature type not provided for "${a}".`);
	}
	let s, c = n * o;
	switch (i) {
		case "BYTE":
			s = new Int8Array(e, t, c);
			break;
		case "UNSIGNED_BYTE":
			s = new Uint8Array(e, t, c);
			break;
		case "SHORT":
			s = new Int16Array(e, t, c);
			break;
		case "UNSIGNED_SHORT":
			s = new Uint16Array(e, t, c);
			break;
		case "INT":
			s = new Int32Array(e, t, c);
			break;
		case "UNSIGNED_INT":
			s = new Uint32Array(e, t, c);
			break;
		case "FLOAT":
			s = new Float32Array(e, t, c);
			break;
		case "DOUBLE":
			s = new Float64Array(e, t, c);
			break;
		default: throw Error(`FeatureTable : Feature component type not provided for "${a}".`);
	}
	return s;
}
var Q = class {
	constructor(e, t, n, r) {
		this.buffer = e, this.binOffset = t + n, this.binLength = r;
		let i = null;
		if (n !== 0) {
			let r = new Uint8Array(e, t, n);
			i = JSON.parse(J(r));
		} else i = {};
		this.header = i;
	}
	getKeys() {
		return Object.keys(this.header).filter((e) => e !== "extensions");
	}
	getData(e, t, n = null, r = null) {
		let i = this.header;
		if (!(e in i)) return null;
		let a = i[e];
		if (!(a instanceof Object) || Array.isArray(a)) return a;
		{
			let { buffer: i, binOffset: o, binLength: s } = this, c = a.byteOffset || 0, l = a.type || r, u = a.componentType || n;
			if ("type" in a && r && a.type !== r) throw Error("FeatureTable: Specified type does not match expected type.");
			let d = o + c, f = Z(i, d, t, l, u, e);
			if (d + f.byteLength > o + s) throw Error("FeatureTable: Feature data read outside binary body length.");
			return f;
		}
	}
	getBuffer(e, t) {
		let { buffer: n, binOffset: r } = this;
		return n.slice(r + e, r + e + t);
	}
}, ae = class {
	constructor(e) {
		this.batchTable = e;
		let t = e.header.extensions["3DTILES_batch_table_hierarchy"];
		this.classes = t.classes;
		for (let e of this.classes) {
			let t = e.instances;
			for (let n in t) e.instances[n] = this._parseProperty(t[n], e.length, n);
		}
		if (this.instancesLength = t.instancesLength, this.classIds = this._parseProperty(t.classIds, this.instancesLength, "classIds"), t.parentCounts ? this.parentCounts = this._parseProperty(t.parentCounts, this.instancesLength, "parentCounts") : this.parentCounts = Array(this.instancesLength).fill(1), t.parentIds) {
			let e = this.parentCounts.reduce((e, t) => e + t, 0);
			this.parentIds = this._parseProperty(t.parentIds, e, "parentIds");
		} else this.parentIds = null;
		this.instancesIds = [];
		let n = {};
		for (let e of this.classIds) n[e] = n[e] ?? 0, this.instancesIds.push(n[e]), n[e]++;
	}
	_parseProperty(e, t, n) {
		if (Array.isArray(e)) return e;
		{
			let { buffer: r, binOffset: i } = this.batchTable, a = e.byteOffset, o = e.componentType || "UNSIGNED_SHORT";
			return Z(r, i + a, t, "SCALAR", o, n);
		}
	}
	getDataFromId(e, t = {}) {
		let n = this.parentCounts[e];
		if (this.parentIds && n > 0) {
			let r = 0;
			for (let t = 0; t < e; t++) r += this.parentCounts[t];
			for (let i = 0; i < n; i++) {
				let n = this.parentIds[r + i];
				n !== e && this.getDataFromId(n, t);
			}
		}
		let r = this.classIds[e], i = this.classes[r].instances, a = this.classes[r].name, o = this.instancesIds[e];
		for (let e in i) t[a] = t[a] || {}, t[a][e] = i[e][o];
		return t;
	}
}, $ = class extends Q {
	constructor(e, t, n, r, i) {
		super(e, n, r, i), this.count = t, this.extensions = {};
		let a = this.header.extensions;
		a && a["3DTILES_batch_table_hierarchy"] && (this.extensions["3DTILES_batch_table_hierarchy"] = new ae(this));
	}
	getDataFromId(e, t = {}) {
		if (e < 0 || e >= this.count) throw Error(`BatchTable: id value "${e}" out of bounds for "${this.count}" features number.`);
		for (let n of this.getKeys()) t[n] = super.getData(n, this.count)[e];
		for (let n in this.extensions) {
			let r = this.extensions[n];
			r.getDataFromId instanceof Function && (t[n] = t[n] || {}, r.getDataFromId(e, t[n]));
		}
		return t;
	}
	getPropertyArray(e) {
		return super.getData(e, this.count);
	}
}, oe = class extends X {
	parse(e) {
		let t = new DataView(e), n = q(t);
		console.assert(n === "b3dm");
		let r = t.getUint32(4, !0);
		console.assert(r === 1);
		let i = t.getUint32(8, !0);
		console.assert(i === e.byteLength);
		let a = t.getUint32(12, !0), o = t.getUint32(16, !0), s = t.getUint32(20, !0), c = t.getUint32(24, !0), l = new Q(e.slice(28, 28 + a + o), 0, a, o), u = 28 + a + o, d = new $(e.slice(u, u + s + c), l.getData("BATCH_LENGTH"), 0, s, c), f = u + s + c;
		return {
			version: r,
			featureTable: l,
			batchTable: d,
			glbBytes: new Uint8Array(e, f, i - f)
		};
	}
}, se = class extends X {
	parse(e) {
		let t = new DataView(e), n = q(t);
		console.assert(n === "i3dm");
		let r = t.getUint32(4, !0);
		console.assert(r === 1);
		let i = t.getUint32(8, !0);
		console.assert(i === e.byteLength);
		let a = t.getUint32(12, !0), o = t.getUint32(16, !0), s = t.getUint32(20, !0), c = t.getUint32(24, !0), l = t.getUint32(28, !0), u = new Q(e.slice(32, 32 + a + o), 0, a, o), d = 32 + a + o, f = new $(e.slice(d, d + s + c), u.getData("INSTANCES_LENGTH"), 0, s, c), p = d + s + c, m = new Uint8Array(e, p, i - p), h = null, g = null, _ = null;
		if (l) h = m, g = Promise.resolve();
		else {
			let e = this.resolveExternalURL(J(m));
			_ = Y(e), g = fetch(e, this.fetchOptions).then((t) => {
				if (!t.ok) throw Error(`I3DMLoaderBase : Failed to load file "${e}" with status ${t.status} : ${t.statusText}`);
				return t.arrayBuffer();
			}).then((e) => {
				h = new Uint8Array(e);
			});
		}
		return g.then(() => ({
			version: r,
			featureTable: u,
			batchTable: f,
			glbBytes: h,
			gltfWorkingPath: _
		}));
	}
}, ce = class extends X {
	parse(e) {
		let t = new DataView(e), n = q(t);
		console.assert(n === "pnts");
		let r = t.getUint32(4, !0);
		console.assert(r === 1);
		let i = t.getUint32(8, !0);
		console.assert(i === e.byteLength);
		let a = t.getUint32(12, !0), o = t.getUint32(16, !0), s = t.getUint32(20, !0), c = t.getUint32(24, !0), l = new Q(e.slice(28, 28 + a + o), 0, a, o), u = 28 + a + o, d = new $(e.slice(u, u + s + c), l.getData("BATCH_LENGTH") || l.getData("POINTS_LENGTH"), 0, s, c);
		return Promise.resolve({
			version: r,
			featureTable: l,
			batchTable: d
		});
	}
}, le = class extends X {
	parse(e) {
		let t = new DataView(e), n = q(t);
		console.assert(n === "cmpt", "CMPTLoader: The magic bytes equal \"cmpt\".");
		let r = t.getUint32(4, !0);
		console.assert(r === 1, "CMPTLoader: The version listed in the header is \"1\".");
		let i = t.getUint32(8, !0);
		console.assert(i === e.byteLength, "CMPTLoader: The contents buffer length listed in the header matches the file.");
		let a = t.getUint32(12, !0), o = [], s = 16;
		for (let t = 0; t < a; t++) {
			let t = new DataView(e, s, 12), n = q(t), r = t.getUint32(4, !0), i = t.getUint32(8, !0), a = new Uint8Array(e, s, i);
			o.push({
				type: n,
				buffer: a,
				version: r
			}), s += i;
		}
		return {
			version: r,
			tiles: o
		};
	}
};
//#endregion
export { m as A, p as C, l as D, u as E, a as M, r as N, h as O, t as P, c as S, f as T, G as _, $ as a, P as b, X as c, Y as d, q as f, U as g, W as h, oe as i, s as j, g as k, K as l, V as m, ce as n, Q as o, H as p, se as r, Z as s, le as t, J as u, B as v, d as w, N as x, re as y };

//# sourceMappingURL=renderer-ODGdGExE.js.map