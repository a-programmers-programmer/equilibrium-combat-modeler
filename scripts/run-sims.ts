/**
 * Exhaustive-ish Equilibrium DPS sims.
 * Usage: npx tsx scripts/run-sims.ts
 */
import { writeFileSync, mkdirSync } from "fs";
import { stageById, STYLES, type Style, type BuildArchetype } from "../src/lib/eq/gear.ts";
import { modelCombat, gearFromPackage, REGION_PACKAGES } from "../src/lib/eq/model.ts";
import { PRESETS } from "../src/lib/eq/presets.ts";
import { CROWN_PATHS, rankPaths, rankRegions } from "../src/lib/eq/lab.ts";
import { ELECTIVE_REGION_IDS, type RegionId } from "../src/lib/eq/items.ts";
import type { Path } from "../src/lib/eq/blessings.ts";

const ARCH: BuildArchetype[] = ["shield-tank", "defender", "power-dps"];
const stage = stageById("endgame");

type Row = Record<string, string | number | boolean>;

const rows: Row[] = [];

console.log("=== Equilibrium combat sims ===\n");

// 1) Crown paths × styles × packages × multi
for (const pkg of REGION_PACKAGES) {
  for (const style of STYLES.map((s) => s.id)) {
    for (const arch of ARCH) {
      const { snapshot } = gearFromPackage(pkg, style, arch);
      for (const crown of CROWN_PATHS) {
        for (const multi of [0.1, 0.7]) {
          const r = modelCombat({
            picks: crown.picks,
            style,
            stage,
            archetype: arch,
            herbloreLevel: 110,
            targetTiles: multi > 0.4 ? 9 : 1,
            multiContentWeight: multi,
            powerburst: true,
            gear: snapshot,
          });
          rows.push({
            kind: "crown",
            path: crown.id,
            pathCode: crown.picks.map((p) => p[0]).join(""),
            style,
            arch,
            package: pkg.id,
            multi,
            dps: Math.round(r.dps),
            mult: Number(r.vsBaseline.toFixed(3)),
            ad: r.stats.effectiveAd,
            armour: r.stats.armour,
            lp: r.stats.maxLp,
            god4: r.god4 ?? "",
            god8: r.god8 ?? "",
            weaponTier: snapshot.weaponTier,
          });
        }
      }
    }
  }
}

// 2) All presets under default Mory+Asg+Wildy necro shield
const defaultPkg = REGION_PACKAGES.find((p) => p.id === "mory-asgarnia-forinthry")!;
for (const style of STYLES.map((s) => s.id) as Style[]) {
  const { snapshot } = gearFromPackage(defaultPkg, style, "shield-tank");
  const ranked = rankPaths({ style, archetype: "shield-tank", gear: snapshot, multi: 0.1 });
  console.log(`\n--- Ranked paths: ${style} / Mory+Asg+Wildy / shield ST ---`);
  for (const [i, r] of ranked.entries()) {
    console.log(
      `#${i + 1} ${r.name.padEnd(28)} ${String(Math.round(r.result.dps)).padStart(7)}  ${r.result.vsBaseline.toFixed(2)}x  arm${r.result.stats.armour}`,
    );
  }
}

// 3) Region ranking for OOCOBO
const oocobo = CROWN_PATHS.find((c) => c.id === "oocobo")!;
console.log("\n--- Region packages for OOCOBO Necro shield ST ---");
const regRank = rankRegions({
  picks: oocobo.picks,
  style: "necromancy",
  archetype: "shield-tank",
  multi: 0.1,
});
for (const [i, r] of regRank.entries()) {
  console.log(
    `#${i + 1} ${r.pkg.name.padEnd(36)} ${String(Math.round(r.result.dps)).padStart(7)}  arm${r.armour} T${r.weaponTier}`,
  );
}

// 4) Free-only vs full electives margin
console.log("\n--- Free-only vs best package (OOCOBO ST) ---");
for (const style of STYLES.map((s) => s.id) as Style[]) {
  const free = gearFromPackage(
    REGION_PACKAGES.find((p) => p.id === "free-only")!,
    style,
    "shield-tank",
  );
  const full = gearFromPackage(defaultPkg, style, "shield-tank");
  const freeR = modelCombat({
    picks: oocobo.picks,
    style,
    stage,
    archetype: "shield-tank",
    herbloreLevel: 110,
    targetTiles: 1,
    multiContentWeight: 0.1,
    powerburst: true,
    gear: free.snapshot,
  });
  const fullR = modelCombat({
    picks: oocobo.picks,
    style,
    stage,
    archetype: "shield-tank",
    herbloreLevel: 110,
    targetTiles: 1,
    multiContentWeight: 0.1,
    powerburst: true,
    gear: full.snapshot,
  });
  const gain = ((fullR.dps / freeR.dps - 1) * 100).toFixed(1);
  console.log(
    `${style.padEnd(12)} free ${Math.round(freeR.dps)} → mory+asg+wildy ${Math.round(fullR.dps)}  (+${gain}%)  arm ${free.snapshot.armour}→${full.snapshot.armour}`,
  );
}

// 5) Aegis vs Big Boned vs Chaos under realistic gear
console.log("\n--- Path families (Necro, Mory+Asg+Wildy, shield) ---");
const fam = [
  { name: "Aegis crown OOCOBO", picks: oocobo.picks },
  { name: "Pure Order", picks: ["Order", "Order", "Order", "Order", "Order", "Order"] as Path[] },
  { name: "Big Boned", picks: ["Balance", "Order", "Order", "Order", "Balance", "Order"] as Path[] },
  { name: "Full Chaos", picks: ["Chaos", "Chaos", "Chaos", "Chaos", "Chaos", "Chaos"] as Path[] },
];
const snap = gearFromPackage(defaultPkg, "necromancy", "shield-tank").snapshot;
for (const f of fam) {
  const r = modelCombat({
    picks: f.picks,
    style: "necromancy",
    stage,
    archetype: "shield-tank",
    herbloreLevel: 110,
    targetTiles: 1,
    multiContentWeight: 0.1,
    powerburst: true,
    gear: snap,
  });
  console.log(`${f.name.padEnd(24)} ${Math.round(r.dps)}  ${r.vsBaseline.toFixed(2)}x  AD ${r.stats.effectiveAd}`);
}

// 6) Archetype sensitivity
console.log("\n--- Archetype (OOCOBO Necro, Mory+Asg+Wildy) ---");
for (const arch of ARCH) {
  const { snapshot } = gearFromPackage(defaultPkg, "necromancy", arch);
  const r = modelCombat({
    picks: oocobo.picks,
    style: "necromancy",
    stage,
    archetype: arch,
    herbloreLevel: 110,
    targetTiles: 1,
    multiContentWeight: 0.1,
    powerburst: true,
    gear: snapshot,
  });
  console.log(`${arch.padEnd(14)} ${Math.round(r.dps)}  arm${r.stats.armour} AD${r.stats.effectiveAd}`);
}

// Global top
rows.sort((a, b) => Number(b.dps) - Number(a.dps));
console.log("\n=== GLOBAL TOP 20 (all crowns × styles × packages × multi) ===");
for (const r of rows.slice(0, 20)) {
  console.log(
    String(r.dps).padStart(7),
    r.mult + "x",
    String(r.style).padEnd(11),
    String(r.arch).padEnd(12),
    `m${r.multi}`,
    String(r.pathCode).padEnd(7),
    String(r.package),
  );
}

mkdirSync("artifacts", { recursive: true });
const out = {
  generated: new Date().toISOString(),
  totalSims: rows.length,
  top20: rows.slice(0, 20),
  regionRankOocoboNecro: regRank.map((r) => ({
    package: r.pkg.id,
    dps: Math.round(r.result.dps),
    armour: r.armour,
  })),
  summary: {
    bestOverall: rows[0],
    recommendation:
      "OOCOBO (ST) or OCOOOC (multi) with shield-tank + Order gods; electives Mory/Asgarnia/Forinthry for shields & jewellery. Free regions already supply style T95 weapons.",
  },
};
writeFileSync("artifacts/sim-results.json", JSON.stringify(out, null, 2));
console.log(`\nWrote artifacts/sim-results.json (${rows.length} rows)`);
