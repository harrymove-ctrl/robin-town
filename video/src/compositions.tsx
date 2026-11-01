// Complete 120 BPM @ 30fps timeline assemblies for:
//   - RobinTownMaster (6,000 frames = 100 bars = 3:20.0)
//   - RobinTownXClip  (1,320 frames =  22 bars = 0:44.0)
import { AbsoluteFill, Sequence } from "remotion";
import { MasterAudio, XClipAudio } from "./audio";
import { FontGate } from "./components/TownMark";
import { Footage } from "./Footage";
import { layout } from "./grid";
import { PALETTE } from "./palette";
import {
  ChapterCraftCheckCycle,
  ChapterFlywheelCard,
  ChapterLivingTownCard,
  ChapterOtcPunch,
} from "./scenes/ChapterCards";
import { EndLockup } from "./scenes/EndLockup";
import { EngineProof } from "./scenes/EngineProof";
import { MetricMorph } from "./scenes/MetricMorph";
import { MultiSeatStack } from "./scenes/MultiSeatStack";
import { BrandBlockReveal, LaptopBezelDive, OpeningSwarm } from "./scenes/Opening";
import { OrbitFlow } from "./scenes/OrbitFlow";
import { Quickstart } from "./scenes/Quickstart";
import { MASTER_SHOTS, X_SHOTS } from "./shots";

export const MASTER_LAYOUT = layout([
  ["S01", 4],
  ["S02", 2],
  ["S03", 2],
  ["S04", 2],
  ["S05", 14],
  ["S06", 2],
  ["S07", 14],
  ["S08", 3],
  ["S09", 8],
  ["S10", 5],
  ["S11", 2],
  ["S12", 8],
  ["S13a", 2],
  ["S13b", 6],
  ["S14", 3],
  ["S15", 8],
  ["S16", 5],
  ["S17", 5],
  ["S18", 5],
] as const);

export const X_LAYOUT = layout([
  ["X01", 2],
  ["X02", 1],
  ["X03", 1],
  ["X04", 5],
  ["X05a", 1],
  ["X05b", 3],
  ["X06a", 1],
  ["X06b", 1],
  ["X06c", 3],
  ["X07", 2],
  ["X08", 2],
] as const);

export function RobinTownMaster() {
  const S = MASTER_LAYOUT.scenes;
  return (
    <FontGate>
      <AbsoluteFill style={{ backgroundColor: PALETTE.bgDeep }}>
        <MasterAudio />

        <Sequence from={S.S01.from} durationInFrames={S.S01.frames} name="S01-OpeningSwarm">
          <OpeningSwarm />
        </Sequence>
        <Sequence from={S.S02.from} durationInFrames={S.S02.frames} name="S02-BrandBlockReveal">
          <BrandBlockReveal />
        </Sequence>
        <Sequence from={S.S03.from} durationInFrames={S.S03.frames} name="S03-LaptopBezelDive">
          <LaptopBezelDive />
        </Sequence>

        <Sequence from={S.S04.from} durationInFrames={S.S04.frames} name="S04-Ch1Card">
          <ChapterLivingTownCard />
        </Sequence>
        <Sequence from={S.S05.from} durationInFrames={S.S05.frames} name="S05-LivingTownFootage">
          <Footage shot={MASTER_SHOTS.S05} />
        </Sequence>

        <Sequence from={S.S06.from} durationInFrames={S.S06.frames} name="S06-Ch2OtcPunch">
          <ChapterOtcPunch />
        </Sequence>
        <Sequence from={S.S07.from} durationInFrames={S.S07.frames} name="S07-OtcBargainFootage">
          <Footage shot={MASTER_SHOTS.S07} />
        </Sequence>

        <Sequence from={S.S08.from} durationInFrames={S.S08.frames} name="S08-Ch3OrbitFlow">
          <OrbitFlow frames={S.S08.frames} />
        </Sequence>
        <Sequence from={S.S09.from} durationInFrames={S.S09.frames} name="S09-PaydayDropFootage">
          <Footage shot={MASTER_SHOTS.S09} />
        </Sequence>
        <Sequence from={S.S10.from} durationInFrames={S.S10.frames} name="S10-EngineProof">
          <EngineProof />
        </Sequence>

        <Sequence from={S.S11.from} durationInFrames={S.S11.frames} name="S11-Ch4FlywheelCard">
          <ChapterFlywheelCard />
        </Sequence>
        <Sequence from={S.S12.from} durationInFrames={S.S12.frames} name="S12-WifFlywheelFootage">
          <Footage shot={MASTER_SHOTS.S12} />
        </Sequence>
        <Sequence from={S.S13a.from} durationInFrames={S.S13a.frames} name="S13a-MetricMorph">
          <MetricMorph />
        </Sequence>
        <Sequence from={S.S13b.from} durationInFrames={S.S13b.frames} name="S13b-Year6Standings">
          <Footage shot={MASTER_SHOTS.S13b} />
        </Sequence>

        <Sequence from={S.S14.from} durationInFrames={S.S14.frames} name="S14-Ch5CheckCycle">
          <ChapterCraftCheckCycle />
        </Sequence>
        <Sequence from={S.S15.from} durationInFrames={S.S15.frames} name="S15-GadgetsAndRooms">
          <Footage shot={MASTER_SHOTS.S15} />
        </Sequence>
        <Sequence from={S.S16.from} durationInFrames={S.S16.frames} name="S16-MultiSeatStack">
          <MultiSeatStack />
        </Sequence>

        <Sequence from={S.S17.from} durationInFrames={S.S17.frames} name="S17-Quickstart">
          <Quickstart />
        </Sequence>
        <Sequence from={S.S18.from} durationInFrames={S.S18.frames} name="S18-EndLockup">
          <EndLockup />
        </Sequence>
      </AbsoluteFill>
    </FontGate>
  );
}

export function RobinTownXClip() {
  const X = X_LAYOUT.scenes;
  return (
    <FontGate>
      <AbsoluteFill style={{ backgroundColor: PALETTE.bgDeep }}>
        <XClipAudio />

        <Sequence from={X.X01.from} durationInFrames={X.X01.frames} name="X01-OpeningSwarm">
          <OpeningSwarm fast />
        </Sequence>
        <Sequence from={X.X02.from} durationInFrames={X.X02.frames} name="X02-BrandBlockReveal">
          <BrandBlockReveal fast />
        </Sequence>
        <Sequence from={X.X03.from} durationInFrames={X.X03.frames} name="X03-LaptopBezelDive">
          <LaptopBezelDive fast />
        </Sequence>
        <Sequence from={X.X04.from} durationInFrames={X.X04.frames} name="X04-LivingTownToggle">
          <Footage shot={X_SHOTS.X04} />
        </Sequence>
        <Sequence from={X.X05a.from} durationInFrames={X.X05a.frames} name="X05a-OtcPunch">
          <ChapterOtcPunch fast />
        </Sequence>
        <Sequence from={X.X05b.from} durationInFrames={X.X05b.frames} name="X05b-OtcDeal">
          <Footage shot={X_SHOTS.X05b} />
        </Sequence>
        <Sequence from={X.X06a.from} durationInFrames={X.X06a.frames} name="X06a-PaydayDrop">
          <Footage shot={X_SHOTS.X06Payday} />
        </Sequence>
        <Sequence from={X.X06b.from} durationInFrames={X.X06b.frames} name="X06b-MetricMorph">
          <MetricMorph fast />
        </Sequence>
        <Sequence from={X.X06c.from} durationInFrames={X.X06c.frames} name="X06c-FlywheelCallout">
          <Footage shot={X_SHOTS.X06Flywheel} />
        </Sequence>
        <Sequence from={X.X07.from} durationInFrames={X.X07.frames} name="X07-RobinPodWheel">
          <Footage shot={X_SHOTS.X07} />
        </Sequence>
        <Sequence from={X.X08.from} durationInFrames={X.X08.frames} name="X08-EndLockup">
          <EndLockup />
        </Sequence>
      </AbsoluteFill>
    </FontGate>
  );
}
