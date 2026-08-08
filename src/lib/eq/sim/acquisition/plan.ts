/**
 * Compose wall-clock acquisition plan from recipe + costs + skill union.
 */

import type { SkillId } from "../../xp";
import { chartSkillLeaguePhased } from "../league-hours";
import {
  rareMultAtTier,
  RARE_MULT_SCENARIOS,
} from "../league-passives";
import { costRequirement } from "../req-hours";
import { AllReq, SkillReq, RegionReq, type RegionTag } from "../requirements";
import { COMPONENT_BY_ID } from "./components";
import { costComponent } from "./cost";
import {
  COMBAT_BUNDLE_FACTOR,
  COMBAT_SKILLS,
  PARALLEL_COMBAT_EFFICIENCY,
  STARTER_REGIONS,
} from "./math";
import { recipeForBuild } from "./recipes";
import type {
  AcquisitionPlan,
  BuildSpec,
  ComponentCost,
} from "./types";

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
  return (Object.entries(maxLvl) as [SkillId, number][]).map(([sk, lvl]) => ({
    skill: sk,
    level: lvl,
    hours: chartSkillLeaguePhased(sk, 1, lvl, electives).hours,
  }));
}

function compressSkills(rows: { skill: SkillId; hours: number }[]) {
  const combat = new Set<string>(COMBAT_SKILLS);
  let maxC = 0;
  let support = 0;
  for (const r of rows) {
    if (combat.has(r.skill)) maxC = Math.max(maxC, r.hours);
    else support += r.hours;
  }
  const combatBundle = maxC * COMBAT_BUNDLE_FACTOR;
  return { combatBundle, support, total: combatBundle + support };
}

function regionFlagHedgeHours(
  recipe: string[],
  electives: readonly string[],
  rareMult: number,
  skillUnionHours: number,
): number {
  const paid = new Set<string>();
  let reqGraphHours = 0;
  for (const id of recipe) {
    const c = COMPONENT_BY_ID[id];
    if (!c) continue;
    const parts: (SkillReq | RegionReq)[] = [];
    if (c.skillReqs) {
      for (const [sk, lvl] of Object.entries(c.skillReqs)) {
        if (lvl && (lvl as number) > 1) {
          parts.push(new SkillReq(sk as SkillId, lvl as number));
        }
      }
    }
    if (c.requiresAllRegions) {
      for (const r of c.requiresAllRegions) parts.push(new RegionReq(r));
    }
    if (parts.length) {
      reqGraphHours += costRequirement(new AllReq(parts), {
        electives,
        rareMult,
        paid,
      }).hours;
    } else if ((c.fixedHoursFn?.() ?? c.fixedHours ?? 0) < 0.05 && !c.drop) {
      reqGraphHours += 0.15;
    }
  }
  return Math.max(0, reqGraphHours - skillUnionHours);
}

export function planAcquisition(spec: BuildSpec): AcquisitionPlan {
  const have = new Set<RegionTag>([
    ...(STARTER_REGIONS as unknown as RegionTag[]),
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
    // Skills handled once via union — zero out per-component skill hours
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
    Math.min(combatExclusiveHours, skillComp.combatBundle) *
    PARALLEL_COMBAT_EFFICIENCY;

  const hedge = regionFlagHedgeHours(
    recipe,
    spec.electives,
    rareMult,
    skillUnionHours,
  );

  const base =
    Math.max(0, skillUnionHours - parallelCredit) + exclusiveHours;
  const wallClockMean = base + hedge;
  const nonDropExcl = exclusiveHours - meanDrop;
  const wallClockP50 =
    Math.max(0, skillUnionHours - parallelCredit) +
    nonDropExcl +
    p50Drop * 0.95 +
    hedge;
  const wallClockP90 = wallClockMean + p90Extra;

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
    const par =
      Math.min(combatEx, skillComp.combatBundle) * PARALLEL_COMBAT_EFFICIENCY;
    sensitivity[label] = Math.max(0, skillUnionHours - par) + excl;
  }

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
    breakdown: [
      `Farm league tier ${farmTier} → rare ×${rareMult}`,
      `Skills union: ${skillUnionHours.toFixed(1)}h (combat ${skillComp.combatBundle.toFixed(1)} + support ${skillComp.support.toFixed(1)})`,
      `Exclusive: ${exclusiveHours.toFixed(1)}h (combat-train ${combatExclusiveHours.toFixed(1)}h)`,
      `Parallel −${parallelCredit.toFixed(1)}h · region/flag hedge +${hedge.toFixed(1)}h`,
      `WALL mean ${wallClockMean.toFixed(1)}h · p50 ${wallClockP50.toFixed(1)}h · p90 ${wallClockP90.toFixed(1)}h`,
      `Sensitivity: ${Object.entries(sensitivity)
        .map(([k, v]) => `${k}=${v.toFixed(0)}`)
        .join(" · ")}`,
    ],
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
