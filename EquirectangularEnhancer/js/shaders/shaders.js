// GLSL ES 3.00 shader sources for the equirectangular enhancement pipeline.
// All working textures use REPEAT wrap on S (horizontal) and CLAMP_TO_EDGE on T
// (vertical), so every texture() sample here automatically wraps across the
// left/right seam and clamps (rather than wraps) at the poles.

export const VERTEX_SRC = `#version 300 es
layout(location = 0) in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const HEAD = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
`;

// Weight that rises toward 1 near the top/bottom edges (the poles) and is 0
// across the equatorial band. vUv.y = 0 and vUv.y = 1 are both "poles" here
// since we don't know a priori which edge is top vs bottom.
const POLE_WEIGHT_FN = `
float poleWeight(float v, float bandStart, float bandEnd) {
  float d = min(v, 1.0 - v); // 0 at pole, 0.5 at equator
  return 1.0 - smoothstep(bandStart, bandEnd, d);
}
`;

export const FRAGMENT_SHADERS = {

  // Simple passthrough / resize (relies on target FBO size + LINEAR filtering
  // to perform down/upsampling).
  copy: `${HEAD}
uniform sampler2D uSrc;
void main() {
  outColor = texture(uSrc, vUv);
}`,

  // Joint bilateral (edge-preserving) denoise, single 5x5 pass.
  bilateralDenoise: `${HEAD}
uniform sampler2D uSrc;
uniform vec2 uTexel;
uniform float uStrength;   // 0..1 overall blend amount
uniform float uSigmaRange; // color-difference sensitivity

void main() {
  vec3 center = texture(uSrc, vUv).rgb;
  if (uStrength <= 0.001) { outColor = vec4(center, 1.0); return; }

  vec3 sum = vec3(0.0);
  float wsum = 0.0;
  const float sigmaSpatial = 1.6;

  for (int j = -2; j <= 2; j++) {
    for (int i = -2; i <= 2; i++) {
      vec2 off = vec2(float(i), float(j)) * uTexel;
      vec3 c = texture(uSrc, vUv + off).rgb;
      float sw = exp(-float(i*i + j*j) / (2.0 * sigmaSpatial * sigmaSpatial));
      vec3 d = c - center;
      float rw = exp(-dot(d, d) / (2.0 * uSigmaRange * uSigmaRange));
      float w = sw * rw;
      sum += c * w;
      wsum += w;
    }
  }
  vec3 filtered = sum / max(wsum, 1e-5);
  outColor = vec4(mix(center, filtered, uStrength), 1.0);
}`,

  // Small fixed-radius separable gaussian blur, horizontal pass.
  // Horizontal wraps naturally via REPEAT texture wrap mode.
  blurH: `${HEAD}
uniform sampler2D uSrc;
uniform vec2 uTexel;
uniform float uSigma;
const int MAX_R = 8;
void main() {
  float sigma = max(uSigma, 0.0001);
  int radius = int(min(float(MAX_R), ceil(sigma * 3.0)));
  vec3 sum = vec3(0.0);
  float wsum = 0.0;
  for (int i = -MAX_R; i <= MAX_R; i++) {
    if (i < -radius || i > radius) continue;
    float w = exp(-float(i*i) / (2.0 * sigma * sigma));
    sum += texture(uSrc, vUv + vec2(float(i) * uTexel.x, 0.0)).rgb * w;
    wsum += w;
  }
  outColor = vec4(sum / max(wsum, 1e-5), 1.0);
}`,

  // Vertical pass — clamps at top/bottom (no polar wraparound).
  blurV: `${HEAD}
uniform sampler2D uSrc;
uniform vec2 uTexel;
uniform float uSigma;
const int MAX_R = 8;
void main() {
  float sigma = max(uSigma, 0.0001);
  int radius = int(min(float(MAX_R), ceil(sigma * 3.0)));
  vec3 sum = vec3(0.0);
  float wsum = 0.0;
  for (int i = -MAX_R; i <= MAX_R; i++) {
    if (i < -radius || i > radius) continue;
    float w = exp(-float(i*i) / (2.0 * sigma * sigma));
    float vy = clamp(vUv.y + float(i) * uTexel.y, 0.0, 1.0);
    sum += texture(uSrc, vec2(vUv.x, vy)).rgb * w;
    wsum += w;
  }
  outColor = vec4(sum / max(wsum, 1e-5), 1.0);
}`,

  // Gray-world / percentile white balance: per-channel multiplicative gain.
  whiteBalance: `${HEAD}
uniform sampler2D uSrc;
uniform vec3 uGain;
void main() {
  vec3 c = texture(uSrc, vUv).rgb;
  outColor = vec4(clamp(c * uGain, 0.0, 1.0), 1.0);
}`,

  // Local contrast enhancement approximating tiled CLAHE via a large-radius
  // (downsample/blur/upsample) low-pass of luminance: boost the
  // high-frequency residual (orig - lowpass) in YCbCr space, leaving chroma
  // untouched, attenuated near the poles.
  localContrast: `${HEAD}
${POLE_WEIGHT_FN}
uniform sampler2D uSrc;
uniform sampler2D uLowpass;
uniform float uStrength;

const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

void main() {
  vec3 c = texture(uSrc, vUv).rgb;
  vec3 lp = texture(uLowpass, vUv).rgb;
  float y = dot(c, LUMA);
  float yLow = dot(lp, LUMA);
  float pw = 1.0 - poleWeight(vUv.y, 0.03, 0.14);
  float boost = uStrength * pw;
  float yNew = y + (y - yLow) * boost;
  float scale = y > 1e-4 ? yNew / y : 1.0;
  vec3 outc = c * mix(1.0, scale, 0.85) + (yNew - y) * 0.15 * LUMA;
  outColor = vec4(clamp(outc, 0.0, 1.0), 1.0);
}`,

  // Latitude-aware unsharp mask.
  sharpen: `${HEAD}
${POLE_WEIGHT_FN}
uniform sampler2D uSrc;
uniform sampler2D uBlurred;
uniform float uAmount;
void main() {
  vec3 c = texture(uSrc, vUv).rgb;
  vec3 b = texture(uBlurred, vUv).rgb;
  float pw = 1.0 - poleWeight(vUv.y, 0.04, 0.16);
  vec3 outc = c + (c - b) * uAmount * pw;
  outColor = vec4(clamp(outc, 0.0, 1.0), 1.0);
}`,

  // Extra smoothing confined to the top/bottom ~5-8% of rows to tame
  // stitching artifacts at the zenith/nadir without softening the rest.
  poleCleanup: `${HEAD}
${POLE_WEIGHT_FN}
uniform sampler2D uSrc;
uniform sampler2D uBlurred;
void main() {
  vec3 c = texture(uSrc, vUv).rgb;
  vec3 b = texture(uBlurred, vUv).rgb;
  float pw = poleWeight(vUv.y, 0.0, 0.06);
  outColor = vec4(mix(c, b, pw * 0.6), 1.0);
}`,

  // Blend a corrective gradient across the left/right wrap seam when the
  // edge columns' average colors mismatch (stitching seam).
  seamBlend: `${HEAD}
uniform sampler2D uSrc;
uniform vec3 uSeamDelta; // colorRight - colorLeft, applied as gradient correction
uniform float uBandWidth; // fraction of image width affected on each side
void main() {
  vec3 c = texture(uSrc, vUv).rgb;
  float x = vUv.x;
  float distLeft = x;             // distance from left edge (x=0)
  float distRight = 1.0 - x;      // distance from right edge (x=1)
  float w = 0.0;
  float sign = 0.0;
  if (distLeft < uBandWidth) {
    float t = 1.0 - (distLeft / uBandWidth);
    w = t; sign = -1.0; // pull left edge toward right's tone
  } else if (distRight < uBandWidth) {
    float t = 1.0 - (distRight / uBandWidth);
    w = t; sign = 1.0; // pull right edge toward left's tone
  }
  vec3 corrected = c + sign * uSeamDelta * w * 0.5;
  outColor = vec4(clamp(corrected, 0.0, 1.0), 1.0);
}`,

  // Adaptive saturation / vibrance boost (HSL-space, luminance-preserving).
  saturation: `${HEAD}
uniform sampler2D uSrc;
uniform float uAmount; // -1..1, positive = more saturated
void main() {
  vec3 c = texture(uSrc, vUv).rgb;
  float maxc = max(c.r, max(c.g, c.b));
  float minc = min(c.r, min(c.g, c.b));
  float l = (maxc + minc) * 0.5;
  // vibrance: less effect on already-saturated pixels
  float sat = maxc - minc;
  float vibrance = uAmount * (1.0 - sat);
  vec3 outc = mix(vec3(l), c, 1.0 + vibrance);
  outColor = vec4(clamp(outc, 0.0, 1.0), 1.0);
}`,

  // Editor Mode's real-time manual adjustment pass: recenter (yaw), exposure,
  // white balance temp/tint, contrast, highlights/shadows, and
  // saturation/vibrance, all in one pass so slider drags stay a single draw
  // call. Denoise and sharpen stay separate multi-pass stages (see
  // glPipeline.js's renderEditorChain) since they need blur neighborhoods.
  editorTone: `${HEAD}
uniform sampler2D uSrc;
uniform float uYawShift;
uniform float uExposure;
uniform float uContrast;
uniform float uHighlights;
uniform float uShadows;
uniform float uTemp;
uniform float uTint;
uniform float uSaturation;
const vec3 LUMA2 = vec3(0.2126, 0.7152, 0.0722);
void main() {
  vec2 uv = vec2(fract(vUv.x + uYawShift), vUv.y);
  vec3 c = texture(uSrc, uv).rgb;

  c *= exp2(uExposure);

  c.r *= (1.0 + uTemp * 0.35) * (1.0 - uTint * 0.15);
  c.g *= (1.0 + uTint * 0.35);
  c.b *= (1.0 - uTemp * 0.35) * (1.0 - uTint * 0.15);

  c = (c - 0.5) * (1.0 + uContrast) + 0.5;

  float y = dot(c, LUMA2);
  float hiMask = smoothstep(0.45, 1.0, y);
  float loMask = 1.0 - smoothstep(0.0, 0.55, y);
  c += uHighlights * hiMask * 0.4;
  c += uShadows * loMask * 0.4;

  float maxc = max(c.r, max(c.g, c.b));
  float minc = min(c.r, min(c.g, c.b));
  float l = (maxc + minc) * 0.5;
  float sat = maxc - minc;
  float vibrance = uSaturation * (1.0 - sat);
  c = mix(vec3(l), c, 1.0 + vibrance);

  outColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`,

  // Bicubic (Catmull-Rom) upscale into a larger target framebuffer.
  bicubicUpscale: `${HEAD}
uniform sampler2D uSrc;
uniform vec2 uSrcSize;

vec4 cubicWeights(float t) {
  float t2 = t * t;
  float t3 = t2 * t;
  float w0 = -0.5*t3 + t2 - 0.5*t;
  float w1 =  1.5*t3 - 2.5*t2 + 1.0;
  float w2 = -1.5*t3 + 2.0*t2 + 0.5*t;
  float w3 =  0.5*t3 - 0.5*t2;
  return vec4(w0, w1, w2, w3);
}

void main() {
  vec2 texel = 1.0 / uSrcSize;
  vec2 pos = vUv * uSrcSize - 0.5;
  vec2 fpos = floor(pos);
  vec2 frac = pos - fpos;

  vec4 wx = cubicWeights(frac.x);
  vec4 wy = cubicWeights(frac.y);

  vec3 result = vec3(0.0);
  for (int j = -1; j <= 2; j++) {
    vec3 rowSum = vec3(0.0);
    for (int i = -1; i <= 2; i++) {
      vec2 samplePos = (fpos + vec2(float(i), float(j)) + 0.5) * texel;
      // wrap horizontally, clamp vertically
      samplePos.x = fract(samplePos.x);
      samplePos.y = clamp(samplePos.y, 0.0, 1.0);
      float wgt = (i == -1 ? wx.x : i == 0 ? wx.y : i == 1 ? wx.z : wx.w);
      rowSum += texture(uSrc, samplePos).rgb * wgt;
    }
    float wgt = (j == -1 ? wy.x : j == 0 ? wy.y : j == 1 ? wy.z : wy.w);
    result += rowSum * wgt;
  }
  outColor = vec4(clamp(result, 0.0, 1.0), 1.0);
}`,

};
