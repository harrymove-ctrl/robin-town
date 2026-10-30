/**
 * tests/unit/assets.test.ts
 *
 * Automated test suite verifying the pixel art asset pipeline:
 * PNG binary encoding, matrix conversion, integer scaling, SVG generation,
 * board map dimensions, and asset verification routines.
 */

import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  encodePng,
  matrixToRgba,
  scaleRgba,
  matrixToSvg,
  generateBoardMapRgba,
  checkAsepriteFallback,
  SHOP_PALETTES,
  SHOP_MATRICES,
  AVATAR_PALETTES,
  AVATAR_MATRICES,
} from '../../scripts/generate-assets';
import { verifyAsset, GAME_IMAGES } from '../../scripts/verify-assets';

describe('Pixel Art Asset Pipeline', () => {
  it('encodes RFC 2083 compliant PNG buffers with valid signature and IHDR', () => {
    const rawRgba = Buffer.alloc(32 * 32 * 4, 128);
    const png = encodePng(32, 32, rawRgba);

    // PNG 8-byte signature
    const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    assert.deepStrictEqual(png.subarray(0, 8), signature);

    // IHDR chunk
    assert.strictEqual(png.readUInt32BE(8), 13);
    assert.strictEqual(png.subarray(12, 16).toString('ascii'), 'IHDR');
    assert.strictEqual(png.readUInt32BE(16), 32);
    assert.strictEqual(png.readUInt32BE(20), 32);
    assert.strictEqual(png[24], 8); // Bit depth
    assert.strictEqual(png[25], 6); // RGBA color type
  });

  it('converts character matrix to RGBA buffer correctly', () => {
    const matrix = [
      '..##',
      '..##',
      '####',
      '####',
    ];
    const palette = {
      '.': [0, 0, 0, 0] as [number, number, number, number],
      '#': [255, 0, 0, 255] as [number, number, number, number],
    };
    const rgba = matrixToRgba(matrix, palette, 4, 4);
    assert.strictEqual(rgba.length, 4 * 4 * 4);
    // Pixel (0, 0) is transparent
    assert.strictEqual(rgba[0], 0);
    assert.strictEqual(rgba[3], 0);
    // Pixel (2, 0) is red
    assert.strictEqual(rgba[(0 * 4 + 2) * 4], 255);
    assert.strictEqual(rgba[(0 * 4 + 2) * 4 + 3], 255);
  });

  it('scales RGBA buffer using exact 3x integer nearest-neighbor interpolation', () => {
    const src = Buffer.alloc(2 * 2 * 4);
    // Set pixel (0,0) to white
    src[0] = 255;
    src[1] = 255;
    src[2] = 255;
    src[3] = 255;

    const scaled = scaleRgba(src, 2, 2, 3);
    assert.strictEqual(scaled.length, 6 * 6 * 4);

    // Pixels (0..2, 0..2) in scaled image must all be white
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        const offset = (y * 6 + x) * 4;
        assert.strictEqual(scaled[offset], 255);
        assert.strictEqual(scaled[offset + 3], 255);
      }
    }
    // Pixel (3, 0) must be black/zero
    const offsetRight = (0 * 6 + 3) * 4;
    assert.strictEqual(scaled[offsetRight], 0);
  });

  it('generates valid SVG text structure', () => {
    const matrix = ['#'];
    const palette = { '#': [0, 200, 5, 255] as [number, number, number, number] };
    const svg = matrixToSvg(matrix, palette, 1, 1);
    assert.ok(svg.includes('<svg'));
    assert.ok(svg.includes('</svg>'));
    assert.ok(svg.includes('shape-rendering="crispEdges"'));
    assert.ok(svg.includes('fill="#00c805"'));
  });

  it('generates board map RGBA with exact 1100x730 dimensions', () => {
    const mapRgba = generateBoardMapRgba(1100, 730);
    assert.strictEqual(mapRgba.length, 1100 * 730 * 4);
    // Verify background pixel at (2, 2) is dark navy canvas #0B0F19
    const offset = (2 * 1100 + 2) * 4;
    assert.strictEqual(mapRgba[offset], 11);
    assert.strictEqual(mapRgba[offset + 1], 15);
    assert.strictEqual(mapRgba[offset + 2], 25);
    assert.strictEqual(mapRgba[offset + 3], 255);
  });

  it('checks Aseprite fallback cleanly when art directory is missing or present', () => {
    const fallback = checkAsepriteFallback(path.resolve(process.cwd(), 'nonexistent-art-dir'));
    assert.strictEqual(fallback.hasAsepriteFiles, false);
    assert.strictEqual(fallback.hasJsonSheets, false);
  });

  it('validates all 6 protocol shop matrices have 32 rows of 32 characters', () => {
    assert.strictEqual(SHOP_MATRICES.length, 6);
    for (let i = 0; i < 6; i++) {
      assert.strictEqual(SHOP_MATRICES[i].length, 32);
      for (const row of SHOP_MATRICES[i]) {
        assert.strictEqual(row.length, 32);
        for (const char of row) {
          assert.ok(SHOP_PALETTES[i][char] !== undefined, `Unknown char ${char} in shop ${i}`);
        }
      }
    }
  });

  it('validates all 4 player avatar matrices have 32 rows of 32 characters', () => {
    assert.strictEqual(AVATAR_MATRICES.length, 4);
    for (let i = 0; i < 4; i++) {
      assert.strictEqual(AVATAR_MATRICES[i].length, 32);
      for (const row of AVATAR_MATRICES[i]) {
        assert.strictEqual(row.length, 32);
        for (const char of row) {
          assert.ok(AVATAR_PALETTES[i][char] !== undefined, `Unknown char ${char} in avatar ${i}`);
        }
      }
    }
  });

  it('passes asset verification on all declared GAME_IMAGES', () => {
    const publicDir = path.resolve(process.cwd(), 'public');
    for (const assetPath of GAME_IMAGES) {
      const res = verifyAsset(publicDir, assetPath);
      assert.ok(res.ok, `Asset failed verification: ${assetPath}: ${res.message}`);
    }
  });
});
