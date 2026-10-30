/**
 * scripts/verify-assets.ts
 *
 * Standalone asset integrity verification script for robin-town.
 * Validates existence, non-zero size, 8-byte PNG header (89 50 4E 47 0D 0A 1A 0A),
 * and IHDR dimensions for all assets declared in GAME_IMAGES.
 * Exits with code 0 on complete health, non-zero on any missing/corrupt asset.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

export interface ExpectedDimension {
  width?: number;
  height?: number;
}

/**
 * Complete list of assets required for runtime gameplay and rendering.
 * Covers 31 primary assets plus all semantic and legacy aliases.
 */
export const GAME_IMAGES: string[] = [
  // 6 Protocol Shops Native (32x32)
  '/assets/shops/shop_0.png',
  '/assets/shops/shop_1.png',
  '/assets/shops/shop_2.png',
  '/assets/shops/shop_3.png',
  '/assets/shops/shop_4.png',
  '/assets/shops/shop_5.png',
  // 6 Protocol Shops HD (96x96)
  '/assets/shops/shop_0_hd.png',
  '/assets/shops/shop_1_hd.png',
  '/assets/shops/shop_2_hd.png',
  '/assets/shops/shop_3_hd.png',
  '/assets/shops/shop_4_hd.png',
  '/assets/shops/shop_5_hd.png',
  // 6 Protocol Shops Semantic Aliases
  '/assets/shops/dex-exchange.png',
  '/assets/shops/memecoin-lounge.png',
  '/assets/shops/staking-vault.png',
  '/assets/shops/lending-protocol.png',
  '/assets/shops/derivatives-exchange.png',
  '/assets/shops/validator-citadel.png',
  // 6 Protocol Shops Legacy Aliases
  '/assets/shops/coffee.png',
  '/assets/shops/banhmi.png',
  '/assets/shops/pho.png',
  '/assets/shops/flowers.png',
  '/assets/shops/tailor.png',
  '/assets/shops/grocery.png',
  // 4 Player Avatars Native (32x32)
  '/assets/avatars/avatar_0.png',
  '/assets/avatars/avatar_1.png',
  '/assets/avatars/avatar_2.png',
  '/assets/avatars/avatar_3.png',
  // 4 Player Avatars HD (96x96)
  '/assets/avatars/avatar_0_hd.png',
  '/assets/avatars/avatar_1_hd.png',
  '/assets/avatars/avatar_2_hd.png',
  '/assets/avatars/avatar_3_hd.png',
  // 4 Player Avatars Semantic Aliases
  '/assets/avatars/avatar-robinhood.png',
  '/assets/avatars/avatar-cryptodoge.png',
  '/assets/avatars/avatar-siliconvc.png',
  '/assets/avatars/avatar-wallstbull.png',
  // Board Background Map (1100x730)
  '/assets/board/board_map.png',
  '/assets/board_map.png',
  '/assets/robin-city-board.png',
  '/assets/saigon-city-board-v6.png',
  '/assets/city/saigon-city-board-v6.png',
  // Currency Tokens
  '/assets/tokens/coin_wif.png',
  '/assets/tokens/bill_usdg.png',
  '/assets/wif-coin.png',
  '/assets/wif-coin.svg',
  '/assets/usdg-note.png',
  '/assets/usdg-note.svg',
  // Player Ownership Tokens (32x32)
  '/assets/tokens/token_0.png',
  '/assets/tokens/token_1.png',
  '/assets/tokens/token_2.png',
  '/assets/tokens/token_3.png',
  '/assets/tokens/token-0.png',
  '/assets/tokens/token-1.png',
  '/assets/tokens/token-2.png',
  '/assets/tokens/token-3.png',
  '/assets/token-0.png',
  '/assets/token-1.png',
  '/assets/token-2.png',
  '/assets/token-3.png',
  // Action & UI Icons (32x32)
  '/assets/ui/icon_trade.png',
  '/assets/ui/icon_build.png',
  '/assets/ui/stamp_filled.png',
  '/assets/trade-icon.png',
  '/assets/build-icon.png',
  // Favicon
  '/favicon.svg',
];

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_IHDR = Buffer.from([0x49, 0x48, 0x44, 0x52]);

export function getExpectedDimensions(assetPath: string): ExpectedDimension | undefined {
  if (assetPath.endsWith('_hd.png') || assetPath.endsWith('-hd.png')) {
    return { width: 96, height: 96 };
  }
  if (
    assetPath.includes('board_map.png') ||
    assetPath.includes('robin-city-board.png') ||
    assetPath.includes('saigon-city-board-v6.png')
  ) {
    return { width: 1100, height: 730 };
  }
  if (assetPath.endsWith('.png')) {
    return { width: 32, height: 32 };
  }
  return undefined;
}

export interface VerificationResult {
  asset: string;
  ok: boolean;
  type: 'png' | 'svg' | 'other';
  width?: number;
  height?: number;
  sizeBytes: number;
  message: string;
}

export function verifyAsset(publicDir: string, assetPath: string): VerificationResult {
  const rel = assetPath.startsWith('/') ? assetPath.slice(1) : assetPath;
  const fullPath = path.resolve(publicDir, rel);

  if (!fs.existsSync(fullPath)) {
    return {
      asset: assetPath,
      ok: false,
      type: 'other',
      sizeBytes: 0,
      message: `File does not exist: ${fullPath}`,
    };
  }

  const stat = fs.statSync(fullPath);
  if (stat.size === 0) {
    return {
      asset: assetPath,
      ok: false,
      type: 'other',
      sizeBytes: 0,
      message: `File is empty (0 bytes): ${fullPath}`,
    };
  }

  // PNG Verification
  if (assetPath.endsWith('.png')) {
    if (stat.size < 24) {
      return {
        asset: assetPath,
        ok: false,
        type: 'png',
        sizeBytes: stat.size,
        message: `PNG truncated (only ${stat.size} bytes): ${fullPath}`,
      };
    }

    const buf = fs.readFileSync(fullPath);
    if (!buf.subarray(0, 8).equals(PNG_SIGNATURE)) {
      return {
        asset: assetPath,
        ok: false,
        type: 'png',
        sizeBytes: stat.size,
        message: `Invalid 8-byte PNG header signature: ${fullPath}`,
      };
    }

    if (!buf.subarray(12, 16).equals(PNG_IHDR)) {
      return {
        asset: assetPath,
        ok: false,
        type: 'png',
        sizeBytes: stat.size,
        message: `Missing IHDR chunk in PNG: ${fullPath}`,
      };
    }

    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    const expected = getExpectedDimensions(assetPath);

    if (expected?.width && width !== expected.width) {
      return {
        asset: assetPath,
        ok: false,
        type: 'png',
        width,
        height,
        sizeBytes: stat.size,
        message: `Width mismatch: got ${width}, expected ${expected.width}`,
      };
    }

    if (expected?.height && height !== expected.height) {
      return {
        asset: assetPath,
        ok: false,
        type: 'png',
        width,
        height,
        sizeBytes: stat.size,
        message: `Height mismatch: got ${height}, expected ${expected.height}`,
      };
    }

    return {
      asset: assetPath,
      ok: true,
      type: 'png',
      width,
      height,
      sizeBytes: stat.size,
      message: `Valid PNG (${width}x${height}, ${stat.size} bytes)`,
    };
  }

  // SVG Verification
  if (assetPath.endsWith('.svg')) {
    const text = fs.readFileSync(fullPath, 'utf8');
    if (!text.includes('<svg') || (!text.includes('</svg>') && !text.includes('/>'))) {
      return {
        asset: assetPath,
        ok: false,
        type: 'svg',
        sizeBytes: stat.size,
        message: `Malformed SVG text structure: ${fullPath}`,
      };
    }
    return {
      asset: assetPath,
      ok: true,
      type: 'svg',
      sizeBytes: stat.size,
      message: `Valid SVG (${stat.size} bytes)`,
    };
  }

  return {
    asset: assetPath,
    ok: true,
    type: 'other',
    sizeBytes: stat.size,
    message: `Valid asset file (${stat.size} bytes)`,
  };
}

export function runAssetVerification(rootDir?: string): boolean {
  const root = rootDir ? path.resolve(rootDir) : process.cwd();
  const publicDir = path.resolve(root, 'public');

  console.log(`[verify-assets] Verifying assets in: ${publicDir}`);
  console.log(`[verify-assets] Manifest size: ${GAME_IMAGES.length} declared assets`);

  const results: VerificationResult[] = [];
  let failures = 0;

  for (const assetPath of GAME_IMAGES) {
    const res = verifyAsset(publicDir, assetPath);
    results.push(res);
    if (!res.ok) {
      failures++;
      console.error(`  [FAIL] ${assetPath}: ${res.message}`);
    } else {
      console.log(`  [PASS] ${assetPath}: ${res.message}`);
    }
  }

  const passedCount = GAME_IMAGES.length - failures;
  console.log(`[verify-assets] Results: ${passedCount}/${GAME_IMAGES.length} passed (${failures} failures)`);

  return failures === 0;
}

// Execute immediately when invoked directly as CLI
const isDirectRun =
  process.argv[1] &&
  (process.argv[1].endsWith('verify-assets.ts') || process.argv[1].endsWith('verify-assets.js'));

if (isDirectRun) {
  const success = runAssetVerification();
  if (!success) {
    console.error('[verify-assets] Asset verification failed with missing or corrupt assets.');
    process.exit(1);
  } else {
    console.log('[verify-assets] All assets healthy. Exiting with code 0.');
    process.exit(0);
  }
}
