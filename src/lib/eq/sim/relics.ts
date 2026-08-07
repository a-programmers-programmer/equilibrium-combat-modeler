/**
 * Equilibrium League relics — ONE pick per tier permanently.
 *
 * Rejuvenated (wiki): "Allows the player to pick another relic from any of the
 * previous tiers." That is NOT "take any two combat relics." It means:
 *   - You pick Rejuvenated as your choice on some tier T
 *   - You then get ONE extra relic from tiers 1..T-1 (a relic you skipped earlier)
 *
 * You still cannot take two relics from the SAME tier. Devout + Infernal Fire
 * only works if they sit on different tiers AND one was skipped then claimed
 * via Rejuvenated on a later tier.
 *
 * Pre-launch most combat relics are "Unknown Tier" — we assign assumedTier
 * for modeling (documented guesses) and only allow Rejuvenated doubles that
 * satisfy previous-tier rules.
 */

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
}

/**
 * Assumed tier map (UPDATE WHEN WIKI CONFIRMS):
 * T1 wiki: Endless Harvest | Survivalist | Golden Touch
 * Guess packing combat relics across T2–T7 so Rejuvenated is meaningful.
 * Critical: Devout and Infernal Fire are on DIFFERENT assumed tiers so a
 * Rejuvenated double is *possible* but costs the Rejuvenated tier slot.
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
  },
  {
    id: "assassins-insight",
    name: "Assassin's Insight",
    assumedTier: 2,
    assumedTierSource: "guess",
    combatRank: "C",
    skills: ["slayer"],
    playerDpsMult: 1.03,
    notes: "ASSUMED T2 — slayer",
    effects: ["Corrupted slayer helm effects", "Elite 5×"],
    tags: ["slayer"],
  },
  {
    id: "voidwalker",
    name: "Voidwalker",
    assumedTier: 2,
    assumedTierSource: "guess",
    combatRank: "D",
    skills: ["divination"],
    playerDpsMult: 1,
    notes: "ASSUMED T2 — utility",
    effects: ["Teleports / void shards"],
    tags: ["utility"],
  },
  {
    id: "perkfection",
    name: "Perkfection",
    assumedTier: 3,
    assumedTierSource: "guess",
    combatRank: "A",
    skills: ["invention"],
    playerDpsMult: 1.08,
    notes: "ASSUMED T3 — invention perks",
    effects: ["Helpful perks +20%", "Toolbox gizmos", "No charge"],
    tags: ["invention", "perks"],
  },
  {
    id: "icyenic-faith",
    name: "Icyenic Faith",
    assumedTier: 3,
    assumedTierSource: "guess",
    combatRank: "A",
    skills: ["prayer"],
    playerDpsMult: 1.14,
    notes: "ASSUMED T3 — prayer combat",
    effects: ["Tome prayer→AD/crit", "100% protect + SS"],
    tags: ["prayer", "dps"],
  },
  {
    id: "production-master",
    name: "Production Master",
    assumedTier: 3,
    assumedTierSource: "guess",
    combatRank: "D",
    skills: ["artisan"],
    playerDpsMult: 1,
    notes: "ASSUMED T3 — skilling",
    effects: ["Production"],
    tags: ["skilling"],
  },
  {
    id: "devout",
    name: "Devout",
    assumedTier: 4,
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
  },
  {
    id: "naragi-edict",
    name: "Naragi Edict",
    assumedTier: 4,
    assumedTierSource: "guess",
    combatRank: "S",
    skills: ["combat"],
    playerDpsMult: 1.12,
    notes: "ASSUMED T4 — mutually exclusive with Devout if same tier!",
    effects: ["255 combat duty cycle", "Pocket combat stats"],
    tags: ["combat", "burst"],
  },
  {
    id: "antiquarian",
    name: "Antiquarian",
    assumedTier: 4,
    assumedTierSource: "guess",
    combatRank: "D",
    skills: ["archaeology"],
    playerDpsMult: 1,
    notes: "ASSUMED T4 — archaeology",
    effects: ["Archaeology"],
    tags: ["skilling"],
  },
  {
    id: "infernal-fire",
    name: "Infernal Fire",
    assumedTier: 5,
    assumedTierSource: "guess",
    combatRank: "S",
    skills: ["combat"],
    playerDpsMult: 1.18,
    notes: "ASSUMED T5 — Death Mark execute",
    effects: ["Death Mark 100% — kill at 20% HP", "Pocket bonuses"],
    tags: ["combat", "execute"],
  },
  {
    id: "rejuvenated",
    name: "Rejuvenated",
    assumedTier: 5,
    assumedTierSource: "guess",
    combatRank: "S",
    skills: [],
    playerDpsMult: 1,
    notes:
      "ASSUMED T5 — pick ONE extra relic from tiers 1–4 only (previous tiers). Competes with Infernal Fire on this assumed tier.",
    effects: ["Pick another relic from any previous tier"],
    tags: ["meta", "combo"],
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
  },
  {
    id: "crystal-grace",
    name: "Crystal Grace",
    assumedTier: 6,
    assumedTierSource: "guess",
    combatRank: "C",
    skills: [],
    playerDpsMult: 1.04,
    notes: "ASSUMED T6",
    effects: ["Unknown combat-adjacent"],
    tags: ["utility"],
  },
  {
    id: "superheated",
    name: "Superheated",
    assumedTier: 6,
    assumedTierSource: "guess",
    combatRank: "D",
    skills: ["smithing", "firemaking"],
    playerDpsMult: 1,
    notes: "ASSUMED T6 skilling",
    effects: ["Smithing/FM"],
    tags: ["skilling"],
  },
  {
    id: "natures-network",
    name: "Nature's Network",
    assumedTier: 6,
    assumedTierSource: "guess",
    combatRank: "D",
    skills: ["farming"],
    playerDpsMult: 1,
    notes: "ASSUMED T6",
    effects: ["Farming/tele"],
    tags: ["skilling"],
  },
  {
    id: "transmutation",
    name: "Transmutation",
    assumedTier: 7,
    assumedTierSource: "guess",
    combatRank: "D",
    skills: [],
    playerDpsMult: 1,
    notes: "ASSUMED T7",
    effects: ["Skilling"],
    tags: ["skilling"],
  },
  {
    id: "animal-wrangler",
    name: "Animal Wrangler",
    assumedTier: 7,
    assumedTierSource: "guess",
    combatRank: "D",
    skills: ["hunter"],
    playerDpsMult: 1,
    notes: "ASSUMED T7",
    effects: ["Hunter"],
    tags: ["skilling"],
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
  },
];

export const RELIC_BY_ID: Readonly<Record<string, RelicDef>> = Object.fromEntries(
  RELICS.map((r) => [r.id, r]),
);

export interface RelicLoadout {
  /** One pick per tier 1..7 (null = not yet unlocked) */
  byTier: Partial<Record<number, RelicId>>;
  /**
   * If some tier picked rejuvenated, the extra previous-tier relic claimed.
   * Must be from a tier < rejuvenatedTier and not already the pick on that tier
   * (it's the alternate from that tier).
   */
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

/** Active relic ids from a loadout (tier picks + optional Rejuvenated extra). */
export function activeRelicsFromLoadout(loadout: RelicLoadout): RelicId[] {
  const ids: RelicId[] = [];
  for (let t = 1; t <= 7; t++) {
    const id = loadout.byTier[t];
    if (id && id !== "none") ids.push(id);
  }
  if (loadout.rejuvenatedExtra) ids.push(loadout.rejuvenatedExtra.relic);
  return ids;
}

/**
 * Validate Rejuvenated rules:
 * - At most one relic per tier in byTier
 * - If Rejuvenated is picked on tier T, extra must be from tier < T
 * - Extra cannot be the same id as the original pick on that tier (you take the other option)
 * - Extra's assumedTier must match fromTier
 */
export function validateRelicLoadout(loadout: RelicLoadout): ValidatedRelics {
  const errors: string[] = [];
  const notes: string[] = [];
  const flags: string[] = [];

  // Check tier uniqueness of definitions
  for (let t = 1; t <= 7; t++) {
    const id = loadout.byTier[t];
    if (!id || id === "none") continue;
    const def = RELIC_BY_ID[id];
    if (!def) {
      errors.push(`Unknown relic ${id} on T${t}`);
      continue;
    }
    if (def.assumedTier !== t && def.id !== "rejuvenated") {
      // allow only if assumed matches — rejuvenated always on its tier
      if (def.assumedTier !== t) {
        notes.push(
          `WARN: ${def.name} assumed T${def.assumedTier} but slotted on T${t} (${def.assumedTierSource})`,
        );
      }
    }
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
      // Cannot be same as what you already picked on that tier
      if (loadout.byTier[fromTier] === relic) {
        errors.push(
          `Already picked ${relic} on T${fromTier} — Rejuvenated must take a different relic from a previous tier`,
        );
      }
      // Same-tier exclusivity: extra is from previous tier's options you skipped
      notes.push(
        `Rejuvenated T${rejTier} → extra ${def?.name ?? relic} from T${fromTier}`,
      );
    }
  }

  const active = activeRelicsFromLoadout(loadout);
  // Duplicate active ids?
  if (new Set(active).size !== active.length) {
    errors.push("Duplicate active relics");
  }

  // Devout + Infernal both active?
  if (active.includes("devout") && active.includes("infernal-fire")) {
    notes.push(
      "Devout+Infernal both active — valid when on different tiers (assumed T4+T5); Rejuvenated not required for that pair",
    );
  }
  if (active.includes("devout") && active.includes("naragi-edict")) {
    // both assumed T4 — INVALID without tier reassignment
    const d = RELIC_BY_ID.devout!;
    const n = RELIC_BY_ID["naragi-edict"]!;
    if (d.assumedTier === n.assumedTier) {
      errors.push(
        `Devout and Naragi Edict both assumed T${d.assumedTier} — mutually exclusive (one pick per tier)`,
      );
    }
  }
  if (active.includes("infernal-fire") && active.includes("rejuvenated")) {
    const i = RELIC_BY_ID["infernal-fire"]!;
    const r = RELIC_BY_ID.rejuvenated!;
    if (i.assumedTier === r.assumedTier) {
      errors.push(
        `Infernal Fire and Rejuvenated both assumed T${i.assumedTier} — cannot pick both on same tier`,
      );
    }
  }

  let mult = 1;
  for (const id of active) {
    const def = RELIC_BY_ID[id];
    if (def) mult *= def.playerDpsMult;
  }
  const devout = active.includes("devout");
  const divineDruid = active.includes("divine-druid");
  for (const id of active) {
    const def = RELIC_BY_ID[id];
    if (def) flags.push(`Relic: ${def.name}`);
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

/** Single primary relic (no double). */
export function stackRelicPlayerMult(
  primary: RelicId,
  secondary: RelicId | null = null,
): {
  mult: number;
  devout: boolean;
  divineDruid: boolean;
  flags: string[];
  valid: boolean;
  errors: string[];
  notes: string[];
} {
  // Legacy API: interpret secondary as Rejuvenated extra when primary isn't rejuvenated
  // NEW RULES: if both set, try to build a valid loadout
  if (!secondary || secondary === "none") {
    const def = RELIC_BY_ID[primary] ?? RELIC_BY_ID.none!;
    return {
      mult: def.playerDpsMult,
      devout: primary === "devout",
      divineDruid: primary === "divine-druid",
      flags: primary === "none" ? [] : [`Relic: ${def.name}`],
      valid: true,
      errors: [],
      notes: [],
    };
  }

  // Build assumed loadout: place each on its assumed tier; if conflict, invalid
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
      `${a.name} and ${b.name} are both assumed T${a.assumedTier} — cannot both be active (one pick per tier). Rejuvenated does NOT merge same-tier picks.`,
    );
    // still compute mult for "what if" but mark invalid
    return {
      mult: a.playerDpsMult * b.playerDpsMult,
      devout: primary === "devout" || secondary === "devout",
      divineDruid: primary === "divine-druid" || secondary === "divine-druid",
      flags: [`INVALID: ${a.name}+${b.name}`],
      valid: false,
      errors,
      notes: [
        "To combine two combat relics they must be on different tiers; use Rejuvenated on a LATER tier to reclaim a skipped earlier tier relic.",
      ],
    };
  } else {
    // Different tiers — both as normal picks (no Rejuvenated needed)
    byTier[a.assumedTier] = primary;
    byTier[b.assumedTier] = secondary;
  }

  const v = validateRelicLoadout({ byTier, rejuvenatedExtra });
  return {
    mult: v.mult,
    devout: v.devout,
    divineDruid: v.divineDruid,
    flags: v.valid ? v.flags : [...v.flags, ...v.errors.map((e) => `ERR: ${e}`)],
    valid: v.valid && errors.length === 0,
    errors: [...errors, ...v.errors],
    notes: v.notes,
  };
}

/**
 * Legal combat-oriented loadouts under assumed tiers.
 * Rejuvenated path: pick Rejuvenated on T5 → reclaim Devout (T4) while taking
 * something else on T4 was skipped... Actually if Rejuvenated is T5 and Infernal
 * is also T5, you MUST choose: Infernal OR Rejuvenated, not both.
 *
 * Valid high-combat paths:
 * - T4 Devout, T5 Infernal (no Rejuvenated) — BOTH if different tiers ✓
 * - T4 Naragi, T5 Infernal
 * - T4 Devout, T5 Rejuvenated → extra Icyenic (T3) or Perkfection (T3)
 * - T3 Icyenic, T4 Devout, T5 Infernal
 */
export function legalCombatLoadouts(): {
  id: string;
  label: string;
  loadout: RelicLoadout;
  validation: ValidatedRelics;
}[] {
  const specs: { id: string; label: string; loadout: RelicLoadout }[] = [
    {
      id: "devout-only",
      label: "T4 Devout only",
      loadout: { byTier: { 4: "devout" } },
    },
    {
      id: "infernal-only",
      label: "T5 Infernal only",
      loadout: { byTier: { 5: "infernal-fire" } },
    },
    {
      id: "icyenic-only",
      label: "T3 Icyenic only",
      loadout: { byTier: { 3: "icyenic-faith" } },
    },
    {
      id: "devout-plus-infernal",
      label: "T4 Devout + T5 Infernal (no Rejuv needed)",
      loadout: { byTier: { 4: "devout", 5: "infernal-fire" } },
    },
    {
      id: "icyenic-devout-infernal",
      label: "T3 Icyenic + T4 Devout + T5 Infernal",
      loadout: {
        byTier: { 3: "icyenic-faith", 4: "devout", 5: "infernal-fire" },
      },
    },
    {
      id: "perk-devout-infernal",
      label: "T3 Perkfection + T4 Devout + T5 Infernal",
      loadout: {
        byTier: { 3: "perkfection", 4: "devout", 5: "infernal-fire" },
      },
    },
    {
      id: "rejuv-reclaim-devout",
      label: "T4 Naragi + T5 Rejuvenated → reclaim Devout? INVALID same as need Devout on T4",
      loadout: {
        byTier: { 4: "naragi-edict", 5: "rejuvenated" },
        rejuvenatedExtra: { fromTier: 4, relic: "devout" },
      },
    },
    {
      id: "rejuv-reclaim-icyenic",
      label: "T3 Perkfection + T4 Devout + T5 Rejuvenated → Icyenic",
      loadout: {
        byTier: { 3: "perkfection", 4: "devout", 5: "rejuvenated" },
        rejuvenatedExtra: { fromTier: 3, relic: "icyenic-faith" },
      },
    },
    {
      id: "invalid-same-tier-devout-naragi",
      label: "INVALID T4 Devout+Naragi",
      loadout: { byTier: { 4: "devout" } }, // can't put both
    },
    {
      id: "none",
      label: "No combat relics",
      loadout: { byTier: {} },
    },
  ];

  // Fix rejuv reclaim devout: extra from T4 while T4 is Naragi — valid Rejuvenated pattern
  specs[6] = {
    id: "rejuv-reclaim-devout",
    label: "T4 Naragi + T5 Rejuvenated → reclaim Devout (valid)",
    loadout: {
      byTier: { 4: "naragi-edict", 5: "rejuvenated" },
      rejuvenatedExtra: { fromTier: 4, relic: "devout" },
    },
  };

  return specs.map((s) => ({
    ...s,
    validation: validateRelicLoadout(s.loadout),
  }));
}

/** @deprecated use legalCombatLoadouts — kept for old sims */
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

/** Only VALID doubles under assumed tiers (no fake same-tier stacks). */
export function combatRelicCombos(_includeRejuvDouble = true): {
  primary: RelicId;
  secondary: RelicId | null;
  label: string;
  valid: boolean;
}[] {
  const out: { primary: RelicId; secondary: RelicId | null; label: string; valid: boolean }[] = [];
  for (const p of COMBAT_RELIC_PICKS) {
    out.push({ primary: p, secondary: null, label: p, valid: true });
  }
  // Different-tier pairs (valid without Rejuvenated)
  const pairs: [RelicId, RelicId][] = [
    ["devout", "infernal-fire"], // T4 + T5
    ["icyenic-faith", "devout"], // T3 + T4
    ["icyenic-faith", "infernal-fire"], // T3 + T5
    ["perkfection", "devout"],
    ["perkfection", "infernal-fire"],
    ["divine-druid", "devout"], // T2 + T4
    ["divine-druid", "infernal-fire"],
    ["naragi-edict", "infernal-fire"], // T4 + T5
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
  // INVALID same-tier (for documentation in sims)
  out.push({
    primary: "devout",
    secondary: "naragi-edict",
    label: "INVALID:devout+naragi(same-tier)",
    valid: false,
  });
  // Rejuvenated: T5 Rejuv reclaiming T3 Icyenic while T4 Devout
  out.push({
    primary: "rejuvenated",
    secondary: "icyenic-faith",
    label: "rejuvenated→icyenic",
    valid: true,
  });
  return out;
}
