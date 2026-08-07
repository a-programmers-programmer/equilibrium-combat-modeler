/**
 * Full multi-dimension combat sweep:
 * on-hit, poison, potions, DoTs, familiars, conjures, specs, ults, bane, relics.
 *
 * npx tsx scripts/sim-dimensions.ts
 */
import { writeFileSync, mkdirSync } from "fs";
import type { Path } from "../src/lib/eq/blessings.ts";
import { stageById, type Style } from "../src/lib/eq/gear.ts";
import { modelCombat, type ModelInput } from "../src/lib/eq/model.ts";
import { POTION_PROFILES } from "../src/lib/eq/sim/dimensions.ts";
import { WAZZY_COMBAT_ROUTES } from "../src/lib/eq/sim/wazzy-tiers.ts";
import { validateRelicLoadout, type RelicId } from "../src/lib/eq/sim/relics.ts";
import { pickBestFamiliar, type FamiliarId } from "../src/lib/eq/sim/summoning.ts";
import { Player } from "../src/lib/eq/sim/player.ts";
import type { RegionTag } from "../src/lib/eq/sim/requirements.ts";
import type { TargetTag } from "../src/lib/eq/sim/bane.ts";
import { gearFromRegions, gearFromPackage } from "../src/lib/eq/model.ts";
import { REGION_PACKAGES } from "../src/lib/eq/items.ts";

const stage = stageById("endgame")!;

/** Creative blessing packages targeting different dimensions */
const BLESSING_PACKS: { id: string; label: string; picks: Path[]; tags: string[] }[] = [
  {
    id: "aegis-crit-inferno",
    label: "Aegis + Cinders + Crit + Perfidious (on-hit/proc)",
    picks: ["Order", "Chaos", "Order", "Balance", "Chaos", "Chaos"],
    tags: ["on-hit", "proc", "crit"],
  },
  {
    id: "poison-dot-stack",
    label: "Big Boned + Barkscales + Thorns + Envenomed (poison/DoT/flat)",
    picks: ["Balance", "Balance", "Order", "Balance", "Balance", "Balance"],
    tags: ["poison", "dot", "flat"],
  },
  {
    id: "light-splash",
    label: "Aegis + Light + Splash + Lord of Light (AoE proc)",
    picks: ["Order", "Order", "Order", "Balance", "Order", "Chaos"],
    tags: ["light", "splash", "multi"],
  },
  {
    id: "true-eq-genesis",
    label: "True Eq + Genesis + Tempered (AD stack)",
    picks: ["Order", "Chaos", "Balance", "Balance", "Order", "Order"],
    tags: ["ad", "genesis"],
  },
  {
    id: "havoc-crit",
    label: "Havoc glass + Unholy + Perfidious",
    picks: ["Chaos", "Chaos", "Chaos", "Chaos", "Chaos", "Chaos"],
    tags: ["glass", "crit"],
  },
  {
    id: "wazzy-crit-melee",
    label: "Wazzy-style Aegis/Cinders/Steadfast/Fervor + TE + Crit + Perf",
    picks: ["Order", "Chaos", "Order", "Balance", "Chaos", "Chaos"],
    tags: ["wazzy", "meta"],
  },
];

function makePlayer(electives: RegionTag[], sum = 99): Player {
  const p = new Player({ electives, relicTier: 7 });
  p.setLevel("summoning", sum);
  for (const sk of ["attack", "strength", "defence", "magic", "ranged", "necromancy"] as const) {
    p.setLevel(sk, 99);
  }
  p.setFlag("league:contract-claws-auto");
  if (electives.includes("forinthry")) {
    p.setFlag("unlocked:ancient-summoning");
    p.setFlag("unlocked:binding-contracts");
    p.setFlag("unlocked:binding-ripper");
    p.setFlag("killed:nihil");
    p.setFlag("unlocked:nihil-pouches");
    p.setFlag("unlocked:dungeoneering-kalg");
  }
  return p;
}

function primarySecondary(active: RelicId[]): { primary: RelicId; secondary: RelicId | null } {
  const order: RelicId[] = [
    "devout",
    "infernal-fire",
    "icyenic-faith",
    "naragi-edict",
    "perkfection",
    "divine-druid",
  ];
  const picked = order.filter((id) => active.includes(id));
  return { primary: picked[0] ?? "none", secondary: picked[1] ?? null };
}

interface RunRow {
  name: string;
  style: Style;
  totalDps: number;
  playerDps: number;
  famDps: number;
  familiar: string;
  potion: string;
  dimensions: { id: string; dps: number; share: number }[];
  topDims: string;
  flags: string[];
  targetTags: string[];
  fightSeconds: number;
}

function run(input: ModelInput, name: string): RunRow {
  const r = modelCombat(input);
  const dims = (r.dimensions ?? []).map((d) => ({
    id: d.id,
    dps: d.dps,
    share: d.share,
  }));
  const top = [...dims]
    .sort((a, b) => b.dps - a.dps)
    .slice(0, 4)
    .map((d) => `${d.id} ${(d.share * 100).toFixed(0)}%`)
    .join(", ");
  return {
    name,
    style: input.style,
    totalDps: r.totalDps ?? r.dps,
    playerDps: r.dps,
    famDps: r.familiar?.dps ?? 0,
    familiar: r.familiar?.name ?? "none",
    potion: r.potions?.name ?? "?",
    dimensions: dims,
    topDims: top,
    flags: r.flags.slice(0, 12),
    targetTags: input.targetTags ?? ["general"],
    fightSeconds: input.fightSeconds ?? 60,
  };
}

console.log("╔══════════════════════════════════════════════════════════════╗");
console.log("║  MULTI-DIMENSION COMBAT SWEEP                                ║");
console.log("╚══════════════════════════════════════════════════════════════╝\n");

const electives: RegionTag[] = ["forinthry", "desert", "anachronia"];
const player = makePlayer(electives, 99);
const bestFam = pickBestFamiliar(player.snapshot(), {
  devout: true,
  divineDruid: true,
  accessMode: "soft",
});
console.log("Best familiar (Forinthry+Devout):", bestFam.name, bestFam.familiarId);

const rows: RunRow[] = [];
const styles: Style[] = ["melee", "necromancy", "magic", "ranged"];
const combatRoute = WAZZY_COMBAT_ROUTES.find((r) => r.id === "devout-infernal")!;
const v = validateRelicLoadout({
  byTier: combatRoute.byTier,
  rejuvenatedExtra: combatRoute.rejuvenatedExtra,
});
const { primary, secondary } = primarySecondary(v.active);

// 1) Blessing packs × styles × potions
for (const pack of BLESSING_PACKS) {
  for (const style of styles) {
    for (const pot of ["none", "overload", "elder-ovl", "poison-stack"] as const) {
      const arch = style === "melee" ? "shield-tank" : "power-dps";
      let gear;
      try {
        gear = gearFromRegions(electives as any, style, arch);
      } catch {
        gear = { snapshot: undefined as any, offhand: "none" as const };
      }
      rows.push(
        run(
          {
            picks: pack.picks,
            style,
            stage,
            archetype: arch,
            offhand: gear.offhand,
            gear: gear.snapshot,
            herbloreLevel: pot === "none" ? 50 : 110,
            targetTiles: pack.tags.includes("multi") ? 9 : 1,
            multiContentWeight: pack.tags.includes("multi") ? 0.7 : 0,
            powerburst: pot !== "none",
            potionProfile: pot,
            familiar: bestFam.familiarId as FamiliarId,
            relic: primary,
            relicSecondary: secondary,
            summoningLevel: 99,
            summoningPlayer: player.snapshot(),
            familiarAccess: "soft",
            baneRegions: ["free", "misthalin", "havenhythe", "karamja", ...electives],
            fightSeconds: 60,
            modelDots: true,
            modelSpecials: true,
            modelConjures: true,
          },
          `${pack.id}|${style}|${pot}`,
        ),
      );
    }
  }
}

// 2) Fight length curve (ult duty)
for (const fight of [15, 30, 60, 120, 300]) {
  rows.push(
    run(
      {
        picks: BLESSING_PACKS[0]!.picks,
        style: "melee",
        stage,
        archetype: "shield-tank",
        herbloreLevel: 110,
        targetTiles: 1,
        multiContentWeight: 0,
        powerburst: true,
        potionProfile: "elder-ovl",
        familiar: "ripper-demon",
        relic: "devout",
        relicSecondary: "infernal-fire",
        summoningLevel: 99,
        summoningPlayer: player.snapshot(),
        familiarAccess: "soft",
        baneRegions: ["free", "misthalin", "havenhythe", "karamja", ...electives],
        fightSeconds: fight,
      },
      `fight-length|melee|${fight}s`,
    ),
  );
}

// 3) Target tags / bane
for (const tags of [
  ["general"],
  ["dragon"],
  ["dragon", "melee-class"],
  ["demon"],
  ["mage-class"],
] as TargetTag[][]) {
  rows.push(
    run(
      {
        picks: BLESSING_PACKS[0]!.picks,
        style: "ranged",
        stage,
        archetype: "power-dps",
        herbloreLevel: 110,
        targetTiles: 1,
        multiContentWeight: 0,
        powerburst: true,
        potionProfile: "elder-ovl",
        familiar: "ripper-demon",
        relic: "devout",
        relicSecondary: "infernal-fire",
        summoningLevel: 99,
        summoningPlayer: player.snapshot(),
        familiarAccess: "soft",
        baneRegions: ["free", "misthalin", "havenhythe", "karamja", "forinthry", "fremennik", "anachronia"],
        targetTags: tags,
        fightSeconds: 60,
      },
      `bane|ranged|${tags.join("+")}`,
    ),
  );
}

// 4) Familiar ladder
for (const fam of [
  "none",
  "steel-titan",
  "kalgerion-demon",
  "ripper-demon",
  "ice-nihil",
] as FamiliarId[]) {
  const p =
    fam === "steel-titan" || fam === "none"
      ? makePlayer([], 99)
      : player;
  rows.push(
    run(
      {
        picks: BLESSING_PACKS[5]!.picks,
        style: "melee",
        stage,
        archetype: "shield-tank",
        herbloreLevel: 110,
        targetTiles: 1,
        multiContentWeight: 0,
        powerburst: true,
        potionProfile: "elder-ovl",
        familiar: fam,
        relic: fam === "none" ? "infernal-fire" : "devout",
        relicSecondary: fam === "none" ? null : "infernal-fire",
        summoningLevel: 99,
        summoningPlayer: p.snapshot(),
        familiarAccess: "soft",
        baneRegions:
          fam === "steel-titan" || fam === "none"
            ? ["free", "misthalin", "havenhythe", "karamja"]
            : ["free", "misthalin", "havenhythe", "karamja", ...electives],
        fightSeconds: 60,
      },
      `familiar|${fam}`,
    ),
  );
}

// Rank
const ranked = [...rows].sort((a, b) => b.totalDps - a.totalDps);
console.log("\n=== TOP 20 TOTAL (all dimensions) ===");
ranked.slice(0, 20).forEach((r, i) => {
  console.log(
    `#${String(i + 1).padStart(2)} ${Math.round(r.totalDps).toLocaleString().padStart(8)} ${r.name.slice(0, 55).padEnd(55)} fam=${Math.round(r.famDps)}`,
  );
  console.log(`     dims: ${r.topDims}`);
});

// Dimension contribution averages on top 30
const top30 = ranked.slice(0, 30);
const dimAgg: Record<string, number[]> = {};
for (const r of top30) {
  for (const d of r.dimensions) {
    (dimAgg[d.id] ??= []).push(d.share);
  }
}
console.log("\n=== AVG DIMENSION SHARE (top 30 builds) ===");
Object.entries(dimAgg)
  .map(([id, arr]) => ({
    id,
    avg: arr.reduce((a, b) => a + b, 0) / arr.length,
  }))
  .sort((a, b) => b.avg - a.avg)
  .forEach((x) => console.log(`  ${x.id.padEnd(16)} ${(x.avg * 100).toFixed(1)}%`));

// Poison-focused ranking
console.log("\n=== POISON-STACK builds ===");
ranked
  .filter((r) => r.name.includes("poison"))
  .slice(0, 8)
  .forEach((r) => {
    const pois = r.dimensions.find((d) => d.id === "poison");
    console.log(
      `  ${Math.round(r.totalDps).toLocaleString().padStart(8)} ${r.name.slice(0, 50)} poison=${Math.round(pois?.dps ?? 0)} (${((pois?.share ?? 0) * 100).toFixed(1)}%)`,
    );
  });

// Fam ladder
console.log("\n=== FAMILIAR LADDER ===");
ranked
  .filter((r) => r.name.startsWith("familiar|"))
  .sort((a, b) => b.totalDps - a.totalDps)
  .forEach((r) =>
    console.log(
      `  ${r.name.padEnd(28)} total ${Math.round(r.totalDps).toLocaleString().padStart(7)}  fam ${Math.round(r.famDps).toString().padStart(5)}  ${r.familiar}`,
    ),
  );

// Fight length
console.log("\n=== FIGHT LENGTH (ult duty) ===");
ranked
  .filter((r) => r.name.startsWith("fight-length"))
  .sort((a, b) => a.fightSeconds - b.fightSeconds)
  .forEach((r) => {
    const u = r.dimensions.find((d) => d.id === "ultDuty");
    console.log(
      `  ${String(r.fightSeconds).padStart(4)}s  total ${Math.round(r.totalDps).toLocaleString().padStart(7)}  ultShare ${((u?.share ?? 0) * 100).toFixed(1)}%`,
    );
  });

// SVG stacked dimension breakdown for winner
const winner = ranked[0]!;
const W = 900;
const H = 420;
const dims = [...winner.dimensions].filter((d) => d.dps > 0).sort((a, b) => b.dps - a.dps);
const colors = [
  "#38bdf8",
  "#f472b6",
  "#fbbf24",
  "#4ade80",
  "#a78bfa",
  "#fb923c",
  "#2dd4bf",
  "#e879f9",
  "#94a3b8",
  "#f87171",
  "#a3e635",
  "#c084fc",
  "#67e8f9",
  "#fdba74",
  "#86efac",
];
let svg = `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="100%" height="100%" fill="#0f172a"/>
<text x="${W / 2}" y="28" text-anchor="middle" fill="#e2e8f0" font-size="16" font-weight="600" font-family="system-ui,sans-serif">Damage dimensions — ${winner.name.slice(0, 48)}</text>
<text x="${W / 2}" y="48" text-anchor="middle" fill="#64748b" font-size="11" font-family="system-ui,sans-serif">Total ${Math.round(winner.totalDps).toLocaleString()} DPS · ${winner.potion} · ${winner.familiar}</text>`;
const maxD = dims[0]?.dps ?? 1;
dims.forEach((d, i) => {
  const y = 70 + i * 22;
  const w = (d.dps / maxD) * 520;
  svg += `<text x="12" y="${y + 12}" fill="#94a3b8" font-size="11" font-family="system-ui,sans-serif">${d.id}</text>
  <rect x="140" y="${y}" width="${w}" height="16" rx="3" fill="${colors[i % colors.length]}"/>
  <text x="${150 + w}" y="${y + 12}" fill="#e2e8f0" font-size="10" font-family="system-ui,sans-serif">${Math.round(d.dps).toLocaleString()} (${(d.share * 100).toFixed(1)}%)</text>`;
});
svg += `</svg>`;

// Average share pie-like horizontal for top30
let avgSvg = `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="900" height="380" viewBox="0 0 900 380">
<rect width="100%" height="100%" fill="#0f172a"/>
<text x="450" y="28" text-anchor="middle" fill="#e2e8f0" font-size="15" font-weight="600" font-family="system-ui,sans-serif">Avg dimension share — top 30 builds</text>`;
const avgs = Object.entries(dimAgg)
  .map(([id, arr]) => ({
    id,
    avg: arr.reduce((a, b) => a + b, 0) / arr.length,
  }))
  .sort((a, b) => b.avg - a.avg);
avgs.forEach((x, i) => {
  const y = 50 + i * 20;
  const w = x.avg * 600;
  avgSvg += `<text x="12" y="${y + 12}" fill="#94a3b8" font-size="11" font-family="system-ui,sans-serif">${x.id}</text>
  <rect x="140" y="${y}" width="${Math.max(2, w)}" height="14" rx="2" fill="${colors[i % colors.length]}"/>
  <text x="${150 + w}" y="${y + 11}" fill="#e2e8f0" font-size="10">${(x.avg * 100).toFixed(1)}%</text>`;
});
avgSvg += `</svg>`;

// Potion comparison SVG
const potRows = ranked.filter(
  (r) => r.name.startsWith("aegis-crit-inferno|melee|") && !r.name.includes("poison-dot"),
);
let potSvg = `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="720" height="260" viewBox="0 0 720 260">
<rect width="100%" height="100%" fill="#0f172a"/>
<text x="360" y="28" text-anchor="middle" fill="#e2e8f0" font-size="15" font-family="system-ui,sans-serif">Potion ladder — Aegis/Cinders melee + Devout/Infernal</text>`;
const maxPot = Math.max(...potRows.map((r) => r.totalDps), 1);
potRows
  .sort((a, b) => a.totalDps - b.totalDps)
  .forEach((r, i) => {
    const y = 50 + i * 40;
    const w = (r.totalDps / maxPot) * 480;
    const pot = r.name.split("|")[2] ?? r.potion;
    potSvg += `<text x="12" y="${y + 16}" fill="#94a3b8" font-size="12">${pot}</text>
    <rect x="120" y="${y}" width="${w}" height="24" rx="4" fill="#38bdf8"/>
    <text x="${130 + w}" y="${y + 16}" fill="#e2e8f0" font-size="11">${Math.round(r.totalDps).toLocaleString()}</text>`;
  });
potSvg += `</svg>`;

mkdirSync("artifacts", { recursive: true });
mkdirSync("public", { recursive: true });
writeFileSync("artifacts/dimensions-winner.svg", svg);
writeFileSync("artifacts/dimensions-avg-share.svg", avgSvg);
writeFileSync("artifacts/dimensions-potions.svg", potSvg);
writeFileSync("public/dimensions-winner.svg", svg);
writeFileSync("public/dimensions-avg-share.svg", avgSvg);
writeFileSync("public/dimensions-potions.svg", potSvg);

const report = {
  generated: new Date().toISOString(),
  totalRuns: rows.length,
  winner,
  top20: ranked.slice(0, 20),
  avgDimShare: avgs,
  potionProfiles: POTION_PROFILES.map((p) => p.id),
  conclusions: {
    dimensionsModeled: 15,
    poison: "Weapon poison tiers + Envenomed (+50%+2%/Herb) + Grasp poison",
    onHit: "Abyssal Cinders +15% AD + Inferno procs (Perfidious ×5)",
    potions: "OVL AD mult, adren density, powerburst LP, weapon poison tier",
    familiars: "Additive DPS; Devout scales; region-gated",
    ults: "Duty cycle by fight length; Higher Power removes",
    dots: "Style bleeds × Tearing Thorns duration",
    conjures: "Necro-only EV",
  },
};
writeFileSync("artifacts/dimensions-sim.json", JSON.stringify(report, null, 2));

const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Multi-dimension DPS</title>
<style>body{background:#0f172a;color:#e2e8f0;font-family:system-ui;padding:24px}
h1{font-size:1.25rem} object{max-width:100%;border:1px solid #334155;border-radius:8px;margin:12px 0}
.card{background:#1e293b;padding:16px;border-radius:12px;margin:16px 0;max-width:960px}
</style></head><body>
<h1>All damage dimensions</h1>
<p>On-hit · proc bursts · flat · poison · DoTs · potions · familiars · conjures · specials · prayer · bane · relics · splash · ults</p>
<div class="card"><h2>Winner breakdown</h2><object data="/dimensions-winner.svg" type="image/svg+xml"></object></div>
<div class="card"><h2>Average share (top 30)</h2><object data="/dimensions-avg-share.svg" type="image/svg+xml"></object></div>
<div class="card"><h2>Potion ladder</h2><object data="/dimensions-potions.svg" type="image/svg+xml"></object></div>
<pre>${JSON.stringify({ winner: winner.name, total: Math.round(winner.totalDps), topDims: winner.topDims }, null, 2)}</pre>
</body></html>`;
writeFileSync("public/dimensions.html", html);

console.log(`\n${rows.length} runs · wrote artifacts/dimensions-*.svg + dimensions-sim.json`);
