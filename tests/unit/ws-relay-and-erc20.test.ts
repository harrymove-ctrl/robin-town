import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {
  BURN_ADDRESS,
  ROBINHOOD_MAINNET_CHAIN_ID,
  WIF_TOKEN_CONTRACT_ADDRESS,
  WalletAdapter,
  encodeErc20Approve,
  encodeErc20BalanceOf,
  encodeErc20Burn,
  encodeErc20Transfer,
  type EIP1193Provider,
} from '../../src/tokenomics/wallet';
import { NetworkRoom, WebSocketRelayTransport } from '../../src/network/room';
// @ts-expect-error ESM relay module shared with production server
import { createMultiplayerRelay } from '../../scripts/ws-relay.mjs';

describe('Cross-Device RFC 6455 WebSocket Relay & $wif ERC-20 Contract Integration', () => {
  it('encodes ERC-20 balanceOf, transfer, approve, and burn selectors accurately', () => {
    const balData = encodeErc20BalanceOf(BURN_ADDRESS);
    assert.equal(
      balData,
      '0x70a08231000000000000000000000000000000000000000000000000000000000000dead',
    );

    const txData = encodeErc20Transfer(BURN_ADDRESS, 100, 18);
    assert.ok(txData.startsWith('0xa9059cbb'));
    assert.equal(txData.length, 2 + 8 + 64 + 64);
    // 100 * 10^18 = 0x56bc75e2d63100000
    assert.ok(txData.endsWith('0000000000000000000000000000000000000000000000056bc75e2d63100000'));

    const appData = encodeErc20Approve('0x1000000000000000000000000000000000000001', 500, 18);
    assert.ok(appData.startsWith('0x095ea7b3'));
    assert.equal(appData.length, 138);

    const burnData = encodeErc20Burn(250, 18);
    assert.ok(burnData.startsWith('0x42966c68'));
    assert.equal(burnData.length, 74);
  });

  it('executes Web3 ERC-20 balanceOf, transferErc20, and approveErc20 against WIF_TOKEN_CONTRACT_ADDRESS', async () => {
    assert.equal(ROBINHOOD_MAINNET_CHAIN_ID, 4663);
    assert.equal(WIF_TOKEN_CONTRACT_ADDRESS, '0x5173b8eA6923c2d40267890D45C46a3480954773');

    const sentCalls: Array<{ method: string; params: unknown }> = [];
    const mockProvider: EIP1193Provider = {
      async request(args) {
        sentCalls.push({ method: args.method, params: args.params });
        if (args.method === 'eth_requestAccounts') {
          return ['0x7F4C890000000000000000000000000000001234'];
        }
        if (args.method === 'eth_chainId') {
          return '0xb627';
        }
        if (args.method === 'eth_getBalance') {
          return '0x56bc75e2d63100000'; // 100
        }
        if (args.method === 'eth_call') {
          return '0x878678326eac900000'; // 2500 WIF
        }
        if (args.method === 'eth_sendTransaction') {
          return '0xerc20txhash999';
        }
        return null;
      },
    };

    const wallet = new WalletAdapter({ mode: 'web3', provider: mockProvider });
    await wallet.connect();

    const ercBal = await wallet.getErc20Balance();
    assert.equal(Math.round(ercBal), 2500);

    const tx = await wallet.transferErc20(BURN_ADDRESS, 100);
    assert.equal(tx.hash, '0xerc20txhash999');

    const lastSend = sentCalls.filter((c) => c.method === 'eth_sendTransaction').pop();
    assert.ok(lastSend);
    const txParam = (lastSend.params as Array<Record<string, string>>)[0];
    assert.equal(txParam.to, WIF_TOKEN_CONTRACT_ADDRESS);
    assert.equal(txParam.value, '0x0');
    assert.ok(txParam.data.startsWith('0xa9059cbb'));
  });

  it('connects two isolated NetworkRooms across separate devices via RFC 6455 WebSocket relay', async () => {
    if (typeof WebSocket === 'undefined') {
      return;
    }

    const relay = createMultiplayerRelay();
    const server = http.createServer((req, res) => {
      if (relay.handleApiRequest(req, res)) return;
      res.writeHead(404);
      res.end();
    });
    server.on('upgrade', (req, socket, head) => {
      if (!relay.handleUpgrade(req, socket, head)) {
        socket.destroy();
      }
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const port = (server.address() as { port: number }).port;
    const wsEndpoint = `ws://127.0.0.1:${port}/ws`;
    const roomCode = 'WIF777';

    const hostTransport = new WebSocketRelayTransport(roomCode, 'host_device_1', {
      wsUrl: wsEndpoint,
      isHost: true,
      autoReconnect: false,
    });
    const guestTransport = new WebSocketRelayTransport(roomCode, 'guest_device_2', {
      wsUrl: wsEndpoint,
      isHost: false,
      autoReconnect: false,
    });

    const hostRoom = new NetworkRoom({
      roomCode,
      isHost: true,
      transport: hostTransport,
      localPlayer: {
        name: 'AliceHost',
        address: '0x1000000000000000000000000000000000000001',
      },
    });
    const guestRoom = new NetworkRoom({
      roomCode,
      isHost: false,
      transport: guestTransport,
      localPlayer: {
        name: 'BobMobile',
        address: '0x2000000000000000000000000000000000000002',
      },
    });

    try {
      await hostRoom.start();
      assert.equal(hostRoom.isCloudRelayActive(), true);

      await guestRoom.start();
      assert.equal(guestRoom.isCloudRelayActive(), true);

      // Wait briefly for WebSocket frame roundtrip
      await new Promise((r) => setTimeout(r, 120));

      assert.equal(hostRoom.state.players.length, 2);
      assert.equal(guestRoom.state.players.length, 2);
      assert.equal(guestRoom.getLocalPlayer()?.seat, 1);

      const apiRes = await fetch(`http://127.0.0.1:${port}/api/rooms`);
      const apiJson = (await apiRes.json()) as { activeRoomCount: number; connectedClients: number };
      assert.equal(apiJson.activeRoomCount, 1);
      assert.equal(apiJson.connectedClients, 2);

      guestRoom.toggleReady(true);
      await new Promise((r) => setTimeout(r, 80));
      assert.equal(hostRoom.state.players[1].isReady, true);

      hostRoom.startMatch(4242);
      await new Promise((r) => setTimeout(r, 100));
      assert.equal(guestRoom.state.status, 'playing');
      assert.ok(guestRoom.state.gameState);
    } finally {
      guestRoom.stop();
      hostRoom.stop();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
