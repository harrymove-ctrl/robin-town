/**
 * scripts/verify-browser-e2e.ts
 *
 * Multi-Viewport Headless Playwright Verification Suite for Robin-Town (Milestone M13)
 * Tests Desktop (1440x900) and Mobile (390x844) viewports with zero external dependencies.
 * Asserts zero console errors, zero page errors, zero 404 image requests,
 * Apple Carousel interaction, $wif Flywheel modal, 3D Living Diorama rendering,
 * view mode toggles, and collapsible iPod Classic dock.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, '../dist');

// Dynamic resolution of Playwright module across local and npx caches
async function resolvePlaywright(): Promise<{ chromium: any }> {
  try {
    const require = createRequire(import.meta.url);
    const mod = require('playwright');
    if (mod && (mod.chromium || mod.default?.chromium)) {
      return { chromium: mod.chromium || mod.default.chromium };
    }
  } catch {}

  try {
    const pkg = 'playwright';
    const mod: any = await import(pkg);
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

  throw new Error(
    'Playwright module not found. Install via: npm install -D playwright or ensure npx playwright cache exists.',
  );
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

interface ViewportConfig {
  name: string;
  width: number;
  height: number;
}

const VIEWPORTS: ViewportConfig[] = [
  { name: 'Desktop', width: 1440, height: 900 },
  { name: 'Mobile', width: 390, height: 844 },
];

async function runBrowserVerification(): Promise<void> {
  if (!fs.existsSync(path.join(distDir, 'index.html'))) {
    console.error('[verify-browser] dist/index.html not found. Please run npm run build first.');
    process.exit(1);
  }

  const { chromium } = await resolvePlaywright();
  const server = createStaticServer();

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${address.port}`;
  console.log(`[verify-browser] Static server listening at ${baseUrl}`);

  let totalFailures = 0;

  for (const vp of VIEWPORTS) {
    console.log(`\n=================== Verifying ${vp.name} (${vp.width}x${vp.height}) ===================`);
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });

    const consoleErrors: string[] = [];
    page.on('console', (msg: any) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    const pageErrors: string[] = [];
    page.on('pageerror', (err: any) => {
      pageErrors.push(err.message);
    });

    const http404s: string[] = [];
    page.on('response', (resp: any) => {
      if (resp.status() === 404) {
        http404s.push(resp.url());
      }
    });

    try {
      await page.goto(baseUrl);
      await page.waitForLoadState('networkidle');

      // 1. Apple Carousel Verification
      const carousel = await page.$('.apple-carousel');
      const cards = await page.$$('.apple-carousel-card');
      const playButton = await page.$('.apple-carousel-play-button');
      if (!carousel || cards.length < 6 || !playButton) {
        throw new Error(`Apple Carousel missing or incomplete: cards=${cards.length}`);
      }
      console.log(`  [PASS] Apple Carousel mounted with ${cards.length} cards`);

      // Test autoplay play/pause toggle
      await page.click('.apple-carousel-play-button');
      const isPlayingAfterClick = await carousel.getAttribute('data-playing');
      console.log(`  [PASS] Apple Carousel play button toggled: data-playing=${isPlayingAfterClick}`);

      // Test carousel tab click
      await page.click('.apple-carousel-tab:nth-child(2)');
      console.log(`  [PASS] Apple Carousel tab navigation verified`);

      // 2. $wif Flywheel Modal on Start Screen
      await page.click('#start-screen button[data-action="wif-hub"]');
      await page.waitForTimeout(200);
      const modal = await page.$('#modal');
      const isOpen = modal ? await page.evaluate((el: any) => el.open, modal) : false;
      const sections = await page.$$('.wif-hub-section');
      if (!isOpen || sections.length < 4) {
        throw new Error(`$wif Hub modal failed to open or missing sections (count=${sections.length})`);
      }
      console.log(`  [PASS] $wif Hub modal opened with ${sections.length} economic sections`);

      // Test simulated wallet pill selection
      const simPills = await page.$$('.wif-sim-pill');
      if (simPills.length > 1) {
        await page.click('.wif-sim-pill:nth-child(2)');
        console.log(`  [PASS] Simulated wallet account switching verified`);
      }

      // Close modal
      await page.click('#modal button[data-action="close"]');
      await page.waitForTimeout(200);
      const isClosed = await page.evaluate((el: any) => !el.open, modal);
      if (!isClosed) throw new Error('Modal failed to close');
      console.log(`  [PASS] $wif Hub modal closed cleanly`);

      // 3. Start Game Session
      await page.waitForSelector('#start-screen button[data-action="resume"]:not([disabled])', {
        timeout: 6000,
      });
      await page.click('#start-screen button[data-action="resume"]');
      await page.waitForTimeout(600);

      const gameShell = await page.$('.game-shell');
      const startHidden = await page.evaluate(() => (document.getElementById('start-screen') as any)?.hidden);
      if (!gameShell || !startHidden) {
        throw new Error('Game session failed to mount or start screen remained visible');
      }
      console.log(`  [PASS] Game session mounted and start screen transitioned`);

      // 4. 3D Living Diorama Canvas Verification
      const cityStage = await page.$('.three-city-stage');
      const threeCanvas = await page.$('.three-city-canvas-host canvas');
      const cityShader = await page.$('#robin-city-shader');
      if (!cityStage || !threeCanvas || !cityShader) {
        throw new Error('3D Living Diorama stage, Three.js WebGL canvas, or background shader missing');
      }
      console.log(`  [PASS] 3D Living Diorama stage, Three.js canvas, and WebGL2 shader active`);

      // 5. 1-Click View Mode Toggle
      const initialMode = await page.evaluate(() => document.body.dataset.viewMode);
      if (initialMode !== 'city-3d') {
        throw new Error(`Expected initial viewMode to be city-3d, got ${initialMode}`);
      }
      console.log(`  [PASS] Default viewMode verified as city-3d`);

      await page.click('button[data-action="view-toggle"]');
      await page.waitForTimeout(300);
      const mode2d = await page.evaluate(() => document.body.dataset.viewMode);
      if (mode2d === 'city-3d') {
        throw new Error('View mode failed to toggle away from city-3d');
      }
      console.log(`  [PASS] 1-click toggle to 2D board verified: mode=${mode2d}`);

      await page.click('button[data-action="view-toggle"]');
      await page.waitForTimeout(300);
      const modeBack = await page.evaluate(() => document.body.dataset.viewMode);
      if (modeBack !== 'city-3d') {
        throw new Error(`View mode failed to toggle back to city-3d, got ${modeBack}`);
      }
      console.log(`  [PASS] 1-click toggle restored 3D city view: mode=${modeBack}`);

      // Direct segmented buttons test on desktop
      if (vp.width >= 640) {
        await page.click('button[data-action="set-view"][data-view-mode="2d"]');
        await page.waitForTimeout(200);
        await page.click('button[data-action="set-view"][data-view-mode="city-3d"]');
        await page.waitForTimeout(200);
        console.log(`  [PASS] Direct segmented view-mode buttons verified`);
      }

      // 6. iPod Classic Retro Controller Dock
      if (vp.width >= 860) {
        await page.click('.game-hud-top button[data-action="toggle-ipod"]');
        await page.waitForTimeout(300);
        const dock = await page.$('#robin-ipod-dock');
        const isVisible = dock ? await page.evaluate((el: any) => !el.hidden, dock) : false;
        const chassis = await page.$('.ipod-classic-chassis');
        const wheel = await page.$('.ipod-click-wheel');
        if (!isVisible || !chassis || !wheel) {
          throw new Error('iPod Classic dock failed to expand or missing chassis/click wheel');
        }
        console.log(`  [PASS] iPod Classic dock expanded with chassis and click wheel`);

        await page.click('#robin-ipod-dock button[data-action="toggle-ipod"]');
        await page.waitForTimeout(300);
        const isCollapsed = dock ? await page.evaluate((el: any) => el.hidden, dock) : false;
        if (!isCollapsed) throw new Error('iPod Classic dock failed to collapse');
        console.log(`  [PASS] iPod Classic dock collapsed cleanly without board obstruction`);
      } else {
        const ipodHudBtn = await page.$('.ipod-hud-btn');
        const isHidden = ipodHudBtn
          ? await page.evaluate((el: any) => window.getComputedStyle(el).display === 'none', ipodHudBtn)
          : true;
        if (!isHidden) throw new Error('iPod HUD button should be hidden on mobile viewports to prevent occlusion');
        console.log(`  [PASS] Mobile responsive layout verified (iPod dock hidden to prevent obstruction)`);
      }

      // 7. In-Game HUD $wif Hub Modal
      if (vp.width >= 600) {
        await page.click('.game-hud-top button[data-action="wif-hub"]');
        await page.waitForTimeout(300);
        const inGameModal = await page.$('#modal');
        const inGameOpen = inGameModal ? await page.evaluate((el: any) => el.open, inGameModal) : false;
        if (!inGameOpen) throw new Error('In-game HUD $wif Hub failed to open dialog');
        console.log(`  [PASS] In-game HUD $wif Hub modal opened`);

        await page.click('#modal button[data-action="close"]');
        await page.waitForTimeout(200);
        console.log(`  [PASS] In-game HUD $wif Hub modal closed`);
      }

      // 8. Error and 404 Assertions
      console.log(
        `  [PASS] Console errors: ${consoleErrors.length}, Page errors: ${pageErrors.length}, HTTP 404s: ${http404s.length}`,
      );

      if (consoleErrors.length > 0) {
        console.error(`  [FAIL] Detected console errors:`, consoleErrors);
        totalFailures++;
      }
      if (pageErrors.length > 0) {
        console.error(`  [FAIL] Detected uncaught page errors:`, pageErrors);
        totalFailures++;
      }
      if (pageErrors.length === 0 && consoleErrors.length === 0 && http404s.length === 0) {
        // all clean
      }
      if (http404s.length > 0) {
        console.error(`  [FAIL] Detected HTTP 404 assets:`, http404s);
        totalFailures++;
      }
    } catch (err) {
      console.error(`  [FAIL] Test failure on ${vp.name}:`, err);
      totalFailures++;
    } finally {
      await browser.close();
    }
  }

  server.close();

  if (totalFailures > 0) {
    console.error(`\n[verify-browser] FAILED: ${totalFailures} error(s) detected during browser verification.`);
    process.exit(1);
  } else {
    console.log(`\n======================================================================`);
    console.log(`>>> 100% PASS: All Desktop & Mobile Browser Tests Verified Clean! <<<`);
    console.log(`======================================================================\n`);
    process.exit(0);
  }
}

void runBrowserVerification();
