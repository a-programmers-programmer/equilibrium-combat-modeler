/**
 * RS3 weapon-poison stack model (Equilibrium-aware).
 *
 * Sources (stacking):
 * - Weapon poison / + / ++ / +++  (consumable tiers 1–4)
 * - Cinderbane gloves             (Lost Grove / Solak → Tirannwn)
 * - Laniakea's spear              (+5% apply, +5% poison dmg — Anachronia)
 * - Upgraded Bone Blowpipe        (halve poison dmg, double proc rate)
 * - Kwuarm incense sticks         (+2.5% poison dmg per stack, max 4 = +10%)
 * - Envenomed blessing            (+50% + 2% per Herblore level; strip immunity)
 * - Tearing Thorns / Barkscales   (Grasp poison riders — handled in model)
 * - Blood reaver familiar         (extra poison hit EV on damage)
 * - Perfidious / high hit rate    (more apply rolls)
 *
 * Base mechanic (wiki-shaped):
 * - Poison activates on a ~16-tick cycle; chance to apply per ability hit
 * - Cinderbanes: 12.5% (1/8) apply per hit + +1 poison tier + chain extra hits
 *   (extra-hit series ≈ +1/7 ≈ +14.3% poison throughput)
 * - With WP+++, poison hit ≈ 39% of ability damage per activation (wiki example)
 *
 * Region gates:
 * - Cinderbanes: tirannwn (Lost Grove / Solak)
 * - Laniakea spear: anachronia
 * - Bone blowpipe: early-mid ranged (misthalin / general)
 */

import type { RegionTag } from "./requirements";
import type { Style } from "../gear";

export type WeaponPoisonTier = 0 | 1 | 2 | 3 | 4;

/** Relative poison damage coefficient by tier (tier 4 = WP+++ = 1.0 baseline). */
export const POISON_TIER_COEFF: Record<WeaponPoisonTier, number> = {
  0: 0,
  1: 0.45, // weapon poison
  2: 0.65, // +
  3: 0.82, // ++
  4: 1.0, // +++
};

export interface PoisonGearFlags {
  /** Cinderbane gloves worn (or switch EV ≈ 1) */
  cinderbaneGloves: boolean;
  /** Laniakea's spear as mainhand or switch */
  laniakeaSpear: boolean;
  /** Upgraded bone blowpipe mainhand */
  upgradedBoneBlowpipe: boolean;
  /** Kwuarm incense stacks 0–4 */
  kwuarmStacks: 0 | 1 | 2 | 3 | 4;
  /** Blood reaver familiar out */
  bloodReaver: boolean;
  /** Target is poison-immune (unless Envenomed strips) */
  targetPoisonImmune: boolean;
}

export interface PoisonModelInput {
  abilityDamage: number;
  hitsPerSecond: number;
  style: Style;
  weaponPoisonTier: WeaponPoisonTier;
  herbloreLevel: number;
  hasEnvenomed: boolean;
  gear: PoisonGearFlags;
  /** Multi-target hit multiplier (ricochet etc.) — more apply rolls */
  multiHitFactor?: number;
  regions: ReadonlySet<RegionTag> | RegionTag[];
}

export interface PoisonSourceBreakdown {
  id: string;
  label: string;
  /** Contribution to poison DPS */
  dps: number;
  notes: string[];
}

export interface PoisonModelResult {
  /** Total poison DPS after all stacks */
  dps: number;
  /** Effective poison tier after cinderbane +1 */
  effectiveTier: number;
  /** Apply chance per ability hit */
  applyChance: number;
  /** Poison hit size as fraction of AD */
  hitAdPct: number;
  /** Activations per second */
  activationsPerSec: number;
  sources: PoisonSourceBreakdown[];
  flags: string[];
  warnings: string[];
  /** Gear pieces assumed / locked out by region */
  gearStatus: {
    cinderbane: "active" | "unavailable" | "off";
    laniakea: "active" | "unavailable" | "off";
    blowpipe: "active" | "off";
    kwuarm: number;
  };
}

function regionSet(r: PoisonModelInput["regions"]): Set<RegionTag> {
  return r instanceof Set ? r : new Set(r);
}

export function cinderbaneAccessible(regions: ReadonlySet<RegionTag>): boolean {
  // Lost Grove + Solak are Tirannwn
  return regions.has("tirannwn") || regions.has("free"); // free never has grove — only tirannwn
}

export function laniakeaAccessible(regions: ReadonlySet<RegionTag>): boolean {
  return regions.has("anachronia");
}

/**
 * Full poison stack DPS.
 *
 * Approx formula:
 *   baseHit = AD * 0.39 * tierCoeff(effectiveTier)
 *   applyChance = base  (from WP uptime) + cinderbane 0.125 + laniakea 0.05
 *   activations/s ≈ min( hits/s * applyChance * multi,  1/ (0.6 * blowpipeHalve) )
 *   chainMult = cinderbane ? 1 + 1/7 : 1
 *   kwuarm = 1 + 0.025 * stacks
 *   envenomed = 1.5 + 0.02 * herb
 *   blowpipe: dmg * 0.5, rate * 2  (net ~same raw, but cinderbane chain interaction)
 *   blood reaver: +15% poison EV (extra hit syn)
 */
export function modelPoisonStack(input: PoisonModelInput): PoisonModelResult {
  const flags: string[] = [];
  const warnings: string[] = [];
  const sources: PoisonSourceBreakdown[] = [];
  const regions = regionSet(input.regions);
  const multi = input.multiHitFactor ?? 1;

  let cinder = input.gear.cinderbaneGloves;
  let lani = input.gear.laniakeaSpear;
  const blowpipe = input.gear.upgradedBoneBlowpipe;
  const kwuarm = Math.min(4, Math.max(0, input.gear.kwuarmStacks)) as 0 | 1 | 2 | 3 | 4;

  let cinderStatus: "active" | "unavailable" | "off" = "off";
  let laniStatus: "active" | "unavailable" | "off" = "off";

  if (cinder) {
    if (!regions.has("tirannwn")) {
      cinder = false;
      cinderStatus = "unavailable";
      warnings.push(
        "Cinderbane gloves require Tirannwn (Lost Grove / Solak) — not in electives",
      );
    } else {
      cinderStatus = "active";
      flags.push("Cinderbane gloves (Tirannwn)");
    }
  }
  if (lani) {
    if (!laniakeaAccessible(regions)) {
      lani = false;
      laniStatus = "unavailable";
      warnings.push("Laniakea's spear requires Anachronia");
    } else {
      laniStatus = "active";
      flags.push("Laniakea's spear (+5% apply, +5% poison dmg)");
    }
  }
  if (blowpipe) flags.push("Upgraded Bone Blowpipe (½ dmg, 2× rate)");
  if (kwuarm > 0) flags.push(`Kwuarm incense ×${kwuarm} (+${kwuarm * 2.5}% poison)`);

  // Immunity
  if (input.gear.targetPoisonImmune && !input.hasEnvenomed) {
    return {
      dps: 0,
      effectiveTier: 0,
      applyChance: 0,
      hitAdPct: 0,
      activationsPerSec: 0,
      sources: [
        {
          id: "immune",
          label: "Target poison-immune",
          dps: 0,
          notes: ["Need Envenomed to strip 30s"],
        },
      ],
      flags: ["Poison blocked — target immune (no Envenomed)"],
      warnings: ["Poison immune target"],
      gearStatus: {
        cinderbane: cinderStatus,
        laniakea: laniStatus,
        blowpipe: blowpipe ? "active" : "off",
        kwuarm,
      },
    };
  }
  if (input.gear.targetPoisonImmune && input.hasEnvenomed) {
    flags.push("Envenomed strips poison immunity (30s)");
  }

  // Effective tier: WP tier +1 if cinderbane with another source
  let tier: number = input.weaponPoisonTier;
  if (cinder && tier > 0) {
    tier = Math.min(5, tier + 1); // "tier 5" above +++
    flags.push(`Cinderbane +1 poison tier → effective T${tier}`);
  } else if (cinder && tier === 0) {
    // Cinderbanes alone apply tier 2 poison
    tier = 2;
    flags.push("Cinderbane solo → T2 poison");
  }

  if (tier === 0 && !cinder) {
    return {
      dps: 0,
      effectiveTier: 0,
      applyChance: 0,
      hitAdPct: 0,
      activationsPerSec: 0,
      sources: [],
      flags: ["No weapon poison and no Cinderbanes"],
      warnings: [],
      gearStatus: {
        cinderbane: cinderStatus,
        laniakea: laniStatus,
        blowpipe: blowpipe ? "active" : "off",
        kwuarm,
      },
    };
  }

  // Tier coefficient — tier 5 ≈ 1.15 above +++
  const tierCoeff =
    tier <= 4
      ? POISON_TIER_COEFF[tier as WeaponPoisonTier]
      : POISON_TIER_COEFF[4] * 1.15;

  // Apply chance per ability hit
  // Baseline: weapon poison has high uptime once applied; model apply/reapply chance
  let applyChance = tier > 0 ? 0.12 : 0; // base reapply/maintain
  if (cinder) applyChance += 0.125;
  if (lani) applyChance += 0.05;
  applyChance = Math.min(0.55, applyChance);

  // Hit size: wiki ~39% AD for WP+++ with cinderbanes package
  let hitAdPct = 0.39 * tierCoeff;
  if (lani) hitAdPct *= 1.05;
  if (kwuarm > 0) hitAdPct *= 1 + 0.025 * kwuarm;

  // Blowpipe: half damage, double rate
  let rateMult = 1;
  let dmgMult = 1;
  if (blowpipe) {
    dmgMult *= 0.5;
    rateMult *= 2;
    if (cinder) {
      // PVME: blowpipe halves cinderbane poison dmg but does NOT double cinderbane proc chance
      // Net: cinderbane portion hurt — approximate 0.75 overall when both
      dmgMult *= 0.9;
      warnings.push(
        "Upgraded Bone Blowpipe + Cinderbanes: poison dmg halved on cinderbane procs (PVME)",
      );
    }
  }

  // Envenomed
  let envMult = 1;
  if (input.hasEnvenomed) {
    envMult = 1.5 + 0.02 * input.herbloreLevel;
    flags.push(`Envenomed ×${envMult.toFixed(2)}`);
  }

  // Cinderbane chain extras ≈ +1/7
  const chainMult = cinder ? 1 + 1 / 7 : 1;
  if (cinder) flags.push("Cinderbane chain extras (+1/7)");

  // Blood reaver synergy
  let reaverMult = 1;
  if (input.gear.bloodReaver) {
    reaverMult = 1.18;
    flags.push("Blood reaver poison synergy (+18% EV)");
  }

  // Activations per second
  const hits = input.hitsPerSecond * multi;
  // Natural poison tick ~ every 16 ticks (9.6s) guaranteed path + chance procs
  const chanceActivations = hits * applyChance * rateMult;
  const floorActivations = (1 / 9.6) * rateMult; // 16-tick baseline
  const activationsPerSec = Math.min(hits * 0.5, Math.max(floorActivations, chanceActivations));

  const perHit = input.abilityDamage * hitAdPct * dmgMult;
  const rawDps =
    perHit * activationsPerSec * chainMult * envMult * reaverMult;

  // Source breakdown (approximate attribution)
  const baseShare = tier > 0 ? 0.55 : 0.2;
  sources.push({
    id: "weapon-poison",
    label: `Weapon poison T${input.weaponPoisonTier}→eff T${tier}`,
    dps: rawDps * baseShare,
    notes: [`coeff ${tierCoeff.toFixed(2)}`, `hit ${ (hitAdPct * 100).toFixed(1)}% AD`],
  });
  if (cinder) {
    sources.push({
      id: "cinderbane",
      label: "Cinderbane gloves",
      dps: rawDps * 0.28,
      notes: ["+1 tier", "12.5% apply", "chain +1/7"],
    });
  }
  if (lani) {
    sources.push({
      id: "laniakea",
      label: "Laniakea's spear",
      dps: rawDps * 0.06,
      notes: ["+5% apply", "+5% dmg"],
    });
  }
  if (kwuarm > 0) {
    sources.push({
      id: "kwuarm",
      label: `Kwuarm incense ×${kwuarm}`,
      dps: rawDps * (0.025 * kwuarm) * 0.8,
      notes: [`+${kwuarm * 2.5}% poison damage`],
    });
  }
  if (input.hasEnvenomed) {
    sources.push({
      id: "envenomed",
      label: "Envenomed blessing",
      dps: rawDps * (1 - 1 / envMult),
      notes: [`Herb ${input.herbloreLevel}`],
    });
  }
  if (blowpipe) {
    sources.push({
      id: "blowpipe",
      label: "Upgraded Bone Blowpipe",
      dps: rawDps * 0.02, // net roughly neutral; small structure
      notes: ["½ dmg × 2 rate"],
    });
  }
  if (input.gear.bloodReaver) {
    sources.push({
      id: "blood-reaver",
      label: "Blood reaver",
      dps: rawDps * (1 - 1 / reaverMult),
      notes: ["extra poison hit EV"],
    });
  }

  // Style note: melee hits denser → slightly more applies (already in hitsPerSec)
  flags.push(
    `Poison DPS ${Math.round(rawDps)} (${activationsPerSec.toFixed(2)} act/s × ${Math.round(perHit)} hit)`,
  );

  return {
    dps: rawDps,
    effectiveTier: tier,
    applyChance,
    hitAdPct,
    activationsPerSec,
    sources,
    flags,
    warnings,
    gearStatus: {
      cinderbane: cinderStatus,
      laniakea: laniStatus,
      blowpipe: blowpipe ? "active" : "off",
      kwuarm,
    },
  };
}

/** Preset poison kits for sims */
export type PoisonKitId =
  | "none"
  | "wp-only"
  | "wp-cinder"
  | "full-melee-poison" // WP+++ + cinder + lani + kwuarm4 + envenomed
  | "full-ranged-blowpipe" // blowpipe + WP + cinder attempt
  | "cinder-only"
  | "reaver-cinder";

export interface PoisonKit {
  id: PoisonKitId;
  name: string;
  weaponPoisonTier: WeaponPoisonTier;
  gear: PoisonGearFlags;
  preferEnvenomed: boolean;
  notes: string;
}

export const POISON_KITS: readonly PoisonKit[] = [
  {
    id: "none",
    name: "No poison gear",
    weaponPoisonTier: 0,
    gear: {
      cinderbaneGloves: false,
      laniakeaSpear: false,
      upgradedBoneBlowpipe: false,
      kwuarmStacks: 0,
      bloodReaver: false,
      targetPoisonImmune: false,
    },
    preferEnvenomed: false,
    notes: "Control",
  },
  {
    id: "wp-only",
    name: "Weapon poison+++ only",
    weaponPoisonTier: 4,
    gear: {
      cinderbaneGloves: false,
      laniakeaSpear: false,
      upgradedBoneBlowpipe: false,
      kwuarmStacks: 0,
      bloodReaver: false,
      targetPoisonImmune: false,
    },
    preferEnvenomed: true,
    notes: "Consumable only",
  },
  {
    id: "wp-cinder",
    name: "WP+++ + Cinderbanes + Kwuarm4",
    weaponPoisonTier: 4,
    gear: {
      cinderbaneGloves: true,
      laniakeaSpear: false,
      upgradedBoneBlowpipe: false,
      kwuarmStacks: 4,
      bloodReaver: false,
      targetPoisonImmune: false,
    },
    preferEnvenomed: true,
    notes: "Needs Tirannwn for gloves",
  },
  {
    id: "full-melee-poison",
    name: "WP+++ + Cinder + Laniakea + Kwuarm4",
    weaponPoisonTier: 4,
    gear: {
      cinderbaneGloves: true,
      laniakeaSpear: true,
      upgradedBoneBlowpipe: false,
      kwuarmStacks: 4,
      bloodReaver: false,
      targetPoisonImmune: false,
    },
    preferEnvenomed: true,
    notes: "Tirannwn + Anachronia",
  },
  {
    id: "full-ranged-blowpipe",
    name: "Upgraded Bone Blowpipe + WP+++ + Cinder",
    weaponPoisonTier: 4,
    gear: {
      cinderbaneGloves: true,
      laniakeaSpear: false,
      upgradedBoneBlowpipe: true,
      kwuarmStacks: 4,
      bloodReaver: false,
      targetPoisonImmune: false,
    },
    preferEnvenomed: true,
    notes: "Blowpipe rate manip; cinder interaction",
  },
  {
    id: "cinder-only",
    name: "Cinderbanes only (no WP potion)",
    weaponPoisonTier: 0,
    gear: {
      cinderbaneGloves: true,
      laniakeaSpear: false,
      upgradedBoneBlowpipe: false,
      kwuarmStacks: 2,
      bloodReaver: false,
      targetPoisonImmune: false,
    },
    preferEnvenomed: true,
    notes: "T2 poison from gloves alone",
  },
  {
    id: "reaver-cinder",
    name: "WP+++ + Cinder + Blood reaver",
    weaponPoisonTier: 4,
    gear: {
      cinderbaneGloves: true,
      laniakeaSpear: false,
      upgradedBoneBlowpipe: false,
      kwuarmStacks: 4,
      bloodReaver: true,
      targetPoisonImmune: false,
    },
    preferEnvenomed: true,
    notes: "Familiar poison synergy",
  },
];

export const POISON_KIT_BY_ID: Readonly<Record<string, PoisonKit>> = Object.fromEntries(
  POISON_KITS.map((k) => [k.id, k]),
);
