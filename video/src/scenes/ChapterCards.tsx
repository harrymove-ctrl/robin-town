import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { CheckCycle } from "@/components/snap-cn/check-cycle";
import { PunchLines } from "@/components/snap-cn/punch-lines";
import { TextHighlight } from "@/components/snap-cn/text-highlight";
import { WordGather } from "@/components/snap-cn/word-gather";
import { SolaceGround } from "../components/TownMark";
import { PALETTE } from "../palette";
import { BE_VIETNAM, ROBIN_THEME } from "../theme";

const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** S04 (120f): Chapter 1 Turn using @snapcn/word-gather + @snapcn/text-highlight (marker). */
export function ChapterLivingTownCard() {
  const frame = useCurrentFrame();
  const subIn = interpolate(frame, [46, 62], [0, 1], {
    ...CLAMP,
    easing: Easing.out(Easing.cubic),
  });
  return (
    <SolaceGround>
      <AbsoluteFill style={{ transform: "translateY(-108px) scale(0.86)" }}>
        <WordGather
          text="One living neighborhood."
          maxWidth={580}
          accent={PALETTE.accentJade}
          fontFamily={BE_VIETNAM}
          fontWeight={600}
          speed={0.95}
          theme={{ ...ROBIN_THEME, background: "transparent", foreground: PALETTE.parchmentLight }}
          mode="dark"
        />
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          paddingTop: 245,
          opacity: subIn,
          transform: `translateY(${(1 - subIn) * 14}px)`,
        }}
      >
        <TextHighlight
          before=""
          highlight="Two instant views."
          after=""
          preset="marker"
          baseColor={PALETTE.parchmentLight}
          accentColor={PALETTE.accentEmerald}
          highlightedTextColor={PALETTE.parchmentLight}
          fontFamily={BE_VIETNAM}
          fontSize={58}
          fontWeight={700}
          startAt={54}
          drawDuration={24}
          theme={ROBIN_THEME}
          mode="dark"
        />
      </AbsoluteFill>
    </SolaceGround>
  );
}

/** S06 (120f) & X05a (60f): Chapter 2 Contrast Cards using @snapcn/punch-lines. */
export function ChapterOtcPunch({ fast = false }: { fast?: boolean }) {
  if (fast) {
    return (
      <SolaceGround>
        <PunchLines
          script="Cash. Tiles. Deeds. | Everything is negotiable."
          styles="slide,punch"
          sizes="0.92,1.15"
          holds="28,32"
          accentBeat={2}
          accentColor={PALETTE.accentGold}
          lead={3}
          fontFamily={BE_VIETNAM}
          fontSize={74}
          fontWeight={700}
          theme={{ ...ROBIN_THEME, background: "transparent" }}
          mode="dark"
        />
      </SolaceGround>
    );
  }
  return (
    <SolaceGround>
      <PunchLines
        script="Cash. Shop tiles. Street deeds. | Bundle any deal across the mat. | Everything is negotiable."
        styles="slide,slide,punch"
        sizes="0.88,0.88,1.18"
        holds="40,40,40"
        accentBeat={3}
        accentColor={PALETTE.accentGold}
        lead={4}
        fontFamily={BE_VIETNAM}
        fontSize={72}
        fontWeight={700}
        theme={{ ...ROBIN_THEME, background: "transparent" }}
        mode="dark"
      />
    </SolaceGround>
  );
}

/** S11 (120f): Chapter 4 $wif Flywheel Card using @snapcn/word-gather + @snapcn/text-highlight (underline). */
export function ChapterFlywheelCard() {
  const frame = useCurrentFrame();
  const subIn = interpolate(frame, [44, 60], [0, 1], {
    ...CLAMP,
    easing: Easing.out(Easing.cubic),
  });
  return (
    <SolaceGround>
      <AbsoluteFill style={{ transform: "translateY(-108px) scale(0.86)" }}>
        <WordGather
          text="Play free."
          maxWidth={580}
          accent={PALETTE.accentEmerald}
          fontFamily={BE_VIETNAM}
          fontWeight={600}
          speed={0.95}
          theme={{ ...ROBIN_THEME, background: "transparent", foreground: PALETTE.parchmentLight }}
          mode="dark"
        />
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          paddingTop: 245,
          opacity: subIn,
          transform: `translateY(${(1 - subIn) * 14}px)`,
        }}
      >
        <TextHighlight
          before="Stake, compete, and "
          highlight="burn $wif."
          after=""
          preset="underline"
          baseColor={PALETTE.parchmentLight}
          accentColor={PALETTE.accentGold}
          fontFamily={BE_VIETNAM}
          fontSize={58}
          fontWeight={700}
          startAt={54}
          drawDuration={24}
          thickness={5}
          theme={ROBIN_THEME}
          mode="dark"
        />
      </AbsoluteFill>
    </SolaceGround>
  );
}

/** S14 (180f): Chapter 5 Craft & P2P Rooms Slot Roll using @snapcn/check-cycle. */
export function ChapterCraftCheckCycle() {
  return (
    <SolaceGround>
      <CheckCycle
        headline="Built with"
        words="ROBIN-POD Wheel, Apple Carousel, SolaceUI Shader, WebSocket Rooms, Chain ID 46631"
        fontFamily={BE_VIETNAM}
        theme={{
          ...ROBIN_THEME,
          background: PALETTE.bgDeep,
          primary: PALETTE.accentEmerald,
          foreground: PALETTE.parchmentLight,
        }}
        mode="dark"
      />
    </SolaceGround>
  );
}
