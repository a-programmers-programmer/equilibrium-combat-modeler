/**
 * Lab helpers: rank blessing paths under a fixed gear snapshot,
 * and rank region packages under a fixed blessing path.
 */

import type { Path } from "./blessings";
import type { BuildArchetype, Style } from "./gear";
import { stageById } from "./gear";
import {
  modelCombat,
  gearFromPackage,
  gearFromRegions,
  type GearSnapshot,
  type ModelResult,
} from "./model";
import { PRESETS } from "./presets";
import {
  REGION_PACKAGES,
  ELECTIVE_REGION_IDS,
  type RegionId,
  type RegionPackage,
} from "./items";

export const CROWN_PATHS: { id: string; name: string; picks: Path[]; note: string }[] = [
  {
    id: "oocobo",
    name: "OOCOBO Crown ST",
    picks: ["Order", "Order", "Chaos", "Order", "Balance", "Order"],
    note: "Aegis + Striking + Avernic + Higher Power + Thorns + Tempered + Fervor + Genesis",
  },
  {
    id: "ocoooc",
    name: "OCOOOC Crown Multi",
    picks: ["Order", "Chaos", "Order", "Order", "Order", "Chaos"],
    note: "Aegis + Cinders + Steadfast + Higher Power + Lord + Perfidious + Fervor + Genesis",
  },
  {
    id: "oocobb",
    name: "OOCOBB DoT Runner",
    picks: ["Order", "Order", "Chaos", "Order", "Balance", "Balance"],
    note: "Aegis + Avernic + Higher Power + Thorns + Envenomed",
  },
  {
    id: "ocoboc",
    name: "OCOBOC Keep Ultimates",
    picks: ["Order", "Chaos", "Order", "Balance", "Order", "Chaos"],
    note: "No Higher Power — keep Living Death / Berserk / Sunshine",
  },
  {
    id: "oooooo",
    name: "Pure Order",
    picks: ["Order", "Order", "Order", "Order", "Order", "Order"],
    note: "Classic full Sara — strong but not lab-optimal",
  },
  {
    id: "booobo",
    name: "Best Big Boned",
    picks: ["Balance", "Order", "Order", "Order", "Balance", "Order"],
    note: "Best BB family package in prior sweeps",
  },
  {
    id: "cccccc",
    name: "Full Chaos",
    picks: ["Chaos", "Chaos", "Chaos", "Chaos", "Chaos", "Chaos"],
    note: "Burst kit — trails sustained DPS hard",
  },
];

export interface RankedPath {
  id: string;
  name: string;
  picks: Path[];
  note: string;
  result: ModelResult;
}

export interface RankedRegion {
  pkg: RegionPackage;
  result: ModelResult;
  armour: number;
  weaponTier: number;
}

export function rankPaths(opts: {
  style: Style;
  archetype: BuildArchetype;
  gear: GearSnapshot;
  multi?: number;
  herblore?: number;
}): RankedPath[] {
  const multi = opts.multi ?? 0.1;
  const herblore = opts.herblore ?? 110;
  const stage = stageById("endgame");

  return CROWN_PATHS.map((c) => ({
    ...c,
    result: modelCombat({
      picks: c.picks,
      style: opts.style,
      stage,
      archetype: opts.archetype,
      herbloreLevel: herblore,
      targetTiles: multi > 0.4 ? 9 : 1,
      multiContentWeight: multi,
      powerburst: true,
      gear: opts.gear,
    }),
  })).sort((a, b) => b.result.dps - a.result.dps);
}

export function rankPresets(opts: {
  style: Style;
  archetype: BuildArchetype;
  gear: GearSnapshot;
  multi?: number;
}): RankedPath[] {
  const multi = opts.multi ?? 0.1;
  const stage = stageById("endgame");
  return PRESETS.map((p) => ({
    id: p.id,
    name: p.name,
    picks: [...p.picks],
    note: p.description,
    result: modelCombat({
      picks: [...p.picks],
      style: opts.style,
      stage,
      archetype: p.preferredArchetype,
      herbloreLevel: 110,
      targetTiles: multi > 0.4 ? 9 : 1,
      multiContentWeight: multi,
      powerburst: true,
      gear: opts.gear,
    }),
  })).sort((a, b) => b.result.dps - a.result.dps);
}

export function rankRegions(opts: {
  picks: Path[];
  style: Style;
  archetype: BuildArchetype;
  multi?: number;
}): RankedRegion[] {
  const multi = opts.multi ?? 0.1;
  const stage = stageById("endgame");
  return REGION_PACKAGES.map((pkg) => {
    const { snapshot } = gearFromPackage(pkg, opts.style, opts.archetype);
    const result = modelCombat({
      picks: opts.picks,
      style: opts.style,
      stage,
      archetype: opts.archetype,
      herbloreLevel: 110,
      targetTiles: multi > 0.4 ? 9 : 1,
      multiContentWeight: multi,
      powerburst: true,
      gear: snapshot,
    });
    return {
      pkg,
      result,
      armour: snapshot.armour,
      weaponTier: snapshot.weaponTier,
    };
  }).sort((a, b) => b.result.dps - a.result.dps);
}

export function gearFromCustomElectives(
  electives: readonly RegionId[],
  style: Style,
  archetype: BuildArchetype,
) {
  const clean = electives
    .filter((e) => (ELECTIVE_REGION_IDS as readonly string[]).includes(e))
    .slice(0, 3);
  return gearFromRegions(clean, style, archetype);
}

export function formatBuildShare(opts: {
  picks: Path[];
  style: Style;
  archetype: BuildArchetype;
  electives: RegionId[];
  dps: number;
  mult: number;
  armour: number;
  ad: number;
  pieces: string[];
}): string {
  const path = opts.picks.map((p) => p[0]).join("");
  return [
    `RS3 Equilibrium Build`,
    `Path: ${path} (${opts.picks.join(" → ")})`,
    `Style: ${opts.style} · ${opts.archetype}`,
    `Electives: ${opts.electives.length ? opts.electives.join(", ") : "none (free only)"}`,
    `Model DPS: ${Math.round(opts.dps)} (${opts.mult.toFixed(2)}× baseline)`,
    `AD ${opts.ad} · Armour ${opts.armour}`,
    `Gear: ${opts.pieces.join(" · ")}`,
    `— Equilibrium Combat Modeler (relative model, not live parse)`,
  ].join("\n");
}
