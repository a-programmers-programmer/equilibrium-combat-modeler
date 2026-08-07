/**
 * Dragonbane / affinity bane deep sims — was missing from earlier work.
 * Usage: npx tsx scripts/sim-bane-depth.ts
 */
import { writeFileSync, mkdirSync } from "fs";
import type { Path } from "../src/lib/eq/blessings.ts";
import { stageById, type Style } from "../src/lib/eq/gear.ts";
import { modelCombat, gearFromPackage } from "../src/lib/eq/model.ts";
import { REGION_PACKAGES } from "../src/lib/eq/items.ts";
import {
  BANE_CATALOG,
  TARGET_PROFILES,
  pickBaneLoadout,
  baneDamageMult,
  baneAccessible,
  type TargetTag,
  type BanePiece,
} from "../src/lib/eq/sim/bane.ts";
import { Player } from "../src/lib/eq/sim/player.ts";
import type { RegionTag } from "../src/lib/eq/sim/requirements.ts";

const stage = stageById("endgame");
const PATH_OCOBOC: Path[] = ["Order", "Chaos", "Order", "Balance", "Order", "Chaos"];
const PATH_OCOBCC: Path[] = ["Order", "Chaos", "Order", "Balance", "Chaos", "Chaos"];

function maxPlayer(electives: RegionTag[]): Player {
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

console.log("╔══════════════════════════════════════════════════════════╗");
console.log("║  BANE / DRAGONBANE / AFFINITY DEPTH                      ║");
console.log("╚══════════════════════════════════════════════════════════╝\n");

console.log("Catalog pieces:");
for (const b of BANE_CATALOG) {
  console.log(
    `  ${b.id.padEnd(28)} ${b.role.padEnd(8)} T${String(b.tier).padEnd(3)} ${b.style.padEnd(7)} reg=${b.regions.join("+") || "free"}  vs=${JSON.stringify(b.vsTags)}`,
  );
}

// Accessibility by region
console.log("\n=== Region accessibility (soft) ===");
function accessibleNames(electives: RegionTag[]) {
  const p = maxPlayer(electives);
  return BANE_CATALOG.filter((b) => baneAccessible(b, p.snapshot(), true)).map((b) => b.name);
}
for (const electives of [
  [],
  ["fremennik"],
  ["forinthry"],
  ["anachronia"],
  ["desert"],
  ["asgarnia", "forinthry", "fremennik"],
  ["desert", "anachronia", "forinthry"],
] as RegionTag[][]) {
  console.log(`[${electives.join("+") || "free"}] → ${accessibleNames(electives).join(", ") || "(none)"}`);
}

interface Row {
  style: string;
  target: string;
  path: string;
  packageId: string;
  dps: number;
  dmg30: number;
  baneMult: number;
  banePieces: string[];
  applied: string;
  notes: string;
}

const rows: Row[] = [];
const pkgs = ["free-only", "desert-asgarnia-forinthry", "mory-asgarnia-forinthry", "forinthry-asgarnia-anach"];

// Map package electives for bane region limits
function pkgElectives(id: string): RegionTag[] {
  const pkg = REGION_PACKAGES.find((p) => p.id === id);
  return (pkg?.electives ?? []) as RegionTag[];
}

for (const style of ["ranged", "melee", "magic", "necromancy"] as Style[]) {
  for (const target of TARGET_PROFILES) {
    for (const pkgId of pkgs) {
      const pkg = REGION_PACKAGES.find((p) => p.id === pkgId);
      if (!pkg) continue;
      const electives = pkgElectives(pkgId);
      // free-only has no fremennik — dragonbane locked
      const { snapshot, offhand } = gearFromPackage(pkg, style, style === "melee" ? "shield-tank" : "power-dps");
      const player = maxPlayer(electives);
      const bane = pickBaneLoadout(style, target.tags, player.snapshot());

      // Optional: swap weapon AD when affinity weapon is primary (hex/terra/inq/leng)
      let gear = { ...snapshot };
      const affinityWep = bane.find((b) => b.role === "weapon" && b.abilityDamage);
      let note = "";
      if (affinityWep && affinityWep.abilityDamage) {
        // Compare: keep BiS AD vs swap to affinity weapon AD
        const keep = modelCombat({
          picks: PATH_OCOBOC,
          style,
          stage,
          archetype: style === "melee" ? "shield-tank" : "power-dps",
          offhand,
          herbloreLevel: 110,
          targetTiles: 1,
          multiContentWeight: 0,
          powerburst: false,
          gear: snapshot,
          targetTags: target.tags,
          baneGear: bane.filter((b) => b.role === "ammo"), // ammo only on BiS weapon
          baneRegions: electives,
        });
        const swappedAd = Math.round(
          affinityWep.abilityDamage +
            (affinityWep.twoHanded ? 0 : snapshot.baselineAd * 0.15) +
            900,
        );
        const swapGear = {
          ...snapshot,
          baselineAd: Math.max(swappedAd, Math.round(affinityWep.abilityDamage * 1.4)),
          weaponTier: affinityWep.tier,
          source: `${snapshot.source}+baneWep:${affinityWep.id}`,
        };
        const swap = modelCombat({
          picks: PATH_OCOBOC,
          style,
          stage,
          archetype: style === "melee" ? "shield-tank" : "power-dps",
          offhand: affinityWep.twoHanded ? "none" : offhand,
          herbloreLevel: 110,
          targetTiles: 1,
          multiContentWeight: 0,
          powerburst: false,
          gear: swapGear,
          targetTags: target.tags,
          baneGear: bane,
          baneRegions: electives,
        });
        const best = swap.dps >= keep.dps ? swap : keep;
        note =
          swap.dps >= keep.dps
            ? `affinity weapon ${affinityWep.name} beats BiS`
            : `BiS weapon + ammo beats pure ${affinityWep.name}`;
        rows.push({
          style,
          target: target.id,
          path: "OCOBOC",
          packageId: pkgId,
          dps: best.dps,
          dmg30: best.dps * 30,
          baneMult: best.bane?.mult ?? 1,
          banePieces: best.bane?.pieces ?? [],
          applied: (best.bane?.applied ?? []).map((a) => `${a.name}×${a.mult}`).join("; "),
          notes: note,
        });
        continue;
      }

      const r = modelCombat({
        picks: PATH_OCOBOC,
        style,
        stage,
        archetype: style === "melee" ? "shield-tank" : "power-dps",
        offhand,
        herbloreLevel: 110,
        targetTiles: 1,
        multiContentWeight: 0,
        powerburst: false,
        gear,
        targetTags: target.tags,
        baneGear: bane,
        baneRegions: electives,
      });
      rows.push({
        style,
        target: target.id,
        path: "OCOBOC",
        packageId: pkgId,
        dps: r.dps,
        dmg30: r.dps * 30,
        baneMult: r.bane?.mult ?? 1,
        banePieces: r.bane?.pieces ?? [],
        applied: (r.bane?.applied ?? []).map((a) => `${a.name}×${a.mult}`).join("; "),
        notes: r.flags.filter((f) => f.startsWith("Bane")).join(" · ") || "no bane",
      });
    }
  }
}

rows.sort((a, b) => b.dps - a.dps);

console.log("\n=== DRAGON TARGET: top setups ===");
for (const r of rows.filter((x) => x.target === "dragon" || x.target === "dragon-mage").slice(0, 15)) {
  console.log(
    `${Math.round(r.dmg30).toLocaleString().padStart(10)}  ${r.style.padEnd(11)} ${r.target.padEnd(12)} ${r.packageId.padEnd(26)} ×${r.baneMult.toFixed(2)}  ${r.applied || r.notes}`,
  );
}

console.log("\n=== GENERAL vs DRAGON (same style/pkg) uplift ===");
for (const style of ["ranged", "melee", "magic"] as Style[]) {
  for (const pkgId of ["free-only", "desert-asgarnia-forinthry", "forinthry-asgarnia-anach"]) {
    const g = rows.find((r) => r.style === style && r.packageId === pkgId && r.target === "general");
    const d = rows.find((r) => r.style === style && r.packageId === pkgId && r.target === "dragon");
    const dm = rows.find((r) => r.style === style && r.packageId === pkgId && r.target === "dragon-mage");
    if (!g || !d) continue;
    const up = ((d.dps / g.dps - 1) * 100).toFixed(1);
    const upm = dm ? ((dm.dps / g.dps - 1) * 100).toFixed(1) : "n/a";
    console.log(
      `${style.padEnd(8)} ${pkgId.padEnd(26)} gen ${Math.round(g.dmg30).toLocaleString()} → dragon +${up}%  dragon-mage +${upm}%  [${d.applied || "no bane"}]`,
    );
  }
}

console.log("\n=== AFFINITY TARGETS (hex / terra / inq) ===");
for (const tid of ["mage-class", "melee-class", "ranged-class", "glacor"]) {
  console.log(`\n${tid}:`);
  for (const r of rows.filter((x) => x.target === tid).slice(0, 6)) {
    console.log(
      `  ${Math.round(r.dmg30).toLocaleString().padStart(10)} ${r.style.padEnd(8)} ${r.packageId.padEnd(26)} ${r.applied || r.notes}`,
    );
  }
}

// Explicit dragonbane stack table for ranged
console.log("\n=== RANGED DRAGON STACK DETAIL ===");
const fullPkg = REGION_PACKAGES.find((p) => p.id === "forinthry-asgarnia-anach")!;
const { snapshot, offhand } = gearFromPackage(fullPkg, "ranged", "power-dps");
const player = maxPlayer(["forinthry", "asgarnia", "anachronia", "fremennik"] as RegionTag[]);
// force fremennik for bane ammo
player.unlockRegion("fremennik");
player.completeQuest("ritual-of-the-mahjarrat");
player.setFlag("unlocked:tune-bane");
player.setFlag("unlocked:dinarrows");
player.setFlag("unlocked:jas-anima");
player.setFlag("killed:soulgazer");
player.setFlag("unlocked:hexhunter-imbue");

const combos: { name: string; tags: TargetTag[]; pieces: BanePiece[] }[] = [
  { name: "BOLG no ammo", tags: ["dragon"], pieces: [] },
  {
    name: "BOLG + dragonbane bolts",
    tags: ["dragon"],
    pieces: [BANE_CATALOG.find((b) => b.id === "dragonbane-bolts")!],
  },
  {
    name: "BOLG + Jas dragonbane",
    tags: ["dragon"],
    pieces: [BANE_CATALOG.find((b) => b.id === "jas-dragonbane-arrows")!],
  },
  {
    name: "Hex imbued + Jas dragonbane (dragon-mage)",
    tags: ["dragon", "mage-class"],
    pieces: [
      BANE_CATALOG.find((b) => b.id === "hexhunter-bow-imbued")!,
      BANE_CATALOG.find((b) => b.id === "jas-dragonbane-arrows")!,
    ],
  },
  {
    name: "Hex imbued + dragonbane bolts (dragon-mage)",
    tags: ["dragon", "mage-class"],
    pieces: [
      BANE_CATALOG.find((b) => b.id === "hexhunter-bow-imbued")!,
      BANE_CATALOG.find((b) => b.id === "dragonbane-bolts")!,
    ],
  },
];

for (const c of combos) {
  let gear = { ...snapshot };
  const hex = c.pieces.find((p) => p.kind === "weapon-hexhunter");
  if (hex) {
    gear = {
      ...gear,
      baselineAd: Math.round((hex.abilityDamage ?? 1920) * 1.45),
      weaponTier: hex.tier,
      source: "hexhunter-swap",
    };
  }
  const r = modelCombat({
    picks: PATH_OCOBOC,
    style: "ranged",
    stage,
    archetype: "power-dps",
    offhand: hex ? "none" : offhand,
    herbloreLevel: 110,
    targetTiles: 1,
    multiContentWeight: 0,
    powerburst: false,
    gear,
    targetTags: c.tags,
    baneGear: c.pieces,
  });
  const { mult, applied } = baneDamageMult(c.pieces, c.tags);
  console.log(
    `${c.name.padEnd(48)} dps ${Math.round(r.dps).toLocaleString().padStart(8)}  30s ${Math.round(r.dps * 30).toLocaleString().padStart(10)}  mult×${(r.bane?.mult ?? mult).toFixed(3)}  ${applied.map((a) => a.name).join("+")}`,
  );
}

// Free-only cannot make dragonbane (needs Fremennik)
console.log("\n=== CRITICAL: free-only dragonbane? ===");
const freeP = maxPlayer([]);
const freeBane = pickBaneLoadout("ranged", ["dragon"], freeP.snapshot());
console.log(
  "Free regions dragon bane pick:",
  freeBane.map((b) => b.name).join(", ") || "NONE — need Fremennik for tuned bane / or free-path Jas if flags set",
);
// Jas is free path regions empty — should work
const freeJas = pickBaneLoadout("ranged", ["dragon"], maxPlayer([]).snapshot());
console.log(
  "With max flags free:",
  freeJas.map((b) => b.name).join(", "),
  "→ Jas dragonbane is freepath (EGWD anima), classic dragonbane bolts need Fremennik",
);

mkdirSync("artifacts", { recursive: true });
writeFileSync(
  "artifacts/bane-depth-sim.json",
  JSON.stringify(
    {
      generated: new Date().toISOString(),
      catalog: BANE_CATALOG,
      targets: TARGET_PROFILES,
      topDragon: rows.filter((r) => r.target.startsWith("dragon")).slice(0, 20),
      uplift: rows.filter((r) => r.target === "dragon" || r.target === "general"),
      conclusion: {
        dragonbaneBolts: "T80 +25% ability vs dragons; needs Fremennik + RoTM Tune Bane",
        jasDragonbane: "T95 +30% ability vs dragons; free-path anima — strongest dragon ranged ammo",
        hexhunter: "Forinthry; +12.5–17.5% vs mage-class; stacks with dragonbane on dragon-mage targets",
        terrasaur: "Anachronia BGH; +12.5% vs ranged-class melee",
        inquisitor: "Desert; +12.5–17.5% vs melee-class magic",
        leng: "Forinthry Glacor Front specialized, not dragonbane",
        freeOnly:
          "Classic dragonbane bolts LOCKED without Fremennik. Jas dragonbane still available on free if anima unlocked.",
      },
    },
    null,
    2,
  ),
);
console.log("\nWrote artifacts/bane-depth-sim.json");
