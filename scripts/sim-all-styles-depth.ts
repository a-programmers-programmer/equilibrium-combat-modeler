/**
 * Deep multi-style sims: melee / magic / ranged / necro.
 * Other styles get denser package×mode×path matrices (more customizable).
 *
 * Usage: npx tsx scripts/sim-all-styles-depth.ts
 */
import { writeFileSync, mkdirSync } from "fs";
import { PATHS, type Path, activeBlessings } from "../src/lib/eq/blessings.ts";
import { stageById, type Style } from "../src/lib/eq/gear.ts";
import { modelCombat, type GearSnapshot } from "../src/lib/eq/model.ts";
import {
  STYLE_TREES,
  stylePackages,
  resolveStyleLoadout,
  styleWeaponAccessibility,
  type DepthStyle,
} from "../src/lib/eq/sim/style-depth.ts";
import type { OffhandMode } from "../src/lib/eq/items.ts";
import type { BuildArchetype } from "../src/lib/eq/gear.ts";

const stage = stageById("endgame");

function pathCode(p: Path[]) {
  return p.map((x) => x[0]).join("");
}

function modeToArch(mode: OffhandMode): BuildArchetype {
  if (mode === "shield") return "shield-tank";
  if (mode === "defender") return "defender";
  return "power-dps";
}

function offhandFromMode(mode: OffhandMode): "shield" | "defender" | "none" {
  if (mode === "shield") return "shield";
  if (mode === "defender") return "defender";
  return "none";
}

/** Ult duty-cycle multiplier by style & window. HP forces 1.0. */
function ultMult(style: Style, hasHP: boolean, windowSec: number): number {
  if (hasHP) return 1;
  const peak: Record<Style, number> = {
    melee: 1.72, // Berserk densest short window
    magic: 1.55, // Sunshine
    ranged: 1.52, // Death's Swiftness
    necromancy: 1.42, // Living Death
  };
  const p = peak[style];
  if (windowSec <= 30) return p;
  if (windowSec <= 60) return 1 + (p - 1) * 0.72;
  if (windowSec <= 120) return 1 + (p - 1) * 0.48;
  if (windowSec <= 180) return 1 + (p - 1) * 0.35;
  if (windowSec <= 300) return 1 + (p - 1) * 0.25;
  return 1 + (p - 1) * 0.15;
}

function loadoutToSnapshot(load: ReturnType<typeof resolveStyleLoadout>): GearSnapshot {
  const genesisAdBonus = Math.round(load.totalWeaponAd * 0.22 + (120 - load.weaponTier) * 8);
  return {
    armour: load.totalArmour,
    baselineAd: load.totalWeaponAd,
    baseLp: load.totalLp,
    prayer: load.totalPrayer + 12,
    genesisAdBonus: Math.max(400, genesisAdBonus),
    weaponTier: load.weaponTier,
    source: `oop:${load.unlocked.join("+")}·${load.mode}`,
    pieces: load.pieces.map((p) => ({ name: p.name, slot: p.slot })),
    notes: load.notes,
  };
}

/** Representative paths for coarse matrix (not full 729). */
const SAMPLE_PATHS: { code: string; picks: Path[] }[] = [
  { code: "OCOBOC", picks: ["Order", "Chaos", "Order", "Balance", "Order", "Chaos"] },
  { code: "OCOBCC", picks: ["Order", "Chaos", "Order", "Balance", "Chaos", "Chaos"] },
  { code: "OOCOBO", picks: ["Order", "Order", "Chaos", "Order", "Balance", "Order"] },
  { code: "OCOOOC", picks: ["Order", "Chaos", "Order", "Order", "Order", "Chaos"] },
  { code: "BOOBOC", picks: ["Balance", "Order", "Order", "Balance", "Order", "Chaos"] },
  { code: "BOCBOO", picks: ["Balance", "Order", "Chaos", "Balance", "Order", "Order"] },
  { code: "OOCOBB", picks: ["Order", "Order", "Chaos", "Order", "Balance", "Balance"] },
  { code: "CCCCCC", picks: ["Chaos", "Chaos", "Chaos", "Chaos", "Chaos", "Chaos"] },
  { code: "OOOOOO", picks: ["Order", "Order", "Order", "Order", "Order", "Order"] },
  { code: "COCOBO", picks: ["Chaos", "Order", "Chaos", "Order", "Balance", "Order"] },
];

interface ResultRow {
  style: DepthStyle;
  packageId: string;
  packageLabel: string;
  mode: OffhandMode;
  path: string;
  hasHP: boolean;
  window: number;
  scenario: "ST" | "MULTI";
  dmg: number;
  dps: number;
  ad: number;
  armour: number;
  pieces: string;
  electives: string[];
}

const rows: ResultRow[] = [];
const t0 = Date.now();

console.log("╔══════════════════════════════════════════════════════════════╗");
console.log("║  ALL-STYLES DEEP SIM (melee/magic/ranged denser than necro) ║");
console.log("╚══════════════════════════════════════════════════════════════╝\n");

// ── Feasibility trees ──
for (const style of ["necromancy", "melee", "magic", "ranged"] as DepthStyle[]) {
  const tree = STYLE_TREES[style];
  console.log(`\n######## ${style.toUpperCase()} ########`);
  console.log("Free peak:", tree.freePeak.map((w) => `${w.name} T${w.tier}`).join(" · "));
  console.log("Why deeper:", tree.customizationNotes.join(" "));
  console.log("Elective branches:");
  for (const b of tree.electiveBranches) {
    console.log(`  [${b.priority}] ${b.region}: ${b.weapons.join(", ")} — ${b.why}`);
  }
  const freeW = styleWeaponAccessibility(style, []);
  const recW = styleWeaponAccessibility(style, tree.recommendedElectives);
  console.log(
    `Weapons accessible free: ${freeW.length} → recommended pkg: ${recW.length}`,
  );
  console.log("  free top:", freeW.slice(0, 4).map((w) => w.name).join(" | ") || "(none)");
  console.log("  rec top:", recW.slice(0, 5).map((w) => w.name).join(" | ") || "(none)");
}

// ── Dense matrix ──
const windows = [30, 120, 300];
const scenarios: { scenario: "ST" | "MULTI"; tiles: number; multi: number }[] = [
  { scenario: "ST", tiles: 1, multi: 0 },
  { scenario: "MULTI", tiles: 25, multi: 1 },
];

for (const style of ["melee", "magic", "ranged", "necromancy"] as DepthStyle[]) {
  const tree = STYLE_TREES[style];
  const pkgs = stylePackages(style);
  const modes = tree.modesWorthTesting;
  console.log(`\n→ Matrix ${style}: ${pkgs.length} pkgs × ${modes.length} modes × ${SAMPLE_PATHS.length} paths × ${windows.length} win × 2 sc`);

  for (const pkg of pkgs) {
    for (const mode of modes) {
      const load = resolveStyleLoadout(style, pkg.electives, mode);
      const gear = loadoutToSnapshot(load);
      const arch = modeToArch(mode);
      const oh = offhandFromMode(mode === "2h" ? "dual" : mode);

      for (const path of SAMPLE_PATHS) {
        const active = activeBlessings(path.picks);
        const hasHP = active.some((b) => b.id === "higher-power");
        const pb = active.some((b) => b.id === "big-boned");
        const base = modelCombat({
          picks: path.picks,
          style: style as Style,
          stage,
          archetype: arch,
          offhand: oh,
          herbloreLevel: 110,
          targetTiles: 1,
          multiContentWeight: 0,
          powerburst: pb,
          gear,
        });
        const multi = modelCombat({
          picks: path.picks,
          style: style as Style,
          stage,
          archetype: arch,
          offhand: oh,
          herbloreLevel: 110,
          targetTiles: 25,
          multiContentWeight: 1,
          powerburst: pb,
          gear,
        });

        for (const w of windows) {
          for (const sc of scenarios) {
            const r = sc.scenario === "ST" ? base : multi;
            const um = ultMult(style as Style, hasHP, w);
            rows.push({
              style,
              packageId: pkg.id,
              packageLabel: pkg.label,
              mode,
              path: path.code,
              hasHP,
              window: w,
              scenario: sc.scenario,
              dmg: r.dps * w * um,
              dps: r.dps,
              ad: r.stats.effectiveAd,
              armour: r.stats.armour,
              pieces: load.pieces.map((p) => p.name).join(" | "),
              electives: pkg.electives,
            });
          }
        }
      }
    }
  }
}

console.log(`\nCoarse matrix rows: ${rows.length} in ${((Date.now() - t0) / 1000).toFixed(2)}s`);

function topN(
  filter: (r: ResultRow) => boolean,
  n: number,
  title: string,
) {
  const list = rows.filter(filter).sort((a, b) => b.dmg - a.dmg);
  console.log(`\n=== ${title} ===`);
  for (const [i, r] of list.slice(0, n).entries()) {
    console.log(
      `#${String(i + 1).padStart(2)} ${Math.round(r.dmg).toLocaleString().padStart(11)}  ${r.style.padEnd(11)} ${r.path}  ${r.mode.padEnd(8)} ${r.packageId.padEnd(14)} HP=${r.hasHP ? "Y" : "n"}`,
    );
    if (i === 0) console.log(`     ${r.pieces.slice(0, 120)}`);
  }
  return list[0];
}

// Per-style free-only 30s ST winner from sample paths
for (const style of ["melee", "magic", "ranged", "necromancy"] as DepthStyle[]) {
  topN(
    (r) => r.style === style && r.window === 30 && r.scenario === "ST" && r.packageId === "free",
    5,
    `${style.toUpperCase()} free-only 30s ST (sample paths)`,
  );
  topN(
    (r) => r.style === style && r.window === 30 && r.scenario === "ST",
    5,
    `${style.toUpperCase()} BEST package 30s ST`,
  );
  topN(
    (r) => r.style === style && r.window === 120 && r.scenario === "ST",
    5,
    `${style.toUpperCase()} BEST 2m ST`,
  );
  topN(
    (r) => r.style === style && r.window === 30 && r.scenario === "MULTI",
    3,
    `${style.toUpperCase()} BEST 30s MULTI`,
  );
}

// Cross-style crown at each window
for (const w of windows) {
  topN((r) => r.window === w && r.scenario === "ST", 12, `GLOBAL BEST ${w}s ST`);
  topN((r) => r.window === w && r.scenario === "MULTI", 6, `GLOBAL BEST ${w}s MULTI`);
}

// Free vs recommended package gain per style
console.log("\n=== ELECTIVE VALUE BY STYLE (best sample path, 2m ST) ===");
const electiveValue: Record<string, unknown> = {};
for (const style of ["melee", "magic", "ranged", "necromancy"] as DepthStyle[]) {
  const free = rows
    .filter((r) => r.style === style && r.window === 120 && r.scenario === "ST" && r.packageId === "free")
    .sort((a, b) => b.dmg - a.dmg)[0]!;
  const best = rows
    .filter((r) => r.style === style && r.window === 120 && r.scenario === "ST")
    .sort((a, b) => b.dmg - a.dmg)[0]!;
  const gain = ((best.dmg / free.dmg - 1) * 100).toFixed(1);
  console.log(
    `${style.padEnd(11)} free ${free.path}/${free.mode} ${Math.round(free.dmg).toLocaleString()}  →  best ${best.packageId} ${best.path}/${best.mode} ${Math.round(best.dmg).toLocaleString()}  (+${gain}%)`,
  );
  electiveValue[style] = {
    freeDmg: Math.round(free.dmg),
    freePath: free.path,
    freeMode: free.mode,
    freePieces: free.pieces,
    bestDmg: Math.round(best.dmg),
    bestPkg: best.packageId,
    bestPath: best.path,
    bestMode: best.mode,
    bestPieces: best.pieces,
    gainPct: +gain,
  };
}

// ── Full 729 path sweeps: free + best package × each style × best mode for 2m ST ──
console.log("\n=== FULL 729-PATH SWEEPS (2m ST) — free + style BiS package ===");
interface SweepWin {
  style: DepthStyle;
  packageId: string;
  mode: OffhandMode;
  code: string;
  dmg: number;
  hasHP: boolean;
  blessings: string;
  pieces: string;
}
const sweeps: SweepWin[] = [];

function bestModeForStyle(style: DepthStyle, pkgId: string): OffhandMode {
  // pick mode that won coarse matrix for that style/pkg on 2m ST
  const cand = rows
    .filter((r) => r.style === style && r.packageId === pkgId && r.window === 120 && r.scenario === "ST")
    .sort((a, b) => b.dmg - a.dmg)[0];
  return cand?.mode ?? "dual";
}

function bestPkgId(style: DepthStyle): string {
  const cand = rows
    .filter((r) => r.style === style && r.window === 120 && r.scenario === "ST")
    .sort((a, b) => b.dmg - a.dmg)[0];
  return cand?.packageId ?? "free";
}

for (const style of ["melee", "magic", "ranged", "necromancy"] as DepthStyle[]) {
  for (const pkgId of ["free", bestPkgId(style)]) {
    const pkg = stylePackages(style).find((p) => p.id === pkgId)!;
    if (!pkg) continue;
    const mode = bestModeForStyle(style, pkgId);
    const load = resolveStyleLoadout(style, pkg.electives, mode);
    const gear = loadoutToSnapshot(load);
    const arch = modeToArch(mode);
    const oh = offhandFromMode(mode === "2h" ? "dual" : mode);

    let best: SweepWin | null = null;
    let n = 0;
    for (const a of PATHS)
      for (const b of PATHS)
        for (const c of PATHS)
          for (const d of PATHS)
            for (const e of PATHS)
              for (const f of PATHS) {
                const picks = [a, b, c, d, e, f] as Path[];
                const active = activeBlessings(picks);
                const hasHP = active.some((x) => x.id === "higher-power");
                const pb = active.some((x) => x.id === "big-boned");
                const r = modelCombat({
                  picks,
                  style: style as Style,
                  stage,
                  archetype: arch,
                  offhand: oh,
                  herbloreLevel: 110,
                  targetTiles: 1,
                  multiContentWeight: 0,
                  powerburst: pb,
                  gear,
                });
                const dmg = r.dps * 120 * ultMult(style as Style, hasHP, 120);
                n++;
                if (!best || dmg > best.dmg) {
                  best = {
                    style,
                    packageId: pkgId,
                    mode,
                    code: pathCode(picks),
                    dmg,
                    hasHP,
                    blessings: active.map((x) => x.name).join(" · "),
                    pieces: load.pieces.map((p) => p.name).join(" | "),
                  };
                }
              }
    sweeps.push(best!);
    console.log(
      `${style.padEnd(11)} ${pkgId.padEnd(14)} mode=${mode.padEnd(8)} best=${best!.code}  ${Math.round(best!.dmg).toLocaleString()}  HP=${best!.hasHP}  (729)`,
    );
    console.log(`     ${best!.pieces.slice(0, 110)}`);
  }
}

// HP crossover per style free dual/2h
console.log("\n=== HIGHER POWER CROSSOVER BY STYLE (free, style-default mode) ===");
const hpCross: Record<string, unknown> = {};
for (const style of ["melee", "magic", "ranged", "necromancy"] as DepthStyle[]) {
  const mode = style === "magic" || style === "ranged" ? "2h" : style === "melee" ? "2h" : "dual";
  const load = resolveStyleLoadout(style, [], mode);
  const gear = loadoutToSnapshot(load);
  const arch = modeToArch(mode);
  const oh = offhandFromMode(mode === "2h" ? "dual" : mode);
  const cross: { window: number; winner: string; hp: number; ult: number }[] = [];
  for (const w of [30, 60, 120, 180, 300, 600]) {
    const hp = modelCombat({
      picks: ["Order", "Order", "Chaos", "Order", "Balance", "Order"],
      style: style as Style,
      stage,
      archetype: arch,
      offhand: oh,
      herbloreLevel: 110,
      targetTiles: 1,
      multiContentWeight: 0,
      powerburst: false,
      gear,
    });
    const ult = modelCombat({
      picks: ["Order", "Chaos", "Order", "Balance", "Chaos", "Chaos"],
      style: style as Style,
      stage,
      archetype: arch,
      offhand: oh,
      herbloreLevel: 110,
      targetTiles: 1,
      multiContentWeight: 0,
      powerburst: false,
      gear,
    });
    const dHp = hp.dps * w;
    const dUlt = ult.dps * w * ultMult(style as Style, false, w);
    const winner = dUlt >= dHp ? "KEEP_ULT" : "HIGHER_POWER";
    cross.push({ window: w, winner, hp: Math.round(dHp), ult: Math.round(dUlt) });
    console.log(
      `${style.padEnd(11)} ${String(w).padStart(3)}s  HP ${Math.round(dHp).toLocaleString().padStart(10)}  Ult ${Math.round(dUlt).toLocaleString().padStart(10)}  → ${winner}`,
    );
  }
  hpCross[style] = { mode, pieces: load.pieces.map((p) => p.name), cross };
}

// Mode sensitivity: same package, compare modes for melee/ranged/magic
console.log("\n=== MODE SENSITIVITY (best path sample, 30s ST, style BiS pkg) ===");
const modeSens: Record<string, unknown> = {};
for (const style of ["melee", "magic", "ranged"] as DepthStyle[]) {
  const pkgId = bestPkgId(style);
  const sub = rows
    .filter((r) => r.style === style && r.packageId === pkgId && r.window === 30 && r.scenario === "ST")
    .sort((a, b) => b.dmg - a.dmg);
  const byMode = new Map<string, ResultRow>();
  for (const r of sub) {
    if (!byMode.has(r.mode) || byMode.get(r.mode)!.dmg < r.dmg) byMode.set(r.mode, r);
  }
  console.log(`${style} @ ${pkgId}:`);
  for (const [mode, r] of [...byMode.entries()].sort((a, b) => b[1].dmg - a[1].dmg)) {
    console.log(`  ${mode.padEnd(8)} ${r.path} ${Math.round(r.dmg).toLocaleString()}`);
  }
  modeSens[style] = Object.fromEntries(
    [...byMode.entries()].map(([m, r]) => [m, { path: r.path, dmg: Math.round(r.dmg), pieces: r.pieces }]),
  );
}

mkdirSync("artifacts", { recursive: true });
const report = {
  generated: new Date().toISOString(),
  note: "Deeper than necro-only: per-style package trees, multi-mode, 729-path free+BiS, HP crossover, mode sensitivity",
  coarseRows: rows.length,
  trees: STYLE_TREES,
  electiveValue2mST: electiveValue,
  sweeps729_2mST: sweeps.map((s) => ({
    ...s,
    dmg: Math.round(s.dmg),
  })),
  hpCrossover: hpCross,
  modeSensitivity: modeSens,
  globalWinners: {
    st30: rows.filter((r) => r.window === 30 && r.scenario === "ST").sort((a, b) => b.dmg - a.dmg)[0],
    multi30: rows.filter((r) => r.window === 30 && r.scenario === "MULTI").sort((a, b) => b.dmg - a.dmg)[0],
    st120: rows.filter((r) => r.window === 120 && r.scenario === "ST").sort((a, b) => b.dmg - a.dmg)[0],
    st300: rows.filter((r) => r.window === 300 && r.scenario === "ST").sort((a, b) => b.dmg - a.dmg)[0],
  },
  conclusion: {
    necro: "Least region-dependent — free Omni kit is complete; electives ~5%.",
    melee: "Most mode-sensitive — shield Aegis vs free EZK 2H vs Desert drygores; electives matter a lot.",
    magic: "Free FSOA 2H strong; Asgarnia seismic dual is the main fork.",
    ranged: "Most weapon-branch diversity (BOLG/SGB/Asc/Blight/ECB); package choice is identity.",
  },
};

// slim global winners for JSON size
for (const k of Object.keys(report.globalWinners) as (keyof typeof report.globalWinners)[]) {
  const r = report.globalWinners[k]!;
  (report.globalWinners as any)[k] = {
    style: r.style,
    path: r.path,
    mode: r.mode,
    packageId: r.packageId,
    dmg: Math.round(r.dmg),
    pieces: r.pieces,
    hasHP: r.hasHP,
  };
}

writeFileSync("artifacts/all-styles-depth-sim.json", JSON.stringify(report, null, 2));
console.log("\nWrote artifacts/all-styles-depth-sim.json");
console.log(`Total time ${((Date.now() - t0) / 1000).toFixed(1)}s`);
