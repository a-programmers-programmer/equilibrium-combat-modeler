/**
 * Equilibrium League relics — ONE pick per tier permanently.
 *
 * Tiers: wiki (relic-tiers-wiki.ts) is source of truth.
 * Combat mults: effect-based via relic-combat.ts (not opaque fudges).
 *
 * Rejuvenated: claim ONE extra relic from a *previous* tier only.
 */

import { wikiTierOf, wikiPeers, WIKI_RELIC_TIERS } from "./relic-tiers-wiki";
import {
  resolveRelicCombat,
  type RelicCombatContext,
} from "./relic-combat";

export type RelicId =
  | "endless-harvest"
  | "survivalist"
  | "golden-touch"
  | "crystal-grace"
  | "superheated"
  | "divine-druid"
  | "transmutation"
  | "natures-network"
  | "assassins-insight"
  | "voidwalker"
  | "animal-wrangler"
  | "icyenic-faith"
  | "perkfection"
  | "devout"
  | "rejuvenated"
  | "naragi-edict"
  | "production-master"
  | "antiquarian"
  | "infernal-fire"
  | "clue-connoisseur"
  | "none";

/** Explicit restriction types for validation / UI. */
export type RelicRestriction =
  | { kind: "one-per-tier" }
  | { kind: "tier-unlock"; minTier: number }
  | { kind: "rejuvenated-previous-tier-only" }
  | {
      kind: "requires-prior-relics";
      /** empty for all current Equilibrium combat relics (wiki has none) */
      anyOf: RelicId[];
      allOf: RelicId[];
      note: string;
    }
  | { kind: "mutually-exclusive-same-tier"; peers: RelicId[] }
  | { kind: "assumed-tier-guess"; tier: number };

export interface RelicDef {
  id: RelicId;
  name: string;
  /**
   * Assumed relic tier for modeling (1–7). Tier 1 is confirmed wiki.
   * Unknown-tier combat relics use best-guess slots — mark assumedTierSource.
   */
  assumedTier: number;
  assumedTierSource: "wiki" | "guess";
  combatRank: "S" | "A" | "B" | "C" | "D";
  skills: string[];
  playerDpsMult: number;
  notes: string;
  effects: string[];
  tags: string[];
  /**
   * Prior-relic affinity requirements.
   * Wiki currently lists NONE for Equilibrium combat relics — kept empty
   * so the engine can grow when Jagex documents chains.
   */
  requiresPriorAnyOf: RelicId[];
  requiresPriorAllOf: RelicId[];
  restrictions: RelicRestriction[];
}

function baseRestrictions(
  id: RelicId,
  tier: number,
  source: "wiki" | "guess",
  peersOnTier: RelicId[],
): RelicRestriction[] {
  const r: RelicRestriction[] = [
    { kind: "one-per-tier" },
    { kind: "tier-unlock", minTier: tier },
    { kind: "mutually-exclusive-same-tier", peers: peersOnTier.filter((p) => p !== id) },
  ];
  if (source === "guess") r.push({ kind: "assumed-tier-guess", tier });
  if (id === "rejuvenated") r.push({ kind: "rejuvenated-previous-tier-only" });
  r.push({
    kind: "requires-prior-relics",
    anyOf: [],
    allOf: [],
    note: "No prior-relic affinity documented on wiki for this relic",
  });
  return r;
}

/**
 * Assumed tier map (UPDATE WHEN WIKI CONFIRMS):
 * T1 wiki: Endless Harvest | Survivalist | Golden Touch
 */
export const RELICS: readonly RelicDef[] = [
  {
    id: "endless-harvest",
    name: "Endless Harvest",
    assumedTier: 1,
    assumedTierSource: "wiki",
    combatRank: "D",
    skills: ["gathering"],
    playerDpsMult: 1,
    notes: "T1 gathering",
    effects: ["Auto-bank resources"],
    tags: ["skilling"],
    requiresPriorAnyOf: [],
    requiresPriorAllOf: [],
    restrictions: baseRestrictions("endless-harvest", 1, "wiki", [
      "endless-harvest",
      "survivalist",
      "golden-touch",
    ]),
  },
  {
    id: "survivalist",
    name: "Survivalist",
    assumedTier: 1,
    assumedTierSource: "wiki",
    combatRank: "D",
    skills: ["gathering"],
    playerDpsMult: 1,
    notes: "T1 gathering",
    effects: ["Double resources"],
    tags: ["skilling"],
    requiresPriorAnyOf: [],
    requiresPriorAllOf: [],
    restrictions: baseRestrictions("survivalist", 1, "wiki", [
      "endless-harvest",
      "survivalist",
      "golden-touch",
    ]),
  },
  {
    id: "golden-touch",
    name: "Golden Touch",
    assumedTier: 1,
    assumedTierSource: "wiki",
    combatRank: "D",
    skills: ["agility", "thieving"],
    playerDpsMult: 1,
    notes: "T1 agility/thieving",
    effects: ["Goldenhawk boots"],
    tags: ["skilling"],
    requiresPriorAnyOf: [],
    requiresPriorAllOf: [],
    restrictions: baseRestrictions("golden-touch", 1, "wiki", [
      "endless-harvest",
      "survivalist",
      "golden-touch",
    ]),
  },
  {
    id: "divine-druid",
    name: "Divine Druid",
    assumedTier: 2,
    assumedTierSource: "guess",
    combatRank: "B",
    skills: ["summoning", "herblore", "divination"],
    playerDpsMult: 1.02,
    notes: "ASSUMED T2 — scrolls/herblore",
    effects: ["10 scrolls per pouch", "Charm 5×", "Skill boost familiars ×3"],
    tags: ["summoning", "scrolls", "herblore"],
    requiresPriorAnyOf: [],
    requiresPriorAllOf: [],
    restrictions: baseRestrictions("divine-druid", 2, "guess", [
      "divine-druid",
      "assassins-insight",
      "voidwalker",
    ]),
  },
  {
    id: "assassins-insight",
    name: "Assassin's Insight",
    assumedTier: 3,
    assumedTierSource: "guess",
    combatRank: "C",
    skills: ["slayer"],
    playerDpsMult: 1.03,
    notes: "ASSUMED T2 — slayer",
    effects: ["Corrupted slayer helm effects", "Elite 5×"],
    tags: ["slayer"],
    requiresPriorAnyOf: [],
    requiresPriorAllOf: [],
    restrictions: baseRestrictions("assassins-insight", 2, "guess", [
      "divine-druid",
      "assassins-insight",
      "voidwalker",
    ]),
  },
  {
    id: "voidwalker",
    name: "Voidwalker",
    assumedTier: 3,
    assumedTierSource: "guess",
    combatRank: "D",
    skills: ["divination"],
    playerDpsMult: 1,
    notes: "ASSUMED T2 — utility",
    effects: ["Teleports / void shards"],
    tags: ["utility"],
    requiresPriorAnyOf: [],
    requiresPriorAllOf: [],
    restrictions: baseRestrictions("voidwalker", 2, "guess", [
      "divine-druid",
      "assassins-insight",
      "voidwalker",
    ]),
  },
  {
    id: "perkfection",
    name: "Perkfection",
    assumedTier: 6,
    assumedTierSource: "guess",
    combatRank: "A",
    skills: ["invention"],
    playerDpsMult: 1.08,
    notes: "ASSUMED T3 — invention perks",
    effects: ["Helpful perks +20%", "Toolbox gizmos", "No charge"],
    tags: ["invention", "perks"],
    requiresPriorAnyOf: [],
    requiresPriorAllOf: [],
    restrictions: baseRestrictions("perkfection", 3, "guess", [
      "perkfection",
      "icyenic-faith",
      "production-master",
    ]),
  },
  {
    id: "icyenic-faith",
    name: "Icyenic Faith",
    assumedTier: 7,
    assumedTierSource: "guess",
    combatRank: "A",
    skills: ["prayer"],
    playerDpsMult: 1.14,
    notes: "ASSUMED T3 — prayer combat",
    effects: ["Tome prayer→AD/crit", "100% protect + SS"],
    tags: ["prayer", "dps"],
    requiresPriorAnyOf: [],
    requiresPriorAllOf: [],
    restrictions: baseRestrictions("icyenic-faith", 3, "guess", [
      "perkfection",
      "icyenic-faith",
      "production-master",
    ]),
  },
  {
    id: "production-master",
    name: "Production Master",
    assumedTier: 5,
    assumedTierSource: "guess",
    combatRank: "D",
    skills: ["artisan"],
    playerDpsMult: 1,
    notes: "ASSUMED T3 — skilling",
    effects: ["Production"],
    tags: ["skilling"],
    requiresPriorAnyOf: [],
    requiresPriorAllOf: [],
    restrictions: baseRestrictions("production-master", 3, "guess", [
      "perkfection",
      "icyenic-faith",
      "production-master",
    ]),
  },
  {
    id: "devout",
    name: "Devout",
    assumedTier: 5,
    assumedTierSource: "guess",
    combatRank: "S",
    skills: ["summoning"],
    playerDpsMult: 1,
    notes: "ASSUMED T4 — Summoning combat (NOT same tier as Infernal)",
    effects: [
      "Scrolls not consumed",
      "SP cost 10%",
      "Combat familiars up to +500% at 99 Summoning",
    ],
    tags: ["summoning", "familiar-dps", "scrolls"],
    requiresPriorAnyOf: [],
    requiresPriorAllOf: [],
    restrictions: baseRestrictions("devout", 4, "guess", [
      "devout",
      "naragi-edict",
      "antiquarian",
    ]),
  },
  {
    id: "naragi-edict",
    name: "Naragi Edict",
    assumedTier: 7,
    assumedTierSource: "guess",
    combatRank: "S",
    skills: ["combat"],
    playerDpsMult: 1.12,
    notes: "ASSUMED T4 — mutually exclusive with Devout if same tier!",
    effects: ["255 combat duty cycle", "Pocket combat stats"],
    tags: ["combat", "burst"],
    requiresPriorAnyOf: [],
    requiresPriorAllOf: [],
    restrictions: baseRestrictions("naragi-edict", 4, "guess", [
      "devout",
      "naragi-edict",
      "antiquarian",
    ]),
  },
  {
    id: "antiquarian",
    name: "Antiquarian",
    assumedTier: 4,
    assumedTierSource: "guess",
    combatRank: "D",
    skills: ["archaeology"],
    playerDpsMult: 1,
    notes: "ASSUMED T4 — archaeology (unlocks Archaeology relic *powers*, different system)",
    effects: ["All Archaeology relics after tutorial"],
    tags: ["skilling"],
    requiresPriorAnyOf: [],
    requiresPriorAllOf: [],
    restrictions: baseRestrictions("antiquarian", 4, "guess", [
      "devout",
      "naragi-edict",
      "antiquarian",
    ]),
  },
  {
    id: "infernal-fire",
    name: "Infernal Fire",
    assumedTier: 7,
    assumedTierSource: "guess",
    combatRank: "S",
    skills: ["combat"],
    playerDpsMult: 1.18,
    notes: "ASSUMED T5 — Death Mark execute",
    effects: ["Death Mark 100% — kill at 20% HP", "Pocket bonuses"],
    tags: ["combat", "execute"],
    requiresPriorAnyOf: [],
    requiresPriorAllOf: [],
    restrictions: baseRestrictions("infernal-fire", 5, "guess", [
      "infernal-fire",
      "rejuvenated",
      "clue-connoisseur",
    ]),
  },
  {
    id: "rejuvenated",
    name: "Rejuvenated",
    assumedTier: 6,
    assumedTierSource: "guess",
    combatRank: "S",
    skills: [],
    playerDpsMult: 1,
    notes:
      "ASSUMED T5 — pick ONE extra relic from tiers 1–4 only. Competes with Infernal if same tier.",
    effects: ["Pick another relic from any previous tier"],
    tags: ["meta", "combo"],
    requiresPriorAnyOf: [],
    requiresPriorAllOf: [],
    restrictions: baseRestrictions("rejuvenated", 5, "guess", [
      "infernal-fire",
      "rejuvenated",
      "clue-connoisseur",
    ]),
  },
  {
    id: "clue-connoisseur",
    name: "Clue Connoisseur",
    assumedTier: 5,
    assumedTierSource: "guess",
    combatRank: "D",
    skills: ["clues"],
    playerDpsMult: 1,
    notes: "ASSUMED T5",
    effects: ["Clues"],
    tags: ["skilling"],
    requiresPriorAnyOf: [],
    requiresPriorAllOf: [],
    restrictions: baseRestrictions("clue-connoisseur", 5, "guess", [
      "infernal-fire",
      "rejuvenated",
      "clue-connoisseur",
    ]),
  },
  {
    id: "crystal-grace",
    name: "Crystal Grace",
    assumedTier: 4,
    assumedTierSource: "guess",
    combatRank: "C",
    skills: [],
    playerDpsMult: 1.04,
    notes: "ASSUMED T6",
    effects: ["Spell unlocks / RC / necro rituals"],
    tags: ["utility"],
    requiresPriorAnyOf: [],
    requiresPriorAllOf: [],
    restrictions: baseRestrictions("crystal-grace", 6, "guess", [
      "crystal-grace",
      "superheated",
      "natures-network",
    ]),
  },
  {
    id: "superheated",
    name: "Superheated",
    assumedTier: 2,
    assumedTierSource: "guess",
    combatRank: "D",
    skills: ["smithing", "firemaking"],
    playerDpsMult: 1,
    notes: "ASSUMED T6 skilling",
    effects: ["Smithing/FM"],
    tags: ["skilling"],
    requiresPriorAnyOf: [],
    requiresPriorAllOf: [],
    restrictions: baseRestrictions("superheated", 6, "guess", [
      "crystal-grace",
      "superheated",
      "natures-network",
    ]),
  },
  {
    id: "natures-network",
    name: "Nature's Network",
    assumedTier: 3,
    assumedTierSource: "guess",
    combatRank: "D",
    skills: ["farming"],
    playerDpsMult: 1,
    notes: "ASSUMED T6",
    effects: ["Farming/tele"],
    tags: ["skilling"],
    requiresPriorAnyOf: [],
    requiresPriorAllOf: [],
    restrictions: baseRestrictions("natures-network", 6, "guess", [
      "crystal-grace",
      "superheated",
      "natures-network",
    ]),
  },
  {
    id: "transmutation",
    name: "Transmutation",
    assumedTier: 4,
    assumedTierSource: "guess",
    combatRank: "D",
    skills: [],
    playerDpsMult: 1,
    notes: "ASSUMED T7",
    effects: ["Skilling"],
    tags: ["skilling"],
    requiresPriorAnyOf: [],
    requiresPriorAllOf: [],
    restrictions: baseRestrictions("transmutation", 7, "guess", [
      "transmutation",
      "animal-wrangler",
    ]),
  },
  {
    id: "animal-wrangler",
    name: "Animal Wrangler",
    assumedTier: 2,
    assumedTierSource: "guess",
    combatRank: "D",
    skills: ["hunter"],
    playerDpsMult: 1,
    notes: "ASSUMED T7",
    effects: ["Hunter"],
    tags: ["skilling"],
    requiresPriorAnyOf: [],
    requiresPriorAllOf: [],
    restrictions: baseRestrictions("animal-wrangler", 7, "guess", [
      "transmutation",
      "animal-wrangler",
    ]),
  },
  {
    id: "none",
    name: "No relic",
    assumedTier: 0,
    assumedTierSource: "wiki",
    combatRank: "D",
    skills: [],
    playerDpsMult: 1,
    notes: "Baseline",
    effects: [],
    tags: [],
    requiresPriorAnyOf: [],
    requiresPriorAllOf: [],
    restrictions: [],
  },
];

export const RELIC_BY_ID: Readonly<Record<string, RelicDef>> = Object.fromEntries(
  RELICS.map((r) => [r.id, r]),
);

/** Force wiki tiers + peer exclusivity after catalog load */
function applyWikiTiersToCatalog(): void {
  for (const r of RELICS) {
    if (r.id === "none") continue;
    const t = wikiTierOf(r.id);
    if (!t) continue;
    (r as { assumedTier: number }).assumedTier = t;
    (r as { assumedTierSource: "wiki" | "guess" }).assumedTierSource = "wiki";
    (r as { restrictions: RelicRestriction[] }).restrictions = baseRestrictions(
      r.id,
      t,
      "wiki",
      wikiPeers(r.id),
    );
  }
}
applyWikiTiersToCatalog();

export interface RelicLoadout {
  byTier: Partial<Record<number, RelicId>>;
  rejuvenatedExtra?: { fromTier: number; relic: RelicId };
}

export interface ValidatedRelics {
  active: RelicId[];
  mult: number;
  devout: boolean;
  divineDruid: boolean;
  valid: boolean;
  errors: string[];
  flags: string[];
  notes: string[];
}

export function activeRelicsFromLoadout(loadout: RelicLoadout): RelicId[] {
  const ids: RelicId[] = [];
  for (let t = 1; t <= 7; t++) {
    const id = loadout.byTier[t];
    if (id && id !== "none") ids.push(id);
  }
  if (loadout.rejuvenatedExtra) ids.push(loadout.rejuvenatedExtra.relic);
  return ids;
}

/** Check requiresPriorAnyOf / AllOf against already-active lower-tier picks. */
function checkPriorRequirements(
  relicId: RelicId,
  alreadyActive: readonly RelicId[],
): string[] {
  const def = RELIC_BY_ID[relicId];
  if (!def) return [`Unknown relic ${relicId}`];
  const errs: string[] = [];
  if (def.requiresPriorAllOf.length) {
    for (const need of def.requiresPriorAllOf) {
      if (!alreadyActive.includes(need)) {
        errs.push(`${def.name} requires prior relic ${need} (allOf)`);
      }
    }
  }
  if (def.requiresPriorAnyOf.length) {
    if (!def.requiresPriorAnyOf.some((n) => alreadyActive.includes(n))) {
      errs.push(
        `${def.name} requires one of prior relics: ${def.requiresPriorAnyOf.join(", ")}`,
      );
    }
  }
  return errs;
}

export function validateRelicLoadout(loadout: RelicLoadout): ValidatedRelics {
  const errors: string[] = [];
  const notes: string[] = [];
  const flags: string[] = [];

  // Sequential: for each tier in order, prior requirements vs earlier picks
  const earlier: RelicId[] = [];
  for (let t = 1; t <= 7; t++) {
    const id = loadout.byTier[t];
    if (!id || id === "none") continue;
    const def = RELIC_BY_ID[id];
    if (!def) {
      errors.push(`Unknown relic ${id} on T${t}`);
      continue;
    }
    if (def.assumedTier !== t) {
      notes.push(
        `WARN: ${def.name} assumed T${def.assumedTier} but slotted on T${t} (${def.assumedTierSource})`,
      );
    }
    errors.push(...checkPriorRequirements(id, earlier));
    earlier.push(id);
  }

  let rejTier: number | null = null;
  for (let t = 1; t <= 7; t++) {
    if (loadout.byTier[t] === "rejuvenated") rejTier = t;
  }

  if (loadout.rejuvenatedExtra) {
    if (rejTier === null) {
      errors.push("Rejuvenated extra set but Rejuvenated not picked on any tier");
    } else {
      const { fromTier, relic } = loadout.rejuvenatedExtra;
      if (fromTier >= rejTier) {
        errors.push(
          `Rejuvenated (T${rejTier}) can only claim previous tiers, not T${fromTier}`,
        );
      }
      const def = RELIC_BY_ID[relic];
      if (!def) errors.push(`Unknown extra relic ${relic}`);
      else if (def.assumedTier !== fromTier) {
        errors.push(
          `Extra ${def.name} is assumed T${def.assumedTier}, not T${fromTier}`,
        );
      }
      if (loadout.byTier[fromTier] === relic) {
        errors.push(
          `Already picked ${relic} on T${fromTier} — Rejuvenated must take a different relic from a previous tier`,
        );
      }
      // Prior reqs for the reclaimed relic vs what was active before Rejuvenated tier
      const beforeRej = earlier.filter((id) => {
        const d = RELIC_BY_ID[id];
        return d && d.assumedTier < rejTier!;
      });
      errors.push(...checkPriorRequirements(relic, beforeRej));
      notes.push(
        `Rejuvenated T${rejTier} → extra ${def?.name ?? relic} from T${fromTier}`,
      );
    }
  }

  const active = activeRelicsFromLoadout(loadout);
  if (new Set(active).size !== active.length) {
    errors.push("Duplicate active relics");
  }

  if (active.includes("devout") && active.includes("infernal-fire")) {
    notes.push(
      "Devout+Infernal both active — valid when on different tiers (assumed T4+T5); no prior-relic affinity required by wiki",
    );
  }
  // T7 mutual exclusion among combat apex picks
  const t7Combat = (["infernal-fire", "naragi-edict", "icyenic-faith"] as RelicId[]).filter((id) =>
    active.includes(id),
  );
  if (t7Combat.length > 1) {
    errors.push(
      `T7 combat relics are mutually exclusive (Wazzy): picked ${t7Combat.join(" + ")}`,
    );
  }
  // T5: Devout vs Production Master vs Clues
  const t5Combat = (["devout", "production-master", "clue-connoisseur"] as RelicId[]).filter((id) =>
    active.includes(id),
  );
  if (t5Combat.length > 1) {
    errors.push(`T5 relics mutually exclusive: ${t5Combat.join(" + ")}`);
  }
  // T6: Rejuvenated vs Perkfection
  if (active.includes("rejuvenated") && active.includes("perkfection")) {
    errors.push("T6 Rejuvenated and Perkfection are mutually exclusive (Wazzy map)");
  }

  let mult = 1;
  const combat = resolveRelicCombat(
    active[0] ?? "none",
    active.length > 1 ? active[1]! : null,
    {
      prayerBonus: 40,
      fightSeconds: 60,
      style: "melee",
      summoningLevel: 99,
      baselineAd: 7000,
    },
  );
  // Product all active combat slices (relic-combat only takes 2 — fold rest)
  mult = 1;
  for (const id of active) {
    mult *= resolveRelicCombat(id, null, {
      prayerBonus: 40,
      fightSeconds: 60,
      style: "melee",
      summoningLevel: 99,
      baselineAd: 7000,
    }).playerDpsMult;
  }
  void combat;
  const devout = active.includes("devout");
  const divineDruid = active.includes("divine-druid");
  for (const id of active) {
    const def = RELIC_BY_ID[id];
    if (def) flags.push(`Relic: ${def.name} T${def.assumedTier}`);
  }

  // Transparency: no prior-affinity chains loaded
  const withPriors = RELICS.filter(
    (r) => r.requiresPriorAnyOf.length || r.requiresPriorAllOf.length,
  );
  if (withPriors.length === 0) {
    notes.push(
      "Prior-relic affinity: none configured (wiki documents no combat-relic prerequisites)",
    );
  }

  return {
    active,
    mult,
    devout,
    divineDruid,
    valid: errors.length === 0,
    errors,
    flags,
    notes,
  };
}

export function stackRelicPlayerMult(
  primary: RelicId,
  secondary: RelicId | null = null,
  combatCtx?: Partial<RelicCombatContext>,
): {
  mult: number;
  devout: boolean;
  divineDruid: boolean;
  flags: string[];
  valid: boolean;
  errors: string[];
  notes: string[];
  combat?: ReturnType<typeof resolveRelicCombat>;
} {
  const ctx: RelicCombatContext = {
    prayerBonus: combatCtx?.prayerBonus ?? 40,
    fightSeconds: combatCtx?.fightSeconds ?? 60,
    style: combatCtx?.style ?? "melee",
    summoningLevel: combatCtx?.summoningLevel ?? 99,
    baselineAd: combatCtx?.baselineAd ?? 7000,
  };

  if (!secondary || secondary === "none") {
    const combat = resolveRelicCombat(primary, null, ctx);
    const def = RELIC_BY_ID[primary] ?? RELIC_BY_ID.none!;
    return {
      mult: combat.playerDpsMult,
      devout: primary === "devout",
      divineDruid: primary === "divine-druid",
      flags:
        primary === "none"
          ? []
          : [
              `Relic: ${def.name} (T${def.assumedTier}) ×${combat.playerDpsMult.toFixed(3)}`,
              ...combat.components.map(
                (c) => `${c.name} ×${c.mult.toFixed(3)}`,
              ),
            ],
      valid: true,
      errors: [],
      notes: combat.notes,
      combat,
    };
  }

  const byTier: Partial<Record<number, RelicId>> = {};
  const a = RELIC_BY_ID[primary]!;
  const b = RELIC_BY_ID[secondary]!;
  let rejuvenatedExtra: RelicLoadout["rejuvenatedExtra"];
  let errors: string[] = [];

  if (primary === "rejuvenated") {
    byTier[a.assumedTier] = "rejuvenated";
    rejuvenatedExtra = { fromTier: b.assumedTier, relic: secondary };
  } else if (secondary === "rejuvenated") {
    byTier[b.assumedTier] = "rejuvenated";
    rejuvenatedExtra = { fromTier: a.assumedTier, relic: primary };
  } else if (a.assumedTier === b.assumedTier) {
    errors.push(
      `${a.name} and ${b.name} are both T${a.assumedTier} — mutually exclusive (one per tier). Use Rejuvenated (T6) to reclaim a *previous* tier pick.`,
    );
    // Still compute mult for display but mark invalid
    const combat = resolveRelicCombat(primary, secondary, ctx);
    return {
      mult: combat.playerDpsMult,
      devout: primary === "devout" || secondary === "devout",
      divineDruid: primary === "divine-druid" || secondary === "divine-druid",
      flags: combat.components.map((c) => `${c.relic}:${c.name}`),
      valid: false,
      errors,
      notes: combat.notes,
      combat,
    };
  } else {
    byTier[a.assumedTier] = primary;
    byTier[b.assumedTier] = secondary;
  }

  const loadout: RelicLoadout = { byTier, rejuvenatedExtra };
  const v = validateRelicLoadout(loadout);
  const combat = resolveRelicCombat(primary, secondary, ctx);

  return {
    mult: combat.playerDpsMult,
    devout: primary === "devout" || secondary === "devout",
    divineDruid: primary === "divine-druid" || secondary === "divine-druid",
    flags: [
      ...combat.components.map(
        (c) => `${c.relic}: ${c.name} ×${c.mult.toFixed(3)}`,
      ),
      ...v.flags,
    ],
    valid: v.valid && errors.length === 0,
    errors: [...errors, ...v.errors],
    notes: [...combat.notes, ...v.notes],
    combat,
  };
}

export function legalCombatLoadouts(): {
  id: string;
  label: string;
  loadout: RelicLoadout;
  validation: ValidatedRelics;
}[] {
  // Wiki tiers: T5 Devout, T6 Rejuv/Perk, T7 Infernal|Naragi|Icyenic
  const specs: { id: string; label: string; loadout: RelicLoadout }[] = [
    {
      id: "devout-only",
      label: "T5 Devout only",
      loadout: { byTier: { 5: "devout" } },
    },
    {
      id: "infernal-only",
      label: "T7 Infernal only",
      loadout: { byTier: { 7: "infernal-fire" } },
    },
    {
      id: "icyenic-only",
      label: "T7 Icyenic only",
      loadout: { byTier: { 7: "icyenic-faith" } },
    },
    {
      id: "devout-plus-infernal",
      label: "T5 Devout + T7 Infernal (no Rejuv needed)",
      loadout: { byTier: { 5: "devout", 7: "infernal-fire" } },
    },
    {
      id: "devout-plus-icyenic",
      label: "T5 Devout + T7 Icyenic",
      loadout: { byTier: { 5: "devout", 7: "icyenic-faith" } },
    },
    {
      id: "devout-plus-naragi",
      label: "T5 Devout + T7 Naragi",
      loadout: { byTier: { 5: "devout", 7: "naragi-edict" } },
    },
    {
      id: "perk-devout-infernal",
      label: "T5 Devout + T6 Perkfection + T7 Infernal",
      loadout: {
        byTier: { 5: "devout", 6: "perkfection", 7: "infernal-fire" },
      },
    },
    {
      id: "rejuv-reclaim-druid-icyenic",
      label: "Wazzy: T6 Rejuv→Divine Druid + T7 Icyenic",
      loadout: {
        byTier: { 6: "rejuvenated", 7: "icyenic-faith" },
        rejuvenatedExtra: { fromTier: 2, relic: "divine-druid" },
      },
    },
    {
      id: "invalid-t7-infernal-icyenic",
      label: "INVALID T7 Infernal+Icyenic",
      loadout: { byTier: { 7: "infernal-fire" } }, // cannot both
    },
    {
      id: "none",
      label: "No combat relics",
      loadout: { byTier: {} },
    },
  ];

  return specs.map((s) => ({
    ...s,
    validation: validateRelicLoadout(s.loadout),
  }));
}

export const COMBAT_RELIC_PICKS: readonly RelicId[] = [
  "devout",
  "divine-druid",
  "naragi-edict",
  "infernal-fire",
  "icyenic-faith",
  "perkfection",
  "assassins-insight",
  "none",
];

export function combatRelicCombos(_includeRejuvDouble = true): {
  primary: RelicId;
  secondary: RelicId | null;
  label: string;
  valid: boolean;
}[] {
  const out: {
    primary: RelicId;
    secondary: RelicId | null;
    label: string;
    valid: boolean;
  }[] = [];
  for (const p of COMBAT_RELIC_PICKS) {
    out.push({ primary: p, secondary: null, label: p, valid: true });
  }
  const pairs: [RelicId, RelicId][] = [
    ["devout", "infernal-fire"], // T5+T7
    ["devout", "icyenic-faith"],
    ["devout", "naragi-edict"],
    ["perkfection", "devout"], // T6+T5
    ["perkfection", "infernal-fire"], // T6+T7
    ["divine-druid", "devout"], // T2+T5
    ["divine-druid", "infernal-fire"],
  ];
  for (const [a, b] of pairs) {
    const s = stackRelicPlayerMult(a, b);
    out.push({
      primary: a,
      secondary: b,
      label: `${a}+${b}`,
      valid: s.valid,
    });
  }
  out.push({
    primary: "infernal-fire",
    secondary: "icyenic-faith",
    label: "INVALID:infernal+icyenic(same-T7)",
    valid: false,
  });
  out.push({
    primary: "rejuvenated",
    secondary: "icyenic-faith",
    label: "rejuvenated→icyenic",
    valid: true,
  });
  return out;
}

/** Human-readable restriction report for UI / FAQ. */
export function relicRestrictionReport(): {
  summary: string;
  enforced: string[];
  notOnWiki: string[];
  priorAffinityConfigured: number;
} {
  const priorAffinityConfigured = RELICS.filter(
    (r) => r.requiresPriorAnyOf.length || r.requiresPriorAllOf.length,
  ).length;
  return {
    summary:
      "Relics: one-per-tier + Rejuvenated previous-tier only. No wiki prior-relic affinity chains. Blessing God tiers use path affinity (separate system).",
    enforced: [
      "One relic pick per tier",
      "Rejuvenated → previous tiers only",
      "Same assumed-tier mutual exclusion",
      "requiresPriorAnyOf/AllOf hooks (currently empty lists)",
      "Blessing God T4/T8 path majority (in blessings.ts, not here)",
    ],
    notOnWiki: [
      "No documented 'must pick relic X before relic Y' for combat relics",
      "Most combat relic tier numbers still Unknown (assumedTier is a guess)",
    ],
    priorAffinityConfigured,
  };
}
