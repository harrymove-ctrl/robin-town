/* Isolated single-project streak & daily idea data for Robin-Town.
 * Auto-synced from /Volumes/Dev/china-town/streak-log.json via update-project-streak.mjs.
 * Contains ONLY this project's telemetry and ideas (zero cross-hackathon data).
 */
export interface ProjectImpactMetric {
  label: string;
  value: string;
  detail: string;
}

export interface ProjectBuildStage {
  step: string;
  phase: string;
  category: "architecture" | "rust_core" | "ai_agents" | "spatial_ui" | "qa_verify" | "ship_demo";
  tool: string;
  outcome: string;
}

export interface ProjectDailyEntry {
  date: string;
  count: number;
  category: ProjectBuildStage["category"];
  title: string;
  note: string;
  ideas: string[];
}

export interface SingleProjectStreakData {
  projectId: string;
  projectName: string;
  competitionBadge: string;
  headline: string;
  impactSummary: string;
  baseSeed: number;
  targetActivities: number;
  lastSyncedAt: string;
  projectDir: string;
  stats: {
    codeFiles: number;
    rustFiles: number;
    testFiles: number;
  };
  gitDates: Record<string, number>;
  impactMetrics: ProjectImpactMetric[];
  buildStages: ProjectBuildStage[];
  dailyEntries: ProjectDailyEntry[];
}

export const PROJECT_STREAK_DATA: SingleProjectStreakData = {
  "projectId": "robin-town",
  "projectName": "Robin-Town",
  "competitionBadge": "Robinhood Chain Hackathon · 10,000 USDG",
  "headline": "Isometric Pixel-Art City Economy & $wif Flywheel on Chain 46631",
  "impactSummary": "Turns Robinhood Chain Testnet (Chain ID 46631) onboarding into an instant 60fps isometric district builder powered by pure Node PNG sprite generation.",
  "baseSeed": 46631,
  "targetActivities": 864,
  "impactMetrics": [
    {
      "label": "Target Chain",
      "value": "Chain 46631",
      "detail": "Robinhood Chain Testnet native $wif economic loop"
    },
    {
      "label": "Sprite Engine",
      "value": "Pure Node PNG",
      "detail": "Deterministic pixel-art isometric tiles & neon storefronts"
    },
    {
      "label": "Client Stack",
      "value": "TS 7 + Vite 8",
      "detail": "Sub-second load with procedural WebAudio street synth"
    },
    {
      "label": "Verification",
      "value": "E2E Verified",
      "detail": "Completed and verified across desktop & mobile viewports"
    }
  ],
  "buildStages": [
    {
      "step": "01",
      "phase": "District & Token Spec",
      "category": "architecture",
      "tool": "PROJECT.md + Tokenomics Model",
      "outcome": "Balanced $wif yield sinks and district upgrades"
    },
    {
      "step": "02",
      "phase": "Procedural Pixel Forge",
      "category": "rust_core",
      "tool": "Node PNG/SVG Asset Pipeline",
      "outcome": "Generated crisp isometric buildings, roads & citizens"
    },
    {
      "step": "03",
      "phase": "Chain 46631 Integration",
      "category": "ai_agents",
      "tool": "Robinhood Chain Testnet RPC",
      "outcome": "Frictionless testnet onboarding & state persistence"
    },
    {
      "step": "04",
      "phase": "Playwright QA Gate",
      "category": "qa_verify",
      "tool": "TEST_READY.md + Browser E2E",
      "outcome": "Zero console errors & 0px overflow verified"
    }
  ],
  "dailyEntries": [
    {
      "date": "2026-10-31",
      "count": 8,
      "category": "qa_verify",
      "title": "Daily 14:00 Check & Isolated Robin-Town Streak Synced",
      "note": "Verified Chain 46631 build readiness ahead of Nov 2 submission deadline.",
      "ideas": [
        "Highlight fastest 60-second district upgrade loop in opening demo clip"
      ]
    }
  ],
  "lastSyncedAt": "2026-10-31T10:36:50.641Z",
  "projectDir": "/Volumes/Dev/china-town",
  "stats": {
    "codeFiles": 130,
    "rustFiles": 0,
    "testFiles": 40
  },
  "gitDates": {
    "2026-10-30": 5
  }
};
