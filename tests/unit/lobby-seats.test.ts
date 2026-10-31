import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RobinTownApp } from '../../src/app.js';
import { NetworkRoom } from '../../src/network/room.js';

type LobbyInternals = {
  networkRoom: NetworkRoom | null;
  renderRoomModalHTML(): string;
  handleRoomModalClick(e: Event): void;
};

const clickSeat = (app: LobbyInternals, seat: number) =>
  app.handleRoomModalClick({
    target: { closest: () => ({ dataset: { seat: String(seat) } }) },
    currentTarget: null,
  } as unknown as Event);

describe('Multiplayer lobby seat picker', () => {
  it('renders seats 0..3 as clickable cards and moves the local player on click', async () => {
    const app = new RobinTownApp(null) as unknown as LobbyInternals;
    const room = new NetworkRoom({
      roomCode: 'SEATS1',
      isHost: true,
      localPlayer: { name: 'Host', address: '0x1111' },
      heartbeatIntervalMs: 60_000,
    });
    await room.start();
    try {
      app.networkRoom = room;
      const html = app.renderRoomModalHTML();
      for (const seat of [0, 1, 2, 3]) assert.ok(html.includes(`data-seat="${seat}"`), `seat ${seat} card`);
      assert.match(html, /Seat 0 \(You\)/, 'host starts in seat 0');

      clickSeat(app, 2);
      assert.equal(room.getLocalPlayer()?.seat, 2);
      assert.match(app.renderRoomModalHTML(), /Seat 2 \(You\)/);

      clickSeat(app, 9); // out of range: rejected without throwing
      assert.equal(room.getLocalPlayer()?.seat, 2);
    } finally {
      room.stop();
    }
  });
});
