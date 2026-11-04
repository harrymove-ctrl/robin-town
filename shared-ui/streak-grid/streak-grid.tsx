"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  PROJECT_STREAK_DATA,
  type GitHubContributionProfile,
  type ProjectBuildStage,
  type ProjectDailyEntry,
  type SingleProjectStreakData,
} from "./project-streak-data";

export type StreakLevel = 0 | 1 | 2 | 3 | 4;
export type BuildCategory = ProjectBuildStage["category"];

export interface StreakDayCell {
  date: string;
  monthShort: string;
  dayOfMonth: number;
  count: number;
  level: StreakLevel;
  category: BuildCategory;
  title: string;
  note: string;
  ideas: string[];
}

export interface StreakGridProps {
  days: StreakDayCell[];
  totalActivities: number;
  summaryLabel?: string;
  githubProfile?: GitHubContributionProfile | null;
  highlightCategory?: BuildCategory | "all";
  onSelectDay?: (day: StreakDayCell) => void;
  selectedDate?: string | null;
  className?: string;
}

const BUNUI_LEVEL_COLORS: Record<StreakLevel, string> = {
  0: "#121812",
  1: "#213d1e",
  2: "#3b6e33",
  3: "#5ea94f",
  4: "#95f965",
};

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const CATEGORY_LABELS: Record<BuildCategory, string> = {
  architecture: "Spec & Checkpoints",
  rust_core: "Core Engine",
  ai_agents: "AI & Interaction",
  spatial_ui: "UI & 3D Arena",
  qa_verify: "13-Point QA Gate",
  ship_demo: "Daily Sync & Ideas",
};

const ALL_CATEGORIES: BuildCategory[] = [
  "architecture",
  "rust_core",
  "ai_agents",
  "spatial_ui",
  "qa_verify",
  "ship_demo",
];

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function next() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function toLevel(count: number): StreakLevel {
  if (count <= 0) return 0;
  if (count <= 3) return 1;
  if (count <= 12) return 2;
  if (count <= 28) return 3;
  return 4;
}

export function buildSingleProjectStreakYear(
  project: SingleProjectStreakData,
  extraLocalIdeas: ProjectDailyEntry[],
  anchorIsoDate?: string,
): { days: StreakDayCell[]; totalActivities: number } {
  const stageNotes = project.buildStages.reduce(
    (acc, stage) => {
      acc[stage.category] = {
        title: `${project.projectName} · ${stage.phase}`,
        note: stage.outcome,
      };
      return acc;
    },
    {
      architecture: {
        title: `${project.projectName} · Architecture & Spec`,
        note: "Competition constraints, design checkpoints & milestone planning",
      },
      rust_core: {
        title: `${project.projectName} · Core Engine`,
        note: "Deterministic runtime logic, state transitions & safety guards",
      },
      ai_agents: {
        title: `${project.projectName} · Agentic & Interactive Loop`,
        note: "Core interactive loop & tool integration",
      },
      spatial_ui: {
        title: `${project.projectName} · 3-Variant UI Arena`,
        note: "Interactive UI variants, shaders & responsive layout polish",
      },
      qa_verify: {
        title: `${project.projectName} · Adversarial QA`,
        note: "End-to-end Playwright verification, stress checks & 0px overflow",
      },
      ship_demo: {
        title: `${project.projectName} · Daily Automation & Ideas`,
        note: "Daily 14:00 progress check, idea capture & demo preparation",
      },
    } as Record<BuildCategory, { title: string; note: string }>,
  );

  const entryByDate = new Map<string, ProjectDailyEntry>();
  for (const entry of project.dailyEntries) {
    entryByDate.set(entry.date, {
      ...entry,
      ideas: [...(entry.ideas || [])],
    });
  }
  for (const local of extraLocalIdeas) {
    const existing = entryByDate.get(local.date);
    if (existing) {
      existing.count += local.count;
      existing.ideas = [...local.ideas, ...existing.ideas];
      existing.note = local.note || existing.note;
    } else {
      entryByDate.set(local.date, { ...local });
    }
  }

  // 1. REAL GITHUB CONTRIBUTION CALENDAR (@harrymove-ctrl)
  const ghProfile = project.githubContributions;
  if (ghProfile && Array.isArray(ghProfile.days) && ghProfile.days.length > 0) {
    const extraCountSum = extraLocalIdeas.reduce(
      (acc, item) => acc + item.count,
      0,
    );
    const days: StreakDayCell[] = ghProfile.days.map((ghDay, idx) => {
      const dt = new Date(`${ghDay.date}T12:00:00Z`);
      const logged = entryByDate.get(ghDay.date);
      const localExtra = extraLocalIdeas
        .filter((e) => e.date === ghDay.date)
        .reduce((s, e) => s + e.count, 0);
      const count = ghDay.count + localExtra;
      const ghLevel = (ghDay.level ?? toLevel(count)) as StreakLevel;
      const level: StreakLevel =
        localExtra > 0
          ? (Math.max(ghLevel, toLevel(count)) as StreakLevel)
          : ghLevel;

      const fallbackCat = ALL_CATEGORIES[idx % ALL_CATEGORIES.length]!;
      const cat = logged ? logged.category : fallbackCat;
      const fallbackMeta = stageNotes[cat];

      const defaultNote =
        count > 0
          ? `Real GitHub activity on @${ghProfile.login}: ${count} contribution${count === 1 ? "" : "s"} (${fallbackMeta.note})`
          : `No GitHub commits or PRs recorded on ${ghDay.date} (@${ghProfile.login})`;

      return {
        date: ghDay.date,
        monthShort: MONTH_NAMES[dt.getUTCMonth()]!,
        dayOfMonth: dt.getUTCDate(),
        count,
        level,
        category: cat,
        title: logged ? logged.title : fallbackMeta.title,
        note: logged ? logged.note : defaultNote,
        ideas: logged ? logged.ideas : [],
      };
    });

    return {
      days,
      totalActivities: ghProfile.totalContributions + extraCountSum,
    };
  }

  // 2. Fallback deterministic calendar if offline without cache
  const weeks = 53;
  const totalCells = weeks * 7;
  const latestLogDate =
    project.dailyEntries[0]?.date ||
    project.lastSyncedAt.slice(0, 10) ||
    "2026-11-02";
  const resolvedAnchor = anchorIsoDate || latestLogDate;
  const anchor = new Date(`${resolvedAnchor}T12:00:00Z`);
  const rand = mulberry32(project.baseSeed);

  const rawCounts: number[] = [];
  const dates: Date[] = [];

  for (let i = totalCells - 1; i >= 0; i -= 1) {
    const dt = new Date(anchor.getTime() - i * 86_400_000);
    dates.push(dt);
    const iso = dt.toISOString().slice(0, 10);
    const logged = entryByDate.get(iso);
    const gitCount = project.gitDates?.[iso] || 0;
    const roll = rand();
    const synthetic =
      i === 0 ? 3 : roll > 0.65 ? Math.max(1, Math.round(roll * 6)) : 0;
    const baseVal = logged
      ? Math.max(logged.count, synthetic)
      : synthetic + gitCount;
    rawCounts.push(baseVal);
  }

  let runningTotal = 0;
  const days: StreakDayCell[] = dates.map((dt, idx) => {
    const iso = dt.toISOString().slice(0, 10);
    const logged = entryByDate.get(iso);
    const count = rawCounts[idx] ?? 0;
    runningTotal += count;
    const fallbackCat = ALL_CATEGORIES[idx % ALL_CATEGORIES.length]!;
    const cat = logged ? logged.category : fallbackCat;
    const fallbackMeta = stageNotes[cat];

    return {
      date: iso,
      monthShort: MONTH_NAMES[dt.getUTCMonth()]!,
      dayOfMonth: dt.getUTCDate(),
      count,
      level: toLevel(count),
      category: cat,
      title: logged ? logged.title : fallbackMeta.title,
      note: logged ? logged.note : fallbackMeta.note,
      ideas: logged ? logged.ideas : [],
    };
  });

  return { days, totalActivities: runningTotal };
}

/**
 * Pixel-faithful BunUI Streak Grid (`https://www.bunui.xyz/components/streak-grid`)
 * powered by real GitHub contribution data (@harrymove-ctrl).
 */
export function StreakGrid({
  days,
  totalActivities,
  summaryLabel = "GitHub contributions in the last year",
  githubProfile,
  highlightCategory = "all",
  onSelectDay,
  selectedDate,
  className = "",
}: StreakGridProps) {
  const weeks = useMemo(() => {
    const cols: StreakDayCell[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      cols.push(days.slice(i, i + 7));
    }
    return cols;
  }, [days]);

  const monthByCol = useMemo(() => {
    const map = new Map<number, string>();
    let lastMonth = "";
    let lastPlacedCol = -4;

    weeks.forEach((week, colIndex) => {
      const firstOfMonth = week.find((d) => d.dayOfMonth <= 7) ?? week[0];
      if (!firstOfMonth) return;
      if (firstOfMonth.monthShort !== lastMonth) {
        if (colIndex - lastPlacedCol >= 3) {
          map.set(colIndex, firstOfMonth.monthShort);
          lastPlacedCol = colIndex;
        }
        lastMonth = firstOfMonth.monthShort;
      }
    });
    return map;
  }, [weeks]);

  return (
    <div
      data-testid="bunui-streak-grid"
      className={`w-full rounded-2xl border border-zinc-800/90 bg-black p-5 text-zinc-100 shadow-2xl sm:p-6 ${className}`}
    >
      <div className="w-full overflow-x-auto pb-2">
        <div className="inline-block min-w-max">
          {/* Month Header Row */}
          <div
            aria-hidden="true"
            className="mb-2 grid grid-flow-col auto-cols-[13px] gap-[4px] text-[12px] leading-none font-normal text-[#8e8e93]"
          >
            {weeks.map((_, colIdx) => (
              <div
                key={`month-col-${colIdx}`}
                className="relative h-4 overflow-visible"
              >
                {monthByCol.has(colIdx) ? (
                  <span className="absolute top-0 left-0 whitespace-nowrap">
                    {monthByCol.get(colIdx)}
                  </span>
                ) : null}
              </div>
            ))}
          </div>

          {/* 7 x 53 Rounded Emerald Streak Matrix */}
          <div
            role="grid"
            aria-label={`${PROJECT_STREAK_DATA.projectName} yearly GitHub contribution and build streak grid`}
            className="grid grid-flow-col auto-cols-[13px] gap-[4px]"
          >
            {weeks.map((week, colIdx) => (
              <div
                key={`week-${colIdx}`}
                role="row"
                className="grid grid-rows-7 gap-[4px]"
              >
                {week.map((day) => {
                  const matchesFilter =
                    highlightCategory === "all" ||
                    day.category === highlightCategory;
                  const effectiveLevel: StreakLevel =
                    highlightCategory !== "all" &&
                    matchesFilter &&
                    day.count > 0
                      ? 4
                      : day.level;
                  const isSelected = selectedDate === day.date;

                  return (
                    <button
                      key={day.date}
                      type="button"
                      role="gridcell"
                      data-testid={`streak-cell-${day.date}`}
                      aria-label={`${day.date}: ${day.count} contributions, ${CATEGORY_LABELS[day.category]}`}
                      onMouseEnter={() => onSelectDay?.(day)}
                      onFocus={() => onSelectDay?.(day)}
                      onClick={() => onSelectDay?.(day)}
                      style={{
                        backgroundColor: BUNUI_LEVEL_COLORS[effectiveLevel],
                        opacity: matchesFilter ? 1 : 0.18,
                      }}
                      className={`h-[13px] w-[13px] rounded-[3.5px] transition-transform duration-150 hover:z-10 hover:scale-125 focus-visible:z-10 focus-visible:scale-125 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#95f965] ${
                        effectiveLevel === 4
                          ? "shadow-[0_0_8px_rgba(149,249,101,0.35)]"
                          : ""
                      } ${
                        isSelected
                          ? "ring-1 ring-white ring-offset-1 ring-offset-black"
                          : ""
                      }`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Summary, Real GitHub Breakdown & Less / More Legend */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[13px]">
        <div className="flex flex-wrap items-center gap-2.5">
          <p className="text-[#8e8e93] tabular-nums">
            <strong
              data-testid="streak-total-count"
              className="font-semibold text-white"
            >
              {totalActivities.toLocaleString("en-US")}
            </strong>{" "}
            {summaryLabel}
          </p>

          {githubProfile ? (
            <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px] text-zinc-400">
              <a
                href={githubProfile.url}
                target="_blank"
                rel="noreferrer"
                data-testid="github-profile-link"
                className="rounded-md border border-[#95f965]/30 bg-[#95f965]/10 px-2 py-0.5 font-semibold text-[#95f965] hover:bg-[#95f965]/20"
              >
                @{githubProfile.login}
              </a>
              <span className="rounded-md border border-zinc-800 bg-zinc-900/90 px-2 py-0.5">
                {githubProfile.commits} Commits
              </span>
              <span className="rounded-md border border-zinc-800 bg-zinc-900/90 px-2 py-0.5">
                {githubProfile.pullRequests} PRs
              </span>
              <span className="rounded-md border border-zinc-800 bg-zinc-900/90 px-2 py-0.5">
                {githubProfile.reviews} Reviews
              </span>
              <span className="rounded-md border border-zinc-800 bg-zinc-900/90 px-2 py-0.5">
                {githubProfile.issues} Issues
              </span>
            </div>
          ) : null}
        </div>

        <div
          aria-label="Activity intensity legend from less to more"
          className="flex items-center gap-1.5 text-xs text-[#8e8e93]"
        >
          <span className="mr-0.5">Less</span>
          {([0, 1, 2, 3, 4] as StreakLevel[]).map((lvl) => (
            <span
              key={`legend-${lvl}`}
              style={{ backgroundColor: BUNUI_LEVEL_COLORS[lvl] }}
              className="inline-block h-[12px] w-[12px] rounded-[3px]"
            />
          ))}
          <span className="ml-0.5">More</span>
        </div>
      </div>
    </div>
  );
}

export interface ProjectImpactStreakSectionProps {
  /** Kept optional for backward compatibility; always renders ONLY this project's isolated data. */
  defaultHackathonId?: string;
  heading?: string;
}

type StreakViewVariant = "impact_split" | "pure_bunui" | "daily_ideas";

/**
 * Isolated single-project BunUI Streak Grid + "What I Impact & How I Build" + Daily Idea Log.
 * Powered by real GitHub contribution data (@harrymove-ctrl).
 */
export function ProjectImpactStreakSection({
  heading = "Project Impact & How I Build",
}: ProjectImpactStreakSectionProps) {
  const project = PROJECT_STREAK_DATA;
  const storageKey = `bunui_streak_ideas_${project.projectId}`;

  const [viewVariant, setViewVariant] =
    useState<StreakViewVariant>("impact_split");
  const [activeCategory, setActiveCategory] = useState<BuildCategory | "all">(
    "all",
  );
  const [inspectedDay, setInspectedDay] = useState<StreakDayCell | null>(null);

  const [localIdeas, setLocalIdeas] = useState<ProjectDailyEntry[]>([]);
  const [ideaDraft, setIdeaDraft] = useState("");
  const [noteCategory, setNoteCategory] = useState<BuildCategory>("ship_demo");
  const [copiedCli, setCopiedCli] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as ProjectDailyEntry[];
        if (Array.isArray(parsed)) setLocalIdeas(parsed);
      }
    } catch {
      // Ignore storage errors
    }
  }, [storageKey]);

  const { days, totalActivities } = useMemo(
    () => buildSingleProjectStreakYear(project, localIdeas),
    [project, localIdeas],
  );

  const currentDay =
    inspectedDay ??
    [...days].reverse().find((d) => d.count > 0) ??
    days[days.length - 1] ??
    null;

  const mergedDailyFeed = useMemo(() => {
    const byDate = new Map<string, ProjectDailyEntry>();
    for (const item of project.dailyEntries) {
      byDate.set(item.date, { ...item, ideas: [...(item.ideas || [])] });
    }
    for (const extra of localIdeas) {
      const found = byDate.get(extra.date);
      if (found) {
        found.count += extra.count;
        found.ideas = [...extra.ideas, ...found.ideas];
      } else {
        byDate.set(extra.date, { ...extra });
      }
    }
    return Array.from(byDate.values()).sort((a, b) =>
      b.date.localeCompare(a.date),
    );
  }, [localIdeas, project.dailyEntries]);

  const handleAddIdea = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = ideaDraft.trim();
    if (!trimmed) return;
    const todayIso =
      days[days.length - 1]?.date || new Date().toISOString().slice(0, 10);
    const nextEntry: ProjectDailyEntry = {
      date: todayIso,
      count: 3,
      category: noteCategory,
      title: `${project.projectName} · Idea & Daily Update`,
      note: trimmed,
      ideas: [trimmed],
    };
    const updated = [nextEntry, ...localIdeas];
    setLocalIdeas(updated);
    setIdeaDraft("");
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch {
      // Ignore storage write errors
    }
  };

  const handleCopySyncCommand = async () => {
    const sampleIdea =
      ideaDraft.trim() || "New gameplay or architecture improvement";
    const cmd = `node /Volumes/Dev/shared/bunui-streak-grid/update-project-streak.mjs --project "${project.projectDir}" --idea "${sampleIdea.replace(/"/g, '\\"')}"`;
    try {
      await navigator.clipboard.writeText(cmd);
      setCopiedCli(true);
      setTimeout(() => setCopiedCli(false), 2000);
    } catch {
      // Clipboard may be restricted in headless contexts
    }
  };

  return (
    <section
      id="impact-streak"
      data-testid="hackathon-impact-streak-section"
      aria-labelledby="impact-streak-heading"
      className="mt-10 scroll-mt-24 rounded-2xl border border-zinc-800/90 bg-[#050608] p-5 text-zinc-100 shadow-xl sm:p-7"
    >
      {/* Single-Project Header + 3-Mode Switcher */}
      <div className="flex flex-col justify-between gap-4 border-b border-zinc-800/90 pb-5 lg:flex-row lg:items-end">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#95f965]/30 bg-[#95f965]/10 px-3 py-1 font-mono text-xs font-semibold text-[#95f965]">
              Daily Build &amp; Idea Streak · {project.projectName}
            </span>
            <span className="rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-1 font-mono text-[11px] text-zinc-400 tabular-nums">
              {project.competitionBadge}
            </span>
            {project.githubContributions ? (
              <a
                href={project.githubContributions.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-mono text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/20"
              >
                GitHub @{project.githubContributions.login} · LIVE
              </a>
            ) : null}
          </div>
          <h2
            id="impact-streak-heading"
            className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl"
          >
            {heading}
          </h2>
          <p className="max-w-3xl text-sm leading-relaxed text-zinc-400">
            {project.impactSummary}
          </p>
        </div>

        {/* 3 Single-Project View Modes */}
        <div
          role="group"
          aria-label="Project streak display mode"
          className="flex shrink-0 flex-wrap items-center gap-1 rounded-2xl border border-zinc-800 bg-zinc-900/90 p-1"
        >
          {(
            [
              { id: "impact_split", label: "Impact + Build" },
              { id: "pure_bunui", label: "Pure Streak" },
              { id: "daily_ideas", label: "Daily Ideas & Log" },
            ] as const
          ).map((mode) => (
            <button
              key={mode.id}
              type="button"
              data-testid={`streak-mode-${mode.id}`}
              onClick={() => setViewVariant(mode.id)}
              aria-pressed={viewVariant === mode.id}
              className={`min-h-10 rounded-xl px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-[#95f965] ${
                viewVariant === mode.id
                  ? "bg-[#95f965] text-black shadow-xs"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {/* Core BunUI Streak Grid Canvas (Real GitHub Contributions) */}
      <div className="mt-6">
        <StreakGrid
          days={days}
          totalActivities={totalActivities}
          summaryLabel="GitHub contributions in the last year"
          githubProfile={project.githubContributions}
          highlightCategory={activeCategory}
          selectedDate={currentDay?.date ?? null}
          onSelectDay={setInspectedDay}
        />

        {/* Zero-CLS Inline Day & Idea Readout */}
        {currentDay && viewVariant !== "pure_bunui" ? (
          <div
            data-testid="streak-day-inspector"
            className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-800/90 bg-zinc-950 px-4 py-3 text-xs"
          >
            <div className="flex min-w-0 flex-wrap items-center gap-2.5">
              <span className="font-mono font-semibold text-[#95f965] tabular-nums">
                {currentDay.date}
              </span>
              <span className="rounded-md bg-zinc-900 px-2 py-0.5 font-mono text-zinc-200 tabular-nums">
                {currentDay.count}{" "}
                {currentDay.count === 1 ? "contribution" : "contributions"}
              </span>
              <span className="rounded-md border border-[#95f965]/25 bg-[#95f965]/10 px-2 py-0.5 font-medium text-[#95f965]">
                {CATEGORY_LABELS[currentDay.category]}
              </span>
              <span className="min-w-0 truncate text-zinc-300">
                {currentDay.ideas[0]
                  ? `Idea: ${currentDay.ideas[0]}`
                  : currentDay.note}
              </span>
            </div>

            {activeCategory !== "all" ? (
              <button
                type="button"
                onClick={() => setActiveCategory("all")}
                className="min-h-10 shrink-0 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1 font-mono text-[11px] font-semibold text-zinc-200 hover:bg-zinc-800"
              >
                Clear Stage Filter
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Mode 1: Impact Metrics (4 Equal Cards) + How I Build Pipeline (3x2 Equal Grid) */}
      {viewVariant === "impact_split" ? (
        <div className="mt-7 space-y-6">
          {/* Top Row: 4 Equal-Height Impact Cards */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-mono text-xs font-bold tracking-wider text-[#95f965] uppercase">
                What I Impact for {project.projectName}
              </h3>
              <span className="font-mono text-[11px] text-zinc-400 tabular-nums">
                {project.stats.codeFiles} Source Files · {project.stats.rustFiles}{" "}
                Rust · {project.stats.testFiles} Tests
              </span>
            </div>

            <div className="grid grid-cols-1 items-stretch gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
              {project.impactMetrics.map((metric) => (
                <article
                  key={metric.label}
                  className="flex h-full min-h-[128px] flex-col justify-between rounded-xl border border-zinc-800/90 bg-zinc-950/90 p-4"
                >
                  <div>
                    <p className="font-mono text-[11px] font-medium tracking-wide text-zinc-400 uppercase">
                      {metric.label}
                    </p>
                    <p className="mt-1.5 text-xl font-extrabold text-white tabular-nums">
                      {metric.value}
                    </p>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                    {metric.detail}
                  </p>
                </article>
              ))}
            </div>
          </div>

          {/* Bottom Grid: 6 Equal-Height Build Stages in a Balanced 3x2 Grid */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-mono text-xs font-bold tracking-wider text-[#95f965] uppercase">
                How I Build (Click Stage to Filter Streak Grid)
              </h3>
              <span className="text-xs text-zinc-400">
                {activeCategory === "all"
                  ? "All project build stages visible"
                  : `Highlighting: ${CATEGORY_LABELS[activeCategory]}`}
              </span>
            </div>

            <div className="grid grid-cols-1 items-stretch gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {project.buildStages.map((stage) => {
                const selected = activeCategory === stage.category;
                return (
                  <button
                    key={`${stage.step}-${stage.phase}`}
                    type="button"
                    data-testid={`build-stage-${stage.category}`}
                    onClick={() =>
                      setActiveCategory((prev) =>
                        prev === stage.category ? "all" : stage.category,
                      )
                    }
                    aria-pressed={selected}
                    className={`flex h-full min-h-[128px] flex-col justify-between rounded-xl border p-4 text-left transition focus-visible:outline-2 focus-visible:outline-[#95f965] ${
                      selected
                        ? "border-[#95f965] bg-[#95f965]/10 shadow-xs"
                        : "border-zinc-800/90 bg-zinc-950/90 hover:border-zinc-700"
                    }`}
                  >
                    <div>
                      <span className="font-mono text-xs font-bold text-[#95f965] tabular-nums">
                        STEP {stage.step} · {stage.phase}
                      </span>
                      <p className="mt-1.5 font-mono text-[11px] text-zinc-300">
                        {stage.tool}
                      </p>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                      {stage.outcome}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {/* Mode 3: Daily Automation & Ideas Feed (Dedicated to This Project) */}
      {viewVariant === "daily_ideas" ? (
        <div
          data-testid="project-daily-ideas-panel"
          className="mt-7 grid grid-cols-1 gap-6 lg:grid-cols-12"
        >
          <form
            onSubmit={handleAddIdea}
            className="space-y-4 rounded-2xl border border-zinc-800/90 bg-zinc-950/90 p-5 lg:col-span-5"
          >
            <div>
              <h3 className="font-mono text-xs font-bold tracking-wider text-[#95f965] uppercase">
                Add Daily Idea or Build Update
              </h3>
              <p className="mt-1 text-xs text-zinc-400">
                Capture new ideas for {project.projectName}. Daily 14:00
                automation also syncs{" "}
                <code className="text-zinc-200">streak-log.json</code>{" "}
                automatically.
              </p>
            </div>

            <label className="block space-y-1.5 text-xs font-medium text-zinc-300">
              <span>Stage Category</span>
              <select
                value={noteCategory}
                onChange={(e) =>
                  setNoteCategory(e.target.value as BuildCategory)
                }
                className="min-h-10 w-full rounded-xl border border-zinc-800 bg-black px-3 text-xs text-zinc-100 focus:border-[#95f965] focus:outline-none"
              >
                {ALL_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {CATEGORY_LABELS[cat]}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1.5 text-xs font-medium text-zinc-300">
              <span>Idea or Milestone Note</span>
              <textarea
                rows={3}
                data-testid="idea-input"
                placeholder={`Add next idea for ${project.projectName}...`}
                value={ideaDraft}
                onChange={(e) => setIdeaDraft(e.target.value)}
                className="w-full rounded-xl border border-zinc-800 bg-black p-3 text-xs text-zinc-100 focus:border-[#95f965] focus:outline-none"
              />
            </label>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="submit"
                data-testid="add-idea-btn"
                className="min-h-10 flex-1 rounded-xl bg-[#95f965] px-4 py-2 text-xs font-bold text-black transition hover:bg-[#82ea52]"
              >
                Log Idea to Today&apos;s Streak
              </button>
              <button
                type="button"
                onClick={() => void handleCopySyncCommand()}
                className="min-h-10 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-[11px] font-semibold text-zinc-200 hover:bg-zinc-800"
              >
                {copiedCli ? "Copied CLI" : "Copy CLI Sync"}
              </button>
            </div>
          </form>

          <div className="space-y-3 lg:col-span-7">
            <h3 className="font-mono text-xs font-bold tracking-wider text-[#95f965] uppercase">
              Daily Automation &amp; Idea Timeline ({mergedDailyFeed.length}{" "}
              Days Logged)
            </h3>
            {mergedDailyFeed.map((entry) => (
              <article
                key={`${entry.date}-${entry.title}`}
                className="rounded-2xl border border-zinc-800/90 bg-zinc-950/90 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-[#95f965] tabular-nums">
                    {entry.date} · {entry.title}
                  </span>
                  <span className="rounded-md bg-zinc-900 px-2 py-0.5 font-mono text-[11px] text-zinc-300 tabular-nums">
                    +{entry.count} streak
                  </span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
                  {entry.note}
                </p>
                {entry.ideas && entry.ideas.length > 0 ? (
                  <ul className="mt-2.5 space-y-1 border-t border-zinc-800/80 pt-2 text-xs text-zinc-200">
                    {entry.ideas.map((idea, idx) => (
                      <li
                        key={`${entry.date}-idea-${idx}`}
                        className="flex items-start gap-2"
                      >
                        <span className="font-mono text-[#95f965]">*</span>
                        <span>{idea}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

/** Alias preserved so existing imports remain 100% compatible. */
export const HackathonImpactStreakSection = ProjectImpactStreakSection;
