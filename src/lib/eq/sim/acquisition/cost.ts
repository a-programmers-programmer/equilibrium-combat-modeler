/**
 * Cost a single AcqComponent → exclusive hours + optional drop detail.
 */

import type { SkillId } from "../../xp";
import { chartSkillLeaguePhased } from "../league-hours";
import type { RegionTag } from "../requirements";
import { calcDrop } from "./drops";
import { MIN_COMPONENT_HOURS } from "./math";
import type { AcqComponent, ComponentCost } from "./types";

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
  let dropDetail: ComponentCost["dropDetail"];

  if (c.drop) {
    dropDetail = calcDrop(c.drop.sourceId, {
      rareMult: opts?.rareMult,
      pieces: c.drop.pieces,
      rateDenom: c.drop.rateDenom,
      kph: c.drop.kph,
    });
    exclusiveHours += dropDetail.hoursMean;
    notes.push(
      `Drop EV ${dropDetail.expectedKills.toFixed(0)} kills @ rare×${dropDetail.rareMult} → ${dropDetail.hoursMean.toFixed(1)}h mean / ${dropDetail.hoursP90.toFixed(1)}h p90`,
    );
  }

  if (opts?.perkfection && c.perkfectionMult != null) {
    exclusiveHours *= c.perkfectionMult;
    notes.push(`Perkfection ×${c.perkfectionMult}`);
  }

  if (c.kind !== "skill" && exclusiveHours < MIN_COMPONENT_HOURS && !dropDetail) {
    exclusiveHours = MIN_COMPONENT_HOURS;
    notes.push(`Min unlock hedge ${MIN_COMPONENT_HOURS}h`);
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
