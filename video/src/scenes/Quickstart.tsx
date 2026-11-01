import { TerminalSimulator } from "@/components/snap-cn/terminal-simulator";
import { SolaceGround } from "../components/TownMark";
import { PALETTE } from "../palette";
import { BE_VIETNAM, MONO, ROBIN_THEME } from "../theme";

/** S17 (300f / 5 bars): @snapcn/terminal-simulator single-camera flythrough quickstart. */
export function Quickstart() {
  return (
    <SolaceGround>
      <TerminalSimulator
        intro="Run your own *Robin-Town* in *seconds.*"
        command={{
          managers: ["git", "npm", "pnpm"],
          text: "git clone https://github.com/harrymove-ctrl/robin-town",
        }}
        lines={[
          { text: "npm install && npm test", type: "command", delay: 6 },
          { text: "✓ 926 tests passed (26 suites), 69/69 pixel sprites verified", type: "success", delay: 8 },
          { text: "npm run dev", type: "command", delay: 10 },
          { text: "✓ Robin-Town live at http://127.0.0.1:5173 · Chain ID 46631", type: "success", delay: 8 },
        ]}
        background={PALETTE.bgHudDark}
        borderColor={PALETTE.borderEmerald}
        fontFamily={BE_VIETNAM}
        charsPerFrame={1.8}
        chunkSize={3}
        zoom={{ enabled: true, scale: 2.15 }}
        theme={{
          ...ROBIN_THEME,
          background: PALETTE.bgDeep,
          fontFamily: MONO,
        }}
        mode="dark"
      />
    </SolaceGround>
  );
}
