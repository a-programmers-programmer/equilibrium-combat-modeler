/** Gear progression stages (abstract fallback) + re-exports for region system. */

import type { Offhand } from "./blessings";

export type Style = "necromancy" | "melee" | "magic" | "ranged";
export type GearStageId = "early" | "mid" | "late" | "endgame";
export type BuildArchetype = "shield-tank" | "defender" | "power-dps";

export interface GearStage {
  id: GearStageId;
  label: string;
  description: string;
  regionsNote: string;
  armour: Record<BuildArchetype, number>;
  baseLp: Record<BuildArchetype, number>;
  baselineAd: Record<Style, number>;
  genesisAdBonus: Record<Style, number>;
  prayerBonus: number;
}

/** Abstract stages — used when region loadout is not selected. Prefer items.ts packages. */
export const GEAR_STAGES: readonly GearStage[] = [
  {
    id: "early",
    label: "Early (free regions)",
    description: "Misthalin + Havenhythe + Karamja only. Still has style T95s from free bosses.",
    regionsNote: "No electives",
    armour: { "shield-tank": 1400, defender: 1200, "power-dps": 900 },
    baseLp: { "shield-tank": 14000, defender: 13000, "power-dps": 12000 },
    baselineAd: { necromancy: 2800, melee: 3000, magic: 3100, ranged: 3100 },
    genesisAdBonus: { necromancy: 600, melee: 650, magic: 620, ranged: 620 },
    prayerBonus: 8,
  },
  {
    id: "mid",
    label: "Mid (1 elective)",
    description: "One elective online — typically Wildy or Asgarnia for shields/jewellery.",
    regionsNote: "+ 1 elective",
    armour: { "shield-tank": 2000, defender: 1700, "power-dps": 1300 },
    baseLp: { "shield-tank": 17000, defender: 15500, "power-dps": 14500 },
    baselineAd: { necromancy: 3200, melee: 3300, magic: 3300, ranged: 3300 },
    genesisAdBonus: { necromancy: 700, melee: 750, magic: 720, ranged: 720 },
    prayerBonus: 12,
  },
  {
    id: "late",
    label: "Late (2–3 electives)",
    description: "Strong region package mid-league.",
    regionsNote: "2–3 electives",
    armour: { "shield-tank": 2450, defender: 2100, "power-dps": 1600 },
    baseLp: { "shield-tank": 20000, defender: 18000, "power-dps": 16500 },
    baselineAd: { necromancy: 3600, melee: 3700, magic: 3650, ranged: 3650 },
    genesisAdBonus: { necromancy: 800, melee: 850, magic: 820, ranged: 820 },
    prayerBonus: 18,
  },
  {
    id: "endgame",
    label: "Push (full 3 electives + BiS)",
    description: "Best gear from chosen 3 electives. Prefer region packages over this abstract tier.",
    regionsNote: "Full 3 electives",
    armour: { "shield-tank": 2800, defender: 2400, "power-dps": 1850 },
    baseLp: { "shield-tank": 23000, defender: 20500, "power-dps": 18500 },
    baselineAd: { necromancy: 4000, melee: 4100, magic: 4050, ranged: 4050 },
    genesisAdBonus: { necromancy: 900, melee: 950, magic: 920, ranged: 920 },
    prayerBonus: 24,
  },
];

export function stageById(id: GearStageId): GearStage {
  return GEAR_STAGES.find((s) => s.id === id) ?? GEAR_STAGES[2]!;
}

export function offhandForArchetype(a: BuildArchetype): Offhand {
  if (a === "shield-tank") return "shield";
  if (a === "defender") return "defender";
  return "none";
}

export interface StyleProfile {
  id: Style;
  label: string;
  hitsPerSecond: number;
  multiHitShare: number;
  basicsPerSecond: number;
  dotDensity: number;
  notes: string;
}

export const STYLES: readonly StyleProfile[] = [
  {
    id: "necromancy",
    label: "Necromancy",
    hitsPerSecond: 2.4,
    multiHitShare: 0.55,
    basicsPerSecond: 0.9,
    dotDensity: 0.7,
    notes: "Conjures + multi abilities. Free-region BiS (Rasial) is complete.",
  },
  {
    id: "melee",
    label: "Melee",
    hitsPerSecond: 2.1,
    multiHitShare: 0.4,
    basicsPerSecond: 0.7,
    dotDensity: 0.45,
    notes: "EZK free; drygores need Desert; shields need Mory/Asgarnia.",
  },
  {
    id: "magic",
    label: "Magic",
    hitsPerSecond: 2.0,
    multiHitShare: 0.45,
    basicsPerSecond: 0.65,
    dotDensity: 0.55,
    notes: "FSOA + Cryptbloom free — strongest free-region style with Aegis.",
  },
  {
    id: "ranged",
    label: "Ranged",
    hitsPerSecond: 1.9,
    multiHitShare: 0.35,
    basicsPerSecond: 0.6,
    dotDensity: 0.35,
    notes: "BOLG + Dracolich free; Asc/Blightbound need electives.",
  },
];

export function styleById(id: Style): StyleProfile {
  return STYLES.find((s) => s.id === id) ?? STYLES[0]!;
}

/** @deprecated Use REGIONS from items.ts — kept for UI tables during migration */
export { REGIONS, FREE_REGION_IDS, ELECTIVE_REGION_IDS, REGION_PACKAGES } from "./items";
