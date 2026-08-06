/**
 * OOP progression sim — verifies Invention / Ancient Invention gates.
 * Usage: npx tsx scripts/sim-progression.ts
 */
import { writeFileSync, mkdirSync } from "fs";
import { Player, ProgressionSim, simulateLeagueRoute, INVENTION_UNLOCK, ANCIENT_INVENTION_UNLOCK } from "../src/lib/eq/sim/index.ts";

function fmt(h: number) {
  if (h < 1) return `${Math.round(h * 60)}m`;
  return `${h.toFixed(1)}h`;
}

console.log("=== INVENTION GATE SANITY ===\n");

{
  const p = new Player({ electives: [], relicTier: 1 });
  p.setLevel("crafting", 80);
  p.setLevel("smithing", 80);
  p.setLevel("divination", 80);
  p.syncAutoUnlocks();
  const sim = new ProgressionSim(p);
  console.log("80s but NO Asgarnia:");
  console.log("  standard unlocked?", sim.inventionStatus().standard);
  console.log("  missing:", sim.inventionStatus().missingStandard.join("; "));
  const tryTrain = sim.trainTo("invention", 5);
  console.log("  train blocked?", tryTrain.blocked?.join("; ") ?? "no — BAD");
}

{
  const p = new Player({ electives: ["asgarnia"], relicTier: 2 });
  p.setLevel("crafting", 80);
  p.setLevel("smithing", 80);
  p.setLevel("divination", 80);
  p.syncAutoUnlocks();
  const sim = new ProgressionSim(p);
  console.log("\n80s + Asgarnia:");
  console.log("  standard unlocked?", sim.inventionStatus().standard);
  console.log("  ancient unlocked?", sim.inventionStatus().ancient);
  console.log("  ancient missing:", sim.inventionStatus().missingAncient.join("; "));
  const tryTrain = sim.trainTo("invention", 50);
  console.log("  trained to", tryTrain.reached, "in", fmt(tryTrain.hours));
}

{
  const p = new Player({ electives: ["asgarnia", "kandarin"], relicTier: 4 });
  p.setLevel("crafting", 80);
  p.setLevel("smithing", 80);
  p.setLevel("divination", 80);
  p.setLevel("invention", 85);
  p.setLevel("archaeology", 95);
  p.syncAutoUnlocks();
  const sim = new ProgressionSim(p);
  console.log("\nAsgarnia+Kandarin + Inv85 + Arch95:");
  console.log("  ancient unlocked?", sim.inventionStatus().ancient);
  console.log("  missing:", sim.inventionStatus().missingAncient.join("; ") || "(none)");
}

console.log("\n=== COMBAT ROUTE (Asgarnia + Desert + Forinthry) — NO Kandarin ===\n");
const combat = simulateLeagueRoute({
  electives: ["asgarnia", "desert", "forinthry"],
  wantAncientInvention: false,
});
for (const ph of combat.phases) {
  console.log(`\n${ph.title}  [${fmt(ph.hours)}]`);
  console.log(
    `  Inv standard=${ph.invention.standard} ancient=${ph.invention.ancient}`,
  );
  if (!ph.invention.standard) console.log("  missing std:", ph.invention.missingStandard.join("; "));
  if (!ph.invention.ancient) console.log("  missing ancient:", ph.invention.missingAncient.join("; "));
  console.log(
    `  levels: necro ${ph.levels.necromancy} inv ${ph.levels.invention} craft ${ph.levels.crafting} smith ${ph.levels.smithing} div ${ph.levels.divination} arch ${ph.levels.archaeology}`,
  );
  for (const a of ph.actions.slice(0, 12)) console.log("  ·", a);
  if (ph.actions.length > 12) console.log(`  · … +${ph.actions.length - 12} more`);
}
console.log("\nCombat route total:", fmt(combat.totalHours));
console.log("Final ancient?", combat.finalInvention.ancient, combat.finalInvention.missingAncient.join("; "));

console.log("\n=== ANCIENT INVENTION ROUTE (Asgarnia + Kandarin + Forinthry) ===\n");
const ancient = simulateLeagueRoute({
  electives: ["asgarnia", "kandarin", "forinthry"],
  wantAncientInvention: true,
});
for (const ph of ancient.phases) {
  console.log(`\n${ph.title}  [${fmt(ph.hours)}]`);
  console.log(
    `  Inv standard=${ph.invention.standard} ancient=${ph.invention.ancient}`,
  );
  console.log(
    `  levels: necro ${ph.levels.necromancy} inv ${ph.levels.invention} arch ${ph.levels.archaeology}`,
  );
  for (const a of ph.actions.filter((x) => /Invention|Ancient|Stormguard|Blocked|Unlocked|BLOCKED/i.test(x)).slice(0, 15)) {
    console.log("  ·", a);
  }
}
console.log("\nAncient route total:", fmt(ancient.totalHours));
console.log("Final ancient?", ancient.finalInvention.ancient);

console.log("\n=== REQUIREMENT DESCRIPTIONS ===");
console.log("Invention:", INVENTION_UNLOCK.describe());
console.log("Ancient:", ANCIENT_INVENTION_UNLOCK.describe());

mkdirSync("artifacts", { recursive: true });
writeFileSync(
  "artifacts/progression-sim.json",
  JSON.stringify(
    {
      generated: new Date().toISOString(),
      inventionUnlock: INVENTION_UNLOCK.describe(),
      ancientUnlock: ANCIENT_INVENTION_UNLOCK.describe(),
      combatRoute: combat,
      ancientRoute: ancient,
      conclusion: {
        standardInvention: "Requires Asgarnia + 80 Craft/Smith/Div (tutorial auto)",
        ancientInvention:
          "Requires Kandarin (Stormguard) + 85 Invention + 95 Archaeology + Howl's workshop. Combat package Asgarnia+Desert+Forinthry CANNOT unlock Ancient Invention.",
        recommendation:
          "BiS combat electives trade Ancient Invention for Desert gear. Take Kandarin instead of Desert if ancient gizmos are priority.",
      },
    },
    null,
    2,
  ),
);
console.log("\nWrote artifacts/progression-sim.json");
