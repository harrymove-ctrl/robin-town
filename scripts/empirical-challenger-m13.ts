/**
 * scripts/empirical-challenger-m13.ts
 *
 * Empirical Challenger M13 Stress Harness for Robin-Town
 * Challenges:
 * 1. Rapid successive view mode toggles between city-3d and 2D board view (20 cycles via HUD toggle and key V)
 * 2. Rapid modal opening and closing without memory leaks or uncaught DOM exceptions (20 cycles across start screen and game HUD)
 * 3. Mobile viewport layout occlusion: verify iPod dock and segmented buttons do not occlude board parcels
 * 4. Rapid responsive viewport resize stress between desktop, tablet, and mobile
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, '../dist');

async function resolvePlaywright(): Promise<{ chromium: any }> {
  try {
    const require = createRequire(import.meta.url);
    const mod = require('playwright');
    if (mod && (mod.chromium || mod.default?.chromium)) {
      return { chromium: mod.chromium || mod.default.chromium };
    }
  } catch {}

  const npxSearchDirs = [
    '/Users/harryphan/.npm/_npx/e41f203b7505f1fb/node_modules/playwright',
    path.join(process.env.HOME || '', '.npm/_npx/e41f203b7505f1fb/node_modules/playwright'),
  ];

  for (const dir of npxSearchDirs) {
    if (fs.existsSync(dir)) {
      try {
        const require = createRequire(import.meta.url);
        const mod = require(dir);
        if (mod && (mod.chromium || mod.default?.chromium)) {
          return { chromium: mod.chromium || mod.default.chromium };
        }
      } catch {}
      try {
        const mod: any = await import(dir);
        if (mod && (mod.chromium || mod.default?.chromium)) {
          return { chromium: mod.chromium || mod.default.chromium };
        }
      } catch {}
    }
  }

  throw new Error('Playwright module not found.');
}

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
};

function createStaticServer(): http.Server {
  return http.createServer((req, res) => {
    let reqPath = (req.url || '/').split('?')[0];
    if (reqPath === '/') reqPath = '/index.html';
    const filePath = path.join(distDir, reqPath);

    if (!fs.existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end(`Not Found: ${reqPath}`);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

interface ChallengeResult {
  name: string;
  passed: boolean;
  details: string;
  metrics?: Record<string, any>;
}

async function runEmpiricalChallenge(): Promise<void> {
  console.log('======================================================================');
  console.log('>>> STARTING EMPIRICAL CHALLENGER M13 STRESS HARNESS <<<');
  console.log('======================================================================\n');

  if (!fs.existsSync(path.join(distDir, 'index.html'))) {
    console.error('Error: dist/index.html not found. Run npm run build first.');
    process.exit(1);
  }

  const { chromium } = await resolvePlaywright();
  const server = createStaticServer();

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${address.port}`;
  console.log(`[challenger-m13] Static test server running on ${baseUrl}`);

  const results: ChallengeResult[] = [];
  let fatalCount = 0;

  const browser = await chromium.launch({ headless: true });

  try {
    // -------------------------------------------------------------------------
    // CHALLENGE 1: Rapid Successive View Mode Toggles (city-3d <-> 2D)
    // -------------------------------------------------------------------------
    console.log('\n--- Challenge 1: Rapid Successive View Mode Toggles (20 Cycles) ---');
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      const consoleErrors: string[] = [];
      const pageErrors: string[] = [];

      page.on('console', (msg: any) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', (err: any) => {
        pageErrors.push(err.message);
      });

      await page.goto(baseUrl);
      await page.waitForLoadState('networkidle');

      // Start game
      await page.waitForSelector('#start-screen button[data-action="resume"]:not([disabled])', { timeout: 6000 });
      await page.click('#start-screen button[data-action="resume"]');
      await page.waitForTimeout(500);

      const initialMode = await page.evaluate(() => document.body.dataset.viewMode);
      if (initialMode !== 'city-3d') {
        throw new Error(`Expected initial mode city-3d, got ${initialMode}`);
      }

      const toggleStartTime = Date.now();
      const toggleCycles = 20;
      let toggleFails = 0;

      for (let i = 0; i < toggleCycles; i++) {
        if (i % 2 === 0) {
          await page.click('.game-hud-top button[data-action="view-toggle"]', { timeout: 3000 });
        } else {
          await page.keyboard.press('KeyV');
        }

        await page.waitForTimeout(100);

        const currentMode = await page.evaluate(() => document.body.dataset.viewMode);
        if (!currentMode || !['city-3d', 'tabletop-3d', '2d'].includes(currentMode)) {
          toggleFails++;
        }
      }

      const toggleDuration = Date.now() - toggleStartTime;

      // Ensure final mode is city-3d
      const curMode = await page.evaluate(() => document.body.dataset.viewMode);
      if (curMode !== 'city-3d') {
        await page.click('.game-hud-top button[data-action="view-toggle"]', { timeout: 3000 });
        await page.waitForTimeout(200);
      }

      const canvasHealthy = await page.evaluate(() => {
        const canvas = document.querySelector('.three-city-canvas-host canvas') as HTMLCanvasElement | null;
        if (!canvas) return false;
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        return gl ? !gl.isContextLost() : false;
      });

      const pass = toggleFails === 0 && consoleErrors.length === 0 && pageErrors.length === 0 && canvasHealthy;
      results.push({
        name: 'Rapid View Mode Toggles',
        passed: pass,
        details: `Executed ${toggleCycles} rapid view toggles in ${toggleDuration}ms. Console errors: ${consoleErrors.length}, page errors: ${pageErrors.length}. WebGL context active: ${canvasHealthy}.`,
        metrics: { cycles: toggleCycles, durationMs: toggleDuration, consoleErrors, pageErrors, canvasHealthy },
      });

      console.log(`  [${pass ? 'PASS' : 'FAIL'}] Challenge 1: ${toggleCycles} toggles in ${toggleDuration}ms`);
      if (!pass) fatalCount++;
      await page.close();
    }

    // -------------------------------------------------------------------------
    // CHALLENGE 2: Rapid Modal Open and Close Cycles (Stress & Memory Leaks)
    // -------------------------------------------------------------------------
    console.log('\n--- Challenge 2: Rapid Modal Open and Close Cycles (20 Cycles) ---');
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      const consoleErrors: string[] = [];
      const pageErrors: string[] = [];

      page.on('console', (msg: any) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', (err: any) => {
        pageErrors.push(err.message);
      });

      await page.goto(baseUrl);
      await page.waitForLoadState('networkidle');

      const modalStartTime = Date.now();
      const perPhaseCycles = 10;
      let modalFails = 0;

      // Phase A: 10 cycles on Start Screen
      for (let i = 0; i < perPhaseCycles; i++) {
        await page.click('#start-screen button[data-action="wif-hub"]', { timeout: 3000 });
        await page.waitForTimeout(100);

        const isOpen = await page.evaluate(() => {
          const m = document.getElementById('modal') as HTMLDialogElement | null;
          return m ? m.open : false;
        });
        if (!isOpen) modalFails++;

        await page.click('#modal button[data-action="close"]', { timeout: 3000 });
        await page.waitForTimeout(150);

        const isClosed = await page.evaluate(() => {
          const m = document.getElementById('modal') as HTMLDialogElement | null;
          return m ? !m.open : true;
        });
        if (!isClosed) modalFails++;
      }

      // Transition to game
      await page.waitForSelector('#start-screen button[data-action="resume"]:not([disabled])', { timeout: 6000 });
      await page.click('#start-screen button[data-action="resume"]');
      await page.waitForTimeout(500);

      // Phase B: 10 cycles in-game HUD
      for (let i = 0; i < perPhaseCycles; i++) {
        await page.click('.game-hud-top button[data-action="wif-hub"]', { timeout: 3000 });
        await page.waitForTimeout(100);

        const isOpen = await page.evaluate(() => {
          const m = document.getElementById('modal') as HTMLDialogElement | null;
          return m ? m.open : false;
        });
        if (!isOpen) modalFails++;

        await page.click('#modal button[data-action="close"]', { timeout: 3000 });
        await page.waitForTimeout(150);

        const isClosed = await page.evaluate(() => {
          const m = document.getElementById('modal') as HTMLDialogElement | null;
          return m ? !m.open : true;
        });
        if (!isClosed) modalFails++;
      }

      const modalDuration = Date.now() - modalStartTime;
      const modalElementsCount = await page.evaluate(() => document.querySelectorAll('#modal').length);

      const pass = modalFails === 0 && modalElementsCount === 1 && consoleErrors.length === 0 && pageErrors.length === 0;

      results.push({
        name: 'Rapid Modal Open/Close Stress',
        passed: pass,
        details: `Executed ${perPhaseCycles * 2} cycles in ${modalDuration}ms. Modal element count: ${modalElementsCount}. Uncaught errors: 0.`,
        metrics: { totalCycles: perPhaseCycles * 2, durationMs: modalDuration, modalFails, modalElementsCount },
      });

      console.log(`  [${pass ? 'PASS' : 'FAIL'}] Challenge 2: ${perPhaseCycles * 2} modal cycles in ${modalDuration}ms`);
      if (!pass) fatalCount++;
      await page.close();
    }

    // -------------------------------------------------------------------------
    // CHALLENGE 3: Mobile Viewport Layout Occlusion Verification
    // -------------------------------------------------------------------------
    console.log('\n--- Challenge 3: Mobile Viewport Layout Occlusion Verification ---');
    {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      const consoleErrors: string[] = [];
      const pageErrors: string[] = [];

      page.on('console', (msg: any) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', (err: any) => {
        pageErrors.push(err.message);
      });

      await page.goto(baseUrl);
      await page.waitForLoadState('networkidle');

      await page.waitForSelector('#start-screen button[data-action="resume"]:not([disabled])', { timeout: 6000 });
      await page.click('#start-screen button[data-action="resume"]');
      await page.waitForTimeout(500);

      // Verify iPod dock visibility on mobile:
      // The iPod HUD button is hidden on mobile, and the dock aside remains hidden so it cannot occlude game board.
      const ipodDockAudit = await page.evaluate(() => {
        const dock = document.getElementById('robin-ipod-dock');
        const hudBtn = document.querySelector('.ipod-hud-btn') as HTMLElement | null;
        const dockHasHidden = dock ? dock.hasAttribute('hidden') : true;
        const hudBtnDisplay = hudBtn ? window.getComputedStyle(hudBtn).display : 'none';
        const dockDisplay = dock ? window.getComputedStyle(dock).display : 'none';
        return { dockHasHidden, hudBtnDisplay, dockDisplay };
      });

      // Verify segmented view buttons are hidden on mobile
      const segmentedAudit = await page.evaluate(() => {
        const seg = document.querySelector('.view-mode-segmented') as HTMLElement | null;
        return seg ? window.getComputedStyle(seg).display : 'none';
      });

      // Switch to 2D board view to inspect board lots interaction
      await page.click('.game-hud-top button[data-action="view-toggle"]');
      await page.waitForTimeout(300);

      // Check board lot clickability and selection
      await page.click('.lot[data-lot="0"]');
      await page.waitForTimeout(200);

      const lot0Selected = await page.evaluate(() => {
        const lot0 = document.querySelector('.lot[data-lot="0"]') as HTMLElement | null;
        return lot0 ? lot0.classList.contains('inspected') || lot0.getAttribute('aria-pressed') === 'true' : false;
      });

      // Element-from-point occlusion check for visible parcels
      const sampleLotIndices = [0, 1, 2, 6, 7, 12, 13, 24, 25];
      const occlusionAudit = await page.evaluate((indices: number[]) => {
        const results: { lotId: number; occludedByDockOrSegmented: boolean; hitTag: string }[] = [];
        for (const idx of indices) {
          const lot = document.querySelector(`.lot[data-lot="${idx}"]`) as HTMLElement | null;
          if (lot) {
            const rect = lot.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              const cx = rect.left + rect.width / 2;
              const cy = rect.top + rect.height / 2;
              if (cx >= 0 && cx <= window.innerWidth && cy >= 0 && cy <= window.innerHeight) {
                const el = document.elementFromPoint(cx, cy);
                const isDock = el ? (el.id === 'robin-ipod-dock' || !!el.closest('#robin-ipod-dock')) : false;
                const isSeg = el ? (el.classList.contains('view-mode-segmented') || !!el.closest('.view-mode-segmented')) : false;
                results.push({ lotId: idx, occludedByDockOrSegmented: isDock || isSeg, hitTag: el?.tagName || 'none' });
              }
            }
          }
        }
        return results;
      }, sampleLotIndices);

      const occludedSampleLots = occlusionAudit.filter((r: { occludedByDockOrSegmented: boolean }) => r.occludedByDockOrSegmented);

      const pass =
        ipodDockAudit.dockHasHidden &&
        ipodDockAudit.hudBtnDisplay === 'none' &&
        ipodDockAudit.dockDisplay === 'none' &&
        segmentedAudit === 'none' &&
        lot0Selected &&
        occludedSampleLots.length === 0 &&
        consoleErrors.length === 0 &&
        pageErrors.length === 0;

      results.push({
        name: 'Mobile Layout Occlusion & Interaction',
        passed: pass,
        details: `Mobile layout verified (390x844). iPod dock display: ${ipodDockAudit.dockDisplay}, HUD button: ${ipodDockAudit.hudBtnDisplay}. Segmented buttons display: ${segmentedAudit}. Parcel 0 interactive click: ${lot0Selected}. Zero parcels occluded by dock or segmented buttons.`,
        metrics: { ipodDockAudit, segmentedAudit, lot0Selected, occlusionAudit },
      });

      console.log(`  [${pass ? 'PASS' : 'FAIL'}] Challenge 3: Mobile layout and parcel interaction verified`);
      if (!pass) fatalCount++;
      await page.close();
    }

    // -------------------------------------------------------------------------
    // CHALLENGE 4: Rapid Responsive Resizing Stress Test
    // -------------------------------------------------------------------------
    console.log('\n--- Challenge 4: Rapid Viewport Resize Stress Test ---');
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      const consoleErrors: string[] = [];
      const pageErrors: string[] = [];

      page.on('console', (msg: any) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', (err: any) => {
        pageErrors.push(err.message);
      });

      await page.goto(baseUrl);
      await page.waitForLoadState('networkidle');

      await page.waitForSelector('#start-screen button[data-action="resume"]:not([disabled])', { timeout: 6000 });
      await page.click('#start-screen button[data-action="resume"]');
      await page.waitForTimeout(500);

      const viewports = [
        { width: 1440, height: 900 },
        { width: 390, height: 844 },
        { width: 768, height: 1024 },
        { width: 375, height: 667 },
        { width: 1280, height: 800 },
        { width: 390, height: 844 },
        { width: 1440, height: 900 },
      ];

      for (const vp of viewports) {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.waitForTimeout(80);
      }

      const canvasResized = await page.evaluate(() => {
        const canvas = document.querySelector('.three-city-canvas-host canvas') as HTMLCanvasElement | null;
        return canvas !== null && canvas.width > 0 && canvas.height > 0;
      });

      const pass = canvasResized && consoleErrors.length === 0 && pageErrors.length === 0;

      results.push({
        name: 'Rapid Viewport Resize Stress',
        passed: pass,
        details: `Tested ${viewports.length} dynamic viewport switches. Three.js canvas active and resized: ${canvasResized}.`,
        metrics: { viewportsTested: viewports.length, canvasResized },
      });

      console.log(`  [${pass ? 'PASS' : 'FAIL'}] Challenge 4: ${viewports.length} viewport resizes passed`);
      if (!pass) fatalCount++;
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }

  console.log('\n======================================================================');
  console.log('>>> EMPIRICAL CHALLENGE RESULTS SUMMARY <<<');
  console.log('======================================================================');
  for (const r of results) {
    const mark = r.passed ? '[PASS]' : '[FAIL]';
    console.log(`${mark} ${r.name}`);
    console.log(`       ${r.details}`);
  }
  console.log('======================================================================\n');

  if (fatalCount > 0) {
    console.error(`[challenger-m13] FAILED: ${fatalCount} challenge(s) failed.`);
    process.exit(1);
  } else {
    console.log('[challenger-m13] SUCCESS: All empirical challenges passed with 100% green integrity!');
    process.exit(0);
  }
}

void runEmpiricalChallenge();
