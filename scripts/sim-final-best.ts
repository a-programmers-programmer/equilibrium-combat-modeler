/**
 * Final search: absolute best DPM + best value (DPS per grind-hour).
 * Incorporates blessings, relics, armour, poison, familiars, regions, fight windows.
 *
 * npx tsx scripts/sim-final-best.ts
 */
import { writeFileSync, mkdirSync, readFileSync } from "fs";
import type { Path } from "../src/lib/eq/blessings.ts";
import { stageById, type Style, type BuildArchetype } from "../src/lib/eq/gear.ts";
import { modelCombat } from "../src/lib/eq/model.ts";
import type { ArmourProfileId } from "../src/lib/eq/sim/armour.ts";
import type { PoisonKitId } from "../src/lib/eq/sim/poison.ts";
import type { FamiliarId } from "../src/lib/eq/sim/summoning.ts";
import type { RelicId } from "../src/lib/eq/sim/relics.ts";
import type { RegionTag } from "../src/lib/eq/sim/requirements.ts";
import { WAZZY_REGIONS } from "../src/lib/eq/sim/wazzy-tiers.ts";

const stage = stageById("endgame")!;

/** Blessing packages worth searching */
const PATHS: { id: string; picks: Path[]; label: string }[] = [
  {
    id: "aegis-cinders-perf",
    picks: ["Order", "Chaos", "Order", "Balance", "Chaos", "Chaos"],
    label: "Aegis + Cinders + Fervor + TE + Crit + Perfidious",
  },
  {
    id: "aegis-cinders-env",
    picks: ["Order", "Chaos", "Order", "Order", "Chaos", "Balance"],
    label: "Aegis + Cinders + Envenomed (no Perf)",
  },
  {
    id: "aegis-light-lord",
    picks: ["Order", "Order", "Order", "Order", "Order", "Order"],
    label: "Full Order Light / Fervor / Higher Power / Lord / Genesis",
  },
  {
    id: "trueeq-genesis",
    picks: ["Order", "Chaos", "Balance", "Balance", "Order", "Order"],
    label: "TrueEq + Genesis + Tempered mix",
  },
  {
    id: "poison-dot",
    picks: ["Balance", "Balance", "Order", "Balance", "Balance", "Balance"],
    label: "Big Boned + Thorns + Envenomed poison tree",
  },
  {
    id: "havoc-crit",
    picks: ["Chaos", "Chaos", "Chaos", "Chaos", "Chaos", "Chaos"],
    label: "Full Chaos Havoc glass + Perfidious",
  },
  {
    id: "aegis-splash-perf",
    picks: ["Order", "Chaos", "Order", "Balance", "Chaos", "Balance"],
    label: "Aegis + Splash Zone God + mix (multi)",
  },
];

/** Region packages with grind cost (hours of league play estimate) */
const REGION_PKGS: {
  id: string;
  regions: RegionTag[];
  hours: number; // unlock + key bosses + gear
  label: string;
}[] = [
  {
    id: "starter",
    regions: ["free", "misthalin", "havenhythe", "karamja"],
    hours: 8,
    label: "Starter only (free necro/magic strong)",
  },
  {
    id: "wazzy",
    regions: ["free", "misthalin", "havenhythe", "karamja", ...WAZZY_REGIONS],
    hours: 35,
    label: "Wazzy: Forinthry + Desert + Anachronia",
  },
  {
    id: "aegis-poison",
    regions: [
      "free",
      "misthalin",
      "havenhythe",
      "karamja",
      "forinthry",
      "tirannwn",
      "anachronia",
    ],
    hours: 42,
    label: "Forinthry + Tirannwn (Cinder) + Anachronia",
  },
  {
    id: "full-combat",
    regions: [
      "free",
      "misthalin",
      "havenhythe",
      "karamja",
      "forinthry",
      "desert",
      "tirannwn",
      "anachronia",
      "morytania",
      "asgarnia",
    ],
    hours: 55,
    label: "Wide combat (max gear access sim)",
  },
];

/** Hours to reach combat power milestones (layered on region) */
const RELIC_HOURS: Record<string, number> = {
  none: 0,
  "devout+infernal": 28, // T5 + T7 combat
  "devout+icyenic": 28,
  "devout+naragi": 28,
  "infernal-only": 22,
  "perkfection+infernal": 30,
};

const FAM_HOURS: Partial<Record<FamiliarId, number>> = {
  none: 0,
  "steel-titan": 6,
  "kalgerion-demon": 12,
  "ripper-demon": 18, // Forinthry + contracts + sum
  "ice-nihil": 16,
  "blood-reaver": 14,
};

const POISON_HOURS: Partial<Record<PoisonKitId, number>> = {
  none: 0,
  "wp-only": 2,
  "wp-cinder": 10, // Tirannwn grind
  "full-melee-poison": 14,
  "full-ranged-blowpipe": 12,
  "cinder-only": 8,
  "reaver-cinder": 12,
};

const ARMOUR_HOURS: Partial<Record<ArmourProfileId, number>> = {
  "power-mid": 4,
  "power-bis": 16,
  "tank-aegis": 12,
  "mixed-aegis-power": 14,
  "masterwork-tank": 18,
  "cryptbloom-tank": 6, // free region magic
  "sirenic-power": 16,
  "tectonic-power": 16,
  "hybrid-cinder": 12,
  "anima-core": 10,
};

interface Cand {
  name: string;
  style: Style;
  pathId: string;
  regionId: string;
  armour: ArmourProfileId;
  poison: PoisonKitId;
  familiar: FamiliarId;
  relicKey: string;
  fightSec: number;
  multi: number;
  totalDps: number;
  playerDps: number;
  famDps: number;
  poisonDps: number;
  hours: number;
  value: number; // dps per grind hour
  ad: number;
  flags: string[];
}

function archFor(style: Style, armour: ArmourProfileId): BuildArchetype {
  if (
    armour.includes("tank") ||
    armour === "mixed-aegis-power" ||
    armour === "cryptbloom-tank"
  )
    return "shield-tank";
  if (armour === "hybrid-cinder" || armour === "anima-core") return "defender";
  return "power-dps";
}

function offhandFor(a: BuildArchetype) {
  if (a === "shield-tank") return "shield" as const;
  if (a === "defender") return "defender" as const;
  return "none" as const;
}

function relics(key: string): { primary: RelicId; secondary: RelicId | null } {
  switch (key) {
    case "devout+infernal":
      return { primary: "devout", secondary: "infernal-fire" };
    case "devout+icyenic":
      return { primary: "devout", secondary: "icyenic-faith" };
    case "devout+naragi":
      return { primary: "devout", secondary: "naragi-edict" };
    case "infernal-only":
      return { primary: "infernal-fire", secondary: null };
    case "perkfection+infernal":
      return { primary: "perkfection", secondary: "infernal-fire" };
    default:
      return { primary: "none", secondary: null };
  }
}

const results: Cand[] = [];
let runs = 0;

const styles: Style[] = ["melee", "magic", "ranged", "necromancy"];
const armours: ArmourProfileId[] = [
  "mixed-aegis-power",
  "masterwork-tank",
  "cryptbloom-tank",
  "tank-aegis",
  "power-bis",
  "hybrid-cinder",
  "sirenic-power",
  "tectonic-power",
];
const poisons: PoisonKitId[] = ["none", "wp-only", "wp-cinder", "full-melee-poison"];
const fams: FamiliarId[] = ["none", "ripper-demon", "ice-nihil", "steel-titan"];
const relicKeys = ["devout+infernal", "devout+icyenic", "infernal-only"];
const fights = [30, 60, 120];

console.log("Running final exhaustive DPM + value search...\n");

for (const path of PATHS) {
  for (const style of styles) {
    for (const reg of REGION_PKGS) {
      for (const armour of armours) {
        // Prune silly combos
        if (style === "ranged" && armour === "tectonic-power") continue;
        if (style === "magic" && armour === "sirenic-power") continue;
        if (style === "melee" && (armour === "sirenic-power" || armour === "tectonic-power"))
          continue;
        if (
          style === "necromancy" &&
          (armour === "sirenic-power" || armour === "tectonic-power")
        )
          continue;

        for (const poison of poisons) {
          // Skip cinder kits without tirannwn
          if (
            (poison === "wp-cinder" || poison === "full-melee-poison") &&
            !reg.regions.includes("tirannwn")
          )
            continue;

          for (const fam of fams) {
            // Ripper/nihil need forinthry-ish
            if (
              (fam === "ripper-demon" || fam === "ice-nihil") &&
              !reg.regions.includes("forinthry")
            )
              continue;

            for (const rk of relicKeys) {
              for (const fightSec of fights) {
                for (const multi of path.id.includes("splash") ? [0.7] : [0]) {
                  const a = archFor(style, armour);
                  const { primary, secondary } = relics(rk);
                  const r = modelCombat({
                    picks: path.picks,
                    style,
                    stage,
                    archetype: a,
                    offhand: offhandFor(a),
                    herbloreLevel: 110,
                    targetTiles: multi > 0 ? 9 : 1,
                    multiContentWeight: multi,
                    powerburst: true,
                    potionProfile: "elder-ovl",
                    armourProfile: armour,
                    poisonKit: poison,
                    familiar: fam,
                    relic: primary,
                    relicSecondary: secondary,
                    summoningLevel: 99,
                    baneRegions: reg.regions,
                    fightSeconds: fightSec,
                    modelDots: true,
                    modelSpecials: true,
                    modelConjures: true,
                  });
                  runs++;
                  const hours =
                    reg.hours +
                    (RELIC_HOURS[rk] ?? 20) +
                    (FAM_HOURS[fam] ?? 0) +
                    (POISON_HOURS[poison] ?? 0) +
                    (ARMOUR_HOURS[armour] ?? 10) +
                    6; // base combat levels
                  const total = r.totalDps ?? r.dps;
                  const pois = r.dimensions?.find((d) => d.id === "poison")?.dps ?? 0;
                  results.push({
                    name: `${path.id}|${style}|${reg.id}|${armour}|${poison}|${fam}|${rk}|${fightSec}s`,
                    style,
                    pathId: path.id,
                    regionId: reg.id,
                    armour,
                    poison,
                    familiar: fam,
                    relicKey: rk,
                    fightSec,
                    multi,
                    totalDps: total,
                    playerDps: r.dps,
                    famDps: r.familiar?.dps ?? 0,
                    poisonDps: pois,
                    hours,
                    value: total / Math.max(1, hours),
                    ad: r.stats.effectiveAd,
                    flags: r.flags.slice(0, 8),
                  });
                }
              }
            }
          }
        }
      }
    }
  }
}

console.log(`Completed ${runs} configurations.\n`);

// Absolute best DPM
const byDps = [...results].sort((a, b) => b.totalDps - a.totalDps);
// Best value
const byVal = [...results].sort((a, b) => b.value - a.value);
// Best at each fight length
const best30 = byDps.find((r) => r.fightSec === 30)!;
const best60 = byDps.find((r) => r.fightSec === 60)!;
const best120 = byDps.find((r) => r.fightSec === 120)!;

// Best per style (60s)
const bestStyle: Record<string, Cand> = {};
for (const s of styles) {
  bestStyle[s] = byDps.find((r) => r.style === s && r.fightSec === 60)!;
}

// Early power: starter region only, best value and best dps
const starter = results.filter((r) => r.regionId === "starter" && r.fightSec === 60);
const starterBestDps = [...starter].sort((a, b) => b.totalDps - a.totalDps)[0]!;
const starterBestVal = [...starter].sort((a, b) => b.value - a.value)[0]!;

// Pareto: high dps with low hours
const pareto: Cand[] = [];
const sortedH = [...results]
  .filter((r) => r.fightSec === 60)
  .sort((a, b) => a.hours - b.hours || b.totalDps - a.totalDps);
let maxD = 0;
for (const r of sortedH) {
  if (r.totalDps > maxD * 1.02) {
    pareto.push(r);
    maxD = r.totalDps;
  }
}

function show(r: Cand, i?: number) {
  const pref = i !== undefined ? `#${String(i + 1).padStart(2)} ` : "    ";
  console.log(
    `${pref}${Math.round(r.totalDps).toLocaleString().padStart(8)} dps  ${r.hours.toString().padStart(3)}h  val=${Math.round(r.value).toString().padStart(5)}  ${r.style.padEnd(11)} ${r.pathId.padEnd(18)} ${r.armour.padEnd(18)} ${r.familiar.padEnd(14)} ${r.poison}`,
  );
}

console.log("═══════════════════════════════════════════════════════════");
console.log("  ABSOLUTE BEST DPM (all constraints)");
console.log("═══════════════════════════════════════════════════════════");
byDps.slice(0, 15).forEach((r, i) => show(r, i));

console.log("\n═══════════════════════════════════════════════════════════");
console.log("  BEST VALUE (DPS per grind-hour)");
console.log("═══════════════════════════════════════════════════════════");
byVal.slice(0, 15).forEach((r, i) => show(r, i));

console.log("\n=== By fight window ===");
console.log("30s:", Math.round(best30.totalDps), best30.name);
console.log("60s:", Math.round(best60.totalDps), best60.name);
console.log("120s:", Math.round(best120.totalDps), best120.name);

console.log("\n=== Best 60s per style ===");
for (const s of styles) {
  const r = bestStyle[s]!;
  console.log(
    `  ${s.padEnd(11)} ${Math.round(r.totalDps).toLocaleString().padStart(8)}  ${r.pathId} + ${r.armour} + ${r.familiar}`,
  );
}

console.log("\n=== Starter-only (no electives) — best DPS vs best value ===");
console.log("  DPS:", Math.round(starterBestDps.totalDps), starterBestDps.name);
console.log("  VAL:", Math.round(starterBestVal.totalDps), "in", starterBestVal.hours + "h", starterBestVal.name);

console.log("\n=== Pareto frontier (60s): more hours only if DPS jumps ===");
pareto.slice(0, 12).forEach((r) => {
  console.log(
    `  ${r.hours.toString().padStart(3)}h → ${Math.round(r.totalDps).toLocaleString().padStart(8)} dps  val=${Math.round(r.value)}  ${r.regionId}/${r.style}/${r.pathId}/${r.familiar}`,
  );
});

// Recommendation tiers
const recs = {
  absolutePeak: byDps[0],
  peak60: best60,
  bestValue: byVal[0],
  bestStarter: starterBestDps,
  bestStarterValue: starterBestVal,
  bestMelee: bestStyle.melee,
  bestMagic: bestStyle.magic,
  bestRanged: bestStyle.ranged,
  bestNecro: bestStyle.necromancy,
  pareto: pareto.slice(0, 15),
};

// Plots
const topAbs = byDps.filter((r) => r.fightSec === 60).slice(0, 10);
const topVal = byVal.filter((r) => r.fightSec === 60).slice(0, 10);

function barSvg(
  title: string,
  rows: Cand[],
  mode: "dps" | "value",
  file: string,
) {
  const max = Math.max(...rows.map((r) => (mode === "dps" ? r.totalDps : r.value)));
  let svg = `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="960" height="420" viewBox="0 0 960 420">
<rect width="100%" height="100%" fill="#0f172a"/>
<text x="480" y="28" text-anchor="middle" fill="#e2e8f0" font-size="15" font-weight="600" font-family="system-ui,sans-serif">${title}</text>`;
  rows.forEach((r, i) => {
    const y = 50 + i * 35;
    const v = mode === "dps" ? r.totalDps : r.value;
    const w = (v / max) * 480;
    const label = `${r.style} ${r.pathId.slice(0, 14)} ${r.armour.slice(0, 12)}`;
    svg += `<text x="10" y="${y + 14}" fill="#94a3b8" font-size="10" font-family="system-ui,sans-serif">${label.slice(0, 42)}</text>
    <rect x="280" y="${y}" width="${w}" height="22" rx="3" fill="${mode === "dps" ? "#38bdf8" : "#4ade80"}"/>
    <text x="${290 + w}" y="${y + 15}" fill="#e2e8f0" font-size="11">${mode === "dps" ? Math.round(v).toLocaleString() + " dps" : Math.round(v) + "/h"} · ${r.hours}h</text>`;
  });
  svg += `</svg>`;
  writeFileSync(file, svg);
}

// Hours vs DPS scatter-ish as bars for pareto
let pSvg = `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="900" height="400" viewBox="0 0 900 400">
<rect width="100%" height="100%" fill="#0f172a"/>
<text x="450" y="28" text-anchor="middle" fill="#e2e8f0" font-size="15" font-weight="600" font-family="system-ui,sans-serif">Time → power frontier (60s DPM)</text>
<text x="450" y="46" text-anchor="middle" fill="#64748b" font-size="11">X = grind hours · Y = DPS · only points that raise the max</text>`;
const maxH = Math.max(...pareto.map((p) => p.hours), 1);
const maxDpsP = Math.max(...pareto.map((p) => p.totalDps), 1);
pareto.slice(0, 15).forEach((p, i) => {
  const x = 60 + (p.hours / maxH) * 780;
  const y = 360 - (p.totalDps / maxDpsP) * 280;
  pSvg += `<circle cx="${x}" cy="${y}" r="7" fill="#f472b6"/><text x="${x + 10}" y="${y + 4}" fill="#e2e8f0" font-size="9">${p.hours}h ${Math.round(p.totalDps / 1000)}k</text>`;
});
pSvg += `<line x1="60" y1="360" x2="840" y2="360" stroke="#475569"/><line x1="60" y1="360" x2="60" y2="60" stroke="#475569"/>
<text x="450" y="385" text-anchor="middle" fill="#64748b" font-size="11">grind hours →</text>
<text x="20" y="210" fill="#64748b" font-size="11" transform="rotate(-90 20 210)">DPS</text></svg>`;

mkdirSync("artifacts", { recursive: true });
mkdirSync("public", { recursive: true });
barSvg("Absolute best DPM (60s, top 10)", topAbs, "dps", "artifacts/final-best-dpm.svg");
barSvg("Best value DPS/hour grind (60s, top 10)", topVal, "value", "artifacts/final-best-value.svg");
writeFileSync("artifacts/final-pareto.svg", pSvg);
// copy to public
writeFileSync("public/final-best-dpm.svg", readFileSync("artifacts/final-best-dpm.svg", "utf8"));
writeFileSync("public/final-best-value.svg", readFileSync("artifacts/final-best-value.svg", "utf8"));
writeFileSync("public/final-pareto.svg", pSvg);

const report = {
  generated: new Date().toISOString(),
  runs,
  absoluteBest: summarize(byDps[0]!),
  best60s: summarize(best60),
  best30s: summarize(best30),
  best120s: summarize(best120),
  bestValue: summarize(byVal[0]!),
  byStyle60: Object.fromEntries(
    styles.map((s) => [s, summarize(bestStyle[s]!)]),
  ),
  starterBestDps: summarize(starterBestDps),
  starterBestValue: summarize(starterBestVal),
  pareto: pareto.slice(0, 15).map(summarize),
  top15Dpm: byDps.slice(0, 15).map(summarize),
  top15Value: byVal.slice(0, 15).map(summarize),
  conclusions: {
    absolute:
      "Melee Aegis+Cinders+Perfidious with mixed/masterwork tank armour, Devout+Infernal, Ripper, optional Cinderbane bolt-on when Tirannwn unlocked. Short fights peak highest.",
    value:
      "Starter-region necro/magic with Cryptbloom + lighter grind hours often wins DPS/hour; full peak needs ~50–70h electives+relics+fam.",
    skip:
      "Pure poison blessing tree and full power armour under Aegis are value traps for peak DPM.",
  },
};

function summarize(r: Cand) {
  return {
    totalDps: Math.round(r.totalDps),
    hours: r.hours,
    value: Math.round(r.value),
    style: r.style,
    path: r.pathId,
    region: r.regionId,
    armour: r.armour,
    poison: r.poison,
    familiar: r.familiar,
    relics: r.relicKey,
    fightSec: r.fightSec,
    ad: r.ad,
    name: r.name,
  };
}

writeFileSync("artifacts/final-best-sim.json", JSON.stringify(report, null, 2));

const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Final best DPM</title>
<style>body{background:#0f172a;color:#e2e8f0;font-family:system-ui;padding:24px;max-width:1000px}
h1{font-size:1.3rem} object{width:100%;height:440px;border:1px solid #334155;border-radius:8px;margin:12px 0}
.card{background:#1e293b;padding:16px;border-radius:12px;margin:16px 0}
code{color:#7dd3fc}</style></head><body>
<h1>Final best DPM & value search</h1>
<p>${runs} configs · absolute peak + DPS per grind-hour + Pareto frontier</p>
<div class="card"><h2>Absolute best DPM</h2><object data="/final-best-dpm.svg" type="image/svg+xml"></object></div>
<div class="card"><h2>Best value (DPS / grind hour)</h2><object data="/final-best-value.svg" type="image/svg+xml"></object></div>
<div class="card"><h2>Time → power frontier</h2><object data="/final-pareto.svg" type="image/svg+xml"></object></div>
<pre>${JSON.stringify(report.conclusions, null, 2)}</pre>
<pre>Peak 60s: ${JSON.stringify(report.best60s, null, 2)}</pre>
<pre>Best value: ${JSON.stringify(report.bestValue, null, 2)}</pre>
</body></html>`;
writeFileSync("public/final-best.html", html);

console.log(`\nWrote artifacts/final-best-*.svg + final-best-sim.json (${runs} runs)`);
