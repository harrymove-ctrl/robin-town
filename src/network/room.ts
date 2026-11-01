/**
 * src/network/room.ts
 *
 * Multiplayer Room and Networking Layer for robin-town.
 * Supports:
 * 1. Room lifecycle: code generation, joining, seat assignment, ready toggles, match start.
 * 2. Deterministic AI bot autofill for vacant seats (seats 0..3).
 * 3. Authoritative host pattern with automatic failover and host migration.
 * 4. Dual-transport abstraction: BroadcastChannelTransport (cross-tab) and MemoryTransport (headless testing).
 * 5. Monotonic sequence tracking, state synchronization diffs, and OTC chat.
 */

import type { GameAction, GameState, Player, TradeEvaluation, TradeOffer, RandomSource } from '../engine/types';
import {
  createGame,
  draftPlots,
  beginBuild,
  buildTile,
  executeTrade,
  collectIncome,
  nextYear,
  startYear,
} from '../engine/engine';

export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRoomCode(): string {
  let result = '';
  for (let i = 0; i < 6; i++) {
    const index = Math.floor(Math.random() * ROOM_CODE_ALPHABET.length);
    result += ROOM_CODE_ALPHABET.charAt(index);
  }
  return result;
}

export function isValidRoomCode(code: string): boolean {
  if (typeof code !== 'string') return false;
  const trimmed = code.trim().toUpperCase();
  return /^[A-Z0-9]{6}$/.test(trimmed);
}

export function normalizeRoomCode(code: string): string {
  return code.trim().toUpperCase();
}

function createSeededRng(seed: number): RandomSource {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

export type TransportStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
export type RoomStatus = 'lobby' | 'starting' | 'playing' | 'completed' | 'closed';

export interface RoomPlayer {
  clientId: string;
  name: string;
  address: string;
  avatar: string;
  seat: number | null; // 0..maxPlayers-1 or null if spectator
  isHost: boolean;
  isReady: boolean;
  connected: boolean;
  lastSeen: number;
}

export interface RoomState {
  code: string;
  status: RoomStatus;
  hostClientId: string;
  players: RoomPlayer[];
  maxPlayers: number; // 3 to 6 players, default 4
  gameState: GameState | null;
  stateSeq: number;
  seed: number;
  createdAt: number;
  updatedAt: number;
}

export interface TransportMessageListener {
  (packet: NetworkPacket): void;
}

export interface TransportStatusListener {
  (status: TransportStatus): void;
}

export interface NetworkTransport {
  readonly status: TransportStatus;
  readonly channelId: string;
  readonly localClientId: string;

  connect(): Promise<void>;
  disconnect(): void;
  send(packet: NetworkPacket): void;
  broadcast(packet: NetworkPacket): void;
  onMessage(listener: TransportMessageListener): () => void;
  onStatusChange(listener: TransportStatusListener): () => void;
}

export type PacketType =
  | 'ROOM_JOIN_REQUEST'
  | 'ROOM_JOIN_RESPONSE'
  | 'ROOM_STATE_SYNC'
  | 'ROOM_LEAVE'
  | 'SEAT_ASSIGN_REQUEST'
  | 'READY_TOGGLE'
  | 'START_MATCH_REQUEST'
  | 'MATCH_STARTED'
  | 'GAME_ACTION'
  | 'GAME_STATE_SYNC'
  | 'SYNC_REQUEST'
  | 'CHAT_MESSAGE'
  | 'TRADE_OFFER_BROADCAST'
  | 'TRADE_OFFER_RESPONSE'
  | 'HEARTBEAT'
  | 'HEARTBEAT_ACK'
  | 'HOST_MIGRATION_ANNOUNCE';

export interface BasePacket<T extends PacketType, P> {
  id: string;
  roomCode: string;
  senderId: string;
  sequenceNumber: number;
  timestamp: number;
  type: T;
  payload: P;
}

export type RoomJoinRequestPacket = BasePacket<'ROOM_JOIN_REQUEST', {
  name: string;
  address: string;
  avatar?: string;
  preferredSeat?: number;
}>;

export type RoomJoinResponsePacket = BasePacket<'ROOM_JOIN_RESPONSE', {
  success: boolean;
  assignedSeat?: number | null;
  roomState?: RoomState;
  error?: string;
}>;

export type RoomStateSyncPacket = BasePacket<'ROOM_STATE_SYNC', {
  roomState: RoomState;
}>;

export type RoomLeavePacket = BasePacket<'ROOM_LEAVE', {
  reason?: string;
}>;

export type SeatAssignRequestPacket = BasePacket<'SEAT_ASSIGN_REQUEST', {
  targetSeat: number;
}>;

export type ReadyTogglePacket = BasePacket<'READY_TOGGLE', {
  isReady: boolean;
}>;

export type StartMatchRequestPacket = BasePacket<'START_MATCH_REQUEST', {
  seed?: number;
}>;

export type MatchStartedPacket = BasePacket<'MATCH_STARTED', {
  initialState: GameState;
  seed: number;
  stateSeq: number;
}>;

export type GameActionPacket = BasePacket<'GAME_ACTION', {
  action: GameAction;
  expectedStateSeq: number;
}>;

export type GameStateSyncPacket = BasePacket<'GAME_STATE_SYNC', {
  stateSeq: number;
  gameState: GameState;
  lastAction?: GameAction;
}>;

export type SyncRequestPacket = BasePacket<'SYNC_REQUEST', {
  lastKnownStateSeq: number;
}>;

export type ChatMessagePacket = BasePacket<'CHAT_MESSAGE', {
  senderName: string;
  text: string;
  targetPlayerId?: number;
}>;

export type TradeOfferBroadcastPacket = BasePacket<'TRADE_OFFER_BROADCAST', {
  offer: TradeOffer;
}>;

export type TradeOfferResponsePacket = BasePacket<'TRADE_OFFER_RESPONSE', {
  offerId?: string;
  accepted: boolean;
  evaluation?: TradeEvaluation;
}>;

export type HeartbeatPacket = BasePacket<'HEARTBEAT', {
  clientTimestamp: number;
}>;

export type HeartbeatAckPacket = BasePacket<'HEARTBEAT_ACK', {
  clientTimestamp: number;
  serverTimestamp: number;
}>;

export type HostMigrationAnnouncePacket = BasePacket<'HOST_MIGRATION_ANNOUNCE', {
  newHostClientId: string;
  reason: string;
  stateSeq: number;
}>;

export type NetworkPacket =
  | RoomJoinRequestPacket
  | RoomJoinResponsePacket
  | RoomStateSyncPacket
  | RoomLeavePacket
  | SeatAssignRequestPacket
  | ReadyTogglePacket
  | StartMatchRequestPacket
  | MatchStartedPacket
  | GameActionPacket
  | GameStateSyncPacket
  | SyncRequestPacket
  | ChatMessagePacket
  | TradeOfferBroadcastPacket
  | TradeOfferResponsePacket
  | HeartbeatPacket
  | HeartbeatAckPacket
  | HostMigrationAnnouncePacket;

export class BroadcastChannelTransport implements NetworkTransport {
  public status: TransportStatus = 'disconnected';
  public readonly channelId: string;
  public readonly localClientId: string;

  private channel: BroadcastChannel | null = null;
  private messageListeners = new Set<TransportMessageListener>();
  private statusListeners = new Set<TransportStatusListener>();

  constructor(roomCode: string, localClientId: string) {
    this.channelId = `robin-town:room:${normalizeRoomCode(roomCode)}`;
    this.localClientId = localClientId;
  }

  public async connect(): Promise<void> {
    if (this.channel) return;
    this.updateStatus('connecting');

    try {
      this.channel = new BroadcastChannel(this.channelId);
      this.channel.onmessage = (event: MessageEvent) => {
        const packet = event.data as NetworkPacket;
        if (packet && packet.roomCode) {
          for (const listener of this.messageListeners) {
            listener(packet);
          }
        }
      };
      this.channel.onmessageerror = () => {
        this.updateStatus('error');
      };
      this.updateStatus('connected');
    } catch {
      this.updateStatus('error');
      throw new Error(`Failed to initialize BroadcastChannel for channel ${this.channelId}`);
    }
  }

  public disconnect(): void {
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
    this.updateStatus('disconnected');
    this.messageListeners.clear();
    this.statusListeners.clear();
  }

  public send(packet: NetworkPacket): void {
    this.broadcast(packet);
  }

  public broadcast(packet: NetworkPacket): void {
    if (!this.channel || this.status !== 'connected') {
      throw new Error('Cannot broadcast message on disconnected transport');
    }
    this.channel.postMessage(packet);
  }

  public onMessage(listener: TransportMessageListener): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  public onStatusChange(listener: TransportStatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => this.statusListeners.delete(listener);
  }

  private updateStatus(newStatus: TransportStatus): void {
    if (this.status === newStatus) return;
    this.status = newStatus;
    for (const listener of this.statusListeners) {
      listener(newStatus);
    }
  }
}

export class MemoryTransportHub {
  private static channels = new Map<string, Set<MemoryTransport>>();

  public static register(transport: MemoryTransport): void {
    let set = MemoryTransportHub.channels.get(transport.channelId);
    if (!set) {
      set = new Set();
      MemoryTransportHub.channels.set(transport.channelId, set);
    }
    set.add(transport);
  }

  public static unregister(transport: MemoryTransport): void {
    const set = MemoryTransportHub.channels.get(transport.channelId);
    if (set) {
      set.delete(transport);
      if (set.size === 0) MemoryTransportHub.channels.delete(transport.channelId);
    }
  }

  public static dispatch(sender: MemoryTransport, packet: NetworkPacket): void {
    const set = MemoryTransportHub.channels.get(sender.channelId);
    if (!set) return;
    for (const target of set) {
      if (target !== sender && target.status === 'connected') {
        target.receiveIncoming(packet);
      }
    }
  }

  public static clearAll(): void {
    MemoryTransportHub.channels.clear();
  }
}

export class MemoryTransport implements NetworkTransport {
  public status: TransportStatus = 'disconnected';
  public readonly channelId: string;
  public readonly localClientId: string;

  private messageListeners = new Set<TransportMessageListener>();
  private statusListeners = new Set<TransportStatusListener>();

  constructor(roomCode: string, localClientId: string) {
    this.channelId = `mem:room:${normalizeRoomCode(roomCode)}`;
    this.localClientId = localClientId;
  }

  public async connect(): Promise<void> {
    this.status = 'connected';
    MemoryTransportHub.register(this);
    for (const listener of this.statusListeners) listener(this.status);
  }

  public disconnect(): void {
    this.status = 'disconnected';
    MemoryTransportHub.unregister(this);
    for (const listener of this.statusListeners) listener(this.status);
    this.messageListeners.clear();
    this.statusListeners.clear();
  }

  public send(packet: NetworkPacket): void {
    this.broadcast(packet);
  }

  public broadcast(packet: NetworkPacket): void {
    if (this.status !== 'connected') throw new Error('Transport not connected');
    MemoryTransportHub.dispatch(this, packet);
  }

  public receiveIncoming(packet: NetworkPacket): void {
    const cloned = JSON.parse(JSON.stringify(packet)) as NetworkPacket;
    for (const listener of this.messageListeners) {
      listener(cloned);
    }
  }

  public onMessage(listener: TransportMessageListener): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  public onStatusChange(listener: TransportStatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => this.statusListeners.delete(listener);
  }
}

export interface WebSocketRelayOptions {
  wsUrl?: string;
  isHost?: boolean;
  autoReconnect?: boolean;
}

/**
 * RFC 6455 Browser WebSocket transport connecting to `/ws?room=CODE&client=ID`
 * for real cross-device multiplayer rooms on Railway and Vite dev servers.
 */
export class WebSocketRelayTransport implements NetworkTransport {
  public status: TransportStatus = 'disconnected';
  public readonly channelId: string;
  public readonly localClientId: string;

  private readonly roomCode: string;
  private readonly wsUrl: string;
  private readonly autoReconnect: boolean;
  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private manuallyClosed = false;
  private outboundQueue: string[] = [];
  private messageListeners = new Set<TransportMessageListener>();
  private statusListeners = new Set<TransportStatusListener>();

  constructor(roomCode: string, localClientId: string, options?: WebSocketRelayOptions) {
    this.roomCode = normalizeRoomCode(roomCode);
    this.channelId = `ws:room:${this.roomCode}`;
    this.localClientId = localClientId;
    this.autoReconnect = options?.autoReconnect ?? true;

    if (options?.wsUrl) {
      const sep = options.wsUrl.includes('?') ? '&' : '?';
      this.wsUrl = `${options.wsUrl}${sep}room=${encodeURIComponent(this.roomCode)}&client=${encodeURIComponent(localClientId)}&host=${options.isHost ? '1' : '0'}`;
    } else if (typeof window !== 'undefined' && window.location?.host) {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      this.wsUrl = `${proto}//${window.location.host}/ws?room=${encodeURIComponent(this.roomCode)}&client=${encodeURIComponent(localClientId)}&host=${options?.isHost ? '1' : '0'}`;
    } else {
      this.wsUrl = `ws://127.0.0.1:8080/ws?room=${encodeURIComponent(this.roomCode)}&client=${encodeURIComponent(localClientId)}&host=${options?.isHost ? '1' : '0'}`;
    }
  }

  public isCloudConnected(): boolean {
    return Boolean(this.socket && this.socket.readyState === WebSocket.OPEN);
  }

  public async connect(): Promise<void> {
    this.manuallyClosed = false;
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }
    if (typeof WebSocket === 'undefined') {
      this.updateStatus('error');
      return;
    }

    this.updateStatus('connecting');
    await new Promise<void>((resolve) => {
      let settled = false;
      const done = () => {
        if (!settled) {
          settled = true;
          resolve();
        }
      };
      const timer = setTimeout(done, 1200);

      try {
        const ws = new WebSocket(this.wsUrl);
        this.socket = ws;

        ws.onopen = () => {
          clearTimeout(timer);
          this.updateStatus('connected');
          while (this.outboundQueue.length > 0 && ws.readyState === WebSocket.OPEN) {
            const msg = this.outboundQueue.shift();
            if (msg) ws.send(msg);
          }
          done();
        };

        ws.onmessage = (ev: MessageEvent) => {
          if (typeof ev.data !== 'string') return;
          try {
            const packet = JSON.parse(ev.data) as NetworkPacket;
            if (packet && packet.roomCode === this.roomCode && packet.senderId !== this.localClientId) {
              for (const listener of this.messageListeners) {
                listener(packet);
              }
            }
          } catch {}
        };

        ws.onerror = () => {
          clearTimeout(timer);
          done();
        };

        ws.onclose = () => {
          clearTimeout(timer);
          if (this.socket === ws) {
            this.socket = null;
          }
          if (!this.manuallyClosed) {
            this.updateStatus('disconnected');
            if (this.autoReconnect) {
              this.reconnectTimer = setTimeout(() => {
                if (!this.manuallyClosed) void this.connect();
              }, 2000);
            }
          }
          done();
        };
      } catch {
        clearTimeout(timer);
        this.updateStatus('error');
        done();
      }
    });
  }

  public disconnect(): void {
    this.manuallyClosed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.outboundQueue = [];
    if (this.socket) {
      try {
        this.socket.close();
      } catch {}
      this.socket = null;
    }
    this.updateStatus('disconnected');
    this.messageListeners.clear();
    this.statusListeners.clear();
  }

  public send(packet: NetworkPacket): void {
    this.broadcast(packet);
  }

  public broadcast(packet: NetworkPacket): void {
    const raw = JSON.stringify(packet);
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(raw);
      return;
    }
    if (!this.manuallyClosed) {
      if (this.outboundQueue.length >= 32) {
        this.outboundQueue.shift();
      }
      this.outboundQueue.push(raw);
    }
  }

  public onMessage(listener: TransportMessageListener): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  public onStatusChange(listener: TransportStatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => this.statusListeners.delete(listener);
  }

  private updateStatus(next: TransportStatus): void {
    if (this.status === next) return;
    this.status = next;
    for (const listener of this.statusListeners) {
      listener(next);
    }
  }
}

/**
 * Combines same-device BroadcastChannel with cross-device WebSocket relay,
 * deduplicating incoming packets by `packet.id`.
 */
export class HybridRoomTransport implements NetworkTransport {
  public status: TransportStatus = 'disconnected';
  public readonly channelId: string;
  public readonly localClientId: string;

  private readonly localBroadcast: BroadcastChannelTransport | null;
  private readonly wsRelay: WebSocketRelayTransport | null;
  private readonly seenPacketIds: string[] = [];
  private readonly seenPacketSet = new Set<string>();
  private messageListeners = new Set<TransportMessageListener>();
  private statusListeners = new Set<TransportStatusListener>();

  constructor(roomCode: string, localClientId: string, options?: WebSocketRelayOptions) {
    const norm = normalizeRoomCode(roomCode);
    this.channelId = `hybrid:room:${norm}`;
    this.localClientId = localClientId;
    this.localBroadcast =
      typeof BroadcastChannel !== 'undefined'
        ? new BroadcastChannelTransport(norm, localClientId)
        : null;
    const canUseWs =
      typeof WebSocket !== 'undefined' &&
      (Boolean(options?.wsUrl) ||
        (typeof window !== 'undefined' &&
          (window.location?.protocol === 'http:' || window.location?.protocol === 'https:') &&
          Boolean(window.location?.host)));
    this.wsRelay = canUseWs ? new WebSocketRelayTransport(norm, localClientId, options) : null;

    const handleIncoming = (packet: NetworkPacket) => {
      if (!packet || !packet.id) return;
      if (this.seenPacketSet.has(packet.id)) return;
      this.seenPacketSet.add(packet.id);
      this.seenPacketIds.push(packet.id);
      if (this.seenPacketIds.length > 256) {
        const oldest = this.seenPacketIds.shift();
        if (oldest) this.seenPacketSet.delete(oldest);
      }
      for (const listener of this.messageListeners) {
        listener(packet);
      }
    };

    this.localBroadcast?.onMessage(handleIncoming);
    this.wsRelay?.onMessage(handleIncoming);
    this.wsRelay?.onStatusChange(() => {
      for (const listener of this.statusListeners) {
        listener(this.status);
      }
    });
  }

  public isCloudConnected(): boolean {
    return this.wsRelay?.isCloudConnected() ?? false;
  }

  public async connect(): Promise<void> {
    if (this.localBroadcast) {
      await this.localBroadcast.connect();
      this.status = 'connected';
      for (const listener of this.statusListeners) listener(this.status);
    }
    if (this.wsRelay) {
      if (this.localBroadcast) {
        void this.wsRelay.connect();
      } else {
        await this.wsRelay.connect();
        this.status = this.wsRelay.status === 'connected' ? 'connected' : 'connecting';
        for (const listener of this.statusListeners) listener(this.status);
      }
    }
  }

  public disconnect(): void {
    this.localBroadcast?.disconnect();
    this.wsRelay?.disconnect();
    this.status = 'disconnected';
    this.seenPacketIds.length = 0;
    this.seenPacketSet.clear();
    this.messageListeners.clear();
    this.statusListeners.clear();
  }

  public send(packet: NetworkPacket): void {
    this.broadcast(packet);
  }

  public broadcast(packet: NetworkPacket): void {
    if (packet?.id && !this.seenPacketSet.has(packet.id)) {
      this.seenPacketSet.add(packet.id);
      this.seenPacketIds.push(packet.id);
      if (this.seenPacketIds.length > 256) {
        const oldest = this.seenPacketIds.shift();
        if (oldest) this.seenPacketSet.delete(oldest);
      }
    }
    if (this.localBroadcast && this.localBroadcast.status === 'connected') {
      this.localBroadcast.broadcast(packet);
    }
    if (this.wsRelay) {
      this.wsRelay.broadcast(packet);
    }
  }

  public onMessage(listener: TransportMessageListener): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  public onStatusChange(listener: TransportStatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => this.statusListeners.delete(listener);
  }
}

export interface NetworkRoomConfig {
  roomCode: string;
  localPlayer: {
    name: string;
    address: string;
    avatar?: string;
  };
  transport?: NetworkTransport;
  isHost?: boolean;
  maxPlayers?: number;
  heartbeatIntervalMs?: number;
  disconnectTimeoutMs?: number;
}

export class NetworkRoom {
  public state: RoomState;
  public readonly localClientId: string;
  public readonly transport: NetworkTransport;

  private localSequence = 0;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatIntervalMs: number;
  private disconnectTimeoutMs: number;
  private stateChangeListeners = new Set<(state: RoomState) => void>();
  private actionListeners = new Set<(action: GameAction) => void>();
  private chatListeners = new Set<(message: { sender: string; text: string }) => void>();

  constructor(config: NetworkRoomConfig) {
    const code = normalizeRoomCode(config.roomCode);
    this.localClientId = `client_${Math.random().toString(36).substring(2, 10)}`;
    this.heartbeatIntervalMs = config.heartbeatIntervalMs ?? 3000;
    this.disconnectTimeoutMs = config.disconnectTimeoutMs ?? 9000;

    const rawMax = config.maxPlayers ?? 4;
    const maxPlayers = Math.max(3, Math.min(6, rawMax));

    const isHost = Boolean(config.isHost);
    const initialPlayer: RoomPlayer = {
      clientId: this.localClientId,
      name: config.localPlayer.name,
      address: config.localPlayer.address,
      avatar: config.localPlayer.avatar ?? 'avatar_0.png',
      seat: isHost ? 0 : null,
      isHost,
      isReady: isHost,
      connected: true,
      lastSeen: Date.now(),
    };

    this.state = {
      code,
      status: 'lobby',
      hostClientId: isHost ? this.localClientId : '',
      players: [initialPlayer],
      maxPlayers,
      gameState: null,
      stateSeq: 0,
      seed: Math.floor(Math.random() * 1000000),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.transport =
      config.transport ??
      (typeof window !== 'undefined' &&
      (typeof BroadcastChannel !== 'undefined' || typeof WebSocket !== 'undefined')
        ? new HybridRoomTransport(code, this.localClientId, { isHost })
        : new MemoryTransport(code, this.localClientId));

    this.transport.onMessage((packet) => this.handleIncomingPacket(packet));
  }

  public isCloudRelayActive(): boolean {
    if (this.transport instanceof HybridRoomTransport) {
      return this.transport.isCloudConnected();
    }
    if (this.transport instanceof WebSocketRelayTransport) {
      return this.transport.isCloudConnected();
    }
    return false;
  }

  public async start(): Promise<void> {
    await this.transport.connect();
    this.startHeartbeatLoop();

    if (!this.isLocalHost()) {
      this.sendPacket('ROOM_JOIN_REQUEST', {
        name: this.getLocalPlayer()?.name ?? 'Player',
        address: this.getLocalPlayer()?.address ?? '0x0',
        avatar: this.getLocalPlayer()?.avatar,
      });
    }
  }

  public stop(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    try {
      this.sendPacket('ROOM_LEAVE', { reason: 'User left room' });
    } catch {
      // Ignore errors when sending leave on teardown
    }
    this.transport.disconnect();
    this.state.status = 'closed';
    this.notifyStateChange();
  }

  public isLocalHost(): boolean {
    return this.state.hostClientId === this.localClientId;
  }

  public getLocalPlayer(): RoomPlayer | undefined {
    return this.state.players.find((p) => p.clientId === this.localClientId);
  }

  public setSeat(seatIndex: number): void {
    if (this.state.status !== 'lobby') return;
    if (seatIndex < 0 || seatIndex >= this.state.maxPlayers) {
      const allowed = Array.from({ length: this.state.maxPlayers }, (_, i) => i);
      const allowedStr =
        this.state.maxPlayers === 4
          ? '0, 1, 2, or 3'
          : `${allowed.slice(0, -1).join(', ')}, or ${allowed[allowed.length - 1]}`;
      throw new Error(`Seat index must be ${allowedStr}`);
    }
    const existing = this.state.players.find((p) => p.seat === seatIndex && p.connected);
    if (existing && existing.clientId !== this.localClientId) {
      throw new Error(`Seat ${seatIndex} is already occupied by ${existing.name}`);
    }

    const local = this.getLocalPlayer();
    if (local) {
      local.seat = seatIndex;
      this.state.updatedAt = Date.now();
      if (this.isLocalHost()) {
        this.broadcastRoomState();
      } else {
        this.sendPacket('SEAT_ASSIGN_REQUEST', { targetSeat: seatIndex });
      }
      this.notifyStateChange();
    }
  }

  public toggleReady(isReady?: boolean): void {
    if (this.state.status !== 'lobby') return;
    const local = this.getLocalPlayer();
    if (!local) return;
    local.isReady = isReady !== undefined ? isReady : !local.isReady;
    this.state.updatedAt = Date.now();

    if (this.isLocalHost()) {
      this.broadcastRoomState();
    } else {
      this.sendPacket('READY_TOGGLE', { isReady: local.isReady });
    }
    this.notifyStateChange();
  }

  public startMatch(seed?: number): void {
    if (!this.isLocalHost()) throw new Error('Only the room host can start the match');
    if (this.state.status !== 'lobby') throw new Error('Match can be started only from lobby state');

    const seated = this.state.players.filter((p) => p.seat !== null && p.connected);
    if (seated.length === 0) throw new Error('Cannot start match with zero seated players');
    const allReady = seated.every((p) => p.isReady);
    if (!allReady) throw new Error('All seated players must toggle ready before starting');

    const matchSeed = seed ?? this.state.seed;
    const botArchetypes = [
      { name: 'Sherwood', address: '0x2000000000000000000000000000000000000001', avatar: 'avatar_1.png' },
      { name: 'Apex', address: '0x3000000000000000000000000000000000000002', avatar: 'avatar_2.png' },
      { name: 'Luna', address: '0x4000000000000000000000000000000000000003', avatar: 'avatar_3.png' },
      { name: 'Nexus', address: '0x5000000000000000000000000000000000000004', avatar: 'avatar_1.png' },
      { name: 'Solace', address: '0x6000000000000000000000000000000000000005', avatar: 'avatar_2.png' },
    ];

    const matchPlayers: { name: string; address: string; avatar: string }[] = [];
    let botIndex = 0;

    for (let seat = 0; seat < this.state.maxPlayers; seat++) {
      const human = this.state.players.find((p) => p.seat === seat && p.connected);
      if (human) {
        matchPlayers.push({ name: human.name, address: human.address, avatar: human.avatar });
      } else {
        const bot = botArchetypes[botIndex % botArchetypes.length];
        botIndex++;
        matchPlayers.push(bot);
      }
    }

    const rng = createSeededRng(matchSeed);
    const initialEngineState = createGame({ players: matchPlayers, seed: matchSeed }, rng);
    this.state.gameState = initialEngineState;
    this.state.status = 'playing';
    this.state.seed = matchSeed;
    this.state.stateSeq = 1;
    this.state.updatedAt = Date.now();

    this.sendPacket('MATCH_STARTED', {
      initialState: initialEngineState,
      seed: matchSeed,
      stateSeq: this.state.stateSeq,
    });
    this.notifyStateChange();
  }

  public dispatchGameAction(action: GameAction): void {
    if (this.state.status !== 'playing' || !this.state.gameState) {
      throw new Error('Game action can be dispatched only while match is actively playing');
    }

    if (this.isLocalHost()) {
      this.applyAuthoritativeAction(action);
    } else {
      const local = this.getLocalPlayer();
      const globalLifecycleActions: GameAction['type'][] = [
        'START_YEAR',
        'BEGIN_BUILD',
        'COLLECT_INCOME',
        'NEXT_YEAR',
      ];
      if (globalLifecycleActions.includes(action.type)) {
        throw new Error(`Only the room host can dispatch global lifecycle action ${action.type}`);
      }
      if (
        'playerId' in action &&
        typeof (action as any).playerId === 'number' &&
        local &&
        local.seat !== null &&
        (action as any).playerId !== local.seat
      ) {
        throw new Error(
          `Cannot dispatch action for player ${(action as any).playerId} when seated at ${local.seat}`
        );
      }
      if (
        action.type === 'EXECUTE_TRADE' &&
        action.offer &&
        local &&
        local.seat !== null &&
        action.offer.fromPlayer !== undefined &&
        action.offer.fromPlayer !== local.seat
      ) {
        throw new Error(
          `Cannot dispatch trade from player ${action.offer.fromPlayer} when seated at ${local.seat}`
        );
      }
      this.sendPacket('GAME_ACTION', {
        action,
        expectedStateSeq: this.state.stateSeq,
      });
    }
  }

  public sendChat(text: string): void {
    const local = this.getLocalPlayer();
    const senderName = local?.name ?? 'Player';
    this.sendPacket('CHAT_MESSAGE', { senderName, text });
    for (const listener of this.chatListeners) {
      listener({ sender: senderName, text });
    }
  }

  public onStateChange(listener: (state: RoomState) => void): () => void {
    this.stateChangeListeners.add(listener);
    listener(this.state);
    return () => this.stateChangeListeners.delete(listener);
  }

  public onAction(listener: (action: GameAction) => void): () => void {
    this.actionListeners.add(listener);
    return () => this.actionListeners.delete(listener);
  }

  public onChat(listener: (message: { sender: string; text: string }) => void): () => void {
    this.chatListeners.add(listener);
    return () => this.chatListeners.delete(listener);
  }

  private handleIncomingPacket(packet: NetworkPacket): void {
    if (packet.roomCode !== this.state.code || packet.senderId === this.localClientId) return;

    const sender = this.state.players.find((p) => p.clientId === packet.senderId);
    if (sender) {
      const wasDisconnected = !sender.connected;
      sender.lastSeen = Date.now();
      sender.connected = true;

      if (this.isLocalHost()) {
        const isSeatOccupied =
          sender.seat !== null &&
          this.state.players.some(
            (p) => p.clientId !== sender.clientId && p.connected && p.seat === sender.seat
          );

        if (isSeatOccupied) {
          const allSeats = Array.from({ length: this.state.maxPlayers }, (_, i) => i);
          const vacantSeat = allSeats.find(
            (seat) =>
              !this.state.players.some(
                (p) => p.clientId !== sender.clientId && p.connected && p.seat === seat
              )
          );
          sender.seat = vacantSeat ?? null;
          this.state.updatedAt = Date.now();
          this.broadcastRoomState();
          this.notifyStateChange();
        } else if (wasDisconnected) {
          this.state.updatedAt = Date.now();
          this.broadcastRoomState();
          this.notifyStateChange();
        }
      }
    }

    switch (packet.type) {
      case 'ROOM_JOIN_REQUEST': {
        if (!this.isLocalHost()) break;
        if (this.state.status === 'closed') {
          this.sendPacket('ROOM_JOIN_RESPONSE', {
            success: false,
            error: 'Room is closed',
          });
          break;
        }

        const availableSeats = Array.from({ length: this.state.maxPlayers }, (_, i) => i);
        const availableSeat = availableSeats.find(
          (seat) => !this.state.players.some((p) => p.seat === seat && p.connected)
        );
        const assignedSeat =
          packet.payload.preferredSeat !== undefined &&
          packet.payload.preferredSeat >= 0 &&
          packet.payload.preferredSeat < this.state.maxPlayers &&
          !this.state.players.some((p) => p.seat === packet.payload.preferredSeat && p.connected)
            ? packet.payload.preferredSeat
            : availableSeat ?? null;

        let existing = this.state.players.find((p) => p.clientId === packet.senderId);
        if (!existing) {
          existing = {
            clientId: packet.senderId,
            name: packet.payload.name,
            address: packet.payload.address,
            avatar: packet.payload.avatar ?? 'avatar_1.png',
            seat: assignedSeat,
            isHost: false,
            isReady: false,
            connected: true,
            lastSeen: Date.now(),
          };
          this.state.players.push(existing);
        } else {
          const rejoiningPlayer = existing;
          rejoiningPlayer.connected = true;
          rejoiningPlayer.lastSeen = Date.now();
          const seatOccupied =
            rejoiningPlayer.seat !== null &&
            this.state.players.some(
              (p) =>
                p.clientId !== rejoiningPlayer.clientId &&
                p.connected &&
                p.seat === rejoiningPlayer.seat
            );
          if (rejoiningPlayer.seat === null || seatOccupied) {
            rejoiningPlayer.seat = assignedSeat;
          }
        }

        this.sendPacket('ROOM_JOIN_RESPONSE', {
          success: true,
          assignedSeat,
          roomState: this.state,
        });
        this.broadcastRoomState();
        this.notifyStateChange();
        break;
      }

      case 'ROOM_JOIN_RESPONSE': {
        if (this.isLocalHost()) break;
        if (packet.payload.success && packet.payload.roomState) {
          this.syncFromRemoteState(packet.payload.roomState);
        }
        break;
      }

      case 'ROOM_STATE_SYNC': {
        if (this.isLocalHost() || packet.senderId !== this.state.hostClientId) break;
        this.syncFromRemoteState(packet.payload.roomState);
        break;
      }

      case 'SEAT_ASSIGN_REQUEST': {
        if (!this.isLocalHost()) break;
        if (this.state.status !== 'lobby') {
          this.broadcastRoomState();
          break;
        }
        const player = this.state.players.find((p) => p.clientId === packet.senderId);
        const targetSeat = packet.payload?.targetSeat;
        const isValidSeat =
          typeof targetSeat === 'number' &&
          targetSeat >= 0 &&
          targetSeat < this.state.maxPlayers;
        const occupied =
          isValidSeat &&
          this.state.players.some(
            (p) => p.seat === targetSeat && p.connected && p.clientId !== packet.senderId
          );
        if (player && isValidSeat && !occupied) {
          player.seat = targetSeat;
          this.state.updatedAt = Date.now();
          this.broadcastRoomState();
          this.notifyStateChange();
        } else {
          this.broadcastRoomState();
        }
        break;
      }

      case 'READY_TOGGLE': {
        if (!this.isLocalHost() || this.state.status !== 'lobby') break;
        const player = this.state.players.find((p) => p.clientId === packet.senderId);
        if (player) {
          player.isReady = packet.payload.isReady;
          this.state.updatedAt = Date.now();
          this.broadcastRoomState();
          this.notifyStateChange();
        }
        break;
      }

      case 'MATCH_STARTED': {
        if (packet.senderId !== this.state.hostClientId) break;
        this.state.gameState = packet.payload.initialState;
        this.state.status = 'playing';
        this.state.seed = packet.payload.seed;
        this.state.stateSeq = packet.payload.stateSeq;
        this.notifyStateChange();
        break;
      }

      case 'GAME_ACTION': {
        if (!this.isLocalHost()) break;

        const sender = this.state.players.find((p) => p.clientId === packet.senderId);
        if (!sender || sender.seat === null || !sender.connected) {
          console.warn(
            `[NetworkRoom ${this.state.code}] Rejected action from unseated or disconnected sender ${packet.senderId}`
          );
          this.sendPacket('GAME_STATE_SYNC', {
            stateSeq: this.state.stateSeq,
            gameState: this.state.gameState,
          });
          break;
        }

        const action = packet.payload?.action;
        if (!action || typeof action !== 'object' || typeof action.type !== 'string') {
          console.warn(
            `[NetworkRoom ${this.state.code}] Rejected malformed action payload from ${packet.senderId}`
          );
          this.sendPacket('GAME_STATE_SYNC', {
            stateSeq: this.state.stateSeq,
            gameState: this.state.gameState,
          });
          break;
        }

        const globalLifecycleActions: GameAction['type'][] = [
          'START_YEAR',
          'BEGIN_BUILD',
          'COLLECT_INCOME',
          'NEXT_YEAR',
        ];

        if (globalLifecycleActions.includes(action.type)) {
          console.warn(
            `[NetworkRoom ${this.state.code}] Rejected global lifecycle action ${action.type} from non-host sender ${packet.senderId}`
          );
          this.sendPacket('GAME_STATE_SYNC', {
            stateSeq: this.state.stateSeq,
            gameState: this.state.gameState,
          });
          break;
        }

        if (
          'playerId' in action &&
          typeof (action as any).playerId === 'number' &&
          (action as any).playerId !== sender.seat
        ) {
          console.warn(
            `[NetworkRoom ${this.state.code}] Rejected action ${action.type}: sender seat ${sender.seat} does not match action.playerId ${(action as any).playerId}`
          );
          this.sendPacket('GAME_STATE_SYNC', {
            stateSeq: this.state.stateSeq,
            gameState: this.state.gameState,
          });
          break;
        }

        if (action.type === 'EXECUTE_TRADE' && action.offer) {
          const fromPlayer = action.offer.fromPlayer;
          if (fromPlayer !== undefined && fromPlayer !== sender.seat) {
            console.warn(
              `[NetworkRoom ${this.state.code}] Rejected trade: sender seat ${sender.seat} does not match offer.fromPlayer ${fromPlayer}`
            );
            this.sendPacket('GAME_STATE_SYNC', {
              stateSeq: this.state.stateSeq,
              gameState: this.state.gameState,
            });
            break;
          }
        }

        this.applyAuthoritativeAction(action);
        break;
      }

      case 'GAME_STATE_SYNC': {
        if (this.isLocalHost() || packet.senderId !== this.state.hostClientId) break;
        if (packet.payload.stateSeq > this.state.stateSeq) {
          this.state.gameState = packet.payload.gameState;
          this.state.stateSeq = packet.payload.stateSeq;
          if (packet.payload.lastAction) {
            for (const listener of this.actionListeners) {
              listener(packet.payload.lastAction);
            }
          }
          this.notifyStateChange();
        }
        break;
      }

      case 'CHAT_MESSAGE': {
        for (const listener of this.chatListeners) {
          listener({ sender: packet.payload.senderName, text: packet.payload.text });
        }
        break;
      }

      case 'ROOM_LEAVE': {
        const leaving = this.state.players.find((p) => p.clientId === packet.senderId);
        if (leaving) {
          leaving.connected = false;
          leaving.seat = null;
          this.notifyStateChange();
          if (leaving.clientId === this.state.hostClientId) {
            this.electNewHost('Host voluntarily left');
          } else if (this.isLocalHost()) {
            this.broadcastRoomState();
          }
        }
        break;
      }

      case 'HOST_MIGRATION_ANNOUNCE': {
        if (this.isLocalHost()) break;

        this.checkPlayerLiveness();

        const currentHost = this.state.players.find((p) => p.clientId === this.state.hostClientId);
        if (currentHost && currentHost.connected) {
          break;
        }

        const candidates = this.state.players
          .filter((p) => p.connected && p.seat !== null && p.clientId !== this.state.hostClientId)
          .sort((a, b) => (a.seat ?? 99) - (b.seat ?? 99));

        const expectedHost =
          candidates[0] ??
          this.state.players.find((p) => p.connected && p.clientId !== this.state.hostClientId);

        if (
          !expectedHost ||
          packet.payload.newHostClientId !== expectedHost.clientId ||
          packet.senderId !== packet.payload.newHostClientId
        ) {
          break;
        }

        this.state.hostClientId = packet.payload.newHostClientId;
        for (const player of this.state.players) {
          player.isHost = player.clientId === packet.payload.newHostClientId;
        }
        this.notifyStateChange();
        break;
      }

      case 'HEARTBEAT': {
        this.sendPacket('HEARTBEAT_ACK', {
          clientTimestamp: packet.payload.clientTimestamp,
          serverTimestamp: Date.now(),
        });
        break;
      }

      case 'HEARTBEAT_ACK': {
        break;
      }

      default:
        break;
    }
  }

  private syncFromRemoteState(remote: RoomState): void {
    const local = this.getLocalPlayer();
    this.state = {
      ...remote,
      players: remote.players.map((p) => {
        if (p.clientId === this.localClientId) {
          return {
            ...p,
            connected: true,
            lastSeen: Date.now(),
            name: local?.name ?? p.name,
            address: local?.address ?? p.address,
            avatar: local?.avatar ?? p.avatar,
          };
        }
        return p;
      }),
    };

    if (local && !this.state.players.some((p) => p.clientId === this.localClientId)) {
      this.state.players.push(local);
    }
    this.notifyStateChange();
  }

  private applyAuthoritativeAction(action: GameAction): void {
    if (!this.state.gameState || !action || typeof action !== 'object') return;

    try {
      switch (action.type) {
        case 'START_YEAR':
          startYear(this.state.gameState);
          break;
        case 'DRAFT_PLOTS':
          draftPlots(this.state.gameState, action.playerId, action.lotIds);
          break;
        case 'BEGIN_BUILD':
          beginBuild(this.state.gameState);
          break;
        case 'BUILD_TILE':
          buildTile(this.state.gameState, action.playerId, action.lotId, action.shopType);
          break;
        case 'EXECUTE_TRADE':
          executeTrade(this.state.gameState, action.offer);
          break;
        case 'COLLECT_INCOME':
          collectIncome(this.state.gameState);
          break;
        case 'NEXT_YEAR':
          nextYear(this.state.gameState);
          break;
        default:
          break;
      }
    } catch (err) {
      console.warn(
        `[NetworkRoom ${this.state.code}] Game engine rejected action ${action.type}:`,
        err instanceof Error ? err.message : err
      );
      this.sendPacket('GAME_STATE_SYNC', {
        stateSeq: this.state.stateSeq,
        gameState: this.state.gameState,
      });
      return;
    }

    this.state.stateSeq++;
    this.state.updatedAt = Date.now();

    for (const listener of this.actionListeners) {
      listener(action);
    }

    this.sendPacket('GAME_STATE_SYNC', {
      stateSeq: this.state.stateSeq,
      gameState: this.state.gameState,
      lastAction: action,
    });
    this.notifyStateChange();
  }

  private startHeartbeatLoop(): void {
    this.heartbeatTimer = setInterval(() => {
      try {
        this.sendPacket('HEARTBEAT', { clientTimestamp: Date.now() });
        this.checkPlayerLiveness();
      } catch {
        // Ignore disconnected transport heartbeat attempts
      }
    }, this.heartbeatIntervalMs);
    if (this.heartbeatTimer && typeof (this.heartbeatTimer as any).unref === 'function') {
      (this.heartbeatTimer as any).unref();
    }
  }

  public checkPlayerLiveness(): void {
    const now = Date.now();
    let changed = false;

    for (const player of this.state.players) {
      if (player.clientId !== this.localClientId && player.connected) {
        if (now - player.lastSeen > this.disconnectTimeoutMs) {
          player.connected = false;
          player.seat = null;
          changed = true;
          if (player.clientId === this.state.hostClientId) {
            this.electNewHost('Host heartbeat timed out');
          }
        }
      }
    }

    if (changed) {
      if (this.isLocalHost()) {
        this.broadcastRoomState();
      }
      this.notifyStateChange();
    }
  }

  private electNewHost(reason: string): void {
    const candidates = this.state.players
      .filter((p) => p.connected && p.seat !== null)
      .sort((a, b) => (a.seat ?? 99) - (b.seat ?? 99));

    if (candidates.length === 0) {
      candidates.push(...this.state.players.filter((p) => p.connected));
    }

    if (candidates.length === 0) return;
    const newHost = candidates[0];
    this.state.hostClientId = newHost.clientId;

    for (const player of this.state.players) {
      player.isHost = player.clientId === newHost.clientId;
    }

    if (newHost.clientId === this.localClientId) {
      this.sendPacket('HOST_MIGRATION_ANNOUNCE', {
        newHostClientId: newHost.clientId,
        reason,
        stateSeq: this.state.stateSeq,
      });
      this.broadcastRoomState();
    }
    this.notifyStateChange();
  }

  private broadcastRoomState(): void {
    this.sendPacket('ROOM_STATE_SYNC', { roomState: this.state });
  }

  private sendPacket<T extends PacketType>(type: T, payload: any): void {
    this.localSequence++;
    const packet: NetworkPacket = {
      id: `${this.localClientId}_${this.localSequence}_${Date.now()}`,
      roomCode: this.state.code,
      senderId: this.localClientId,
      sequenceNumber: this.localSequence,
      timestamp: Date.now(),
      type,
      payload,
    };
    this.transport.broadcast(packet);
  }

  private notifyStateChange(): void {
    for (const listener of this.stateChangeListeners) {
      listener(this.state);
    }
  }
}
