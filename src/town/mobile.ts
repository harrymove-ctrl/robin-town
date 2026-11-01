import type { Point } from './camera';

export interface MobileTouchPoint {
  readonly clientX: number;
  readonly clientY: number;
}

/** The event fields these guards use, also suitable for lightweight DOM test doubles. */
export interface MobileGuardEvent {
  readonly target?: unknown;
  readonly cancelable?: boolean;
  preventDefault(): void;
}

export interface MobileTouchEvent extends MobileGuardEvent {
  readonly touches: ArrayLike<MobileTouchPoint>;
}

export type MobileGuardListener = (event: MobileGuardEvent) => void;
export type MobileTouchListener = (event: MobileTouchEvent) => void;

export interface MobileGuardDocument {
  addEventListener(
    type: 'touchstart' | 'touchmove',
    listener: MobileTouchListener,
    options?: AddEventListenerOptions,
  ): void;
  addEventListener(
    type: string,
    listener: MobileGuardListener,
    options?: AddEventListenerOptions,
  ): void;
}

export interface MobileClosestTarget {
  closest(selector: string): unknown;
}

/** Partial metrics preserve support for small test doubles and non-scrollable ancestors. */
export interface MobileScrollRegion {
  readonly scrollLeft?: number;
  readonly scrollTop?: number;
  readonly scrollWidth?: number;
  readonly scrollHeight?: number;
  readonly clientWidth?: number;
  readonly clientHeight?: number;
  readonly parentElement?: unknown;
}

const EDITABLE_SELECTOR = 'input,textarea,[contenteditable="true"]';
const SCROLLABLE_SELECTOR =
  '.shop-tray,.address-strip,.plot-inspector,.quick-build>div,.offer-tray,.barter-plots,.phase-announcement,.modal-body,dialog,.research,#app,.start-screen,.apple-carousel-viewport';
const SCROLL_METRICS = [
  'scrollLeft',
  'scrollTop',
  'scrollWidth',
  'scrollHeight',
  'clientWidth',
  'clientHeight',
] as const;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isClosestTarget(value: unknown): value is MobileClosestTarget {
  return isObject(value) && typeof value.closest === 'function';
}

function closest(target: unknown, selector: string): unknown {
  return isClosestTarget(target) ? target.closest(selector) : null;
}

function editable(target: unknown): boolean {
  return Boolean(closest(target, EDITABLE_SELECTOR));
}

function isScrollRegion(value: unknown): value is MobileScrollRegion {
  return (
    isObject(value) &&
    SCROLL_METRICS.every((key) => value[key] === undefined || typeof value[key] === 'number')
  );
}

function scrollable(target: unknown): MobileScrollRegion | null {
  const region = closest(target, SCROLLABLE_SELECTOR);
  return isScrollRegion(region) ? region : null;
}

// The page is a fixed game surface. Only explicit drawers and dialogs scroll.
export function installMobileGuards(doc: MobileGuardDocument = globalThis.document): void {
  let previous: Point | null = null;

  doc.addEventListener('contextmenu', (event) => {
    if (!editable(event.target)) event.preventDefault();
  });
  doc.addEventListener('selectstart', (event) => {
    if (!editable(event.target)) event.preventDefault();
  });
  doc.addEventListener('dragstart', (event) => {
    if (isObject(event.target) && event.target.tagName === 'IMG') event.preventDefault();
  });
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
    doc.addEventListener(type, (event) => event.preventDefault(), { passive: false });
  }
  doc.addEventListener(
    'touchstart',
    (event) => {
      const point = event.touches[0];
      previous = point ? { x: point.clientX, y: point.clientY } : null;
    },
    { passive: true },
  );
  doc.addEventListener(
    'touchmove',
    (event) => {
      if (event.touches.length !== 1) {
        event.preventDefault();
        return;
      }
      const point = event.touches[0];
      if (point === undefined) throw new Error('A single-touch move needs its touch point.');
      const dx = point.clientX - (previous?.x ?? point.clientX);
      const dy = point.clientY - (previous?.y ?? point.clientY);
      previous = { x: point.clientX, y: point.clientY };
      if (editable(event.target)) return;

      let region = scrollable(event.target);
      while (region) {
        const horizontal = Math.abs(dx) > Math.abs(dy);
        const position = (horizontal ? region.scrollLeft : region.scrollTop) ?? Number.NaN;
        const max = horizontal
          ? (region.scrollWidth ?? Number.NaN) - (region.clientWidth ?? Number.NaN)
          : (region.scrollHeight ?? Number.NaN) - (region.clientHeight ?? Number.NaN);
        const delta = horizontal ? dx : dy;
        if (max > 1 && ((delta < 0 && position < max - 1) || (delta > 0 && position > 0))) return;
        region = scrollable(region.parentElement);
      }
      if (event.cancelable) event.preventDefault();
    },
    { passive: false },
  );
}
