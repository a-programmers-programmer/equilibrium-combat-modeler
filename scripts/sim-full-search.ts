/**
 * Full multi-window suite search + synergy packs + AD formula sanity.
 * npx tsx scripts/sim-full-search.ts
 */
import { writeFileSync, mkdirSync } from "fs";
import { optimizeSuite } from "../src/lib/eq/sim/optimizer.ts";
import { modelCombat } from "../src/lib/eq/model.ts";
import { stageById } from "../src/lib/eq/gear.ts";
import { stackRelicPlayerMult } from "../src/lib/eq/sim/relics.ts";
import type { Path } from "../src/lib/eq/blessings.ts";

console.log("╔════════════════════════════════════════════════════════════╗");
console.log("║  FULL SEARCH — synergies · windows · styles · relics       ║");
console.log("╚════════════════════════════════════════════════════════════╝\n");

// ── Wiki AD formula sanity (magic dual, ref) ──
function wikiMagicAd(level: number, tier: number, styleBonus: number, spellTier = 99) {
  const f = (L: number) =>
    (145 * Math.log(1 + 0.6 * (L / 145))) / Math.log(1.6);
  const fl = Math.floor(2.5 * f(level));
  const mh = fl + Math.floor(9.6 * Math.min(tier, spellTier) + styleBonus);
  const oh = Math.floor(
    0.5 * (fl + Math.floor(9.6 * Math.min(tier, spellTier) + styleBonus)),
  );
  return { levelPart: f(level), dual: mh + oh, mh, oh };
}
const adSanity = wikiMagicAd(120, 95, 450);
console.log("Wiki Magic AD sanity (lv120 ovl, T95 dual, +450 style):");
console.log(
  `  f(level)=${adSanity.levelPart.toFixed(1)}  MH ${adSanity.mh} OH ${adSanity.oh} dual≈${adSanity.dual}`,
);
console.log(
  "  (Our model uses gear-stage AD + Aegis/Icyenic/relics on top — not a full re-derive of wiki AD.)\n",
);

type Pack = {
  name: string;
  fightSeconds: number;
  multi: number;
  tiles: number;
  beam: number;
  topRelics: number;
};

const packs: Pack[] = [
  { name: "ST-30s-burst", fightSeconds: 30, multi: 0, tiles: 1, beam: 50, topRelics: 48 },
  { name: "ST-60s", fightSeconds: 60, multi: 0, tiles: 1, beam: 70, topRelics: 64 },
  { name: "ST-120s", fightSeconds: 120, multi: 0, tiles: 1, beam: 50, topRelics: 48 },
  { name: "MULTI-60s", fightSeconds: 60, multi: 0.55, tiles: 3, beam: 50, topRelics: 48 },
];

const allTop: Record<string, unknown> = {};
const leaders: {
  pack: string;
  dps: number;
  style: string;
  path: string;
  armour: string;
  inv: string;
  fam: string;
  poison: string;
  relics: string;
  hours: number;
  flags: string[];
}[] = [];

for (const p of packs) {
  console.log(`\n═══ ${p.name} (beam ${p.beam}, multi=${p.multi}) ═══`);
  const t0 = Date.now();
  const res = optimizeSuite({
    mode: "dps",
    beamWidth: p.beam,
    topRelics: p.topRelics,
    fightSeconds: p.fightSeconds,
    multiContentWeight: p.multi,
    targetTiles: p.tiles,
  });
  console.log(
    `  gen=${res.generated} eval=${res.evaluated} prune=${res.pruned} ${Date.now() - t0}ms`,
  );
  const top = res.top.slice(0, 8);
  for (let i = 0; i < top.length; i++) {
    const c = top[i]!;
    const apex = c.relicActive
      .filter((x) =>
        [
          "devout",
          "infernal-fire",
          "icyenic-faith",
          "naragi-edict",
          "perkfection",
          "divine-druid",
          "rejuvenated",
          "assassins-insight",
          "crystal-grace",
        ].includes(x),
      )
      .join("+");
    console.log(
      `  #${i + 1} ${Math.round(c.totalDps).toLocaleString().padStart(8)}  ${c.style.padEnd(11)} ${c.pathId.padEnd(22)} ${c.armour.padEnd(18)} inv=${c.invention.padEnd(8)} ${apex}`,
    );
  }
  const best = res.bestDps!;
  leaders.push({
    pack: p.name,
    dps: best.totalDps,
    style: best.style,
    path: best.pathId,
    armour: best.armour,
    inv: best.invention,
    fam: best.familiar,
    poison: best.poison,
    relics: best.relicActive
      .filter((x) =>
        ["devout", "infernal-fire", "icyenic-faith", "naragi-edict", "perkfection"].includes(
          x,
        ),
      )
      .join("+"),
    hours: best.hours,
    flags: best.flags,
  });
  allTop[p.name] = {
    best: best,
    top10: res.top.slice(0, 10),
    meta: {
      generated: res.generated,
      evaluated: res.evaluated,
      pruned: res.pruned,
      elapsedMs: res.elapsedMs,
    },
  };
}

// ── Hand synergy matrix (explicit) ──
console.log("\n═══ Synergy matrix (hand sims) ═══");
const stage = stageById("endgame")!;
const syn: {
  name: string;
  picks: Path[];
  style: string;
  armour: string;
  oh: string;
  relic: string;
  sec: string | null;
  inv: string;
  fam: string;
  fight: number;
  multi: number;
}[] = [
  {
    name: "Aegis+DW+Icyenic+Perk+Nihil",
    picks: ["Order", "Order", "Order", "Order", "Order", "Chaos"],
    style: "necromancy",
    armour: "deathwarden-tank",
    oh: "shield",
    relic: "perkfection",
    sec: "icyenic-faith",
    inv: "ancient",
    fam: "ice-nihil",
    fight: 60,
    multi: 0,
  },
  {
    name: "Aegis+DW+Infernal+Perk+Nihil",
    picks: ["Order", "Chaos", "Order", "Balance", "Chaos", "Chaos"],
    style: "necromancy",
    armour: "deathwarden-tank",
    oh: "shield",
    relic: "perkfection",
    sec: "infernal-fire",
    inv: "ancient",
    fam: "ice-nihil",
    fight: 60,
    multi: 0,
  },
  {
    name: "Aegis+Infernal short 30s",
    picks: ["Order", "Chaos", "Order", "Balance", "Chaos", "Chaos"],
    style: "necromancy",
    armour: "deathwarden-tank",
    oh: "shield",
    relic: "infernal-fire",
    sec: "devout",
    inv: "standard",
    fam: "steel-titan",
    fight: 30,
    multi: 0,
  },
  {
    name: "Full Zammy melee claws",
    picks: ["Chaos", "Chaos", "Chaos", "Chaos", "Chaos", "Chaos"],
    style: "melee",
    armour: "power-bis",
    oh: "none",
    relic: "perkfection",
    sec: "infernal-fire",
    inv: "standard",
    fam: "ripper-demon",
    fight: 60,
    multi: 0,
  },
  {
    name: "Aegis+melee+Icyenic",
    picks: ["Order", "Order", "Order", "Order", "Order", "Chaos"],
    style: "melee",
    armour: "mixed-aegis-power",
    oh: "shield",
    relic: "icyenic-faith",
    sec: "devout",
    inv: "standard",
    fam: "steel-titan",
    fight: 60,
    multi: 0,
  },
  {
    name: "Splash multi Order+SplashZone",
    picks: ["Order", "Order", "Order", "Balance", "Order", "Order"],
    style: "magic",
    armour: "tectonic-power",
    oh: "none",
    relic: "icyenic-faith",
    sec: "perkfection",
    inv: "standard",
    fam: "none",
    fight: 60,
    multi: 0.7,
  },
  {
    name: "Cryptbloom magic Aegis hybrid",
    picks: ["Order", "Chaos", "Order", "Balance", "Chaos", "Chaos"],
    style: "magic",
    armour: "cryptbloom-tank",
    oh: "shield",
    relic: "infernal-fire",
    sec: "devout",
    inv: "none",
    fam: "none",
    fight: 60,
    multi: 0,
  },
  {
    name: "Balance BigBoned tank",
    picks: ["Balance", "Balance", "Balance", "Balance", "Balance", "Balance"],
    style: "necromancy",
    armour: "deathwarden-tank",
    oh: "shield",
    relic: "icyenic-faith",
    sec: "devout",
    inv: "none",
    fam: "steel-titan",
    fight: 60,
    multi: 0,
  },
];

const synResults = [];
for (const s of syn) {
  const r = modelCombat({
    picks: s.picks as any,
    style: s.style as any,
    stage,
    archetype: s.oh === "shield" ? "shield-tank" : "power-dps",
    offhand: s.oh as any,
    armourProfile: s.armour as any,
    herbloreLevel: 110,
    targetTiles: s.multi > 0 ? 3 : 1,
    multiContentWeight: s.multi,
    powerburst: true,
    potionProfile: "elder-ovl",
    relic: s.relic as any,
    relicSecondary: s.sec as any,
    inventionTier: s.inv as any,
    familiar: s.fam as any,
    summoningLevel: 99,
    fightSeconds: s.fight,
    perkfection: s.relic === "perkfection" || s.sec === "perkfection",
    clawSpecDump: s.style === "melee",
    modelDots: true,
    modelSpecials: true,
    modelConjures: true,
  });
  const row = {
    name: s.name,
    dps: Math.round(r.totalDps ?? r.dps),
    ad: r.stats.effectiveAd,
    fight: s.fight,
  };
  synResults.push(row);
  console.log(
    `  ${String(row.dps).padStart(7)}  AD ${String(row.ad).padStart(5)}  ${s.name}`,
  );
}

// Value pass
console.log("\n═══ VALUE beam (60s ST) ═══");
const val = optimizeSuite({ mode: "value", beamWidth: 40, topRelics: 40, fightSeconds: 60 });
val.top.slice(0, 8).forEach((c, i) => {
  console.log(
    `  #${i + 1} val=${Math.round(c.value)}  dps=${Math.round(c.totalDps)}  ${c.hours.toFixed(0)}h  ${c.style} ${c.pathId} [${c.relicActive.filter((x) => ["devout", "infernal-fire", "icyenic-faith", "perkfection"].includes(x)).join("+")}]`,
  );
});

mkdirSync("artifacts", { recursive: true });
const out = {
  generated: new Date().toISOString(),
  wikiAdSanity: adSanity,
  packLeaders: leaders,
  synergyHand: synResults,
  packs: allTop,
  valueTop: val.top.slice(0, 12),
  notes: [
    "AD base from gear stages + wiki-inspired Aegis/Icyenic/relic layers; not full reimplementation of every style's AD formula.",
    "Synergies: Aegis+shield, Icyenic+prayer, Infernal+short fights, Perkfection+procs, Devout+fam, Zammy Rampage+claws, multi Splash.",
    "T7 mutually exclusive; Rejuvenated reclaim previous only.",
  ],
};
writeFileSync("artifacts/full-search.json", JSON.stringify(out, null, 2));
console.log("\nWrote artifacts/full-search.json");
console.log("\n═══ PACK LEADERS ═══");
for (const L of leaders) {
  console.log(
    `  ${L.pack.padEnd(14)} ${Math.round(L.dps).toLocaleString().padStart(8)}  ${L.style} / ${L.path} / ${L.armour} / ${L.relics || "—"} inv=${L.inv}`,
  );
}
