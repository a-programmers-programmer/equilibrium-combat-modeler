/**
 * Multi-dimensional combat damage sources for Equilibrium.
 * Each dimension is modeled independently then summed (with shared multipliers).
 *
 * Dimensions:
 *  1. coreAbility     — ability hits from AD × hits/s × crit × style
 *  2. onHitBonus      — Abyssal Cinders +15% AD, similar riders
 *  3. procBurst       — Inferno, Light of Saradomin, Grasp bursts
 *  4. flatPerHit      — Big Boned 5% max LP (rides hits + procs)
 *  5. poison          — weapon poison + Envenomed + blessing poison
 *  6. bleedDot        — style DoTs (bleeds, combust, necro stacks)
 *  7. potionBoost     — overload AD, adrenaline density, powerburst LP
 *  8. familiar        — combat familiar DPS (additive, Devout-scaled)
 *  9. conjure         — necro conjures / thrall-like EV (style-gated)
 * 10. specialAttack   — weapon specials duty cycle
 * 11. prayer          — turmoil/anguish/torment + Icyenic faith
 * 12. baneAffinity    — bane/affinity mult on applicable sources
 * 13. relicPlayer     — Infernal/Naragi/Icyenic/Perk player mult
 * 14. multiSplash     — Splash Zone multi-target
 * 15. ultDuty         — Berserk/Sunshine/DS/LD windows (lost if Higher Power)
 */

import type { Style } from "../gear";

export type DamageDimensionId =
  | "coreAbility"
  | "onHitBonus"
  | "procBurst"
  | "flatPerHit"
  | "poison"
  | "bleedDot"
  | "potionBoost"
  | "familiar"
  | "conjure"
  | "specialAttack"
  | "prayer"
  | "baneAffinity"
  | "relicPlayer"
  | "multiSplash"
  | "ultDuty"
  | "armourBonus";

export const ALL_DIMENSIONS: readonly DamageDimensionId[] = [
  "coreAbility",
  "onHitBonus",
  "procBurst",
  "flatPerHit",
  "poison",
  "bleedDot",
  "potionBoost",
  "familiar",
  "conjure",
  "specialAttack",
  "prayer",
  "baneAffinity",
  "relicPlayer",
  "multiSplash",
  "ultDuty",
  "armourBonus",
] as const;

export interface DimensionSlice {
  id: DamageDimensionId;
  label: string;
  /** Absolute contribution to total DPS (player-side unless familiar) */
  dps: number;
  /** Share of total (0–1) after final assembly */
  share: number;
  notes: string[];
  /** Sources that fed this slice */
  sources: string[];
}

export interface PotionProfile {
  id: string;
  name: string;
  /** Overload-style base AD mult (1.15 ≈ elder overload) */
  adMult: number;
  /** Extra adrenaline gen density */
  adrenDensity: number;
  /** Powerburst of vitality max LP mult */
  powerburstLp: number;
  /** Weapon poison tier 0–4 (none → weapon poison+++ ) */
  poisonTier: 0 | 1 | 2 | 3 | 4;
  /** Adrenaline potion free-spec windows per minute */
  adrenPotsPerMin: number;
  herbloreRequired: number;
  notes: string;
}

/** Common potion loadouts by Herblore band / league pace */
export const POTION_PROFILES: readonly PotionProfile[] = [
  {
    id: "none",
    name: "No potions",
    adMult: 1,
    adrenDensity: 1,
    powerburstLp: 1,
    poisonTier: 0,
    adrenPotsPerMin: 0,
    herbloreRequired: 1,
    notes: "Raw baseline",
  },
  {
    id: "super-sets",
    name: "Super sets + weapon poison",
    adMult: 1.08,
    adrenDensity: 1.02,
    powerburstLp: 1,
    poisonTier: 2,
    adrenPotsPerMin: 1,
    herbloreRequired: 55,
    notes: "Early–mid league",
  },
  {
    id: "overload",
    name: "Overloads + weapon poison+",
    adMult: 1.12,
    adrenDensity: 1.04,
    powerburstLp: 1.1,
    poisonTier: 3,
    adrenPotsPerMin: 2,
    herbloreRequired: 96,
    notes: "Standard high-end",
  },
  {
    id: "elder-ovl",
    name: "Elder overloads + weapon poison+++",
    adMult: 1.15,
    adrenDensity: 1.06,
    powerburstLp: 1.15,
    poisonTier: 4,
    adrenPotsPerMin: 3,
    herbloreRequired: 106,
    notes: "Endgame combat consumables",
  },
  {
    id: "poison-stack",
    name: "Elder OVL + Envenomed focus (max poison)",
    adMult: 1.15,
    adrenDensity: 1.05,
    powerburstLp: 1.15,
    poisonTier: 4,
    adrenPotsPerMin: 2,
    herbloreRequired: 106,
    notes: "Pairs with Envenomed blessing + Tearing Thorns",
  },
];

export const POTION_BY_ID: Readonly<Record<string, PotionProfile>> = Object.fromEntries(
  POTION_PROFILES.map((p) => [p.id, p]),
);

/** Weapon poison base DPS factor (fraction of AD × hits, before Envenomed) */
export function weaponPoisonBase(
  poisonTier: number,
  ad: number,
  hitsPerSec: number,
  styleDotDensity: number,
): { dps: number; label: string } {
  if (poisonTier <= 0) return { dps: 0, label: "no weapon poison" };
  // Approximate RS3 weapon poison: tick damage scales with tier
  const tierMult = [0, 0.04, 0.07, 0.1, 0.14][Math.min(4, poisonTier)] ?? 0;
  const dps = ad * tierMult * hitsPerSec * (0.6 + 0.4 * styleDotDensity);
  const names = ["", "weapon poison", "weapon poison+", "weapon poison++", "weapon poison+++"];
  return { dps, label: names[poisonTier] ?? "poison" };
}

/** Envenomed multiplies poison; herblore adds 2% per level */
export function envenomedPoisonMult(herbloreLevel: number, hasEnvenomed: boolean): number {
  if (!hasEnvenomed) return 1;
  // +50% + 2% per herblore level (wiki Envenomed)
  return 1.5 + 0.02 * herbloreLevel;
}

/**
 * Style DoT density baseline — bleeds (melee), combust/corruption (magic),
 * fragmentation (ranged), necro stacks.
 */
export function styleBleedDotDps(
  style: Style,
  ad: number,
  hitsPerSec: number,
  dotDensity: number,
  tearingThorns: boolean,
  havocMult: number,
): { dps: number; sources: string[] } {
  const baseShare =
    style === "melee"
      ? 0.18
      : style === "magic"
        ? 0.16
        : style === "ranged"
          ? 0.14
          : 0.12; // necro less classical bleed, more stacks
  let mult = 1;
  const sources = [`${style} DoT kit`];
  if (tearingThorns) {
    mult *= 2; // duration ×2 ≈ uptime×2 for DoTs
    sources.push("Tearing Thorns 2× DoT duration");
  }
  const dps = ad * baseShare * hitsPerSec * dotDensity * mult * havocMult;
  return { dps, sources };
}

/** Necromancy conjure EV (Spirit of War / skeleton / putrid / zombie) */
export function conjureDps(
  style: Style,
  ad: number,
  hasGenesis: boolean,
  hasPowerArchive: boolean,
): { dps: number; sources: string[] } {
  if (style !== "necromancy") return { dps: 0, sources: [] };
  // Rough conjure package ~12–18% of AD throughput
  let mult = 0.14;
  const sources = ["Necro conjures"];
  if (hasGenesis) {
    mult *= 1.12;
    sources.push("Genesis weapon tiers on conjure scale");
  }
  if (hasPowerArchive) {
    mult *= 1.2;
    sources.push("Power Archive EQ ranks on conjure damage");
  }
  return { dps: ad * mult * 2.2, sources }; // 2.2 ≈ effective hits density of conjures
}

/** Special attack duty-cycle EV */
export function specialAttackDps(
  style: Style,
  ad: number,
  densityMult: number,
  adrenPotsPerMin: number,
  hasAvernic: boolean,
): { dps: number; sources: string[] } {
  // Specs ~8% of rotation value baseline; avernic + adren pots open free windows
  let share = 0.08;
  const sources = [`${style} weapon specials`];
  if (hasAvernic) {
    share += 0.06;
    sources.push("Avernic free-spec windows");
  }
  if (adrenPotsPerMin > 0) {
    share += 0.015 * adrenPotsPerMin;
    sources.push(`Adren pots ×${adrenPotsPerMin}/min`);
  }
  return { dps: ad * share * 2.5 * densityMult, sources };
}

/** Ult duty cycle mult (1 = none). Higher Power removes these. */
export function ultDutyMult(
  style: Style,
  hasHigherPower: boolean,
  fightSeconds: number,
): { mult: number; sources: string[] } {
  if (hasHigherPower) {
    return { mult: 1, sources: ["Higher Power — no major ult"] };
  }
  // Peak window strength then duty cycle over fight length
  const peak =
    style === "melee"
      ? 1.68 // Berserk
      : style === "magic"
        ? 1.5 // Sunshine
        : style === "ranged"
          ? 1.5 // Death's Swiftness
          : 1.42; // Living Death
  // Cooldown ~60s, duration ~20s → 33% uptime raw; shorter fights weight peak more
  const uptime = Math.min(0.45, 20 / Math.max(30, fightSeconds));
  const mult = 1 + (peak - 1) * uptime;
  return {
    mult,
    sources: [`${style} ult duty @ ${fightSeconds}s fight (×${mult.toFixed(3)})`],
  };
}

export function assembleShares(
  slices: Omit<DimensionSlice, "share">[],
): DimensionSlice[] {
  const total = slices.reduce((s, x) => s + Math.max(0, x.dps), 0);
  return slices.map((x) => ({
    ...x,
    share: total > 0 ? Math.max(0, x.dps) / total : 0,
  }));
}

export function dimensionLabels(): Record<DamageDimensionId, string> {
  return {
    coreAbility: "Core abilities",
    onHitBonus: "On-hit (Cinders)",
    procBurst: "Proc bursts (Inferno/Light/Grasp)",
    flatPerHit: "Flat per hit (Big Boned)",
    poison: "Poison (weapon + Envenomed)",
    bleedDot: "Style DoTs / bleeds",
    potionBoost: "Potion AD uplift (isolated)",
    familiar: "Familiar",
    conjure: "Conjures (necro)",
    specialAttack: "Weapon specials",
    prayer: "Prayer / Icyenic",
    baneAffinity: "Bane / affinity uplift",
    relicPlayer: "Relic player mult uplift",
    multiSplash: "Splash Zone multi",
    ultDuty: "Ultimate windows",
    armourBonus: "Armour style dmg / set effects",
  };
}
