/**
 * Armour bonuses that affect DPS — not just defence.
 *
 * RS3 layers:
 * 1. Armour value          → Teragard's Aegis AD conversion; Steadfast Will
 * 2. Style damage bonus    → power armour melee str / magic dmg / ranged dmg / necro
 * 3. Life points on pieces → Big Boned flat, Aegis sustain (indirect)
 * 4. Prayer bonus          → curses, Light of Saradomin scale
 * 5. Set effects           → Cryptbloom, Sirenic, Tectonic, Masterwork, etc.
 * 6. Hybrid pieces         → Cinderbane gloves (T70 dmg / T85 hybrid armour)
 * 7. Shield/defender       → armour for Aegis %, revenge/reflect EV
 * 8. Chaotic Insight       → set pieces count +2 each (blessing)
 *
 * Tank vs power tradeoff is the big Equilibrium decision with Aegis.
 *
 * Style gates: Cryptbloom is MAGIC only; Deathwarden/TFN are NECRO only.
 * modelCombat always sanitizes profiles so off-style packages cannot equip.
 */

import type { Style } from "../gear";
import type { BuildArchetype } from "../gear";
import type { Offhand } from "../blessings";

export type ArmourProfileId =
  | "power-bis"
  | "power-mid"
  | "tank-aegis"
  | "hybrid-cinder"
  | "cryptbloom-tank"
  | "deathwarden-tank"
  | "tfn-power"
  | "masterwork-tank"
  | "sirenic-power"
  | "tectonic-power"
  | "anima-core"
  | "mixed-aegis-power"
  | "void-elite"
  | "warpriest"
  | "vestments-of-havoc";

export interface ArmourProfile {
  id: ArmourProfileId;
  name: string;
  kind: "power" | "tank" | "hybrid" | "mixed";
  /** Total armour value of full set + jewellery (before offhand) */
  armourBody: number;
  /** Offhand armour contribution (shield/defender/none) */
  offhandArmour: Record<Offhand, number>;
  /** Style damage bonus as AD multiplier from power armour (1.0 = none) */
  styleDamageMult: Record<Style, number>;
  /** Extra LP from armour pieces */
  lpBonus: number;
  /** Prayer bonus from gear */
  prayerBonus: number;
  /** Named set-effect EV as mult on ability package */
  setEffectMult: number;
  setEffectNotes: string[];
  /** Preferred archetype */
  archetype: BuildArchetype;
  notes: string;
  /** Combat style this profile is legal for (undefined = any hybrid) */
  legalStyles?: readonly Style[];
}

/**
 * Curated armour packages. Numbers are league-biased EV, not wiki-perfect.
 * styleDamageMult approximates sum of style damage bonuses → AD.
 */
export const ARMOUR_PROFILES: readonly ArmourProfile[] = [
  {
    id: "power-bis",
    name: "Full power BiS (style)",
    kind: "power",
    armourBody: 1600,
    offhandArmour: { none: 0, defender: 180, shield: 0 },
    styleDamageMult: {
      melee: 1.14,
      magic: 1.13,
      ranged: 1.13,
      necromancy: 1.12,
    },
    lpBonus: 500,
    prayerBonus: 18,
    setEffectMult: 1.04,
    setEffectNotes: ["Power set passive EV"],
    archetype: "power-dps",
    notes: "Max style damage; weak Aegis convert",
  },
  {
    id: "power-mid",
    name: "Mid power armour",
    kind: "power",
    armourBody: 1100,
    offhandArmour: { none: 0, defender: 120, shield: 0 },
    styleDamageMult: {
      melee: 1.08,
      magic: 1.08,
      ranged: 1.08,
      necromancy: 1.07,
    },
    lpBonus: 300,
    prayerBonus: 10,
    setEffectMult: 1.02,
    setEffectNotes: [],
    archetype: "power-dps",
    notes: "Mid-league power",
  },
  {
    id: "tank-aegis",
    name: "Full tank for Teragard's Aegis",
    kind: "tank",
    armourBody: 2400,
    offhandArmour: { none: 0, defender: 220, shield: 450 },
    styleDamageMult: {
      melee: 1.02,
      magic: 1.02,
      ranged: 1.02,
      necromancy: 1.02,
    },
    lpBonus: 1200,
    prayerBonus: 12,
    setEffectMult: 1.03,
    setEffectNotes: ["Tank set utility"],
    archetype: "shield-tank",
    notes: "Maximises Aegis AD from armour %",
  },
  {
    id: "cryptbloom-tank",
    name: "Cryptbloom tank (magic — Croesus/Misthalin)",
    kind: "tank",
    armourBody: 2600,
    offhandArmour: { none: 0, defender: 200, shield: 480 },
    styleDamageMult: {
      magic: 1.05,
      melee: 0.94,
      ranged: 0.94,
      necromancy: 0.93,
    },
    lpBonus: 1400,
    prayerBonus: 14,
    setEffectMult: 1.06,
    setEffectNotes: ["Cryptbloom Nature's Envoy / Deathspores — magic kit"],
    archetype: "shield-tank",
    notes:
      "T90 magic tank from Croesus (Misthalin starter). GREAT for magic+Aegis. ILLEGAL as necro DPS armour.",
    legalStyles: ["magic"],
  },
  {
    id: "deathwarden-tank",
    name: "Deathwarden necro tank",
    kind: "tank",
    armourBody: 2450,
    offhandArmour: { none: 0, defender: 180, shield: 420 },
    styleDamageMult: {
      necromancy: 1.06,
      melee: 0.95,
      magic: 0.95,
      ranged: 0.95,
    },
    lpBonus: 1000,
    prayerBonus: 12,
    setEffectMult: 1.04,
    setEffectNotes: ["Necro tank path (Kili)", "Aegis-friendly armour"],
    archetype: "shield-tank",
    notes: "Correct necro tank for Teragard Aegis — free-region Necromancy progression",
    legalStyles: ["necromancy"],
  },
  {
    id: "tfn-power",
    name: "Robes of the First Necromancer (power)",
    kind: "power",
    armourBody: 1550,
    offhandArmour: { none: 0, defender: 100, shield: 0 },
    styleDamageMult: {
      necromancy: 1.13,
      melee: 0.95,
      magic: 0.95,
      ranged: 0.95,
    },
    lpBonus: 400,
    prayerBonus: 10,
    setEffectMult: 1.05,
    setEffectNotes: ["TFN power set — Rasial"],
    archetype: "power-dps",
    notes: "Necro power BiS path (Rasial) — weaker Aegis convert than Deathwarden tank",
    legalStyles: ["necromancy"],
  },
  {
    id: "masterwork-tank",
    name: "Masterwork / trimmed MW melee tank",
    kind: "tank",
    armourBody: 2550,
    offhandArmour: { none: 0, defender: 240, shield: 500 },
    styleDamageMult: {
      melee: 1.06,
      magic: 1.01,
      ranged: 1.01,
      necromancy: 1.01,
    },
    lpBonus: 1100,
    prayerBonus: 10,
    setEffectMult: 1.05,
    setEffectNotes: ["Masterwork set", "Melee tank"],
    archetype: "shield-tank",
    notes: "Aegis + melee strength hybrid tank",
    legalStyles: ["melee"],
  },
  {
    id: "sirenic-power",
    name: "Sirenic / elite sirenic power ranged",
    kind: "power",
    armourBody: 1500,
    offhandArmour: { none: 0, defender: 100, shield: 0 },
    styleDamageMult: {
      melee: 1.01,
      magic: 1.01,
      ranged: 1.15,
      necromancy: 1.01,
    },
    lpBonus: 400,
    prayerBonus: 16,
    setEffectMult: 1.05,
    setEffectNotes: ["Sirenic set"],
    archetype: "power-dps",
    notes: "Ranged power BiS package",
    legalStyles: ["ranged"],
  },
  {
    id: "tectonic-power",
    name: "Tectonic / elite tectonic power magic",
    kind: "power",
    armourBody: 1550,
    offhandArmour: { none: 0, defender: 100, shield: 0 },
    styleDamageMult: {
      melee: 1.01,
      magic: 1.15,
      ranged: 1.01,
      necromancy: 1.01,
    },
    lpBonus: 400,
    prayerBonus: 16,
    setEffectMult: 1.05,
    setEffectNotes: ["Tectonic set"],
    archetype: "power-dps",
    notes: "Magic power BiS package",
    legalStyles: ["magic"],
  },
  {
    id: "hybrid-cinder",
    name: "Power body + Cinderbane gloves hybrid",
    kind: "hybrid",
    armourBody: 1700,
    offhandArmour: { none: 0, defender: 180, shield: 350 },
    styleDamageMult: {
      melee: 1.1,
      magic: 1.09,
      ranged: 1.09,
      necromancy: 1.08,
    },
    lpBonus: 600,
    prayerBonus: 14,
    setEffectMult: 1.03,
    setEffectNotes: ["Cinderbane gloves hybrid T70 dmg"],
    archetype: "defender",
    notes: "Poison gloves + solid style dmg; Tirannwn",
  },
  {
    id: "anima-core",
    name: "Anima core (hybrid mid)",
    kind: "hybrid",
    armourBody: 1400,
    offhandArmour: { none: 0, defender: 150, shield: 300 },
    styleDamageMult: {
      melee: 1.07,
      magic: 1.07,
      ranged: 1.07,
      necromancy: 1.06,
    },
    lpBonus: 700,
    prayerBonus: 20,
    setEffectMult: 1.03,
    setEffectNotes: ["Anima core"],
    archetype: "defender",
    notes: "Prayer-heavy hybrid",
  },
  {
    id: "mixed-aegis-power",
    name: "Mixed: tank body/legs + power helm/gloves (Aegis optimise)",
    kind: "mixed",
    armourBody: 2100,
    offhandArmour: { none: 0, defender: 220, shield: 450 },
    styleDamageMult: {
      melee: 1.08,
      magic: 1.07,
      ranged: 1.07,
      necromancy: 1.07,
    },
    lpBonus: 900,
    prayerBonus: 14,
    setEffectMult: 1.04,
    setEffectNotes: ["Mixed tank+power for Aegis"],
    archetype: "shield-tank",
    notes: "Common Aegis optimise — high armour + partial power bonuses",
  },
  {
    id: "void-elite",
    name: "Elite / superior Void knight",
    kind: "power",
    armourBody: 900,
    offhandArmour: { none: 0, defender: 80, shield: 0 },
    styleDamageMult: {
      // Void: notable style damage when set complete; low armour
      melee: 1.1,
      magic: 1.1,
      ranged: 1.1,
      necromancy: 1.0, // void historically melee/mage/range kits
    },
    lpBonus: 200,
    prayerBonus: 6,
    setEffectMult: 1.06,
    setEffectNotes: [
      "Void set: style damage when full set (melee/mage/range)",
      "Weak Aegis convert (low armour)",
    ],
    archetype: "power-dps",
    notes:
      "Pest Control void — attainable early. Strong pre-Aegis / no-Aegis; loses hard to tank under Teragard's Aegis.",
    legalStyles: ["melee", "magic", "ranged"],
  },
  {
    id: "warpriest",
    name: "Warpriest of Zamorak/Saradomin (full)",
    kind: "hybrid",
    armourBody: 1650,
    offhandArmour: { none: 0, defender: 160, shield: 320 },
    styleDamageMult: {
      melee: 1.04,
      magic: 1.04,
      ranged: 1.04,
      necromancy: 1.03,
    },
    lpBonus: 500,
    prayerBonus: 22,
    setEffectMult: 1.035,
    setEffectNotes: [
      "Warpriest set: damage reduction charges / hybrid stats",
      "Prayer-friendly for Icyenic",
    ],
    archetype: "defender",
    notes:
      "GWD warpriest — mid armour, high prayer. Nice Icyenic synergy, not Aegis BiS.",
  },
  {
    id: "vestments-of-havoc",
    name: "Vestments of Havoc (melee power)",
    kind: "power",
    armourBody: 1480,
    offhandArmour: { none: 0, defender: 100, shield: 0 },
    styleDamageMult: {
      melee: 1.16,
      magic: 0.96,
      ranged: 0.96,
      necromancy: 0.96,
    },
    lpBonus: 350,
    prayerBonus: 12,
    setEffectMult: 1.09,
    setEffectNotes: [
      "Herald of Chaos: adren after melee ult",
      "3pc: Berserk +6s duration",
      "4pc: +20% max adren with melee",
    ],
    archetype: "power-dps",
    notes:
      "Zamorak melee power set — strong Berserk/ult density. Weaker Aegis than tank; pairs with Chaos path + Rampage.",
    legalStyles: ["melee"],
  },
];

export const ARMOUR_BY_ID: Readonly<Record<string, ArmourProfile>> = Object.fromEntries(
  ARMOUR_PROFILES.map((p) => [p.id, p]),
);

/**
 * Remap illegal armour profiles to the correct style package.
 * Cryptbloom never sticks on necro/melee/ranged; TFN/Deathwarden only on necro.
 */
export function sanitizeArmourProfile(
  style: Style,
  profileId: ArmourProfileId | undefined,
  opts?: { hasAegis?: boolean; offhand?: Offhand },
): { profileId: ArmourProfileId; remapped: boolean; reason?: string } {
  const hasAegis = opts?.hasAegis ?? false;
  const offhand = opts?.offhand ?? "none";
  const fallback = defaultProfile(style, offhand, hasAegis);

  if (!profileId) {
    return { profileId: fallback, remapped: false };
  }

  const profile = ARMOUR_BY_ID[profileId];
  if (!profile) {
    return { profileId: fallback, remapped: true, reason: `Unknown profile ${profileId}` };
  }

  if (profile.legalStyles && !profile.legalStyles.includes(style)) {
    // Style-specific remap
    let alt: ArmourProfileId = fallback;
    if (profileId === "cryptbloom-tank") {
      alt =
        style === "necromancy"
          ? "deathwarden-tank"
          : style === "melee"
            ? "masterwork-tank"
            : style === "ranged"
              ? hasAegis
                ? "tank-aegis"
                : "sirenic-power"
              : fallback;
    } else if (profileId === "deathwarden-tank" || profileId === "tfn-power") {
      alt = fallback;
    } else if (profileId === "sirenic-power") {
      alt = style === "magic" ? "tectonic-power" : style === "necromancy" ? "tfn-power" : "power-bis";
    } else if (profileId === "tectonic-power") {
      alt = style === "ranged" ? "sirenic-power" : style === "necromancy" ? "tfn-power" : "power-bis";
    } else if (profileId === "masterwork-tank") {
      alt =
        style === "necromancy"
          ? "deathwarden-tank"
          : style === "magic"
            ? "cryptbloom-tank"
            : "tank-aegis";
    }
    return {
      profileId: alt,
      remapped: true,
      reason: `${profileId} illegal for ${style} → ${alt}`,
    };
  }

  return { profileId, remapped: false };
}

/** Infer armour profile from equipped body piece names. */
export function profileFromBodyPiece(
  style: Style,
  bodyNameOrId: string | undefined,
  mode: "tank" | "power",
): ArmourProfileId {
  const n = (bodyNameOrId ?? "").toLowerCase();
  if (/cryptbloom/.test(n)) {
    return style === "magic" ? "cryptbloom-tank" : sanitizeArmourProfile(style, "cryptbloom-tank").profileId;
  }
  if (/deathwarden/.test(n)) return "deathwarden-tank";
  if (/first necromancer|tfn|deathdealer/.test(n)) return "tfn-power";
  if (/sirenic|dracolich/.test(n)) return style === "ranged" ? "sirenic-power" : "power-bis";
  if (/tectonic/.test(n)) return style === "magic" ? "tectonic-power" : "power-bis";
  if (/masterwork|malevolent|bandos|trimmed/.test(n)) {
    return mode === "tank" ? "masterwork-tank" : "power-bis";
  }
  if (/anima/.test(n)) return "anima-core";
  if (mode === "tank") {
    if (style === "necromancy") return "deathwarden-tank";
    if (style === "magic") return "cryptbloom-tank";
    if (style === "melee") return "masterwork-tank";
    return "tank-aegis";
  }
  if (style === "necromancy") return "tfn-power";
  if (style === "magic") return "tectonic-power";
  if (style === "ranged") return "sirenic-power";
  return "power-bis";
}

export interface ArmourResolveInput {
  profileId?: ArmourProfileId;
  style: Style;
  offhand: Offhand;
  hasAegis: boolean;
  hasChaoticInsight?: boolean;
  /** Override raw armour if loadout already summed */
  armourOverride?: number;
  prayerOverride?: number;
  lpOverride?: number;
}

export interface ArmourResolveResult {
  profile: ArmourProfile;
  totalArmour: number;
  styleDamageMult: number;
  setEffectMult: number;
  /** Chaotic Insight amplifies set effects */
  chaoticInsightMult: number;
  prayerBonus: number;
  lpBonus: number;
  /** Isolated AD equivalent from style damage bonuses (for breakdown) */
  styleBonusAdFactor: number;
  /** Aegis AD from this armour (caller multiplies by 0.25/0.5/0.75) */
  armourForAegis: number;
  flags: string[];
  /** Effective mult on ability-like damage from armour system alone */
  abilityMult: number;
  /** True if profile was remapped for style legality */
  remappedFrom?: string;
}

export function resolveArmourBonuses(input: ArmourResolveInput): ArmourResolveResult {
  const sanitized = sanitizeArmourProfile(input.style, input.profileId, {
    hasAegis: input.hasAegis,
    offhand: input.offhand,
  });
  const profile =
    ARMOUR_BY_ID[sanitized.profileId] ??
    ARMOUR_BY_ID[defaultProfile(input.style, input.offhand, input.hasAegis)] ??
    ARMOUR_BY_ID["mixed-aegis-power"]!;

  const ohArm = profile.offhandArmour[input.offhand] ?? 0;
  const totalArmour = input.armourOverride ?? profile.armourBody + ohArm;
  const styleDamageMult = profile.styleDamageMult[input.style] ?? 1;
  let setEffectMult = profile.setEffectMult;
  let chaoticInsightMult = 1;
  const flags: string[] = [`Armour: ${profile.name}`];
  if (sanitized.remapped && sanitized.reason) {
    flags.push(`⚠ Armour remapped: ${sanitized.reason}`);
  }

  // Off-style tank sets: set effects largely don't apply (e.g. Cryptbloom on necro)
  // After sanitize this should be rare, but keep safety net.
  if (profile.id === "cryptbloom-tank" && input.style !== "magic") {
    setEffectMult = 1.0;
    flags.push(
      "⚠ Cryptbloom is MAGIC tank — off-style: no set EV + style penalty (accuracy)",
    );
  }
  if (profile.id === "deathwarden-tank" && input.style !== "necromancy") {
    setEffectMult = 1.0;
    flags.push("⚠ Deathwarden is necro tank — off-style set muted");
  }
  if (profile.id === "masterwork-tank" && input.style !== "melee") {
    setEffectMult = Math.min(setEffectMult, 1.01);
  }
  if (
    (profile.id === "sirenic-power" && input.style !== "ranged") ||
    (profile.id === "tectonic-power" && input.style !== "magic") ||
    (profile.id === "tfn-power" && input.style !== "necromancy")
  ) {
    setEffectMult = 1.0;
    flags.push("⚠ Power armour off-style — set muted");
  }

  if (input.hasChaoticInsight) {
    chaoticInsightMult = 1.08;
    setEffectMult = 1 + (setEffectMult - 1) * 1.7;
    flags.push("Chaotic Insight set amplification");
  }

  const prayerBonus = input.prayerOverride ?? profile.prayerBonus;
  const lpBonus = input.lpOverride ?? profile.lpBonus;

  flags.push(`Style dmg ×${styleDamageMult.toFixed(3)}`);
  if (setEffectMult > 1.001) flags.push(`Set effects ×${setEffectMult.toFixed(3)}`);
  flags.push(`Armour value ${totalArmour} (Aegis base)`);
  if (prayerBonus > 0) flags.push(`Prayer bonus +${prayerBonus}`);

  const abilityMult = styleDamageMult * setEffectMult * chaoticInsightMult;

  return {
    profile,
    totalArmour,
    styleDamageMult,
    setEffectMult,
    chaoticInsightMult,
    prayerBonus,
    lpBonus,
    styleBonusAdFactor: styleDamageMult - 1,
    armourForAegis: totalArmour,
    flags,
    abilityMult,
    remappedFrom: sanitized.remapped ? input.profileId : undefined,
  };
}

function defaultProfile(
  style: Style,
  offhand: Offhand,
  hasAegis: boolean,
): ArmourProfileId {
  if (hasAegis && offhand === "shield") {
    if (style === "magic") return "cryptbloom-tank";
    if (style === "necromancy") return "deathwarden-tank";
    if (style === "melee") return "masterwork-tank";
    return "tank-aegis";
  }
  if (hasAegis) return "mixed-aegis-power";
  if (style === "ranged") return "sirenic-power";
  if (style === "magic") return "tectonic-power";
  if (style === "necromancy") return "tfn-power";
  return "power-bis";
}

/** Compare power vs tank for Aegis builds: returns which wins on raw AD proxy */
export function compareAegisArmourTradeoff(opts: {
  style: Style;
  aegisPct: number; // 0.25 / 0.5 / 0.75
  baselineAd: number;
}): {
  power: { ad: number; armour: number; mult: number };
  tank: { ad: number; armour: number; mult: number };
  mixed: { ad: number; armour: number; mult: number };
  winner: "power" | "tank" | "mixed";
} {
  const power = resolveArmourBonuses({
    profileId: "power-bis",
    style: opts.style,
    offhand: "none",
    hasAegis: true,
  });
  const tankProfile =
    opts.style === "necromancy"
      ? "deathwarden-tank"
      : opts.style === "magic"
        ? "cryptbloom-tank"
        : opts.style === "melee"
          ? "masterwork-tank"
          : "tank-aegis";
  const tank = resolveArmourBonuses({
    profileId: tankProfile,
    style: opts.style,
    offhand: "shield",
    hasAegis: true,
  });
  const mixed = resolveArmourBonuses({
    profileId: "mixed-aegis-power",
    style: opts.style,
    offhand: "shield",
    hasAegis: true,
  });

  const score = (r: ArmourResolveResult) => {
    const aegisAd = r.totalArmour * opts.aegisPct;
    const ad = (opts.baselineAd + aegisAd) * r.abilityMult;
    return { ad, armour: r.totalArmour, mult: r.abilityMult };
  };

  const p = score(power);
  const t = score(tank);
  const m = score(mixed);
  let winner: "power" | "tank" | "mixed" = "tank";
  if (p.ad >= t.ad && p.ad >= m.ad) winner = "power";
  else if (m.ad >= t.ad) winner = "mixed";
  return { power: p, tank: t, mixed: m, winner };
}
