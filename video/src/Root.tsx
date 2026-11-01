import "./index.css";
import { Composition } from "remotion";
import { MASTER_LAYOUT, RobinTownMaster, RobinTownXClip, X_LAYOUT } from "./compositions";
import { FPS } from "./grid";
import { INTRO_FRAMES, RobinTownIntro } from "./scenes/RaylightIntro";

export function RemotionRoot() {
  return (
    <>
      <Composition
        id="RobinTownIntro"
        component={RobinTownIntro}
        durationInFrames={INTRO_FRAMES}
        fps={FPS}
        width={1920}
        height={1080}
      />
      <Composition
        id="RobinTownMaster"
        component={RobinTownMaster}
        durationInFrames={MASTER_LAYOUT.total}
        fps={FPS}
        width={1920}
        height={1080}
      />
      <Composition
        id="RobinTownXClip"
        component={RobinTownXClip}
        durationInFrames={X_LAYOUT.total}
        fps={FPS}
        width={1920}
        height={1080}
      />
    </>
  );
}
