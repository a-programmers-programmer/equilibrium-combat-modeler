/**
 * Exhaustive relic audit: wiki tiers + combat mult components.
 * npx tsx scripts/audit-relics.ts
 */
import { writeFileSync, mkdirSync } from "fs";
import { RELICS, stackRelicPlayerMult, legalCombatLoadouts } from "../src/lib/eq/sim/relics.ts";
import { WIKI_RELIC_TIERS, wikiTierOf } from "../src/lib/eq/sim/relic-tiers-wiki.ts";
import { auditAllRelicCombat } from "../src/lib/eq/sim/relic-combat.ts";
import { WAZZY_RELIC_TIERS } from "../src/lib/eq/sim/wazzy-tiers.ts";
import { modelCombat } from "../src/lib/eq/model.ts";
import { stageById } from "../src/lib/eq/gear.ts";

console.log("╔══════════════════════════════════════════════════╗");
console.log("║  RELIC AUDIT — wiki tiers + effect multipliers   ║");
console.log("╚══════════════════════════════════════════════════╝\n");

console.log("═══ Wiki tier map ═══");
for (const [t, row] of Object.entries(WIKI_RELIC_TIERS)) {
  console.log(`T${t} (${row.points} pts): ${row.relics.join(" | ")}`);
}

console.log("\n═══ Catalog tier vs wiki ═══");
let tierMismatches = 0;
for (const r of RELICS) {
  if (r.id === "none") continue;
  const w = wikiTierOf(r.id);
  const ok = w === r.assumedTier;
  if (!ok) tierMismatches++;
  console.log(
    `  ${ok ? "OK" : "MISMATCH"}  ${r.id.padEnd(22)} catalog T${r.assumedTier}  wiki T${w}  (${r.assumedTierSource})`,
  );
}

console.log("\n═══ Wazzy vs wiki ═══");
for (const [t, row] of Object.entries(WAZZY_RELIC_TIERS)) {
  const wiki = WIKI_RELIC_TIERS[Number(t)]?.relics ?? [];
  const same =
    row.relics.length === wiki.length &&
    row.relics.every((id) => wiki.includes(id));
  console.log(
    `T${t} ${same ? "MATCH" : "DIFF"}  wazzy=[${row.relics.join(",")}]  wiki=[${wiki.join(",")}]`,
  );
}

console.log("\n═══ Combat effect mults (ref: prayer40, AD7000, 60s) ═══");
const audit = auditAllRelicCombat(
  RELICS.map((r) => ({ id: r.id, assumedTier: r.assumedTier })),
);
for (const a of audit) {
  const mark = a.combatRelevant ? "⚔" : "·";
  console.log(
    `${mark} T${a.tier} ${a.id.padEnd(22)} ×${a.dpsMult.toFixed(3)}`,
  );
  for (const c of a.components) console.log(`     ${c}`);
}

console.log("\n═══ Stack combos ═══");
const combos: [string, string | null][] = [
  ["infernal-fire", null],
  ["naragi-edict", null],
  ["icyenic-faith", null],
  ["devout", "infernal-fire"],
  ["devout", "icyenic-faith"],
  ["devout", "naragi-edict"],
  ["perkfection", "infernal-fire"],
  ["perkfection", "devout"],
  ["infernal-fire", "icyenic-faith"], // invalid same T7
  ["divine-druid", "icyenic-faith"],
];
for (const [p, s] of combos) {
  const r = stackRelicPlayerMult(p as never, s as never);
  console.log(
    `  ${p}+${s ?? "—"} → ×${r.mult.toFixed(3)} valid=${r.valid}${r.errors.length ? " ERR:" + r.errors[0] : ""}`,
  );
}

console.log("\n═══ Live modelCombat with each T7 ═══");
const stage = stageById("endgame")!;
const picks = ["Order", "Chaos", "Order", "Balance", "Chaos", "Chaos"] as const;
for (const relic of ["none", "infernal-fire", "naragi-edict", "icyenic-faith", "perkfection"] as const) {
  const r = modelCombat({
    picks: picks as never,
    style: "necromancy",
    stage,
    archetype: "shield-tank",
    offhand: "shield",
    armourProfile: "deathwarden-tank",
    herbloreLevel: 110,
    targetTiles: 1,
    multiContentWeight: 0,
    powerburst: true,
    potionProfile: "elder-ovl",
    fightSeconds: 60,
    relic,
    relicSecondary: relic === "perkfection" ? "infernal-fire" : "devout",
  });
  console.log(
    `  ${relic.padEnd(16)} DPS ${Math.round(r.totalDps ?? r.dps).toLocaleString()}  AD ${r.stats.effectiveAd}`,
  );
}

console.log("\n═══ Legal loadout validations ═══");
for (const L of legalCombatLoadouts()) {
  console.log(
    `  ${L.validation.valid ? "OK" : "BAD"} ${L.id} mult×${L.validation.mult.toFixed(3)} ${L.validation.errors[0] ?? ""}`,
  );
}

mkdirSync("artifacts", { recursive: true });
writeFileSync(
  "artifacts/relic-audit.json",
  JSON.stringify(
    {
      generated: new Date().toISOString(),
      wikiTiers: WIKI_RELIC_TIERS,
      tierMismatches,
      audit,
      note: "Combat mults are effect-based (relic-combat.ts). Devout familiar damage is separate (summoning.ts).",
    },
    null,
    2,
  ),
);
console.log("\nWrote artifacts/relic-audit.json");
console.log(`Tier mismatches after applyWiki: ${tierMismatches}`);
