/**
 * Re-rank builds by value using REAL league XP mults (5×→8×→12×→16×).
 * npx tsx scripts/sim-league-value.ts
 */
import { writeFileSync, mkdirSync } from "fs";
import type { Path } from "../src/lib/eq/blessings.ts";
import { stageById, type Style } from "../src/lib/eq/gear.ts";
import { modelCombat } from "../src/lib/eq/model.ts";
import type { ArmourProfileId } from "../src/lib/eq/sim/armour.ts";
import type { PoisonKitId } from "../src/lib/eq/sim/poison.ts";
import type { FamiliarId } from "../src/lib/eq/sim/summoning.ts";
import type { RelicId } from "../src/lib/eq/sim/relics.ts";
import type { RegionTag } from "../src/lib/eq/sim/requirements.ts";
import {
  hoursToPower,
  hoursIfFlatMult,
  chartSkillLeaguePhased,
} from "../src/lib/eq/sim/league-hours.ts";
import { leagueMultForRelicTier, LEAGUE_XP_MULT } from "../src/lib/eq/xp.ts";

const stage = stageById("endgame")!;

const PATHS: { id: string; picks: Path[] }[] = [
  { id: "aegis-cinders-perf", picks: ["Order", "Chaos", "Order", "Balance", "Chaos", "Chaos"] },
  { id: "aegis-cinders-env", picks: ["Order", "Chaos", "Order", "Order", "Chaos", "Balance"] },
  { id: "poison-dot", picks: ["Balance", "Balance", "Order", "Balance", "Balance", "Balance"] },
];

const REGIONS: { id: string; regions: RegionTag[]; electives: string[] }[] = [
  {
    id: "starter",
    regions: ["free", "misthalin", "havenhythe", "karamja"],
    electives: [],
  },
  {
    id: "wazzy",
    regions: ["free", "misthalin", "havenhythe", "karamja", "forinthry", "desert", "anachronia"],
    electives: ["forinthry", "desert", "anachronia"],
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
    electives: ["forinthry", "tirannwn", "anachronia"],
  },
];

interface Row {
  name: string;
  style: Style;
  pathId: string;
  regionId: string;
  armour: ArmourProfileId;
  poison: PoisonKitId;
  familiar: FamiliarId;
  relicKey: string;
  totalDps: number;
  hours: number;
  skillH: number;
  padH: number;
  effMult: number;
  value: number;
  endgame: boolean;
}

function relics(key: string): { primary: RelicId; secondary: RelicId | null } {
  if (key === "devout+infernal") return { primary: "devout", secondary: "infernal-fire" };
  if (key === "infernal-only") return { primary: "infernal-fire", secondary: null };
  if (key === "devout+icyenic") return { primary: "devout", secondary: "icyenic-faith" };
  return { primary: "none", secondary: null };
}

const rows: Row[] = [];
let runs = 0;

console.log("League mult schedule:", LEAGUE_XP_MULT.map((r) => r.label).join(" · "));
console.log("Re-ranking with phased 5×→16× skill hours + content pads...\n");

// Mult impact demo
console.log("=== League mult impact (necromancy 1→99 XP only) ===");
for (const m of [5, 8, 12, 16]) {
  console.log(`  flat ${m}×: ${hoursIfFlatMult("necromancy", 99, [], m).toFixed(2)}h`);
}
console.log(
  `  phased 5→16×: ${chartSkillLeaguePhased("necromancy", 1, 99, []).hours.toFixed(2)}h\n`,
);

const styles: Style[] = ["necromancy", "melee", "magic", "ranged"];
const armours: ArmourProfileId[] = [
  "cryptbloom-tank",
  "mixed-aegis-power",
  "masterwork-tank",
  "tank-aegis",
  "power-bis",
  "hybrid-cinder",
];
const poisons: PoisonKitId[] = ["none", "wp-only", "wp-cinder", "full-melee-poison"];
const fams: FamiliarId[] = ["none", "steel-titan", "ice-nihil", "ripper-demon"];
const relicKeys = ["infernal-only", "devout+infernal", "devout+icyenic"];

for (const path of PATHS) {
  for (const style of styles) {
    for (const reg of REGIONS) {
      for (const armour of armours) {
        if (style === "ranged" && armour === "cryptbloom-tank") {
          /* ok tank hybrid */
        }
        for (const poison of poisons) {
          if (
            (poison === "wp-cinder" || poison === "full-melee-poison") &&
            !reg.regions.includes("tirannwn")
          )
            continue;
          for (const fam of fams) {
            if (
              (fam === "ice-nihil" || fam === "ripper-demon") &&
              !reg.regions.includes("forinthry")
            )
              continue;
            for (const rk of relicKeys) {
              for (const endgame of [false, true]) {
                // Mid builds don't need full end pads
                if (!endgame && (poison.includes("cinder") || poison === "full-melee-poison"))
                  continue;
                if (!endgame && (fam === "ice-nihil" || fam === "ripper-demon")) continue;
                if (!endgame && armour === "masterwork-tank") continue;

                const a =
                  armour.includes("tank") || armour === "mixed-aegis-power"
                    ? "shield-tank"
                    : armour === "hybrid-cinder"
                      ? "defender"
                      : "power-dps";
                const { primary, secondary } = relics(rk);
                const r = modelCombat({
                  picks: path.picks,
                  style,
                  stage,
                  archetype: a as any,
                  offhand:
                    a === "shield-tank" ? "shield" : a === "defender" ? "defender" : "none",
                  herbloreLevel: endgame || poison !== "none" ? 110 : 90,
                  targetTiles: 1,
                  multiContentWeight: 0,
                  powerburst: true,
                  potionProfile: endgame ? "elder-ovl" : "overload",
                  armourProfile: armour,
                  poisonKit: poison,
                  familiar: fam,
                  relic: primary,
                  relicSecondary: secondary,
                  summoningLevel: fam === "none" ? 1 : 99,
                  baneRegions: reg.regions,
                  fightSeconds: 60,
                });
                const h = hoursToPower({
                  style,
                  regions: reg.regions,
                  electives: reg.electives,
                  armour,
                  poison,
                  familiar: fam,
                  relicKey: rk,
                  endgame,
                });
                runs++;
                const total = r.totalDps ?? r.dps;
                rows.push({
                  name: `${path.id}|${style}|${reg.id}|${armour}|${poison}|${fam}|${rk}|${endgame ? "end" : "mid"}`,
                  style,
                  pathId: path.id,
                  regionId: reg.id,
                  armour,
                  poison,
                  familiar: fam,
                  relicKey: rk,
                  totalDps: total,
                  hours: h.totalHours,
                  skillH: h.skillHours,
                  padH: h.contentPadHours,
                  effMult: h.effectiveMult,
                  value: total / Math.max(0.5, h.totalHours),
                  endgame,
                });
              }
            }
          }
        }
      }
    }
  }
}

console.log(`Ran ${runs} builds with league-scaled hours.\n`);

const byDps = [...rows].sort((a, b) => b.totalDps - a.totalDps);
const byVal = [...rows].sort((a, b) => b.value - a.value);

function show(r: Row, i: number) {
  console.log(
    `#${String(i + 1).padStart(2)} ${Math.round(r.totalDps).toLocaleString().padStart(8)} dps  ${r.hours.toFixed(1).padStart(6)}h  (xp ${r.skillH.toFixed(1)} + pad ${r.padH.toFixed(1)})  ~${r.effMult.toFixed(0)}×  val=${Math.round(r.value).toString().padStart(5)}  ${r.style.padEnd(11)} ${r.regionId.padEnd(12)} ${r.familiar.padEnd(12)} ${r.endgame ? "END" : "mid"}`,
  );
}

console.log("══════════════════════════════════════════════════════");
console.log("  ABSOLUTE BEST DPM (league hours annotated)");
console.log("══════════════════════════════════════════════════════");
byDps.slice(0, 12).forEach((r, i) => show(r, i));

console.log("\n══════════════════════════════════════════════════════");
console.log("  BEST VALUE = DPS / league-scaled hours");
console.log("══════════════════════════════════════════════════════");
byVal.slice(0, 15).forEach((r, i) => show(r, i));

// Pareto
const sortedH = [...rows].sort((a, b) => a.hours - b.hours || b.totalDps - a.totalDps);
const pareto: Row[] = [];
let maxD = 0;
for (const r of sortedH) {
  if (r.totalDps > maxD * 1.015) {
    pareto.push(r);
    maxD = r.totalDps;
  }
}
console.log("\n=== Pareto: hours (w/ league mults) → DPS ===");
pareto.slice(0, 14).forEach((r) => {
  console.log(
    `  ${r.hours.toFixed(1).padStart(6)}h → ${Math.round(r.totalDps).toLocaleString().padStart(8)}  val=${Math.round(r.value)}  ${r.style}/${r.regionId}/${r.familiar}/${r.endgame ? "end" : "mid"}  mult~${r.effMult.toFixed(0)}×`,
  );
});

// Practical recommendation band
const practical = byVal.filter(
  (r) =>
    r.pathId === "aegis-cinders-perf" &&
    (r.style === "necromancy" || r.style === "melee") &&
    r.hours <= 40,
);
console.log("\n=== Practical band (Aegis path, necro/melee, ≤40h league) ===");
practical.slice(0, 8).forEach((r, i) => show(r, i));

const peak = byDps[0]!;
const bestVal = byVal[0]!;
const bestPrac = practical[0]!;

// SVG
const topV = byVal.slice(0, 10);
const maxV = Math.max(...topV.map((r) => r.value));
let svg = `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="960" height="420" viewBox="0 0 960 420">
<rect width="100%" height="100%" fill="#0f172a"/>
<text x="480" y="26" text-anchor="middle" fill="#e2e8f0" font-size="15" font-weight="600" font-family="system-ui,sans-serif">Best value with league XP mults (5×→16× phased)</text>
<text x="480" y="44" text-anchor="middle" fill="#64748b" font-size="11">DPS / wall-clock hour · skill XP uses mults · boss/region pads do not</text>`;
topV.forEach((r, i) => {
  const y = 58 + i * 34;
  const w = (r.value / maxV) * 420;
  svg += `<text x="10" y="${y + 14}" fill="#94a3b8" font-size="10">${r.style} ${r.regionId} ${r.familiar}</text>
  <rect x="220" y="${y}" width="${w}" height="20" rx="3" fill="#4ade80"/>
  <text x="${230 + w}" y="${y + 14}" fill="#e2e8f0" font-size="10">${Math.round(r.value)} dps/h · ${r.hours.toFixed(0)}h · ${Math.round(r.totalDps / 1000)}k dps</text>`;
});
svg += `</svg>`;

let pSvg = `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="900" height="380" viewBox="0 0 900 380">
<rect width="100%" height="100%" fill="#0f172a"/>
<text x="450" y="26" text-anchor="middle" fill="#e2e8f0" font-size="14" font-weight="600" font-family="system-ui,sans-serif">Pareto frontier — league-scaled hours</text>`;
const maxH = Math.max(...pareto.map((p) => p.hours), 1);
const maxDps = Math.max(...pareto.map((p) => p.totalDps), 1);
pareto.slice(0, 12).forEach((p) => {
  const x = 70 + (p.hours / maxH) * 760;
  const y = 340 - (p.totalDps / maxDps) * 260;
  pSvg += `<circle cx="${x}" cy="${y}" r="6" fill="#f472b6"/><text x="${x + 8}" y="${y + 3}" fill="#e2e8f0" font-size="9">${p.hours.toFixed(0)}h ${Math.round(p.totalDps / 1000)}k</text>`;
});
pSvg += `<line x1="70" y1="340" x2="840" y2="340" stroke="#475569"/><line x1="70" y1="340" x2="70" y2="60" stroke="#475569"/>
<text x="450" y="365" text-anchor="middle" fill="#64748b" font-size="11">hours (skills w/ 5–16× + content pads)</text></svg>`;

mkdirSync("artifacts", { recursive: true });
mkdirSync("public", { recursive: true });
writeFileSync("artifacts/league-value.svg", svg);
writeFileSync("artifacts/league-pareto.svg", pSvg);
writeFileSync("public/league-value.svg", svg);
writeFileSync("public/league-pareto.svg", pSvg);

const report = {
  generated: new Date().toISOString(),
  runs,
  leagueMults: LEAGUE_XP_MULT,
  multDemo: {
    necro99_flat5: hoursIfFlatMult("necromancy", 99, [], 5),
    necro99_flat16: hoursIfFlatMult("necromancy", 99, [], 16),
    necro99_phased: chartSkillLeaguePhased("necromancy", 1, 99, []).hours,
  },
  absoluteBest: pack(peak),
  bestValue: pack(bestVal),
  bestPracticalUnder40h: pack(bestPrac),
  top10Value: byVal.slice(0, 10).map(pack),
  top10Dpm: byDps.slice(0, 10).map(pack),
  pareto: pareto.slice(0, 14).map(pack),
  note: "Skill XP hours use phased league mults 5×→8×→12×→16×. Content pads (bosses, regions, cinderbanes) are unmultiplied wall-clock.",
};

function pack(r: Row) {
  return {
    dps: Math.round(r.totalDps),
    hours: +r.hours.toFixed(1),
    skillHours: +r.skillH.toFixed(1),
    padHours: +r.padH.toFixed(1),
    effMult: +r.effMult.toFixed(1),
    value: Math.round(r.value),
    style: r.style,
    region: r.regionId,
    armour: r.armour,
    poison: r.poison,
    familiar: r.familiar,
    relics: r.relicKey,
    path: r.pathId,
    endgame: r.endgame,
    name: r.name,
  };
}

writeFileSync("artifacts/league-value-sim.json", JSON.stringify(report, null, 2));
console.log("\nWrote artifacts/league-value-sim.json + SVGs");
console.log("\n*** BEST VALUE ***", Math.round(bestVal.totalDps), "dps in", bestVal.hours.toFixed(1) + "h", "@", Math.round(bestVal.value), "dps/h");
console.log("*** PEAK DPM ***", Math.round(peak.totalDps), "dps in", peak.hours.toFixed(1) + "h");
console.log("*** PRACTICAL ≤40h ***", Math.round(bestPrac.totalDps), "dps in", bestPrac.hours.toFixed(1) + "h");
