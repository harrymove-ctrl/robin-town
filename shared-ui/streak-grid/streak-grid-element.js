/**
 * Framework-agnostic BunUI Streak Grid Web Component (<bunui-streak-grid>)
 * Works in plain HTML, Vite, Atlassian Forge Custom UI, Vue, Svelte, or React.
 */
const BUNUI_COLORS = ["#121812", "#213d1e", "#3b6e33", "#5ea94f", "#95f965"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function seededRandom(seed) {
  let t = seed >>> 0;
  return function next() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

class BunUIStreakGridElement extends HTMLElement {
  connectedCallback() {
    const seed = Number(this.getAttribute("seed") || "995");
    const target = Number(this.getAttribute("activities") || "995");
    const label = this.getAttribute("label") || "activities last year";
    const anchor = new Date("2026-10-31T12:00:00Z");
    const rand = seededRandom(seed);

    const weeks = 53;
    const totalCells = weeks * 7;
    const raw = [];
    const dates = [];

    for (let i = totalCells - 1; i >= 0; i--) {
      const dt = new Date(anchor.getTime() - i * 86400000);
      dates.push(dt);
      const roll = rand();
      raw.push(roll > 0.25 ? Math.max(1, Math.round(roll * roll * 10)) : 0);
    }

    const sum = raw.reduce((a, b) => a + b, 0) || 1;
    const scale = target / sum;
    let total = 0;

    const cells = dates.map((dt, idx) => {
      const count = raw[idx] === 0 ? 0 : Math.max(1, Math.round(raw[idx] * scale));
      total += count;
      const level = count === 0 ? 0 : count <= 2 ? 1 : count <= 5 ? 2 : count <= 9 ? 3 : 4;
      return {
        iso: dt.toISOString().slice(0, 10),
        month: MONTHS[dt.getUTCMonth()],
        day: dt.getUTCDate(),
        count,
        level,
      };
    });

    if (cells.length > 0 && total !== target) {
      const last = cells[cells.length - 1];
      const nextCount = Math.max(4, last.count + (target - total));
      total += nextCount - last.count;
      last.count = nextCount;
      last.level = 4;
    }

    let lastMonth = "";
    let lastPlaced = -4;
    const monthLabels = new Map();
    for (let c = 0; c < weeks; c++) {
      const week = cells.slice(c * 7, c * 7 + 7);
      const m = (week.find((d) => d.day <= 7) || week[0]).month;
      if (m !== lastMonth) {
        if (c - lastPlaced >= 3) {
          monthLabels.set(c, m);
          lastPlaced = c;
        }
        lastMonth = m;
      }
    }

    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        :host { display: block; font-family: ui-sans-serif, system-ui, sans-serif; }
        .card { background: #000; border: 1px solid #27272a; border-radius: 24px; padding: 24px; color: #f4f4f5; }
        .scroll { overflow-x: auto; padding-bottom: 6px; }
        .months, .cols { display: grid; grid-auto-flow: column; grid-auto-columns: 13px; gap: 4px; width: max-content; }
        .months { margin-bottom: 8px; color: #8e8e93; font-size: 12px; height: 15px; }
        .mcell { position: relative; }
        .mcell span { position: absolute; left: 0; top: 0; white-space: nowrap; }
        .wcol { display: grid; grid-template-rows: repeat(7, 13px); gap: 4px; }
        .cell { width: 13px; height: 13px; border-radius: 3.5px; transition: transform 140ms ease; cursor: pointer; }
        .cell:hover { transform: scale(1.25); outline: 1px solid #fff; }
        .footer { margin-top: 14px; display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; font-size: 13px; color: #8e8e93; font-variant-numeric: tabular-nums; }
        .footer strong { color: #fff; font-weight: 600; }
        .legend { display: flex; align-items: center; gap: 5px; font-size: 12px; }
        .sw { width: 12px; height: 12px; border-radius: 3px; display: inline-block; }
      </style>
      <div class="card">
        <div class="scroll">
          <div class="months">
            ${Array.from({ length: weeks }, (_, c) => `<div class="mcell">${monthLabels.has(c) ? `<span>${monthLabels.get(c)}</span>` : ""}</div>`).join("")}
          </div>
          <div class="cols">
            ${Array.from({ length: weeks }, (_, c) => {
              const week = cells.slice(c * 7, c * 7 + 7);
              return `<div class="wcol">${week.map((d) => `<div class="cell" title="${d.iso}: ${d.count} activities" style="background:${BUNUI_COLORS[d.level]}"></div>`).join("")}</div>`;
            }).join("")}
          </div>
        </div>
        <div class="footer">
          <span><strong>${total.toLocaleString("en-US")}</strong> ${label}</span>
          <span class="legend">Less ${BUNUI_COLORS.map((hex) => `<i class="sw" style="background:${hex}"></i>`).join("")} More</span>
        </div>
      </div>
    `;
  }
}

if (typeof window !== "undefined" && !customElements.get("bunui-streak-grid")) {
  customElements.define("bunui-streak-grid", BunUIStreakGridElement);
}
