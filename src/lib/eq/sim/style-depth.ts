/**
 * Per-style depth model: other styles are more customizable than necro
 * (region-gated weapon trees, 1H/2H/OH modes, hybrid armour).
 */

import type { RegionTag } from "./requirements";
import { Player } from "./player";
import { EQUIPMENT_CATALOG, resolveLoadoutOOP, type Equipment } from "./equipment";
import type { CombatStyle } from "../items";
import type { OffhandMode } from "../items";

export type DepthStyle = "melee" | "magic" | "ranged" | "necromancy";

export interface StyleWeaponTree {
  style: DepthStyle;
  /** Free-region peak weapons (no elective) */
  freePeak: { name: string; tier: number; twoHanded: boolean; note: string }[];
  /** Elective branches that unlock meaningfully better gear */
  electiveBranches: {
    region: RegionTag;
    weapons: string[];
    why: string;
    priority: "S" | "A" | "B" | "C";
  }[];
  /** Recommended elective order for that style */
  recommendedElectives: RegionTag[];
  /** Why this style needs deeper sim than necro */
  customizationNotes: string[];
  modesWorthTesting: OffhandMode[];
}

export const STYLE_TREES: Record<DepthStyle, StyleWeaponTree> = {
  necromancy: {
    style: "necromancy",
    freePeak: [
      { name: "Omni guard", tier: 95, twoHanded: false, note: "Rasial — free Misthalin" },
      { name: "Soulbound lantern", tier: 95, twoHanded: false, note: "Rasial OH" },
    ],
    electiveBranches: [
      {
        region: "desert",
        weapons: ["Devourer's Guard", "Tumeken resplendence set"],
        why: "Amascut sidegrade ~5%",
        priority: "B",
      },
      {
        region: "asgarnia",
        weapons: ["RoD", "Souls/EOF"],
        why: "Jewellery + Invention — not weapons",
        priority: "A",
      },
    ],
    recommendedElectives: ["asgarnia", "desert", "forinthry"],
    customizationNotes: [
      "Least region-dependent style: T95 weapons free.",
      "Main customization is blessings + Aegis archetype, not weapon tree.",
    ],
    modesWorthTesting: ["dual", "shield"],
  },
  melee: {
    style: "melee",
    freePeak: [
      { name: "Ek-ZekKil", tier: 95, twoHanded: true, note: "Zamorak — free Misthalin 2H" },
      { name: "Khopesh of Elidinis + Tumeken", tier: 92, twoHanded: false, note: "Gate of Elidinis — free dual" },
    ],
    electiveBranches: [
      {
        region: "desert",
        weapons: ["Drygore set", "Zaros godsword"],
        why: "T90 dual drygores / ZGS 2H — classic melee BiS branch",
        priority: "S",
      },
      {
        region: "morytania",
        weapons: ["Nox scythe", "Malevolent", "RoTS kites"],
        why: "T90 2H scythe + tank kite for Aegis",
        priority: "A",
      },
      {
        region: "asgarnia",
        weapons: ["Masterwork / TMW", "GWD", "RoD/EOF"],
        why: "TMW armour + jewellery + Invention",
        priority: "S",
      },
      {
        region: "forinthry",
        weapons: ["Chaotics", "Emberkeen"],
        why: "Mid T80 bridge + glacor boots",
        priority: "B",
      },
      {
        region: "anachronia",
        weapons: ["Laceration boots", "Reaver ring"],
        why: "Boot/ring power",
        priority: "B",
      },
    ],
    recommendedElectives: ["asgarnia", "desert", "morytania"],
    customizationNotes: [
      "Highly customizable: free EZK 2H vs free khopeshes vs Desert drygores vs Mory scythe.",
      "Shield (TMW/Malevolent kite) vs dual vs 2H completely changes Aegis %.",
      "Berserk duty cycle dominates short windows — pathing more sensitive than necro.",
    ],
    modesWorthTesting: ["shield", "dual", "2h", "defender"],
  },
  magic: {
    style: "magic",
    freePeak: [
      { name: "Fractured Staff of Armadyl", tier: 95, twoHanded: true, note: "Kerapac — free Misthalin 2H" },
    ],
    electiveBranches: [
      {
        region: "asgarnia",
        weapons: ["Seismic wand + singularity"],
        why: "Best dual magic — Vorago; also cryptbloom free but seismic needs Asg",
        priority: "S",
      },
      {
        region: "morytania",
        weapons: ["Nox staff"],
        why: "T90 2H bridge / Araxxi",
        priority: "B",
      },
      {
        region: "desert",
        weapons: ["Inquisitor staff"],
        why: "T80 2H niche (affinity)",
        priority: "C",
      },
      {
        region: "forinthry",
        weapons: ["Tectonic crafts", "ED magic"],
        why: "Power armour path",
        priority: "A",
      },
    ],
    recommendedElectives: ["asgarnia", "forinthry", "morytania"],
    customizationNotes: [
      "Free FSOA 2H is excellent — dual seismic requires Asgarnia and is a real fork.",
      "Cryptbloom tank set is free Misthalin (Croesus) — Aegis magic is viable locked.",
      "Sunshine vs Higher Power timing differs from Berserk/Living Death.",
    ],
    modesWorthTesting: ["2h", "dual", "shield"],
  },
  ranged: {
    style: "ranged",
    freePeak: [
      { name: "Bow of the Last Guardian", tier: 95, twoHanded: true, note: "Vorkath path — free Misthalin 2H" },
    ],
    electiveBranches: [
      {
        region: "desert",
        weapons: ["Seren godbow"],
        why: "T92 2H alternative",
        priority: "A",
      },
      {
        region: "kandarin",
        weapons: ["Ascension crossbows"],
        why: "T90 dual — Legiones; also Stormguard/Ancient Inv",
        priority: "A",
      },
      {
        region: "tirannwn",
        weapons: ["Blightbound crossbows"],
        why: "T92 dual Solak line",
        priority: "A",
      },
      {
        region: "morytania",
        weapons: ["Nox longbow"],
        why: "T90 2H Araxxi",
        priority: "B",
      },
      {
        region: "forinthry",
        weapons: ["Eldritch crossbow", "Sirenic"],
        why: "T90 2H + power armour",
        priority: "A",
      },
      {
        region: "asgarnia",
        weapons: ["Elite sirenic", "RoD/EOF"],
        why: "Craft upgrade + jewellery",
        priority: "S",
      },
    ],
    recommendedElectives: ["asgarnia", "forinthry", "kandarin"],
    customizationNotes: [
      "Most branched weapon tree: free BOLG 2H vs SGB vs Asc dual vs Blight dual vs Eldritch.",
      "Region package choice changes style identity more than necro.",
      "Death's Swiftness duty cycle + caroming/ECB specs need deeper path×weapon matrix.",
    ],
    modesWorthTesting: ["2h", "dual", "shield"],
  },
};

/** Elective package presets per style for deep sweeps. */
export function stylePackages(style: DepthStyle): {
  id: string;
  electives: RegionTag[];
  label: string;
}[] {
  const base = [
    { id: "free", electives: [] as RegionTag[], label: "Free only" },
    { id: "asg-only", electives: ["asgarnia"] as RegionTag[], label: "Asgarnia only (1 elect)" },
  ];
  switch (style) {
    case "melee":
      return [
        ...base,
        { id: "asg-des", electives: ["asgarnia", "desert"], label: "Asg+Desert" },
        { id: "asg-mory", electives: ["asgarnia", "morytania"], label: "Asg+Mory" },
        { id: "des-mory-asg", electives: ["desert", "morytania", "asgarnia"], label: "Desert+Mory+Asg (melee BiS pkg)" },
        { id: "des-asg-for", electives: ["desert", "asgarnia", "forinthry"], label: "Desert+Asg+Wildy" },
        { id: "mory-asg-for", electives: ["morytania", "asgarnia", "forinthry"], label: "Mory+Asg+Wildy" },
      ];
    case "magic":
      return [
        ...base,
        { id: "asg-for", electives: ["asgarnia", "forinthry"], label: "Asg+Wildy (seismic+tectonic)" },
        { id: "asg-mory-for", electives: ["asgarnia", "morytania", "forinthry"], label: "Asg+Mory+Wildy" },
        { id: "asg-des-for", electives: ["asgarnia", "desert", "forinthry"], label: "Asg+Desert+Wildy" },
        { id: "asg-for-ana", electives: ["asgarnia", "forinthry", "anachronia"], label: "Asg+Wildy+Anach" },
      ];
    case "ranged":
      return [
        ...base,
        { id: "asg-for", electives: ["asgarnia", "forinthry"], label: "Asg+Wildy (sirenic/ECB)" },
        { id: "asg-kan-for", electives: ["asgarnia", "kandarin", "forinthry"], label: "Asg+Kan+Wildy (Asc+Ancient)" },
        { id: "asg-tir-for", electives: ["asgarnia", "tirannwn", "forinthry"], label: "Asg+Tir+Wildy (Blight)" },
        { id: "asg-des-for", electives: ["asgarnia", "desert", "forinthry"], label: "Asg+Desert+Wildy (SGB)" },
        { id: "kan-tir-asg", electives: ["kandarin", "tirannwn", "asgarnia"], label: "Kan+Tir+Asg dual bow path" },
      ];
    case "necromancy":
    default:
      return [
        ...base,
        { id: "asg-des-for", electives: ["asgarnia", "desert", "forinthry"], label: "Asg+Desert+Wildy" },
        { id: "asg-kan-for", electives: ["asgarnia", "kandarin", "forinthry"], label: "Asg+Kan+Wildy (Ancient Inv)" },
        { id: "des-mory-asg", electives: ["desert", "morytania", "asgarnia"], label: "Desert+Mory+Asg" },
      ];
  }
}

export function resolveStyleLoadout(
  style: DepthStyle,
  electives: RegionTag[],
  mode: OffhandMode,
  flags: string[] = [],
) {
  const p = new Player({ electives, relicTier: 6 });
  for (const sk of [
    "attack",
    "strength",
    "defence",
    "magic",
    "ranged",
    "necromancy",
    "smithing",
    "crafting",
    "prayer",
  ] as const) {
    p.setLevel(sk, 99);
  }
  for (const f of flags) p.setFlag(f);
  // default boss flags for electives so hard mode can unlock
  const defaults = [
    "killed:rasial",
    "killed:vorago",
    "killed:kerapac",
    "killed:zamorak",
    "killed:vorkath-path",
    "killed:amascut",
    "killed:rots",
    "killed:rax",
    "killed:raids",
    "killed:zuk",
    "killed:arch-glacor",
    "killed:solak",
    "killed:araxxi",
    "killed:legiones",
  ];
  for (const f of defaults) p.setFlag(f);
  const snap = p.snapshot();
  return resolveLoadoutOOP(snap, style, mode, { ignoreBossFlags: true });
}

export function styleWeaponAccessibility(style: DepthStyle, electives: RegionTag[]) {
  const p = new Player({ electives, relicTier: 6 });
  for (const sk of ["attack", "strength", "defence", "magic", "ranged", "necromancy"] as const) {
    p.setLevel(sk, 99);
  }
  for (const f of [
    "killed:rasial",
    "killed:vorago",
    "killed:kerapac",
    "killed:zamorak",
    "killed:vorkath-path",
    "killed:amascut",
    "killed:araxxi",
    "killed:legiones",
    "killed:solak",
  ])
    p.setFlag(f);
  const snap = p.snapshot();
  return EQUIPMENT_CATALOG.filter(
    (e) =>
      e.slot === "weapon" &&
      (e.style === style || e.style === "all") &&
      e.tier >= 70 &&
      e.accessibleIgnoringBossFlags(snap),
  )
    .sort((a, b) => b.tier - a.tier || b.abilityDamage - a.abilityDamage)
    .map((e) => ({
      name: e.name,
      tier: e.tier,
      twoHanded: e.twoHanded,
      regions: e.regions,
      ad: e.abilityDamage,
    }));
}
