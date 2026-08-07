// Drag/touch reveal slider between the "before" (original) and "after"
// (enhanced) flat equirectangular images.
export class CompareSlider {
  constructor({ root, beforeWrap, handle }) {
    this.root = root;
    this.beforeWrap = beforeWrap;
    this.handle = handle;
    this._dragging = false;
    this._pointerId = null;
    this.setPercent(50);

    root.addEventListener("pointerdown", (e) => {
      this._dragging = true;
      this._pointerId = e.pointerId;
      root.setPointerCapture(e.pointerId);
      this._updateFromEvent(e);
    });
    root.addEventListener("pointermove", (e) => {
      if (!this._dragging || e.pointerId !== this._pointerId) return;
      this._updateFromEvent(e);
    });
    const stop = (e) => {
      if (e.pointerId !== this._pointerId) return;
      this._dragging = false;
      this._pointerId = null;
    };
    root.addEventListener("pointerup", stop);
    root.addEventListener("pointercancel", stop);
  }

  _updateFromEvent(e) {
    const rect = this.root.getBoundingClientRect();
    const pct = ((e.clientX - rect.left) / rect.width) * 100;
    this.setPercent(pct);
  }

  setPercent(pct) {
    const clamped = Math.max(0, Math.min(100, pct));
    this.beforeWrap.style.clipPath = `inset(0 ${100 - clamped}% 0 0)`;
    this.handle.style.left = `${clamped}%`;
  }
}
