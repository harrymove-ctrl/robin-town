import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROBINHOOD_MAINNET_RPC =
  process.env.ROBINHOOD_MAINNET_RPC || 'https://rpc.mainnet.chain.robinhood.com';
const WIF_CONTRACT_MAINNET = '0x5173b8eA6923c2d40267890D45C46a3480954773';

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
// Persistent Harbor Wallet & Match Registry
// ============================================================================

export function isValidRealWalletAddress(addr) {
  if (typeof addr !== 'string') return false;
  const clean = addr.trim().toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(clean)) return false;
  if (BLOCKED_SIM_ADDRESSES.has(clean)) return false;
  return true;
}

export function formatShortAddress(addr) {
  const clean = String(addr || '').trim();
  if (clean.length < 12) return clean;
  return `${clean.slice(0, 6)}…${clean.slice(-4)}`;
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
  const hexVal = json?.result;
  if (!hexVal || hexVal === '0x') return 0;
  const rawHex = String(hexVal).replace(/^0x/i, '');
  if (!rawHex) return 0;
  const wei = BigInt('0x' + rawHex);
  const whole = wei / 1000000000000000000n;
  const rem = wei % 1000000000000000000n;
  return Number((Number(whole) + Number(rem) / 1e18).toFixed(4));
}

export function createWalletRegistry(options = {}) {
  const storePath = options.storePath || resolveDefaultStorePath();
  const fetchBalanceFn =
    options.fetchBalanceFn !== undefined ? options.fetchBalanceFn : fetchMainnetWifBalance;
  const maxBodyBytes = 16_384;

  /**
   * @type {{
   *   version: number,
   *   updatedAt: string,
   *   totalMatchesPlayed: number,
   *   walletMatchesPlayed: number,
   *   guestMatchesPlayed: number,
   *   totalWifBurnedInGame: number,
   *   wallets: Record<string, {
   *     address: string,
   *     firstSeenAt: string,
   *     lastSeenAt: string,
   *     connectCount: number,
   *     verified: boolean,
   *     verifiedAt: string | null,
   *     nonce: string,
   *     chainId: number,
   *     source: string,
   *     onChainWifBalance: number,
   *     matchesPlayed: number,
   *     wins: number,
   *     bestNetWorthWif: number,
   *     totalBurnedWif: number
   *   }>
   * }}
   */
  let state = {
    version: 1,
    updatedAt: new Date().toISOString(),
    totalMatchesPlayed: 0,
    walletMatchesPlayed: 0,
    guestMatchesPlayed: 0,
    totalWifBurnedInGame: 0,
    wallets: {},
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
          };
        }
      }
    } catch {}
  }

  function flushToDisk() {
    try {
      state.updatedAt = new Date().toISOString();
      const dir = path.dirname(storePath);
      fs.mkdirSync(dir, { recursive: true });
      const tmp = `${storePath}.tmp.${process.pid}.${Date.now()}`;
      fs.writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8');
      fs.renameSync(tmp, storePath);
    } catch {}
  }

  loadFromDisk();

  // Simple per-IP sliding window rate limiter (max 30 mutating calls per 60s)
  const ipBuckets = new Map();
  function allowRate(ip) {
    const key = String(ip || 'local');
    const now = Date.now();
    const bucket = ipBuckets.get(key);
    if (!bucket || now - bucket.windowStart > 60_000) {
      ipBuckets.set(key, { windowStart: now, count: 1 });
      return true;
    }
    if (bucket.count >= 40) return false;
    bucket.count += 1;
    return true;
  }

  function publicSummary(viewerAddress = null) {
    const entries = Object.values(state.wallets);
    const verifiedCount = entries.filter((w) => w.verified).length;

    const leaderboard = [...entries]
      .sort((a, b) => {
        if (b.bestNetWorthWif !== a.bestNetWorthWif) return b.bestNetWorthWif - a.bestNetWorthWif;
        if (Number(b.verified) !== Number(a.verified)) return Number(b.verified) - Number(a.verified);
        if (b.matchesPlayed !== a.matchesPlayed) return b.matchesPlayed - a.matchesPlayed;
        return b.onChainWifBalance - a.onChainWifBalance;
      })
      .slice(0, 25)
      .map((w, idx) => ({
        rank: idx + 1,
        shortAddress: formatShortAddress(w.address),
        verified: w.verified,
        chainId: w.chainId,
        onChainWifBalance: w.onChainWifBalance,
        matchesPlayed: w.matchesPlayed,
        wins: w.wins,
        bestNetWorthWif: w.bestNetWorthWif,
        totalBurnedWif: w.totalBurnedWif,
        lastSeenAt: w.lastSeenAt,
      }));

    const recentWallets = [...entries]
      .sort((a, b) => Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt))
      .slice(0, 20)
      .map((w) => ({
        shortAddress: formatShortAddress(w.address),
        verified: w.verified,
        chainId: w.chainId,
        source: w.source,
        onChainWifBalance: w.onChainWifBalance,
        matchesPlayed: w.matchesPlayed,
        bestNetWorthWif: w.bestNetWorthWif,
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
        me = {
          address: own.address,
          shortAddress: formatShortAddress(own.address),
          verified: own.verified,
          verifiedAt: own.verifiedAt,
          rank: rankIdx >= 0 ? rankIdx + 1 : null,
          onChainWifBalance: own.onChainWifBalance,
          matchesPlayed: own.matchesPlayed,
          wins: own.wins,
          bestNetWorthWif: own.bestNetWorthWif,
          totalBurnedWif: own.totalBurnedWif,
          challengeMessage: buildChallengeMessage(own.address, own.nonce),
        };
      }
    }

    return {
      ok: true,
      storePersistent: storePath.startsWith('/data/'),
      totalUniqueWallets: entries.length,
      verifiedWallets: verifiedCount,
      totalMatchesPlayed: state.totalMatchesPlayed,
      walletMatchesPlayed: state.walletMatchesPlayed,
      guestMatchesPlayed: state.guestMatchesPlayed,
      totalWifBurnedInGame: Number(state.totalWifBurnedInGame.toFixed(2)),
      leaderboard,
      recentWallets,
      me,
    };
  }

  async function recordConnect({ address, chainId = 4663, source = 'eip1193' }) {
    if (!isValidRealWalletAddress(address)) {
      throw new Error('Invalid or simulated wallet address.');
    }
    const norm = address.trim().toLowerCase();
    const nowIso = new Date().toISOString();
    const existing = state.wallets[norm];
    const isFirstConnect = !existing;

    const record = existing || {
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
    };

    record.lastSeenAt = nowIso;
    record.connectCount += 1;
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
    record.verifiedAt = record.verifiedAt || new Date().toISOString();
    record.lastSeenAt = new Date().toISOString();
    record.nonce = crypto.randomBytes(8).toString('hex');
    flushToDisk();
    return {
      ...publicSummary(norm),
      verified: true,
      firstTimeVerified,
      bonusTownPoints: firstTimeVerified ? 100 : 0,
    };
  }

  function recordMatch({
    address,
    finalNetWorthWif = 0,
    won = false,
    burnedWif = 0,
  }) {
    const safeWorth = Math.max(0, Math.min(1_000_000, Math.round(Number(finalNetWorthWif) || 0)));
    const safeBurn = Math.max(0, Math.min(100_000, Number(burnedWif) || 0));

    state.totalMatchesPlayed += 1;
    state.totalWifBurnedInGame = Number((state.totalWifBurnedInGame + safeBurn).toFixed(2));

    let norm = null;
    if (address && isValidRealWalletAddress(address)) {
      norm = address.trim().toLowerCase();
      state.walletMatchesPlayed += 1;
      const nowIso = new Date().toISOString();
      const rec = state.wallets[norm] || {
        address: norm,
        firstSeenAt: nowIso,
        lastSeenAt: nowIso,
        connectCount: 1,
        verified: false,
        verifiedAt: null,
        nonce: crypto.randomBytes(8).toString('hex'),
        chainId: 4663,
        source: 'eip1193',
        onChainWifBalance: 0,
        matchesPlayed: 0,
        wins: 0,
        bestNetWorthWif: 0,
        totalBurnedWif: 0,
      };
      rec.lastSeenAt = nowIso;
      rec.matchesPlayed += 1;
      if (won) rec.wins += 1;
      if (safeWorth > rec.bestNetWorthWif) rec.bestNetWorthWif = safeWorth;
      rec.totalBurnedWif = Number((rec.totalBurnedWif + safeBurn).toFixed(2));
      state.wallets[norm] = rec;
    } else {
      state.guestMatchesPlayed += 1;
    }

    flushToDisk();
    return publicSummary(norm);
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
        .catch((err) => sendJson(res, 400, { ok: false, error: err.message || 'Verification failed' }));
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
    recordConnect,
    verifyWalletSignature,
    recordMatch,
    flushToDisk,
    handleRequest,
  };
}
