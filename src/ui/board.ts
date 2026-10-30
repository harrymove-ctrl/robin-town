/**
 * src/ui/board.ts
 *
 * Board rendering pipeline for the 72-parcel robin-town Web3 metropolis.
 * Decoupled around a Canvas2DContextLike interface for headless testability.
 * Handles high-DPI scaling, district neon glow, parcel states, shop sprites,
 * cluster halos, and interactive overlays.
 */

import {
  BOARD_WIDTH,
  BOARD_HEIGHT,
  CELL_SIZE,
  DISTRICT_BLOCKS,
  LOT_DEFINITIONS,
  SHOP_CATEGORIES,
  TOTAL_LOTS,
  findAllClusters,
} from '../engine/board-layout';
import type { GameState, Lot } from '../engine/types';
import { CameraController, type CameraState, type ViewportSize } from './camera';

export interface Canvas2DContextLike {
  save(): void;
  restore(): void;
  translate(x: number, y: number): void;
  scale(x: number, y: number): void;
  clearRect(x: number, y: number, w: number, h: number): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  strokeRect(x: number, y: number, w: number, h: number): void;
  fillText(text: string, x: number, y: number): void;
  strokeText?(text: string, x: number, y: number): void;
  beginPath(): void;
  closePath(): void;
  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number): void;
  fill(): void;
  stroke(): void;
  drawImage(image: unknown, dx: number, dy: number, dw?: number, dh?: number): void;
  setLineDash?(segments: number[]): void;
  fillStyle: string | unknown;
  strokeStyle: string | unknown;
  lineWidth: number;
  font: string;
  textAlign: string;
  textBaseline: string;
  globalAlpha: number;
  imageSmoothingEnabled: boolean;
  lineDashOffset?: number;
}

export interface BoardRenderState {
  gameState: GameState;
  selectedLotId: number | null;
  hoveredLotId: number | null;
  highlightLots?: number[];
  validBuildLots?: number[];
  invalidBuildLots?: number[];
  activePlayerId?: number;
  selectedShopType?: number | null;
}

export const PLAYER_COLORS: readonly string[] = Object.freeze([
  '#00C805', // Player 0: Robin Emerald
  '#EEC353', // Player 1: Bullion Gold
  '#29B6F6', // Player 2: Ocean Cyan
  '#FF7043', // Player 3: Sunset Coral
]);

export const PLAYER_LIGHT_COLORS: readonly string[] = Object.freeze([
  '#5CFF62',
  '#FFE899',
  '#81D4FA',
  '#FFAB91',
]);

/**
 * Visual Board Renderer drawing the game map and parcel layers.
 */
export class BoardRenderer {
  private camera: CameraController;
  private imageCache: Map<string, unknown> = new Map();

  constructor(camera: CameraController) {
    this.camera = camera;
  }

  public getCamera(): CameraController {
    return this.camera;
  }

  public setImage(key: string, image: unknown): void {
    this.imageCache.set(key, image);
  }

  public hasImage(key: string): boolean {
    return this.imageCache.has(key);
  }

  public getImage(key: string): unknown | undefined {
    return this.imageCache.get(key);
  }

  public clearImageCache(): void {
    this.imageCache.clear();
  }

  /**
   * Preloads an image asynchronously in browser environments.
   */
  public async loadAsset(key: string, src: string): Promise<void> {
    if (typeof Image === 'undefined') {
      return;
    }
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        this.setImage(key, img);
        resolve();
      };
      img.onerror = () => {
        resolve();
      };
      img.src = src;
    });
  }

  /**
   * Main render execution using decoupled canvas context.
   */
  public render(
    ctx: Canvas2DContextLike,
    viewport: ViewportSize,
    state: BoardRenderState
  ): void {
    const cam = this.camera.getState();

    ctx.clearRect(0, 0, viewport.width, viewport.height);

    ctx.save();
    // Setup camera matrix: center on screen, apply zoom, translate to camera world coordinate
    ctx.translate(viewport.width / 2, viewport.height / 2);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);
    ctx.imageSmoothingEnabled = false;

    // Layer 0: Background map
    this.renderBackground(ctx);

    // Layer 1: District outlines and headers
    this.renderDistricts(ctx);

    // Layer 2: All 72 Parcels
    for (let i = 0; i < TOTAL_LOTS; i++) {
      const lot = state.gameState.lots[i];
      const def = LOT_DEFINITIONS[i];
      this.renderParcel(ctx, lot, def, state);
    }

    // Layer 3: Connected clusters and completion halos
    this.renderClusters(ctx, state);

    // Layer 4: Interactive overlays (hover, selection, valid and invalid targets)
    this.renderInteractions(ctx, state);

    ctx.restore();
  }

  private renderBackground(ctx: Canvas2DContextLike): void {
    const bg = this.imageCache.get('board_map');
    if (bg) {
      ctx.drawImage(bg, 0, 0, BOARD_WIDTH, BOARD_HEIGHT);
    } else {
      // Procedural cyberpunk dark grid fallback
      ctx.fillStyle = '#0B0F19';
      ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

      // Outer board border
      ctx.strokeStyle = '#1F2937';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, BOARD_WIDTH - 2, BOARD_HEIGHT - 2);

      // Subtle water / bay channel representation
      ctx.fillStyle = '#07101E';
      ctx.fillRect(0, 680, BOARD_WIDTH, 50);
    }
  }

  private renderDistricts(ctx: Canvas2DContextLike): void {
    for (const district of DISTRICT_BLOCKS) {
      ctx.strokeStyle = district.accentHex;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.4;

      // Calculate district bounding box based on its rows
      let minCol = 99;
      let maxCol = -1;
      const numRows = district.rows.length;
      for (const rowCols of district.rows) {
        for (const c of rowCols) {
          if (c < minCol) minCol = c;
          if (c > maxCol) maxCol = c;
        }
      }

      const dx = district.x + minCol * 52 - 8;
      const dy = district.y - 20;
      const dw = (maxCol - minCol + 1) * 52 + 16;
      const dh = numRows * 52 + 28;

      ctx.strokeRect(dx, dy, dw, dh);

      // District name header
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = district.accentHex;
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(district.name, dx + 6, dy + 5);
      ctx.globalAlpha = 1.0;
    }
  }

  private renderParcel(
    ctx: Canvas2DContextLike,
    lot: Lot,
    def: (typeof LOT_DEFINITIONS)[number],
    state: BoardRenderState
  ): void {
    const px = def.x;
    const py = def.y;
    const size = CELL_SIZE;

    // Base parcel container
    if (!this.imageCache.has('board_map')) {
      ctx.fillStyle = '#111827';
      ctx.fillRect(px, py, size, size);
      ctx.strokeStyle = '#1F2937';
      ctx.lineWidth = 1;
      ctx.strokeRect(px, py, size, size);
    }

    if (lot.owner === null) {
      // Unowned parcel: render lot number badge
      const isPendingDraft =
        state.gameState.phase === 'receive' &&
        state.gameState.pending &&
        state.gameState.pending.includes(lot.id);

      if (isPendingDraft) {
        ctx.fillStyle = 'rgba(0, 200, 5, 0.12)';
        ctx.fillRect(px, py, size, size);
        ctx.strokeStyle = '#00C805';
        ctx.lineWidth = 1.5;
        if (ctx.setLineDash) {
          ctx.setLineDash([4, 2]);
        }
        ctx.strokeRect(px, py, size, size);
        if (ctx.setLineDash) {
          ctx.setLineDash([]);
        }
      }

      // Lot badge
      ctx.fillStyle = '#4B5563';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(def.lotNumber), px + size / 2, py + size / 2);
    } else if (lot.shop === null) {
      // Owned but unbuilt parcel: render player color disc and border
      const pColor = PLAYER_COLORS[lot.owner] || '#FFFFFF';

      ctx.strokeStyle = pColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 1, py + 1, size - 2, size - 2);

      // Center ownership disc or sprite
      const tokenImg = this.imageCache.get(`token_${lot.owner}`);
      if (tokenImg) {
        ctx.drawImage(tokenImg, px + 9, py + 9, 32, 32);
      } else {
        ctx.beginPath();
        ctx.arc(px + size / 2, py + size / 2, 13, 0, Math.PI * 2);
        ctx.fillStyle = pColor;
        ctx.fill();
        ctx.strokeStyle = '#0B0F19';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#0B0F19';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`P${lot.owner + 1}`, px + size / 2, py + size / 2);
      }

      // Small corner number tag
      ctx.fillStyle = pColor;
      ctx.font = '8px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(String(def.lotNumber), px + 3, py + 3);
    } else {
      // Built occupied parcel: render shop background tint, sprite, and owner pip
      const shopDef = SHOP_CATEGORIES[lot.shop];
      const shopColor = shopDef ? shopDef.colorHex : '#39A883';

      ctx.fillStyle = shopColor + '33';
      ctx.fillRect(px, py, size, size);

      const shopImg = this.imageCache.get(`shop_${lot.shop}`);
      if (shopImg) {
        ctx.drawImage(shopImg, px + 9, py + 9, 32, 32);
      } else {
        // Fallback procedural shop rectangle with code
        ctx.fillStyle = shopColor;
        ctx.fillRect(px + 9, py + 9, 32, 32);
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 9, py + 9, 32, 32);

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const code = shopDef ? shopDef.code : 'SH';
        ctx.fillText(code, px + size / 2, py + size / 2);
      }

      // Small owner indicator pip at top right
      const pColor = PLAYER_COLORS[lot.owner] || '#FFFFFF';
      ctx.beginPath();
      ctx.arc(px + size - 8, py + 8, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = pColor;
      ctx.fill();
      ctx.strokeStyle = '#0B0F19';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  private renderClusters(ctx: Canvas2DContextLike, state: BoardRenderState): void {
    const allClusters = findAllClusters(state.gameState.lots);
    for (const cluster of allClusters) {
      if (cluster.isComplete) {
        // Golden completion halo around all parcels in completed cluster
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 2.5;
        for (const lotId of cluster.lots) {
          const def = LOT_DEFINITIONS[lotId];
          ctx.strokeRect(def.x - 1, def.y - 1, CELL_SIZE + 2, CELL_SIZE + 2);
        }

        // Crown completion badge on the lowest ID lot in the cluster
        const rootLotId = cluster.lots[0];
        const rootDef = LOT_DEFINITIONS[rootLotId];
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillText('100%', rootDef.x + CELL_SIZE - 2, rootDef.y + CELL_SIZE - 2);
      }
    }
  }

  private renderInteractions(ctx: Canvas2DContextLike, state: BoardRenderState): void {
    // Valid build targets overlay
    if (state.validBuildLots && state.validBuildLots.length > 0) {
      ctx.fillStyle = 'rgba(0, 200, 5, 0.25)';
      ctx.strokeStyle = '#00C805';
      ctx.lineWidth = 2;
      for (const id of state.validBuildLots) {
        const def = LOT_DEFINITIONS[id];
        ctx.fillRect(def.x, def.y, CELL_SIZE, CELL_SIZE);
        ctx.strokeRect(def.x, def.y, CELL_SIZE, CELL_SIZE);
      }
    }

    // Invalid build targets overlay
    if (state.invalidBuildLots && state.invalidBuildLots.length > 0) {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.35)';
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 1.5;
      for (const id of state.invalidBuildLots) {
        const def = LOT_DEFINITIONS[id];
        ctx.fillRect(def.x, def.y, CELL_SIZE, CELL_SIZE);
        ctx.strokeRect(def.x, def.y, CELL_SIZE, CELL_SIZE);
      }
    }

    // General highlighted lots
    if (state.highlightLots && state.highlightLots.length > 0) {
      ctx.strokeStyle = '#00F0FF';
      ctx.lineWidth = 2;
      for (const id of state.highlightLots) {
        const def = LOT_DEFINITIONS[id];
        ctx.strokeRect(def.x - 1, def.y - 1, CELL_SIZE + 2, CELL_SIZE + 2);
      }
    }

    // Hovered lot outline
    if (state.hoveredLotId !== null && state.hoveredLotId >= 0 && state.hoveredLotId < TOTAL_LOTS) {
      const def = LOT_DEFINITIONS[state.hoveredLotId];
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 2;
      ctx.strokeRect(def.x, def.y, CELL_SIZE, CELL_SIZE);
    }

    // Selected lot highlight
    if (state.selectedLotId !== null && state.selectedLotId >= 0 && state.selectedLotId < TOTAL_LOTS) {
      const def = LOT_DEFINITIONS[state.selectedLotId];
      ctx.strokeStyle = '#00C805';
      ctx.lineWidth = 3;
      ctx.strokeRect(def.x - 1, def.y - 1, CELL_SIZE + 2, CELL_SIZE + 2);
    }
  }

  /**
   * Resizes an HTMLCanvasElement with devicePixelRatio scaling for razor-sharp rendering.
   */
  public resizeCanvas(
    canvas: HTMLCanvasElement,
    viewport: ViewportSize
  ): { dpr: number; cssWidth: number; cssHeight: number } {
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const cssWidth = viewport.width;
    const cssHeight = viewport.height;

    canvas.width = Math.floor(cssWidth * dpr);
    canvas.height = Math.floor(cssHeight * dpr);
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.imageSmoothingEnabled = false;
    }

    return { dpr, cssWidth, cssHeight };
  }
}
