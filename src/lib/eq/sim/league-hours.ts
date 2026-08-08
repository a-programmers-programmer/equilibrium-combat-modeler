/**
 * Wall-clock hours to combat power — WITH Equilibrium league XP mults.
 *
 * Mult schedule (wiki / xp.ts LEAGUE_XP_MULT):
 *   Relic T1–2 → 5×
 *   Relic T2–3 → 8×   (we use T2+)
 *   Relic T4–5 → 12×
 *   Relic T6+  → 16×
 *
 * Skill XP is charted in phases so early levels burn at 5× and late at 16×,
 * not a flat end-tier mult (that would understate early grind).
 *
 * Non-XP pads (bosses, regions, drops) are separate — mults don't apply.
 */

import {
  chartSkill,
  leagueMultForRelicTier,
  LEAGUE_XP_MULT,
  type SkillId,
  type RegionTag,
} from "../xp";
import type { Style } from "../gear";
import type { ArmourProfileId } from "./armour";
import type { PoisonKitId } from "./poison";
import type { FamiliarId } from "./summoning";

/** Level bands → relic tier for mult (when a typical leaguer hits that band) */
const LEVEL_PHASES: { upTo: number; relicTier: number }[] = [
  { upTo: 50, relicTier: 1 }, // 5×
  { upTo: 70, relicTier: 2 }, // 8×
  { upTo: 90, relicTier: 4 }, // 12×
  { upTo: 120, relicTier: 6 }, // 16×
];

export function multAtLevel(level: number): number {
  let tier = 1;
  for (const p of LEVEL_PHASES) {
    if (level < p.upTo) {
      tier = p.relicTier;
      break;
    }
    tier = p.relicTier;
  }
  // for level exactly at boundary use that phase's tier
  for (let i = 0; i < LEVEL_PHASES.length; i++) {
    const p = LEVEL_PHASES[i]!;
    const prev = i === 0 ? 1 : LEVEL_PHASES[i - 1]!.upTo;
    if (level >= prev && level < p.upTo) return leagueMultForRelicTier(p.relicTier);
  }
  return leagueMultForRelicTier(6);
}

/**
 * Chart skill with phased league mults (not flat end-tier).
 */
export function chartSkillLeaguePhased(
  skill: SkillId,
  fromLevel: number,
  toLevel: number,
  electives: readonly string[],
): {
  hours: number;
  steps: {
    from: number;
    to: number;
    mult: number;
    hours: number;
    method: string;
    effectiveXpHr: number;
  }[];
} {
  const steps: {
    from: number;
    to: number;
    mult: number;
    hours: number;
    method: string;
    effectiveXpHr: number;
  }[] = [];
  let total = 0;
  let lvl = fromLevel;
  while (lvl < toLevel) {
    // Find phase end
    const phase = LEVEL_PHASES.find((p) => lvl < p.upTo) ?? LEVEL_PHASES[LEVEL_PHASES.length - 1]!;
    const phaseEnd = Math.min(toLevel, phase.upTo);
    if (phaseEnd <= lvl) {
      lvl++;
      continue;
    }
    const mult = leagueMultForRelicTier(phase.relicTier);
    // Use chartSkill with this phase's relic tier for method selection + mult
    const picks = chartSkill(skill, lvl, phaseEnd, electives, phase.relicTier);
    for (const p of picks) {
      const h = Number.isFinite(p.hours) ? p.hours : 0;
      total += h;
      steps.push({
        from: p.levelFrom,
        to: p.levelTo,
        mult: p.leagueMult,
        hours: h,
        method: p.method.name,
        effectiveXpHr: p.effectiveXpHr,
      });
    }
    lvl = phaseEnd;
  }
  return { hours: total, steps };
}

export interface PowerTargets {
  /** Primary combat style levels */
  style: Style;
  combatLevel: number; // attack/str/def/magic/range/necro primary
  constitution: number;
  prayer: number;
  herblore: number;
  summoning: number;
  slayer: number;
  invention: number;
  archaeology: number;
  /** Secondary skills often needed */
  crafting?: number;
  smithing?: number;
  divination?: number;
  dungeoneering?: number;
  farming?: number;
}

export function targetsForBuild(opts: {
  style: Style;
  armour: ArmourProfileId;
  poison: PoisonKitId;
  familiar: FamiliarId;
  relicKey: string;
  endgame: boolean;
}): PowerTargets {
  const end = opts.endgame;
  const combat = end ? 99 : 90;
  const styleCombat =
    opts.style === "necromancy"
      ? { necromancy: end ? 99 : 90 }
      : opts.style === "magic"
        ? { magic: combat }
        : opts.style === "ranged"
          ? { ranged: combat }
          : { attack: combat, strength: combat };

  const inv =
    opts.armour === "power-bis" ||
    opts.armour === "masterwork-tank" ||
    opts.armour.includes("sirenic") ||
    opts.armour.includes("tectonic")
      ? end
        ? 90
        : 70
      : opts.armour === "mixed-aegis-power"
        ? 80
        : 1;

  const sum =
    opts.familiar === "none"
      ? 1
      : opts.familiar === "steel-titan"
        ? 99
        : opts.familiar === "ripper-demon" || opts.familiar === "ice-nihil"
          ? 99
          : 95;

  const herb =
    opts.poison !== "none" || end
      ? 106
      : opts.relicKey.includes("infernal")
        ? 96
        : 70;

  return {
    style: opts.style,
    combatLevel: combat,
    constitution: end ? 99 : 80,
    prayer: end ? 99 : 70,
    herblore: herb,
    summoning: sum,
    slayer: end ? 99 : 80,
    invention: inv,
    archaeology: opts.armour === "masterwork-tank" || end ? (end ? 90 : 70) : 1,
    crafting: inv >= 80 ? 80 : 1,
    smithing: inv >= 80 ? 80 : 1,
    divination: inv >= 80 ? 80 : 1,
    dungeoneering: opts.familiar === "kalgerion-demon" ? 90 : end ? 80 : 1,
    farming: 1,
  };
}

/** Skills list from targets for parallel-ish max accounting */
function skillGoals(t: PowerTargets): Partial<Record<SkillId, number>> {
  const g: Partial<Record<SkillId, number>> = {
    constitution: t.constitution,
    prayer: t.prayer,
    herblore: t.herblore,
    summoning: t.summoning,
    slayer: t.slayer,
  };
  if (t.style === "necromancy") g.necromancy = t.combatLevel;
  else if (t.style === "magic") g.magic = t.combatLevel;
  else if (t.style === "ranged") g.ranged = t.combatLevel;
  else {
    g.attack = t.combatLevel;
    g.strength = t.combatLevel;
    g.defence = Math.min(99, t.combatLevel);
  }
  // Always some defence for tank armour
  g.defence = Math.max(g.defence ?? 1, t.style === "necromancy" ? 70 : t.combatLevel);
  if (t.invention > 1) g.invention = t.invention;
  if (t.archaeology > 1) g.archaeology = t.archaeology;
  if ((t.crafting ?? 1) > 1) g.crafting = t.crafting;
  if ((t.smithing ?? 1) > 1) g.smithing = t.smithing;
  if ((t.divination ?? 1) > 1) g.divination = t.divination;
  if ((t.dungeoneering ?? 1) > 1) g.dungeoneering = t.dungeoneering;
  return g;
}

/**
 * XP training hours with league mults.
 * Combat skills that train together: take max of attack/str path, not sum
 * (slayer multi-trains). We still sum distinct trees but discount combat bundle.
 */
export function skillHoursLeague(
  targets: PowerTargets,
  electives: readonly string[],
): {
  totalHours: number;
  bySkill: { skill: SkillId; hours: number; multAvg: number }[];
  combatBundleHours: number;
  supportHours: number;
} {
  const goals = skillGoals(targets);
  const bySkill: { skill: SkillId; hours: number; multAvg: number }[] = [];

  const combatSkills = new Set<SkillId>([
    "attack",
    "strength",
    "defence",
    "magic",
    "ranged",
    "necromancy",
    "constitution",
    "slayer",
  ]);

  let combatMax = 0;
  let support = 0;

  for (const [skill, to] of Object.entries(goals) as [SkillId, number][]) {
    if (!to || to <= 1) continue;
    const { hours, steps } = chartSkillLeaguePhased(skill, 1, to, electives);
    const multAvg =
      steps.length > 0
        ? steps.reduce((a, s) => a + s.mult * s.hours, 0) / Math.max(0.001, hours)
        : 5;
    bySkill.push({ skill, hours, multAvg });
    if (combatSkills.has(skill)) {
      combatMax = Math.max(combatMax, hours);
    } else {
      support += hours;
    }
  }

  // Combat bundle: primary style + constitution + slayer heavily overlap
  // Use 1.15× max combat skill as total combat training time
  const combatBundleHours = combatMax * 1.15;
  const totalHours = combatBundleHours + support;

  return { totalHours, bySkill, combatBundleHours, supportHours: support };
}

/** Fixed content pads — NOT multiplied by league XP */
export const CONTENT_PADS: {
  id: string;
  hours: number;
  when: (ctx: HoursContext) => boolean;
  label: string;
}[] = [
  {
    id: "tutorial-start",
    hours: 1.5,
    when: () => true,
    label: "League start / tutorial / first unlocks",
  },
  {
    id: "relic-ladder",
    hours: 6,
    when: (c) => c.relicKey !== "none",
    label: "Relic tasks T1→T7 (non-XP tasks)",
  },
  {
    id: "region-forinthry",
    hours: 4,
    when: (c) => c.regions.includes("forinthry"),
    label: "Forinthry unlock + early wildy",
  },
  {
    id: "region-desert",
    hours: 3.5,
    when: (c) => c.regions.includes("desert"),
    label: "Desert unlock + key quests",
  },
  {
    id: "region-anachronia",
    hours: 5,
    when: (c) => c.regions.includes("anachronia"),
    label: "Anachronia unlock + base camp",
  },
  {
    id: "region-tirannwn",
    hours: 6,
    when: (c) => c.regions.includes("tirannwn"),
    label: "Tirannwn / Prif / Lost Grove access",
  },
  {
    id: "region-mory",
    hours: 3,
    when: (c) => c.regions.includes("morytania"),
    label: "Morytania unlock",
  },
  {
    id: "region-asgarnia",
    hours: 3,
    when: (c) => c.regions.includes("asgarnia"),
    label: "Asgarnia / Invention guild path",
  },
  {
    id: "boss-rasial-necro",
    hours: 8,
    when: (c) => c.style === "necromancy" && c.endgame,
    label: "Rasial / necro BiS grind",
  },
  {
    id: "boss-mid-gear",
    hours: 5,
    when: (c) => !c.endgame,
    label: "Mid-game boss gear pads",
  },
  {
    id: "boss-end-style",
    hours: 10,
    when: (c) => c.endgame && c.style !== "necromancy",
    label: "Style BiS boss grind (non-necro)",
  },
  {
    id: "fam-steel-titan",
    hours: 1.5,
    when: (c) => c.familiar === "steel-titan",
    label: "Steel titan pouch unlock",
  },
  {
    id: "fam-nihil",
    hours: 4,
    when: (c) => c.familiar === "ice-nihil" || c.familiar === "blood-nihil",
    label: "Nihil pouches / contracts",
  },
  {
    id: "fam-ripper",
    hours: 5,
    when: (c) => c.familiar === "ripper-demon",
    label: "Ripper binding contract grind",
  },
  {
    id: "cinderbane-drop",
    hours: 6,
    when: (c) =>
      c.poison === "wp-cinder" ||
      c.poison === "full-melee-poison" ||
      c.poison === "full-ranged-blowpipe" ||
      c.poison === "cinder-only" ||
      c.poison === "reaver-cinder",
    label: "Cinderbane gloves EV (Lost Grove/Solak)",
  },
  {
    id: "armour-mw",
    hours: 4,
    when: (c) => c.armour === "masterwork-tank",
    label: "Masterwork smithing/assembly pad",
  },
  {
    id: "armour-power-bis",
    hours: 5,
    when: (c) =>
      c.armour === "power-bis" ||
      c.armour === "sirenic-power" ||
      c.armour === "tectonic-power",
    label: "Power armour piece grind",
  },
  {
    id: "invention-standard",
    hours: 4,
    when: (c) => c.regions.includes("asgarnia"),
    label: "Invention unlock + early gizmos (Asgarnia)",
  },
  {
    id: "invention-ancient",
    hours: 5,
    when: (c) => c.regions.includes("kandarin") && c.regions.includes("asgarnia"),
    label: "Ancient Invention / Stormguard (Kandarin)",
  },
  {
    id: "herb-ovl-unlock",
    hours: 1,
    when: (c) => c.poison !== "none" || c.endgame,
    label: "Overload / WP+++ setup",
  },
];

export interface HoursContext {
  style: Style;
  regions: RegionTag[];
  electives: string[];
  armour: ArmourProfileId;
  poison: PoisonKitId;
  familiar: FamiliarId;
  relicKey: string;
  endgame: boolean;
}

export interface LeagueHoursResult {
  /** Total wall-clock hours */
  totalHours: number;
  skillHours: number;
  contentPadHours: number;
  combatBundleHours: number;
  supportSkillHours: number;
  bySkill: { skill: SkillId; hours: number; multAvg: number }[];
  pads: { id: string; hours: number; label: string }[];
  /** Effective average XP mult experienced */
  effectiveMult: number;
  multSchedule: typeof LEAGUE_XP_MULT;
  breakdown: string[];
}

export function hoursToPower(ctx: HoursContext): LeagueHoursResult {
  const targets = targetsForBuild({
    style: ctx.style,
    armour: ctx.armour,
    poison: ctx.poison,
    familiar: ctx.familiar,
    relicKey: ctx.relicKey,
    endgame: ctx.endgame,
  });

  // Electives for method region gates (xp.ts uses string electives)
  const electives = ctx.electives.length
    ? ctx.electives
    : ctx.regions.filter((r) => !["free", "misthalin", "havenhythe", "karamja"].includes(r));

  const skills = skillHoursLeague(targets, electives);
  const pads = CONTENT_PADS.filter((p) => p.when(ctx)).map((p) => ({
    id: p.id,
    hours: p.hours,
    label: p.label,
  }));
  const contentPadHours = pads.reduce((a, p) => a + p.hours, 0);
  const totalHours = skills.totalHours + contentPadHours;

  // Effective mult: weighted by skill hours
  let multNum = 0;
  let multDen = 0;
  for (const s of skills.bySkill) {
    multNum += s.multAvg * s.hours;
    multDen += s.hours;
  }
  const effectiveMult = multDen > 0 ? multNum / multDen : 5;

  const breakdown = [
    `Skills (league mult phased 5×→16×): ${skills.totalHours.toFixed(1)}h`,
    `  combat bundle: ${skills.combatBundleHours.toFixed(1)}h`,
    `  support skills: ${skills.supportHours.toFixed(1)}h`,
    `Content pads (no XP mult): ${contentPadHours.toFixed(1)}h`,
    `Effective avg mult: ${effectiveMult.toFixed(1)}×`,
    `TOTAL: ${totalHours.toFixed(1)}h`,
  ];

  return {
    totalHours,
    skillHours: skills.totalHours,
    contentPadHours,
    combatBundleHours: skills.combatBundleHours,
    supportSkillHours: skills.supportHours,
    bySkill: skills.bySkill,
    pads,
    effectiveMult,
    multSchedule: LEAGUE_XP_MULT,
    breakdown,
  };
}

/** Compare same skill goal at flat mults (debug) */
export function hoursIfFlatMult(
  skill: SkillId,
  toLevel: number,
  electives: readonly string[],
  flatMult: number,
): number {
  // Map mult to relic tier
  const tier = flatMult >= 16 ? 6 : flatMult >= 12 ? 4 : flatMult >= 8 ? 2 : 1;
  const picks = chartSkill(skill, 1, toLevel, electives, tier);
  return picks.reduce((a, p) => a + (Number.isFinite(p.hours) ? p.hours : 0), 0);
}
