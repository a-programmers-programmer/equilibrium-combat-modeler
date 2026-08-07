/**
 * Summoning-gated sims — familiars only contribute if requirements met.
 * Usage: npx tsx scripts/sim-summon-gated.ts
 */
import { writeFileSync, mkdirSync } from "fs";
import type { Path } from "../src/lib/eq/blessings.ts";
import { stageById, type Style } from "../src/lib/eq/gear.ts";
import { modelCombat, gearFromPackage } from "../src/lib/eq/model.ts";
import { REGION_PACKAGES, type RegionId } from "../src/lib/eq/items.ts";
import {
  FAMILIAR_CATALOG,
  summoningAccessReport,
  pickBestFamiliar,
  type FamiliarId,
} from "../src/lib/eq/sim/summoning.ts";
import { combatRelicCombos } from "../src/lib/eq/sim/relics.ts";
import { Player } from "../src/lib/eq/sim/player.ts";
import type { RegionTag } from "../src/lib/eq/sim/requirements.ts";
import type { TargetTag } from "../src/lib/eq/sim/bane.ts";

const stage = stageById("endgame");
const PATH: Path[] = ["Order", "Chaos", "Order", "Balance", "Order", "Chaos"];

function playerForPackage(
  electives: readonly string[],
  summoningLevel: number,
  opts?: { ancient?: boolean; nihil?: boolean; kalg?: boolean },
): Player {
  const p = new Player({ electives, relicTier: 6 });
  p.setLevel("summoning", summoningLevel);
  for (const sk of ["attack", "strength", "defence", "magic", "ranged", "necromancy"] as const) {
    p.setLevel(sk, 99);
  }
  // Equilibrium: Contract Claws auto
  p.setFlag("league:contract-claws-auto");
  if (opts?.ancient !== false) {
    p.setFlag("unlocked:ancient-summoning");
    p.setFlag("unlocked:binding-contracts");
  }
  if (opts?.nihil !== false && electives.includes("forinthry")) {
    p.setFlag("killed:nihil");
    p.setFlag("unlocked:nihil-pouches");
  }
  if (opts?.kalg !== false && electives.includes("forinthry")) {
    p.setFlag("unlocked:dungeoneering-kalg");
  }
  if (electives.includes("forinthry")) {
    p.setFlag("unlocked:binding-ripper");
  }
  return p;
}

console.log("╔════════════════════════════════════════════════════════════╗");
console.log("║  SUMMONING REQUIREMENTS + GATED SIMS                       ║");
console.log("╚════════════════════════════════════════════════════════════╝\n");

// Access matrix
for (const label of ["free-only", "forinthry", "sum40-free", "sum99-no-ancient"]) {
  let p: Player;
  if (label === "free-only") p = playerForPackage([], 99);
  else if (label === "forinthry") p = playerForPackage(["forinthry", "asgarnia"], 99);
  else if (label === "sum40-free") p = playerForPackage([], 40);
  else {
    p = playerForPackage(["forinthry"], 99, { ancient: false });
    p.flags.delete("league:contract-claws-auto");
    p.flags.delete("unlocked:ancient-summoning");
  }
  console.log(`\n=== Access: ${label} (sum ${p.level("summoning")}) ===`);
  for (const row of summoningAccessReport(p.snapshot()).filter((r) => r.id !== "none")) {
    if (!row.soft && !row.hard) {
      console.log(`  LOCK  ${row.name.padEnd(40)} need: ${row.missingSoft.join(", ") || row.missingHard.slice(0, 2).join(", ")}`);
    } else {
      console.log(
        `  OK    ${row.name.padEnd(40)} soft=${row.soft} hard=${row.hard}  [${row.req.slice(0, 50)}]`,
      );
    }
  }
  const best = pickBestFamiliar(p.snapshot(), { devout: true, divineDruid: false, accessMode: "soft" });
  console.log(`  → best soft with Devout: ${best.name} (${Math.round(best.familiarDps)} dps)`);
}

// Gated combat sims
interface Row {
  style: string;
  packageId: string;
  summoning: number;
  relic: string;
  familiar: string;
  totalDps: number;
  famDps: number;
  playerDps: number;
  locked: boolean;
  dmg30: number;
}

const rows: Row[] = [];
const famIds = FAMILIAR_CATALOG.filter((f) => f.combat || f.id === "none").map((f) => f.id);
const combos = combatRelicCombos(true).filter((c) =>
  ["none", "devout", "infernal-fire", "devout+infernal-fire(rejuv)", "icyenic-faith"].includes(c.label),
);

const scenarios = [
  { pkg: "free-only", electives: [] as string[], sum: 99 },
  { pkg: "free-only", electives: [] as string[], sum: 70 },
  { pkg: "free-only", electives: [] as string[], sum: 50 },
  { pkg: "forinthry-asgarnia-anach", electives: ["forinthry", "asgarnia", "anachronia"], sum: 99 },
  { pkg: "desert-asgarnia-forinthry", electives: ["desert", "asgarnia", "forinthry"], sum: 99 },
  { pkg: "mory-asgarnia-forinthry", electives: ["morytania", "asgarnia", "forinthry"], sum: 99 },
  { pkg: "desert-asgarnia-forinthry", electives: ["desert", "asgarnia", "forinthry"], sum: 90 },
];

console.log("\n=== GATED COMBAT MATRIX ===");
for (const sc of scenarios) {
  const pkg = REGION_PACKAGES.find((p) => p.id === sc.pkg);
  if (!pkg) continue;
  const player = playerForPackage(sc.electives, sc.sum);
  for (const style of ["necromancy", "melee"] as Style[]) {
    const arch = style === "melee" ? "shield-tank" : "power-dps";
    const { snapshot, offhand } = gearFromPackage(pkg, style, arch);
    for (const combo of combos) {
      for (const fam of famIds) {
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
          familiar: fam as FamiliarId,
          relic: combo.primary,
          relicSecondary: combo.secondary,
          summoningLevel: sc.sum,
          summoningPlayer: player.snapshot(),
          familiarAccess: "soft",
          baneRegions: [
            "free",
            "misthalin",
            "havenhythe",
            "karamja",
            ...(sc.electives as RegionTag[]),
          ],
        });
        const locked = r.warnings.some((w) => w.includes("LOCKED")) || (r.familiar?.dps === 0 && fam !== "none" && FAMILIAR_CATALOG.find((f) => f.id === fam)?.combat);
        rows.push({
          style,
          packageId: `${sc.pkg}|sum${sc.sum}`,
          summoning: sc.sum,
          relic: combo.label,
          familiar: fam,
          totalDps: r.totalDps,
          famDps: r.familiar?.dps ?? 0,
          playerDps: r.dps,
          locked: !!locked && (r.familiar?.dps ?? 0) === 0 && fam !== "none",
          dmg30: r.totalDps * 30 * (style === "melee" ? 1.72 : 1.42),
        });
      }
    }
  }
}

console.log(`Rows: ${rows.length}`);

// Free-only: ripper must be locked
const freeRipper = rows.find(
  (r) => r.packageId.startsWith("free-only") && r.summoning === 99 && r.familiar === "ripper-demon" && r.relic === "devout" && r.style === "necromancy",
)!;
console.log("\nFree-only + Devout + Ripper:", {
  famDps: Math.round(freeRipper.famDps),
  locked: freeRipper.locked,
  total: Math.round(freeRipper.totalDps),
});

const freeSteel = rows.find(
  (r) => r.packageId.startsWith("free-only") && r.summoning === 99 && r.familiar === "steel-titan" && r.relic === "devout" && r.style === "necromancy",
)!;
console.log("Free-only + Devout + Steel titan:", {
  famDps: Math.round(freeSteel.famDps),
  locked: freeSteel.locked,
  total: Math.round(freeSteel.totalDps),
});

const freeSum50 = rows.find(
  (r) => r.packageId.includes("sum50") && r.familiar === "steel-titan" && r.relic === "devout" && r.style === "necromancy",
)!;
console.log("Free sum50 + Steel titan:", freeSum50 ? { fam: Math.round(freeSum50.famDps), locked: freeSum50.locked } : "n/a");

const forinRipper = rows.find(
  (r) => r.packageId.includes("forinthry-asgarnia") && r.summoning === 99 && r.familiar === "ripper-demon" && r.relic === "devout" && r.style === "necromancy",
)!;
console.log("Forinthry + Devout + Ripper:", {
  famDps: Math.round(forinRipper.famDps),
  locked: forinRipper.locked,
  total: Math.round(forinRipper.totalDps),
});

// Best legal setup per package
console.log("\n=== BEST LEGAL (soft access) PER SCENARIO ===");
for (const sc of scenarios) {
  const key = `${sc.pkg}|sum${sc.sum}`;
  const best = rows
    .filter((r) => r.packageId === key && r.style === "necromancy" && !r.locked)
    .sort((a, b) => b.totalDps - a.totalDps)[0];
  if (best) {
    console.log(
      `${key.padEnd(40)} ${best.relic.padEnd(32)} ${best.familiar.padEnd(20)} fam=${Math.round(best.famDps)} total=${Math.round(best.totalDps)}`,
    );
  }
}

console.log("\n=== GLOBAL BEST LEGAL 30s (melee+necro) ===");
const legal = rows.filter((r) => !r.locked || r.familiar === "none").sort((a, b) => b.dmg30 - a.dmg30);
for (const [i, r] of legal.slice(0, 12).entries()) {
  console.log(
    `#${i + 1} ${Math.round(r.dmg30).toLocaleString().padStart(10)} ${r.style.padEnd(11)} ${r.packageId.padEnd(40)} ${r.relic.padEnd(28)} ${r.familiar.padEnd(18)} fam=${Math.round(r.famDps)}`,
  );
}

// Compare: illegal (ignore gates) vs legal
console.log("\n=== Gate impact: free-only ignoring gates vs soft ===");
const pkg = REGION_PACKAGES.find((p) => p.id === "free-only")!;
const { snapshot, offhand } = gearFromPackage(pkg, "necromancy", "power-dps");
const pFree = playerForPackage([], 99);
const ignore = modelCombat({
  picks: PATH,
  style: "necromancy",
  stage,
  archetype: "power-dps",
  offhand,
  herbloreLevel: 110,
  targetTiles: 1,
  multiContentWeight: 0,
  powerburst: false,
  gear: snapshot,
  familiar: "ripper-demon",
  relic: "devout",
  summoningLevel: 99,
  familiarAccess: "ignore",
});
const soft = modelCombat({
  picks: PATH,
  style: "necromancy",
  stage,
  archetype: "power-dps",
  offhand,
  herbloreLevel: 110,
  targetTiles: 1,
  multiContentWeight: 0,
  powerburst: false,
  gear: snapshot,
  familiar: "ripper-demon",
  relic: "devout",
  summoningLevel: 99,
  summoningPlayer: pFree.snapshot(),
  familiarAccess: "soft",
});
console.log("ignore gates ripper fam", Math.round(ignore.familiar?.dps ?? 0), "total", Math.round(ignore.totalDps));
console.log("soft gates ripper fam", Math.round(soft.familiar?.dps ?? 0), "total", Math.round(soft.totalDps), soft.warnings[0]);

mkdirSync("artifacts", { recursive: true });
writeFileSync(
  "artifacts/summoning-gated-sim.json",
  JSON.stringify(
    {
      generated: new Date().toISOString(),
      freeOnlyAccess: summoningAccessReport(playerForPackage([], 99).snapshot()),
      forinthryAccess: summoningAccessReport(playerForPackage(["forinthry"], 99).snapshot()),
      freeRipper,
      freeSteel,
      forinRipper,
      topLegal: legal.slice(0, 30),
      conclusion: {
        freePathBiSFamiliar: "Steel titan at 99 Summoning (or Iron titan at 95). Ripper LOCKED without Forinthry.",
        forinthryBiS: "Ripper demon + Devout once 96 Summoning + binding contract farmed.",
        levelGates: "sum50 free → hellhound only; sum70 → mid titans; sum99 → steel titan.",
      },
    },
    null,
    2,
  ),
);
console.log("\nWrote artifacts/summoning-gated-sim.json");
