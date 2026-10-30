/**
 * SolaceUI Exposure-Grid Shader Background for Robin-Town (Milestone M7)
 * Pure TypeScript WebGL2 full-screen quad shader with GLSL 300 ES shaders,
 * 22 dynamic uniforms, phase-reactive palettes, DPR clamping, pointer smoothing,
 * context loss recovery, and procedural Canvas2D fallback for headless testing.
 */

export type ExposureGridPhase = 'receive' | 'trade' | 'build' | 'income' | 'ended';
export type ExposureGridTreatment = 'chroma' | 'exposure' | 'monochrome';

export interface PhaseColors {
  grid: [number, number, number];
  accent: [number, number, number];
  secondary: [number, number, number];
  ink: [number, number, number];
  paper: [number, number, number];
}

export interface ExposureGridOptions {
  canvas: HTMLCanvasElement;
  phaseTheme?: ExposureGridPhase;
  intensity?: number;
  columns?: number;
  rows?: number;
  lineWidth?: number;
  lineOpacity?: number;
  activity?: number;
  tempo?: number;
  zoom?: number;
  grain?: number;
  interaction?: number;
  treatment?: ExposureGridTreatment | number;
}

export interface ExposureGridRenderer {
  mount(): void;
  unmount(): void;
  setPhaseTheme(theme: ExposureGridPhase, durationMs?: number): void;
  setIntensity(intensity: number): void;
  setTreatment(treatment: ExposureGridTreatment | number): void;
  resize(width?: number, height?: number): void;
  render(timeSeconds?: number): void;
  getCanvas(): HTMLCanvasElement;
  isWebGL(): boolean;
  loseContextForTesting(): boolean;
  restoreContextForTesting(): boolean;
}

export const PHASE_PALETTES: Record<ExposureGridPhase, PhaseColors> = {
  receive: {
    grid: [0.086, 0.220, 0.141],
    accent: [0.000, 0.784, 0.020],
    secondary: [0.000, 0.902, 0.463],
    ink: [0.020, 0.075, 0.039],
    paper: [0.039, 0.110, 0.071],
  },
  trade: {
    grid: [0.165, 0.133, 0.031],
    accent: [0.933, 0.765, 0.325],
    secondary: [1.000, 0.569, 0.000],
    ink: [0.078, 0.063, 0.012],
    paper: [0.102, 0.086, 0.031],
  },
  build: {
    grid: [0.043, 0.145, 0.200],
    accent: [0.161, 0.714, 0.965],
    secondary: [0.671, 0.278, 0.737],
    ink: [0.016, 0.055, 0.078],
    paper: [0.031, 0.094, 0.133],
  },
  income: {
    grid: [0.039, 0.169, 0.114],
    accent: [0.000, 0.902, 0.463],
    secondary: [1.000, 0.839, 0.000],
    ink: [0.012, 0.071, 0.039],
    paper: [0.024, 0.114, 0.071],
  },
  ended: {
    grid: [0.141, 0.047, 0.180],
    accent: [1.000, 0.000, 0.545],
    secondary: [0.486, 0.302, 1.000],
    ink: [0.059, 0.012, 0.078],
    paper: [0.094, 0.031, 0.133],
  },
};

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

uniform sampler2D u_source;
uniform vec2 u_resolution;
uniform vec2 u_pointer;
uniform float u_pointerStrength;
uniform float u_sourceAspect;
uniform float u_time;
uniform float u_columns;
uniform float u_rows;
uniform float u_lineWidth;
uniform float u_lineOpacity;
uniform float u_activity;
uniform float u_tempo;
uniform float u_intensity;
uniform float u_zoom;
uniform float u_grain;
uniform float u_interaction;
uniform int u_treatment;
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

vec2 coverUv(vec2 uv) {
  float viewportAspect = u_resolution.x / max(u_resolution.y, 1.0);
  if (viewportAspect > u_sourceAspect) {
    uv.y = 0.5 + (uv.y - 0.5) * (u_sourceAspect / viewportAspect);
  } else {
    uv.x = 0.5 + (uv.x - 0.5) * (viewportAspect / u_sourceAspect);
  }
  return clamp(uv, 0.001, 0.999);
}

vec3 sourceAt(vec2 uv) {
  return texture(u_source, coverUv(uv)).rgb;
}

void main() {
  vec2 cells = vec2(max(u_columns, 1.0), max(u_rows, 1.0));
  vec2 cellSpace = v_uv * cells;
  vec2 cellId = floor(cellSpace);
  vec2 local = fract(cellSpace);
  vec2 center = (cellId + 0.5) / cells;
  float seed = hash(cellId + 3.17);
  float totalCells = cells.x * cells.y;
  float cellIndex = cellId.y * cells.x + cellId.x;

  float sequence = u_time * max(u_tempo, 0.0);
  float sequenceIndex = floor(sequence);
  float sequenceLife = fract(sequence);
  float primaryA = floor(hash(vec2(sequenceIndex + 0.71, 8.17)) * totalCells);
  float primaryB = floor(hash(vec2(sequenceIndex + 1.71, 8.17)) * totalCells);
  float primaryMatchA = 1.0 - step(0.1, abs(cellIndex - primaryA));
  float primaryMatchB = 1.0 - step(0.1, abs(cellIndex - primaryB));
  float handoff = smoothstep(0.72, 0.96, sequenceLife);
  float primaryPresence = mix(primaryMatchA, primaryMatchB, handoff);

  float echoIndex = floor(hash(vec2(sequenceIndex + 4.37, 2.91)) * totalCells);
  float echoMatch = 1.0 - step(0.1, abs(cellIndex - echoIndex));
  float echoGate = step(hash(vec2(sequenceIndex + 7.23, 5.14)), u_activity);
  float echoPresence = echoMatch * echoGate * 0.32 * (1.0 - handoff);
  float randomPresence = max(primaryPresence, echoPresence);

  vec2 pointerCell = floor(clamp(u_pointer, 0.0, 0.9999) * cells);
  float pointerCellMatch = 1.0 - step(0.1, length(cellId - pointerCell));
  float focusedPresence = pointerCellMatch * u_pointerStrength * u_interaction;
  float presence = clamp(max(randomPresence * (1.0 - u_pointerStrength * u_interaction), focusedPresence), 0.0, 1.0);

  float scale = 1.0 - u_zoom * (0.055 + seed * 0.035) * presence;
  vec2 direction = vec2(hash(cellId + sequenceIndex + 9.1), hash(cellId - sequenceIndex + 4.2)) - 0.5;
  vec2 sampleUv = center + (v_uv - center) * scale + direction / cells * u_zoom * 0.025 * presence;

  vec3 source = sourceAt(v_uv);
  vec3 sampled = sourceAt(sampleUv);
  float luminance = dot(sampled, vec3(0.299, 0.587, 0.114));
  vec2 sourceTexel = 1.4 / max(u_resolution, vec2(1.0));
  float luminanceX = dot(sourceAt(sampleUv + vec2(sourceTexel.x, 0.0)), vec3(0.299, 0.587, 0.114));
  float luminanceY = dot(sourceAt(sampleUv + vec2(0.0, sourceTexel.y)), vec3(0.299, 0.587, 0.114));
  float relief = clamp((abs(luminance - luminanceX) + abs(luminance - luminanceY)) * 5.5, 0.0, 1.0);

  vec3 treated;
  if (u_treatment == 1) {
    float exposure = mix(0.78, 1.34, seed);
    treated = pow(max(sampled * exposure, 0.0), vec3(mix(1.08, 0.88, seed)));
    treated = mix(treated, u_paper, max(0.0, exposure - 1.0) * 0.08);
  } else if (u_treatment == 2) {
    treated = mix(u_ink, u_paper, smoothstep(0.12, 0.92, luminance));
    treated = mix(treated, sampled, 0.08);
  } else {
    vec2 registration = direction / cells * (0.006 + u_zoom * 0.008);
    vec3 registered = vec3(
      sourceAt(sampleUv + registration).r,
      sampled.g,
      sourceAt(sampleUv - registration).b
    );
    float registeredLuma = dot(registered, vec3(0.299, 0.587, 0.114));
    float surround = (
      dot(sourceAt(sampleUv + vec2(sourceTexel.x * 4.0, 0.0)), vec3(0.299, 0.587, 0.114)) +
      dot(sourceAt(sampleUv - vec2(sourceTexel.x * 4.0, 0.0)), vec3(0.299, 0.587, 0.114)) +
      dot(sourceAt(sampleUv + vec2(0.0, sourceTexel.y * 4.0)), vec3(0.299, 0.587, 0.114)) +
      dot(sourceAt(sampleUv - vec2(0.0, sourceTexel.y * 4.0)), vec3(0.299, 0.587, 0.114))
    ) * 0.25;

    float photographicDetail = clamp((registeredLuma - surround) * 3.2, -0.22, 0.22);
    float tone = smoothstep(0.07, 0.93, registeredLuma + photographicDetail * 1.7 + relief * 0.035);
    float highlight = smoothstep(0.58, 0.98, registeredLuma);
    vec3 shadowInk = mix(u_secondary, u_ink, 0.14);
    vec3 lightInk = mix(u_accent, u_paper, 0.16);
    vec3 inkSeparation = mix(shadowInk, lightInk, tone);
    inkSeparation = mix(inkSeparation, u_paper, highlight * 0.46);

    vec3 multiplyPass = registered * (0.56 + inkSeparation * 0.78);
    vec3 screenPass = 1.0 - (1.0 - registered) * (1.0 - inkSeparation);
    vec3 photographicPass = mix(multiplyPass, screenPass, smoothstep(0.22, 0.78, registeredLuma));
    treated = mix(inkSeparation, photographicPass, 0.48);
    treated *= mix(0.78, 1.1, tone);
    treated += photographicDetail * mix(vec3(0.62), u_paper, 0.24);
    treated += relief * mix(u_secondary, u_accent, tone) * 0.055;
  }

  float stableGrain = hash(gl_FragCoord.xy + cellId * 37.0);
  float paperGrain = (stableGrain - 0.5) * u_grain;
  float raster = sin((gl_FragCoord.x + gl_FragCoord.y) * 1.05) * 0.5 + 0.5;
  treated += paperGrain * vec3(0.1, 0.08, 0.12);
  treated = mix(treated, treated * (0.94 + raster * 0.06), u_grain * 0.28);
  vec3 color = mix(source, treated, presence * u_intensity);

  vec2 edgeDistance = min(local, 1.0 - local);
  vec2 pixelInCell = 1.0 / max(u_resolution / cells, vec2(1.0));
  float verticalLine = 1.0 - smoothstep(0.0, pixelInCell.x * u_lineWidth, edgeDistance.x);
  float horizontalLine = 1.0 - smoothstep(0.0, pixelInCell.y * u_lineWidth, edgeDistance.y);
  float gridLine = max(verticalLine, horizontalLine);
  float verticalGlow = 1.0 - smoothstep(0.0, pixelInCell.x * u_lineWidth * 3.8, edgeDistance.x);
  float horizontalGlow = 1.0 - smoothstep(0.0, pixelInCell.y * u_lineWidth * 3.8, edgeDistance.y);
  float gridGlow = max(verticalGlow, horizontalGlow);

  color = mix(color, u_grid, gridGlow * u_lineOpacity * 0.07);
  color = mix(color, u_grid, gridLine * u_lineOpacity * 0.52);
  color = mix(color, u_paper, gridLine * presence * u_lineOpacity * 0.2);

  float vignette = smoothstep(0.92, 0.28, length((v_uv - 0.5) * vec2(0.72, 1.0)));
  color *= mix(0.96, 1.01, vignette);

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
 * Procedural 2D canvas fallback rendering atmospheric cyber-landscape
 * for headless Node.js tests or devices lacking WebGL2.
 */
export function drawFallback(canvas: HTMLCanvasElement, colors: PhaseColors, intensity = 0.78): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = canvas.width || 800;
  const height = canvas.height || 600;

  ctx.save();
  ctx.clearRect(0, 0, width, height);

  // 1. Multi-stop sky gradient
  const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
  skyGrad.addColorStop(0, rgbToString(colors.paper, 1.0));
  skyGrad.addColorStop(0.4, rgbToString(colors.ink, 1.0));
  skyGrad.addColorStop(1.0, rgbToString(colors.secondary, 0.85));
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, width, height);

  // 2. Ambient celestial glow
  const sunX = width * 0.75;
  const sunY = height * 0.35;
  const sunRadius = Math.min(width, height) * 0.28;
  const sunGrad = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunRadius);
  sunGrad.addColorStop(0, rgbToString(colors.accent, 0.65 * intensity));
  sunGrad.addColorStop(0.5, rgbToString(colors.accent, 0.25 * intensity));
  sunGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = sunGrad;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunRadius, 0, Math.PI * 2);
  ctx.fill();

  // 3. Lower horizon skyline silhouette
  ctx.fillStyle = rgbToString(colors.ink, 0.95);
  ctx.beginPath();
  ctx.moveTo(0, height);
  ctx.lineTo(0, height * 0.72);
  ctx.bezierCurveTo(
    width * 0.25,
    height * 0.68,
    width * 0.45,
    height * 0.82,
    width * 0.7,
    height * 0.7
  );
  ctx.bezierCurveTo(
    width * 0.85,
    height * 0.62,
    width * 0.95,
    height * 0.75,
    width,
    height * 0.72
  );
  ctx.lineTo(width, height);
  ctx.closePath();
  ctx.fill();

  // 4. Subtle tactical grid overlay
  ctx.strokeStyle = rgbToString(colors.grid, 0.25 * intensity);
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
 * Creates an offscreen procedural source texture canvas.
 */
function createProceduralSourceTexture(colors: PhaseColors): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 500;
  drawFallback(canvas, colors, 1.0);
  return canvas;
}

export class ExposureGrid implements ExposureGridRenderer {
  private canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext | null = null;
  private isDisposed = false;
  private isContextLostState = false;
  private animationFrameId: number | null = null;
  private startTime = 0;

  // Options & uniforms
  private phaseTheme: ExposureGridPhase = 'receive';
  private intensity = 0.78;
  private columns = 4.0;
  private rows = 4.0;
  private lineWidth = 2.5;
  private lineOpacity = 0.4;
  private activity = 0.4;
  private tempo = 0.96;
  private zoom = 0.68;
  private grain = 0.68;
  private interaction = 0.82;
  private treatment = 0; // 0=chroma, 1=exposure, 2=monochrome

  // Color transition state
  private currentColors: PhaseColors;
  private startColors: PhaseColors;
  private targetColors: PhaseColors;
  private transitionStartTime = 0;
  private transitionDurationMs = 800;

  // Pointer smoothing state
  private targetPointerX = 0.5;
  private targetPointerY = 0.5;
  private currentPointerX = 0.5;
  private currentPointerY = 0.5;
  private targetPointerStrength = 0.0;
  private currentPointerStrength = 0.0;

  // WebGL handles
  private program: WebGLProgram | null = null;
  private vertexShader: WebGLShader | null = null;
  private fragmentShader: WebGLShader | null = null;
  private vertexBuffer: WebGLBuffer | null = null;
  private texture: WebGLTexture | null = null;
  private uniformLocations: Map<string, WebGLUniformLocation> = new Map();

  // Event handlers
  private onPointerMoveHandler: ((e: PointerEvent | MouseEvent) => void) | null = null;
  private onPointerLeaveHandler: (() => void) | null = null;
  private onContextLostHandler: ((e: Event) => void) | null = null;
  private onContextRestoredHandler: (() => void) | null = null;
  private resizeObserver: ResizeObserver | null = null;

  constructor(options: ExposureGridOptions) {
    this.canvas = options.canvas;
    if (options.phaseTheme && PHASE_PALETTES[options.phaseTheme]) {
      this.phaseTheme = options.phaseTheme;
    }
    if (typeof options.intensity === 'number') this.intensity = options.intensity;
    if (typeof options.columns === 'number') this.columns = options.columns;
    if (typeof options.rows === 'number') this.rows = options.rows;
    if (typeof options.lineWidth === 'number') this.lineWidth = options.lineWidth;
    if (typeof options.lineOpacity === 'number') this.lineOpacity = options.lineOpacity;
    if (typeof options.activity === 'number') this.activity = options.activity;
    if (typeof options.tempo === 'number') this.tempo = options.tempo;
    if (typeof options.zoom === 'number') this.zoom = options.zoom;
    if (typeof options.grain === 'number') this.grain = options.grain;
    if (typeof options.interaction === 'number') this.interaction = options.interaction;

    if (typeof options.treatment === 'number') {
      this.treatment = Math.max(0, Math.min(2, options.treatment));
    } else if (options.treatment === 'exposure') {
      this.treatment = 1;
    } else if (options.treatment === 'monochrome') {
      this.treatment = 2;
    } else {
      this.treatment = 0;
    }

    const initial = PHASE_PALETTES[this.phaseTheme];
    this.currentColors = this.cloneColors(initial);
    this.startColors = this.cloneColors(initial);
    this.targetColors = this.cloneColors(initial);
  }

  private cloneColors(colors: PhaseColors): PhaseColors {
    return {
      grid: [...colors.grid],
      accent: [...colors.accent],
      secondary: [...colors.secondary],
      ink: [...colors.ink],
      paper: [...colors.paper],
    };
  }

  public getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  public isWebGL(): boolean {
    return this.gl !== null && !this.isContextLostState;
  }

  public mount(): void {
    if (this.isDisposed) return;

    this.initWebGL();

    if (!this.gl) {
      // Graceful Canvas2D fallback
      this.resize();
      drawFallback(this.canvas, this.currentColors, this.intensity);
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
      this.isContextLostState = false;

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

      // Cache uniform locations (22 uniforms)
      const uniformNames = [
        'u_source',
        'u_resolution',
        'u_pointer',
        'u_pointerStrength',
        'u_sourceAspect',
        'u_time',
        'u_columns',
        'u_rows',
        'u_lineWidth',
        'u_lineOpacity',
        'u_activity',
        'u_tempo',
        'u_intensity',
        'u_zoom',
        'u_grain',
        'u_interaction',
        'u_treatment',
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

      // Procedural source texture upload
      this.buildSourceTexture();
    } catch {
      this.gl = null;
    }
  }

  private buildSourceTexture(): void {
    const gl = this.gl;
    if (!gl) return;

    const sourceCanvas = createProceduralSourceTexture(this.currentColors);
    if (!sourceCanvas) return;

    if (!this.texture) {
      this.texture = gl.createTexture();
    }
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    try {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        sourceCanvas
      );
    } catch {
      // Safe no-op in headless emulation
    }
  }

  private bindEvents(): void {
    if (typeof window === 'undefined') return;

    this.onPointerMoveHandler = (e: PointerEvent | MouseEvent) => {
      const rect = this.canvas.getBoundingClientRect
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

    this.onContextLostHandler = (e: Event) => {
      e.preventDefault();
      this.isContextLostState = true;
      if (this.animationFrameId !== null) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }
    };

    this.onContextRestoredHandler = () => {
      this.isContextLostState = false;
      this.initWebGL();
      if (this.gl) {
        this.resize();
        this.startLoop();
      }
    };

    this.canvas.addEventListener('pointermove', this.onPointerMoveHandler as EventListener);
    this.canvas.addEventListener('pointerleave', this.onPointerLeaveHandler);
    this.canvas.addEventListener('webglcontextlost', this.onContextLostHandler);
    this.canvas.addEventListener('webglcontextrestored', this.onContextRestoredHandler);

    if (typeof ResizeObserver !== 'undefined' && this.canvas.parentElement) {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.canvas.parentElement);
    }
  }

  private startLoop(): void {
    if (this.animationFrameId !== null || this.isDisposed || this.isContextLostState) return;

    const tick = () => {
      if (this.isDisposed || this.isContextLostState) return;
      this.render();
      if (typeof requestAnimationFrame !== 'undefined') {
        this.animationFrameId = requestAnimationFrame(tick);
      }
    };

    if (typeof requestAnimationFrame !== 'undefined') {
      this.animationFrameId = requestAnimationFrame(tick);
    }
  }

  public setPhaseTheme(theme: ExposureGridPhase, durationMs = 800): void {
    if (!PHASE_PALETTES[theme]) return;
    this.phaseTheme = theme;
    this.startColors = this.cloneColors(this.currentColors);
    this.targetColors = this.cloneColors(PHASE_PALETTES[theme]);
    this.transitionStartTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this.transitionDurationMs = Math.max(1, durationMs);

    if (!this.gl) {
      this.currentColors = this.cloneColors(this.targetColors);
      drawFallback(this.canvas, this.currentColors, this.intensity);
    }
  }

  public setIntensity(intensity: number): void {
    this.intensity = Math.max(0.0, Math.min(2.0, intensity));
    if (!this.gl) {
      drawFallback(this.canvas, this.currentColors, this.intensity);
    }
  }

  public setTreatment(treatment: ExposureGridTreatment | number): void {
    if (typeof treatment === 'number') {
      this.treatment = Math.max(0, Math.min(2, Math.floor(treatment)));
    } else if (treatment === 'exposure') {
      this.treatment = 1;
    } else if (treatment === 'monochrome') {
      this.treatment = 2;
    } else {
      this.treatment = 0;
    }
  }

  public resize(width?: number, height?: number): void {
    const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 1.5) : 1.0;
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

    const displayWidth = Math.max(1, Math.round((w || this.canvas.width || 800) * dpr));
    const displayHeight = Math.max(1, Math.round((h || this.canvas.height || 600) * dpr));

    if (this.canvas.width !== displayWidth || this.canvas.height !== displayHeight) {
      this.canvas.width = displayWidth;
      this.canvas.height = displayHeight;
    }

    if (this.gl && !this.isContextLostState) {
      this.gl.viewport(0, 0, displayWidth, displayHeight);
    }
  }

  public render(timeSeconds?: number): void {
    if (this.isDisposed || this.isContextLostState) return;

    // 1. Advance smooth color interpolation with cubic easing: t * t * (3 - 2 * t)
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (this.transitionStartTime > 0) {
      const elapsed = now - this.transitionStartTime;
      const progress = Math.min(1.0, Math.max(0.0, elapsed / this.transitionDurationMs));
      const t = progress * progress * (3 - 2 * progress);

      for (let i = 0; i < 3; i++) {
        this.currentColors.grid[i] = this.startColors.grid[i] + (this.targetColors.grid[i] - this.startColors.grid[i]) * t;
        this.currentColors.accent[i] = this.startColors.accent[i] + (this.targetColors.accent[i] - this.startColors.accent[i]) * t;
        this.currentColors.secondary[i] = this.startColors.secondary[i] + (this.targetColors.secondary[i] - this.startColors.secondary[i]) * t;
        this.currentColors.ink[i] = this.startColors.ink[i] + (this.targetColors.ink[i] - this.startColors.ink[i]) * t;
        this.currentColors.paper[i] = this.startColors.paper[i] + (this.targetColors.paper[i] - this.startColors.paper[i]) * t;
      }

      if (progress >= 1.0) {
        this.transitionStartTime = 0;
      }
    }

    // 2. Smooth pointer exponential decay
    this.currentPointerX += (this.targetPointerX - this.currentPointerX) * 0.12;
    this.currentPointerY += (this.targetPointerY - this.currentPointerY) * 0.12;
    this.currentPointerStrength += (this.targetPointerStrength - this.currentPointerStrength) * 0.10;

    // 3. Fallback path if no WebGL context
    if (!this.gl) {
      drawFallback(this.canvas, this.currentColors, this.intensity);
      return;
    }

    // 4. WebGL2 Render
    const gl = this.gl;
    const program = this.program;
    if (!program) return;

    gl.useProgram(program);

    const elapsedSeconds = timeSeconds !== undefined
      ? timeSeconds
      : (now - this.startTime) / 1000.0;

    const set1f = (name: string, val: number) => {
      const loc = this.uniformLocations.get(name);
      if (loc) gl.uniform1f(loc, val);
    };
    const set2f = (name: string, x: number, y: number) => {
      const loc = this.uniformLocations.get(name);
      if (loc) gl.uniform2f(loc, x, y);
    };
    const set3fv = (name: string, rgb: [number, number, number]) => {
      const loc = this.uniformLocations.get(name);
      if (loc) gl.uniform3f(loc, rgb[0], rgb[1], rgb[2]);
    };
    const set1i = (name: string, val: number) => {
      const loc = this.uniformLocations.get(name);
      if (loc) gl.uniform1i(loc, val);
    };

    // Bind uniforms (all 22 parameters)
    set1i('u_source', 0);
    set2f('u_resolution', this.canvas.width, this.canvas.height);
    set2f('u_pointer', this.currentPointerX, this.currentPointerY);
    set1f('u_pointerStrength', this.currentPointerStrength);
    set1f('u_sourceAspect', 1.6);
    set1f('u_time', elapsedSeconds);
    set1f('u_columns', this.columns);
    set1f('u_rows', this.rows);
    set1f('u_lineWidth', this.lineWidth);
    set1f('u_lineOpacity', this.lineOpacity);
    set1f('u_activity', this.activity);
    set1f('u_tempo', this.tempo);
    set1f('u_intensity', this.intensity);
    set1f('u_zoom', this.zoom);
    set1f('u_grain', this.grain);
    set1f('u_interaction', this.interaction);
    set1i('u_treatment', this.treatment);
    set3fv('u_grid', this.currentColors.grid);
    set3fv('u_accent', this.currentColors.accent);
    set3fv('u_secondary', this.currentColors.secondary);
    set3fv('u_ink', this.currentColors.ink);
    set3fv('u_paper', this.currentColors.paper);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  public loseContextForTesting(): boolean {
    if (!this.gl) return false;
    const ext = this.gl.getExtension('WEBGL_lose_context');
    if (ext) {
      ext.loseContext();
      this.isContextLostState = true;
      return true;
    }
    this.isContextLostState = true;
    return false;
  }

  public restoreContextForTesting(): boolean {
    if (!this.gl) return false;
    const ext = this.gl.getExtension('WEBGL_lose_context');
    if (ext) {
      ext.restoreContext();
      this.isContextLostState = false;
      return true;
    }
    this.isContextLostState = false;
    return false;
  }

  public unmount(): void {
    this.isDisposed = true;

    if (this.animationFrameId !== null && typeof cancelAnimationFrame !== 'undefined') {
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
      const gl = this.gl;
      if (this.texture) gl.deleteTexture(this.texture);
      if (this.vertexBuffer) gl.deleteBuffer(this.vertexBuffer);
      if (this.program) gl.deleteProgram(this.program);
      if (this.vertexShader) gl.deleteShader(this.vertexShader);
      if (this.fragmentShader) gl.deleteShader(this.fragmentShader);
      this.gl = null;
    }
  }
}
