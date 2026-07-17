/* ============================================================
   Pointer particle / depth-smoke field (home hero)
   ------------------------------------------------------------
   No external libraries required. The effect uses:
     • pointer-following particles with velocity-sensitive emission
     • a low-resolution feedback buffer that preserves, diffuses, and
       slowly fades each trail into smoke
     • a simulated depth value per particle
     • two transparent canvases: one behind the project hexagons and
       one in front of them
     • DOM-derived hexagon obstacles that bend background particles
       around the cluster

   Edit SETTINGS below to tune density, persistence, and intensity.
   ============================================================ */
(function () {
  "use strict";

  const SETTINGS = {
    /* Particle counts per breakpoint. */
    desktopParticles: 560,
    tabletParticles: 390,
    mobileParticles: 200,

    feedbackScaleDesktop: 0.40,
    feedbackScaleMobile: 0.34,
    maximumPixelRatio: 1.25,

    /* Feedback drift scales with cursor activity, so the smoke
       stops evolving once the pointer is still. */
    decayBack: 0.936,
    decayFront: 0.900,
    diffusion: 1.00065,
    driftPixels: 0.13,

    pointerEase: 0.14,
    pointerRadius: 230,
    pointerForce: 0.012,
    pointerSwirl: 0.0075,
    flowStrength: 0.0105,

    /* No base or idle emission. Movement alone creates particles. */
    baseEmission: 0,
    distanceEmission: 0.18,
    speedEmission: 0.060,
    maximumEmissionPerFrame: 14,

    /* The effect begins winding down almost immediately after the
       pointer stops, then only the existing smoke fades away. */
    stillDelayMs: 85,
    motionFadeMs: 190,
    minimumMoveDistance: 0.08,
    minimumMoveSpeed: 0.14,

    obstaclePadding: 1.18,
    obstacleForce: 0.075,
    obstacleTurn: 0.026,

    trailOpacityBack: 0.135,
    trailOpacityFront: 0.082,
    smokeOpacityBack: 0.027,
    smokeOpacityFront: 0.0065,
    pointOpacityBack: 0.40,
    pointOpacityFront: 0.31,
    presentationOpacityBack: 0.60,
    presentationOpacityFront: 0.35
  };

  const TAU = Math.PI * 2;
  /* Palette: original blue → violet → magenta → orange. */
  const COLOR_STOPS = [
    { at: 0.00, rgb: [37, 174, 255] },
    { at: 0.33, rgb: [115, 91, 214] },
    { at: 0.68, rgb: [225, 51, 137] },
    { at: 1.00, rgb: [245, 116, 43] }
  ];

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (a, b, t) => a + (b - a) * t;

  function smoothstep(min, max, value) {
    const x = clamp((value - min) / (max - min), 0, 1);
    return x * x * (3 - 2 * x);
  }

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function colorAt(position) {
    const t = clamp(position, 0, 1);
    let lower = COLOR_STOPS[0];
    let upper = COLOR_STOPS[COLOR_STOPS.length - 1];

    for (let i = 0; i < COLOR_STOPS.length - 1; i += 1) {
      if (t >= COLOR_STOPS[i].at && t <= COLOR_STOPS[i + 1].at) {
        lower = COLOR_STOPS[i];
        upper = COLOR_STOPS[i + 1];
        break;
      }
    }

    const local = (t - lower.at) / Math.max(0.0001, upper.at - lower.at);
    return [
      Math.round(lerp(lower.rgb[0], upper.rgb[0], local)),
      Math.round(lerp(lower.rgb[1], upper.rgb[1], local)),
      Math.round(lerp(lower.rgb[2], upper.rgb[2], local))
    ];
  }

  function rgba(rgb, alpha) {
    return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${clamp(alpha, 0, 1)})`;
  }

  function mutedSmokeColor(rgb) {
    /* Keep particle points vivid while making the accumulated plume dark
       enough to merge with the navy website background. */
    return rgb.map((channel) => Math.round(channel * 0.46));
  }

  function pageIsReducedMotion() {
    return window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  class FeedbackLayer {
    constructor(canvas, options) {
      this.canvas = canvas;
      this.context = canvas.getContext("2d", { alpha: true, desynchronized: true });
      this.options = options;

      this.buffer = document.createElement("canvas");
      this.scratch = document.createElement("canvas");
      this.bufferContext = this.buffer.getContext("2d", { alpha: true });
      this.scratchContext = this.scratch.getContext("2d", { alpha: true });

      this.width = 1;
      this.height = 1;
      this.pixelRatio = 1;
      this.feedbackScale = 0.5;
      this.feedbackWidth = 1;
      this.feedbackHeight = 1;
    }

    resize(width, height, pixelRatio, feedbackScale) {
      this.width = Math.max(1, Math.round(width));
      this.height = Math.max(1, Math.round(height));
      this.pixelRatio = pixelRatio;
      this.feedbackScale = feedbackScale;

      this.canvas.width = Math.max(1, Math.round(this.width * pixelRatio));
      this.canvas.height = Math.max(1, Math.round(this.height * pixelRatio));
      this.canvas.style.width = `${this.width}px`;
      this.canvas.style.height = `${this.height}px`;

      this.feedbackWidth = Math.max(1, Math.round(this.width * feedbackScale));
      this.feedbackHeight = Math.max(1, Math.round(this.height * feedbackScale));
      this.buffer.width = this.feedbackWidth;
      this.buffer.height = this.feedbackHeight;
      this.scratch.width = this.feedbackWidth;
      this.scratch.height = this.feedbackHeight;

      this.context.imageSmoothingEnabled = true;
      this.bufferContext.imageSmoothingEnabled = true;
      this.scratchContext.imageSmoothingEnabled = true;
      this.clear();
    }

    clear() {
      this.context.setTransform(1, 0, 0, 1, 0, 0);
      this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.bufferContext.setTransform(1, 0, 0, 1, 0, 0);
      this.bufferContext.clearRect(0, 0, this.feedbackWidth, this.feedbackHeight);
      this.scratchContext.setTransform(1, 0, 0, 1, 0, 0);
      this.scratchContext.clearRect(0, 0, this.feedbackWidth, this.feedbackHeight);
    }

    beginFeedback(timeSeconds, activity) {
      const sctx = this.scratchContext;
      const bctx = this.bufferContext;
      const w = this.feedbackWidth;
      const h = this.feedbackHeight;
      const motion = clamp(activity, 0, 1);
      const scale = 1 + (this.options.diffusion - 1) * motion;
      const drift = this.options.driftPixels * this.feedbackScale * motion;
      const waveX = Math.sin(timeSeconds * 0.67 + this.options.phase) * drift;
      const waveY = -drift * 0.45 + Math.cos(timeSeconds * 0.43) * drift * 0.22;

      sctx.setTransform(1, 0, 0, 1, 0, 0);
      sctx.clearRect(0, 0, w, h);
      sctx.globalCompositeOperation = "source-over";
      sctx.globalAlpha = this.options.decay;
      sctx.translate(w * 0.5 + waveX, h * 0.5 + waveY);
      sctx.scale(scale, scale);
      sctx.rotate(Math.sin(timeSeconds * 0.23 + this.options.phase) * 0.0008 * motion);
      sctx.translate(-w * 0.5, -h * 0.5);
      sctx.drawImage(this.buffer, 0, 0);

      /* A faint offset copy creates inexpensive diffusion. The low
         feedback resolution makes this read as soft smoke rather than
         as duplicated geometry when it is scaled to the screen. */
      sctx.setTransform(1, 0, 0, 1, 0, 0);
      sctx.globalAlpha = this.options.decay * 0.035;
      sctx.drawImage(this.buffer, waveX * -1.8, waveY * -1.3);

      bctx.setTransform(1, 0, 0, 1, 0, 0);
      bctx.clearRect(0, 0, w, h);
      bctx.globalCompositeOperation = "source-over";
      bctx.globalAlpha = 1;
      bctx.drawImage(this.scratch, 0, 0);

      /* Draw calls use CSS-pixel coordinates after this transform. */
      bctx.setTransform(this.feedbackScale, 0, 0, this.feedbackScale, 0, 0);
      /* Alpha compositing avoids the additive build-up that can turn many
         translucent coloured deposits into an opaque white/blue wash. */
      bctx.globalCompositeOperation = "source-over";
    }

    drawTrail(particle, opacity, smokeOpacity, depthScale) {
      if (opacity <= 0.001) return;

      const ctx = this.bufferContext;
      const speed = Math.hypot(particle.x - particle.previousX, particle.y - particle.previousY);
      const width = clamp((particle.size * 0.08 + speed * 0.10) * depthScale, 0.35, 2.3);
      const trailAlpha = opacity * this.options.trailOpacity;
      const smokeAlpha = opacity * smokeOpacity;
      const smokeRgb = mutedSmokeColor(particle.rgb);

      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = rgba(particle.rgb, trailAlpha);
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(particle.previousX, particle.previousY);
      ctx.lineTo(particle.x, particle.y);
      ctx.stroke();

      /* Deposit several translucent circles. As the feedback buffer is
         repeatedly transformed, these become a soft smoke plume. */
      const ageExpansion = 1 + particle.age * 0.025;
      const radius = clamp(particle.size * 1.28 * ageExpansion * depthScale, 2.5, 22);
      ctx.fillStyle = rgba(smokeRgb, smokeAlpha);
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, radius, 0, TAU);
      ctx.fill();

      if (speed > 5.5) {
        ctx.globalAlpha = 0.18;
        ctx.beginPath();
        ctx.arc(
          lerp(particle.previousX, particle.x, 0.45),
          lerp(particle.previousY, particle.y, 0.45),
          radius * 0.78,
          0,
          TAU
        );
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    present(particles, particleCount, weightFunction, pointOpacity) {
      const ctx = this.context;
      const dpr = this.pixelRatio;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = this.options.presentationOpacity;
      ctx.drawImage(
        this.buffer,
        0,
        0,
        this.feedbackWidth,
        this.feedbackHeight,
        0,
        0,
        this.canvas.width,
        this.canvas.height
      );
      ctx.globalAlpha = 1;

      /* Crisp luminous particles sit on top of their own smoke trail. */
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < particleCount; i += 1) {
        const particle = particles[i];
        if (!particle.active) continue;

        const layerWeight = weightFunction(particle.depth);
        if (layerWeight <= 0.015) continue;

        const lifeAlpha = particleLifeAlpha(particle);
        const alpha = lifeAlpha * layerWeight * pointOpacity;
        if (alpha <= 0.01) continue;

        const depthScale = 0.72 + (particle.depth + 1) * 0.20;
        const radius = clamp(particle.pointSize * depthScale, 0.65, 3.1);
        ctx.fillStyle = rgba(particle.rgb, alpha);
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, radius, 0, TAU);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
    }
  }

  function particleLifeAlpha(particle) {
    const progress = particle.age / particle.life;
    const fadeIn = smoothstep(0, 0.08, progress);
    const fadeOut = 1 - smoothstep(0.62, 1, progress);
    return fadeIn * fadeOut;
  }

  class ParticleField {
    constructor(home, backCanvas, frontCanvas) {
      this.home = home;
      this.backCanvas = backCanvas;
      this.frontCanvas = frontCanvas;

      this.width = 1;
      this.height = 1;
      this.maxParticles = SETTINGS.desktopParticles;
      this.particles = [];
      this.poolCursor = 0;
      this.obstacles = [];
      this.lastObstacleUpdate = 0;

      this.pointer = {
        x: 0,
        y: 0,
        targetX: 0,
        targetY: 0,
        previousX: 0,
        previousY: 0,
        velocityX: 0,
        velocityY: 0,
        active: false,
        lastMoveAt: -Infinity
      };

      this.lastFrameAt = performance.now();
      this.emissionRemainder = 0;
      this.running = true;
      this.resizeQueued = false;

      this.backLayer = new FeedbackLayer(backCanvas, {
        decay: SETTINGS.decayBack,
        diffusion: SETTINGS.diffusion,
        driftPixels: SETTINGS.driftPixels,
        phase: 0.2,
        trailOpacity: SETTINGS.trailOpacityBack,
        presentationOpacity: SETTINGS.presentationOpacityBack
      });

      this.frontLayer = new FeedbackLayer(frontCanvas, {
        decay: SETTINGS.decayFront,
        diffusion: SETTINGS.diffusion + 0.0007,
        driftPixels: SETTINGS.driftPixels * 0.8,
        phase: 2.1,
        trailOpacity: SETTINGS.trailOpacityFront,
        presentationOpacity: SETTINGS.presentationOpacityFront
      });

      this.handlePointerMove = this.handlePointerMove.bind(this);
      this.handlePointerLeave = this.handlePointerLeave.bind(this);
      this.handleResize = this.handleResize.bind(this);
      this.animate = this.animate.bind(this);

      this.buildPool();
      this.bindEvents();
      this.resize();
      requestAnimationFrame(this.animate);
    }

    buildPool() {
      this.particles.length = 0;
      for (let i = 0; i < SETTINGS.desktopParticles; i += 1) {
        this.particles.push({
          active: false,
          x: 0,
          y: 0,
          previousX: 0,
          previousY: 0,
          velocityX: 0,
          velocityY: 0,
          depth: 0,
          depthVelocity: 0,
          depthPhase: 0,
          age: 0,
          life: 1,
          size: 1,
          pointSize: 1,
          rgb: [255, 255, 255]
        });
      }
    }

    bindEvents() {
      this.home.addEventListener("pointermove", this.handlePointerMove, { passive: true });
      this.home.addEventListener("pointerenter", this.handlePointerMove, { passive: true });
      this.home.addEventListener("pointerleave", this.handlePointerLeave, { passive: true });
      window.addEventListener("resize", this.handleResize, { passive: true });

      if (window.ResizeObserver) {
        this.resizeObserver = new window.ResizeObserver(this.handleResize);
        this.resizeObserver.observe(this.home);
      }
    }

    handleResize() {
      if (this.resizeQueued) return;
      this.resizeQueued = true;
      requestAnimationFrame(() => {
        this.resizeQueued = false;
        this.resize();
      });
    }

    resize() {
      const rect = this.home.getBoundingClientRect();
      const nextWidth = Math.max(1, rect.width);
      const nextHeight = Math.max(1, rect.height);
      const widthRatio = nextWidth / Math.max(1, this.width);
      const heightRatio = nextHeight / Math.max(1, this.height);

      this.width = nextWidth;
      this.height = nextHeight;

      const isMobile = window.matchMedia("(max-width: 700px)").matches;
      const isTablet = !isMobile && window.matchMedia("(max-width: 1100px)").matches;
      this.maxParticles = isMobile
        ? SETTINGS.mobileParticles
        : (isTablet ? SETTINGS.tabletParticles : SETTINGS.desktopParticles);

      const pixelRatio = Math.min(window.devicePixelRatio || 1, SETTINGS.maximumPixelRatio);
      const feedbackScale = isMobile
        ? SETTINGS.feedbackScaleMobile
        : SETTINGS.feedbackScaleDesktop;

      this.backLayer.resize(this.width, this.height, pixelRatio, feedbackScale);
      this.frontLayer.resize(this.width, this.height, pixelRatio, feedbackScale);

      if (Number.isFinite(widthRatio) && Number.isFinite(heightRatio)) {
        for (let i = 0; i < this.particles.length; i += 1) {
          const p = this.particles[i];
          if (!p.active) continue;
          p.x *= widthRatio;
          p.previousX *= widthRatio;
          p.y *= heightRatio;
          p.previousY *= heightRatio;
        }
      }

      const startX = this.width * 0.54;
      const startY = this.height * 0.54;
      if (!this.pointer.active) {
        this.pointer.x = startX;
        this.pointer.y = startY;
        this.pointer.targetX = startX;
        this.pointer.targetY = startY;
        this.pointer.previousX = startX;
        this.pointer.previousY = startY;
      }

      this.updateObstacles(true);
    }

    handlePointerMove(event) {
      const rect = this.home.getBoundingClientRect();
      const nextX = clamp(event.clientX - rect.left, 0, rect.width);
      const nextY = clamp(event.clientY - rect.top, 0, rect.height);

      const moveX = nextX - this.pointer.targetX;
      const moveY = nextY - this.pointer.targetY;
      const moved = Math.hypot(moveX, moveY);

      this.pointer.velocityX = moveX;
      this.pointer.velocityY = moveY;
      this.pointer.targetX = nextX;
      this.pointer.targetY = nextY;
      this.pointer.active = true;
      if (moved >= SETTINGS.minimumMoveDistance) {
        this.pointer.lastMoveAt = performance.now();
      }
    }

    handlePointerLeave() {
      this.pointer.active = false;
      this.pointer.velocityX = 0;
      this.pointer.velocityY = 0;
      this.pointer.lastMoveAt = -Infinity;
    }

    updateObstacles(force) {
      const now = performance.now();
      if (!force && now - this.lastObstacleUpdate < 550) return;
      this.lastObstacleUpdate = now;

      const homeRect = this.home.getBoundingClientRect();
      const hexagons = this.home.querySelectorAll(".hex-cluster .hex-img");
      this.obstacles = Array.from(hexagons).map((hexagon) => {
        const rect = hexagon.getBoundingClientRect();
        return {
          centerX: rect.left - homeRect.left + rect.width * 0.5,
          centerY: rect.top - homeRect.top + rect.height * 0.5,
          radiusX: Math.max(8, rect.width * 0.51),
          radiusY: Math.max(8, rect.height * 0.51)
        };
      });
    }

    seedAmbientParticles() {
      /* A small initial cluster prevents an empty first frame without
         covering the page before the visitor moves the pointer. */
      const count = Math.min(26, Math.round(this.maxParticles * 0.05));
      for (let i = 0; i < count; i += 1) {
        const x = randomBetween(this.width * 0.46, this.width * 0.88);
        const y = randomBetween(this.height * 0.20, this.height * 0.72);
        const p = this.spawnParticle(x, y, randomBetween(-0.35, 0.35), randomBetween(-0.28, 0.16));
        if (p) p.age = randomBetween(0, p.life * 0.42);
      }
    }

    acquireParticle() {
      for (let search = 0; search < this.maxParticles; search += 1) {
        const index = (this.poolCursor + search) % this.maxParticles;
        const particle = this.particles[index];
        if (!particle.active) {
          this.poolCursor = (index + 1) % this.maxParticles;
          return particle;
        }
      }

      /* The pool is full: reuse the oldest particle rather than allocate. */
      let oldest = this.particles[0];
      for (let i = 1; i < this.maxParticles; i += 1) {
        if (this.particles[i].age > oldest.age) oldest = this.particles[i];
      }
      return oldest;
    }

    spawnParticle(x, y, inputVelocityX, inputVelocityY) {
      const particle = this.acquireParticle();
      if (!particle) return null;

      const angle = Math.random() * TAU;
      const scatter = randomBetween(0.12, 1.25);
      const depth = Math.random() < 0.78
        ? randomBetween(-1, 0.18)
        : randomBetween(0.38, 1);
      const positionColor = clamp(x / Math.max(1, this.width), 0, 1);

      particle.active = true;
      particle.x = x + Math.cos(angle) * randomBetween(0, 7);
      particle.y = y + Math.sin(angle) * randomBetween(0, 7);
      particle.previousX = particle.x;
      particle.previousY = particle.y;
      particle.velocityX = inputVelocityX * randomBetween(0.035, 0.095) + Math.cos(angle) * scatter;
      particle.velocityY = inputVelocityY * randomBetween(0.035, 0.095) + Math.sin(angle) * scatter - 0.12;
      particle.depth = depth;
      particle.depthVelocity = randomBetween(-0.0045, 0.0045);
      particle.depthPhase = Math.random() * TAU;
      particle.age = 0;
      particle.life = randomBetween(1.8, 4.4);
      particle.size = randomBetween(2.2, 6.8) * (0.84 + (depth + 1) * 0.10);
      particle.pointSize = randomBetween(0.60, 1.55);
      particle.rgb = colorAt(positionColor);
      return particle;
    }

    pointerActivity(now) {
      const elapsed = now - this.pointer.lastMoveAt;
      return 1 - smoothstep(
        SETTINGS.stillDelayMs,
        SETTINGS.stillDelayMs + SETTINGS.motionFadeMs,
        elapsed
      );
    }

    emitAlongPointer(deltaSeconds, now, activity) {
      const pointer = this.pointer;
      const oldX = pointer.x;
      const oldY = pointer.y;

      pointer.previousX = oldX;
      pointer.previousY = oldY;
      pointer.x += (pointer.targetX - pointer.x) * SETTINGS.pointerEase;
      pointer.y += (pointer.targetY - pointer.y) * SETTINGS.pointerEase;

      const dx = pointer.x - oldX;
      const dy = pointer.y - oldY;
      const distance = Math.hypot(dx, dy);
      const speed = Math.hypot(pointer.velocityX, pointer.velocityY);
      const moving =
        pointer.active &&
        activity > 0.001 &&
        (distance >= SETTINGS.minimumMoveDistance ||
         speed >= SETTINGS.minimumMoveSpeed);

      let emission = moving
        ? (
            SETTINGS.baseEmission +
            distance * SETTINGS.distanceEmission +
            speed * SETTINGS.speedEmission
          ) * activity
        : 0;

      emission *= clamp(deltaSeconds * 60, 0.3, 1.8);
      emission += moving ? this.emissionRemainder : 0;

      const count = Math.min(
        SETTINGS.maximumEmissionPerFrame,
        Math.floor(emission)
      );
      this.emissionRemainder = moving ? emission - count : 0;

      for (let i = 0; i < count; i += 1) {
        const t = count <= 1 ? 1 : i / (count - 1);
        const x = lerp(oldX, pointer.x, t);
        const y = lerp(oldY, pointer.y, t);
        this.spawnParticle(x, y, pointer.velocityX, pointer.velocityY);
      }

      pointer.velocityX *= moving ? 0.84 : 0.45;
      pointer.velocityY *= moving ? 0.84 : 0.45;
    }

    applyHexagonFlow(particle) {
      if (particle.depth > 0.28) return;

      for (let i = 0; i < this.obstacles.length; i += 1) {
        const obstacle = this.obstacles[i];
        const dx = particle.x - obstacle.centerX;
        const dy = particle.y - obstacle.centerY;
        const nx = dx / obstacle.radiusX;
        const ny = dy / obstacle.radiusY;
        const normalizedDistance = Math.hypot(nx, ny);

        if (normalizedDistance <= 0.0001 || normalizedDistance >= SETTINGS.obstaclePadding) {
          continue;
        }

        const proximity = 1 - normalizedDistance / SETTINGS.obstaclePadding;
        const depthInfluence = 1 - smoothstep(-0.25, 0.35, particle.depth);
        const force = proximity * proximity * SETTINGS.obstacleForce * depthInfluence;
        const tangentDirection = particle.velocityX * dy - particle.velocityY * dx >= 0 ? 1 : -1;

        particle.velocityX += nx * force + (-ny) * SETTINGS.obstacleTurn * proximity * tangentDirection;
        particle.velocityY += ny * force + nx * SETTINGS.obstacleTurn * proximity * tangentDirection;
      }
    }

    nearestHexagonDistance(particle) {
      let nearest = Infinity;
      for (let i = 0; i < this.obstacles.length; i += 1) {
        const obstacle = this.obstacles[i];
        const nx = (particle.x - obstacle.centerX) / obstacle.radiusX;
        const ny = (particle.y - obstacle.centerY) / obstacle.radiusY;
        nearest = Math.min(nearest, Math.hypot(nx, ny));
      }
      return nearest;
    }

    updateParticle(particle, deltaSeconds, timeSeconds, activity) {
      particle.previousX = particle.x;
      particle.previousY = particle.y;
      particle.age += deltaSeconds;

      if (particle.age >= particle.life) {
        particle.active = false;
        return;
      }

      const dx = this.pointer.x - particle.x;
      const dy = this.pointer.y - particle.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const pointerFalloff = Math.max(0, 1 - distance / SETTINGS.pointerRadius);
      const pointerInfluence = pointerFalloff * pointerFalloff;

      if (pointerInfluence > 0 && activity > 0.001) {
        particle.velocityX += (dx / distance) * SETTINGS.pointerForce * pointerInfluence * activity * 60 * deltaSeconds;
        particle.velocityY += (dy / distance) * SETTINGS.pointerForce * pointerInfluence * activity * 60 * deltaSeconds;
        particle.velocityX += (-dy / distance) * SETTINGS.pointerSwirl * pointerInfluence * activity * 60 * deltaSeconds;
        particle.velocityY += (dx / distance) * SETTINGS.pointerSwirl * pointerInfluence * activity * 60 * deltaSeconds;
      }

      /* Inexpensive continuous flow field. Combining several waves avoids
         the rigid appearance of one sine curve without requiring a noise
         library or texture download. */
      const flow =
        Math.sin(particle.x * 0.0072 + timeSeconds * 0.86) +
        Math.cos(particle.y * 0.0064 - timeSeconds * 0.62) +
        Math.sin((particle.x + particle.y) * 0.0031 + particle.depthPhase);
      const flowAngle = flow * 1.72 + particle.depthPhase * 0.12;
      particle.velocityX += Math.cos(flowAngle) * SETTINGS.flowStrength * activity * 60 * deltaSeconds;
      particle.velocityY += Math.sin(flowAngle) * SETTINGS.flowStrength * activity * 60 * deltaSeconds;
      particle.velocityY -= 0.006 * activity * 60 * deltaSeconds;

      particle.depthVelocity += Math.sin(timeSeconds * 0.72 + particle.depthPhase) * 0.000055 * activity * 60 * deltaSeconds;
      particle.depthVelocity *= Math.pow(activity > 0.02 ? 0.996 : 0.90, deltaSeconds * 60);
      particle.depth += particle.depthVelocity * activity * deltaSeconds * 60;

      if (particle.depth > 1) {
        particle.depth = 1;
        particle.depthVelocity *= -0.78;
      } else if (particle.depth < -1) {
        particle.depth = -1;
        particle.depthVelocity *= -0.78;
      }

      this.applyHexagonFlow(particle);

      const dragBase = lerp(0.90, 0.982, activity);
      const drag = Math.pow(dragBase, deltaSeconds * 60);
      particle.velocityX *= drag;
      particle.velocityY *= drag;
      particle.x += particle.velocityX * deltaSeconds * 60;
      particle.y += particle.velocityY * deltaSeconds * 60;

      const margin = 120;
      if (
        particle.x < -margin || particle.x > this.width + margin ||
        particle.y < -margin || particle.y > this.height + margin
      ) {
        particle.active = false;
      }
    }

    isVisibleAndRelevant() {
      if (document.hidden) return false;
      if (!this.home.classList.contains("is-active") || this.home.hidden) return false;

      const twinLayer = document.getElementById("twinLayer");
      if (twinLayer && (twinLayer.classList.contains("is-mounted") || twinLayer.classList.contains("is-open"))) {
        return false;
      }

      return true;
    }

    animate(now) {
      if (!this.running) return;
      requestAnimationFrame(this.animate);

      const rawDelta = (now - this.lastFrameAt) / 1000;
      this.lastFrameAt = now;
      const deltaSeconds = clamp(rawDelta || 1 / 60, 1 / 240, 1 / 24);
      const timeSeconds = now / 1000;

      if (!this.isVisibleAndRelevant()) return;

      this.updateObstacles(false);
      const activity = this.pointerActivity(now);
      this.emitAlongPointer(deltaSeconds, now, activity);

      this.backLayer.beginFeedback(timeSeconds, activity);
      this.frontLayer.beginFeedback(timeSeconds, activity);

      for (let i = 0; i < this.maxParticles; i += 1) {
        const particle = this.particles[i];
        if (!particle.active) continue;

        this.updateParticle(particle, deltaSeconds, timeSeconds, activity);
        if (!particle.active) continue;

        const lifeAlpha = particleLifeAlpha(particle);
        /* Most particles remain behind the project cards. Only particles
           with clearly positive depth reach the foreground canvas. */
        const frontWeight = smoothstep(0.18, 0.68, particle.depth);
        const backWeight = 1 - smoothstep(-0.08, 0.48, particle.depth);
        const depthScale = 0.78 + (particle.depth + 1) * 0.19;
        const lifeProgress = particle.age / particle.life;

        /* Smoke is deposited mainly while a particle is young and near the
           interaction region. Old particles remain as tiny points instead
           of painting the whole page. */
        const youngSmoke = 1 - smoothstep(0.36, 0.78, lifeProgress);
        const pointerDistance = Math.hypot(
          particle.x - this.pointer.x,
          particle.y - this.pointer.y
        );
        const localInteraction = lerp(0.18, 1, 1 - smoothstep(170, 520, pointerDistance));

        /* Protect the text-heavy left panel. The particles may cross it,
           but their diffuse plume becomes almost invisible there. */
        const leftSuppression = smoothstep(this.width * 0.30, this.width * 0.53, particle.x);
        const smokeVisibility = lerp(0.08, 1, leftSuppression) * youngSmoke * localInteraction;

        /* Foreground particles can pass over the hexagons, but their broad
           smoke is suppressed over the image faces. This preserves the
           spatial cue without washing out project imagery. */
        const hexDistance = this.nearestHexagonDistance(particle);
        const frontFaceVisibility = lerp(0.10, 1, smoothstep(0.76, 1.16, hexDistance));

        this.backLayer.drawTrail(
          particle,
          lifeAlpha * backWeight * activity,
          SETTINGS.smokeOpacityBack * smokeVisibility,
          depthScale * 0.92
        );
        this.frontLayer.drawTrail(
          particle,
          lifeAlpha * frontWeight * activity,
          SETTINGS.smokeOpacityFront * smokeVisibility * frontFaceVisibility,
          depthScale * 1.02
        );
      }

      this.backLayer.present(
        this.particles,
        this.maxParticles,
        (depth) => 1 - smoothstep(-0.08, 0.48, depth),
        SETTINGS.pointOpacityBack * activity
      );
      this.frontLayer.present(
        this.particles,
        this.maxParticles,
        (depth) => smoothstep(0.18, 0.68, depth),
        SETTINGS.pointOpacityFront * activity
      );
    }
  }

  function initializeSmokeDepth() {
    if (pageIsReducedMotion()) return;

    const home = document.getElementById("view-home");
    const backCanvas = document.getElementById("smokeBack");
    const frontCanvas = document.getElementById("smokeFront");
    if (!home || !backCanvas || !frontCanvas) return;

    try {
      window.DTS_SMOKE_FIELD = new ParticleField(home, backCanvas, frontCanvas);
    } catch (error) {
      /* The main website remains fully usable if canvas initialization is
         unavailable in an unusual browser or constrained webview. */
      console.warn("[DTS smoke] Effect disabled:", error);
      backCanvas.hidden = true;
      frontCanvas.hidden = true;
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeSmokeDepth, { once: true });
  } else {
    initializeSmokeDepth();
  }
})();
