/**
 * Full acquisition ledger sim — expected hours p50/mean/p90 per kit.
 * npx tsx scripts/sim-acquisition.ts
 */
import { writeFileSync, mkdirSync } from "fs";
import {
  planAcquisition,
  type BuildSpec,
  couponCollectorKills,
  DROP_SOURCES,
} from "../src/lib/eq/sim/acquisition.ts";
import { modelCombat } from "../src/lib/eq/model.ts";
import { stageById } from "../src/lib/eq/gear.ts";
import type { Path } from "../src/lib/eq/blessings.ts";

const stage = stageById("endgame")!;
const AEGIS: Path[] = ["Order", "Chaos", "Order", "Balance", "Chaos", "Chaos"];

const builds: BuildSpec[] = [
  {
    id: "necro-mid-deathwarden",
    name: "Necro mid — Deathwarden T90 + Infernal (no Rasial)",
    style: "necromancy",
    armour: "deathwarden-tank",
    poison: "none",
    familiar: "none",
    invention: "none",
    regions: ["free", "misthalin", "havenhythe", "karamja"],
    electives: [],
    gearTier: "mid",
    aegisPath: true,
    relicsT7: true,
  },
  {
    id: "necro-end-deathwarden",
    name: "Necro end — Omni+Soul + Deathwarden tank",
    style: "necromancy",
    armour: "deathwarden-tank",
    poison: "none",
    familiar: "none",
    invention: "none",
    regions: ["free", "misthalin", "havenhythe", "karamja"],
    electives: [],
    gearTier: "end",
    aegisPath: true,
    relicsT7: true,
  },
  {
    id: "necro-end-titan",
    name: "Necro end + Steel Titan + Devout path",
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
    id: "necro-inv-asgarnia",
    name: "Necro end + Asgarnia Invention + Perkfection",
    style: "necromancy",
    armour: "deathwarden-tank",
    poison: "wp-only",
    familiar: "steel-titan",
    invention: "standard",
    regions: ["free", "misthalin", "havenhythe", "karamja", "asgarnia"],
    electives: ["asgarnia"],
    gearTier: "end",
    perkfection: true,
  },
  {
    id: "necro-nihil",
    name: "Necro end + Forinthry Ice Nihil",
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
    id: "necro-full-send",
    name: "Necro FULL — Ancient Inv + Nihil + Cinder",
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
  },
  {
    id: "necro-tfn-power",
    name: "Necro TFN power set (full Rasial armour)",
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
    id: "magic-cryptbloom",
    name: "Magic Aegis — Cryptbloom set (Croesus)",
    style: "magic",
    armour: "cryptbloom-tank",
    poison: "none",
    familiar: "none",
    invention: "none",
    regions: ["free", "misthalin", "havenhythe", "karamja"],
    electives: [],
    gearTier: "mid",
  },
  {
    id: "melee-mid",
    name: "Melee mid Aegis mixed",
    style: "melee",
    armour: "mixed-aegis-power",
    poison: "none",
    familiar: "none",
    invention: "none",
    regions: ["free", "misthalin", "havenhythe", "karamja"],
    electives: [],
    gearTier: "mid",
  },
  {
    id: "melee-cinder",
    name: "Melee end + Cinderbanes + Ripper",
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
    ],
    electives: ["forinthry", "tirannwn"],
    gearTier: "end",
  },
];

console.log("═══ Drop math sanity ═══");
const r = DROP_SOURCES.rasial!;
const rate = r.rateDenom / (r.leagueDropMult ?? 1);
console.log(
  `Rasial effective unique rate 1/${rate} (base 1/${r.rateDenom}, league ×${r.leagueDropMult})`,
);
console.log(
  `  Omni+Soul (2): ${couponCollectorKills(rate, 2).toFixed(0)} kills → ${(couponCollectorKills(rate, 2) / r.killsPerHour).toFixed(1)}h @${r.killsPerHour} kph`,
);
console.log(
  `  TFN 5pc: ${couponCollectorKills(rate, 5).toFixed(0)} kills → ${(couponCollectorKills(rate, 5) / r.killsPerHour).toFixed(1)}h`,
);
console.log(
  `  Full 7 uniques: ${couponCollectorKills(rate, 7).toFixed(0)} kills → ${(couponCollectorKills(rate, 7) / r.killsPerHour).toFixed(1)}h`,
);
const cind = DROP_SOURCES.lostGroveOnTask!;
const cr = cind.rateDenom / (cind.leagueDropMult ?? 1);
console.log(
  `Cinderbane on-task 1/${cr}: ${(cr / cind.killsPerHour).toFixed(1)}h EV @${cind.killsPerHour} kph`,
);
const cro = DROP_SOURCES.croesus!;
const crr = cro.rateDenom / (cro.leagueDropMult ?? 1);
console.log(
  `Cryptbloom 5pc Croesus 1/${crr}: ${couponCollectorKills(crr, 5).toFixed(0)} kills → ${(couponCollectorKills(crr, 5) / cro.killsPerHour).toFixed(1)}h`,
);

console.log("\n═══ Full acquisition plans ═══\n");

const rows: {
  id: string;
  name: string;
  dps: number;
  meanH: number;
  p50: number;
  p90: number;
  value: number;
  exclusive: number;
  skills: number;
  parallel: number;
  blocked: number;
  ledger: { name: string; h: number; drop?: string }[];
  breakdown: string[];
}[] = [];

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
    `  DPS ${Math.round(dps).toLocaleString()} · mean ${plan.wallClockMean.toFixed(1)}h · p50 ${plan.wallClockP50.toFixed(1)}h · p90 ${plan.wallClockP90.toFixed(1)}h · val ${Math.round(value)} dps/h`,
  );
  if (plan.blocked.length) {
    console.log(`  BLOCKED: ${plan.blocked.map((x) => x.id + " " + x.reasons.join(",")).join("; ")}`);
  }
  for (const line of plan.breakdown) console.log(`  ${line}`);
  console.log("  Ledger (exclusive h):");
  for (const L of plan.ledger.filter((x) => x.exclusiveH > 0.05)) {
    console.log(
      `    ${L.exclusiveH.toFixed(1).padStart(6)}h  ${L.name}${L.drop ? "  [" + L.drop + "]" : ""}`,
    );
  }
  console.log("");

  rows.push({
    id: b.id,
    name: b.name,
    dps: Math.round(dps),
    meanH: +plan.wallClockMean.toFixed(1),
    p50: +plan.wallClockP50.toFixed(1),
    p90: +plan.wallClockP90.toFixed(1),
    value: Math.round(value),
    exclusive: +plan.exclusiveHours.toFixed(1),
    skills: +plan.skillUnionHours.toFixed(1),
    parallel: +plan.parallelCredit.toFixed(1),
    blocked: plan.blocked.length,
    ledger: plan.ledger.map((L) => ({
      name: L.name,
      h: L.exclusiveH,
      drop: L.drop,
    })),
    breakdown: plan.breakdown,
  });
}

rows.sort((a, b) => b.value - a.value);
console.log("═══ RANKED BY VALUE (DPS / mean hours) ═══");
rows.forEach((r, i) => {
  console.log(
    `#${i + 1} val=${r.value}  ${r.dps} dps  mean ${r.meanH}h (p50 ${r.p50} / p90 ${r.p90})  ${r.name}`,
  );
});

mkdirSync("artifacts", { recursive: true });
writeFileSync(
  "artifacts/acquisition-sim.json",
  JSON.stringify(
    {
      generated: new Date().toISOString(),
      dropAssumptions: {
        rasial: "1/640 base, league ×2 → 1/320 effective, 22 kph, coupon collector sets",
        croesus: "1/600 base ×2 league, 8 kph, 5pc cryptbloom",
        cinderbane: "1/1500 on-task ×2 league, 180 kph",
        parallel: "0.85 × min(combat boss hours, combat skill bundle)",
      },
      ranked: rows,
    },
    null,
    2,
  ),
);
console.log("\nWrote artifacts/acquisition-sim.json");
