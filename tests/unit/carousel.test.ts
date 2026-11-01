import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  AppleCarousel,
  CLONE_COUNT,
  SETTLE_DELAY,
  type CarouselItem,
} from '../../src/ui/carousel.js';

// Minimal mock DOM node for headless Node.js
class MockElement {
  public tagName: string;
  public className = '';
  public id = '';
  public innerHTML = '';
  public textContent = '';
  public style: Record<string, string> = {};
  public attributes: Record<string, string> = {};
  public children: MockElement[] = [];
  public parentElement: MockElement | null = null;
  public offsetLeft = 0;
  public offsetWidth = 280;
  public clientWidth = 800;
  public scrollLeft = 0;
  public type = 'button';
  public listeners: Record<string, Function[]> = {};

  constructor(tagName: string) {
    this.tagName = tagName.toUpperCase();
  }

  public setAttribute(name: string, value: string): void {
    this.attributes[name] = value;
  }

  public getAttribute(name: string): string | null {
    return this.attributes[name] ?? null;
  }

  public hasAttribute(name: string): boolean {
    return name in this.attributes;
  }

  public removeAttribute(name: string): void {
    delete this.attributes[name];
  }

  public appendChild(child: MockElement): MockElement {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  public removeChild(child: MockElement): MockElement {
    const idx = this.children.indexOf(child);
    if (idx !== -1) {
      this.children.splice(idx, 1);
      child.parentElement = null;
    }
    return child;
  }

  public querySelector(selector: string): MockElement | null {
    if (selector.startsWith('.')) {
      const cls = selector.substring(1);
      for (const child of this.children) {
        if (child.className.includes(cls)) return child;
        const sub = child.querySelector(selector);
        if (sub) return sub;
      }
    }
    return null;
  }

  public addEventListener(event: string, handler: Function): void {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(handler);
  }

  public removeEventListener(event: string, handler: Function): void {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter((h) => h !== handler);
  }

  public dispatchEvent(event: { type: string }): void {
    const handlers = this.listeners[event.type];
    if (handlers) {
      for (const h of handlers) {
        h(event);
      }
    }
  }

  public classList = {
    toggle: (cls: string, force?: boolean) => {
      const classes = new Set(this.className.split(' ').filter(Boolean));
      if (force !== undefined) {
        if (force) classes.add(cls);
        else classes.delete(cls);
      } else {
        if (classes.has(cls)) classes.delete(cls);
        else classes.add(cls);
      }
      this.className = Array.from(classes).join(' ');
    },
  };

  public scrollTo(options: { left: number; behavior?: string }): void {
    this.scrollLeft = options.left;
  }
}

function setupMockDocument() {
  const doc = {
    createElement(tagName: string) {
      return new MockElement(tagName);
    },
    timeline: {},
  };
  (global as unknown as { document: unknown }).document = doc;
}

const SAMPLE_ITEMS: CarouselItem[] = [
  { id: 1, title: 'Parcel 01', district: 'Financial District', color: '#00C805', owner: 'Robinhood', shop: 'DEX Exchange', income: 40 },
  { id: 2, title: 'Parcel 02', district: 'Crypto Strip', color: '#EEC353', owner: 'Luna', shop: 'Memecoin Lounge', income: 25 },
  { id: 3, title: 'Parcel 03', district: 'Chinatown Core', color: '#29B6F6', owner: 'Sherwood', shop: 'Coffee Shop', income: 30 },
  { id: 4, title: 'Parcel 04', district: 'Silicon Valley', color: '#AB47BC', owner: 'Apex', shop: 'Validator Citadel', income: 55 },
  { id: 5, title: 'Parcel 05', district: 'Wall Street', color: '#FF9100', owner: 'Bank', shop: 'Lending Vault', income: 70 },
  { id: 6, title: 'Parcel 06', district: 'Downtown Marina', color: '#00E676', owner: 'Player 1', shop: 'Pho Bistro', income: 45 },
];

describe('AppleCarousel Infinite Autoplay Component (Milestone M7)', () => {
  beforeEach(() => {
    setupMockDocument();
  });

  it('renders infinite clone track with 2 leading and 2 trailing clones', () => {
    const container = new MockElement('div') as unknown as HTMLElement;
    const carousel = new AppleCarousel({
      container,
      items: SAMPLE_ITEMS,
    });

    carousel.mount();

    assert.equal(carousel.getRealCardCount(), 6);
    // cloneCount = Math.min(2, 6) = 2, so clone cards count is 2 * 2 = 4
    assert.equal(carousel.getCloneCardCount(), 4);

    const cards = carousel.getCardElements();
    assert.equal(cards.length, 6 + 4, 'Total rendered cards must equal real count + 2 * cloneCount');

    // Verify leading clones have data-clone attribute
    for (let i = 0; i < 2; i++) {
      assert.equal(cards[i].getAttribute('data-clone'), 'true');
      assert.ok(cards[i].hasAttribute('inert'), 'Clone cards must have inert attribute');
    }

    // Verify real cards in the middle
    for (let i = 2; i < 8; i++) {
      assert.equal(cards[i].hasAttribute('data-clone'), false);
    }

    // Verify trailing clones at the end
    for (let i = 8; i < 10; i++) {
      assert.equal(cards[i].getAttribute('data-clone'), 'true');
      assert.ok(cards[i].hasAttribute('inert'), 'Trailing clone cards must have inert attribute');
    }

    carousel.unmount();
  });

  it('handles single item without clone cards', () => {
    const container = new MockElement('div') as unknown as HTMLElement;
    const singleItem = [SAMPLE_ITEMS[0]];
    const carousel = new AppleCarousel({
      container,
      items: singleItem,
    });

    carousel.mount();
    assert.equal(carousel.getRealCardCount(), 1);
    assert.equal(carousel.getCloneCardCount(), 0);
    assert.equal(carousel.getCardElements().length, 1);
    carousel.unmount();
  });

  it('advances slides sequentially via next, prev, and goTo', () => {
    const container = new MockElement('div') as unknown as HTMLElement;
    const carousel = new AppleCarousel({
      container,
      items: SAMPLE_ITEMS,
    });

    carousel.mount();
    assert.equal(carousel.getCurrentIndex(), 0);
    assert.equal(carousel.getCurrentItem()?.title, 'Parcel 01');

    carousel.next();
    assert.equal(carousel.getCurrentIndex(), 1);
    assert.equal(carousel.getCurrentItem()?.title, 'Parcel 02');

    carousel.next();
    assert.equal(carousel.getCurrentIndex(), 2);

    carousel.prev();
    assert.equal(carousel.getCurrentIndex(), 1);

    carousel.goTo(5);
    assert.equal(carousel.getCurrentIndex(), 5);

    // Loop around
    carousel.next();
    assert.equal(carousel.getCurrentIndex(), 0);

    carousel.prev();
    assert.equal(carousel.getCurrentIndex(), 5);

    carousel.unmount();
  });

  it('controls autoplay state with play, pause, and togglePlay', () => {
    const container = new MockElement('div') as unknown as HTMLElement;
    const carousel = new AppleCarousel({
      container,
      items: SAMPLE_ITEMS,
      autoplayDurationMs: 3000,
    });

    carousel.mount();
    assert.equal(carousel.isPlaying(), true);

    carousel.pause();
    assert.equal(carousel.isPlaying(), false);

    carousel.play();
    assert.equal(carousel.isPlaying(), true);

    carousel.togglePlay();
    assert.equal(carousel.isPlaying(), false);

    carousel.togglePlay();
    assert.equal(carousel.isPlaying(), true);

    carousel.unmount();
  });

  it('supports full keyboard navigation conforming to W3C carousel patterns', () => {
    let selectedItem: CarouselItem | null = null;
    const container = new MockElement('div') as unknown as HTMLElement;
    const carousel = new AppleCarousel({
      container,
      items: SAMPLE_ITEMS,
      onSelect: (item) => {
        selectedItem = item;
      },
    });

    carousel.mount();

    carousel.simulateKey('ArrowRight');
    assert.equal(carousel.getCurrentIndex(), 1);

    carousel.simulateKey('ArrowLeft');
    assert.equal(carousel.getCurrentIndex(), 0);

    carousel.simulateKey('End');
    assert.equal(carousel.getCurrentIndex(), 5);

    carousel.simulateKey('Home');
    assert.equal(carousel.getCurrentIndex(), 0);

    carousel.simulateKey('Enter');
    assert.ok(selectedItem !== null);
    assert.equal((selectedItem as CarouselItem).title, 'Parcel 01');

    carousel.unmount();
  });

  it('applies WAI-ARIA tabbed carousel semantics to container, cards, and tabs', () => {
    const container = new MockElement('div') as unknown as HTMLElement;
    const carousel = new AppleCarousel({
      container,
      items: SAMPLE_ITEMS,
    });

    carousel.mount();

    const root = (container as unknown as MockElement).children[0];
    assert.equal(root.getAttribute('role'), 'region');
    assert.equal(root.getAttribute('aria-roledescription'), 'carousel');

    const viewport = root.children[0];
    const track = viewport.children[0];
    assert.equal(track.getAttribute('role'), 'list');

    const activeCard = track.children.find(
      (c) => !c.hasAttribute('data-clone') && c.getAttribute('data-index') === '0'
    );
    assert.ok(activeCard);
    assert.equal(activeCard.getAttribute('role'), 'group');
    assert.equal(activeCard.getAttribute('aria-roledescription'), 'slide');
    assert.equal(activeCard.getAttribute('aria-hidden'), 'false');
    assert.equal(activeCard.hasAttribute('inert'), false);

    const inactiveCard = track.children.find(
      (c) => !c.hasAttribute('data-clone') && c.getAttribute('data-index') === '1'
    );
    assert.ok(inactiveCard);
    assert.equal(inactiveCard.getAttribute('aria-hidden'), 'true');
    assert.ok(inactiveCard.hasAttribute('inert'));

    carousel.unmount();
  });

  it('updates item set dynamically with setItems', () => {
    const container = new MockElement('div') as unknown as HTMLElement;
    const carousel = new AppleCarousel({
      container,
      items: SAMPLE_ITEMS.slice(0, 3),
    });

    carousel.mount();
    assert.equal(carousel.getRealCardCount(), 3);

    carousel.setItems(SAMPLE_ITEMS);
    assert.equal(carousel.getRealCardCount(), 6);
    assert.equal(carousel.getCurrentIndex(), 0);

    carousel.unmount();
  });

  it('unmounts cleanly and removes DOM elements and event listeners', () => {
    const container = new MockElement('div') as unknown as HTMLElement;
    const carousel = new AppleCarousel({
      container,
      items: SAMPLE_ITEMS,
    });

    carousel.mount();
    assert.equal((container as unknown as MockElement).children.length, 1);

    carousel.unmount();
    assert.equal((container as unknown as MockElement).children.length, 0);
  });
});
