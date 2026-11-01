export type Side = "above" | "below" | "left" | "right";

export type TargetId = "C1" | "C2" | "C3" | "C4" | "C5" | "C6" | "C7" | "C8" | "X1" | "X2" | "I1" | "I2";

export interface CalloutSpec {
  id: TargetId;
  /** Scene-local frame when callout ring starts drawing. */
  from: number;
  /** Scene-local frame when callout completes fade-out. */
  to: number;
  side: Side;
  /** Line 1: What it is (<= 6 words, 34px, 600, #fbf6e8). */
  what: string;
  /** Line 2: Why it helps you (<= 9 words, 28px, 500, #bdd8c8). */
  why: string;
  /** Optional accent dot color. */
  accent?: string;
}

export const CARD_W = 660;

export const cardHeight = (why: string): number =>
  36 + 42 + 8 + 36 * Math.max(1, Math.ceil(why.length / 40));

export const layoutKey = (scope: string, spec: Pick<CalloutSpec, "id" | "from">): string =>
  `${scope}:${spec.id}@${spec.from}`;
