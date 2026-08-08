/**
 * Full acquisition ledger — top-grade expected-hours model.
 *
 * Every combat component is a node with:
 * - Skill gates → XP hours via phased league mults (5×→16×)
 * - Drop sources → E[hours] = E[kills] / kph (geometric / coupon collector)
 * - Craft / unlock pads
 * - Region / quest flags
 *
 * A loadout is a dependency set. Total wall-clock =
 *   skill hours (with parallel credit from bossing)
 * + exclusive content (drops, crafts, relic tasks)
 *
 * Not a Monte-Carlo of every kill; uses closed-form EV (p50 ≈ mean for geo).
 * p90 bands via geometric quantile for key uniques.
 */

import type { SkillId } from "../xp";
import { chartSkillLeaguePhased } from "./league-hours";
import type { Style } from "../gear";
import type { ArmourProfileId } from "./armour";
import type { PoisonKitId } from "./poison";
import type { FamiliarId } from "./summoning";
import type { InventionTier } from "./invention";
import type { RegionTag } from "./requirements";

// ── Math ────────────────────────────────────────────────────────────

/** Expected kills for 1 success at rate 1/N (geometric mean) */
export function expectedKills(rateDenom: number): number {
  return rateDenom; // E[X] = 1/p = N
}

/** p-quantile of geometric (0-index success trials), p in (0,1) */
export function geometricQuantile(rateDenom: number, p: number): number {
  // CDF: 1 - (1-p)^k >= q → k >= log(1-q)/log(1-p)
  const pr = 1 / rateDenom;
  if (pr >= 1) return 1;
  return Math.ceil(Math.log(1 - p) / Math.log(1 - pr));
}

/**
 * Coupon collector for n distinct items, each kill independently rolls
 * each item at rate 1/N (approx when wiki lists each unique at 1/N).
 * E[T] = N * H_n  if mutually exclusive single-drop table of n items at 1/(N) each
 *       = N * H_n if one unique slot shared equally among n (rate 1/N total unique).
 *
 * Rasial: each unique listed ~1/640 independently-ish on rare table.
 * Model A (shared unique slot 1/640, uniform among n): E = 640 * H_n
 * Model B (independent 1/640 each): harder. Use shared-slot (standard RS rare table).
 */
export function couponCollectorKills(
  uniqueRateDenom: number,
  distinctItems: number,
): number {
  let H = 0;
  for (let i = 1; i <= distinctItems; i++) H += 1 / i;
  return uniqueRateDenom * H;
}

export function hoursFromKills(kills: number, killsPerHour: number): number {
  return kills / Math.max(0.1, killsPerHour);
}

// ── Drop sources (wiki-backed where noted) ──────────────────────────

export interface DropSource {
  id: string;
  name: string;
  /** 1/N rarity for this unique (or unique table) */
  rateDenom: number;
  killsPerHour: number;
  /** Region gate */
  regions: RegionTag[];
  notes: string;
  /** League drop mult guess (Equilibrium often 2×–5× rares — conservative 2× when flagged) */
  leagueDropMult?: number;
}

export const DROP_SOURCES: Record<string, DropSource> = {
  rasial: {
    id: "rasial",
    name: "Rasial, the First Necromancer",
    rateDenom: 640, // wiki Omni / armour pieces ~1/640
    killsPerHour: 22, // above-avg league player (wiki MMG ~28 peak; 22 realistic mid-learn)
    regions: ["free", "misthalin"],
    notes: "Wiki: Omni 1/640, TFN pieces ~1/640, luck T4 → ~1/632. Shared unique table model.",
    leagueDropMult: 2, // Equilibrium notable-drop 2× common in leagues — apply as rate/2
  },
  croesus: {
    id: "croesus",
    name: "Croesus",
    // High contribution ~1/450–1/675 for unique; use 600 mid-good
    rateDenom: 600,
    killsPerHour: 8, // skilling boss, contribution runs
    regions: ["free", "misthalin"],
    notes: "Wiki unique 1/5400 (60 contrib) to 1/450 (420+). Model assumes solid contrib ~1/600.",
    leagueDropMult: 2,
  },
  lostGroveOnTask: {
    id: "lost-grove-task",
    name: "Lost Grove Slayer (on-task)",
    rateDenom: 1500, // wiki Cinderbane on-task
    killsPerHour: 180,
    regions: ["tirannwn"],
    notes: "Wiki: Cinderbane 1/1500 on-task, 1/5000 off-task. Prefer on-task.",
    leagueDropMult: 2,
  },
  solak: {
    id: "solak",
    name: "Solak",
    rateDenom: 1000,
    killsPerHour: 6,
    regions: ["tirannwn"],
    notes: "Wiki Cinderbane 1/1000 from Solak",
    leagueDropMult: 2,
  },
  // Familiars / contracts — modeled as grind pads with sources
  ripperContract: {
    id: "ripper-contract",
    name: "Ripper demon binding contract",
    rateDenom: 1,
    killsPerHour: 1,
    regions: ["forinthry"],
    notes: "Contract grind — use fixed hours below",
  },
};

function effectiveRate(src: DropSource): number {
  const m = src.leagueDropMult ?? 1;
  return src.rateDenom / m;
}

// ── Component nodes ─────────────────────────────────────────────────

export type ComponentKind =
  | "skill"
  | "drop"
  | "set-drop"
  | "craft"
  | "unlock"
  | "relic"
  | "blessing"
  | "familiar"
  | "consumable";

export interface AcqComponent {
  id: string;
  name: string;
  kind: ComponentKind;
  /** Hard regions required (any of if multiple free-ish) */
  requiresRegions?: RegionTag[];
  requiresAllRegions?: RegionTag[];
  /** Skill levels needed before this is usable/craftable */
  skillReqs?: Partial<Record<SkillId, number>>;
  /** Drop modeling */
  drop?: {
    sourceId: keyof typeof DROP_SOURCES;
    /** Single unique */
    pieces?: number; // default 1; set → coupon collector
    /** Override rate denom */
    rateDenom?: number;
    /** Override kph */
    kph?: number;
  };
  /** Fixed hours (craft/quest/task) when not pure drop */
  fixedHours?: number;
  /** Skills trained while doing this content (parallel credit tags) */
  trainsCombat?: boolean;
  notes?: string;
  /** Only required for certain build tags */
  tags?: string[];
}

/**
 * Master component catalog — every meaningful DPS unlock.
 */
export const COMPONENTS: AcqComponent[] = [
  // ── Skills (explicit level targets as components) ──
  {
    id: "skill-necro-90",
    name: "Necromancy 90",
    kind: "skill",
    skillReqs: { necromancy: 90 },
    notes: "Kili T90 / mid power",
  },
  {
    id: "skill-necro-95",
    name: "Necromancy 95",
    kind: "skill",
    skillReqs: { necromancy: 95 },
    notes: "Omni / TFN / Rasial entry",
  },
  {
    id: "skill-necro-99",
    name: "Necromancy 99",
    kind: "skill",
    skillReqs: { necromancy: 99 },
  },
  {
    id: "skill-combat-bundle-90",
    name: "Combat stats 90 (style primary)",
    kind: "skill",
    skillReqs: { attack: 90, strength: 90, defence: 90, constitution: 90 },
  },
  {
    id: "skill-magic-90",
    name: "Magic 90",
    kind: "skill",
    skillReqs: { magic: 90 },
  },
  {
    id: "skill-magic-99",
    name: "Magic 99",
    kind: "skill",
    skillReqs: { magic: 99 },
  },
  {
    id: "skill-ranged-90",
    name: "Ranged 90",
    kind: "skill",
    skillReqs: { ranged: 90 },
  },
  {
    id: "skill-prayer-95",
    name: "Prayer 95 (curses)",
    kind: "skill",
    skillReqs: { prayer: 95 },
  },
  {
    id: "skill-herb-96",
    name: "Herblore 96 (overloads)",
    kind: "skill",
    skillReqs: { herblore: 96 },
  },
  {
    id: "skill-herb-106",
    name: "Herblore 106 (elder OVL)",
    kind: "skill",
    skillReqs: { herblore: 106 },
  },
  {
    id: "skill-sum-99",
    name: "Summoning 99",
    kind: "skill",
    skillReqs: { summoning: 99 },
  },
  {
    id: "skill-slayer-99",
    name: "Slayer 99",
    kind: "skill",
    skillReqs: { slayer: 99 },
  },
  {
    id: "skill-inv-gates",
    name: "Invention gates (80 Craft/Smith/Div)",
    kind: "skill",
    skillReqs: { crafting: 80, smithing: 80, divination: 80 },
    requiresAllRegions: ["asgarnia"],
  },
  {
    id: "skill-inv-90",
    name: "Invention 90",
    kind: "skill",
    skillReqs: { invention: 90 },
    requiresAllRegions: ["asgarnia"],
  },
  {
    id: "skill-inv-99",
    name: "Invention 99",
    kind: "skill",
    skillReqs: { invention: 99 },
    requiresAllRegions: ["asgarnia"],
  },
  {
    id: "skill-arch-95",
    name: "Archaeology 95 (Ancient Inv path)",
    kind: "skill",
    skillReqs: { archaeology: 95 },
    requiresAllRegions: ["kandarin"],
  },

  // ── Relics / blessings ──
  {
    id: "relics-t7",
    name: "Relic ladder T1→T7 (league points/tasks)",
    kind: "relic",
    // Community: T7 often 8–15h focused with mults; use 10h mean for above-avg
    fixedHours: 10,
    notes: "Not pure XP — task/point gated. Calibrated ~10h above-avg route.",
  },
  {
    id: "blessings-aegis-path",
    name: "Blessing path to Aegis+Cinders+Perfidious God picks",
    kind: "blessing",
    fixedHours: 4,
    notes: "Blessing unlocks track with combat/skilling; 4h exclusive estimate",
  },

  // ── Necro gear ladder ──
  {
    id: "kili-t70",
    name: "Kili tasks → Death Guard/Warden T70",
    kind: "craft",
    skillReqs: { necromancy: 70 },
    fixedHours: 2.5,
    trainsCombat: true,
    notes: "Materials + Kili — free City of Um",
    tags: ["necro", "mid"],
  },
  {
    id: "kili-t90",
    name: "Kili tasks → Death Guard/Warden/Skull T90",
    kind: "craft",
    skillReqs: { necromancy: 90 },
    fixedHours: 5,
    trainsCombat: true,
    notes: "Full Kili T90 ladder free region",
    tags: ["necro", "mid", "end"],
  },
  {
    id: "rasial-omni-soul",
    name: "Omni guard + Soulbound lantern",
    kind: "set-drop",
    skillReqs: { necromancy: 95 },
    drop: { sourceId: "rasial", pieces: 2, rateDenom: 640 },
    trainsCombat: true,
    notes: "2 weapons @ ~1/640 shared unique table → 640*H_2 kills",
    tags: ["necro", "end"],
  },
  {
    id: "rasial-tfn-set",
    name: "First Necromancer robe set (5 pieces)",
    kind: "set-drop",
    skillReqs: { necromancy: 95 },
    drop: { sourceId: "rasial", pieces: 5, rateDenom: 640 },
    trainsCombat: true,
    notes: "5 armour uniques coupon collector on Rasial table",
    tags: ["necro", "power", "end"],
  },
  {
    id: "deathwarden-t90-set",
    name: "Deathwarden T90 full tank set",
    kind: "craft",
    skillReqs: { necromancy: 90, defence: 90 },
    fixedHours: 3,
    notes: "Crafted via Kili tank path — not Rasial",
    tags: ["necro", "tank", "aegis"],
  },

  // ── Magic ──
  {
    id: "cryptbloom-set",
    name: "Cryptbloom full set (5 pieces incomplete→restore)",
    kind: "set-drop",
    skillReqs: { magic: 90, defence: 90 },
    drop: { sourceId: "croesus", pieces: 5, rateDenom: 600 },
    trainsCombat: false, // skilling boss
    fixedHours: 2, // restore flakes
    notes: "Croesus Misthalin. Coupon 600*H_5 + restore. MAGIC only.",
    tags: ["magic", "tank", "aegis"],
  },
  {
    id: "fsoa",
    name: "Fractured Staff of Armadyl",
    kind: "drop",
    skillReqs: { magic: 95 },
    // Kerapac T4 — free-ish path? Kerapac is Orthen/Anachronia often
    fixedHours: 25,
    notes: "EV placeholder — Kerapac path long; leagues 2× helps",
    tags: ["magic", "end"],
  },

  // ── Melee ──
  {
    id: "melee-mid-weapons",
    name: "Mid melee weapons (drygores/chaotics tier)",
    kind: "drop",
    skillReqs: { attack: 90, strength: 90 },
    fixedHours: 8,
    trainsCombat: true,
    tags: ["melee", "mid"],
  },
  {
    id: "masterwork-set",
    name: "Masterwork armour set craft",
    kind: "craft",
    skillReqs: { smithing: 99, defence: 90 },
    fixedHours: 12,
    notes: "Smithing + materials — heavy",
    tags: ["melee", "tank"],
  },

  // ── Poison ──
  {
    id: "weapon-poison-plus-plus-plus",
    name: "Weapon poison+++ supply line",
    kind: "consumable",
    skillReqs: { herblore: 82 },
    fixedHours: 0.5,
    tags: ["poison"],
  },
  {
    id: "cinderbane-gloves",
    name: "Cinderbane gloves",
    kind: "drop",
    drop: { sourceId: "lostGroveOnTask", pieces: 1, rateDenom: 1500 },
    requiresAllRegions: ["tirannwn"],
    skillReqs: { slayer: 90 },
    trainsCombat: true,
    notes: "E[kills]=1500/leagueMult; on-task Lost Grove. Solak alt 1/1000 slower kph.",
    tags: ["poison", "end"],
  },

  // ── Familiars ──
  {
    id: "fam-steel-titan",
    name: "Steel titan pouch + scrolls",
    kind: "familiar",
    skillReqs: { summoning: 99 },
    fixedHours: 1,
    notes: "Charm stack + pouches after 99 Sum",
    tags: ["fam"],
  },
  {
    id: "fam-ice-nihil",
    name: "Ice nihil pouch",
    kind: "familiar",
    skillReqs: { summoning: 87 },
    requiresAllRegions: ["forinthry"],
    fixedHours: 3,
    notes: "Nihil pouches — Forinthry/wilderness content",
    tags: ["fam", "end"],
  },
  {
    id: "fam-ripper",
    name: "Ripper demon binding contract",
    kind: "familiar",
    skillReqs: { summoning: 96 },
    requiresAllRegions: ["forinthry"],
    fixedHours: 6,
    notes: "Contract grind Forinthry",
    tags: ["fam", "end"],
  },

  // ── Invention ──
  {
    id: "invention-unlock",
    name: "Invention tutorial + first gizmos",
    kind: "unlock",
    requiresAllRegions: ["asgarnia"],
    skillReqs: { crafting: 80, smithing: 80, divination: 80 },
    fixedHours: 2,
    tags: ["invention"],
  },
  {
    id: "invention-perks-bis",
    name: "BiS-ish gizmo perk rolls (AS/Precise/Eq/Biting)",
    kind: "craft",
    requiresAllRegions: ["asgarnia"],
    skillReqs: { invention: 90 },
    fixedHours: 8,
    notes: "Perkfection cuts this; without: longer RNG",
    tags: ["invention", "end"],
  },
  {
    id: "ancient-invention",
    name: "Ancient Invention unlock (Stormguard)",
    kind: "unlock",
    requiresAllRegions: ["asgarnia", "kandarin"],
    skillReqs: { invention: 85, archaeology: 95 },
    fixedHours: 4,
    tags: ["invention", "ancient"],
  },

  // ── Regions ──
  {
    id: "unlock-forinthry",
    name: "Unlock Forinthry elective + early access",
    kind: "unlock",
    requiresAllRegions: ["forinthry"],
    fixedHours: 3,
  },
  {
    id: "unlock-asgarnia",
    name: "Unlock Asgarnia elective",
    kind: "unlock",
    requiresAllRegions: ["asgarnia"],
    fixedHours: 2.5,
  },
  {
    id: "unlock-kandarin",
    name: "Unlock Kandarin elective",
    kind: "unlock",
    requiresAllRegions: ["kandarin"],
    fixedHours: 3,
  },
  {
    id: "unlock-tirannwn",
    name: "Unlock Tirannwn + Prif access",
    kind: "unlock",
    requiresAllRegions: ["tirannwn"],
    fixedHours: 5,
  },
  {
    id: "unlock-desert",
    name: "Unlock Desert elective",
    kind: "unlock",
    requiresAllRegions: ["desert"],
    fixedHours: 3,
  },
  {
    id: "unlock-anachronia",
    name: "Unlock Anachronia + base camp",
    kind: "unlock",
    requiresAllRegions: ["anachronia"],
    fixedHours: 4,
  },

  // ── Consumables end ──
  {
    id: "elder-overload-line",
    name: "Elder overload production ready",
    kind: "consumable",
    skillReqs: { herblore: 106 },
    fixedHours: 1,
    tags: ["end"],
  },
];

export const COMPONENT_BY_ID = Object.fromEntries(
  COMPONENTS.map((c) => [c.id, c]),
) as Record<string, AcqComponent>;

// ── Cost of one component ───────────────────────────────────────────

export interface ComponentCost {
  id: string;
  name: string;
  kind: ComponentKind;
  /** Exclusive hours (drops, fixed, craft) — not pure skill XP */
  exclusiveHours: number;
  /** Skill XP hours attributed here (before parallel merge) */
  skillHoursDetail: { skill: SkillId; hours: number }[];
  skillHoursSum: number;
  /** Drop detail */
  dropDetail?: {
    source: string;
    expectedKills: number;
    p50Kills: number;
    p90Kills: number;
    kph: number;
    hoursP50: number;
    hoursP90: number;
    rateEffective: number;
  };
  trainsCombat: boolean;
  notes: string[];
  blocked?: string[];
}

function regionsOk(
  c: AcqComponent,
  have: Set<RegionTag>,
): string[] {
  const miss: string[] = [];
  if (c.requiresAllRegions) {
    for (const r of c.requiresAllRegions) {
      if (!have.has(r) && r !== "free") miss.push(`region:${r}`);
    }
  }
  if (c.requiresRegions?.length) {
    const ok = c.requiresRegions.some((r) => have.has(r) || r === "free");
    if (!ok) miss.push(`anyRegion:${c.requiresRegions.join("|")}`);
  }
  return miss;
}

export function costComponent(
  c: AcqComponent,
  electives: readonly string[],
  haveRegions: Set<RegionTag>,
  opts?: { perkfection?: boolean },
): ComponentCost {
  const notes: string[] = c.notes ? [c.notes] : [];
  const blocked = regionsOk(c, haveRegions);
  const skillHoursDetail: { skill: SkillId; hours: number }[] = [];

  if (c.skillReqs) {
    for (const [sk, lvl] of Object.entries(c.skillReqs) as [SkillId, number][]) {
      if (!lvl || lvl <= 1) continue;
      const { hours } = chartSkillLeaguePhased(sk, 1, lvl, electives);
      skillHoursDetail.push({ skill: sk, hours });
    }
  }

  let exclusiveHours = c.fixedHours ?? 0;
  let dropDetail: ComponentCost["dropDetail"];

  if (c.drop) {
    const src = DROP_SOURCES[c.drop.sourceId];
    if (!src) {
      notes.push(`Missing drop source ${c.drop.sourceId}`);
    } else {
      const rate = c.drop.rateDenom
        ? c.drop.rateDenom / (src.leagueDropMult ?? 1)
        : effectiveRate(src);
      const pieces = c.drop.pieces ?? 1;
      const expK =
        pieces > 1
          ? couponCollectorKills(rate, pieces)
          : expectedKills(rate);
      const p50 = pieces > 1 ? expK : geometricQuantile(rate, 0.5);
      const p90 =
        pieces > 1
          ? expK * 1.5 // approx band for collector
          : geometricQuantile(rate, 0.9);
      const kph = c.drop.kph ?? src.killsPerHour;
      dropDetail = {
        source: src.name,
        expectedKills: expK,
        p50Kills: p50,
        p90Kills: p90,
        kph,
        hoursP50: hoursFromKills(p50, kph),
        hoursP90: hoursFromKills(p90, kph),
        rateEffective: rate,
      };
      // Use mean EV for exclusive
      exclusiveHours += hoursFromKills(expK, kph);
      notes.push(
        `Drop EV: ${expK.toFixed(0)} kills @ ${kph}/h = ${hoursFromKills(expK, kph).toFixed(1)}h (p90 ${dropDetail.hoursP90.toFixed(1)}h)`,
      );
    }
  }

  if (c.id === "invention-perks-bis" && opts?.perkfection) {
    exclusiveHours *= 0.45; // Perkfection +20% helpful + free charges → much less reroll
    notes.push("Perkfection: perk grind ×0.45");
  }

  const skillHoursSum = skillHoursDetail.reduce((a, s) => a + s.hours, 0);

  return {
    id: c.id,
    name: c.name,
    kind: c.kind,
    exclusiveHours,
    skillHoursDetail,
    skillHoursSum,
    dropDetail,
    trainsCombat: !!c.trainsCombat,
    notes,
    blocked: blocked.length ? blocked : undefined,
  };
}

// ── Loadout → component recipe ──────────────────────────────────────

export interface BuildSpec {
  id: string;
  name: string;
  style: Style;
  armour: ArmourProfileId;
  poison: PoisonKitId;
  familiar: FamiliarId;
  invention: InventionTier;
  regions: RegionTag[];
  electives: string[];
  /** mid = T90 kili, end = rasial/tfn */
  gearTier: "mid" | "end";
  perkfection?: boolean;
  /** Aegis combat path blessings */
  aegisPath?: boolean;
  relicsT7?: boolean;
}

export function recipeForBuild(spec: BuildSpec): string[] {
  const ids: string[] = ["relics-t7", "blessings-aegis-path"];
  if (spec.aegisPath === false) {
    // still need some blessings
  }

  const regs = new Set(spec.regions);
  for (const r of ["forinthry", "asgarnia", "kandarin", "tirannwn", "desert", "anachronia"] as RegionTag[]) {
    if (regs.has(r)) ids.push(`unlock-${r}`);
  }

  // Style skills + gear
  if (spec.style === "necromancy") {
    ids.push(spec.gearTier === "end" ? "skill-necro-95" : "skill-necro-90");
    if (spec.gearTier === "end") ids.push("skill-necro-99");
    ids.push("skill-prayer-95");
    ids.push(spec.gearTier === "mid" ? "kili-t70" : "kili-t90");
    if (spec.gearTier === "end") {
      ids.push("rasial-omni-soul");
      if (spec.armour === "tfn-power" || spec.armour === "power-bis") {
        ids.push("rasial-tfn-set");
      } else {
        ids.push("deathwarden-t90-set");
      }
    } else {
      ids.push("deathwarden-t90-set");
    }
  } else if (spec.style === "magic") {
    ids.push(spec.gearTier === "end" ? "skill-magic-99" : "skill-magic-90");
    ids.push("skill-prayer-95");
    if (spec.armour === "cryptbloom-tank") ids.push("cryptbloom-set");
    if (spec.gearTier === "end") ids.push("fsoa");
  } else if (spec.style === "melee") {
    ids.push("skill-combat-bundle-90");
    ids.push("skill-prayer-95");
    ids.push("melee-mid-weapons");
    if (spec.armour === "masterwork-tank") ids.push("masterwork-set");
  } else if (spec.style === "ranged") {
    ids.push("skill-ranged-90");
    ids.push("skill-prayer-95");
  }

  // Herb
  if (spec.gearTier === "end") ids.push("skill-herb-106", "elder-overload-line");
  else ids.push("skill-herb-96");

  // Poison
  if (spec.poison !== "none") ids.push("weapon-poison-plus-plus-plus");
  if (
    spec.poison === "wp-cinder" ||
    spec.poison === "full-melee-poison" ||
    spec.poison === "full-ranged-blowpipe" ||
    spec.poison === "cinder-only"
  ) {
    ids.push("skill-slayer-99", "cinderbane-gloves");
  }

  // Fam
  if (spec.familiar === "steel-titan") {
    ids.push("skill-sum-99", "fam-steel-titan");
  } else if (spec.familiar === "ice-nihil") {
    ids.push("skill-sum-99", "fam-ice-nihil");
  } else if (spec.familiar === "ripper-demon") {
    ids.push("skill-sum-99", "fam-ripper");
  }

  // Invention
  if (spec.invention === "standard" || spec.invention === "ancient") {
    ids.push("skill-inv-gates", "skill-inv-90", "invention-unlock", "invention-perks-bis");
  }
  if (spec.invention === "ancient") {
    ids.push("skill-arch-95", "skill-inv-99", "ancient-invention");
  }

  // de-dupe preserve order
  return [...new Set(ids)];
}

// ── Full acquisition plan ───────────────────────────────────────────

export interface AcquisitionPlan {
  spec: BuildSpec;
  components: ComponentCost[];
  blocked: { id: string; reasons: string[] }[];
  /** Max skill hours per skill (deduped) */
  skillUnionHours: number;
  skillBySkill: { skill: SkillId; hours: number }[];
  exclusiveHours: number;
  /** Combat-training exclusive (bosses) that overlap skills */
  combatExclusiveHours: number;
  /** Wall-clock after parallel skill credit */
  wallClockP50: number;
  wallClockP90: number;
  wallClockMean: number;
  parallelCredit: number;
  breakdown: string[];
  ledger: {
    id: string;
    name: string;
    exclusiveH: number;
    drop?: string;
  }[];
}

/**
 * Merge skill requirements: take max level per skill, chart once.
 */
function unionSkillHours(
  components: ComponentCost[],
  electives: readonly string[],
  recipeIds: string[],
): { skill: SkillId; hours: number; level: number }[] {
  const maxLvl: Partial<Record<SkillId, number>> = {};
  for (const id of recipeIds) {
    const c = COMPONENT_BY_ID[id];
    if (!c?.skillReqs) continue;
    for (const [sk, lvl] of Object.entries(c.skillReqs) as [SkillId, number][]) {
      maxLvl[sk] = Math.max(maxLvl[sk] ?? 1, lvl);
    }
  }
  const out: { skill: SkillId; hours: number; level: number }[] = [];
  for (const [sk, lvl] of Object.entries(maxLvl) as [SkillId, number][]) {
    const { hours } = chartSkillLeaguePhased(sk, 1, lvl, electives);
    out.push({ skill: sk, hours, level: lvl });
  }
  return out;
}

/**
 * Combat skills overlap: attack/str/def/con/necro/magic/ranged/slayer
 * → wall skill time = 1.2 × max(combat skills) + sum(non-combat)
 */
function compressSkills(
  rows: { skill: SkillId; hours: number }[],
): { combatBundle: number; support: number; total: number } {
  const combat = new Set<SkillId>([
    "attack",
    "strength",
    "defence",
    "constitution",
    "necromancy",
    "magic",
    "ranged",
    "slayer",
  ]);
  let maxC = 0;
  let support = 0;
  for (const r of rows) {
    if (combat.has(r.skill)) maxC = Math.max(maxC, r.hours);
    else support += r.hours;
  }
  const combatBundle = maxC * 1.2;
  return { combatBundle, support, total: combatBundle + support };
}

export function planAcquisition(spec: BuildSpec): AcquisitionPlan {
  const have = new Set<RegionTag>(spec.regions);
  // always have starters
  for (const r of ["free", "misthalin", "havenhythe", "karamja"] as RegionTag[]) {
    have.add(r);
  }

  const recipe = recipeForBuild(spec);
  const components: ComponentCost[] = [];
  const blocked: { id: string; reasons: string[] }[] = [];

  for (const id of recipe) {
    const c = COMPONENT_BY_ID[id];
    if (!c) continue;
    const cost = costComponent(c, spec.electives, have, {
      perkfection: spec.perkfection,
    });
    // Don't double-count skills on component — skills handled in union
    cost.skillHoursSum = 0;
    cost.skillHoursDetail = [];
    components.push(cost);
    if (cost.blocked?.length) blocked.push({ id, reasons: cost.blocked });
  }

  const skillRows = unionSkillHours(components, spec.electives, recipe);
  const skillComp = compressSkills(skillRows);
  const skillUnionHours = skillComp.total;

  let exclusiveHours = 0;
  let combatExclusiveHours = 0;
  let p90Extra = 0;

  for (const c of components) {
    exclusiveHours += c.exclusiveHours;
    if (c.trainsCombat) combatExclusiveHours += c.exclusiveHours;
    if (c.dropDetail) {
      p90Extra += Math.max(0, c.dropDetail.hoursP90 - c.dropDetail.hoursP50);
    }
  }

  // Parallel: while bossing (combat exclusive), you train combat XP.
  // Credit min(combatExclusive, combatBundle) * 0.85 efficiency
  const parallelCredit = Math.min(
    combatExclusiveHours,
    skillComp.combatBundle,
  ) * 0.85;

  const wallClockMean = Math.max(0, skillUnionHours - parallelCredit) + exclusiveHours;
  // p50 ≈ mean for large EV; p90 adds drop tail
  const wallClockP50 = wallClockMean * 0.92;
  const wallClockP90 = wallClockMean + p90Extra * 0.7;

  const breakdown = [
    `Skills union (league 5×→16×, combat bundled): ${skillUnionHours.toFixed(1)}h`,
    `  combat bundle: ${skillComp.combatBundle.toFixed(1)}h · support: ${skillComp.support.toFixed(1)}h`,
    `Exclusive content (drops/crafts/relics): ${exclusiveHours.toFixed(1)}h`,
    `  of which combat-training: ${combatExclusiveHours.toFixed(1)}h`,
    `Parallel skill credit from bossing: −${parallelCredit.toFixed(1)}h`,
    `WALL mean: ${wallClockMean.toFixed(1)}h · p50≈${wallClockP50.toFixed(1)}h · p90≈${wallClockP90.toFixed(1)}h`,
  ];

  return {
    spec,
    components,
    blocked,
    skillUnionHours,
    skillBySkill: skillRows.map((s) => ({ skill: s.skill, hours: s.hours })),
    exclusiveHours,
    combatExclusiveHours,
    wallClockP50,
    wallClockP90,
    wallClockMean,
    parallelCredit,
    breakdown,
    ledger: components.map((c) => ({
      id: c.id,
      name: c.name,
      exclusiveH: +c.exclusiveHours.toFixed(2),
      drop: c.dropDetail
        ? `${c.dropDetail.expectedKills.toFixed(0)}k @${c.dropDetail.kph}/h`
        : undefined,
    })),
  };
}
