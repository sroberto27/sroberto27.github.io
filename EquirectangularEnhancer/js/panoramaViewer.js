import * as THREE from "three";

// Interactive 360° sphere viewer with drag-to-look, scroll/pinch zoom, and a
// toggle between two equirectangular textures (original vs enhanced).
export class PanoramaViewer {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);

    const geometry = new THREE.SphereGeometry(500, 64, 40);
    geometry.scale(-1, 1, 1); // view from inside

    this.material = new THREE.MeshBasicMaterial({ color: 0x111111 });
    this.anaglyphMaterial = null; // created lazily once stereo textures exist
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.scene.add(this.mesh);

    this.textures = { original: null, enhanced: null };
    this.stereoTextures = { left: null, right: null };
    this.currentKey = "enhanced";
    this.anaglyphEnabled = false;

    this._lon = 0;
    this._lat = 0;
    this._isPointerDown = false;
    this._pointerId = null;
    this._lastX = 0;
    this._lastY = 0;
    this._fov = 75;

    this._bindEvents();
    this._resizeObserver = new ResizeObserver(() => this._onResize());
    this._resizeObserver.observe(canvas.parentElement);
    this._onResize();

    this._animate = this._animate.bind(this);
    this._raf = requestAnimationFrame(this._animate);
  }

  setTexture(key, canvasOrImage) {
    const tex = new THREE.CanvasTexture(canvasOrImage);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.wrapS = THREE.RepeatWrapping; // horizontal seam matches the sphere wrap
    tex.needsUpdate = true;
    if (this.textures[key]) this.textures[key].dispose();
    this.textures[key] = tex;
    if (key === this.currentKey) this._applyCurrentTexture();
  }

  showKey(key) {
    if (!this.textures[key]) return;
    this.currentKey = key;
    this._applyCurrentTexture();
  }

  _applyCurrentTexture() {
    this.material.map = this.textures[this.currentKey];
    this.material.color.set(0xffffff);
    this.material.needsUpdate = true;
  }

  // Sets the left/right eye textures used for the anaglyph sanity-check
  // preview (does not affect the normal mono original/enhanced toggle).
  setStereoTextures(leftCanvas, rightCanvas) {
    const makeTex = (canvas) => {
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.wrapS = THREE.RepeatWrapping;
      tex.needsUpdate = true;
      return tex;
    };
    if (this.stereoTextures.left) this.stereoTextures.left.dispose();
    if (this.stereoTextures.right) this.stereoTextures.right.dispose();
    this.stereoTextures.left = makeTex(leftCanvas);
    this.stereoTextures.right = makeTex(rightCanvas);

    if (!this.anaglyphMaterial) {
      this.anaglyphMaterial = new THREE.ShaderMaterial({
        uniforms: {
          uLeft: { value: this.stereoTextures.left },
          uRight: { value: this.stereoTextures.right },
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform sampler2D uLeft;
          uniform sampler2D uRight;
          varying vec2 vUv;
          void main() {
            vec3 l = texture2D(uLeft, vUv).rgb;
            vec3 r = texture2D(uRight, vUv).rgb;
            gl_FragColor = vec4(l.r, r.g, r.b, 1.0);
          }
        `,
      });
    } else {
      this.anaglyphMaterial.uniforms.uLeft.value = this.stereoTextures.left;
      this.anaglyphMaterial.uniforms.uRight.value = this.stereoTextures.right;
    }
  }

  hasStereoTextures() {
    return !!(this.stereoTextures.left && this.stereoTextures.right);
  }

  setAnaglyph(enabled) {
    if (enabled && !this.hasStereoTextures()) return;
    this.anaglyphEnabled = enabled;
    this.mesh.material = enabled ? this.anaglyphMaterial : this.material;
  }

  _bindEvents() {
    const c = this.canvas;
    c.addEventListener("pointerdown", (e) => {
      this._isPointerDown = true;
      this._pointerId = e.pointerId;
      this._lastX = e.clientX;
      this._lastY = e.clientY;
      c.setPointerCapture(e.pointerId);
    });
    c.addEventListener("pointermove", (e) => {
      if (!this._isPointerDown || e.pointerId !== this._pointerId) return;
      const dx = e.clientX - this._lastX;
      const dy = e.clientY - this._lastY;
      this._lastX = e.clientX;
      this._lastY = e.clientY;
      this._lon -= dx * 0.15;
      this._lat = Math.max(-85, Math.min(85, this._lat + dy * 0.15));
    });
    const stop = (e) => {
      if (e.pointerId !== this._pointerId) return;
      this._isPointerDown = false;
      this._pointerId = null;
    };
    c.addEventListener("pointerup", stop);
    c.addEventListener("pointercancel", stop);
    c.addEventListener("pointerleave", stop);

    c.addEventListener("wheel", (e) => {
      e.preventDefault();
      this._fov = Math.max(30, Math.min(100, this._fov + e.deltaY * 0.04));
      this.camera.fov = this._fov;
      this.camera.updateProjectionMatrix();
    }, { passive: false });

    // Pinch-to-zoom
    this._pinchDist = null;
    c.addEventListener("touchstart", (e) => {
      if (e.touches.length === 2) this._pinchDist = this._touchDist(e);
    }, { passive: true });
    c.addEventListener("touchmove", (e) => {
      if (e.touches.length === 2 && this._pinchDist != null) {
        const d = this._touchDist(e);
        const delta = this._pinchDist - d;
        this._fov = Math.max(30, Math.min(100, this._fov + delta * 0.15));
        this.camera.fov = this._fov;
        this.camera.updateProjectionMatrix();
        this._pinchDist = d;
      }
    }, { passive: true });
    c.addEventListener("touchend", () => { this._pinchDist = null; });
  }

  _touchDist(e) {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  resize() {
    this._onResize();
  }

  _onResize() {
    const parent = this.canvas.parentElement;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    if (w === 0 || h === 0) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  _animate() {
    this._raf = requestAnimationFrame(this._animate);
    const phi = THREE.MathUtils.degToRad(90 - this._lat);
    const theta = THREE.MathUtils.degToRad(this._lon);
    const target = new THREE.Vector3(
      500 * Math.sin(phi) * Math.cos(theta),
      500 * Math.cos(phi),
      500 * Math.sin(phi) * Math.sin(theta)
    );
    this.camera.lookAt(target);
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    cancelAnimationFrame(this._raf);
    this._resizeObserver.disconnect();
    for (const key of Object.keys(this.textures)) {
      if (this.textures[key]) this.textures[key].dispose();
    }
    if (this.stereoTextures.left) this.stereoTextures.left.dispose();
    if (this.stereoTextures.right) this.stereoTextures.right.dispose();
    if (this.anaglyphMaterial) this.anaglyphMaterial.dispose();
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.renderer.dispose();
  }
}
