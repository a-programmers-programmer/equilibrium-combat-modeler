/**
 * Hour-based DPS progression curves + SVG plot.
 * Also documents Rejuvenated rules.
 *
 * Usage: npx tsx scripts/plot-dps-hours.ts
 */
import { writeFileSync, mkdirSync } from "fs";
import type { Path } from "../src/lib/eq/blessings.ts";
import { stageById, type Style, GEAR_STAGES } from "../src/lib/eq/gear.ts";
import { modelCombat, gearFromPackage, gearFromRegions, type GearSnapshot } from "../src/lib/eq/model.ts";
import { REGION_PACKAGES } from "../src/lib/eq/items.ts";
import {
  legalCombatLoadouts,
  stackRelicPlayerMult,
  validateRelicLoadout,
  type RelicId,
  activeRelicsFromLoadout,
} from "../src/lib/eq/sim/relics.ts";
import { pickBestFamiliar, type FamiliarId } from "../src/lib/eq/sim/summoning.ts";
import { Player } from "../src/lib/eq/sim/player.ts";
import type { RegionTag } from "../src/lib/eq/sim/requirements.ts";

const PATH: Path[] = ["Order", "Chaos", "Order", "Balance", "Order", "Chaos"];

/** Route definitions for curves */
interface Route {
  id: string;
  name: string;
  color: string;
  /** electives unlocked by hour */
  electivesAt: { hour: number; electives: RegionTag[] }[];
  /** summoning level curve */
  sumAt: { hour: number; level: number }[];
  /** combat style */
  style: Style;
  /** relic loadout id from legalCombatLoadouts, applied when hour >= unlockHour */
  relicPlan: { hour: number; loadoutId: string }[];
}

const ROUTES: Route[] = [
  {
    id: "free-necro-titan",
    name: "Free necro + Steel titan (Devout→Infernal)",
    color: "#38bdf8",
    electivesAt: [{ hour: 0, electives: [] }],
    sumAt: [
      { hour: 0, level: 30 },
      { hour: 4, level: 55 },
      { hour: 10, level: 75 },
      { hour: 18, level: 90 },
      { hour: 28, level: 95 },
      { hour: 40, level: 99 },
    ],
    style: "necromancy",
    relicPlan: [
      { hour: 8, loadoutId: "devout-only" },
      { hour: 22, loadoutId: "devout-plus-infernal" },
      { hour: 35, loadoutId: "icyenic-devout-infernal" },
    ],
  },
  {
    id: "forinthry-ripper",
    name: "Forinthry + Ripper + Devout→Infernal",
    color: "#f472b6",
    electivesAt: [
      { hour: 0, electives: [] },
      { hour: 12, electives: ["forinthry"] },
      { hour: 20, electives: ["forinthry", "asgarnia"] },
      { hour: 30, electives: ["forinthry", "asgarnia", "desert"] },
    ],
    sumAt: [
      { hour: 0, level: 30 },
      { hour: 6, level: 60 },
      { hour: 14, level: 85 },
      { hour: 22, level: 96 },
      { hour: 32, level: 99 },
    ],
    style: "necromancy",
    relicPlan: [
      { hour: 10, loadoutId: "devout-only" },
      { hour: 24, loadoutId: "devout-plus-infernal" },
      { hour: 38, loadoutId: "icyenic-devout-infernal" },
    ],
  },
  {
    id: "melee-aegis",
    name: "Melee Aegis (Mory/Asg) + Infernal path",
    color: "#fbbf24",
    electivesAt: [
      { hour: 0, electives: [] },
      { hour: 10, electives: ["asgarnia"] },
      { hour: 18, electives: ["asgarnia", "morytania"] },
      { hour: 28, electives: ["asgarnia", "morytania", "forinthry"] },
    ],
    sumAt: [
      { hour: 0, level: 25 },
      { hour: 8, level: 70 },
      { hour: 20, level: 90 },
      { hour: 36, level: 99 },
    ],
    style: "melee",
    relicPlan: [
      { hour: 12, loadoutId: "icyenic-only" },
      { hour: 20, loadoutId: "infernal-only" },
      { hour: 26, loadoutId: "devout-plus-infernal" },
      { hour: 40, loadoutId: "icyenic-devout-infernal" },
    ],
  },
  {
    id: "invalid-double-myth",
    name: "MYTH (invalid): same-tier double stack",
    color: "#94a3b8",
    electivesAt: [
      { hour: 0, electives: [] },
      { hour: 15, electives: ["forinthry", "asgarnia", "desert"] },
    ],
    sumAt: [
      { hour: 0, level: 50 },
      { hour: 20, level: 99 },
    ],
    style: "necromancy",
    // forced invalid stacking for comparison line
    relicPlan: [{ hour: 20, loadoutId: "INVALID_STACK" }],
  },
];

function lerpLevel(curve: { hour: number; level: number }[], hour: number): number {
  if (hour <= curve[0]!.hour) return curve[0]!.level;
  for (let i = 1; i < curve.length; i++) {
    const a = curve[i - 1]!;
    const b = curve[i]!;
    if (hour <= b.hour) {
      const t = (hour - a.hour) / (b.hour - a.hour);
      return Math.round(a.level + t * (b.level - a.level));
    }
  }
  return curve[curve.length - 1]!.level;
}

function electivesAt(route: Route, hour: number): RegionTag[] {
  let e: RegionTag[] = [];
  for (const step of route.electivesAt) {
    if (hour >= step.hour) e = step.electives;
  }
  return e;
}

function loadoutAt(route: Route, hour: number): string {
  let id = "none";
  for (const step of route.relicPlan) {
    if (hour >= step.hour) id = step.loadoutId;
  }
  return id;
}

function gearStageForHour(hour: number) {
  if (hour < 6) return stageById("early") ?? GEAR_STAGES[0]!;
  if (hour < 16) return stageById("mid") ?? GEAR_STAGES[1]!;
  if (hour < 30) return stageById("late") ?? GEAR_STAGES[2]!;
  return stageById("endgame") ?? GEAR_STAGES[GEAR_STAGES.length - 1]!;
}

function makePlayer(electives: RegionTag[], sum: number): Player {
  const p = new Player({ electives, relicTier: Math.min(7, 1 + Math.floor(sum / 20)) });
  p.setLevel("summoning", sum);
  for (const sk of ["attack", "strength", "defence", "magic", "ranged", "necromancy"] as const) {
    p.setLevel(sk, Math.min(99, 40 + sum));
  }
  p.setFlag("league:contract-claws-auto");
  if (electives.includes("forinthry")) {
    p.setFlag("unlocked:ancient-summoning");
    p.setFlag("unlocked:binding-contracts");
    p.setFlag("unlocked:binding-ripper");
    p.setFlag("killed:nihil");
    p.setFlag("unlocked:nihil-pouches");
    p.setFlag("unlocked:dungeoneering-kalg");
  }
  return p;
}

function resolveRelics(loadoutId: string): {
  mult: number;
  devout: boolean;
  divineDruid: boolean;
  valid: boolean;
  label: string;
  active: string[];
} {
  if (loadoutId === "none") {
    return { mult: 1, devout: false, divineDruid: false, valid: true, label: "none", active: [] };
  }
  if (loadoutId === "INVALID_STACK") {
    // Myth: pretend Devout + Infernal + Icyenic + Naragi all stack (wrong)
    return {
      mult: 1.18 * 1.14 * 1.12,
      devout: true,
      divineDruid: false,
      valid: false,
      label: "INVALID myth stack",
      active: ["devout", "infernal-fire", "icyenic-faith", "naragi-edict"],
    };
  }
  const legal = legalCombatLoadouts().find((l) => l.id === loadoutId);
  if (!legal) {
    return { mult: 1, devout: false, divineDruid: false, valid: false, label: loadoutId, active: [] };
  }
  const v = legal.validation;
  return {
    mult: v.mult,
    devout: v.devout,
    divineDruid: v.divineDruid,
    valid: v.valid,
    label: legal.label,
    active: v.active,
  };
}

interface Point {
  hour: number;
  totalDps: number;
  playerDps: number;
  famDps: number;
  summoning: number;
  electives: string;
  relics: string;
  familiar: string;
  valid: boolean;
}

function simulateRoute(route: Route): Point[] {
  const points: Point[] = [];
  const hours = [
    0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 36, 40, 48, 60, 80,
  ];
  for (const hour of hours) {
    const electives = electivesAt(route, hour);
    const sum = lerpLevel(route.sumAt, hour);
    const player = makePlayer(electives, sum);
    const loadoutId = loadoutAt(route, hour);
    const relics = resolveRelics(loadoutId);
    const stage = gearStageForHour(hour);

    // Gear: use package if electives match a package, else regions
    let snapshot: GearSnapshot;
    let offhand: "shield" | "defender" | "none" = "none";
    const arch = route.style === "melee" ? "shield-tank" : "power-dps";
    try {
      if (electives.length === 0) {
        const pkg = REGION_PACKAGES.find((p) => p.id === "free-only")!;
        const g = gearFromPackage(pkg, route.style, arch);
        snapshot = g.snapshot;
        offhand = g.offhand;
      } else if (electives.includes("forinthry") && electives.includes("asgarnia") && electives.includes("desert")) {
        const g = gearFromPackage(
          REGION_PACKAGES.find((p) => p.id === "desert-asgarnia-forinthry")!,
          route.style,
          arch,
        );
        snapshot = g.snapshot;
        offhand = g.offhand;
      } else if (electives.includes("morytania") && electives.includes("asgarnia")) {
        const g = gearFromPackage(
          REGION_PACKAGES.find((p) => p.id === "mory-asgarnia-forinthry") ??
            REGION_PACKAGES.find((p) => p.id === "desert-asgarnia-forinthry")!,
          route.style,
          arch,
        );
        snapshot = g.snapshot;
        offhand = g.offhand;
      } else {
        const g = gearFromRegions(electives as any, route.style, arch);
        snapshot = g.snapshot;
        offhand = g.offhand;
      }
    } catch {
      snapshot = {
        armour: 1500 + hour * 20,
        baselineAd: 2000 + hour * 40,
        baseLp: 9900,
        prayer: 20,
        genesisAdBonus: 500,
        weaponTier: Math.min(95, 60 + hour),
        source: "fallback",
      };
    }

    // Blend abstract stage early game
    if (hour < 16) {
      const w = hour / 16;
      snapshot = {
        ...snapshot,
        armour: Math.round(stage.armour[arch] * (1 - w) + snapshot.armour * w),
        baselineAd: Math.round(stage.baselineAd[route.style] * (1 - w) + snapshot.baselineAd * w),
        weaponTier: Math.min(snapshot.weaponTier, stage.id === "early" ? 75 : stage.id === "mid" ? 85 : 90),
      };
    }

    const bestFam = pickBestFamiliar(player.snapshot(), {
      devout: relics.devout,
      divineDruid: relics.divineDruid,
      accessMode: "soft",
    });

    // Map primary/secondary for modelCombat from active list
    let primary: RelicId = "none";
    let secondary: RelicId | null = null;
    if (relics.active.includes("devout")) primary = "devout";
    if (relics.active.includes("infernal-fire")) {
      if (primary === "none") primary = "infernal-fire";
      else secondary = "infernal-fire";
    }
    if (relics.active.includes("icyenic-faith")) {
      if (primary === "none") primary = "icyenic-faith";
      else if (!secondary) secondary = "icyenic-faith";
    }
    if (relics.active.includes("naragi-edict") && primary === "none") primary = "naragi-edict";
    if (relics.active.includes("perkfection") && !secondary) secondary = "perkfection";

    // For invalid myth, pass devout+infernal with ignore-style mult via primary stacking
    const r = modelCombat({
      picks: PATH,
      style: route.style,
      stage,
      archetype: arch,
      offhand,
      herbloreLevel: Math.min(110, 50 + hour),
      targetTiles: 1,
      multiContentWeight: 0,
      powerburst: hour >= 20,
      gear: snapshot,
      familiar: bestFam.familiarId as FamiliarId,
      relic: loadoutId === "INVALID_STACK" ? "devout" : primary,
      relicSecondary: loadoutId === "INVALID_STACK" ? "infernal-fire" : secondary,
      summoningLevel: sum,
      summoningPlayer: player.snapshot(),
      familiarAccess: "soft",
      baneRegions: ["free", "misthalin", "havenhythe", "karamja", ...electives],
    });

    // For invalid myth, inflate player mult extra to show the lie
    let total = r.totalDps;
    let playerDps = r.dps;
    if (loadoutId === "INVALID_STACK" && hour >= 20) {
      playerDps *= 1.14 * 1.12; // fake icyenic+naragi on top
      total = playerDps + (r.familiar?.dps ?? 0);
    }

    points.push({
      hour,
      totalDps: total,
      playerDps,
      famDps: r.familiar?.dps ?? 0,
      summoning: sum,
      electives: electives.join("+") || "free",
      relics: relics.label,
      familiar: bestFam.name,
      valid: relics.valid,
    });
  }
  return points;
}

// ── Run ──
console.log("╔════════════════════════════════════════════════════════════╗");
console.log("║  REJUVENATED RULES + HOUR DPS CURVES                       ║");
console.log("╚════════════════════════════════════════════════════════════╝\n");

console.log("=== REJUVENATED — can you get Devout AND Infernal? ===\n");
console.log(
  "Wiki: Rejuvenated lets you pick another relic from PREVIOUS tiers only.",
);
console.log("One pick per tier forever. Same-tier pairs (e.g. Devout+Naragi if same tier) = impossible.\n");

for (const L of legalCombatLoadouts()) {
  const mark = L.validation.valid ? "VALID  " : "INVALID";
  console.log(
    `${mark}  ${L.label}\n         active=[${L.validation.active.join(", ")}] mult×${L.validation.mult.toFixed(3)}`,
  );
  if (L.validation.errors.length) console.log("         ERR:", L.validation.errors.join("; "));
  if (L.validation.notes.length) console.log("         note:", L.validation.notes[0]);
}

// Specific answer
const both = stackRelicPlayerMult("devout", "infernal-fire");
console.log("\n→ Devout + Infernal Fire (assumed T4+T5):", both.valid ? "YES — different tiers, no Rejuvenated required" : both.errors.join("; "));
const same = stackRelicPlayerMult("devout", "naragi-edict");
console.log("→ Devout + Naragi (assumed same T4):", same.valid ? "yes" : "NO — " + same.errors[0]);
console.log(
  "→ Infernal + Rejuvenated (assumed same T5):",
  stackRelicPlayerMult("infernal-fire", "rejuvenated").valid
    ? "yes"
    : "NO — " + stackRelicPlayerMult("infernal-fire", "rejuvenated").errors[0],
);
console.log(
  "\nBottom line: Under assumed tiers, Devout+Infernal is a normal T4+T5 path.",
);
console.log(
  "Rejuvenated does NOT let you take two T5 picks. It reclaims a SKIPPED earlier-tier relic.",
);

// Curves
const series = ROUTES.map((r) => ({ route: r, points: simulateRoute(r) }));

console.log("\n=== DPS @ key hours ===");
for (const h of [4, 12, 20, 30, 40, 60]) {
  console.log(`\nHour ${h}:`);
  for (const s of series) {
    const p = s.points.find((x) => x.hour === h) ?? s.points[s.points.length - 1]!;
    console.log(
      `  ${s.route.name.slice(0, 42).padEnd(42)} total ${Math.round(p.totalDps).toLocaleString().padStart(7)}  fam ${Math.round(p.famDps).toString().padStart(5)}  sum${p.summoning}  ${p.familiar.slice(0, 20)}  ${p.electives}`,
    );
  }
}

// ── SVG plot ──
const W = 960;
const H = 560;
const pad = { l: 72, r: 24, t: 48, b: 64 };
const innerW = W - pad.l - pad.r;
const innerH = H - pad.t - pad.b;
const maxH = 80;
const maxDps = Math.max(...series.flatMap((s) => s.points.map((p) => p.totalDps))) * 1.05;

function xScale(h: number) {
  return pad.l + (h / maxH) * innerW;
}
function yScale(d: number) {
  return pad.t + innerH - (d / maxDps) * innerH;
}

function pathFor(points: Point[]) {
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${xScale(p.hour).toFixed(1)} ${yScale(p.totalDps).toFixed(1)}`).join(" ");
}

const gridHours = [0, 10, 20, 30, 40, 50, 60, 70, 80];
const gridDps = 5;
const yTicks = Array.from({ length: gridDps + 1 }, (_, i) => (maxDps * i) / gridDps);

let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="100%" height="100%" fill="#0f172a"/>
  <text x="${W / 2}" y="28" text-anchor="middle" fill="#e2e8f0" font-family="system-ui,sans-serif" font-size="18" font-weight="600">Equilibrium total DPS vs hours played</text>
  <text x="${W / 2}" y="46" text-anchor="middle" fill="#94a3b8" font-family="system-ui,sans-serif" font-size="11">Gated familiars · assumed relic tiers · dashed = invalid myth stack</text>
`;

// grid
for (const h of gridHours) {
  const x = xScale(h);
  svg += `<line x1="${x}" y1="${pad.t}" x2="${x}" y2="${pad.t + innerH}" stroke="#1e293b" stroke-width="1"/>`;
  svg += `<text x="${x}" y="${H - 28}" text-anchor="middle" fill="#94a3b8" font-size="11" font-family="system-ui,sans-serif">${h}h</text>`;
}
for (const d of yTicks) {
  const y = yScale(d);
  svg += `<line x1="${pad.l}" y1="${y}" x2="${pad.l + innerW}" y2="${y}" stroke="#1e293b" stroke-width="1"/>`;
  svg += `<text x="${pad.l - 8}" y="${y + 4}" text-anchor="end" fill="#94a3b8" font-size="10" font-family="system-ui,sans-serif">${(d / 1000).toFixed(0)}k</text>`;
}

svg += `<text x="20" y="${pad.t + innerH / 2}" fill="#94a3b8" font-size="11" font-family="system-ui,sans-serif" transform="rotate(-90 20 ${pad.t + innerH / 2})">Total DPS (player + familiar)</text>`;
svg += `<text x="${W / 2}" y="${H - 8}" text-anchor="middle" fill="#94a3b8" font-size="11" font-family="system-ui,sans-serif">Hours of league play (model)</text>`;

// lines
series.forEach((s, idx) => {
  const dash = s.route.id === "invalid-double-myth" ? 'stroke-dasharray="8 6"' : "";
  const opacity = s.route.id === "invalid-double-myth" ? "0.55" : "1";
  svg += `<path d="${pathFor(s.points)}" fill="none" stroke="${s.route.color}" stroke-width="2.5" ${dash} opacity="${opacity}"/>`;
  // end dots
  const last = s.points[s.points.length - 1]!;
  svg += `<circle cx="${xScale(last.hour)}" cy="${yScale(last.totalDps)}" r="4" fill="${s.route.color}" opacity="${opacity}"/>`;
  // legend
  const ly = pad.t + 12 + idx * 18;
  svg += `<rect x="${pad.l + 12}" y="${ly - 8}" width="14" height="3" fill="${s.route.color}" opacity="${opacity}"/>`;
  svg += `<text x="${pad.l + 32}" y="${ly}" fill="#e2e8f0" font-size="11" font-family="system-ui,sans-serif">${s.route.name}</text>`;
});

svg += `</svg>`;

mkdirSync("artifacts", { recursive: true });
mkdirSync("public", { recursive: true });
writeFileSync("artifacts/dps-hours.svg", svg);
writeFileSync("public/dps-hours.svg", svg);

// Also simple HTML viewer
const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Equilibrium DPS vs Hours</title>
  <style>
    body { margin:0; background:#0f172a; color:#e2e8f0; font-family:system-ui,sans-serif; padding:24px; }
    h1 { font-size:1.25rem; margin:0 0 8px; }
    p { color:#94a3b8; max-width:70ch; line-height:1.5; }
    img,object { width:100%; max-width:960px; border-radius:12px; border:1px solid #1e293b; }
    table { border-collapse:collapse; margin-top:24px; font-size:13px; }
    th,td { border:1px solid #334155; padding:6px 10px; text-align:left; }
    th { background:#1e293b; }
    .ok { color:#4ade80; } .bad { color:#f87171; }
  </style>
</head>
<body>
  <h1>Equilibrium total DPS vs hours played</h1>
  <p>Familiars are region/level gated. Relic doubles only when on different assumed tiers.
  <b>Rejuvenated</b> reclaimes one skipped relic from a <i>previous</i> tier — it does not let you take two picks from the same tier (e.g. Infernal+Rejuvenated if both T5).</p>
  <object data="/dps-hours.svg" type="image/svg+xml"></object>
  <h2>Rejuvenated legality (assumed tiers)</h2>
  <table>
    <tr><th>Loadout</th><th>Status</th><th>Active</th></tr>
    ${legalCombatLoadouts()
      .map(
        (l) =>
          `<tr><td>${l.label}</td><td class="${l.validation.valid ? "ok" : "bad"}">${l.validation.valid ? "VALID" : "INVALID"}</td><td>${l.validation.active.join(", ") || "—"}</td></tr>`,
      )
      .join("\n")}
  </table>
  <h2>Sample points</h2>
  <pre style="background:#1e293b;padding:12px;border-radius:8px;overflow:auto;font-size:12px">${series
    .map((s) => {
      const p40 = s.points.find((p) => p.hour === 40)!;
      return `${s.route.id}: @40h total=${Math.round(p40.totalDps)} fam=${Math.round(p40.famDps)} sum=${p40.summoning} ${p40.familiar}`;
    })
    .join("\n")}</pre>
</body>
</html>`;
writeFileSync("public/dps-hours.html", html);

const report = {
  generated: new Date().toISOString(),
  rejuvenatedAnswer: {
    wiki: "Pick another relic from any of the previous tiers",
    canDevoutAndInfernal:
      "YES if they are on different tiers (our assumed T4+T5). No Rejuvenated required for that pair.",
    canInfernalAndRejuvenatedSameTier:
      "NO under assumed T5 conflict — Rejuvenated competes with Infernal if same tier.",
    cannot: "Two relics from the same tier. Rejuvenated is not a free second S-tier from the current tier.",
  },
  series: series.map((s) => ({
    id: s.route.id,
    name: s.route.name,
    points: s.points,
  })),
  legalLoadouts: legalCombatLoadouts().map((l) => ({
    id: l.id,
    label: l.label,
    valid: l.validation.valid,
    active: l.validation.active,
    errors: l.validation.errors,
  })),
};
writeFileSync("artifacts/dps-hours.json", JSON.stringify(report, null, 2));
console.log("\nWrote artifacts/dps-hours.svg, public/dps-hours.svg, public/dps-hours.html, artifacts/dps-hours.json");
