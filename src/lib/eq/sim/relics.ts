/**
 * Equilibrium League relics — mutually exclusive per tier (tier assignment
 * partially unknown pre-launch; combat-relevant ones modeled for DPS).
 *
 * Combat-critical:
 * - Devout: familiar damage + scroll economy (Summoning)
 * - Divine Druid: scroll stock / Summoning training
 * - Naragi Edict: 255 combat levels duty cycle + pocket
 * - Infernal Fire: Death Mark 100% execute at 20% HP
 * - Icyenic Faith: prayer → AD/crit + full protect+SS
 * - Perkfection: helpful perks +20% proc
 * - Rejuvenated: pick another prior-tier relic (double-dip)
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
  /** Combat relevance S/A/B/C/D */
  combatTier: "S" | "A" | "B" | "C" | "D";
  skills: string[];
  /** Approximate player DPS mult from relic alone (1 = none) */
  playerDpsMult: number;
  /** Flat AD-like contribution modeled as DPS mult extras */
  notes: string;
  effects: string[];
  /** Tags for sim branching */
  tags: string[];
}

export const RELICS: readonly RelicDef[] = [
  {
    id: "devout",
    name: "Devout",
    combatTier: "S",
    skills: ["summoning"],
    playerDpsMult: 1,
    notes: "Free scrolls, SP 10%, combat familiars up to +500% dmg at 99 Summoning",
    effects: [
      "Summoning scrolls not consumed",
      "Familiar SP cost 10%",
      "Combat familiars +up to 500% damage at 99 Summoning",
      "Devout Yak (32 slot bank familiar)",
    ],
    tags: ["summoning", "familiar-dps", "scrolls"],
  },
  {
    id: "divine-druid",
    name: "Divine Druid",
    combatTier: "B",
    skills: ["summoning", "herblore", "divination"],
    playerDpsMult: 1.02,
    notes: "10 scrolls per pouch + herblore economy; skill boosts ×3",
    effects: [
      "Always 10 scrolls when making pouch",
      "Charm drops 5×",
      "Skill-boost familiars ×3",
      "Thera's Summoning pouch",
    ],
    tags: ["summoning", "scrolls", "herblore"],
  },
  {
    id: "naragi-edict",
    name: "Naragi Edict",
    combatTier: "S",
    skills: ["combat"],
    // 16.8s / 90s of huge boost ≈ 18.7% uptime; model ~+12% sustained DPS
    playerDpsMult: 1.12,
    notes: "Sliver: 255 combat stats 16.8s/90s + pocket combat bonuses",
    effects: [
      "Activate every 90s for 16.8s: heal + combat levels 255",
      "Pocket: +300 armour, +14 style dmg, +1500 LP, +15 prayer",
    ],
    tags: ["combat", "burst", "pocket"],
  },
  {
    id: "infernal-fire",
    name: "Infernal Fire",
    combatTier: "S",
    skills: ["combat"],
    // Death Mark at 20% HP ≈ ~15–25% kill-time save on long fights; model +18% effective
    playerDpsMult: 1.18,
    notes: "Avernic Star: Death Mark 100% — execute at 20% HP",
    effects: [
      "Death Mark always applies — kill at 20% remaining HP",
      "+5% adren on Death Mark kill",
      "Pocket style bonuses",
    ],
    tags: ["combat", "execute", "pocket"],
  },
  {
    id: "icyenic-faith",
    name: "Icyenic Faith",
    combatTier: "A",
    skills: ["prayer"],
    // Tome: 0.2% AD per prayer bonus; +50 prayer from tome + gear ~80 prayer → ~16% AD
    playerDpsMult: 1.14,
    notes: "Tome: AD/crit from prayer bonus; 100% protect + Soul Split",
    effects: [
      "+50 prayer bonus tome",
      "0.2% crit and 0.2% ability damage per 1 prayer bonus",
      "Protect prayers block 100% and act as Soul Split",
    ],
    tags: ["prayer", "survivability", "dps"],
  },
  {
    id: "perkfection",
    name: "Perkfection",
    combatTier: "A",
    skills: ["invention"],
    playerDpsMult: 1.08,
    notes: "Helpful perks +20% proc; free charges; extra gizmo toolbox",
    effects: [
      "Helpful perks trigger 20% more often",
      "Inventor toolbox: 2 extra gizmo slots",
      "No charge drain, 10× materials",
    ],
    tags: ["invention", "perks"],
  },
  {
    id: "assassins-insight",
    name: "Assassin's Insight",
    combatTier: "C",
    skills: ["slayer"],
    playerDpsMult: 1.03,
    notes: "Corrupted slayer helm effects + elite spawn rate — mild combat",
    effects: ["Corrupted slayer helmet effects", "Elite monsters 5×", "Slayer QoL"],
    tags: ["slayer"],
  },
  {
    id: "voidwalker",
    name: "Voidwalker",
    combatTier: "D",
    skills: ["divination", "invention"],
    playerDpsMult: 1,
    notes: "Loot/teleports — not direct DPS",
    effects: ["Void shards loot table", "Abyssal conduit teleports"],
    tags: ["utility"],
  },
  {
    id: "rejuvenated",
    name: "Rejuvenated",
    combatTier: "S",
    skills: [],
    playerDpsMult: 1,
    notes: "Pick another relic from a previous tier (combo enabler)",
    effects: ["Choose an additional prior-tier relic"],
    tags: ["meta", "combo"],
  },
  {
    id: "endless-harvest",
    name: "Endless Harvest",
    combatTier: "D",
    skills: ["gathering"],
    playerDpsMult: 1,
    notes: "Gathering",
    effects: ["Auto-bank resources"],
    tags: ["skilling"],
  },
  {
    id: "survivalist",
    name: "Survivalist",
    combatTier: "D",
    skills: ["gathering"],
    playerDpsMult: 1,
    notes: "Gathering",
    effects: ["Double resources"],
    tags: ["skilling"],
  },
  {
    id: "golden-touch",
    name: "Golden Touch",
    combatTier: "D",
    skills: ["agility", "thieving"],
    playerDpsMult: 1,
    notes: "Agility/Thieving",
    effects: ["Goldenhawk boots"],
    tags: ["skilling"],
  },
  {
    id: "none",
    name: "No combat relic",
    combatTier: "D",
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

/** Combat-focused relic picks to sweep (unknown tier → treat as independent choices). */
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

/**
 * Rejuvenated enables double-dip: primary + secondary combat relic.
 * Model combinations where Rejuvenated is assumed at some tier.
 */
export function combatRelicCombos(includeRejuvDouble = true): { primary: RelicId; secondary: RelicId | null; label: string }[] {
  const out: { primary: RelicId; secondary: RelicId | null; label: string }[] = [];
  for (const p of COMBAT_RELIC_PICKS) {
    out.push({ primary: p, secondary: null, label: p });
  }
  if (includeRejuvDouble) {
    // Strong doubles: Devout + Infernal/Naragi/Icyenic, etc.
    const doubles: [RelicId, RelicId][] = [
      ["devout", "infernal-fire"],
      ["devout", "naragi-edict"],
      ["devout", "icyenic-faith"],
      ["devout", "perkfection"],
      ["infernal-fire", "naragi-edict"],
      ["infernal-fire", "icyenic-faith"],
      ["naragi-edict", "icyenic-faith"],
      ["divine-druid", "devout"], // training + combat — can't both if same tier; Rejuv only
      ["perkfection", "infernal-fire"],
    ];
    for (const [a, b] of doubles) {
      out.push({ primary: a, secondary: b, label: `${a}+${b}(rejuv)` });
    }
  }
  return out;
}

export function stackRelicPlayerMult(primary: RelicId, secondary: RelicId | null): {
  mult: number;
  devout: boolean;
  divineDruid: boolean;
  flags: string[];
} {
  const a = RELIC_BY_ID[primary] ?? RELIC_BY_ID.none!;
  const b = secondary ? RELIC_BY_ID[secondary] : null;
  const mult = a.playerDpsMult * (b?.playerDpsMult ?? 1);
  const ids = new Set([primary, secondary].filter(Boolean) as RelicId[]);
  return {
    mult,
    devout: ids.has("devout"),
    divineDruid: ids.has("divine-druid"),
    flags: [
      `Relic: ${a.name}${b ? ` + ${b.name}` : ""}`,
      ...(a.effects.slice(0, 2)),
      ...(b?.effects.slice(0, 2) ?? []),
    ],
  };
}
