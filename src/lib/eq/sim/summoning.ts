/**
 * Summoning familiars, scrolls, and league relic interactions (OOP).
 *
 * Every familiar is a Requirement-gated object (skill + region + quest + flags),
 * same graph as Equipment. modelCombat must only apply DPS when accessible.
 *
 * Equilibrium:
 * - Devout: free scrolls, SP 10%, combat familiars up to +500% dmg at 99 Summoning
 * - Divine Druid: 10 scrolls/pouch, skill boosts ×3
 * - Contract Claws auto → Ancient Summoning path available (still need contracts/regions)
 * - Big Boned does NOT buff familiar damage
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
  | "spirit-terrorbird"
  | "war-tortoise"
  | "bunyip"
  | "unicorn-stallion"
  | "giant-wolpertinger"
  | "spirit-kyatt"
  | "arctic-bear"
  | "lava-titan"
  | "swamp-titan"
  | "geyser-titan"
  | "obsidian-golem";

export type ScrollMode = "none" | "manual" | "devout-free" | "druid-stocked";

export interface FamiliarScroll {
  id: string;
  name: string;
  specialAvgMult: number;
  scrollsPerMinute: number;
  /** Extra Summoning level to use the scroll effectively */
  scrollLevel?: number;
  notes: string;
}

export interface FamiliarDef {
  id: FamiliarId;
  name: string;
  summoningLevel: number;
  baseDps: number;
  combat: boolean;
  scroll?: FamiliarScroll;
  ancient?: boolean;
  playerDamageMult?: number;
  playerAccuracyMult?: number;
  /** Elective regions required (empty = free path) */
  regions: RegionTag[];
  flags: string[];
  quests: string[];
  /** Charm type for pouch (informational / soft flag) */
  charm?: "gold" | "green" | "crimson" | "blue" | "elder" | "binding";
  notes: string;
}

export const FAMILIAR_DEFS: readonly FamiliarDef[] = [
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
  // ── Early free path ──────────────────────────────────────────────
  {
    id: "spirit-terrorbird",
    name: "Spirit terrorbird",
    summoningLevel: 52,
    baseDps: 0,
    combat: false,
    regions: [],
    flags: [],
    quests: [],
    charm: "gold",
    notes: "Run energy utility — free path",
  },
  {
    id: "war-tortoise",
    name: "War tortoise",
    summoningLevel: 67,
    baseDps: 0,
    combat: false,
    regions: [],
    flags: [],
    quests: [],
    charm: "gold",
    notes: "Inventory utility",
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
    charm: "crimson",
    notes: "Early combat familiar — free path",
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
    charm: "green",
    notes: "Heal utility — free path",
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
    charm: "green",
    notes: "Heal utility — free path",
  },
  {
    id: "spirit-kyatt",
    name: "Spirit kyatt",
    summoningLevel: 57,
    baseDps: 55,
    combat: true,
    regions: [],
    flags: [],
    quests: [],
    charm: "green",
    notes: "Early teleport/combat hybrid",
  },
  {
    id: "arctic-bear",
    name: "Arctic bear",
    summoningLevel: 71,
    baseDps: 70,
    combat: true,
    regions: ["fremennik"],
    flags: [],
    quests: [],
    charm: "gold",
    notes: "Fremennik hunter content adjacency",
  },
  {
    id: "giant-wolpertinger",
    name: "Giant wolpertinger",
    summoningLevel: 92,
    baseDps: 90,
    combat: true,
    scroll: {
      id: "wolpertinger-scroll",
      name: "Magic focus scroll",
      specialAvgMult: 1.2,
      scrollsPerMinute: 6,
      notes: "Magic accuracy support",
    },
    playerDamageMult: 1.02,
    regions: [],
    flags: [],
    quests: [],
    charm: "crimson",
    notes: "Magic support familiar — free path pouch",
  },
  // ── Titans (free pouch path; materials widely available) ─────────
  {
    id: "lava-titan",
    name: "Lava titan",
    summoningLevel: 83,
    baseDps: 160,
    combat: true,
    scroll: {
      id: "titan-lava",
      name: "Ebon thunder scroll",
      specialAvgMult: 1.35,
      scrollsPerMinute: 8,
      notes: "Mid titan",
    },
    regions: [],
    flags: [],
    quests: [],
    charm: "blue",
    notes: "Mid combat titan — free path",
  },
  {
    id: "swamp-titan",
    name: "Swamp titan",
    summoningLevel: 85,
    baseDps: 170,
    combat: true,
    regions: [],
    flags: [],
    quests: [],
    charm: "blue",
    notes: "Mid combat titan",
  },
  {
    id: "geyser-titan",
    name: "Geyser titan",
    summoningLevel: 89,
    baseDps: 190,
    combat: true,
    regions: [],
    flags: [],
    quests: [],
    charm: "blue",
    notes: "High mid titan",
  },
  {
    id: "obsidian-golem",
    name: "Obsidian golem",
    summoningLevel: 73,
    baseDps: 100,
    combat: true,
    regions: ["karamja"],
    flags: [],
    quests: [],
    charm: "blue",
    notes: "Karamja (milestone free) — mining boost + combat",
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
      scrollLevel: 95,
      notes: "Mid titan special",
    },
    regions: [],
    flags: [],
    quests: [],
    charm: "blue",
    notes: "T95 titan — free path at 95 Summoning",
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
      scrollLevel: 99,
      notes: "Classic titan special",
    },
    regions: [],
    flags: [],
    quests: [],
    charm: "blue",
    notes: "T99 classic combat familiar — free path at 99 Summoning",
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
    charm: "crimson",
    notes: "Inventory utility — free path",
  },
  // ── Forinthry / Wilderness / Dungeoneering line ──────────────────
  {
    id: "kalgerion-demon",
    name: "Kal'gerion demon",
    summoningLevel: 90,
    baseDps: 300,
    combat: true,
    scroll: {
      id: "crit-kalg",
      name: "Kal'gerion warscroll",
      specialAvgMult: 1.4,
      scrollsPerMinute: 8,
      notes: "Crit-oriented",
    },
    playerDamageMult: 1.03,
    regions: ["forinthry"],
    flags: ["unlocked:dungeoneering-kalg"],
    quests: [],
    charm: "crimson",
    notes: "Daemonheim / Forinthry — player crit synergy",
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
      notes: "Style accuracy",
    },
    playerAccuracyMult: 1.05,
    playerDamageMult: 1.04,
    regions: ["forinthry"],
    flags: ["killed:nihil", "unlocked:nihil-pouches"],
    quests: [],
    charm: "crimson",
    notes: "Nihil pouch — Forinthry (Fate of the Gods line / wilderness nihil)",
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
    flags: ["killed:nihil", "unlocked:nihil-pouches"],
    quests: [],
    charm: "crimson",
    notes: "Melee accuracy nihil — Forinthry",
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
    flags: ["killed:nihil", "unlocked:nihil-pouches"],
    quests: [],
    charm: "crimson",
    notes: "Magic accuracy nihil — Forinthry",
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
    flags: ["killed:nihil", "unlocked:nihil-pouches"],
    quests: [],
    charm: "crimson",
    notes: "Ranged accuracy nihil — Forinthry",
  },
  // ── Ancient Summoning / binding contracts ────────────────────────
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
      scrollLevel: 96,
      notes: "Next hit 200–320% max; BiS combat familiar with scrolls",
    },
    regions: ["forinthry"],
    flags: [
      "unlocked:ancient-summoning",
      "unlocked:binding-contracts",
      "unlocked:binding-ripper",
    ],
    quests: [],
    charm: "binding",
    notes:
      "Ancient Summoning. Contract Claws auto in Equilibrium unlocks path, but you still need Forinthry contracts + 96 Summoning + materials.",
  },
  {
    id: "blood-reaver",
    name: "Blood reaver (binding contract)",
    summoningLevel: 96,
    baseDps: 280,
    combat: true,
    ancient: true,
    scroll: {
      id: "blood-reaver-scroll",
      name: "Blood reaver scroll",
      specialAvgMult: 1.35,
      scrollsPerMinute: 10,
      scrollLevel: 96,
      notes: "Damage + sustain",
    },
    playerDamageMult: 1.02,
    regions: ["forinthry"],
    flags: ["unlocked:ancient-summoning", "unlocked:binding-contracts"],
    quests: [],
    charm: "binding",
    notes: "Ancient Summoning sustain familiar — Forinthry",
  },
];

/** @deprecated alias */
export const COMBAT_FAMILIARS = FAMILIAR_DEFS;

/**
 * OOP familiar — every instance carries a Requirement graph.
 */
export class Familiar {
  readonly id: FamiliarId;
  readonly name: string;
  readonly summoningLevel: number;
  readonly baseDps: number;
  readonly combat: boolean;
  readonly scroll?: FamiliarScroll;
  readonly ancient: boolean;
  readonly playerDamageMult: number;
  readonly playerAccuracyMult: number;
  readonly regions: RegionTag[];
  readonly flags: string[];
  readonly quests: string[];
  readonly charm?: string;
  readonly notes: string;
  readonly req: Requirement;

  constructor(def: FamiliarDef) {
    this.id = def.id;
    this.name = def.name;
    this.summoningLevel = def.summoningLevel;
    this.baseDps = def.baseDps;
    this.combat = def.combat;
    this.scroll = def.scroll;
    this.ancient = !!def.ancient;
    this.playerDamageMult = def.playerDamageMult ?? 1;
    this.playerAccuracyMult = def.playerAccuracyMult ?? 1;
    this.regions = def.regions;
    this.flags = def.flags;
    this.quests = def.quests;
    this.charm = def.charm;
    this.notes = def.notes;
    this.req = buildFamiliarReq(def);
  }

  /** Full hard check (skills + regions + quests + flags). */
  accessible(p: PlayerSnapshot): boolean {
    return this.req.satisfied(p);
  }

  /**
   * Planning check: region + Summoning level hard;
   * boss/unlock flags soft if region owned (can farm once unlocked).
   * Ancient Summoning flag soft if league auto OR forinthry owned.
   */
  accessibleSoft(p: PlayerSnapshot): boolean {
    if ((p.levels.summoning ?? 1) < this.summoningLevel) return false;
    for (const r of this.regions) {
      if (!p.regions.has(r)) return false;
    }
    if (this.ancient) {
      const ancientOk =
        p.flags.has("unlocked:ancient-summoning") ||
        p.flags.has("league:contract-claws-auto") ||
        // Equilibrium: Contract Claws auto-completed in free regions
        p.regions.has("free") ||
        p.regions.has("misthalin");
      if (!ancientOk) return false;
      // still need forinthry for contracts
      if (!this.regions.every((r) => p.regions.has(r))) return false;
    }
    return true;
  }

  missing(p: PlayerSnapshot): string[] {
    return unsatisfied(this.req, p);
  }

  missingSoft(p: PlayerSnapshot): string[] {
    const miss: string[] = [];
    if ((p.levels.summoning ?? 1) < this.summoningLevel) {
      miss.push(`summoning ${(p.levels.summoning ?? 1)}<${this.summoningLevel}`);
    }
    for (const r of this.regions) {
      if (!p.regions.has(r)) miss.push(`region:${r}`);
    }
    if (this.ancient && !this.accessibleSoft(p)) {
      miss.push("ancient-summoning/binding-contract path");
    }
    return miss;
  }

  describeReq(): string {
    return this.req.describe();
  }
}

function buildFamiliarReq(def: FamiliarDef): Requirement {
  const parts: Requirement[] = [
    new SkillReq("summoning" as SkillId, def.summoningLevel),
  ];
  for (const r of def.regions) parts.push(new RegionReq(r));
  for (const q of def.quests) parts.push(new QuestReq(q, q));
  for (const f of def.flags) parts.push(new FlagReq(f, f));
  if (def.ancient) {
    parts.push(
      new AnyReq([
        new FlagReq("unlocked:ancient-summoning", "Ancient Summoning"),
        new FlagReq("league:contract-claws-auto", "Contract Claws auto"),
      ]),
    );
  }
  if (def.scroll?.scrollLevel && def.scroll.scrollLevel > def.summoningLevel) {
    parts.push(new SkillReq("summoning" as SkillId, def.scroll.scrollLevel));
  }
  return parts.length === 1 ? parts[0]! : new AllReq(parts);
}

export const FAMILIAR_CATALOG: readonly Familiar[] = FAMILIAR_DEFS.map((d) => new Familiar(d));
export const FAMILIAR_BY_ID: Readonly<Record<string, Familiar>> = Object.fromEntries(
  FAMILIAR_CATALOG.map((f) => [f.id, f]),
);

export function familiarRequirement(f: FamiliarDef | Familiar): Requirement {
  if (f instanceof Familiar) return f.req;
  return buildFamiliarReq(f);
}

export function familiarAccessible(
  f: FamiliarDef | Familiar,
  p: PlayerSnapshot,
  soft = true,
): boolean {
  const fam = f instanceof Familiar ? f : FAMILIAR_BY_ID[f.id];
  if (!fam) return false;
  return soft ? fam.accessibleSoft(p) : fam.accessible(p);
}

export interface SummoningRelicState {
  devout: boolean;
  divineDruid: boolean;
  summoningLevel: number;
}

export function devoutFamiliarMult(summoningLevel: number, hasDevout: boolean): number {
  if (!hasDevout) return 1;
  const t = Math.min(1, Math.max(0, summoningLevel / 99));
  return 1 + 5 * t;
}

export function scrollUptime(mode: ScrollMode, hasDevout: boolean, hasDruid: boolean): number {
  if (hasDevout) return 0.98;
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
  locked: boolean;
}

export function modelFamiliarDps(
  familiar: Familiar | FamiliarDef | FamiliarId,
  opts: {
    summoningLevel: number;
    devout: boolean;
    divineDruid: boolean;
    scrollMode?: ScrollMode;
    player?: PlayerSnapshot;
    /** default soft for planning; hard for strict sims */
    accessMode?: "soft" | "hard" | "ignore";
  },
): FamiliarDpsResult {
  const fam: Familiar =
    typeof familiar === "string"
      ? FAMILIAR_BY_ID[familiar] ?? FAMILIAR_BY_ID.none!
      : familiar instanceof Familiar
        ? familiar
        : FAMILIAR_BY_ID[familiar.id] ?? new Familiar(familiar);

  const breakdown: string[] = [];
  const mode = opts.accessMode ?? (opts.player ? "soft" : "ignore");
  let accessible = true;
  let missing: string[] = [];

  if (opts.player && mode !== "ignore") {
    accessible = mode === "hard" ? fam.accessible(opts.player) : fam.accessibleSoft(opts.player);
    missing = mode === "hard" ? fam.missing(opts.player) : fam.missingSoft(opts.player);
  }
  if (opts.summoningLevel < fam.summoningLevel) {
    accessible = false;
    if (!missing.some((m) => m.startsWith("summoning"))) {
      missing.push(`summoning ${opts.summoningLevel}<${fam.summoningLevel}`);
    }
  }

  // LOCKED: zero contribution
  if (!accessible && fam.id !== "none") {
    return {
      familiarId: fam.id,
      name: fam.name,
      familiarDps: 0,
      playerDamageMult: 1,
      playerAccuracyMult: 1,
      devoutMult: 1,
      scrollUptime: 0,
      scrollMult: 1,
      breakdown: [`LOCKED: ${missing.join(", ") || fam.describeReq()}`],
      accessible: false,
      missing,
      locked: true,
    };
  }

  if (!fam.combat || fam.id === "none") {
    return {
      familiarId: fam.id,
      name: fam.name,
      familiarDps: 0,
      playerDamageMult: fam.playerDamageMult,
      playerAccuracyMult: fam.playerAccuracyMult,
      devoutMult: 1,
      scrollUptime: 0,
      scrollMult: 1,
      breakdown: ["non-combat / none"],
      accessible: true,
      missing: [],
      locked: false,
    };
  }

  const devoutMult = devoutFamiliarMult(opts.summoningLevel, opts.devout);
  const uptime = scrollUptime(
    opts.scrollMode ?? (opts.devout ? "devout-free" : opts.divineDruid ? "druid-stocked" : "manual"),
    opts.devout,
    opts.divineDruid,
  );
  const specialMult = fam.scroll?.specialAvgMult ?? 1;
  const scrollMult = 1 + (specialMult - 1) * uptime;
  let dps = fam.baseDps * scrollMult * devoutMult;
  breakdown.push(`base ${fam.baseDps}`);
  breakdown.push(`scroll ×${scrollMult.toFixed(3)} (uptime ${(uptime * 100).toFixed(0)}%)`);
  if (opts.devout) breakdown.push(`Devout ×${devoutMult.toFixed(2)} (sum ${opts.summoningLevel})`);
  if (opts.divineDruid && !opts.devout) breakdown.push("Divine Druid scroll stock");
  if (!opts.devout && opts.summoningLevel >= 90) {
    dps *= 1.05;
    breakdown.push("high Summoning +5%");
  }

  return {
    familiarId: fam.id,
    name: fam.name,
    familiarDps: dps,
    playerDamageMult: fam.playerDamageMult,
    playerAccuracyMult: fam.playerAccuracyMult,
    devoutMult,
    scrollUptime: uptime,
    scrollMult,
    breakdown,
    accessible: true,
    missing: [],
    locked: false,
  };
}

/** Best accessible combat familiar under player gates. */
export function pickBestFamiliar(
  player: PlayerSnapshot,
  opts: {
    devout: boolean;
    divineDruid: boolean;
    accessMode?: "soft" | "hard";
  },
): FamiliarDpsResult {
  const sumLvl = player.levels.summoning ?? 1;
  let best: FamiliarDpsResult | null = null;
  for (const fam of FAMILIAR_CATALOG) {
    if (!fam.combat && fam.id !== "none") continue;
    const r = modelFamiliarDps(fam, {
      summoningLevel: sumLvl,
      devout: opts.devout,
      divineDruid: opts.divineDruid,
      player,
      accessMode: opts.accessMode ?? "soft",
    });
    if (r.locked) continue;
    const score = r.familiarDps * r.playerDamageMult * (1 + (r.playerAccuracyMult - 1) * 0.4);
    const bestScore = best
      ? best.familiarDps * best.playerDamageMult * (1 + (best.playerAccuracyMult - 1) * 0.4)
      : -1;
    if (!best || score > bestScore) best = r;
  }
  return (
    best ??
    modelFamiliarDps("none", {
      summoningLevel: sumLvl,
      devout: opts.devout,
      divineDruid: opts.divineDruid,
    })
  );
}

/** List what's locked vs unlocked for a player snapshot. */
export function summoningAccessReport(player: PlayerSnapshot) {
  return FAMILIAR_CATALOG.map((f) => ({
    id: f.id,
    name: f.name,
    level: f.summoningLevel,
    soft: f.accessibleSoft(player),
    hard: f.accessible(player),
    missingSoft: f.missingSoft(player),
    missingHard: f.missing(player),
    req: f.describeReq(),
  }));
}
