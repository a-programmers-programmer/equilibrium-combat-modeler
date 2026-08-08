/**
 * Hardened acquisition ledger — rare×2–8, learn-tax, full components.
 * npx tsx scripts/sim-acquisition.ts
 */
import { writeFileSync, mkdirSync } from "fs";
import {
  planAcquisition,
  calcDrop,
  type BuildSpec,
  couponCollectorKills,
  DROP_SOURCES,
  RARE_MULT_SCENARIOS,
  relicLadderHours,
  blessingTrackHours,
} from "../src/lib/eq/sim/acquisition.ts";
import { modelCombat } from "../src/lib/eq/model.ts";
import { stageById } from "../src/lib/eq/gear.ts";
import type { Path } from "../src/lib/eq/blessings.ts";
import { LEAGUE_TIER_PASSIVES } from "../src/lib/eq/sim/league-passives.ts";

const stage = stageById("endgame")!;
const AEGIS: Path[] = ["Order", "Chaos", "Order", "Balance", "Chaos", "Chaos"];

console.log("═══ League passives (wiki) ═══");
for (const p of LEAGUE_TIER_PASSIVES) {
  console.log(`  T${p.leagueTier}: XP ${p.xpMult}× · rares ${p.rareMult}× — ${p.notes}`);
}
console.log(`Relic T1→T7: ${relicLadderHours(7).toFixed(1)}h`);
console.log(`Blessing Aegis track: ${blessingTrackHours().toFixed(1)}h`);

console.log("\n═══ Drop EV at rare×6 (T6 farm) vs ×2 / ×8 ═══");
for (const [id, pieces] of [
  ["rasial", 2],
  ["rasial", 5],
  ["croesus", 5],
  ["kerapac", 3],
  ["kalphiteKing", 2],
  ["lostGroveOnTask", 1],
] as const) {
  for (const m of [2, 6, 8]) {
    const d = calcDrop(id, { pieces, rareMult: m });
    console.log(
      `  ${id}×${pieces} rare×${m}: ${d.expectedKills.toFixed(0)} kills · mean ${d.hoursMean.toFixed(1)}h · p90 ${d.hoursP90.toFixed(1)}h`,
    );
  }
}

const builds: BuildSpec[] = [
  {
    id: "necro-mid-dw",
    name: "Necro mid Deathwarden + Infernal",
    style: "necromancy",
    armour: "deathwarden-tank",
    poison: "none",
    familiar: "none",
    invention: "none",
    regions: ["free", "misthalin", "havenhythe", "karamja"],
    electives: [],
    gearTier: "mid",
    farmLeagueTier: 4,
  },
  {
    id: "necro-end-omni-dw",
    name: "Necro Omni+Soul + Deathwarden",
    style: "necromancy",
    armour: "deathwarden-tank",
    poison: "none",
    familiar: "none",
    invention: "none",
    regions: ["free", "misthalin", "havenhythe", "karamja"],
    electives: [],
    gearTier: "end",
    farmLeagueTier: 6,
  },
  {
    id: "necro-titan",
    name: "Necro end + Titan",
    style: "necromancy",
    armour: "deathwarden-tank",
    poison: "wp-only",
    familiar: "steel-titan",
    invention: "none",
    regions: ["free", "misthalin", "havenhythe", "karamja"],
    electives: [],
    gearTier: "end",
  },
  {
    id: "necro-inv",
    name: "Necro + Asgarnia Inv + Perks",
    style: "necromancy",
    armour: "deathwarden-tank",
    poison: "wp-only",
    familiar: "steel-titan",
    invention: "standard",
    regions: ["free", "misthalin", "havenhythe", "karamja", "asgarnia"],
    electives: ["asgarnia"],
    gearTier: "end",
    perkfection: true,
    bisJewellery: true,
  },
  {
    id: "necro-nihil",
    name: "Necro + Nihil Forinthry",
    style: "necromancy",
    armour: "deathwarden-tank",
    poison: "wp-only",
    familiar: "ice-nihil",
    invention: "none",
    regions: ["free", "misthalin", "havenhythe", "karamja", "forinthry"],
    electives: ["forinthry"],
    gearTier: "end",
  },
  {
    id: "necro-full",
    name: "Necro FULL Ancient+Nihil+Cinder",
    style: "necromancy",
    armour: "deathwarden-tank",
    poison: "wp-cinder",
    familiar: "ice-nihil",
    invention: "ancient",
    regions: [
      "free",
      "misthalin",
      "havenhythe",
      "karamja",
      "asgarnia",
      "kandarin",
      "forinthry",
      "tirannwn",
    ],
    electives: ["asgarnia", "kandarin", "forinthry"],
    gearTier: "end",
    perkfection: true,
    bisJewellery: true,
  },
  {
    id: "necro-tfn",
    name: "Necro full TFN power (5pc)",
    style: "necromancy",
    armour: "tfn-power",
    poison: "none",
    familiar: "none",
    invention: "none",
    regions: ["free", "misthalin", "havenhythe", "karamja"],
    electives: [],
    gearTier: "end",
  },
  {
    id: "magic-crypt",
    name: "Magic Cryptbloom set",
    style: "magic",
    armour: "cryptbloom-tank",
    poison: "none",
    familiar: "none",
    invention: "none",
    regions: ["free", "misthalin", "havenhythe", "karamja"],
    electives: [],
    gearTier: "mid",
    farmLeagueTier: 5,
  },
  {
    id: "magic-fsoa",
    name: "Magic Cryptbloom + FSOA (Anachronia)",
    style: "magic",
    armour: "cryptbloom-tank",
    poison: "none",
    familiar: "none",
    invention: "none",
    regions: ["free", "misthalin", "havenhythe", "karamja", "anachronia"],
    electives: ["anachronia"],
    gearTier: "end",
  },
  {
    id: "melee-mid",
    name: "Melee mid free-region",
    style: "melee",
    armour: "mixed-aegis-power",
    poison: "none",
    familiar: "none",
    invention: "none",
    regions: ["free", "misthalin", "havenhythe", "karamja"],
    electives: [],
    gearTier: "mid",
    farmLeagueTier: 4,
  },
  {
    id: "melee-drygore",
    name: "Melee dual drygores (Desert)",
    style: "melee",
    armour: "mixed-aegis-power",
    poison: "none",
    familiar: "none",
    invention: "none",
    regions: ["free", "misthalin", "havenhythe", "karamja", "desert"],
    electives: ["desert"],
    gearTier: "end",
  },
  {
    id: "melee-cinder-ripper",
    name: "Melee Cinder + Ripper",
    style: "melee",
    armour: "mixed-aegis-power",
    poison: "full-melee-poison",
    familiar: "ripper-demon",
    invention: "none",
    regions: [
      "free",
      "misthalin",
      "havenhythe",
      "karamja",
      "forinthry",
      "tirannwn",
      "desert",
    ],
    electives: ["forinthry", "tirannwn", "desert"],
    gearTier: "end",
  },
];

console.log("\n═══ Plans ═══\n");
const rows: Record<string, unknown>[] = [];

for (const b of builds) {
  const plan = planAcquisition(b);
  const tank =
    b.armour.includes("tank") ||
    b.armour.includes("mixed") ||
    b.armour === "deathwarden-tank";
  const r = modelCombat({
    picks: AEGIS,
    style: b.style,
    stage,
    archetype: tank ? "shield-tank" : "power-dps",
    offhand: tank ? "shield" : "none",
    herbloreLevel: b.gearTier === "end" ? 110 : 96,
    targetTiles: 1,
    multiContentWeight: 0,
    powerburst: true,
    potionProfile: b.gearTier === "end" ? "elder-ovl" : "overload",
    armourProfile: b.armour,
    poisonKit: b.poison,
    familiar: b.familiar,
    relic: "infernal-fire",
    relicSecondary: b.familiar !== "none" ? "devout" : null,
    perkfection: !!b.perkfection,
    inventionTier: b.invention,
    summoningLevel: b.familiar === "none" ? 1 : 99,
    baneRegions: b.regions,
    fightSeconds: 60,
  });
  const dps = r.totalDps ?? r.dps;
  const value = dps / Math.max(0.5, plan.wallClockMean);

  console.log(`▸ ${b.name}`);
  console.log(
    `  DPS ${Math.round(dps).toLocaleString()} · mean ${plan.wallClockMean.toFixed(1)}h · p50 ${plan.wallClockP50.toFixed(1)} · p90 ${plan.wallClockP90.toFixed(1)} · val ${Math.round(value)} · rare×${plan.rareMultUsed}`,
  );
  console.log(
    `  Sensitivity: ${Object.entries(plan.sensitivity)
      .map(([k, v]) => `${k}:${v.toFixed(0)}h`)
      .join(" ")}`,
  );
  for (const line of plan.breakdown.slice(0, 4)) console.log(`  ${line}`);
  const big = plan.ledger.filter((x) => x.exclusiveH >= 1).sort((a, b) => b.exclusiveH - a.exclusiveH);
  console.log(
    `  Top costs: ${big
      .slice(0, 6)
      .map((x) => `${x.exclusiveH.toFixed(1)}h ${x.name.split(" ").slice(0, 4).join(" ")}`)
      .join(" · ")}`,
  );
  if (plan.blocked.length)
    console.log(`  BLOCKED ${plan.blocked.map((x) => x.id).join(",")}`);
  console.log("");

  rows.push({
    id: b.id,
    name: b.name,
    dps: Math.round(dps),
    meanH: +plan.wallClockMean.toFixed(1),
    p50: +plan.wallClockP50.toFixed(1),
    p90: +plan.wallClockP90.toFixed(1),
    value: Math.round(value),
    rareMult: plan.rareMultUsed,
    sensitivity: plan.sensitivity,
    exclusive: +plan.exclusiveHours.toFixed(1),
    skills: +plan.skillUnionHours.toFixed(1),
    parallel: +plan.parallelCredit.toFixed(1),
    ledger: plan.ledger,
    breakdown: plan.breakdown,
  });
}

rows.sort((a, b) => (b.value as number) - (a.value as number));
console.log("═══ VALUE RANK ═══");
rows.forEach((r, i) => {
  console.log(
    `#${i + 1} val=${r.value}  ${r.dps} dps  ${r.meanH}h mean (p90 ${r.p90}) rare×${r.rareMult}  ${r.name}`,
  );
});

mkdirSync("artifacts", { recursive: true });
writeFileSync(
  "artifacts/acquisition-sim.json",
  JSON.stringify(
    {
      generated: new Date().toISOString(),
      hardened: true,
      passives: LEAGUE_TIER_PASSIVES,
      relicLadderH: relicLadderHours(7),
      blessingTrackH: blessingTrackHours(),
      rareScenarios: RARE_MULT_SCENARIOS,
      ranked: rows,
    },
    null,
    2,
  ),
);
console.log("\nWrote artifacts/acquisition-sim.json");
