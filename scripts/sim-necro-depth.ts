/**
 * Deep necro feasibility + DPS across gear stages, paths, windows.
 */
import { writeFileSync, mkdirSync } from "fs";
import { PATHS, type Path, activeBlessings } from "../src/lib/eq/blessings.ts";
import { stageById, type Style } from "../src/lib/eq/gear.ts";
import { modelCombat, gearFromPackage, REGION_PACKAGES } from "../src/lib/eq/model.ts";
import {
  necroWeaponFeasibility,
  buildNecroStages,
} from "../src/lib/eq/sim/necro-ladder.ts";
import { Player, ProgressionSim } from "../src/lib/eq/sim/index.ts";
import { CROWN_PATHS } from "../src/lib/eq/lab.ts";

const stage = stageById("endgame");

function ultMult(style: Style, hasHP: boolean, windowSec: number): number {
  if (hasHP) return 1;
  // Duty cycle dilutes over longer windows
  const peak =
    style === "melee" ? 1.68 : style === "magic" ? 1.52 : style === "ranged" ? 1.5 : 1.42;
  if (windowSec <= 30) return peak;
  if (windowSec <= 120) return 1 + (peak - 1) * 0.45;
  // 5 min
  return 1 + (peak - 1) * 0.28;
}

function pathCode(p: Path[]) {
  return p.map((x) => x[0]).join("");
}

console.log("╔════════════════════════════════════════════════════════════╗");
console.log("║  NECRO REGION LOCK + DEEP DPS SIMS                         ║");
console.log("╚════════════════════════════════════════════════════════════╝\n");

// ── Feasibility ──
const feasFree = necroWeaponFeasibility([]);
const feasDesert = necroWeaponFeasibility(["desert", "asgarnia", "forinthry"]);
console.log("=== Can you get good necro gear region-locked? ===\n");
console.log("FREE PATH WEAPONS (no electives):");
for (const w of feasFree.freePathWeapons) {
  console.log(`  ${w.ok ? "YES" : "NO "} T${w.tier} ${w.name}  [${w.regions.join("+")}]`);
}
console.log("\nDESERT UPGRADES (need Desert elective):");
for (const w of feasDesert.desertUpgrades.slice(0, 12)) {
  console.log(`  ${w.ok ? "YES" : "NO "} T${w.tier} ${w.name}`);
}
console.log("\nSUMMARY:");
for (const s of feasFree.summary) console.log(" •", s);

const stages = buildNecroStages();
console.log("\n=== NECRO GEAR STAGES (resolved loadouts) ===\n");
for (const s of stages) {
  console.log(`${s.name}`);
  console.log(`  electives: [${s.electives.join(", ") || "none"}]  necro ${s.necroLevel}`);
  console.log(`  AD ${s.weaponAd}  arm ${s.armour}  weaponsOK=${s.canObtainWeapons}`);
  console.log(`  gear: ${s.pieces.join(" | ") || "(none)"}`);
  for (const n of s.notes) console.log(`  · ${n}`);
}

// ── DPS by gear stage × path × window ──
const windows = [30, 120, 300];
const paths = [
  ...CROWN_PATHS,
  {
    id: "oocobo-alias",
    name: "OOCOBO",
    picks: ["Order", "Order", "Chaos", "Order", "Balance", "Order"] as Path[],
  },
];

// unique by path code
const uniqPaths = new Map<string, { id: string; name: string; picks: Path[] }>();
for (const p of paths) uniqPaths.set(pathCode(p.picks), p as any);

const pkgIds = [
  "free-only",
  "mory-asgarnia-forinthry",
  "desert-asgarnia-forinthry",
  "desert-mory-asgarnia",
  "necro-focus",
  "skip-combat-skilling",
];

interface Row {
  window: number;
  scenario: string;
  path: string;
  packageId: string;
  style: string;
  arch: string;
  dmg: number;
  dps: number;
  ult: number;
  hasHP: boolean;
  ad: number;
  armour: number;
  pieces: string;
}

const rows: Row[] = [];
const t0 = Date.now();

for (const window of windows) {
  for (const sc of [
    { scenario: "ST", multi: 0, tiles: 1 },
    { scenario: "MULTI", multi: 1, tiles: 25 },
  ]) {
    for (const style of ["necromancy", "melee", "magic", "ranged"] as Style[]) {
      for (const arch of ["shield-tank", "power-dps"] as const) {
        for (const pkgId of pkgIds) {
          const pkg = REGION_PACKAGES.find((p) => p.id === pkgId);
          if (!pkg) continue;
          const { snapshot, loadout, offhand } = gearFromPackage(pkg, style, arch);
          for (const [, path] of uniqPaths) {
            const active = activeBlessings(path.picks);
            const hasHP = active.some((b) => b.id === "higher-power");
            // powerburst only if big boned
            const pb = active.some((b) => b.id === "big-boned");
            const r = modelCombat({
              picks: path.picks,
              style,
              stage,
              archetype: arch,
              offhand,
              herbloreLevel: 110,
              targetTiles: sc.tiles,
              multiContentWeight: sc.multi,
              powerburst: pb,
              gear: snapshot,
            });
            const um = ultMult(style, hasHP, window);
            rows.push({
              window,
              scenario: sc.scenario,
              path: pathCode(path.picks),
              packageId: pkgId,
              style,
              arch,
              dmg: r.dps * window * um,
              dps: r.dps,
              ult: um,
              hasHP,
              ad: r.stats.effectiveAd,
              armour: r.stats.armour,
              pieces: loadout.pieces.map((p) => p.name).join(" | "),
            });
          }
        }
      }
    }
  }
}

rows.sort((a, b) => b.dmg - a.dmg);
console.log(`\nSimulated ${rows.length} configs in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

function top(filter: (r: Row) => boolean, n = 8, label = "") {
  const list = rows.filter(filter);
  console.log(`\n=== ${label} (n=${list.length}) ===`);
  for (const [i, r] of list.slice(0, n).entries()) {
    console.log(
      `#${i + 1} ${Math.round(r.dmg).toLocaleString().padStart(11)}  ${r.path}  ${r.style.padEnd(11)} ${r.scenario.padEnd(5)} ${r.packageId.padEnd(26)} ${r.arch.padEnd(12)} HP=${r.hasHP}`,
    );
  }
  return list[0];
}

const best30st = top((r) => r.window === 30 && r.scenario === "ST", 10, "BEST 30s SINGLE-TARGET");
const best30m = top((r) => r.window === 30 && r.scenario === "MULTI", 8, "BEST 30s MULTI");
const best2mSt = top((r) => r.window === 120 && r.scenario === "ST", 8, "BEST 2m ST");
const best5mSt = top((r) => r.window === 300 && r.scenario === "ST", 8, "BEST 5m ST");

console.log("\n=== FREE-ONLY vs FULL PACKAGE (necro ST, best path each window) ===");
for (const w of windows) {
  const free = rows
    .filter((r) => r.window === w && r.scenario === "ST" && r.style === "necromancy" && r.packageId === "free-only")
    .sort((a, b) => b.dmg - a.dmg)[0]!;
  const full = rows
    .filter(
      (r) =>
        r.window === w &&
        r.scenario === "ST" &&
        r.style === "necromancy" &&
        r.packageId === "desert-asgarnia-forinthry",
    )
    .sort((a, b) => b.dmg - a.dmg)[0]!;
  const gain = ((full.dmg / free.dmg - 1) * 100).toFixed(1);
  console.log(
    `${w}s: free ${free.path} ${Math.round(free.dmg).toLocaleString()}  vs  full ${full.path} ${Math.round(full.dmg).toLocaleString()}  (+${gain}%)`,
  );
  console.log(`     free gear: ${free.pieces}`);
  console.log(`     full gear: ${full.pieces}`);
}

console.log("\n=== NECRO vs MELEE at free-only (proves necro doesn't need electives) ===");
for (const w of [30, 120]) {
  const n = rows
    .filter((r) => r.window === w && r.scenario === "ST" && r.style === "necromancy" && r.packageId === "free-only")
    .sort((a, b) => b.dmg - a.dmg)[0]!;
  const m = rows
    .filter((r) => r.window === w && r.scenario === "ST" && r.style === "melee" && r.packageId === "free-only")
    .sort((a, b) => b.dmg - a.dmg)[0]!;
  console.log(
    `${w}s ST free-only: necro ${n.path} ${Math.round(n.dmg).toLocaleString()}  vs melee ${m.path} ${Math.round(m.dmg).toLocaleString()}  (necro ${n.dmg > m.dmg ? "WINS" : "loses"})`,
  );
}

// Path depth: all 729 for necro free-only 2m ST — sample already have crowns; run full for free necro
console.log("\n=== FULL 729 PATH SWEEP: necro free-only, 2m ST ===");
const freePkg = REGION_PACKAGES.find((p) => p.id === "free-only")!;
const { snapshot, offhand } = gearFromPackage(freePkg, "necromancy", "power-dps");
let best729: { code: string; dmg: number; hasHP: boolean; blessings: string } | null = null;
let n729 = 0;
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
              style: "necromancy",
              stage,
              archetype: "power-dps",
              offhand,
              herbloreLevel: 110,
              targetTiles: 1,
              multiContentWeight: 0,
              powerburst: pb,
              gear: snapshot,
            });
            const dmg = r.dps * 120 * ultMult("necromancy", hasHP, 120);
            n729++;
            if (!best729 || dmg > best729.dmg) {
              best729 = {
                code: pathCode(picks),
                dmg,
                hasHP,
                blessings: active.map((x) => x.name).join(" · "),
              };
            }
          }
console.log(`Swept ${n729} paths. Best free-only necro 2m ST: ${best729!.code} → ${Math.round(best729!.dmg).toLocaleString()}`);
console.log(`  HP=${best729!.hasHP}`);
console.log(`  ${best729!.blessings}`);
console.log(`  gear: ${snapshot.source}`);
console.log(`  pieces: ${snapshot.pieces?.map((p) => p.name).join(" | ")}`);

// Compare Higher Power threshold by window for necro free
console.log("\n=== When does Higher Power beat keep-ult? (necro free dual) ===");
for (const w of [30, 60, 120, 180, 300, 600]) {
  const withHp = modelCombat({
    picks: ["Order", "Order", "Chaos", "Order", "Balance", "Order"],
    style: "necromancy",
    stage,
    archetype: "power-dps",
    offhand,
    herbloreLevel: 110,
    targetTiles: 1,
    multiContentWeight: 0,
    powerburst: false,
    gear: snapshot,
  });
  const noHp = modelCombat({
    picks: ["Order", "Chaos", "Order", "Balance", "Chaos", "Chaos"],
    style: "necromancy",
    stage,
    archetype: "power-dps",
    offhand,
    herbloreLevel: 110,
    targetTiles: 1,
    multiContentWeight: 0,
    powerburst: false,
    gear: snapshot,
  });
  const dHp = withHp.dps * w * 1.0;
  const dUlt = noHp.dps * w * ultMult("necromancy", false, w);
  console.log(
    `${String(w).padStart(3)}s  HP(OOCOBO) ${Math.round(dHp).toLocaleString().padStart(10)}  vs  Ult(OCOBCC) ${Math.round(dUlt).toLocaleString().padStart(10)}  → ${dUlt >= dHp ? "KEEP ULT" : "HIGHER POWER"} wins`,
  );
}

mkdirSync("artifacts", { recursive: true });
const report = {
  generated: new Date().toISOString(),
  necroFeasibility: {
    free: feasFree,
    withDesert: feasDesert,
    answer:
      "YES — good necro gear (Omni + Soulbound + T90 deathwarden/dealer) is fully obtainable on free Misthalin via Rasial/Kili. Electives only add jewellery (Asgarnia) or Amascut upgrades (Desert).",
  },
  stages,
  sims: rows.length,
  winners: {
    best30st,
    best30m,
    best2mSt,
    best5mSt,
  },
  freeOnly729: best729,
  freeVsFull: windows.map((w) => {
    const free = rows
      .filter((r) => r.window === w && r.scenario === "ST" && r.style === "necromancy" && r.packageId === "free-only")
      .sort((a, b) => b.dmg - a.dmg)[0]!;
    const full = rows
      .filter(
        (r) =>
          r.window === w &&
          r.scenario === "ST" &&
          r.style === "necromancy" &&
          r.packageId === "desert-asgarnia-forinthry",
      )
      .sort((a, b) => b.dmg - a.dmg)[0]!;
    return {
      window: w,
      free: { path: free.path, dmg: Math.round(free.dmg), pieces: free.pieces },
      full: { path: full.path, dmg: Math.round(full.dmg), pieces: full.pieces },
      electiveGainPct: +((full.dmg / free.dmg - 1) * 100).toFixed(2),
    };
  }),
};
writeFileSync("artifacts/necro-depth-sim.json", JSON.stringify(report, null, 2));
console.log("\nWrote artifacts/necro-depth-sim.json");
console.log("\n=== BOTTOM LINE ===");
console.log(report.necroFeasibility.answer);
