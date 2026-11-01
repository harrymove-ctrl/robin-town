/**
 * scripts/generate-english-saigon-assets.ts
 *
 * Deterministic 100% English pixel-art sprite generator ported directly from
 * the original layered Aseprite Lua scripts (draw-shops.lua, draw-landmarks.lua,
 * draw-street-life.lua, draw-saigon-v8-assets.lua).
 *
 * Redraws every shop signboard, landmark pediment, banknote denomination, and
 * OpenGraph banner in crisp native pixel lettering (COFFEE, BAKERY, NOODLES,
 * FLOWERS, TAILOR, GROCERY, HALL, MARKET, 10W, ROBIN TOWN) using pure Node.js
 * RFC 2083 RGBA PNG encoding with zero external dependencies.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import { encodePng, type RgbaColor } from './generate-assets';

interface PixelImage {
  width: number;
  height: number;
  data: Uint8Array;
}

interface LayeredSprite {
  width: number;
  height: number;
  layers: { name: string; image: PixelImage }[];
}

function createImage(width: number, height: number): PixelImage {
  return { width, height, data: new Uint8Array(width * height * 4) };
}

function parseHexColor(hex: string, overrideAlpha?: number): RgbaColor {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const a =
    overrideAlpha !== undefined
      ? overrideAlpha
      : clean.length === 8
        ? parseInt(clean.slice(6, 8), 16)
        : 255;
  return [r, g, b, a];
}

function setPixel(img: PixelImage, x: number, y: number, c: RgbaColor): void {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  if (ix < 0 || iy < 0 || ix >= img.width || iy >= img.height) return;
  const idx = (iy * img.width + ix) * 4;
  img.data[idx] = c[0];
  img.data[idx + 1] = c[1];
  img.data[idx + 2] = c[2];
  img.data[idx + 3] = c[3];
}

function alphaCompositeOver(dst: PixelImage, src: PixelImage, dx = 0, dy = 0): void {
  for (let sy = 0; sy < src.height; sy++) {
    const ty = dy + sy;
    if (ty < 0 || ty >= dst.height) continue;
    for (let sx = 0; sx < src.width; sx++) {
      const tx = dx + sx;
      if (tx < 0 || tx >= dst.width) continue;
      const sIdx = (sy * src.width + sx) * 4;
      const sa = src.data[sIdx + 3] / 255;
      if (sa <= 0) continue;
      const dIdx = (ty * dst.width + tx) * 4;
      const da = dst.data[dIdx + 3] / 255;
      const outA = sa + da * (1 - sa);
      if (outA <= 0) continue;
      dst.data[dIdx] = Math.round((src.data[sIdx] * sa + dst.data[dIdx] * da * (1 - sa)) / outA);
      dst.data[dIdx + 1] = Math.round(
        (src.data[sIdx + 1] * sa + dst.data[dIdx + 1] * da * (1 - sa)) / outA,
      );
      dst.data[dIdx + 2] = Math.round(
        (src.data[sIdx + 2] * sa + dst.data[dIdx + 2] * da * (1 - sa)) / outA,
      );
      dst.data[dIdx + 3] = Math.round(outA * 255);
    }
  }
}

function flattenSprite(sprite: LayeredSprite): PixelImage {
  const out = createImage(sprite.width, sprite.height);
  for (const layer of sprite.layers) {
    alphaCompositeOver(out, layer.image, 0, 0);
  }
  return out;
}

function resizeNearest(src: PixelImage, targetW: number, targetH: number): PixelImage {
  const out = createImage(targetW, targetH);
  for (let y = 0; y < targetH; y++) {
    const sy = Math.min(src.height - 1, Math.floor((y * src.height) / targetH));
    for (let x = 0; x < targetW; x++) {
      const sx = Math.min(src.width - 1, Math.floor((x * src.width) / targetW));
      const sIdx = (sy * src.width + sx) * 4;
      const dIdx = (y * targetW + x) * 4;
      out.data[dIdx] = src.data[sIdx];
      out.data[dIdx + 1] = src.data[sIdx + 1];
      out.data[dIdx + 2] = src.data[sIdx + 2];
      out.data[dIdx + 3] = src.data[sIdx + 3];
    }
  }
  return out;
}

function paethPredictor(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

/**
 * Minimal RFC 2083 PNG decoder supporting 8-bit RGB (type 2), Palette (type 3),
 * and RGBA (type 6) so we can composite the city board crop into the OG image.
 */
function decodePngFile(filePath: string): PixelImage {
  const buf = fs.readFileSync(filePath);
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 6;
  let palette: RgbaColor[] = [];
  const idatChunks: Buffer[] = [];

  while (offset < buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.subarray(offset + 4, offset + 8).toString('ascii');
    const data = buf.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data[9];
    } else if (type === 'PLTE') {
      palette = [];
      for (let i = 0; i < data.length; i += 3) {
        palette.push([data[i], data[i + 1], data[i + 2], 255]);
      }
    } else if (type === 'tRNS' && colorType === 3) {
      for (let i = 0; i < data.length && i < palette.length; i++) {
        palette[i][3] = data[i];
      }
    } else if (type === 'IDAT') {
      idatChunks.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + length;
  }

  const raw = zlib.inflateSync(Buffer.concat(idatChunks));
  const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : 1;
  const stride = width * bpp;
  const unfiltered = new Uint8Array(height * stride);

  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const rowIn = y * (stride + 1) + 1;
    const rowOut = y * stride;
    for (let i = 0; i < stride; i++) {
      const xByte = raw[rowIn + i];
      const a = i >= bpp ? unfiltered[rowOut + i - bpp] : 0;
      const b = y > 0 ? unfiltered[rowOut - stride + i] : 0;
      const c = y > 0 && i >= bpp ? unfiltered[rowOut - stride + i - bpp] : 0;
      let val = xByte;
      if (filter === 1) val = (xByte + a) & 0xff;
      else if (filter === 2) val = (xByte + b) & 0xff;
      else if (filter === 3) val = (xByte + Math.floor((a + b) / 2)) & 0xff;
      else if (filter === 4) val = (xByte + paethPredictor(a, b, c)) & 0xff;
      unfiltered[rowOut + i] = val;
    }
  }

  const out = createImage(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dIdx = (y * width + x) * 4;
      if (colorType === 6) {
        const sIdx = (y * width + x) * 4;
        out.data[dIdx] = unfiltered[sIdx];
        out.data[dIdx + 1] = unfiltered[sIdx + 1];
        out.data[dIdx + 2] = unfiltered[sIdx + 2];
        out.data[dIdx + 3] = unfiltered[sIdx + 3];
      } else if (colorType === 2) {
        const sIdx = (y * width + x) * 3;
        out.data[dIdx] = unfiltered[sIdx];
        out.data[dIdx + 1] = unfiltered[sIdx + 1];
        out.data[dIdx + 2] = unfiltered[sIdx + 2];
        out.data[dIdx + 3] = 255;
      } else if (colorType === 3) {
        const pIdx = unfiltered[y * width + x];
        const col = palette[pIdx] ?? [0, 0, 0, 0];
        out.data[dIdx] = col[0];
        out.data[dIdx + 1] = col[1];
        out.data[dIdx + 2] = col[2];
        out.data[dIdx + 3] = col[3];
      }
    }
  }
  return out;
}

function savePng(img: PixelImage, targetPaths: string[]): void {
  const pngBuf = encodePng(img.width, img.height, Buffer.from(img.data));
  for (const p of targetPaths) {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, pngBuf);
  }
}

// ============================================================================
// 1. SIX ENGLISH SHOP SPRITES (96x96) - Ported from shops/draw-shops.lua
// ============================================================================

function generateEnglishShops(): Record<string, PixelImage> {
  const rawPalette: Record<string, string> = {
    ink: '343d39',
    edge: '4b5143',
    dark: '254e4d',
    teal: '367b78',
    aqua: '62a89a',
    mint: 'a3c7ae',
    cream: 'fff0cf',
    wall: 'ebcd91',
    shade: 'c4a36c',
    ochre: 'dba65e',
    gold: 'efbf69',
    straw: 'f7d990',
    roof: 'cb7054',
    roofhi: 'ec976a',
    roofdark: '995341',
    red: 'bb5149',
    pink: 'e38e89',
    rose: 'f2b6ad',
    brown: '815a43',
    wood: 'a8774f',
    lightwood: 'd2a571',
    deep: '5b4a3c',
    white: 'fff9e8',
    steel: '92aba4',
    steeldark: '62817e',
    blue: '518db1',
    bluehi: '8cbac3',
    green: '5e8b57',
    leaf: '8aae64',
    leafhi: 'bbca78',
    soil: '7c6748',
    amber: 'eba450',
    yellow: 'f4d06e',
    lavender: 'a99bc6',
    shadow: '5d62504b',
  };
  const P: Record<string, RgbaColor> = {};
  for (const [k, v] of Object.entries(rawPalette)) {
    P[k] = parseHexColor(v);
  }

  let S!: LayeredSprite;
  let I!: PixelImage;

  const px = (x: number, y: number, c: string | RgbaColor) => {
    setPixel(I, x, y, typeof c === 'string' ? P[c] : c);
  };
  const rect = (x: number, y: number, w: number, h: number, c: string | RgbaColor) => {
    for (let j = y; j <= y + h - 1; j++) {
      for (let i = x; i <= x + w - 1; i++) px(i, j, c);
    }
  };
  const line = (x0: number, y0: number, x1: number, y1: number, c: string | RgbaColor) => {
    let cx = Math.floor(x0);
    let cy = Math.floor(y0);
    const tx = Math.floor(x1);
    const ty = Math.floor(y1);
    const dx = Math.abs(tx - cx);
    const sx = cx < tx ? 1 : -1;
    const dy = -Math.abs(ty - cy);
    const sy = cy < ty ? 1 : -1;
    let err = dx + dy;
    while (true) {
      px(cx, cy, c);
      if (cx === tx && cy === ty) break;
      const e = 2 * err;
      if (e >= dy) {
        err += dy;
        cx += sx;
      }
      if (e <= dx) {
        err += dx;
        cy += sy;
      }
    }
  };
  const poly = (pts: [number, number][], c: string | RgbaColor, edge?: string) => {
    let miny = 10000;
    let maxy = -1;
    for (const p of pts) {
      miny = Math.min(miny, p[1]);
      maxy = Math.max(maxy, p[1]);
    }
    for (let y = miny; y <= maxy; y++) {
      const xs: number[] = [];
      for (let n = 0; n < pts.length; n++) {
        const p = pts[n];
        const q = pts[(n + 1) % pts.length];
        if ((p[1] <= y && q[1] > y) || (q[1] <= y && p[1] > y)) {
          xs.push(p[0] + ((y - p[1]) / (q[1] - p[1])) * (q[0] - p[0]));
        }
      }
      xs.sort((a, b) => a - b);
      for (let n = 0; n + 1 < xs.length; n += 2) {
        line(Math.ceil(xs[n]), y, Math.floor(xs[n + 1]), y, c);
      }
    }
    if (edge) {
      for (let n = 0; n < pts.length; n++) {
        const p = pts[n];
        const q = pts[(n + 1) % pts.length];
        line(p[0], p[1], q[0], q[1], edge);
      }
    }
  };
  const box = (x: number, y: number, w: number, h: number, c: string, e = 'ink') => {
    rect(x, y, w, h, e);
    rect(x + 1, y + 1, w - 2, h - 2, c);
  };
  const ellipse = (cx: number, cy: number, rx: number, ry: number, c: string) => {
    for (let y = -ry; y <= ry; y++) {
      for (let x = -rx; x <= rx; x++) {
        if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) px(cx + x, cy + y, c);
      }
    }
  };
  const layer = (name: string) => {
    I = createImage(S.width, S.height);
    S.layers.push({ name, image: I });
  };
  const start = () => {
    S = { width: 96, height: 96, layers: [] };
  };

  const F: Record<string, string[]> = {
    A: ['010', '101', '111', '101', '101'],
    B: ['110', '101', '110', '101', '110'],
    C: ['011', '100', '100', '100', '011'],
    D: ['110', '101', '101', '101', '110'],
    E: ['111', '100', '110', '100', '111'],
    F: ['111', '100', '110', '100', '100'],
    G: ['011', '100', '101', '101', '011'],
    H: ['101', '101', '111', '101', '101'],
    I: ['111', '010', '010', '010', '111'],
    J: ['001', '001', '001', '101', '010'],
    K: ['101', '101', '110', '101', '101'],
    L: ['100', '100', '100', '100', '111'],
    M: ['101', '111', '111', '101', '101'],
    N: ['101', '111', '111', '111', '101'],
    O: ['010', '101', '101', '101', '010'],
    P: ['110', '101', '110', '100', '100'],
    Q: ['010', '101', '101', '111', '011'],
    R: ['110', '101', '110', '101', '101'],
    S: ['011', '100', '010', '001', '110'],
    T: ['111', '010', '010', '010', '010'],
    U: ['101', '101', '101', '101', '111'],
    V: ['101', '101', '101', '101', '010'],
    W: ['101', '101', '111', '111', '101'],
    X: ['101', '101', '010', '101', '101'],
    Y: ['101', '101', '010', '010', '010'],
    Z: ['111', '001', '010', '100', '111'],
    ' ': ['000', '000', '000', '000', '000'],
    '-': ['000', '000', '111', '000', '000'],
  };

  const txt = (str: string, startX: number, y: number, c: string) => {
    let x = startX;
    for (const ch of str) {
      const g = F[ch] ?? F[' '];
      for (let j = 0; j < g.length; j++) {
        const row = g[j];
        for (let k = 0; k < 3; k++) {
          if (row[k] === '1') px(x + k, y + j, c);
        }
      }
      x += 4;
    }
  };

  const sign = (str: string, x: number, y: number, w: number, c = 'teal') => {
    box(x, y, w, 12, c);
    line(x + 1, y + 1, x + w - 2, y + 1, 'aqua');
    const textW = str.length * 4 - 1;
    txt(str, x + Math.floor((w - textW) / 2), y + 4, 'cream');
  };

  const ground = () => {
    layer('01 Ground and cast shadow');
    poly(
      [
        [17, 74],
        [73, 72],
        [91, 81],
        [82, 88],
        [17, 89],
        [7, 83],
      ],
      'shadow',
    );
    poly(
      [
        [17, 72],
        [72, 71],
        [86, 77],
        [78, 84],
        [15, 84],
        [9, 80],
      ],
      'shade',
    );
    poly(
      [
        [17, 72],
        [72, 71],
        [85, 76],
        [77, 81],
        [14, 81],
        [9, 79],
      ],
      'wall',
    );
    line(14, 82, 76, 82, 'ochre');
    line(19, 75, 72, 74, 'cream');
    line(30, 76, 27, 80, 'shade');
    line(57, 75, 57, 80, 'shade');
    px(15, 79, 'cream');
    rect(73, 79, 5, 1, 'cream');
  };

  const walls = (x: number, y: number, w: number, h: number, wall = 'wall') => {
    layer('02 Plaster and timber');
    poly(
      [
        [x + w - 1, y],
        [x + w + 8, y - 5],
        [x + w + 8, y + h - 7],
        [x + w - 1, y + h],
      ],
      'shade',
      'ink',
    );
    line(x + w + 1, y + 2, x + w + 1, y + h - 4, 'ochre');
    box(x, y, w, h, wall);
    rect(x + 2, y + 2, w - 4, 2, 'cream');
    rect(x + 1, y + h - 6, w - 2, 5, 'ochre');
    rect(x + 3, y + h - 3, w - 6, 1, 'shade');
    rect(x + 2, y + 5, 2, h - 12, 'gold');
    rect(x + w - 4, y + 6, 2, h - 13, 'shade');
  };

  const roof = (y: number, col = 'roof') => {
    layer('03 Tiled roof');
    const rc = col;
    const hi = rc === 'gold' ? 'straw' : 'roofhi';
    const dk = rc === 'gold' ? 'ochre' : 'roofdark';
    poly(
      [
        [29, y],
        [70, y],
        [85, y + 13],
        [87, y + 19],
        [79, y + 21],
        [17, y + 21],
        [15, y + 18],
      ],
      dk,
      'ink',
    );
    poly(
      [
        [29, y],
        [69, y],
        [79, y + 17],
        [17, y + 17],
      ],
      rc,
      'ink',
    );
    line(29, y + 1, 68, y + 1, hi);
    line(18, y + 16, 78, y + 16, hi);
    for (let row = 1; row <= 3; row++) {
      const yy = y + row * 4;
      const l = 29 - Math.floor(row * 2.8);
      const r = 69 + row * 2;
      line(l, yy, r, yy, dk);
      line(l + 1, yy + 1, r, yy + 1, hi);
      for (let xx = l + 3; xx <= r - 2; xx += 8) line(xx, yy - 2, xx - 1, yy, dk);
    }
    for (let xx = 19; xx <= 77; xx += 6) {
      line(xx, y + 17, xx, y + 19, dk);
      px(xx + 1, y + 18, hi);
    }
    rect(17, y + 20, 62, 2, 'deep');
    rect(20, y + 22, 56, 2, 'brown');
    line(70, y + 2, 82, y + 13, hi);
    line(80, y + 15, 84, y + 16, dk);
  };

  const door = (x: number, y: number, w: number, h: number) => {
    box(x, y, w, h, 'dark');
    rect(x + 2, y + 2, w - 4, h - 3, 'teal');
    rect(x + 3, y + 3, w - 6, h - 6, 'dark');
    rect(x + w - 4, y + h - 9, 1, 2, 'gold');
    line(x + 2, y + h - 2, x + w - 2, y + h - 2, 'mint');
  };

  const windowBox = (x: number, y: number, w: number, h: number) => {
    box(x, y, w, h, 'teal');
    rect(x + 2, y + 2, w - 4, h - 4, 'dark');
    line(x + 3, y + 2, x + 3, y + h - 4, 'aqua');
    rect(x + 4, y + 3, w - 7, 2, 'steeldark');
    rect(x + 2, y + h - 3, w - 4, 1, 'gold');
  };

  const stool = (x: number, y: number, c: string) => {
    rect(x - 4, y + 2, 2, 5, 'ink');
    rect(x + 3, y + 2, 2, 5, 'ink');
    rect(x - 3, y + 2, 1, 4, c);
    rect(x + 3, y + 2, 1, 4, c);
    box(x - 5, y - 2, 11, 5, c);
    line(x - 3, y - 1, x + 3, y - 1, c === 'blue' ? 'bluehi' : 'roofhi');
    px(x - 4, y + 1, c);
  };

  const tableTop = (x: number, y: number) => {
    rect(x - 1, y + 2, 2, 8, 'deep');
    line(x - 4, y + 9, x + 4, y + 9, 'brown');
    ellipse(x, y, 9, 3, 'ink');
    ellipse(x, y - 1, 8, 2, 'lightwood');
    line(x - 5, y - 2, x + 5, y - 2, 'straw');
  };

  const cup = (x: number, y: number, dripper: boolean) => {
    rect(x - 3, y, 6, 5, 'dark');
    rect(x - 2, y + 1, 4, 3, 'cream');
    rect(x + 3, y + 1, 2, 2, 'cream');
    rect(x - 3, y + 5, 7, 1, 'steel');
    if (dripper) {
      box(x - 3, y - 5, 6, 5, 'steel');
      rect(x - 4, y - 2, 8, 1, 'white');
      rect(x - 4, y - 6, 8, 2, 'steeldark');
      rect(x - 3, y - 6, 6, 1, 'white');
      px(x, y - 7, 'steel');
    } else {
      rect(x - 2, y, 4, 1, 'brown');
    }
  };

  const steam = (x: number, y: number) => {
    line(x, y, x - 1, y - 2, 'cream');
    line(x - 1, y - 3, x + 1, y - 5, 'cream');
    px(x + 1, y - 6, 'cream');
  };

  const pot = (x: number, y: number) => {
    box(x - 3, y, 7, 7, 'roof');
    line(x - 4, y, x + 4, y, 'ink');
    line(x - 3, y + 1, x + 3, y + 1, 'roofhi');
    line(x - 2, y + 5, x + 2, y + 5, 'roofdark');
  };

  const plant = (x: number, y: number) => {
    pot(x, y);
    line(x, y - 1, x, y - 10, 'green');
    line(x, y - 5, x - 4, y - 8, 'green');
    line(x, y - 3, x + 4, y - 6, 'green');
    rect(x - 6, y - 9, 4, 3, 'leaf');
    rect(x + 2, y - 7, 4, 3, 'green');
    rect(x - 1, y - 12, 3, 4, 'leaf');
    px(x - 5, y - 9, 'leafhi');
  };

  const lamp = (x: number, y: number, c = 'red') => {
    line(x, y - 4, x, y - 1, 'deep');
    rect(x - 2, y - 1, 5, 1, 'ink');
    ellipse(x, y + 3, 4, 4, c);
    line(x - 1, y, x - 1, y + 6, 'roofhi');
    rect(x - 2, y + 7, 5, 1, 'deep');
    line(x, y + 8, x, y + 10, 'gold');
  };

  const results: Record<string, PixelImage> = {};

  // 1. COFFEE HOUSE ('COFFEE')
  start();
  ground();
  walls(22, 34, 53, 43);
  roof(14);
  layer('04 Cafe shutters and English COFFEE sign');
  sign('COFFEE', 30, 39, 37, 'teal');
  windowBox(26, 53, 27, 17);
  door(57, 52, 14, 24);
  rect(25, 68, 30, 3, 'brown');
  rect(25, 68, 30, 1, 'straw');
  rect(25, 54, 3, 13, 'teal');
  rect(51, 54, 3, 13, 'aqua');
  for (let yy = 55; yy <= 64; yy += 3) {
    line(25, yy, 28, yy, 'dark');
    line(51, yy, 53, yy, 'teal');
  }
  lamp(21, 42, 'red');
  lamp(77, 41, 'red');
  layer('05 Coffee service and street furniture');
  tableTop(50, 76);
  cup(49, 70, true);
  stool(35, 78, 'blue');
  stool(65, 81, 'blue');
  plant(18, 72);
  cup(35, 62, true);
  cup(46, 64, false);
  rect(31, 57, 3, 3, 'gold');
  rect(44, 57, 3, 3, 'cream');
  line(29, 62, 48, 62, 'wood');
  layer('06 Light, steam and details');
  steam(36, 56);
  px(61, 57, 'aqua');
  rect(27, 74, 8, 1, 'cream');
  rect(80, 49, 1, 8, 'ochre');
  results.coffee = flattenSprite(S);

  // 2. CORNER BAKERY ('BAKERY')
  start();
  ground();
  walls(26, 33, 44, 42);
  roof(15, 'gold');
  layer('04 Bakery and folding canopy');
  windowBox(30, 43, 16, 20);
  door(51, 42, 15, 32);
  poly(
    [
      [18, 39],
      [66, 39],
      [74, 51],
      [13, 51],
    ],
    'cream',
    'ink',
  );
  for (let x = 20; x <= 64; x += 12) {
    poly(
      [
        [x, 40],
        [x + 5, 40],
        [x + 7, 50],
        [x - 2, 50],
      ],
      'roof',
    );
  }
  rect(13, 51, 61, 4, 'roof');
  for (let x = 15; x <= 68; x += 12) rect(x, 52, 6, 2, 'cream');
  line(15, 52, 15, 74, 'deep');
  line(72, 52, 72, 74, 'deep');
  line(16, 53, 16, 73, 'gold');
  layer('05 Baguette glass cart with English BAKERY sign');
  box(19, 56, 45, 22, 'teal');
  rect(21, 58, 41, 9, 'bluehi');
  rect(22, 58, 16, 8, 'mint');
  rect(41, 58, 20, 8, 'aqua');
  line(40, 57, 40, 68, 'steel');
  line(23, 58, 27, 58, 'white');
  line(22, 59, 22, 62, 'white');
  line(46, 58, 50, 58, 'white');
  for (let n = 0; n <= 3; n++) {
    const x = 23 + n * 9;
    poly(
      [
        [x, 64],
        [x + 2, 59],
        [x + 4, 58],
        [x + 6, 59],
        [x + 4, 65],
        [x + 2, 66],
      ],
      'amber',
      'brown',
    );
    line(x + 2, 61, x + 4, 62, 'straw');
    px(x + 2, 64, 'straw');
  }
  rect(19, 68, 45, 2, 'cream');
  rect(20, 70, 43, 7, 'gold');
  txt('BAKERY', 30, 71, 'deep');
  rect(24, 78, 2, 3, 'deep');
  rect(58, 78, 2, 3, 'deep');
  ellipse(25, 81, 3, 3, 'ink');
  ellipse(25, 81, 1, 1, 'steel');
  ellipse(59, 81, 3, 3, 'ink');
  ellipse(59, 81, 1, 1, 'steel');
  rect(63, 70, 6, 2, 'deep');
  rect(69, 69, 2, 4, 'steel');
  layer('06 Fresh ingredients');
  box(70, 66, 10, 13, 'wood');
  rect(71, 65, 8, 3, 'leaf');
  rect(72, 63, 3, 4, 'green');
  rect(76, 62, 2, 5, 'leafhi');
  line(72, 72, 77, 72, 'straw');
  line(72, 75, 77, 75, 'deep');
  box(10, 68, 7, 10, 'steel');
  rect(11, 67, 5, 2, 'red');
  rect(12, 72, 3, 3, 'cream');
  results.banhmi = flattenSprite(S);

  // 3. NOODLE KITCHEN ('NOODLES')
  start();
  ground();
  walls(22, 34, 53, 43);
  layer('03a Chimney');
  box(67, 11, 8, 16, 'steel');
  rect(66, 9, 10, 3, 'steeldark');
  rect(68, 10, 6, 1, 'white');
  line(70, 8, 69, 5, 'cream');
  line(69, 4, 71, 2, 'cream');
  roof(15);
  layer('04 Noodle kitchen joinery and English NOODLES sign');
  sign('NOODLES', 30, 40, 37, 'red');
  windowBox(26, 54, 45, 20);
  rect(28, 56, 19, 16, 'deep');
  rect(50, 56, 19, 16, 'dark');
  rect(47, 54, 3, 19, 'wood');
  rect(25, 72, 47, 3, 'wood');
  line(25, 72, 71, 72, 'straw');
  rect(26, 76, 47, 2, 'shade');
  lamp(77, 42, 'red');
  layer('05 Stockpot and serving counter');
  rect(28, 68, 17, 5, 'ink');
  rect(31, 71, 4, 2, 'roofhi');
  rect(37, 71, 4, 2, 'red');
  box(28, 59, 18, 11, 'steel');
  rect(30, 61, 3, 7, 'mint');
  rect(32, 60, 9, 1, 'white');
  rect(44, 61, 2, 7, 'steeldark');
  ellipse(37, 59, 9, 3, 'steeldark');
  ellipse(37, 58, 8, 2, 'steel');
  line(33, 57, 41, 57, 'white');
  rect(34, 55, 6, 2, 'dark');
  line(25, 61, 27, 61, 'steel');
  line(46, 61, 48, 61, 'steel');
  const bowl = (x: number, y: number) => {
    ellipse(x, y, 7, 2, 'ink');
    ellipse(x, y, 6, 1, 'gold');
    poly(
      [
        [x - 7, y + 1],
        [x + 7, y + 1],
        [x + 4, y + 6],
        [x - 4, y + 6],
      ],
      'cream',
      'ink',
    );
    line(x - 4, y + 3, x + 4, y + 3, 'blue');
    rect(x - 2, y + 6, 5, 1, 'steel');
    px(x - 2, y, 'green');
    px(x + 2, y - 1, 'green');
    line(x + 1, y - 2, x + 6, y - 7, 'brown');
    line(x + 3, y - 2, x + 8, y - 7, 'brown');
  };
  bowl(59, 65);
  tableTop(37, 78);
  bowl(37, 73);
  stool(20, 79, 'red');
  stool(58, 82, 'red');
  plant(79, 71);
  layer('06 Broth steam and garnish');
  steam(32, 58);
  steam(42, 58);
  box(65, 69, 4, 5, 'red');
  rect(66, 67, 2, 2, 'cream');
  rect(49, 71, 5, 1, 'green');
  results.pho = flattenSprite(S);

  // 4. FLOWER STUDIO ('FLOWERS')
  start();
  ground();
  walls(22, 34, 53, 43);
  roof(14, 'gold');
  layer('04 Flower shop front with English FLOWERS sign');
  sign('FLOWERS', 27, 40, 44, 'teal');
  door(44, 54, 15, 23);
  windowBox(26, 54, 14, 18);
  windowBox(62, 54, 10, 17);
  rect(24, 70, 18, 3, 'brown');
  rect(63, 68, 8, 2, 'wood');
  line(30, 55, 37, 55, 'aqua');
  layer('05 Vine and flower buckets');
  line(77, 33, 77, 66, 'green');
  for (let y = 36; y <= 61; y += 5) {
    rect(74, y, 4, 3, 'green');
    rect(78, y + 2, 4, 3, 'leaf');
    px(74, y, 'leafhi');
  }
  const blossom = (x: number, y: number, c: string) => {
    rect(x - 2, y - 3, 4, 7, c);
    rect(x - 3, y - 2, 7, 4, c);
    px(x, y, 'yellow');
    px(x - 2, y - 2, c === 'pink' ? 'rose' : 'cream');
    px(x + 1, y + 2, c === 'rose' ? 'pink' : 'gold');
  };
  const bouquet = (x: number, y: number, c: string) => {
    poly(
      [
        [x - 5, y],
        [x + 5, y],
        [x + 3, y + 10],
        [x - 3, y + 10],
      ],
      'steeldark',
      'ink',
    );
    line(x - 3, y + 2, x - 2, y + 8, 'mint');
    rect(x - 4, y, 9, 2, 'steel');
    line(x, y, x - 3, y - 9, 'green');
    line(x, y, x + 4, y - 10, 'green');
    line(x, y, x, y - 13, 'green');
    rect(x - 5, y - 4, 4, 2, 'leaf');
    rect(x + 1, y - 6, 4, 2, 'leafhi');
    blossom(x - 4, y - 9, c);
    blossom(x + 4, y - 10, c);
    blossom(x, y - 15, c);
  };
  bouquet(18, 69, 'pink');
  bouquet(31, 73, 'yellow');
  bouquet(65, 73, 'rose');
  bouquet(78, 68, 'lavender');
  pot(47, 75);
  rect(44, 73, 7, 4, 'green');
  blossom(47, 70, 'pink');
  blossom(43, 72, 'cream');
  blossom(51, 72, 'yellow');
  layer('06 Hanging posy');
  line(22, 40, 22, 51, 'deep');
  pot(22, 50);
  rect(18, 46, 8, 6, 'green');
  blossom(22, 45, 'rose');
  rect(64, 35, 8, 2, 'green');
  rect(68, 37, 7, 2, 'leaf');
  results.flowers = flattenSprite(S);

  // 5. SILK TAILOR ('TAILOR')
  start();
  ground();
  walls(26, 28, 44, 48);
  roof(8, 'gold');
  layer('04 Tailor sign and balcony with English TAILOR sign');
  windowBox(31, 33, 14, 12);
  windowBox(50, 33, 14, 12);
  line(37, 34, 37, 43, 'gold');
  line(56, 34, 56, 43, 'gold');
  rect(29, 43, 38, 2, 'teal');
  for (let x = 30; x <= 65; x += 5) rect(x, 44, 1, 4, 'dark');
  line(28, 47, 67, 47, 'aqua');
  sign('TAILOR', 26, 49, 44, 'teal');
  door(47, 62, 19, 14);
  windowBox(29, 63, 15, 12);
  layer('05 Silk and sewing tools');
  line(69, 48, 82, 48, 'deep');
  line(76, 48, 76, 53, 'deep');
  poly(
    [
      [76, 51],
      [71, 54],
      [81, 54],
    ],
    'cream',
    'deep',
  );
  poly(
    [
      [74, 53],
      [78, 53],
      [80, 56],
      [83, 64],
      [80, 65],
      [78, 59],
      [79, 68],
      [81, 76],
      [76, 75],
      [74, 68],
      [73, 76],
      [69, 76],
      [72, 62],
      [69, 66],
      [67, 64],
      [71, 55],
    ],
    'pink',
    'ink',
  );
  line(75, 54, 75, 67, 'rose');
  rect(72, 77, 3, 3, 'cream');
  rect(77, 77, 3, 3, 'cream');
  px(77, 58, 'gold');
  px(78, 61, 'gold');
  px(76, 65, 'gold');
  rect(30, 72, 14, 2, 'lightwood');
  rect(32, 65, 9, 3, 'ink');
  rect(32, 67, 3, 4, 'ink');
  rect(40, 65, 3, 7, 'ink');
  ellipse(42, 66, 2, 2, 'steel');
  ellipse(42, 66, 1, 1, 'ink');
  rect(35, 68, 5, 3, 'cream');
  line(36, 68, 36, 71, 'steel');
  rect(36, 64, 1, 1, 'red');
  line(21, 71, 21, 81, 'deep');
  line(17, 82, 25, 82, 'deep');
  rect(20, 57, 3, 4, 'wood');
  poly(
    [
      [18, 61],
      [24, 61],
      [26, 65],
      [24, 70],
      [25, 73],
      [17, 73],
      [18, 70],
      [16, 65],
    ],
    'cream',
    'ink',
  );
  line(21, 62, 21, 72, 'lightwood');
  line(18, 68, 24, 68, 'roof');
  box(50, 68, 4, 13, 'blue');
  rect(51, 69, 1, 10, 'bluehi');
  ellipse(52, 68, 2, 1, 'cream');
  box(55, 71, 5, 10, 'red');
  rect(56, 72, 1, 7, 'pink');
  ellipse(57, 71, 2, 1, 'cream');
  layer('06 Tailor finishing details');
  lamp(25, 42, 'red');
  rect(30, 77, 9, 1, 'cream');
  results.tailor = flattenSprite(S);

  // 6. CORNER GROCER ('GROCERY')
  start();
  ground();
  walls(21, 35, 55, 41);
  roof(15);
  layer('04 Grocer awning and English GROCERY sign');
  sign('GROCERY', 28, 40, 42, 'cream');
  rect(29, 41, 40, 10, 'gold');
  txt('GROCERY', 35, 44, 'deep');
  poly(
    [
      [22, 51],
      [73, 51],
      [79, 59],
      [17, 59],
    ],
    'teal',
    'ink',
  );
  for (let x = 25; x <= 70; x += 10) {
    poly(
      [
        [x, 52],
        [x + 4, 52],
        [x + 3, 58],
        [x - 2, 58],
      ],
      'mint',
    );
  }
  rect(17, 59, 63, 3, 'dark');
  for (let x = 19; x <= 75; x += 10) rect(x, 60, 4, 2, 'aqua');
  windowBox(25, 63, 25, 13);
  door(55, 63, 15, 14);
  line(27, 69, 48, 69, 'lightwood');
  rect(24, 75, 49, 2, 'wood');
  line(24, 75, 72, 75, 'straw');
  layer('05 Bottles tins and hanging packets');
  const bottleCols = ['red', 'gold', 'blue', 'cream', 'green'];
  for (let n = 0; n <= 4; n++) {
    const x = 28 + n * 4;
    rect(x, 64, 3, 4, bottleCols[n]);
    px(x + 1, 63, 'straw');
    rect(x, 66, 2, 1, 'cream');
  }
  const tinCols = ['gold', 'pink', 'mint', 'blue'];
  for (let n = 0; n <= 3; n++) box(28 + n * 5, 71, 4, 4, tinCols[n]);
  const pktCols = ['red', 'gold', 'mint'];
  for (let n = 0; n <= 2; n++) {
    const y = 63 + n * 4;
    box(72, y, 5, 4, pktCols[n]);
    px(74, y + 1, 'cream');
  }
  const crate = (x: number, y: number) => {
    box(x, y, 15, 10, 'wood');
    line(x + 2, y + 3, x + 12, y + 3, 'straw');
    line(x + 2, y + 6, x + 12, y + 6, 'deep');
    rect(x + 1, y + 1, 2, 8, 'lightwood');
    rect(x + 12, y + 1, 2, 8, 'lightwood');
  };
  crate(58, 77);
  for (let n = 0; n <= 3; n++) {
    ellipse(61 + n * 3, 76, 2, 2, n % 2 === 0 ? 'amber' : 'yellow');
    px(61 + n * 3, 74, 'green');
  }
  crate(74, 72);
  for (let n = 0; n <= 2; n++) {
    ellipse(77 + n * 3, 71, 2, 3, 'green');
    px(77 + n * 3, 69, 'leaf');
  }
  poly(
    [
      [13, 68],
      [21, 68],
      [24, 76],
      [23, 82],
      [11, 82],
      [10, 76],
    ],
    'wall',
    'ink',
  );
  ellipse(17, 68, 5, 2, 'brown');
  ellipse(17, 67, 4, 1, 'cream');
  rect(13, 73, 7, 4, 'gold');
  px(15, 68, 'straw');
  px(18, 67, 'shade');
  line(14, 75, 19, 75, 'brown');
  poly(
    [
      [30, 74],
      [37, 73],
      [40, 78],
      [39, 84],
      [27, 84],
      [26, 80],
    ],
    'straw',
    'ink',
  );
  ellipse(33, 74, 4, 1, 'cream');
  line(30, 79, 36, 79, 'wood');
  px(30, 75, 'shade');
  px(34, 74, 'shade');
  layer('06 Corner grocer details');
  box(46, 73, 8, 10, 'red');
  rect(48, 74, 4, 2, 'cream');
  rect(48, 78, 4, 3, 'gold');
  rect(47, 72, 6, 2, 'steel');
  line(80, 47, 80, 64, 'brown');
  rect(79, 45, 3, 3, 'roofhi');
  results.grocery = flattenSprite(S);

  return results;
}

// ============================================================================
// 2. ENGLISH LANDMARK SPRITES & ATLAS - Ported from landmarks/draw-landmarks.lua
// ============================================================================

function generateEnglishLandmarks(publicDir: string): {
  choLon: PixelImage;
  binhThanh: PixelImage;
  atlas: PixelImage;
} {
  const hex: Record<string, string> = {
    ink: '183d3c',
    shade: '315452',
    stone: '99a995',
    sand: 'd6c99d',
    cream: 'f8e8b9',
    light: 'fff4d1',
    ochre: 'd9a55a',
    ochreDark: 'aa7046',
    brick: 'ad5140',
    terra: 'd96c49',
    tile: 'ef9560',
    red: 'd94546',
    pink: 'ee6f9f',
    pinkLite: 'ffa1bb',
    pinkDark: 'b94678',
    purple: '703e65',
    glass: '326c73',
    aqua: '79bdb0',
    jade: '397a57',
    leaf: '66a45b',
    leafHi: 'a4cb77',
    trunk: '885b3c',
    river: '469895',
    riverLight: '87c9b6',
    white: 'fff8db',
  };
  const C: Record<string, RgbaColor> = {};
  for (const [k, v] of Object.entries(hex)) C[k] = parseHexColor(v);
  C.shadow = [24, 61, 60, 65];

  let I!: PixelImage;
  const dot = (x: number, y: number, c: string) => setPixel(I, x, y, C[c]);
  const rect = (x: number, y: number, w: number, h: number, c: string) => {
    for (let yy = y; yy <= y + h - 1; yy++) {
      for (let xx = x; xx <= x + w - 1; xx++) dot(xx, yy, c);
    }
  };
  const line = (x0: number, y0: number, x1: number, y1: number, c: string) => {
    let cx = Math.floor(x0);
    let cy = Math.floor(y0);
    const tx = Math.floor(x1);
    const ty = Math.floor(y1);
    const dx = Math.abs(tx - cx);
    const sx = cx < tx ? 1 : -1;
    const dy = -Math.abs(ty - cy);
    const sy = cy < ty ? 1 : -1;
    let er = dx + dy;
    while (true) {
      dot(cx, cy, c);
      if (cx === tx && cy === ty) break;
      const e2 = 2 * er;
      if (e2 >= dy) {
        er += dy;
        cx += sx;
      }
      if (e2 <= dx) {
        er += dx;
        cy += sy;
      }
    }
  };
  const poly = (p: [number, number][], c: string, outline?: string) => {
    let miny = 9999;
    let maxy = -9999;
    for (const v of p) {
      miny = Math.min(miny, v[1]);
      maxy = Math.max(maxy, v[1]);
    }
    for (let y = miny; y <= maxy; y++) {
      const nodes: number[] = [];
      let j = p.length - 1;
      for (let i = 0; i < p.length; i++) {
        const a = p[i];
        const b = p[j];
        if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
          nodes.push(a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
        }
        j = i;
      }
      nodes.sort((x, z) => x - z);
      for (let i = 0; i + 1 < nodes.length; i += 2) {
        for (let x = Math.ceil(nodes[i]); x <= Math.floor(nodes[i + 1]); x++) dot(x, y, c);
      }
    }
    if (outline) {
      for (let j = 0; j < p.length; j++) {
        const a = p[j];
        const b = p[(j + 1) % p.length];
        line(a[0], a[1], b[0], b[1], outline);
      }
    }
  };
  const box = (x: number, y: number, w: number, h: number, fill: string, edge = 'ink') => {
    rect(x, y, w, h, edge);
    rect(x + 1, y + 1, w - 2, h - 2, fill);
  };
  const disk = (x: number, y: number, rx: number, ry: number, c: string) => {
    for (let yy = y - ry; yy <= y + ry; yy++) {
      for (let xx = x - rx; xx <= x + rx; xx++) {
        if ((xx - x) ** 2 / (rx * rx) + (yy - y) ** 2 / (ry * ry) <= 1) dot(xx, yy, c);
      }
    }
  };
  const arch = (x: number, y: number, w: number, h: number, fill: string) => {
    rect(x + 1, y + 2, w - 2, h - 2, 'ink');
    rect(x + 2, y + 1, w - 4, 2, 'ink');
    rect(x + 3, y, w - 6, 1, 'ink');
    rect(x + 2, y + 3, w - 4, h - 3, fill);
    rect(x + 3, y + 2, w - 6, 2, fill);
  };
  const ground = () => {
    poly(
      [
        [9, 77],
        [69, 66],
        [90, 78],
        [80, 85],
        [27, 89],
        [6, 82],
      ],
      'shadow',
    );
    poly(
      [
        [12, 74],
        [69, 64],
        [86, 75],
        [79, 80],
        [27, 85],
        [10, 81],
      ],
      'sand',
      'ink',
    );
    line(12, 76, 27, 82, 'cream');
    line(27, 82, 78, 77, 'cream');
    line(27, 84, 78, 79, 'ochreDark');
  };
  const roof = (x: number, y: number, w: number, depth: number) => {
    poly(
      [
        [x, y],
        [x + depth, y - depth],
        [x + w + depth, y - depth],
        [x + w, y],
      ],
      'terra',
      'ink',
    );
    for (let yy = 2; yy <= depth - 2; yy += 3) line(x + yy, y - yy, x + w + yy, y - yy, 'tile');
    for (let xx = 4; xx <= w - 3; xx += 7) {
      line(x + xx, y - 1, x + xx + depth - 2, y - depth + 1, 'brick');
    }
    line(x + 1, y, x + w - 1, y, 'ochreDark');
  };
  const house = (x: number, y: number, w: number, h: number, body = 'ochre') => {
    const d = 8;
    poly(
      [
        [x + w, y],
        [x + w + d, y - d],
        [x + w + d, y + h - d],
        [x + w, y + h],
      ],
      'ochreDark',
      'ink',
    );
    box(x, y, w, h, body);
    rect(x + 1, y + 1, w - 2, 2, 'cream');
    roof(x - 2, y, w + 4, d);
  };
  const stall = (x: number, y: number, w: number, color = 'red') => {
    box(x + 1, y + 7, w - 2, 8, 'ochre');
    rect(x + 2, y + 8, w - 4, 2, 'cream');
    line(x + 2, y + 1, x + 2, y + 9, 'ink');
    line(x + w - 3, y + 1, x + w - 3, y + 9, 'ink');
    poly(
      [
        [x, y],
        [x + 3, y - 5],
        [x + w - 3, y - 5],
        [x + w, y],
      ],
      color,
      'ink',
    );
    for (let xx = x + 3; xx <= x + w - 4; xx += 6) {
      poly(
        [
          [xx, y - 1],
          [xx + 2, y - 4],
          [xx + 4, y - 4],
          [xx + 3, y - 1],
        ],
        'cream',
      );
    }
    rect(x, y, w, 3, 'ink');
    for (let xx = x + 1; xx <= x + w - 2; xx++) {
      dot(xx, y + 1, Math.floor((xx - x) / 3) % 2 === 0 ? color : 'cream');
    }
    disk(x + 4, y + 7, 2, 2, 'leafHi');
    disk(x + 8, y + 7, 2, 2, 'red');
    disk(x + 12, y + 7, 2, 2, 'ochre');
  };
  const scooter = (x: number, y: number) => {
    disk(x, y, 3, 3, 'ink');
    disk(x + 12, y, 3, 3, 'ink');
    dot(x, y, 'sand');
    dot(x + 12, y, 'sand');
    poly(
      [
        [x - 2, y - 5],
        [x + 4, y - 7],
        [x + 7, y - 4],
        [x + 10, y - 4],
        [x + 10, y - 10],
        [x + 13, y - 10],
        [x + 14, y - 3],
        [x + 9, y - 1],
        [x + 1, y - 1],
      ],
      'aqua',
      'ink',
    );
    rect(x, y - 8, 6, 2, 'ink');
    rect(x + 1, y - 7, 3, 1, 'cream');
    line(x + 10, y - 11, x + 15, y - 11, 'ink');
    rect(x + 13, y - 9, 2, 2, 'cream');
  };

  const font: Record<string, string[]> = {
    A: ['010', '101', '111', '101', '101'],
    E: ['111', '100', '110', '100', '111'],
    H: ['101', '101', '111', '101', '101'],
    K: ['101', '101', '110', '101', '101'],
    L: ['100', '100', '100', '100', '111'],
    M: ['10001', '11011', '10101', '10001', '10001'],
    R: ['110', '101', '110', '101', '101'],
    T: ['111', '010', '010', '010', '010'],
    ' ': ['0', '0', '0', '0', '0'],
  };
  const label = (t: string, startX: number, y: number, c: string) => {
    let x = startX;
    for (const ch of t) {
      const f = font[ch] ?? font[' '];
      for (let yy = 0; yy < f.length; yy++) {
        const row = f[yy];
        for (let xx = 0; xx < row.length; xx++) {
          if (row[xx] === '1') dot(x + xx, y + yy, c);
        }
      }
      x += f[0].length + 1;
    }
  };

  // Lantern Hall ('HALL' replacing 'CHO')
  const choSprite: LayeredSprite = { width: 96, height: 96, layers: [] };
  const addLayer = (sp: LayeredSprite, name: string, fn: () => void) => {
    I = createImage(96, 96);
    fn();
    sp.layers.push({ name, image: I });
  };
  addLayer(choSprite, '01 Trading courtyard', () => {
    ground();
    line(23, 81, 77, 73, 'ochreDark');
  });
  addLayer(choSprite, '02 Market wings', () => {
    house(12, 52, 62, 26, 'ochre');
    roof(9, 52, 68, 13);
    for (let x = 16; x <= 67; x += 10) {
      arch(x, 61, 8, 16, 'glass');
      rect(x - 1, 57, 9, 2, 'cream');
    }
    poly(
      [
        [8, 53],
        [14, 47],
        [22, 48],
        [70, 44],
        [85, 40],
        [81, 49],
        [74, 52],
      ],
      'terra',
      'ink',
    );
    line(14, 49, 74, 47, 'tile');
    line(21, 52, 72, 50, 'brick');
  });
  addLayer(choSprite, '03 Tiled gateway with English HALL plaque', () => {
    poly(
      [
        [52, 39],
        [61, 34],
        [61, 72],
        [52, 80],
      ],
      'ochreDark',
      'ink',
    );
    box(30, 40, 25, 40, 'cream');
    rect(33, 51, 19, 9, 'ochre');
    label('HALL', 35, 53, 'brick');
    arch(35, 64, 15, 16, 'glass');
    arch(39, 66, 7, 14, 'ink');
    rect(29, 79, 27, 3, 'ochreDark');
    rect(28, 82, 29, 2, 'sand');
    poly(
      [
        [22, 42],
        [28, 34],
        [34, 35],
        [42, 24],
        [54, 34],
        [62, 31],
        [59, 41],
        [53, 44],
        [31, 44],
      ],
      'terra',
      'ink',
    );
    line(27, 39, 55, 39, 'tile');
    line(33, 36, 54, 36, 'tile');
    line(36, 32, 49, 32, 'tile');
    line(40, 28, 45, 28, 'tile');
    line(26, 42, 55, 42, 'brick');
    line(28, 34, 30, 36, 'cream');
    line(58, 33, 60, 31, 'cream');
    poly(
      [
        [34, 25],
        [38, 20],
        [47, 20],
        [53, 25],
        [49, 28],
        [37, 28],
      ],
      'jade',
      'ink',
    );
    line(37, 24, 49, 24, 'leaf');
    rect(41, 17, 4, 4, 'terra');
    dot(42, 16, 'cream');
    rect(28, 44, 30, 3, 'ochreDark');
    line(30, 44, 55, 44, 'cream');
    rect(31, 47, 3, 32, 'ochre');
    rect(51, 47, 3, 32, 'ochre');
  });
  addLayer(choSprite, '04 Lanterns and wholesale goods', () => {
    for (const x of [25, 60]) {
      line(x, 49, x, 56, 'ink');
      box(x - 3, 56, 7, 8, 'red');
      rect(x - 1, 56, 2, 7, 'tile');
      rect(x - 2, 55, 5, 1, 'ochre');
      rect(x - 2, 64, 5, 1, 'ochre');
      line(x, 65, x, 68, 'ochreDark');
    }
    box(16, 73, 8, 8, 'ochre');
    line(17, 75, 22, 79, 'ochreDark');
    box(22, 76, 9, 7, 'ochreDark');
    line(23, 77, 29, 77, 'sand');
    box(66, 74, 9, 6, 'cream');
    rect(67, 75, 7, 2, 'brick');
    box(73, 77, 8, 5, 'ochre');
    rect(74, 78, 6, 1, 'cream');
  });
  const choLon = flattenSprite(choSprite);

  // Grand Market ('MARKET' replacing 'BA CHIEU')
  const btSprite: LayeredSprite = { width: 96, height: 96, layers: [] };
  addLayer(btSprite, '01 Public market apron', () => {
    ground();
    line(12, 80, 25, 83, 'cream');
    line(64, 79, 81, 75, 'cream');
  });
  addLayer(btSprite, '02 Market hall', () => {
    house(11, 50, 67, 29, 'ochre');
    roof(8, 50, 70, 15);
    line(15, 38, 78, 38, 'tile');
    line(13, 42, 77, 42, 'tile');
    line(10, 46, 76, 46, 'tile');
    for (let x = 15; x <= 70; x += 11) {
      box(x, 61, 8, 18, 'glass');
      rect(x - 1, 58, 10, 2, 'cream');
      rect(x + 1, 64, 6, 1, 'aqua');
      rect(x + 3, 62, 1, 15, 'ink');
    }
    rect(12, 52, 65, 3, 'cream');
    rect(12, 56, 65, 2, 'ochreDark');
    line(79, 51, 84, 46, 'cream');
  });
  addLayer(btSprite, '03 Stepped market pediment with English MARKET plaque', () => {
    poly(
      [
        [24, 53],
        [24, 43],
        [30, 43],
        [30, 38],
        [35, 38],
        [35, 34],
        [51, 34],
        [51, 38],
        [58, 38],
        [58, 43],
        [64, 43],
        [64, 53],
      ],
      'cream',
      'ink',
    );
    rect(26, 49, 36, 4, 'ochre');
    rect(28, 44, 32, 2, 'sand');
    rect(36, 36, 14, 2, 'light');
    label('MARKET', 31, 46, 'brick');
    rect(38, 39, 10, 3, 'terra');
    rect(40, 39, 6, 1, 'tile');
    rect(32, 57, 24, 3, 'cream');
    arch(36, 61, 16, 18, 'ink');
    rect(37, 67, 14, 12, 'glass');
    rect(41, 66, 5, 13, 'ink');
    rect(31, 79, 27, 3, 'cream');
    rect(30, 82, 28, 2, 'ochreDark');
  });
  addLayer(btSprite, '04 Produce awnings and scooter', () => {
    stall(10, 72, 20, 'jade');
    stall(62, 72, 22, 'red');
    scooter(45, 86);
    disk(14, 74, 2, 2, 'leafHi');
    disk(18, 74, 2, 2, 'ochre');
  });
  const binhThanh = flattenSprite(btSprite);

  // Re-composite 288x192 neighborhood-landmarks.png (3x2 grid)
  const atlas = createImage(288, 192);
  const landmarkFiles = [
    decodePngFile(path.join(publicDir, 'assets/saigon/landmarks/tan-dinh.png')),
    decodePngFile(path.join(publicDir, 'assets/saigon/landmarks/ben-thanh.png')),
    decodePngFile(path.join(publicDir, 'assets/saigon/landmarks/thao-dien.png')),
    choLon,
    binhThanh,
    decodePngFile(path.join(publicDir, 'assets/saigon/landmarks/phu-nhuan.png')),
  ];
  landmarkFiles.forEach((cell, idx) => {
    const cx = (idx % 3) * 96;
    const cy = Math.floor(idx / 3) * 96;
    alphaCompositeOver(atlas, cell, cx, cy);
  });

  return { choLon, binhThanh, atlas };
}

// ============================================================================
// 3. ENGLISH $WIF BANKNOTE SPRITE (48x24) - Ported from life/draw-street-life.lua
// ============================================================================

function generateEnglishBanknote(): PixelImage {
  const hex: Record<string, string> = {
    ink: '183d3c',
    cream: 'f8e8b9',
    light: 'fff4d1',
    aqua: '79bdb0',
    jade: '397a57',
    river: '469895',
    riverLight: '87c9b6',
  };
  const C: Record<string, RgbaColor> = {};
  for (const [k, v] of Object.entries(hex)) C[k] = parseHexColor(v);
  C.shadow = [24, 61, 60, 65];

  const sp: LayeredSprite = { width: 48, height: 24, layers: [] };
  let I!: PixelImage;
  const dot = (x: number, y: number, c: string) => setPixel(I, x, y, C[c]);
  const rect = (x: number, y: number, w: number, h: number, c: string) => {
    for (let yy = y; yy <= y + h - 1; yy++) {
      for (let xx = x; xx <= x + w - 1; xx++) dot(xx, yy, c);
    }
  };
  const line = (x0: number, y0: number, x1: number, y1: number, c: string) => {
    let cx = Math.floor(x0);
    let cy = Math.floor(y0);
    const tx = Math.floor(x1);
    const ty = Math.floor(y1);
    const dx = Math.abs(tx - cx);
    const sx = cx < tx ? 1 : -1;
    const dy = -Math.abs(ty - cy);
    const sy = cy < ty ? 1 : -1;
    let er = dx + dy;
    while (true) {
      dot(cx, cy, c);
      if (cx === tx && cy === ty) break;
      const e2 = 2 * er;
      if (e2 >= dy) {
        er += dy;
        cx += sx;
      }
      if (e2 <= dx) {
        er += dx;
        cy += sy;
      }
    }
  };
  const poly = (p: [number, number][], c: string, outline?: string) => {
    let miny = 9999;
    let maxy = -9999;
    for (const v of p) {
      miny = Math.min(miny, v[1]);
      maxy = Math.max(maxy, v[1]);
    }
    for (let y = miny; y <= maxy; y++) {
      const nodes: number[] = [];
      let j = p.length - 1;
      for (let i = 0; i < p.length; i++) {
        const a = p[i];
        const b = p[j];
        if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
          nodes.push(a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
        }
        j = i;
      }
      nodes.sort((a, b) => a - b);
      for (let i = 0; i + 1 < nodes.length; i += 2) {
        for (let x = Math.ceil(nodes[i]); x <= Math.floor(nodes[i + 1]); x++) dot(x, y, c);
      }
    }
    if (outline) {
      for (let j = 0; j < p.length; j++) {
        const a = p[j];
        const b = p[(j + 1) % p.length];
        line(a[0], a[1], b[0], b[1], outline);
      }
    }
  };
  const disk = (x: number, y: number, rx: number, ry: number, c: string) => {
    for (let yy = y - ry; yy <= y + ry; yy++) {
      for (let xx = x - rx; xx <= x + rx; xx++) {
        if ((xx - x) ** 2 / (rx * rx) + (yy - y) ** 2 / (ry * ry) <= 1) dot(xx, yy, c);
      }
    }
  };
  const box = (x: number, y: number, w: number, h: number, c: string) => {
    rect(x, y, w, h, 'ink');
    rect(x + 1, y + 1, w - 2, h - 2, c);
  };
  const glyphs: Record<string, string[]> = {
    '1': ['010', '110', '010', '010', '111'],
    '0': ['111', '101', '101', '101', '111'],
    W: ['10001', '10001', '10101', '10101', '01010'],
  };
  const drawGlyphs = (t: string, startX: number, y: number, c: string) => {
    let x = startX;
    for (const ch of t) {
      const g = glyphs[ch];
      if (!g) continue;
      for (let yy = 0; yy < g.length; yy++) {
        for (let xx = 0; xx < g[yy].length; xx++) {
          if (g[yy][xx] === '1') dot(x + xx, y + yy, c);
        }
      }
      x += g[0].length + 1;
    }
  };

  const addLayer = (name: string, fn: () => void) => {
    I = createImage(48, 24);
    fn();
    sp.layers.push({ name, image: I });
  };

  addLayer('01 Fictional paper and border', () => {
    rect(0, 2, 47, 21, 'shadow');
    box(1, 1, 46, 21, 'aqua');
    rect(3, 3, 42, 17, 'cream');
    rect(4, 4, 40, 15, 'aqua');
    rect(5, 5, 38, 13, 'riverLight');
    for (let x = 5; x <= 41; x += 3) {
      dot(x, 3, 'aqua');
      dot(x, 19, 'aqua');
    }
  });
  addLayer('02 Emblem ornament', () => {
    disk(27, 11, 8, 7, 'river');
    disk(27, 11, 7, 6, 'aqua');
    poly(
      [
        [27, 6],
        [24, 10],
        [27, 14],
        [30, 10],
      ],
      'cream',
      'jade',
    );
    poly(
      [
        [21, 9],
        [22, 14],
        [27, 15],
        [26, 12],
      ],
      'cream',
      'jade',
    );
    poly(
      [
        [33, 9],
        [32, 14],
        [27, 15],
        [28, 12],
      ],
      'cream',
      'jade',
    );
    line(23, 16, 31, 16, 'jade');
    for (let y = 6; y <= 16; y += 2) {
      line(37, y, 41, y, 'aqua');
      dot(36, y + 1, 'cream');
    }
  });
  addLayer('03 Game value 10W ($wif) symbol', () => {
    drawGlyphs('10W', 6, 8, 'ink');
    drawGlyphs('10', 37, 13, 'jade');
    line(6, 15, 19, 15, 'jade');
    dot(6, 6, 'light');
    dot(42, 17, 'light');
  });

  return flattenSprite(sp);
}

// ============================================================================
// 4. ROBIN TOWN OPENGRAPH BANNER (1200x630) - Ported from draw-saigon-v8-assets.lua
// ============================================================================

function generateRobinTownOgBanner(
  publicDir: string,
  shops: Record<string, PixelImage>,
): PixelImage {
  const JADE = parseHexColor('143f33');
  const INK = parseHexColor('0c2b24');
  const CREAM = parseHexColor('f4e4bc');
  const GOLD = parseHexColor('eec353');
  const MUTED = parseHexColor('8eaa88');

  const og: LayeredSprite = { width: 1200, height: 630, layers: [] };
  let I!: PixelImage;

  const rect = (x: number, y: number, w: number, h: number, c: RgbaColor) => {
    for (let yy = Math.floor(y); yy <= Math.floor(y + h - 1); yy++) {
      for (let xx = Math.floor(x); xx <= Math.floor(x + w - 1); xx++) {
        setPixel(I, xx, yy, c);
      }
    }
  };

  const FONT: Record<string, string[]> = {
    A: ['01110', '11011', '11011', '11111', '11011', '11011', '11011'],
    B: ['11110', '11011', '11011', '11110', '11011', '11011', '11110'],
    C: ['01111', '11000', '11000', '11000', '11000', '11000', '01111'],
    D: ['11110', '11011', '11011', '11011', '11011', '11011', '11110'],
    E: ['11111', '11000', '11000', '11110', '11000', '11000', '11111'],
    F: ['11111', '11000', '11000', '11110', '11000', '11000', '11000'],
    G: ['01111', '11000', '11000', '11011', '11011', '11011', '01111'],
    H: ['11011', '11011', '11011', '11111', '11011', '11011', '11011'],
    I: ['11111', '01110', '01110', '01110', '01110', '01110', '11111'],
    K: ['11011', '11011', '11110', '11100', '11110', '11011', '11011'],
    L: ['11000', '11000', '11000', '11000', '11000', '11000', '11111'],
    M: ['11011', '11111', '11111', '11011', '11011', '11011', '11011'],
    N: ['11011', '11111', '11111', '11111', '11011', '11011', '11011'],
    O: ['01110', '11011', '11011', '11011', '11011', '11011', '01110'],
    P: ['11110', '11011', '11011', '11110', '11000', '11000', '11000'],
    R: ['11110', '11011', '11011', '11110', '11100', '11010', '11011'],
    S: ['01111', '11000', '11000', '01110', '00011', '00011', '11110'],
    T: ['11111', '01110', '01110', '01110', '01110', '01110', '01110'],
    U: ['11011', '11011', '11011', '11011', '11011', '11011', '01110'],
    W: ['11011', '11011', '11011', '11011', '11111', '11111', '11011'],
    $: ['00100', '01111', '11000', '01110', '00011', '11110', '00100'],
    '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
    ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  };

  const text = (t: string, startX: number, y: number, scale: number, c: RgbaColor, gap = 1) => {
    let x = startX;
    for (const ch of t) {
      const g = FONT[ch] ?? FONT[' '];
      for (let yy = 0; yy < g.length; yy++) {
        for (let xx = 0; xx < 5; xx++) {
          if (g[yy][xx] === '1') {
            rect(x + xx * scale, y + yy * scale, scale, scale, c);
          }
        }
      }
      x += (5 + gap) * scale;
    }
  };

  const addLayer = (name: string, fn: () => void) => {
    I = createImage(1200, 630);
    fn();
    og.layers.push({ name, image: I });
  };

  addLayer('01 Jade cloth and warm brand frame', () => {
    rect(0, 0, 1200, 630, JADE);
    for (let y = 5; y <= 625; y += 8) {
      for (let x = 5; x <= 1195; x += 8) {
        if ((x * 13 + y * 7) % 31 < 3) rect(x, y, 2, 2, parseHexColor('1a4638'));
      }
    }
    rect(28, 28, 1144, 2, parseHexColor('729265'));
    rect(28, 600, 1144, 2, parseHexColor('729265'));
    rect(28, 28, 2, 574, parseHexColor('729265'));
    rect(1170, 28, 2, 574, parseHexColor('729265'));
    for (const [px, py] of [
      [41, 41],
      [1152, 41],
      [41, 581],
      [1152, 581],
    ]) {
      rect(px, py, 7, 7, GOLD);
    }
  });

  const board = decodePngFile(path.join(publicDir, 'assets/saigon/city/saigon-city-board-v6.png'));
  const crop = createImage(504, 502);
  alphaCompositeOver(crop, board, -375, -175);

  addLayer('02 Cropped city board and wooden rim', () => {
    rect(640, 63, 521, 520, parseHexColor('071f19', 150));
    rect(636, 55, 520, 520, parseHexColor('8c6941'));
    rect(643, 62, 506, 506, parseHexColor('e5c991'));
    alphaCompositeOver(I, crop, 644, 64);
    rect(638, 57, 516, 3, parseHexColor('cbab6c'));
    rect(638, 570, 516, 4, parseHexColor('573e28'));
  });

  addLayer('02b Subtle jade wash on the board', () => {
    rect(644, 64, 504, 502, parseHexColor('174437', 42));
  });

  addLayer('03 ROBIN TOWN brand lettering', () => {
    text('ROBINHOOD CHAIN . BUILD WITH $WIF', 64, 74, 2, MUTED);
    text('ROBIN', 69, 157, 12, INK);
    text('ROBIN', 64, 151, 12, CREAM);
    text('TOWN', 68, 270, 15, INK);
    text('TOWN', 64, 264, 15, GOLD);
    rect(64, 396, 48, 3, GOLD);
    rect(120, 396, 390, 1, parseHexColor('4e7654'));
    text('BUILD. BARGAIN. BELONG.', 64, 425, 3, CREAM);
    text('PUT $WIF TO WORK.', 64, 520, 3, MUTED);
  });

  const coffeeLarge = resizeNearest(shops.coffee, 276, 276);
  const bakeryLarge = resizeNearest(shops.banhmi, 250, 250);
  const noodlesLarge = resizeNearest(shops.pho, 244, 244);

  addLayer('04 Three English neighborhood shops', () => {
    alphaCompositeOver(I, coffeeLarge, 770, 112);
    alphaCompositeOver(I, bakeryLarge, 613, 262);
    alphaCompositeOver(I, noodlesLarge, 936, 286);
  });

  addLayer('05 Four colorful ownership stools', () => {
    const stoolCoords = [
      [728, 458],
      [825, 475],
      [935, 466],
      [1040, 475],
    ];
    for (let n = 0; n < 4; n++) {
      const stoolImg = decodePngFile(
        path.join(publicDir, `assets/saigon/materials/stool-${n}-v8.png`),
      );
      const scaled = resizeNearest(stoolImg, 96, 96);
      alphaCompositeOver(I, scaled, stoolCoords[n][0], stoolCoords[n][1]);
    }
  });

  return flattenSprite(og);
}

export function generateAllEnglishAssets(rootDir = process.cwd()): void {
  const publicDir = path.join(rootDir, 'public');
  const shops = generateEnglishShops();

  for (const [name, img] of Object.entries(shops)) {
    savePng(img, [
      path.join(publicDir, `assets/saigon/shops/${name}.png`),
      path.join(publicDir, `assets/${name}-hd.png`),
    ]);
    const img32 = resizeNearest(img, 32, 32);
    savePng(img32, [
      path.join(publicDir, `assets/shops/${name}.png`),
      path.join(publicDir, `assets/${name}.png`),
    ]);
  }

  const { choLon, binhThanh, atlas } = generateEnglishLandmarks(publicDir);
  savePng(choLon, [path.join(publicDir, 'assets/saigon/landmarks/cho-lon.png')]);
  savePng(binhThanh, [path.join(publicDir, 'assets/saigon/landmarks/binh-thanh.png')]);
  savePng(atlas, [path.join(publicDir, 'assets/saigon/landmarks/neighborhood-landmarks.png')]);

  const banknote = generateEnglishBanknote();
  savePng(banknote, [
    path.join(publicDir, 'assets/saigon/life/game-banknote.png'),
    path.join(publicDir, 'assets/materials/game-banknote.png'),
  ]);

  const ogBanner = generateRobinTownOgBanner(publicDir, shops);
  savePng(ogBanner, [path.join(publicDir, 'assets/saigon/saigon-town-og-v8.png')]);

  console.log(
    '[english-assets] Generated 100% English shop sprites, landmarks, $wif banknote, and Robin Town OG banner.',
  );
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]).endsWith('generate-english-saigon-assets.ts');
if (isDirectRun) {
  generateAllEnglishAssets(process.cwd());
}
