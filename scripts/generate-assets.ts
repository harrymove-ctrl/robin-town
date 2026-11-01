/**
 * scripts/generate-assets.ts
 *
 * Standalone procedural pixel art asset synthesis pipeline for robin-town.
 * Pure Node.js built-ins (node:fs, node:path, node:zlib) without external C-libraries.
 * Fully RFC 2083 compliant PNG encoder with nearest-neighbor 3x integer scaling.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import { execSync } from 'node:child_process';

export type RgbaColor = [number, number, number, number];
export type Palette = Record<string, RgbaColor>;

const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  CRC_TABLE[i] = c >>> 0;
}

/**
 * Calculates standard IEEE 802.3 CRC32 over a Buffer.
 * Uses native node:zlib.crc32 when available with a table-driven fallback.
 */
export function crc32(buffer: Buffer): number {
  if (typeof (zlib as { crc32?: (buf: Buffer) => number }).crc32 === 'function') {
    return (zlib as { crc32: (buf: Buffer) => number }).crc32(buffer);
  }
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) {
    c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * Constructs a PNG chunk with length, type, payload, and CRC32.
 */
function makeChunk(type: string, data: Buffer): Buffer {
  const len = data.length;
  const chunk = Buffer.alloc(12 + len);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  if (len > 0) {
    data.copy(chunk, 8);
  }
  const typeAndData = chunk.subarray(4, 8 + len);
  const crc = crc32(typeAndData);
  chunk.writeUInt32BE(crc, 8 + len);
  return chunk;
}

/**
 * Constructs an RFC 2083 compliant 32-bit RGBA PNG binary buffer.
 */
export function encodePng(width: number, height: number, rgbaBuffer: Buffer): Buffer {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR Chunk: 13 bytes payload
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // 8 bits per channel
  ihdrData[9] = 6; // Color type 6: RGBA with truecolor alpha
  ihdrData[10] = 0; // Deflate compression
  ihdrData[11] = 0; // Adaptive filtering
  ihdrData[12] = 0; // No interlacing
  const ihdrChunk = makeChunk('IHDR', ihdrData);

  // IDAT Chunk: raw scanlines with 1 filter byte (0 = None) per row
  const scanlineWidth = 1 + width * 4;
  const scanlines = Buffer.alloc(height * scanlineWidth);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * scanlineWidth;
    scanlines[rowOffset] = 0; // Filter: None
    rgbaBuffer.copy(scanlines, rowOffset + 1, y * width * 4, (y + 1) * width * 4);
  }
  const compressed = zlib.deflateSync(scanlines);
  const idatChunk = makeChunk('IDAT', compressed);

  // IEND Chunk: 0 bytes payload
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

/**
 * Converts a character matrix into a contiguous RGBA Buffer.
 */
export function matrixToRgba(matrix: string[], palette: Palette, width = 32, height = 32): Buffer {
  const buf = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    const row = matrix[y] || '';
    for (let x = 0; x < width; x++) {
      const char = row[x] || '.';
      const [r, g, b, a] = palette[char] || [0, 0, 0, 0];
      const offset = (y * width + x) * 4;
      buf[offset] = r;
      buf[offset + 1] = g;
      buf[offset + 2] = b;
      buf[offset + 3] = a;
    }
  }
  return buf;
}

/**
 * Scales a contiguous RGBA Buffer by an exact integer factor using nearest-neighbor interpolation.
 */
export function scaleRgba(src: Buffer, srcWidth: number, srcHeight: number, scale: number): Buffer {
  const destWidth = srcWidth * scale;
  const destHeight = srcHeight * scale;
  const dest = Buffer.alloc(destWidth * destHeight * 4);

  for (let y = 0; y < destHeight; y++) {
    const srcY = Math.floor(y / scale);
    for (let x = 0; x < destWidth; x++) {
      const srcX = Math.floor(x / scale);
      const srcOffset = (srcY * srcWidth + srcX) * 4;
      const destOffset = (y * destWidth + x) * 4;
      dest[destOffset] = src[srcOffset];
      dest[destOffset + 1] = src[srcOffset + 1];
      dest[destOffset + 2] = src[srcOffset + 2];
      dest[destOffset + 3] = src[srcOffset + 3];
    }
  }
  return dest;
}

/**
 * Converts a character matrix into an equivalent Scalable Vector Graphic (SVG) string.
 */
export function matrixToSvg(matrix: string[], palette: Palette, width = 32, height = 32): string {
  const rects: string[] = [];
  for (let y = 0; y < height; y++) {
    const row = matrix[y] || '';
    for (let x = 0; x < width; x++) {
      const char = row[x] || '.';
      const color = palette[char];
      if (!color || color[3] === 0) continue;
      const [r, g, b, a] = color;
      const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
      const opacity = a < 255 ? ` opacity="${(a / 255).toFixed(2)}"` : '';
      rects.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="${hex}"${opacity}/>`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" shape-rendering="crispEdges">\n${rects.join('\n')}\n</svg>\n`;
}

// -----------------------------------------------------------------------------
// 3x5 Pixel Font for Numbers and Headers
// -----------------------------------------------------------------------------

export const FONT_3X5: Record<string, string[]> = {
  '0': ['###', '#.#', '#.#', '#.#', '###'],
  '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '2': ['###', '..#', '###', '#..', '###'],
  '3': ['###', '..#', '###', '..#', '###'],
  '4': ['#.#', '#.#', '###', '..#', '..#'],
  '5': ['###', '#..', '###', '..#', '###'],
  '6': ['###', '#..', '###', '#.#', '###'],
  '7': ['###', '..#', '..#', '..#', '..#'],
  '8': ['###', '#.#', '###', '#.#', '###'],
  '9': ['###', '#.#', '###', '..#', '###'],
  A: ['###', '#.#', '###', '#.#', '#.#'],
  B: ['##.', '#.#', '##.', '#.#', '##.'],
  C: ['###', '#..', '#..', '#..', '###'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '###', '#..', '###'],
  F: ['###', '#..', '###', '#..', '#..'],
  G: ['###', '#..', '#.#', '#.#', '###'],
  H: ['#.#', '#.#', '###', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  J: ['..#', '..#', '..#', '#.#', '###'],
  K: ['#.#', '#.#', '##.', '#.#', '#.#'],
  L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#.#', '###', '#.#', '#.#', '#.#'],
  N: ['#.#', '###', '###', '#.#', '#.#'],
  O: ['###', '#.#', '#.#', '#.#', '###'],
  P: ['###', '#.#', '###', '#..', '#..'],
  Q: ['###', '#.#', '#.#', '###', '..#'],
  R: ['###', '#.#', '###', '##.', '#.#'],
  S: ['###', '#..', '###', '..#', '###'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'],
  V: ['#.#', '#.#', '#.#', '#.#', '.#.'],
  W: ['#.#', '#.#', '#.#', '###', '#.#'],
  X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  Y: ['#.#', '#.#', '###', '.#.', '.#.'],
  Z: ['###', '..#', '.#.', '#..', '###'],
  ' ': ['...', '...', '...', '...', '...'],
  '-': ['...', '...', '###', '...', '...'],
  ':': ['...', '.#.', '...', '.#.', '...'],
};

function renderTextOnRgba(
  buf: Buffer,
  bufW: number,
  bufH: number,
  text: string,
  startX: number,
  startY: number,
  color: RgbaColor,
  scale = 1
): void {
  let currX = startX;
  const upper = text.toUpperCase();
  for (let i = 0; i < upper.length; i++) {
    const glyph = FONT_3X5[upper[i]] || FONT_3X5[' '];
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 3; c++) {
        if (glyph[r][c] === '#') {
          for (let sy = 0; sy < scale; sy++) {
            for (let sx = 0; sx < scale; sx++) {
              const px = currX + c * scale + sx;
              const py = startY + r * scale + sy;
              if (px >= 0 && px < bufW && py >= 0 && py < bufH) {
                const offset = (py * bufW + px) * 4;
                buf[offset] = color[0];
                buf[offset + 1] = color[1];
                buf[offset + 2] = color[2];
                buf[offset + 3] = color[3];
              }
            }
          }
        }
      }
    }
    currX += (3 + 1) * scale;
  }
}

// -----------------------------------------------------------------------------
// Storefront Pixel Art Matrices (6 Protocol Shops)
// -----------------------------------------------------------------------------

export const SHOP_PALETTES: Palette[] = [
  // 0: DEX Swap
  {
    '.': [0, 0, 0, 0],
    '#': [11, 15, 25, 255],
    k: [17, 24, 39, 255],
    g: [57, 168, 131, 255],
    G: [0, 200, 5, 255],
    L: [140, 235, 195, 255],
    d: [25, 90, 65, 255],
    W: [243, 244, 246, 255],
    Y: [238, 195, 83, 255],
  },
  // 1: Memecoin Lounge
  {
    '.': [0, 0, 0, 0],
    '#': [11, 15, 25, 255],
    k: [26, 18, 36, 255],
    Y: [238, 195, 83, 255],
    y: [180, 130, 20, 255],
    L: [255, 230, 140, 255],
    P: [255, 105, 180, 255],
    p: [200, 60, 130, 255],
    F: [229, 169, 60, 255],
    f: [185, 125, 30, 255],
    W: [255, 248, 220, 255],
    N: [15, 15, 20, 255],
  },
  // 2: Staking Vault
  {
    '.': [0, 0, 0, 0],
    '#': [11, 15, 25, 255],
    k: [15, 23, 42, 255],
    C: [255, 112, 67, 255],
    c: [184, 85, 57, 255],
    L: [255, 165, 135, 255],
    S: [100, 116, 139, 255],
    s: [51, 65, 85, 255],
    G: [0, 255, 100, 255],
    R: [239, 68, 68, 255],
    Y: [251, 191, 36, 255],
  },
  // 3: Lending Protocol
  {
    '.': [0, 0, 0, 0],
    '#': [11, 15, 25, 255],
    k: [24, 15, 35, 255],
    A: [171, 71, 188, 255],
    a: [120, 40, 140, 255],
    L: [225, 150, 245, 255],
    P: [243, 244, 246, 255],
    p: [156, 163, 175, 255],
    G: [238, 195, 83, 255],
  },
  // 4: Derivatives Exchange
  {
    '.': [0, 0, 0, 0],
    '#': [11, 15, 25, 255],
    k: [10, 20, 32, 255],
    B: [88, 124, 154, 255],
    b: [45, 75, 100, 255],
    L: [140, 180, 215, 255],
    G: [0, 200, 5, 255],
    R: [239, 68, 68, 255],
    W: [243, 244, 246, 255],
    Y: [251, 191, 36, 255],
  },
  // 5: Validator Citadel
  {
    '.': [0, 0, 0, 0],
    '#': [11, 15, 25, 255],
    k: [15, 20, 25, 255],
    F: [100, 132, 84, 255],
    f: [55, 80, 45, 255],
    L: [150, 185, 130, 255],
    S: [69, 90, 100, 255],
    s: [40, 55, 65, 255],
    G: [0, 255, 100, 255],
    W: [243, 244, 246, 255],
  },
];

export const SHOP_MATRICES: string[][] = [
  // 0: DEX Swap
  [
    '............########............',
    '.........###gggggggg###.........',
    '.......##gggLLLLLLLLggg##.......',
    '.....##ggLLggggggggggLLgg##.....',
    '....#ggLLggggggggggggggLLgg#....',
    '...#ggLggggggggggggggggggLgg#...',
    '..#ggLggggggggggggggggggggLgg#..',
    '..#dddddddddddddddddddddddddd#..',
    '..#kkkkkkkkkkkkkkkkkkkkkkkkkk#..',
    '..#kkkkkkkGGGGGGGGkkkkkkkkkkk#..',
    '..#kkkkkGGGGGGGGGGGGkkkkkkkkk#..',
    '..#kkkkGGGGkkkkkkGGGGkkkWWkkk#..',
    '..#kkkGGGGkkk####kkGGGGkWWWkk#..',
    '..#kkkGGGkkk#YYYY#kkGGGWWWWWk#..',
    '..#kkkGGGkkk#YYYY#kkGGGkkWWWk#..',
    '..#kkkGGGkkk#YYYY#kkGGGkkkWWk#..',
    '..#kkkGGGkkk#YYYY#kkGGGkkkkkk#..',
    '..#kkkGGGkkk#YYYY#kkGGGkkkkkk#..',
    '..#kkkWWkkkk#YYYY#kkGGGkkkkkk#..',
    '..#kkWWWkkkk#YYYY#kkGGGkkkkkk#..',
    '..#kWWWWWkkk#YYYY#kkGGGkkkkkk#..',
    '..#kkWWWkkGGGG####kkkGGGkkkkk#..',
    '..#kkkWWkkkGGGGkkkkkkGGGkkkkk#..',
    '..#kkkkkkkkkGGGGGGGGGGGGkkkkk#..',
    '..#kkkkkkkkkkkGGGGGGGGkkkkkkk#..',
    '..#kkkkkkkkkkkkkkkkkkkkkkkkkk#..',
    '..#dddddddddddddddddddddddddd#..',
    '..#gggggggggggggggggggggggggg#..',
    '..#ggLLLLLLLLLLLLLLLLLLLLLLgg#..',
    '..#gggggggggggggggggggggggggg#..',
    '...#dddddddddddddddddddddddd#...',
    '....########################....',
  ],
  // 1: Memecoin Lounge
  [
    '............########............',
    '.........###YYYYYYYY###.........',
    '.......##YYYLLLLLLLLYYY##.......',
    '.....##YYLLYYYYYYYYYYLLYY##.....',
    '....#YYLLYYYYYYYYYYYYYYLLYY#....',
    '...#YYLYYYYYYYYYYYYYYYYYYLYY#...',
    '..#YYLYYYYYYYYYYYYYYYYYYYYLYY#..',
    '..#yyyyyyyyyyyyyyyyyyyyyyyyyy#..',
    '..#kkkkkkkkkkkkkkkkkkkkkkkkkk#..',
    '..#kkkkkkkkkkkPPPPkkkkkkkkkkk#..',
    '..#kkkkkkkkkPPPPPPPPkkkkkkkkk#..',
    '..#kkkkkkkkPPPPPPPPPPkkkkkkkk#..',
    '..#kkkkkkkppPPPPPPPPppkkkkkkk#..',
    '..#kkkkkkkppPPPPPPPPppkkkkkkk#..',
    '..#kkkkkkkkppppppppppkkkkkkkk#..',
    '..#kkkkkkFFFFFFFFFFFFFFkkkkkk#..',
    '..#kkkkkFFFFFFFFFFFFFFFFkkkkk#..',
    '..#kkkkFFFFFNNFFFFNNFFFFFkkkk#..',
    '..#kkkkFFFFFNNFFFFNNFFFFFkkkk#..',
    '..#kkkkFFFFFFFFFFFFFFFFFFkkkk#..',
    '..#kkkkkFFFFWWWWWWWWFFFFkkkkk#..',
    '..#kkkkkFFFFWWNNNNWWFFFFkkkkk#..',
    '..#kkkkkkffffWWWWWWffffkkkkkk#..',
    '..#kkkkkkkffffffffffffkkkkkkk#..',
    '..#kkkkkkkkkffffffffkkkkkkkkk#..',
    '..#kkkkkkkkkkkkkkkkkkkkkkkkkk#..',
    '..#yyyyyyyyyyyyyyyyyyyyyyyyyy#..',
    '..#YYYYYYYYYYYYYYYYYYYYYYYYYY#..',
    '..#YYLLLLLLLLLLLLLLLLLLLLLLYY#..',
    '..#YYYYYYYYYYYYYYYYYYYYYYYYYY#..',
    '...#yyyyyyyyyyyyyyyyyyyyyyyy#...',
    '....########################....',
  ],
  // 2: Staking Vault
  [
    '............########............',
    '.........###CCCCCCCC###.........',
    '.......##CCCLLLLLLLLCCC##.......',
    '.....##CCLLCCCCCCCCCCLLCC##.....',
    '....#CCLLCCCCCCCCCCCCCCLLCC#....',
    '...#CCLLCCCCCCCCCCCCCCCCLLCC#...',
    '..#CCLLCCCCCCCCCCCCCCCCCCLLCC#..',
    '..#cccccccccccccccccccccccccc#..',
    '..#kkkkkkkkkkkkkkkkkkkkkkkkkk#..',
    '..#kSSSSSSSSSSSSSSSSSSSSSSSSk#..',
    '..#kSssssssssssssssssssssssSk#..',
    '..#kSsGGssYYssGGssYYssGGsssSk#..',
    '..#kSssssssssssssssssssssssSk#..',
    '..#kSssssssssssssssssssssssSk#..',
    '..#kSssssssssssssssssssssssSk#..',
    '..#kSsGGssYYssGGssYYssGGsssSk#..',
    '..#kSssssssssssssssssssssssSk#..',
    '..#kSssssssssssssssssssssssSk#..',
    '..#kSssssssssssssssssssssssSk#..',
    '..#kSsGGssYYssGGssYYssGGsssSk#..',
    '..#kSssssssssssssssssssssssSk#..',
    '..#kSssssssssssssssssssssssSk#..',
    '..#kSssssssssssssssssssssssSk#..',
    '..#kSsGGssYYssRRssRRssGGsssSk#..',
    '..#kSssssssssssssssssssssssSk#..',
    '..#kSSSSSSSSSSSSSSSSSSSSSSSSk#..',
    '..#cccccccccccccccccccccccccc#..',
    '..#CCCCCCCCCCCCCCCCCCCCCCCCCC#..',
    '..#CCLLLLLLLLLLLLLLLLLLLLLLCC#..',
    '..#CCCCCCCCCCCCCCCCCCCCCCCCCC#..',
    '...#cccccccccccccccccccccccc#...',
    '....########################....',
  ],
  // 3: Lending Protocol
  [
    '............########............',
    '.........###AAAAAAAA###.........',
    '.......##AAALLLLLLLLAAA##.......',
    '.....##AALLAAAAAAAAAALLAA##.....',
    '....#AALLAAAAAAAAAAAAAALLAA#....',
    '...#AALLAAAAAAAAAAAAAAAAALLAA#..',
    '..#AALLAAAAAAAAAAAAAAAAAAAAALLA#',
    '..#aaaaaaaaaaaaaaaaaaaaaaaaaa#..',
    '..#kkkkkkkkkkkkkkkkkkkkkkkkkk#..',
    '..#kkkGGGGGGGGGGGGGGGGGGGGkkk#..',
    '..#kkkkkkkkkkkGGkkkkkkkkkkkkk#..',
    '..#kkkPPkkkkkkGGkkkkkkPPkkkkk#..',
    '..#kkkPPkkkGGGGGGGGkkkPPkkkkk#..',
    '..#kkkPPkkGGkkGGkkGGkkPPkkkkk#..',
    '..#kkkPPkkkGGGGGGGGkkkPPkkkkk#..',
    '..#kkkPPkkkkkkGGkkkkkkPPkkkkk#..',
    '..#kkkPPkkkkkkGGkkkkkkPPkkkkk#..',
    '..#kkkPPkkkkkkGGkkkkkkPPkkkkk#..',
    '..#kkkPPkkkkkGGGGkkkkkPPkkkkk#..',
    '..#kkkPPkkkkGGGGGGkkkkPPkkkkk#..',
    '..#kkkPPkkkGGGGGGGGkkkPPkkkkk#..',
    '..#kkkPPkkkkkkkkkkkkkkPPkkkkk#..',
    '..#kkkppkkkkkkkkkkkkkkppkkkkk#..',
    '..#kkkppkkkkkkkkkkkkkkppkkkkk#..',
    '..#kkkPPPPPPPPPPPPPPPPPPkkkkk#..',
    '..#kkkkkkkkkkkkkkkkkkkkkkkkkk#..',
    '..#aaaaaaaaaaaaaaaaaaaaaaaaaa#..',
    '..#AAAAAAAAAAAAAAAAAAAAAAAAAA#..',
    '..#AALLLLLLLLLLLLLLLLLLLLLLAA#..',
    '..#AAAAAAAAAAAAAAAAAAAAAAAAAA#..',
    '...#aaaaaaaaaaaaaaaaaaaaaaaa#...',
    '....########################....',
  ],
  // 4: Derivatives Exchange
  [
    '............########............',
    '.........###BBBBBBBB###.........',
    '.......##BBBLLLLLLLLBBB##.......',
    '.....##BBLLBBBBBBBBBBLLBB##.....',
    '....#BBLLBBBBBBBBBBBBBBLLBB#....',
    '...#BBLLBBBBBBBBBBBBBBBBLLBB#...',
    '..#BBLLBBBBBBBBBBBBBBBBBBLLBB#..',
    '..#bbbbbbbbbbbbbbbbbbbbbbbbbb#..',
    '..#kkkkkkkkkkkkkkkkkkkkkkkkkk#..',
    '..#kkWWWWWWWWWWWWWWWWWWWWWWkk#..',
    '..#kkWkkkkkkkkkkkkkkkkkkkkWkk#..',
    '..#kkWkkkkGGkkkkkkkkkkkkkkWkk#..',
    '..#kkWkkkkGGkkkkkkkkkkkkkkWkk#..',
    '..#kkWkkkkGGkkkRRkkkkkkkkkWkk#..',
    '..#kkWkkkGGGkkkRRkkkkGGkkkWkk#..',
    '..#kkWkkkGGGkkkRRkkkGGGkkkWkk#..',
    '..#kkWkkkGGGkkRRRkkkGGGkkkWkk#..',
    '..#kkWkkkkGGkkRRRkkkGGGkkkWkk#..',
    '..#kkWkkkkGGkkkRRkkkkGGkkkWkk#..',
    '..#kkWkkkkkkkkkRRkkkkGGkkkWkk#..',
    '..#kkWkkkkkkkkkRRkkkkkkkkkWkk#..',
    '..#kkWkkkkYYkYYkYYkYYkkkkkWkk#..',
    '..#kkWkkkkYYkYYkYYkYYkkkkkWkk#..',
    '..#kkWWWWWWWWWWWWWWWWWWWWWWkk#..',
    '..#kkkkkkkkkkkkkkkkkkkkkkkkkk#..',
    '..#kkkkkkkkkkkkkkkkkkkkkkkkkk#..',
    '..#bbbbbbbbbbbbbbbbbbbbbbbbbb#..',
    '..#BBBBBBBBBBBBBBBBBBBBBBBBBB#..',
    '..#BBLLLLLLLLLLLLLLLLLLLLLLBB#..',
    '..#BBBBBBBBBBBBBBBBBBBBBBBBBB#..',
    '...#bbbbbbbbbbbbbbbbbbbbbbbb#...',
    '....########################....',
  ],
  // 5: Validator Citadel
  [
    '............########............',
    '.........###FFFFFFFF###.........',
    '.......##FFFLLLLLLLLFFF##.......',
    '.....##FFLLFFFFFFFFFFLLFF##.....',
    '....#FFLLFFFFFFFFFFFFFFLLFF#....',
    '...#FFLLFFFFFFFFFFFFFFFFLLFF#...',
    '..#FFLLFFFFFFFFFFFFFFFFFFLLFF#..',
    '..#ffffffffffffffffffffffffff#..',
    '..#kkkkkkkkkkkkWWkkkkkkkkkkkk#..',
    '..#kkkkkkkkkkkWWWWkkkkkkkkkkk#..',
    '..#kkkkkkkkkkkWWWWkkkkkkkkkkk#..',
    '..#kkkkkkkkkkkkWWkkkkkkkkkkkk#..',
    '..#kkkkkkkSSSSSGGSSSSSkkkkkkk#..',
    '..#kkkkkkkSsssSGGsSsssSkkkkkk#..',
    '..#kkkkkkkSsssSGGsSsssSkkkkkk#..',
    '..#kkkkkkkSsssSGGsSsssSkkkkkk#..',
    '..#kkkkkkkSsssSGGsSsssSkkkkkk#..',
    '..#kkkkkkkSSSSSGGSSSSSkkkkkkk#..',
    '..#kkkkkSSSSSSSGGSSSSSSSkkkkk#..',
    '..#kkkkkSsssssSGGsSsssssSkkkk#..',
    '..#kkkkkSsssssSGGsSsssssSkkkk#..',
    '..#kkkkkSsssssSGGsSsssssSkkkk#..',
    '..#kkkkkSSSSSSSGGSSSSSSSkkkkk#..',
    '..#kkkSSSSSSSSSGGSSSSSSSSSkkk#..',
    '..#kkkSsssssssSGGsSsssssssSkk#..',
    '..#kkkSSSSSSSSSSSSSSSSSSSSSkk#..',
    '..#ffffffffffffffffffffffffff#..',
    '..#FFFFFFFFFFFFFFFFFFFFFFFFFF#..',
    '..#FFLLLLLLLLLLLLLLLLLLLLLLFF#..',
    '..#FFFFFFFFFFFFFFFFFFFFFFFFFF#..',
    '...#ffffffffffffffffffffffff#...',
    '....########################....',
  ],
];

// -----------------------------------------------------------------------------
// Avatar Pixel Art Matrices (4 Player Avatars)
// -----------------------------------------------------------------------------

export const AVATAR_PALETTES: Palette[] = [
  // 0: Robinhood Archer / Sherwood
  {
    '.': [0, 0, 0, 0],
    '#': [11, 15, 25, 255],
    G: [0, 200, 5, 255],
    g: [0, 120, 30, 255],
    L: [100, 255, 120, 255],
    V: [0, 255, 200, 255],
    S: [240, 180, 140, 255],
    s: [190, 130, 95, 255],
    Y: [238, 195, 83, 255],
    W: [243, 244, 246, 255],
    K: [17, 24, 39, 255],
  },
  // 1: Crypto Doge / Luna
  {
    '.': [0, 0, 0, 0],
    '#': [11, 15, 25, 255],
    P: [255, 105, 180, 255],
    p: [200, 50, 120, 255],
    L: [255, 180, 220, 255],
    F: [229, 169, 60, 255],
    f: [180, 120, 30, 255],
    W: [255, 248, 220, 255],
    D: [20, 25, 35, 255],
    d: [60, 75, 95, 255],
    N: [10, 10, 15, 255],
    T: [239, 68, 68, 255],
  },
  // 2: Silicon VC / Investor
  {
    '.': [0, 0, 0, 0],
    '#': [11, 15, 25, 255],
    H: [75, 50, 35, 255],
    h: [45, 30, 20, 255],
    S: [245, 195, 160, 255],
    s: [205, 155, 120, 255],
    G: [100, 116, 139, 255],
    g: [148, 163, 184, 255],
    V: [30, 41, 59, 255],
    v: [51, 65, 85, 255],
    Z: [156, 163, 175, 255],
    C: [243, 244, 246, 255],
    P: [59, 130, 246, 255],
  },
  // 3: Wall Street Bull / Apex
  {
    '.': [0, 0, 0, 0],
    '#': [11, 15, 25, 255],
    B: [120, 53, 15, 255],
    b: [70, 30, 10, 255],
    H: [238, 195, 83, 255],
    h: [180, 140, 40, 255],
    L: [254, 240, 138, 255],
    S: [15, 23, 42, 255],
    P: [71, 85, 105, 255],
    W: [243, 244, 246, 255],
    R: [220, 38, 38, 255],
    N: [251, 191, 36, 255],
  },
];

export const AVATAR_MATRICES: string[][] = [
  // 0: Robinhood Archer / Sherwood
  [
    '................................',
    '...................##...........',
    '..................#YW#..........',
    '.................#YYW#..........',
    '................#YYW#...........',
    '...............#YYW#............',
    '............####gg####..........',
    '..........##gggggggggg##........',
    '.........#gggLLLLLLggggg#.......',
    '........#ggLLggggggLLgggg#......',
    '.......#ggLggggggggggLggg#......',
    '.......#gLggggggggggggLgg#......',
    '......#ggLgggKKKKKKgggLgg#......',
    '......#ggLggKKKKKKKKggLgg#......',
    '......#ggLgKKKKKKKKKKgLgg#......',
    '......#ggLgKVVVVVVVVKgLgg#......',
    '......#gggLKVVVVVVVVKgggL#......',
    '.......#gggKKsSSSSsKKggg#.......',
    '.......#gggKKsSSSSsKKggg#.......',
    '........#ggggKKssKKgggg#........',
    '.........#gggggssggggg#.........',
    '..........#gggggggggg#..........',
    '.......####gggggggggg####.......',
    '.....##gggggggggggggggggg##.....',
    '....#gggggggggggggggggggggg#....',
    '...#ggggggGggggggGgggggggggg#...',
    '..#ggggggGGggggggGGgggggggggg#..',
    '..#ggggggGGggggggGGgggggggggg#..',
    '..#ggggggGGggggggGGgggggggggg#..',
    '..#ggggggGGggggggGGgggggggggg#..',
    '...#gggggggggggggggggggggggg#...',
    '....########################....',
  ],
  // 1: Crypto Doge / Luna
  [
    '................................',
    '..........####....####..........',
    '.........#ffff#..#ffff#.........',
    '........#ffFFff##ffFFff#........',
    '........#fFFFFFF##FFFFFF#.......',
    '.......#ffffPPPPPPPPffff#.......',
    '......#ffffPPPPPPPPPPffff#......',
    '......#fffppLLLLLLLLppfff#......',
    '......#fffppPPPPPPPPppfff#......',
    '......#fffppppppppppppfff#......',
    '.....#FFFFFFFFFFFFFFFFFFFF#.....',
    '....#FFFFFFFFFFFFFFFFFFFFFF#....',
    '...#FFFFFDDDDDDFFDDDDDDFFFFF#...',
    '...#FFFFFDDddDDFFDDddDDFFFFF#...',
    '...#FFFFFDDddDDFFDDddDDFFFFF#...',
    '...#FFFFFDDDDDDFFDDDDDDFFFFF#...',
    '...#FFFFFFFFFFFFFFFFFFFFFFFF#...',
    '...#FFFFFFFFFFFFFFFFFFFFFFFF#...',
    '....#FFFFFWWWWWWWWWWWWWFFFF#....',
    '.....#FFFFWWWWWWWWWWWWWFFF#.....',
    '......#FFFWWWWNNNNWWWWFFF#......',
    '.......#ffWWWWNNNNWWWWff#.......',
    '........#ffWWWWWWWWWWff#........',
    '.........#fffWWTTWWfff#.........',
    '..........#fffWWWWfff#..........',
    '.........##ffffffffffff##.......',
    '........#FFFFFFFFFFFFFFFF#......',
    '.......#FFFFFFFFFFFFFFFFFF#.....',
    '......#FFFFFWWWWWWWWWFFFFF#.....',
    '......#FFFFFWWWWWWWWWFFFFF#.....',
    '.......#fffffffffffffFFFF#......',
    '........################........',
  ],
  // 2: Silicon VC / Investor
  [
    '................................',
    '............########............',
    '..........##HHHHHHHH##..........',
    '........##HHHHHHHHHHHH##........',
    '.......#HHHHHHHHHHHHHHHH#.......',
    '......#HHHHHHHHHHHHHHHHHH#......',
    '......#HHHhhHHHHHHHHhhHHH#......',
    '......#HHhhSSSSSSSSSSssHH#......',
    '......#HHhSSSSSSSSSSSSsHH#......',
    '......#HHhSSGGSSGGSSSSsHH#......',
    '......#HHhSSGgSSGgSSSSsHH#......',
    '......#HHhSSGGSSGGSSSSsHH#......',
    '.......#HhSSSSSSSSSSSSsH#.......',
    '........#sSSSSsSSsSSSSs#........',
    '........#sSSSSssssSSSSs#........',
    '.........#sSSSSSSSSSSs#.........',
    '..........#ssSSSSSSss#..........',
    '...........#sssCCsss#...........',
    '.........###vvvCCvvv###.........',
    '.......##VVVvvvCCvvvVVV##.......',
    '......#VVVVVVVvZZvVVVVVVV#......',
    '.....#VVVVVVVVvZZvVVVVVVVV#.....',
    '....#VVVVVVVVVvZZvVVVVVVVVV#....',
    '...#VVVVVVVVVVvZZvVVVVVVVVVV#...',
    '...#VVVVVVVVVVvZZvVVVVVVVVVV#...',
    '...#VVVVVVVVVVvZZvVVVVVPPPPV#...',
    '...#VVVVVVVVVVvZZvVVVVVPPPPV#...',
    '...#VVVVVVVVVVvZZvVVVVVPPPPV#...',
    '...#VVVVVVVVVVvZZvVVVVVPPPPV#...',
    '....#VVVVVVVVVvZZvVVVVVVVVV#....',
    '.....#vvvvvvvvvZZvvvvvvvvv#.....',
    '......###################.......',
  ],
  // 3: Wall Street Bull / Apex
  [
    '................................',
    '......###..............###......',
    '.....#LLH#............#HLL#.....',
    '....#HHHHh#..........#hHHHH#....',
    '...#HHHHHh#..........#hHHHHH#...',
    '...#HHHHhh#..........#hhHHHH#...',
    '....#HHhh##..........##hhHH#....',
    '.....####BB##########BB####.....',
    '......#BBBBBBBBBBBBBBBBBB#......',
    '.....#BBBBBBBBBBBBBBBBBBBB#.....',
    '....#BBBBBBBBBBBBBBBBBBBBBB#....',
    '...#BBBB##BBBBBBBBBB##BBBBB#....',
    '...#BBBB##BBBBBBBBBB##BBBBB#....',
    '...#BBBBBBBBBBBBBBBBBBBBBBBB#...',
    '...#BBBBBBBBBBBBBBBBBBBBBBBB#...',
    '....#BBBBBBBBBNNNBBBBBBBBBB#....',
    '.....#BBBBBBBBNNNBBBBBBBBB#.....',
    '......#bbbbbbbbbbbbbbbbbb#......',
    '.......#bbbbbbbbbbbbbbbb#.......',
    '........#bbbbWWWWWWbbbb#........',
    '.........#bbWWWRRWWbb#..........',
    '.......###SSSWWRRWWWSSS###......',
    '.....##SSSSSSWWRRWWWSSSSSS##....',
    '....#SSSSPPSSWWRRWWWSSPPSSSS#...',
    '...#SSSSPSSSSWWRRWWWSSSPSSSS#...',
    '..#SSSSSPSSSSWWRRWWWSSSPSSSSS#..',
    '..#SSSSSPSSSSWWRRWWWSSSPSSSSS#..',
    '..#SSSSSPSSSSWWRRWWWSSSPSSSSS#..',
    '..#SSSSSPSSSSWWRRWWWSSSPSSSSS#..',
    '...#SSSSPPSSSWWRRWWWSSSPPSSS#...',
    '....#SSSSSSSSSSSSSSSSSSSSSS#....',
    '.....######################.....',
  ],
];

// -----------------------------------------------------------------------------
// Currency Tokens and UI Badges Matrices
// -----------------------------------------------------------------------------

export const COIN_WIF_PALETTE: Palette = {
  '.': [0, 0, 0, 0],
  '#': [11, 15, 25, 255],
  Y: [238, 195, 83, 255],
  y: [180, 130, 20, 255],
  L: [255, 240, 138, 255],
  P: [255, 105, 180, 255],
  p: [200, 50, 120, 255],
  w: [255, 255, 255, 255],
  F: [229, 169, 60, 255],
  f: [180, 120, 30, 255],
  W: [255, 248, 220, 255],
  N: [10, 10, 15, 255],
};

export const COIN_WIF_MATRIX: string[] = [
  '................................',
  '.........##############.........',
  '.......##YYYLLLLLLLLYYY##.......',
  '.....##YYLLYYYYYYYYYYLLYY##.....',
  '....#YYLLYYYYYYYYYYYYYYLLYY#....',
  '...#YYLYYYYYYYYYYYYYYYYYYLYY#...',
  '..#YYLYYYYYYYYYYYYYYYYYYYYLYY#..',
  '..#yyYYYYYYYYYYYYYYYYYYYYYYyy#..',
  '..#yyYYYYYYYYYwYYYYYYYYYYYYyy#..',
  '..#yyYYYYYYYppPpPpYYYYYYYYYyy#..',
  '..#yyYYYYYYpPPPPPPpYYYYYYYYyy#..',
  '..#yyYYYYYpPPPPPPPPpYYYYYYYyy#..',
  '..#yyYYYYYpPPPPPPPPpYYYYYYYyy#..',
  '..#yyYYYYYYppppppppYYYYYYYYyy#..',
  '..#yyYYYYYFFFFFFFFFFYYYYYYYyy#..',
  '..#yyYYYYFFFFFFFFFFFFYYYYYYyy#..',
  '..#yyYYYFFFFFNNFFFFNNYYYYYYyy#..',
  '..#yyYYYFFFFFNNFFFFNNYYYYYYyy#..',
  '..#yyYYYYFFFFFFFFFFFFYYYYYYyy#..',
  '..#yyYYYYYFFFWWWWFFFFYYYYYYyy#..',
  '..#yyYYYYYFFFNNNNFFFFYYYYYYyy#..',
  '..#yyYYYYYYffWWWWffYYYYYYYYyy#..',
  '..#yyYYYYYYYffffffYYYYYYYYYyy#..',
  '..#yyYYYYYYYYYYYYYYYYYYYYYYyy#..',
  '..#YYLYYYYYYYYYYYYYYYYYYYYLYY#..',
  '...#YYLYYYYYYYYYYYYYYYYYYLYY#...',
  '....#YYLLYYYYYYYYYYYYYYLLYY#....',
  '.....##YYLLYYYYYYYYYYLLYY##.....',
  '.......##YYYLLLLLLLLYYY##.......',
  '.........##############.........',
  '................................',
  '................................',
];

export const NOTE_USDG_PALETTE: Palette = {
  '.': [0, 0, 0, 0],
  '#': [11, 15, 25, 255],
  G: [0, 200, 5, 255],
  w: [230, 247, 237, 255],
  d: [18, 56, 38, 255],
  '1': [18, 56, 38, 255],
  '0': [18, 56, 38, 255],
};

export const NOTE_USDG_MATRIX: string[] = [
  '................................',
  '..############################..',
  '..#GGGGGGGGGGGGGGGGGGGGGGGGGG#..',
  '..#GwwwwwwwwwwwwwwwwwwwwwwwwG#..',
  '..#GwGGGGGGGGGGGGGGGGGGGGGGwG#..',
  '..#GwG10wwwwwwwwwwwwwwww10GwG#..',
  '..#GwGwwwwwww######wwwwwwwGwG#..',
  '..#GwGwwwwww#dddddd#wwwwwwGwG#..',
  '..#GwGwwwww#ddGGGGdd#wwwwwGwG#..',
  '..#GwGwwwww#ddGGGGdd#wwwwwGwG#..',
  '..#GwGwwww#ddG#dd#Gdd#wwwwGwG#..',
  '..#GwGwwww#ddG#dd#Gdd#wwwwGwG#..',
  '..#GwGwwww#dddGGGGddd#wwwwGwG#..',
  '..#GwGwwww#ddddGGdddd#wwwwGwG#..',
  '..#GwGwwww#dddGGGGddd#wwwwGwG#..',
  '..#GwGwwww#dd#dd#Gddd#wwwwGwG#..',
  '..#GwGwwww#dd#dd#Gddd#wwwwGwG#..',
  '..#GwGwwwww#ddGGGGdd#wwwwwGwG#..',
  '..#GwGwwwww#ddGGGGdd#wwwwwGwG#..',
  '..#GwGwwwwww#dddddd#wwwwwwGwG#..',
  '..#GwGwwwwwww######wwwwwwwGwG#..',
  '..#GwGwwwwwwwwwwwwwwwwwwwwGwG#..',
  '..#GwG10wwwwwwwwwwwwwwww10GwG#..',
  '..#GwGGGGGGGGGGGGGGGGGGGGGGwG#..',
  '..#GwwwwwwwwwwwwwwwwwwwwwwwwG#..',
  '..#GGGGGGGGGGGGGGGGGGGGGGGGGG#..',
  '..############################..',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
];

export const TOKEN_PALETTES: Palette[] = [
  // Player 0: Emerald Green
  {
    '.': [0, 0, 0, 0],
    '#': [11, 15, 25, 255],
    C: [0, 200, 5, 255],
    c: [0, 110, 3, 255],
    L: [92, 255, 98, 255],
    W: [255, 255, 255, 255],
  },
  // Player 1: Bullion Gold
  {
    '.': [0, 0, 0, 0],
    '#': [11, 15, 25, 255],
    C: [238, 195, 83, 255],
    c: [140, 110, 30, 255],
    L: [255, 232, 153, 255],
    W: [255, 255, 255, 255],
  },
  // Player 2: Ocean Cyan
  {
    '.': [0, 0, 0, 0],
    '#': [11, 15, 25, 255],
    C: [41, 182, 246, 255],
    c: [2, 119, 189, 255],
    L: [129, 212, 250, 255],
    W: [255, 255, 255, 255],
  },
  // Player 3: Sunset Coral / Red
  {
    '.': [0, 0, 0, 0],
    '#': [11, 15, 25, 255],
    C: [255, 112, 67, 255],
    c: [198, 63, 23, 255],
    L: [255, 171, 145, 255],
    W: [255, 255, 255, 255],
  },
  // Player 4: Royal Purple
  {
    '.': [0, 0, 0, 0],
    '#': [11, 15, 25, 255],
    C: [171, 71, 188, 255],
    c: [123, 31, 162, 255],
    L: [225, 190, 231, 255],
    W: [255, 255, 255, 255],
  },
  // Player 5: Neon Rose
  {
    '.': [0, 0, 0, 0],
    '#': [11, 15, 25, 255],
    C: [236, 64, 122, 255],
    c: [194, 24, 91, 255],
    L: [248, 187, 208, 255],
    W: [255, 255, 255, 255],
  },
];

export const TOKEN_MATRICES: string[][] = [
  // Token 0: Arrow/Feather
  [
    '................................',
    '.........##############.........',
    '.......##CCCLLLLLLLLCCC##.......',
    '.....##CCLLCCCCCCCCCCLLCC##.....',
    '....#CCLLCCCCCCCCCCCCCCLLCC#....',
    '...#CCLLCCCCCCCWWCCCCCCCLLCC#...',
    '..#CCLLCCCCCCCWWWWCCCCCCCLLCC#..',
    '..#cCCCCCCCCCCWWWWCCCCCCCCCCc#..',
    '..#cCCCCCCCCCWWWWWWCCCCCCCCCc#..',
    '..#cCCCCCCCCWWWWWWWWCCCCCCCCc#..',
    '..#cCCCCCCCCWWWWWWWWCCCCCCCCc#..',
    '..#cCCCCCCCCCCCWWCCCCCCCCCCCc#..',
    '..#cCCCCCCCCCCCWWCCCCCCCCCCCc#..',
    '..#cCCCCCCCCCCCWWCCCCCCCCCCCc#..',
    '..#cCCCCCCCCCCCWWCCCCCCCCCCCc#..',
    '..#cCCCCCCCCCCCWWCCCCCCCCCCCc#..',
    '..#cCCCCCCCCCCCWWCCCCCCCCCCCc#..',
    '..#cCCCCCCCCCCCWWCCCCCCCCCCCc#..',
    '..#cCCCCCCCCCCCWWCCCCCCCCCCCc#..',
    '..#cCCCCCCCCCCCWWCCCCCCCCCCCc#..',
    '..#cCCCCCCCCCCCCCCCCCCCCCCCCc#..',
    '..#cCCCCCCCCCCCCCCCCCCCCCCCCc#..',
    '..#cCCCCCCCCCCCCCCCCCCCCCCCCc#..',
    '..#cCCCCCCCCCCCCCCCCCCCCCCCCc#..',
    '..#CCLLCCCCCCCCCCCCCCCCCCLLCC#..',
    '...#CCLLCCCCCCCCCCCCCCCCLLCC#...',
    '....#CCLLCCCCCCCCCCCCCCLLCC#....',
    '.....##CCLLCCCCCCCCCCLLCC##.....',
    '.......##CCCLLLLLLLLCCC##.......',
    '.........##############.........',
    '................................',
    '................................',
  ],
  // Token 1: Bull Horns
  [
    '................................',
    '.........##############.........',
    '.......##CCCLLLLLLLLCCC##.......',
    '.....##CCLLCCCCCCCCCCLLCC##.....',
    '....#CCLLCCCCCCCCCCCCCCLLCC#....',
    '...#CCLLCCWWCCCCCCWWCCCCLLCC#...',
    '..#CCLLCCCWWWCCCCWWWCCCCCLLCC#..',
    '..#cCCCCCCWWWWCCWWWWCCCCCCCCc#..',
    '..#cCCCCCCCWWWWWWWWCCCCCCCCCc#..',
    '..#cCCCCCCCCWWWWWWCCCCCCCCCCc#..',
    '..#cCCCCCCCCCWWWWCCCCCCCCCCCc#..',
    '..#cCCCCCCCCCCWWCCCCCCCCCCCCc#..',
    '..#cCCCCCCCCCWWWWCCCCCCCCCCCc#..',
    '..#cCCCCCCCCWWWWWWCCCCCCCCCCc#..',
    '..#cCCCCCCCWWWWWWWWCCCCCCCCCc#..',
    '..#cCCCCCCCWWWWWWWWCCCCCCCCCc#..',
    '..#cCCCCCCCCWWWWWWCCCCCCCCCCc#..',
    '..#cCCCCCCCCCWWWWCCCCCCCCCCCc#..',
    '..#cCCCCCCCCCCCCCCCCCCCCCCCCc#..',
    '..#cCCCCCCCCCCCCCCCCCCCCCCCCc#..',
    '..#cCCCCCCCCCCCCCCCCCCCCCCCCc#..',
    '..#cCCCCCCCCCCCCCCCCCCCCCCCCc#..',
    '..#cCCCCCCCCCCCCCCCCCCCCCCCCc#..',
    '..#cCCCCCCCCCCCCCCCCCCCCCCCCc#..',
    '..#CCLLCCCCCCCCCCCCCCCCCCLLCC#..',
    '...#CCLLCCCCCCCCCCCCCCCCLLCC#...',
    '....#CCLLCCCCCCCCCCCCCCLLCC#....',
    '.....##CCLLCCCCCCCCCCLLCC##.....',
    '.......##CCCLLLLLLLLCCC##.......',
    '.........##############.........',
    '................................',
    '................................',
  ],
  // Token 2: Doge Paw
  [
    '................................',
    '.........##############.........',
    '.......##CCCLLLLLLLLCCC##.......',
    '.....##CCLLCCCCCCCCCCLLCC##.....',
    '....#CCLLCCCCCCCCCCCCCCLLCC#....',
    '...#CCLLCCWWCCCCCCWWCCCCLLCC#...',
    '..#CCLLCCCWWCCCCCCWWCCCCCLLCC#..',
    '..#cCCCCCCCWWCCCCWWCCCCCCCCCc#..',
    '..#cCCCCWWCCCCCCCCCCWWCCCCCCc#..',
    '..#cCCCWWWWCCCCCCCCWWWWCCCCCc#..',
    '..#cCCCWWWWCCCCCCCCWWWWCCCCCc#..',
    '..#cCCCCWWCCCCCCCCCCWWCCCCCCc#..',
    '..#cCCCCCCCCCCWWCCCCCCCCCCCCc#..',
    '..#cCCCCCCCCWWWWWWCCCCCCCCCCc#..',
    '..#cCCCCCCCWWWWWWWWCCCCCCCCCc#..',
    '..#cCCCCCCCWWWWWWWWCCCCCCCCCc#..',
    '..#cCCCCCCCWWWWWWWWCCCCCCCCCc#..',
    '..#cCCCCCCCCWWWWWWCCCCCCCCCCc#..',
    '..#cCCCCCCCCCWWWWCCCCCCCCCCCc#..',
    '..#cCCCCCCCCCCCCCCCCCCCCCCCCc#..',
    '..#cCCCCCCCCCCCCCCCCCCCCCCCCc#..',
    '..#cCCCCCCCCCCCCCCCCCCCCCCCCc#..',
    '..#cCCCCCCCCCCCCCCCCCCCCCCCCc#..',
    '..#cCCCCCCCCCCCCCCCCCCCCCCCCc#..',
    '..#CCLLCCCCCCCCCCCCCCCCCCLLCC#..',
    '...#CCLLCCCCCCCCCCCCCCCCLLCC#...',
    '....#CCLLCCCCCCCCCCCCCCLLCC#....',
    '.....##CCLLCCCCCCCCCCLLCC##.....',
    '.......##CCCLLLLLLLLCCC##.......',
    '.........##############.........',
    '................................',
    '................................',
  ],
  // Token 3: Crosshair Target
  [
    '................................',
    '.........##############.........',
    '.......##CCCLLLLLLLLCCC##.......',
    '.....##CCLLCCCCCCCCCCLLCC##.....',
    '....#CCLLCCCCCCCCCCCCCCLLCC#....',
    '...#CCLLCCCCCCCWWCCCCCCCLLCC#...',
    '..#CCLLCCCCCCCCWWCCCCCCCCLLCC#..',
    '..#cCCCCCCCCCCCWWCCCCCCCCCCCc#..',
    '..#cCCCCCCCCCCCWWCCCCCCCCCCCc#..',
    '..#cCCCCCCWWWWWWWWWWWWCCCCCCc#..',
    '..#cCCCCCCWCCCCCCCCCCWCCCCCCc#..',
    '..#cCCCCCCWCCCCWWCCCCWCCCCCCc#..',
    '..#cWWWWWWWWCCWWWWCCWWWWWWWWc#..',
    '..#cWWWWWWWWCCWWWWCCWWWWWWWWc#..',
    '..#cCCCCCCWCCCCWWCCCCWCCCCCCc#..',
    '..#cCCCCCCWCCCCCCCCCCWCCCCCCc#..',
    '..#cCCCCCCWWWWWWWWWWWWCCCCCCc#..',
    '..#cCCCCCCCCCCCWWCCCCCCCCCCCc#..',
    '..#cCCCCCCCCCCCWWCCCCCCCCCCCc#..',
    '..#cCCCCCCCCCCCWWCCCCCCCCCCCc#..',
    '..#cCCCCCCCCCCCWWCCCCCCCCCCCc#..',
    '..#cCCCCCCCCCCCCCCCCCCCCCCCCc#..',
    '..#cCCCCCCCCCCCCCCCCCCCCCCCCc#..',
    '..#cCCCCCCCCCCCCCCCCCCCCCCCCc#..',
    '..#CCLLCCCCCCCCCCCCCCCCCCLLCC#..',
    '...#CCLLCCCCCCCCCCCCCCCCLLCC#...',
    '....#CCLLCCCCCCCCCCCCCCLLCC#....',
    '.....##CCLLCCCCCCCCCCLLCC##.....',
    '.......##CCCLLLLLLLLCCC##.......',
    '.........##############.........',
    '................................',
    '................................',
  ],
];

export const ICON_TRADE_PALETTE: Palette = {
  '.': [0, 0, 0, 0],
  '#': [11, 15, 25, 255],
  B: [56, 189, 248, 255],
  b: [2, 132, 199, 255],
  P: [168, 85, 247, 255],
  p: [126, 34, 206, 255],
  S: [252, 211, 77, 255],
  s: [245, 158, 11, 255],
  G: [0, 200, 5, 255],
  W: [255, 255, 255, 255],
};

export const ICON_TRADE_MATRIX: string[] = [
  '................................',
  '................................',
  '............########............',
  '...........#WWWWWWWW#...........',
  '..........#WGGGGGGGGW#..........',
  '.........#WGGGGGGGGGGW#.........',
  '........#WGGGGWWGGGGGGW#........',
  '.........#WGGGGGGGGGGW#.........',
  '..........#WGGGGGGGGW#..........',
  '...........#WWWWWWWW#...........',
  '............########............',
  '..######................######..',
  '.#BBBBBB#..............#PPPPPP#.',
  '#BBbbBBBB#............#PPPPppPP#',
  '#BBbbBBBB#...######...#PPPPppPP#',
  '#BBbbBBBB###SSSSSSSS###PPPPppPP#',
  '#BBbbBBBB##SSSSSSSSSS##PPPPppPP#',
  '#BBbbBBBB#SSsSSSSSSsSS#PPPPppPP#',
  '.#BBBBBB#SSSSsSSSSsSSSS#PPPPPP#.',
  '..######SSSSSsSSSSsSSSSS######..',
  '.......#SSSSSSSSSSSSSSSS#.......',
  '.......#SSssSSSSSSSSssSS#.......',
  '........#SssSSSSSSSSssS#........',
  '.........#SSSSSSSSSSSS#.........',
  '..........#SSSSSSSSSS#..........',
  '...........#SSSSSSSS#...........',
  '............#SSSSSS#............',
  '.............######.............',
  '................................',
  '................................',
  '................................',
  '................................',
];

export const ICON_BUILD_PALETTE: Palette = {
  '.': [0, 0, 0, 0],
  '#': [11, 15, 25, 255],
  S: [203, 213, 225, 255],
  s: [100, 116, 139, 255],
  L: [255, 255, 255, 255],
  G: [0, 200, 5, 255],
  g: [0, 120, 30, 255],
};

export const ICON_BUILD_MATRIX: string[] = [
  '................................',
  '...................########.....',
  '.................##SSSSSSSS##...',
  '................#SSSsSSsSSSS#...',
  '...............#SSSs....sSSSS#..',
  '..............#SSSs......sSSS#..',
  '..............#SSS........sSS#..',
  '.............#SSS..........sS#..',
  '.............#SSS.........sSS#..',
  '..............#SSS.......sSSS#..',
  '...............#SSSs....sSSSS#..',
  '................#SSSsSSsSSSS#...',
  '.................##SSSSSS##.....',
  '...................#sGGs#.......',
  '..................#sGGGGs#......',
  '.................#sGGGGGGs#.....',
  '................#sGGGGGGGGs#....',
  '...............#sGGGGGGGGGGs#...',
  '..............#sGGGGGGGGGGGGs#..',
  '.............#sGGGGGGGGGGGGGGs#.',
  '............#sGGGGGGGGGGGGGGGGs#',
  '...........#sGGGGGGGGGGGGGGGGs#.',
  '..........#sGGGGGGGGGGGGGGGGs#..',
  '.........#sGGGGGGGGGGGGGGGGs#...',
  '........#sGGGGGGGGGGGGGGGGs#....',
  '.......#sGGGGGGGGGGGGGGGGs#.....',
  '......#sGGGGGGGGGGGGGGGGs#......',
  '.....#sggggggggggggggggs#.......',
  '....#ssssssssssssssssss#........',
  '...####################.........',
  '................................',
  '................................',
];

export const STAMP_FILLED_PALETTE: Palette = {
  '.': [0, 0, 0, 0],
  '#': [11, 15, 25, 255],
  C: [0, 255, 200, 255],
  G: [0, 200, 5, 255],
  k: [17, 24, 39, 255],
  W: [255, 255, 255, 255],
};

export const STAMP_FILLED_MATRIX: string[] = [
  '................................',
  '..############################..',
  '.#CCCCCCCCCCCCCCCCCCCCCCCCCCCC#.',
  '.#CkkkkkkkkkkkkkkkkkkkkkkkkkkC#.',
  '.#Ck########################kC#.',
  '.#Ck#WWWW#W#W####W####WWWW##kC#.',
  '.#Ck#W####W#W####W####W#####kC#.',
  '.#Ck#WWWW#W#W####W####WWWW##kC#.',
  '.#Ck#W####W#W####W####W#####kC#.',
  '.#Ck#W####W#WWWW#WWWW#WWWW##kC#.',
  '.#Ck########################kC#.',
  '.#Ck########################kC#.',
  '.#Ck#GGGGGGGGGGGGGGGGGGGGGG#kC#.',
  '.#Ck#GGGGGGGGGGGGGGGGGGGGGG#kC#.',
  '.#Ck########################kC#.',
  '.#Ck#WWWW#WWWW#W#W#W#WWWW###kC#.',
  '.#Ck#W####W##W#W#W#W#W##W###kC#.',
  '.#Ck#WWWW#WWWW#W#W#W#WWWW###kC#.',
  '.#Ck####W#W####W#W#W#W######kC#.',
  '.#Ck#WWWW#W####WWWWW#W######kC#.',
  '.#Ck########################kC#.',
  '.#Ck########################kC#.',
  '.#Ck#CCCCCCCCCCCCCCCCCCCCCC#kC#.',
  '.#Ck#CCCCCCCCCCCCCCCCCCCCCC#kC#.',
  '.#Ck########################kC#.',
  '.#CkkkkkkkkkkkkkkkkkkkkkkkkkkC#.',
  '.#CCCCCCCCCCCCCCCCCCCCCCCCCCCC#.',
  '..############################..',
  '................................',
  '................................',
  '................................',
  '................................',
];

// -----------------------------------------------------------------------------
// Procedural Board Map Rasterizer (1100x730 Canvas)
// -----------------------------------------------------------------------------

export interface DistrictConfig {
  id: number;
  name: string;
  x: number;
  y: number;
  accent: RgbaColor;
  accentHex: string;
  rows: number[][];
}

export const DISTRICT_BLOCKS: DistrictConfig[] = [
  {
    id: 0,
    name: 'ROBINHOOD DISTRICT',
    x: 92,
    y: 100,
    accent: [0, 200, 5, 255],
    accentHex: '#00C805',
    rows: [
      [1, 2, 3],
      [0, 1, 2, 3],
      [0, 1, 2],
      [0, 1],
    ],
  },
  {
    id: 1,
    name: 'WALL STREET QUARTER',
    x: 399,
    y: 105,
    accent: [238, 195, 83, 255],
    accentHex: '#EEC353',
    rows: [
      [0, 1],
      [0, 1, 2],
      [0, 1, 2, 3],
      [1, 2, 3],
    ],
  },
  {
    id: 2,
    name: 'CRYPTO WHARF',
    x: 747,
    y: 120,
    accent: [41, 182, 246, 255],
    accentHex: '#29B6F6',
    rows: [
      [0, 1, 2],
      [0, 1, 2],
      [0, 1, 2, 3],
      [2, 3],
    ],
  },
  {
    id: 3,
    name: 'SILICON STRIP',
    x: 156,
    y: 439,
    accent: [171, 71, 188, 255],
    accentHex: '#AB47BC',
    rows: [
      [1, 2],
      [1, 2, 3],
      [0, 1, 2],
      [0, 1, 2, 3],
    ],
  },
  {
    id: 4,
    name: 'MEMECOIN BOULEVARD',
    x: 464,
    y: 404,
    accent: [255, 112, 67, 255],
    accentHex: '#FF7043',
    rows: [
      [0, 1, 2, 3],
      [0, 1, 2],
      [0, 1],
      [0, 1, 2],
    ],
  },
  {
    id: 5,
    name: 'DEFI CITADEL',
    x: 796,
    y: 451,
    accent: [88, 124, 154, 255],
    accentHex: '#587C9A',
    rows: [
      [1, 2, 3],
      [0, 1, 2, 3],
      [0, 1],
      [0, 1, 2],
    ],
  },
];

export function generateBoardMapRgba(width = 1100, height = 730): Buffer {
  const buf = Buffer.alloc(width * height * 4);

  // Helper pixel drawer
  function setPx(x: number, y: number, r: number, g: number, b: number, a = 255): void {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const idx = (y * width + x) * 4;
    buf[idx] = r;
    buf[idx + 1] = g;
    buf[idx + 2] = b;
    buf[idx + 3] = a;
  }

  function fillRect(rx: number, ry: number, rw: number, rh: number, r: number, g: number, b: number, a = 255): void {
    const x0 = Math.max(0, rx);
    const y0 = Math.max(0, ry);
    const x1 = Math.min(width, rx + rw);
    const y1 = Math.min(height, ry + rh);
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const idx = (y * width + x) * 4;
        buf[idx] = r;
        buf[idx + 1] = g;
        buf[idx + 2] = b;
        buf[idx + 3] = a;
      }
    }
  }

  // 1. Base dark background (#0B0F19)
  fillRect(0, 0, width, height, 11, 15, 25, 255);

  // Subtle background tactile speckling
  for (let y = 0; y < height; y += 4) {
    for (let x = 0; x < width; x += 4) {
      const hash = (x * 17 + y * 23) % 73;
      if (hash === 0) {
        fillRect(x, y, 2, 2, 16, 23, 38, 255);
      } else if (hash === 1) {
        fillRect(x, y, 2, 2, 26, 35, 58, 255);
      }
    }
  }

  // 2. Marina water on eastern edge
  for (let x = 1040; x < width; x++) {
    const factor = (x - 1040) / (width - 1040);
    const wr = Math.floor(19 + factor * 5);
    const wg = Math.floor(34 + factor * 10);
    const wb = Math.floor(56 + factor * 25);
    fillRect(x, 0, 1, height, wr, wg, wb, 255);
  }
  // Wave glints on water
  for (let y = 20; y < height; y += 18) {
    for (let x = 1045; x < width - 10; x += 15) {
      const glintX = x + ((y * 7) % 9);
      fillRect(glintX, y, 6, 2, 41, 182, 246, 180);
    }
  }

  // 3. Roads and Streets
  // Horizontal Street 1: Upper Avenue (y: 35 to 75)
  fillRect(0, 35, 1040, 40, 31, 46, 71); // Curbs
  fillRect(0, 38, 1040, 34, 22, 31, 48); // Asphalt
  // Dashed lane divider
  for (let x = 0; x < 1040; x += 24) {
    fillRect(x, 54, 12, 2, 245, 197, 66);
  }

  // Horizontal Street 2: Central Boulevard (y: 345 to 395)
  fillRect(0, 345, 1040, 50, 31, 46, 71); // Curbs
  fillRect(0, 348, 1040, 44, 22, 31, 48); // Asphalt
  for (let x = 0; x < 1040; x += 24) {
    fillRect(x, 369, 12, 2, 245, 197, 66);
  }

  // Horizontal Street 3: South Perimeter (y: 675 to 715)
  fillRect(0, 675, 1040, 40, 31, 46, 71);
  fillRect(0, 678, 1040, 34, 22, 31, 48);
  for (let x = 0; x < 1040; x += 24) {
    fillRect(x, 694, 12, 2, 245, 197, 66);
  }

  // Vertical Street 1: West Ring Road (x: 25 to 65)
  fillRect(25, 0, 40, height, 31, 46, 71);
  fillRect(28, 0, 34, height, 22, 31, 48);
  for (let y = 0; y < height; y += 24) {
    fillRect(44, y, 2, 12, 245, 197, 66);
  }

  // Vertical Street 2: North Connector 1 (x: 325 to 370, y: 35 to 395)
  fillRect(325, 35, 45, 360, 31, 46, 71);
  fillRect(328, 35, 39, 360, 22, 31, 48);
  for (let y = 35; y < 395; y += 24) {
    fillRect(346, y, 2, 12, 76, 102, 154);
  }

  // Vertical Street 3: North Connector 2 (x: 645 to 695, y: 35 to 395)
  fillRect(645, 35, 50, 360, 31, 46, 71);
  fillRect(648, 35, 44, 360, 22, 31, 48);
  for (let y = 35; y < 395; y += 24) {
    fillRect(669, y, 2, 12, 76, 102, 154);
  }

  // Vertical Street 4: South Connector 1 (x: 395 to 440, y: 345 to 715)
  fillRect(395, 345, 45, 370, 31, 46, 71);
  fillRect(398, 345, 39, 370, 22, 31, 48);
  for (let y = 345; y < 715; y += 24) {
    fillRect(416, y, 2, 12, 76, 102, 154);
  }

  // Vertical Street 5: South Connector 2 (x: 715 to 765, y: 345 to 715)
  fillRect(715, 345, 50, 370, 31, 46, 71);
  fillRect(718, 345, 44, 370, 22, 31, 48);
  for (let y = 345; y < 715; y += 24) {
    fillRect(739, y, 2, 12, 76, 102, 154);
  }

  // Pedestrian Crosswalks (White Zebra Stripes)
  const crosswalks = [
    { x: 332, y: 150, vert: true },
    { x: 332, y: 280, vert: true },
    { x: 652, y: 170, vert: true },
    { x: 652, y: 300, vert: true },
    { x: 402, y: 480, vert: true },
    { x: 402, y: 620, vert: true },
    { x: 722, y: 510, vert: true },
    { x: 722, y: 640, vert: true },
    { x: 180, y: 350, vert: false },
    { x: 520, y: 350, vert: false },
    { x: 860, y: 350, vert: false },
  ];

  for (const cw of crosswalks) {
    if (cw.vert) {
      for (let s = 0; s < 5; s++) {
        fillRect(cw.x + s * 6, cw.y, 4, 16, 226, 232, 240);
      }
    } else {
      for (let s = 0; s < 5; s++) {
        fillRect(cw.x, cw.y + s * 6, 16, 4, 226, 232, 240);
      }
    }
  }

  // 4. District Envelopes and 72 Lots
  const CELL_SIZE = 50;
  const CELL_PITCH = 52;
  let globalLotId = 1;

  for (const block of DISTRICT_BLOCKS) {
    // District Header Banner above block
    const headerX = block.x;
    const headerY = block.y - 32;
    const headerW = 208;
    const headerH = 24;

    // Header container: dark fill, 2px district accent border
    fillRect(headerX, headerY, headerW, headerH, 15, 23, 42);
    // 2px border in district accent
    fillRect(headerX, headerY, headerW, 2, block.accent[0], block.accent[1], block.accent[2]);
    fillRect(headerX, headerY + headerH - 2, headerW, 2, block.accent[0], block.accent[1], block.accent[2]);
    fillRect(headerX, headerY, 2, headerH, block.accent[0], block.accent[1], block.accent[2]);
    fillRect(headerX + headerW - 2, headerY, 2, headerH, block.accent[0], block.accent[1], block.accent[2]);

    // Header neon glow corners
    fillRect(headerX - 1, headerY - 1, 3, 3, block.accent[0], block.accent[1], block.accent[2]);
    fillRect(headerX + headerW - 2, headerY - 1, 3, 3, block.accent[0], block.accent[1], block.accent[2]);

    // Render district title
    renderTextOnRgba(buf, width, height, block.name, headerX + 8, headerY + 8, [243, 244, 246, 255], 1);

    // Draw Lots in Block
    for (let r = 0; r < block.rows.length; r++) {
      const cols = block.rows[r];
      for (let c = 0; c < cols.length; c++) {
        const colIdx = cols[c];
        const px = block.x + colIdx * CELL_PITCH;
        const py = block.y + r * CELL_PITCH;

        // Lot background: dark slate (#182238)
        fillRect(px, py, CELL_SIZE, CELL_SIZE, 24, 34, 56);

        // Lot outer border: 1px in #374151
        fillRect(px, py, CELL_SIZE, 1, 55, 65, 81);
        fillRect(px, py + CELL_SIZE - 1, CELL_SIZE, 1, 55, 65, 81);
        fillRect(px, py, 1, CELL_SIZE, 55, 65, 81);
        fillRect(px + CELL_SIZE - 1, py, 1, CELL_SIZE, 55, 65, 81);

        // District accent corner tabs (4x4 px)
        fillRect(px + 1, py + 1, 4, 4, block.accent[0], block.accent[1], block.accent[2]);
        fillRect(
          px + CELL_SIZE - 5,
          py + CELL_SIZE - 5,
          4,
          4,
          block.accent[0],
          block.accent[1],
          block.accent[2]
        );

        // Lot center number badge (e.g. 18x12 box)
        const badgeW = 20;
        const badgeH = 12;
        const badgeX = px + Math.floor((CELL_SIZE - badgeW) / 2);
        const badgeY = py + Math.floor((CELL_SIZE - badgeH) / 2);
        fillRect(badgeX, badgeY, badgeW, badgeH, 15, 23, 42);
        // 1px badge border
        fillRect(badgeX, badgeY, badgeW, 1, 36, 51, 78);
        fillRect(badgeX, badgeY + badgeH - 1, badgeW, 1, 36, 51, 78);
        fillRect(badgeX, badgeY, 1, badgeH, 36, 51, 78);
        fillRect(badgeX + badgeW - 1, badgeY, 1, badgeH, 36, 51, 78);

        // Render lot number text
        const numStr = globalLotId.toString();
        const textW = numStr.length * 4 - 1;
        const numX = badgeX + Math.floor((badgeW - textW) / 2);
        const numY = badgeY + 4;
        renderTextOnRgba(buf, width, height, numStr, numX, numY, [243, 244, 246, 255], 1);

        globalLotId++;
      }
    }
  }

  return buf;
}

// -----------------------------------------------------------------------------
// Aseprite Fallback Compatibility Inspector
// -----------------------------------------------------------------------------

export function checkAsepriteFallback(artDir: string): {
  hasAsepriteFiles: boolean;
  hasJsonSheets: boolean;
  asepriteBin: string | null;
} {
  let hasAsepriteFiles = false;
  let hasJsonSheets = false;
  let asepriteBin: string | null = null;

  if (fs.existsSync(artDir)) {
    try {
      const files = fs.readdirSync(artDir, { recursive: true }) as string[];
      hasAsepriteFiles = files.some((f) => f.endsWith('.aseprite'));
      hasJsonSheets = files.some((f) => f.endsWith('.json'));
    } catch {
      // Ignored
    }
  }

  // Check system PATH for aseprite binary
  const candidates = [
    'aseprite',
    '/Applications/Aseprite.app/Contents/MacOS/aseprite',
    `${process.env.HOME}/Library/Application Support/Steam/steamapps/common/Aseprite/Aseprite.app/Contents/MacOS/aseprite`,
  ];
  for (const bin of candidates) {
    try {
      execSync(`"${bin}" --version`, { stdio: 'ignore' });
      asepriteBin = bin;
      break;
    } catch {
      // Continue searching
    }
  }

  return { hasAsepriteFiles, hasJsonSheets, asepriteBin };
}

// -----------------------------------------------------------------------------
// Master Asset Generation Entry Point
// -----------------------------------------------------------------------------

export async function generateAssets(targetDir?: string): Promise<void> {
  const root = targetDir ? path.resolve(targetDir) : process.cwd();
  const publicAssets = path.resolve(root, 'public/assets');
  const artDir = path.resolve(root, 'art');

  console.log(`[generate-assets] Root directory: ${root}`);
  console.log(`[generate-assets] Output directory: ${publicAssets}`);

  // 1. Aseprite Fallback Check
  const fallback = checkAsepriteFallback(artDir);
  if (fallback.hasAsepriteFiles && fallback.asepriteBin) {
    console.log(`[generate-assets] Found Aseprite binary at "${fallback.asepriteBin}". Extracting native art...`);
  } else if (fallback.hasJsonSheets) {
    console.log('[generate-assets] Found JSON sprite sheets in art/. Slicing frames...');
  } else {
    console.log(
      '[generate-assets] No local Aseprite files or sprite sheets detected in art/. Executing procedural pixel art generator.'
    );
  }

  // Ensure output directory tree exists
  const dirs = [
    publicAssets,
    path.join(publicAssets, 'shops'),
    path.join(publicAssets, 'avatars'),
    path.join(publicAssets, 'board'),
    path.join(publicAssets, 'city'),
    path.join(publicAssets, 'tokens'),
    path.join(publicAssets, 'materials'),
    path.join(publicAssets, 'ui'),
  ];
  for (const d of dirs) {
    fs.mkdirSync(d, { recursive: true });
  }

  // 2. Synthesize 6 Protocol Storefront Sprites (32x32 native and 96x96 HD)
  const shopSemanticNames = [
    'dex-exchange',
    'memecoin-lounge',
    'staking-vault',
    'lending-protocol',
    'derivatives-exchange',
    'validator-citadel',
  ];
  const shopLegacyAliases = ['coffee', 'banhmi', 'pho', 'flowers', 'tailor', 'grocery'];

  for (let i = 0; i < 6; i++) {
    const matrix = SHOP_MATRICES[i];
    const palette = SHOP_PALETTES[i];
    const rgba32 = matrixToRgba(matrix, palette, 32, 32);
    const png32 = encodePng(32, 32, rgba32);

    const rgba96 = scaleRgba(rgba32, 32, 32, 3);
    const png96 = encodePng(96, 96, rgba96);

    // Save indexed files
    fs.writeFileSync(path.join(publicAssets, 'shops', `shop_${i}.png`), png32);
    fs.writeFileSync(path.join(publicAssets, 'shops', `shop_${i}_hd.png`), png96);
    fs.writeFileSync(path.join(publicAssets, `shop_${i}.png`), png32);
    fs.writeFileSync(path.join(publicAssets, `shop_${i}_hd.png`), png96);

    // Save semantic names
    const sName = shopSemanticNames[i];
    fs.writeFileSync(path.join(publicAssets, 'shops', `${sName}.png`), png32);
    fs.writeFileSync(path.join(publicAssets, 'shops', `${sName}-hd.png`), png96);
    fs.writeFileSync(path.join(publicAssets, `${sName}.png`), png32);
    fs.writeFileSync(path.join(publicAssets, `${sName}-hd.png`), png96);

    // Also support dex-swap alias for dex-exchange
    if (i === 0) {
      fs.writeFileSync(path.join(publicAssets, 'shops', 'dex-swap.png'), png32);
      fs.writeFileSync(path.join(publicAssets, 'shops', 'dex-swap-hd.png'), png96);
      fs.writeFileSync(path.join(publicAssets, 'dex-swap.png'), png32);
    }

    // Save legacy aliases
    const lName = shopLegacyAliases[i];
    fs.writeFileSync(path.join(publicAssets, 'shops', `${lName}.png`), png32);
    fs.writeFileSync(path.join(publicAssets, `${lName}.png`), png32);
  }
  console.log('[generate-assets] Generated 6 protocol storefronts (32x32 & 96x96 HD) and aliases.');

  // 3. Synthesize 4 Player Avatars (32x32 native and 96x96 HD)
  const avatarSemanticNames = [
    'avatar-robinhood',
    'avatar-cryptodoge',
    'avatar-siliconvc',
    'avatar-wallstbull',
  ];

  for (let i = 0; i < 4; i++) {
    const matrix = AVATAR_MATRICES[i];
    const palette = AVATAR_PALETTES[i];
    const rgba32 = matrixToRgba(matrix, palette, 32, 32);
    const png32 = encodePng(32, 32, rgba32);

    const rgba96 = scaleRgba(rgba32, 32, 32, 3);
    const png96 = encodePng(96, 96, rgba96);

    // Indexed files
    fs.writeFileSync(path.join(publicAssets, 'avatars', `avatar_${i}.png`), png32);
    fs.writeFileSync(path.join(publicAssets, 'avatars', `avatar_${i}_hd.png`), png96);
    fs.writeFileSync(path.join(publicAssets, `avatar_${i}.png`), png32);
    fs.writeFileSync(path.join(publicAssets, `avatar_${i}_hd.png`), png96);

    // Semantic names
    const sName = avatarSemanticNames[i];
    fs.writeFileSync(path.join(publicAssets, 'avatars', `${sName}.png`), png32);
    fs.writeFileSync(path.join(publicAssets, 'avatars', `${sName}-hd.png`), png96);
    fs.writeFileSync(path.join(publicAssets, `${sName}.png`), png32);
    fs.writeFileSync(path.join(publicAssets, `${sName}-hd.png`), png96);
  }
  console.log('[generate-assets] Generated 4 player avatars (32x32 & 96x96 HD) and aliases.');

  // 4. Synthesize Currency and Tokens ($wif coin, USDG bill, player tokens)
  // 4a. $wif coin
  const wifRgba = matrixToRgba(COIN_WIF_MATRIX, COIN_WIF_PALETTE, 32, 32);
  const wifPng = encodePng(32, 32, wifRgba);
  const wifSvg = matrixToSvg(COIN_WIF_MATRIX, COIN_WIF_PALETTE, 32, 32);

  fs.writeFileSync(path.join(publicAssets, 'tokens', 'coin_wif.png'), wifPng);
  fs.writeFileSync(path.join(publicAssets, 'tokens', 'coin-wif.png'), wifPng);
  fs.writeFileSync(path.join(publicAssets, 'tokens', 'wif-coin.png'), wifPng);
  fs.writeFileSync(path.join(publicAssets, 'tokens', 'wif-coin.svg'), wifSvg);
  fs.writeFileSync(path.join(publicAssets, 'coin_wif.png'), wifPng);
  fs.writeFileSync(path.join(publicAssets, 'coin-wif.png'), wifPng);
  fs.writeFileSync(path.join(publicAssets, 'wif-coin.png'), wifPng);
  fs.writeFileSync(path.join(publicAssets, 'wif-coin.svg'), wifSvg);

  // 4b. USDG bill
  const usdgRgba = matrixToRgba(NOTE_USDG_MATRIX, NOTE_USDG_PALETTE, 32, 32);
  const usdgPng = encodePng(32, 32, usdgRgba);
  const usdgSvg = matrixToSvg(NOTE_USDG_MATRIX, NOTE_USDG_PALETTE, 32, 32);

  fs.writeFileSync(path.join(publicAssets, 'tokens', 'bill_usdg.png'), usdgPng);
  fs.writeFileSync(path.join(publicAssets, 'tokens', 'bill-usdg.png'), usdgPng);
  fs.writeFileSync(path.join(publicAssets, 'tokens', 'usdg-note.png'), usdgPng);
  fs.writeFileSync(path.join(publicAssets, 'tokens', 'usdg-note.svg'), usdgSvg);
  fs.writeFileSync(path.join(publicAssets, 'materials', 'game-banknote.png'), usdgPng);
  fs.writeFileSync(path.join(publicAssets, 'bill_usdg.png'), usdgPng);
  fs.writeFileSync(path.join(publicAssets, 'bill-usdg.png'), usdgPng);
  fs.writeFileSync(path.join(publicAssets, 'usdg-note.png'), usdgPng);
  fs.writeFileSync(path.join(publicAssets, 'usdg-note.svg'), usdgSvg);

  // 4c. Player tokens (0..5)
  for (let i = 0; i < 6; i++) {
    const tokenRgba = matrixToRgba(TOKEN_MATRICES[i % TOKEN_MATRICES.length], TOKEN_PALETTES[i], 32, 32);
    const tokenPng = encodePng(32, 32, tokenRgba);

    fs.writeFileSync(path.join(publicAssets, 'tokens', `token_${i}.png`), tokenPng);
    fs.writeFileSync(path.join(publicAssets, 'tokens', `token-${i}.png`), tokenPng);
    fs.writeFileSync(path.join(publicAssets, `token_${i}.png`), tokenPng);
    fs.writeFileSync(path.join(publicAssets, `token-${i}.png`), tokenPng);
    fs.writeFileSync(path.join(publicAssets, `beacon_${i}.png`), tokenPng);
    fs.writeFileSync(path.join(publicAssets, 'materials', `stool-${i}-v8.png`), tokenPng);
  }

  // 4d. Ground plot texture
  const groundBuf = Buffer.alloc(32 * 32 * 4, 30);
  for (let i = 0; i < 32 * 32; i++) {
    const offset = i * 4;
    groundBuf[offset] = 24;
    groundBuf[offset + 1] = 34;
    groundBuf[offset + 2] = 56;
    groundBuf[offset + 3] = 255;
  }
  const groundPng = encodePng(32, 32, groundBuf);
  fs.writeFileSync(path.join(publicAssets, 'materials', 'plot-ground.png'), groundPng);

  console.log('[generate-assets] Generated currency tokens ($wif, USDG) and player tokens.');

  // 5. Synthesize UI and Action Icons
  // 5a. Trade handshake icon
  const tradeRgba = matrixToRgba(ICON_TRADE_MATRIX, ICON_TRADE_PALETTE, 32, 32);
  const tradePng = encodePng(32, 32, tradeRgba);
  fs.writeFileSync(path.join(publicAssets, 'ui', 'icon_trade.png'), tradePng);
  fs.writeFileSync(path.join(publicAssets, 'ui', 'icon-trade.png'), tradePng);
  fs.writeFileSync(path.join(publicAssets, 'ui', 'trade-icon.png'), tradePng);
  fs.writeFileSync(path.join(publicAssets, 'icon_trade.png'), tradePng);
  fs.writeFileSync(path.join(publicAssets, 'icon-trade.png'), tradePng);
  fs.writeFileSync(path.join(publicAssets, 'trade-icon.png'), tradePng);

  // 5b. Build wrench icon
  const buildRgba = matrixToRgba(ICON_BUILD_MATRIX, ICON_BUILD_PALETTE, 32, 32);
  const buildPng = encodePng(32, 32, buildRgba);
  fs.writeFileSync(path.join(publicAssets, 'ui', 'icon_build.png'), buildPng);
  fs.writeFileSync(path.join(publicAssets, 'ui', 'icon-build.png'), buildPng);
  fs.writeFileSync(path.join(publicAssets, 'ui', 'build-icon.png'), buildPng);
  fs.writeFileSync(path.join(publicAssets, 'icon_build.png'), buildPng);
  fs.writeFileSync(path.join(publicAssets, 'icon-build.png'), buildPng);
  fs.writeFileSync(path.join(publicAssets, 'build-icon.png'), buildPng);

  // 5c. Deal stamp filled
  const stampRgba = matrixToRgba(STAMP_FILLED_MATRIX, STAMP_FILLED_PALETTE, 32, 32);
  const stampPng = encodePng(32, 32, stampRgba);
  fs.writeFileSync(path.join(publicAssets, 'ui', 'stamp_filled.png'), stampPng);
  fs.writeFileSync(path.join(publicAssets, 'ui', 'stamp-filled.png'), stampPng);
  fs.writeFileSync(path.join(publicAssets, 'stamp_filled.png'), stampPng);
  fs.writeFileSync(path.join(publicAssets, 'stamp-filled.png'), stampPng);

  // Additional legacy UI chips
  fs.writeFileSync(path.join(publicAssets, 'ui', 'calendar-paper-v9.png'), stampPng);
  fs.writeFileSync(path.join(publicAssets, 'ui', 'plot-mini-v9.png'), groundPng);
  fs.writeFileSync(path.join(publicAssets, 'ui', 'chieu-mat-v9.png'), groundPng);

  console.log('[generate-assets] Generated UI and action icons (trade, build, stamp).');

  // 6. Synthesize Full 1100x730 Board Background Map
  const boardRgba = generateBoardMapRgba(1100, 730);
  const boardPng = encodePng(1100, 730, boardRgba);

  fs.writeFileSync(path.join(publicAssets, 'board', 'board_map.png'), boardPng);
  fs.writeFileSync(path.join(publicAssets, 'board', 'robin-city-board.png'), boardPng);
  fs.writeFileSync(path.join(publicAssets, 'board_map.png'), boardPng);
  fs.writeFileSync(path.join(publicAssets, 'robin-city-board.png'), boardPng);
  fs.writeFileSync(path.join(publicAssets, 'saigon-city-board-v6.png'), boardPng);
  fs.writeFileSync(path.join(publicAssets, 'city', 'saigon-city-board-v6.png'), boardPng);
  fs.writeFileSync(path.join(publicAssets, 'city', 'robin-city-board.png'), boardPng);

  console.log('[generate-assets] Generated 1100x730 board background map and aliases.');
  console.log('[generate-assets] Completed pixel art asset synthesis pipeline successfully.');
}

// Execute immediately when invoked directly as CLI
const isDirectRun =
  process.argv[1] &&
  (process.argv[1].endsWith('generate-assets.ts') || process.argv[1].endsWith('generate-assets.js'));

if (isDirectRun) {
  generateAssets()
    .then(() => {
      console.log('[generate-assets] Finished with exit code 0.');
    })
    .catch((err) => {
      console.error('[generate-assets] Fatal error during asset generation:', err);
      process.exit(1);
    });
}
