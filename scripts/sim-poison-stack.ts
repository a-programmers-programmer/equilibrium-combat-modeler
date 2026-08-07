/**
 * Poison stack sims: Cinderbane, Laniakea, Blowpipe, Kwuarm, Envenomed, Reaver.
 * npx tsx scripts/sim-poison-stack.ts
 */
import { writeFileSync, mkdirSync } from "fs";
import { modelCombat } from "../src/lib/eq/model.ts";
import { stageById, type Style } from "../src/lib/eq/gear.ts";
import { POISON_KITS, type PoisonKitId } from "../src/lib/eq/sim/poison.ts";
import type { Path } from "../src/lib/eq/blessings.ts";
import type { RegionTag } from "../src/lib/eq/sim/requirements.ts";

const stage = stageById("endgame")!;
const envenomedPicks: Path[] = ["Balance", "Balance", "Order", "Balance", "Balance", "Balance"];
const critPicks: Path[] = ["Order", "Chaos", "Order", "Balance", "Chaos", "Chaos"];

const REGION_SETS: { id: string; regions: RegionTag[] }[] = [
  { id: "starter", regions: ["free", "misthalin", "havenhythe", "karamja"] },
  { id: "wazzy", regions: ["free", "misthalin", "forinthry", "desert", "anachronia"] },
  {
    id: "poison-max",
    regions: ["free", "misthalin", "tirannwn", "anachronia", "forinthry"],
  },
];

console.log("╔══════════════════════════════════════════════════════════╗");
console.log("║  POISON STACK — Cinderbane / Blowpipe / Laniakea / etc.  ║");
console.log("╚══════════════════════════════════════════════════════════╝\n");

const rows: {
  kit: string;
  regions: string;
  style: Style;
  blessing: string;
  total: number;
  poison: number;
  poisonShare: number;
  cinder: string;
  notes: string;
}[] = [];

for (const reg of REGION_SETS) {
  for (const kit of POISON_KITS) {
    for (const style of ["melee", "ranged", "necromancy"] as Style[]) {
      for (const [blessName, picks] of [
        ["envenomed-dot", envenomedPicks],
        ["crit-cinders", critPicks],
      ] as const) {
        const r = modelCombat({
          picks,
          style,
          stage,
          archetype: style === "melee" ? "shield-tank" : "power-dps",
          herbloreLevel: 110,
          targetTiles: 1,
          multiContentWeight: 0,
          powerburst: true,
          potionProfile: "elder-ovl",
          poisonKit: kit.id as PoisonKitId,
          relic: "devout",
          relicSecondary: "infernal-fire",
          familiar: kit.gear.bloodReaver ? "blood-reaver" : "ripper-demon",
          summoningLevel: 99,
          baneRegions: reg.regions,
          fightSeconds: 60,
        });
        const pois = r.dimensions?.find((d) => d.id === "poison");
        rows.push({
          kit: kit.id,
          regions: reg.id,
          style,
          blessing: blessName,
          total: r.totalDps ?? r.dps,
          poison: pois?.dps ?? 0,
          poisonShare: pois?.share ?? 0,
          cinder: r.poisonStack?.gearStatus.cinderbane ?? "?",
          notes: (r.poisonStack?.sources ?? []).map((s) => s.label).join("; "),
        });
      }
    }
  }
}

rows.sort((a, b) => b.total - a.total);
console.log("=== TOP 15 (poison kits × regions) ===");
rows.slice(0, 15).forEach((r, i) => {
  console.log(
    `#${String(i + 1).padStart(2)} ${Math.round(r.total).toLocaleString().padStart(7)} pois ${Math.round(r.poison).toString().padStart(6)} (${(r.poisonShare * 100).toFixed(1)}%) ${r.kit.padEnd(22)} ${r.regions.padEnd(12)} ${r.style.padEnd(11)} cinder=${r.cinder}`,
  );
});

console.log("\n=== Cinderbane region gate (full-melee-poison, melee, envenomed) ===");
for (const reg of REGION_SETS) {
  const r = rows.find(
    (x) =>
      x.kit === "full-melee-poison" &&
      x.regions === reg.id &&
      x.style === "melee" &&
      x.blessing === "envenomed-dot",
  )!;
  console.log(
    `  ${reg.id.padEnd(12)} total ${Math.round(r.total).toLocaleString().padStart(7)}  poison ${Math.round(r.poison).toString().padStart(6)}  cinder=${r.cinder}`,
  );
}

console.log("\n=== Kit ladder on poison-max regions (melee + envenomed) ===");
for (const kit of POISON_KITS) {
  const r = rows.find(
    (x) =>
      x.kit === kit.id &&
      x.regions === "poison-max" &&
      x.style === "melee" &&
      x.blessing === "envenomed-dot",
  )!;
  console.log(
    `  ${kit.id.padEnd(22)} total ${Math.round(r.total).toLocaleString().padStart(7)}  poison ${Math.round(r.poison).toString().padStart(6)} (${(r.poisonShare * 100).toFixed(1)}%)`,
  );
}

// SVG kit ladder
const ladder = POISON_KITS.map((kit) => {
  const r = rows.find(
    (x) =>
      x.kit === kit.id &&
      x.regions === "poison-max" &&
      x.style === "melee" &&
      x.blessing === "envenomed-dot",
  )!;
  return { id: kit.id, name: kit.name, total: r.total, poison: r.poison };
});
const maxT = Math.max(...ladder.map((l) => l.total));
let svg = `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="900" height="340" viewBox="0 0 900 340">
<rect width="100%" height="100%" fill="#0f172a"/>
<text x="450" y="28" text-anchor="middle" fill="#e2e8f0" font-size="15" font-weight="600" font-family="system-ui,sans-serif">Poison kit ladder (Tirannwn+Anachronia, Envenomed melee)</text>
<text x="450" y="46" text-anchor="middle" fill="#64748b" font-size="11" font-family="system-ui,sans-serif">Cinderbane · Laniakea · Blowpipe · Kwuarm · WP+++ · Envenomed</text>`;
ladder.forEach((l, i) => {
  const y = 60 + i * 36;
  const w = (l.total / maxT) * 500;
  const pw = (l.poison / maxT) * 500;
  svg += `<text x="12" y="${y + 14}" fill="#94a3b8" font-size="11" font-family="system-ui,sans-serif">${l.id}</text>
  <rect x="160" y="${y}" width="${w}" height="20" rx="3" fill="#334155"/>
  <rect x="160" y="${y}" width="${pw}" height="20" rx="3" fill="#4ade80"/>
  <text x="${170 + w}" y="${y + 14}" fill="#e2e8f0" font-size="10">${Math.round(l.total).toLocaleString()} (pois ${Math.round(l.poison).toLocaleString()})</text>`;
});
svg += `</svg>`;

mkdirSync("artifacts", { recursive: true });
mkdirSync("public", { recursive: true });
writeFileSync("artifacts/poison-kit-ladder.svg", svg);
writeFileSync("public/poison-kit-ladder.svg", svg);
writeFileSync(
  "artifacts/poison-stack-sim.json",
  JSON.stringify(
    {
      generated: new Date().toISOString(),
      top: rows.slice(0, 25),
      ladder,
      conclusions: {
        cinderbaneRegion: "Tirannwn (Lost Grove/Solak) required",
        laniakeaRegion: "Anachronia",
        fullStackPoisonShare: "~12–15% of total with Envenomed",
        blowpipeNote: "Upgraded Bone Blowpipe halves poison dmg / doubles rate; softens Cinderbane package",
        withoutTirannwn: "Cinderbanes locked — WP+++ only",
      },
    },
    null,
    2,
  ),
);
console.log("\nWrote artifacts/poison-kit-ladder.svg + poison-stack-sim.json");
