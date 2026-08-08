/**
 * Declarative acquisition component catalog.
 * Use helpers — avoid hand-rolling every object shape.
 */

import type { SkillId } from "../../xp";
import type { RegionTag } from "../requirements";
import {
  blessingTrackHours,
  relicLadderHours,
  RELIC_TIER_UNLOCKS,
  BLESSING_AEGIS_TRACK,
} from "../league-passives";
import type { DropSourceId } from "./drops";
import type { AcqComponent, ComponentKind } from "./types";

// ── Builders (DRY) ──────────────────────────────────────────────────

type SkillMap = Partial<Record<SkillId, number>>;

function c(
  partial: Omit<AcqComponent, "kind"> & { kind: ComponentKind },
): AcqComponent {
  return partial;
}

/** Level skill gate */
export function skill(
  id: string,
  name: string,
  skillReqs: SkillMap,
  extra: Partial<AcqComponent> = {},
): AcqComponent {
  return c({ id, name, kind: "skill", skillReqs, ...extra });
}

/** Region unlock pad */
export function regionUnlock(
  region: RegionTag,
  hours: number,
  name?: string,
): AcqComponent {
  return c({
    id: `unlock-${region}`,
    name: name ?? `Unlock ${region[0]!.toUpperCase()}${region.slice(1)}`,
    kind: "unlock",
    requiresAllRegions: [region],
    fixedHours: hours,
  });
}

/** Fixed-hour craft / unlock / consumable */
export function pad(
  id: string,
  name: string,
  kind: ComponentKind,
  fixedHours: number,
  extra: Partial<AcqComponent> = {},
): AcqComponent {
  return c({ id, name, kind, fixedHours, ...extra });
}

/** Boss / slayer drop (optionally multi-piece set) */
export function drop(
  id: string,
  name: string,
  sourceId: DropSourceId,
  opts: {
    pieces?: number;
    rateDenom?: number;
    skillReqs?: SkillMap;
    regions?: RegionTag[];
    fixedHours?: number;
    trainsCombat?: boolean;
    notes?: string;
    kind?: "drop" | "set-drop";
  } = {},
): AcqComponent {
  return c({
    id,
    name,
    kind: opts.kind ?? (opts.pieces && opts.pieces > 1 ? "set-drop" : "drop"),
    skillReqs: opts.skillReqs,
    requiresAllRegions: opts.regions,
    drop: {
      sourceId,
      pieces: opts.pieces,
      rateDenom: opts.rateDenom,
    },
    fixedHours: opts.fixedHours,
    trainsCombat: opts.trainsCombat ?? true,
    notes: opts.notes,
  });
}

// ── Catalog (declarative) ───────────────────────────────────────────

const SKILLS: AcqComponent[] = [
  skill("skill-necro-90", "Necromancy 90", { necromancy: 90 }),
  skill("skill-necro-95", "Necromancy 95", { necromancy: 95 }),
  skill("skill-necro-99", "Necromancy 99", { necromancy: 99 }),
  skill("skill-combat-bundle-90", "Melee combat 90 bundle", {
    attack: 90,
    strength: 90,
    defence: 90,
    constitution: 90,
  }),
  skill("skill-combat-bundle-99", "Melee combat 99 bundle", {
    attack: 99,
    strength: 99,
    defence: 99,
    constitution: 99,
  }),
  skill("skill-magic-90", "Magic 90", { magic: 90, defence: 90 }),
  skill("skill-magic-99", "Magic 99", { magic: 99, defence: 90 }),
  skill("skill-ranged-90", "Ranged 90", { ranged: 90, defence: 90 }),
  skill("skill-ranged-99", "Ranged 99", { ranged: 99 }),
  skill("skill-prayer-95", "Prayer 95", { prayer: 95 }),
  skill("skill-herb-96", "Herblore 96", { herblore: 96 }),
  skill("skill-herb-106", "Herblore 106", { herblore: 106 }),
  skill("skill-sum-99", "Summoning 99", { summoning: 99 }),
  skill("skill-slayer-99", "Slayer 99", { slayer: 99 }),
  skill("skill-smith-99", "Smithing 99", { smithing: 99 }),
  skill(
    "skill-inv-gates",
    "Invention 80 gates",
    { crafting: 80, smithing: 80, divination: 80 },
    { requiresAllRegions: ["asgarnia"] },
  ),
  skill("skill-inv-90", "Invention 90", { invention: 90 }, {
    requiresAllRegions: ["asgarnia"],
  }),
  skill("skill-inv-99", "Invention 99", { invention: 99 }, {
    requiresAllRegions: ["asgarnia"],
  }),
  skill("skill-arch-95", "Archaeology 95", { archaeology: 95 }, {
    requiresAllRegions: ["kandarin"],
  }),
];

const META: AcqComponent[] = [
  c({
    id: "relics-t7",
    name: "Relic ladder T1→T7",
    kind: "relic",
    fixedHoursFn: () => relicLadderHours(7),
    notes: RELIC_TIER_UNLOCKS.map((r) => `T${r.tier}:${r.exclusiveHours}h`).join(
      " · ",
    ),
  }),
  c({
    id: "relics-t5",
    name: "Relic ladder T1→T5",
    kind: "relic",
    fixedHoursFn: () => relicLadderHours(5),
  }),
  c({
    id: "blessings-aegis-path",
    name: "Blessing track Aegis+Cinders+Perf",
    kind: "blessing",
    fixedHoursFn: () => blessingTrackHours(),
    notes: BLESSING_AEGIS_TRACK.map((b) => b.id).join(" → "),
  }),
];

const NECRO: AcqComponent[] = [
  pad("kili-t70", "Kili → T70 necro weapons/armour", "craft", 2.5, {
    skillReqs: { necromancy: 70 },
    trainsCombat: true,
    notes: "City of Um free; materials under mults",
  }),
  pad("kili-t90", "Kili → T90 Death Guard/Warden/Skull", "craft", 5.5, {
    skillReqs: { necromancy: 90 },
    trainsCombat: true,
  }),
  drop("rasial-omni-soul", "Omni guard + Soulbound lantern", "rasial", {
    pieces: 2,
    rateDenom: 640,
    skillReqs: { necromancy: 95 },
    notes: "2 weapons coupon on Rasial unique table",
  }),
  drop("rasial-tfn-set", "TFN robe set (5)", "rasial", {
    pieces: 5,
    rateDenom: 640,
    skillReqs: { necromancy: 95 },
  }),
  pad("deathwarden-t90-set", "Deathwarden T90 tank set", "craft", 3.5, {
    skillReqs: { necromancy: 90, defence: 90 },
    notes: "Kili tank path — correct Aegis necro armour",
  }),
];

const MAGIC: AcqComponent[] = [
  drop("cryptbloom-set", "Cryptbloom 5pc + restore", "croesus", {
    pieces: 5,
    rateDenom: 600,
    skillReqs: { magic: 90, defence: 90 },
    fixedHours: 2.5,
    trainsCombat: false,
    notes: "MAGIC only. Croesus Misthalin.",
  }),
  drop("fsoa", "Fractured Staff of Armadyl (3 pieces)", "kerapac", {
    pieces: 3,
    rateDenom: 133,
    skillReqs: { magic: 95 },
    regions: ["anachronia"],
  }),
];

const MELEE: AcqComponent[] = [
  drop("drygore-dual", "Dual drygores (KK)", "kalphiteKing", {
    pieces: 2,
    rateDenom: 84,
    skillReqs: { attack: 90, strength: 90 },
    regions: ["desert"],
  }),
  pad("melee-mid-weapons", "Mid melee (chaotics / early dry path)", "craft", 4, {
    skillReqs: { attack: 80, strength: 80 },
    trainsCombat: true,
  }),
  pad("masterwork-set", "Masterwork armour craft", "craft", 14, {
    skillReqs: { smithing: 99, defence: 90 },
  }),
];

const RANGED: AcqComponent[] = [
  pad("ranged-mid-weapons", "Mid ranged weapons", "drop", 12, {
    skillReqs: { ranged: 90 },
    trainsCombat: true,
  }),
];

const POISON: AcqComponent[] = [
  pad("weapon-poison-plus-plus-plus", "Weapon poison+++ line", "consumable", 0.5, {
    skillReqs: { herblore: 82 },
  }),
  drop("cinderbane-gloves", "Cinderbane gloves (Lost Grove on-task)", "lostGroveOnTask", {
    pieces: 1,
    rateDenom: 1500,
    skillReqs: { slayer: 90 },
    regions: ["tirannwn"],
  }),
  drop("cinderbane-solak", "Cinderbane via Solak (alt)", "solak", {
    pieces: 1,
    rateDenom: 1000,
    regions: ["tirannwn"],
  }),
];

const FAMILIARS: AcqComponent[] = [
  pad("fam-steel-titan", "Steel titan pouches", "familiar", 1.2, {
    skillReqs: { summoning: 99 },
  }),
  pad("fam-ice-nihil", "Ice nihil pouches", "familiar", 3.5, {
    skillReqs: { summoning: 87 },
    requiresAllRegions: ["forinthry"],
  }),
  pad("fam-ripper", "Ripper binding contract", "familiar", 7, {
    skillReqs: { summoning: 96 },
    requiresAllRegions: ["forinthry"],
  }),
];

const INVENTION: AcqComponent[] = [
  pad("invention-unlock", "Invention tutorial + first gizmos", "unlock", 2.5, {
    requiresAllRegions: ["asgarnia"],
    skillReqs: { crafting: 80, smithing: 80, divination: 80 },
  }),
  pad("invention-perks-bis", "Weapon/armour perk rolls BiS-ish", "craft", 10, {
    requiresAllRegions: ["asgarnia"],
    skillReqs: { invention: 90 },
    perkfectionMult: 0.45,
    notes: "Perkfection multiplies exclusive hours",
  }),
  pad("ancient-invention", "Ancient Invention (Stormguard)", "unlock", 5, {
    requiresAllRegions: ["asgarnia", "kandarin"],
    skillReqs: { invention: 85, archaeology: 95 },
  }),
];

const JEWELLERY: AcqComponent[] = [
  pad("jewellery-reaper-stack", "Reaper crew + essence / mid jewellery", "jewellery", 3, {
    trainsCombat: true,
  }),
  pad("jewellery-eof-souls", "EOF / Amulet of Souls / RoD tier", "jewellery", 8, {
    requiresAllRegions: ["asgarnia"],
    tags: ["asgarnia", "end"],
  }),
];

const REGIONS: AcqComponent[] = [
  regionUnlock("forinthry", 3),
  regionUnlock("asgarnia", 2.5),
  regionUnlock("kandarin", 3),
  regionUnlock("tirannwn", 5.5, "Unlock Tirannwn/Prif"),
  regionUnlock("desert", 3),
  regionUnlock("anachronia", 4.5),
];

const CONSUMABLES: AcqComponent[] = [
  pad("elder-overload-line", "Elder overload ready", "consumable", 1.2, {
    skillReqs: { herblore: 106 },
  }),
];

export const COMPONENTS: AcqComponent[] = [
  ...SKILLS,
  ...META,
  ...NECRO,
  ...MAGIC,
  ...MELEE,
  ...RANGED,
  ...POISON,
  ...FAMILIARS,
  ...INVENTION,
  ...JEWELLERY,
  ...REGIONS,
  ...CONSUMABLES,
];

export const COMPONENT_BY_ID: Record<string, AcqComponent> = Object.fromEntries(
  COMPONENTS.map((x) => [x.id, x]),
);
