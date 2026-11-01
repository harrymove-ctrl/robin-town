import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CELL_SIZE, PLOT_LAYOUT } from '../board-layout';
import { SHOPS, groups } from '../engine';
import { createNeighborhoodWorld3D } from './neighborhood-world';
import {
  animatePlotSlot3D,
  createPlotSlot3D,
  disposePlotSlot3D,
  updatePlotSlot3D,
} from './shop-models-3d';
import {
  BOARD_2D_H,
  BOARD_2D_W,
  EMPTY_CLUSTER_CONNECTIONS,
  boardRectToWorld,
  computePlotClusterConnections,
  getPlotStreetFacingYaw,
  type CameraPresetMode,
  type City3DRenderParams,
  type CityAtmosphereMode,
  type NeighborhoodWorldHandle,
  type PlotSlot3D,
  type PlotVisualState,
  type RobinCity3DOptions,
} from './types-3d';

const CAMERA_FOV_DEG = 38;
const CAMERA_NEAR = 10;
const CAMERA_FAR = 5200;

const MIN_ELEVATION = 0.3;
const MAX_ELEVATION = 1.48;
const MIN_RADIUS = 320;
const MAX_RADIUS = 1650;

const PAN_LIMIT_X = 560;
const PAN_LIMIT_Z = 380;

const CLICK_TRAVEL_LIMIT_PX = 6;
const TOUCH_CLICK_TRAVEL_LIMIT_PX = 10;
const ORBIT_SENSITIVITY = 0.0054;
const GROUND_PICK_Y = 1.5;

export type TouchDragMode = 'pan' | 'orbit';
type DragMode = 'orbit' | 'pan' | 'pinch' | null;

interface PointerSample {
  x: number;
  y: number;
}

function canCreateWebGLContext(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }
  try {
    const probe = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
        (probe.getContext('webgl2') ||
          probe.getContext('webgl') ||
          probe.getContext('experimental-webgl')),
    );
  } catch {
    return false;
  }
}

function createInitialVisualState(lotId: number): PlotVisualState {
  const layout = PLOT_LAYOUT[lotId];
  return {
    lotId,
    displayNumber: lotId + 1,
    districtIndex: layout ? layout.block : Math.floor(lotId / 12),
    owner: null,
    shop: null,
    isOffered: false,
    isChosen: false,
    isSelected: false,
    isHovered: false,
    isDropTarget: false,
    isBuildable: false,
    clusterSize: 0,
    targetSize: 0,
    isComplete: false,
    streetYaw: getPlotStreetFacingYaw(lotId),
    connectedMask: EMPTY_CLUSTER_CONNECTIONS,
    isClusterFlagship: true,
    atmosphere: 'day',
  };
}

export class RobinCity3DRenderer {
  private readonly options: RobinCity3DOptions;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly lightingGroup: THREE.Group;
  private readonly plotGroup: THREE.Group;
  private readonly raycaster = new THREE.Raycaster();
  private readonly groundPickPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -GROUND_PICK_Y);
  private readonly rayHitPoint = new THREE.Vector3();
  private readonly ndcPoint = new THREE.Vector2();

  private renderer: THREE.WebGLRenderer | null = null;
  private envRenderTarget: THREE.WebGLRenderTarget | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private resizeObserver: ResizeObserver | null = null;

  private hemiLight: THREE.HemisphereLight | null = null;
  private sunLight: THREE.DirectionalLight | null = null;
  private riverRimLight: THREE.DirectionalLight | null = null;
  private atmosphere: CityAtmosphereMode;

  private neighborhoodWorld: NeighborhoodWorldHandle | null = null;
  private plotSlots: PlotSlot3D[] = [];
  private visualStates: PlotVisualState[] = [];

  private width: number;
  private height: number;
  private worldBuilt = false;
  private isMounted = false;
  private isPaused = true;
  private rafId: number | null = null;
  private lastFrameMs = 0;
  private elapsedSec = 0;

  private cameraPreset: CameraPresetMode;
  private readonly cameraTarget = new THREE.Vector3(0, 4, 12);
  private readonly desiredTarget = new THREE.Vector3(0, 4, 10);
  private currentAzimuth = -0.06;
  private currentElevation = 0.88;
  private currentRadius = 1280;
  private desiredAzimuth = -0.06;
  private desiredElevation = 0.88;
  private desiredRadius = 1280;
  private hasCustomZoom = false;

  private focusedLotId: number | null = null;
  private readonly focusedLotWorldPos = new THREE.Vector3(0, 8, 25);

  private selectedLotId: number | null = null;
  private hoveredLotId: number | null = null;
  private dropTargetLotId: number | null = null;

  private readonly activePointers = new Map<number, PointerSample>();
  private touchDragMode: TouchDragMode = 'pan';
  private dragMode: DragMode = null;
  private primaryPointerId: number | null = null;
  private pointerDownPos: PointerSample = { x: 0, y: 0 };
  private lastDragPos: PointerSample = { x: 0, y: 0 };
  private pointerTravelPx = 0;
  private pinchStartDistance = 1;
  private pinchStartRadius = 1280;
  private pinchLastMidpoint: PointerSample = { x: 0, y: 0 };
  private pinchLastAngle = 0;

  private readonly onFrameBound: (nowMs: number) => void;
  private readonly onPointerDownBound: (event: PointerEvent) => void;
  private readonly onPointerMoveBound: (event: PointerEvent) => void;
  private readonly onPointerUpBound: (event: PointerEvent) => void;
  private readonly onPointerCancelBound: (event: PointerEvent) => void;
  private readonly onPointerLeaveBound: () => void;
  private readonly onWheelBound: (event: WheelEvent) => void;
  private readonly onContextMenuBound: (event: MouseEvent) => void;
  private readonly onWindowResizeBound: () => void;

  constructor(options: RobinCity3DOptions) {
    this.options = options;

    const initialSize = this.resolveInitialSize(options);
    this.width = initialSize.width;
    this.height = initialSize.height;

    this.scene = new THREE.Scene();
    this.scene.name = 'RobinCity3DScene';
    this.scene.background = new THREE.Color(0xcae6f4);
    this.scene.fog = new THREE.FogExp2(0xdfeef5, 0.00014);
    this.atmosphere = options.initialAtmosphere ?? 'day';

    this.camera = new THREE.PerspectiveCamera(
      this.computeCameraFov(),
      this.width / Math.max(1, this.height),
      CAMERA_NEAR,
      CAMERA_FAR,
    );
    this.camera.up.set(0, 1, 0);

    this.lightingGroup = new THREE.Group();
    this.lightingGroup.name = 'RobinWarmDaylightRig';

    this.plotGroup = new THREE.Group();
    this.plotGroup.name = 'RobinPlotSlotsGroup';

    this.cameraPreset = options.initialPreset ?? 'neighborhood';
    this.applyPresetTargets(this.cameraPreset, true);

    this.onFrameBound = (nowMs: number) => this.tick(nowMs);
    this.onPointerDownBound = (event: PointerEvent) => this.handlePointerDown(event);
    this.onPointerMoveBound = (event: PointerEvent) => this.handlePointerMove(event);
    this.onPointerUpBound = (event: PointerEvent) => this.handlePointerUp(event);
    this.onPointerCancelBound = (event: PointerEvent) => this.handlePointerCancel(event);
    this.onPointerLeaveBound = () => this.handlePointerLeave();
    this.onWheelBound = (event: WheelEvent) => this.handleWheel(event);
    this.onContextMenuBound = (event: MouseEvent) => event.preventDefault();
    this.onWindowResizeBound = () => this.syncSizeFromContainer();

    this.ensureWorldBuilt();
  }

  public mount(): void {
    this.ensureWorldBuilt();

    if (this.isMounted) {
      this.resume();
      return;
    }

    this.syncSizeFromContainer();
    this.isMounted = true;

    if (canCreateWebGLContext()) {
      try {
        const glRenderer = new THREE.WebGLRenderer({
          antialias: true,
          powerPreference: 'high-performance',
        });
        const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
        glRenderer.setPixelRatio(dpr);
        glRenderer.setSize(this.width, this.height, false);
        glRenderer.outputColorSpace = THREE.SRGBColorSpace;
        glRenderer.toneMapping = THREE.ACESFilmicToneMapping;
        glRenderer.toneMappingExposure = 1.12;
        glRenderer.shadowMap.enabled = true;
        glRenderer.shadowMap.type = THREE.PCFSoftShadowMap;

        try {
          const pmrem = new THREE.PMREMGenerator(glRenderer);
          pmrem.compileEquirectangularShader();
          const roomEnv = new RoomEnvironment();
          this.envRenderTarget = pmrem.fromScene(roomEnv, 0.04);
          this.scene.environment = this.envRenderTarget.texture;
          roomEnv.dispose();
          pmrem.dispose();
        } catch {
          this.envRenderTarget = null;
        }

        this.renderer = glRenderer;
        this.canvas = glRenderer.domElement;
        this.applyAtmosphereLighting(this.atmosphere);
      } catch {
        this.renderer = null;
        this.canvas = null;
      }
    }

    if (!this.canvas && typeof document !== 'undefined' && typeof document.createElement === 'function') {
      try {
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.width;
        this.canvas.height = this.height;
      } catch {
        this.canvas = null;
      }
    }

    if (this.canvas) {
      this.canvas.className = 'robin-city-3d-canvas';
      this.canvas.style.display = 'block';
      this.canvas.style.width = '100%';
      this.canvas.style.height = '100%';
      this.canvas.style.touchAction = 'none';
      this.canvas.style.userSelect = 'none';
      this.canvas.style.cursor = 'grab';

      if (this.options.container && typeof this.options.container.appendChild === 'function') {
        this.options.container.appendChild(this.canvas);
      }

      this.attachDomListeners(this.canvas);
    }

    this.isPaused = false;
    this.lastFrameMs = 0;

    if (this.renderer) {
      this.renderer.render(this.scene, this.camera);
      this.startLoop();
    }
  }

  public unmount(): void {
    this.pause();
    this.isMounted = false;
    this.activePointers.clear();
    this.dragMode = null;
    this.primaryPointerId = null;

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
      window.removeEventListener('resize', this.onWindowResizeBound);
    }

    if (this.canvas) {
      this.detachDomListeners(this.canvas);
      if (this.canvas.parentElement) {
        this.canvas.parentElement.removeChild(this.canvas);
      }
      this.canvas = null;
    }

    if (this.neighborhoodWorld) {
      this.scene.remove(this.neighborhoodWorld.group);
      this.neighborhoodWorld.dispose();
      this.neighborhoodWorld = null;
    }

    for (const slot of this.plotSlots) {
      this.plotGroup.remove(slot.root);
      disposePlotSlot3D(slot);
    }
    this.plotSlots = [];
    this.visualStates = [];
    this.scene.remove(this.plotGroup);

    this.lightingGroup.clear();
    this.hemiLight = null;
    this.sunLight = null;
    this.riverRimLight = null;
    this.scene.remove(this.lightingGroup);

    this.scene.environment = null;
    if (this.envRenderTarget) {
      this.envRenderTarget.dispose();
      this.envRenderTarget = null;
    }

    this.worldBuilt = false;

    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }
  }

  public pause(): void {
    this.isPaused = true;
    if (this.rafId !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  public resume(): void {
    if (!this.isMounted) {
      return;
    }
    this.isPaused = false;
    this.lastFrameMs = 0;
    if (this.renderer && this.rafId === null) {
      this.startLoop();
    }
  }

  public resize(width: number, height: number): void {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      return;
    }

    this.width = Math.max(1, Math.round(width));
    this.height = Math.max(1, Math.round(height));

    this.camera.fov = this.computeCameraFov();
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();

    if (this.renderer) {
      const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
      this.renderer.setPixelRatio(dpr);
      this.renderer.setSize(this.width, this.height, false);
    } else if (this.canvas) {
      this.canvas.width = this.width;
      this.canvas.height = this.height;
    }

    if (!this.hasCustomZoom) {
      if (this.focusedLotId === null) {
        this.applyPresetTargets(this.cameraPreset, !this.renderer || this.isPaused);
      } else {
        this.desiredRadius = this.radiusForPreset(this.cameraPreset);
        if (!this.renderer || this.isPaused) {
          this.currentRadius = this.desiredRadius;
        }
      }
    } else {
      this.desiredRadius = THREE.MathUtils.clamp(this.desiredRadius, MIN_RADIUS, MAX_RADIUS);
    }

    this.applyCameraTransform();
    if (this.renderer && this.isPaused) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  public setCameraPreset(preset: CameraPresetMode): void {
    this.cameraPreset = preset;
    this.hasCustomZoom = false;
    if (preset !== 'street') {
      this.focusedLotId = null;
    }
    const snapImmediate = !this.renderer || this.isPaused;
    this.applyPresetTargets(preset, snapImmediate);
  }

  public getCameraPreset(): CameraPresetMode {
    return this.cameraPreset;
  }

  public setTouchDragMode(mode: TouchDragMode): void {
    this.touchDragMode = mode;
  }

  public getTouchDragMode(): TouchDragMode {
    return this.touchDragMode;
  }

  public setAtmosphere(mode: CityAtmosphereMode): void {
    this.atmosphere = mode;
    this.ensureWorldBuilt();
    this.applyAtmosphereLighting(mode);
    this.neighborhoodWorld?.setAtmosphere?.(mode);

    for (let i = 0; i < this.plotSlots.length; i++) {
      const existing = this.visualStates[i];
      if (!existing) continue;
      const updated: PlotVisualState = {
        ...existing,
        atmosphere: mode,
      };
      this.visualStates[i] = updated;
      updatePlotSlot3D(this.plotSlots[i]!, updated);
    }

    if (this.renderer && this.isPaused) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  public getAtmosphere(): CityAtmosphereMode {
    return this.atmosphere;
  }

  public resetCamera(): void {
    this.focusedLotId = null;
    this.hasCustomZoom = false;
    const snapImmediate = !this.renderer || this.isPaused;
    this.applyPresetTargets(this.cameraPreset, snapImmediate);
  }

  public focusLot(lotId: number): void {
    if (!Number.isInteger(lotId) || lotId < 0 || lotId >= PLOT_LAYOUT.length) {
      return;
    }
    const plot = PLOT_LAYOUT[lotId];
    if (!plot) {
      return;
    }

    const [wx, , wz] = boardRectToWorld(plot.x, plot.y, CELL_SIZE, CELL_SIZE, 0);
    const clampedX = THREE.MathUtils.clamp(wx, -PAN_LIMIT_X, PAN_LIMIT_X);
    const clampedZ = THREE.MathUtils.clamp(wz, -PAN_LIMIT_Z, PAN_LIMIT_Z);

    this.focusedLotId = lotId;
    this.focusedLotWorldPos.set(clampedX, 8, clampedZ);

    const targetY = this.cameraPreset === 'street' ? 8 : this.cameraPreset === 'topdown' ? 0 : 4;
    this.desiredTarget.set(clampedX, targetY, clampedZ);

    if (!this.renderer || this.isPaused) {
      this.cameraTarget.copy(this.desiredTarget);
      this.applyCameraTransform();
    }
  }

  public projectLotToScreen(
    lotId: number,
    liftY = 26,
  ): { x: number; y: number } | null {
    if (!this.worldBuilt || lotId < 0 || lotId >= PLOT_LAYOUT.length) {
      return null;
    }
    const rect = this.getViewportRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return null;
    }
    const plot = PLOT_LAYOUT[lotId];
    const [wx, , wz] = boardRectToWorld(plot.x, plot.y, CELL_SIZE, CELL_SIZE, 0);
    const vec = new THREE.Vector3(wx, liftY, wz);
    this.camera.updateMatrixWorld(true);
    vec.project(this.camera);
    if (vec.z < -1 || vec.z > 1) {
      return null;
    }
    return {
      x: rect.left + (vec.x * 0.5 + 0.5) * rect.width,
      y: rect.top + (-vec.y * 0.5 + 0.5) * rect.height,
    };
  }

  public pickLotAtClientPoint(clientX: number, clientY: number): number | null {
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY) || !this.worldBuilt) {
      return null;
    }

    const rect = this.getViewportRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return null;
    }

    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    if (localX < 0 || localX > rect.width || localY < 0 || localY > rect.height) {
      return null;
    }

    this.ndcPoint.set((localX / rect.width) * 2 - 1, -(localY / rect.height) * 2 + 1);

    this.camera.updateMatrixWorld(true);
    this.plotGroup.updateMatrixWorld(true);
    this.raycaster.setFromCamera(this.ndcPoint, this.camera);

    const roots: THREE.Object3D[] = [];
    for (let i = 0; i < this.plotSlots.length; i++) {
      roots.push(this.plotSlots[i].root);
    }

    const hits = this.raycaster.intersectObjects(roots, true);
    for (const hit of hits) {
      const resolved = this.resolveLotIdFromObject(hit.object);
      if (resolved !== null) {
        return resolved;
      }
    }

    // Fallback ground-plane check at y = 1.5 across all 72 [plot.x, plot.x + 50] x [plot.y, plot.y + 50] cells
    const planeHit = this.raycaster.ray.intersectPlane(this.groundPickPlane, this.rayHitPoint);
    if (planeHit) {
      const bx = planeHit.x + BOARD_2D_W / 2;
      const by = planeHit.z + BOARD_2D_H / 2;
      for (let i = 0; i < PLOT_LAYOUT.length; i++) {
        const plot = PLOT_LAYOUT[i];
        if (
          bx >= plot.x &&
          bx <= plot.x + CELL_SIZE &&
          by >= plot.y &&
          by <= plot.y + CELL_SIZE
        ) {
          return plot.id;
        }
      }
    }

    return null;
  }

  public setDropTargetLot(lotId: number | null): void {
    const normalized =
      lotId !== null && Number.isInteger(lotId) && lotId >= 0 && lotId < PLOT_LAYOUT.length
        ? lotId
        : null;

    if (this.dropTargetLotId === normalized) {
      return;
    }

    const previous = this.dropTargetLotId;
    this.dropTargetLotId = normalized;

    this.refreshSinglePlotFlag(previous);
    this.refreshSinglePlotFlag(normalized);
  }

  public render(params: City3DRenderParams): void {
    this.ensureWorldBuilt();

    const { state } = params;
    this.selectedLotId = params.selectedLot ?? null;

    const clusterSizeByLot = new Int16Array(PLOT_LAYOUT.length);
    const clusterLotsByLot: Array<readonly number[] | undefined> = new Array(PLOT_LAYOUT.length);
    for (let playerIndex = 0; playerIndex < state.players.length; playerIndex++) {
      const playerGroups = groups(state, playerIndex);
      for (const group of playerGroups) {
        for (const id of group.lots) {
          if (id >= 0 && id < clusterSizeByLot.length) {
            clusterSizeByLot[id] = group.size;
            clusterLotsByLot[id] = group.lots;
          }
        }
      }
    }

    const offeredSet = new Set<number>(state.phase === 'receive' ? state.pending : []);
    const chosenSet = new Set<number>(params.chosenLots ?? []);
    if (state.phase === 'trade') {
      if (params.tradeGiveLots) {
        for (const id of params.tradeGiveLots) chosenSet.add(id);
      }
      if (params.tradeTakeLots) {
        for (const id of params.tradeTakeLots) chosenSet.add(id);
      }
    }

    const hasSelectedShop = params.selectedShop !== null && params.selectedShop !== undefined;

    for (let lotId = 0; lotId < this.plotSlots.length; lotId++) {
      const slot = this.plotSlots[lotId];
      const layout = PLOT_LAYOUT[lotId];
      const lot = state.lots[lotId];
      const owner = lot ? lot.owner : null;
      const shop = lot ? lot.shop : null;

      let clusterSize = 0;
      let targetSize = 0;
      let isComplete = false;

      if (shop !== null && SHOPS[shop]) {
        targetSize = SHOPS[shop].size;
        clusterSize = Math.max(1, clusterSizeByLot[lotId] || 1);
        isComplete = clusterSize >= targetSize;
      }

      const isBuildable =
        state.phase === 'build' && owner === 0 && shop === null && hasSelectedShop;
      const clusterLots = shop !== null ? clusterLotsByLot[lotId] : undefined;
      const streetYaw = getPlotStreetFacingYaw(lotId, clusterLots);
      const { mask: connectedMask, isFlagship: isClusterFlagship } =
        computePlotClusterConnections(lotId, clusterLots);

      const visualState: PlotVisualState = {
        lotId,
        displayNumber: lotId + 1,
        districtIndex: layout ? layout.block : Math.floor(lotId / 12),
        owner,
        shop,
        isOffered: offeredSet.has(lotId),
        isChosen: chosenSet.has(lotId),
        isSelected: this.selectedLotId === lotId,
        isHovered: this.hoveredLotId === lotId,
        isDropTarget: this.dropTargetLotId === lotId,
        isBuildable,
        clusterSize,
        targetSize,
        isComplete,
        streetYaw,
        connectedMask,
        isClusterFlagship,
        atmosphere: this.atmosphere,
      };

      this.visualStates[lotId] = visualState;
      updatePlotSlot3D(slot, visualState);
    }

    if (this.renderer && this.isPaused) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  public getScene(): THREE.Scene {
    return this.scene;
  }

  public getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  public getPlotSlot(lotId: number): PlotSlot3D | undefined {
    if (!Number.isInteger(lotId) || lotId < 0 || lotId >= this.plotSlots.length) {
      return undefined;
    }
    return this.plotSlots[lotId];
  }

  private ensureWorldBuilt(): void {
    if (this.worldBuilt) {
      return;
    }

    this.setupLightingRig();
    this.scene.add(this.lightingGroup);

    const world: NeighborhoodWorldHandle = createNeighborhoodWorld3D();
    world.setAtmosphere?.(this.atmosphere);
    this.neighborhoodWorld = world;
    this.scene.add(world.group);

    this.plotSlots = [];
    this.visualStates = [];
    for (let lotId = 0; lotId < PLOT_LAYOUT.length; lotId++) {
      const districtIndex = PLOT_LAYOUT[lotId]?.block ?? Math.floor(lotId / 12);
      const slot = createPlotSlot3D(lotId, districtIndex);
      slot.root.userData.lotId = lotId;
      const initialState = createInitialVisualState(lotId);
      initialState.atmosphere = this.atmosphere;
      this.plotSlots.push(slot);
      this.visualStates.push(initialState);
      this.plotGroup.add(slot.root);
    }
    this.scene.add(this.plotGroup);

    this.applyCameraTransform();
    this.worldBuilt = true;
  }

  private setupLightingRig(): void {
    this.lightingGroup.clear();

    // Warm cream sky with soft jade ground bounce so shadows stay legible and sunny
    const hemiLight = new THREE.HemisphereLight(0xfff8e6, 0x6c8566, 1.18);
    hemiLight.name = 'RobinHemisphereLight';
    hemiLight.position.set(0, 520, 0);
    this.hemiLight = hemiLight;

    // Main golden-hour sunlight casting crisp 2048x2048 soft shadows across the 1100x730 island
    const sunLight = new THREE.DirectionalLight(0xfff1cf, 1.68);
    sunLight.name = 'RobinMainSunLight';
    sunLight.position.set(-320, 680, 420);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    sunLight.shadow.camera.left = -640;
    sunLight.shadow.camera.right = 640;
    sunLight.shadow.camera.top = 460;
    sunLight.shadow.camera.bottom = -460;
    sunLight.shadow.camera.near = 120;
    sunLight.shadow.camera.far = 1500;
    sunLight.shadow.bias = -0.0004;
    sunLight.shadow.normalBias = 0.02;
    sunLight.shadow.camera.updateProjectionMatrix();
    this.sunLight = sunLight;

    // Soft river rim fill from the eastern Robinhood River side
    const riverRimLight = new THREE.DirectionalLight(0xd4edf2, 0.48);
    riverRimLight.name = 'RobinRiverRimFillLight';
    riverRimLight.position.set(520, 320, -280);
    this.riverRimLight = riverRimLight;

    this.lightingGroup.add(hemiLight, sunLight, sunLight.target, riverRimLight);
    this.applyAtmosphereLighting(this.atmosphere);
  }

  private applyAtmosphereLighting(mode: CityAtmosphereMode): void {
    const fog = this.scene.fog as THREE.FogExp2 | null;
    if (mode === 'sunset') {
      this.scene.background = new THREE.Color('#e89b6c');
      if (fog) {
        fog.color.set('#e5986c');
        fog.density = 0.0002;
      }
      if (this.hemiLight) {
        this.hemiLight.color.set('#ffb880');
        this.hemiLight.groundColor.set('#52394c');
        this.hemiLight.intensity = 0.74;
      }
      if (this.sunLight) {
        this.sunLight.color.set('#ff863b');
        this.sunLight.intensity = 1.66;
        this.sunLight.position.set(-560, 260, -150);
      }
      if (this.riverRimLight) {
        this.riverRimLight.color.set('#ffad70');
        this.riverRimLight.intensity = 0.44;
      }
      this.scene.environmentIntensity = 0.22;
      if (this.renderer) {
        this.renderer.toneMappingExposure = 1.04;
      }
      return;
    }

    if (mode === 'night') {
      this.scene.background = new THREE.Color('#102036');
      if (fog) {
        fog.color.set('#142640');
        fog.density = 0.00022;
      }
      if (this.hemiLight) {
        this.hemiLight.color.set('#4469a6');
        this.hemiLight.groundColor.set('#162336');
        this.hemiLight.intensity = 0.38;
      }
      if (this.sunLight) {
        this.sunLight.color.set('#7fa8eb');
        this.sunLight.intensity = 0.44;
        this.sunLight.position.set(340, 520, 340);
      }
      if (this.riverRimLight) {
        this.riverRimLight.color.set('#ffc16e');
        this.riverRimLight.intensity = 0.24;
      }
      this.scene.environmentIntensity = 0.11;
      if (this.renderer) {
        this.renderer.toneMappingExposure = 0.96;
      }
      return;
    }

    // Default 'day': warm sunlit miniature harbor diorama
    this.scene.background = new THREE.Color('#cae6f4');
    if (fog) {
      fog.color.set('#dfeef5');
      fog.density = 0.00014;
    }
    if (this.hemiLight) {
      this.hemiLight.color.set('#fff8e6');
      this.hemiLight.groundColor.set('#6c8566');
      this.hemiLight.intensity = 1.18;
    }
    if (this.sunLight) {
      this.sunLight.color.set('#fff1cf');
      this.sunLight.intensity = 1.68;
      this.sunLight.position.set(-320, 680, 420);
    }
    if (this.riverRimLight) {
      this.riverRimLight.color.set('#d4edf2');
      this.riverRimLight.intensity = 0.48;
    }
    this.scene.environmentIntensity = 0.34;
    if (this.renderer) {
      this.renderer.toneMappingExposure = 1.12;
    }
  }

  private isPortraitCompact(): boolean {
    return this.width < this.height && this.width <= 680;
  }

  private computeCameraFov(): number {
    const aspect = Math.max(0.35, this.width / Math.max(1, this.height));
    if (aspect < 0.9) {
      return THREE.MathUtils.clamp(CAMERA_FOV_DEG + (0.9 - aspect) * 30, CAMERA_FOV_DEG, 50);
    }
    return CAMERA_FOV_DEG;
  }

  private computeFitRadius(): number {
    const aspect = Math.max(0.35, this.width / Math.max(1, this.height));
    const fovRad = THREE.MathUtils.degToRad(this.computeCameraFov());
    const tanHalfV = Math.tan(fovRad * 0.5);
    const tanHalfH = tanHalfV * aspect;

    const radiusForWidth = 110 + (BOARD_2D_W * 0.46) / tanHalfH;
    const radiusForHeight = 95 + (BOARD_2D_H * 0.45) / tanHalfV;
    return THREE.MathUtils.clamp(Math.max(radiusForWidth, radiusForHeight), 790, MAX_RADIUS - 30);
  }

  private radiusForPreset(preset: CameraPresetMode): number {
    const fitRadius = this.computeFitRadius();
    const portrait = this.isPortraitCompact();
    switch (preset) {
      case 'street':
        return portrait
          ? THREE.MathUtils.clamp(fitRadius * 0.34, MIN_RADIUS, 490)
          : THREE.MathUtils.clamp(fitRadius * 0.48, MIN_RADIUS, MAX_RADIUS);
      case 'isometric':
        return portrait
          ? THREE.MathUtils.clamp(fitRadius * 0.56, 720, 820)
          : THREE.MathUtils.clamp(fitRadius * 0.90, MIN_RADIUS, MAX_RADIUS);
      case 'topdown':
        return portrait
          ? THREE.MathUtils.clamp(fitRadius * 0.86, 840, 1280)
          : THREE.MathUtils.clamp(fitRadius * 1.08, MIN_RADIUS, MAX_RADIUS);
      case 'neighborhood':
      default:
        return portrait
          ? THREE.MathUtils.clamp(fitRadius * 0.52, 690, 755)
          : THREE.MathUtils.clamp(fitRadius, MIN_RADIUS, MAX_RADIUS);
    }
  }

  private applyPresetTargets(preset: CameraPresetMode, snapImmediate: boolean): void {
    const radius = this.radiusForPreset(preset);
    const portrait = this.isPortraitCompact();
    let targetAzimuth = -0.04;
    let targetElevation = 0.90;

    if (preset === 'neighborhood') {
      targetAzimuth = portrait ? -0.05 : -0.04;
      targetElevation = portrait ? 0.72 : 0.90;
      if (portrait && this.focusedLotId !== null) {
        this.desiredTarget.copy(this.focusedLotWorldPos);
      } else {
        this.desiredTarget.set(0, portrait ? 8 : 4, portrait ? 18 : 14);
      }
    } else if (preset === 'isometric') {
      targetAzimuth = portrait ? 0.42 : 0.48;
      targetElevation = portrait ? 0.64 : 0.68;
      this.desiredTarget.set(0, portrait ? 8 : 4, portrait ? 16 : 0);
    } else if (preset === 'topdown') {
      targetAzimuth = 0;
      targetElevation = 1.44;
      this.desiredTarget.set(0, 0, 0);
    } else if (preset === 'street') {
      targetAzimuth = portrait ? -0.15 : -0.18;
      targetElevation = portrait ? 0.48 : 0.44;
      if (this.focusedLotId !== null) {
        this.desiredTarget.copy(this.focusedLotWorldPos);
      } else {
        this.desiredTarget.set(0, portrait ? 10 : 8, portrait ? 38 : 25);
      }
    }

    this.setDesiredAzimuthShortest(targetAzimuth);
    this.desiredElevation = THREE.MathUtils.clamp(targetElevation, MIN_ELEVATION, MAX_ELEVATION);
    this.desiredRadius = radius;

    if (snapImmediate) {
      this.currentAzimuth = targetAzimuth;
      this.desiredAzimuth = targetAzimuth;
      this.currentElevation = this.desiredElevation;
      this.currentRadius = this.desiredRadius;
      this.cameraTarget.copy(this.desiredTarget);
      this.applyCameraTransform();
    }
  }

  private setDesiredAzimuthShortest(targetAzimuth: number): void {
    const twoPi = Math.PI * 2;
    let delta = (targetAzimuth - this.currentAzimuth) % twoPi;
    if (delta > Math.PI) delta -= twoPi;
    if (delta < -Math.PI) delta += twoPi;
    this.desiredAzimuth = this.currentAzimuth + delta;
  }

  private applyCameraTransform(): void {
    const cosElev = Math.cos(this.currentElevation);
    const sinElev = Math.sin(this.currentElevation);
    const sinAzim = Math.sin(this.currentAzimuth);
    const cosAzim = Math.cos(this.currentAzimuth);

    const camX = this.cameraTarget.x + this.currentRadius * cosElev * sinAzim;
    const camY = this.cameraTarget.y + this.currentRadius * sinElev;
    const camZ = this.cameraTarget.z + this.currentRadius * cosElev * cosAzim;

    this.camera.position.set(camX, camY, camZ);
    this.camera.lookAt(this.cameraTarget);
  }

  private startLoop(): void {
    if (this.isPaused || this.rafId !== null || typeof requestAnimationFrame !== 'function') {
      return;
    }
    this.rafId = requestAnimationFrame(this.onFrameBound);
  }

  private tick(nowMs: number): void {
    if (this.isPaused || !this.isMounted) {
      this.rafId = null;
      return;
    }

    const rawDt = this.lastFrameMs > 0 ? (nowMs - this.lastFrameMs) * 0.001 : 1 / 60;
    this.lastFrameMs = nowMs;
    const dtSec = THREE.MathUtils.clamp(Number.isFinite(rawDt) ? rawDt : 1 / 60, 0, 0.05);
    this.elapsedSec += dtSec;
    const timeSec = this.elapsedSec;

    const damp = 1 - Math.exp(-10 * dtSec);
    this.currentAzimuth += (this.desiredAzimuth - this.currentAzimuth) * damp;
    this.currentElevation = THREE.MathUtils.clamp(
      this.currentElevation + (this.desiredElevation - this.currentElevation) * damp,
      MIN_ELEVATION,
      MAX_ELEVATION,
    );
    this.currentRadius = THREE.MathUtils.clamp(
      this.currentRadius + (this.desiredRadius - this.currentRadius) * damp,
      MIN_RADIUS,
      MAX_RADIUS,
    );
    this.cameraTarget.lerp(this.desiredTarget, damp);
    this.applyCameraTransform();

    if (this.neighborhoodWorld) {
      this.neighborhoodWorld.update(timeSec, dtSec);
    }

    for (let i = 0; i < this.plotSlots.length; i++) {
      const vs = this.visualStates[i];
      if (
        vs &&
        (vs.isOffered ||
          vs.isChosen ||
          vs.isSelected ||
          vs.isHovered ||
          vs.isDropTarget ||
          vs.isBuildable ||
          vs.shop !== null)
      ) {
        animatePlotSlot3D(this.plotSlots[i], vs, timeSec);
      }
    }

    if (this.renderer) {
      this.renderer.render(this.scene, this.camera);
    }

    this.rafId = requestAnimationFrame(this.onFrameBound);
  }

  private attachDomListeners(canvas: HTMLCanvasElement): void {
    canvas.addEventListener('pointerdown', this.onPointerDownBound);
    canvas.addEventListener('pointermove', this.onPointerMoveBound);
    canvas.addEventListener('pointerup', this.onPointerUpBound);
    canvas.addEventListener('pointercancel', this.onPointerCancelBound);
    canvas.addEventListener('pointerleave', this.onPointerLeaveBound);
    canvas.addEventListener('wheel', this.onWheelBound, { passive: false });
    canvas.addEventListener('contextmenu', this.onContextMenuBound);

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('resize', this.onWindowResizeBound);
    }

    if (
      typeof ResizeObserver !== 'undefined' &&
      this.options.container &&
      typeof Node !== 'undefined' &&
      this.options.container instanceof Element
    ) {
      this.resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const cr = entry.contentRect;
          if (cr.width > 0 && cr.height > 0) {
            this.resize(cr.width, cr.height);
          }
        }
      });
      this.resizeObserver.observe(this.options.container);
    }
  }

  private detachDomListeners(canvas: HTMLCanvasElement): void {
    canvas.removeEventListener('pointerdown', this.onPointerDownBound);
    canvas.removeEventListener('pointermove', this.onPointerMoveBound);
    canvas.removeEventListener('pointerup', this.onPointerUpBound);
    canvas.removeEventListener('pointercancel', this.onPointerCancelBound);
    canvas.removeEventListener('pointerleave', this.onPointerLeaveBound);
    canvas.removeEventListener('wheel', this.onWheelBound);
    canvas.removeEventListener('contextmenu', this.onContextMenuBound);
  }

  private handlePointerDown(event: PointerEvent): void {
    if (event.button === 2) {
      event.preventDefault();
    }

    try {
      this.canvas?.setPointerCapture?.(event.pointerId);
    } catch {
      // Ignore synthetic events in headless environments without active pointer capture
    }

    this.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (this.activePointers.size === 2) {
      const pair = Array.from(this.activePointers.values());
      this.dragMode = 'pinch';
      this.pointerTravelPx = CLICK_TRAVEL_LIMIT_PX + 100;
      this.pinchStartDistance = Math.max(12, Math.hypot(pair[1].x - pair[0].x, pair[1].y - pair[0].y));
      this.pinchStartRadius = this.desiredRadius;
      this.pinchLastMidpoint = {
        x: (pair[0].x + pair[1].x) * 0.5,
        y: (pair[0].y + pair[1].y) * 0.5,
      };
      this.pinchLastAngle = Math.atan2(pair[1].y - pair[0].y, pair[1].x - pair[0].x);
      if (this.canvas) {
        this.canvas.style.cursor = 'grabbing';
      }
      return;
    }

    if (this.activePointers.size === 1) {
      this.primaryPointerId = event.pointerId;
      this.pointerDownPos = { x: event.clientX, y: event.clientY };
      this.lastDragPos = { x: event.clientX, y: event.clientY };
      this.pointerTravelPx = 0;

      if (event.pointerType === 'touch') {
        this.dragMode = this.touchDragMode;
      } else {
        const isPanGesture =
          event.button === 2 || event.button === 1 || (event.button === 0 && event.shiftKey);
        this.dragMode = isPanGesture ? 'pan' : 'orbit';
      }
    }
  }

  private handlePointerMove(event: PointerEvent): void {
    if (this.activePointers.has(event.pointerId)) {
      this.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

      if (this.activePointers.size >= 2 && this.dragMode === 'pinch') {
        const pair = Array.from(this.activePointers.values());
        const dist = Math.max(12, Math.hypot(pair[1].x - pair[0].x, pair[1].y - pair[0].y));
        const midX = (pair[0].x + pair[1].x) * 0.5;
        const midY = (pair[0].y + pair[1].y) * 0.5;
        const angle = Math.atan2(pair[1].y - pair[0].y, pair[1].x - pair[0].x);

        const zoomRatio = this.pinchStartDistance / dist;
        this.hasCustomZoom = true;
        this.desiredRadius = THREE.MathUtils.clamp(
          this.pinchStartRadius * zoomRatio,
          MIN_RADIUS,
          MAX_RADIUS,
        );
        this.currentRadius = this.desiredRadius;

        let angleDelta = angle - this.pinchLastAngle;
        if (angleDelta > Math.PI) angleDelta -= Math.PI * 2;
        if (angleDelta < -Math.PI) angleDelta += Math.PI * 2;
        this.pinchLastAngle = angle;
        if (Math.abs(angleDelta) > 0.004) {
          this.desiredAzimuth -= angleDelta * 0.85;
          this.currentAzimuth = this.desiredAzimuth;
        }

        const panDx = midX - this.pinchLastMidpoint.x;
        const panDy = midY - this.pinchLastMidpoint.y;
        this.pinchLastMidpoint = { x: midX, y: midY };
        this.panCameraByScreenDelta(panDx, panDy);
        this.applyCameraTransform();
        return;
      }

      if (event.pointerId === this.primaryPointerId) {
        const travelLimit =
          event.pointerType === 'touch' ? TOUCH_CLICK_TRAVEL_LIMIT_PX : CLICK_TRAVEL_LIMIT_PX;
        const travelFromStart = Math.hypot(
          event.clientX - this.pointerDownPos.x,
          event.clientY - this.pointerDownPos.y,
        );
        this.pointerTravelPx = Math.max(this.pointerTravelPx, travelFromStart);

        const stepDx = event.clientX - this.lastDragPos.x;
        const stepDy = event.clientY - this.lastDragPos.y;
        this.lastDragPos = { x: event.clientX, y: event.clientY };

        if (this.pointerTravelPx > travelLimit) {
          if (this.canvas) {
            this.canvas.style.cursor = 'grabbing';
          }
          if (this.hoveredLotId !== null) {
            this.updateHoveredLot(null);
          }

          if (this.dragMode === 'pan' || event.shiftKey) {
            this.panCameraByScreenDelta(stepDx, stepDy);
          } else {
            this.desiredAzimuth -= stepDx * ORBIT_SENSITIVITY;
            this.desiredElevation = THREE.MathUtils.clamp(
              this.desiredElevation + stepDy * ORBIT_SENSITIVITY,
              MIN_ELEVATION,
              MAX_ELEVATION,
            );
            this.currentAzimuth = this.desiredAzimuth;
            this.currentElevation = this.desiredElevation;
          }
          this.applyCameraTransform();
        }
      }
      return;
    }

    // Hover raycast when no drag gesture is active
    const hitLotId = this.pickLotAtClientPoint(event.clientX, event.clientY);
    this.updateHoveredLot(hitLotId);
    if (this.canvas) {
      this.canvas.style.cursor = hitLotId !== null ? 'pointer' : 'grab';
    }
  }

  private handlePointerUp(event: PointerEvent): void {
    try {
      this.canvas?.releasePointerCapture?.(event.pointerId);
    } catch {
      // Ignore synthetic events without active pointer capture
    }

    const wasTracked = this.activePointers.delete(event.pointerId);
    const travelLimit =
      event.pointerType === 'touch' ? TOUCH_CLICK_TRAVEL_LIMIT_PX : CLICK_TRAVEL_LIMIT_PX;
    const isSelectableDragMode =
      this.dragMode === 'orbit' || (event.pointerType === 'touch' && this.dragMode === 'pan');
    const wasCleanPrimaryClick =
      wasTracked &&
      event.pointerId === this.primaryPointerId &&
      event.button === 0 &&
      !event.shiftKey &&
      isSelectableDragMode &&
      this.pointerTravelPx <= travelLimit;

    if (this.activePointers.size === 1) {
      const remainingEntry = this.activePointers.entries().next().value;
      if (remainingEntry) {
        this.primaryPointerId = remainingEntry[0];
        this.lastDragPos = { x: remainingEntry[1].x, y: remainingEntry[1].y };
        this.pointerTravelPx = CLICK_TRAVEL_LIMIT_PX + 100;
        this.dragMode = event.pointerType === 'touch' ? this.touchDragMode : 'orbit';
      }
      return;
    }

    if (this.activePointers.size === 0) {
      this.dragMode = null;
      this.primaryPointerId = null;
    }

    if (wasCleanPrimaryClick) {
      const hitLotId = this.pickLotAtClientPoint(event.clientX, event.clientY);
      if (hitLotId !== null) {
        this.options.onSelectLot?.(hitLotId);
      }
    }

    const hoverHit = this.pickLotAtClientPoint(event.clientX, event.clientY);
    this.updateHoveredLot(hoverHit);
    if (this.canvas) {
      this.canvas.style.cursor = hoverHit !== null ? 'pointer' : 'grab';
    }
  }

  private handlePointerCancel(event: PointerEvent): void {
    try {
      this.canvas?.releasePointerCapture?.(event.pointerId);
    } catch {
      // Ignore synthetic events
    }
    this.activePointers.delete(event.pointerId);
    if (this.activePointers.size === 0) {
      this.dragMode = null;
      this.primaryPointerId = null;
      if (this.canvas) {
        this.canvas.style.cursor = 'grab';
      }
    }
  }

  private handlePointerLeave(): void {
    if (this.activePointers.size === 0 && this.hoveredLotId !== null) {
      this.updateHoveredLot(null);
      if (this.canvas) {
        this.canvas.style.cursor = 'grab';
      }
    }
  }

  private handleWheel(event: WheelEvent): void {
    event.preventDefault();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? this.height : 1;
    const clampedPixels = THREE.MathUtils.clamp(event.deltaY * unit, -240, 240);
    const zoomFactor = Math.exp(clampedPixels * 0.0014);

    this.hasCustomZoom = true;
    this.desiredRadius = THREE.MathUtils.clamp(
      this.desiredRadius * zoomFactor,
      MIN_RADIUS,
      MAX_RADIUS,
    );

    if (!this.renderer || this.isPaused) {
      this.currentRadius = this.desiredRadius;
      this.applyCameraTransform();
    }
  }

  private panCameraByScreenDelta(dxPx: number, dyPx: number): void {
    if (dxPx === 0 && dyPx === 0) {
      return;
    }

    const fovRad = THREE.MathUtils.degToRad(this.camera.fov);
    const unitsPerPixel =
      (2 * this.currentRadius * Math.tan(fovRad * 0.5)) / Math.max(1, this.height);
    const groundDepthFactor = 1 / Math.max(0.45, Math.sin(this.currentElevation));

    const sinAzim = Math.sin(this.currentAzimuth);
    const cosAzim = Math.cos(this.currentAzimuth);

    // Camera right vector in XZ is (cosAzim, 0, -sinAzim); forward away from camera is (-sinAzim, 0, -cosAzim)
    const worldDx =
      (-dxPx * cosAzim - dyPx * sinAzim * groundDepthFactor) * unitsPerPixel;
    const worldDz =
      (dxPx * sinAzim - dyPx * cosAzim * groundDepthFactor) * unitsPerPixel;

    this.desiredTarget.x = THREE.MathUtils.clamp(
      this.desiredTarget.x + worldDx,
      -PAN_LIMIT_X,
      PAN_LIMIT_X,
    );
    this.desiredTarget.z = THREE.MathUtils.clamp(
      this.desiredTarget.z + worldDz,
      -PAN_LIMIT_Z,
      PAN_LIMIT_Z,
    );
    this.cameraTarget.x = this.desiredTarget.x;
    this.cameraTarget.z = this.desiredTarget.z;
  }

  private updateHoveredLot(nextLotId: number | null): void {
    if (this.hoveredLotId === nextLotId) {
      return;
    }
    const previous = this.hoveredLotId;
    this.hoveredLotId = nextLotId;

    this.refreshSinglePlotFlag(previous);
    this.refreshSinglePlotFlag(nextLotId);

    this.options.onHoverLot?.(nextLotId);
  }

  private refreshSinglePlotFlag(lotId: number | null): void {
    if (lotId === null || lotId < 0 || lotId >= this.plotSlots.length) {
      return;
    }
    const slot = this.plotSlots[lotId];
    const existing = this.visualStates[lotId] ?? createInitialVisualState(lotId);
    const nextState: PlotVisualState = {
      ...existing,
      isHovered: this.hoveredLotId === lotId,
      isDropTarget: this.dropTargetLotId === lotId,
      isSelected: this.selectedLotId === lotId,
    };
    this.visualStates[lotId] = nextState;
    updatePlotSlot3D(slot, nextState);

    if (this.renderer && this.isPaused) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  private resolveLotIdFromObject(object: THREE.Object3D | null): number | null {
    let cursor: THREE.Object3D | null = object;
    while (cursor) {
      const candidate = cursor.userData?.lotId;
      if (
        typeof candidate === 'number' &&
        Number.isInteger(candidate) &&
        candidate >= 0 &&
        candidate < PLOT_LAYOUT.length
      ) {
        return candidate;
      }
      cursor = cursor.parent;
    }
    return null;
  }

  private resolveInitialSize(options: RobinCity3DOptions): { width: number; height: number } {
    let w = options.width ?? 0;
    let h = options.height ?? 0;

    if ((w <= 0 || h <= 0) && options.container) {
      if (typeof options.container.getBoundingClientRect === 'function') {
        const rect = options.container.getBoundingClientRect();
        if (w <= 0 && rect.width > 0) w = rect.width;
        if (h <= 0 && rect.height > 0) h = rect.height;
      }
      if (w <= 0 && options.container.clientWidth > 0) w = options.container.clientWidth;
      if (h <= 0 && options.container.clientHeight > 0) h = options.container.clientHeight;
    }

    return {
      width: Math.max(1, Math.round(w > 0 ? w : BOARD_2D_W)),
      height: Math.max(1, Math.round(h > 0 ? h : BOARD_2D_H)),
    };
  }

  private syncSizeFromContainer(): void {
    if (!this.options.container) {
      return;
    }
    if (typeof this.options.container.getBoundingClientRect === 'function') {
      const rect = this.options.container.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        this.resize(rect.width, rect.height);
        return;
      }
    }
    if (this.options.container.clientWidth > 0 && this.options.container.clientHeight > 0) {
      this.resize(this.options.container.clientWidth, this.options.container.clientHeight);
    }
  }

  private getViewportRect(): { left: number; top: number; width: number; height: number } {
    if (this.canvas && typeof this.canvas.getBoundingClientRect === 'function') {
      const rect = this.canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
      }
    }
    if (this.options.container && typeof this.options.container.getBoundingClientRect === 'function') {
      const rect = this.options.container.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
      }
    }
    return { left: 0, top: 0, width: this.width, height: this.height };
  }
}
