/**
 * Invention combat layer for Equilibrium.
 *
 * Gates (requirements.ts):
 * - Standard Invention: 80 Craft+Smith+Div (unboostable) + Asgarnia (Invention Guild)
 * - Ancient Invention: 85 Inv + 95 Arch + Kandarin (Stormguard)
 *
 * Combat value:
 * - Weapon/armour gizmo perk ranks (Aftershock, Precise, Equilibrium, Biting, etc.)
 * - Perkfection relic: helpful perks +20%, free charges
 * - Power Archive blessing: combat perk ranks doubled
 * - Augmented T90–T95 gear baseline
 */

import type { RegionTag, PlayerSnapshot } from "./requirements";
import {
  INVENTION_UNLOCK,
  ANCIENT_INVENTION_UNLOCK,
  unsatisfied,
} from "./requirements";
import type { Style } from "../gear";

export type InventionTier = "none" | "standard" | "ancient";

export interface InventionPerks {
  /** Aggregate perk EV mult on ability package */
  perkMult: number;
  /** Aftershock / crackling style proc EV (fraction of AD throughput) */
  procShare: number;
  notes: string[];
}

export interface InventionModelInput {
  tier: InventionTier;
  style: Style;
  /** Perkfection relic */
  perkfection: boolean;
  /** Power Archive blessing (rank double) */
  powerArchive: boolean;
  /** Player for hard gates; if locked, force none */
  player?: PlayerSnapshot;
  /** Soft: regions only */
  regions?: ReadonlySet<RegionTag> | RegionTag[];
}

export interface InventionModelResult {
  tier: InventionTier;
  locked: boolean;
  missing: string[];
  perkMult: number;
  procDpsFactor: number; // multiply ability-like dps
  flags: string[];
  warnings: string[];
  /** Hours pad for invention unlock (non-XP content + setup) */
  unlockPadHours: number;
}

const STYLE_PERK_BASE: Record<Style, { mult: number; proc: number; label: string }> = {
  melee: { mult: 1.1, proc: 0.04, label: "Aftershock/Precise/Eq/Biting" },
  magic: { mult: 1.09, proc: 0.035, label: "Precise/Eq/Biting/Crackling" },
  ranged: { mult: 1.09, proc: 0.035, label: "Precise/Eq/Biting" },
  necromancy: { mult: 1.08, proc: 0.03, label: "Necro gizmo package" },
};

function regionSet(
  r?: ReadonlySet<RegionTag> | RegionTag[],
): Set<RegionTag> {
  if (!r) return new Set();
  return r instanceof Set ? new Set(r) : new Set(r);
}

export function inventionAccessible(
  want: InventionTier,
  player?: PlayerSnapshot,
  regions?: ReadonlySet<RegionTag> | RegionTag[],
): { ok: boolean; missing: string[]; effective: InventionTier } {
  if (want === "none") return { ok: true, missing: [], effective: "none" };

  if (player) {
    if (want === "standard" || want === "ancient") {
      const miss = unsatisfied(INVENTION_UNLOCK, player);
      if (miss.length) {
        return { ok: false, missing: miss, effective: "none" };
      }
    }
    if (want === "ancient") {
      const miss = unsatisfied(ANCIENT_INVENTION_UNLOCK, player);
      if (miss.length) {
        // Fall back to standard if that works
        return { ok: false, missing: miss, effective: "standard" };
      }
    }
    return { ok: true, missing: [], effective: want };
  }

  // Soft region check
  const regs = regionSet(regions);
  if (want === "standard" || want === "ancient") {
    if (!regs.has("asgarnia") && !regs.has("free")) {
      // free never has invention guild — need asgarnia
      if (!regs.has("asgarnia")) {
        return {
          ok: false,
          missing: ["region:asgarnia (Invention Guild)"],
          effective: "none",
        };
      }
    }
    if (!regs.has("asgarnia")) {
      return {
        ok: false,
        missing: ["region:asgarnia"],
        effective: "none",
      };
    }
  }
  if (want === "ancient" && !regs.has("kandarin")) {
    return {
      ok: false,
      missing: ["region:kandarin (Ancient Invention / Stormguard)"],
      effective: "standard", // can still use standard
    };
  }
  return { ok: true, missing: [], effective: want };
}

export function modelInvention(input: InventionModelInput): InventionModelResult {
  const flags: string[] = [];
  const warnings: string[] = [];
  const access = inventionAccessible(input.tier, input.player, input.regions);

  let tier = access.effective;
  if (!access.ok && access.effective === "none") {
    return {
      tier: "none",
      locked: true,
      missing: access.missing,
      perkMult: 1,
      procDpsFactor: 1,
      flags: ["Invention locked"],
      warnings: access.missing.map((m) => `Invention: ${m}`),
      unlockPadHours: 0,
    };
  }
  if (access.missing.length && tier !== input.tier) {
    warnings.push(
      `Wanted ${input.tier} invention, effective ${tier}: ${access.missing.join("; ")}`,
    );
  }

  if (tier === "none") {
    return {
      tier: "none",
      locked: false,
      missing: [],
      perkMult: 1,
      procDpsFactor: 1,
      flags: ["No invention perks"],
      warnings,
      unlockPadHours: 0,
    };
  }

  const base = STYLE_PERK_BASE[input.style];
  let perkMult = base.mult;
  let proc = base.proc;
  flags.push(`Invention ${tier}: ${base.label}`);

  if (tier === "ancient") {
    perkMult *= 1.04; // ancient gizmo ceiling
    proc *= 1.1;
    flags.push("Ancient gizmos (+perk ceiling)");
  }

  if (input.powerArchive) {
    // ranks doubled → roughly + half the perk gap again
    const gap = perkMult - 1;
    perkMult = 1 + gap * 1.55;
    proc *= 1.25;
    flags.push("Power Archive: perk ranks doubled");
  }

  if (input.perkfection) {
    perkMult *= 1.2; // helpful perks +20%
    flags.push("Perkfection +20% helpful perks");
  }

  // Soft cap so we don't go insane
  perkMult = Math.min(perkMult, 1.45);
  const procDpsFactor = 1 + proc;

  let unlockPadHours = tier === "standard" ? 3 : 6;
  if (input.perkfection) unlockPadHours += 1;

  return {
    tier,
    locked: false,
    missing: access.missing,
    perkMult,
    procDpsFactor,
    flags,
    warnings,
    unlockPadHours,
  };
}

/** Invention skill targets for hours model */
export function inventionSkillTargets(tier: InventionTier): {
  invention: number;
  crafting: number;
  smithing: number;
  divination: number;
  archaeology: number;
} {
  if (tier === "none") {
    return { invention: 1, crafting: 1, smithing: 1, divination: 1, archaeology: 1 };
  }
  if (tier === "standard") {
    return {
      invention: 90,
      crafting: 80,
      smithing: 80,
      divination: 80,
      archaeology: 1,
    };
  }
  return {
    invention: 99,
    crafting: 80,
    smithing: 80,
    divination: 80,
    archaeology: 95,
  };
}
