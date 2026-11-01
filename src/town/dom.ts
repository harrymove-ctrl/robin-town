/** Optional lookup for elements that appear only in a particular phase. */
export function query(selector: '#modal'): HTMLDialogElement | null;
export function query<T extends HTMLElement = HTMLElement>(selector: string): T | null;
export function query<T extends HTMLElement = HTMLElement>(selector: string): T | null {
  return document.querySelector<T>(selector);
}

/** Required lookup for elements owned by the currently mounted screen. */
export function required(selector: '#modal'): HTMLDialogElement;
export function required<T extends HTMLElement = HTMLElement>(selector: string): T;
export function required<T extends HTMLElement = HTMLElement>(selector: string): T {
  const element = query<T>(selector);
  if (!element) throw new Error(`Expected mounted game element: ${selector}`);
  return element;
}

export function eventElement(event: Event): HTMLElement | null {
  return event.target instanceof HTMLElement ? event.target : null;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
