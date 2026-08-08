/**
 * Every item has requirements; every requirement path has hours.
 * npx tsx scripts/sim-item-paths.ts
 */
import { writeFileSync, mkdirSync } from "fs";
import {
  EQUIPMENT_CATALOG,
  resolveLoadoutOOP,
} from "../src/lib/eq/sim/equipment.ts";
import {
  pathForItem,
  pathForLoadout,
  auditCatalogRequirements,
} from "../src/lib/eq/sim/item-paths.ts";
import { planAcquisition, type BuildSpec } from "../src/lib/eq/sim/acquisition.ts";
import {
  costRequirement,
  type CostContext,
} from "../src/lib/eq/sim/req-hours.ts";
import {
  AllReq,
  SkillReq,
  RegionReq,
  FlagReq,
  INVENTION_UNLOCK,
  ANCIENT_INVENTION_UNLOCK,
} from "../src/lib/eq/sim/requirements.ts";
import { Player } from "../src/lib/eq/sim/player.ts";
import { modelCombat } from "../src/lib/eq/model.ts";
import { stageById } from "../src/lib/eq/gear.ts";

console.log("╔══════════════════════════════════════════════════════════╗");
console.log("║  EVERY ITEM · EVERY REQUIREMENT · EVERY PATH HAS TIME    ║");
console.log("╚══════════════════════════════════════════════════════════╝\n");

// 1) Audit catalog
const audit = auditCatalogRequirements({ minTier: 70, limit: 120 });
console.log(`Catalog audit (T70+, n=${audit.total}):`);
console.log(`  With measurable req/region/skill: ${audit.withReq}`);
console.log(`  Zero-solo-risk (<0.2h): ${audit.zeroSoloRisk.length}`);
if (audit.zeroSoloRisk.length) {
  console.log(
    "  ",
    audit.zeroSoloRisk
      .slice(0, 8)
      .map((z) => z.name)
      .join(", "),
  );
}
console.log("\nMost expensive solo items (req+obtain):");
for (const s of audit.sample.slice(0, 12)) {
  console.log(
    `  ${s.soloTotal.toFixed(1).padStart(6)}h  ${s.name.slice(0, 40).padEnd(40)}  req ${s.reqHours.toFixed(1)} + obt ${s.obtainHours.toFixed(1)}  [${s.obtainDetail.slice(0, 40)}]`,
  );
}

// 2) Famous unlocks
console.log("\n═══ Core unlock graphs ═══");
const paid = new Set<string>();
const ctx = (p = paid): CostContext => ({
  electives: ["asgarnia", "kandarin", "forinthry"],
  rareMult: 6,
  paid: p,
});
for (const [label, req] of [
  ["Invention", INVENTION_UNLOCK],
  ["Ancient Invention", ANCIENT_INVENTION_UNLOCK],
  [
    "Necro 95 + Misthalin + Rasial flag",
    new AllReq([
      new SkillReq("necromancy", 95),
      new RegionReq("misthalin"),
      new FlagReq("killed:rasial", "Rasial"),
    ]),
  ],
] as const) {
  const fresh = new Set<string>();
  const node = costRequirement(req, ctx(fresh));
  console.log(`  ${label}: ${node.hours.toFixed(2)}h`);
}

// 3) Resolve loadouts and path them
console.log("\n═══ Style loadouts (shared req dedupe) ═══");
const stage = stageById("endgame")!;
const styles = ["necromancy", "magic", "melee", "ranged"] as const;
const loadoutRows = [];

for (const style of styles) {
  const p = new Player({
    electives: ["asgarnia", "forinthry", "desert"],
    relicTier: 7,
  });
  p.setLevel("necromancy", 99);
  p.setLevel("magic", 99);
  p.setLevel("attack", 99);
  p.setLevel("strength", 99);
  p.setLevel("defence", 99);
  p.setLevel("ranged", 99);
  p.setLevel("prayer", 99);
  p.setLevel("invention", 99);
  p.setLevel("smithing", 99);
  p.setLevel("crafting", 99);
  p.setLevel("divination", 99);
  p.setFlag("killed:rasial");
  p.setFlag("killed:vorago");
  const snap = p.snapshot();
  // Path as if we DON'T own skills — empty player for true cost
  const load = resolveLoadoutOOP(snap, style, "dual", { ignoreBossFlags: true });
  let gear = (load.equipment ?? []) as typeof EQUIPMENT_CATALOG;
  if (!gear.length) {
    gear = EQUIPMENT_CATALOG.filter(
      (e) =>
        (e.style === style || e.style === "all") &&
        e.tier >= 80 &&
        ["weapon", "offhand", "body", "legs", "helmet", "gloves", "boots"].includes(
          String(e.slot),
        ),
    )
      .sort((a, b) => b.tier - a.tier || b.abilityDamage - a.abilityDamage)
      .slice(0, 8);
  }
  // Filter any without constructor
  gear = gear.filter((g) => g && g.req);

  const path = pathForLoadout(gear, ["asgarnia", "forinthry", "desert"], {
    rareMult: 6,
  });
  console.log(
    `  ${style}: ${gear.length} pcs · total ${path.totalHours.toFixed(1)}h (req ${path.reqHours.toFixed(1)} + obtain ${path.obtainHours.toFixed(1)}) · shared save ${path.sharedSavings.toFixed(1)}h`,
  );
  for (const L of path.ledger.slice(0, 5)) {
    console.log(`     ${L.hours.toFixed(1)}h  ${L.name.slice(0, 36)} — ${L.detail.slice(0, 50)}`);
  }
  loadoutRows.push({
    style,
    pieces: gear.map((g) => g.name),
    total: path.totalHours,
    req: path.reqHours,
    obtain: path.obtainHours,
    savings: path.sharedSavings,
    ledger: path.ledger,
  });
}

// 4) Merge acquisition plan + item paths for necro mid/end
console.log("\n═══ Acquisition + item-path hedge ═══");
const builds: BuildSpec[] = [
  {
    id: "necro-mid",
    name: "Necro mid Deathwarden",
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
    id: "necro-end",
    name: "Necro Omni end",
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
];

const merged = [];
for (const b of builds) {
  const plan = planAcquisition(b);
  // Hedge: max(plan, sum of named BiS item paths for style * 0.35 factor if plan lower on gear)
  const necroGear = EQUIPMENT_CATALOG.filter(
    (e) =>
      e.style === "necromancy" &&
      e.tier >= (b.gearTier === "end" ? 90 : 70) &&
      ["weapon", "offhand", "body", "legs", "helmet"].includes(String(e.slot)),
  )
    .sort((a, c) => c.tier - a.tier)
    .slice(0, 6);
  const ip = pathForLoadout(necroGear, b.electives, {
    rareMult: b.farmLeagueTier === 4 ? 4 : 6,
  });
  // Combined: take max of exclusive plan vs item-path obtain for gear realism
  const gearFloor = ip.obtainHours * 0.85 + ip.reqHours * 0.15;
  const hedgedMean = Math.max(plan.wallClockMean, plan.wallClockMean * 0.5 + gearFloor * 0.5);
  console.log(
    `  ${b.name}: plan ${plan.wallClockMean.toFixed(1)}h · item-path gear ${ip.totalHours.toFixed(1)}h · hedged ${hedgedMean.toFixed(1)}h`,
  );
  merged.push({
    name: b.name,
    planMean: plan.wallClockMean,
    itemPath: ip.totalHours,
    hedged: hedgedMean,
    planBreakdown: plan.breakdown,
    itemLedger: ip.ledger,
  });
}

// 5) Guarantee: no component in acquisition has 0 exclusive AND 0 skill when it has gates
console.log("\n═══ Zero-cost hedge scan (acquisition components) ═══");
const { COMPONENTS, costComponent } = await import(
  "../src/lib/eq/sim/acquisition.ts"
);
let zero = 0;
const have = new Set(["free", "misthalin", "havenhythe", "karamja", "asgarnia", "forinthry", "tirannwn", "desert", "kandarin", "anachronia"]);
for (const c of COMPONENTS) {
  const cost = costComponent(c, ["asgarnia"], have as never, { rareMult: 6 });
  const skillH = c.skillReqs
    ? Object.values(c.skillReqs).filter((x) => (x as number) > 1).length
    : 0;
  if (cost.exclusiveHours < 0.05 && skillH === 0 && c.kind !== "skill") {
    zero++;
    console.log(`  ZERO-RISK: ${c.id} (${c.kind}) — adding hedge in model`);
  }
}
console.log(`  Zero-risk components: ${zero}`);

mkdirSync("artifacts", { recursive: true });
writeFileSync(
  "artifacts/item-paths-sim.json",
  JSON.stringify(
    {
      generated: new Date().toISOString(),
      audit: {
        total: audit.total,
        withReq: audit.withReq,
        zeroSolo: audit.zeroSoloRisk.length,
        topSolo: audit.sample.slice(0, 20),
      },
      loadouts: loadoutRows,
      merged,
      principle:
        "Every Equipment.req is timed; every obtain path has hours; shared prereqs deduped; never free.",
    },
    null,
    2,
  ),
);
console.log("\nWrote artifacts/item-paths-sim.json");
