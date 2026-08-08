/**
 * Effect-based combat resolution for Equilibrium relics.
 * Replaces opaque playerDpsMult fudges with wiki-derived components.
 *
 * Each combat-relevant relic contributes structured multipliers:
 * - adMult / styleBonusAd  (pocket damage bonuses)
 * - critChanceAdd / abilityDamagePctFromPrayer
 * - executeSkipFrac         (Death Mark EV)
 * - dutyCycleBurstMult      (Naragi 255 levels)
 * - familiarDamageMult      (Devout — applied in summoning too)
 * - perkTriggerMult         (Perkfection helpful perks +20%)
 * - ritualMult              (Crystal Grace necro)
 * - pocketArmour            (Naragi)
 */

import type { RelicId } from "./relics";

export interface RelicCombatContext {
  /** Total prayer bonus from gear + tome etc. before Icyenic scaling */
  prayerBonus: number;
  /** Fight length seconds (Death Mark / Naragi duty) */
  fightSeconds: number;
  /** Style for pocket style-bonus conversion */
  style: "melee" | "magic" | "ranged" | "necromancy";
  summoningLevel: number;
  /** Baseline AD before relic pocket bonuses */
  baselineAd: number;
}

export interface RelicCombatSlice {
  id: RelicId;
  /** Multiplicative DPS (execute, perk procs, etc.) — applied at end */
  dpsMult: number;
  /** Flat AD added (pocket style bonuses) */
  flatAd: number;
  /** Extra armour (Naragi pocket) — apply before Aegis */
  flatArmour: number;
  /** Crit chance added (0–1) from Icyenic etc. */
  critChanceAdd: number;
  /** Base ability damage fraction from prayer (Icyenic 0.2%/pt) */
  abilityDamagePct: number;
  /** Extra prayer bonus (Tome +50, Star +15, Sliver +15) */
  prayerBonusAdd: number;
  notes: string[];
  components: { name: string; mult: number; detail: string }[];
}

export interface RelicCombatResult {
  slices: RelicCombatSlice[];
  dpsMult: number;
  flatAd: number;
  flatArmour: number;
  critChanceAdd: number;
  abilityDamagePct: number;
  prayerBonusAdd: number;
  notes: string[];
  components: { relic: RelicId; name: string; mult: number; detail: string }[];
  playerDpsMult: number;
  hasIcyenic: boolean;
  hasInfernal: boolean;
  hasNaragi: boolean;
  hasPerkfection: boolean;
  hasDevout: boolean;
}

/** Style bonus 18.7 ≈ rough AD conversion (RS3: style bonus → AD nonlinear; use ~AD*0.004 per point as coarse) */
function styleBonusToAd(styleBonus: number, baselineAd: number): number {
  // Coarse: each style bonus point ≈ 0.35% of a mid AD bar + flat
  return styleBonus * 12 + baselineAd * styleBonus * 0.00035;
}

function resolveOne(
  id: RelicId,
  ctx: RelicCombatContext,
): RelicCombatSlice {
  const notes: string[] = [];
  const components: RelicCombatSlice["components"] = [];
  let dpsMult = 1;
  let flatAd = 0;
  let flatArmour = 0;
  let critChanceAdd = 0;
  let abilityDamagePct = 0;
  let prayerBonusAdd = 0;

  const push = (name: string, mult: number, detail: string) => {
    if (Math.abs(mult - 1) < 0.001 && !detail.includes("flat")) return;
    components.push({ name, mult, detail });
    if (mult !== 1) dpsMult *= mult;
  };

  switch (id) {
    case "infernal-fire": {
      const executeFrac = 0.2;
      const fight = Math.max(15, ctx.fightSeconds);
      const skipWeight = Math.min(0.22, executeFrac * (45 / fight) + 0.08);
      const executeMult = 1 / (1 - skipWeight);
      push(
        "Death Mark execute EV",
        executeMult,
        `skip~${(skipWeight * 100).toFixed(0)}% HP @ ${fight}s fights`,
      );
      const pocketAd = styleBonusToAd(18.7, ctx.baselineAd);
      flatAd += pocketAd;
      prayerBonusAdd += 15;
      notes.push(`Avernic Star pocket +${pocketAd.toFixed(0)} AD eq +15 prayer`);
      components.push({
        name: "Avernic Star pocket style",
        mult: 1,
        detail: `+18.7 style → +${pocketAd.toFixed(0)} AD; +15 prayer`,
      });
      break;
    }
    case "naragi-edict": {
      const uptime = 16.8 / 90;
      const peak = 1.55;
      const duty = 1 + (peak - 1) * uptime;
      push(
        "Naragi 255 duty cycle",
        duty,
        `${(uptime * 100).toFixed(1)}% uptime ×${peak} peak`,
      );
      flatAd += styleBonusToAd(14, ctx.baselineAd);
      flatArmour += 300;
      prayerBonusAdd += 15;
      notes.push("Sliver pocket +300 armour / +14 style / +15 prayer");
      components.push({
        name: "Sliver pocket",
        mult: 1,
        detail: `+14 style AD, +300 armour, +1500 LP, +15 prayer`,
      });
      break;
    }
    case "icyenic-faith": {
      // Tome of the Icyene: +50 prayer; 0.2% crit + 0.2% base AD per 1 prayer bonus
      // Applied structurally in modelCombat (not as opaque end mult) so AD/crit stack correctly
      prayerBonusAdd += 50;
      const prayerTotal = ctx.prayerBonus + prayerBonusAdd;
      abilityDamagePct += prayerTotal * 0.002;
      critChanceAdd += prayerTotal * 0.002;
      components.push({
        name: "Icyenic AD from prayer",
        mult: 1 + abilityDamagePct,
        detail: `prayer ${prayerTotal} → +${(abilityDamagePct * 100).toFixed(1)}% base AD`,
      });
      components.push({
        name: "Icyenic crit from prayer",
        mult: 1 + Math.min(0.5, critChanceAdd) * 0.45,
        detail: `+${(critChanceAdd * 100).toFixed(1)}% crit chance (applied in crit mult)`,
      });
      notes.push(
        "Tome +50 prayer; Protect/Deflect = 100% block + act as Soul Split",
      );
      // dpsMult stays 1 — model applies abilityDamagePct + critChanceAdd
      break;
    }
    case "devout": {
      // Familiar damage handled in summoning.ts; tiny player pad if no familiar modeled
      push("Devout (familiar path)", 1.0, "scroll free + familiar ≤+500% @99 — see summoning");
      notes.push("Combat mult applied on familiar DPS, not player core");
      break;
    }
    case "perkfection": {
      // Helpful perks trigger 20% more often
      push("Helpful perks +20%", 1.2, "Aftershock/Eruptive/etc. proc rate");
      // Toolbox 2 extra gizmo slots — partial EV if already BiS perks
      push("Toolbox extra gizmos EV", 1.04, "2 additional gizmo slots");
      notes.push("No charge drain on augmented gear");
      break;
    }
    case "divine-druid": {
      // Scroll stock + skill boost familiars ×3 — combat scroll uptime
      push("Divine Druid scroll/familiar QoL", 1.03, "10 scrolls/pouch, better familiar uptime");
      break;
    }
    case "assassins-insight": {
      // Corrupted slayer helm effects on task
      push("Corrupted slayer helm effects", 1.045, "on-task (assumed assignment)");
      break;
    }
    case "crystal-grace": {
      // Necro rituals Multiply/Attraction/Protection 200% + Speed 50%
      if (ctx.style === "necromancy") {
        push("Crystal Grace ritual power", 1.06, "ritual glyphs free at high rank");
      } else {
        push("Crystal Grace (off-style)", 1.01, "spell unlocks / utility");
      }
      break;
    }
    case "antiquarian": {
      // Archaeology relic powers available — Fury of the Small etc. EV
      push("Archaeology relic powers unlocked", 1.03, "e.g. Fury of the Small / combat powers");
      break;
    }
    case "production-master":
    case "clue-connoisseur":
    case "endless-harvest":
    case "survivalist":
    case "golden-touch":
    case "superheated":
    case "animal-wrangler":
    case "natures-network":
    case "voidwalker":
    case "transmutation":
    case "rejuvenated":
    case "none":
      push("non-combat / meta", 1, id);
      break;
    default:
      push("unlisted relic", 1, String(id));
  }

  return {
    id,
    dpsMult,
    flatAd,
    flatArmour,
    critChanceAdd,
    abilityDamagePct,
    prayerBonusAdd,
    notes,
    components,
  };
}

export function resolveRelicCombat(
  primary: RelicId | null | undefined,
  secondary: RelicId | null | undefined,
  ctx: RelicCombatContext,
): RelicCombatResult {
  const ids = [primary, secondary].filter(
    (x): x is RelicId => !!x && x !== "none",
  );
  const slices = ids.map((id) => resolveOne(id, ctx));

  let dpsMult = 1;
  let flatAd = 0;
  let flatArmour = 0;
  let critChanceAdd = 0;
  let abilityDamagePct = 0;
  let prayerBonusAdd = 0;
  const notes: string[] = [];
  const components: RelicCombatResult["components"] = [];

  for (const s of slices) {
    dpsMult *= s.dpsMult;
    flatAd += s.flatAd;
    flatArmour += s.flatArmour;
    critChanceAdd += s.critChanceAdd;
    abilityDamagePct += s.abilityDamagePct;
    prayerBonusAdd += s.prayerBonusAdd;
    notes.push(...s.notes.map((n) => `${s.id}: ${n}`));
    for (const c of s.components) {
      components.push({ relic: s.id, ...c });
    }
  }

  // Effective player mult for legacy: multiplicative + structural AD/crit EV
  const structural =
    (1 + abilityDamagePct) *
    (1 + Math.min(0.5, critChanceAdd) * 0.45);
  const playerDpsMult = dpsMult * structural;

  return {
    slices,
    dpsMult,
    flatAd,
    flatArmour,
    critChanceAdd,
    abilityDamagePct,
    prayerBonusAdd,
    notes,
    components,
    playerDpsMult,
    hasIcyenic: ids.includes("icyenic-faith"),
    hasInfernal: ids.includes("infernal-fire"),
    hasNaragi: ids.includes("naragi-edict"),
    hasPerkfection: ids.includes("perkfection"),
    hasDevout: ids.includes("devout"),
  };
}

/** Audit table: every relic’s modeled combat mult at reference context */
export function auditAllRelicCombat(
  catalog: { id: RelicId; assumedTier: number }[],
  ctx?: Partial<RelicCombatContext>,
): {
  id: RelicId;
  tier: number;
  dpsMult: number;
  components: string[];
  combatRelevant: boolean;
}[] {
  const full: RelicCombatContext = {
    prayerBonus: 40,
    fightSeconds: 60,
    style: "melee",
    summoningLevel: 99,
    baselineAd: 7000,
    ...ctx,
  };
  return catalog
    .filter((r) => r.id !== "none")
    .map((row) => {
      const r = resolveOne(row.id, full);
      return {
        id: row.id,
        tier: row.assumedTier,
        dpsMult: +r.dpsMult.toFixed(4),
        components: r.components.map(
          (c) => `${c.name}:×${c.mult.toFixed(3)} (${c.detail})`,
        ),
        combatRelevant: r.dpsMult > 1.001 || r.flatAd > 1 || r.critChanceAdd > 0,
      };
    })
    .sort((a, b) => a.tier - b.tier || b.dpsMult - a.dpsMult);
}
