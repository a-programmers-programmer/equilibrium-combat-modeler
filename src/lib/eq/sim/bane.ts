/**
 * Bane / affinity weapons & ammo — target-conditional DPS.
 *
 * Dragonbane was missing from earlier sims; this module models:
 *  - Tuned bane ammo (dragon/demon/abyssal/basilisk/wallasalki)
 *  - Jas dragonbane / demonbane arrows (T95)
 *  - Affinity "bane weapons": Hexhunter, Terrasaur, Inquisitor
 *  - Leng dark ice line (Glacor Front — not dragonbane, but specialized)
 *
 * Wiki refs:
 *  - Bane ammo: +40% ability dmg +30% hit chance vs susceptible (tuned T80)
 *  - Jas dragonbane: +30% dmg +20% hit chance vs dragons, T95 ammo
 *  - Hexhunter: +12.5% (+17.5% imbued) vs magic-class
 *  - Terrasaur: +12.5% vs ranged-class
 *  - Inquisitor: +12.5% (+17.5% imbued) vs melee-class
 */

import type { RegionId } from "../items";
import type { SkillId } from "../xp";
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
  unsatisfied,
} from "./requirements";

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

export interface BanePiece {
  id: string;
  name: string;
  kind: BaneKind;
  /** Combat role */
  role: "ammo" | "weapon" | "offhand";
  style: "melee" | "magic" | "ranged" | "all";
  tier: number;
  twoHanded?: boolean;
  /** Base ability damage contribution when equipped (weapons); ammo is multiplicative only */
  abilityDamage?: number;
  /**
   * Damage mult when target has any of these tags.
   * Applied to core ability DPS (and flat-ish) — model uses ability-focused 25%/30%/12.5% wiki values.
   */
  vsTags: Partial<Record<TargetTag, number>>;
  /** Hit chance bonus (informational / soft accuracy mult in model) */
  hitChanceBonus?: Partial<Record<TargetTag, number>>;
  regions: RegionId[];
  skillReqs: { skill: SkillId; level: number }[];
  quests: string[];
  flags: string[];
  notes: string;
  /** If true, only one of this kind's vs-tag can apply with others of same exclusive group */
  exclusiveGroup?: string;
}

/**
 * Ability-damage-focused mults (wiki ability numbers, not auto-attack 40%).
 * Hit chance is folded as a soft 0–8% effective DPS uplift when high.
 */
export const BANE_CATALOG: readonly BanePiece[] = [
  // ── Ammunition ────────────────────────────────────────────────────
  {
    id: "dragonbane-bolts",
    name: "Dragonbane bolts",
    kind: "ammo-dragonbane",
    role: "ammo",
    style: "ranged",
    tier: 80,
    vsTags: { dragon: 1.25 },
    hitChanceBonus: { dragon: 0.3 },
    regions: ["fremennik"], // bane ore / Kethsi line often Frem-adjacent; RoTM
    skillReqs: [
      { skill: "ranged", level: 80 },
      { skill: "smithing", level: 80 },
    ],
    quests: ["ritual-of-the-mahjarrat"],
    flags: ["unlocked:tune-bane"],
    notes: "Tuned bane bolts: +25% ability / +40% auto vs dragons. T80 ammo. Needs Tune Bane (RoTM).",
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
    notes: "Same dragonbane effect for bows (BOLG, SGB, hexhunter, etc.).",
    exclusiveGroup: "ranged-ammo",
  },
  {
    id: "demonbane-bolts",
    name: "Demonbane / Abyssalbane bolts",
    kind: "ammo-demonbane",
    role: "ammo",
    style: "ranged",
    tier: 80,
    vsTags: { demon: 1.25, abyssal: 1.25 },
    hitChanceBonus: { demon: 0.3, abyssal: 0.3 },
    regions: ["fremennik"],
    skillReqs: [
      { skill: "ranged", level: 80 },
      { skill: "smithing", level: 80 },
    ],
    quests: ["ritual-of-the-mahjarrat"],
    flags: ["unlocked:tune-bane"],
    notes: "Same tuned-bane framework vs demons/abyssals.",
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
    regions: [], // anima of Jas — EGWD / free-accessible elder content often Misthalin-linked
    skillReqs: [{ skill: "ranged", level: 95 }],
    quests: [],
    flags: ["unlocked:dinarrows", "unlocked:jas-anima"],
    notes: "T95 dinarrows + resonant anima of Jas. +30% dmg vs dragons. BiS dragon ranged ammo.",
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

  // ── Affinity bane weapons ─────────────────────────────────────────
  {
    id: "hexhunter-bow",
    name: "Hexhunter bow",
    kind: "weapon-hexhunter",
    role: "weapon",
    style: "ranged",
    tier: 80,
    twoHanded: true,
    abilityDamage: 1920, // T80 2H-ish model
    vsTags: { "mage-class": 1.125 }, // +12.5%; imbued 1.175
    regions: ["forinthry"], // soulgazers / wildy-adjacent; also some asgarnia — Forinthry primary
    skillReqs: [{ skill: "ranged", level: 80 }],
    quests: [],
    flags: ["killed:soulgazer"],
    notes: "+12.5% ability dmg vs magic-class (+17.5% imbued). Stacks with dragonbane ammo on dragons that are mage-class.",
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
    notes: "+12.5% ability vs ranged-class + affinity. Crafted from BGH T3 dinos (Anachronia).",
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
    notes: "+12.5% vs melee-class (+17.5% imbued). Desert / Archaeology components.",
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

  // ── Leng / Glacor Front (specialized, not dragonbane) ─────────────
  {
    id: "dark-ice-shard",
    name: "Dark ice shard",
    kind: "weapon-leng-dark-ice",
    role: "weapon",
    style: "melee",
    tier: 85,
    abilityDamage: 1600,
    vsTags: { glacor: 1.08 }, // mild model of chill passive value vs glacors
    regions: ["forinthry"],
    skillReqs: [
      { skill: "attack", level: 85 },
      { skill: "smithing", level: 85 },
    ],
    quests: [],
    flags: ["unlocked:glacor-front"],
    notes: "Glacor Front main-hand. Upgrade path to Dark Shard of Leng T95.",
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
    notes: "OH pair for dark ice / Leng line.",
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
    notes: "T95 Leng main-hand from Frozen Core upgrade.",
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

export const BANE_BY_ID = Object.fromEntries(BANE_CATALOG.map((b) => [b.id, b]));

export function baneRequirement(b: BanePiece): Requirement {
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

export function baneAccessible(b: BanePiece, p: PlayerSnapshot, soft = true): boolean {
  if (soft) {
    // region + skills hard; quests/flags soft if region unlocked
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

/** Multiply damage multipliers for matching tags (ammo × weapon stack). */
export function baneDamageMult(
  equipped: readonly BanePiece[],
  targetTags: readonly TargetTag[],
): { mult: number; applied: { name: string; tag: TargetTag; mult: number }[] } {
  const tags = new Set(targetTags);
  if (tags.has("general") && tags.size === 1) {
    return { mult: 1, applied: [] };
  }
  const applied: { name: string; tag: TargetTag; mult: number }[] = [];
  let mult = 1;
  const usedGroups = new Set<string>();

  for (const piece of equipped) {
    if (piece.exclusiveGroup && usedGroups.has(piece.exclusiveGroup)) continue;
    let best: { tag: TargetTag; m: number } | null = null;
    for (const [tag, m] of Object.entries(piece.vsTags) as [TargetTag, number][]) {
      if (!tags.has(tag)) continue;
      if (!best || m > best.m) best = { tag, m };
    }
    if (best) {
      mult *= best.m;
      applied.push({ name: piece.name, tag: best.tag, mult: best.m });
      if (piece.exclusiveGroup) usedGroups.add(piece.exclusiveGroup);
    }
  }
  return { mult, applied };
}

/** Soft accuracy → DPS factor from hit-chance bonuses (capped). */
export function baneAccuracyDpsFactor(
  equipped: readonly BanePiece[],
  targetTags: readonly TargetTag[],
): number {
  const tags = new Set(targetTags);
  let bonus = 0;
  for (const piece of equipped) {
    if (!piece.hitChanceBonus) continue;
    for (const [tag, b] of Object.entries(piece.hitChanceBonus) as [TargetTag, number][]) {
      if (tags.has(tag)) bonus = Math.max(bonus, b);
    }
  }
  // +30% hit chance is not +30% DPS; map to ~0–6% effective
  return 1 + Math.min(0.06, bonus * 0.2);
}

export interface TargetProfile {
  id: string;
  name: string;
  tags: TargetTag[];
  /** Optional base affinity note */
  note?: string;
}

export const TARGET_PROFILES: readonly TargetProfile[] = [
  { id: "general", name: "General (no bane)", tags: ["general"] },
  { id: "dragon", name: "Dragon (QBD, rune dragons, etc.)", tags: ["dragon"] },
  {
    id: "dragon-mage",
    name: "Dragon + magic-class (e.g. some dragon bosses)",
    tags: ["dragon", "mage-class"],
    note: "Hexhunter + dragonbane can stack",
  },
  { id: "demon", name: "Demon", tags: ["demon"] },
  { id: "abyssal", name: "Abyssal", tags: ["abyssal"] },
  { id: "mage-class", name: "Magic-class NPC", tags: ["mage-class"] },
  { id: "melee-class", name: "Melee-class NPC", tags: ["melee-class"] },
  { id: "ranged-class", name: "Ranged-class NPC", tags: ["ranged-class"] },
  { id: "glacor", name: "Glacor Front", tags: ["glacor"] },
];

/** Suggest best bane setup for style + target given unlocked regions. */
export function pickBaneLoadout(
  style: "melee" | "magic" | "ranged" | "necromancy",
  targetTags: readonly TargetTag[],
  player: PlayerSnapshot,
): BanePiece[] {
  const soft = true;
  const pool = BANE_CATALOG.filter((b) => baneAccessible(b, player, soft));
  const out: BanePiece[] = [];

  // Ammo for ranged
  if (style === "ranged") {
    const ammos = pool
      .filter((b) => b.role === "ammo")
      .map((b) => {
        const { mult } = baneDamageMult([b], targetTags);
        return { b, mult: mult * (b.tier >= 95 ? 1.05 : 1) };
      })
      .filter((x) => x.mult > 1)
      .sort((a, b) => b.mult - a.mult || b.b.tier - a.b.tier);
    if (ammos[0]) out.push(ammos[0].b);
  }

  // Affinity / specialized weapons
  if (style === "ranged") {
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
      const oh = pool.find((b) => b.kind === "weapon-leng-dark-ice" && b.role === "offhand" && b.tier === leng[0]!.tier);
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
