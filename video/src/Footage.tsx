// Two-state 3D perspective Footage rig (cruising 8..11 deg yaw -> 0 deg flat for Explainer Callouts),
// single-pointer @snapcn/cursor-track overlay, drawn emerald confirmation Tick, Dim, Callout, and Eyebrow.
import {
  AbsoluteFill,
  Easing,
  OffthreadVideo,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { CursorTrack, type CursorWaypoint } from "@/components/snap-cn/cursor-track";
import {
  CALLOUT_MODE,
  Callout,
  Dim,
  Eyebrow,
  type ScreenBox,
  calloutLevel,
} from "./components/Callout";
import { SolaceGround } from "./components/TownMark";
import { C, PALETTE } from "./palette";
import { type CamKey, type Point, type ShotSpec, TARGETS } from "./shots";
import { ROBIN_THEME } from "./theme";

const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

interface CameraPose {
  scale: number;
  tx: number;
  ty: number;
  yaw: number;
}

function sampleCamera(keys: CamKey[], frame: number, w: number, h: number): CameraPose {
  if (keys.length === 1 || frame <= keys[0].at) {
    return toPose(keys[0], w, h);
  }
  const last = keys[keys.length - 1];
  if (frame >= last.at) {
    return toPose(last, w, h);
  }
  let i = 0;
  while (i < keys.length - 2 && frame >= keys[i + 1].at) i++;
  const a = keys[i];
  const b = keys[i + 1];
  const t = interpolate(frame, [a.at, b.at], [0, 1], {
    ...CLAMP,
    easing: Easing.inOut(Easing.cubic),
  });
  const scale = a.scale + (b.scale - a.scale) * t;
  const fx = a.focus.x + (b.focus.x - a.focus.x) * t;
  const fy = a.focus.y + (b.focus.y - a.focus.y) * t;
  const yaw = (a.yaw ?? 0) + ((b.yaw ?? 0) - (a.yaw ?? 0)) * t;
  const panX = (a.panX ?? 0) + ((b.panX ?? 0) - (a.panX ?? 0)) * t;
  return clampPose(scale, fx, fy, yaw, panX, w, h);
}

function toPose(k: CamKey, w: number, h: number): CameraPose {
  return clampPose(k.scale, k.focus.x, k.focus.y, k.yaw ?? 0, k.panX ?? 0, w, h);
}

function clampPose(
  scale: number,
  fx: number,
  fy: number,
  yaw: number,
  panX: number,
  w: number,
  h: number,
): CameraPose {
  // When tilted in 3D (>= 4 deg yaw), pull back slightly (~0.91x) so the beveled card floats on #112a24 SolaceUI grid;
  // when yaw -> 0 deg for a Callout, fill >= 96%..105% of the 1080p frame cleanly.
  const tiltFactor = Math.min(1, Math.abs(yaw) / 10);
  const effScale = scale * (1 - 0.09 * tiltFactor);
  const maxTx = Math.max(0, ((Math.max(1, effScale) - 1) * w) / 2);
  const maxTy = Math.max(0, ((Math.max(1, effScale) - 1) * h) / 2);
  const rawTx = (w / 2 - fx) * effScale;
  const rawTy = (h / 2 - fy) * effScale;
  return {
    scale: effScale,
    tx: Math.max(-maxTx, Math.min(maxTx, rawTx)) + panX,
    ty: Math.max(-maxTy, Math.min(maxTy, rawTy)),
    yaw,
  };
}

function projectPoint(p: Point, cam: CameraPose, w: number, h: number): Point {
  return {
    x: (p.x - w / 2) * cam.scale + w / 2 + cam.tx,
    y: (p.y - h / 2) * cam.scale + h / 2 + cam.ty,
  };
}

function projectBox(box: ScreenBox, cam: CameraPose, w: number, h: number): ScreenBox {
  const tl = projectPoint({ x: box.x, y: box.y }, cam, w, h);
  return {
    x: Math.round(tl.x),
    y: Math.round(tl.y),
    w: Math.round(box.w * cam.scale),
    h: Math.round(box.h * cam.scale),
  };
}

function buildCursorWaypoints(
  rings: Array<{ at: number; p: Point }> | undefined,
  keys: CamKey[],
  w: number,
  h: number,
): CursorWaypoint[] {
  if (!rings || rings.length === 0) return [];
  const waypoints: CursorWaypoint[] = [];
  const firstCam = sampleCamera(keys, Math.max(0, rings[0].at - 16), w, h);
  const firstPt = projectPoint(rings[0].p, firstCam, w, h);
  // Walk cursor cleanly from bottom-right edge onto the first target
  waypoints.push({
    at: Math.max(0, rings[0].at - 18),
    x: Math.min(0.96, firstPt.x / w + 0.08),
    y: Math.min(0.96, firstPt.y / h + 0.08),
    duration: 4,
  });
  for (const r of rings) {
    const cam = sampleCamera(keys, r.at, w, h);
    const pt = projectPoint(r.p, cam, w, h);
    waypoints.push({
      at: Math.max(0, r.at - 12),
      x: pt.x / w,
      y: pt.y / h,
      duration: 12,
      click: true,
    });
  }
  return waypoints;
}

function DrawnTick({ at, p }: { at: number; p: Point }) {
  const frame = useCurrentFrame();
  if (CALLOUT_MODE === "rings") return null;
  const local = frame - at;
  if (local < 0 || local > 42) return null;
  const draw = interpolate(local, [0, 9], [0, 1], {
    ...CLAMP,
    easing: Easing.out(Easing.cubic),
  });
  const fade = interpolate(local, [28, 42], [1, 0], CLAMP);
  const scale = interpolate(local, [0, 8], [0.72, 1], {
    ...CLAMP,
    easing: Easing.out(Easing.back(1.6)),
  });
  return (
    <div
      style={{
        position: "absolute",
        left: p.x - 24,
        top: p.y - 24,
        width: 48,
        height: 48,
        borderRadius: 999,
        background: PALETTE.accentEmerald,
        border: `2px solid ${PALETTE.parchmentLight}`,
        boxShadow: "0 10px 28px rgba(8, 22, 16, 0.65)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: fade,
        transform: `scale(${scale})`,
        pointerEvents: "none",
      }}
    >
      <svg width={26} height={26} viewBox="0 0 26 26">
        <path
          d="M5 13.5 L10.5 19 L21 7.5"
          fill="none"
          stroke={PALETTE.parchmentLight}
          strokeWidth={3.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={30}
          strokeDashoffset={(1 - draw) * 30}
        />
      </svg>
    </div>
  );
}

export function Footage({ shot }: { shot: ShotSpec }) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const cam = sampleCamera(shot.camera, frame, width, height);
  const tiltAbs = Math.abs(cam.yaw);
  const cardRadius = Math.round(interpolate(tiltAbs, [0, 10], [4, 20], CLAMP));

  const callouts = shot.callouts ?? [];
  const activeCallouts = callouts
    .map((spec) => ({
      spec,
      level: calloutLevel(frame, spec.from, spec.to),
      box: projectBox(TARGETS[spec.id], cam, width, height),
    }))
    .filter((c) => c.level > 0);

  const maxDimLevel = activeCallouts.reduce((m, c) => Math.max(m, c.level), 0);
  const waypoints =
    CALLOUT_MODE === "rings" ? [] : buildCursorWaypoints(shot.rings, shot.camera, width, height);

  return (
    <SolaceGround>
      <CursorTrack
        path={waypoints}
        variant="arrow"
        mode="dark"
        theme={ROBIN_THEME}
        color={PALETTE.parchmentLight}
        outlineColor={PALETTE.bgDeep}
        ringColor={PALETTE.accentMintPill}
      >
        <AbsoluteFill
          style={{
            perspective: 1200,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width,
              height,
              borderRadius: cardRadius,
              overflow: "hidden",
              border: tiltAbs > 0.5 ? `1.5px solid ${C.line}` : "none",
              boxShadow:
                tiltAbs > 0.5 ? "0 36px 90px rgba(8, 22, 16, 0.78)" : "none",
              transform: `translate3d(${cam.tx.toFixed(2)}px, ${cam.ty.toFixed(2)}px, 0) scale(${cam.scale.toFixed(4)}) rotateY(${cam.yaw.toFixed(2)}deg)`,
              transformStyle: "preserve-3d",
              background: PALETTE.bgCityStage,
            }}
          >
            <OffthreadVideo
              src={staticFile(shot.clip)}
              trimBefore={shot.trimBefore}
              playbackRate={shot.playbackRate ?? 1}
              muted
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />

            {/* Subtle 1.5px far-edge depth softness when tilted >= 4 deg */}
            {tiltAbs >= 4 ? (
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  width: 140,
                  [cam.yaw > 0 ? "right" : "left"]: 0,
                  backdropFilter: "blur(1.5px)",
                  WebkitBackdropFilter: "blur(1.5px)",
                  maskImage:
                    cam.yaw > 0
                      ? "linear-gradient(to right, transparent, black)"
                      : "linear-gradient(to left, transparent, black)",
                  WebkitMaskImage:
                    cam.yaw > 0
                      ? "linear-gradient(to right, transparent, black)"
                      : "linear-gradient(to left, transparent, black)",
                  pointerEvents: "none",
                }}
              />
            ) : null}
          </div>
        </AbsoluteFill>
      </CursorTrack>

      {/* Dim non-ringed background by 25% when a Callout is active */}
      {activeCallouts.length > 0 ? (
        <Dim boxes={activeCallouts.map((c) => c.box)} level={maxDimLevel} />
      ) : null}

      {/* Drawn emerald ticks on confirmed button actions */}
      {(shot.ticks ?? []).map((tk) => (
        <DrawnTick
          key={`${shot.id}-tick-${tk.at}`}
          at={tk.at}
          p={projectPoint(tk.p, cam, width, height)}
        />
      ))}

      {/* 2-line Explainer Callouts (solver-placed via callout-layout.json) */}
      {callouts.map((spec) => (
        <Callout
          key={`${shot.id}-${spec.id}-${spec.from}`}
          spec={spec}
          box={projectBox(TARGETS[spec.id], cam, width, height)}
          scope={shot.id}
        />
      ))}

      {/* Bottom-left Chapter Eyebrow chip */}
      {shot.eyebrow ? <Eyebrow n={shot.eyebrow.n} title={shot.eyebrow.title} /> : null}
    </SolaceGround>
  );
}
