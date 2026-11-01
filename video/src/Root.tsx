import "./index.css";
import { Composition } from "remotion";
import { MASTER_LAYOUT, RobinTownMaster, RobinTownXClip, X_LAYOUT } from "./compositions";
import { FPS } from "./grid";
import { INTRO_FRAMES, RobinTownIntro } from "./scenes/RaylightIntro";
import { DISPATCH_STILL_FRAMES, DispatchBannerStill } from "./scenes/DispatchBannerStill";

export function RemotionRoot() {
  return (
    <>
      <Composition
        id="DispatchBannerStill"
        component={DispatchBannerStill}
        durationInFrames={DISPATCH_STILL_FRAMES}
        fps={FPS}
        width={1920}
        height={1080}
      />
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
