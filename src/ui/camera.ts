/**
 * src/ui/camera.ts
 *
 * Camera transformation controller and coordinate projection system.
 * Provides mathematical forward and inverse transforms, boundary clamping,
 * cursor-anchored wheel zooming, and parcel hit-testing for robin-town.
 */

import {
  BOARD_WIDTH,
  BOARD_HEIGHT,
  CELL_SIZE,
  LOT_DEFINITIONS,
  TOTAL_LOTS,
} from '../engine/board-layout';

export interface ViewportSize {
  width: number;
  height: number;
}

export interface CameraState {
  x: number;
  y: number;
  zoom: number;
}

export interface CameraConfig {
  minZoom: number;
  maxZoom: number;
  defaultZoom: number;
  panMargin: number;
  lerpSpeed: number;
}

export const DEFAULT_CAMERA_CONFIG: Readonly<CameraConfig> = Object.freeze({
  minZoom: 0.5,
  maxZoom: 2.5,
  defaultZoom: 1.0,
  panMargin: 100,
  lerpSpeed: 0.15,
});

/**
 * Pure mathematical forward transform: Board coordinate to Screen coordinate.
 */
export function boardToScreen(
  bx: number,
  by: number,
  camera: CameraState,
  viewport: ViewportSize
): { x: number; y: number } {
  return {
    x: (bx - camera.x) * camera.zoom + viewport.width / 2,
    y: (by - camera.y) * camera.zoom + viewport.height / 2,
  };
}

/**
 * Pure mathematical inverse transform: Screen coordinate to Board coordinate.
 */
export function screenToBoard(
  sx: number,
  sy: number,
  camera: CameraState,
  viewport: ViewportSize
): { x: number; y: number } {
  return {
    x: (sx - viewport.width / 2) / camera.zoom + camera.x,
    y: (sy - viewport.height / 2) / camera.zoom + camera.y,
  };
}

/**
 * Clamps camera position and scale to keep the board inside acceptable viewport bounds.
 */
export function clampCamera(
  camera: CameraState,
  viewport: ViewportSize,
  config: CameraConfig = DEFAULT_CAMERA_CONFIG,
  boardWidth = BOARD_WIDTH,
  boardHeight = BOARD_HEIGHT
): CameraState {
  const zoom = Math.max(config.minZoom, Math.min(config.maxZoom, camera.zoom));
  const halfVisibleW = viewport.width / 2 / zoom;
  const halfVisibleH = viewport.height / 2 / zoom;

  let x = camera.x;
  let y = camera.y;

  if (boardWidth * zoom <= viewport.width) {
    x = boardWidth / 2;
  } else {
    const minX = halfVisibleW - config.panMargin;
    const maxX = boardWidth - halfVisibleW + config.panMargin;
    if (minX <= maxX) {
      x = Math.max(minX, Math.min(maxX, x));
    } else {
      x = boardWidth / 2;
    }
  }

  if (boardHeight * zoom <= viewport.height) {
    y = boardHeight / 2;
  } else {
    const minY = halfVisibleH - config.panMargin;
    const maxY = boardHeight - halfVisibleH + config.panMargin;
    if (minY <= maxY) {
      y = Math.max(minY, Math.min(maxY, y));
    } else {
      y = boardHeight / 2;
    }
  }

  return { x, y, zoom };
}

/**
 * Computes camera state to anchor zoom around a specific screen coordinate.
 */
export function zoomAtScreenPoint(
  sx: number,
  sy: number,
  newZoom: number,
  camera: CameraState,
  viewport: ViewportSize,
  config: CameraConfig = DEFAULT_CAMERA_CONFIG,
  boardWidth = BOARD_WIDTH,
  boardHeight = BOARD_HEIGHT
): CameraState {
  const clampedZoom = Math.max(config.minZoom, Math.min(config.maxZoom, newZoom));
  const anchorBoard = screenToBoard(sx, sy, camera, viewport);
  const targetX = anchorBoard.x - (sx - viewport.width / 2) / clampedZoom;
  const targetY = anchorBoard.y - (sy - viewport.height / 2) / clampedZoom;

  return clampCamera(
    { x: targetX, y: targetY, zoom: clampedZoom },
    viewport,
    config,
    boardWidth,
    boardHeight
  );
}

/**
 * Pure board-coordinate hit-testing against all 72 lots.
 */
export function hitTestBoardPoint(
  bx: number,
  by: number,
  cellSize = CELL_SIZE,
  boardWidth = BOARD_WIDTH,
  boardHeight = BOARD_HEIGHT
): number | null {
  if (bx < 0 || bx > boardWidth || by < 0 || by > boardHeight) {
    return null;
  }
  for (let i = 0; i < TOTAL_LOTS; i++) {
    const lot = LOT_DEFINITIONS[i];
    if (
      bx >= lot.x &&
      bx < lot.x + cellSize &&
      by >= lot.y &&
      by < lot.y + cellSize
    ) {
      return lot.id;
    }
  }
  return null;
}

/**
 * Screen to lot ID hit-testing function.
 */
export function hitTestScreenPoint(
  sx: number,
  sy: number,
  camera: CameraState,
  viewport: ViewportSize,
  cellSize = CELL_SIZE
): number | null {
  const board = screenToBoard(sx, sy, camera, viewport);
  return hitTestBoardPoint(board.x, board.y, cellSize);
}

/**
 * Stateful interactive camera controller.
 */
export class CameraController {
  private current: CameraState;
  private target: CameraState;
  private viewport: ViewportSize;
  private config: CameraConfig;
  private boundElement: HTMLElement | null = null;
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private cameraStartPos = { x: 0, y: 0 };
  private touchDistance = 0;

  // Bound event handlers for clean detachment
  private onMouseDownBound: (e: MouseEvent) => void;
  private onMouseMoveBound: (e: MouseEvent) => void;
  private onMouseUpBound: (e: MouseEvent) => void;
  private onWheelBound: (e: WheelEvent) => void;
  private onTouchStartBound: (e: TouchEvent) => void;
  private onTouchMoveBound: (e: TouchEvent) => void;
  private onTouchEndBound: (e: TouchEvent) => void;

  constructor(
    viewport: ViewportSize = { width: BOARD_WIDTH, height: BOARD_HEIGHT },
    config: Partial<CameraConfig> = {}
  ) {
    this.viewport = { ...viewport };
    this.config = { ...DEFAULT_CAMERA_CONFIG, ...config };
    this.current = {
      x: BOARD_WIDTH / 2,
      y: BOARD_HEIGHT / 2,
      zoom: this.config.defaultZoom,
    };
    this.target = { ...this.current };

    this.onMouseDownBound = this.handleMouseDown.bind(this);
    this.onMouseMoveBound = this.handleMouseMove.bind(this);
    this.onMouseUpBound = this.handleMouseUp.bind(this);
    this.onWheelBound = this.handleWheel.bind(this);
    this.onTouchStartBound = this.handleTouchStart.bind(this);
    this.onTouchMoveBound = this.handleTouchMove.bind(this);
    this.onTouchEndBound = this.handleTouchEnd.bind(this);
  }

  public getState(): Readonly<CameraState> {
    return this.current;
  }

  public getTargetState(): Readonly<CameraState> {
    return this.target;
  }

  public getViewport(): Readonly<ViewportSize> {
    return this.viewport;
  }

  public setViewport(width: number, height: number): void {
    this.viewport = { width: Math.max(1, width), height: Math.max(1, height) };
    this.target = clampCamera(this.target, this.viewport, this.config);
    this.current = clampCamera(this.current, this.viewport, this.config);
  }

  public pan(screenDx: number, screenDy: number): void {
    const boardDx = screenDx / this.current.zoom;
    const boardDy = screenDy / this.current.zoom;
    this.target = clampCamera(
      {
        ...this.target,
        x: this.target.x - boardDx,
        y: this.target.y - boardDy,
      },
      this.viewport,
      this.config
    );
    this.current = { ...this.target };
  }

  public setZoom(zoom: number, screenAnchor?: { x: number; y: number }): void {
    const anchor = screenAnchor ?? {
      x: this.viewport.width / 2,
      y: this.viewport.height / 2,
    };
    this.target = zoomAtScreenPoint(
      anchor.x,
      anchor.y,
      zoom,
      this.current,
      this.viewport,
      this.config
    );
    this.current = { ...this.target };
  }

  public zoomBy(factor: number, screenAnchor?: { x: number; y: number }): void {
    this.setZoom(this.target.zoom * factor, screenAnchor);
  }

  public centerOn(bx: number, by: number, zoom?: number): void {
    const nextZoom = zoom !== undefined ? zoom : this.target.zoom;
    this.target = clampCamera(
      { x: bx, y: by, zoom: nextZoom },
      this.viewport,
      this.config
    );
    this.current = { ...this.target };
  }

  public reset(): void {
    this.centerOn(BOARD_WIDTH / 2, BOARD_HEIGHT / 2, this.config.defaultZoom);
  }

  public fitToViewport(padding = 40): void {
    const availableW = Math.max(10, this.viewport.width - padding * 2);
    const availableH = Math.max(10, this.viewport.height - padding * 2);
    const scaleX = availableW / BOARD_WIDTH;
    const scaleY = availableH / BOARD_HEIGHT;
    const fitZoom = Math.min(scaleX, scaleY);
    this.centerOn(BOARD_WIDTH / 2, BOARD_HEIGHT / 2, fitZoom);
  }

  public update(): boolean {
    const lerp = this.config.lerpSpeed;
    const dx = this.target.x - this.current.x;
    const dy = this.target.y - this.current.y;
    const dz = this.target.zoom - this.current.zoom;

    if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001 && Math.abs(dz) < 0.0001) {
      this.current.x = this.target.x;
      this.current.y = this.target.y;
      this.current.zoom = this.target.zoom;
      return false;
    }

    this.current.x += dx * lerp;
    this.current.y += dy * lerp;
    this.current.zoom += dz * lerp;
    return true;
  }

  public screenToBoard(sx: number, sy: number): { x: number; y: number } {
    return screenToBoard(sx, sy, this.current, this.viewport);
  }

  public boardToScreen(bx: number, by: number): { x: number; y: number } {
    return boardToScreen(bx, by, this.current, this.viewport);
  }

  public hitTest(sx: number, sy: number): number | null {
    return hitTestScreenPoint(sx, sy, this.current, this.viewport);
  }

  public attach(element: HTMLElement): void {
    if (this.boundElement) {
      this.detach();
    }
    this.boundElement = element;
    element.addEventListener('mousedown', this.onMouseDownBound);
    window.addEventListener('mousemove', this.onMouseMoveBound);
    window.addEventListener('mouseup', this.onMouseUpBound);
    element.addEventListener('wheel', this.onWheelBound, { passive: false });
    element.addEventListener('touchstart', this.onTouchStartBound, { passive: false });
    window.addEventListener('touchmove', this.onTouchMoveBound, { passive: false });
    window.addEventListener('touchend', this.onTouchEndBound);
  }

  public detach(): void {
    if (!this.boundElement) return;
    this.boundElement.removeEventListener('mousedown', this.onMouseDownBound);
    window.removeEventListener('mousemove', this.onMouseMoveBound);
    window.removeEventListener('mouseup', this.onMouseUpBound);
    this.boundElement.removeEventListener('wheel', this.onWheelBound);
    this.boundElement.removeEventListener('touchstart', this.onTouchStartBound);
    window.removeEventListener('touchmove', this.onTouchMoveBound);
    window.removeEventListener('touchend', this.onTouchEndBound);
    this.boundElement = null;
    this.isDragging = false;
  }

  private handleMouseDown(e: MouseEvent): void {
    if (e.button !== 0 && e.button !== 1) return;
    this.isDragging = true;
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
    this.cameraStartPos = { x: this.current.x, y: this.current.y };
  }

  private handleMouseMove(e: MouseEvent): void {
    if (!this.isDragging) return;
    const dx = e.clientX - this.dragStartX;
    const dy = e.clientY - this.dragStartY;
    const boardDx = dx / this.current.zoom;
    const boardDy = dy / this.current.zoom;

    this.target = clampCamera(
      {
        ...this.target,
        x: this.cameraStartPos.x - boardDx,
        y: this.cameraStartPos.y - boardDy,
      },
      this.viewport,
      this.config
    );
    this.current = { ...this.target };
  }

  private handleMouseUp(): void {
    this.isDragging = false;
  }

  private handleWheel(e: WheelEvent): void {
    e.preventDefault();
    const rect = this.boundElement?.getBoundingClientRect();
    const sx = rect ? e.clientX - rect.left : e.clientX;
    const sy = rect ? e.clientY - rect.top : e.clientY;
    const zoomMultiplier = e.deltaY < 0 ? 1.15 : 0.87;
    this.setZoom(this.target.zoom * zoomMultiplier, { x: sx, y: sy });
  }

  private handleTouchStart(e: TouchEvent): void {
    if (e.touches.length === 1) {
      this.isDragging = true;
      this.dragStartX = e.touches[0].clientX;
      this.dragStartY = e.touches[0].clientY;
      this.cameraStartPos = { x: this.current.x, y: this.current.y };
    } else if (e.touches.length === 2) {
      this.isDragging = false;
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      this.touchDistance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
    }
  }

  private handleTouchMove(e: TouchEvent): void {
    if (e.touches.length === 1 && this.isDragging) {
      e.preventDefault();
      const dx = e.touches[0].clientX - this.dragStartX;
      const dy = e.touches[0].clientY - this.dragStartY;
      const boardDx = dx / this.current.zoom;
      const boardDy = dy / this.current.zoom;

      this.target = clampCamera(
        {
          ...this.target,
          x: this.cameraStartPos.x - boardDx,
          y: this.cameraStartPos.y - boardDy,
        },
        this.viewport,
        this.config
      );
      this.current = { ...this.target };
    } else if (e.touches.length === 2) {
      e.preventDefault();
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const newDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      if (this.touchDistance > 0) {
        const factor = newDist / this.touchDistance;
        const midX = (t1.clientX + t2.clientX) / 2;
        const midY = (t1.clientY + t2.clientY) / 2;
        const rect = this.boundElement?.getBoundingClientRect();
        const sx = rect ? midX - rect.left : midX;
        const sy = rect ? midY - rect.top : midY;
        this.setZoom(this.target.zoom * factor, { x: sx, y: sy });
      }
      this.touchDistance = newDist;
    }
  }

  private handleTouchEnd(): void {
    this.isDragging = false;
    this.touchDistance = 0;
  }
}
