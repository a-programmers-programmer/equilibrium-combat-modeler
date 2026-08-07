/**
 * Verify bane is first-class in Equipment OOP + resolveLoadoutOOP + modelCombat.
 */
import { writeFileSync, mkdirSync } from "fs";
import {
  EQUIPMENT_CATALOG,
  BANE_EQUIPMENT,
  resolveLoadoutOOP,
  equipmentStats,
} from "../src/lib/eq/sim/equipment.ts";
import { TARGET_PROFILES, type TargetTag } from "../src/lib/eq/sim/bane.ts";
import { Player } from "../src/lib/eq/sim/player.ts";
import { gearFromPackage, modelCombat } from "../src/lib/eq/model.ts";
import { REGION_PACKAGES } from "../src/lib/eq/items.ts";
import { stageById } from "../src/lib/eq/gear.ts";
import type { Style } from "../src/lib/eq/gear.ts";
import type { Path } from "../src/lib/eq/blessings.ts";
import type { RegionTag } from "../src/lib/eq/sim/requirements.ts";

const stage = stageById("endgame");
const PATH: Path[] = ["Order", "Chaos", "Order", "Balance", "Order", "Chaos"];

function maxPlayer(electives: RegionTag[]) {
  const p = new Player({ electives, relicTier: 6 });
  for (const sk of [
    "attack",
    "strength",
    "defence",
    "magic",
    "ranged",
    "necromancy",
    "smithing",
    "crafting",
    "hunter",
    "runecrafting",
  ] as const) {
    p.setLevel(sk, 99);
  }
  p.completeQuest("ritual-of-the-mahjarrat");
  for (const f of [
    "unlocked:tune-bane",
    "unlocked:dinarrows",
    "unlocked:jas-anima",
    "killed:soulgazer",
    "unlocked:hexhunter-imbue",
    "unlocked:bgh-t3",
    "unlocked:inquisitor-assemble",
    "unlocked:inq-imbue",
    "unlocked:glacor-front",
    "unlocked:leng-core",
  ])
    p.setFlag(f);
  return p;
}

console.log("=== OOP EQUIPMENT STATS ===");
console.log(equipmentStats());
console.log(
  "\nBane Equipment instances:",
  BANE_EQUIPMENT.map((e) => `${e.id} [${e.slot}] req=${e.describeReq().slice(0, 60)}`).join("\n  "),
);

// Every bane piece is Equipment
const notInCatalog = BANE_EQUIPMENT.filter((e) => !EQUIPMENT_BY_ID_HAS(e.id));
function EQUIPMENT_BY_ID_HAS(id: string) {
  return EQUIPMENT_CATALOG.some((e) => e.id === id);
}
console.log("\nAll bane in catalog?", notInCatalog.length === 0);

const rows: unknown[] = [];
console.log("\n=== TARGET-AWARE resolveLoadoutOOP ===");

for (const style of ["ranged", "melee", "magic", "necromancy"] as Style[]) {
  for (const target of TARGET_PROFILES) {
    for (const electives of [
      [] as RegionTag[],
      ["fremennik"] as RegionTag[],
      ["forinthry", "asgarnia"] as RegionTag[],
      ["forinthry", "asgarnia", "fremennik"] as RegionTag[],
      ["desert", "anachronia", "forinthry"] as RegionTag[],
    ]) {
      const p = maxPlayer(electives);
      const mode =
        style === "ranged" || style === "magic"
          ? ("2h" as const)
          : style === "melee"
            ? ("dual" as const)
            : ("dual" as const);
      const load = resolveLoadoutOOP(p.snapshot(), style, mode, {
        ignoreBossFlags: true,
        targetTags: target.tags,
      });
      if (load.bane.mult > 1 || target.id === "general") {
        rows.push({
          style,
          target: target.id,
          electives,
          mult: load.bane.mult,
          pieces: load.bane.pieces.map((x) => x.name),
          weapon: load.equipment.find((e) => e.slot === "weapon")?.name,
          ammo: load.equipment.find((e) => e.slot === "ammo")?.name,
        });
      }
    }
  }
}

// Print interesting
for (const r of rows as any[]) {
  if (r.mult > 1) {
    console.log(
      `${r.style.padEnd(11)} ${String(r.target).padEnd(14)} elect=${(r.electives.join("+") || "free").padEnd(28)} ×${r.mult.toFixed(3)}  wep=${r.weapon}  ammo=${r.ammo ?? "-"}  bane=${r.pieces.join("+")}`,
    );
  }
}

console.log("\n=== END-TO-END modelCombat via gearFromPackage(targetTags) ===");
const e2e: unknown[] = [];
for (const style of ["ranged", "melee", "magic"] as Style[]) {
  for (const tags of [["general"], ["dragon"], ["dragon", "mage-class"], ["melee-class"], ["ranged-class"], ["glacor"]] as TargetTag[][]) {
    for (const pkgId of ["free-only", "forinthry-asgarnia-anach", "desert-asgarnia-forinthry"]) {
      const pkg = REGION_PACKAGES.find((p) => p.id === pkgId);
      if (!pkg) continue;
      // freemenik not in packages — add via regions for freemenik bane when needed
      const arch = style === "melee" ? "shield-tank" : "power-dps";
      let { snapshot, offhand } = gearFromPackage(pkg, style, arch, tags);
      // if need fremennik bolts explicitly test extra package
      const r = modelCombat({
        picks: PATH,
        style,
        stage,
        archetype: arch,
        offhand,
        herbloreLevel: 110,
        targetTiles: 1,
        multiContentWeight: 0,
        powerburst: false,
        gear: snapshot,
        targetTags: tags,
      });
      e2e.push({
        style,
        tags: tags.join("+"),
        pkg: pkgId,
        dps: Math.round(r.dps),
        dmg30: Math.round(r.dps * 30),
        baneMult: r.bane?.mult ?? 1,
        fromOOP: r.flags.includes("Bane from OOP loadout"),
        pieces: r.bane?.pieces ?? [],
        weapon: snapshot.pieces?.find((p) => p.slot === "weapon")?.name,
        ammo: snapshot.pieces?.find((p) => p.slot === "ammo")?.name,
      });
    }
  }
}

(e2e as any[])
  .filter((r) => r.baneMult > 1)
  .sort((a, b) => b.dps - a.dps)
  .forEach((r) => {
    console.log(
      `${String(r.dmg30).padStart(10)} ${r.style.padEnd(7)} ${r.tags.padEnd(22)} ${r.pkg.padEnd(26)} OOP=${r.fromOOP} ×${r.baneMult.toFixed(2)} ${r.weapon} + ${r.ammo ?? "no-ammo"}`,
    );
  });

// Fremennik package via gearFromRegions
console.log("\n=== Fremennik dragonbane bolts path ===");
import { gearFromRegions } from "../src/lib/eq/model.ts";
const { snapshot: sn, offhand: oh } = gearFromRegions(
  ["fremennik", "forinthry", "asgarnia"] as any,
  "ranged",
  "power-dps",
  ["dragon"],
);
console.log(
  "pieces:",
  sn.pieces?.map((p) => p.name).join(" | "),
  "\nbane:",
  sn.bane,
);
const r2 = modelCombat({
  picks: PATH,
  style: "ranged",
  stage,
  archetype: "power-dps",
  offhand: oh,
  herbloreLevel: 110,
  targetTiles: 1,
  multiContentWeight: 0,
  powerburst: false,
  gear: sn,
  targetTags: ["dragon"],
});
console.log("dps", Math.round(r2.dps), r2.flags.filter((f) => /Bane|ammo/i.test(f)));

mkdirSync("artifacts", { recursive: true });
writeFileSync(
  "artifacts/oop-bane-verify.json",
  JSON.stringify(
    {
      stats: equipmentStats(),
      baneIds: BANE_EQUIPMENT.map((e) => e.id),
      loadoutRows: rows,
      e2e,
      conclusion:
        "Bane is Equipment OOP (ammo/weapon slots, Requirement graph). resolveLoadoutOOP(targetTags) picks ammo + affinity swaps. gearFromPackage/Regions thread tags into GearSnapshot.bane. modelCombat consumes OOP bane.",
    },
    null,
    2,
  ),
);
console.log("\nWrote artifacts/oop-bane-verify.json");
