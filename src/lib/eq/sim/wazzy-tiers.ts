/**
 * Relic tier estimates from Wazzy's Leagues Hub (public Google Doc).
 * Source: https://docs.google.com/document/d/e/2PACX-1vRFLz-cmfOVWYvWeJ5sW7CgrsMEXO4wSzlNg2UNkMDN_oZMNXnhjJxlJJ36za4i9fwx3W9QmvVZd-HW/pub
 * Tweet: https://x.com/WazzyRS/status/2084019049164402901
 *
 * "?" in the doc = potential/unknown. We treat as working assumptions.
 * "starter regions" = Misthalin + Havenhythe + Karamja (NOT free-to-play).
 */

import type { RelicId } from "./relics";
import type { RegionTag } from "./requirements";
import type { Path } from "../blessings";

export const WAZZY_DOC_URL =
  "https://docs.google.com/document/d/e/2PACX-1vRFLz-cmfOVWYvWeJ5sW7CgrsMEXO4wSzlNg2UNkMDN_oZMNXnhjJxlJJ36za4i9fwx3W9QmvVZd-HW/pub";

/** Wazzy Relic Tier Summary (Twitch chat majority + his bold picks) */
export const WAZZY_RELIC_TIERS: Record<
  number,
  { relics: RelicId[]; confidence: "confirmed" | "estimated"; notes: string }
> = {
  1: {
    relics: ["endless-harvest", "survivalist", "golden-touch"],
    confidence: "confirmed",
    notes: "Wiki confirmed T1",
  },
  2: {
    relics: ["superheated", "divine-druid", "animal-wrangler"],
    confidence: "estimated",
    notes: "Wazzy: Superheated? Divine Druid? Animal Wrangler?",
  },
  3: {
    relics: ["assassins-insight", "natures-network", "voidwalker"],
    confidence: "estimated",
    notes: "Wazzy: Assassin's Insight, Nature's Network (bold if Prif), Voidwalker",
  },
  4: {
    relics: ["crystal-grace", "transmutation", "antiquarian"],
    confidence: "estimated",
    notes: "Wazzy: Crystal Grace? Transmutation? Antiquarian?",
  },
  5: {
    relics: ["devout", "production-master", "clue-connoisseur"],
    confidence: "estimated",
    notes: "Wazzy: Devout? Production Master? Clue Connoisseur",
  },
  6: {
    relics: ["rejuvenated", "perkfection"],
    confidence: "estimated",
    notes: "Wazzy: Rejuvenated? Perkfection? (only 2 listed)",
  },
  7: {
    relics: ["infernal-fire", "naragi-edict", "icyenic-faith"],
    confidence: "estimated",
    notes: "Wazzy: Infernal Fire, Naragi Edict, Icyenic Faith — combat apex tier",
  },
};

/** Wazzy personal skilling path */
export const WAZZY_PERSONAL_RELICS: {
  tier: number;
  pick: RelicId;
  rejuvenatedExtra?: RelicId;
}[] = [
  { tier: 1, pick: "survivalist" },
  { tier: 2, pick: "superheated" },
  { tier: 3, pick: "voidwalker" },
  { tier: 4, pick: "antiquarian" },
  { tier: 5, pick: "production-master" },
  { tier: 6, pick: "rejuvenated", rejuvenatedExtra: "divine-druid" },
  { tier: 7, pick: "icyenic-faith" },
];

/** Wazzy region order: Wilderness (Forinthry) → Desert → Anachronia */
export const WAZZY_REGIONS: RegionTag[] = ["forinthry", "desert", "anachronia"];

/**
 * Combat-focused legal T7 choices (mutually exclusive).
 * Devout is T5 → can pair with any T7 combat relic.
 * Rejuvenated is T6 → can reclaim Divine Druid (T2) or other earlier skip.
 * Cannot take Infernal + Icyenic (both T7).
 */
export type CombatRouteId =
  | "devout-infernal"
  | "devout-icyenic"
  | "devout-naragi"
  | "prod-infernal"
  | "prod-icyenic"
  | "rejuv-druid-icyenic" // Wazzy personal
  | "perk-devout-infernal"
  | "no-combat-relics";

export interface CombatRoute {
  id: CombatRouteId;
  label: string;
  /** Full 7-tier picks under Wazzy map */
  byTier: Partial<Record<number, RelicId>>;
  rejuvenatedExtra?: { fromTier: number; relic: RelicId };
  electives: RegionTag[];
  /** Blessing path picks [T1,T2,T3,T5,T6,T7] — Order=Sara, Chaos=Zammy, Balance=Guthix */
  blessingPicks: Path[];
  notes: string;
}

/**
 * High-value combat routes under Wazzy tier constraints + region capabilities.
 * Blessings: Wazzy likes Teragard (Order) → often Sara-heavy; crit lines use Zammy mid.
 */
export const WAZZY_COMBAT_ROUTES: CombatRoute[] = [
  {
    id: "devout-infernal",
    label: "T5 Devout + T7 Infernal (Ripper path)",
    byTier: {
      1: "survivalist",
      2: "divine-druid",
      3: "voidwalker",
      4: "antiquarian",
      5: "devout",
      6: "perkfection",
      7: "infernal-fire",
    },
    electives: ["forinthry", "desert", "anachronia"],
    blessingPicks: ["Order", "Chaos", "Order", "Balance", "Order", "Chaos"],
    notes: "Familiar ceil + Death Mark. Needs Forinthry for Ripper.",
  },
  {
    id: "devout-icyenic",
    label: "T5 Devout + T7 Icyenic (Wazzy T7 pick style)",
    byTier: {
      1: "survivalist",
      2: "divine-druid",
      3: "voidwalker",
      4: "crystal-grace",
      5: "devout",
      6: "perkfection",
      7: "icyenic-faith",
    },
    electives: ["forinthry", "desert", "anachronia"],
    blessingPicks: ["Order", "Chaos", "Order", "Balance", "Order", "Chaos"],
    notes: "Prayer AD/crit + familiar. Competes with Infernal at T7.",
  },
  {
    id: "devout-naragi",
    label: "T5 Devout + T7 Naragi",
    byTier: {
      1: "survivalist",
      2: "divine-druid",
      3: "voidwalker",
      4: "antiquarian",
      5: "devout",
      6: "perkfection",
      7: "naragi-edict",
    },
    electives: ["forinthry", "desert", "anachronia"],
    blessingPicks: ["Order", "Chaos", "Order", "Balance", "Order", "Chaos"],
    notes: "Burst 255 combat duty cycle + familiars.",
  },
  {
    id: "prod-infernal",
    label: "T5 Production + T7 Infernal (no Devout)",
    byTier: {
      1: "survivalist",
      2: "superheated",
      3: "voidwalker",
      4: "antiquarian",
      5: "production-master",
      6: "perkfection",
      7: "infernal-fire",
    },
    electives: ["forinthry", "desert", "anachronia"],
    blessingPicks: ["Order", "Chaos", "Order", "Balance", "Order", "Chaos"],
    notes: "Skilling-lean T5; Infernal only combat apex.",
  },
  {
    id: "prod-icyenic",
    label: "T5 Production + T7 Icyenic",
    byTier: {
      1: "survivalist",
      2: "superheated",
      3: "voidwalker",
      4: "antiquarian",
      5: "production-master",
      6: "perkfection",
      7: "icyenic-faith",
    },
    electives: ["forinthry", "desert", "anachronia"],
    blessingPicks: ["Order", "Order", "Order", "Balance", "Order", "Order"],
    notes: "Closer to Wazzy skilling path + Icyenic.",
  },
  {
    id: "rejuv-druid-icyenic",
    label: "Wazzy personal: Rejuv→Druid + T7 Icyenic",
    byTier: {
      1: "survivalist",
      2: "superheated",
      3: "voidwalker",
      4: "antiquarian",
      5: "production-master",
      6: "rejuvenated",
      7: "icyenic-faith",
    },
    rejuvenatedExtra: { fromTier: 2, relic: "divine-druid" },
    electives: ["forinthry", "desert", "anachronia"],
    blessingPicks: ["Order", "Chaos", "Order", "Balance", "Order", "Chaos"],
    notes: "Exact Wazzy personal relic path (regions Forinthry/Desert/Anach).",
  },
  {
    id: "perk-devout-infernal",
    label: "T5 Devout + T6 Perk + T7 Infernal",
    byTier: {
      1: "endless-harvest",
      2: "divine-druid",
      3: "assassins-insight",
      4: "crystal-grace",
      5: "devout",
      6: "perkfection",
      7: "infernal-fire",
    },
    electives: ["forinthry", "asgarnia", "desert"],
    blessingPicks: ["Order", "Chaos", "Order", "Balance", "Chaos", "Chaos"],
    notes: "Combat-max: Devout familiars + perks + Death Mark. Asgarnia for invention/gear.",
  },
  {
    id: "no-combat-relics",
    label: "Baseline: no combat relics (starter regions only)",
    byTier: {
      1: "survivalist",
      2: "superheated",
      3: "voidwalker",
      4: "antiquarian",
      5: "production-master",
      6: "rejuvenated",
      7: "clue-connoisseur" as RelicId, // invalid if clue is T5 — use none on combat
    },
    electives: [],
    blessingPicks: ["Order", "Chaos", "Order", "Balance", "Order", "Chaos"],
    notes: "Starter regions only; no T7 combat pick — control curve.",
  },
];

/** Fix no-combat: T7 must pick something — use a dummy non-combat if needed; clue is T5. Use none via empty T7 */
WAZZY_COMBAT_ROUTES[WAZZY_COMBAT_ROUTES.length - 1] = {
  id: "no-combat-relics",
  label: "Baseline skilling (starter regions, no T5/T7 combat)",
  byTier: {
    1: "survivalist",
    2: "superheated",
    3: "voidwalker",
    4: "antiquarian",
    5: "production-master",
    6: "perkfection",
    // T7 forced pick — pick weakest combat for "baseline" awareness: still need a pick
    // Model as naragi with mult only when we want; for true baseline omit combat mults in sim
    7: "naragi-edict",
  },
  electives: [],
  blessingPicks: ["Order", "Chaos", "Order", "Balance", "Order", "Chaos"],
  notes: "Starter regions; T7 still required by league — use Naragi as placeholder but label baseline electives empty.",
};

export function wazzyTierOf(relic: RelicId): number | null {
  for (const [t, info] of Object.entries(WAZZY_RELIC_TIERS)) {
    if (info.relics.includes(relic)) return Number(t);
  }
  return null;
}
