/**
 * src/ui/diorama-post.ts
 *
 * Full-screen pixel-art post pass for the 3D board, ported from the diorama
 * kit (docs/diorama-kit/templates/post.js):
 *
 *   - luminance-neighbour edge ink, mixed toward warm near-black at 0.62
 *   - 8x8 ordered Bayer dither, gated to tonal transitions so flat pavement
 *     stays free of speckle
 *   - nearest-colour snap to the 64-colour Robin-Town palette
 *   - rendered at a reduced target resolution and shown with nearest-neighbour
 *     upscaling (the canvas uses `image-rendering: pixelated`)
 *
 * Differences from the kit: the model is composited onto the game's dark
 * backdrop instead of paper white, and there is no cut-out rim fragmentation
 * because the board fills the viewport.
 */

import * as THREE from 'three';
import { PALETTE_RGB } from './diorama-palette';

/** Warm near-black the contour ink is mixed toward (matches the kit). */
export const INK_COLOR: readonly [number, number, number] = [0.085, 0.082, 0.076];
/** Fraction of the ink colour mixed in on a detected contour. */
export const INK_STRENGTH = 0.62;
/** Backdrop the scene is composited onto, as sRGB (#0b0f19). */
export const BACKDROP_SRGB: readonly [number, number, number] = [11 / 255, 15 / 255, 25 / 255];

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
uniform vec3 uBackdrop;
uniform vec3 uInk;
uniform float uInkStrength;
uniform float uDither;

float bayer2(vec2 a) {
  a = floor(a);
  return fract(a.x * 0.5 + a.y * a.y * 0.75);
}
float bayer4(vec2 a) {
  return bayer2(0.5 * a) * 0.25 + bayer2(a);
}
float bayer8(vec2 a) {
  return bayer4(0.5 * a) * 0.25 + bayer4(a);
}
float luma(vec3 c) {
  return dot(c, vec3(0.299, 0.587, 0.114));
}

void main() {
  vec2 px = 1.0 / uResolution;
  vec4 centre = texture(tScene, vUv);
  float cov = centre.a;

  // Composite onto the backdrop, then bring the linear target into display sRGB.
  vec3 c = pow(max(centre.rgb, vec3(0.0)), vec3(1.0 / 2.2));
  c = mix(uBackdrop, c, smoothstep(0.05, 0.6, cov));

  // Gentle grade.
  float l = luma(c);
  c = mix(vec3(l), c, 1.07);
  c = clamp((c - 0.5) * 1.028 + 0.5, 0.0, 1.0);

  // Luminance-neighbour edge ink.
  float l0 = luma(centre.rgb);
  float l1 = luma(texture(tScene, vUv + vec2(px.x, 0.0)).rgb);
  float l2 = luma(texture(tScene, vUv - vec2(px.x, 0.0)).rgb);
  float l3 = luma(texture(tScene, vUv + vec2(0.0, px.y)).rgb);
  float l4 = luma(texture(tScene, vUv - vec2(0.0, px.y)).rgb);
  float edge = max(max(abs(l0 - l1), abs(l0 - l2)), max(abs(l0 - l3), abs(l0 - l4)));
  edge = pow(edge, 0.4545);
  float ink = smoothstep(0.13, 0.34, edge) * smoothstep(0.20, 0.55, cov);
  c = mix(c, uInk, ink * uInkStrength);

  // 8x8 ordered dither, hardest where tones transition; flat areas get none.
  float d = bayer8(gl_FragCoord.xy) - 0.5;
  float gate = smoothstep(0.004, 0.055, edge);
  c += d * (0.0012 + 0.019 * gate) * uDither;

  // Nearest palette colour.
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

  fragColor = vec4(best, 1.0);
}
`;

export interface PixelPostOptions {
  /** CSS pixels per target pixel. 2 gives chunky pixel-art; 1 is full resolution. */
  pixelSize?: number;
  /** Hard ceiling for the longest target edge. */
  maxDim?: number;
  /** 0 disables the dither (tests and flat-colour checks). */
  dither?: number;
}

export class PixelPost {
  public readonly size = new THREE.Vector2(2, 2);
  public readonly uniforms: Record<string, THREE.IUniform>;

  private readonly renderer: THREE.WebGLRenderer;
  private readonly rt: THREE.WebGLRenderTarget;
  private readonly material: THREE.ShaderMaterial;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly pixelSize: number;
  private readonly maxDim: number;

  constructor(renderer: THREE.WebGLRenderer, options: PixelPostOptions = {}) {
    this.renderer = renderer;
    this.pixelSize = Math.max(1, options.pixelSize ?? 2);
    this.maxDim = options.maxDim ?? 1600;

    this.rt = new THREE.WebGLRenderTarget(2, 2, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: true,
      stencilBuffer: false,
      samples: 0,
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      colorSpace: THREE.LinearSRGBColorSpace,
    });
    this.rt.texture.generateMipmaps = false;

    this.uniforms = {
      tScene: { value: this.rt.texture },
      uResolution: { value: new THREE.Vector2(2, 2) },
      uPalette: { value: PALETTE_RGB.map((c) => new THREE.Vector3(c[0], c[1], c[2])) },
      uBackdrop: { value: new THREE.Vector3(...BACKDROP_SRGB) },
      uInk: { value: new THREE.Vector3(...INK_COLOR) },
      uInkStrength: { value: INK_STRENGTH },
      uDither: { value: options.dither ?? 1.0 },
    };

    this.material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: this.uniforms,
      vertexShader: VERT,
      fragmentShader: FRAG,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });

    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    quad.frustumCulled = false;
    this.scene.add(quad);
  }

  /** Target resolution for a CSS size, honouring `pixelSize` and `maxDim`. */
  public targetSize(width: number, height: number): [number, number] {
    const scale = Math.min(1 / this.pixelSize, this.maxDim / Math.max(width, height));
    return [Math.max(2, Math.round(width * scale)), Math.max(2, Math.round(height * scale))];
  }

  public setSize(width: number, height: number): void {
    const [w, h] = this.targetSize(width, height);
    if (w === this.size.x && h === this.size.y) return;
    this.size.set(w, h);
    this.rt.setSize(w, h);
    (this.uniforms.uResolution.value as THREE.Vector2).set(w, h);
    // One drawing-buffer pixel per target pixel; CSS size is controlled by the page.
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(w, h, false);
  }

  public setDither(amount: number): void {
    this.uniforms.uDither.value = amount;
  }

  public render(scene: THREE.Scene, camera: THREE.Camera): void {
    const r = this.renderer;
    r.setRenderTarget(this.rt);
    r.setClearColor(0x000000, 0);
    r.clear(true, true, true);
    r.render(scene, camera);
    r.setRenderTarget(null);
    r.setClearColor(0x000000, 1);
    r.clear(true, true, true);
    r.render(this.scene, this.camera);
  }

  public dispose(): void {
    this.rt.dispose();
    this.material.dispose();
    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
    });
  }
}
