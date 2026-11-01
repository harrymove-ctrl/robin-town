import crypto from 'node:crypto';
import { createWalletRegistry } from './wallet-registry.mjs';

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MAX_FRAME_BYTES = 262_144; // 256 KB cap per packet
const MAX_ROOMS = 256;
const ROOM_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

export const ROBINHOOD_MAINNET_RPC = 'https://rpc.mainnet.chain.robinhood.com';
export const ROBINHOOD_TESTNET_RPC = 'https://rpc.testnet.chain.robinhood.com';
export const WIF_CONTRACT_MAINNET = '0x5173b8eA6923c2d40267890D45C46a3480954773';
export const DEAD_BURN_SINK = '0x000000000000000000000000000000000000dEaD';
export const WORLD_IS_FLAT_URL = 'https://worldisflat.fun';
export const WORLD_IS_FLAT_BUILD_URL = 'https://worldisflat.fun/build';
export const WORLD_IS_FLAT_FAIR_URL = 'https://worldisflat.fun/fair/';
export const WIF_PONS_LAUNCHPAD_URL =
  'https://www.ponsfamily.com/launchpad/0x5173b8eA6923c2d40267890D45C46a3480954773';

export function encodeWsFrame(opcode, payloadBuffer) {
  const len = payloadBuffer.length;
  let header;
  if (len < 126) {
    header = Buffer.allocUnsafe(2);
    header[0] = 0x80 | (opcode & 0x0f);
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.allocUnsafe(4);
    header[0] = 0x80 | (opcode & 0x0f);
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.allocUnsafe(10);
    header[0] = 0x80 | (opcode & 0x0f);
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payloadBuffer]);
}

export function encodeWsText(text) {
  return encodeWsFrame(0x01, Buffer.from(text, 'utf8'));
}

async function rpcCall(rpcUrl, method, params) {
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(4500),
  });
  if (!res.ok) throw new Error(`RPC HTTP ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || 'RPC error');
  return data.result;
}

function hexWeiToFloat(hexVal) {
  if (!hexVal || hexVal === '0x') return 0;
  const cleaned = hexVal.startsWith('0x') ? hexVal.slice(2) : hexVal;
  if (!cleaned) return 0;
  const wei = BigInt('0x' + cleaned);
  const whole = wei / 1000000000000000000n;
  const rem = wei % 1000000000000000000n;
  return Number(whole) + Number(rem) / 1e18;
}

let cachedOnChainSnapshot = null;
let cachedOnChainAt = 0;

export async function getLiveOnChainWifProof() {
  const now = Date.now();
  if (cachedOnChainSnapshot && now - cachedOnChainAt < 15_000) {
    return cachedOnChainSnapshot;
  }

  const deadCallData =
    '0x70a08231000000000000000000000000000000000000000000000000000000000000dead';
  const totalSupplyData = '0x18160ddd';

  const [mainnetBlockHex, testnetBlockHex, deadBalHex, totalSupplyHex] = await Promise.all([
    rpcCall(ROBINHOOD_MAINNET_RPC, 'eth_blockNumber', []),
    rpcCall(ROBINHOOD_TESTNET_RPC, 'eth_blockNumber', []).catch(() => '0x0'),
    rpcCall(
      ROBINHOOD_MAINNET_RPC,
      'eth_call',
      [{ to: WIF_CONTRACT_MAINNET, data: deadCallData }, 'latest'],
    ),
    rpcCall(
      ROBINHOOD_MAINNET_RPC,
      'eth_call',
      [{ to: WIF_CONTRACT_MAINNET, data: totalSupplyData }, 'latest'],
    ),
  ]);

  const supplyFloat = hexWeiToFloat(String(totalSupplyHex));
  const deadFloat = hexWeiToFloat(String(deadBalHex));
  const supplyBurnedFloat = Math.max(0, 1_000_000_000 - supplyFloat);

  const snapshot = {
    ok: true,
    fetchedAt: new Date(now).toISOString(),
    mainnetChainId: 4663,
    testnetChainId: 46630,
    mainnetRpc: ROBINHOOD_MAINNET_RPC,
    testnetRpc: ROBINHOOD_TESTNET_RPC,
    explorerUrl: `https://robinhoodchain.blockscout.com/token/${WIF_CONTRACT_MAINNET}`,
    burnAddressUrl: `https://robinhoodchain.blockscout.com/address/${DEAD_BURN_SINK}`,
    worldIsFlatUrl: WORLD_IS_FLAT_URL,
    hackathonUrl: WORLD_IS_FLAT_BUILD_URL,
    fairUrl: WORLD_IS_FLAT_FAIR_URL,
    ponsTradeUrl: WIF_PONS_LAUNCHPAD_URL,
    contractAddress: WIF_CONTRACT_MAINNET,
    tokenName: 'World is Flat',
    tokenSymbol: 'WIF',
    decimals: 18,
    mainnetBlockNumber: parseInt(String(mainnetBlockHex), 16) || 0,
    testnetBlockNumber: parseInt(String(testnetBlockHex), 16) || 0,
    totalSupplyWif: Math.round(supplyFloat),
    burnedDeadBalanceWif: Number((deadFloat + supplyBurnedFloat).toFixed(2)),
    deadSinkBalanceWif: Number(deadFloat.toFixed(2)),
    supplyBurnedWif: Number(supplyBurnedFloat.toFixed(2)),
  };

  cachedOnChainSnapshot = snapshot;
  cachedOnChainAt = now;
  return snapshot;
}

export function createMultiplayerRelay(options = {}) {
  /** @type {Map<string, { code: string, peers: Map<string, import('node:net').Socket>, lastSyncText: string | null, updatedAt: number }>} */
  const rooms = new Map();
  const walletRegistry = createWalletRegistry(options.walletRegistryOptions || {});

  function pruneStaleRooms() {
    const now = Date.now();
    for (const [code, room] of rooms) {
      if (room.peers.size === 0 && now - room.updatedAt > ROOM_TTL_MS) {
        rooms.delete(code);
      }
    }
    if (rooms.size > MAX_ROOMS) {
      for (const [code, room] of rooms) {
        if (room.peers.size === 0) {
          rooms.delete(code);
          if (rooms.size <= MAX_ROOMS) break;
        }
      }
    }
  }

  function handleApiRequest(req, res) {
    const rawUrl = (req.url || '/').split('?')[0] || '/';

    if (rawUrl === '/api/rooms' && req.method === 'GET') {
      pruneStaleRooms();
      let connectedClients = 0;
      const activeRooms = [];
      for (const [code, room] of rooms) {
        if (room.peers.size > 0) {
          connectedClients += room.peers.size;
          activeRooms.push({ code, players: room.peers.size, updatedAt: room.updatedAt });
        }
      }
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(
        JSON.stringify({
          ok: true,
          transport: 'websocket-rfc6455',
          activeRoomCount: activeRooms.length,
          connectedClients,
          rooms: activeRooms,
        }),
      );
      return true;
    }

    if (rawUrl === '/api/onchain-wif' && req.method === 'GET') {
      getLiveOnChainWifProof()
        .then((proof) => {
          res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'public, max-age=10',
            'Access-Control-Allow-Origin': '*',
          });
          res.end(JSON.stringify(proof));
        })
        .catch((err) => {
          res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            'Access-Control-Allow-Origin': '*',
          });
          res.end(
            JSON.stringify({
              ok: false,
              contractAddress: WIF_CONTRACT_MAINNET,
              explorerUrl: `https://robinhoodchain.blockscout.com/token/${WIF_CONTRACT_MAINNET}`,
              error: err instanceof Error ? err.message : 'RPC unreachable',
            }),
          );
        });
      return true;
    }

    if (walletRegistry.handleRequest(req, res)) {
      return true;
    }

    return false;
  }

  function handleUpgrade(req, socket, head) {
    let parsedUrl;
    try {
      parsedUrl = new URL(req.url || '/', 'http://localhost');
    } catch {
      socket.destroy();
      return false;
    }

    if (parsedUrl.pathname !== '/ws') {
      return false;
    }

    const roomCode = (parsedUrl.searchParams.get('room') || '').trim().toUpperCase();
    const clientId =
      (parsedUrl.searchParams.get('client') || '').trim() ||
      `peer_${crypto.randomBytes(4).toString('hex')}`;
    const wsKey = req.headers['sec-websocket-key'];

    if (!/^[A-Z0-9]{6}$/.test(roomCode) || typeof wsKey !== 'string' || !wsKey) {
      socket.write('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return true;
    }

    const accept = crypto
      .createHash('sha1')
      .update(wsKey.trim() + WS_GUID)
      .digest('base64');

    socket.write(
      [
        'HTTP/1.1 101 Switching Protocols',
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Accept: ${accept}`,
        '\r\n',
      ].join('\r\n'),
    );
    socket.setNoDelay(true);

    pruneStaleRooms();
    let room = rooms.get(roomCode);
    if (!room) {
      room = {
        code: roomCode,
        peers: new Map(),
        lastSyncText: null,
        updatedAt: Date.now(),
      };
      rooms.set(roomCode, room);
    }

    const prevSocket = room.peers.get(clientId);
    if (prevSocket && prevSocket !== socket) {
      prevSocket.destroy();
    }
    room.peers.set(clientId, socket);
    room.updatedAt = Date.now();

    // Replay latest cached authoritative state to newly connected non-host peers
    if (room.lastSyncText && parsedUrl.searchParams.get('host') !== '1') {
      try {
        socket.write(encodeWsText(room.lastSyncText));
      } catch {}
    }

    let recvBuf = head && head.length > 0 ? Buffer.from(head) : Buffer.alloc(0);

    const cleanup = () => {
      const r = rooms.get(roomCode);
      if (r && r.peers.get(clientId) === socket) {
        r.peers.delete(clientId);
        r.updatedAt = Date.now();
      }
    };

    const processFrames = () => {
      while (recvBuf.length >= 2) {
        const b0 = recvBuf[0];
        const b1 = recvBuf[1];
        const opcode = b0 & 0x0f;
        const masked = (b1 & 0x80) !== 0;
        let payloadLen = b1 & 0x7f;
        let offset = 2;

        if (payloadLen === 126) {
          if (recvBuf.length < 4) return;
          payloadLen = recvBuf.readUInt16BE(2);
          offset = 4;
        } else if (payloadLen === 127) {
          if (recvBuf.length < 10) return;
          const bigLen = recvBuf.readBigUInt64BE(2);
          if (bigLen > BigInt(MAX_FRAME_BYTES)) {
            socket.destroy();
            return;
          }
          payloadLen = Number(bigLen);
          offset = 10;
        }

        if (payloadLen > MAX_FRAME_BYTES) {
          socket.destroy();
          return;
        }

        const maskLen = masked ? 4 : 0;
        const totalFrameLen = offset + maskLen + payloadLen;
        if (recvBuf.length < totalFrameLen) return;

        const payload = Buffer.from(
          recvBuf.subarray(offset + maskLen, totalFrameLen),
        );
        if (masked) {
          const maskKey = recvBuf.subarray(offset, offset + 4);
          for (let i = 0; i < payload.length; i++) {
            payload[i] ^= maskKey[i & 3];
          }
        }
        recvBuf = recvBuf.subarray(totalFrameLen);

        if (opcode === 0x08) {
          try {
            socket.end(encodeWsFrame(0x08, Buffer.alloc(0)));
          } catch {
            socket.destroy();
          }
          return;
        }

        if (opcode === 0x09) {
          try {
            socket.write(encodeWsFrame(0x0a, payload));
          } catch {}
          continue;
        }

        if (opcode === 0x01) {
          const text = payload.toString('utf8');
          let parsed;
          try {
            parsed = JSON.parse(text);
          } catch {
            continue;
          }
          if (!parsed || parsed.roomCode !== roomCode) continue;

          const currentRoom = rooms.get(roomCode);
          if (!currentRoom) continue;
          currentRoom.updatedAt = Date.now();

          if (
            parsed.type === 'ROOM_STATE_SYNC' ||
            parsed.type === 'MATCH_STARTED' ||
            parsed.type === 'GAME_STATE_SYNC'
          ) {
            currentRoom.lastSyncText = text;
          }

          const outboundFrame = encodeWsText(text);
          for (const [peerId, peerSocket] of currentRoom.peers) {
            if (peerId !== clientId && !peerSocket.destroyed) {
              try {
                peerSocket.write(outboundFrame);
              } catch {}
            }
          }
        }
      }
    };

    if (recvBuf.length > 0) {
      processFrames();
    }

    socket.on('data', (chunk) => {
      recvBuf = recvBuf.length === 0 ? chunk : Buffer.concat([recvBuf, chunk]);
      if (recvBuf.length > MAX_FRAME_BYTES * 2) {
        socket.destroy();
        return;
      }
      processFrames();
    });

    socket.on('close', cleanup);
    socket.on('end', cleanup);
    socket.on('error', cleanup);
    return true;
  }

  return { handleApiRequest, handleUpgrade, rooms, walletRegistry };
}
