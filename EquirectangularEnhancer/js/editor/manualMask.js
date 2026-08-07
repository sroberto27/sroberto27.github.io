// Freeform brush/lasso mask, in full working-image pixel coordinates (not
// display/preview coordinates — callers map pointer events through the
// current yaw offset before calling in here). Also accepts masks produced
// by smartSelect.js, so brush strokes can refine a depth-based selection.
export class ManualMask {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.canvas = document.createElement("canvas");
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext("2d");
    this._dirty = false;
    this.lassoPoints = [];
    this.clear();
  }

  clear() {
    this.ctx.fillStyle = "#000";
    this.ctx.fillRect(0, 0, this.width, this.height);
    this.lassoPoints = [];
    this._dirty = false;
  }

  isEmpty() {
    return !this._dirty;
  }

  // Draws a round-capped stroke from (x0,y0) to (x1,y1) in image pixel
  // space. Also drawn shifted by ±width so strokes painted near the seam
  // wrap correctly onto the opposite edge.
  brushStroke(x0, y0, x1, y1, radius) {
    this._dirty = true;
    const ctx = this.ctx;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = radius * 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const dx of [-this.width, 0, this.width]) {
      ctx.beginPath();
      ctx.moveTo(x0 + dx, y0);
      ctx.lineTo(x1 + dx, y1);
      ctx.stroke();
    }
  }

  brushDot(x, y, radius) {
    this._dirty = true;
    const ctx = this.ctx;
    ctx.fillStyle = "#fff";
    for (const dx of [-this.width, 0, this.width]) {
      ctx.beginPath();
      ctx.arc(x + dx, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  addLassoPoint(x, y) {
    this.lassoPoints.push([x, y]);
  }

  get lassoPointCount() {
    return this.lassoPoints.length;
  }

  closeLasso() {
    if (this.lassoPoints.length < 3) { this.lassoPoints = []; return; }
    this._dirty = true;
    const ctx = this.ctx;
    ctx.fillStyle = "#fff";
    for (const dx of [-this.width, 0, this.width]) {
      ctx.beginPath();
      ctx.moveTo(this.lassoPoints[0][0] + dx, this.lassoPoints[0][1]);
      for (let i = 1; i < this.lassoPoints.length; i++) {
        ctx.lineTo(this.lassoPoints[i][0] + dx, this.lassoPoints[i][1]);
      }
      ctx.closePath();
      ctx.fill();
    }
    this.lassoPoints = [];
  }

  // Adopts an externally computed mask (e.g. from smartSelect.js) at the
  // same resolution.
  setFromCanvas(maskCanvas) {
    this._dirty = true;
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.ctx.drawImage(maskCanvas, 0, 0, this.width, this.height);
  }
}
