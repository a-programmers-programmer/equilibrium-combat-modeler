/**
 * Verify every equipment piece has restrictions + loadout gating.
 */
import { writeFileSync, mkdirSync } from "fs";
import {
  EQUIPMENT_CATALOG,
  equipmentStats,
  resolveLoadoutOOP,
  equipmentAccessible,
  Player,
  type RegionTag,
} from "../src/lib/eq/sim/index.ts";

const stats = equipmentStats();
console.log("=== EQUIPMENT OOP CATALOG ===");
console.log(JSON.stringify(stats, null, 2));

// Every piece must have a describable requirement
let noReq = 0;
for (const e of EQUIPMENT_CATALOG) {
  const d = e.describeReq();
  if (!d || d.length < 3) {
    noReq++;
    console.log("EMPTY REQ", e.id, e.name);
  }
}
console.log("pieces with empty req describe:", noReq);

// Sample: free-only player cannot access Asgarnia seismic
{
  const p = new Player({ electives: [], relicTier: 1 });
  p.setLevel("magic", 99);
  p.setLevel("defence", 99);
  const snap = p.snapshot();
  const seismic = EQUIPMENT_CATALOG.find((e) => /seismic wand/i.test(e.name));
  const omni = EQUIPMENT_CATALOG.find((e) => /omni guard/i.test(e.name));
  console.log("\nFree player:");
  if (seismic) {
    console.log("  Seismic accessible?", seismic.accessibleIgnoringBossFlags(snap), seismic.missing(snap).slice(0, 4));
  }
  if (omni) {
    console.log("  Omni accessible (ignore boss)?", omni.accessibleIgnoringBossFlags(snap));
    console.log("  Omni accessible (hard flags)?", omni.accessible(snap), omni.missing(snap));
  }
  const load = resolveLoadoutOOP(snap, "necromancy", "dual");
  console.log(
    "  Necro dual loadout:",
    load.pieces.map((x) => x.name).join(" | ") || "(empty)",
  );
  console.log("  notes:", load.notes.join("; "));
}

// Asgarnia + combat levels
{
  const p = new Player({ electives: ["asgarnia", "desert", "forinthry"], relicTier: 6 });
  for (const sk of ["attack", "strength", "defence", "magic", "ranged", "necromancy", "smithing"] as const) {
    p.setLevel(sk, 99);
  }
  p.setFlag("killed:rasial");
  p.setFlag("killed:vorago");
  const snap = p.snapshot();
  console.log("\nCombat package + 99s + key kills:");
  console.log("  accessible combat pieces:", equipmentAccessible(snap, { combatOnly: true, ignoreBossFlags: false }).length);
  for (const style of ["necromancy", "melee", "magic", "ranged"] as const) {
    const load = resolveLoadoutOOP(snap, style, style === "melee" ? "shield" : "dual", {
      ignoreBossFlags: false,
    });
    console.log(
      `  ${style}:`,
      load.pieces.map((x) => x.name).join(" | "),
    );
  }
}

// Show requirement samples
console.log("\n=== SAMPLE RESTRICTIONS ===");
const samples = [
  "omni-guard",
  "seismic-wand",
  "trimmed-mw",
  "malevolent-kiteshield",
  "essence-of-finality",
  "chaotic-rapier",
  "asc-xbow",
  "achto",
];
for (const id of samples) {
  const e = EQUIPMENT_CATALOG.find((x) => x.id === id);
  if (!e) {
    console.log(id, "NOT FOUND");
    continue;
  }
  console.log(`\n${e.name}`);
  console.log(`  req: ${e.describeReq()}`);
  console.log(`  regions: [${e.regions.join(", ")}] skills: ${JSON.stringify(e.skillReqs)} flags: [${e.flags.join(", ")}]`);
}

// Distribution: how many pieces require each region
console.log("\n=== REGION GATE COUNTS ===");
const regionCounts: Record<string, number> = {};
for (const e of EQUIPMENT_CATALOG) {
  if (!e.regions.length) regionCounts["free-path"] = (regionCounts["free-path"] ?? 0) + 1;
  for (const r of e.regions) regionCounts[r] = (regionCounts[r] ?? 0) + 1;
}
console.log(regionCounts);

mkdirSync("artifacts", { recursive: true });
writeFileSync(
  "artifacts/equipment-oop-verify.json",
  JSON.stringify(
    {
      generated: new Date().toISOString(),
      stats,
      sampleReqs: samples.map((id) => {
        const e = EQUIPMENT_CATALOG.find((x) => x.id === id);
        return e
          ? {
              id: e.id,
              name: e.name,
              req: e.describeReq(),
              regions: e.regions,
              skillReqs: e.skillReqs,
              flags: e.flags,
              quests: e.quests,
            }
          : { id, missing: true };
      }),
      regionCounts,
    },
    null,
    2,
  ),
);
console.log("\nWrote artifacts/equipment-oop-verify.json");
