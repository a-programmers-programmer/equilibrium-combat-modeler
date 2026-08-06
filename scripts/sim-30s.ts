/**
 * Exhaustive 30-second damage window search.
 * Conclusive WITHIN this model after 2H/offhand fix.
 *
 * Search space:
 *   729 paths × 4 styles × 3 archetypes × 7 region packages × {ST, MULTI} × {PB on/off}
 *   = 244,944 configs
 *
 * damage_30s = model_dps * 30 * ultWindowMult
 * ultWindowMult = 1 if Higher Power else style ult EV over 30s.
 */
import { writeFileSync, mkdirSync } from "fs";
import { PATHS, type Path, activeBlessings } from "../src/lib/eq/blessings.ts";
import { stageById, STYLES, type Style, type BuildArchetype } from "../src/lib/eq/gear.ts";
import { modelCombat, gearFromPackage, REGION_PACKAGES } from "../src/lib/eq/model.ts";
import type { RegionPackage } from "../src/lib/eq/items.ts";

const ARCH: BuildArchetype[] = ["shield-tank", "defender", "power-dps"];
const stage = stageById("endgame");

function ultWindowMult(style: Style, hasHigherPower: boolean): number {
  if (hasHigherPower) return 1.0;
  switch (style) {
    case "melee":
      return 1.68; // Berserk ~20.4s @ 2× in 30s window
    case "magic":
      return 1.52; // Sunshine packed 30s
    case "ranged":
      return 1.5; // Death's Swiftness
    case "necromancy":
      return 1.42; // Living Death peak
    default:
      return 1.0;
  }
}

function pathCode(picks: Path[]): string {
  return picks.map((p) => p[0]).join("");
}

function* allPaths(): Generator<Path[]> {
  const p = PATHS;
  for (const a of p)
    for (const b of p)
      for (const c of p)
        for (const d of p)
          for (const e of p)
            for (const f of p) yield [a, b, c, d, e, f];
}

interface Cand {
  dmg30: number;
  dps: number;
  ultMult: number;
  path: string;
  picks: Path[];
  style: Style;
  arch: BuildArchetype;
  packageId: string;
  packageName: string;
  scenario: "ST" | "MULTI";
  powerburst: boolean;
  multiWeight: number;
  tiles: number;
  ad: number;
  armour: number;
  lp: number;
  gods: string;
  blessings: string;
  hasHP: boolean;
  hasAegis: boolean;
  hasSplash: boolean;
  hasBB: boolean;
  weaponTier: number;
  offhand: string;
  pieces: string;
}

const cands: Cand[] = [];
let n = 0;

const scenarios: { scenario: "ST" | "MULTI"; multi: number; tiles: number }[] = [
  { scenario: "ST", multi: 0, tiles: 1 },
  { scenario: "MULTI", multi: 1, tiles: 25 },
];

const t0 = Date.now();

for (const picks of allPaths()) {
  const active = activeBlessings(picks);
  const ids = new Set(active.map((b) => b.id));
  const hasHP = ids.has("higher-power");

  for (const style of STYLES.map((s) => s.id) as Style[]) {
    for (const arch of ARCH) {
      for (const pkg of REGION_PACKAGES as readonly RegionPackage[]) {
        const { snapshot, loadout, offhand } = gearFromPackage(pkg, style, arch);
        for (const sc of scenarios) {
          for (const powerburst of [true, false]) {
            const r = modelCombat({
              picks,
              style,
              stage,
              archetype: arch,
              offhand, // actual equipped, not nominal archetype
              herbloreLevel: 110,
              targetTiles: sc.tiles,
              multiContentWeight: sc.multi,
              powerburst,
              gear: snapshot,
            });
            const um = ultWindowMult(style, hasHP);
            const dmg30 = r.dps * 30 * um;
            cands.push({
              dmg30,
              dps: r.dps,
              ultMult: um,
              path: pathCode(picks),
              picks: [...picks],
              style,
              arch,
              packageId: pkg.id,
              packageName: pkg.name,
              scenario: sc.scenario,
              powerburst,
              multiWeight: sc.multi,
              tiles: sc.tiles,
              ad: r.stats.effectiveAd,
              armour: r.stats.armour,
              lp: r.stats.maxLp,
              gods: `${r.god4 ?? "?"}/${r.god8 ?? "?"}`,
              blessings: r.active.map((b) => b.id).join(","),
              hasHP,
              hasAegis: ids.has("teragards-aegis"),
              hasSplash: ids.has("splash-zone"),
              hasBB: ids.has("big-boned"),
              weaponTier: snapshot.weaponTier,
              offhand,
              pieces: loadout.pieces.map((p) => p.name).join(" | "),
            });
            n++;
          }
        }
      }
    }
  }
}

const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
cands.sort((a, b) => b.dmg30 - a.dmg30);

const best = cands[0]!;
const bestST = cands.find((c) => c.scenario === "ST")!;
const bestMulti = cands.find((c) => c.scenario === "MULTI")!;

// Dedup ties for unique path+style+arch+pkg+scenario
function uniqueTop(list: Cand[], k: number): Cand[] {
  const out: Cand[] = [];
  const seen = new Set<string>();
  for (const c of list) {
    const key = `${c.path}|${c.style}|${c.arch}|${c.packageId}|${c.scenario}|${c.offhand}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
    if (out.length >= k) break;
  }
  return out;
}

console.log(`Simulated ${n} configs in ${elapsed}s\n`);

function print(c: Cand, label: string) {
  console.log(`\n========== ${label} ==========`);
  console.log(`30s DAMAGE: ${Math.round(c.dmg30).toLocaleString()}`);
  console.log(`  = dps ${Math.round(c.dps)} × 30s × ult ${c.ultMult.toFixed(2)}`);
  console.log(`Path: ${c.path}  (${c.picks.join(" → ")})`);
  console.log(`Gods: ${c.gods}`);
  console.log(`Style: ${c.style} | Archetype intent: ${c.arch} | Offhand actual: ${c.offhand}`);
  console.log(`Regions: ${c.packageName}`);
  console.log(`Scenario: ${c.scenario} multi=${c.multiWeight} tiles=${c.tiles} PB=${c.powerburst}`);
  console.log(`AD ${c.ad} | Armour ${c.armour} | LP ${c.lp} | T${c.weaponTier}`);
  console.log(
    `Higher Power: ${c.hasHP} | Aegis: ${c.hasAegis} | Big Boned: ${c.hasBB} | Splash: ${c.hasSplash}`,
  );
  console.log(`Blessings: ${c.blessings}`);
  console.log(`Gear: ${c.pieces}`);
}

print(best, "ABSOLUTE #1 — HIGHEST 30s DAMAGE");
print(bestST, "BEST STRICT SINGLE-TARGET 30s");
print(bestMulti, "BEST MULTI/AOE 30s");

console.log("\n=== TOP 15 UNIQUE ===");
for (const [i, c] of uniqueTop(cands, 15).entries()) {
  console.log(
    `#${String(i + 1).padStart(2)} ${Math.round(c.dmg30).toLocaleString().padStart(10)}  ${c.path}  ${c.style.padEnd(11)} ${c.offhand.padEnd(8)} ${c.scenario.padEnd(5)} ${c.packageId.slice(0, 24).padEnd(24)} HP=${c.hasHP} splash=${c.hasSplash}`,
  );
}

console.log("\n=== BEST ST PER STYLE ===");
for (const style of STYLES.map((s) => s.id) as Style[]) {
  const c = cands.find((x) => x.scenario === "ST" && x.style === style)!;
  console.log(
    `${style.padEnd(12)} ${Math.round(c.dmg30).toLocaleString().padStart(10)}  ${c.path}  ${c.offhand.padEnd(8)} ${c.packageId}  HP=${c.hasHP} ult${c.ultMult}`,
  );
}

console.log("\n=== BEST MULTI PER STYLE ===");
for (const style of STYLES.map((s) => s.id) as Style[]) {
  const c = cands.find((x) => x.scenario === "MULTI" && x.style === style)!;
  console.log(
    `${style.padEnd(12)} ${Math.round(c.dmg30).toLocaleString().padStart(10)}  ${c.path}  ${c.offhand.padEnd(8)} ${c.packageId}  HP=${c.hasHP}`,
  );
}

// Compare Higher Power vs Keep Ults for top style
console.log("\n=== Higher Power vs Ultimates (melee ST, top packages) ===");
const meleeST = cands.filter((c) => c.style === "melee" && c.scenario === "ST" && c.offhand === "shield");
const bestHp = meleeST.find((c) => c.hasHP);
const bestNoHp = meleeST.find((c) => !c.hasHP);
if (bestHp && bestNoHp) {
  console.log("Best WITH Higher Power:", Math.round(bestHp.dmg30), bestHp.path, bestHp.packageId);
  console.log("Best WITHOUT (keep Berserk):", Math.round(bestNoHp.dmg30), bestNoHp.path, bestNoHp.packageId);
  console.log(
    "Ultimates win by",
    (((bestNoHp.dmg30 - bestHp.dmg30) / bestHp.dmg30) * 100).toFixed(1) + "%",
  );
}

const second = uniqueTop(cands, 2)[1]!;
console.log(
  `\n#1 vs #2 unique margin: ${(((best.dmg30 - second.dmg30) / second.dmg30) * 100).toFixed(3)}%`,
);

mkdirSync("artifacts", { recursive: true });
const report = {
  generated: new Date().toISOString(),
  sims: n,
  elapsedSec: Number(elapsed),
  method:
    "damage_30s = model_dps * 30 * ultWindowMult. Full 729×4×3×7×2×2 search. Offhand from actual loadout (2H never pairs with OH). Ult mult: melee 1.68 / magic 1.52 / ranged 1.5 / necro 1.42 when Higher Power absent.",
  absoluteWinner: best,
  bestSingleTarget: bestST,
  bestMulti: bestMulti,
  top15unique: uniqueTop(cands, 15),
  conclusiveStatement: `Within this model's complete search space (${n} configs), the unique maximum 30-second damage is path ${best.path} ${best.style} ${best.offhand} ${best.scenario} on ${best.packageId}: ${Math.round(best.dmg30)} damage units.`,
};
writeFileSync("artifacts/sim-30s-winner.json", JSON.stringify(report, null, 2));
console.log("\n" + report.conclusiveStatement);
console.log("Wrote artifacts/sim-30s-winner.json");
