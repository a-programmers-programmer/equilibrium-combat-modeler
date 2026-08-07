/**
 * Bane / affinity definitions + target profiles.
 * Equipment instances are built in equipment.ts — this is the data + pure math.
 */

import type { RegionId } from "../items";
import type { SkillId } from "../xp";

/** What the target is weak to / classified as. */
export type TargetTag =
  | "general"
  | "dragon"
  | "demon"
  | "abyssal"
  | "basilisk"
  | "wallasalki"
  | "mage-class"
  | "melee-class"
  | "ranged-class"
  | "glacor";

export type BaneKind =
  | "ammo-dragonbane"
  | "ammo-demonbane"
  | "ammo-abyssalbane"
  | "ammo-jas-dragonbane"
  | "ammo-jas-demonbane"
  | "weapon-hexhunter"
  | "weapon-terrasaur"
  | "weapon-inquisitor"
  | "weapon-leng-dark-ice";

/** Plain def — promoted to Equipment in equipment.ts */
export interface BaneDef {
  id: string;
  name: string;
  kind: BaneKind;
  role: "ammo" | "weapon" | "offhand";
  style: "melee" | "magic" | "ranged" | "all";
  tier: number;
  twoHanded?: boolean;
  abilityDamage?: number;
  armour?: number;
  vsTags: Partial<Record<TargetTag, number>>;
  hitChanceBonus?: Partial<Record<TargetTag, number>>;
  regions: RegionId[];
  skillReqs: { skill: SkillId; level: number }[];
  quests: string[];
  flags: string[];
  notes: string;
  exclusiveGroup?: string;
}

/**
 * Ability-damage-focused mults (wiki ability numbers).
 * Classic tuned bane: +25% ability vs susceptible.
 * Jas: +30% ability. Affinity weapons: +12.5% / +17.5% imbued.
 */
export const BANE_DEFS: readonly BaneDef[] = [
  {
    id: "dragonbane-bolts",
    name: "Dragonbane bolts",
    kind: "ammo-dragonbane",
    role: "ammo",
    style: "ranged",
    tier: 80,
    vsTags: { dragon: 1.25 },
    hitChanceBonus: { dragon: 0.3 },
    regions: ["fremennik"],
    skillReqs: [
      { skill: "ranged", level: 80 },
      { skill: "smithing", level: 80 },
    ],
    quests: ["ritual-of-the-mahjarrat"],
    flags: ["unlocked:tune-bane"],
    notes: "Tuned bane bolts +25% ability / +40% auto vs dragons. Needs Fremennik + Tune Bane (RoTM).",
    exclusiveGroup: "ranged-ammo",
  },
  {
    id: "dragonbane-arrows",
    name: "Dragonbane arrows",
    kind: "ammo-dragonbane",
    role: "ammo",
    style: "ranged",
    tier: 80,
    vsTags: { dragon: 1.25 },
    hitChanceBonus: { dragon: 0.3 },
    regions: ["fremennik"],
    skillReqs: [
      { skill: "ranged", level: 80 },
      { skill: "smithing", level: 80 },
    ],
    quests: ["ritual-of-the-mahjarrat"],
    flags: ["unlocked:tune-bane"],
    notes: "Dragonbane for bows (BOLG, SGB, hexhunter, etc.).",
    exclusiveGroup: "ranged-ammo",
  },
  {
    id: "demonbane-bolts",
    name: "Demonbane bolts",
    kind: "ammo-demonbane",
    role: "ammo",
    style: "ranged",
    tier: 80,
    vsTags: { demon: 1.25 },
    hitChanceBonus: { demon: 0.3 },
    regions: ["fremennik"],
    skillReqs: [
      { skill: "ranged", level: 80 },
      { skill: "smithing", level: 80 },
    ],
    quests: ["ritual-of-the-mahjarrat"],
    flags: ["unlocked:tune-bane"],
    notes: "Tuned demonbane bolts.",
    exclusiveGroup: "ranged-ammo",
  },
  {
    id: "abyssalbane-bolts",
    name: "Abyssalbane bolts",
    kind: "ammo-abyssalbane",
    role: "ammo",
    style: "ranged",
    tier: 80,
    vsTags: { abyssal: 1.25 },
    hitChanceBonus: { abyssal: 0.3 },
    regions: ["fremennik"],
    skillReqs: [
      { skill: "ranged", level: 80 },
      { skill: "smithing", level: 80 },
    ],
    quests: ["ritual-of-the-mahjarrat"],
    flags: ["unlocked:tune-bane"],
    notes: "Tuned abyssalbane bolts.",
    exclusiveGroup: "ranged-ammo",
  },
  {
    id: "basiliskbane-bolts",
    name: "Basiliskbane bolts",
    kind: "ammo-dragonbane",
    role: "ammo",
    style: "ranged",
    tier: 80,
    vsTags: { basilisk: 1.25 },
    hitChanceBonus: { basilisk: 0.3 },
    regions: ["fremennik"],
    skillReqs: [
      { skill: "ranged", level: 80 },
      { skill: "smithing", level: 80 },
    ],
    quests: ["ritual-of-the-mahjarrat"],
    flags: ["unlocked:tune-bane"],
    notes: "Tuned basiliskbane.",
    exclusiveGroup: "ranged-ammo",
  },
  {
    id: "wallasalkibane-bolts",
    name: "Wallasalkibane bolts",
    kind: "ammo-dragonbane",
    role: "ammo",
    style: "ranged",
    tier: 80,
    vsTags: { wallasalki: 1.25 },
    hitChanceBonus: { wallasalki: 0.3 },
    regions: ["fremennik"],
    skillReqs: [
      { skill: "ranged", level: 80 },
      { skill: "smithing", level: 80 },
    ],
    quests: ["ritual-of-the-mahjarrat"],
    flags: ["unlocked:tune-bane"],
    notes: "Tuned wallasalkibane.",
    exclusiveGroup: "ranged-ammo",
  },
  {
    id: "jas-dragonbane-arrows",
    name: "Jas dragonbane arrows",
    kind: "ammo-jas-dragonbane",
    role: "ammo",
    style: "ranged",
    tier: 95,
    vsTags: { dragon: 1.3 },
    hitChanceBonus: { dragon: 0.2 },
    regions: [],
    skillReqs: [{ skill: "ranged", level: 95 }],
    quests: [],
    flags: ["unlocked:dinarrows", "unlocked:jas-anima"],
    notes: "T95 dinarrows + resonant anima of Jas. BiS dragon ranged ammo. Free-path anima.",
    exclusiveGroup: "ranged-ammo",
  },
  {
    id: "jas-demonbane-arrows",
    name: "Jas demonbane arrows",
    kind: "ammo-jas-demonbane",
    role: "ammo",
    style: "ranged",
    tier: 95,
    vsTags: { demon: 1.3 },
    hitChanceBonus: { demon: 0.2 },
    regions: [],
    skillReqs: [{ skill: "ranged", level: 95 }],
    quests: [],
    flags: ["unlocked:dinarrows", "unlocked:jas-anima", "unlocked:tune-bane"],
    notes: "Tune Jas dragonbane → demonbane. +30% vs demons.",
    exclusiveGroup: "ranged-ammo",
  },
  {
    id: "hexhunter-bow",
    name: "Hexhunter bow",
    kind: "weapon-hexhunter",
    role: "weapon",
    style: "ranged",
    tier: 80,
    twoHanded: true,
    abilityDamage: 1920,
    vsTags: { "mage-class": 1.125 },
    regions: ["forinthry"],
    skillReqs: [{ skill: "ranged", level: 80 }],
    quests: [],
    flags: ["killed:soulgazer"],
    notes: "+12.5% ability vs magic-class. Stacks with dragonbane ammo on dragon-mage targets.",
  },
  {
    id: "hexhunter-bow-imbued",
    name: "Hexhunter bow (imbued)",
    kind: "weapon-hexhunter",
    role: "weapon",
    style: "ranged",
    tier: 80,
    twoHanded: true,
    abilityDamage: 1920,
    vsTags: { "mage-class": 1.175 },
    regions: ["forinthry"],
    skillReqs: [{ skill: "ranged", level: 80 }],
    quests: [],
    flags: ["killed:soulgazer", "unlocked:hexhunter-imbue"],
    notes: "Imbued +17.5% vs magic-class.",
  },
  {
    id: "terrasaur-maul",
    name: "Terrasaur maul",
    kind: "weapon-terrasaur",
    role: "weapon",
    style: "melee",
    tier: 80,
    twoHanded: true,
    abilityDamage: 2100,
    vsTags: { "ranged-class": 1.125 },
    regions: ["anachronia"],
    skillReqs: [
      { skill: "strength", level: 80 },
      { skill: "crafting", level: 93 },
      { skill: "smithing", level: 93 },
      { skill: "hunter", level: 96 },
    ],
    quests: [],
    flags: ["unlocked:bgh-t3"],
    notes: "+12.5% ability vs ranged-class. Crafted BGH T3 Anachronia.",
  },
  {
    id: "inquisitor-staff",
    name: "Inquisitor staff",
    kind: "weapon-inquisitor",
    role: "weapon",
    style: "magic",
    tier: 80,
    twoHanded: true,
    abilityDamage: 1920,
    vsTags: { "melee-class": 1.125 },
    regions: ["desert"],
    skillReqs: [
      { skill: "magic", level: 80 },
      { skill: "runecrafting", level: 93 },
    ],
    quests: [],
    flags: ["unlocked:inquisitor-assemble"],
    notes: "+12.5% vs melee-class. Desert / Archaeology.",
  },
  {
    id: "inquisitor-staff-imbued",
    name: "Inquisitor staff (imbued)",
    kind: "weapon-inquisitor",
    role: "weapon",
    style: "magic",
    tier: 80,
    twoHanded: true,
    abilityDamage: 1920,
    vsTags: { "melee-class": 1.175 },
    regions: ["desert"],
    skillReqs: [
      { skill: "magic", level: 80 },
      { skill: "runecrafting", level: 93 },
    ],
    quests: [],
    flags: ["unlocked:inquisitor-assemble", "unlocked:inq-imbue"],
    notes: "Imbued +17.5% vs melee-class.",
  },
  {
    id: "dark-ice-shard",
    name: "Dark ice shard",
    kind: "weapon-leng-dark-ice",
    role: "weapon",
    style: "melee",
    tier: 85,
    abilityDamage: 1600,
    vsTags: { glacor: 1.08 },
    regions: ["forinthry"],
    skillReqs: [
      { skill: "attack", level: 85 },
      { skill: "smithing", level: 85 },
    ],
    quests: [],
    flags: ["unlocked:glacor-front"],
    notes: "Glacor Front MH. Upgrade path to Dark Shard of Leng.",
  },
  {
    id: "dark-ice-sliver",
    name: "Dark ice sliver",
    kind: "weapon-leng-dark-ice",
    role: "offhand",
    style: "melee",
    tier: 85,
    abilityDamage: 800,
    vsTags: { glacor: 1.08 },
    regions: ["forinthry"],
    skillReqs: [
      { skill: "attack", level: 85 },
      { skill: "smithing", level: 85 },
    ],
    quests: [],
    flags: ["unlocked:glacor-front"],
    notes: "OH pair for dark ice / Leng.",
  },
  {
    id: "dark-shard-of-leng",
    name: "Dark Shard of Leng",
    kind: "weapon-leng-dark-ice",
    role: "weapon",
    style: "melee",
    tier: 95,
    abilityDamage: 2450,
    vsTags: { glacor: 1.1 },
    regions: ["forinthry"],
    skillReqs: [{ skill: "attack", level: 95 }],
    quests: [],
    flags: ["unlocked:glacor-front", "unlocked:leng-core"],
    notes: "T95 Leng main-hand.",
  },
  {
    id: "dark-sliver-of-leng",
    name: "Dark Sliver of Leng",
    kind: "weapon-leng-dark-ice",
    role: "offhand",
    style: "melee",
    tier: 95,
    abilityDamage: 1225,
    vsTags: { glacor: 1.1 },
    regions: ["forinthry"],
    skillReqs: [{ skill: "attack", level: 95 }],
    quests: [],
    flags: ["unlocked:glacor-front", "unlocked:leng-core"],
    notes: "T95 Leng off-hand.",
  },
];

export const BANE_BY_ID: Readonly<Record<string, BaneDef>> = Object.fromEntries(
  BANE_DEFS.map((b) => [b.id, b]),
);

/** @deprecated use BANE_DEFS — kept for script compat */
export const BANE_CATALOG = BANE_DEFS;
export type BanePiece = BaneDef;

export interface TargetProfile {
  id: string;
  name: string;
  tags: TargetTag[];
  note?: string;
}

export const TARGET_PROFILES: readonly TargetProfile[] = [
  { id: "general", name: "General (no bane)", tags: ["general"] },
  { id: "dragon", name: "Dragon (QBD, rune dragons, etc.)", tags: ["dragon"] },
  {
    id: "dragon-mage",
    name: "Dragon + magic-class",
    tags: ["dragon", "mage-class"],
    note: "Hexhunter + dragonbane can stack",
  },
  { id: "demon", name: "Demon", tags: ["demon"] },
  { id: "abyssal", name: "Abyssal", tags: ["abyssal"] },
  { id: "basilisk", name: "Basilisk", tags: ["basilisk"] },
  { id: "wallasalki", name: "Wallasalki", tags: ["wallasalki"] },
  { id: "mage-class", name: "Magic-class NPC", tags: ["mage-class"] },
  { id: "melee-class", name: "Melee-class NPC", tags: ["melee-class"] },
  { id: "ranged-class", name: "Ranged-class NPC", tags: ["ranged-class"] },
  { id: "glacor", name: "Glacor Front", tags: ["glacor"] },
];

export interface BaneApplication {
  name: string;
  id: string;
  tag: TargetTag;
  mult: number;
}

/** Multiply matching tag mults; one piece per exclusiveGroup. */
export function stackBaneMults(
  pieces: readonly { id: string; name: string; vsTags: Partial<Record<TargetTag, number>>; exclusiveGroup?: string }[],
  targetTags: readonly TargetTag[],
): { mult: number; applied: BaneApplication[] } {
  const tags = new Set(targetTags);
  if (tags.has("general") && tags.size === 1) return { mult: 1, applied: [] };

  const applied: BaneApplication[] = [];
  let mult = 1;
  const usedGroups = new Set<string>();

  for (const piece of pieces) {
    if (piece.exclusiveGroup && usedGroups.has(piece.exclusiveGroup)) continue;
    let best: { tag: TargetTag; m: number } | null = null;
    for (const [tag, m] of Object.entries(piece.vsTags) as [TargetTag, number][]) {
      if (!tags.has(tag)) continue;
      if (!best || m > best.m) best = { tag, m };
    }
    if (best) {
      mult *= best.m;
      applied.push({ name: piece.name, id: piece.id, tag: best.tag, mult: best.m });
      if (piece.exclusiveGroup) usedGroups.add(piece.exclusiveGroup);
    }
  }
  return { mult, applied };
}

export function stackBaneAccuracy(
  pieces: readonly { hitChanceBonus?: Partial<Record<TargetTag, number>> }[],
  targetTags: readonly TargetTag[],
): number {
  const tags = new Set(targetTags);
  let bonus = 0;
  for (const piece of pieces) {
    if (!piece.hitChanceBonus) continue;
    for (const [tag, b] of Object.entries(piece.hitChanceBonus) as [TargetTag, number][]) {
      if (tags.has(tag)) bonus = Math.max(bonus, b);
    }
  }
  return 1 + Math.min(0.06, bonus * 0.2);
}

/** Compat wrappers used by older scripts */
export function baneDamageMult(
  equipped: readonly BaneDef[],
  targetTags: readonly TargetTag[],
) {
  return stackBaneMults(equipped, targetTags);
}

export function baneAccuracyDpsFactor(
  equipped: readonly BaneDef[],
  targetTags: readonly TargetTag[],
) {
  return stackBaneAccuracy(equipped, targetTags);
}

// ── Requirement helpers (used when not going through Equipment) ─────
import {
  AllReq,
  AnyReq,
  RegionReq,
  SkillReq,
  FlagReq,
  QuestReq,
  type Requirement,
  type RegionTag,
  type PlayerSnapshot,
} from "./requirements";

export function baneRequirement(b: BaneDef): Requirement {
  const parts: Requirement[] = [];
  for (const r of b.regions) parts.push(new RegionReq(r as RegionTag));
  if (b.regions.length === 0) {
    parts.push(
      new AnyReq([
        new RegionReq("free"),
        new RegionReq("misthalin"),
        new RegionReq("havenhythe"),
        new RegionReq("karamja"),
      ]),
    );
  }
  for (const s of b.skillReqs) parts.push(new SkillReq(s.skill, s.level));
  for (const q of b.quests) parts.push(new QuestReq(q, q));
  for (const f of b.flags) parts.push(new FlagReq(f, f));
  return parts.length === 1 ? parts[0]! : new AllReq(parts);
}

export function baneAccessible(b: BaneDef, p: PlayerSnapshot, soft = true): boolean {
  if (soft) {
    for (const r of b.regions) {
      if (!new RegionReq(r as RegionTag).satisfied(p)) return false;
    }
    if (b.regions.length === 0) {
      const free =
        p.regions.has("free") ||
        p.regions.has("misthalin") ||
        p.regions.has("havenhythe") ||
        p.regions.has("karamja");
      if (!free) return false;
    }
    for (const s of b.skillReqs) {
      if ((p.levels[s.skill] ?? 1) < s.level) return false;
    }
    return true;
  }
  return baneRequirement(b).satisfied(p);
}

/** Prefer Equipment-based pickBaneFromCatalog in equipment.ts for full OOP. */
export function pickBaneLoadout(
  style: "melee" | "magic" | "ranged" | "necromancy",
  targetTags: readonly TargetTag[],
  player: PlayerSnapshot,
): BaneDef[] {
  const pool = BANE_DEFS.filter((b) => baneAccessible(b, player, true));
  const out: BaneDef[] = [];

  if (style === "ranged") {
    const ammos = pool
      .filter((b) => b.role === "ammo")
      .map((b) => {
        const { mult } = stackBaneMults([b], targetTags);
        return { b, mult: mult * (b.tier >= 95 ? 1.05 : 1) };
      })
      .filter((x) => x.mult > 1)
      .sort((a, b) => b.mult - a.mult || b.b.tier - a.b.tier);
    if (ammos[0]) out.push(ammos[0].b);

    const hex = pool
      .filter((b) => b.kind === "weapon-hexhunter")
      .sort((a, b) => (b.vsTags["mage-class"] ?? 1) - (a.vsTags["mage-class"] ?? 1));
    if (targetTags.includes("mage-class") && hex[0]) out.push(hex[0]);
  }
  if (style === "melee") {
    const terra = pool.filter((b) => b.kind === "weapon-terrasaur");
    if (targetTags.includes("ranged-class") && terra[0]) out.push(terra[0]);
    const leng = pool
      .filter((b) => b.kind === "weapon-leng-dark-ice" && b.role === "weapon")
      .sort((a, b) => b.tier - a.tier);
    if (targetTags.includes("glacor") && leng[0]) {
      out.push(leng[0]);
      const oh = pool.find(
        (b) => b.kind === "weapon-leng-dark-ice" && b.role === "offhand" && b.tier === leng[0]!.tier,
      );
      if (oh) out.push(oh);
    }
  }
  if (style === "magic") {
    const inq = pool
      .filter((b) => b.kind === "weapon-inquisitor")
      .sort((a, b) => (b.vsTags["melee-class"] ?? 1) - (a.vsTags["melee-class"] ?? 1));
    if (targetTags.includes("melee-class") && inq[0]) out.push(inq[0]);
  }
  return out;
}
