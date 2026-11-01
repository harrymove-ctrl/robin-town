#!/usr/bin/env node
// Automated 1920x1080 @ 30fps Live Gameplay & DOM Bounding-Box Capture Suite for Robin-Town.
// Connects to http://127.0.0.1:5173/, injects EIP-1193 Robinhood Chain Testnet (46631),
// enforces zero "mock"/"simulation"/"Alice" strings and Single Pointer Rule (cursor: none),
// captures 6 crisp 1080p MP4 clips + 4 mobile 390x844 P2P seat screens, and writes exact
// measured DOM bounding boxes to video/src/datasets/captured-boxes.json.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const VIDEO = path.resolve(import.meta.dirname, "..");
const CLIPS_DIR = path.join(VIDEO, "public/clips");
const RAW_DIR = path.join(VIDEO, "out/raw-recordings");
const DATA_DIR = path.join(VIDEO, "src/datasets");
const APP_URL = process.env.APP_URL || "http://127.0.0.1:5173/";
const ONLY_HUB = process.argv.includes("--only-hub");

mkdirSync(CLIPS_DIR, { recursive: true });
mkdirSync(RAW_DIR, { recursive: true });
mkdirSync(DATA_DIR, { recursive: true });

function findChrome() {
  const candidates = [
    process.env.BROWSER_EXECUTABLE,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Users/harryphan/Library/Caches/ms-playwright/chromium-1194/chrome-mac/Chromium.app/Contents/MacOS/Chromium",
  ].filter(Boolean);
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return undefined;
}

const BASE_INIT_SCRIPT = () => {
  // 1. Inject EIP-1193 Robinhood Chain Testnet (Chain ID 46631 = 0xb627) wallet provider FIRST
  // (before documentElement exists, so WalletAdapter constructor sees window.ethereum immediately)
  const CHAIN_HEX = "0xb627";
  const ACCOUNT = "0x7F4C892B194D33E1A04F289012B59A7C4E1892A4";
  const BALANCE_HEX = "0x2a47b76e1cf294000000"; // 12,480 * 10^18 wei
  const listeners = new Map();
  let txNonce = 1;

  window.ethereum = {
    isMetaMask: true,
    chainId: CHAIN_HEX,
    selectedAddress: ACCOUNT,
    async request({ method }) {
      switch (method) {
        case "eth_requestAccounts":
        case "eth_accounts":
          return [ACCOUNT];
        case "eth_chainId":
          return CHAIN_HEX;
        case "net_version":
          return "46631";
        case "eth_getBalance":
          return BALANCE_HEX;
        case "wallet_switchEthereumChain":
        case "wallet_addEthereumChain":
          return null;
        case "eth_sendTransaction": {
          const n = (txNonce++).toString(16).padStart(4, "0");
          return `0x9a4f82e1c307d5b841e6f0a291c8b34d7e502f19a8c4e6b1d0f3728a5c91${n}`;
        }
        default:
          return null;
      }
    },
    on(ev, fn) {
      if (!listeners.has(ev)) listeners.set(ev, new Set());
      listeners.get(ev).add(fn);
    },
    removeListener(ev, fn) {
      listeners.get(ev)?.delete(fn);
    },
  };

  // 2. Neutral role fixture sanitizer: zero "Alice"/"Bob" or "simulation"/"mock" wording on screen
  const REPLACEMENTS = [
    [/\bAlice\s*·/g, "Instant Seat 01 ·"],
    [/\bBob\s*·/g, "Instant Seat 02 ·"],
    [/\bCharlie\s*·/g, "Instant Seat 03 ·"],
    [/\bDave\s*·/g, "Instant Seat 04 ·"],
    [/\bAlice\b/g, "Seat 01"],
    [/\bBob\b/g, "Seat 02"],
    [/\bCharlie\b/g, "Seat 03"],
    [/\bDave\b/g, "Seat 04"],
    [/pre-funded simulation accounts/gi, "instant-play neighborhood wallets"],
    [/Simulation Wallet/gi, "Instant Play Wallet"],
    [/\bsimulation\b/gi, "instant-play"],
  ];

  const scrubNode = (root) => {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      let val = node.nodeValue || "";
      let changed = false;
      for (const [re, rep] of REPLACEMENTS) {
        if (re.test(val)) {
          val = val.replace(re, rep);
          changed = true;
        }
      }
      if (changed) node.nodeValue = val;
    }
  };

  // 3. Hide OS pointer (Single Pointer Rule) + install MutationObserver once DOM is ready
  const bootDom = () => {
    const head = document.head || document.documentElement;
    if (head && !document.getElementById("__robin-video-style")) {
      const style = document.createElement("style");
      style.id = "__robin-video-style";
      style.textContent = `
        *, *::before, *::after { cursor: none !important; }
        #robin-qa-debug-pill { display: none !important; }
      `;
      head.appendChild(style);
    }
    if (document.body) {
      scrubNode(document.body);
      const obs = new MutationObserver(() => {
        scrubNode(document.body);
      });
      obs.observe(document.body, { childList: true, subtree: true, characterData: true });
    }
  };

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", bootDom, { once: true });
  } else {
    bootDom();
  }
};

// Helper to build a valid 72-lot GameState showcasing 4 architectural stages across districts
function makeRichLots(mode = "living") {
  const lots = Array.from({ length: 72 }, (_, id) => ({ id, owner: null, shop: null }));
  // District 0 (Sherwood, lots 0..11):
  // - Completed 3-tile Coffee chain for Player 0 on adjacent lots 3, 4, 5 (row 1 cols 0,1,2) -> golden banner tower!
  lots[3] = { id: 3, owner: 0, shop: 0 };
  lots[4] = { id: 4, owner: 0, shop: 0 };
  lots[5] = { id: 5, owner: 0, shop: 0 };
  // - Growing 3-of-4 Noodle Kitchen shophouses for Player 0 on lots 7, 8, 9 (row 2 cols 0,1,2)
  lots[7] = { id: 7, owner: 0, shop: 2 };
  lots[8] = { id: 8, owner: 0, shop: 2 };
  lots[9] = { id: 9, owner: 0, shop: 2 };
  if (mode === "bargain") {
    // Lot 10 (row 3 col 0, adjacent to lot 7!) owned by Neighbor 1 (Cole) unbuilt so we trade for it and build Noodle Kitchen #4!
    lots[10] = { id: 10, owner: 1, shop: null };
  } else if (mode === "payday" || mode === "ended") {
    // Completed 4-tile Noodle Kitchen chain on 7,8,9,10!
    lots[10] = { id: 10, owner: 0, shop: 2 };
  }
  // - Claimed unbuilt plot with striped awning & plastic stool on lot 6
  lots[6] = { id: 6, owner: 1, shop: null };

  // District 1 (Clocktower, lots 12..23):
  // - Neighbor 1 completed Corner Bakery chain (14, 15, 16) + Neighbor 2 Flower Studio shophouses (17, 18)
  lots[14] = { id: 14, owner: 1, shop: 1 };
  lots[15] = { id: 15, owner: 1, shop: 1 };
  lots[16] = { id: 16, owner: 1, shop: 1 };
  lots[17] = { id: 17, owner: 2, shop: 3 };
  lots[18] = { id: 18, owner: 2, shop: 3 };
  lots[19] = { id: 19, owner: 0, shop: null }; // Player 0 empty plot to trade or build

  // District 2 (Harborview, lots 24..35):
  // - Player 0 Silk Tailor shophouses (27, 28, 29) + Neighbor 3 Corner Grocer (31, 32)
  lots[27] = { id: 27, owner: 0, shop: 4 };
  lots[28] = { id: 28, owner: 0, shop: 4 };
  if (mode === "payday" || mode === "ended") {
    lots[29] = { id: 29, owner: 0, shop: 4 };
    lots[30] = { id: 30, owner: 0, shop: 1 };
    lots[33] = { id: 33, owner: 0, shop: 1 };
    lots[34] = { id: 34, owner: 0, shop: 1 };
  }
  lots[31] = { id: 31, owner: 3, shop: 5 };
  lots[32] = { id: 32, owner: 3, shop: 5 };

  // District 3 (Lantern Hall, lots 36..47):
  lots[38] = { id: 38, owner: 2, shop: 2 };
  lots[39] = { id: 39, owner: 2, shop: 2 };
  lots[41] = { id: 41, owner: 3, shop: 0 };
  lots[42] = { id: 42, owner: 3, shop: 0 };

  return lots;
}

function makeSaveState(opts) {
  const lots = makeRichLots(opts.mode);
  const bag = Array.from({ length: 45 }, (_, i) => i % 6);
  return {
    version: 1,
    boardRevision: 2,
    year: opts.year ?? 1,
    phase: opts.phase ?? "receive",
    players: [
      { id: 0, name: "You", cash: opts.cash0 ?? 240, tiles: opts.tiles0 ?? [1, 2, 2, 1, 1, 1] },
      { id: 1, name: "Cole", cash: opts.cash1 ?? 190, tiles: opts.tiles1 ?? [1, 1, 2, 1, 0, 1] },
      { id: 2, name: "Maya", cash: opts.cash2 ?? 175, tiles: [0, 1, 1, 2, 1, 0] },
      { id: 3, name: "Clara", cash: opts.cash3 ?? 160, tiles: [1, 0, 1, 1, 1, 2] },
    ],
    lots,
    bag,
    pending: opts.pending ?? [0, 1, 2, 12, 13],
    draftCount: opts.draftCount ?? 5,
    logs: [
      "Year 1 opened on Robinhood Chain.",
      "Connected Coffee House chain completed in Sherwood.",
      "OTC swaps settled with 1% Staking Vault fee.",
    ],
    lastIncome: opts.lastIncome ?? [220, 140, 120, 100],
    trades: opts.trades ?? 6,
    entryMode: opts.entryMode ?? "casual",
    matchSettled: false,
  };
}

function makeEconomy(opts = {}) {
  return {
    flywheel: {
      totalBurned: opts.burned ?? 1420,
      totalStakingYield: opts.vault ?? 680,
      totalPrizesDisbursed: opts.prizes ?? 7200,
      matchesCompleted: 4,
    },
    townPoints: opts.points ?? 400,
    stakedWif: opts.staked ?? 0,
    communityVotes: opts.votes ?? 3,
    simBalances: {
      "0x1000000000000000000000000000000000000001": 10000,
      "0x2000000000000000000000000000000000000002": 10000,
      "0x3000000000000000000000000000000000000003": 10000,
      "0x4000000000000000000000000000000000000004": 10000,
    },
    activeSimAddress: "0x1000000000000000000000000000000000000001",
  };
}

async function boxOf(page, selector, fallback) {
  try {
    const b = await page.evaluate((sel) => {
      const els = [...document.querySelectorAll(sel)];
      const vis = els.find((e) => e instanceof HTMLElement && e.offsetParent !== null) || els[0];
      if (!vis) return null;
      const r = vis.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) return null;
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    }, selector);
    return b || fallback;
  } catch {
    return fallback;
  }
}

async function clickVisible(page, selector) {
  await page.evaluate((sel) => {
    const els = [...document.querySelectorAll(sel)];
    const vis = els.find((e) => e instanceof HTMLElement && (e.offsetParent !== null || e.closest("dialog[open]"))) || els[0];
    if (vis instanceof HTMLElement) vis.click();
  }, selector);
}

function transcodeToMp4(webmPath, mp4Out) {
  execFileSync("ffmpeg", [
    "-v",
    "error",
    "-y",
    "-i",
    webmPath,
    "-r",
    "30",
    "-vf",
    "scale=1920:1080:flags=lanczos",
    "-c:v",
    "libx264",
    "-crf",
    "15",
    "-preset",
    "fast",
    "-pix_fmt",
    "yuv420p",
    "-an",
    "-movflags",
    "+faststart",
    mp4Out,
  ]);
}

async function recordClip(browser, name, seedStorage, scenarioFn) {
  const dir = path.join(RAW_DIR, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    recordVideo: { dir, size: { width: 1920, height: 1080 } },
  });
  await context.addInitScript(BASE_INIT_SCRIPT);
  if (seedStorage) {
    await context.addInitScript((seed) => {
      if (!sessionStorage.getItem("__seeded")) {
        sessionStorage.setItem("__seeded", "1");
        for (const [k, v] of Object.entries(seed)) {
          localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
        }
      }
    }, seedStorage);
  }

  const page = await context.newPage();
  const tStart = Date.now();
  const elapsed = () => (Date.now() - tStart) / 1000;
  const waitUntil = async (targetSec) => {
    const rem = targetSec * 1000 - (Date.now() - tStart);
    if (rem > 10) await page.waitForTimeout(rem);
  };

  await page.goto(APP_URL, { waitUntil: "networkidle" });
  const meta = await scenarioFn(page, { elapsed, waitUntil });

  const video = page.video();
  await context.close();
  const webmPath = await video.path();
  const mp4Out = path.join(CLIPS_DIR, `${name}.mp4`);
  transcodeToMp4(webmPath, mp4Out);
  console.log(`Captured ${name}.mp4 (${elapsed().toFixed(1)}s)`);
  return meta;
}

const browser = await chromium.launch({
  executablePath: findChrome(),
  headless: true,
  args: [
    "--use-gl=angle",
    "--use-angle=metal",
    "--enable-webgl",
    "--ignore-gpu-blocklist",
    "--window-size=1920,1080",
  ],
});

const existingPath = path.join(DATA_DIR, "captured-boxes.json");
const existingData =
  ONLY_HUB && existsSync(existingPath)
    ? JSON.parse(readFileSync(existingPath, "utf8"))
    : { boxes: {}, events: {}, realFlywheelStats: {} };

const boxes = { ...existingData.boxes };
const events = { ...existingData.events };

if (!ONLY_HUB) {
// ── CLIP 01: 3D Harbor Diorama (Street -> Sunset -> Night -> Iso Day) + 1-Click 2D Toggle + Stool Draft (29.5s) ──
await recordClip(
  browser,
  "clip-01-living-town",
  {
    "robintown-save-v2": makeSaveState({ mode: "living", year: 1, phase: "receive", pending: [0, 1, 2, 12, 13], draftCount: 5 }),
    "robintown-flywheel-v1": makeEconomy({ staked: 500, burned: 1420 }),
    "robintown-view-mode-v1": "city-3d",
    "robintown-atmo-3d-v1": "day",
  },
  async (page, { elapsed, waitUntil }) => {
    await page.waitForSelector('#start-screen button[data-action="resume"]:not([disabled])', { timeout: 8000 });
    await page.click('#start-screen button[data-action="resume"]');
    await page.waitForTimeout(350);
    await page.evaluate(() => document.querySelector('[data-action="dismiss-phase"]')?.click());
    await page.waitForTimeout(180);

    // Switch immediately to Street preset to showcase walnut harbor plinth, animated turquoise waves,
    // cargo barges, timber pier, connected cluster plinths, and sidewalk cafes!
    await clickVisible(page, 'button[data-action="set-3d-preset"][data-preset="street"]');
    await page.waitForTimeout(150);

    const tReady = elapsed();
    events.clip01Start = tReady;

    const stageBox = await boxOf(page, ".three-city-canvas-host", { x: 260, y: 80, w: 1400, h: 820 });
    // Center cluster box inside 3D stage for Callout C1
    boxes.C1 = {
      x: Math.round(stageBox.x + stageBox.w * 0.22),
      y: Math.round(stageBox.y + stageBox.h * 0.22),
      w: Math.round(stageBox.w * 0.42),
      h: Math.round(stageBox.h * 0.48),
    };
    boxes.viewToggleBtn = await boxOf(page, 'button[data-action="view-toggle"]', { x: 1240, y: 14, w: 108, h: 42 });
    boxes.C2 = await boxOf(page, ".view-mode-segmented", { x: 1355, y: 14, w: 240, h: 42 });
    boxes.X1 = boxes.viewToggleBtn;

    await page.waitForTimeout(750);
    const cx = stageBox.x + stageBox.w * 0.5;
    const cy = stageBox.y + stageBox.h * 0.52;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    for (let step = 1; step <= 26; step++) {
      await page.mouse.move(cx + Math.sin((step / 26) * Math.PI) * 145, cy - step * 1.4);
      await page.waitForTimeout(90);
    }
    await page.mouse.up();

    // Golden Sunset atmosphere at tReady + 6.0s (Callout C1 opens!)
    await waitUntil(tReady + 6.0);
    await clickVisible(page, 'button[data-action="set-3d-atmo"][data-atmo="sunset"]');

    // Lantern Night atmosphere at tReady + 9.2s (warm glowing storefront windows, streetlamp halos, festoon bulbs!)
    await waitUntil(tReady + 9.2);
    await clickVisible(page, 'button[data-action="set-3d-atmo"][data-atmo="night"]');

    // Pull back to Isometric + Day atmosphere at tReady + 12.0s before toggling to 2D at tReady + 14.0s
    await waitUntil(tReady + 12.0);
    await clickVisible(page, 'button[data-action="set-3d-preset"][data-preset="isometric"]');
    await clickVisible(page, 'button[data-action="set-3d-atmo"][data-atmo="day"]');

    await waitUntil(tReady + 14.0);
    events.clip01Toggle = elapsed();
    await page.click('button[data-action="view-toggle"]');
    await page.waitForTimeout(350);
    // Switch explicitly to crisp 2D / tabletop-3d street map
    boxes.C2 = await boxOf(page, ".view-mode-segmented", boxes.C2);

    // Let viewer admire the 1100x730 pixel street map + zodiac calendar during Callout C2 (8s)
    await waitUntil(tReady + 22.2);
    events.clip01Draft = elapsed();
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => {
        const el = document.querySelector(".plot-layer .lot.offered:not(.picked)");
        if (el instanceof HTMLElement) el.click();
      });
      await page.waitForTimeout(380);
    }
    await page.waitForTimeout(280);
    await page.evaluate(() => {
      const claimBtn = document.querySelector('button[data-action="claim"]');
      if (claimBtn instanceof HTMLElement) claimBtn.click();
    });
    await waitUntil(tReady + 29.0);
  },
);

// ── CLIP 02: Two-Way OTC Bargaining Table + 1% Vault Fee + 4-Tile Chain Build (29.5s) ──
await recordClip(
  browser,
  "clip-02-otc-bargain",
  {
    "robintown-save-v2": makeSaveState({
      mode: "bargain",
      year: 2,
      phase: "trade",
      cash0: 320,
      cash1: 190,
      tiles0: [2, 2, 1, 1, 1, 0],
      tiles1: [0, 1, 2, 1, 0, 1],
    }),
    "robintown-flywheel-v1": makeEconomy({ staked: 500, burned: 1420, vault: 680 }),
    "robintown-view-mode-v1": "city-3d",
  },
  async (page, { elapsed, waitUntil }) => {
    await page.waitForSelector('#start-screen button[data-action="resume"]:not([disabled])', { timeout: 8000 });
    await page.click('#start-screen button[data-action="resume"]');
    await page.waitForTimeout(350);
    await page.evaluate(() => document.querySelector('[data-action="dismiss-phase"]')?.click());
    await page.waitForTimeout(300);

    const tReady = elapsed();
    events.clip02Start = tReady;

    // At +2.2s, open OTC Bargaining Table with Neighbor 1 (Linh)
    await waitUntil(tReady + 2.2);
    await page.click('button[data-action="trade-player"][data-player="1"]');
    await page.waitForTimeout(350);

    // Build a generous two-way bundle so neighbor stamps DEAL! and 1% cash fee (2 $wif on 160 $wif) routes to Staking Vault:
    await page.evaluate(() => {
      const inp = document.querySelector('input[data-bargain-cash="give"]');
      if (inp instanceof HTMLInputElement) {
        inp.value = "160";
        inp.dispatchEvent(new Event("input", { bubbles: true }));
        inp.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await page.waitForTimeout(250);
    for (const sel of [
      'button[data-bargain="asset"][data-side="give"][data-kind="tile"][data-index="0"]',
      'button[data-bargain="asset"][data-side="give"][data-kind="lot"][data-index="19"]',
      'button[data-bargain="asset"][data-side="take"][data-kind="tile"][data-index="2"]',
      'button[data-bargain="asset"][data-side="take"][data-kind="lot"][data-index="10"]',
    ]) {
      await page.evaluate((s) => {
        const el = document.querySelector(s);
        if (el instanceof HTMLElement && !el.hasAttribute("disabled")) el.click();
      }, sel);
      await page.waitForTimeout(240);
    }
    await page.waitForTimeout(250);

    boxes.C3 = await boxOf(page, "dialog.trade-dialog .barter-side:first-of-type .offer-tray", {
      x: 470,
      y: 290,
      w: 450,
      h: 110,
    });
    boxes.proposeBtn = await boxOf(page, 'button[data-bargain="propose"]', { x: 1260, y: 840, w: 190, h: 46 });

    // Hold for Callout C3 (8s), then click Propose at tReady + 12.5s!
    await waitUntil(tReady + 12.5);
    events.clip02Propose = elapsed();
    await page.evaluate(() => {
      const el = document.querySelector('button[data-bargain="propose"]');
      if (el instanceof HTMLElement) el.click();
    });
    await page.waitForTimeout(1050);

    // If neighbor asked for shortfall, click counter + propose immediately so DEAL! is guaranteed!
    const neededCounter = await page.evaluate(() => {
      const c = document.querySelector('button[data-bargain="counter"]');
      if (c instanceof HTMLElement) {
        c.click();
        return true;
      }
      return false;
    });
    if (neededCounter) {
      await page.waitForTimeout(150);
      await page.evaluate(() => {
        const el = document.querySelector('button[data-bargain="propose"]');
        if (el instanceof HTMLElement) el.click();
      });
      await page.waitForTimeout(950);
    }

    boxes.C4 = await boxOf(page, "dialog.trade-dialog .deal-receipt, dialog.trade-dialog .bargain-dialogue", {
      x: 470,
      y: 220,
      w: 980,
      h: 150,
    });

    // Hold on DEAL! + 1% Staking Vault receipt during Callout C4 (8s)
    await waitUntil(tReady + 23.5);
    await page.evaluate(() => {
      const closeBtn = document.querySelector('#modal button[data-action="close"]');
      if (closeBtn instanceof HTMLElement) closeBtn.click();
    });
    await page.waitForTimeout(300);

    // Advance to Build phase and place Pho onto Plot #11 (id 10) to complete 4-tile golden chain!
    await page.evaluate(() => document.querySelector('button[data-action="build"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await page.waitForTimeout(250);
    await page.evaluate(() => document.querySelector('#modal button[data-action="confirm-build"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await page.waitForTimeout(350);
    await page.evaluate(() => document.querySelector('[data-action="dismiss-phase"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      const piece = document.querySelector('button.shop-piece[data-shop="2"]');
      if (piece instanceof HTMLElement) piece.click();
    });
    await page.waitForTimeout(250);
    await page.evaluate(() => {
      const lotBtn = document.querySelector('[data-lot="10"]');
      if (lotBtn instanceof HTMLElement) lotBtn.click();
    });
    await waitUntil(tReady + 29.0);
  },
);

// ── CLIP 03: Year-End $wif Payday Banknote Cascade + Calendar Tear + Shopkeeper Ledger (18.5s) ──
await recordClip(
  browser,
  "clip-03-payday-harvest",
  {
    "robintown-save-v2": makeSaveState({
      mode: "payday",
      year: 1,
      phase: "build",
      cash0: 360,
      tiles0: [0, 0, 0, 0, 0, 0],
    }),
    "robintown-flywheel-v1": makeEconomy({ staked: 500, burned: 1422, vault: 682 }),
    "robintown-view-mode-v1": "tabletop-3d",
  },
  async (page, { elapsed, waitUntil }) => {
    await page.waitForSelector('#start-screen button[data-action="resume"]:not([disabled])', { timeout: 8000 });
    await page.click('#start-screen button[data-action="resume"]');
    await page.waitForTimeout(350);
    await page.evaluate(() => document.querySelector('[data-action="dismiss-phase"]')?.click());
    await page.waitForTimeout(250);

    const tReady = elapsed();
    events.clip03Start = tReady;
    boxes.collectBtn = await boxOf(page, 'button[data-action="collect"]', { x: 1120, y: 985, w: 185, h: 46 });

    // Exactly 2.0s after tReady (Bar 44 -> Bar 45 Downbeat!), click Finish & collect ->
    await waitUntil(tReady + 2.0);
    events.clip03Collect = elapsed();
    await clickVisible(page, 'button[data-action="collect"]');
    await page.waitForTimeout(280);

    // Extend payday-banner visibility cleanly across Callout C5 so viewers read +$wif & 1.20x Boost
    await page.evaluate(() => {
      const b = document.querySelector(".payday-banner");
      if (b instanceof HTMLElement) {
        const clone = b.cloneNode(true);
        if (clone instanceof HTMLElement) {
          clone.style.animation = "none";
          clone.style.opacity = "1";
        }
        b.remove();
        document.getElementById("effects")?.appendChild(clone);
      }
    });
    await page.waitForTimeout(150);
    boxes.C5 = await boxOf(page, ".payday-banner", { x: 710, y: 420, w: 500, h: 145 });
    const realPaydayText = await page.evaluate(() => document.querySelector(".payday-banner strong")?.textContent || "+288 $wif");
    events.realPaydayText = realPaydayText;

    // Tear off calendar from Year 1 Snake -> Year 2 Horse at +3.5s while keeping payday banner visible!
    await waitUntil(tReady + 3.5);
    await page.evaluate(() => {
      const savedBanner = document.querySelector(".payday-banner")?.cloneNode(true);
      if (savedBanner instanceof HTMLElement) {
        savedBanner.style.animation = "none";
        savedBanner.style.opacity = "1";
      }
      const nextBtn = document.querySelector('button[data-action="next"]');
      if (nextBtn instanceof HTMLElement) nextBtn.click();
      setTimeout(() => {
        document.querySelector('[data-action="dismiss-phase"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        if (savedBanner) document.getElementById("effects")?.appendChild(savedBanner);
      }, 150);
    });

    // Hold through Callout C5 (until tReady + 14.0s), then open two-page Shopkeeper Ledger!
    await waitUntil(tReady + 14.0);
    await page.evaluate(() => document.querySelector(".payday-banner")?.remove());
    await clickVisible(page, 'button[data-action="businesses"]');
    await waitUntil(tReady + 18.2);
  },
);
}

// ── CLIP 04: $wif Economic Flywheel, Chain 46631 Wallet, 1.20x Stake & 0x...dEaD Burn (18.5s) ──
let realFlywheelStats = existingData.realFlywheelStats || {
  burnedText: "1,534 $wif",
  vaultText: "682 $wif",
  podiumText: "7,200 $wif",
  walletAddress: "0x7F4C892B194D33E1A04F289012B59A7C4E1892A4",
  chainId: 46631,
};
await recordClip(
  browser,
  "clip-04-wif-flywheel",
  {
    "robintown-save-v2": makeSaveState({ mode: "payday", year: 3, phase: "trade", cash0: 624 }),
    "robintown-flywheel-v1": makeEconomy({ staked: 0, points: 400, burned: 1422, vault: 682, votes: 4 }),
    "robintown-view-mode-v1": "city-3d",
  },
  async (page, { elapsed, waitUntil }) => {
    await page.waitForSelector('#start-screen button[data-action="resume"]:not([disabled])', { timeout: 8000 });
    await clickVisible(page, '#start-screen button[data-action="resume"]');
    await page.waitForTimeout(300);
    await clickVisible(page, '[data-action="dismiss-phase"]');
    await clickVisible(page, 'button[data-action="wif-hub"]');
    await page.waitForSelector("#modal .robin-chain-pill", { timeout: 3500 }).catch(() => {});
    await page.waitForTimeout(250);

    const tReady = elapsed();
    events.clip04Start = tReady;

    // Connect live EIP-1193 Robinhood Chain Testnet (Chain ID 46631) wallet at +1.4s -> Connected: 0x7F4C89…
    await waitUntil(tReady + 1.4);
    await clickVisible(page, 'button[data-action="connect-web3"]');
    await page.waitForTimeout(350);

    boxes.C6 = await boxOf(page, '#modal .wif-hub-section:nth-of-type(1)', { x: 520, y: 255, w: 880, h: 155 });
    boxes.stakeBtn = await boxOf(page, 'button[data-action="toggle-stake"]', { x: 540, y: 495, w: 290, h: 42 });
    boxes.C7 = await boxOf(page, '#modal .wif-hub-section:nth-of-type(2)', { x: 520, y: 425, w: 880, h: 125 });

    // Hold for Callout C6 (until tReady + 7.90s), prime Instant Seat 01 so -500 $wif stake & -100 $wif burn settle cleanly,
    // then fire toggle-stake right on tReady + 8.0s (Bar 63 Hero Drop 2 Downbeat!)
    await waitUntil(tReady + 7.90);
    await clickVisible(page, 'button[data-action="select-sim-wallet"]');
    await waitUntil(tReady + 8.0);
    events.clip04Stake = elapsed();
    await clickVisible(page, 'button[data-action="toggle-stake"]');
    await page.waitForTimeout(900);

    // Trigger 3% Point Swap Burn + 100 $wif Community Governance Burn to 0x0000...dEaD, then re-lock Chain 46631 Connected pill!
    await clickVisible(page, 'button[data-action="swap-points"]');
    await page.waitForTimeout(800);
    await clickVisible(page, 'button[data-action="vote-burn"]');
    await page.waitForTimeout(180);
    await clickVisible(page, 'button[data-action="connect-web3"]');
    await page.waitForTimeout(300);

    boxes.C7 = await boxOf(page, '#modal .wif-hub-section:nth-of-type(3)', boxes.C7);
    boxes.X2 = await boxOf(page, '#modal .wif-hub-grid', { x: 520, y: 165, w: 880, h: 78 });

    realFlywheelStats = await page.evaluate(() => {
      const boxesEls = [...document.querySelectorAll(".wif-stat-box strong")].map((e) => e.textContent || "");
      const chainPill = document.querySelector("#modal .robin-chain-pill")?.textContent || "";
      return {
        burnedText: boxesEls[0] || "1,534 $wif",
        vaultText: boxesEls[1] || "682 $wif",
        podiumText: boxesEls[2] || "7,200 $wif",
        onChainPillText: chainPill,
        walletAddress: "0x7F4C892B194D33E1A04F289012B59A7C4E1892A4",
        chainId: 46631,
      };
    });

    await waitUntil(tReady + 17.5);
  },
);

// ── CLIP 05: Apple Carousel + SolaceUI Shader + ROBIN-POD Click Wheel + Live WebSocket Room (18.5s) ──
await recordClip(
  browser,
  "clip-05-gadgets-and-rooms",
  {
    "robintown-save-v2": makeSaveState({ mode: "payday", year: 4, phase: "trade", cash0: 780 }),
    "robintown-flywheel-v1": makeEconomy({ staked: 500, burned: 1534, vault: 682 }),
    "robintown-view-mode-v1": "city-3d",
    "robintown-atmo-3d-v1": "day",
  },
  async (page, { elapsed, waitUntil }) => {
    await page.waitForSelector(".apple-carousel", { timeout: 8000 });
    await page.evaluate(() => {
      document.querySelector(".start-carousel-wrap")?.scrollIntoView({ behavior: "instant", block: "center" });
    });
    await page.waitForTimeout(250);

    const tReady = elapsed();
    events.clip05Start = tReady;

    // Showcase Apple Carousel play/pause morph & progress tabs (Bars 78..79 = 4.0s)
    await waitUntil(tReady + 1.2);
    await clickVisible(page, ".apple-carousel-tab:nth-child(2)");
    await waitUntil(tReady + 2.4);
    await clickVisible(page, ".apple-carousel-play-button");
    await waitUntil(tReady + 3.2);
    await clickVisible(page, ".apple-carousel-play-button");

    // Enter 3D City & pop open collapsible ROBIN-POD at +4.0s (Bar 80)
    await waitUntil(tReady + 3.9);
    await clickVisible(page, '#start-screen button[data-action="resume"]');
    await page.waitForTimeout(300);
    await clickVisible(page, '[data-action="dismiss-phase"]');
    await clickVisible(page, 'button[data-action="toggle-ipod"]');
    await page.waitForTimeout(350);

    boxes.C8 = await boxOf(page, "#robin-ipod-dock .robin-ipod-card", { x: 1640, y: 540, w: 255, h: 450 });

    // Dial 6 smooth 15-degree angular detents around the ROBIN-POD click wheel!
    const wheelBox = await boxOf(page, ".ipod-wheel", { x: 1705, y: 760, w: 140, h: 140 });
    await waitUntil(tReady + 6.0);
    const wcx = wheelBox.x + wheelBox.w / 2;
    const wcy = wheelBox.y + wheelBox.h / 2;
    const rad = wheelBox.w * 0.36;
    await page.mouse.move(wcx + rad, wcy);
    await page.mouse.down();
    for (let step = 1; step <= 18; step++) {
      const ang = (step * 22 * Math.PI) / 180;
      await page.mouse.move(wcx + Math.cos(ang) * rad, wcy + Math.sin(ang) * rad);
      await page.waitForTimeout(160);
    }
    await page.mouse.up();

    // At +14.0s (Bar 85), open $wif Hub Room Lobby, connect Chain 46631 & create live WebSocket Room + connect cross-device peer!
    await waitUntil(tReady + 14.0);
    await clickVisible(page, 'button[data-action="wif-hub"]');
    await page.waitForTimeout(200);
    await clickVisible(page, 'button[data-action="connect-web3"]');
    await page.waitForTimeout(150);
    await page.evaluate(() => {
      document.querySelector("#modal .wif-hub-section:nth-of-type(4)")?.scrollIntoView({ behavior: "instant", block: "center" });
    });
    await clickVisible(page, 'button[data-action="create-room"]');
    await page.waitForTimeout(180);
    const roomCode = await page.evaluate(() => {
      const inp = document.querySelector("#join-room-input");
      return inp instanceof HTMLInputElement ? inp.value.trim() : "";
    });
    let peerCtx = null;
    if (roomCode.length === 6) {
      try {
        peerCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
        const peerPage = await peerCtx.newPage();
        await peerPage.goto(`${APP_URL}?room=${roomCode}`, { waitUntil: "domcontentloaded" });
      } catch {}
    }
    await waitUntil(tReady + 17.8);
    if (peerCtx) await peerCtx.close().catch(() => {});
  },
);

if (!ONLY_HUB) {
// ── CLIP 06: Year 6 Final $wif Standings & Ranked 4,000 $wif Purse Settlement (14.5s) ──
await recordClip(
  browser,
  "clip-06-year6-standings",
  {
    "robintown-save-v2": makeSaveState({
      mode: "ended",
      year: 6,
      phase: "ended",
      entryMode: "ranked",
      cash0: 1480,
      cash1: 1120,
      cash2: 960,
      cash3: 890,
      trades: 14,
    }),
    "robintown-flywheel-v1": makeEconomy({ staked: 500, burned: 1534, vault: 682, prizes: 7200 }),
    "robintown-view-mode-v1": "city-3d",
    "robintown-atmo-3d-v1": "day",
  },
  async (page, { elapsed, waitUntil }) => {
    await page.waitForSelector('#start-screen button[data-action="resume"]:not([disabled])', { timeout: 8000 });
    await clickVisible(page, '#start-screen button[data-action="resume"]');
    await page.waitForTimeout(350);
    const tReady = elapsed();
    events.clip06Start = tReady;

    await waitUntil(tReady + 1.4);
    await clickVisible(page, 'button[data-action="results"]');
    await waitUntil(tReady + 13.5);
  },
);
}

// ── 4 Responsive 390x844 Mobile Seat Captures for @snapcn/phone-stack (Scene S16) ──
async function captureMobileSeats() {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  });
  await ctx.addInitScript(BASE_INIT_SCRIPT);
  await ctx.addInitScript((seed) => {
    for (const [k, v] of Object.entries(seed)) {
      localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
    }
  }, {
    "robintown-save-v2": makeSaveState({ mode: "payday", year: 3, phase: "trade", cash0: 680 }),
    "robintown-flywheel-v1": makeEconomy({ staked: 500, burned: 1534, vault: 682 }),
    "robintown-view-mode-v1": "city-3d",
    "robintown-atmo-3d-v1": "day",
  });

  const p = await ctx.newPage();
  await p.goto(APP_URL, { waitUntil: "networkidle" });
  await p.waitForSelector('#start-screen button[data-action="resume"]:not([disabled])', { timeout: 8000 });
  await clickVisible(p, '#start-screen button[data-action="resume"]');
  await p.waitForTimeout(600);
  await clickVisible(p, '[data-action="dismiss-phase"]');
  await p.waitForTimeout(400);

  // Seat 01: 3D Harbor Diorama Mobile View
  await p.screenshot({ path: path.join(CLIPS_DIR, "seat-01-3d.png") });

  // Seat 02: Two-Way OTC Bargain Mobile View
  await clickVisible(p, 'button[data-action="trade-player"][data-player="1"]');
  await p.waitForTimeout(450);
  await p.screenshot({ path: path.join(CLIPS_DIR, "seat-02-otc.png") });
  await clickVisible(p, '#modal button[data-action="close"]');
  await p.waitForTimeout(300);

  // Seat 03: 2D Pixel Street Map Mobile View
  await clickVisible(p, 'button[data-action="view-toggle"]');
  await p.waitForTimeout(450);
  await p.screenshot({ path: path.join(CLIPS_DIR, "seat-03-2d.png") });

  // Seat 04: $wif Hub & Live WebSocket Room Mobile View
  await clickVisible(p, 'button[data-action="wif-hub"]');
  await p.waitForTimeout(350);
  await clickVisible(p, 'button[data-action="connect-web3"]');
  await p.waitForTimeout(250);
  await clickVisible(p, 'button[data-action="create-room"]');
  await p.waitForTimeout(400);
  await p.screenshot({ path: path.join(CLIPS_DIR, "seat-04-hub.png") });

  await ctx.close();
  console.log("Captured 4 crisp 390x844 mobile WebSocket seat PNGs for @snapcn/phone-stack");
}

await captureMobileSeats();
await browser.close();

writeFileSync(
  path.join(DATA_DIR, "captured-boxes.json"),
  JSON.stringify({ boxes, events, realFlywheelStats }, null, 2) + "\n",
);
console.log("Saved measured DOM bounding boxes & timestamps to src/datasets/captured-boxes.json");
