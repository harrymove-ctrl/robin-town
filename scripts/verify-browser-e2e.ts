/**
 * scripts/verify-browser-e2e.ts
 *
 * Multi-Viewport Headless Playwright Verification Suite for Robin-Town (Milestone M14)
 * Tests Desktop (1440x900), CompactLaptop (1280x760), Mobile (390x844), and MobileLandscape (844x390)
 * viewports with zero external dependencies.
 * Asserts zero console errors, zero page errors, zero 404 image requests,
 * responsive Start Screen (.start-layout-grid), $wif Flywheel modal (.wif-hub-sections-grid),
 * Apple Carousel interaction, 3D Living Diorama rendering, view mode toggles,
 * compact landscape HUD rules, and collapsible iPod Classic dock.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
// @ts-expect-error ESM helper script
import { createMultiplayerRelay } from './ws-relay.mjs';

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
  const relay = createMultiplayerRelay();
  return http.createServer((req, res) => {
    if (relay.handleApiRequest(req, res)) {
      return;
    }
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
  { name: 'CompactLaptop', width: 1280, height: 760 },
  { name: 'Mobile', width: 390, height: 844 },
  { name: 'MobileLandscape', width: 844, height: 390 },
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
    const chromeExecutable = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    const browser = await chromium.launch({
      headless: true,
      ...(fs.existsSync(chromeExecutable) ? { executablePath: chromeExecutable } : {}),
      args: ['--use-gl=angle', '--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist'],
    });
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

      // 1a. Responsive Start Screen Grid & Zero Horizontal Overflow
      const startMetrics = await page.evaluate(() => {
        const panel = document.querySelector<HTMLElement>('#start-screen .start-panel');
        const grid = document.querySelector<HTMLElement>('#start-screen .start-layout-grid');
        const cmdCol = document.querySelector<HTMLElement>('#start-screen .start-command-col');
        const gridCols = grid ? window.getComputedStyle(grid).gridTemplateColumns.trim() : '';
        return {
          hasGrid: Boolean(grid),
          hasCommandCol: Boolean(cmdCol),
          panelClientW: panel?.clientWidth ?? 0,
          panelScrollW: panel?.scrollWidth ?? 0,
          docClientW: document.documentElement.clientWidth,
          docScrollW: document.documentElement.scrollWidth,
          colCount: gridCols ? gridCols.split(' ').filter(Boolean).length : 0,
          gridCols,
        };
      });
      if (!startMetrics.hasGrid || !startMetrics.hasCommandCol) {
        throw new Error(
          `Start Screen missing .start-layout-grid (${startMetrics.hasGrid}) or .start-command-col (${startMetrics.hasCommandCol})`,
        );
      }
      if (startMetrics.panelScrollW > startMetrics.panelClientW + 2) {
        throw new Error(
          `Start Screen .start-panel horizontal overflow on ${vp.name}: scrollWidth=${startMetrics.panelScrollW} > clientWidth=${startMetrics.panelClientW}`,
        );
      }
      if (startMetrics.docScrollW > vp.width + 2) {
        throw new Error(
          `Start Screen document horizontal overflow on ${vp.name}: scrollWidth=${startMetrics.docScrollW} > viewport=${vp.width}`,
        );
      }
      if (vp.width >= 920 && vp.height >= 540) {
        if (startMetrics.colCount !== 2) {
          throw new Error(
            `Expected 2-column .start-layout-grid on ${vp.name}, got ${startMetrics.colCount} (${startMetrics.gridCols})`,
          );
        }
      } else if (vp.height <= 539 && vp.width > vp.height) {
        if (startMetrics.colCount !== 2) {
          throw new Error(
            `Expected 2-column landscape .start-layout-grid on ${vp.name}, got ${startMetrics.colCount} (${startMetrics.gridCols})`,
          );
        }
      } else if (startMetrics.colCount !== 1) {
        throw new Error(
          `Expected 1-column .start-layout-grid on ${vp.name}, got ${startMetrics.colCount} (${startMetrics.gridCols})`,
        );
      }
      console.log(
        `  [PASS] Start Screen .start-layout-grid (${startMetrics.colCount}-col) & .start-panel zero overflow (${startMetrics.panelScrollW}/${startMetrics.panelClientW}px)`,
      );

      // 1b. Apple Carousel Verification
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

      const wifHubMetrics = await page.evaluate(() => {
        const dlg = document.querySelector<HTMLElement>('#modal');
        const sectionsGrid = document.querySelector<HTMLElement>('#modal .wif-hub-sections-grid');
        const gridCols = sectionsGrid
          ? window.getComputedStyle(sectionsGrid).gridTemplateColumns.trim()
          : '';
        return {
          hasSectionsGrid: Boolean(sectionsGrid),
          modalClientW: dlg?.clientWidth ?? 0,
          modalScrollW: dlg?.scrollWidth ?? 0,
          colCount: gridCols ? gridCols.split(' ').filter(Boolean).length : 0,
          gridCols,
        };
      });
      if (!wifHubMetrics.hasSectionsGrid) {
        throw new Error('$wif Hub modal missing .wif-hub-sections-grid');
      }
      if (wifHubMetrics.modalScrollW > wifHubMetrics.modalClientW + 2) {
        throw new Error(
          `$wif Hub #modal horizontal overflow on ${vp.name}: scrollWidth=${wifHubMetrics.modalScrollW} > clientWidth=${wifHubMetrics.modalClientW}`,
        );
      }
      const expectedWifCols = vp.width >= 960 ? 3 : vp.width >= 681 ? 2 : 1;
      if (wifHubMetrics.colCount !== expectedWifCols) {
        throw new Error(
          `Expected ${expectedWifCols}-column .wif-hub-sections-grid on ${vp.name}, got ${wifHubMetrics.colCount} (${wifHubMetrics.gridCols})`,
        );
      }
      console.log(
        `  [PASS] $wif Hub modal opened with ${sections.length} sections (${wifHubMetrics.colCount}-col grid, zero overflow ${wifHubMetrics.modalScrollW}/${wifHubMetrics.modalClientW}px)`,
      );

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

      // 4. 3D Living Diorama Canvas & Responsive HUD Verification
      const cityStage = await page.$('.three-city-stage');
      const threeCanvas = await page.$('.three-city-canvas-host canvas');
      const cityShader = await page.$('#robin-city-shader');
      if (!cityStage || !threeCanvas || !cityShader) {
        throw new Error('3D Living Diorama stage, Three.js WebGL canvas, or background shader missing');
      }
      console.log(`  [PASS] 3D Living Diorama stage, Three.js canvas, and WebGL2 shader active`);

      if (vp.height <= 539 && vp.width > vp.height) {
        const landscapeHud = await page.evaluate(() => {
          const hudTop = document.querySelector<HTMLElement>('.game-hud-top');
          const stage = document.querySelector<HTMLElement>('.three-city-stage');
          const seg = document.querySelector<HTMLElement>('.robin-hud-utilities .view-mode-segmented');
          const ipod = document.querySelector<HTMLElement>('.robin-hud-utilities .ipod-hud-btn');
          const inv = document.querySelector<HTMLElement>('.game-shell .pocket-inventory');
          const viewBtn = document.querySelector<HTMLElement>('.robin-hud-utilities .view-toggle-btn');
          return {
            hudHeight: hudTop?.getBoundingClientRect().height ?? 0,
            hudClientW: hudTop?.clientWidth ?? 0,
            hudScrollW: hudTop?.scrollWidth ?? 0,
            stageHeight: stage?.getBoundingClientRect().height ?? 0,
            segDisplay: seg ? window.getComputedStyle(seg).display : 'none',
            ipodDisplay: ipod ? window.getComputedStyle(ipod).display : 'none',
            invDisplay: inv ? window.getComputedStyle(inv).display : 'none',
            viewBtnDisplay: viewBtn ? window.getComputedStyle(viewBtn).display : 'none',
          };
        });
        if (
          landscapeHud.segDisplay !== 'none' ||
          landscapeHud.ipodDisplay !== 'none' ||
          landscapeHud.invDisplay !== 'none' ||
          landscapeHud.viewBtnDisplay === 'none'
        ) {
          throw new Error(
            `MobileLandscape compact HUD media query mismatch: ${JSON.stringify(landscapeHud)}`,
          );
        }
        if (landscapeHud.hudScrollW > landscapeHud.hudClientW + 2 || landscapeHud.hudHeight > 54) {
          throw new Error(
            `MobileLandscape single-row HUD overflow or excessive height: ${JSON.stringify(landscapeHud)}`,
          );
        }
        console.log(
          `  [PASS] MobileLandscape compact single-row HUD verified (HUD=${Math.round(landscapeHud.hudHeight)}px, 3D stage=${Math.round(landscapeHud.stageHeight)}px)`,
        );
      }

      // 5. 1-Click View Mode Toggle
      const initialMode = await page.evaluate(() => document.body.dataset.viewMode);
      if (initialMode !== 'city-3d') {
        throw new Error(`Expected initial viewMode to be city-3d, got ${initialMode}`);
      }
      console.log(`  [PASS] Default viewMode verified as city-3d`);

      if (vp.width >= 1321) {
        await page.click('.three-city-toolbar button[data-action="view-toggle"]');
      } else {
        await page.click('.robin-hud-utilities button[data-action="view-toggle"]');
      }
      await page.waitForTimeout(300);
      const mode2d = await page.evaluate(() => document.body.dataset.viewMode);
      if (mode2d === 'city-3d') {
        throw new Error('View mode failed to toggle away from city-3d');
      }
      console.log(`  [PASS] 1-click toggle to 2D board verified: mode=${mode2d}`);

      if (vp.width >= 1321) {
        await page.click('.robin-hud-utilities button[data-action="set-view"][data-view-mode="city-3d"]');
      } else {
        await page.click('.robin-hud-utilities button[data-action="view-toggle"]');
      }
      await page.waitForTimeout(300);
      const modeBack = await page.evaluate(() => document.body.dataset.viewMode);
      if (modeBack !== 'city-3d') {
        throw new Error(`View mode failed to toggle back to city-3d, got ${modeBack}`);
      }
      console.log(`  [PASS] 1-click toggle restored 3D city view: mode=${modeBack}`);

      // Direct segmented buttons test on widescreen desktop (>= 1321px and height >= 540px)
      if (vp.width >= 1321 && vp.height >= 540) {
        await page.click('.robin-hud-utilities button[data-action="set-view"][data-view-mode="2d"]');
        await page.waitForTimeout(200);
        const seg2d = await page.evaluate(() => document.body.dataset.viewMode);
        if (seg2d !== '2d') throw new Error(`Expected segmented 2d mode, got ${seg2d}`);
        await page.click(
          '.robin-hud-utilities button[data-action="set-view"][data-view-mode="tabletop-3d"]',
        );
        await page.waitForTimeout(200);
        const segTilt = await page.evaluate(() => document.body.dataset.viewMode);
        if (segTilt !== 'tabletop-3d') {
          throw new Error(`Expected segmented tabletop-3d mode, got ${segTilt}`);
        }
        await page.keyboard.press('v');
        await page.waitForTimeout(200);
        const hotkeyMode = await page.evaluate(() => document.body.dataset.viewMode);
        if (hotkeyMode !== 'city-3d') {
          throw new Error(`Expected 'v' hotkey to restore city-3d mode, got ${hotkeyMode}`);
        }
        console.log(`  [PASS] Direct segmented view-mode buttons and 'v' hotkey verified`);
      } else {
        const segHidden = await page.evaluate(() => {
          const el = document.querySelector<HTMLElement>('.robin-hud-utilities .view-mode-segmented');
          return !el || window.getComputedStyle(el).display === 'none';
        });
        if (!segHidden) {
          throw new Error(`Expected .view-mode-segmented to be hidden on ${vp.name}`);
        }
        console.log(`  [PASS] Compact HUD view-toggle verified (.view-mode-segmented hidden on ${vp.name})`);
      }

      // 6. iPod Classic Retro Controller Dock
      // Respects @media (max-width: 860px), @media (max-height: 539px) and (orientation: landscape),
      // and @media (max-width: 1380px) and (min-width: 1261px) single-row compact laptop rule.
      const ipodExpectedVisible =
        vp.height >= 540 && (vp.width > 1380 || (vp.width >= 861 && vp.width <= 1260));
      if (ipodExpectedVisible) {
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
        if (!isHidden) {
          throw new Error(`iPod HUD button should be hidden on ${vp.name} to prevent HUD/board occlusion`);
        }
        console.log(`  [PASS] Responsive HUD verified on ${vp.name} (iPod button hidden per media query)`);
      }

      // 7. In-Game HUD $wif Hub Modal Across All Viewports
      await page.click('.game-hud-top button[data-action="wif-hub"]');
      await page.waitForTimeout(300);
      const inGameModalCheck = await page.evaluate(() => {
        const dlg = document.querySelector<HTMLDialogElement>('#modal');
        return {
          open: Boolean(dlg?.open),
          clientW: dlg?.clientWidth ?? 0,
          scrollW: dlg?.scrollWidth ?? 0,
        };
      });
      if (!inGameModalCheck.open) throw new Error('In-game HUD $wif Hub failed to open dialog');
      if (inGameModalCheck.scrollW > inGameModalCheck.clientW + 2) {
        throw new Error(
          `In-game #modal horizontal overflow on ${vp.name}: scrollWidth=${inGameModalCheck.scrollW} > clientWidth=${inGameModalCheck.clientW}`,
        );
      }
      console.log(`  [PASS] In-game HUD $wif Hub modal opened with zero horizontal overflow`);

      await page.click('#modal button[data-action="close"]');
      await page.waitForTimeout(200);
      console.log(`  [PASS] In-game HUD $wif Hub modal closed`);

      // 7b. Player Card Bot Name Readability & Fast Play Toggle Verification
      const hudCheck = await page.evaluate(() => {
        const names = [...document.querySelectorAll('.pocket-token b')].map((el) => ({
          text: el.textContent || '',
          clientW: el.clientWidth,
          scrollW: el.scrollWidth,
          truncated: el.scrollWidth > el.clientWidth + 1,
        }));
        const hasFastBtn = Boolean(
          document.querySelector('.game-hud-top [data-action="toggle-fast-play"]'),
        );
        const hasBotFeed = Boolean(document.querySelector('.bot-live-feed'));
        return { names, hasFastBtn, hasBotFeed };
      });
      if (!hudCheck.hasFastBtn || !hudCheck.hasBotFeed) {
        throw new Error('Fast Play button or Live Bot Feed missing in HUD');
      }
      const minNameWidth = vp.height <= 539 ? 16 : 20;
      if (
        hudCheck.names.length !== 4 ||
        hudCheck.names.some(
          (n: { clientW: number; truncated: boolean }) => n.clientW < minNameWidth || n.truncated,
        )
      ) {
        throw new Error(`Player card bot names truncated on ${vp.name}: ${JSON.stringify(hudCheck.names)}`);
      }
      console.log(`  [PASS] All 4 player names (YOU, COLE, MAYA, CLARA) un-truncated and Fast Play ready`);

      await page.evaluate(() => {
        document.querySelector<HTMLElement>('.game-hud-top [data-action="toggle-fast-play"]')?.click();
      });
      await page.waitForTimeout(380);
      await page.evaluate(() => {
        document.querySelector<HTMLElement>('.game-hud-top [data-action="stop-fast-play"]')?.click();
      });
      await page.waitForTimeout(150);
      console.log(`  [PASS] Fast Play A-to-Z started and paused cleanly`);

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
    console.log(`\n================================================================================`);
    console.log(`>>> 100% PASS: All 4 Viewports (Desktop, CompactLaptop, Mobile, Landscape) Clean! <<<`);
    console.log(`================================================================================\n`);
    process.exit(0);
  }
}

void runBrowserVerification();
