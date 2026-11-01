import type { GameState } from './types';
import { DISTRICTS, SHOPS, groups, holdings, income, rankings } from './engine';

export interface ScoreCardPayload {
  state: GameState;
  stakedBoost: boolean;
  walletAddress?: string | null;
  verifiedWallet?: boolean;
  verifiedTxCount?: number;
  streakDays?: number;
  dailyRank?: number | null;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function renderEmpireScoreCardDataUrl(payload: ScoreCardPayload): string {
  const { state, stakedBoost, walletAddress, verifiedWallet, verifiedTxCount, streakDays, dailyRank } =
    payload;
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 630;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Rich Harbor Emerald & Walnut Backdrop
  const bg = ctx.createLinearGradient(0, 0, 1200, 630);
  bg.addColorStop(0, '#0d261c');
  bg.addColorStop(0.55, '#163b2b');
  bg.addColorStop(1, '#261d12');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1200, 630);

  // Subtle architectural grid lines
  ctx.strokeStyle = 'rgba(139, 245, 181, 0.06)';
  ctx.lineWidth = 1;
  for (let x = 60; x < 1200; x += 60) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 630);
    ctx.stroke();
  }
  for (let y = 60; y < 630; y += 60) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(1200, y);
    ctx.stroke();
  }

  // Outer brass-gold tabletop border
  drawRoundedRect(ctx, 26, 26, 1148, 578, 22);
  ctx.strokeStyle = '#eec353';
  ctx.lineWidth = 3;
  ctx.stroke();

  drawRoundedRect(ctx, 36, 36, 1128, 558, 16);
  ctx.strokeStyle = 'rgba(203, 180, 132, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Top Kicker Pill
  drawRoundedRect(ctx, 68, 62, 510, 36, 18);
  ctx.fillStyle = '#123a29';
  ctx.fill();
  ctx.strokeStyle = '#39a883';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#8bf5b5';
  ctx.font = '800 14px system-ui, -apple-system, sans-serif';
  ctx.fillText('● ROBIN TOWN · ROBINHOOD CHAIN (4663) · $WIF', 88, 85);

  // Mode Badge on Top Right
  const modeLabel =
    state.entryMode === 'daily'
      ? `DAILY HARBOR SEED #${state.dailySeed || 'TODAY'}`
      : state.entryMode === 'ranked'
        ? 'RANKED 4,000 $WIF ARENA'
        : 'CASUAL HARBOR MATCH';
  const modeW = Math.max(260, ctx.measureText(modeLabel).width + 44);
  drawRoundedRect(ctx, 1132 - modeW, 62, modeW, 36, 18);
  ctx.fillStyle = '#3b2b10';
  ctx.fill();
  ctx.strokeStyle = '#eec353';
  ctx.stroke();
  ctx.fillStyle = '#ffea9f';
  ctx.fillText(modeLabel, 1132 - modeW + 22, 85);

  // Standings & Player Stats
  const ranked = rankings(state);
  const myPlace = ranked.findIndex((p) => p.id === 0) + 1;
  const myCash = state.players[0]?.cash ?? 0;
  const yr6Yield = income(state, 0, stakedBoost);
  const myLots = holdings(state, 0);
  const builtShops = myLots.filter((l) => l.shop !== null).length;
  const myGroups = groups(state, 0).sort((a, b) => b.size - a.size);
  const flagship = myGroups[0]
    ? `${SHOPS[myGroups[0].shop].english} (${myGroups[0].size}/${SHOPS[myGroups[0].shop].size})`
    : 'Harbor Merchant';

  // Top District Monopoly
  const districtCounts = [0, 0, 0, 0, 0, 0];
  for (const lot of myLots) {
    districtCounts[Math.floor(lot.id / 12)] += 1;
  }
  const bestDistIdx = districtCounts.indexOf(Math.max(...districtCounts));
  const bestDistrict =
    districtCounts[bestDistIdx] > 0
      ? `${DISTRICTS[bestDistIdx]} (${districtCounts[bestDistIdx]}/12 plots)`
      : 'Open Harbor';

  // Title & Crown
  ctx.fillStyle = '#f7f3e6';
  ctx.font = '900 54px system-ui, -apple-system, sans-serif';
  const crownText =
    myPlace === 1 ? 'HARBOR EMPIRE VICTORY' : `YEAR 6 HARBOR RECEIPT (#${myPlace})`;
  ctx.fillText(crownText, 68, 168);

  ctx.fillStyle = '#c8dfd1';
  ctx.font = '600 21px system-ui, -apple-system, sans-serif';
  ctx.fillText(
    `Six Zodiac Years of Street Negotiation, 3D Shophouses & On-Chain $wif Yield`,
    68,
    204,
  );

  // Primary Net Worth Card
  drawRoundedRect(ctx, 68, 234, 520, 210, 18);
  ctx.fillStyle = 'rgba(13, 36, 26, 0.88)';
  ctx.fill();
  ctx.strokeStyle = '#eec353';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#a9dec0';
  ctx.font = '800 15px system-ui, -apple-system, sans-serif';
  ctx.fillText('FINAL YEAR 6 NET WORTH', 96, 272);

  ctx.fillStyle = '#eec353';
  ctx.font = '900 74px system-ui, -apple-system, sans-serif';
  ctx.fillText(`${myCash.toLocaleString('en-US')} $wif`, 96, 355);

  ctx.fillStyle = '#8bf5b5';
  ctx.font = '700 20px system-ui, -apple-system, sans-serif';
  ctx.fillText(
    `+${yr6Yield.toLocaleString('en-US')} $wif/yr store yield${stakedBoost ? ' · 1.20x Boost Active' : ''}`,
    96,
    404,
  );

  // Right 2x2 Breakdown Grid
  const boxes = [
    { label: 'STOREFRONTS OPENED', value: `${builtShops} Shops (${myLots.length} Deeds)` },
    { label: 'OTC DEALS CLOSED', value: `${state.trades} Street Trades` },
    { label: 'FLAGSHIP CHAIN', value: flagship },
    { label: 'STRONGEST DISTRICT', value: bestDistrict },
  ];

  boxes.forEach((box, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const bx = 612 + col * 266;
    const by = 234 + row * 110;
    drawRoundedRect(ctx, bx, by, 252, 98, 14);
    ctx.fillStyle = 'rgba(22, 54, 40, 0.86)';
    ctx.fill();
    ctx.strokeStyle = '#3c735a';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#9ccab0';
    ctx.font = '800 12px system-ui, -apple-system, sans-serif';
    ctx.fillText(box.label, bx + 18, by + 34);

    ctx.fillStyle = '#f7f3e6';
    ctx.font = '800 19px system-ui, -apple-system, sans-serif';
    ctx.fillText(box.value, bx + 18, by + 68);
  });

  // Podium Bar
  drawRoundedRect(ctx, 68, 466, 1064, 54, 12);
  ctx.fillStyle = 'rgba(15, 38, 28, 0.9)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(203, 180, 132, 0.4)';
  ctx.stroke();

  ctx.fillStyle = '#ffea9f';
  ctx.font = '700 17px system-ui, -apple-system, sans-serif';
  const tableLine = ranked
    .map((p, i) => `#${i + 1} ${p.id === 0 ? 'You' : p.name}: ${p.cash} $wif`)
    .join('    ·    ');
  ctx.fillText(tableLine, 92, 499);

  // Footer Wallet & Play URL
  const shortWallet =
    walletAddress && walletAddress.length >= 12
      ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`
      : 'Guest Simulation Trader';
  const badgeParts = [
    verifiedWallet ? `✓ Verified ${shortWallet}` : `Wallet: ${shortWallet}`,
    verifiedTxCount ? `${verifiedTxCount} On-Chain $wif Tx` : null,
    streakDays && streakDays > 1 ? `${streakDays}-Day Harbor Streak` : null,
    dailyRank ? `Daily Seed Rank #${dailyRank}` : null,
  ].filter(Boolean);

  ctx.fillStyle = '#9ef5c8';
  ctx.font = '700 16px system-ui, -apple-system, sans-serif';
  ctx.fillText(badgeParts.join('  ·  '), 68, 560);

  ctx.fillStyle = '#eec353';
  ctx.font = '800 16px system-ui, -apple-system, sans-serif';
  ctx.fillText('robin-town-production.up.railway.app', 804, 560);

  return canvas.toDataURL('image/png');
}

export function downloadEmpireScoreCard(payload: ScoreCardPayload): boolean {
  const dataUrl = renderEmpireScoreCardDataUrl(payload);
  if (!dataUrl) return false;
  const link = document.createElement('a');
  const seedSuffix = payload.state.dailySeed ? `-${payload.state.dailySeed}` : '';
  link.download = `robin-town-empire${seedSuffix}.png`;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  link.remove();
  return true;
}

export function buildEmpireXShareUrl(payload: ScoreCardPayload): string {
  const ranked = rankings(payload.state);
  const myPlace = ranked.findIndex((p) => p.id === 0) + 1;
  const myCash = payload.state.players[0]?.cash ?? 0;
  const modeTag =
    payload.state.entryMode === 'daily'
      ? `on Daily Harbor Seed #${payload.state.dailySeed || 'Today'}`
      : 'in Robin Town';
  const text = [
    `Finished #${myPlace} with ${myCash.toLocaleString('en-US')} $wif ${modeTag} on Robinhood Chain (4663)!`,
    `Build 3D harbor shophouses, haggle OTC deals & put World is Flat ($wif) to work:`,
    `https://robin-town-production.up.railway.app`,
  ].join('\n');
  return `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
}
