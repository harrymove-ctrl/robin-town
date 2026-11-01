import { AbsoluteFill, Easing, interpolate, staticFile, useCurrentFrame } from "remotion";
import { BlockWordmark } from "@/components/snap-cn/block-wordmark";
import { LaptopFrame } from "@/components/snap-cn/laptop-frame";
import { OrbSwarm } from "@/components/snap-cn/orb-swarm";
import { SolaceGround, TownMark } from "../components/TownMark";
import { DISTRICT_PALETTE, PALETTE } from "../palette";
import { BE_VIETNAM, BUNGEE, ROBIN_THEME } from "../theme";

const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** S01 (240f) & X01 (120f): V3 @snapcn/orb-swarm 4-beat opening hook on #112a24 SolaceUI grid. */
export function OpeningSwarm({ fast = false }: { fast?: boolean }) {
  // OrbSwarm expects 6 pipe-separated cards; we map the 4-beat story arc cleanly across the 6 slots
  // so every beat is <= 5 words and settles crisply on Be Vietnam Pro.
  const script = fast
    ? "Pull up a stool. | Bargain for corners. | Open neighborhood shops. | Chain 46631 live. | Compound $wif yield. | Put $wif to work."
    : "Pull up a stool. | Bargain street corners. | Open neighborhood shops. | Connect matching blocks. | Earn annual $wif. | Put $wif to work.";
  return (
    <SolaceGround>
      <OrbSwarm
        script={script}
        background={PALETTE.bgDeep}
        ink={PALETTE.parchmentLight}
        orbColor={PALETTE.accentEmerald}
        fontFamily={BE_VIETNAM}
        softness={0}
        speed={fast ? 1.42 : 0.72}
        theme={ROBIN_THEME}
        mode="dark"
      />
    </SolaceGround>
  );
}

/** S02 (120f) & X02 (60f): @snapcn/block-wordmark + TownMark SVG in Robin-Town district colors. */
export function BrandBlockReveal({ fast = false }: { fast?: boolean }) {
  const frame = useCurrentFrame();
  const speed = fast ? 1.85 : 1.0;
  const f = frame * speed;
  const markIn = interpolate(f, [62, 80], [0, 1], {
    ...CLAMP,
    easing: Easing.out(Easing.cubic),
  });

  return (
    <SolaceGround>
      <BlockWordmark
        text="ROBIN TOWN"
        fontFamily={BUNGEE}
        fontSize={132}
        color={PALETTE.brandWordmarkGold}
        colors={[...DISTRICT_PALETTE.slice(0, 6)]}
        background="transparent"
        blockSizing="glyph"
        growDuration={8}
        spinDuration={26}
        splitDuration={5}
        ascenderDuration={8}
        holdDuration={16}
        flashStagger={2}
        flashDuration={3}
        flashToSwap={4}
        speed={speed}
        theme={ROBIN_THEME}
        mode="dark"
      />
      {/* Shophouse TownMark crest + subtitle lock in right above/below wordmark as letters resolve */}
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
          opacity: markIn,
          transform: `translateY(${(1 - markIn) * -14}px)`,
        }}
      >
        <div style={{ transform: "translateY(-138px)" }}>
          <TownMark size={80} />
        </div>
        <div
          style={{
            position: "absolute",
            top: "50%",
            marginTop: 88,
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "8px 20px",
            borderRadius: 999,
            background: "rgba(16, 42, 32, 0.9)",
            border: `1px solid ${PALETTE.borderEmerald}`,
            fontFamily: BE_VIETNAM,
            fontSize: 22,
            fontWeight: 600,
            color: PALETTE.accentMintPill,
            letterSpacing: "0.04em",
          }}
        >
          <span>● ROBINHOOD CHAIN · 46631</span>
          <span style={{ color: PALETTE.accentGold }}>·</span>
          <span style={{ color: PALETTE.parchmentWarm }}>BUILD WITH $WIF</span>
        </div>
      </AbsoluteFill>
    </SolaceGround>
  );
}

/** S03 (120f) & X03 (60f): @snapcn/laptop-frame notch connect + bezel dive into live 3D town. */
export function LaptopBezelDive({ fast = false }: { fast?: boolean }) {
  // LaptopFrame's PUSH_END is frame 185 at speed=1; scale speed so zoom-to-screen lands cleanly at clip end!
  const speed = fast ? 185 / 60 : 185 / 120;
  return (
    <SolaceGround>
      <LaptopFrame
        entrance="open"
        finale="zoom-to-screen"
        showNotch={true}
        notchLabel="Robinhood Chain 46631 · Year 1 Ready"
        indicatorColor={PALETTE.accentEmerald}
        bezelColor={PALETTE.bgHudDark}
        screenColor={PALETTE.bgCityStage}
        screenSrc={staticFile("clips/clip-01-living-town.mp4")}
        fontFamily={BE_VIETNAM}
        speed={speed}
        theme={ROBIN_THEME}
        mode="dark"
      />
    </SolaceGround>
  );
}
