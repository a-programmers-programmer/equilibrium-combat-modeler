/**
 * Armour bonus sims — power vs tank vs hybrid under Aegis.
 * npx tsx scripts/sim-armour.ts
 */
import { writeFileSync, mkdirSync } from "fs";
import { modelCombat } from "../src/lib/eq/model.ts";
import { stageById, type Style } from "../src/lib/eq/gear.ts";
import {
  ARMOUR_PROFILES,
  compareAegisArmourTradeoff,
  type ArmourProfileId,
} from "../src/lib/eq/sim/armour.ts";
import type { Path } from "../src/lib/eq/blessings.ts";

const stage = stageById("endgame")!;
const aegisPicks: Path[] = ["Order", "Chaos", "Order", "Balance", "Chaos", "Chaos"];
const noAegis: Path[] = ["Chaos", "Chaos", "Chaos", "Chaos", "Chaos", "Chaos"];

console.log("╔══════════════════════════════════════════════════════════╗");
console.log("║  ARMOUR BONUSES — power / tank / sets / Aegis tradeoff   ║");
console.log("╚══════════════════════════════════════════════════════════╝\n");

console.log("=== Aegis AD tradeoff (baseline AD 3400, shield 75%) ===");
for (const style of ["melee", "magic", "ranged", "necromancy"] as Style[]) {
  const t = compareAegisArmourTradeoff({
    style,
    aegisPct: 0.75,
    baselineAd: 3400,
  });
  console.log(
    `  ${style.padEnd(11)} winner=${t.winner}  powerAD=${Math.round(t.power.ad)} tankAD=${Math.round(t.tank.ad)} mixedAD=${Math.round(t.mixed.ad)}`,
  );
}

const rows: {
  profile: string;
  style: Style;
  aegis: boolean;
  total: number;
  ad: number;
  armour: number;
  styleMult: number;
  setMult: number;
  aegisAd: number;
}[] = [];

for (const style of ["melee", "magic", "ranged"] as Style[]) {
  for (const profile of ARMOUR_PROFILES) {
    for (const useAegis of [true, false]) {
      const r = modelCombat({
        picks: useAegis ? aegisPicks : noAegis,
        style,
        stage,
        archetype: profile.archetype,
        offhand:
          profile.archetype === "shield-tank"
            ? "shield"
            : profile.archetype === "defender"
              ? "defender"
              : "none",
        herbloreLevel: 110,
        targetTiles: 1,
        multiContentWeight: 0,
        powerburst: true,
        potionProfile: "elder-ovl",
        armourProfile: profile.id as ArmourProfileId,
        relic: "devout",
        relicSecondary: "infernal-fire",
        familiar: "ripper-demon",
        summoningLevel: 99,
        baneRegions: [
          "free",
          "misthalin",
          "forinthry",
          "tirannwn",
          "anachronia",
        ],
        fightSeconds: 60,
      });
      rows.push({
        profile: profile.id,
        style,
        aegis: useAegis,
        total: r.totalDps ?? r.dps,
        ad: r.stats.effectiveAd,
        armour: r.stats.armour,
        styleMult: r.armourBonuses?.styleDamageMult ?? 1,
        setMult: r.armourBonuses?.setEffectMult ?? 1,
        aegisAd: r.armourBonuses?.aegisAd ?? 0,
      });
    }
  }
}

rows.sort((a, b) => b.total - a.total);
console.log("\n=== TOP 12 armour packages (melee/magic/ranged) ===");
rows.slice(0, 12).forEach((r, i) => {
  console.log(
    `#${String(i + 1).padStart(2)} ${Math.round(r.total).toLocaleString().padStart(8)} ${r.style.padEnd(7)} ${r.profile.padEnd(20)} aegis=${r.aegis ? "Y" : "N"} AD=${r.ad} arm=${r.armour} style×${r.styleMult.toFixed(2)} aegisAD=${r.aegisAd}`,
  );
});

console.log("\n=== Melee Aegis: every profile ===");
rows
  .filter((r) => r.style === "melee" && r.aegis)
  .sort((a, b) => b.total - a.total)
  .forEach((r) => {
    console.log(
      `  ${r.profile.padEnd(20)} ${Math.round(r.total).toLocaleString().padStart(8)}  AD=${String(r.ad).padStart(5)} arm=${String(r.armour).padStart(4)} style×${r.styleMult.toFixed(3)} set×${r.setMult.toFixed(3)}`,
    );
  });

// SVG
const meleeAegis = rows
  .filter((r) => r.style === "melee" && r.aegis)
  .sort((a, b) => b.total - a.total);
const maxT = Math.max(...meleeAegis.map((r) => r.total));
let svg = `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="920" height="420" viewBox="0 0 920 420">
<rect width="100%" height="100%" fill="#0f172a"/>
<text x="460" y="28" text-anchor="middle" fill="#e2e8f0" font-size="15" font-weight="600" font-family="system-ui,sans-serif">Melee + Aegis: armour package ranking</text>
<text x="460" y="46" text-anchor="middle" fill="#64748b" font-size="11" font-family="system-ui,sans-serif">Style damage mult · set effects · armour value → Aegis AD</text>`;
meleeAegis.forEach((r, i) => {
  const y = 60 + i * 34;
  const w = (r.total / maxT) * 520;
  svg += `<text x="12" y="${y + 14}" fill="#94a3b8" font-size="11" font-family="system-ui,sans-serif">${r.profile}</text>
  <rect x="180" y="${y}" width="${w}" height="20" rx="3" fill="#38bdf8"/>
  <text x="${190 + w}" y="${y + 14}" fill="#e2e8f0" font-size="10">${Math.round(r.total).toLocaleString()} (arm ${r.armour}, ×${r.styleMult.toFixed(2)})</text>`;
});
svg += `</svg>`;

mkdirSync("artifacts", { recursive: true });
mkdirSync("public", { recursive: true });
writeFileSync("artifacts/armour-packages.svg", svg);
writeFileSync("public/armour-packages.svg", svg);
writeFileSync(
  "artifacts/armour-sim.json",
  JSON.stringify(
    {
      tradeoff: Object.fromEntries(
        (["melee", "magic", "ranged", "necromancy"] as Style[]).map((s) => [
          s,
          compareAegisArmourTradeoff({ style: s, aegisPct: 0.75, baselineAd: 3400 }),
        ]),
      ),
      top: rows.slice(0, 20),
      meleeAegis,
    },
    null,
    2,
  ),
);
console.log("\nWrote artifacts/armour-packages.svg + armour-sim.json");
