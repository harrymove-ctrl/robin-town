import {
  AbsoluteFill,
  Easing,
  getInputProps,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  CARD_W,
  type CalloutSpec,
  cardHeight,
  layoutKey,
} from "../callout-spec";
import LAYOUT from "../callout-layout.json";
import { framesPerBeat } from "../grid";
import { BE_VIETNAM, C, PALETTE } from "../theme";

export type { CalloutSpec, Side, TargetId } from "../callout-spec";

const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export interface ScreenBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

const PAD = 8;
const RING = 8;
const CARD_IN = 6;
const FADE = 6;
const MARGIN = 48;
/** Ring stays >= 25 px inside frame so its 2 px stroke never clips the 1080p edge (Gate 3). */
const SAFE = 25;
const GAP = 56;

const PROPS = getInputProps() as { calloutMode?: string; only?: string };
export const CALLOUT_MODE = PROPS.calloutMode ?? "normal";
const MEASURE = CALLOUT_MODE === "rings";

const placed = LAYOUT as Record<string, { x: number; y: number }>;

export function calloutLevel(frame: number, from: number, to: number): number {
  const out = to - framesPerBeat;
  return Math.min(
    interpolate(frame, [from, from + RING], [0, 1], CLAMP),
    interpolate(frame, [out, out + FADE], [1, 0], CLAMP),
  );
}

export function ringRect(box: ScreenBox, width: number, height: number): ScreenBox {
  const x0 = Math.max(SAFE, box.x - PAD);
  const y0 = Math.max(SAFE, box.y - PAD);
  const x1 = Math.min(width - SAFE, box.x + box.w + PAD);
  const y1 = Math.min(height - SAFE, box.y + box.h + PAD);
  return { x: x0, y: y0, w: Math.max(12, x1 - x0), h: Math.max(12, y1 - y0) };
}

export function Dim({ boxes, level }: { boxes: ScreenBox[]; level: number }) {
  const { width, height } = useVideoConfig();
  if (level <= 0 || MEASURE) return null;
  const holes = boxes
    .map((b) => ringRect(b, width, height))
    .map((r) => `M${r.x},${r.y} h${r.w} v${r.h} h${-r.w} z`)
    .join(" ");
  return (
    <svg width={width} height={height} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <path
        d={`M0,0 H${width} V${height} H0 z ${holes}`}
        fill={PALETTE.bgCityStage}
        fillRule="evenodd"
        opacity={0.25 * level}
      />
    </svg>
  );
}

const nearest = (px: number, py: number, r: ScreenBox): [number, number] => [
  Math.min(Math.max(px, r.x), r.x + r.w),
  Math.min(Math.max(py, r.y), r.y + r.h),
];

export function Callout({
  spec,
  box,
  scope,
}: {
  spec: CalloutSpec;
  box: ScreenBox;
  scope: string;
}) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const level = calloutLevel(frame, spec.from, spec.to);
  if (level <= 0) return null;

  const draw = interpolate(frame, [spec.from, spec.from + RING], [0, 1], {
    ...CLAMP,
    easing: Easing.out(Easing.cubic),
  });
  const cardIn = interpolate(frame, [spec.from + RING, spec.from + RING + CARD_IN], [0, 1], {
    ...CLAMP,
    easing: Easing.out(Easing.cubic),
  });

  const ring = ringRect(box, width, height);
  const perimeter = 2 * (ring.w + ring.h);

  if (MEASURE) {
    if (PROPS.only && PROPS.only !== layoutKey(scope, spec)) return null;
    return (
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        <rect
          x={ring.x}
          y={ring.y}
          width={ring.w}
          height={ring.h}
          fill="none"
          stroke="#00ff00"
          strokeWidth={3}
        />
      </svg>
    );
  }

  const cardH = cardHeight(spec.why);
  const cx = ring.x + ring.w / 2;
  const cy = ring.y + ring.h / 2;
  const spot = placed[layoutKey(scope, spec)];
  let x: number;
  let y: number;
  if (spot) {
    ({ x, y } = spot);
  } else {
    x =
      spec.side === "left"
        ? ring.x - GAP - CARD_W
        : spec.side === "right"
          ? ring.x + ring.w + GAP
          : cx - CARD_W / 2;
    y =
      spec.side === "above"
        ? ring.y - GAP - cardH
        : spec.side === "below"
          ? ring.y + ring.h + GAP
          : cy - cardH / 2;
  }
  x = Math.min(Math.max(MARGIN, x), width - MARGIN - CARD_W);
  y = Math.min(Math.max(MARGIN, y), height - MARGIN - cardH);

  const card: ScreenBox = { x, y, w: CARD_W, h: cardH };
  const to = nearest(cx, cy, card);
  const from = nearest(to[0], to[1], ring);

  return (
    <AbsoluteFill style={{ opacity: level, pointerEvents: "none" }}>
      <svg
        width={width}
        height={height}
        style={{ position: "absolute", inset: 0, overflow: "visible" }}
      >
        <rect
          x={ring.x}
          y={ring.y}
          width={ring.w}
          height={ring.h}
          rx={10}
          fill="none"
          stroke={C.mint}
          strokeWidth={2}
          strokeDasharray={perimeter}
          strokeDashoffset={(1 - draw) * perimeter}
        />
        <line
          x1={from[0]}
          y1={from[1]}
          x2={from[0] + (to[0] - from[0]) * draw}
          y2={from[1] + (to[1] - from[1]) * draw}
          stroke="rgba(189, 216, 200, 0.45)"
          strokeWidth={1.5}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          left: x,
          top: y,
          width: CARD_W,
          minHeight: cardH,
          boxSizing: "border-box",
          opacity: cardIn,
          transform: `translateY(${(1 - cardIn) * 12}px)`,
          background: C.card,
          border: `1px solid ${C.line}`,
          borderRadius: 14,
          padding: "18px 24px",
          fontFamily: BE_VIETNAM,
          boxShadow: "0 24px 60px rgba(8, 22, 16, 0.72)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontSize: 34,
            fontWeight: 600,
            color: C.ink,
            lineHeight: 1.2,
          }}
        >
          <span
            style={{
              width: 11,
              height: 11,
              borderRadius: 6,
              background: spec.accent ?? C.mint,
              flexShrink: 0,
            }}
          />
          {spec.what}
        </div>
        <div
          style={{
            marginTop: 7,
            fontSize: 28,
            fontWeight: 500,
            color: C.muted,
            lineHeight: 1.26,
          }}
        >
          {spec.why}
        </div>
      </div>
    </AbsoluteFill>
  );
}

/** Chapter Eyebrow chip anchored bottom-left over empty dark stage felt so top HUD stays 100% clear. */
export function Eyebrow({ n, title }: { n: number; title: string }) {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [0, 8], [0, 1], {
    ...CLAMP,
    easing: Easing.out(Easing.cubic),
  });
  if (MEASURE) return null;
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          width: 720,
          height: 180,
          opacity: p,
          background: `radial-gradient(ellipse 100% 100% at 0% 100%, ${C.bg} 0%, ${C.bg} 45%, transparent 100%)`,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 36,
          bottom: 32,
          transform: `translateX(${(1 - p) * -32}px)`,
          opacity: p,
          background: C.cardSolid,
          border: `1px solid ${C.line}`,
          borderRadius: 999,
          padding: "10px 22px",
          fontFamily: BE_VIETNAM,
          fontSize: 24,
          fontWeight: 600,
          color: C.ink,
          boxShadow: `0 0 0 8px ${C.bg}, 0 12px 36px rgba(8, 22, 16, 0.72)`,
          pointerEvents: "none",
        }}
      >
        <span style={{ color: C.mint }}>0{n}</span> · {title}
      </div>
    </>
  );
}

export const EYEBROW_BOX = { x: 20, y: 955, w: 500, h: 105 };
