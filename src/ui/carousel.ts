/**
 * Apple Carousel Infinite Autoplay Component for Robin-Town (Milestone M7)
 * Pure TypeScript DOM implementation with infinite clone track, silent clone wrapping,
 * Web Animations API progress bar autoplay clock, hover/touch pause/resume,
 * keyboard navigation, WAI-ARIA tabbed carousel semantics, and headless Node.js safety.
 */

export interface CarouselItem {
  id: number;
  title: string;
  district: string;
  color: string;
  owner: string;
  shop: string;
  income: number;
}

export interface AppleCarouselOptions {
  container: HTMLElement;
  items: CarouselItem[];
  onSelect?: (item: CarouselItem) => void;
  autoplayDurationMs?: number;
}

export const CLONES_PER_SIDE = 2;
export const CLONE_COUNT = 2;
export const TOTAL_CLONES = CLONES_PER_SIDE * 2;
export const SETTLE_DELAY = 150;

export class AppleCarousel {
  private container: HTMLElement;
  private items: CarouselItem[] = [];
  private onSelectCallback?: (item: CarouselItem) => void;
  private autoplayDurationMs = 4000;

  // DOM Elements
  private rootElement: HTMLElement | null = null;
  private viewportElement: HTMLElement | null = null;
  private trackElement: HTMLElement | null = null;
  private tablistElement: HTMLElement | null = null;
  private playButtonElement: HTMLButtonElement | null = null;
  private cardElements: HTMLElement[] = [];
  private tabElements: HTMLButtonElement[] = [];

  // State
  private currentIndex = 0;
  private isMounted = false;
  private playing = true;
  private isUserInteracting = false;
  private ignoreScrollUntil = 0;
  private scrollDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private fallbackTimer: ReturnType<typeof setTimeout> | null = null;
  private currentAnimation: Animation | null = null;

  // Listeners
  private boundOnScroll: (() => void) | null = null;
  private boundOnScrollEnd: (() => void) | null = null;
  private boundOnKeyDown: ((e: KeyboardEvent) => void) | null = null;
  private boundOnPointerEnter: (() => void) | null = null;
  private boundOnPointerLeave: (() => void) | null = null;
  private boundOnPointerDown: (() => void) | null = null;
  private boundOnPointerUp: (() => void) | null = null;

  constructor(options: AppleCarouselOptions) {
    this.container = options.container;
    this.items = [...(options.items || [])];
    this.onSelectCallback = options.onSelect;
    if (typeof options.autoplayDurationMs === 'number' && options.autoplayDurationMs > 0) {
      this.autoplayDurationMs = options.autoplayDurationMs;
    }
  }

  public getRealCardCount(): number {
    return this.items.length;
  }

  public getCloneCardCount(): number {
    if (this.items.length <= 1) return 0;
    return Math.min(CLONES_PER_SIDE, this.items.length) * 2;
  }

  public getCardElements(): HTMLElement[] {
    return [...this.cardElements];
  }

  public getCurrentIndex(): number {
    return this.currentIndex;
  }

  public getCurrentItem(): CarouselItem | null {
    if (this.items.length === 0) return null;
    return this.items[this.currentIndex] || null;
  }

  public isPlaying(): boolean {
    return this.playing;
  }

  public mount(): void {
    if (this.isMounted || !this.container) return;
    this.isMounted = true;
    this.renderDOM();
    this.bindEvents();
    this.alignToInitialSlide();
    if (this.playing) {
      this.startAutoplay();
    }
  }

  private renderDOM(): void {
    if (typeof document === 'undefined') return;

    // Root section with WAI-ARIA carousel semantics
    const root = document.createElement('section');
    root.className = 'apple-carousel';
    root.setAttribute('role', 'region');
    root.setAttribute('aria-roledescription', 'carousel');
    root.setAttribute('aria-label', 'Robin-Town Properties & Shops');
    root.setAttribute('data-playing', String(this.playing));
    this.rootElement = root;

    // Viewport
    const viewport = document.createElement('div');
    viewport.className = 'apple-carousel-viewport';
    viewport.setAttribute('tabindex', '0');
    this.viewportElement = viewport;

    // Track
    const track = document.createElement('ul');
    track.className = 'apple-carousel-track';
    track.setAttribute('role', 'list');
    this.trackElement = track;

    // Render cards (leading clones, real items, trailing clones)
    this.renderCards(track);

    viewport.appendChild(track);
    root.appendChild(viewport);

    // Controls dock (tablist and play button)
    const controls = document.createElement('div');
    controls.className = 'apple-carousel-controls';

    const tablist = document.createElement('div');
    tablist.className = 'apple-carousel-tablist';
    tablist.setAttribute('role', 'tablist');
    tablist.setAttribute('aria-label', 'Slides');
    this.tablistElement = tablist;

    this.renderTabs(tablist);
    controls.appendChild(tablist);

    // Play/Pause button
    const playBtn = document.createElement('button');
    playBtn.type = 'button';
    playBtn.className = 'apple-carousel-play-button';
    playBtn.setAttribute('aria-label', this.playing ? 'Pause autoplay' : 'Start autoplay');
    playBtn.innerHTML = this.getPlayPauseSvg(this.playing);
    playBtn.addEventListener('click', () => this.togglePlay());
    this.playButtonElement = playBtn;
    controls.appendChild(playBtn);

    root.appendChild(controls);
    this.container.appendChild(root);

    this.updateAriaStates();
  }

  private renderCards(track: HTMLElement): void {
    this.cardElements = [];
    const count = this.items.length;
    if (count === 0) return;

    const cloneCount = count <= 1 ? 0 : Math.min(CLONES_PER_SIDE, count);

    // 1. Leading clones: items.slice(count - cloneCount)
    if (cloneCount > 0) {
      const leadingClones = this.items.slice(count - cloneCount);
      leadingClones.forEach((item, i) => {
        const logicalIndex = count - cloneCount + i;
        const card = this.createCardElement(item, logicalIndex, true);
        track.appendChild(card);
        this.cardElements.push(card);
      });
    }

    // 2. Real items: items
    this.items.forEach((item, index) => {
      const card = this.createCardElement(item, index, false);
      track.appendChild(card);
      this.cardElements.push(card);
    });

    // 3. Trailing clones: items.slice(0, cloneCount)
    if (cloneCount > 0) {
      const trailingClones = this.items.slice(0, cloneCount);
      trailingClones.forEach((item, i) => {
        const logicalIndex = i;
        const card = this.createCardElement(item, logicalIndex, true);
        track.appendChild(card);
        this.cardElements.push(card);
      });
    }
  }

  private createCardElement(item: CarouselItem, logicalIndex: number, isClone: boolean): HTMLElement {
    const li = document.createElement('li');
    li.className = 'apple-carousel-slide';
    li.setAttribute('role', 'group');
    li.setAttribute('aria-roledescription', 'slide');
    li.setAttribute('aria-label', `${item.title} (${logicalIndex + 1} of ${this.items.length})`);
    li.setAttribute('data-index', String(logicalIndex));
    li.id = isClone ? `card-clone-${logicalIndex}-${Math.random().toString(36).substring(2, 7)}` : `card-${item.id}`;

    if (isClone) {
      li.setAttribute('data-clone', 'true');
      li.setAttribute('aria-hidden', 'true');
      li.setAttribute('inert', '');
    }

    // Inner card markup
    const cardBody = document.createElement('div');
    cardBody.className = 'apple-carousel-card';
    cardBody.style.borderColor = item.color;

    const badge = document.createElement('div');
    badge.className = 'apple-carousel-badge';
    badge.style.backgroundColor = item.color;
    badge.textContent = item.district;
    cardBody.appendChild(badge);

    const titleEl = document.createElement('h3');
    titleEl.className = 'apple-carousel-title';
    titleEl.textContent = item.title;
    cardBody.appendChild(titleEl);

    const meta = document.createElement('div');
    meta.className = 'apple-carousel-meta';
    meta.innerHTML = `<span class="meta-owner">Owner: ${item.owner}</span> | <span class="meta-shop">Shop: ${item.shop || 'Vacant'}</span> | <span class="meta-income">+${item.income} $wif/yr</span>`;
    cardBody.appendChild(meta);

    // Card click handler
    cardBody.addEventListener('click', () => {
      this.goTo(logicalIndex);
      if (this.onSelectCallback) {
        this.onSelectCallback(item);
      }
    });

    li.appendChild(cardBody);
    return li;
  }

  private renderTabs(tablist: HTMLElement): void {
    this.tabElements = [];
    tablist.innerHTML = '';

    this.items.forEach((item, index) => {
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'apple-carousel-tab';
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', index === this.currentIndex ? 'true' : 'false');
      tab.setAttribute('aria-label', `Slide ${index + 1}: ${item.title}`);
      tab.setAttribute('aria-controls', `card-${item.id}`);

      const fill = document.createElement('span');
      fill.className = 'apple-carousel-tab-fill';
      tab.appendChild(fill);

      tab.addEventListener('click', () => {
        this.goTo(index);
      });

      tablist.appendChild(tab);
      this.tabElements.push(tab);
    });
  }

  private getPlayPauseSvg(isPlaying: boolean): string {
    if (isPlaying) {
      return `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
    }
    return `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><polygon points="5,3 19,12 5,21"/></svg>`;
  }

  private bindEvents(): void {
    if (!this.viewportElement || !this.rootElement) return;

    // Scroll listener with debounce for silent clone wrapping
    this.boundOnScroll = () => {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (now < this.ignoreScrollUntil) return;

      if (this.scrollDebounceTimer !== null) {
        clearTimeout(this.scrollDebounceTimer);
      }
      this.scrollDebounceTimer = setTimeout(() => {
        this.handleSettle();
      }, SETTLE_DELAY);
      if (
        this.scrollDebounceTimer &&
        typeof this.scrollDebounceTimer === 'object' &&
        typeof (this.scrollDebounceTimer as unknown as { unref: () => void }).unref === 'function'
      ) {
        (this.scrollDebounceTimer as unknown as { unref: () => void }).unref();
      }
    };

    this.boundOnScrollEnd = () => {
      this.handleSettle();
    };

    // Keyboard navigation
    this.boundOnKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          this.prev();
          break;
        case 'ArrowRight':
          e.preventDefault();
          this.next();
          break;
        case 'Home':
          e.preventDefault();
          this.goTo(0);
          break;
        case 'End':
          e.preventDefault();
          this.goTo(this.items.length - 1);
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          this.selectCurrent();
          break;
      }
    };

    // Hover and touch pause/resume
    this.boundOnPointerEnter = () => {
      this.isUserInteracting = true;
      this.pauseAutoplayAnimation();
    };

    this.boundOnPointerLeave = () => {
      this.isUserInteracting = false;
      if (this.playing) {
        this.resumeAutoplayAnimation();
      }
    };

    this.boundOnPointerDown = () => {
      this.isUserInteracting = true;
      this.pauseAutoplayAnimation();
    };

    this.boundOnPointerUp = () => {
      this.isUserInteracting = false;
      if (this.playing) {
        this.resumeAutoplayAnimation();
      }
    };

    this.viewportElement.addEventListener('scroll', this.boundOnScroll, { passive: true });
    this.viewportElement.addEventListener('scrollend', this.boundOnScrollEnd as EventListener);
    this.viewportElement.addEventListener('keydown', this.boundOnKeyDown);
    this.rootElement.addEventListener('pointerenter', this.boundOnPointerEnter);
    this.rootElement.addEventListener('pointerleave', this.boundOnPointerLeave);
    this.rootElement.addEventListener('pointerdown', this.boundOnPointerDown);
    this.rootElement.addEventListener('pointerup', this.boundOnPointerUp);
  }

  private alignToInitialSlide(): void {
    if (!this.viewportElement) return;
    const realSlide0 = this.getRealSlide(0);
    if (realSlide0) {
      const snapLeft = this.getSnapLeft(realSlide0);
      this.writeScrollLeft(snapLeft);
    }
  }

  private getRealSlide(index: number): HTMLElement | null {
    for (const card of this.cardElements) {
      if (!card.hasAttribute('data-clone') && card.getAttribute('data-index') === String(index)) {
        return card;
      }
    }
    return null;
  }

  private getSnapLeft(slide: HTMLElement): number {
    if (!this.viewportElement) return 0;
    const viewport = this.viewportElement;

    // Check custom style scrollSnapAlign if available
    let snapAlign = 'center';
    if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
      try {
        const style = window.getComputedStyle(slide);
        if (style && style.scrollSnapAlign) {
          snapAlign = style.scrollSnapAlign;
        }
      } catch {
        snapAlign = 'center';
      }
    }

    const slideLeft = slide.offsetLeft || 0;
    const slideWidth = slide.offsetWidth || 280;
    const viewportWidth = viewport.clientWidth || 800;

    if (snapAlign.startsWith('start')) {
      return slideLeft;
    }
    // Center alignment
    return slideLeft - (viewportWidth - slideWidth) / 2;
  }

  private writeScrollLeft(left: number, silent = false): void {
    if (!this.viewportElement) return;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this.ignoreScrollUntil = now + SETTLE_DELAY;
    if (silent) {
      const prevBehavior = this.viewportElement.style.scrollBehavior;
      this.viewportElement.style.scrollBehavior = 'auto';
      this.viewportElement.scrollLeft = left;
      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(() => {
          if (this.viewportElement) {
            this.viewportElement.style.scrollBehavior = prevBehavior;
          }
        });
      } else {
        this.viewportElement.style.scrollBehavior = prevBehavior;
      }
    } else {
      this.viewportElement.scrollLeft = left;
    }
  }

  private handleSettle(): void {
    if (!this.viewportElement || this.cardElements.length === 0) return;

    const nearest = this.getNearestSlide();
    if (!nearest) return;

    const isClone = nearest.hasAttribute('data-clone');
    const logicalIndex = Number(nearest.getAttribute('data-index') || 0);

    if (isClone) {
      // Silent wrapping from clone to real card
      const realSlide = this.getRealSlide(logicalIndex);
      if (realSlide) {
        const targetSnapLeft = this.getSnapLeft(realSlide);
        this.writeScrollLeft(targetSnapLeft, true);
      }
    }

    if (this.currentIndex !== logicalIndex) {
      this.currentIndex = logicalIndex;
      this.updateAriaStates();
      if (this.playing && !this.isUserInteracting) {
        this.startAutoplay();
      }
    }
  }

  private getNearestSlide(): HTMLElement | null {
    if (!this.viewportElement || this.cardElements.length === 0) return null;
    const currentLeft = this.viewportElement.scrollLeft || 0;

    let nearest: HTMLElement | null = null;
    let minDistance = Infinity;

    for (const slide of this.cardElements) {
      const targetLeft = this.getSnapLeft(slide);
      const distance = Math.abs(targetLeft - currentLeft);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = slide;
      }
    }

    return nearest;
  }

  private updateAriaStates(): void {
    // 1. Update cards inert and selected states
    this.cardElements.forEach((card) => {
      const isClone = card.hasAttribute('data-clone');
      const idx = Number(card.getAttribute('data-index'));
      const isCurrent = !isClone && idx === this.currentIndex;

      if (isCurrent) {
        card.removeAttribute('inert');
        card.setAttribute('aria-hidden', 'false');
        card.setAttribute('data-active', 'true');
      } else {
        card.setAttribute('inert', '');
        card.setAttribute('aria-hidden', 'true');
        card.removeAttribute('data-active');
      }
    });

    // 2. Update tabs aria-selected
    this.tabElements.forEach((tab, index) => {
      const isSelected = index === this.currentIndex;
      tab.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      tab.classList.toggle('active', isSelected);
      const fill = tab.querySelector('.apple-carousel-tab-fill') as HTMLElement | null;
      if (fill && !isSelected) {
        fill.style.transform = 'scaleX(0)';
      }
    });

    // 3. Update root data-playing
    if (this.rootElement) {
      this.rootElement.setAttribute('data-playing', String(this.playing));
    }
    if (this.playButtonElement) {
      this.playButtonElement.setAttribute('aria-label', this.playing ? 'Pause autoplay' : 'Start autoplay');
      this.playButtonElement.innerHTML = this.getPlayPauseSvg(this.playing);
    }
  }

  public next(): void {
    if (this.items.length <= 1) return;
    const nextIdx = (this.currentIndex + 1) % this.items.length;
    this.goTo(nextIdx);
  }

  public prev(): void {
    if (this.items.length <= 1) return;
    const prevIdx = (this.currentIndex - 1 + this.items.length) % this.items.length;
    this.goTo(prevIdx);
  }

  public goTo(index: number): void {
    if (this.items.length === 0) return;
    const normalized = Math.max(0, Math.min(this.items.length - 1, index));
    this.currentIndex = normalized;

    const realSlide = this.getRealSlide(normalized);
    if (realSlide && this.viewportElement) {
      const snapLeft = this.getSnapLeft(realSlide);
      this.programmaticScroll(snapLeft);
    }

    this.updateAriaStates();

    if (this.playing && !this.isUserInteracting) {
      this.startAutoplay();
    }
  }

  private programmaticScroll(targetLeft: number): void {
    if (!this.viewportElement) return;

    // Use native smooth scrolling or direct write with ignore window
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this.ignoreScrollUntil = now + SETTLE_DELAY + 300;

    if (typeof this.viewportElement.scrollTo === 'function') {
      try {
        this.viewportElement.scrollTo({
          left: targetLeft,
          behavior: 'smooth',
        });
        return;
      } catch {
        // Fallback to direct scrollLeft
      }
    }
    this.viewportElement.scrollLeft = targetLeft;
  }

  public selectCurrent(): void {
    const item = this.getCurrentItem();
    if (item && this.onSelectCallback) {
      this.onSelectCallback(item);
    }
  }

  public play(): void {
    this.playing = true;
    this.updateAriaStates();
    if (!this.isUserInteracting) {
      this.startAutoplay();
    }
  }

  public pause(): void {
    this.playing = false;
    this.updateAriaStates();
    this.pauseAutoplayAnimation();
  }

  public togglePlay(): void {
    if (this.playing) {
      this.pause();
    } else {
      this.play();
    }
  }

  private startAutoplay(): void {
    this.stopAutoplayClock();

    if (!this.playing || this.items.length <= 1) return;

    // Web Animations API (WAAPI) implementation
    const activeTab = this.tabElements[this.currentIndex];
    const fillEl = activeTab ? (activeTab.querySelector('.apple-carousel-tab-fill') as HTMLElement) : null;

    if (
      fillEl &&
      typeof Animation !== 'undefined' &&
      typeof KeyframeEffect !== 'undefined'
    ) {
      try {
        const effect = new KeyframeEffect(
          fillEl,
          [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }],
          { duration: this.autoplayDurationMs, fill: 'forwards', easing: 'linear' }
        );
        this.currentAnimation = new Animation(effect, document.timeline);
        this.currentAnimation.onfinish = () => {
          this.next();
        };
        this.currentAnimation.play();
        return;
      } catch {
        // Fall back to JS timer
      }
    }

    // Fallback timer for headless or unsupported environments
    this.fallbackTimer = setTimeout(() => {
      this.next();
    }, this.autoplayDurationMs);
    if (
      this.fallbackTimer &&
      typeof this.fallbackTimer === 'object' &&
      typeof (this.fallbackTimer as unknown as { unref: () => void }).unref === 'function'
    ) {
      (this.fallbackTimer as unknown as { unref: () => void }).unref();
    }
  }

  private pauseAutoplayAnimation(): void {
    if (this.currentAnimation) {
      try {
        this.currentAnimation.pause();
      } catch {
        // Safe no-op
      }
    }
    if (this.fallbackTimer !== null) {
      clearTimeout(this.fallbackTimer);
      this.fallbackTimer = null;
    }
  }

  private resumeAutoplayAnimation(): void {
    if (!this.playing) return;
    if (this.currentAnimation && this.currentAnimation.playState === 'paused') {
      try {
        this.currentAnimation.play();
        return;
      } catch {
        // Fall back to new animation
      }
    }
    this.startAutoplay();
  }

  private stopAutoplayClock(): void {
    if (this.currentAnimation) {
      try {
        this.currentAnimation.cancel();
      } catch {
        // Safe no-op
      }
      this.currentAnimation = null;
    }
    if (this.fallbackTimer !== null) {
      clearTimeout(this.fallbackTimer);
      this.fallbackTimer = null;
    }
  }

  public setItems(items: CarouselItem[]): void {
    this.items = [...items];
    this.currentIndex = 0;
    if (this.trackElement) {
      this.trackElement.innerHTML = '';
      this.renderCards(this.trackElement);
    }
    if (this.tablistElement) {
      this.renderTabs(this.tablistElement);
    }
    this.alignToInitialSlide();
    this.updateAriaStates();
    if (this.playing) {
      this.startAutoplay();
    }
  }

  public simulateKey(key: string): void {
    if (this.boundOnKeyDown) {
      const event = {
        key,
        preventDefault: () => {},
      } as unknown as KeyboardEvent;
      this.boundOnKeyDown(event);
    }
  }

  public unmount(): void {
    this.isMounted = false;
    this.stopAutoplayClock();

    if (this.scrollDebounceTimer !== null) {
      clearTimeout(this.scrollDebounceTimer);
      this.scrollDebounceTimer = null;
    }

    if (this.viewportElement) {
      if (this.boundOnScroll) {
        this.viewportElement.removeEventListener('scroll', this.boundOnScroll);
      }
      if (this.boundOnScrollEnd) {
        this.viewportElement.removeEventListener('scrollend', this.boundOnScrollEnd as EventListener);
      }
      if (this.boundOnKeyDown) {
        this.viewportElement.removeEventListener('keydown', this.boundOnKeyDown);
      }
    }

    if (this.rootElement) {
      if (this.boundOnPointerEnter) {
        this.rootElement.removeEventListener('pointerenter', this.boundOnPointerEnter);
      }
      if (this.boundOnPointerLeave) {
        this.rootElement.removeEventListener('pointerleave', this.boundOnPointerLeave);
      }
      if (this.boundOnPointerDown) {
        this.rootElement.removeEventListener('pointerdown', this.boundOnPointerDown);
      }
      if (this.boundOnPointerUp) {
        this.rootElement.removeEventListener('pointerup', this.boundOnPointerUp);
      }
      if (this.rootElement.parentElement) {
        this.rootElement.parentElement.removeChild(this.rootElement);
      }
    }

    this.rootElement = null;
    this.viewportElement = null;
    this.trackElement = null;
    this.tablistElement = null;
    this.playButtonElement = null;
    this.cardElements = [];
    this.tabElements = [];
  }
}
