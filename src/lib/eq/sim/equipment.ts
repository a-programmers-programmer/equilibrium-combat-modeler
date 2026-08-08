/**
 * OOP equipment model — every piece has a Requirement graph.
 * Combines wiki-generated catalog + hand-curated combat BiS + bane/affinity gear.
 * Loadout resolution is target-aware (dragonbane, hexhunter, etc.) and
 * STRICTLY style/region gated (modelCombat cannot equip illegal gear).
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
  itemStyleLegal,
  scoreBodyForMode,
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
} from "./equipment.generated";
import {
  BANE_DEFS,
  type BaneDef,
  type TargetTag,
  type BaneApplication,
  stackBaneMults,
  stackBaneAccuracy,
} from "./bane";

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

  /** Bane / affinity: damage mult by target tag (1.0 = none) */
  readonly vsTags: Partial<Record<TargetTag, number>>;
  /** Hit chance bonus by tag (0–1 scale, e.g. 0.3 = +30%) */
  readonly hitChanceBonus: Partial<Record<TargetTag, number>>;
  /** Only one piece per group applies (e.g. ranged-ammo) */
  readonly exclusiveGroup?: string;
  readonly baneKind?: string;
  readonly isBane: boolean;

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
    vsTags?: Partial<Record<TargetTag, number>>;
    hitChanceBonus?: Partial<Record<TargetTag, number>>;
    exclusiveGroup?: string;
    baneKind?: string;
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
    this.vsTags = opts.vsTags ?? {};
    this.hitChanceBonus = opts.hitChanceBonus ?? {};
    this.exclusiveGroup = opts.exclusiveGroup;
    this.baneKind = opts.baneKind;
    this.isBane = Object.keys(this.vsTags).length > 0 || !!opts.baneKind;

    const parts: Requirement[] = [];
    for (const r of opts.regions) {
      parts.push(new RegionReq(r as RegionTag));
    }
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

  /** Best single-tag mult this piece gives vs target set (1 if none). */
  multVs(tags: readonly TargetTag[]): number {
    const set = new Set(tags);
    if (set.has("general") && set.size === 1) return 1;
    let best = 1;
    for (const [tag, m] of Object.entries(this.vsTags) as [TargetTag, number][]) {
      if (set.has(tag) && m > best) best = m;
    }
    return best;
  }

  appliesTo(tags: readonly TargetTag[]): boolean {
    return this.multVs(tags) > 1;
  }

  accessible(p: PlayerSnapshot, opts?: { ignoreBossFlags?: boolean }): boolean {
    if (opts?.ignoreBossFlags) return this.accessibleIgnoringBossFlags(p);
    return this.req.satisfied(p);
  }

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
      notes: `${this.notes}${this.source ? ` · ${this.source}` : ""}${
        this.isBane ? ` · bane:${JSON.stringify(this.vsTags)}` : ""
      }`,
    };
  }

  /** Style legality for a combat style (delegates to shared rule). */
  styleLegalFor(style: Exclude<CombatStyle, "all">): boolean {
    if (this.slot === "material" || this.slot === "codex" || this.slot === "unknown") {
      return false;
    }
    return itemStyleLegal(
      {
        slot: this.slot as ItemSlot,
        style: this.style as CombatStyle,
        kind: this.kind,
        abilityDamage: this.abilityDamage,
      },
      style,
    );
  }
}

/** Known wiki mis-tags / incomplete rows — fix at catalog build time. */
function patchGenerated(g: GeneratedGearDef): GeneratedGearDef {
  const out = { ...g };
  // Melee-only weapons mis-tagged style:all
  if (out.id === "obsidian-blade" || out.id === "whip-vine" || out.id === "abyssal-whip") {
    out.style = "melee";
  }
  if (out.id === "annihilation" || out.id === "decimation" || out.id === "obliteration") {
    if (out.id === "annihilation") out.style = "melee";
    if (out.id === "decimation") out.style = "ranged";
    if (out.id === "obliteration") out.style = "magic";
  }
  // Khopeshes are MELEE (Gate of Elidinis) — wiki mis-tagged Tumeken as necro weapon
  if (out.id === "khopesh-of-tumeken" || /khopesh of tumeken/i.test(out.name)) {
    out.style = "melee";
    out.slot = "offhand";
    out.kind = "none";
    out.twoHanded = false;
  }
  if (out.id === "khopesh-of-elidinis" || /khopesh of elidinis/i.test(out.name)) {
    out.style = "melee";
    out.slot = "weapon";
    out.kind = "none";
  }
  // Death Guard wiki row sometimes lands as unknown slot
  if (/death-guard/i.test(out.id) || /death guard/i.test(out.name)) {
    out.style = "necromancy";
    if (out.slot === "unknown" || out.slot === "material" || out.slot === "codex") {
      out.slot = "weapon";
    }
    if (!out.abilityDamage || out.abilityDamage <= 0) {
      out.abilityDamage = out.tier >= 90 ? 2052 : 857;
    }
  }
  // Deathwarden is a body tank set, not an offhand shield
  if (out.id === "deathwarden-robe-set") {
    out.slot = "body";
    out.kind = "tank";
    out.armour = out.armour && out.armour > 0 ? out.armour : 700;
    out.style = "necromancy";
  }
  // TFN power set
  if (out.id === "first-necromancers-equipment") {
    out.kind = "power";
    out.tier = Math.max(out.tier, 95);
    out.armour = Math.max(out.armour ?? 0, 560);
    out.style = "necromancy";
  }
  // Cryptbloom is magic only (already tagged, reinforce)
  if (/cryptbloom/i.test(out.id) || /cryptbloom/i.test(out.name)) {
    out.style = "magic";
    out.kind = "tank";
  }
  // Tumeken's resplendence is magic (Desert Amascut) not necro
  if (/tumeken.*resplendence|resplendence.*tumeken/i.test(out.id + out.name)) {
    out.style = "magic";
  }
  return out;
}

function fromGenerated(g: GeneratedGearDef): Equipment {
  g = patchGenerated(g);
  let skillReqs = [...g.skillReqs];
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
  const skillReqs: { skill: string; level: number }[] = [];
  const t = Math.min(item.tier, 99);
  if (item.slot === "weapon" || (item.slot === "offhand" && item.kind === "none") || item.slot === "ammo") {
    if (item.style === "melee") skillReqs.push({ skill: "attack", level: Math.min(t, 90) });
    if (item.style === "magic") skillReqs.push({ skill: "magic", level: Math.min(t, 95) });
    if (item.style === "ranged") skillReqs.push({ skill: "ranged", level: Math.min(t, 95) });
    if (item.style === "necromancy") skillReqs.push({ skill: "necromancy", level: Math.min(t, 95) });
  } else if (["body", "helmet", "legs", "boots", "gloves"].includes(item.slot)) {
    skillReqs.push({ skill: "defence", level: Math.min(Math.max(t - 10, 1), 90) });
    if (item.style === "necromancy") skillReqs.push({ skill: "necromancy", level: Math.min(t, 95) });
    if (item.style === "magic") skillReqs.push({ skill: "magic", level: Math.min(t, 95) });
    if (item.style === "ranged") skillReqs.push({ skill: "ranged", level: Math.min(t, 95) });
  }
  if (/masterwork/i.test(item.name)) skillReqs.push({ skill: "smithing", level: 90 });

  const flags: string[] = [];
  // Rasial / TFN gate for top necro uniques
  if (/omni|soulbound|first necromancer|tfn-robes|tfn robes/i.test(`${item.id} ${item.name}`)) {
    flags.push("killed:rasial");
  }
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

function fromBaneDef(b: BaneDef): Equipment {
  const slot: EquipSlot =
    b.role === "ammo" ? "ammo" : b.role === "offhand" ? "offhand" : "weapon";
  return new Equipment({
    id: b.id,
    name: b.name,
    slot,
    style: b.style,
    tier: b.tier,
    kind: "none",
    twoHanded: b.twoHanded,
    abilityDamage: b.abilityDamage ?? 0,
    armour: b.armour ?? 0,
    source: "bane-catalog",
    notes: b.notes,
    regions: b.regions,
    skillReqs: b.skillReqs,
    quests: b.quests,
    flags: b.flags,
    wikiGenerated: false,
    vsTags: b.vsTags,
    hitChanceBonus: b.hitChanceBonus,
    exclusiveGroup: b.exclusiveGroup,
    baneKind: b.kind,
  });
}

/** Merged catalog: wiki → hand BiS → bane (bane wins on same id). */
function buildCatalog(): Equipment[] {
  const byId = new Map<string, Equipment>();
  for (const g of GENERATED_GEAR) {
    byId.set(g.id, fromGenerated(g));
  }
  for (const item of ITEMS) {
    byId.set(item.id, fromHandItem(item));
  }
  for (const b of BANE_DEFS) {
    byId.set(b.id, fromBaneDef(b));
  }
  return [...byId.values()];
}

export const EQUIPMENT_CATALOG: readonly Equipment[] = buildCatalog();

export const EQUIPMENT_BY_ID: Readonly<Map<string, Equipment>> = new Map(
  EQUIPMENT_CATALOG.map((e) => [e.id, e]),
);

export const BANE_EQUIPMENT: readonly Equipment[] = EQUIPMENT_CATALOG.filter((e) => e.isBane);

export function equipmentAccessible(
  p: PlayerSnapshot,
  opts?: { combatOnly?: boolean; ignoreBossFlags?: boolean; includeAmmo?: boolean },
): Equipment[] {
  return EQUIPMENT_CATALOG.filter((e) => {
    if (opts?.combatOnly) {
      if (e.slot === "material" || e.slot === "codex" || e.slot === "unknown") return false;
      if (e.slot === "ammo" && !opts.includeAmmo) return false;
    }
    return opts?.ignoreBossFlags ? e.accessibleIgnoringBossFlags(p) : e.accessible(p);
  });
}

function styleMatch(e: Equipment, style: CombatStyle): boolean {
  if (style === "all") return true;
  return e.styleLegalFor(style);
}

function is2h(e: Equipment): boolean {
  return e.twoHanded;
}

export interface LoadoutBaneInfo {
  mult: number;
  accuracyFactor: number;
  applied: BaneApplication[];
  pieces: Equipment[];
  targetTags: TargetTag[];
}

export type ResolveLoadoutOpts = {
  ignoreBossFlags?: boolean;
  /** Target tags — enables ammo pick + affinity weapon swap when better EV */
  targetTags?: TargetTag[];
  /** Prefer affinity bane weapons even if raw AD lower (default true when tags set) */
  preferBaneWeapons?: boolean;
};

/**
 * Requirement-aware BiS resolve — only pieces the player can equip.
 * Enforces style + region gates hard (strips illegal pieces).
 * When targetTags set: picks best ammo + may swap to affinity weapons (hex/terra/inq/Leng).
 */
export function resolveLoadoutOOP(
  player: PlayerSnapshot,
  style: Exclude<CombatStyle, "all">,
  mode: OffhandMode,
  opts?: ResolveLoadoutOpts,
): ResolvedLoadout & {
  equipment: Equipment[];
  bane: LoadoutBaneInfo;
  blockedCandidates: { name: string; missing: string[] }[];
} {
  const targetTags: TargetTag[] = opts?.targetTags?.length ? [...opts.targetTags] : ["general"];
  const preferBane = opts?.preferBaneWeapons ?? targetTags.some((t) => t !== "general");

  const pool = equipmentAccessible(player, {
    combatOnly: true,
    ignoreBossFlags: opts?.ignoreBossFlags ?? true,
    includeAmmo: true,
  }).filter((e) => {
    if (!styleMatch(e, style) && e.slot !== "ammo") return false;
    if (e.slot === "unknown" || e.slot === "material" || e.slot === "codex") return false;
    if (e.slot === "ammo") return true;
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

  for (const e of EQUIPMENT_CATALOG) {
    if (!styleMatch(e, style) && e.slot !== "ammo") continue;
    if (e.slot !== "weapon" && e.slot !== "body" && e.slot !== "offhand" && e.slot !== "ammo") continue;
    if (opts?.ignoreBossFlags ? e.accessibleIgnoringBossFlags(player) : e.accessible(player)) continue;
    const miss = e.missing(player);
    if (miss.length && miss.length <= 4) {
      blockedCandidates.push({ name: e.name, missing: miss });
    }
  }

  // ── Weapon: general BiS vs affinity bane EV ──────────────────────
  const weapons = pool.filter((e) => e.slot === "weapon");
  const scoreWeapon = (e: Equipment) => {
    const base = e.abilityDamage + e.tier * 2;
    // Prefer exact style over anything else (already filtered)
    const styleBoost = e.style === style ? 50 : 0;
    if (!preferBane) return base + styleBoost;
    return base * e.multVs(targetTags) + styleBoost;
  };

  let weapon: Equipment | undefined;
  if (mode === "2h") {
    weapon = pickBest(
      weapons.filter((w) => is2h(w)),
      scoreWeapon,
    );
    if (!weapon) weapon = pickBest(weapons, scoreWeapon);
  } else {
    const oneHand = weapons.filter((w) => !is2h(w));
    weapon = pickBest(oneHand, scoreWeapon);
    if (!weapon) {
      weapon = pickBest(weapons, scoreWeapon);
      if (weapon && is2h(weapon)) notes.push("No 1H BiS accessible — using 2H (OH disabled)");
    }
  }

  // If affinity bane weapon wins EV vs current weapon (including shared ammo mult)
  if (preferBane && targetTags.some((t) => t !== "general")) {
    const affinity = weapons.filter(
      (w) => w.isBane && w.appliesTo(targetTags) && w.abilityDamage > 0,
    );
    const bestAff = pickBest(affinity, scoreWeapon);
    const ammoPool = pool.filter((e) => e.slot === "ammo" && e.appliesTo(targetTags));
    const bestAmmo = pickBest(ammoPool, (e) => e.multVs(targetTags) * 100 + e.tier);
    const ammoM = bestAmmo?.multVs(targetTags) ?? 1;

    if (bestAff && weapon) {
      const generalScore = weapon.abilityDamage * weapon.multVs(targetTags) * ammoM;
      const affScore = bestAff.abilityDamage * bestAff.multVs(targetTags) * ammoM;
      if (affScore > generalScore * 1.01) {
        weapon = bestAff;
        notes.push(`Bane weapon swap: ${bestAff.name} (EV vs [${targetTags.join(",")}])`);
      }
    } else if (bestAff && !weapon) {
      weapon = bestAff;
    }
  }

  if (weapon) pieces.push(weapon);
  else missing.push("weapon");

  const weaponIs2h = weapon ? is2h(weapon) : false;

  const bodies = pool.filter((e) => e.slot === "body");
  const wantTank = mode === "shield";
  const body = pickBest(bodies, (e) =>
    scoreBodyForMode(
      { armour: e.armour, lp: e.lp, kind: e.kind, tier: e.tier },
      wantTank,
    ) + (e.style === style ? 100 : 0),
  );
  if (body) {
    if (style === "necromancy" && /cryptbloom/i.test(body.id + body.name)) {
      notes.push("CRITICAL blocked: refused Cryptbloom on necromancy");
    } else {
      pieces.push(body);
    }
  } else missing.push("armour set");

  // Necro hard-guard: if somehow no body, force best deathwarden/tfn from pool
  if (style === "necromancy" && !pieces.some((p) => p.slot === "body")) {
    const necroBodies = bodies.filter(
      (e) => e.style === "necromancy" && !/cryptbloom/i.test(e.id + e.name),
    );
    const forced = pickBest(necroBodies, (e) =>
      scoreBodyForMode({ armour: e.armour, lp: e.lp, kind: e.kind, tier: e.tier }, wantTank),
    );
    if (forced) {
      pieces.push(forced);
      notes.push(`Necro armour fallback: ${forced.name}`);
    }
  }

  if (weaponIs2h || mode === "2h") {
    notes.push("2H weapon — no off-hand");
  } else if (mode === "dual") {
    const ohPool = pool.filter((e) => e.slot === "offhand" && e.kind === "none" && e.abilityDamage > 0);
    const oh = pickBest(ohPool, (e) => e.abilityDamage * (preferBane ? e.multVs(targetTags) : 1));
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
      (e) => e.armour * 2 + e.lp + (e.style === style ? 40 : 0),
    );
    if (shield) pieces.push(shield);
    else missing.push("shield");
  }

  for (const slot of ["boots", "ring", "cape", "amulet", "gloves", "helmet"] as EquipSlot[]) {
    const best = pickBest(
      pool.filter((e) => e.slot === slot),
      (e) =>
        e.tier +
        e.armour +
        e.prayer * 5 +
        e.abilityDamage * 0.1 +
        (e.style === style ? 40 : 0),
    );
    if (best) pieces.push(best);
  }

  // ── Ammo (ranged only, target-aware) ─────────────────────────────
  if (style === "ranged" && targetTags.some((t) => t !== "general")) {
    const ammos = pool.filter((e) => e.slot === "ammo" && e.appliesTo(targetTags));
    const ammo = pickBest(ammos, (e) => e.multVs(targetTags) * 100 + e.tier);
    if (ammo) {
      pieces.push(ammo);
      notes.push(`Bane ammo: ${ammo.name} ×${ammo.multVs(targetTags).toFixed(2)}`);
    } else {
      notes.push(`No bane ammo accessible for [${targetTags.join(",")}]`);
    }
  }

  // ── Hard strip illegal pieces (style / region) ───────────────────
  const unlockedRegions = new Set<RegionId>(
    [...player.regions].filter(
      (r): r is RegionId =>
        r !== "free" && r !== "any" && r !== undefined,
    ) as RegionId[],
  );
  // free milestone regions always present when free/misthalin
  if (player.regions.has("free") || player.regions.has("misthalin")) {
    unlockedRegions.add("misthalin");
    unlockedRegions.add("havenhythe");
    unlockedRegions.add("karamja");
  }
  for (const r of player.regions) {
    if (r !== "free" && r !== "any") unlockedRegions.add(r as RegionId);
  }

  const legalPieces: Equipment[] = [];
  for (const p of pieces) {
    if (p.slot === "ammo") {
      legalPieces.push(p);
      continue;
    }
    if (!p.styleLegalFor(style)) {
      notes.push(`Stripped illegal style: ${p.name} (${p.style}≠${style})`);
      continue;
    }
    if (/cryptbloom/i.test(p.id + p.name) && style !== "magic") {
      notes.push(`Stripped Cryptbloom off-style: ${p.name}`);
      continue;
    }
    // Region check via accessible flags already applied; double-check regions
    if (p.regions.length > 0) {
      const missReg = p.regions.filter((r) => !unlockedRegions.has(r) && !player.regions.has(r as RegionTag));
      if (missReg.length) {
        notes.push(`Stripped region-locked: ${p.name} needs ${missReg.join("+")}`);
        continue;
      }
    }
    legalPieces.push(p);
  }
  pieces.length = 0;
  pieces.push(...legalPieces);

  let totalArmour = 400;
  let totalWeaponAd = 0;
  let totalLp = 9900;
  let totalPrayer = 0;
  let weaponTier = 1;
  for (const p of pieces) {
    if (p.slot === "ammo") continue;
    totalArmour += p.armour;
    totalWeaponAd += p.abilityDamage;
    totalLp += p.lp;
    totalPrayer += p.prayer;
    if (p.slot === "weapon") weaponTier = Math.max(weaponTier, p.tier);
  }
  if (weaponIs2h) totalWeaponAd = Math.round(totalWeaponAd * 1.05);
  totalWeaponAd = Math.round(totalWeaponAd + 900);

  const banePieces = pieces.filter((p) => p.isBane && p.appliesTo(targetTags));
  const stacked = stackBaneMults(
    banePieces.map((p) => ({
      id: p.id,
      name: p.name,
      vsTags: p.vsTags,
      exclusiveGroup: p.exclusiveGroup,
    })),
    targetTags,
  );
  const accuracyFactor = stackBaneAccuracy(banePieces, targetTags);
  const bane: LoadoutBaneInfo = {
    mult: stacked.mult,
    accuracyFactor,
    applied: stacked.applied,
    pieces: banePieces,
    targetTags,
  };
  if (stacked.mult > 1) {
    notes.push(
      `Bane stack ×${stacked.mult.toFixed(3)} (acc×${accuracyFactor.toFixed(3)}): ${stacked.applied.map((a) => a.name).join(" + ")}`,
    );
  }

  notes.push(
    `OOP resolve: ${pieces.length} pieces from ${pool.length} accessible / ${EQUIPMENT_CATALOG.length} catalog` +
      (targetTags[0] !== "general" ? ` · target=[${targetTags.join(",")}]` : ""),
  );

  const unlockedList = [...unlockedRegions];

  return {
    unlocked: unlockedList,
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
    bane,
  };
}

/** Pick bane Equipment objects from full catalog (OOP). */
export function pickBaneFromCatalog(
  player: PlayerSnapshot,
  style: Exclude<CombatStyle, "all">,
  targetTags: readonly TargetTag[],
  opts?: { ignoreBossFlags?: boolean },
): Equipment[] {
  const load = resolveLoadoutOOP(player, style, style === "ranged" || style === "magic" ? "2h" : "dual", {
    ignoreBossFlags: opts?.ignoreBossFlags ?? true,
    targetTags: [...targetTags],
  });
  return load.bane.pieces;
}

export function equipmentStats() {
  const bySlot: Record<string, number> = {};
  const byRegion: Record<string, number> = {};
  let withSkills = 0;
  let withFlags = 0;
  let withBane = 0;
  for (const e of EQUIPMENT_CATALOG) {
    bySlot[e.slot] = (bySlot[e.slot] ?? 0) + 1;
    for (const r of e.regions) byRegion[r] = (byRegion[r] ?? 0) + 1;
    if (e.skillReqs.length) withSkills++;
    if (e.flags.length) withFlags++;
    if (e.isBane) withBane++;
  }
  return {
    total: EQUIPMENT_CATALOG.length,
    bySlot,
    byRegion,
    withSkills,
    withFlags,
    withBane,
    wikiGenerated: EQUIPMENT_CATALOG.filter((e) => e.wikiGenerated).length,
    handCurated: EQUIPMENT_CATALOG.filter((e) => !e.wikiGenerated && !e.isBane).length,
    banePieces: withBane,
  };
}
