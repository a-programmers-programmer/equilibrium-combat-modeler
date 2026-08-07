/**
 * Summoning familiars, scrolls, and league relic interactions (OOP).
 *
 * Key Equilibrium relics:
 * - Devout: free scrolls, SP cost 10%, combat familiars +up to 500% dmg at 99 Summoning
 * - Divine Druid: 10 scrolls per pouch, skill boosts ×3 (training / QoL)
 *
 * Official: Big Boned does NOT buff familiar damage (player-sourced only).
 * Ancient Summoning: Contract Claws auto-completed → binding contracts available.
 */

import {
  AllReq,
  AnyReq,
  RegionReq,
  SkillReq,
  FlagReq,
  QuestReq,
  type Requirement,
  type PlayerSnapshot,
  type RegionTag,
  unsatisfied,
} from "./requirements";
import type { SkillId } from "../xp";

export type FamiliarId =
  | "none"
  | "steel-titan"
  | "iron-titan"
  | "pack-yak"
  | "ripper-demon"
  | "blood-reaver"
  | "kalgerion-demon"
  | "ice-nihil"
  | "blood-nihil"
  | "smoke-nihil"
  | "shadow-nihil"
  | "hellhound"
  | "bunyip"
  | "unicorn-stallion"
  | "dreadnip"; // not summoning pouch but dreadnip-like — excluded from familiar DPS

export type ScrollMode = "none" | "manual" | "devout-free" | "druid-stocked";

export interface FamiliarScroll {
  id: string;
  name: string;
  /** Average special mult on familiar autos when scroll is available */
  specialAvgMult: number;
  /** Scrolls used per minute at full uptime */
  scrollsPerMinute: number;
  notes: string;
}

export interface CombatFamiliar {
  id: FamiliarId;
  name: string;
  summoningLevel: number;
  /** Base auto-attack DPS at normal (no league, no scroll) — model units */
  baseDps: number;
  /** Is this a true combat DPS familiar */
  combat: boolean;
  scroll?: FamiliarScroll;
  /** Ancient Summoning / binding contract */
  ancient?: boolean;
  /** Style-linked utility (nihil accuracy) */
  playerDamageMult?: number;
  playerAccuracyMult?: number;
  regions: RegionTag[];
  flags: string[];
  quests: string[];
  notes: string;
}

export const COMBAT_FAMILIARS: readonly CombatFamiliar[] = [
  {
    id: "none",
    name: "No familiar",
    summoningLevel: 1,
    baseDps: 0,
    combat: false,
    regions: [],
    flags: [],
    quests: [],
    notes: "Baseline",
  },
  {
    id: "steel-titan",
    name: "Steel titan",
    summoningLevel: 99,
    baseDps: 320,
    combat: true,
    scroll: {
      id: "steel-of-legends",
      name: "Steel of Legends scroll",
      specialAvgMult: 1.65,
      scrollsPerMinute: 12,
      notes: "Classic titan special — strong with scroll uptime",
    },
    regions: [],
    flags: [],
    quests: [],
    notes: "T99 classic combat familiar. Free regions.",
  },
  {
    id: "iron-titan",
    name: "Iron titan",
    summoningLevel: 95,
    baseDps: 240,
    combat: true,
    scroll: {
      id: "iron-within",
      name: "Iron Within scroll",
      specialAvgMult: 1.5,
      scrollsPerMinute: 10,
      notes: "Mid titan",
    },
    regions: [],
    flags: [],
    quests: [],
    notes: "Budget titan",
  },
  {
    id: "ripper-demon",
    name: "Ripper demon (binding contract)",
    summoningLevel: 96,
    baseDps: 520,
    combat: true,
    ancient: true,
    scroll: {
      id: "death-from-above",
      name: "Ripper Demon scroll (Death From Above)",
      specialAvgMult: 2.15,
      scrollsPerMinute: 14,
      notes: "Next hit 200–320% max; BiS combat familiar with scrolls",
    },
    regions: ["forinthry"], // ripper demons in wilderness / forinthry-adjacent
    flags: ["unlocked:ancient-summoning", "unlocked:binding-ripper"],
    quests: [],
    notes: "Ancient Summoning BiS DPS familiar. Contract Claws auto in Equilibrium.",
  },
  {
    id: "blood-reaver",
    name: "Blood reaver (binding contract)",
    summoningLevel: 96,
    baseDps: 280,
    combat: true,
    ancient: true,
    scroll: {
      id: "soul-gazer-scroll",
      name: "Blood reaver scroll",
      specialAvgMult: 1.35,
      scrollsPerMinute: 10,
      notes: "Damage + sustain",
    },
    playerDamageMult: 1.02,
    regions: ["forinthry"],
    flags: ["unlocked:ancient-summoning"],
    quests: [],
    notes: "Sustain familiar; lower raw DPS than ripper",
  },
  {
    id: "kalgerion-demon",
    name: "Kal'gerion demon",
    summoningLevel: 90,
    baseDps: 300,
    combat: true,
    scroll: {
      id: "crit-kalg",
      name: "Kal'gerion scroll",
      specialAvgMult: 1.4,
      scrollsPerMinute: 8,
      notes: "Crit-oriented",
    },
    playerDamageMult: 1.03,
    regions: ["forinthry"], // Dungeoneering / Daemonheim line
    flags: [],
    quests: [],
    notes: "Player crit synergy",
  },
  {
    id: "ice-nihil",
    name: "Ice nihil",
    summoningLevel: 87,
    baseDps: 140,
    combat: true,
    scroll: {
      id: "ice-nihil-scroll",
      name: "Ice nihil scroll",
      specialAvgMult: 1.25,
      scrollsPerMinute: 8,
      notes: "Style accuracy support",
    },
    playerAccuracyMult: 1.05,
    playerDamageMult: 1.04,
    regions: ["forinthry"],
    flags: ["killed:nihil"],
    quests: [],
    notes: "Accuracy familiar — player mult more than familiar autos",
  },
  {
    id: "blood-nihil",
    name: "Blood nihil",
    summoningLevel: 87,
    baseDps: 140,
    combat: true,
    playerAccuracyMult: 1.05,
    playerDamageMult: 1.04,
    regions: ["forinthry"],
    flags: ["killed:nihil"],
    quests: [],
    notes: "Melee accuracy nihil",
  },
  {
    id: "smoke-nihil",
    name: "Smoke nihil",
    summoningLevel: 87,
    baseDps: 140,
    combat: true,
    playerAccuracyMult: 1.05,
    playerDamageMult: 1.04,
    regions: ["forinthry"],
    flags: ["killed:nihil"],
    quests: [],
    notes: "Magic accuracy nihil",
  },
  {
    id: "shadow-nihil",
    name: "Shadow nihil",
    summoningLevel: 87,
    baseDps: 140,
    combat: true,
    playerAccuracyMult: 1.05,
    playerDamageMult: 1.04,
    regions: ["forinthry"],
    flags: ["killed:nihil"],
    quests: [],
    notes: "Ranged accuracy nihil",
  },
  {
    id: "hellhound",
    name: "Hellhound",
    summoningLevel: 45,
    baseDps: 40,
    combat: true,
    regions: [],
    flags: [],
    quests: [],
    notes: "Early combat familiar",
  },
  {
    id: "pack-yak",
    name: "Pack yak",
    summoningLevel: 96,
    baseDps: 0,
    combat: false,
    regions: [],
    flags: [],
    quests: [],
    notes: "Utility only — no combat DPS",
  },
  {
    id: "bunyip",
    name: "Bunyip",
    summoningLevel: 68,
    baseDps: 0,
    combat: false,
    regions: [],
    flags: [],
    quests: [],
    notes: "Heal utility",
  },
  {
    id: "unicorn-stallion",
    name: "Unicorn stallion",
    summoningLevel: 88,
    baseDps: 0,
    combat: false,
    regions: [],
    flags: [],
    quests: [],
    notes: "Heal utility",
  },
];

export const FAMILIAR_BY_ID: Readonly<Record<string, CombatFamiliar>> = Object.fromEntries(
  COMBAT_FAMILIARS.map((f) => [f.id, f]),
);

export function familiarRequirement(f: CombatFamiliar): Requirement {
  const parts: Requirement[] = [new SkillReq("summoning" as SkillId, f.summoningLevel)];
  for (const r of f.regions) parts.push(new RegionReq(r));
  for (const fl of f.flags) parts.push(new FlagReq(fl, fl));
  for (const q of f.quests) parts.push(new QuestReq(q, q));
  if (f.ancient) {
    parts.push(new FlagReq("unlocked:ancient-summoning", "Ancient Summoning"));
  }
  return parts.length === 1 ? parts[0]! : new AllReq(parts);
}

export function familiarAccessible(f: CombatFamiliar, p: PlayerSnapshot, soft = true): boolean {
  if ((p.levels.summoning ?? 1) < f.summoningLevel) return false;
  for (const r of f.regions) {
    if (!p.regions.has(r) && !p.regions.has("free")) {
      // need region
      if (!p.regions.has(r)) return false;
    }
  }
  if (!soft) return familiarRequirement(f).satisfied(p);
  for (const r of f.regions) {
    if (!p.regions.has(r)) return false;
  }
  if (f.ancient && !p.flags.has("unlocked:ancient-summoning") && !soft) return false;
  // soft: ancient unlocked via league auto if flag or ignore
  if (f.ancient && soft) {
    // allow if free regions always have contract claws auto
    if (!p.flags.has("unlocked:ancient-summoning") && !p.flags.has("league:contract-claws-auto")) {
      // still allow soft planning if forinthry unlocked (contracts farmed there)
      if (!f.regions.every((r) => p.regions.has(r))) return false;
    }
  }
  return true;
}

export interface SummoningRelicState {
  devout: boolean;
  divineDruid: boolean;
  summoningLevel: number;
}

/**
 * Devout: up to +500% familiar damage at 99 Summoning → mult = 1 + 5*(lvl/99)
 */
export function devoutFamiliarMult(summoningLevel: number, hasDevout: boolean): number {
  if (!hasDevout) return 1;
  const t = Math.min(1, Math.max(0, summoningLevel / 99));
  return 1 + 5 * t;
}

/**
 * Scroll uptime: without free scrolls SP-limited; Devout → near permanent.
 * Divine Druid stocks 10 scrolls/pouch → high uptime without Devout.
 */
export function scrollUptime(mode: ScrollMode, hasDevout: boolean, hasDruid: boolean): number {
  if (hasDevout) return 0.98; // free + 10% SP cost
  if (mode === "none") return 0;
  if (hasDruid || mode === "druid-stocked") return 0.75;
  if (mode === "manual") return 0.4;
  if (mode === "devout-free") return 0.98;
  return 0.4;
}

export interface FamiliarDpsResult {
  familiarId: FamiliarId;
  name: string;
  familiarDps: number;
  playerDamageMult: number;
  playerAccuracyMult: number;
  devoutMult: number;
  scrollUptime: number;
  scrollMult: number;
  breakdown: string[];
  accessible: boolean;
  missing: string[];
}

export function modelFamiliarDps(
  familiar: CombatFamiliar,
  opts: {
    summoningLevel: number;
    devout: boolean;
    divineDruid: boolean;
    scrollMode?: ScrollMode;
    player?: PlayerSnapshot;
    softAccess?: boolean;
  },
): FamiliarDpsResult {
  const breakdown: string[] = [];
  let accessible = true;
  let missing: string[] = [];

  if (opts.player) {
    accessible = familiarAccessible(familiar, opts.player, opts.softAccess ?? true);
    if (!accessible) missing = unsatisfied(familiarRequirement(familiar), opts.player);
  }
  if (opts.summoningLevel < familiar.summoningLevel) {
    accessible = false;
    missing.push(`summoning ${opts.summoningLevel}<${familiar.summoningLevel}`);
  }

  if (!familiar.combat || familiar.id === "none") {
    return {
      familiarId: familiar.id,
      name: familiar.name,
      familiarDps: 0,
      playerDamageMult: familiar.playerDamageMult ?? 1,
      playerAccuracyMult: familiar.playerAccuracyMult ?? 1,
      devoutMult: 1,
      scrollUptime: 0,
      scrollMult: 1,
      breakdown: ["non-combat familiar"],
      accessible,
      missing,
    };
  }

  const devoutMult = devoutFamiliarMult(opts.summoningLevel, opts.devout);
  const uptime = scrollUptime(
    opts.scrollMode ?? (opts.devout ? "devout-free" : opts.divineDruid ? "druid-stocked" : "manual"),
    opts.devout,
    opts.divineDruid,
  );
  const specialMult = familiar.scroll?.specialAvgMult ?? 1;
  // blend: uptime * special + (1-uptime) * 1
  const scrollMult = 1 + (specialMult - 1) * uptime;

  let dps = familiar.baseDps * scrollMult * devoutMult;
  breakdown.push(`base ${familiar.baseDps}`);
  breakdown.push(`scroll ×${scrollMult.toFixed(3)} (uptime ${(uptime * 100).toFixed(0)}%)`);
  if (opts.devout) breakdown.push(`Devout ×${devoutMult.toFixed(2)} (sum ${opts.summoningLevel})`);
  if (opts.divineDruid && !opts.devout) breakdown.push("Divine Druid scroll stock");

  // Scale slightly with summoning level even without Devout (better scroll weaving)
  if (!opts.devout && opts.summoningLevel >= 90) {
    dps *= 1.05;
    breakdown.push("high Summoning craft +5%");
  }

  return {
    familiarId: familiar.id,
    name: familiar.name,
    familiarDps: dps,
    playerDamageMult: familiar.playerDamageMult ?? 1,
    playerAccuracyMult: familiar.playerAccuracyMult ?? 1,
    devoutMult,
    scrollUptime: uptime,
    scrollMult,
    breakdown,
    accessible,
    missing,
  };
}

/** Best accessible combat familiar for player. */
export function pickBestFamiliar(
  player: PlayerSnapshot,
  opts: { devout: boolean; divineDruid: boolean; soft?: boolean },
): FamiliarDpsResult {
  const sumLvl = player.levels.summoning ?? 1;
  let best: FamiliarDpsResult | null = null;
  for (const f of COMBAT_FAMILIARS) {
    if (!f.combat && f.id !== "none") continue;
    const r = modelFamiliarDps(f, {
      summoningLevel: sumLvl,
      devout: opts.devout,
      divineDruid: opts.divineDruid,
      player,
      softAccess: opts.soft ?? true,
    });
    if (!r.accessible && f.id !== "none") continue;
    if (!best || r.familiarDps * r.playerDamageMult > best.familiarDps * best.playerDamageMult) {
      best = r;
    }
  }
  return best ?? modelFamiliarDps(FAMILIAR_BY_ID.none!, {
    summoningLevel: sumLvl,
    devout: opts.devout,
    divineDruid: opts.divineDruid,
  });
}
