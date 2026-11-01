import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROBINHOOD_MAINNET_RPC =
  process.env.ROBINHOOD_MAINNET_RPC || 'https://rpc.mainnet.chain.robinhood.com';
const WIF_CONTRACT_MAINNET = '0x5173b8eA6923c2d40267890D45C46a3480954773';
const DEAD_BURN_SINK_LOWER = '0x000000000000000000000000000000000000dead';
const ERC20_TRANSFER_TOPIC0 =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

const BLOCKED_SIM_ADDRESSES = new Set([
  '0x0000000000000000000000000000000000000000',
  '0x000000000000000000000000000000000000dead',
  '0x1000000000000000000000000000000000000001',
  '0x2000000000000000000000000000000000000002',
  '0x3000000000000000000000000000000000000003',
  '0x4000000000000000000000000000000000000004',
]);

// ============================================================================
// Pure Zero-Dependency Keccak-256 + secp256k1 EIP-191 personal_sign Recovery
// ============================================================================

const KECCAK_ROUNDS = 24;
const ROTC = [
  1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 2, 14, 27, 41, 56, 8, 25, 43, 62, 18, 39, 61, 20, 44,
];
const PILN = [
  10, 7, 11, 17, 18, 3, 5, 16, 8, 21, 24, 4, 15, 23, 19, 13, 12, 2, 20, 14, 22, 9, 6, 1,
];
const MASK64 = 0xffffffffffffffffn;
const RC = [
  0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an, 0x8000000080008000n,
  0x000000000000808bn, 0x0000000080000001n, 0x8000000080008081n, 0x8000000000008009n,
  0x000000000000008an, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
  0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n,
  0x8000000000008002n, 0x8000000000000080n, 0x000000000000800an, 0x800000008000000an,
  0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n,
];

function rotl64(x, n) {
  return ((x << BigInt(n)) | (x >> BigInt(64 - n))) & MASK64;
}

export function keccak256(inputBytes) {
  const rate = 136; // 1088 bits for Keccak-256
  const state = new Array(25).fill(0n);
  const msg = Buffer.from(inputBytes);
  const padLen = rate - (msg.length % rate);
  const padded = Buffer.alloc(msg.length + padLen);
  msg.copy(padded);
  padded[msg.length] = 0x01; // Original Keccak padding (NOT NIST SHA-3 0x06)
  padded[padded.length - 1] |= 0x80;

  for (let offset = 0; offset < padded.length; offset += rate) {
    for (let i = 0; i < 17; i++) {
      state[i] ^= padded.readBigUInt64LE(offset + i * 8);
    }
    const bc = new Array(5);
    for (let round = 0; round < KECCAK_ROUNDS; round++) {
      for (let i = 0; i < 5; i++) {
        bc[i] = state[i] ^ state[i + 5] ^ state[i + 10] ^ state[i + 15] ^ state[i + 20];
      }
      for (let i = 0; i < 5; i++) {
        const t = bc[(i + 4) % 5] ^ rotl64(bc[(i + 1) % 5], 1);
        for (let j = 0; j < 25; j += 5) {
          state[j + i] = (state[j + i] ^ t) & MASK64;
        }
      }
      let t = state[1];
      for (let i = 0; i < 24; i++) {
        const j = PILN[i];
        const tmp = state[j];
        state[j] = rotl64(t, ROTC[i]);
        t = tmp;
      }
      for (let j = 0; j < 25; j += 5) {
        for (let i = 0; i < 5; i++) bc[i] = state[j + i];
        for (let i = 0; i < 5; i++) {
          state[j + i] = (state[j + i] ^ ((~bc[(i + 1) % 5] & MASK64) & bc[(i + 2) % 5])) & MASK64;
        }
      }
      state[0] = (state[0] ^ RC[round]) & MASK64;
    }
  }

  const out = Buffer.alloc(32);
  for (let i = 0; i < 4; i++) {
    out.writeBigUInt64LE(state[i], i * 8);
  }
  return out;
}

const SECP_P = 0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2fn;
const SECP_N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
const SECP_GX = 0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798n;
const SECP_GY = 0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8n;

function mod(a, m = SECP_P) {
  const r = a % m;
  return r >= 0n ? r : r + m;
}

function modPow(base, exp, m = SECP_P) {
  let result = 1n;
  let b = mod(base, m);
  let e = exp;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % m;
    b = (b * b) % m;
    e >>= 1n;
  }
  return result;
}

function modInv(a, m = SECP_P) {
  let [oldR, r] = [mod(a, m), m];
  let [oldS, s] = [1n, 0n];
  while (r !== 0n) {
    const q = oldR / r;
    [oldR, r] = [r, oldR - q * r];
    [oldS, s] = [s, oldS - q * s];
  }
  return mod(oldS, m);
}

function pointAdd(p1, p2) {
  if (!p1) return p2;
  if (!p2) return p1;
  const [x1, y1] = p1;
  const [x2, y2] = p2;
  if (x1 === x2 && y1 !== y2) return null;
  const lam =
    x1 === x2 && y1 === y2
      ? mod(3n * x1 * x1 * modInv(2n * y1))
      : mod((y2 - y1) * modInv(x2 - x1));
  const x3 = mod(lam * lam - x1 - x2);
  const y3 = mod(lam * (x1 - x3) - y1);
  return [x3, y3];
}

function pointMul(p, k) {
  let res = null;
  let addend = p;
  let scalar = k;
  while (scalar > 0n) {
    if (scalar & 1n) res = pointAdd(res, addend);
    addend = pointAdd(addend, addend);
    scalar >>= 1n;
  }
  return res;
}

export function hashPersonalMessage(message) {
  const msgBuf = Buffer.from(String(message), 'utf8');
  const prefix = Buffer.from(`\x19Ethereum Signed Message:\n${msgBuf.length}`, 'utf8');
  return keccak256(Buffer.concat([prefix, msgBuf]));
}

export function recoverPersonalSignAddress(message, signatureHex) {
  if (typeof signatureHex !== 'string') return null;
  const clean = signatureHex.trim().replace(/^0x/i, '');
  let r;
  let s;
  let v;

  if (/^[0-9a-fA-F]{130}$/.test(clean)) {
    r = BigInt('0x' + clean.slice(0, 64));
    s = BigInt('0x' + clean.slice(64, 128));
    v = parseInt(clean.slice(128, 130), 16);
    if (v >= 27) v -= 27;
  } else if (/^[0-9a-fA-F]{128}$/.test(clean)) {
    // EIP-2098 compact 64-byte signature (yParity in top bit of vs)
    r = BigInt('0x' + clean.slice(0, 64));
    const vs = BigInt('0x' + clean.slice(64, 128));
    v = Number(vs >> 255n);
    s = vs & ((1n << 255n) - 1n);
  } else {
    return null;
  }

  if (v !== 0 && v !== 1) return null;
  if (r <= 0n || r >= SECP_N || s <= 0n || s >= SECP_N) return null;

  const x = r;
  if (x >= SECP_P) return null;
  const ySq = mod(modPow(x, 3n) + 7n);
  let y = modPow(ySq, (SECP_P + 1n) / 4n);
  if (mod(y * y) !== ySq) return null;
  if (Number(y & 1n) !== v) {
    y = SECP_P - y;
  }

  const R = [x, y];
  const msgHash = hashPersonalMessage(message);
  const e = BigInt('0x' + msgHash.toString('hex')) % SECP_N;
  const rInv = modInv(r, SECP_N);

  const sR = pointMul(R, s);
  const eG = pointMul([SECP_GX, SECP_GY], e);
  const negEG = eG ? [eG[0], mod(-eG[1])] : null;
  const diff = pointAdd(sR, negEG);
  const Q = pointMul(diff, rInv);
  if (!Q) return null;

  const pubBytes = Buffer.from(
    Q[0].toString(16).padStart(64, '0') + Q[1].toString(16).padStart(64, '0'),
    'hex',
  );
  const addrHash = keccak256(pubBytes);
  return '0x' + addrHash.subarray(12).toString('hex').toLowerCase();
}

export function signPersonalMessage(message, privateKeyHex) {
  const cleanPriv = String(privateKeyHex).trim().replace(/^0x/i, '').padStart(64, '0');
  const d = BigInt('0x' + cleanPriv);
  if (d <= 0n || d >= SECP_N) {
    throw new Error('Invalid secp256k1 private key');
  }
  const msgHash = hashPersonalMessage(message);
  const e = BigInt('0x' + msgHash.toString('hex')) % SECP_N;

  // Deterministic nonce derived via HMAC-SHA256(privKey, msgHash || counter)
  let counter = 0;
  while (counter < 16) {
    const kBuf = crypto
      .createHmac('sha256', Buffer.from(cleanPriv, 'hex'))
      .update(msgHash)
      .update(Buffer.from([counter]))
      .digest();
    counter += 1;
    const k = BigInt('0x' + kBuf.toString('hex')) % SECP_N;
    if (k <= 0n) continue;
    const R = pointMul([SECP_GX, SECP_GY], k);
    if (!R) continue;
    const r = R[0] % SECP_N;
    if (r === 0n) continue;
    let s = (modInv(k, SECP_N) * (e + r * d)) % SECP_N;
    if (s === 0n) continue;
    let v = Number(R[1] & 1n) + 27;
    if (s > SECP_N / 2n) {
      s = SECP_N - s;
      v = v === 27 ? 28 : 27;
    }
    const pub = pointMul([SECP_GX, SECP_GY], d);
    const pubBytes = Buffer.from(
      pub[0].toString(16).padStart(64, '0') + pub[1].toString(16).padStart(64, '0'),
      'hex',
    );
    const address = '0x' + keccak256(pubBytes).subarray(12).toString('hex').toLowerCase();
    const signature =
      '0x' +
      r.toString(16).padStart(64, '0') +
      s.toString(16).padStart(64, '0') +
      v.toString(16).padStart(2, '0');
    return { address, signature };
  }
  throw new Error('Failed to sign personal message');
}

export function verifyPersonalSign(message, signatureHex, expectedAddress) {
  if (!isValidRealWalletAddress(expectedAddress)) return false;
  const recovered = recoverPersonalSignAddress(message, signatureHex);
  return Boolean(recovered && recovered === expectedAddress.trim().toLowerCase());
}

// ============================================================================
// Persistent Harbor Wallet, On-Chain Tx Verifier & Daily Challenge Registry
// ============================================================================

export function isValidRealWalletAddress(addr) {
  if (typeof addr !== 'string') return false;
  const clean = addr.trim().toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(clean)) return false;
  if (BLOCKED_SIM_ADDRESSES.has(clean)) return false;
  return true;
}

export function isValidTxHash(hash) {
  if (typeof hash !== 'string') return false;
  return /^0x[0-9a-fA-F]{64}$/.test(hash.trim());
}

export function formatShortAddress(addr) {
  const clean = String(addr || '').trim();
  if (clean.length < 12) return clean;
  return `${clean.slice(0, 6)}…${clean.slice(-4)}`;
}

export function utcDateKey(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function prevUtcDateKey(dateKey) {
  const parts = String(dateKey).split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return '';
  const dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return utcDateKey(dt);
}

function buildChallengeMessage(address, nonce) {
  return [
    'Robin Town Harbor Trader Verification',
    `Wallet: ${address.toLowerCase()}`,
    'Chain ID: 4663',
    `Nonce: ${nonce}`,
  ].join('\n');
}

function resolveDefaultStorePath() {
  if (process.env.WALLET_STORE_PATH) {
    return process.env.WALLET_STORE_PATH;
  }
  try {
    if (fs.existsSync('/data')) {
      fs.accessSync('/data', fs.constants.W_OK);
      return '/data/wallets.json';
    }
  } catch {}
  return path.resolve(process.cwd(), '.data', 'wallets.json');
}

function hexWeiToWifNumber(hexVal) {
  if (!hexVal || hexVal === '0x') return 0;
  const rawHex = String(hexVal).trim().replace(/^0x/i, '');
  if (!rawHex || !/^[0-9a-fA-F]+$/.test(rawHex)) return 0;
  const wei = BigInt('0x' + rawHex);
  const whole = wei / 1000000000000000000n;
  const rem = wei % 1000000000000000000n;
  return Number((Number(whole) + Number(rem) / 1e18).toFixed(4));
}

async function fetchMainnetWifBalance(address, rpcUrl = ROBINHOOD_MAINNET_RPC) {
  const clean = address.trim().replace(/^0x/i, '').toLowerCase().padStart(64, '0');
  const data = `0x70a08231${clean}`;
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_call',
      params: [{ to: WIF_CONTRACT_MAINNET, data }, 'latest'],
    }),
    signal: AbortSignal.timeout(3000),
  });
  if (!res.ok) return null;
  const json = await res.json();
  return hexWeiToWifNumber(json?.result);
}

async function fetchMainnetTxReceipt(txHash, rpcUrl = ROBINHOOD_MAINNET_RPC) {
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_getTransactionReceipt',
      params: [txHash],
    }),
    signal: AbortSignal.timeout(4500),
  });
  if (!res.ok) throw new Error(`Robinhood Chain RPC returned HTTP ${res.status}.`);
  const json = await res.json();
  if (json?.error) {
    throw new Error(json.error.message || 'Robinhood Chain RPC error.');
  }
  return json?.result || null;
}

export function decodeWifTransfersFromReceipt(receipt) {
  if (!receipt || !Array.isArray(receipt.logs)) return [];
  const wifLower = WIF_CONTRACT_MAINNET.toLowerCase();
  const transfers = [];
  for (const entry of receipt.logs) {
    if (!entry || typeof entry.address !== 'string') continue;
    if (entry.address.trim().toLowerCase() !== wifLower) continue;
    const topics = Array.isArray(entry.topics) ? entry.topics : [];
    if (topics.length < 3) continue;
    if (String(topics[0] || '').toLowerCase() !== ERC20_TRANSFER_TOPIC0) continue;
    const rawFrom = String(topics[1] || '').replace(/^0x/i, '');
    const rawTo = String(topics[2] || '').replace(/^0x/i, '');
    if (rawFrom.length < 40 || rawTo.length < 40) continue;
    const from = '0x' + rawFrom.slice(-40).toLowerCase();
    const to = '0x' + rawTo.slice(-40).toLowerCase();
    const amountWif = hexWeiToWifNumber(entry.data);
    if (amountWif > 0) {
      transfers.push({ from, to, amountWif });
    }
  }
  return transfers;
}

function makeDefaultWalletRecord(norm, nowIso, chainId = 4663, source = 'eip1193') {
  return {
    address: norm,
    firstSeenAt: nowIso,
    lastSeenAt: nowIso,
    connectCount: 0,
    verified: false,
    verifiedAt: null,
    nonce: crypto.randomBytes(8).toString('hex'),
    chainId: Number(chainId) || 4663,
    source: String(source || 'eip1193').slice(0, 24),
    onChainWifBalance: 0,
    matchesPlayed: 0,
    wins: 0,
    bestNetWorthWif: 0,
    totalBurnedWif: 0,
    verifiedTxCount: 0,
    verifiedOnChainWifMoved: 0,
    lastVerifiedTxHash: null,
    onChainPatronBoost: false,
    currentStreakDays: 0,
    bestStreakDays: 0,
    lastPlayedDay: null,
  };
}

export function createWalletRegistry(options = {}) {
  const storePath = options.storePath || resolveDefaultStorePath();
  const fetchBalanceFn =
    options.fetchBalanceFn !== undefined ? options.fetchBalanceFn : fetchMainnetWifBalance;
  const fetchReceiptFn =
    options.fetchReceiptFn !== undefined ? options.fetchReceiptFn : fetchMainnetTxReceipt;
  const nowFn = options.nowFn || (() => new Date());
  const maxBodyBytes = 16_384;

  let state = {
    version: 2,
    updatedAt: nowFn().toISOString(),
    totalMatchesPlayed: 0,
    walletMatchesPlayed: 0,
    guestMatchesPlayed: 0,
    totalWifBurnedInGame: 0,
    totalVerifiedOnChainWifMoved: 0,
    wallets: {},
    verifiedTxs: {},
    dailyBoards: {},
  };

  function loadFromDisk() {
    try {
      if (fs.existsSync(storePath)) {
        const raw = JSON.parse(fs.readFileSync(storePath, 'utf8'));
        if (raw && typeof raw === 'object') {
          state = {
            ...state,
            ...raw,
            wallets: raw.wallets && typeof raw.wallets === 'object' ? raw.wallets : {},
            verifiedTxs:
              raw.verifiedTxs && typeof raw.verifiedTxs === 'object' ? raw.verifiedTxs : {},
            dailyBoards:
              raw.dailyBoards && typeof raw.dailyBoards === 'object' ? raw.dailyBoards : {},
          };
        }
      }
    } catch {}
  }

  function pruneOldDailyBoards() {
    const keys = Object.keys(state.dailyBoards).sort();
    while (keys.length > 14) {
      const oldest = keys.shift();
      if (oldest) delete state.dailyBoards[oldest];
    }
  }

  function flushToDisk() {
    try {
      pruneOldDailyBoards();
      state.updatedAt = nowFn().toISOString();
      const dir = path.dirname(storePath);
      fs.mkdirSync(dir, { recursive: true });
      const tmp = `${storePath}.tmp.${process.pid}.${Date.now()}`;
      fs.writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8');
      fs.renameSync(tmp, storePath);
    } catch {}
  }

  loadFromDisk();

  // Simple per-IP sliding window rate limiter (max 45 mutating calls per 60s)
  const ipBuckets = new Map();
  function allowRate(ip) {
    const key = String(ip || 'local');
    const now = Date.now();
    const bucket = ipBuckets.get(key);
    if (!bucket || now - bucket.windowStart > 60_000) {
      ipBuckets.set(key, { windowStart: now, count: 1 });
      return true;
    }
    if (bucket.count >= 45) return false;
    bucket.count += 1;
    return true;
  }

  function getDailyLeaderboard(dateKey = utcDateKey(nowFn())) {
    const dayMap = state.dailyBoards[dateKey] || {};
    const entries = Object.values(dayMap);
    return entries
      .sort((a, b) => {
        if (b.bestNetWorthWif !== a.bestNetWorthWif) return b.bestNetWorthWif - a.bestNetWorthWif;
        if (Number(b.verified) !== Number(a.verified)) return Number(b.verified) - Number(a.verified);
        return Date.parse(a.updatedAt) - Date.parse(b.updatedAt);
      })
      .slice(0, 25)
      .map((row, idx) => ({
        rank: idx + 1,
        label: row.label,
        shortAddress: row.shortAddress || null,
        verified: Boolean(row.verified),
        verifiedTxCount: row.verifiedTxCount || 0,
        bestNetWorthWif: row.bestNetWorthWif,
        won: Boolean(row.won),
        attempts: row.attempts || 1,
        streakDays: row.streakDays || 1,
        updatedAt: row.updatedAt,
      }));
  }

  function publicSummary(viewerAddress = null) {
    const todaySeed = utcDateKey(nowFn());
    const entries = Object.values(state.wallets);
    const verifiedCount = entries.filter((w) => w.verified).length;
    const totalVerifiedOnChainTxs = Object.keys(state.verifiedTxs).length;

    const leaderboard = [...entries]
      .sort((a, b) => {
        if (b.bestNetWorthWif !== a.bestNetWorthWif) return b.bestNetWorthWif - a.bestNetWorthWif;
        if ((b.verifiedTxCount || 0) !== (a.verifiedTxCount || 0))
          return (b.verifiedTxCount || 0) - (a.verifiedTxCount || 0);
        if (Number(b.verified) !== Number(a.verified)) return Number(b.verified) - Number(a.verified);
        if (b.matchesPlayed !== a.matchesPlayed) return b.matchesPlayed - a.matchesPlayed;
        return b.onChainWifBalance - a.onChainWifBalance;
      })
      .slice(0, 25)
      .map((w, idx) => ({
        rank: idx + 1,
        shortAddress: formatShortAddress(w.address),
        verified: Boolean(w.verified),
        chainId: w.chainId || 4663,
        onChainWifBalance: w.onChainWifBalance || 0,
        matchesPlayed: w.matchesPlayed || 0,
        wins: w.wins || 0,
        bestNetWorthWif: w.bestNetWorthWif || 0,
        totalBurnedWif: w.totalBurnedWif || 0,
        verifiedTxCount: w.verifiedTxCount || 0,
        verifiedOnChainWifMoved: w.verifiedOnChainWifMoved || 0,
        lastVerifiedTxHash: w.lastVerifiedTxHash || null,
        onChainPatronBoost: Boolean(w.onChainPatronBoost),
        currentStreakDays: w.currentStreakDays || 0,
        bestStreakDays: w.bestStreakDays || 0,
        lastSeenAt: w.lastSeenAt,
      }));

    const recentWallets = [...entries]
      .sort((a, b) => Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt))
      .slice(0, 20)
      .map((w) => ({
        shortAddress: formatShortAddress(w.address),
        verified: Boolean(w.verified),
        chainId: w.chainId || 4663,
        source: w.source || 'eip1193',
        onChainWifBalance: w.onChainWifBalance || 0,
        matchesPlayed: w.matchesPlayed || 0,
        bestNetWorthWif: w.bestNetWorthWif || 0,
        verifiedTxCount: w.verifiedTxCount || 0,
        lastVerifiedTxHash: w.lastVerifiedTxHash || null,
        currentStreakDays: w.currentStreakDays || 0,
        firstSeenAt: w.firstSeenAt,
        lastSeenAt: w.lastSeenAt,
      }));

    let me = null;
    if (viewerAddress && isValidRealWalletAddress(viewerAddress)) {
      const norm = viewerAddress.trim().toLowerCase();
      const own = state.wallets[norm];
      if (own) {
        const rankIdx = [...entries]
          .sort((a, b) => b.bestNetWorthWif - a.bestNetWorthWif)
          .findIndex((w) => w.address === norm);
        const dailyBoard = getDailyLeaderboard(todaySeed);
        const myDaily = dailyBoard.find((d) => d.shortAddress === formatShortAddress(norm));
        me = {
          address: own.address,
          shortAddress: formatShortAddress(own.address),
          verified: Boolean(own.verified),
          verifiedAt: own.verifiedAt || null,
          rank: rankIdx >= 0 ? rankIdx + 1 : null,
          dailyRank: myDaily ? myDaily.rank : null,
          onChainWifBalance: own.onChainWifBalance || 0,
          matchesPlayed: own.matchesPlayed || 0,
          wins: own.wins || 0,
          bestNetWorthWif: own.bestNetWorthWif || 0,
          totalBurnedWif: own.totalBurnedWif || 0,
          verifiedTxCount: own.verifiedTxCount || 0,
          verifiedOnChainWifMoved: own.verifiedOnChainWifMoved || 0,
          lastVerifiedTxHash: own.lastVerifiedTxHash || null,
          onChainPatronBoost: Boolean(own.onChainPatronBoost),
          currentStreakDays: own.currentStreakDays || 0,
          bestStreakDays: own.bestStreakDays || 0,
          challengeMessage: buildChallengeMessage(own.address, own.nonce),
        };
      }
    }

    return {
      ok: true,
      storePersistent: storePath.startsWith('/data/'),
      todaySeed,
      totalUniqueWallets: entries.length,
      verifiedWallets: verifiedCount,
      totalMatchesPlayed: state.totalMatchesPlayed,
      walletMatchesPlayed: state.walletMatchesPlayed,
      guestMatchesPlayed: state.guestMatchesPlayed,
      totalWifBurnedInGame: Number(state.totalWifBurnedInGame.toFixed(2)),
      totalVerifiedOnChainTxs,
      totalVerifiedOnChainWifMoved: Number((state.totalVerifiedOnChainWifMoved || 0).toFixed(4)),
      leaderboard,
      recentWallets,
      dailyLeaderboard: getDailyLeaderboard(todaySeed),
      me,
    };
  }

  async function recordConnect({ address, chainId = 4663, source = 'eip1193' }) {
    if (!isValidRealWalletAddress(address)) {
      throw new Error('Invalid or simulated wallet address.');
    }
    const norm = address.trim().toLowerCase();
    const nowIso = nowFn().toISOString();
    const existing = state.wallets[norm];
    const isFirstConnect = !existing;

    const record = {
      ...makeDefaultWalletRecord(norm, nowIso, chainId, source),
      ...(existing || {}),
    };

    record.lastSeenAt = nowIso;
    record.connectCount = (record.connectCount || 0) + 1;
    if (chainId) record.chainId = Number(chainId) || 4663;
    if (source) record.source = String(source).slice(0, 24);
    state.wallets[norm] = record;

    if (fetchBalanceFn) {
      try {
        const bal = await fetchBalanceFn(norm);
        if (typeof bal === 'number' && Number.isFinite(bal) && bal >= 0) {
          record.onChainWifBalance = bal;
        }
      } catch {}
    }

    flushToDisk();
    return {
      ...publicSummary(norm),
      isFirstConnect,
    };
  }

  function verifyWalletSignature({ address, signature }) {
    if (!isValidRealWalletAddress(address)) {
      throw new Error('Invalid wallet address.');
    }
    const norm = address.trim().toLowerCase();
    const record = state.wallets[norm];
    if (!record) {
      throw new Error('Connect wallet first before verifying signature.');
    }
    const expectedMessage = buildChallengeMessage(norm, record.nonce);
    const valid = verifyPersonalSign(expectedMessage, signature, norm);
    if (!valid) {
      throw new Error('Signature verification failed for wallet address.');
    }
    const firstTimeVerified = !record.verified;
    record.verified = true;
    record.verifiedAt = record.verifiedAt || nowFn().toISOString();
    record.lastSeenAt = nowFn().toISOString();
    record.nonce = crypto.randomBytes(8).toString('hex');
    flushToDisk();
    return {
      ...publicSummary(norm),
      verified: true,
      firstTimeVerified,
      bonusTownPoints: firstTimeVerified ? 100 : 0,
    };
  }

  async function verifyOnChainWifTx({ address = null, txHash }) {
    const cleanHash = String(txHash || '').trim().toLowerCase();
    if (!isValidTxHash(cleanHash)) {
      throw new Error('Enter a valid 66-character 0x transaction hash.');
    }
    if (state.verifiedTxs[cleanHash]) {
      throw new Error('This transaction hash is already verified in the Harbor Registry.');
    }
    if (!fetchReceiptFn) {
      throw new Error('On-chain RPC receipt verifier is unavailable.');
    }

    const receipt = await fetchReceiptFn(cleanHash);
    if (!receipt) {
      throw new Error(
        'Transaction receipt not found yet on Robinhood Chain (4663). Wait a few seconds and retry.',
      );
    }
    const statusHex = String(receipt.status || '').toLowerCase();
    if (statusHex !== '0x1' && statusHex !== '1') {
      throw new Error('Transaction did not succeed on Robinhood Chain (status != 0x1).');
    }

    const transfers = decodeWifTransfersFromReceipt(receipt);
    if (transfers.length === 0) {
      throw new Error(
        `No official World is Flat ($wif) Transfer logs (${WIF_CONTRACT_MAINNET.slice(0, 8)}…) found in this transaction.`,
      );
    }

    let targetAddr = null;
    if (address && isValidRealWalletAddress(address)) {
      targetAddr = address.trim().toLowerCase();
      const txSender = String(receipt.from || '').trim().toLowerCase();
      const matchesWallet =
        txSender === targetAddr || transfers.some((t) => t.from === targetAddr);
      if (!matchesWallet) {
        throw new Error(
          `This $wif transaction was not sent by ${formatShortAddress(targetAddr)}.`,
        );
      }
    } else {
      const candidate =
        transfers.find((t) => isValidRealWalletAddress(t.from))?.from ||
        String(receipt.from || '').trim().toLowerCase();
      if (!isValidRealWalletAddress(candidate)) {
        throw new Error('Could not resolve a valid sender wallet address from receipt.');
      }
      targetAddr = candidate;
    }

    const walletTransfers = transfers.filter((t) => t.from === targetAddr);
    const relevant = walletTransfers.length > 0 ? walletTransfers : transfers;
    const wifMoved = Number(relevant.reduce((acc, t) => acc + t.amountWif, 0).toFixed(4));
    const wifBurned = Number(
      relevant
        .filter((t) => t.to === DEAD_BURN_SINK_LOWER)
        .reduce((acc, t) => acc + t.amountWif, 0)
        .toFixed(4),
    );

    const nowIso = nowFn().toISOString();
    const record = {
      ...makeDefaultWalletRecord(targetAddr, nowIso, 4663, 'onchain-tx'),
      ...(state.wallets[targetAddr] || {}),
    };
    record.lastSeenAt = nowIso;
    record.connectCount = Math.max(1, record.connectCount || 0);
    record.verified = true;
    record.verifiedAt = record.verifiedAt || nowIso;
    record.verifiedTxCount = (record.verifiedTxCount || 0) + 1;
    record.verifiedOnChainWifMoved = Number(
      ((record.verifiedOnChainWifMoved || 0) + wifMoved).toFixed(4),
    );
    record.lastVerifiedTxHash = cleanHash;
    record.totalBurnedWif = Number(((record.totalBurnedWif || 0) + wifBurned).toFixed(4));
    if (record.verifiedOnChainWifMoved >= 1) {
      record.onChainPatronBoost = true;
    }

    if (fetchBalanceFn) {
      try {
        const bal = await fetchBalanceFn(targetAddr);
        if (typeof bal === 'number' && Number.isFinite(bal) && bal >= 0) {
          record.onChainWifBalance = bal;
        }
      } catch {}
    }

    state.wallets[targetAddr] = record;
    state.verifiedTxs[cleanHash] = {
      address: targetAddr,
      wifMoved,
      wifBurned,
      verifiedAt: nowIso,
    };
    state.totalVerifiedOnChainWifMoved = Number(
      ((state.totalVerifiedOnChainWifMoved || 0) + wifMoved).toFixed(4),
    );
    if (wifBurned > 0) {
      state.totalWifBurnedInGame = Number((state.totalWifBurnedInGame + wifBurned).toFixed(2));
    }

    flushToDisk();
    return {
      ...publicSummary(targetAddr),
      txVerified: true,
      txHash: cleanHash,
      verifiedAddress: targetAddr,
      wifMoved,
      wifBurned,
      bonusTownPoints: 150,
      onChainPatronBoost: Boolean(record.onChainPatronBoost),
    };
  }

  function recordMatch({
    address,
    finalNetWorthWif = 0,
    won = false,
    burnedWif = 0,
    entryMode = 'casual',
    dailySeed = null,
    playerName = null,
  }) {
    const safeWorth = Math.max(0, Math.min(1_000_000, Math.round(Number(finalNetWorthWif) || 0)));
    const safeBurn = Math.max(0, Math.min(100_000, Number(burnedWif) || 0));
    const nowDate = nowFn();
    const nowIso = nowDate.toISOString();
    const todayKey = utcDateKey(nowDate);

    state.totalMatchesPlayed += 1;
    state.totalWifBurnedInGame = Number((state.totalWifBurnedInGame + safeBurn).toFixed(2));

    let norm = null;
    let streakMultiplier = 1;
    let streakDays = 1;
    let streakBonusPoints = 0;

    if (address && isValidRealWalletAddress(address)) {
      norm = address.trim().toLowerCase();
      state.walletMatchesPlayed += 1;
      const rec = {
        ...makeDefaultWalletRecord(norm, nowIso, 4663, 'eip1193'),
        ...(state.wallets[norm] || {}),
      };
      rec.connectCount = Math.max(1, rec.connectCount || 0);
      rec.lastSeenAt = nowIso;
      rec.matchesPlayed = (rec.matchesPlayed || 0) + 1;
      if (won) rec.wins = (rec.wins || 0) + 1;
      if (safeWorth > (rec.bestNetWorthWif || 0)) rec.bestNetWorthWif = safeWorth;
      rec.totalBurnedWif = Number(((rec.totalBurnedWif || 0) + safeBurn).toFixed(2));

      if (rec.lastPlayedDay === todayKey) {
        rec.currentStreakDays = Math.max(1, rec.currentStreakDays || 1);
      } else if (rec.lastPlayedDay === prevUtcDateKey(todayKey)) {
        rec.currentStreakDays = (rec.currentStreakDays || 0) + 1;
      } else {
        rec.currentStreakDays = 1;
      }
      rec.bestStreakDays = Math.max(rec.bestStreakDays || 0, rec.currentStreakDays);
      rec.lastPlayedDay = todayKey;

      streakDays = rec.currentStreakDays;
      streakMultiplier = Number(
        (1 + Math.min(0.5, Math.max(0, streakDays - 1) * 0.1)).toFixed(2),
      );
      if (streakDays > 1) {
        streakBonusPoints = Math.round((streakMultiplier - 1) * Math.max(60, safeWorth));
      }

      state.wallets[norm] = rec;
    } else {
      state.guestMatchesPlayed += 1;
    }

    const isDaily = entryMode === 'daily' || (dailySeed && String(dailySeed) === todayKey);
    if (isDaily) {
      const seedKey = dailySeed && /^\d{4}-\d{2}-\d{2}$/.test(String(dailySeed))
        ? String(dailySeed)
        : todayKey;
      if (!state.dailyBoards[seedKey]) {
        state.dailyBoards[seedKey] = {};
      }
      const board = state.dailyBoards[seedKey];
      const cleanName = String(playerName || 'Guest Trader')
        .replace(/[^a-zA-Z0-9 _.-]/g, '')
        .trim()
        .slice(0, 20);
      const entryKey = norm || `guest:${cleanName.toLowerCase() || 'trader'}`;
      const prev = board[entryKey];
      const rec = norm ? state.wallets[norm] : null;
      board[entryKey] = {
        label: norm ? formatShortAddress(norm) : cleanName || 'Guest Trader',
        shortAddress: norm ? formatShortAddress(norm) : null,
        verified: Boolean(rec?.verified),
        verifiedTxCount: rec?.verifiedTxCount || 0,
        bestNetWorthWif: prev ? Math.max(prev.bestNetWorthWif, safeWorth) : safeWorth,
        won: Boolean(prev?.won || won),
        attempts: (prev?.attempts || 0) + 1,
        streakDays: rec?.currentStreakDays || 1,
        updatedAt: nowIso,
      };
    }

    flushToDisk();
    return {
      ...publicSummary(norm),
      streakDays,
      streakMultiplier,
      streakBonusPoints,
    };
  }

  function readJsonBody(req) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      let total = 0;
      req.on('data', (chunk) => {
        total += chunk.length;
        if (total > maxBodyBytes) {
          reject(new Error('Payload too large'));
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', () => {
        try {
          const text = Buffer.concat(chunks).toString('utf8');
          resolve(text ? JSON.parse(text) : {});
        } catch {
          reject(new Error('Invalid JSON payload'));
        }
      });
      req.on('error', reject);
    });
  }

  function sendJson(res, status, obj) {
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end(JSON.stringify(obj));
  }

  function handleRequest(req, res) {
    const parsed = new URL(req.url || '/', 'http://localhost');
    if (!parsed.pathname.startsWith('/api/wallets')) {
      return false;
    }

    if (req.method === 'OPTIONS') {
      sendJson(res, 200, { ok: true });
      return true;
    }

    if (req.method === 'GET' && parsed.pathname === '/api/wallets') {
      const viewer = parsed.searchParams.get('address');
      sendJson(res, 200, publicSummary(viewer));
      return true;
    }

    if (req.method === 'GET' && parsed.pathname === '/api/wallets/daily') {
      const dateParam =
        parsed.searchParams.get('date') ||
        parsed.searchParams.get('seed') ||
        utcDateKey(nowFn());
      const rows = getDailyLeaderboard(dateParam);
      sendJson(res, 200, {
        ok: true,
        date: dateParam,
        seed: dateParam,
        dailyLeaderboard: rows,
        leaderboard: rows,
      });
      return true;
    }

    const clientIp =
      String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
      req.socket?.remoteAddress ||
      'local';

    if (req.method === 'POST' && parsed.pathname === '/api/wallets/connect') {
      if (!allowRate(clientIp)) {
        sendJson(res, 429, { ok: false, error: 'Too many requests, try again shortly.' });
        return true;
      }
      readJsonBody(req)
        .then((body) => recordConnect(body))
        .then((out) => sendJson(res, 200, out))
        .catch((err) => sendJson(res, 400, { ok: false, error: err.message || 'Bad request' }));
      return true;
    }

    if (req.method === 'POST' && parsed.pathname === '/api/wallets/verify') {
      if (!allowRate(clientIp)) {
        sendJson(res, 429, { ok: false, error: 'Too many requests, try again shortly.' });
        return true;
      }
      readJsonBody(req)
        .then((body) => verifyWalletSignature(body))
        .then((out) => sendJson(res, 200, out))
        .catch((err) =>
          sendJson(res, 400, { ok: false, error: err.message || 'Verification failed' }),
        );
      return true;
    }

    if (req.method === 'POST' && parsed.pathname === '/api/wallets/tx') {
      if (!allowRate(clientIp)) {
        sendJson(res, 429, { ok: false, error: 'Too many requests, try again shortly.' });
        return true;
      }
      readJsonBody(req)
        .then((body) => verifyOnChainWifTx(body))
        .then((out) => sendJson(res, 200, out))
        .catch((err) =>
          sendJson(res, 400, { ok: false, error: err.message || 'Tx verification failed' }),
        );
      return true;
    }

    if (req.method === 'POST' && parsed.pathname === '/api/wallets/match') {
      if (!allowRate(clientIp)) {
        sendJson(res, 429, { ok: false, error: 'Too many requests, try again shortly.' });
        return true;
      }
      readJsonBody(req)
        .then((body) => recordMatch(body))
        .then((out) => sendJson(res, 200, out))
        .catch((err) => sendJson(res, 400, { ok: false, error: err.message || 'Bad request' }));
      return true;
    }

    sendJson(res, 404, { ok: false, error: 'Unknown wallet endpoint' });
    return true;
  }

  return {
    storePath,
    publicSummary,
    getDailyLeaderboard,
    recordConnect,
    verifyWalletSignature,
    verifyOnChainWifTx,
    recordMatch,
    flushToDisk,
    handleRequest,
  };
}
