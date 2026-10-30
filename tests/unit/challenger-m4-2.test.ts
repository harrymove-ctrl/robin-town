/**
 * tests/unit/challenger-m4-2.test.ts
 *
 * Empirical Adversarial Test Harness for Milestone 4 Networking (src/network/room.ts).
 * Tests:
 * 1. Multi-Client Concurrent Joining and Seat Invariants
 * 2. Cascading Host Migration (4-tier succession, abrupt crash failover, and unauthorized announce vulnerability)
 * 3. Sequence Number Desync, Out-of-Order Packets, and Unhandled Action Errors
 * 4. Heartbeat Timeouts, Stalled Clients, and Reconnection Seat Collision Bug
 * 5. High-Throughput Chat Flooding and Transport Stress
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import * as assert from 'node:assert';
import {
  NetworkRoom,
  MemoryTransport,
  MemoryTransportHub,
  generateRoomCode,
  type NetworkPacket,
  type RoomState,
} from '../../src/network/room';
import type { GameAction } from '../../src/engine/types';

beforeEach(() => {
  MemoryTransportHub.clearAll();
});

afterEach(() => {
  MemoryTransportHub.clearAll();
});

describe('Adversarial Harness 1: Multi-Client Concurrent Joining and Seat Invariants', () => {
  it('handles 4 clients joining concurrently and ensures unique seat assignments', async () => {
    const code = generateRoomCode();
    const host = new NetworkRoom({
      roomCode: code,
      isHost: true,
      localPlayer: { name: 'Alice', address: '0x1001' },
    });
    await host.start();

    const clientB = new NetworkRoom({
      roomCode: code,
      isHost: false,
      localPlayer: { name: 'Bob', address: '0x1002' },
    });
    const clientC = new NetworkRoom({
      roomCode: code,
      isHost: false,
      localPlayer: { name: 'Charlie', address: '0x1003' },
    });
    const clientD = new NetworkRoom({
      roomCode: code,
      isHost: false,
      localPlayer: { name: 'Dave', address: '0x1004' },
    });

    await Promise.all([clientB.start(), clientC.start(), clientD.start()]);

    const seatedPlayers = host.state.players.filter((p) => p.seat !== null && p.connected);
    assert.strictEqual(seatedPlayers.length, 4, 'All 4 players must be seated');

    const seats = seatedPlayers.map((p) => p.seat);
    const uniqueSeats = new Set(seats);
    assert.strictEqual(uniqueSeats.size, 4, 'Each seated player must occupy a unique seat index');
    assert.deepStrictEqual(seats.sort(), [0, 1, 2, 3]);

    host.stop();
    clientB.stop();
    clientC.stop();
    clientD.stop();
  });

  it('overflows 5th client into spectator status with null seat when lobby is full', async () => {
    const code = generateRoomCode();
    const host = new NetworkRoom({
      roomCode: code,
      isHost: true,
      localPlayer: { name: 'Alice', address: '0x1001' },
    });
    await host.start();

    const clients: NetworkRoom[] = [];
    for (let i = 0; i < 4; i++) {
      const client = new NetworkRoom({
        roomCode: code,
        isHost: false,
        localPlayer: { name: `Guest_${i}`, address: `0x200${i}` },
      });
      await client.start();
      clients.push(client);
    }

    assert.strictEqual(host.state.players.length, 5);
    const seated = host.state.players.filter((p) => p.seat !== null && p.connected);
    assert.strictEqual(seated.length, 4, 'Maximum 4 players can hold seats');

    const spectator = host.state.players.find((p) => p.name === 'Guest_3');
    assert.ok(spectator, '5th player exists in room');
    assert.strictEqual(spectator?.seat, null, '5th player must be assigned null seat');

    host.stop();
    for (const c of clients) c.stop();
  });

  it('rejects assigning an occupied seat when client calls setSeat directly', async () => {
    const code = generateRoomCode();
    const host = new NetworkRoom({
      roomCode: code,
      isHost: true,
      localPlayer: { name: 'Alice', address: '0x1001' },
    });
    await host.start();

    const clientB = new NetworkRoom({
      roomCode: code,
      isHost: false,
      localPlayer: { name: 'Bob', address: '0x1002' },
    });
    await clientB.start();

    assert.throws(() => {
      clientB.setSeat(0);
    }, /Seat 0 is already occupied by Alice/);

    host.stop();
    clientB.stop();
  });

  it('verifies host broadcasts ROOM_STATE_SYNC on invalid SEAT_ASSIGN_REQUEST reconciling client state', async () => {
    const code = generateRoomCode();
    const host = new NetworkRoom({
      roomCode: code,
      isHost: true,
      localPlayer: { name: 'Alice', address: '0x1001' },
    });
    await host.start();

    const clientB = new NetworkRoom({
      roomCode: code,
      isHost: false,
      localPlayer: { name: 'Bob', address: '0x1002' },
    });
    await clientB.start();

    // Bob holds seat 1 on host and client
    assert.strictEqual(clientB.getLocalPlayer()?.seat, 1);
    assert.strictEqual(host.state.players.find((p) => p.name === 'Bob')?.seat, 1);

    // Inject an invalid SEAT_ASSIGN_REQUEST packet for seat 0 (Alice's seat)
    // Directly sending the packet bypasses local throw in setSeat()
    const seatPacket: NetworkPacket = {
      id: 'pkt_seat_clash',
      roomCode: code,
      senderId: clientB.localClientId,
      sequenceNumber: 99,
      timestamp: Date.now(),
      type: 'SEAT_ASSIGN_REQUEST',
      payload: { targetSeat: 0 },
    };

    clientB.transport.send(seatPacket);

    // Host rejects request and broadcasts authoritative room state
    const bobOnHost = host.state.players.find((p) => p.name === 'Bob');
    assert.strictEqual(bobOnHost?.seat, 1, 'Host keeps Bob at seat 1');
    assert.strictEqual(
      clientB.getLocalPlayer()?.seat,
      1,
      'Client reconciles to seat 1 via broadcasted room state sync'
    );

    host.stop();
    clientB.stop();
  });
});

describe('Adversarial Harness 2: Cascading Host Migration', () => {
  it('executes 4-tier cascading host migration under sequential disconnects', async () => {
    const code = generateRoomCode();
    const hostAlice = new NetworkRoom({
      roomCode: code,
      isHost: true,
      localPlayer: { name: 'Alice', address: '0x1001' },
    });
    await hostAlice.start();

    const clientBob = new NetworkRoom({
      roomCode: code,
      isHost: false,
      localPlayer: { name: 'Bob', address: '0x1002' },
    });
    await clientBob.start();

    const clientCharlie = new NetworkRoom({
      roomCode: code,
      isHost: false,
      localPlayer: { name: 'Charlie', address: '0x1003' },
    });
    await clientCharlie.start();

    const clientDave = new NetworkRoom({
      roomCode: code,
      isHost: false,
      localPlayer: { name: 'Dave', address: '0x1004' },
    });
    await clientDave.start();

    clientBob.toggleReady(true);
    clientCharlie.toggleReady(true);
    clientDave.toggleReady(true);
    hostAlice.startMatch(777);

    assert.strictEqual(hostAlice.state.status, 'playing');
    assert.strictEqual(clientBob.state.status, 'playing');
    assert.strictEqual(clientCharlie.state.status, 'playing');
    assert.strictEqual(clientDave.state.status, 'playing');

    // Tier 1 Failover: Alice disconnects -> Bob (seat 1) assumes host
    hostAlice.stop();
    assert.strictEqual(clientBob.isLocalHost(), true, 'Bob must assume host role');
    assert.strictEqual(clientBob.state.hostClientId, clientBob.localClientId);
    assert.strictEqual(clientCharlie.state.hostClientId, clientBob.localClientId);
    assert.strictEqual(clientDave.state.hostClientId, clientBob.localClientId);

    // Bob dispatches an authoritative action
    const draftCount = clientBob.state.gameState!.draftCount;
    const pendingLots = clientBob.state.gameState!.pending.slice(0, draftCount);
    clientBob.dispatchGameAction({
      type: 'DRAFT_PLOTS',
      playerId: 1,
      lotIds: pendingLots,
    });
    assert.strictEqual(clientBob.state.stateSeq, 2);
    assert.strictEqual(clientCharlie.state.stateSeq, 2);
    assert.strictEqual(clientDave.state.stateSeq, 2);

    // Tier 2 Failover: Bob disconnects -> Charlie (seat 2) assumes host
    clientBob.stop();
    assert.strictEqual(clientCharlie.isLocalHost(), true, 'Charlie must assume host role');
    assert.strictEqual(clientCharlie.state.hostClientId, clientCharlie.localClientId);
    assert.strictEqual(clientDave.state.hostClientId, clientCharlie.localClientId);

    // Charlie dispatches another action as authoritative host
    clientCharlie.dispatchGameAction({
      type: 'BEGIN_BUILD',
    });
    assert.strictEqual(clientCharlie.state.stateSeq, 3);
    assert.strictEqual(clientDave.state.stateSeq, 3);

    // Tier 3 Failover: Charlie disconnects -> Dave (seat 3) assumes host
    clientCharlie.stop();
    assert.strictEqual(clientDave.isLocalHost(), true, 'Dave must assume host role');
    assert.strictEqual(clientDave.state.hostClientId, clientDave.localClientId);

    clientDave.stop();
  });

  it('recovers authority via liveness timer when host drops abruptly without ROOM_LEAVE', async () => {
    const code = generateRoomCode();
    const host = new NetworkRoom({
      roomCode: code,
      isHost: true,
      localPlayer: { name: 'Alice', address: '0x1001' },
      disconnectTimeoutMs: 100,
    });
    await host.start();

    const clientBob = new NetworkRoom({
      roomCode: code,
      isHost: false,
      localPlayer: { name: 'Bob', address: '0x1002' },
      disconnectTimeoutMs: 100,
    });
    await clientBob.start();

    const clientCharlie = new NetworkRoom({
      roomCode: code,
      isHost: false,
      localPlayer: { name: 'Charlie', address: '0x1003' },
      disconnectTimeoutMs: 100,
    });
    await clientCharlie.start();

    // Abrupt crash: host transport disconnected directly without sending ROOM_LEAVE
    host.transport.disconnect();

    const aliceOnBob = clientBob.state.players.find((p) => p.clientId === host.localClientId);
    assert.ok(aliceOnBob);
    aliceOnBob.lastSeen = Date.now() - 5000;

    const aliceOnCharlie = clientCharlie.state.players.find((p) => p.clientId === host.localClientId);
    assert.ok(aliceOnCharlie);
    aliceOnCharlie.lastSeen = Date.now() - 5000;

    clientBob.checkPlayerLiveness();
    clientCharlie.checkPlayerLiveness();

    assert.strictEqual(clientBob.isLocalHost(), true, 'Bob must be elected new host');
    assert.strictEqual(clientBob.state.hostClientId, clientBob.localClientId);
    assert.strictEqual(clientCharlie.state.hostClientId, clientBob.localClientId);

    clientBob.stop();
    clientCharlie.stop();
  });

  it('verifies active host rejects unauthorized HOST_MIGRATION_ANNOUNCE from peer', async () => {
    const code = generateRoomCode();
    const host = new NetworkRoom({
      roomCode: code,
      isHost: true,
      localPlayer: { name: 'Alice', address: '0x1001' },
    });
    await host.start();

    const clientBob = new NetworkRoom({
      roomCode: code,
      isHost: false,
      localPlayer: { name: 'Bob', address: '0x1002' },
    });
    await clientBob.start();

    assert.strictEqual(host.isLocalHost(), true);
    assert.strictEqual(clientBob.isLocalHost(), false);

    // Rogue client Bob broadcasts HOST_MIGRATION_ANNOUNCE claiming itself as host
    const hijackPacket: NetworkPacket = {
      id: 'hijack_1',
      roomCode: code,
      senderId: clientBob.localClientId,
      sequenceNumber: 1,
      timestamp: Date.now(),
      type: 'HOST_MIGRATION_ANNOUNCE',
      payload: {
        newHostClientId: clientBob.localClientId,
        reason: 'Host hijacked',
        stateSeq: 1,
      },
    };

    clientBob.transport.send(hijackPacket);

    // Observe whether active host Alice accepts the announcement and demotes herself
    const aliceAcceptedHijack = !host.isLocalHost() && host.state.hostClientId === clientBob.localClientId;

    host.stop();
    clientBob.stop();

    // In a secure architecture, active host rejects unauthorized demotion
    assert.strictEqual(
      aliceAcceptedHijack,
      false,
      'Active host rejects unauthorized HOST_MIGRATION_ANNOUNCE and preserves host authority'
    );
    assert.strictEqual(host.isLocalHost(), true);
    assert.strictEqual(host.state.hostClientId, host.localClientId);
  });
});

describe('Adversarial Harness 3: Sequence Desync and Authoritative Validation', () => {
  it('ignores stale GAME_STATE_SYNC packets with smaller stateSeq numbers', async () => {
    const code = generateRoomCode();
    const host = new NetworkRoom({
      roomCode: code,
      isHost: true,
      localPlayer: { name: 'Alice', address: '0x1001' },
    });
    await host.start();

    const client = new NetworkRoom({
      roomCode: code,
      isHost: false,
      localPlayer: { name: 'Bob', address: '0x1002' },
    });
    await client.start();
    client.toggleReady(true);
    host.startMatch(12345);

    assert.strictEqual(client.state.stateSeq, 1);

    const draftLots = host.state.gameState!.pending.slice(0, host.state.gameState!.draftCount);
    host.dispatchGameAction({
      type: 'DRAFT_PLOTS',
      playerId: 0,
      lotIds: draftLots,
    });
    assert.strictEqual(client.state.stateSeq, 2);

    const obsoletePacket: NetworkPacket = {
      id: 'stale_pkt_1',
      roomCode: code,
      senderId: host.localClientId,
      sequenceNumber: 999,
      timestamp: Date.now(),
      type: 'GAME_STATE_SYNC',
      payload: {
        stateSeq: 1,
        gameState: { ...host.state.gameState!, year: 99 } as any,
      },
    };

    client.transport.send(obsoletePacket);

    assert.strictEqual(client.state.stateSeq, 2);
    assert.strictEqual(client.state.gameState!.year, 1);

    host.stop();
    client.stop();
  });

  it('catches engine exceptions and keeps host message loop running', async () => {
    const code = generateRoomCode();
    const host = new NetworkRoom({
      roomCode: code,
      isHost: true,
      localPlayer: { name: 'Alice', address: '0x1001' },
    });
    await host.start();

    const client = new NetworkRoom({
      roomCode: code,
      isHost: false,
      localPlayer: { name: 'Bob', address: '0x1002' },
    });
    await client.start();
    client.toggleReady(true);
    host.startMatch(999);

    const malformedPacket: NetworkPacket = {
      id: 'malformed_act_1',
      roomCode: code,
      senderId: client.localClientId,
      sequenceNumber: 10,
      timestamp: Date.now(),
      type: 'GAME_ACTION',
      payload: {
        action: {
          type: 'DRAFT_PLOTS',
          playerId: 1,
          lotIds: [9999, -1],
        },
        expectedStateSeq: host.state.stateSeq,
      },
    };

    let uncaughtError: Error | null = null;
    try {
      client.transport.send(malformedPacket);
    } catch (err: any) {
      uncaughtError = err;
    }

    assert.strictEqual(uncaughtError, null, 'Host must catch action error and keep loop intact');
    assert.strictEqual(host.state.stateSeq, 1, 'Rejected action must not increment stateSeq');

    const validDraftLots = host.state.gameState!.pending.slice(0, host.state.gameState!.draftCount);
    host.dispatchGameAction({
      type: 'DRAFT_PLOTS',
      playerId: 0,
      lotIds: validDraftLots,
    });
    assert.strictEqual(host.state.stateSeq, 2, 'Host processes subsequent valid actions normally');

    host.stop();
    client.stop();
  });

  it('verifies host rejects unauthorized MATCH_STARTED injection by non-host client', async () => {
    const code = generateRoomCode();
    const host = new NetworkRoom({
      roomCode: code,
      isHost: true,
      localPlayer: { name: 'Alice', address: '0x1001' },
    });
    await host.start();

    const clientBob = new NetworkRoom({
      roomCode: code,
      isHost: false,
      localPlayer: { name: 'Bob', address: '0x1002' },
    });
    await clientBob.start();

    assert.strictEqual(host.state.status, 'lobby');
    assert.strictEqual(clientBob.state.status, 'lobby');

    // Bob injects MATCH_STARTED packet without host authorization
    const fakeMatchStartPacket: NetworkPacket = {
      id: 'fake_start_1',
      roomCode: code,
      senderId: clientBob.localClientId,
      sequenceNumber: 1,
      timestamp: Date.now(),
      type: 'MATCH_STARTED',
      payload: {
        initialState: { version: 1, year: 5 } as any,
        seed: 9999,
        stateSeq: 100,
      },
    };

    clientBob.transport.send(fakeMatchStartPacket);

    // Check that host and client ignore unauthorized state transition
    const currentHostStatus: string = host.state.status;
    const hostForced = currentHostStatus === 'playing' && host.state.seed === 9999;

    host.stop();
    clientBob.stop();

    assert.strictEqual(
      hostForced,
      false,
      'Host must reject MATCH_STARTED from non-host peer and remain in lobby'
    );
    assert.strictEqual(currentHostStatus, 'lobby');
  });

  it('rejects action when sender tries to act on behalf of another seat', async () => {
    const code = generateRoomCode();
    const host = new NetworkRoom({
      roomCode: code,
      isHost: true,
      localPlayer: { name: 'Alice', address: '0x1001' },
    });
    await host.start();

    const clientBob = new NetworkRoom({
      roomCode: code,
      isHost: false,
      localPlayer: { name: 'Bob', address: '0x1002' },
    });
    await clientBob.start();
    clientBob.toggleReady(true);
    host.startMatch(12345);

    assert.strictEqual(host.state.stateSeq, 1);

    const forgedActionPacket: NetworkPacket = {
      id: 'forged_act_1',
      roomCode: code,
      senderId: clientBob.localClientId,
      sequenceNumber: 5,
      timestamp: Date.now(),
      type: 'GAME_ACTION',
      payload: {
        action: {
          type: 'DRAFT_PLOTS',
          playerId: 0,
          lotIds: host.state.gameState!.pending.slice(0, host.state.gameState!.draftCount),
        },
        expectedStateSeq: 1,
      },
    };

    clientBob.transport.send(forgedActionPacket);
    assert.strictEqual(host.state.stateSeq, 1, 'Forged cross-seat action must be rejected');

    host.stop();
    clientBob.stop();
  });

  it('rejects global lifecycle actions dispatched by non-host senders', async () => {
    const code = generateRoomCode();
    const host = new NetworkRoom({
      roomCode: code,
      isHost: true,
      localPlayer: { name: 'Alice', address: '0x1001' },
    });
    await host.start();

    const clientBob = new NetworkRoom({
      roomCode: code,
      isHost: false,
      localPlayer: { name: 'Bob', address: '0x1002' },
    });
    await clientBob.start();
    clientBob.toggleReady(true);
    host.startMatch(12345);

    assert.strictEqual(host.state.stateSeq, 1);

    const unauthorizedLifecyclePacket: NetworkPacket = {
      id: 'unauth_lifecycle_1',
      roomCode: code,
      senderId: clientBob.localClientId,
      sequenceNumber: 6,
      timestamp: Date.now(),
      type: 'GAME_ACTION',
      payload: {
        action: {
          type: 'BEGIN_BUILD',
        },
        expectedStateSeq: 1,
      },
    };

    clientBob.transport.send(unauthorizedLifecyclePacket);
    assert.strictEqual(host.state.stateSeq, 1, 'Unauthorized lifecycle action must be rejected');

    host.stop();
    clientBob.stop();
  });

  it('ignores duplicate GAME_STATE_SYNC packets with identical stateSeq number', async () => {
    const code = generateRoomCode();
    const host = new NetworkRoom({
      roomCode: code,
      isHost: true,
      localPlayer: { name: 'Alice', address: '0x1001' },
    });
    await host.start();

    const client = new NetworkRoom({
      roomCode: code,
      isHost: false,
      localPlayer: { name: 'Bob', address: '0x1002' },
    });
    await client.start();
    client.toggleReady(true);
    host.startMatch(12345);

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

    const duplicatePacket: NetworkPacket = {
      id: 'dup_pkt_2',
      roomCode: code,
      senderId: host.localClientId,
      sequenceNumber: 999,
      timestamp: Date.now(),
      type: 'GAME_STATE_SYNC',
      payload: {
        stateSeq: 2,
        gameState: host.state.gameState!,
        lastAction: draftAction,
      },
    };

    client.transport.send(duplicatePacket);
    assert.strictEqual(client.state.stateSeq, 2);
    assert.strictEqual(receivedActions.length, 1, 'Duplicate packet must not re-trigger action listeners');

    host.stop();
    client.stop();
  });
});

describe('Adversarial Harness 4: Heartbeat Timeouts and Reconnection Invariants', () => {
  it('marks silent clients disconnected without deadlocking room state', async () => {
    const code = generateRoomCode();
    const host = new NetworkRoom({
      roomCode: code,
      isHost: true,
      localPlayer: { name: 'Alice', address: '0x1001' },
      disconnectTimeoutMs: 200,
    });
    await host.start();

    const client = new NetworkRoom({
      roomCode: code,
      isHost: false,
      localPlayer: { name: 'Bob', address: '0x1002' },
      disconnectTimeoutMs: 200,
    });
    await client.start();

    const bobOnHost = host.state.players.find((p) => p.clientId === client.localClientId);
    assert.strictEqual(bobOnHost?.connected, true);

    bobOnHost!.lastSeen = Date.now() - 500;
    host.checkPlayerLiveness();

    assert.strictEqual(bobOnHost?.connected, false);

    host.startMatch(333);
    assert.strictEqual(host.state.status, 'playing');
    assert.strictEqual(host.state.gameState!.players.length, 4);

    host.stop();
    client.stop();
  });

  it('verifies remediation: timed out client reconnecting preserves seat exclusivity without collision', async () => {
    const code = generateRoomCode();
    const host = new NetworkRoom({
      roomCode: code,
      isHost: true,
      localPlayer: { name: 'Alice', address: '0x1001' },
      disconnectTimeoutMs: 200,
    });
    await host.start();

    const clientBob = new NetworkRoom({
      roomCode: code,
      isHost: false,
      localPlayer: { name: 'Bob', address: '0x1002' },
      disconnectTimeoutMs: 200,
    });
    await clientBob.start();

    assert.strictEqual(clientBob.getLocalPlayer()?.seat, 1);

    // Bob times out
    const bobOnHost = host.state.players.find((p) => p.clientId === clientBob.localClientId);
    assert.ok(bobOnHost);
    bobOnHost.lastSeen = Date.now() - 500;
    host.checkPlayerLiveness();
    assert.strictEqual(bobOnHost.connected, false);

    // Charlie joins and receives vacant seat 1
    const clientCharlie = new NetworkRoom({
      roomCode: code,
      isHost: false,
      localPlayer: { name: 'Charlie', address: '0x1003' },
      disconnectTimeoutMs: 200,
    });
    await clientCharlie.start();
    const charlieOnHost = host.state.players.find((p) => p.clientId === clientCharlie.localClientId);
    assert.strictEqual(charlieOnHost?.seat, 1, 'Charlie is assigned vacant seat 1');

    // Bob reconnects and sends a chat message
    clientBob.sendChat('Reconnecting...');

    // In handleIncomingPacket, Bob reconnects as spectator without colliding on Charlie's seat
    assert.strictEqual(bobOnHost.connected, true);
    assert.strictEqual(charlieOnHost?.connected, true);
    assert.strictEqual(charlieOnHost?.seat, 1, 'Charlie retains seat 1');
    assert.strictEqual(bobOnHost.seat, null, 'Bob reconnects as spectator without colliding on seat 1');

    // Seat exclusivity maintained: exactly one connected player occupies seat 1
    const activeSeat1Players = host.state.players.filter((p) => p.seat === 1 && p.connected);
    assert.strictEqual(
      activeSeat1Players.length,
      1,
      'Seat exclusivity maintained: exactly one connected player occupies seat 1'
    );

    host.stop();
    clientBob.stop();
    clientCharlie.stop();
  });
});

describe('Adversarial Harness 5: High Message Throughput and Flooding', () => {
  it('sustains 1,000 rapid chat messages without dropped packets or memory corruption', async () => {
    const code = generateRoomCode();
    const host = new NetworkRoom({
      roomCode: code,
      isHost: true,
      localPlayer: { name: 'Alice', address: '0x1001' },
    });
    await host.start();

    const client = new NetworkRoom({
      roomCode: code,
      isHost: false,
      localPlayer: { name: 'Bob', address: '0x1002' },
    });
    await client.start();

    const receivedAtHost: string[] = [];
    host.onChat((msg) => receivedAtHost.push(msg.text));

    const totalMessages = 1000;
    for (let i = 0; i < totalMessages; i++) {
      client.sendChat(`Flooding test message #${i}`);
    }

    assert.strictEqual(receivedAtHost.length, totalMessages);
    assert.strictEqual(receivedAtHost[0], 'Flooding test message #0');
    assert.strictEqual(receivedAtHost[totalMessages - 1], `Flooding test message #${totalMessages - 1}`);

    host.stop();
    client.stop();
  });

  it('sustains rapid concurrent action execution between host and clients without state divergence', async () => {
    const code = generateRoomCode();
    const host = new NetworkRoom({
      roomCode: code,
      isHost: true,
      localPlayer: { name: 'Alice', address: '0x1001' },
    });
    await host.start();

    const client = new NetworkRoom({
      roomCode: code,
      isHost: false,
      localPlayer: { name: 'Bob', address: '0x1002' },
    });
    await client.start();
    client.toggleReady(true);
    host.startMatch(5555);

    let clientObservedSeq = client.state.stateSeq;
    client.onStateChange((s) => {
      clientObservedSeq = s.stateSeq;
    });

    const draftLots = host.state.gameState!.pending.slice(0, host.state.gameState!.draftCount);
    host.dispatchGameAction({
      type: 'DRAFT_PLOTS',
      playerId: 0,
      lotIds: draftLots,
    });

    host.dispatchGameAction({
      type: 'BEGIN_BUILD',
    });

    assert.strictEqual(host.state.stateSeq, 3);
    assert.strictEqual(client.state.stateSeq, 3);
    assert.strictEqual(clientObservedSeq, 3);
    assert.strictEqual(host.state.gameState!.phase, client.state.gameState!.phase);

    host.stop();
    client.stop();
  });
});
