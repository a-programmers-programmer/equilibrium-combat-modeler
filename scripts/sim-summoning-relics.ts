/**
 * Hella sims: familiars × scrolls × relics × styles × paths × packages × targets.
 * Usage: npx tsx scripts/sim-summoning-relics.ts
 */
import { writeFileSync, mkdirSync } from "fs";
import type { Path } from "../src/lib/eq/blessings.ts";
import { PATHS, activeBlessings } from "../src/lib/eq/blessings.ts";
import { stageById, type Style } from "../src/lib/eq/gear.ts";
import { modelCombat, gearFromPackage, gearFromRegions } from "../src/lib/eq/model.ts";
import { REGION_PACKAGES } from "../src/lib/eq/items.ts";
import {
  COMBAT_FAMILIARS,
  modelFamiliarDps,
  type FamiliarId,
} from "../src/lib/eq/sim/summoning.ts";
import {
  combatRelicCombos,
  stackRelicPlayerMult,
  COMBAT_RELIC_PICKS,
  type RelicId,
} from "../src/lib/eq/sim/relics.ts";
import type { TargetTag } from "../src/lib/eq/sim/bane.ts";

const stage = stageById("endgame");

const SAMPLE_PATHS: { code: string; picks: Path[] }[] = [
  { code: "OCOBOC", picks: ["Order", "Chaos", "Order", "Balance", "Order", "Chaos"] },
  { code: "OCOBCC", picks: ["Order", "Chaos", "Order", "Balance", "Chaos", "Chaos"] },
  { code: "OOCOBO", picks: ["Order", "Order", "Chaos", "Order", "Balance", "Order"] },
  { code: "BOCBOO", picks: ["Balance", "Order", "Chaos", "Balance", "Order", "Order"] },
];

const FAM_IDS = COMBAT_FAMILIARS.filter((f) => f.combat || f.id === "none").map((f) => f.id);

const PACKAGES = [
  "free-only",
  "desert-asgarnia-forinthry",
  "mory-asgarnia-forinthry",
  "forinthry-asgarnia-anach",
];

function pathCode(p: Path[]) {
  return p.map((x) => x[0]).join("");
}

function ultMult(style: Style, hasHP: boolean, windowSec: number): number {
  if (hasHP) return 1;
  const peak: Record<Style, number> = {
    melee: 1.72,
    magic: 1.55,
    ranged: 1.52,
    necromancy: 1.42,
  };
  const p = peak[style];
  if (windowSec <= 30) return p;
  if (windowSec <= 120) return 1 + (p - 1) * 0.48;
  return 1 + (p - 1) * 0.25;
}

interface Row {
  style: string;
  path: string;
  packageId: string;
  relic: string;
  familiar: string;
  target: string;
  playerDps: number;
  famDps: number;
  totalDps: number;
  dmg30: number;
  dmg120: number;
  devout: boolean;
  baneMult: number;
  pieces: string;
}

const rows: Row[] = [];
const t0 = Date.now();

console.log("╔══════════════════════════════════════════════════════════════╗");
console.log("║  SUMMONING + RELIC MEGA SIM                                  ║");
console.log("╚══════════════════════════════════════════════════════════════╝\n");

// ── Familiar-only table (Devout on/off) ──
console.log("=== FAMILIAR DPS @ 99 Summoning ===");
for (const f of COMBAT_FAMILIARS.filter((x) => x.combat)) {
  const off = modelFamiliarDps(f, { summoningLevel: 99, devout: false, divineDruid: false });
  const on = modelFamiliarDps(f, { summoningLevel: 99, devout: true, divineDruid: false });
  const druid = modelFamiliarDps(f, { summoningLevel: 99, devout: false, divineDruid: true });
  console.log(
    `${f.name.padEnd(40)} base ${String(Math.round(off.familiarDps)).padStart(5)}  druid ${String(Math.round(druid.familiarDps)).padStart(5)}  DEVOUT ${String(Math.round(on.familiarDps)).padStart(6)}  (×${(on.familiarDps / Math.max(1, off.familiarDps)).toFixed(2)})`,
  );
}

// ── Dense matrix ──
const targets: { id: string; tags: TargetTag[] }[] = [
  { id: "general", tags: ["general"] },
  { id: "dragon", tags: ["dragon"] },
];

const combos = combatRelicCombos(true);
console.log(`\nRelic combos: ${combos.length}, familiars: ${FAM_IDS.length}, paths: ${SAMPLE_PATHS.length}`);

let n = 0;
for (const style of ["necromancy", "melee", "magic", "ranged"] as Style[]) {
  for (const pkgId of PACKAGES) {
    const pkg = REGION_PACKAGES.find((p) => p.id === pkgId);
    if (!pkg) continue;
    for (const target of targets) {
      const arch = style === "melee" ? "shield-tank" : "power-dps";
      const { snapshot, offhand } = gearFromPackage(pkg, style, arch, target.tags);
      for (const path of SAMPLE_PATHS) {
        for (const combo of combos) {
          for (const fam of FAM_IDS) {
            // skip non-forinthry packages for ripper when package has no forinthry — still model with warning
            const r = modelCombat({
              picks: path.picks,
              style,
              stage,
              archetype: arch,
              offhand,
              herbloreLevel: 110,
              targetTiles: 1,
              multiContentWeight: 0,
              powerburst: false,
              gear: snapshot,
              targetTags: target.tags,
              familiar: fam as FamiliarId,
              relic: combo.primary,
              relicSecondary: combo.secondary,
              summoningLevel: 99,
            });
            const hasHP = activeBlessings(path.picks).some((b) => b.id === "higher-power");
            const um30 = ultMult(style, hasHP, 30);
            const um120 = ultMult(style, hasHP, 120);
            rows.push({
              style,
              path: path.code,
              packageId: pkgId,
              relic: combo.label,
              familiar: fam,
              target: target.id,
              playerDps: r.dps,
              famDps: r.familiar?.dps ?? 0,
              totalDps: r.totalDps,
              dmg30: r.totalDps * 30 * um30,
              dmg120: r.totalDps * 120 * um120,
              devout: r.relics?.devout ?? false,
              baneMult: r.bane?.mult ?? 1,
              pieces: snapshot.pieces?.map((p) => p.name).slice(0, 3).join(" | ") ?? "",
            });
            n++;
          }
        }
      }
    }
  }
}

console.log(`Simulated ${n} configs in ${((Date.now() - t0) / 1000).toFixed(2)}s`);

function top(filter: (r: Row) => boolean, title: string, n = 12, key: "dmg30" | "dmg120" | "totalDps" = "dmg30") {
  const list = rows.filter(filter).sort((a, b) => b[key] - a[key]);
  console.log(`\n=== ${title} (by ${key}) ===`);
  for (const [i, r] of list.slice(0, n).entries()) {
    console.log(
      `#${String(i + 1).padStart(2)} ${Math.round(r[key]).toLocaleString().padStart(11)}  ${r.style.padEnd(11)} ${r.path}  ${r.relic.padEnd(32)} ${r.familiar.padEnd(22)} ${r.packageId.padEnd(26)} fam=${Math.round(r.famDps)}`,
    );
  }
  return list[0];
}

top((r) => r.target === "general", "GLOBAL BEST 30s TOTAL (general)", 15, "dmg30");
top((r) => r.target === "general", "GLOBAL BEST 2m TOTAL", 10, "dmg120");
top((r) => r.target === "dragon", "BEST vs DRAGON 30s", 10, "dmg30");

for (const style of ["necromancy", "melee", "magic", "ranged"]) {
  top((r) => r.style === style && r.target === "general", `${style.toUpperCase()} best 30s`, 6, "dmg30");
}

// Devout value: best familiar with vs without Devout (same path/style/pkg)
console.log("\n=== DEVOUT VALUE (necro free OCOBOC, ripper) ===");
const base = rows.find(
  (r) =>
    r.style === "necromancy" &&
    r.path === "OCOBOC" &&
    r.packageId === "free-only" &&
    r.familiar === "ripper-demon" &&
    r.relic === "none" &&
    r.target === "general",
)!;
const withDev = rows.find(
  (r) =>
    r.style === "necromancy" &&
    r.path === "OCOBOC" &&
    r.packageId === "free-only" &&
    r.familiar === "ripper-demon" &&
    r.relic === "devout" &&
    r.target === "general",
)!;
console.log(
  `none: total ${Math.round(base.totalDps)} (fam ${Math.round(base.famDps)})  vs  devout: total ${Math.round(withDev.totalDps)} (fam ${Math.round(withDev.famDps)})  Δfam +${Math.round(withDev.famDps - base.famDps)}  total +${(((withDev.totalDps / base.totalDps) - 1) * 100).toFixed(1)}%`,
);

// Relic ranking (best familiar each)
console.log("\n=== RELIC RANKING (necro, desert-asg-for, best fam each combo) ===");
const relicRank = new Map<string, Row>();
for (const r of rows.filter(
  (x) => x.style === "necromancy" && x.packageId === "desert-asgarnia-forinthry" && x.target === "general" && x.path === "OCOBOC",
)) {
  const prev = relicRank.get(r.relic);
  if (!prev || r.totalDps > prev.totalDps) relicRank.set(r.relic, r);
}
[...relicRank.values()]
  .sort((a, b) => b.totalDps - a.totalDps)
  .forEach((r, i) => {
    console.log(
      `#${i + 1} ${r.relic.padEnd(36)} total ${Math.round(r.totalDps).toLocaleString().padStart(8)}  fam ${Math.round(r.famDps).toLocaleString().padStart(6)}  ${r.familiar}`,
    );
  });

// Familiar ranking with Devout
console.log("\n=== FAMILIAR RANKING (Devout, necro free OCOBOC) ===");
for (const r of rows
  .filter(
    (x) =>
      x.style === "necromancy" &&
      x.packageId === "free-only" &&
      x.relic === "devout" &&
      x.path === "OCOBOC" &&
      x.target === "general",
  )
  .sort((a, b) => b.totalDps - a.totalDps)) {
  console.log(
    `${r.familiar.padEnd(22)} total ${Math.round(r.totalDps).toLocaleString().padStart(8)}  fam ${Math.round(r.famDps).toLocaleString().padStart(6)}  player ${Math.round(r.playerDps).toLocaleString().padStart(8)}`,
  );
}

// 729 path sweep: best overall total with Devout+ripper+necro
console.log("\n=== 729 PATH SWEEP: necro + Devout + ripper + free gear, 2m total ===");
const { snapshot, offhand } = gearFromPackage(
  REGION_PACKAGES.find((p) => p.id === "free-only")!,
  "necromancy",
  "power-dps",
);
let best729: { code: string; total: number; player: number; fam: number; hasHP: boolean } | null = null;
let c729 = 0;
for (const a of PATHS)
  for (const b of PATHS)
    for (const c of PATHS)
      for (const d of PATHS)
        for (const e of PATHS)
          for (const f of PATHS) {
            const picks = [a, b, c, d, e, f] as Path[];
            const hasHP = activeBlessings(picks).some((x) => x.id === "higher-power");
            const r = modelCombat({
              picks,
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
            });
            const total = r.totalDps * 120 * ultMult("necromancy", hasHP, 120);
            c729++;
            if (!best729 || total > best729.total) {
              best729 = {
                code: pathCode(picks),
                total,
                player: r.dps,
                fam: r.familiar?.dps ?? 0,
                hasHP,
              };
            }
          }
console.log(
  `Best of ${c729}: ${best729!.code} → 2m total ${Math.round(best729!.total).toLocaleString()} (player ${Math.round(best729!.player)} + fam ${Math.round(best729!.fam)}) HP=${best729!.hasHP}`,
);

// Double-dip Devout+Infernal
console.log("\n=== REJUV DOUBLE-DIP: Devout+Infernal vs singles (melee BiS pkg) ===");
for (const label of ["devout", "infernal-fire", "devout+infernal-fire(rejuv)", "none"]) {
  const r = rows
    .filter(
      (x) =>
        x.style === "melee" &&
        x.packageId === "desert-asgarnia-forinthry" &&
        x.relic === label &&
        x.familiar === "ripper-demon" &&
        x.target === "general",
    )
    .sort((a, b) => b.dmg30 - a.dmg30)[0];
  if (r)
    console.log(
      `${label.padEnd(36)} 30s ${Math.round(r.dmg30).toLocaleString()}  totalDps ${Math.round(r.totalDps)}  fam ${Math.round(r.famDps)}`,
    );
}

mkdirSync("artifacts", { recursive: true });
const report = {
  generated: new Date().toISOString(),
  configs: n,
  familiarTable: COMBAT_FAMILIARS.filter((f) => f.combat).map((f) => ({
    id: f.id,
    name: f.name,
    noDevout: Math.round(modelFamiliarDps(f, { summoningLevel: 99, devout: false, divineDruid: false }).familiarDps),
    withDruid: Math.round(modelFamiliarDps(f, { summoningLevel: 99, devout: false, divineDruid: true }).familiarDps),
    withDevout: Math.round(modelFamiliarDps(f, { summoningLevel: 99, devout: true, divineDruid: false }).familiarDps),
  })),
  winners: {
    best30: rows.sort((a, b) => b.dmg30 - a.dmg30)[0],
    best120: rows.sort((a, b) => b.dmg120 - a.dmg120)[0],
    best729,
  },
  top30: rows.sort((a, b) => b.dmg30 - a.dmg30).slice(0, 25),
  conclusion: {
    devout:
      "Devout multiplies combat familiar DPS up to ×6 at 99 Summoning + free scrolls. Largest single additive DPS lever in the league model.",
    bestFamiliar: "Ripper demon binding contract (Ancient Summoning — free Contract Claws auto).",
    bestCombo: "Devout + Infernal Fire (Rejuvenated) + Ripper + Aegis path OCOBOC",
    note: "Familiar damage is additive and NOT Big-Boned (official). Player ability DPS still uses blessing model.",
  },
};
writeFileSync("artifacts/summoning-relic-sim.json", JSON.stringify(report, null, 2));
console.log("\nWrote artifacts/summoning-relic-sim.json");
console.log(`Total time ${((Date.now() - t0) / 1000).toFixed(1)}s`);
