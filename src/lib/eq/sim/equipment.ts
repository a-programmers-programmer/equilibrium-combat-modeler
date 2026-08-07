/**
 * OOP equipment model — every piece has a Requirement graph.
 * Combines wiki-generated catalog + hand-curated combat BiS from items.ts.
 */

import {
  type CombatItem,
  type ItemSlot,
  type CombatStyle,
  type RegionId,
  type ArmourKind,
  ITEMS,
  type OffhandMode,
  type ResolvedLoadout,
} from "../items";
import type { SkillId } from "../xp";
import {
  Requirement,
  AllReq,
  AnyReq,
  RegionReq,
  SkillReq,
  QuestReq,
  FlagReq,
  type PlayerSnapshot,
  type RegionTag,
  unsatisfied,
} from "./requirements";
import {
  GENERATED_GEAR,
  type GeneratedGearDef,
  type GenSlot,
} from "./equipment.generated";

export type EquipSlot = ItemSlot | "material" | "codex" | "unknown";

export class Equipment {
  readonly id: string;
  readonly name: string;
  readonly slot: EquipSlot;
  readonly style: CombatStyle | "all";
  readonly tier: number;
  readonly kind: ArmourKind;
  readonly twoHanded: boolean;
  readonly abilityDamage: number;
  readonly armour: number;
  readonly lp: number;
  readonly prayer: number;
  readonly source: string;
  readonly notes: string;
  readonly req: Requirement;
  readonly wikiGenerated: boolean;
  readonly regions: RegionId[];
  readonly skillReqs: { skill: string; level: number }[];
  readonly quests: string[];
  readonly flags: string[];

  constructor(opts: {
    id: string;
    name: string;
    slot: EquipSlot;
    style: CombatStyle | "all";
    tier: number;
    kind: ArmourKind;
    twoHanded?: boolean;
    abilityDamage?: number;
    armour?: number;
    lp?: number;
    prayer?: number;
    source?: string;
    notes?: string;
    regions: RegionId[];
    skillReqs?: { skill: string; level: number }[];
    quests?: string[];
    flags?: string[];
    wikiGenerated?: boolean;
    extraReq?: Requirement;
  }) {
    this.id = opts.id;
    this.name = opts.name;
    this.slot = opts.slot;
    this.style = opts.style;
    this.tier = opts.tier;
    this.kind = opts.kind;
    this.twoHanded = !!opts.twoHanded;
    this.abilityDamage = opts.abilityDamage ?? 0;
    this.armour = opts.armour ?? 0;
    this.lp = opts.lp ?? 0;
    this.prayer = opts.prayer ?? 0;
    this.source = opts.source ?? "";
    this.notes = opts.notes ?? "";
    this.wikiGenerated = !!opts.wikiGenerated;
    this.regions = opts.regions;
    this.skillReqs = opts.skillReqs ?? [];
    this.quests = opts.quests ?? [];
    this.flags = opts.flags ?? [];

    const parts: Requirement[] = [];
    // All listed regions required (AND) — multi-region crafts
    for (const r of opts.regions) {
      parts.push(new RegionReq(r as RegionTag));
    }
    // Free-path items with empty regions: need free starter access
    if (opts.regions.length === 0) {
      parts.push(
        new AnyReq([
          new RegionReq("misthalin"),
          new RegionReq("free"),
          new RegionReq("havenhythe"),
          new RegionReq("karamja"),
        ]),
      );
    }
    for (const s of this.skillReqs) {
      parts.push(new SkillReq(s.skill as SkillId, s.level));
    }
    for (const q of this.quests) {
      parts.push(new QuestReq(q, q));
    }
    for (const f of this.flags) {
      // Boss kill flags are soft by default for loadout planning —
      // use requireFlags=true on accessible check for hard mode
      parts.push(new FlagReq(f, f));
    }
    if (opts.extraReq) parts.push(opts.extraReq);

    this.req =
      parts.length === 0
        ? new AnyReq([new RegionReq("free")])
        : parts.length === 1
          ? parts[0]!
          : new AllReq(parts);
  }

  /** Hard check including boss/quest flags. */
  accessible(p: PlayerSnapshot, opts?: { ignoreBossFlags?: boolean }): boolean {
    if (opts?.ignoreBossFlags) {
      return this.accessibleIgnoringBossFlags(p);
    }
    return this.req.satisfied(p);
  }

  /**
   * Region + skill gates only (assume boss drops obtainable once region open).
   * Used for BiS loadout planning mid-league.
   */
  accessibleIgnoringBossFlags(p: PlayerSnapshot): boolean {
    for (const r of this.regions) {
      if (!new RegionReq(r as RegionTag).satisfied(p)) return false;
    }
    if (this.regions.length === 0) {
      const freeOk =
        p.regions.has("free") ||
        p.regions.has("misthalin") ||
        p.regions.has("havenhythe") ||
        p.regions.has("karamja");
      if (!freeOk) return false;
    }
    for (const s of this.skillReqs) {
      if ((p.levels[s.skill as SkillId] ?? 1) < s.level) return false;
    }
    for (const q of this.quests) {
      // league often auto-completes quests on region unlock — soft unless explicit
      if (q && !p.quests.has(q) && !p.regions.has(this.regions[0] as RegionTag)) {
        // if we have the region, treat quest as auto
        if (this.regions.length && this.regions.every((r) => p.regions.has(r as RegionTag))) {
          continue;
        }
      }
    }
    return true;
  }

  missing(p: PlayerSnapshot): string[] {
    return unsatisfied(this.req, p);
  }

  describeReq(): string {
    return this.req.describe();
  }

  toCombatItem(): CombatItem {
    return {
      id: this.id,
      name: this.name,
      slot: (["material", "codex", "unknown"].includes(this.slot)
        ? "pocket"
        : this.slot) as ItemSlot,
      style: this.style as CombatStyle,
      tier: this.tier,
      kind: this.kind,
      requires: this.regions,
      abilityDamage: this.abilityDamage || undefined,
      armour: this.armour || undefined,
      lp: this.lp || undefined,
      prayer: this.prayer || undefined,
      twoHanded: this.twoHanded || undefined,
      notes: `${this.notes}${this.source ? ` · ${this.source}` : ""}`,
    };
  }
}

function fromGenerated(g: GeneratedGearDef): Equipment {
  let skillReqs = [...g.skillReqs];
  // Ensure weapons always have a style skill gate (wiki inference sometimes misses)
  if (
    (g.slot === "weapon" || (g.slot === "offhand" && (g.abilityDamage ?? 0) > 0)) &&
    skillReqs.length === 0 &&
    (g.abilityDamage ?? 0) > 0
  ) {
    const lvl = Math.min(Math.max(g.tier, 1), 90);
    if (g.style === "melee") skillReqs.push({ skill: "attack", level: lvl });
    else if (g.style === "magic") skillReqs.push({ skill: "magic", level: lvl });
    else if (g.style === "ranged") skillReqs.push({ skill: "ranged", level: lvl });
    else if (g.style === "necromancy") skillReqs.push({ skill: "necromancy", level: lvl });
    else skillReqs.push({ skill: "attack", level: Math.min(lvl, 60) });
  }
  return new Equipment({
    id: g.id,
    name: g.name,
    slot: g.slot as EquipSlot,
    style: g.style,
    tier: g.tier,
    kind: g.kind,
    twoHanded: g.twoHanded,
    abilityDamage: g.abilityDamage,
    armour: g.armour,
    source: g.source,
    notes: g.notes,
    regions: g.regions as RegionId[],
    skillReqs,
    quests: g.quests,
    flags: g.flags,
    wikiGenerated: true,
  });
}

function fromHandItem(item: CombatItem): Equipment {
  // Infer skill reqs from tier/style for hand catalog
  const skillReqs: { skill: string; level: number }[] = [];
  const t = Math.min(item.tier, 99);
  if (item.slot === "weapon" || (item.slot === "offhand" && item.kind === "none")) {
    if (item.style === "melee") skillReqs.push({ skill: "attack", level: Math.min(t, 90) });
    if (item.style === "magic") skillReqs.push({ skill: "magic", level: Math.min(t, 95) });
    if (item.style === "ranged") skillReqs.push({ skill: "ranged", level: Math.min(t, 95) });
    if (item.style === "necromancy") skillReqs.push({ skill: "necromancy", level: Math.min(t, 95) });
  } else if (["body", "helmet", "legs", "boots", "gloves"].includes(item.slot)) {
    skillReqs.push({ skill: "defence", level: Math.min(Math.max(t - 10, 1), 90) });
  }
  if (/masterwork/i.test(item.name)) skillReqs.push({ skill: "smithing", level: 90 });

  const flags: string[] = [];
  if (/omni|soulbound/i.test(item.name)) flags.push("killed:rasial");
  if (/seismic/i.test(item.name)) flags.push("killed:vorago");
  if (/fsoa|fractured staff/i.test(item.name)) flags.push("killed:kerapac");
  if (/ezk|ek-zekkil/i.test(item.name)) flags.push("killed:zamorak");
  if (/bolg|last guardian/i.test(item.name)) flags.push("killed:vorkath-path");
  if (/igneous/i.test(item.name)) flags.push("killed:zuk");
  if (/malevolent kite/i.test(item.name)) flags.push("killed:rots");
  if (/essence of finality|eof/i.test(item.name)) flags.push("killed:vorago");
  if (/drygore/i.test(item.name)) flags.push("killed:rax");
  if (/achto/i.test(item.name)) flags.push("killed:raids");

  return new Equipment({
    id: item.id,
    name: item.name,
    slot: item.slot,
    style: item.style,
    tier: item.tier,
    kind: item.kind,
    twoHanded: item.twoHanded,
    abilityDamage: item.abilityDamage,
    armour: item.armour,
    lp: item.lp,
    prayer: item.prayer,
    notes: item.notes,
    regions: item.requires,
    skillReqs,
    flags,
    wikiGenerated: false,
  });
}

/** Merged catalog: hand BiS overrides wiki on same id; wiki fills the rest. */
function buildCatalog(): Equipment[] {
  const byId = new Map<string, Equipment>();
  // wiki first
  for (const g of GENERATED_GEAR) {
    // skip pure unknown low-value noise with tier 0 materials kept
    byId.set(g.id, fromGenerated(g));
  }
  // hand curated wins (combat model stats are trusted)
  for (const item of ITEMS) {
    byId.set(item.id, fromHandItem(item));
  }
  return [...byId.values()];
}

export const EQUIPMENT_CATALOG: readonly Equipment[] = buildCatalog();

export const EQUIPMENT_BY_ID: Readonly<Map<string, Equipment>> = new Map(
  EQUIPMENT_CATALOG.map((e) => [e.id, e]),
);

export function equipmentAccessible(
  p: PlayerSnapshot,
  opts?: { combatOnly?: boolean; ignoreBossFlags?: boolean },
): Equipment[] {
  return EQUIPMENT_CATALOG.filter((e) => {
    if (opts?.combatOnly && (e.slot === "material" || e.slot === "codex" || e.slot === "unknown")) {
      return false;
    }
    return opts?.ignoreBossFlags ? e.accessibleIgnoringBossFlags(p) : e.accessible(p);
  });
}

function styleMatch(e: Equipment, style: CombatStyle): boolean {
  return e.style === "all" || e.style === style;
}

function is2h(e: Equipment): boolean {
  return e.twoHanded;
}

/**
 * Requirement-aware BiS resolve — only pieces the player can equip.
 */
export function resolveLoadoutOOP(
  player: PlayerSnapshot,
  style: Exclude<CombatStyle, "all">,
  mode: OffhandMode,
  opts?: { ignoreBossFlags?: boolean },
): ResolvedLoadout & { equipment: Equipment[]; blockedCandidates: { name: string; missing: string[] }[] } {
  const pool = equipmentAccessible(player, {
    combatOnly: true,
    ignoreBossFlags: opts?.ignoreBossFlags ?? true,
  }).filter((e) => {
    if (!styleMatch(e, style)) return false;
    // drop non-equippable / junk inference
    if (e.slot === "unknown" || e.slot === "material" || e.slot === "codex") return false;
    if (e.tier <= 0 && e.abilityDamage <= 0 && e.armour <= 0) return false;
    return true;
  });

  const notes: string[] = [];
  const pieces: Equipment[] = [];
  const missing: string[] = [];
  const blockedCandidates: { name: string; missing: string[] }[] = [];

  const pickBest = (
    candidates: Equipment[],
    score: (e: Equipment) => number,
  ): Equipment | undefined => {
    if (!candidates.length) return undefined;
    return [...candidates].sort((a, b) => score(b) - score(a) || b.tier - a.tier)[0];
  };

  // Track near-misses for debug
  for (const e of EQUIPMENT_CATALOG) {
    if (!styleMatch(e, style)) continue;
    if (e.slot !== "weapon" && e.slot !== "body" && e.slot !== "offhand") continue;
    if (opts?.ignoreBossFlags ? e.accessibleIgnoringBossFlags(player) : e.accessible(player)) continue;
    const miss = e.missing(player);
    if (miss.length && miss.length <= 4) {
      blockedCandidates.push({ name: e.name, missing: miss });
    }
  }

  const weapons = pool.filter((e) => e.slot === "weapon");
  let weapon: Equipment | undefined;
  if (mode === "2h") {
    weapon = pickBest(
      weapons.filter((w) => is2h(w)),
      (e) => e.abilityDamage + e.tier * 2,
    );
    if (!weapon) weapon = pickBest(weapons, (e) => e.abilityDamage + e.tier * 2);
  } else {
    const oneHand = weapons.filter((w) => !is2h(w));
    weapon = pickBest(oneHand, (e) => e.abilityDamage + e.tier * 2);
    if (!weapon) {
      weapon = pickBest(weapons, (e) => e.abilityDamage + e.tier * 2);
      if (weapon && is2h(weapon)) notes.push("No 1H BiS accessible — using 2H (OH disabled)");
    }
  }
  if (weapon) pieces.push(weapon);
  else missing.push("weapon");

  const weaponIs2h = weapon ? is2h(weapon) : false;

  const bodies = pool.filter((e) => e.slot === "body");
  const wantTank = mode === "shield";
  const body = pickBest(bodies, (e) => {
    if (wantTank) return e.armour * 2 + e.lp + (e.kind === "tank" ? 200 : 0);
    return e.armour + e.lp + (e.kind === "power" ? 150 : 0) + e.tier;
  });
  if (body) pieces.push(body);
  else missing.push("armour set");

  if (weaponIs2h || mode === "2h") {
    notes.push("2H weapon — no off-hand");
  } else if (mode === "dual") {
    const oh = pickBest(
      pool.filter((e) => e.slot === "offhand" && e.kind === "none" && e.abilityDamage > 0),
      (e) => e.abilityDamage,
    );
    if (oh) pieces.push(oh);
    else missing.push("off-hand weapon");
  } else if (mode === "defender") {
    const def = pickBest(
      pool.filter((e) => e.slot === "offhand" && e.kind === "defender"),
      (e) => e.armour + e.abilityDamage * 0.5,
    );
    if (def) pieces.push(def);
    else {
      const oh = pickBest(
        pool.filter((e) => e.slot === "offhand" && e.kind === "none" && e.abilityDamage > 0),
        (e) => e.abilityDamage,
      );
      if (oh) {
        pieces.push(oh);
        notes.push("No defender accessible — dual OH");
      } else missing.push("defender");
    }
  } else {
    const shield = pickBest(
      pool.filter((e) => e.slot === "offhand" && e.kind === "shield"),
      (e) => e.armour * 2 + e.lp,
    );
    if (shield) pieces.push(shield);
    else missing.push("shield");
  }

  for (const slot of ["boots", "ring", "cape", "amulet", "gloves", "helmet"] as EquipSlot[]) {
    const best = pickBest(
      pool.filter((e) => e.slot === slot),
      (e) => e.tier + e.armour + e.prayer * 5 + e.abilityDamage * 0.1,
    );
    if (best) pieces.push(best);
  }

  let totalArmour = 400;
  let totalWeaponAd = 0;
  let totalLp = 9900;
  let totalPrayer = 0;
  let weaponTier = 1;
  for (const p of pieces) {
    totalArmour += p.armour;
    totalWeaponAd += p.abilityDamage;
    totalLp += p.lp;
    totalPrayer += p.prayer;
    if (p.slot === "weapon") weaponTier = Math.max(weaponTier, p.tier);
  }
  if (weaponIs2h) totalWeaponAd = Math.round(totalWeaponAd * 1.05);
  totalWeaponAd = Math.round(totalWeaponAd + 900);

  notes.push(
    `OOP resolve: ${pieces.length} pieces from ${pool.length} accessible / ${EQUIPMENT_CATALOG.length} catalog`,
  );

  return {
    unlocked: [...player.regions].filter((r) => r !== "free" && r !== "any") as RegionId[],
    style,
    mode: weaponIs2h ? "2h" : mode,
    pieces: pieces.map((p) => p.toCombatItem()),
    equipment: pieces,
    totalArmour,
    totalWeaponAd,
    totalLp,
    totalPrayer,
    weaponTier,
    missingSlots: missing,
    notes,
    blockedCandidates: blockedCandidates.slice(0, 25),
  };
}

export function equipmentStats() {
  const bySlot: Record<string, number> = {};
  const byRegion: Record<string, number> = {};
  let withSkills = 0;
  let withFlags = 0;
  for (const e of EQUIPMENT_CATALOG) {
    bySlot[e.slot] = (bySlot[e.slot] ?? 0) + 1;
    for (const r of e.regions) byRegion[r] = (byRegion[r] ?? 0) + 1;
    if (e.skillReqs.length) withSkills++;
    if (e.flags.length) withFlags++;
  }
  return {
    total: EQUIPMENT_CATALOG.length,
    bySlot,
    byRegion,
    withSkills,
    withFlags,
    wikiGenerated: EQUIPMENT_CATALOG.filter((e) => e.wikiGenerated).length,
    handCurated: EQUIPMENT_CATALOG.filter((e) => !e.wikiGenerated).length,
  };
}
