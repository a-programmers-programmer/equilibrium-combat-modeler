/**
 * Wiki-confirmed Equilibrium relic tiers (runescape.wiki/Equilibrium_League/Relics).
 * Single source of truth for tier placement + peers.
 */

import type { RelicId } from "./relics";

export const WIKI_RELIC_TIERS: Record<
  number,
  { points: number; relics: RelicId[] }
> = {
  1: {
    points: 10,
    relics: ["endless-harvest", "survivalist", "golden-touch"],
  },
  2: {
    points: 750,
    relics: ["animal-wrangler", "superheated", "divine-druid"],
  },
  3: {
    points: 1750,
    relics: ["natures-network", "assassins-insight", "voidwalker"],
  },
  4: {
    points: 3500,
    relics: ["crystal-grace", "transmutation", "antiquarian"],
  },
  5: {
    points: 6000,
    relics: ["clue-connoisseur", "production-master", "devout"],
  },
  6: {
    points: 12000,
    relics: ["perkfection", "rejuvenated"],
  },
  7: {
    points: 20000,
    relics: ["infernal-fire", "naragi-edict", "icyenic-faith"],
  },
};

export function wikiTierOf(id: RelicId): number {
  for (const [t, row] of Object.entries(WIKI_RELIC_TIERS)) {
    if (row.relics.includes(id)) return Number(t);
  }
  return 0;
}

export function wikiPeers(id: RelicId): RelicId[] {
  const t = wikiTierOf(id);
  return WIKI_RELIC_TIERS[t]?.relics ?? [];
}
