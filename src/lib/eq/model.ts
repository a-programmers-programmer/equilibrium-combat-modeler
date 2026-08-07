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

export interface GearSnapshot {
  armour: number;
  baselineAd: number;
  baseLp: number;
  prayer: number;
  /** Extra AD when Genesis is active (T120 weapon treatment) */
  genesisAdBonus: number;
  weaponTier: number;
  source: string;
  pieces?: { name: string; slot: string }[];
  notes?: string[];
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
}

export interface DamageBreakdown {
  coreAbility: number;
  bigBonedFlat: number;
  cindersOnHit: number;
  inferno: number;
  lightOfSaradomin: number;
  splashBonus: number;
  tearingGrasps: number;
  other: number;
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
  vsBaseline: number;
  breakdown: DamageBreakdown;
  flags: string[];
  warnings: string[];
  /** Bane/affinity application */
  bane?: {
    mult: number;
    accuracyFactor: number;
    pieces: string[];
    applied: { name: string; tag: string; mult: number }[];
    targetTags: TargetTag[];
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

function modeForArchetype(a: BuildArchetype): OffhandMode {
  if (a === "shield-tank") return "shield";
  if (a === "defender") return "defender";
  return "dual";
}

function offhandFromLoadout(loadout: ResolvedLoadout): Offhand {
  if (loadout.pieces.some((p) => p.kind === "shield")) return "shield";
  if (loadout.pieces.some((p) => p.kind === "defender")) return "defender";
  return "none";
}

export function loadoutToSnapshot(loadout: ResolvedLoadout): GearSnapshot {
  const genesisAdBonus = Math.round(loadout.totalWeaponAd * 0.22 + (120 - loadout.weaponTier) * 8);
  return {
    armour: loadout.totalArmour,
    baselineAd: loadout.totalWeaponAd,
    baseLp: loadout.totalLp,
    prayer: loadout.totalPrayer + 12,
    genesisAdBonus: Math.max(400, genesisAdBonus),
    weaponTier: loadout.weaponTier,
    source: `regions:${loadout.unlocked.join("+")} · ${loadout.mode}`,
    pieces: loadout.pieces.map((p) => ({ name: p.name, slot: p.slot })),
    notes: loadout.notes,
  };
}

function playerSnapFromRegions(
  unlocked: readonly RegionId[],
  style: Style,
): PlayerSnapshot {
  // BiS planning assumes combat skills at weapon tier capability
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
  };
  if (style === "necromancy") levels.necromancy = 99;
  const regions = new Set<RegionTag>(["free", "misthalin", "havenhythe", "karamja"]);
  for (const r of unlocked) regions.add(r as RegionTag);
  return {
    levels,
    regions,
    quests: new Set(),
    flags: new Set(), // boss flags ignored via ignoreBossFlags in resolve
    relicTier: 6,
  };
}

export function gearFromRegions(
  electives: readonly RegionId[],
  style: Style,
  archetype: BuildArchetype,
): { snapshot: GearSnapshot; loadout: ResolvedLoadout; offhand: Offhand } {
  const unlocked = unlockedFromElectives(electives);
  const snap = playerSnapFromRegions(unlocked, style);
  const loadout = resolveLoadoutOOP(snap, style, modeForArchetype(archetype), {
    ignoreBossFlags: true,
  });
  return {
    snapshot: loadoutToSnapshot(loadout),
    loadout,
    offhand: offhandFromLoadout(loadout),
  };
}

export function gearFromPackage(
  pkg: RegionPackage,
  style: Style,
  archetype: BuildArchetype,
): { snapshot: GearSnapshot; loadout: ResolvedLoadout; offhand: Offhand } {
  const unlocked = unlockedFromPackage(pkg);
  const snap = playerSnapFromRegions(unlocked, style);
  const loadout = resolveLoadoutOOP(snap, style, modeForArchetype(archetype), {
    ignoreBossFlags: true,
  });
  return {
    snapshot: loadoutToSnapshot(loadout),
    loadout,
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

  const gear = input.gear ?? snapshotFromStage(input.stage, input.style, input.archetype);

  let armour = gear.armour;
  let baseLp = gear.baseLp;
  let ad = gear.baselineAd;
  let prayer = gear.prayer;
  let critChance = 0;
  let critDmg = 0;

  if (gear.notes) {
    for (const n of gear.notes) {
      if (n.startsWith("WARNING")) warnings.push(n);
      else flags.push(n);
    }
  }
  flags.push(`Gear: ${gear.source} (T${gear.weaponTier})`);

  if (has("true-equilibrium")) {
    const stacks = Math.max(1, Math.min(3, uniq));
    ad += 75 * stacks;
    armour += 50 * stacks;
    baseLp += 500 * stacks;
    critChance += 0.05 * stacks;
    critDmg += 0.075 * stacks;
    prayer += 5 * stacks;
    flags.push(`True Equilibrium ×${stacks}`);
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
  if (input.powerburst) {
    maxLp = floor(baseLp * 1.15);
    flags.push("Powerburst EV");
  }

  let aegisAd = 0;
  if (has("teragards-aegis")) {
    aegisAd = aegisBonus(armour, offhand);
    ad += aegisAd;
    flags.push(`Aegis +${aegisAd} AD (${offhand})`);
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
    let infChance = 0.05;
    if (has("perfidious")) infChance *= 5;
    if (has("unholy-critual")) infChance += totalCritChance * 0.5;
    inferno = ad * 1.5 * hitsPerSec * Math.min(infChance, 0.6) * critMult * havocMult;
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
  if (has("tearing-thorns")) {
    const graspsPerSec = (hitsPerSec * style.dotDensity * 1.5) / 5;
    tearingGrasps = (maxLp * 0.25 + ad * 1.0) * graspsPerSec * havocMult;
    if (flatPerHit > 0) bigBonedFlat += flatPerHit * graspsPerSec;
    flags.push("Tearing Thorns DoTs");
  }

  let other = 0;
  if (has("steadfast-will")) {
    other += armour * 4 * 0.15;
    flags.push("Steadfast Will (partial)");
  }
  if (has("demons-mark")) {
    other += coreAbility * 0.05;
    flags.push("Demon's Mark accuracy");
  }
  if (has("envenomed")) {
    other += ad * 0.08 * hitsPerSec * (1.5 + 0.02 * input.herbloreLevel) * style.dotDensity;
    flags.push("Envenomed poison");
  }
  if (has("power-archive")) {
    other += coreAbility * 0.1;
    flags.push("Power Archive perks");
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

  // ── Bane / affinity (dragonbane, hexhunter, terrasaur, inquisitor, Leng) ──
  const targetTags: TargetTag[] = input.targetTags?.length
    ? [...input.targetTags]
    : ["general"];
  let banePieces: BanePiece[] = input.baneGear !== undefined ? [...input.baneGear] : [];
  if (
    input.baneGear === undefined &&
    !(targetTags.length === 1 && targetTags[0] === "general")
  ) {
    const regions = new Set<RegionTag>(
      input.baneRegions ?? [
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
      ],
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

  const baneDmg = baneDamageMult(banePieces, targetTags);
  const baneAcc = baneAccuracyDpsFactor(banePieces, targetTags);
  const baneTotalMult = baneDmg.mult * baneAcc;
  if (baneTotalMult > 1.001) {
    coreAbility *= baneTotalMult;
    cindersOnHit *= baneTotalMult;
    inferno *= baneTotalMult;
    lightOfSaradomin *= baneTotalMult;
    splashBonus *= baneTotalMult;
    tearingGrasps *= baneTotalMult;
    other *= baneTotalMult;
    // flat BB also scales slightly with better hit rate
    bigBonedFlat *= 1 + (baneAcc - 1);
    for (const a of baneDmg.applied) {
      flags.push(`Bane: ${a.name} ×${a.mult.toFixed(3)} vs ${a.tag}`);
    }
    if (baneAcc > 1.001) flags.push(`Bane accuracy EV ×${baneAcc.toFixed(3)}`);
  } else if (targetTags.some((t) => t !== "general") && banePieces.length === 0) {
    warnings.push(
      `Target tags [${targetTags.join(",")}] but no accessible bane gear for ${input.style}`,
    );
  }

  const breakdown: DamageBreakdown = {
    coreAbility,
    bigBonedFlat,
    cindersOnHit,
    inferno,
    lightOfSaradomin,
    splashBonus,
    tearingGrasps,
    other,
  };

  const dps =
    coreAbility +
    bigBonedFlat +
    cindersOnHit +
    inferno +
    lightOfSaradomin +
    splashBonus +
    tearingGrasps +
    other;

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
    gear,
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
    vsBaseline: dps / Math.max(1, baselineDps),
    breakdown,
    flags,
    warnings,
    bane: {
      mult: baneDmg.mult,
      accuracyFactor: baneAcc,
      pieces: banePieces.map((b) => b.name),
      applied: baneDmg.applied,
      targetTags,
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
