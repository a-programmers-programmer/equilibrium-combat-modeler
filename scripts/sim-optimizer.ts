/**
 * Full-suite optimizer: relic trie + beam search + invention axes.
 * npx tsx scripts/sim-optimizer.ts
 */
import { writeFileSync, mkdirSync } from "fs";
import {
  enumerateRelicCombos,
  buildRelicTrie,
  combosWithPrefix,
  relicComboStats,
  topCombatRelicCombos,
} from "../src/lib/eq/sim/relic-trie.ts";
import { optimizeSuite } from "../src/lib/eq/sim/optimizer.ts";

console.log("╔══════════════════════════════════════════════════════════╗");
console.log("║  RELIC TRIE + SUITE OPTIMIZER (+ Invention)              ║");
console.log("╚══════════════════════════════════════════════════════════╝\n");

const t0 = Date.now();
const all = enumerateRelicCombos({ validOnly: true });
const stats = relicComboStats(all);
const trie = buildRelicTrie(all);
console.log("Legal relic loadouts:", stats.total);
console.log("  Devout:", stats.withDevout, " Infernal:", stats.withInfernal);
console.log("  Rejuvenated extras:", stats.withRejuv, " Perkfection:", stats.withPerk);
console.log(
  "  Mult range:",
  stats.minMult.toFixed(3),
  "–",
  stats.maxMult.toFixed(3),
  " avg",
  stats.avgMult.toFixed(3),
);
console.log("Trie leaf count:", trie.leafCount);
console.log("Enumerate ms:", Date.now() - t0);

// Prefix example: force T5 Devout
const devoutOnly = combosWithPrefix(trie, { 5: "devout" });
console.log("Prefix T5=Devout →", devoutOnly.length, "loadouts");

const topR = topCombatRelicCombos(all, 15);
console.log("\nTop 15 combat relic combos (heuristic):");
topR.forEach((c, i) => {
  console.log(
    `  #${i + 1} mult=${c.mult.toFixed(3)} devout=${c.devout} perk=${c.perkfection} [${c.active.join(", ")}]`,
  );
});

console.log("\n=== Optimize DPS beam ===");
const dpsOpt = optimizeSuite({
  mode: "dps",
  beamWidth: 60,
  topRelics: 56,
  fightSeconds: 60,
});
console.log(
  `generated=${dpsOpt.generated} pruned=${dpsOpt.pruned} evaluated=${dpsOpt.evaluated} in ${dpsOpt.elapsedMs}ms`,
);
console.log("\nTOP 12 DPS:");
dpsOpt.top.slice(0, 12).forEach((c, i) => {
  console.log(
    `#${String(i + 1).padStart(2)} ${Math.round(c.totalDps).toLocaleString().padStart(8)}  ${c.hours.toFixed(0).padStart(3)}h  val=${Math.round(c.value).toString().padStart(5)}  ${c.style.padEnd(11)} inv=${c.invention.padEnd(8)} ${c.familiar.padEnd(12)} ${c.armour.padEnd(18)} relics=[${c.relicActive.filter((x) => ["devout", "infernal-fire", "icyenic-faith", "naragi-edict", "perkfection", "divine-druid", "rejuvenated"].includes(x)).join("+")}]`,
  );
});

console.log("\n=== Optimize VALUE beam ===");
const valOpt = optimizeSuite({
  mode: "value",
  beamWidth: 60,
  topRelics: 40,
  fightSeconds: 60,
});
console.log(
  `generated=${valOpt.generated} pruned=${valOpt.pruned} evaluated=${valOpt.evaluated} in ${valOpt.elapsedMs}ms`,
);
console.log("\nTOP 10 VALUE:");
[...valOpt.top]
  .sort((a, b) => b.value - a.value)
  .slice(0, 10)
  .forEach((c, i) => {
    console.log(
      `#${String(i + 1).padStart(2)} val=${Math.round(c.value).toString().padStart(5)}  ${Math.round(c.totalDps).toLocaleString().padStart(8)} dps  ${c.hours.toFixed(0)}h  ${c.style} inv=${c.invention} ${c.regionId} [${c.relicActive.filter((x) => ["devout", "infernal-fire", "icyenic-faith", "naragi-edict", "perkfection"].includes(x)).join("+")}]`,
    );
  });

// Invention comparison
console.log("\n=== Invention lift (same beam, filter top by inv) ===");
for (const inv of ["none", "standard", "ancient"] as const) {
  const best = dpsOpt.top.find((c) => c.invention === inv);
  if (best) {
    console.log(
      `  ${inv.padEnd(8)} best ${Math.round(best.totalDps).toLocaleString()} dps  ${best.style} ${best.familiar} perk=${best.perkfection}`,
    );
  } else {
    console.log(`  ${inv.padEnd(8)} (not in top beam)`);
  }
}

mkdirSync("artifacts", { recursive: true });
const report = {
  generated: new Date().toISOString(),
  relicStats: stats,
  trieLeaves: trie.leafCount,
  topRelics: topR.map((c) => ({
    mult: c.mult,
    active: c.active,
    devout: c.devout,
    perkfection: c.perkfection,
    rejuv: c.rejuvenatedExtra,
  })),
  dpsOpt: {
    generated: dpsOpt.generated,
    evaluated: dpsOpt.evaluated,
    pruned: dpsOpt.pruned,
    ms: dpsOpt.elapsedMs,
    best: dpsOpt.bestDps,
    top15: dpsOpt.top.slice(0, 15),
  },
  valOpt: {
    generated: valOpt.generated,
    evaluated: valOpt.evaluated,
    ms: valOpt.elapsedMs,
    best: valOpt.bestValue,
    top10: [...valOpt.top].sort((a, b) => b.value - a.value).slice(0, 10),
  },
};
writeFileSync("artifacts/optimizer-sim.json", JSON.stringify(report, null, 2));
console.log("\nWrote artifacts/optimizer-sim.json");
