/**
 * Declarative drop sources + EV calculator.
 * No acquisition plan logic — only kills → hours.
 */

import type { RegionTag } from "../requirements";
import { learnTaxHours, RARE_MULT_SCENARIOS } from "../league-passives";
import {
  couponCollectorKills,
  couponCollectorP90,
  expectedKills,
  geometricQuantile,
  hoursFromKills,
} from "./math";

export interface DropSource {
  id: string;
  name: string;
  /** Base 1/N before league rare mult */
  rateDenom: number;
  killsPerHour: number;
  regions: RegionTag[];
  notes: string;
  learnKills?: number;
  slowFactor?: number;
  rareMultApplies?: boolean;
}

/** Wiki-backed boss / slayer sources — data only */
export const DROP_SOURCES = {
  rasial: {
    id: "rasial",
    name: "Rasial, the First Necromancer",
    rateDenom: 640,
    killsPerHour: 24,
    regions: ["free", "misthalin"] as RegionTag[],
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
    regions: ["free", "misthalin"] as RegionTag[],
    notes: "Unique 1/5400@60 → ~1/450@420+. Model 1/600 solid contrib.",
    learnKills: 15,
    slowFactor: 0.6,
    rareMultApplies: true,
  },
  kerapac: {
    id: "kerapac",
    name: "Kerapac (bound) — FSOA pieces",
    rateDenom: 133,
    killsPerHour: 12,
    regions: ["anachronia"] as RegionTag[],
    notes: "~1/400/pile ×3 piles ≈ 1/133/kill per piece.",
    learnKills: 20,
    slowFactor: 0.45,
    rareMultApplies: true,
  },
  kalphiteKing: {
    id: "kalphite-king",
    name: "Kalphite King — Drygores",
    rateDenom: 84,
    killsPerHour: 20,
    regions: ["desert"] as RegionTag[],
    notes: "Dual drygore EV on ~1/84 shared model.",
    learnKills: 15,
    slowFactor: 0.55,
    rareMultApplies: true,
  },
  lostGroveOnTask: {
    id: "lost-grove-task",
    name: "Lost Grove Slayer (on-task)",
    rateDenom: 1500,
    killsPerHour: 200,
    regions: ["tirannwn"] as RegionTag[],
    notes: "Cinderbane 1/1500 on-task.",
    learnKills: 0,
    rareMultApplies: true,
  },
  solak: {
    id: "solak",
    name: "Solak",
    rateDenom: 1000,
    killsPerHour: 7,
    regions: ["tirannwn"] as RegionTag[],
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
    regions: ["asgarnia"] as RegionTag[],
    notes: "Coarse EV for seismic/rod-adjacent.",
    learnKills: 15,
    slowFactor: 0.4,
    rareMultApplies: true,
  },
} as const satisfies Record<string, DropSource>;

export type DropSourceId = keyof typeof DROP_SOURCES;

export interface DropCalcOpts {
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
  sourceId: DropSourceId,
  opts: DropCalcOpts = {},
): DropCalcResult {
  const src = DROP_SOURCES[sourceId] as DropSource;
  const rareMult =
    opts.rareMult ??
    (src.rareMultApplies === false ? 1 : RARE_MULT_SCENARIOS.lateT6);
  const baseRate = opts.rateDenom ?? src.rateDenom;
  const rateEffective = Math.max(1, baseRate / rareMult);
  const pieces = opts.pieces ?? 1;
  const kph = opts.kph ?? src.killsPerHour;

  const expK =
    pieces > 1
      ? couponCollectorKills(rateEffective, pieces)
      : expectedKills(rateEffective);
  const p50Kills =
    pieces > 1 ? expK * 0.92 : geometricQuantile(rateEffective, 0.5);
  const p90Kills =
    pieces > 1
      ? couponCollectorP90(rateEffective, pieces)
      : geometricQuantile(rateEffective, 0.9);

  const tax = (kills: number) =>
    opts.applyLearnTax === false
      ? hoursFromKills(kills, kph)
      : learnTaxHours(kills, kph, {
          learnKills: src.learnKills,
          slowFactor: src.slowFactor,
        });

  return {
    source: src,
    rateEffective,
    rareMult,
    expectedKills: expK,
    p50Kills,
    p90Kills,
    hoursMean: tax(expK),
    hoursP50: tax(p50Kills),
    hoursP90: tax(p90Kills),
    hoursPeakNoLearn: hoursFromKills(expK, kph),
  };
}
