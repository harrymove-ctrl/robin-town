/**
 * src/ui/pixel-post.ts
 *
 * Pixel-art post-processing pass for the 3D board, adapted from
 * docs/diorama-kit/templates/post.js: render the scene to an offscreen target,
 * then quantise it with an 8x8 ordered dither, a 64-colour palette snap and
 * inked luminance contours. Unlike the kit original it keeps a transparent
 * background (the exposure grid / CSS backdrop shows through) and uses the
 * Robin Town palette instead of the kit's paper-and-tile one.
 */

import * as THREE from 'three';

/** 12 hue ramps x 5 shades (dark to light) + 4 accents = exactly 64 colours. */
export const PIXEL_PALETTE_HEX: readonly string[] = Object.freeze([
  // navy backdrop
  '#070a12', '#0b1325', '#14233f', '#1e3358', '#2d4a78',
  // slate / steel
  '#24304a', '#3a4a68', '#5a6b8a', '#8a99b5', '#c3cde0',
  // Robin emerald
  '#004d10', '#007a0c', '#00c805', '#4de05a', '#a6f5ac',
  // bullion gold
  '#5c4a14', '#9a7b20', '#eec353', '#f6d98a', '#fff0c4',
  // ocean cyan
  '#0b4a63', '#127a9e', '#29b6f6', '#7dd3fb', '#c4eeff',
  // sunset coral
  '#5e2415', '#a8401f', '#ff7043', '#ff9d7a', '#ffd0bd',
  // violet
  '#3b1d5c', '#6a35a8', '#a855f7', '#c77dff', '#e6c8ff',
  // lending protocol pink
  '#4a2a3d', '#7a4a65', '#a16586', '#c48fab', '#e6c3d4',
  // DEX teal
  '#164a3a', '#278065', '#39a883', '#7cd3b6', '#c2eddf',
  // staking vault rust
  '#4a2113', '#82391f', '#b85539', '#d98b6e', '#f0c3b0',
  // derivatives blue
  '#243645', '#3b566d', '#587c9a', '#8aaac4', '#c0d4e3',
  // validator olive
  '#2b3a24', '#46603a', '#648454', '#93b484', '#c7ddbd',
  // black, white, beacon red, skin
  '#000000', '#ffffff', '#ff4d4d', '#f1d3b0',
]);

export const PIXEL_PALETTE_RGB: readonly [number, number, number][] = PIXEL_PALETTE_HEX.map((hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
});

const VERT = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const FRAG = /* glsl */ `
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D tScene;
uniform vec2 uResolution;
uniform vec3 uPalette[64];
uniform float uDither;

float bayer2(vec2 a) {
  a = floor(a);
  return fract(a.x * 0.5 + a.y * a.y * 0.75);
}
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
float bayer8(vec2 a) { return bayer4(0.5 * a) * 0.25 + bayer4(a); }
float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

// Scene colour with alpha un-premultiplied (the target blends over transparent black).
vec4 fetch(vec2 uv) {
  vec4 s = texture(tScene, uv);
  return vec4(s.a > 0.0001 ? s.rgb / s.a : vec3(0.0), s.a);
}

void main() {
  // Snap to the texel centre so every output pixel in a chunky block agrees.
  vec2 pixel = floor(vUv * uResolution);
  vec2 uv = (pixel + 0.5) / uResolution;
  vec2 px = 1.0 / uResolution;

  vec4 centre = fetch(uv);
  if (centre.a < 0.01) {
    fragColor = vec4(0.0);
    return;
  }

  // Filmic-ish tone curve, then linear -> display sRGB.
  vec3 c = vec3(1.0) - exp(-centre.rgb * 1.5);
  c = pow(max(c, vec3(0.0)), vec3(1.0 / 2.2));
  float l = luma(c);
  c = mix(vec3(l), c, 1.1);

  // Ink contour from luminance and coverage steps between neighbouring texels.
  float l0 = luma(centre.rgb);
  vec4 n1 = fetch(uv + vec2(px.x, 0.0));
  vec4 n2 = fetch(uv - vec2(px.x, 0.0));
  vec4 n3 = fetch(uv + vec2(0.0, px.y));
  vec4 n4 = fetch(uv - vec2(0.0, px.y));
  float edge = max(
    max(abs(l0 - luma(n1.rgb)), abs(l0 - luma(n2.rgb))),
    max(abs(l0 - luma(n3.rgb)), abs(l0 - luma(n4.rgb)))
  );
  edge = pow(edge, 0.4545);
  // Only ink fully opaque geometry; translucent glow and motes stay soft
  float ink = smoothstep(0.16, 0.38, edge) * smoothstep(0.9, 0.99, centre.a);
  c = mix(c, vec3(0.02, 0.03, 0.05), ink * 0.7);

  // 8x8 ordered dither, then nearest palette snap.
  float d = bayer8(pixel) - 0.5;
  float gate = smoothstep(0.004, 0.06, edge);
  c += d * (0.012 + 0.03 * gate) * uDither;

  vec3 best = uPalette[0];
  float bestD = 1e9;
  for (int i = 0; i < 64; i++) {
    vec3 p = uPalette[i];
    vec3 diff = (c - p) * vec3(1.0, 1.12, 0.93);
    float dd = dot(diff, diff);
    if (dd < bestD) {
      bestD = dd;
      best = p;
    }
  }

  // Premultiplied output for the alpha-composited canvas.
  float a = smoothstep(0.02, 0.6, centre.a);
  fragColor = vec4(best * a, a);
}
`;

/**
 * Offscreen scene target plus a full-screen quantising pass.
 */
export class PixelPost {
  private renderer: THREE.WebGLRenderer;
  private rt: THREE.WebGLRenderTarget;
  private material: THREE.ShaderMaterial;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private pixelSize: number;
  private quadGeom = new THREE.PlaneGeometry(2, 2);

  /** @param pixelSize CSS pixels per output pixel (2 gives chunky pixel art). */
  constructor(renderer: THREE.WebGLRenderer, pixelSize = 2) {
    this.renderer = renderer;
    this.pixelSize = pixelSize;

    this.rt = new THREE.WebGLRenderTarget(2, 2, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: true,
      stencilBuffer: false,
      samples: 0,
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
    });
    this.rt.texture.generateMipmaps = false;

    this.material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        tScene: { value: this.rt.texture },
        uResolution: { value: new THREE.Vector2(2, 2) },
        uPalette: { value: PIXEL_PALETTE_RGB.map((c) => new THREE.Vector3(c[0], c[1], c[2])) },
        uDither: { value: 1.0 },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      toneMapped: false,
    });

    const quad = new THREE.Mesh(this.quadGeom, this.material);
    quad.frustumCulled = false;
    this.scene.add(quad);
  }

  /** Resize the offscreen target for a CSS-pixel viewport. */
  public setSize(width: number, height: number): void {
    const w = Math.max(2, Math.round(width / this.pixelSize));
    const h = Math.max(2, Math.round(height / this.pixelSize));
    this.rt.setSize(w, h);
    this.material.uniforms.uResolution.value.set(w, h);
  }

  public render(scene: THREE.Scene, camera: THREE.Camera): void {
    const r = this.renderer;
    const prevToneMapping = r.toneMapping;
    r.setRenderTarget(this.rt);
    r.setClearColor(0x000000, 0);
    r.clear(true, true, true);
    r.render(scene, camera);
    r.setRenderTarget(null);
    r.setClearColor(0x000000, 0);
    r.clear(true, true, true);
    r.toneMapping = THREE.NoToneMapping;
    r.render(this.scene, this.camera);
    r.toneMapping = prevToneMapping;
  }

  public dispose(): void {
    this.rt.dispose();
    this.material.dispose();
    this.quadGeom.dispose();
  }
}
