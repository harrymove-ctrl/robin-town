/**
 * Browser QA: walks every HUD state and audits layout geometry.
 *
 * Usage (devtools console or an automation tool, with the dev server running):
 *   const { walk } = await import('/qa/state-walk.js');
 *   console.table(await walk());
 *
 * Deterministic mode: open the app with `?seed=<n>` (e.g. /?seed=42). Deals,
 * bot drafts and tile draws then come from a seeded RNG, so every run and
 * screenshot shows the same board. Each row reports the seed in use.
 *
 * States covered: idle, drafting, wallet-simulation, wallet-web3, rules-modal,
 * lobby-modal, trading, proposals-modal, trade-desk-open, building,
 * harvesting, epoch-summary, settlement.
 *
 * Each state reports overlapping HUD panels, buttons that are off-screen or
 * covered by another element, sideways scrollers, page-level horizontal
 * scroll and modals taller or wider than the viewport. The run ends with a
 * fresh match, so it can be repeated at another viewport size.
 */

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const q = (selector) => document.querySelector(selector);

const PANELS = [
  '.hud-topbar',
  '.player-ribbon',
  '.activity-feed-panel',
  '.hud-bottom-dock',
  '.action-bar-container',
  '.inventory-drawer',
];

function isNested(a, b) {
  return a === '.hud-bottom-dock' && (b === '.action-bar-container' || b === '.inventory-drawer');
}

function scrollParent(el) {
  for (let node = el.parentElement; node; node = node.parentElement) {
    if (['auto', 'scroll'].includes(getComputedStyle(node).overflowY) && node.scrollHeight > node.clientHeight + 1) return node;
  }
  return null;
}

/** Controls that must be visible without scrolling whenever their modal is open. */
const ESSENTIAL = {
  '.trade-modal-window': ['[data-action="close"]', '[data-action="clear-escrow"]', '[data-action="execute-trade"]'],
};

export function audit(state) {
  const rects = {};
  for (const selector of PANELS) {
    const el = q(selector);
    if (el) {
      const r = el.getBoundingClientRect();
      rects[selector] = { x: r.left, y: r.top, w: r.width, h: r.height };
    }
  }

  const overlaps = [];
  const keys = Object.keys(rects);
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      if (isNested(keys[i], keys[j]) || isNested(keys[j], keys[i])) continue;
      const a = rects[keys[i]];
      const b = rects[keys[j]];
      const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (overlapX > 4 && overlapY > 4) overlaps.push(`${keys[i]} x ${keys[j]}`);
    }
  }

  const modal = q('.trade-modal-window, .modal-dialog');
  const scope = modal ? '.trade-modal-window button, .modal-dialog button' : '#hud-container button';
  const blocked = [];
  for (const button of document.querySelectorAll(scope)) {
    const r = button.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const label = (button.innerText || button.title || button.className).trim().replace(/\s+/g, ' ').slice(0, 24);
    // Buttons scrolled out of their own scroll container are reachable by scrolling.
    const scroller = scrollParent(button);
    if (scroller) {
      const sr = scroller.getBoundingClientRect();
      if (r.bottom < sr.top || r.top > sr.bottom) continue;
    }
    if (r.right > innerWidth + 1 || r.left < -1 || r.bottom > innerHeight + 1 || r.top < -1) {
      blocked.push(`${label}: offscreen`);
      continue;
    }
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (top && !button.contains(top) && !top.contains(button)) {
      blocked.push(`${label}: covered by ${top.className || top.tagName}`);
    }
  }

  const scrollers = [...document.querySelectorAll('#hud-container *, .modal-dialog *, .trade-modal-window *')]
    .filter((el) => el.scrollWidth > el.clientWidth + 1 && ['auto', 'scroll'].includes(getComputedStyle(el).overflowX))
    .map((el) => `hscroller ${el.className.toString().slice(0, 24)}`);

  const pageScroll = document.documentElement.scrollWidth > innerWidth + 1 ? ['page hscroll'] : [];

  let modalOverflow = [];
  if (modal) {
    const r = modal.getBoundingClientRect();
    if (r.top < 0 || r.bottom > innerHeight + 1 || r.left < 0 || r.right > innerWidth + 1) {
      modalOverflow = [`modal ${Math.round(r.top)}..${Math.round(r.bottom)} vs ${innerHeight}`];
    }
  }

  const missing = [];
  for (const [windowSelector, controls] of Object.entries(ESSENTIAL)) {
    if (!q(windowSelector)) continue;
    for (const control of controls) {
      const el = q(`${windowSelector} ${control}`);
      const r = el?.getBoundingClientRect();
      if (!r || r.bottom > innerHeight + 1 || r.top < -1 || r.right > innerWidth + 1) missing.push(`essential ${control} not visible`);
    }
  }

  const issues = [...overlaps, ...blocked, ...scrollers, ...pageScroll, ...modalOverflow, ...missing];
  const seed = new URLSearchParams(location.search).get('seed') ?? 'random';
  return { state, viewport: `${innerWidth}x${innerHeight}`, seed, ok: issues.length === 0, issues: issues.join('; ') };
}

async function closeAll() {
  for (let i = 0; i < 3; i++) {
    const close = q('.modal-dialog .btn-close, .trade-modal-window .btn-close');
    if (!close) return;
    close.click();
    await wait(150);
  }
}

export async function walk() {
  const out = [];
  // Fresh load: nothing selected, no modal open.
  out.push(audit('idle'));

  // Allocation with a deed picked in the tray.
  q('.deed-card[data-draft-lot]')?.click();
  await wait(200);
  out.push(audit('drafting'));

  q('[data-action="wallet-toggle"]').click();
  await wait(200);
  out.push(audit('wallet-simulation'));
  q('[data-wallet-mode="web3"]')?.click();
  await wait(300);
  out.push(audit('wallet-web3'));
  q('[data-wallet-mode="simulation"]')?.click();
  await wait(200);
  await closeAll();

  q('[data-action="rules-open"]').click();
  await wait(200);
  out.push(audit('rules-modal'));
  await closeAll();

  q('[data-action="lobby-open"]').click();
  await wait(200);
  out.push(audit('lobby-modal'));
  await closeAll();

  for (let epoch = 1; epoch <= 6; epoch++) {
    q('[data-action-id="quick-draft"]').click();
    await wait(400);
    if (epoch === 1) out.push(audit('trading'));
    if (q('.proposals-modal')) {
      if (epoch === 2) out.push(audit('proposals-modal'));
      q('.proposals-modal [data-modal-close]').click();
      await wait(200);
    }
    if (epoch === 1) {
      q('.player-card[data-player-id="1"]').click();
      await wait(300);
      q('#trade-desk-container [data-tile-take][data-delta="1"]:not([disabled])')?.click();
      await wait(200);
      out.push(audit('trade-desk-open'));
      await closeAll();
    }
    q('[data-action-id="finish-trading"]').click();
    await wait(300);
    if (epoch === 1) {
      q('[data-shop-type="0"]').click();
      await wait(200);
      out.push(audit('building'));
      q('[data-action-id="cancel-shop-selection"]')?.click();
      await wait(100);
    }
    q('[data-action-id="finish-building"]').click();
    if (epoch === 1) {
      // Yield badges and cluster glows are on the board before the summary card opens.
      await wait(500);
      out.push(audit('harvesting'));
      await wait(2200);
    } else {
      // The summary (epochs 1-5) and the auto-opened settlement (epoch 6) appear after the badges.
      await wait(2700);
    }
    if (epoch === 1) out.push(audit('epoch-summary'));
    if (epoch < 6) {
      q('[data-action="epoch-continue"]')?.click();
      await wait(300);
    }
  }

  out.push(audit('settlement'));
  q('[data-action="new-match"]')?.click();
  await wait(300);
  return out;
}
