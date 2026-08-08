/**
 * Beam / trie optimizer over the full combat suite.
 *
 * Candidate generation:
 * 1. Materialize all legal relic loadouts (Wazzy tiers + Rejuvenated extras)
 * 2. Insert into trie for prefix filters
 * 3. Cartesian product of style × path × armour × region × inv × poison × fam
 *    with aggressive pruning + beam keep-top-K by upper bound
 *
 * Upper bound: baseline stage DPS × path mult × relic mult × inv mult × fam heuristic
 * before full modelCombat — drops hopeless branches fast.
 */

import type { Path } from "../blessings";
import { stageById, type Style } from "../gear";
import { modelCombat, type ModelInput } from "../model";
import type { ArmourProfileId } from "./armour";
import type { PoisonKitId } from "./poison";
import type { FamiliarId } from "./summoning";
import type { RelicId } from "./relics";
import type { RegionTag } from "./requirements";
import type { InventionTier } from "./invention";
import {
  enumerateRelicCombos,
  buildRelicTrie,
  topCombatRelicCombos,
  relicComboStats,
  type RelicCombo,
} from "./relic-trie";
import { hoursToPower } from "./league-hours";
import { RELIC_BY_ID } from "./relics";

export interface OptAxes {
  styles?: Style[];
  paths?: { id: string; picks: Path[] }[];
  armours?: ArmourProfileId[];
  regions?: { id: string; regions: RegionTag[]; electives: string[] }[];
  poisons?: PoisonKitId[];
  familiars?: FamiliarId[];
  invention?: InventionTier[];
  /** Max full modelCombat evals */
  beamWidth?: number;
  /** Prefilter top relic combos by heuristic (0 = all) */
  topRelics?: number;
  fightSeconds?: number;
  /** Score mode */
  mode?: "dps" | "value";
}

export interface OptCandidate {
  score: number;
  totalDps: number;
  hours: number;
  value: number;
  style: Style;
  pathId: string;
  armour: ArmourProfileId;
  regionId: string;
  poison: PoisonKitId;
  familiar: FamiliarId;
  invention: InventionTier;
  relicKey: string;
  relicActive: RelicId[];
  relicMult: number;
  devout: boolean;
  perkfection: boolean;
  flags: string[];
}

const DEFAULT_PATHS = [
  {
    id: "aegis-cinders-perf",
    picks: ["Order", "Chaos", "Order", "Balance", "Chaos", "Chaos"] as Path[],
  },
  {
    id: "aegis-light",
    picks: ["Order", "Order", "Order", "Order", "Order", "Order"] as Path[],
  },
  {
    id: "trueeq-genesis",
    picks: ["Order", "Chaos", "Balance", "Balance", "Order", "Order"] as Path[],
  },
  {
    id: "poison-env",
    picks: ["Balance", "Balance", "Order", "Balance", "Balance", "Balance"] as Path[],
  },
];

const DEFAULT_REGIONS = [
  {
    id: "starter",
    regions: ["free", "misthalin", "havenhythe", "karamja"] as RegionTag[],
    electives: [] as string[],
  },
  {
    id: "wazzy",
    regions: [
      "free",
      "misthalin",
      "havenhythe",
      "karamja",
      "forinthry",
      "desert",
      "anachronia",
    ] as RegionTag[],
    electives: ["forinthry", "desert", "anachronia"],
  },
  {
    id: "inv-asgarnia",
    regions: [
      "free",
      "misthalin",
      "havenhythe",
      "karamja",
      "asgarnia",
      "forinthry",
    ] as RegionTag[],
    electives: ["asgarnia", "forinthry"],
  },
  {
    id: "inv-ancient",
    regions: [
      "free",
      "misthalin",
      "havenhythe",
      "karamja",
      "asgarnia",
      "kandarin",
      "forinthry",
    ] as RegionTag[],
    electives: ["asgarnia", "kandarin", "forinthry"],
  },
  {
    id: "poison-max",
    regions: [
      "free",
      "misthalin",
      "havenhythe",
      "karamja",
      "forinthry",
      "tirannwn",
      "asgarnia",
    ] as RegionTag[],
    electives: ["forinthry", "tirannwn", "asgarnia"],
  },
];

function primarySecondary(combo: RelicCombo): {
  primary: RelicId;
  secondary: RelicId | null;
} {
  // Prefer highest playerDpsMult as primary for stackRelic; attach devout/druid as secondary
  const combat = combo.active
    .filter((id) => id !== "none")
    .map((id) => ({ id, mult: RELIC_BY_ID[id]?.playerDpsMult ?? 1 }))
    .sort((a, b) => b.mult - a.mult);
  const primary = combat[0]?.id ?? "none";
  const secondary =
    combo.active.find((id) => id !== primary && (id === "devout" || id === "divine-druid" || id === "perkfection")) ??
    combat[1]?.id ??
    null;
  return { primary, secondary: secondary === primary ? null : secondary };
}

function famOk(fam: FamiliarId, regions: RegionTag[]): boolean {
  if (fam === "none" || fam === "steel-titan") return true;
  if (fam === "ice-nihil" || fam === "ripper-demon" || fam === "blood-reaver") {
    return regions.includes("forinthry");
  }
  return true;
}

function poisonOk(p: PoisonKitId, regions: RegionTag[]): boolean {
  if (p === "none" || p === "wp-only") return true;
  return regions.includes("tirannwn");
}

function invOk(tier: InventionTier, regions: RegionTag[]): boolean {
  if (tier === "none") return true;
  if (tier === "standard") return regions.includes("asgarnia");
  return regions.includes("asgarnia") && regions.includes("kandarin");
}

/** Style-locked armour packages (Cryptbloom magic-only, Deathwarden/TFN necro-only, …) */
function armourOk(style: Style, armour: ArmourProfileId): boolean {
  if (armour === "cryptbloom-tank") return style === "magic";
  if (armour === "deathwarden-tank" || armour === "tfn-power") return style === "necromancy";
  if (armour === "sirenic-power") return style === "ranged";
  if (armour === "tectonic-power") return style === "magic";
  if (armour === "masterwork-tank") return style === "melee";
  return true;
}

/** Heuristic upper bound before full sim */
function upperBound(opts: {
  pathId: string;
  relicMult: number;
  devout: boolean;
  invention: InventionTier;
  familiar: FamiliarId;
  poison: PoisonKitId;
  armour: ArmourProfileId;
}): number {
  let u = 90_000; // rough base aegis kit
  if (opts.pathId.includes("aegis")) u *= 1.15;
  if (opts.pathId.includes("poison")) u *= 0.75;
  u *= opts.relicMult;
  if (opts.devout) u *= 1.08;
  if (opts.invention === "standard") u *= 1.12;
  if (opts.invention === "ancient") u *= 1.18;
  if (opts.familiar === "ice-nihil") u *= 1.12;
  if (opts.familiar === "ripper-demon") u *= 1.06;
  if (opts.poison.includes("cinder") || opts.poison === "full-melee-poison") u *= 1.03;
  if (opts.armour.includes("mixed") || opts.armour.includes("masterwork")) u *= 1.05;
  if (opts.armour === "cryptbloom-tank") u *= 1.04;
  return u;
}

export interface OptimizeResult {
  relicStats: ReturnType<typeof relicComboStats>;
  trieLeaves: number;
  generated: number;
  evaluated: number;
  pruned: number;
  top: OptCandidate[];
  bestDps: OptCandidate | null;
  bestValue: OptCandidate | null;
  elapsedMs: number;
}

export function optimizeSuite(axes: OptAxes = {}): OptimizeResult {
  const t0 = Date.now();
  const stage = stageById("endgame")!;
  const styles = axes.styles ?? ["necromancy", "melee", "magic", "ranged"];
  const paths = axes.paths ?? DEFAULT_PATHS;
  const armours =
    axes.armours ??
    ([
      "mixed-aegis-power",
      "cryptbloom-tank",
      "deathwarden-tank",
      "tfn-power",
      "masterwork-tank",
      "tank-aegis",
      "power-bis",
      "hybrid-cinder",
      "sirenic-power",
      "tectonic-power",
    ] as ArmourProfileId[]);
  const regions = axes.regions ?? DEFAULT_REGIONS;
  const poisons =
    axes.poisons ??
    (["none", "wp-only", "wp-cinder", "full-melee-poison"] as PoisonKitId[]);
  const familiars =
    axes.familiars ??
    (["none", "steel-titan", "ice-nihil", "ripper-demon"] as FamiliarId[]);
  const inventions =
    axes.invention ?? (["none", "standard", "ancient"] as InventionTier[]);
  const beamWidth = axes.beamWidth ?? 80;
  const topRelicsN = axes.topRelics ?? 48;
  const fightSeconds = axes.fightSeconds ?? 60;
  const mode = axes.mode ?? "dps";

  // 1) Relic universe via trie
  const allCombos = enumerateRelicCombos({ validOnly: true, combatOnly: false });
  const stats = relicComboStats(allCombos);
  const trie = buildRelicTrie(allCombos);
  const combatRelics = topCombatRelicCombos(allCombos, topRelicsN);

  // 2) Generate candidates with prune
  type Gen = {
    ub: number;
    style: Style;
    path: (typeof paths)[0];
    armour: ArmourProfileId;
    reg: (typeof regions)[0];
    poison: PoisonKitId;
    fam: FamiliarId;
    inv: InventionTier;
    combo: RelicCombo;
  };
  const pool: Gen[] = [];
  let generated = 0;
  let pruned = 0;

  for (const style of styles) {
    for (const path of paths) {
      for (const armour of armours) {
        if (!armourOk(style, armour)) {
          pruned++;
          continue;
        }
        for (const reg of regions) {
          for (const inv of inventions) {
            if (!invOk(inv, reg.regions)) {
              pruned++;
              continue;
            }
            for (const poison of poisons) {
              if (!poisonOk(poison, reg.regions)) {
                pruned++;
                continue;
              }
              for (const fam of familiars) {
                if (!famOk(fam, reg.regions)) {
                  pruned++;
                  continue;
                }
                for (const combo of combatRelics) {
                  generated++;
                  const ub = upperBound({
                    pathId: path.id,
                    relicMult: combo.mult,
                    devout: combo.devout,
                    invention: inv,
                    familiar: fam,
                    poison,
                    armour,
                  });
                  pool.push({
                    ub,
                    style,
                    path,
                    armour,
                    reg,
                    poison,
                    fam,
                    inv,
                    combo,
                  });
                }
              }
            }
          }
        }
      }
    }
  }

  // Beam: keep top by upper bound
  pool.sort((a, b) => b.ub - a.ub);
  // Evaluate more than beam then re-rank — 3× beam full evals
  const toEval = pool.slice(0, Math.min(pool.length, beamWidth * 6));

  const results: OptCandidate[] = [];
  for (const g of toEval) {
    const { primary, secondary } = primarySecondary(g.combo);
    const arch =
      g.armour.includes("tank") || g.armour === "mixed-aegis-power"
        ? "shield-tank"
        : g.armour === "hybrid-cinder"
          ? "defender"
          : "power-dps";
    const input: ModelInput = {
      picks: g.path.picks,
      style: g.style,
      stage,
      archetype: arch as any,
      offhand:
        arch === "shield-tank" ? "shield" : arch === "defender" ? "defender" : "none",
      herbloreLevel: 110,
      targetTiles: 1,
      multiContentWeight: 0,
      powerburst: true,
      potionProfile: "elder-ovl",
      armourProfile: g.armour,
      poisonKit: g.poison,
      familiar: g.fam,
      relic: primary,
      relicSecondary: secondary,
      perkfection: g.combo.perkfection,
      inventionTier: g.inv,
      summoningLevel: g.fam === "none" ? 1 : 99,
      baneRegions: g.reg.regions,
      fightSeconds,
      modelDots: true,
      modelSpecials: true,
      modelConjures: true,
    };
    // Apply full relic mult if stack undercounted (primary*secondary only)
    const r = modelCombat(input);
    let total = r.totalDps ?? r.dps;
    // Scale to full loadout mult if we only applied primary/secondary
    const applied =
      (RELIC_BY_ID[primary]?.playerDpsMult ?? 1) *
      (secondary ? RELIC_BY_ID[secondary]?.playerDpsMult ?? 1 : 1);
    if (g.combo.mult > applied + 0.001) {
      total = total * (g.combo.mult / applied);
    }

    const h = hoursToPower({
      style: g.style,
      regions: g.reg.regions,
      electives: g.reg.electives,
      armour: g.armour,
      poison: g.poison,
      familiar: g.fam,
      relicKey: g.combo.devout ? "devout+infernal" : "infernal-only",
      endgame: true,
    });
    // Invention pad already if asgarnia in regions
    const hours = h.totalHours;
    const value = total / Math.max(0.5, hours);
    const score = mode === "value" ? value : total;
    results.push({
      score,
      totalDps: total,
      hours,
      value,
      style: g.style,
      pathId: g.path.id,
      armour: g.armour,
      regionId: g.reg.id,
      poison: g.poison,
      familiar: g.fam,
      invention: g.inv,
      relicKey: g.combo.key.slice(0, 80),
      relicActive: g.combo.active,
      relicMult: g.combo.mult,
      devout: g.combo.devout,
      perkfection: g.combo.perkfection,
      flags: r.flags.slice(0, 6),
    });
  }

  results.sort((a, b) => b.score - a.score);
  const top = results.slice(0, beamWidth);
  const byDps = [...results].sort((a, b) => b.totalDps - a.totalDps);
  const byVal = [...results].sort((a, b) => b.value - a.value);

  return {
    relicStats: stats,
    trieLeaves: trie.leafCount,
    generated,
    evaluated: results.length,
    pruned,
    top,
    bestDps: byDps[0] ?? null,
    bestValue: byVal[0] ?? null,
    elapsedMs: Date.now() - t0,
  };
}
