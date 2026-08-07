/**
 * Necromancy gear feasibility under Equilibrium region locks.
 *
 * Wiki (Equilibrium League):
 * - "Necromancy will remain fully accessible during Leagues"
 * - Kili tasks materials still needed; City of Um / Rasial are Misthalin (FREE)
 * - Omni guard + Soulbound lantern + First Necromancer robes = Rasial (Misthalin)
 * - Amascut / Tumeken's resplendence / Devourer's Guard = Desert elective
 * - RoD / Souls / EOF = Asgarnia elective (not necro weapons, but DPS jewellery)
 *
 * Conclusion: TRUE necro BiS weapons+lantern do NOT require electives.
 * Desert is an upgrade path (Amascut). Asgarnia is jewellery/Invention.
 */

import type { RegionTag } from "./requirements";
import { Player } from "./player";
import {
  EQUIPMENT_CATALOG,
  equipmentAccessible,
  resolveLoadoutOOP,
  type Equipment,
} from "./equipment";

export interface NecroGearStage {
  id: string;
  name: string;
  necroLevel: number;
  electives: RegionTag[];
  flags: string[];
  /** Approximate model AD from resolved dual loadout */
  weaponAd: number;
  armour: number;
  pieces: string[];
  notes: string[];
  canObtainWeapons: boolean;
  missingForWeapons: string[];
}

const NECRO_WEAPON_IDS = [
  "death-guard-70",
  "death-guard-90",
  "omni-guard",
  "skull-lantern-90",
  "soulbound-lantern",
];

export function necroWeaponFeasibility(electives: RegionTag[] = []): {
  freePathWeapons: { id: string; name: string; tier: number; regions: string[]; ok: boolean }[];
  desertUpgrades: { id: string; name: string; tier: number; ok: boolean }[];
  summary: string[];
} {
  const p = new Player({ electives, relicTier: 6 });
  p.setLevel("necromancy", 99);
  p.setLevel("defence", 99);
  p.setFlag("killed:rasial");
  p.setFlag("killed:amascut");
  const snap = p.snapshot();

  const freePathWeapons = NECRO_WEAPON_IDS.map((id) => {
    const e = EQUIPMENT_CATALOG.find((x) => x.id === id)!;
    return {
      id,
      name: e.name,
      tier: e.tier,
      regions: e.regions.length ? e.regions : ["free/misthalin"],
      ok: e.accessibleIgnoringBossFlags(snap) || e.accessible(snap),
    };
  });

  const desertUpgrades = EQUIPMENT_CATALOG.filter(
    (e) =>
      e.regions.includes("desert") &&
      (e.style === "necromancy" || /tumeken|devourer|amascut/i.test(e.name)) &&
      (e.slot === "weapon" || e.slot === "offhand" || e.slot === "body" || e.slot === "helmet"),
  ).map((e) => ({
    id: e.id,
    name: e.name,
    tier: e.tier,
    ok: e.accessibleIgnoringBossFlags(snap),
  }));

  const summary = [
    "Core T95 weapons (Omni + Soulbound) = Rasial in Misthalin — FREE region, no elective required.",
    "Deathwarden/Deathdealer T70–T90 ladder = City of Um / Kili path — FREE (materials grind remains).",
    "First Necromancer robes (T95 power) = Rasial — FREE.",
    "Desert elective unlocks Amascut line (Tumeken's resplendence, Devourer's Guard) — optional upgrade.",
    "Asgarnia does NOT gate necro weapons; it gates RoD/Souls/EOF/Invention.",
    electives.includes("desert")
      ? "Current electives INCLUDE Desert → Amascut line available."
      : "Current electives exclude Desert → Amascut line locked; Rasial kit still complete.",
  ];

  return { freePathWeapons, desertUpgrades, summary };
}

/** Gear stages from bronze necro → Rasial → optional Amascut. */
export function buildNecroStages(): NecroGearStage[] {
  const stages: {
    id: string;
    name: string;
    necroLevel: number;
    electives: RegionTag[];
    flags: string[];
    notes: string[];
  }[] = [
    {
      id: "t70-free",
      name: "T70 free (early Kili)",
      necroLevel: 70,
      electives: [],
      flags: [],
      notes: ["Death Guard T70 + Deathwarden — fully free path"],
    },
    {
      id: "t90-free",
      name: "T90 free (Kili complete)",
      necroLevel: 90,
      electives: [],
      flags: [],
      notes: ["Death Guard T90 + Skull lantern + Deathdealer/Warden T90 — free"],
    },
    {
      id: "rasial-free",
      name: "Rasial BiS (free regions only)",
      necroLevel: 95,
      electives: [],
      flags: ["killed:rasial"],
      notes: ["Omni + Soulbound — NO elective required", "This is real endgame necro weapons"],
    },
    {
      id: "rasial-asg",
      name: "Rasial + Asgarnia jewellery",
      necroLevel: 95,
      electives: ["asgarnia"],
      flags: ["killed:rasial", "killed:vorago"],
      notes: ["Same weapons + RoD/Souls/EOF", "Invention hub"],
    },
    {
      id: "rasial-desert",
      name: "Rasial + Desert (Amascut)",
      necroLevel: 95,
      electives: ["desert"],
      flags: ["killed:rasial", "killed:amascut"],
      notes: ["Amascut armour/weapons if better model scores", "Optional vs free Rasial kit"],
    },
    {
      id: "full-combat",
      name: "Asgarnia+Desert+Forinthry full",
      necroLevel: 99,
      electives: ["asgarnia", "desert", "forinthry"],
      flags: ["killed:rasial", "killed:amascut", "killed:vorago"],
      notes: ["Max jewellery + Achtó hybrids + Rasial weapons"],
    },
    {
      id: "ancient-path",
      name: "Asgarnia+Kandarin+Forinthry (Ancient Inv)",
      necroLevel: 99,
      electives: ["asgarnia", "kandarin", "forinthry"],
      flags: ["killed:rasial", "killed:vorago"],
      notes: ["No Amascut; Ancient Invention available", "Weapons still free Rasial"],
    },
  ];

  return stages.map((s) => {
    const p = new Player({ electives: s.electives, relicTier: 6 });
    p.setLevel("necromancy", s.necroLevel);
    p.setLevel("defence", Math.min(99, s.necroLevel));
    p.setLevel("attack", 90);
    p.setLevel("magic", 90);
    p.setLevel("ranged", 90);
    p.setLevel("smithing", 90);
    p.setLevel("crafting", 90);
    p.setLevel("prayer", 95);
    for (const f of s.flags) p.setFlag(f);
    const snap = p.snapshot();

    const load = resolveLoadoutOOP(snap, "necromancy", "dual", { ignoreBossFlags: false });
    const omni = EQUIPMENT_CATALOG.find((e) => e.id === "omni-guard")!;
    const soul = EQUIPMENT_CATALOG.find((e) => e.id === "soulbound-lantern")!;
    const canOmni = omni.accessible(snap) || (s.necroLevel >= 95 && s.flags.includes("killed:rasial"));
    const canSoul = soul.accessible(snap) || (s.necroLevel >= 95 && s.flags.includes("killed:rasial"));

    // soft: if flags set and free regions, count as obtainable
    const canObtainWeapons =
      s.necroLevel >= 95
        ? s.flags.includes("killed:rasial") // free region always
        : s.necroLevel >= 90;

    const missing: string[] = [];
    if (s.necroLevel < 95) missing.push(`need necro ${s.necroLevel}<95 for Omni`);
    if (!s.flags.includes("killed:rasial") && s.necroLevel >= 95) missing.push("need Rasial kill");

    return {
      id: s.id,
      name: s.name,
      necroLevel: s.necroLevel,
      electives: s.electives,
      flags: s.flags,
      weaponAd: load.totalWeaponAd,
      armour: load.totalArmour,
      pieces: load.pieces.map((x) => x.name),
      notes: s.notes,
      canObtainWeapons,
      missingForWeapons: missing,
    };
  });
}
