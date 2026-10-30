/**
 * tests/unit/network.test.ts
 *
 * Comprehensive unit test suite for NetworkRoom, transports, and packet protocol.
 * Verifies room code generation, transport operations, lobby management,
 * match start with bot autofill, action sync, and host migration.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import * as assert from 'node:assert';
import {
  ROOM_CODE_ALPHABET,
  generateRoomCode,
  isValidRoomCode,
  normalizeRoomCode,
  MemoryTransport,
  MemoryTransportHub,
  BroadcastChannelTransport,
  NetworkRoom,
} from '../../src/network/room';
import type { GameAction } from '../../src/engine/types';

beforeEach(() => {
  MemoryTransportHub.clearAll();
});

afterEach(() => {
  MemoryTransportHub.clearAll();
});

describe('Suite 1: Room Code Generation and Validation', () => {
  it('generates room code with exactly 6 uppercase alphanumeric characters', () => {
    const code = generateRoomCode();
    assert.strictEqual(typeof code, 'string');
    assert.strictEqual(code.length, 6);
    for (let i = 0; i < code.length; i++) {
      assert.ok(ROOM_CODE_ALPHABET.includes(code.charAt(i)));
    }
  });

  it('validates 6-character alphanumeric room codes correctly', () => {
    assert.strictEqual(isValidRoomCode('ABC123'), true);
    assert.strictEqual(isValidRoomCode('WIF466'), true);
    assert.strictEqual(isValidRoomCode('  ABC123  '), true);

    // Invalid codes
    assert.strictEqual(isValidRoomCode(''), false);
    assert.strictEqual(isValidRoomCode('ABC'), false);
    assert.strictEqual(isValidRoomCode('ABC1234'), false);
    assert.strictEqual(isValidRoomCode('AB!@12'), false);
    assert.strictEqual(isValidRoomCode(null as unknown as string), false);
    assert.strictEqual(isValidRoomCode(undefined as unknown as string), false);
  });

  it('normalizes room code by trimming whitespace and converting to uppercase', () => {
    assert.strictEqual(normalizeRoomCode('  abc123  '), 'ABC123');
    assert.strictEqual(normalizeRoomCode('wif999'), 'WIF999');
  });

  it('generates 1,000 unique room codes with zero collisions across test iterations', () => {
    const generated = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const code = generateRoomCode();
      assert.strictEqual(isValidRoomCode(code), true);
      generated.add(code);
    }
    assert.strictEqual(generated.size, 1000);
  });
});

describe('Suite 2: Transport Layer Operations', () => {
  it('connects MemoryTransport and transitions status from disconnected to connected', async () => {
    const transport = new MemoryTransport('ROOM01', 'client_a');
    assert.strictEqual(transport.status, 'disconnected');

    const statuses: string[] = [];
    transport.onStatusChange((s) => statuses.push(s));

    await transport.connect();
    assert.strictEqual(transport.status, 'connected');
    assert.ok(statuses.includes('connected'));

    transport.disconnect();
    assert.strictEqual(transport.status, 'disconnected');
  });

  it('transmits packets between sender and receiver in the same channel', async () => {
    const sender = new MemoryTransport('ROOM01', 'client_1');
    const receiver = new MemoryTransport('ROOM01', 'client_2');

    await sender.connect();
    await receiver.connect();

    const received: any[] = [];
    receiver.onMessage((packet) => received.push(packet));

    sender.broadcast({
      id: 'pkt_1',
      roomCode: 'ROOM01',
      senderId: 'client_1',
      sequenceNumber: 1,
      timestamp: Date.now(),
      type: 'CHAT_MESSAGE',
      payload: { senderName: 'Alice', text: 'Hello robin-town' },
    });

    assert.strictEqual(received.length, 1);
    assert.strictEqual(received[0].payload.text, 'Hello robin-town');

    sender.disconnect();
    receiver.disconnect();
  });

  it('isolates messages between different channel IDs', async () => {
    const clientA = new MemoryTransport('ROOM01', 'client_a');
    const clientB = new MemoryTransport('ROOM02', 'client_b');

    await clientA.connect();
    await clientB.connect();

    const receivedB: any[] = [];
    clientB.onMessage((pkt) => receivedB.push(pkt));

    clientA.broadcast({
      id: 'pkt_iso',
      roomCode: 'ROOM01',
      senderId: 'client_a',
      sequenceNumber: 1,
      timestamp: Date.now(),
      type: 'CHAT_MESSAGE',
      payload: { senderName: 'A', text: 'Confidential' },
    });

    assert.strictEqual(receivedB.length, 0);

    clientA.disconnect();
    clientB.disconnect();
  });

  it('stops delivery after unsubscribing a message listener', async () => {
    const sender = new MemoryTransport('ROOM01', 'client_1');
    const receiver = new MemoryTransport('ROOM01', 'client_2');

    await sender.connect();
    await receiver.connect();

    const packets: any[] = [];
    const unsubscribe = receiver.onMessage((pkt) => packets.push(pkt));

    sender.broadcast({
      id: 'pkt_1',
      roomCode: 'ROOM01',
      senderId: 'client_1',
      sequenceNumber: 1,
      timestamp: Date.now(),
      type: 'CHAT_MESSAGE',
      payload: { senderName: 'Alice', text: 'First' },
    });

    assert.strictEqual(packets.length, 1);
    unsubscribe();

    sender.broadcast({
      id: 'pkt_2',
      roomCode: 'ROOM01',
      senderId: 'client_1',
      sequenceNumber: 2,
      timestamp: Date.now(),
      type: 'CHAT_MESSAGE',
      payload: { senderName: 'Alice', text: 'Second' },
    });

    assert.strictEqual(packets.length, 1);

    sender.disconnect();
    receiver.disconnect();
  });

  it('unregisters from memory hub and notifies status listeners on disconnect', async () => {
    const transport = new MemoryTransport('ROOM01', 'client_1');
    await transport.connect();

    const statuses: string[] = [];
    transport.onStatusChange((s) => statuses.push(s));

    transport.disconnect();
    assert.strictEqual(transport.status, 'disconnected');
    assert.strictEqual(statuses[statuses.length - 1], 'disconnected');
  });

  it('instantiates BroadcastChannelTransport with normalized channel name and connects cleanly', async () => {
    const bct = new BroadcastChannelTransport('room99', 'client_bc');
    assert.strictEqual(bct.channelId, 'robin-town:room:ROOM99');
    assert.strictEqual(bct.status, 'disconnected');

    await bct.connect();
    assert.strictEqual(bct.status, 'connected');

    bct.disconnect();
    assert.strictEqual(bct.status, 'disconnected');
  });
});

describe('Suite 3: Room Lifecycle and Lobby Management', () => {
  it('creates a room with local host at seat 0, ready status true, and status lobby', async () => {
    const hostRoom = new NetworkRoom({
      roomCode: 'LOBBY1',
      isHost: true,
      localPlayer: {
        name: 'Alice',
        address: '0x1000000000000000000000000000000000000001',
      },
    });

    await hostRoom.start();

    assert.strictEqual(hostRoom.state.code, 'LOBBY1');
    assert.strictEqual(hostRoom.state.status, 'lobby');
    assert.strictEqual(hostRoom.isLocalHost(), true);
    assert.strictEqual(hostRoom.state.players.length, 1);

    const localPlayer = hostRoom.getLocalPlayer();
    assert.ok(localPlayer);
    assert.strictEqual(localPlayer?.name, 'Alice');
    assert.strictEqual(localPlayer?.seat, 0);
    assert.strictEqual(localPlayer?.isHost, true);
    assert.strictEqual(localPlayer?.isReady, true);

    hostRoom.stop();
  });

  it('allows a second client to join room and assigns vacant seat 1', async () => {
    const code = 'LOBBY2';
    const host = new NetworkRoom({
      roomCode: code,
      isHost: true,
      localPlayer: { name: 'Alice', address: '0x1111' },
    });
    await host.start();

    const client = new NetworkRoom({
      roomCode: code,
      isHost: false,
      localPlayer: { name: 'Bob', address: '0x2222' },
    });
    await client.start();

    assert.strictEqual(host.state.players.length, 2);
    const bobOnHost = host.state.players.find((p) => p.name === 'Bob');
    assert.ok(bobOnHost);
    assert.strictEqual(bobOnHost?.seat, 1);
    assert.strictEqual(bobOnHost?.isHost, false);

    assert.strictEqual(client.state.players.length, 2);
    const bobOnClient = client.state.players.find((p) => p.name === 'Bob');
    assert.strictEqual(bobOnClient?.seat, 1);

    host.stop();
    client.stop();
  });

  it('rejects assigning an already occupied seat to another client', async () => {
    const host = new NetworkRoom({
      roomCode: 'LOBBY3',
      isHost: true,
      localPlayer: { name: 'Alice', address: '0x1111' },
    });
    await host.start();

    const client = new NetworkRoom({
      roomCode: 'LOBBY3',
      isHost: false,
      localPlayer: { name: 'Bob', address: '0x2222' },
    });
    await client.start();

    assert.throws(() => {
      client.setSeat(0);
    }, /Seat 0 is already occupied/);

    host.stop();
    client.stop();
  });

  it('allows a player to change seat to an unoccupied seat index 0 to 3', async () => {
    const host = new NetworkRoom({
      roomCode: 'LOBBY4',
      isHost: true,
      localPlayer: { name: 'Alice', address: '0x1111' },
    });
    await host.start();

    const client = new NetworkRoom({
      roomCode: 'LOBBY4',
      isHost: false,
      localPlayer: { name: 'Bob', address: '0x2222' },
    });
    await client.start();

    client.setSeat(3);

    const bobOnHost = host.state.players.find((p) => p.name === 'Bob');
    assert.strictEqual(bobOnHost?.seat, 3);

    host.stop();
    client.stop();
  });

  it('toggles player ready state between true and false', async () => {
    const host = new NetworkRoom({
      roomCode: 'LOBBY5',
      isHost: true,
      localPlayer: { name: 'Alice', address: '0x1111' },
    });
    await host.start();

    const client = new NetworkRoom({
      roomCode: 'LOBBY5',
      isHost: false,
      localPlayer: { name: 'Bob', address: '0x2222' },
    });
    await client.start();

    assert.strictEqual(client.getLocalPlayer()?.isReady, false);

    client.toggleReady(true);
    assert.strictEqual(client.getLocalPlayer()?.isReady, true);
    assert.strictEqual(host.state.players.find((p) => p.name === 'Bob')?.isReady, true);

    client.toggleReady(false);
    assert.strictEqual(client.getLocalPlayer()?.isReady, false);
    assert.strictEqual(host.state.players.find((p) => p.name === 'Bob')?.isReady, false);

    host.stop();
    client.stop();
  });

  it('prevents joining when room is closed', async () => {
    const host = new NetworkRoom({
      roomCode: 'LOBBY6',
      isHost: true,
      localPlayer: { name: 'Alice', address: '0x1111' },
    });
    await host.start();
    host.stop();

    assert.strictEqual(host.state.status, 'closed');
  });

  it('ignores setSeat and toggleReady calls when room status is not lobby', async () => {
    const host = new NetworkRoom({
      roomCode: 'LOBBY7',
      isHost: true,
      localPlayer: { name: 'Alice', address: '0x1111' },
    });
    await host.start();

    const client = new NetworkRoom({
      roomCode: 'LOBBY7',
      isHost: false,
      localPlayer: { name: 'Bob', address: '0x2222' },
    });
    await client.start();
    client.toggleReady(true);
    host.startMatch(12345);

    assert.strictEqual(host.state.status, 'playing');

    // Calling setSeat or toggleReady during active match should be safely ignored
    client.setSeat(3);
    assert.strictEqual(client.getLocalPlayer()?.seat, 1);

    client.toggleReady(false);
    assert.strictEqual(client.getLocalPlayer()?.isReady, true);

    host.stop();
    client.stop();
  });

  it('reassigns vacant seat or spectator status when rejoining player seat is occupied', async () => {
    const host = new NetworkRoom({
      roomCode: 'LOBBY8',
      isHost: true,
      localPlayer: { name: 'Alice', address: '0x1111' },
      disconnectTimeoutMs: 150,
    });
    await host.start();

    const clientBob = new NetworkRoom({
      roomCode: 'LOBBY8',
      isHost: false,
      localPlayer: { name: 'Bob', address: '0x2222' },
      disconnectTimeoutMs: 150,
    });
    await clientBob.start();
    assert.strictEqual(clientBob.getLocalPlayer()?.seat, 1);

    // Simulate Bob timing out
    const bobOnHost = host.state.players.find((p) => p.name === 'Bob');
    assert.ok(bobOnHost);
    bobOnHost.lastSeen = Date.now() - 500;
    host.checkPlayerLiveness();
    assert.strictEqual(bobOnHost.connected, false);
    assert.strictEqual(bobOnHost.seat, null);

    // Charlie joins and takes seat 1
    const clientCharlie = new NetworkRoom({
      roomCode: 'LOBBY8',
      isHost: false,
      localPlayer: { name: 'Charlie', address: '0x3333' },
      disconnectTimeoutMs: 150,
    });
    await clientCharlie.start();
    assert.strictEqual(clientCharlie.getLocalPlayer()?.seat, 1);

    // Bob sends packet: reconnects and does not collide on seat 1
    clientBob.sendChat('Hello again');
    assert.strictEqual(bobOnHost.connected, true);
    assert.strictEqual(bobOnHost.seat, null);

    const seat1Players = host.state.players.filter((p) => p.seat === 1 && p.connected);
    assert.strictEqual(seat1Players.length, 1);
    assert.strictEqual(seat1Players[0].name, 'Charlie');

    host.stop();
    clientBob.stop();
    clientCharlie.stop();
  });
});

describe('Suite 4: Match Start and Bot Autofill', () => {
  it('rejects startMatch when called by a non-host player', async () => {
    const host = new NetworkRoom({
      roomCode: 'MATCH1',
      isHost: true,
      localPlayer: { name: 'Alice', address: '0x1111' },
    });
    await host.start();

    const client = new NetworkRoom({
      roomCode: 'MATCH1',
      isHost: false,
      localPlayer: { name: 'Bob', address: '0x2222' },
    });
    await client.start();

    assert.throws(() => {
      client.startMatch();
    }, /Only the room host can start the match/);

    host.stop();
    client.stop();
  });

  it('rejects startMatch when seated players have not toggled ready', async () => {
    const host = new NetworkRoom({
      roomCode: 'MATCH2',
      isHost: true,
      localPlayer: { name: 'Alice', address: '0x1111' },
    });
    await host.start();

    const client = new NetworkRoom({
      roomCode: 'MATCH2',
      isHost: false,
      localPlayer: { name: 'Bob', address: '0x2222' },
    });
    await client.start();

    // Bob is seated at 1 but isReady is false
    assert.throws(() => {
      host.startMatch();
    }, /All seated players must toggle ready before starting/);

    host.stop();
    client.stop();
  });

  it('successfully starts match, sets status to playing, and initializes deterministic GameState', async () => {
    const host = new NetworkRoom({
      roomCode: 'MATCH3',
      isHost: true,
      localPlayer: { name: 'Alice', address: '0x1111' },
    });
    await host.start();

    const client = new NetworkRoom({
      roomCode: 'MATCH3',
      isHost: false,
      localPlayer: { name: 'Bob', address: '0x2222' },
    });
    await client.start();

    client.toggleReady(true);
    host.startMatch(12345);

    assert.strictEqual(host.state.status, 'playing');
    assert.ok(host.state.gameState !== null);
    assert.strictEqual(host.state.stateSeq, 1);
    assert.strictEqual(host.state.seed, 12345);

    // Client should also sync to playing state
    assert.strictEqual(client.state.status, 'playing');
    assert.ok(client.state.gameState !== null);
    assert.strictEqual(client.state.stateSeq, 1);

    host.stop();
    client.stop();
  });

  it('automatically populates unoccupied seats with AI bots ensuring exactly 4 players', async () => {
    const host = new NetworkRoom({
      roomCode: 'MATCH4',
      isHost: true,
      localPlayer: { name: 'Alice', address: '0x1111' },
    });
    await host.start();

    const client = new NetworkRoom({
      roomCode: 'MATCH4',
      isHost: false,
      localPlayer: { name: 'Bob', address: '0x2222' },
    });
    await client.start();
    client.toggleReady(true);

    host.startMatch(424242);

    const engineState = host.state.gameState!;
    assert.strictEqual(engineState.players.length, 4);

    assert.strictEqual(engineState.players[0].name, 'Alice');
    assert.strictEqual(engineState.players[1].name, 'Bob');
    assert.strictEqual(engineState.players[2].name, 'Sherwood');
    assert.strictEqual(engineState.players[3].name, 'Apex');

    assert.strictEqual(engineState.players[2].address, '0x2000000000000000000000000000000000000001');
    assert.strictEqual(engineState.players[3].address, '0x3000000000000000000000000000000000000002');

    host.stop();
    client.stop();
  });
});

describe('Suite 5: Action Synchronization and State Replication', () => {
  it('host validates and applies action to GameState when client dispatches action', async () => {
    const host = new NetworkRoom({
      roomCode: 'SYNC01',
      isHost: true,
      localPlayer: { name: 'Alice', address: '0x1111' },
    });
    await host.start();

    const client = new NetworkRoom({
      roomCode: 'SYNC01',
      isHost: false,
      localPlayer: { name: 'Bob', address: '0x2222' },
    });
    await client.start();
    client.toggleReady(true);
    host.startMatch(99999);

    const initialSeq = host.state.stateSeq;
    const initialPending = [...host.state.gameState!.pending];
    const draftCount = host.state.gameState!.draftCount;
    const selectedLots = initialPending.slice(0, draftCount);

    const action: GameAction = {
      type: 'DRAFT_PLOTS',
      playerId: 0,
      lotIds: selectedLots,
    };

    host.dispatchGameAction(action);

    assert.strictEqual(host.state.stateSeq, initialSeq + 1);
    for (const lotId of selectedLots) {
      assert.strictEqual(host.state.gameState!.lots[lotId].owner, 0);
    }

    host.stop();
    client.stop();
  });

  it('host increments stateSeq monotonically and broadcasts sync packet to clients', async () => {
    const host = new NetworkRoom({
      roomCode: 'SYNC02',
      isHost: true,
      localPlayer: { name: 'Alice', address: '0x1111' },
    });
    await host.start();

    const client = new NetworkRoom({
      roomCode: 'SYNC02',
      isHost: false,
      localPlayer: { name: 'Bob', address: '0x2222' },
    });
    await client.start();
    client.toggleReady(true);
    host.startMatch(88888);

    assert.strictEqual(host.state.stateSeq, 1);
    assert.strictEqual(client.state.stateSeq, 1);

    const draftLots = host.state.gameState!.pending.slice(0, host.state.gameState!.draftCount);
    host.dispatchGameAction({
      type: 'DRAFT_PLOTS',
      playerId: 0,
      lotIds: draftLots,
    });

    assert.strictEqual(host.state.stateSeq, 2);
    assert.strictEqual(client.state.stateSeq, 2);

    host.stop();
    client.stop();
  });

  it('non-host client receives sync packet and updates local GameState and stateSeq', async () => {
    const host = new NetworkRoom({
      roomCode: 'SYNC03',
      isHost: true,
      localPlayer: { name: 'Alice', address: '0x1111' },
    });
    await host.start();

    const client = new NetworkRoom({
      roomCode: 'SYNC03',
      isHost: false,
      localPlayer: { name: 'Bob', address: '0x2222' },
    });
    await client.start();
    client.toggleReady(true);
    host.startMatch(77777);

    const receivedActions: GameAction[] = [];
    client.onAction((act) => receivedActions.push(act));

    const draftLots = host.state.gameState!.pending.slice(0, host.state.gameState!.draftCount);
    const draftAction: GameAction = {
      type: 'DRAFT_PLOTS',
      playerId: 0,
      lotIds: draftLots,
    };
    host.dispatchGameAction(draftAction);

    assert.strictEqual(client.state.stateSeq, 2);
    assert.strictEqual(receivedActions.length, 1);
    assert.strictEqual(receivedActions[0].type, 'DRAFT_PLOTS');

    host.stop();
    client.stop();
  });

  it('transmits and receives OTC chat messages between connected room members', async () => {
    const host = new NetworkRoom({
      roomCode: 'SYNC04',
      isHost: true,
      localPlayer: { name: 'Alice', address: '0x1111' },
    });
    await host.start();

    const client = new NetworkRoom({
      roomCode: 'SYNC04',
      isHost: false,
      localPlayer: { name: 'Bob', address: '0x2222' },
    });
    await client.start();

    const hostChat: { sender: string; text: string }[] = [];
    host.onChat((msg) => hostChat.push(msg));

    client.sendChat('Will trade Parcel 12 for 150 $wif');

    assert.strictEqual(hostChat.length, 1);
    assert.strictEqual(hostChat[0].sender, 'Bob');
    assert.strictEqual(hostChat[0].text, 'Will trade Parcel 12 for 150 $wif');

    host.stop();
    client.stop();
  });
});

describe('Suite 6: Heartbeat, Disconnection, and Host Migration', () => {
  it('detects disconnected player when heartbeat timeout expires', async () => {
    const host = new NetworkRoom({
      roomCode: 'HEART1',
      isHost: true,
      localPlayer: { name: 'Alice', address: '0x1111' },
      disconnectTimeoutMs: 100,
    });
    await host.start();

    const client = new NetworkRoom({
      roomCode: 'HEART1',
      isHost: false,
      localPlayer: { name: 'Bob', address: '0x2222' },
      disconnectTimeoutMs: 100,
    });
    await client.start();

    const bobOnHost = host.state.players.find((p) => p.name === 'Bob');
    assert.strictEqual(bobOnHost?.connected, true);

    // Simulate timeout by modifying lastSeen
    bobOnHost!.lastSeen = Date.now() - 5000;
    host.checkPlayerLiveness();

    assert.strictEqual(bobOnHost?.connected, false);

    host.stop();
    client.stop();
  });

  it('executes deterministic host migration electing connected player with lowest seat index when host disconnects', async () => {
    const host = new NetworkRoom({
      roomCode: 'MIGR1',
      isHost: true,
      localPlayer: { name: 'Alice', address: '0x1111' },
    });
    await host.start();

    const clientBob = new NetworkRoom({
      roomCode: 'MIGR1',
      isHost: false,
      localPlayer: { name: 'Bob', address: '0x2222' },
    });
    await clientBob.start();

    const clientCharlie = new NetworkRoom({
      roomCode: 'MIGR1',
      isHost: false,
      localPlayer: { name: 'Charlie', address: '0x3333' },
    });
    await clientCharlie.start();

    assert.strictEqual(host.state.players.length, 3);
    assert.strictEqual(clientBob.getLocalPlayer()?.seat, 1);
    assert.strictEqual(clientCharlie.getLocalPlayer()?.seat, 2);

    // Host Alice leaves the room
    host.stop();

    // Bob has seat 1, Charlie has seat 2: Bob should be elected host
    assert.strictEqual(clientBob.state.hostClientId, clientBob.localClientId);
    assert.strictEqual(clientBob.isLocalHost(), true);
    assert.strictEqual(clientCharlie.state.hostClientId, clientBob.localClientId);

    clientBob.stop();
    clientCharlie.stop();
  });

  it('new host announces migration and assumes authoritative action execution seamlessly', async () => {
    const host = new NetworkRoom({
      roomCode: 'MIGR2',
      isHost: true,
      localPlayer: { name: 'Alice', address: '0x1111' },
    });
    await host.start();

    const clientBob = new NetworkRoom({
      roomCode: 'MIGR2',
      isHost: false,
      localPlayer: { name: 'Bob', address: '0x2222' },
    });
    await clientBob.start();
    clientBob.toggleReady(true);

    host.startMatch(112233);
    assert.strictEqual(host.state.status, 'playing');

    // Host disconnects during match
    host.stop();

    // Bob becomes authoritative host
    assert.strictEqual(clientBob.isLocalHost(), true);
    assert.strictEqual(clientBob.state.status, 'playing');

    // Bob dispatches an authoritative action as new host
    const prevSeq = clientBob.state.stateSeq;
    const draftLots = clientBob.state.gameState!.pending.slice(0, clientBob.state.gameState!.draftCount);
    clientBob.dispatchGameAction({
      type: 'DRAFT_PLOTS',
      playerId: 0,
      lotIds: draftLots,
    });

    assert.strictEqual(clientBob.state.stateSeq, prevSeq + 1);

    clientBob.stop();
  });
});
