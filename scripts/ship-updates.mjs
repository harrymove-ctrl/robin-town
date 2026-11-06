import {
  VAULT_CONTRACT_ABI,
  VAULT_CONTRACT_METADATA,
  VAULT_CREATION_TX_DATA_MAINNET,
  VAULT_SOLIDITY_SOURCE,
} from './contract-artifact.mjs';
import {
  buildJsonFeedPayload,
  renderAtomFeedXml,
  renderDocsHtml,
  renderLlmsTxt,
  renderPortalTopbarHtml,
  renderRobotsTxt,
  renderRssFeedXml,
  renderSharedPortalCss,
  renderSitemapXml,
} from './game-docs.mjs';

export const PRODUCTION_ORIGIN = 'https://robin-town-production.up.railway.app';
export const GITHUB_REPO_URL = 'https://github.com/harrymove-ctrl/robin-town';
export const WIF_TOKEN_CONTRACT_MAINNET = '0x5173b8eA6923c2d40267890D45C46a3480954773';

export const SHIP_RELEASES = [
  {
    version: 'v1.6.0',
    date: '2026-11-06',
    publishedAt: '2026-11-06T07:00:00Z',
    categories: ['Gameplay', 'Web3 & $wif', 'Multiplayer & Infra'],
    title: '9-Viewport Mobile HUD, Concise 2x2 $wif Hub & Chain 4663 Video Suite',
    tagUrl: `${GITHUB_REPO_URL}/releases/tag/v1.6.0`,
    highlights: [
      'Polished mobile 3D camera toolbar, compact $wif HUD balance pills, and above-the-fold Start Screen cards.',
      'Streamlined the $wif Hub into a concise 2x2 layout covering Wallet, 1.20x Vault Staking, Point Swap, and 4-Player Rooms.',
      'Fixed Shopkeeper Ledger ribbon geometry and unified Robinhood Chain Mainnet (4663) telemetry across all views and videos.',
    ],
  },
  {
    version: 'v1.5.0',
    date: '2026-11-02',
    publishedAt: '2026-11-02T05:00:00Z',
    categories: ['Multiplayer & Infra', 'Web3 & $wif', 'Gameplay'],
    title: 'Live News Hub, Game Docs & Syndicated Release Feeds',
    tagUrl: `${GITHUB_REPO_URL}/releases/tag/v1.5.0`,
    highlights: [
      'Launched /changelog with category filters, version permalinks, and auto-discovered feed links.',
      'Published RSS 2.0 (/changelog.xml), Atom 1.0 (/atom.xml), and JSON Feed 1.1 (/feed.json).',
      'Added /docs covering the 6-year turn loop, storefront yields, Zodiac events, and contract ABI.',
      'Added the in-game What\'s New & 6-Year Zodiac Forecast Hub (/?news=1) plus live $wif burn pill.',
    ],
  },
  {
    version: 'v1.4.0',
    date: '2026-11-02',
    publishedAt: '2026-11-02T04:30:00Z',
    categories: ['Smart Contract', 'Web3 & $wif'],
    title: 'RobinTownHarborVault (RTOWN) Contract & 1-Click Deploy Studio',
    tagUrl: `${GITHUB_REPO_URL}/releases/tag/v1.4.0`,
    highlights: [
      'Shipped RobinTownHarborVault.sol (Solc 0.8.24, paris) on Robinhood Chain (4663) with soulbound RTOWN reputation.',
      'Added gas-only Year 6 match anchoring (recordHarborMatch) and instant-withdrawal $wif staking (1.20x payday boost).',
      'Launched /deploy for 1-click browser MetaMask contract deployment and Blockscout source verification.',
    ],
  },
  {
    version: 'v1.3.0',
    date: '2026-11-02',
    publishedAt: '2026-11-02T03:50:00Z',
    categories: ['Gameplay', 'Web3 & $wif', 'Multiplayer & Infra'],
    title: 'Zodiac Harbor Events, Guild Seals & AI Counter-Offers',
    tagUrl: `${GITHUB_REPO_URL}/releases/tag/v1.3.0`,
    highlights: [
      'Added 6 deterministic yearly Zodiac Market Events and +15 $wif/yr District Guild Majority Seals.',
      'Added 1-click AI Counter-Offers and Rival Monopoly Risk alerts inside the OTC Bargaining Table.',
      'Added EIP-6963 multi-wallet discovery, MetaMask mobile deep-linking, and Beat-My-Score challenge links.',
    ],
  },
  {
    version: 'v1.2.0',
    date: '2026-11-01',
    publishedAt: '2026-11-01T18:00:00Z',
    categories: ['Gameplay', 'Web3 & $wif', 'Multiplayer & Infra'],
    title: '9-Viewport Responsive Shell, Wallet Registry & Daily Streaks',
    tagUrl: `${GITHUB_REPO_URL}/releases/tag/v1.2.0`,
    highlights: [
      'Rebuilt responsive layout across 9 desktop, tablet, and mobile viewports with zero overflow.',
      'Shipped persistent Harbor Wallet Registry with gasless EIP-191 verification and Daily Seed leaderboards.',
      'Added downloadable 1200x630 Year 6 Empire Score Cards and 1-click Sweeten (+10 $wif) bargaining.',
    ],
  },
  {
    version: 'v1.1.0',
    date: '2026-10-31',
    publishedAt: '2026-10-31T16:00:00Z',
    categories: ['Gameplay', 'Multiplayer & Infra'],
    title: 'Fast Play A-to-Z Simulation & Smart Draft Synergies',
    tagUrl: `${GITHUB_REPO_URL}/releases/tag/v1.1.0`,
    highlights: [
      'Added Fast Play 1x, 3x, and 8x simulation alongside bot-to-bot OTC bargaining.',
      'Added connected-corner draft badges, +$wif/yr build yield previews, and 1-click online room joining.',
    ],
  },
  {
    version: 'v1.0.0',
    date: '2026-10-30',
    publishedAt: '2026-10-30T14:00:00Z',
    categories: ['Gameplay', 'Web3 & $wif'],
    title: 'Robin Town Launch: 3D Harbor Diorama & $wif Flywheel',
    tagUrl: `${GITHUB_REPO_URL}/releases/tag/v1.0.0`,
    highlights: [
      'Launched 6-year trading board game across 72 plots, 6 districts, and 6 storefront types in 3D and 2D.',
      'Integrated official World is Flat ($wif) Mainnet token (0x5173b8eA6923c2d40267890D45C46a3480954773) on Chain 4663.',
    ],
  },
];

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderChangelogHtml(vaultInfo = null, canonicalPath = '/changelog') {
  const vaultAddr = vaultInfo?.vaultContractAddress || null;
  const vaultBlockscoutUrl = vaultAddr
    ? `https://robinhoodchain.blockscout.com/address/${vaultAddr}`
    : null;

  const articlesHtml = SHIP_RELEASES.map(
    (rel, idx) => `<article class="ship-card" id="${escapeHtml(rel.version)}" data-cats="${escapeHtml((rel.categories || []).join('|'))}">
      <header class="ship-card-head">
        <div class="ship-badges">
          <a class="ship-version" href="#${escapeHtml(rel.version)}">${escapeHtml(rel.version)}</a>
          <time datetime="${escapeHtml(rel.date)}">${escapeHtml(rel.date)}</time>
          ${idx === 0 ? '<span class="ship-latest">LATEST SHIP</span>' : ''}
          ${(rel.categories || []).map((c) => `<span class="ship-cat">${escapeHtml(c)}</span>`).join('')}
        </div>
        <h2>${escapeHtml(rel.title)}</h2>
      </header>
      <ol class="ship-list">
        ${rel.highlights.map((item) => `<li>${escapeHtml(item)}</li>`).join('\n        ')}
      </ol>
      <footer class="ship-card-foot">
        <a href="${escapeHtml(rel.tagUrl)}" target="_blank" rel="noopener">GitHub Release ${escapeHtml(rel.version)} ↗</a>
        <a href="/changelog#${escapeHtml(rel.version)}" class="permalink">Permalink #${escapeHtml(rel.version)}</a>
      </footer>
    </article>`,
  ).join('\n    ');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Robin Town Changelog &amp; Release Feed · Robinhood Chain (4663)</title>
    <meta name="description" content="Dated product changelog, syndicated RSS/Atom release feeds, and verified engineering ships for Robin Town on Robinhood Chain Mainnet (4663) powered by World is Flat ($wif)." />
    <link rel="canonical" href="${PRODUCTION_ORIGIN}${escapeHtml(canonicalPath)}" />
    <link rel="vcs-git" href="${GITHUB_REPO_URL}" />
    <link rel="alternate" type="application/rss+xml" title="Robin Town Changelog (RSS 2.0)" href="${PRODUCTION_ORIGIN}/changelog.xml" />
    <link rel="alternate" type="application/atom+xml" title="Robin Town Changelog (Atom 1.0)" href="${PRODUCTION_ORIGIN}/atom.xml" />
    <link rel="alternate" type="application/feed+json" title="Robin Town Release Feed (JSON)" href="${PRODUCTION_ORIGIN}/feed.json" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Robin Town" />
    <meta property="og:url" content="${PRODUCTION_ORIGIN}${escapeHtml(canonicalPath)}" />
    <meta property="og:title" content="Robin Town · Changelog &amp; Verified Release Feed" />
    <meta property="og:description" content="Follow every shipped release of Robin Town on Robinhood Chain (4663) via web changelog, RSS 2.0, Atom 1.0, or JSON Feed." />
    <meta property="og:image" content="${PRODUCTION_ORIGIN}/assets/saigon/saigon-town-og-v8.png?v=v13" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Robin Town · Changelog &amp; Verified Release Feed" />
    <meta name="twitter:description" content="Follow every shipped release of Robin Town on Robinhood Chain (4663) with World is Flat ($wif)." />
    <meta name="twitter:image" content="${PRODUCTION_ORIGIN}/assets/saigon/saigon-town-og-v8.png?v=v13" />
    <style>
      ${renderSharedPortalCss()}
      .feed-copy-bar {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
        margin-top: 12px;
      }
      .copy-chip {
        cursor: pointer;
        background: var(--card);
        color: var(--mint);
        border: 1px solid rgba(139, 245, 181, 0.32);
        border-radius: 9px;
        padding: 6px 11px;
        font-size: 12.5px;
        font-weight: 700;
      }
      .copy-chip:hover { border-color: var(--gold); color: var(--gold); }
      .filter-bar {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 16px;
      }
      .filter-btn {
        cursor: pointer;
        background: var(--panel);
        color: var(--muted);
        border: 1px solid var(--border);
        border-radius: 999px;
        padding: 6px 14px;
        font-size: 13px;
        font-weight: 700;
      }
      .filter-btn.active {
        background: var(--gold);
        color: #13261b;
        border-color: var(--gold);
      }
      .ship-card {
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 16px;
        padding: 20px 22px;
        margin-bottom: 16px;
        scroll-margin-top: 82px;
      }
      .ship-badges {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
        margin-bottom: 8px;
        font-size: 13px;
      }
      .ship-version {
        font-weight: 800;
        color: #14261c;
        background: var(--gold);
        padding: 2px 10px;
        border-radius: 999px;
        text-decoration: none;
      }
      .ship-latest {
        font-weight: 800;
        font-size: 11px;
        color: var(--mint);
        border: 1px solid var(--mint);
        padding: 2px 8px;
        border-radius: 999px;
      }
      .ship-cat {
        font-size: 11.5px;
        font-weight: 700;
        color: var(--muted);
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.12);
        padding: 2px 8px;
        border-radius: 999px;
      }
      time { color: var(--muted); font-weight: 600; }
      h2 { margin: 0 0 12px; font-size: 20px; color: var(--text); }
      .ship-list { margin: 0 0 14px; padding-left: 20px; color: var(--text); }
      .ship-list li { margin-bottom: 6px; }
      .ship-card-foot { display: flex; flex-wrap: wrap; gap: 16px; align-items: center; }
      .ship-card-foot a { color: var(--gold); font-weight: 700; text-decoration: none; font-size: 13.5px; }
      .ship-card-foot a.permalink { color: var(--muted); font-weight: 600; }
      .ship-card-foot a:hover { text-decoration: underline; }
    </style>
  </head>
  <body>
    <div class="portal-shell">
      ${renderPortalTopbarHtml('changelog', GITHUB_REPO_URL)}

      <header class="hero">
        <span class="kicker">ROBINHOOD CHAIN MAINNET (4663) · VERIFIED SHIP LOG &amp; SYNDICATED FEEDS</span>
        <h1>Robin Town Changelog &amp; Release Feed</h1>
        <p>Every dated release, smart contract upgrade, and gameplay ship for Robin Town (${SHIP_RELEASES.length} verified releases shipped). Subscribe or verify via HTML, RSS 2.0, Atom 1.0, or JSON Feed 1.1.</p>
        <div class="feed-copy-bar">
          <button type="button" class="copy-chip" data-copy-url="${PRODUCTION_ORIGIN}/changelog">📋 Copy Changelog URL (/changelog)</button>
          <button type="button" class="copy-chip" data-copy-url="${PRODUCTION_ORIGIN}/changelog.xml">📡 Copy RSS 2.0 Feed (/changelog.xml)</button>
          <button type="button" class="copy-chip" data-copy-url="${PRODUCTION_ORIGIN}/docs">📖 Copy Game Docs URL (/docs)</button>
        </div>
        <div class="contract-meta">
          <div>Official World is Flat ($wif) Token on Robinhood Chain (4663): <a href="https://robinhoodchain.blockscout.com/token/${WIF_TOKEN_CONTRACT_MAINNET}" target="_blank" rel="noopener"><code>${WIF_TOKEN_CONTRACT_MAINNET}</code></a></div>
          ${
            vaultAddr && vaultBlockscoutUrl
              ? `<div style="margin-top:4px">Official RobinTownHarborVault Game Contract (RTOWN) on Robinhood Chain (4663): <a href="${escapeHtml(vaultBlockscoutUrl)}" target="_blank" rel="noopener"><code>${escapeHtml(vaultAddr)}</code></a></div>`
              : `<div style="margin-top:4px">Game Contract Studio (RobinTownHarborVault, Solc 0.8.24): <a href="/deploy">${PRODUCTION_ORIGIN}/deploy</a></div>`
          }
        </div>
      </header>

      <div class="filter-bar" role="toolbar" aria-label="Filter releases by category">
        <button type="button" class="filter-btn active" data-filter="all">All Ships (${SHIP_RELEASES.length})</button>
        <button type="button" class="filter-btn" data-filter="Smart Contract">Smart Contract</button>
        <button type="button" class="filter-btn" data-filter="Gameplay">Gameplay</button>
        <button type="button" class="filter-btn" data-filter="Web3 &amp; $wif">Web3 &amp; $wif</button>
        <button type="button" class="filter-btn" data-filter="Multiplayer &amp; Infra">Multiplayer &amp; Infra</button>
      </div>

      <main>
        ${articlesHtml}
      </main>
    </div>
    <script>
      (function () {
        document.querySelectorAll('[data-copy-url]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const url = btn.getAttribute('data-copy-url') || '';
            navigator.clipboard.writeText(url);
            const prev = btn.textContent;
            btn.textContent = 'Copied ✓';
            setTimeout(() => { btn.textContent = prev; }, 1400);
          });
        });
        const cards = Array.from(document.querySelectorAll('.ship-card'));
        document.querySelectorAll('[data-filter]').forEach((btn) => {
          btn.addEventListener('click', () => {
            document.querySelectorAll('[data-filter]').forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            const cat = btn.getAttribute('data-filter') || 'all';
            cards.forEach((card) => {
              const raw = card.getAttribute('data-cats') || '';
              card.hidden = cat !== 'all' && !raw.split('|').includes(cat);
            });
          });
        });
      })();
    </script>
  </body>
</html>`;
}

export function renderUpdatesHtml(vaultInfo = null) {
  return renderChangelogHtml(vaultInfo, '/changelog');
}

export { renderDocsHtml, renderRssFeedXml, renderAtomFeedXml, buildJsonFeedPayload };

export function renderDeployStudioHtml(vaultInfo = null) {
  const activeVault = vaultInfo?.vaultContractAddress || '';
  const shortDesc =
    '3D Harbor Diorama & 2D street negotiation board game on Robinhood Chain where 4 players bargain for corners, open shops, stake $wif in the Harbor Vault, and anchor Daily Seed scores on chain.';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Robin Town · Smart Contract Deployer &amp; HEY Submission Studio (Chain 4663)</title>
    <link rel="canonical" href="${PRODUCTION_ORIGIN}/deploy" />
    <link rel="vcs-git" href="${GITHUB_REPO_URL}" />
    <link rel="alternate" type="application/rss+xml" title="Robin Town Changelog (RSS 2.0)" href="${PRODUCTION_ORIGIN}/changelog.xml" />
    <link rel="alternate" type="application/atom+xml" title="Robin Town Changelog (Atom 1.0)" href="${PRODUCTION_ORIGIN}/atom.xml" />
    <style>
      ${renderSharedPortalCss()}
      main { max-width: 980px; margin: 0 auto; }
      .panel {
        background: var(--panel);
        border: 1.5px solid var(--border);
        border-radius: 18px;
        padding: 22px;
        margin-bottom: 20px;
      }
      h2 { margin: 0 0 10px; font-size: 19px; color: var(--gold); }
      p { margin: 0 0 12px; color: var(--muted); font-size: 14px; }
      .row { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-top: 10px; }
      button, .btn {
        cursor: pointer;
        border: none;
        border-radius: 10px;
        padding: 10px 16px;
        font-weight: 800;
        font-size: 14px;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: var(--gold);
        color: #13271c;
      }
      button.secondary, .btn.secondary {
        background: rgba(255, 255, 255, 0.08);
        color: var(--text);
        border: 1px solid var(--border);
      }
      button:disabled { opacity: 0.5; cursor: not-allowed; }
      input[type="text"] {
        background: var(--card);
        color: var(--text);
        border: 1px solid var(--border);
        border-radius: 10px;
        padding: 10px 12px;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 13px;
        min-width: min(300px, 100%);
        flex: 1;
      }
      .status-box {
        margin-top: 12px;
        padding: 12px 14px;
        border-radius: 12px;
        background: var(--card);
        border: 1px solid rgba(139, 245, 181, 0.3);
        font-size: 13.5px;
        word-break: break-all;
      }
      .hey-table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13.5px; }
      .hey-table th, .hey-table td {
        text-align: left;
        padding: 10px 12px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.09);
        vertical-align: middle;
      }
      .hey-table th { color: var(--mint); width: 220px; font-weight: 700; background: transparent; }
      .hey-table code {
        display: inline-block;
        background: var(--card);
        padding: 4px 8px;
        border-radius: 6px;
        color: var(--text);
        word-break: break-all;
      }
      pre {
        background: var(--card);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 12px;
        padding: 12px;
        max-height: 220px;
        overflow: auto;
        font-size: 12px;
        color: var(--muted);
      }
      a { color: var(--mint); }
    </style>
  </head>
  <body>
    <div class="portal-shell">
      ${renderPortalTopbarHtml('deploy', GITHUB_REPO_URL)}
      <main>
        <section class="panel hero">
          <span class="kicker">ROBINHOOD CHAIN MAINNET (4663) · ZERO PRIVATE KEY EXPOSURE</span>
          <h1>RobinTownHarborVault Deploy &amp; HEY Submission Studio</h1>
          <p>Deploy the official <strong>RobinTownHarborVault</strong> game smart contract (<code>${escapeHtml(VAULT_CONTRACT_METADATA.compilerVersion)}</code>, EVM <code>${escapeHtml(VAULT_CONTRACT_METADATA.evmVersion)}</code>, optimizer <code>${VAULT_CONTRACT_METADATA.optimizerRuns}</code> runs) directly through your browser MetaMask or Rabby wallet on Robinhood Chain (4663), activate it live across Robin Town, and copy every verified field into <a href="https://heyresearch.xyz/submit" target="_blank" rel="noopener">heyresearch.xyz/submit</a>.</p>
          <div class="row">
            <a class="btn secondary" href="/">← Back to Robin Town Game</a>
            <a class="btn secondary" href="/changelog">View /changelog</a>
            <a class="btn secondary" href="/docs">View /docs</a>
            <a class="btn secondary" href="https://heyresearch.xyz/submit" target="_blank" rel="noopener">Open HEY Submit Form ↗</a>
          </div>
          <div id="live-vault-banner" class="status-box">
            ${
              activeVault
                ? `✅ Active Registered Game Contract on Robin Town: <a href="https://robinhoodchain.blockscout.com/address/${escapeHtml(activeVault)}" target="_blank" rel="noopener"><code>${escapeHtml(activeVault)}</code> ↗</a>`
                : '⏳ Status: Contract compiled & ready to deploy on Robinhood Chain Mainnet (4663). Estimated deploy gas: ~1.32M gas.'
            }
          </div>
        </section>

        <section class="panel">
          <h2>Step 1 &amp; 2: Connect Wallet &amp; Deploy RobinTownHarborVault on Chain 4663</h2>
          <p>Constructor binds official World is Flat (<code>$wif</code> <code>${WIF_TOKEN_CONTRACT_MAINNET}</code>) and sets your connected wallet as contract <code>owner</code>. Includes instant-withdrawal <code>$wif</code> staking, 50/50 deflationary <code>$wif</code> district burns, gas-only Year 6 match anchoring (<code>recordHarborMatch</code>), and soulbound <code>RTOWN</code> Harbor Reputation.</p>
          <div class="row">
            <button type="button" id="btn-connect">1. Connect MetaMask / Rabby (Chain 4663)</button>
            <button type="button" id="btn-deploy" disabled>2. Deploy RobinTownHarborVault Now</button>
          </div>
          <div class="row" style="margin-top:12px">
            <input type="text" id="input-vault-addr" placeholder="Deployed 0x... RobinTownHarborVault address (auto-fills on deploy)" value="${escapeHtml(activeVault)}" />
            <button type="button" class="secondary" id="btn-activate">3. Sign &amp; Activate Live on Robin Town</button>
          </div>
          <div id="deploy-log" class="status-box">Connect your Robinhood Chain (4663) wallet above to begin.</div>
        </section>

        <section class="panel">
          <h2>Step 3: Copy-Paste Kit for HEY Research Lab (heyresearch.xyz/submit)</h2>
          <p>Open <a href="https://heyresearch.xyz/submit" target="_blank" rel="noopener">heyresearch.xyz/submit</a>, fill the form first using the exact values below, then click <strong>Sign in to submit</strong> at the bottom with your GitHub account (<code>harrymove-ctrl</code>) so your form stays preserved in the tab with zero submission bond needed.</p>
          <div class="table-wrap">
          <table class="hey-table">
            <tbody>
              <tr>
                <th>Project name</th>
                <td><code id="hey-name">Robin Town</code></td>
                <td><button type="button" class="secondary" data-copy="hey-name">Copy</button></td>
              </tr>
              <tr>
                <th>Project type</th>
                <td><code>Application</code> (select from dropdown)</td>
                <td></td>
              </tr>
              <tr>
                <th>Narrative</th>
                <td><code>Gaming</code> (select from dropdown)</td>
                <td></td>
              </tr>
              <tr>
                <th>One line about the project</th>
                <td><code id="hey-desc">${escapeHtml(shortDesc)}</code></td>
                <td><button type="button" class="secondary" data-copy="hey-desc">Copy</button></td>
              </tr>
              <tr>
                <th>Website</th>
                <td><code id="hey-site">${PRODUCTION_ORIGIN}</code></td>
                <td><button type="button" class="secondary" data-copy="hey-site">Copy</button></td>
              </tr>
              <tr>
                <th>Contract address (Chain 4663)</th>
                <td><code id="hey-contract">${escapeHtml(activeVault || 'Deploy in Step 2 above to auto-fill 0x...')}</code></td>
                <td><button type="button" class="secondary" data-copy="hey-contract">Copy</button></td>
              </tr>
              <tr>
                <th>Ticker</th>
                <td><code id="hey-ticker">RTOWN</code></td>
                <td><button type="button" class="secondary" data-copy="hey-ticker">Copy</button></td>
              </tr>
              <tr>
                <th>GitHub repository</th>
                <td><code id="hey-github">${GITHUB_REPO_URL}</code></td>
                <td><button type="button" class="secondary" data-copy="hey-github">Copy</button></td>
              </tr>
              <tr>
                <th>Changelog, release feed or docs</th>
                <td>
                  <code id="hey-updates">${PRODUCTION_ORIGIN}/changelog</code>
                  <div style="margin-top:6px;font-size:12px;color:var(--muted)">Also active: <a href="/changelog.xml">/changelog.xml (RSS 2.0)</a> · <a href="/atom.xml">/atom.xml (Atom)</a> · <a href="/docs">/docs</a></div>
                </td>
                <td><button type="button" class="secondary" data-copy="hey-updates">Copy</button></td>
              </tr>
            </tbody>
          </table>
          </div>
        </section>

        <section class="panel">
          <h2>Step 4: Blockscout Source Code Verification (Optional Green Checkmark)</h2>
          <p>On Blockscout (<code>robinhoodchain.blockscout.com/address/&lt;0x...&gt;?tab=contract</code>), click <strong>Verify &amp; publish</strong> → <strong>Solidity (Single file)</strong>, Compiler <code>${escapeHtml(VAULT_CONTRACT_METADATA.compilerVersion)}</code>, EVM <code>${escapeHtml(VAULT_CONTRACT_METADATA.evmVersion)}</code>, Optimization <code>Yes (${VAULT_CONTRACT_METADATA.optimizerRuns} runs)</code>, and paste the Solidity source below:</p>
          <div class="row" style="margin-bottom:10px">
            <button type="button" class="secondary" id="btn-copy-sol">Copy Solidity Source Code</button>
            <a class="btn secondary" id="link-blockscout-verify" href="${activeVault ? `https://robinhoodchain.blockscout.com/address/${escapeHtml(activeVault)}?tab=contract` : 'https://robinhoodchain.blockscout.com'}" target="_blank" rel="noopener">Open Blockscout Contract Tab ↗</a>
          </div>
          <pre id="sol-source">${escapeHtml(VAULT_SOLIDITY_SOURCE)}</pre>
        </section>
      </main>
    </div>

    <script>
      (function () {
        const CHAIN_ID_HEX = '0x1237';
        const CREATION_DATA = ${JSON.stringify(VAULT_CREATION_TX_DATA_MAINNET)};
        let provider = null;
        let account = null;
        let lastDeployTxHash = null;

        const logEl = document.getElementById('deploy-log');
        const btnConnect = document.getElementById('btn-connect');
        const btnDeploy = document.getElementById('btn-deploy');
        const btnActivate = document.getElementById('btn-activate');
        const inputAddr = document.getElementById('input-vault-addr');
        const heyContract = document.getElementById('hey-contract');
        const banner = document.getElementById('live-vault-banner');
        const verifyLink = document.getElementById('link-blockscout-verify');

        window.addEventListener('eip6963:announceProvider', (e) => {
          if (!provider && e.detail && e.detail.provider) provider = e.detail.provider;
        });
        window.dispatchEvent(new Event('eip6963:requestProvider'));
        if (!provider && window.ethereum) provider = window.ethereum;

        function setLog(html) { logEl.innerHTML = html; }

        async function ensureChain4663() {
          if (!provider) throw new Error('No browser Web3 wallet detected. Open in Chrome/Brave with MetaMask or Rabby.');
          const accs = await provider.request({ method: 'eth_requestAccounts' });
          account = accs && accs[0];
          if (!account) throw new Error('No wallet account authorized.');
          const cid = await provider.request({ method: 'eth_chainId' });
          if (parseInt(String(cid), 16) !== 4663) {
            try {
              await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN_ID_HEX }] });
            } catch (err) {
              if (err && err.code === 4902) {
                await provider.request({
                  method: 'wallet_addEthereumChain',
                  params: [{
                    chainId: CHAIN_ID_HEX,
                    chainName: 'Robinhood Chain Mainnet',
                    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
                    rpcUrls: ['https://rpc.mainnet.chain.robinhood.com'],
                    blockExplorerUrls: ['https://robinhoodchain.blockscout.com'],
                  }],
                });
              } else {
                throw err;
              }
            }
          }
          btnConnect.textContent = 'Connected: ' + account.slice(0, 8) + '…' + account.slice(-4) + ' (4663)';
          btnDeploy.disabled = false;
          setLog('Connected wallet <code>' + account + '</code> on Robinhood Chain Mainnet (4663). Ready to deploy!');
        }

        btnConnect.addEventListener('click', () => {
          ensureChain4663().catch((e) => setLog('⚠️ ' + (e.message || String(e))));
        });

        btnDeploy.addEventListener('click', async () => {
          try {
            await ensureChain4663();
            btnDeploy.disabled = true;
            setLog('⏳ Confirm contract creation transaction in your wallet…');
            const txHash = await provider.request({
              method: 'eth_sendTransaction',
              params: [{ from: account, value: '0x0', data: CREATION_DATA }],
            });
            lastDeployTxHash = txHash;
            setLog('⏳ Broadcasted deploy tx <a href="https://robinhoodchain.blockscout.com/tx/' + txHash + '" target="_blank"><code>' + txHash + '</code> ↗</a>. Waiting for Chain 4663 receipt…');
            for (let i = 0; i < 40; i++) {
              await new Promise((r) => setTimeout(r, 1500));
              const receipt = await provider.request({ method: 'eth_getTransactionReceipt', params: [txHash] });
              if (receipt && receipt.contractAddress) {
                const addr = receipt.contractAddress;
                inputAddr.value = addr;
                heyContract.textContent = addr;
                verifyLink.href = 'https://robinhoodchain.blockscout.com/address/' + addr + '?tab=contract';
                setLog('✅ Deployed <strong>RobinTownHarborVault</strong> at <a href="https://robinhoodchain.blockscout.com/address/' + addr + '" target="_blank"><code>' + addr + '</code> ↗</a>! Now click <strong>3. Sign &amp; Activate Live on Robin Town</strong>.');
                btnDeploy.disabled = false;
                return;
              }
            }
            setLog('Tx sent (' + txHash + '). Once mined, paste the contract address above and click Step 3.');
            btnDeploy.disabled = false;
          } catch (e) {
            btnDeploy.disabled = false;
            setLog('⚠️ ' + (e.message || String(e)));
          }
        });

        btnActivate.addEventListener('click', async () => {
          try {
            const addr = String(inputAddr.value || '').trim();
            if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) throw new Error('Enter a valid 0x contract address first.');
            await ensureChain4663();
            const message = 'Robin Town Vault Registration\\nChain ID: 4663\\nContract: ' + addr.toLowerCase();
            setLog('⏳ Sign the gasless ownership confirmation in your wallet…');
            const signature = await provider.request({
              method: 'personal_sign',
              params: [message, account],
            });
            const res = await fetch('/api/wallets/vault', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ contractAddress: addr, txHash: lastDeployTxHash, signature }),
            });
            const json = await res.json();
            if (!res.ok || !json.ok) throw new Error(json.error || 'Activation failed');
            heyContract.textContent = json.vaultContractAddress;
            verifyLink.href = json.explorerUrl + '?tab=contract';
            banner.innerHTML = '✅ Active Registered Game Contract on Robin Town: <a href="' + json.explorerUrl + '" target="_blank"><code>' + json.vaultContractAddress + '</code> ↗</a> (linked live on /, /changelog, /docs &amp; $wif Hub!)';
            setLog('🎉 Activated! Robin Town home page (/), /changelog, /docs, and in-game $wif Hub now link directly to <code>' + json.vaultContractAddress + '</code>.');
          } catch (e) {
            setLog('⚠️ ' + (e.message || String(e)));
          }
        });

        document.querySelectorAll('[data-copy]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const target = document.getElementById(btn.getAttribute('data-copy'));
            if (!target) return;
            navigator.clipboard.writeText(target.textContent || '');
            const orig = btn.textContent;
            btn.textContent = 'Copied ✓';
            setTimeout(() => { btn.textContent = orig; }, 1400);
          });
        });

        document.getElementById('btn-copy-sol').addEventListener('click', function () {
          const btn = this;
          navigator.clipboard.writeText(document.getElementById('sol-source').textContent || '');
          btn.textContent = 'Copied Solidity ✓';
          setTimeout(() => { btn.textContent = 'Copy Solidity Source Code'; }, 1500);
        });
      })();
    </script>
  </body>
</html>`;
}

export function renderDynamicIndexHtml(
  baseHtml,
  rawRequestUrl,
  origin = PRODUCTION_ORIGIN,
  vaultInfo = null,
) {
  let htmlOut = baseHtml;
  const vaultAddr = vaultInfo?.vaultContractAddress || null;
  if (vaultAddr && /^0x[0-9a-fA-F]{40}$/.test(vaultAddr)) {
    const safeVault = escapeHtml(vaultAddr);
    const vaultLinkHtml = `<a href="https://robinhoodchain.blockscout.com/address/${safeVault}">Harbor Vault (<code>${safeVault}</code>)</a> ·\n          <a href="/deploy">Contract Studio</a>`;
    htmlOut = htmlOut.replace(/<a href="\/deploy">Contract Studio<\/a>/i, vaultLinkHtml);
  }

  let parsed;
  try {
    parsed = new URL(rawRequestUrl || '/', origin);
  } catch {
    return htmlOut;
  }

  const rawRoom = (parsed.searchParams.get('room') || '').trim().toUpperCase();
  const rawDaily = (parsed.searchParams.get('daily') || '').trim();
  const rawTarget = Number(parsed.searchParams.get('target') || '');
  const validRoom = /^[A-Z0-9]{6}$/.test(rawRoom) ? rawRoom : null;
  const validDaily = /^\d{4}-\d{2}-\d{2}$/.test(rawDaily) ? rawDaily : null;
  const validTarget =
    Number.isFinite(rawTarget) && rawTarget > 0 && rawTarget <= 250_000
      ? Math.round(rawTarget)
      : null;

  if (!validRoom && !validDaily && !validTarget) {
    return htmlOut;
  }

  let dynTitle = 'Robin Town · Build with $wif on Robinhood Chain';
  let dynDesc =
    'Make a deal. Open a shop. Put $wif to work across six years on Robinhood Chain (4663).';
  const queryParts = [];

  if (validRoom) {
    dynTitle = `Join Live Room ${validRoom} · Robin Town on Robinhood Chain`;
    dynDesc = `Pull up a stool at Multiplayer Table ${validRoom}! Bargain OTC deals in $wif, draft street corners, and build 3D harbor shophouses live.`;
    queryParts.push(`room=${encodeURIComponent(validRoom)}`);
  } else if (validDaily && validTarget) {
    dynTitle = `Beat ${validTarget.toLocaleString('en-US')} $wif on Daily Seed ${validDaily} · Robin Town`;
    dynDesc = `Can you beat ${validTarget.toLocaleString('en-US')} $wif on Daily Harbor Seed ${validDaily}? Same 6-year plot & shop draws for every trader today on Robinhood Chain (4663).`;
    queryParts.push(`daily=${encodeURIComponent(validDaily)}`, `target=${validTarget}`);
  } else if (validDaily) {
    dynTitle = `Daily Harbor Seed ${validDaily} · Robin Town ($wif)`;
    dynDesc = `Play today's deterministic 6-year Daily Harbor Challenge (${validDaily}) on Robinhood Chain (4663) and climb the leaderboard!`;
    queryParts.push(`daily=${encodeURIComponent(validDaily)}`);
  } else if (validTarget) {
    dynTitle = `Challenge: Beat ${validTarget.toLocaleString('en-US')} $wif in Robin Town!`;
    dynDesc = `A harbor merchant finished Year 6 with ${validTarget.toLocaleString('en-US')} $wif. Pull up a stool and beat their empire in 6 zodiac years!`;
    queryParts.push(`target=${validTarget}`);
  }

  const canonicalShareUrl = `${origin}/${queryParts.length ? '?' + queryParts.join('&') : ''}`;
  const safeTitle = escapeHtml(dynTitle);
  const safeDesc = escapeHtml(dynDesc);
  const safeUrl = escapeHtml(canonicalShareUrl);

  return htmlOut
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${safeTitle}</title>`)
    .replace(
      /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i,
      `<meta property="og:title" content="${safeTitle}" />`,
    )
    .replace(
      /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/i,
      `<meta name="twitter:title" content="${safeTitle}" />`,
    )
    .replace(
      /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i,
      `<meta property="og:description" content="${safeDesc}" />`,
    )
    .replace(
      /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/i,
      `<meta name="twitter:description" content="${safeDesc}" />`,
    )
    .replace(
      /<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/i,
      `<meta property="og:url" content="${safeUrl}" />`,
    );
}

export function handleShipUpdatesRequest(req, res, vaultInfo = null) {
  const rawPath = ((req.url || '/').split('?')[0] || '/').replace(/\/+$/, '') || '/';
  const isRead = req.method === 'GET' || req.method === 'HEAD';
  if (!isRead) return false;

  if (rawPath === '/robots.txt') {
    const txt = renderRobotsTxt(PRODUCTION_ORIGIN);
    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    });
    if (req.method === 'HEAD') res.end();
    else res.end(txt);
    return true;
  }

  if (rawPath === '/sitemap.xml') {
    const xml = renderSitemapXml(PRODUCTION_ORIGIN, SHIP_RELEASES[0]?.date || '2026-11-02');
    res.writeHead(200, {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
      'X-Content-Type-Options': 'nosniff',
    });
    if (req.method === 'HEAD') res.end();
    else res.end(xml);
    return true;
  }

  if (rawPath === '/llms.txt') {
    const txt = renderLlmsTxt({
      origin: PRODUCTION_ORIGIN,
      githubUrl: GITHUB_REPO_URL,
      wifContract: WIF_TOKEN_CONTRACT_MAINNET,
      releases: SHIP_RELEASES,
      vaultInfo,
    });
    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
      'X-Content-Type-Options': 'nosniff',
    });
    if (req.method === 'HEAD') res.end();
    else res.end(txt);
    return true;
  }

  if (rawPath === '/changelog' || rawPath === '/updates') {
    const html = renderChangelogHtml(vaultInfo, '/changelog');
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    });
    if (req.method === 'HEAD') res.end();
    else res.end(html);
    return true;
  }

  if (rawPath === '/docs') {
    const html = renderDocsHtml({
      origin: PRODUCTION_ORIGIN,
      githubUrl: GITHUB_REPO_URL,
      wifContract: WIF_TOKEN_CONTRACT_MAINNET,
      vaultMetadata: VAULT_CONTRACT_METADATA,
      vaultInfo,
    });
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    });
    if (req.method === 'HEAD') res.end();
    else res.end(html);
    return true;
  }

  if (rawPath === '/changelog.xml' || rawPath === '/rss.xml' || rawPath === '/feed.xml') {
    const xml = renderRssFeedXml({
      origin: PRODUCTION_ORIGIN,
      githubUrl: GITHUB_REPO_URL,
      wifContract: WIF_TOKEN_CONTRACT_MAINNET,
      releases: SHIP_RELEASES,
      vaultInfo,
    });
    res.writeHead(200, {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
      'X-Content-Type-Options': 'nosniff',
    });
    if (req.method === 'HEAD') res.end();
    else res.end(xml);
    return true;
  }

  if (rawPath === '/atom.xml') {
    const xml = renderAtomFeedXml({
      origin: PRODUCTION_ORIGIN,
      githubUrl: GITHUB_REPO_URL,
      wifContract: WIF_TOKEN_CONTRACT_MAINNET,
      releases: SHIP_RELEASES,
    });
    res.writeHead(200, {
      'Content-Type': 'application/atom+xml; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
      'X-Content-Type-Options': 'nosniff',
    });
    if (req.method === 'HEAD') res.end();
    else res.end(xml);
    return true;
  }

  if (rawPath === '/feed.json' || rawPath === '/updates.json') {
    const body = JSON.stringify(
      buildJsonFeedPayload({
        origin: PRODUCTION_ORIGIN,
        githubUrl: GITHUB_REPO_URL,
        wifContract: WIF_TOKEN_CONTRACT_MAINNET,
        releases: SHIP_RELEASES,
        vaultInfo,
      }),
    );
    res.writeHead(200, {
      'Content-Type':
        rawPath === '/feed.json'
          ? 'application/feed+json; charset=utf-8'
          : 'application/json; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
      'X-Content-Type-Options': 'nosniff',
    });
    if (req.method === 'HEAD') res.end();
    else res.end(body);
    return true;
  }

  if (rawPath === '/deploy') {
    const html = renderDeployStudioHtml(vaultInfo);
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    if (req.method === 'HEAD') res.end();
    else res.end(html);
    return true;
  }

  if (rawPath === '/api/contract/artifact') {
    const body = JSON.stringify({
      ok: true,
      metadata: VAULT_CONTRACT_METADATA,
      abi: VAULT_CONTRACT_ABI,
      creationTxDataMainnet: VAULT_CREATION_TX_DATA_MAINNET,
      vaultInfo,
    });
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'Access-Control-Allow-Origin': '*',
    });
    if (req.method === 'HEAD') res.end();
    else res.end(body);
    return true;
  }

  return false;
}
