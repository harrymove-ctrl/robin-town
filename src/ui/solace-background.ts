/**
 * src/ui/solace-background.ts
 *
 * SolaceUI Exposure-Grid WebGL2 Background Shader for Robin-Town.
 * Features:
 * 1. WebGL2 shader program with warm Solace color palette and procedural grid lines.
 * 2. Robust Canvas2D fallback when WebGL2 context is unavailable (headless environments).
 * 3. Resize and devicePixelRatio handling without layout shift (pinned CSS dimensions, CLS = 0).
 * 4. Phase-reactive palette transitions, pointer interaction smoothing, and WebGL context restoration.
 */

export type SolacePhase = 'default' | 'receive' | 'trade' | 'build' | 'income' | 'ended';

export interface SolacePalette {
  grid: [number, number, number];
  accent: [number, number, number];
  secondary: [number, number, number];
  ink: [number, number, number];
  paper: [number, number, number];
}

/**
 * Warm Solace brand palettes with rich amber, terracotta, roasted espresso, and parchment tones.
 */
export const SOLACE_WARM_PALETTES: Record<SolacePhase, SolacePalette> = {
  default: {
    grid: [0.361, 0.239, 0.118],     // Warm bronze grid lines (#5C3D1E)
    accent: [0.984, 0.749, 0.141],   // Radiant warm gold (#FBBF24)
    secondary: [0.918, 0.345, 0.047], // Burnt terracotta (#EA580C)
    ink: [0.059, 0.047, 0.039],       // Roasted dark espresso (#0F0C0A)
    paper: [0.102, 0.086, 0.071],     // Warm parchment dark (#1A1612)
  },
  receive: {
    grid: [0.220, 0.235, 0.118],     // Golden olive grid (#383C1E)
    accent: [0.753, 0.824, 0.188],   // Chartreuse gold accent (#C0D230)
    secondary: [0.851, 0.584, 0.141], // Warm ochre secondary (#D99524)
    ink: [0.047, 0.055, 0.031],       // Deep forest espresso (#0C0E08)
    paper: [0.090, 0.098, 0.067],     // Dark olive parchment (#171911)
  },
  trade: {
    grid: [0.392, 0.196, 0.078],     // Deep ember copper grid (#643214)
    accent: [1.000, 0.647, 0.000],   // Radiant saffron amber (#FFB300)
    secondary: [0.957, 0.318, 0.118], // Blazing terracotta (#F4511E)
    ink: [0.071, 0.035, 0.020],       // Smoked walnut ink (#120905)
    paper: [0.122, 0.075, 0.047],     // Roasted amber parchment (#1F130C)
  },
  build: {
    grid: [0.275, 0.196, 0.314],     // Twilight bronze grid (#463250)
    accent: [0.941, 0.651, 0.255],   // Golden copper accent (#F0A641)
    secondary: [0.678, 0.380, 0.780], // Imperial amethyst (#AD61C7)
    ink: [0.055, 0.035, 0.067],       // Deep obsidian violet ink (#0E0911)
    paper: [0.098, 0.071, 0.118],     // Twilight paper (#19121E)
  },
  income: {
    grid: [0.157, 0.275, 0.196],     // Jade bronze grid (#284632)
    accent: [0.000, 0.863, 0.490],   // Glowing jade emerald (#00DC7D)
    secondary: [0.984, 0.749, 0.141], // Warm gold yield (#FBBF24)
    ink: [0.031, 0.055, 0.039],       // Forest espresso ink (#080E0A)
    paper: [0.067, 0.106, 0.082],     // Emerald parchment (#111B15)
  },
  ended: {
    grid: [0.353, 0.118, 0.235],     // Royal burgundy grid (#5A1E3C)
    accent: [1.000, 0.420, 0.208],   // Flaming coral gold (#FF6B35)
    secondary: [0.804, 0.180, 0.471], // Victory rose secondary (#CD2E78)
    ink: [0.067, 0.024, 0.047],       // Velvet espresso ink (#11060C)
    paper: [0.118, 0.055, 0.086],     // Regal parchment (#1E0E16)
  },
};

export interface SolaceBackgroundOptions {
  canvas: HTMLCanvasElement;
  phase?: SolacePhase;
  intensity?: number;
  columns?: number;
  rows?: number;
  lineWidth?: number;
  lineOpacity?: number;
  maxDpr?: number;
  enablePointerInteraction?: boolean;
}

export interface SolaceBackgroundRenderer {
  mount(): void;
  unmount(): void;
  setPhase(phase: SolacePhase, durationMs?: number): void;
  setIntensity(intensity: number): void;
  resize(width?: number, height?: number): void;
  render(timeSeconds?: number): void;
  getCanvas(): HTMLCanvasElement;
  isWebGL(): boolean;
}

const VERTEX_SHADER_SOURCE = `#version 300 es
in vec2 a_position;
out vec2 v_uv;

void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER_SOURCE = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;

uniform vec2 u_resolution;
uniform vec2 u_pointer;
uniform float u_pointerStrength;
uniform float u_time;
uniform float u_columns;
uniform float u_rows;
uniform float u_lineWidth;
uniform float u_lineOpacity;
uniform float u_intensity;
uniform vec3 u_grid;
uniform vec3 u_accent;
uniform vec3 u_secondary;
uniform vec3 u_ink;
uniform vec3 u_paper;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

void main() {
  vec2 cells = vec2(max(u_columns, 1.0), max(u_rows, 1.0));
  vec2 cellSpace = v_uv * cells;
  vec2 cellId = floor(cellSpace);
  vec2 local = fract(cellSpace);
  vec2 center = (cellId + 0.5) / cells;
  float seed = hash(cellId + 7.19);

  // Solace warm ambient background gradient
  float vertGrad = smoothstep(1.0, 0.0, v_uv.y);
  vec3 bgColor = mix(u_paper, u_ink, vertGrad * 0.72);

  // Subtle celestial sunburst glow in upper quadrant
  vec2 sunPos = vec2(0.78, 0.72);
  float sunDist = length(v_uv - sunPos);
  float sunGlow = smoothstep(0.65, 0.0, sunDist);
  bgColor = mix(bgColor, u_accent, sunGlow * 0.18 * u_intensity);

  // Interactive pointer illumination
  float pointerDist = length(v_uv - u_pointer);
  float pointerGlow = smoothstep(0.42, 0.0, pointerDist) * u_pointerStrength;
  bgColor = mix(bgColor, u_secondary, pointerGlow * 0.22 * u_intensity);

  // Dynamic rhythmic pulse per cell
  float pulse = sin(u_time * 1.8 + seed * 6.28) * 0.5 + 0.5;
  vec3 cellWarmth = mix(u_secondary, u_accent, pulse * 0.5);
  bgColor = mix(bgColor, cellWarmth, pulse * 0.045 * u_intensity);

  // Procedural tactical grid lines
  vec2 edgeDistance = min(local, 1.0 - local);
  vec2 pixelInCell = 1.0 / max(u_resolution / cells, vec2(1.0));
  float verticalLine = 1.0 - smoothstep(0.0, pixelInCell.x * u_lineWidth, edgeDistance.x);
  float horizontalLine = 1.0 - smoothstep(0.0, pixelInCell.y * u_lineWidth, edgeDistance.y);
  float gridLine = max(verticalLine, horizontalLine);

  // Soft grid glow
  float verticalGlow = 1.0 - smoothstep(0.0, pixelInCell.x * u_lineWidth * 3.5, edgeDistance.x);
  float horizontalGlow = 1.0 - smoothstep(0.0, pixelInCell.y * u_lineWidth * 3.5, edgeDistance.y);
  float gridGlow = max(verticalGlow, horizontalGlow);

  vec3 color = bgColor;
  color = mix(color, u_grid, gridGlow * u_lineOpacity * 0.25);
  color = mix(color, u_grid, gridLine * u_lineOpacity * 0.85);
  color = mix(color, u_accent, gridLine * pulse * u_lineOpacity * 0.35);

  // Corner vignette
  float vignette = smoothstep(1.1, 0.35, length((v_uv - 0.5) * vec2(0.85, 1.0)));
  color *= mix(0.92, 1.02, vignette);

  outColor = vec4(color, 1.0);
}
`;

function rgbToString(rgb: [number, number, number], alpha = 1.0): string {
  const r = Math.round(Math.max(0, Math.min(1, rgb[0])) * 255);
  const g = Math.round(Math.max(0, Math.min(1, rgb[1])) * 255);
  const b = Math.round(Math.max(0, Math.min(1, rgb[2])) * 255);
  return alpha >= 1.0 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Robust procedural Canvas2D fallback rendering warm Solace landscape.
 * Executes cleanly in headless Node.js tests or systems without WebGL2.
 */
export function drawSolaceCanvas2DFallback(
  canvas: HTMLCanvasElement,
  palette: SolacePalette,
  intensity = 0.85
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = canvas.width || 800;
  const height = canvas.height || 600;

  ctx.save();
  ctx.clearRect(0, 0, width, height);

  // 1. Warm multi-stop gradient background
  const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
  skyGrad.addColorStop(0, rgbToString(palette.paper, 1.0));
  skyGrad.addColorStop(0.45, rgbToString(palette.ink, 1.0));
  skyGrad.addColorStop(1.0, rgbToString(palette.secondary, 0.80));
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, width, height);

  // 2. Ambient celestial sunburst glow
  const sunX = width * 0.78;
  const sunY = height * 0.30;
  const sunRadius = Math.min(width, height) * 0.32;
  const sunGrad = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunRadius);
  sunGrad.addColorStop(0, rgbToString(palette.accent, 0.65 * intensity));
  sunGrad.addColorStop(0.55, rgbToString(palette.accent, 0.20 * intensity));
  sunGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = sunGrad;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunRadius, 0, Math.PI * 2);
  ctx.fill();

  // 3. Lower skyline horizon silhouette
  ctx.fillStyle = rgbToString(palette.ink, 0.95);
  ctx.beginPath();
  ctx.moveTo(0, height);
  ctx.lineTo(0, height * 0.72);
  ctx.bezierCurveTo(
    width * 0.25,
    height * 0.68,
    width * 0.45,
    height * 0.80,
    width * 0.70,
    height * 0.70
  );
  ctx.bezierCurveTo(
    width * 0.85,
    height * 0.64,
    width * 0.95,
    height * 0.75,
    width,
    height * 0.72
  );
  ctx.lineTo(width, height);
  ctx.closePath();
  ctx.fill();

  // 4. Warm tactical grid overlay
  ctx.strokeStyle = rgbToString(palette.grid, 0.35 * intensity);
  ctx.lineWidth = 1;
  const cols = 8;
  const rows = 6;
  for (let c = 1; c < cols; c++) {
    const x = (width / cols) * c;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let r = 1; r < rows; r++) {
    const y = (height / rows) * r;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * SolaceBackground component delivering the SolaceUI exposure-grid shader background.
 */
export class SolaceBackground implements SolaceBackgroundRenderer {
  private canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext | null = null;
  private isDisposed = false;
  private isContextLost = false;
  private animationFrameId: number | null = null;
  private startTime = 0;

  private phase: SolacePhase = 'default';
  private intensity = 0.85;
  private columns = 6.0;
  private rows = 6.0;
  private lineWidth = 2.0;
  private lineOpacity = 0.55;
  private maxDpr = 1.5;
  private enablePointerInteraction = true;

  private currentPalette: SolacePalette;
  private targetPalette: SolacePalette;
  private startPalette: SolacePalette;
  private transitionStartTime = 0;
  private transitionDurationMs = 800;

  private targetPointerX = 0.5;
  private targetPointerY = 0.5;
  private currentPointerX = 0.5;
  private currentPointerY = 0.5;
  private targetPointerStrength = 0.0;
  private currentPointerStrength = 0.0;

  private program: WebGLProgram | null = null;
  private vertexShader: WebGLShader | null = null;
  private fragmentShader: WebGLShader | null = null;
  private vertexBuffer: WebGLBuffer | null = null;
  private uniformLocations: Map<string, WebGLUniformLocation> = new Map();

  private onPointerMoveHandler: ((e: PointerEvent | MouseEvent) => void) | null = null;
  private onPointerLeaveHandler: (() => void) | null = null;
  private onContextLostHandler: ((e: Event) => void) | null = null;
  private onContextRestoredHandler: (() => void) | null = null;
  private resizeObserver: ResizeObserver | null = null;

  constructor(options: SolaceBackgroundOptions) {
    this.canvas = options.canvas;
    if (options.phase && SOLACE_WARM_PALETTES[options.phase]) {
      this.phase = options.phase;
    }
    if (typeof options.intensity === 'number') this.intensity = options.intensity;
    if (typeof options.columns === 'number') this.columns = options.columns;
    if (typeof options.rows === 'number') this.rows = options.rows;
    if (typeof options.lineWidth === 'number') this.lineWidth = options.lineWidth;
    if (typeof options.lineOpacity === 'number') this.lineOpacity = options.lineOpacity;
    if (typeof options.maxDpr === 'number') this.maxDpr = Math.max(1.0, options.maxDpr);
    if (typeof options.enablePointerInteraction === 'boolean') {
      this.enablePointerInteraction = options.enablePointerInteraction;
    }

    const initial = SOLACE_WARM_PALETTES[this.phase];
    this.currentPalette = this.clonePalette(initial);
    this.targetPalette = this.clonePalette(initial);
    this.startPalette = this.clonePalette(initial);

    this.enforceNoLayoutShiftStyle();
  }

  /**
   * Pins canvas CSS dimensions to eliminate Cumulative Layout Shift (CLS = 0).
   */
  private enforceNoLayoutShiftStyle(): void {
    if (!this.canvas || !this.canvas.style) return;
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.pointerEvents = this.enablePointerInteraction ? 'auto' : 'none';
  }

  private clonePalette(p: SolacePalette): SolacePalette {
    return {
      grid: [...p.grid],
      accent: [...p.accent],
      secondary: [...p.secondary],
      ink: [...p.ink],
      paper: [...p.paper],
    };
  }

  public getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  public isWebGL(): boolean {
    return this.gl !== null && !this.isContextLost;
  }

  public mount(): void {
    if (this.isDisposed) return;
    this.initWebGL();

    if (!this.gl) {
      this.resize();
      drawSolaceCanvas2DFallback(this.canvas, this.currentPalette, this.intensity);
      return;
    }

    this.bindEvents();
    this.resize();
    this.startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this.startLoop();
  }

  private initWebGL(): void {
    if (typeof window === 'undefined' || !this.canvas || typeof this.canvas.getContext !== 'function') {
      this.gl = null;
      return;
    }

    try {
      const gl = this.canvas.getContext('webgl2', {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: false,
      }) as WebGL2RenderingContext | null;

      if (!gl) {
        this.gl = null;
        return;
      }

      this.gl = gl;
      this.isContextLost = false;

      // Compile vertex shader
      const vs = gl.createShader(gl.VERTEX_SHADER);
      if (!vs) return;
      gl.shaderSource(vs, VERTEX_SHADER_SOURCE);
      gl.compileShader(vs);
      if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
        gl.deleteShader(vs);
        this.gl = null;
        return;
      }
      this.vertexShader = vs;

      // Compile fragment shader
      const fs = gl.createShader(gl.FRAGMENT_SHADER);
      if (!fs) return;
      gl.shaderSource(fs, FRAGMENT_SHADER_SOURCE);
      gl.compileShader(fs);
      if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
        gl.deleteShader(fs);
        this.gl = null;
        return;
      }
      this.fragmentShader = fs;

      // Link program
      const program = gl.createProgram();
      if (!program) return;
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        gl.deleteProgram(program);
        this.gl = null;
        return;
      }
      this.program = program;
      gl.useProgram(program);

      // Oversized single triangle geometry
      const vbo = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1.0, -1.0, 3.0, -1.0, -1.0, 3.0]),
        gl.STATIC_DRAW
      );
      this.vertexBuffer = vbo;

      const posLoc = gl.getAttribLocation(program, 'a_position');
      if (posLoc >= 0) {
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
      }

      const uniformNames = [
        'u_resolution',
        'u_pointer',
        'u_pointerStrength',
        'u_time',
        'u_columns',
        'u_rows',
        'u_lineWidth',
        'u_lineOpacity',
        'u_intensity',
        'u_grid',
        'u_accent',
        'u_secondary',
        'u_ink',
        'u_paper',
      ];
      this.uniformLocations.clear();
      for (const name of uniformNames) {
        const loc = gl.getUniformLocation(program, name);
        if (loc) {
          this.uniformLocations.set(name, loc);
        }
      }
    } catch {
      this.gl = null;
    }
  }

  private bindEvents(): void {
    if (typeof window === 'undefined') return;

    if (this.enablePointerInteraction) {
      this.onPointerMoveHandler = (e: PointerEvent | MouseEvent) => {
        const rect = typeof this.canvas.getBoundingClientRect === 'function'
          ? this.canvas.getBoundingClientRect()
          : { left: 0, top: 0, width: this.canvas.width || 800, height: this.canvas.height || 600 };
        const w = Math.max(rect.width, 1);
        const h = Math.max(rect.height, 1);
        this.targetPointerX = (e.clientX - rect.left) / w;
        this.targetPointerY = 1.0 - (e.clientY - rect.top) / h;
        this.targetPointerStrength = 1.0;
      };

      this.onPointerLeaveHandler = () => {
        this.targetPointerStrength = 0.0;
      };

      this.canvas.addEventListener('pointermove', this.onPointerMoveHandler as EventListener);
      this.canvas.addEventListener('pointerleave', this.onPointerLeaveHandler);
    }

    this.onContextLostHandler = (e: Event) => {
      e.preventDefault();
      this.isContextLost = true;
      if (this.animationFrameId !== null) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }
    };

    this.onContextRestoredHandler = () => {
      this.isContextLost = false;
      this.initWebGL();
      if (this.gl) {
        this.resize();
        this.startLoop();
      }
    };

    this.canvas.addEventListener('webglcontextlost', this.onContextLostHandler);
    this.canvas.addEventListener('webglcontextrestored', this.onContextRestoredHandler);

    if (typeof ResizeObserver !== 'undefined' && this.canvas.parentElement) {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.canvas.parentElement);
    }
  }

  private startLoop(): void {
    if (this.animationFrameId !== null || this.isDisposed || this.isContextLost) return;

    const tick = () => {
      if (this.isDisposed || this.isContextLost) return;
      this.render();
      if (typeof requestAnimationFrame !== 'undefined') {
        this.animationFrameId = requestAnimationFrame(tick);
      }
    };

    if (typeof requestAnimationFrame !== 'undefined') {
      this.animationFrameId = requestAnimationFrame(tick);
    }
  }

  public setPhase(phase: SolacePhase, durationMs = 800): void {
    if (!SOLACE_WARM_PALETTES[phase]) return;
    this.phase = phase;
    this.startPalette = this.clonePalette(this.currentPalette);
    this.targetPalette = this.clonePalette(SOLACE_WARM_PALETTES[phase]);
    this.transitionStartTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this.transitionDurationMs = Math.max(1, durationMs);

    if (!this.gl) {
      this.currentPalette = this.clonePalette(this.targetPalette);
      drawSolaceCanvas2DFallback(this.canvas, this.currentPalette, this.intensity);
    }
  }

  public setIntensity(intensity: number): void {
    this.intensity = Math.max(0.0, Math.min(2.0, intensity));
    if (!this.gl) {
      drawSolaceCanvas2DFallback(this.canvas, this.currentPalette, this.intensity);
    }
  }

  public resize(width?: number, height?: number): void {
    const rawDpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1.0;
    const dpr = Math.min(rawDpr, this.maxDpr);

    let w = width;
    let h = height;

    if (w === undefined || h === undefined) {
      if (this.canvas.parentElement && typeof this.canvas.parentElement.getBoundingClientRect === 'function') {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        w = rect.width;
        h = rect.height;
      } else if (typeof this.canvas.getBoundingClientRect === 'function') {
        const rect = this.canvas.getBoundingClientRect();
        w = rect.width;
        h = rect.height;
      }
    }

    const cssWidth = Math.max(1, Math.round(w || this.canvas.width || 800));
    const cssHeight = Math.max(1, Math.round(h || this.canvas.height || 600));

    const bufferWidth = Math.max(1, Math.round(cssWidth * dpr));
    const bufferHeight = Math.max(1, Math.round(cssHeight * dpr));

    if (this.canvas.width !== bufferWidth || this.canvas.height !== bufferHeight) {
      this.canvas.width = bufferWidth;
      this.canvas.height = bufferHeight;
    }

    if (this.gl && !this.isContextLost) {
      this.gl.viewport(0, 0, bufferWidth, bufferHeight);
    }
  }

  public render(timeSeconds?: number): void {
    if (!this.gl || this.isContextLost) {
      if (!this.gl) {
        drawSolaceCanvas2DFallback(this.canvas, this.currentPalette, this.intensity);
      }
      return;
    }

    const gl = this.gl;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const elapsedSeconds = timeSeconds !== undefined ? timeSeconds : (now - this.startTime) / 1000.0;

    // Palette interpolation
    const transitionProgress = Math.min(1.0, (now - this.transitionStartTime) / this.transitionDurationMs);
    const ease = transitionProgress * transitionProgress * (3.0 - 2.0 * transitionProgress);

    for (const key of ['grid', 'accent', 'secondary', 'ink', 'paper'] as (keyof SolacePalette)[]) {
      for (let i = 0; i < 3; i++) {
        this.currentPalette[key][i] =
          this.startPalette[key][i] + (this.targetPalette[key][i] - this.startPalette[key][i]) * ease;
      }
    }

    // Pointer smoothing
    this.currentPointerX += (this.targetPointerX - this.currentPointerX) * 0.12;
    this.currentPointerY += (this.targetPointerY - this.currentPointerY) * 0.12;
    this.currentPointerStrength += (this.targetPointerStrength - this.currentPointerStrength) * 0.10;

    gl.useProgram(this.program);

    const setUniform2f = (name: string, x: number, y: number) => {
      const loc = this.uniformLocations.get(name);
      if (loc) gl.uniform2f(loc, x, y);
    };
    const setUniform1f = (name: string, v: number) => {
      const loc = this.uniformLocations.get(name);
      if (loc) gl.uniform1f(loc, v);
    };
    const setUniform3f = (name: string, v: [number, number, number]) => {
      const loc = this.uniformLocations.get(name);
      if (loc) gl.uniform3f(loc, v[0], v[1], v[2]);
    };

    setUniform2f('u_resolution', this.canvas.width, this.canvas.height);
    setUniform2f('u_pointer', this.currentPointerX, this.currentPointerY);
    setUniform1f('u_pointerStrength', this.currentPointerStrength);
    setUniform1f('u_time', elapsedSeconds);
    setUniform1f('u_columns', this.columns);
    setUniform1f('u_rows', this.rows);
    setUniform1f('u_lineWidth', this.lineWidth);
    setUniform1f('u_lineOpacity', this.lineOpacity);
    setUniform1f('u_intensity', this.intensity);

    setUniform3f('u_grid', this.currentPalette.grid);
    setUniform3f('u_accent', this.currentPalette.accent);
    setUniform3f('u_secondary', this.currentPalette.secondary);
    setUniform3f('u_ink', this.currentPalette.ink);
    setUniform3f('u_paper', this.currentPalette.paper);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  public unmount(): void {
    this.isDisposed = true;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    if (this.onPointerMoveHandler) {
      this.canvas.removeEventListener('pointermove', this.onPointerMoveHandler as EventListener);
      this.onPointerMoveHandler = null;
    }
    if (this.onPointerLeaveHandler) {
      this.canvas.removeEventListener('pointerleave', this.onPointerLeaveHandler);
      this.onPointerLeaveHandler = null;
    }
    if (this.onContextLostHandler) {
      this.canvas.removeEventListener('webglcontextlost', this.onContextLostHandler);
      this.onContextLostHandler = null;
    }
    if (this.onContextRestoredHandler) {
      this.canvas.removeEventListener('webglcontextrestored', this.onContextRestoredHandler);
      this.onContextRestoredHandler = null;
    }

    if (this.gl) {
      if (this.program) this.gl.deleteProgram(this.program);
      if (this.vertexShader) this.gl.deleteShader(this.vertexShader);
      if (this.fragmentShader) this.gl.deleteShader(this.fragmentShader);
      if (this.vertexBuffer) this.gl.deleteBuffer(this.vertexBuffer);
      this.gl = null;
    }
  }
}
