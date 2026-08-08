/**
 * Equilibrium DPS / combat model.
 * Supports abstract gear stages OR region-locked item loadouts.
 */

import {
  activeBlessings,
  type BlessingDef,
  type BlessingId,
  type Offhand,
  type Path,
  uniquePaths,
} from "./blessings";
import {
  type BuildArchetype,
  type GearStage,
  type Style,
  offhandForArchetype,
  styleById,
} from "./gear";
import {
  type OffhandMode,
  type RegionId,
  type ResolvedLoadout,
  resolveLoadout,
  unlockedFromElectives,
  unlockedFromPackage,
  type RegionPackage,
  REGION_PACKAGES,
  findIllegalLoadoutPieces,
  FREE_REGION_IDS,
} from "./items";
import { resolveLoadoutOOP, type Equipment } from "./sim/equipment";
import {
  regionsFromElectives,
  type PlayerSnapshot,
  type RegionTag,
} from "./sim/requirements";
import type { SkillId } from "./xp";
import {
  type TargetTag,
  type BanePiece,
  baneDamageMult,
  baneAccuracyDpsFactor,
  pickBaneLoadout,
  BANE_CATALOG,
} from "./sim/bane";
import {
  type FamiliarId,
  FAMILIAR_BY_ID,
  modelFamiliarDps,
  type FamiliarDpsResult,
} from "./sim/summoning";
import {
  type RelicId,
  stackRelicPlayerMult,
  RELIC_BY_ID,
} from "./sim/relics";
import {
  type PotionProfile,
  POTION_BY_ID,
  weaponPoisonBase,
  envenomedPoisonMult,
  styleBleedDotDps,
  conjureDps,
  specialAttackDps,
  ultDutyMult,
  assembleShares,
  type DimensionSlice,
  type DamageDimensionId,
} from "./sim/dimensions";
import {
  modelPoisonStack,
  POISON_KIT_BY_ID,
  type PoisonKitId,
  type PoisonGearFlags,
  type WeaponPoisonTier,
} from "./sim/poison";
import {
  resolveArmourBonuses,
  type ArmourProfileId,
  type ArmourResolveResult,
  ARMOUR_BY_ID,
  profileFromBodyPiece,
  sanitizeArmourProfile,
} from "./sim/armour";
import {
  modelInvention,
  type InventionTier,
} from "./sim/invention";

export interface GearSnapshot {
  armour: number;
  baselineAd: number;
  baseLp: number;
  prayer: number;
  /** Extra AD when Genesis is active (T120 weapon treatment) */
  genesisAdBonus: number;
  weaponTier: number;
  source: string;
  pieces?: { name: string; slot: string; id?: string; style?: string }[];
  notes?: string[];
  /** Armour profile for style dmg / set effects (optional) */
  armourProfileId?: ArmourProfileId;
  /** Explicit style damage mult from power armour (default from profile) */
  styleDamageMult?: number;
  /** Set effect mult */
  setEffectMult?: number;
  /** Regions this loadout was resolved under (invention / poison gates) */
  unlockedRegions?: RegionId[];
  /** Bane stack from OOP loadout (ammo + affinity weapons) */
  bane?: {
    mult: number;
    accuracyFactor: number;
    pieceIds: string[];
    pieceNames: string[];
    applied: { name: string; tag: string; mult: number }[];
    targetTags: TargetTag[];
  };
}

export interface ModelInput {
  picks: Path[];
  style: Style;
  /** Fallback abstract stage if no loadout/snapshot */
  stage: GearStage;
  archetype: BuildArchetype;
  offhand?: Offhand;
  herbloreLevel: number;
  targetTiles: number;
  multiContentWeight: number;
  powerburst: boolean;
  /** When set, overrides stage armour/AD/LP from region-resolved gear */
  gear?: GearSnapshot;
  /**
   * Target tags for bane/affinity weapons (dragon, mage-class, etc.).
   * Default: general (no bane mult).
   */
  targetTags?: TargetTag[];
  /**
   * Explicit bane pieces (ammo + affinity weapons). If omitted and targetTags
   * are non-general, auto-picks best accessible bane for style from free+endgame unlocks.
   */
  baneGear?: BanePiece[];
  /** Soft region set for auto bane pick (default: all free + common electives) */
  baneRegions?: RegionTag[];
  /** Combat familiar */
  familiar?: FamiliarId;
  /** Summoning level for Devout scaling (default 99) */
  summoningLevel?: number;
  /** Primary combat relic */
  relic?: RelicId;
  /** Secondary relic if Rejuvenated double-dip */
  relicSecondary?: RelicId | null;
  /**
   * Player snapshot for familiar/scroll requirement gates.
   * If omitted, builds one from baneRegions + summoningLevel (soft access).
   */
  summoningPlayer?: PlayerSnapshot;
  /** hard = full flags; soft = region+level; ignore = no gates (debug only) */
  familiarAccess?: "soft" | "hard" | "ignore";
  /**
   * Potion / consumable profile id (see POTION_PROFILES).
   * Default: elder-ovl when herbloreLevel >= 106, else overload / super-sets.
   */
  potionProfile?: string;
  /** Fight length for ult duty-cycle modeling (seconds). Default 60. */
  fightSeconds?: number;
  /** Include style DoT / bleed dimension explicitly */
  modelDots?: boolean;
  /** Include weapon specials EV */
  modelSpecials?: boolean;
  /** Force claw/EOF dump modeling during Avernic windows */
  clawSpecDump?: boolean;
  /** Include necro conjures */
  modelConjures?: boolean;
  /**
   * Full poison kit (cinderbane, blowpipe, laniakea, kwuarm, reaver).
   * See POISON_KITS. Overrides simple potion.poisonTier when set.
   */
  poisonKit?: PoisonKitId;
  /** Explicit poison gear flags (overrides kit gear if both set partially) */
  poisonGear?: Partial<PoisonGearFlags>;
  /** Force weapon poison tier 0–4 */
  weaponPoisonTier?: WeaponPoisonTier;
  /** Target poison immune (Envenomed strips) */
  targetPoisonImmune?: boolean;
  /**
   * Armour package profile — power vs tank vs hybrid.
   * Default: auto from style + offhand + Aegis presence.
   */
  armourProfile?: ArmourProfileId;
  /**
   * Invention tier: none | standard (Asgarnia) | ancient (Kandarin).
   * Auto-locked if regions don't allow.
   */
  inventionTier?: InventionTier;
  /** Force Perkfection perk bonus (when full loadout has it) */
  perkfection?: boolean;
}

export interface DamageBreakdown {
  coreAbility: number;
  bigBonedFlat: number;
  cindersOnHit: number;
  inferno: number;
  lightOfSaradomin: number;
  splashBonus: number;
  tearingGrasps: number;
  poison: number;
  bleedDot: number;
  specialAttack: number;
  conjure: number;
  barkscalesGrasp: number;
  other: number;
  /** Full multi-dimension slices (post-mult attribution where possible) */
  dimensions?: DimensionSlice[];
}

export interface ModelResult {
  active: BlessingDef[];
  uniquePathCount: number;
  god4: Path | null;
  god8: Path | null;
  offhand: Offhand;
  gear: GearSnapshot;
  stats: {
    baselineAd: number;
    effectiveAd: number;
    armour: number;
    maxLp: number;
    flatPerHit: number;
    critChanceBonus: number;
    critDamageBonus: number;
    prayerBonus: number;
    hitsPerSecond: number;
    cdrMultiplier: number;
  };
  dps: number;
  /** Player + familiar */
  totalDps: number;
  vsBaseline: number;
  breakdown: DamageBreakdown;
  flags: string[];
  warnings: string[];
  /** Potion profile used */
  potions?: PotionProfile;
  /** Dimension shares for UI / plots */
  dimensions?: DimensionSlice[];
  /** Bane/affinity application */
  bane?: {
    mult: number;
    accuracyFactor: number;
    pieces: string[];
    applied: { name: string; tag: string; mult: number }[];
    targetTags: TargetTag[];
  };
  /** Familiar contribution */
  familiar?: {
    id: string;
    name: string;
    dps: number;
    devoutMult: number;
    scrollUptime: number;
    playerDamageMult: number;
  };
  /** Relic contribution */
  relics?: {
    primary: string;
    secondary: string | null;
    playerMult: number;
    devout: boolean;
    divineDruid: boolean;
  };
  armourBonuses?: {
    profile: ArmourProfileId;
    profileName: string;
    totalArmour: number;
    styleDamageMult: number;
    setEffectMult: number;
    abilityMult: number;
    aegisAd: number;
    armourBonusAd: number;
    prayerBonus: number;
  };
  invention?: {
    tier: InventionTier;
    locked: boolean;
    perkMult: number;
    procFactor: number;
  };
  poisonStack?: {
    dps: number;
    effectiveTier: number;
    applyChance: number;
    sources: unknown[];
    gearStatus: unknown;
  };
}

function floor(n: number): number {
  return Math.floor(n);
}

export function aegisBonus(armour: number, offhand: Offhand): number {
  const pct = offhand === "shield" ? 0.75 : offhand === "defender" ? 0.5 : 0.25;
  return floor(armour * pct);
}

export function fervorThroughput(): number {
  return 1 / 0.7;
}

export function resolveGods(picks: readonly Path[]): { god4: Path | null; god8: Path | null } {
  const derive = (seg: readonly Path[]): Path | null => {
    if (seg.length < 3) return null;
    const c: Record<Path, number> = { Order: 0, Balance: 0, Chaos: 0 };
    for (const p of seg) c[p]++;
    for (const p of ["Order", "Balance", "Chaos"] as Path[]) if (c[p] >= 2) return p;
    if (c.Order && c.Balance && c.Chaos) return "Balance";
    return null;
  };
  return {
    god4: picks.length >= 3 ? derive(picks.slice(0, 3)) : null,
    god8: picks.length >= 6 ? derive(picks.slice(3, 6)) : null,
  };
}

function modeForArchetype(a: BuildArchetype, style?: Style): OffhandMode {
  if (a === "shield-tank") return "shield";
  if (a === "defender") return "defender";
  // Ranged/magic BiS is typically 2H (BOLG/FSOA/hex/inq)
  if (style === "ranged" || style === "magic") return "2h";
  return "dual";
}

function offhandFromLoadout(loadout: ResolvedLoadout): Offhand {
  if (loadout.pieces.some((p) => p.kind === "shield")) return "shield";
  if (loadout.pieces.some((p) => p.kind === "defender")) return "defender";
  return "none";
}

export function loadoutToSnapshot(
  loadout: ResolvedLoadout & {
    bane?: {
      mult: number;
      accuracyFactor: number;
      applied: { name: string; tag: string; mult: number }[];
      pieces: { id: string; name: string }[];
      targetTags: TargetTag[];
    };
  },
): GearSnapshot {
  const genesisAdBonus = Math.round(loadout.totalWeaponAd * 0.22 + (120 - loadout.weaponTier) * 8);
  const body = loadout.pieces.find((p) => p.slot === "body");
  const wantTank = loadout.mode === "shield";
  const armourProfileId = profileFromBodyPiece(
    loadout.style as Style,
    body ? `${body.id} ${body.name}` : undefined,
    wantTank ? "tank" : "power",
  );

  // Defense-in-depth: never snapshot illegal style/region/cryptbloom-on-necro pieces
  const illegal = findIllegalLoadoutPieces(loadout);
  const notes = [...(loadout.notes ?? [])];
  let pieces = loadout.pieces;
  if (illegal.length) {
    const badIds = new Set(illegal.map((i) => i.piece.id));
    pieces = loadout.pieces.filter((p) => !badIds.has(p.id));
    for (const i of illegal) {
      notes.push(`ILLEGAL stripped: ${i.piece.name} (${i.reasons.join("; ")})`);
    }
  }

  const snap: GearSnapshot = {
    armour: loadout.totalArmour,
    baselineAd: loadout.totalWeaponAd,
    baseLp: loadout.totalLp,
    prayer: loadout.totalPrayer + 12,
    genesisAdBonus: Math.max(400, genesisAdBonus),
    weaponTier: loadout.weaponTier,
    source: `regions:${loadout.unlocked.join("+")} · ${loadout.mode}`,
    pieces: pieces.map((p) => ({
      name: p.name,
      slot: p.slot,
      id: p.id,
      style: p.style,
    })),
    notes,
    armourProfileId,
    unlockedRegions: [...loadout.unlocked],
  };
  if (loadout.bane && loadout.bane.mult > 1) {
    snap.bane = {
      mult: loadout.bane.mult,
      accuracyFactor: loadout.bane.accuracyFactor,
      pieceIds: loadout.bane.pieces.map((p) => p.id),
      pieceNames: loadout.bane.pieces.map((p) => p.name),
      applied: loadout.bane.applied,
      targetTags: loadout.bane.targetTags,
    };
    snap.source += ` · bane×${loadout.bane.mult.toFixed(2)}`;
  }
  return snap;
}

function playerSnapFromRegions(
  unlocked: readonly RegionId[],
  style: Style,
): PlayerSnapshot {
  const levels: Partial<Record<SkillId, number>> = {
    attack: 99,
    strength: 99,
    defence: 99,
    magic: 99,
    ranged: 99,
    necromancy: 99,
    smithing: 99,
    crafting: 99,
    prayer: 99,
    hunter: 99,
    runecrafting: 99,
  };
  const regions = new Set<RegionTag>(["free", "misthalin", "havenhythe", "karamja"]);
  for (const r of unlocked) regions.add(r as RegionTag);
  return {
    levels,
    regions,
    quests: new Set(["ritual-of-the-mahjarrat", "necromancy-questline"]),
    flags: new Set([
      "unlocked:tune-bane",
      "unlocked:dinarrows",
      "unlocked:jas-anima",
      "killed:soulgazer",
      "unlocked:hexhunter-imbue",
      "unlocked:bgh-t3",
      "unlocked:inquisitor-assemble",
      "unlocked:inq-imbue",
      "unlocked:glacor-front",
      "unlocked:leng-core",
      // gearFromPackage endgame assumes free-path bosses farmed when ignoreBossFlags
      "killed:rasial",
      "killed:kerapac",
      "killed:vorkath-path",
      "killed:zamorak",
      "killed:zuk",
    ]),
    relicTier: 6,
  };
}

export function gearFromRegions(
  electives: readonly RegionId[],
  style: Style,
  archetype: BuildArchetype,
  targetTags?: TargetTag[],
): { snapshot: GearSnapshot; loadout: ResolvedLoadout; offhand: Offhand } {
  const unlocked = unlockedFromElectives(electives);
  const snap = playerSnapFromRegions(unlocked, style);
  const loadout = resolveLoadoutOOP(snap, style, modeForArchetype(archetype, style), {
    ignoreBossFlags: true,
    targetTags,
  });
  // Prefer explicit elective unlock list for invention / audit (catalog may omit free tags)
  const merged = { ...loadout, unlocked: unlocked.length ? unlocked : loadout.unlocked };
  return {
    snapshot: loadoutToSnapshot(merged),
    loadout: merged,
    offhand: offhandFromLoadout(loadout),
  };
}

export function gearFromPackage(
  pkg: RegionPackage,
  style: Style,
  archetype: BuildArchetype,
  targetTags?: TargetTag[],
): { snapshot: GearSnapshot; loadout: ResolvedLoadout; offhand: Offhand } {
  const unlocked = unlockedFromPackage(pkg);
  const snap = playerSnapFromRegions(unlocked, style);
  const loadout = resolveLoadoutOOP(snap, style, modeForArchetype(archetype, style), {
    ignoreBossFlags: true,
    targetTags,
  });
  const merged = { ...loadout, unlocked: unlocked.length ? unlocked : loadout.unlocked };
  return {
    snapshot: loadoutToSnapshot(merged),
    loadout: merged,
    offhand: offhandFromLoadout(loadout),
  };
}

function snapshotFromStage(stage: GearStage, style: Style, archetype: BuildArchetype): GearSnapshot {
  return {
    armour: stage.armour[archetype],
    baselineAd: stage.baselineAd[style],
    baseLp: stage.baseLp[archetype],
    prayer: stage.prayerBonus,
    genesisAdBonus: stage.genesisAdBonus[style],
    weaponTier: stage.id === "endgame" ? 95 : stage.id === "late" ? 90 : stage.id === "mid" ? 85 : 75,
    source: `stage:${stage.id}`,
  };
}

/** Regions for invention / poison soft gates from input + gear snapshot. */
function regionsForGates(input: ModelInput, gear: GearSnapshot): RegionTag[] {
  if (input.baneRegions) {
    return Array.isArray(input.baneRegions) ? [...input.baneRegions] : [...input.baneRegions];
  }
  if (input.summoningPlayer) {
    return [...input.summoningPlayer.regions];
  }
  if (gear.unlockedRegions?.length) {
    return ["free", ...gear.unlockedRegions] as RegionTag[];
  }
  const m = /^regions:([^\s·]+)/.exec(gear.source);
  if (m?.[1]) {
    return ["free", ...(m[1].split("+").filter(Boolean) as RegionTag[])];
  }
  return ["free", ...FREE_REGION_IDS] as RegionTag[];
}

export function modelCombat(input: ModelInput): ModelResult {
  const style = styleById(input.style);
  const offhand = input.offhand ?? offhandForArchetype(input.archetype);
  const active = activeBlessings(input.picks);
  const ids = new Set(active.map((b) => b.id));
  const has = (id: BlessingId) => ids.has(id);
  const uniq = uniquePaths(input.picks.slice(0, 6));
  const { god4, god8 } = resolveGods(input.picks);
  const flags: string[] = [];
  const warnings: string[] = [];

  let gear = input.gear ?? snapshotFromStage(input.stage, input.style, input.archetype);

  // Snapshot piece validation — Cryptbloom never on necro; wrong-style weapons stripped from notes
  if (gear.pieces?.length) {
    const cleaned = gear.pieces.filter((p) => {
      if (input.style === "necromancy" && /cryptbloom/i.test(p.name)) {
        warnings.push(`Stripped Cryptbloom from necro gear: ${p.name}`);
        return false;
      }
      if (p.style && p.slot === "body" && p.style !== "all" && p.style !== input.style) {
        warnings.push(`Stripped illegal body ${p.name} (${p.style}) for ${input.style}`);
        return false;
      }
      if (p.style && p.slot === "weapon" && p.style !== input.style && p.style !== "all") {
        warnings.push(`Stripped illegal weapon ${p.name} (${p.style}) for ${input.style}`);
        return false;
      }
      return true;
    });
    if (cleaned.length !== gear.pieces.length) {
      gear = { ...gear, pieces: cleaned };
    }
  }

  let armour = gear.armour;
  let baseLp = gear.baseLp;
  let ad = gear.baselineAd;
  let prayer = gear.prayer;
  let critChance = 0;
  let critDmg = 0;

  if (gear.notes) {
    for (const n of gear.notes) {
      if (n.startsWith("WARNING") || n.startsWith("ILLEGAL") || n.startsWith("CRITICAL"))
        warnings.push(n);
      else flags.push(n);
    }
  }
  flags.push(`Gear: ${gear.source} (T${gear.weaponTier})`);

  // Armour package — sanitize off-style profiles (Cryptbloom≠necro, TFN≠melee, …)
  const requestedProfile = input.armourProfile ?? gear.armourProfileId;
  const sanitized = sanitizeArmourProfile(input.style, requestedProfile, {
    hasAegis: has("teragards-aegis"),
    offhand,
  });
  if (sanitized.remapped && sanitized.reason) {
    warnings.push(`Armour profile gate: ${sanitized.reason}`);
  }

  let armourRes = resolveArmourBonuses({
    profileId: sanitized.profileId,
    style: input.style,
    offhand,
    hasAegis: has("teragards-aegis"),
    hasChaoticInsight: has("chaotic-insight"),
    armourOverride: gear.armour > 0 ? gear.armour : undefined,
    prayerOverride: gear.prayer > 0 ? gear.prayer : undefined,
  });
  // Prefer profile armour when snapshot is abstract stage (no explicit pieces)
  if (!input.gear?.pieces?.length && !gear.armourProfileId && input.armourProfile) {
    armour = armourRes.totalArmour;
  } else if (!input.gear && !gear.source.startsWith("stage:")) {
    // keep loadout armour
  } else if (!input.gear) {
    // stage fallback: blend stage armour with profile if profile forced
    if (input.armourProfile) armour = armourRes.totalArmour;
  }
  // Always take profile prayer/LP bonuses as additive floor when higher
  if (armourRes.prayerBonus > prayer) prayer = armourRes.prayerBonus;
  baseLp += armourRes.lpBonus;
  // Style damage mult applied after Aegis AD stack (below)
  const styleDmgMult =
    gear.styleDamageMult ?? armourRes.styleDamageMult;
  const setEffMult = gear.setEffectMult ?? armourRes.setEffectMult * armourRes.chaoticInsightMult;
  for (const f of armourRes.flags) flags.push(f);

  // ── Relic structural effects early (Icyenic prayer/crit/AD%, Naragi armour, pockets) ──
  // Full mult stack still applied later; structural fields feed AD/crit/Aegis.
  const relicEarly = stackRelicPlayerMult(
    input.relic ?? "none",
    input.relicSecondary ?? null,
    {
      style: input.style,
      fightSeconds: input.fightSeconds ?? 60,
      prayerBonus: prayer,
      baselineAd: ad,
      summoningLevel: input.summoningLevel ?? 99,
    },
  );
  const rc = relicEarly.combat;
  if (rc) {
    if (rc.prayerBonusAdd) {
      prayer += rc.prayerBonusAdd;
      flags.push(`Relic prayer +${rc.prayerBonusAdd} → ${prayer}`);
    }
    if (rc.flatArmour) {
      armour += rc.flatArmour;
      flags.push(`Relic armour +${rc.flatArmour}`);
    }
    if (rc.flatAd) {
      ad += rc.flatAd;
      flags.push(`Relic pocket AD +${Math.round(rc.flatAd)}`);
    }
    if (rc.critChanceAdd > 0) {
      critChance += rc.critChanceAdd;
      flags.push(
        `Icyenic/crit +${(rc.critChanceAdd * 100).toFixed(1)}% crit (prayer-scaled)`,
      );
    }
  }

  if (has("true-equilibrium")) {
    const stacks = Math.max(1, Math.min(3, uniq));
    ad += 75 * stacks;
    armour += 50 * stacks;
    baseLp += 500 * stacks;
    critChance += 0.05 * stacks;
    critDmg += 0.075 * stacks;
    prayer += 5 * stacks;
    flags.push(`True Equilibrium ×${stacks}`);
    // Icyenic scales with total prayer — top up crit if TE added prayer after early resolve
    if (rc?.hasIcyenic) {
      const targetCrit = prayer * 0.002;
      const already = rc.critChanceAdd;
      if (targetCrit > already) {
        critChance += targetCrit - already;
        flags.push(
          `Icyenic crit top-up +${((targetCrit - already) * 100).toFixed(1)}% (prayer now ${prayer})`,
        );
      }
    }
  }

  if (has("havoc-born")) {
    armour = floor(armour * 0.75);
    baseLp = floor(baseLp * 0.75);
    flags.push("Havoc Born glass");
  }

  if (has("big-boned")) {
    baseLp = floor(baseLp * 1.5);
    flags.push("Big Boned LP");
  }

  let maxLp = baseLp;
  // Resolve potion profile early — affects AD, LP (powerburst), poison, density
  const potionId =
    input.potionProfile ??
    (input.herbloreLevel >= 106
      ? "elder-ovl"
      : input.herbloreLevel >= 96
        ? "overload"
        : input.herbloreLevel >= 55
          ? "super-sets"
          : "none");
  const potions: PotionProfile = POTION_BY_ID[potionId] ?? POTION_BY_ID.none!;
  if (input.herbloreLevel < potions.herbloreRequired && potions.id !== "none") {
    warnings.push(
      `Potion ${potions.name} needs Herb ${potions.herbloreRequired} (have ${input.herbloreLevel}) — still modeling as available for leagues EV`,
    );
  }
  flags.push(`Potions: ${potions.name}`);

  const powerburstOn = input.powerburst || potions.powerburstLp > 1;
  if (powerburstOn) {
    maxLp = floor(baseLp * Math.max(1.15, potions.powerburstLp));
    flags.push("Powerburst / potion LP EV");
  }
  // Overload AD applied to baseline before aegis-scale? Model as post-base pre-aegis mult
  ad = floor(ad * potions.adMult);
  if (potions.adMult > 1) flags.push(`OVL/AD potion ×${potions.adMult}`);

  let aegisAd = 0;
  if (has("teragards-aegis")) {
    aegisAd = aegisBonus(armour, offhand);
    ad += aegisAd;
    flags.push(`Aegis +${aegisAd} AD from ${armour} armour (${offhand})`);
  }

  if (has("higher-power")) {
    ad = floor(ad * 1.3);
    flags.push("Higher Power +30% AD");
    warnings.push("Lost Berserk / Sunshine / Death's Swiftness / Living Death");
  }

  if (has("genesis-essence")) {
    ad += gear.genesisAdBonus;
    flags.push("Genesis T120 weapons");
  }

  // Icyenic / relic ability-damage % from prayer (0.2% per prayer bonus)
  // Recompute from final prayer so TE / pockets count
  if (rc?.hasIcyenic) {
    const icyPct = prayer * 0.002;
    const before = ad;
    ad = floor(ad * (1 + icyPct));
    flags.push(
      `Icyenic Faith AD +${(icyPct * 100).toFixed(1)}% from prayer ${prayer} (${before}→${ad})`,
    );
  } else if (rc && rc.abilityDamagePct > 0) {
    const before = ad;
    ad = floor(ad * (1 + rc.abilityDamagePct));
    flags.push(
      `Relic base AD +${(rc.abilityDamagePct * 100).toFixed(1)}% (${before}→${ad})`,
    );
  }

  // Power armour style damage bonuses + set effects (on top of weapon AD + Aegis)
  const adBeforeArmourBonus = ad;
  ad = floor(ad * styleDmgMult * setEffMult);
  if (styleDmgMult * setEffMult > 1.001) {
    flags.push(
      `Armour dmg/set ×${(styleDmgMult * setEffMult).toFixed(3)} (AD ${adBeforeArmourBonus}→${ad})`,
    );
  }
  const armourBonusAd = ad - adBeforeArmourBonus;

  // ── Invention perks (gated by Asgarnia / Kandarin via gear regions) ──
  const invRegions = regionsForGates(input, gear);
  const invRes = modelInvention({
    tier: input.inventionTier ?? "none",
    style: input.style,
    perkfection:
      input.perkfection === true ||
      input.relic === "perkfection" ||
      input.relicSecondary === "perkfection",
    powerArchive: has("power-archive"),
    regions: invRegions,
    player: input.summoningPlayer,
  });
  // Also detect perkfection from... we only have primary/secondary here; full loadout may differ
  if (invRes.perkMult > 1 || invRes.procDpsFactor > 1) {
    ad = floor(ad * invRes.perkMult);
    flags.push(...invRes.flags);
  } else if (input.inventionTier && input.inventionTier !== "none" && invRes.locked) {
    flags.push(...invRes.flags);
  }
  for (const w of invRes.warnings) warnings.push(w);
  const inventionProcMult = invRes.procDpsFactor;

  let densityMult = 1;
  if (has("adrenaline-junkie")) {
    densityMult *= 1.12;
    flags.push("Adren Junkie density");
  }
  if (has("tempered-heart")) {
    densityMult *= 1.08;
    flags.push("Tempered Heart adren");
  }
  if (has("avernic-rampage")) {
    densityMult *= 1.18;
    flags.push("Avernic free windows");
  }
  densityMult *= potions.adrenDensity;

  let cdrMult = 1;
  if (has("sacred-fervor")) {
    cdrMult = fervorThroughput();
    flags.push("Sacred Fervor 30% CDR");
  }

  const basicsPerSec = style.basicsPerSecond * cdrMult * densityMult;
  let hitsPerSec = style.hitsPerSecond * cdrMult * densityMult;
  const avgPct = 1.5;

  if (has("unholy-critual")) {
    critChance += 0.15;
    const baseCrit = 0.15 + critChance;
    if (baseCrit > 0.5) {
      critDmg += baseCrit - 0.5;
      critChance = 0.5 - 0.15;
    }
    flags.push("Unholy Critual");
  }
  const totalCritChance = Math.min(0.5, 0.15 + critChance);
  const critMult = 1 + totalCritChance * (0.45 + critDmg);
  const havocMult = has("havoc-born") ? 1.2 : 1;

  let coreAbility = ad * avgPct * hitsPerSec * critMult * havocMult;
  // Invention proc EV (Aftershock etc.) on ability throughput
  if (inventionProcMult > 1.001) {
    coreAbility *= inventionProcMult;
    flags.push(`Invention procs ×${inventionProcMult.toFixed(3)}`);
  }

  let bigBonedFlat = 0;
  const flatPerHit = has("big-boned") ? floor(maxLp * 0.05) : 0;
  if (flatPerHit > 0) {
    const instancesPerSec = hitsPerSec * (1 + style.multiHitShare * 0.8);
    bigBonedFlat = flatPerHit * instancesPerSec * critMult;
  }

  let cindersOnHit = 0;
  let inferno = 0;
  if (has("abyssal-cinders")) {
    cindersOnHit = ad * 0.15 * hitsPerSec * critMult * havocMult;
    // Inferno of Zamorak: 5% on-hit; Perfidious ×5 → 25%; Unholy Critual also fires on crit
    let infChance = 0.05;
    if (has("perfidious")) infChance *= 5;
    if (has("unholy-critual")) {
      // On crit: guaranteed Inferno — adds critChance * (1 - cindersChance) in expectation
      infChance = 1 - (1 - infChance) * (1 - totalCritChance);
      flags.push("Unholy Critual → Inferno on crit");
    }
    // Full zammy multi-hit: do NOT hard-cap at 0.6 — allow high Inferno density
    const infCap = has("perfidious") && has("unholy-critual") ? 0.92 : 0.65;
    const infCritDmg = has("unholy-critual") ? 1.25 : 1; // Inferno gains 50% crit dmg (wiki) → EV ~1.25
    inferno =
      ad *
      1.5 *
      hitsPerSec *
      Math.min(infChance, infCap) *
      critMult *
      havocMult *
      infCritDmg;
    flags.push(
      `Inferno p=${Math.min(infChance, infCap).toFixed(2)}/hit @ ${hitsPerSec.toFixed(2)} hps`,
    );
    flags.push("Abyssal Cinders");
  }

  let lightOfSaradomin = 0;
  if (has("striking-light") || has("lord-of-light")) {
    let lightCd = has("lord-of-light") ? 14.4 : 9;
    if (has("perfidious")) lightCd = 4.8;
    if (has("sacred-fervor")) lightCd *= 0.7;
    const lightsPerSec = 1 / lightCd;
    const prayerScale = 1 + 0.02 * prayer;
    const lightAdPct = 0.5;
    const lightArmour = armour * 2.5;
    let perLight = (ad * lightAdPct + lightArmour) * prayerScale * critMult * havocMult;
    if (has("lord-of-light")) {
      perLight *= input.multiContentWeight > 0.3 ? 4.2 : 2.5;
      flags.push("Lord of Light multi-scatter");
    } else {
      flags.push("Striking Light");
    }
    if (has("striking-light")) {
      coreAbility += ad * 0.4 * 1.2 * basicsPerSec * critMult * havocMult * 0.5;
    }
    lightOfSaradomin = perLight * lightsPerSec;
    if (flatPerHit > 0) {
      const lights = has("lord-of-light")
        ? lightsPerSec * (input.multiContentWeight > 0.3 ? 4 : 2.5)
        : lightsPerSec;
      bigBonedFlat += flatPerHit * lights * critMult;
    }
  }

  let splashBonus = 0;
  if (has("splash-zone")) {
    const multiW = input.multiContentWeight;
    const tileBonus = 0.05 * input.targetTiles;
    const mult = multiW * (1.3 + tileBonus * 0.5) + (1 - multiW) * 1.0;
    splashBonus = (coreAbility + cindersOnHit) * (mult - 1);
    flags.push("Splash Zone");
  }

  let tearingGrasps = 0;
  let barkscalesGrasp = 0;
  if (has("tearing-thorns")) {
    const graspsPerSec = (hitsPerSec * style.dotDensity * 1.5) / 5;
    tearingGrasps = (maxLp * 0.25 + ad * 1.0) * graspsPerSec * havocMult;
    // Poison portion of Grasp (80–120% AD)
    barkscalesGrasp += ad * 1.0 * graspsPerSec * 0.5 * havocMult;
    if (flatPerHit > 0) bigBonedFlat += flatPerHit * graspsPerSec;
    flags.push("Tearing Thorns DoTs + Grasp poison");
  }
  if (has("barkscales")) {
    // Retaliate Grasp every ~5 reductions — model as low passive rate in active combat
    const graspRate = 0.08; // per second EV while tanking/hitting
    barkscalesGrasp += ad * 1.0 * graspRate * havocMult;
    flags.push("Barkscales Grasp poison EV");
  }

  // ── Poison dimension (full stack: Cinderbane / Blowpipe / Laniakea / Kwuarm / Envenomed) ──
  const kit = input.poisonKit ? POISON_KIT_BY_ID[input.poisonKit] : undefined;
  const wpTier: WeaponPoisonTier =
    input.weaponPoisonTier ??
    kit?.weaponPoisonTier ??
    (potions.poisonTier as WeaponPoisonTier);
  const poisonGear: PoisonGearFlags = {
    cinderbaneGloves: kit?.gear.cinderbaneGloves ?? false,
    laniakeaSpear: kit?.gear.laniakeaSpear ?? false,
    upgradedBoneBlowpipe: kit?.gear.upgradedBoneBlowpipe ?? false,
    kwuarmStacks: kit?.gear.kwuarmStacks ?? 0,
    bloodReaver:
      kit?.gear.bloodReaver ||
      input.familiar === "blood-reaver" ||
      false,
    targetPoisonImmune: input.targetPoisonImmune ?? kit?.gear.targetPoisonImmune ?? false,
    ...input.poisonGear,
  };
  // Regions for poison gear gates (prefer explicit, else loadout/invention regions)
  const poisonRegions = new Set<RegionTag>(invRegions);
  if (input.baneRegions) {
    for (const r of input.baneRegions) poisonRegions.add(r);
  }
  if (input.summoningPlayer?.regions) {
    for (const r of input.summoningPlayer.regions) poisonRegions.add(r);
  }

  const poisonResult = modelPoisonStack({
    abilityDamage: ad,
    hitsPerSecond: hitsPerSec,
    style: input.style,
    weaponPoisonTier: wpTier,
    herbloreLevel: input.herbloreLevel,
    hasEnvenomed: has("envenomed"),
    gear: poisonGear,
    multiHitFactor:
      1 +
      style.multiHitShare * 0.5 +
      (has("splash-zone") ? input.multiContentWeight * 0.3 : 0),
    regions: poisonRegions,
  });

  let poison = poisonResult.dps;
  for (const f of poisonResult.flags) flags.push(f);
  for (const w of poisonResult.warnings) warnings.push(w);

  // Blessing Grasp poison (Tearing Thorns / Barkscales) — separate, then Envenomed scales
  let graspPoison = barkscalesGrasp;
  if (has("envenomed") && graspPoison > 0) {
    const env = 1.5 + 0.02 * input.herbloreLevel;
    graspPoison *= env;
    poison += graspPoison * 0.35; // portion already partly in tearingGrasps body
  } else {
    poison += graspPoison * 0.25;
  }

  // Legacy simple WP if no kit and no cinderbane path — poisonResult already covers WP-only
  if (poison === 0 && potions.poisonTier > 0) {
    const wpnPoison = weaponPoisonBase(
      potions.poisonTier,
      ad,
      hitsPerSec,
      style.dotDensity,
    );
    const envMult = envenomedPoisonMult(input.herbloreLevel, has("envenomed"));
    poison = wpnPoison.dps * envMult;
  }

  // ── Style DoTs / bleeds ──
  const modelDots = input.modelDots !== false;
  let bleedDot = 0;
  if (modelDots) {
    const bd = styleBleedDotDps(
      input.style,
      ad,
      hitsPerSec,
      style.dotDensity,
      has("tearing-thorns"),
      havocMult,
    );
    bleedDot = bd.dps;
    for (const s of bd.sources) flags.push(s);
  }

  // ── Specials ──
  const modelSpecs = input.modelSpecials !== false;
  let specialAttack = 0;
  if (modelSpecs) {
    const sp = specialAttackDps(
      input.style,
      ad,
      densityMult,
      potions.adrenPotsPerMin ?? 0,
      has("avernic-rampage"),
      {
        hasJunkie: has("adrenaline-junkie"),
        // on-attack rate: mix of ability GCDs + multi-hit pressure (full zammy hits hard)
        attacksPerSec: hitsPerSec * 0.5 + basicsPerSec * 0.4,
        clawDump:
          input.style === "melee" ||
          input.clawSpecDump === true ||
          (has("avernic-rampage") && has("adrenaline-junkie")),
      },
    );
    specialAttack = sp.dps * critMult * havocMult;
    for (const s of sp.sources) flags.push(s);
    if (sp.rampageUptime > 0.05) {
      flags.push(`Rampage uptime ${(sp.rampageUptime * 100).toFixed(0)}%`);
    }
  }

  // ── Conjures (necro) ──
  const modelConj = input.modelConjures !== false;
  let conjure = 0;
  if (modelConj) {
    const cj = conjureDps(
      input.style,
      ad,
      has("genesis-essence"),
      has("power-archive"),
    );
    conjure = cj.dps * critMult * havocMult;
    for (const s of cj.sources) flags.push(s);
  }

  let other = 0;
  if (has("steadfast-will")) {
    other += armour * 4 * 0.15;
    flags.push("Steadfast Will bash/reflect EV");
  }
  if (has("demons-mark")) {
    other += coreAbility * 0.05;
    flags.push("Demon's Mark accuracy");
  }
  // envenomed residual was previously in other — moved to poison
  if (has("power-archive") && conjure === 0) {
    other += coreAbility * 0.1;
    flags.push("Power Archive perks");
  } else if (has("power-archive")) {
    other += coreAbility * 0.06;
    flags.push("Power Archive perks (conjure separate)");
  }
  if (has("chaotic-insight")) {
    other += coreAbility * 0.08;
    flags.push("Chaotic Insight sets");
  }
  if (has("eternal-sustenance")) {
    other += coreAbility * 0.03;
    flags.push("Eternal Sustenance uptime");
  }

  // Low-tier weapon penalty if no Genesis and weak regions
  if (gear.weaponTier < 90 && !has("genesis-essence")) {
    warnings.push(`Weapon only T${gear.weaponTier} — region locks may be limiting BiS`);
  }

  // ── Bane / affinity (OOP loadout snapshot OR explicit / auto-pick) ──
  const targetTags: TargetTag[] = input.targetTags?.length
    ? [...input.targetTags]
    : gear.bane?.targetTags?.length
      ? [...gear.bane.targetTags]
      : ["general"];

  let banePieces: BanePiece[] = input.baneGear !== undefined ? [...input.baneGear] : [];
  let baneFromGear = false;

  // Prefer bane resolved on GearSnapshot (from resolveLoadoutOOP)
  if (input.baneGear === undefined && gear.bane && gear.bane.mult > 1) {
    baneFromGear = true;
  }

  // Only auto-pick when no gear snapshot bane and no explicit baneGear.
  // Never invent affinity mults for weapons not actually equipped.
  if (
    input.baneGear === undefined &&
    !baneFromGear &&
    !input.gear &&
    !(targetTags.length === 1 && targetTags[0] === "general")
  ) {
    const regions = new Set<RegionTag>(
      input.baneRegions ??
        (invRegions.length > 3
          ? invRegions
          : [
              "free",
              "misthalin",
              "havenhythe",
              "karamja",
              "asgarnia",
              "desert",
              "forinthry",
              "anachronia",
              "fremennik",
              "morytania",
              "kandarin",
              "tirannwn",
            ]),
    );
    const levels: Partial<Record<SkillId, number>> = {
      attack: 99,
      strength: 99,
      defence: 99,
      magic: 99,
      ranged: 99,
      necromancy: 99,
      smithing: 99,
      crafting: 99,
      hunter: 99,
      runecrafting: 99,
    };
    const snap: PlayerSnapshot = {
      levels,
      regions,
      quests: new Set(["ritual-of-the-mahjarrat"]),
      flags: new Set([
        "unlocked:tune-bane",
        "unlocked:dinarrows",
        "unlocked:jas-anima",
        "killed:soulgazer",
        "unlocked:hexhunter-imbue",
        "unlocked:bgh-t3",
        "unlocked:inquisitor-assemble",
        "unlocked:inq-imbue",
        "unlocked:glacor-front",
        "unlocked:leng-core",
      ]),
      relicTier: 6,
    };
    banePieces = pickBaneLoadout(input.style, targetTags, snap);
  }

  let baneDmg: { mult: number; applied: { name: string; tag: string; mult: number }[] };
  let baneAcc: number;

  if (baneFromGear && gear.bane) {
    baneDmg = { mult: gear.bane.mult, applied: gear.bane.applied };
    baneAcc = gear.bane.accuracyFactor;
    banePieces = gear.bane.pieceNames.map((name, i) => ({
      id: gear.bane!.pieceIds[i] ?? name,
      name,
      kind: "ammo-dragonbane" as const,
      role: "ammo" as const,
      style: "ranged" as const,
      tier: 80,
      vsTags: {} as BanePiece["vsTags"],
      regions: [] as BanePiece["regions"],
      skillReqs: [] as BanePiece["skillReqs"],
      quests: [] as string[],
      flags: [] as string[],
      notes: "from-oop-loadout",
    }));
  } else {
    baneDmg = baneDamageMult(banePieces, targetTags);
    baneAcc = baneAccuracyDpsFactor(banePieces, targetTags);
  }

  const baneTotalMult = baneDmg.mult * baneAcc;
  // Snapshot pre-bane for dimension attribution
  const preBaneCore = coreAbility;
  if (baneTotalMult > 1.001) {
    coreAbility *= baneTotalMult;
    cindersOnHit *= baneTotalMult;
    inferno *= baneTotalMult;
    lightOfSaradomin *= baneTotalMult;
    splashBonus *= baneTotalMult;
    tearingGrasps *= baneTotalMult;
    poison *= baneTotalMult;
    bleedDot *= baneTotalMult;
    specialAttack *= baneTotalMult;
    conjure *= baneTotalMult;
    barkscalesGrasp *= baneTotalMult;
    other *= baneTotalMult;
    bigBonedFlat *= 1 + (baneAcc - 1);
    for (const a of baneDmg.applied) {
      flags.push(`Bane: ${a.name} ×${a.mult.toFixed(3)} vs ${a.tag}`);
    }
    if (baneAcc > 1.001) flags.push(`Bane accuracy EV ×${baneAcc.toFixed(3)}`);
    if (baneFromGear) flags.push("Bane from OOP loadout");
  } else if (targetTags.some((t) => t !== "general") && !baneFromGear && banePieces.length === 0) {
    warnings.push(
      `Target tags [${targetTags.join(",")}] but no accessible bane gear for ${input.style}`,
    );
  }

  const fightSeconds = input.fightSeconds ?? 60;
  const ult = ultDutyMult(input.style, has("higher-power"), fightSeconds);
  // Ult applies to ability package, not poison/familiar
  const ultMult = ult.mult;
  for (const s of ult.sources) flags.push(s);

  const abilityPackagePreUlt =
    coreAbility +
    cindersOnHit +
    inferno +
    lightOfSaradomin +
    splashBonus +
    tearingGrasps +
    specialAttack +
    conjure +
    other;
  const abilityAfterUlt = abilityPackagePreUlt * ultMult;
  // Ult uplift attributed later
  const ultUplift = abilityAfterUlt - abilityPackagePreUlt;

  // Scale core-like pieces by ult for final sum
  coreAbility *= ultMult;
  cindersOnHit *= ultMult;
  inferno *= ultMult;
  lightOfSaradomin *= ultMult;
  splashBonus *= ultMult;
  tearingGrasps *= ultMult;
  specialAttack *= ultMult;
  conjure *= ultMult;
  other *= ultMult;
  // flat, poison, bleed: partial ult interaction
  bigBonedFlat *= 1 + (ultMult - 1) * 0.5;
  bleedDot *= 1 + (ultMult - 1) * 0.7;
  // poison ticks don't crit/ult hard
  // barkscales already in poison path partially

  const breakdown: DamageBreakdown = {
    coreAbility,
    bigBonedFlat,
    cindersOnHit,
    inferno,
    lightOfSaradomin,
    splashBonus,
    tearingGrasps,
    poison,
    bleedDot,
    specialAttack,
    conjure,
    barkscalesGrasp,
    other,
  };


  // ── Relics + Summoning familiars ──────────────────────────────────
  // Structural AD/crit/prayer already applied early; end mult = execute/perk only
  const relicStack = relicEarly;
  let playerDpsMult = rc?.dpsMult ?? relicStack.mult;
  // If we already applied structural AD/crit, don't also multiply playerDpsMult by structural
  if (rc && (rc.abilityDamagePct > 0 || rc.critChanceAdd > 0)) {
    playerDpsMult = rc.dpsMult; // execute/perk only
  }
  for (const f of relicStack.flags) flags.push(f);
  if (rc?.hasIcyenic) flags.push("Icyenic Faith: Tome active (100% pray + SS)");
  if (rc?.hasInfernal) flags.push("Infernal Fire: Death Mark execute");
  if (rc?.hasNaragi) flags.push("Naragi Edict: 255 duty windows");

  const famId = input.familiar ?? "none";
  const famDef = FAMILIAR_BY_ID[famId] ?? FAMILIAR_BY_ID.none!;
  const sumLvl = input.summoningLevel ?? 99;

  // Build / use player snapshot so Summoning requirements are enforced
  const sumPlayer: PlayerSnapshot =
    input.summoningPlayer ??
    ({
      levels: {
        summoning: sumLvl,
        attack: 99,
        strength: 99,
        defence: 99,
        magic: 99,
        ranged: 99,
        necromancy: 99,
      },
      regions: new Set<RegionTag>(
        input.baneRegions ?? invRegions,
      ),
      quests: new Set<string>(),
      flags: new Set<string>(["league:contract-claws-auto"]),
      relicTier: 6,
    } satisfies PlayerSnapshot);

  // Ensure summoning level on snapshot matches
  if ((sumPlayer.levels.summoning ?? 1) < sumLvl) {
    sumPlayer.levels = { ...sumPlayer.levels, summoning: sumLvl };
  }

  const famResult = modelFamiliarDps(famDef, {
    summoningLevel: sumLvl,
    devout: relicStack.devout,
    divineDruid: relicStack.divineDruid,
    player: sumPlayer,
    accessMode: input.familiarAccess ?? "soft",
  });
  // Nihil-style player mult stacks with relics — only if familiar unlocked
  if (!famResult.locked) {
    playerDpsMult *= famResult.playerDamageMult;
    if (famResult.playerAccuracyMult > 1) {
      playerDpsMult *= 1 + (famResult.playerAccuracyMult - 1) * 0.4;
    }
  }
  if (famResult.locked) {
    warnings.push(
      `Familiar LOCKED (${famDef.name}): ${famResult.missing.join(", ") || famDef.describeReq?.() || "requirements"}`,
    );
    flags.push(`Familiar locked: ${famDef.name}`);
  } else if (famResult.familiarDps > 0) {
    flags.push(
      `Familiar: ${famResult.name} ${Math.round(famResult.familiarDps)} dps` +
        (relicStack.devout ? ` (Devout ×${famResult.devoutMult.toFixed(2)})` : ""),
    );
  }

  const playerDpsRaw =
    coreAbility +
    bigBonedFlat +
    cindersOnHit +
    inferno +
    lightOfSaradomin +
    splashBonus +
    tearingGrasps +
    poison +
    bleedDot +
    specialAttack +
    conjure +
    barkscalesGrasp * 0.5 + // remainder of grasp not double-counted heavily with poison
    other;

  // Relic + nihil player mult; familiar is ADDITIVE (not Big-Boned, not player ability)
  const dpsPreRelic = playerDpsRaw;
  const dps = playerDpsRaw * playerDpsMult;
  const relicUplift = dps - dpsPreRelic;
  const totalDps = dps + famResult.familiarDps;

  // Bane uplift for dimension chart (approx from pre-bane core)
  const baneUplift =
    baneTotalMult > 1.001
      ? (preBaneCore * baneTotalMult - preBaneCore) * playerDpsMult * ultMult
      : 0;

  // Potion AD uplift isolated: compare as fraction of AD-scaled pieces
  const potionAdShare = potions.adMult > 1 ? 1 - 1 / potions.adMult : 0;
  const potionBoostDps =
    (coreAbility + cindersOnHit + inferno + specialAttack + conjure) *
    potionAdShare *
    playerDpsMult;

  const dimRaw: Omit<DimensionSlice, "share">[] = [
    {
      id: "coreAbility",
      label: "Core abilities",
      dps: coreAbility * playerDpsMult,
      notes: [],
      sources: ["ability hits"],
    },
    {
      id: "onHitBonus",
      label: "On-hit (Cinders)",
      dps: cindersOnHit * playerDpsMult,
      notes: [],
      sources: has("abyssal-cinders") ? ["Abyssal Cinders +15%"] : [],
    },
    {
      id: "procBurst",
      label: "Proc bursts",
      dps: (inferno + lightOfSaradomin + tearingGrasps * 0.4) * playerDpsMult,
      notes: [],
      sources: ["Inferno", "Light", "Grasp burst"],
    },
    {
      id: "flatPerHit",
      label: "Flat per hit (Big Boned)",
      dps: bigBonedFlat * playerDpsMult,
      notes: [],
      sources: has("big-boned") ? ["5% max LP"] : [],
    },
    {
      id: "poison",
      label: "Poison (full stack)",
      dps: (poison + barkscalesGrasp * 0.5) * playerDpsMult,
      notes: poisonResult.flags.slice(0, 4),
      sources: poisonResult.sources.map((s) => s.label),
    },
    {
      id: "bleedDot",
      label: "Style DoTs",
      dps: bleedDot * playerDpsMult,
      notes: [],
      sources: [`${input.style} bleeds/DoTs`],
    },
    {
      id: "potionBoost",
      label: "Potion AD uplift",
      dps: potionBoostDps,
      notes: [potions.name],
      sources: [potions.name],
    },
    {
      id: "familiar",
      label: "Familiar",
      dps: famResult.familiarDps,
      notes: famResult.locked ? ["LOCKED"] : [],
      sources: [famResult.name],
    },
    {
      id: "conjure",
      label: "Conjures",
      dps: conjure * playerDpsMult,
      notes: [],
      sources: input.style === "necromancy" ? ["conjures"] : [],
    },
    {
      id: "specialAttack",
      label: "Weapon specials",
      dps: specialAttack * playerDpsMult,
      notes: [],
      sources: ["specs", "avernic", "adren pots"],
    },
    {
      id: "prayer",
      label: "Prayer / Light scale",
      dps: lightOfSaradomin * playerDpsMult * 0.15, // prayer portion already in light; small attribute
      notes: [`prayer bonus ${prayer}`],
      sources: ["prayer scaling on Light"],
    },
    {
      id: "baneAffinity",
      label: "Bane / affinity",
      dps: baneUplift,
      notes: baneDmg.applied.map((a) => a.name),
      sources: baneDmg.applied.map((a) => `${a.name} vs ${a.tag}`),
    },
    {
      id: "relicPlayer",
      label: "Relic player mult",
      dps: relicUplift,
      notes: relicStack.flags,
      sources: [String(input.relic ?? "none"), String(input.relicSecondary ?? "")],
    },
    {
      id: "multiSplash",
      label: "Splash Zone",
      dps: splashBonus * playerDpsMult,
      notes: [],
      sources: has("splash-zone") ? ["Splash Zone"] : [],
    },
    {
      id: "ultDuty",
      label: "Ultimate windows",
      dps: ultUplift * playerDpsMult,
      notes: ult.sources,
      sources: ult.sources,
    },
    {
      id: "armourBonus",
      label: "Armour style dmg / sets",
      // Attribute fraction of ability package to armour mult uplift
      dps:
        playerDpsMult *
        (coreAbility + cindersOnHit + inferno + specialAttack + conjure) *
        (1 - 1 / Math.max(1.001, styleDmgMult * setEffMult)),
      notes: [
        `style ×${styleDmgMult.toFixed(3)}`,
        `set ×${setEffMult.toFixed(3)}`,
        armourRes.profile.name,
      ],
      sources: [armourRes.profile.name, ...armourRes.profile.setEffectNotes],
    },
  ];
  const dimensions = assembleShares(dimRaw);
  breakdown.dimensions = dimensions;

  const baseHits = style.hitsPerSecond;
  const baselineDps = gear.baselineAd * avgPct * baseHits * (1 + 0.15 * 0.45);

  if (input.archetype === "power-dps" && has("teragards-aegis")) {
    warnings.push("Aegis is weaker without shield/defender — consider shield-tank archetype");
  }
  if (has("higher-power")) {
    warnings.push("Higher Power removes major style ultimates — factor rotation loss carefully");
  }
  if (input.picks.length < 6) {
    warnings.push("Incomplete path (need 6 picks for full God 2)");
  }

  return {
    active,
    uniquePathCount: uniq,
    god4,
    god8,
    offhand,
    gear: {
      ...gear,
      armour,
      prayer,
      armourProfileId: armourRes.profile.id,
      unlockedRegions:
        gear.unlockedRegions ??
        (invRegions.filter((r) => r !== "free" && r !== "any") as RegionId[]),
    },
    stats: {
      baselineAd: gear.baselineAd,
      effectiveAd: ad,
      armour,
      maxLp,
      flatPerHit,
      critChanceBonus: critChance,
      critDamageBonus: critDmg,
      prayerBonus: prayer,
      hitsPerSecond: hitsPerSec,
      cdrMultiplier: cdrMult,
    },
    dps,
    totalDps,
    vsBaseline: dps / Math.max(1, baselineDps),
    breakdown,
    flags,
    warnings,
    potions,
    dimensions,
    armourBonuses: {
      profile: armourRes.profile.id,
      profileName: armourRes.profile.name,
      totalArmour: armour,
      styleDamageMult: styleDmgMult,
      setEffectMult: setEffMult,
      abilityMult: styleDmgMult * setEffMult,
      aegisAd,
      armourBonusAd,
      prayerBonus: prayer,
    },
    invention: {
      tier: invRes.tier,
      locked: invRes.locked,
      perkMult: invRes.perkMult,
      procFactor: invRes.procDpsFactor,
    },
    poisonStack: {
      dps: poisonResult.dps,
      effectiveTier: poisonResult.effectiveTier,
      applyChance: poisonResult.applyChance,
      sources: poisonResult.sources,
      gearStatus: poisonResult.gearStatus,
    },
    bane: {
      mult: baneDmg.mult,
      accuracyFactor: baneAcc,
      pieces: banePieces.map((b) => b.name),
      applied: baneDmg.applied,
      targetTags,
    },
    familiar: {
      id: famResult.familiarId,
      name: famResult.name,
      dps: famResult.familiarDps,
      devoutMult: famResult.devoutMult,
      scrollUptime: famResult.scrollUptime,
      playerDamageMult: famResult.playerDamageMult,
    },
    relics: {
      primary: input.relic ?? "none",
      secondary: input.relicSecondary ?? null,
      playerMult: relicStack.mult,
      devout: relicStack.devout,
      divineDruid: relicStack.divineDruid,
    },
  };
}

export function compareBuilds(
  builds: { name: string; input: ModelInput }[],
): { name: string; result: ModelResult }[] {
  return builds
    .map((b) => ({ name: b.name, result: modelCombat(b.input) }))
    .sort((a, b) => b.result.dps - a.result.dps);
}

export function formatDps(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toFixed(0);
}

export { REGION_PACKAGES, type RegionPackage };
