/**
 * Full acquisition ledger — hardened expected-hours model.
 *
 * Hardened vs v1:
 * - Equilibrium rare mult by league tier (2×→8× wiki passives)
 * - Learn-tax on boss kph (slow first kills)
 * - Relic ladder per-tier hours (not flat 6–10)
 * - Blessing track step hours
 * - Wiki drop sources: Rasial, Croesus, Kerapac/FSOA, KK drygores,
 *   Cinderbane, Solak alt, jewellery pads
 * - Sensitivity: wall hours at rare mult 1/2/4/6/8
 * - p50 / mean / p90 with geometric + collector tails
 * - Parallel skill credit from combat drops
 */

import type { SkillId } from "../xp";
import { chartSkillLeaguePhased } from "./league-hours";
import type { Style } from "../gear";
import type { ArmourProfileId } from "./armour";
import type { PoisonKitId } from "./poison";
import type { FamiliarId } from "./summoning";
import type { InventionTier } from "./invention";
import type { RegionTag } from "./requirements";
import {
  rareMultAtTier,
  relicLadderHours,
  blessingTrackHours,
  learnTaxHours,
  RARE_MULT_SCENARIOS,
  LEAGUE_TIER_PASSIVES,
  RELIC_TIER_UNLOCKS,
  BLESSING_AEGIS_TRACK,
} from "./league-passives";
import { costRequirement, type CostContext } from "./req-hours";
import { AllReq, SkillReq, RegionReq, FlagReq } from "./requirements";

// ── Math ────────────────────────────────────────────────────────────

export function expectedKills(rateDenom: number): number {
  return rateDenom;
}

export function geometricQuantile(rateDenom: number, p: number): number {
  const pr = 1 / rateDenom;
  if (pr >= 1) return 1;
  return Math.ceil(Math.log(1 - p) / Math.log(1 - pr));
}

export function couponCollectorKills(
  uniqueRateDenom: number,
  distinctItems: number,
): number {
  let H = 0;
  for (let i = 1; i <= distinctItems; i++) H += 1 / i;
  return uniqueRateDenom * H;
}

/** Coupon collector p90 approx via 1.4–1.6× mean for n≥2 */
export function couponCollectorP90(
  uniqueRateDenom: number,
  distinctItems: number,
): number {
  return couponCollectorKills(uniqueRateDenom, distinctItems) * (1.35 + 0.05 * Math.min(distinctItems, 6));
}

export function hoursFromKills(kills: number, killsPerHour: number): number {
  return kills / Math.max(0.1, killsPerHour);
}

// ── Drop sources ────────────────────────────────────────────────────

export interface DropSource {
  id: string;
  name: string;
  /** Base 1/N before league rare mult */
  rateDenom: number;
  /** Peak kph for above-avg player */
  killsPerHour: number;
  regions: RegionTag[];
  notes: string;
  /** Learn-tax: first N kills slower */
  learnKills?: number;
  slowFactor?: number;
  /** If true, rare mult applies (boss uniques). False for some craft. */
  rareMultApplies?: boolean;
}

export const DROP_SOURCES: Record<string, DropSource> = {
  rasial: {
    id: "rasial",
    name: "Rasial, the First Necromancer",
    rateDenom: 640,
    killsPerHour: 24,
    regions: ["free", "misthalin"],
    notes: "Wiki Omni/TFN ~1/640; luck ~1/632. Shared unique table.",
    learnKills: 30,
    slowFactor: 0.5,
    rareMultApplies: true,
  },
  croesus: {
    id: "croesus",
    name: "Croesus",
    rateDenom: 600,
    killsPerHour: 9,
    regions: ["free", "misthalin"],
    notes: "Unique 1/5400@60 → ~1/450@420+ contrib. Model 1/600 solid contrib.",
    learnKills: 15,
    slowFactor: 0.6,
    rareMultApplies: true,
  },
  kerapac: {
    id: "kerapac",
    name: "Kerapac (bound) — FSOA pieces",
    // Wiki HM: ~1/400 per pile, 3 piles → ~1/133 per kill for a piece
    // Need 3 pieces for staff → coupon on piece table
    rateDenom: 133,
    killsPerHour: 12,
    regions: ["anachronia"],
    notes: "Wiki ~1/400/pile ×3 piles ≈ 1/133/kill per piece; 3 pieces for FSOA.",
    learnKills: 20,
    slowFactor: 0.45,
    rareMultApplies: true,
  },
  kalphiteKing: {
    id: "kalphite-king",
    name: "Kalphite King — Drygores",
    // Any drygore pair path: ~1/128 per type pair; any drygore ~3/128 ≈ 1/43 any
    // For MH+OH same style: treat as 2 items on ~1/252 each or any-pair 1/43 then style
    rateDenom: 84, // ~ dual drygore set EV (wiki ~1/43 any drygore; refine to pair)
    killsPerHour: 20,
    regions: ["desert"],
    notes: "Wiki ~1/252 per drygore piece; any drygore ~1/43. Model dual set ~1/84 shared.",
    learnKills: 15,
    slowFactor: 0.55,
    rareMultApplies: true,
  },
  lostGroveOnTask: {
    id: "lost-grove-task",
    name: "Lost Grove Slayer (on-task)",
    rateDenom: 1500,
    killsPerHour: 200,
    regions: ["tirannwn"],
    notes: "Cinderbane 1/1500 on-task, 1/5000 off.",
    learnKills: 0,
    rareMultApplies: true,
  },
  solak: {
    id: "solak",
    name: "Solak",
    rateDenom: 1000,
    killsPerHour: 7,
    regions: ["tirannwn"],
    notes: "Cinderbane 1/1000",
    learnKills: 10,
    slowFactor: 0.5,
    rareMultApplies: true,
  },
  vorago: {
    id: "vorago",
    name: "Vorago — seismic / jewellery path",
    rateDenom: 200,
    killsPerHour: 6,
    regions: ["asgarnia"],
    notes: "Coarse EV for seismic/rod-adjacent; teams vary.",
    learnKills: 15,
    slowFactor: 0.4,
    rareMultApplies: true,
  },
};

export interface DropCalcOpts {
  /** Override league rare mult (default 6 = T6 farm) */
  rareMult?: number;
  pieces?: number;
  rateDenom?: number;
  kph?: number;
  applyLearnTax?: boolean;
}

export interface DropCalcResult {
  source: DropSource;
  rateEffective: number;
  rareMult: number;
  expectedKills: number;
  p50Kills: number;
  p90Kills: number;
  hoursMean: number;
  hoursP50: number;
  hoursP90: number;
  hoursPeakNoLearn: number;
}

export function calcDrop(
  sourceId: keyof typeof DROP_SOURCES,
  opts: DropCalcOpts = {},
): DropCalcResult {
  const src = DROP_SOURCES[sourceId]!;
  const rareMult =
    opts.rareMult ??
    (src.rareMultApplies === false ? 1 : RARE_MULT_SCENARIOS.lateT6);
  const baseRate = opts.rateDenom ?? src.rateDenom;
  const rateEffective = Math.max(1, baseRate / rareMult);
  const pieces = opts.pieces ?? 1;
  const kph = opts.kph ?? src.killsPerHour;

  const expectedKills =
    pieces > 1
      ? couponCollectorKills(rateEffective, pieces)
      : expectedKillsGeo(rateEffective);
  const p50Kills =
    pieces > 1 ? expectedKills * 0.92 : geometricQuantile(rateEffective, 0.5);
  const p90Kills =
    pieces > 1
      ? couponCollectorP90(rateEffective, pieces)
      : geometricQuantile(rateEffective, 0.9);

  const useLearn = opts.applyLearnTax !== false;
  const hoursMean = useLearn
    ? learnTaxHours(expectedKills, kph, {
        learnKills: src.learnKills,
        slowFactor: src.slowFactor,
      })
    : hoursFromKills(expectedKills, kph);
  const hoursP50 = useLearn
    ? learnTaxHours(p50Kills, kph, {
        learnKills: src.learnKills,
        slowFactor: src.slowFactor,
      })
    : hoursFromKills(p50Kills, kph);
  const hoursP90 = useLearn
    ? learnTaxHours(p90Kills, kph, {
        learnKills: src.learnKills,
        slowFactor: src.slowFactor,
      })
    : hoursFromKills(p90Kills, kph);

  return {
    source: src,
    rateEffective,
    rareMult,
    expectedKills,
    p50Kills,
    p90Kills,
    hoursMean,
    hoursP50,
    hoursP90,
    hoursPeakNoLearn: hoursFromKills(expectedKills, kph),
  };
}

function expectedKillsGeo(rateDenom: number): number {
  return rateDenom;
}

// ── Components ──────────────────────────────────────────────────────

export type ComponentKind =
  | "skill"
  | "drop"
  | "set-drop"
  | "craft"
  | "unlock"
  | "relic"
  | "blessing"
  | "familiar"
  | "consumable"
  | "jewellery";

export interface AcqComponent {
  id: string;
  name: string;
  kind: ComponentKind;
  requiresRegions?: RegionTag[];
  requiresAllRegions?: RegionTag[];
  skillReqs?: Partial<Record<SkillId, number>>;
  drop?: {
    sourceId: keyof typeof DROP_SOURCES;
    pieces?: number;
    rateDenom?: number;
    kph?: number;
  };
  fixedHours?: number;
  /** Dynamic fixed hours resolver */
  fixedHoursFn?: () => number;
  trainsCombat?: boolean;
  notes?: string;
  tags?: string[];
}

export const COMPONENTS: AcqComponent[] = [
  // Skills
  {
    id: "skill-necro-90",
    name: "Necromancy 90",
    kind: "skill",
    skillReqs: { necromancy: 90 },
  },
  {
    id: "skill-necro-95",
    name: "Necromancy 95",
    kind: "skill",
    skillReqs: { necromancy: 95 },
  },
  {
    id: "skill-necro-99",
    name: "Necromancy 99",
    kind: "skill",
    skillReqs: { necromancy: 99 },
  },
  {
    id: "skill-combat-bundle-90",
    name: "Melee combat 90 bundle",
    kind: "skill",
    skillReqs: { attack: 90, strength: 90, defence: 90, constitution: 90 },
  },
  {
    id: "skill-combat-bundle-99",
    name: "Melee combat 99 bundle",
    kind: "skill",
    skillReqs: { attack: 99, strength: 99, defence: 99, constitution: 99 },
  },
  {
    id: "skill-magic-90",
    name: "Magic 90",
    kind: "skill",
    skillReqs: { magic: 90, defence: 90 },
  },
  {
    id: "skill-magic-99",
    name: "Magic 99",
    kind: "skill",
    skillReqs: { magic: 99, defence: 90 },
  },
  {
    id: "skill-ranged-90",
    name: "Ranged 90",
    kind: "skill",
    skillReqs: { ranged: 90, defence: 90 },
  },
  {
    id: "skill-ranged-99",
    name: "Ranged 99",
    kind: "skill",
    skillReqs: { ranged: 99 },
  },
  {
    id: "skill-prayer-95",
    name: "Prayer 95",
    kind: "skill",
    skillReqs: { prayer: 95 },
  },
  {
    id: "skill-herb-96",
    name: "Herblore 96",
    kind: "skill",
    skillReqs: { herblore: 96 },
  },
  {
    id: "skill-herb-106",
    name: "Herblore 106",
    kind: "skill",
    skillReqs: { herblore: 106 },
  },
  {
    id: "skill-sum-99",
    name: "Summoning 99",
    kind: "skill",
    skillReqs: { summoning: 99 },
  },
  {
    id: "skill-slayer-99",
    name: "Slayer 99",
    kind: "skill",
    skillReqs: { slayer: 99 },
  },
  {
    id: "skill-smith-99",
    name: "Smithing 99",
    kind: "skill",
    skillReqs: { smithing: 99 },
  },
  {
    id: "skill-inv-gates",
    name: "Invention 80 gates",
    kind: "skill",
    skillReqs: { crafting: 80, smithing: 80, divination: 80 },
    requiresAllRegions: ["asgarnia"],
  },
  {
    id: "skill-inv-90",
    name: "Invention 90",
    kind: "skill",
    skillReqs: { invention: 90 },
    requiresAllRegions: ["asgarnia"],
  },
  {
    id: "skill-inv-99",
    name: "Invention 99",
    kind: "skill",
    skillReqs: { invention: 99 },
    requiresAllRegions: ["asgarnia"],
  },
  {
    id: "skill-arch-95",
    name: "Archaeology 95",
    kind: "skill",
    skillReqs: { archaeology: 95 },
    requiresAllRegions: ["kandarin"],
  },

  // Relics / blessings — dynamic
  {
    id: "relics-t7",
    name: "Relic ladder T1→T7",
    kind: "relic",
    fixedHoursFn: () => relicLadderHours(7),
    notes: RELIC_TIER_UNLOCKS.map((r) => `T${r.tier}:${r.exclusiveHours}h`).join(" · "),
  },
  {
    id: "relics-t5",
    name: "Relic ladder T1→T5",
    kind: "relic",
    fixedHoursFn: () => relicLadderHours(5),
  },
  {
    id: "blessings-aegis-path",
    name: "Blessing track Aegis+Cinders+Perf",
    kind: "blessing",
    fixedHoursFn: () => blessingTrackHours(),
    notes: BLESSING_AEGIS_TRACK.map((b) => b.id).join(" → "),
  },

  // Necro
  {
    id: "kili-t70",
    name: "Kili → T70 necro weapons/armour",
    kind: "craft",
    skillReqs: { necromancy: 70 },
    fixedHours: 2.5,
    trainsCombat: true,
    notes: "City of Um free; materials under mults",
  },
  {
    id: "kili-t90",
    name: "Kili → T90 Death Guard/Warden/Skull",
    kind: "craft",
    skillReqs: { necromancy: 90 },
    fixedHours: 5.5,
    trainsCombat: true,
    notes: "Full Kili T90 — free region",
  },
  {
    id: "rasial-omni-soul",
    name: "Omni guard + Soulbound lantern",
    kind: "set-drop",
    skillReqs: { necromancy: 95 },
    drop: { sourceId: "rasial", pieces: 2, rateDenom: 640 },
    trainsCombat: true,
    notes: "2 weapons coupon on Rasial unique table",
  },
  {
    id: "rasial-tfn-set",
    name: "TFN robe set (5)",
    kind: "set-drop",
    skillReqs: { necromancy: 95 },
    drop: { sourceId: "rasial", pieces: 5, rateDenom: 640 },
    trainsCombat: true,
  },
  {
    id: "deathwarden-t90-set",
    name: "Deathwarden T90 tank set",
    kind: "craft",
    skillReqs: { necromancy: 90, defence: 90 },
    fixedHours: 3.5,
    notes: "Kili tank path craft — correct Aegis necro armour",
  },

  // Magic
  {
    id: "cryptbloom-set",
    name: "Cryptbloom 5pc + restore",
    kind: "set-drop",
    skillReqs: { magic: 90, defence: 90 },
    drop: { sourceId: "croesus", pieces: 5, rateDenom: 600 },
    fixedHours: 2.5,
    notes: "MAGIC only. Croesus Misthalin.",
  },
  {
    id: "fsoa",
    name: "Fractured Staff of Armadyl (3 pieces)",
    kind: "set-drop",
    skillReqs: { magic: 95 },
    drop: { sourceId: "kerapac", pieces: 3, rateDenom: 133 },
    requiresAllRegions: ["anachronia"],
    trainsCombat: true,
    notes: "Kerapac HM piece rate ~1/133/kill; 3 pieces",
  },

  // Melee
  {
    id: "drygore-dual",
    name: "Dual drygores (KK)",
    kind: "set-drop",
    skillReqs: { attack: 90, strength: 90 },
    drop: { sourceId: "kalphiteKing", pieces: 2, rateDenom: 84 },
    requiresAllRegions: ["desert"],
    trainsCombat: true,
    notes: "Desert elective. Dual drygore EV.",
  },
  {
    id: "melee-mid-weapons",
    name: "Mid melee (chaotics / early dry path)",
    kind: "craft",
    skillReqs: { attack: 80, strength: 80 },
    fixedHours: 4,
    trainsCombat: true,
    notes: "Dungeoneering chaotics or early PvM — free-region capable",
  },
  {
    id: "masterwork-set",
    name: "Masterwork armour craft",
    kind: "craft",
    skillReqs: { smithing: 99, defence: 90 },
    fixedHours: 14,
    notes: "Smith + materials heavy",
  },

  // Ranged mid
  {
    id: "ranged-mid-weapons",
    name: "Mid ranged weapons (asc/sgb path stub)",
    kind: "drop",
    skillReqs: { ranged: 90 },
    fixedHours: 12,
    trainsCombat: true,
    notes: "Coarse — refined when region-specific BiS locked",
  },

  // Poison
  {
    id: "weapon-poison-plus-plus-plus",
    name: "Weapon poison+++ line",
    kind: "consumable",
    skillReqs: { herblore: 82 },
    fixedHours: 0.5,
  },
  {
    id: "cinderbane-gloves",
    name: "Cinderbane gloves (Lost Grove on-task)",
    kind: "drop",
    drop: { sourceId: "lostGroveOnTask", pieces: 1, rateDenom: 1500 },
    requiresAllRegions: ["tirannwn"],
    skillReqs: { slayer: 90 },
    trainsCombat: true,
  },
  {
    id: "cinderbane-solak",
    name: "Cinderbane via Solak (alt)",
    kind: "drop",
    drop: { sourceId: "solak", pieces: 1, rateDenom: 1000 },
    requiresAllRegions: ["tirannwn"],
    trainsCombat: true,
    notes: "Alt if not slayer tasking Grove",
  },

  // Fam
  {
    id: "fam-steel-titan",
    name: "Steel titan pouches",
    kind: "familiar",
    skillReqs: { summoning: 99 },
    fixedHours: 1.2,
  },
  {
    id: "fam-ice-nihil",
    name: "Ice nihil pouches",
    kind: "familiar",
    skillReqs: { summoning: 87 },
    requiresAllRegions: ["forinthry"],
    fixedHours: 3.5,
  },
  {
    id: "fam-ripper",
    name: "Ripper binding contract",
    kind: "familiar",
    skillReqs: { summoning: 96 },
    requiresAllRegions: ["forinthry"],
    fixedHours: 7,
    notes: "Contract grind Forinthry",
  },

  // Invention
  {
    id: "invention-unlock",
    name: "Invention tutorial + first gizmos",
    kind: "unlock",
    requiresAllRegions: ["asgarnia"],
    skillReqs: { crafting: 80, smithing: 80, divination: 80 },
    fixedHours: 2.5,
  },
  {
    id: "invention-perks-bis",
    name: "Weapon/armour perk rolls BiS-ish",
    kind: "craft",
    requiresAllRegions: ["asgarnia"],
    skillReqs: { invention: 90 },
    fixedHours: 10,
    notes: "Perkfection multiplies ×0.45 in costComponent",
  },
  {
    id: "ancient-invention",
    name: "Ancient Invention (Stormguard)",
    kind: "unlock",
    requiresAllRegions: ["asgarnia", "kandarin"],
    skillReqs: { invention: 85, archaeology: 95 },
    fixedHours: 5,
  },

  // Jewellery (was missing)
  {
    id: "jewellery-reaper-stack",
    name: "Reaper crew + essence / mid jewellery",
    kind: "jewellery",
    fixedHours: 3,
    trainsCombat: true,
    notes: "Reaper assignments for essence — free-region capable",
  },
  {
    id: "jewellery-eof-souls",
    name: "EOF / Amulet of Souls / RoD tier",
    kind: "jewellery",
    requiresAllRegions: ["asgarnia"],
    fixedHours: 8,
    notes: "Asgarnia boss jewellery path (coarse EV)",
    tags: ["asgarnia", "end"],
  },

  // Regions
  {
    id: "unlock-forinthry",
    name: "Unlock Forinthry",
    kind: "unlock",
    requiresAllRegions: ["forinthry"],
    fixedHours: 3,
  },
  {
    id: "unlock-asgarnia",
    name: "Unlock Asgarnia",
    kind: "unlock",
    requiresAllRegions: ["asgarnia"],
    fixedHours: 2.5,
  },
  {
    id: "unlock-kandarin",
    name: "Unlock Kandarin",
    kind: "unlock",
    requiresAllRegions: ["kandarin"],
    fixedHours: 3,
  },
  {
    id: "unlock-tirannwn",
    name: "Unlock Tirannwn/Prif",
    kind: "unlock",
    requiresAllRegions: ["tirannwn"],
    fixedHours: 5.5,
  },
  {
    id: "unlock-desert",
    name: "Unlock Desert",
    kind: "unlock",
    requiresAllRegions: ["desert"],
    fixedHours: 3,
  },
  {
    id: "unlock-anachronia",
    name: "Unlock Anachronia",
    kind: "unlock",
    requiresAllRegions: ["anachronia"],
    fixedHours: 4.5,
  },

  {
    id: "elder-overload-line",
    name: "Elder overload ready",
    kind: "consumable",
    skillReqs: { herblore: 106 },
    fixedHours: 1.2,
  },
];

export const COMPONENT_BY_ID = Object.fromEntries(
  COMPONENTS.map((c) => [c.id, c]),
) as Record<string, AcqComponent>;

// ── Cost ────────────────────────────────────────────────────────────

export interface ComponentCost {
  id: string;
  name: string;
  kind: ComponentKind;
  exclusiveHours: number;
  skillHoursDetail: { skill: SkillId; hours: number }[];
  skillHoursSum: number;
  dropDetail?: DropCalcResult;
  trainsCombat: boolean;
  notes: string[];
  blocked?: string[];
}

function regionsOk(c: AcqComponent, have: Set<RegionTag>): string[] {
  const miss: string[] = [];
  if (c.requiresAllRegions) {
    for (const r of c.requiresAllRegions) {
      if (!have.has(r) && r !== "free") miss.push(`region:${r}`);
    }
  }
  if (c.requiresRegions?.length) {
    const ok = c.requiresRegions.some((r) => have.has(r) || r === "free");
    if (!ok) miss.push(`anyRegion:${c.requiresRegions.join("|")}`);
  }
  return miss;
}

export function costComponent(
  c: AcqComponent,
  electives: readonly string[],
  haveRegions: Set<RegionTag>,
  opts?: { perkfection?: boolean; rareMult?: number },
): ComponentCost {
  const notes: string[] = c.notes ? [c.notes] : [];
  const blocked = regionsOk(c, haveRegions);
  const skillHoursDetail: { skill: SkillId; hours: number }[] = [];

  if (c.skillReqs) {
    for (const [sk, lvl] of Object.entries(c.skillReqs) as [SkillId, number][]) {
      if (!lvl || lvl <= 1) continue;
      const { hours } = chartSkillLeaguePhased(sk, 1, lvl, electives);
      skillHoursDetail.push({ skill: sk, hours });
    }
  }

  let exclusiveHours = c.fixedHoursFn?.() ?? c.fixedHours ?? 0;
  let dropDetail: DropCalcResult | undefined;

  if (c.drop) {
    dropDetail = calcDrop(c.drop.sourceId, {
      rareMult: opts?.rareMult,
      pieces: c.drop.pieces,
      rateDenom: c.drop.rateDenom,
      kph: c.drop.kph,
    });
    exclusiveHours += dropDetail.hoursMean;
    notes.push(
      `Drop EV ${dropDetail.expectedKills.toFixed(0)} kills @ rare×${dropDetail.rareMult} → ${dropDetail.hoursMean.toFixed(1)}h mean / ${dropDetail.hoursP90.toFixed(1)}h p90 (learn-tax on)`,
    );
  }

  if (c.id === "invention-perks-bis" && opts?.perkfection) {
    exclusiveHours *= 0.45;
    notes.push("Perkfection: perk grind ×0.45");
  }

  // Never free: every non-skill component costs something
  if (c.kind !== "skill" && exclusiveHours < 0.15 && !dropDetail) {
    exclusiveHours = 0.15;
    notes.push("Min unlock hedge 0.15h");
  }

  return {
    id: c.id,
    name: c.name,
    kind: c.kind,
    exclusiveHours,
    skillHoursDetail,
    skillHoursSum: skillHoursDetail.reduce((a, s) => a + s.hours, 0),
    dropDetail,
    trainsCombat: !!c.trainsCombat,
    notes,
    blocked: blocked.length ? blocked : undefined,
  };
}

// ── Recipes ─────────────────────────────────────────────────────────

export interface BuildSpec {
  id: string;
  name: string;
  style: Style;
  armour: ArmourProfileId;
  poison: PoisonKitId;
  familiar: FamiliarId;
  invention: InventionTier;
  regions: RegionTag[];
  electives: string[];
  gearTier: "mid" | "end";
  perkfection?: boolean;
  aegisPath?: boolean;
  relicsT7?: boolean;
  /** League tier assumed when farming rares (default 6) */
  farmLeagueTier?: number;
  /** Include EOF/Souls jewellery */
  bisJewellery?: boolean;
}

export function recipeForBuild(spec: BuildSpec): string[] {
  const ids: string[] = [];
  ids.push(spec.relicsT7 === false ? "relics-t5" : "relics-t7");
  if (spec.aegisPath !== false) ids.push("blessings-aegis-path");

  const regs = new Set(spec.regions);
  for (const r of [
    "forinthry",
    "asgarnia",
    "kandarin",
    "tirannwn",
    "desert",
    "anachronia",
  ] as RegionTag[]) {
    if (regs.has(r)) ids.push(`unlock-${r}`);
  }

  if (spec.style === "necromancy") {
    ids.push(spec.gearTier === "end" ? "skill-necro-95" : "skill-necro-90");
    if (spec.gearTier === "end") ids.push("skill-necro-99");
    ids.push("skill-prayer-95");
    ids.push(spec.gearTier === "mid" ? "kili-t70" : "kili-t90");
    if (spec.gearTier === "end") {
      ids.push("rasial-omni-soul");
      if (spec.armour === "tfn-power" || spec.armour === "power-bis") {
        ids.push("rasial-tfn-set");
      } else {
        ids.push("deathwarden-t90-set");
      }
    } else {
      ids.push("deathwarden-t90-set");
    }
    ids.push("jewellery-reaper-stack");
  } else if (spec.style === "magic") {
    ids.push(spec.gearTier === "end" ? "skill-magic-99" : "skill-magic-90");
    ids.push("skill-prayer-95");
    if (spec.armour === "cryptbloom-tank") ids.push("cryptbloom-set");
    if (spec.gearTier === "end") {
      if (regs.has("anachronia")) ids.push("fsoa");
    }
    ids.push("jewellery-reaper-stack");
  } else if (spec.style === "melee") {
    ids.push(
      spec.gearTier === "end" ? "skill-combat-bundle-99" : "skill-combat-bundle-90",
    );
    ids.push("skill-prayer-95");
    if (regs.has("desert") && spec.gearTier === "end") ids.push("drygore-dual");
    else ids.push("melee-mid-weapons");
    if (spec.armour === "masterwork-tank") {
      ids.push("skill-smith-99", "masterwork-set");
    }
    ids.push("jewellery-reaper-stack");
  } else if (spec.style === "ranged") {
    ids.push(spec.gearTier === "end" ? "skill-ranged-99" : "skill-ranged-90");
    ids.push("skill-prayer-95", "ranged-mid-weapons", "jewellery-reaper-stack");
  }

  if (spec.gearTier === "end") ids.push("skill-herb-106", "elder-overload-line");
  else ids.push("skill-herb-96");

  if (spec.poison !== "none") ids.push("weapon-poison-plus-plus-plus");
  if (
    ["wp-cinder", "full-melee-poison", "full-ranged-blowpipe", "cinder-only"].includes(
      spec.poison,
    )
  ) {
    ids.push("skill-slayer-99", "cinderbane-gloves");
  }

  if (spec.familiar === "steel-titan") ids.push("skill-sum-99", "fam-steel-titan");
  else if (spec.familiar === "ice-nihil") ids.push("skill-sum-99", "fam-ice-nihil");
  else if (spec.familiar === "ripper-demon") ids.push("skill-sum-99", "fam-ripper");

  if (spec.invention === "standard" || spec.invention === "ancient") {
    ids.push("skill-inv-gates", "skill-inv-90", "invention-unlock", "invention-perks-bis");
  }
  if (spec.invention === "ancient") {
    ids.push("skill-arch-95", "skill-inv-99", "ancient-invention");
  }
  if (spec.bisJewellery) ids.push("jewellery-eof-souls");

  return [...new Set(ids)];
}

// ── Plan ────────────────────────────────────────────────────────────

export interface AcquisitionPlan {
  spec: BuildSpec;
  rareMultUsed: number;
  farmLeagueTier: number;
  components: ComponentCost[];
  blocked: { id: string; reasons: string[] }[];
  skillUnionHours: number;
  skillBySkill: { skill: SkillId; hours: number }[];
  exclusiveHours: number;
  combatExclusiveHours: number;
  wallClockP50: number;
  wallClockP90: number;
  wallClockMean: number;
  parallelCredit: number;
  /** Sensitivity wall mean at each rare mult */
  sensitivity: Record<string, number>;
  breakdown: string[];
  ledger: {
    id: string;
    name: string;
    exclusiveH: number;
    drop?: string;
  }[];
}

function unionSkillHours(
  recipeIds: string[],
  electives: readonly string[],
): { skill: SkillId; hours: number; level: number }[] {
  const maxLvl: Partial<Record<SkillId, number>> = {};
  for (const id of recipeIds) {
    const c = COMPONENT_BY_ID[id];
    if (!c?.skillReqs) continue;
    for (const [sk, lvl] of Object.entries(c.skillReqs) as [SkillId, number][]) {
      maxLvl[sk] = Math.max(maxLvl[sk] ?? 1, lvl);
    }
  }
  const out: { skill: SkillId; hours: number; level: number }[] = [];
  for (const [sk, lvl] of Object.entries(maxLvl) as [SkillId, number][]) {
    const { hours } = chartSkillLeaguePhased(sk, 1, lvl, electives);
    out.push({ skill: sk, hours, level: lvl });
  }
  return out;
}

function compressSkills(rows: { skill: SkillId; hours: number }[]): {
  combatBundle: number;
  support: number;
  total: number;
} {
  const combat = new Set<SkillId>([
    "attack",
    "strength",
    "defence",
    "constitution",
    "necromancy",
    "magic",
    "ranged",
    "slayer",
  ]);
  let maxC = 0;
  let support = 0;
  for (const r of rows) {
    if (combat.has(r.skill)) maxC = Math.max(maxC, r.hours);
    else support += r.hours;
  }
  const combatBundle = maxC * 1.2;
  return { combatBundle, support, total: combatBundle + support };
}

export function planAcquisition(spec: BuildSpec): AcquisitionPlan {
  const have = new Set<RegionTag>([
    "free",
    "misthalin",
    "havenhythe",
    "karamja",
    ...spec.regions,
  ]);
  const farmTier = spec.farmLeagueTier ?? 6;
  const rareMult = rareMultAtTier(farmTier);
  const recipe = recipeForBuild(spec);

  const components: ComponentCost[] = [];
  const blocked: { id: string; reasons: string[] }[] = [];

  for (const id of recipe) {
    const c = COMPONENT_BY_ID[id];
    if (!c) continue;
    const cost = costComponent(c, spec.electives, have, {
      perkfection: spec.perkfection,
      rareMult,
    });
    cost.skillHoursSum = 0;
    cost.skillHoursDetail = [];
    components.push(cost);
    if (cost.blocked?.length) blocked.push({ id, reasons: cost.blocked });
  }

  const skillRows = unionSkillHours(recipe, spec.electives);
  const skillComp = compressSkills(skillRows);
  const skillUnionHours = skillComp.total;

  let exclusiveHours = 0;
  let combatExclusiveHours = 0;
  let p90Extra = 0;
  let p50Drop = 0;
  let meanDrop = 0;

  for (const c of components) {
    exclusiveHours += c.exclusiveHours;
    if (c.trainsCombat) combatExclusiveHours += c.exclusiveHours;
    if (c.dropDetail) {
      p90Extra += Math.max(0, c.dropDetail.hoursP90 - c.dropDetail.hoursMean);
      p50Drop += c.dropDetail.hoursP50;
      meanDrop += c.dropDetail.hoursMean;
    }
  }

  const parallelCredit =
    Math.min(combatExclusiveHours, skillComp.combatBundle) * 0.85;

  const wallClockMean0 =
    Math.max(0, skillUnionHours - parallelCredit) + exclusiveHours;

  // Requirement-graph hedge: re-cost every component's skill+region+flags
  // via OOP Requirement so nothing slips to 0 without a path.
  const reqPaid = new Set<string>();
  let reqGraphHours = 0;
  for (const id of recipe) {
    const c = COMPONENT_BY_ID[id];
    if (!c) continue;
    const parts = [];
    if (c.skillReqs) {
      for (const [sk, lvl] of Object.entries(c.skillReqs)) {
        if (lvl && lvl > 1) parts.push(new SkillReq(sk as never, lvl as number));
      }
    }
    if (c.requiresAllRegions) {
      for (const r of c.requiresAllRegions) parts.push(new RegionReq(r));
    }
    if (parts.length) {
      const node = costRequirement(new AllReq(parts), {
        electives: spec.electives,
        rareMult,
        paid: reqPaid,
      });
      reqGraphHours += node.hours;
    } else if ((c.fixedHoursFn?.() ?? c.fixedHours ?? 0) < 0.05 && !c.drop) {
      // Truly empty gates — force minimum hedge
      reqGraphHours += 0.15;
    }
  }
  // Skills already in skillUnionHours; reqGraph double-counts skills.
  // Use region-only delta: if reqGraph > skillUnion, add the excess as missing region/flag time.
  const regionFlagHedge = Math.max(0, reqGraphHours - skillUnionHours);

  const wallClockMean =
    wallClockMean0 + regionFlagHedge;

  // p50: slightly under mean on non-drop + p50 drops
  const nonDropExcl = exclusiveHours - meanDrop;
  const wallClockP50 =
    Math.max(0, skillUnionHours - parallelCredit) +
    nonDropExcl +
    p50Drop * 0.95 +
    regionFlagHedge;
  const wallClockP90 = wallClockMean + p90Extra;

  // Sensitivity: recompute exclusive drops only at each mult
  const sensitivity: Record<string, number> = {};
  for (const [label, m] of Object.entries(RARE_MULT_SCENARIOS)) {
    let excl = 0;
    let combatEx = 0;
    for (const id of recipe) {
      const c = COMPONENT_BY_ID[id];
      if (!c) continue;
      const cost = costComponent(c, spec.electives, have, {
        perkfection: spec.perkfection,
        rareMult: m,
      });
      excl += cost.exclusiveHours;
      if (cost.trainsCombat) combatEx += cost.exclusiveHours;
    }
    const par = Math.min(combatEx, skillComp.combatBundle) * 0.85;
    sensitivity[label] =
      Math.max(0, skillUnionHours - par) + excl;
  }

  const breakdown = [
    `Farm league tier ${farmTier} → rare ×${rareMult} (wiki passive ladder)`,
    `Skills union (5×→16× XP): ${skillUnionHours.toFixed(1)}h (combat ${skillComp.combatBundle.toFixed(1)} + support ${skillComp.support.toFixed(1)})`,
    `Exclusive (drops/crafts/relics/blessings): ${exclusiveHours.toFixed(1)}h`,
    `  combat-training exclusive: ${combatExclusiveHours.toFixed(1)}h`,
    `Parallel credit: −${parallelCredit.toFixed(1)}h`,
    `Req-graph region/flag hedge: +${regionFlagHedge.toFixed(1)}h`,
    `WALL mean ${wallClockMean.toFixed(1)}h · p50 ${wallClockP50.toFixed(1)}h · p90 ${wallClockP90.toFixed(1)}h`,
    `Sensitivity mean h: ${Object.entries(sensitivity)
      .map(([k, v]) => `${k}=${v.toFixed(0)}`)
      .join(" · ")}`,
  ];

  return {
    spec,
    rareMultUsed: rareMult,
    farmLeagueTier: farmTier,
    components,
    blocked,
    skillUnionHours,
    skillBySkill: skillRows.map((s) => ({ skill: s.skill, hours: s.hours })),
    exclusiveHours,
    combatExclusiveHours,
    wallClockP50,
    wallClockP90,
    wallClockMean,
    parallelCredit,
    sensitivity,
    breakdown,
    ledger: components.map((c) => ({
      id: c.id,
      name: c.name,
      exclusiveH: +c.exclusiveHours.toFixed(2),
      drop: c.dropDetail
        ? `${c.dropDetail.expectedKills.toFixed(0)}k rare×${c.dropDetail.rareMult}`
        : undefined,
    })),
  };
}

export { LEAGUE_TIER_PASSIVES, RARE_MULT_SCENARIOS, relicLadderHours, blessingTrackHours };
