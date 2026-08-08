/**
 * Region-gated combat items for Equilibrium realism.
 * Free start: Misthalin + Havenhythe; Karamja at first milestone; then 3 electives.
 * Item stats are approximate model inputs (armour contrib, ability damage, LP).
 * Region tags follow wiki / sonnaya2 planner unlock mapping (Forinthry = Wilderness).
 */

export type RegionId =
  | "misthalin"
  | "havenhythe"
  | "karamja"
  | "forinthry" // Wilderness / Daemonheim
  | "asgarnia"
  | "anachronia"
  | "desert"
  | "morytania"
  | "tirannwn"
  | "kandarin"
  | "fremennik";

export type ItemSlot =
  | "weapon"
  | "offhand"
  | "helmet"
  | "body"
  | "legs"
  | "boots"
  | "gloves"
  | "cape"
  | "amulet"
  | "ring"
  | "aura"
  | "pocket"
  | "ammo";

export type CombatStyle = "necromancy" | "melee" | "magic" | "ranged" | "all";
export type ArmourKind = "tank" | "power" | "hybrid" | "shield" | "defender" | "none";

export interface RegionDef {
  id: RegionId;
  name: string;
  /** free starter, free milestone, or elective pick */
  access: "free" | "milestone" | "elective";
  combatTier: "S" | "A" | "B" | "C" | "D";
  summary: string;
  keyUnlocks: string[];
}

export const REGIONS: readonly RegionDef[] = [
  {
    id: "misthalin",
    name: "Misthalin",
    access: "free",
    combatTier: "S",
    summary: "Hub. Rasial necro ladder, Vorkath, Kerapac, Gate of Elidinis, BOLG path.",
    keyUnlocks: ["Rasial / Deathwarden", "FSOA", "BOLG", "Cryptbloom", "EZK", "Vorkath gear"],
  },
  {
    id: "havenhythe",
    name: "Havenhythe",
    access: "free",
    combatTier: "B",
    summary: "League starter island. Skilling + early PvM bridge.",
    keyUnlocks: ["League shops", "Early materials", "BGH-style content"],
  },
  {
    id: "karamja",
    name: "Karamja",
    access: "milestone",
    combatTier: "B",
    summary: "Auto-unlocked at first region milestone. Fire cape, habitat, early combat.",
    keyUnlocks: ["Fire cape", "Juju / habitat", "Early slayer masters"],
  },
  {
    id: "forinthry",
    name: "Forinthry (Wilderness)",
    access: "elective",
    combatTier: "A",
    summary: "Daemonheim shop, chaotics, Arch-Glacor line, ED gear, power armour crafts.",
    keyUnlocks: ["Chaotics T90", "Arch-Glacor boots", "Eldritch / Hex", "Sirenic crafts"],
  },
  {
    id: "asgarnia",
    name: "Asgarnia",
    access: "elective",
    combatTier: "A",
    summary: "GWD, QBD, Vorago, Invention hub, elite power sets, masterwork weapons.",
    keyUnlocks: ["GWD sets", "Elite Tectonic/Sirenic", "Masterwork weapons", "Invention"],
  },
  {
    id: "anachronia",
    name: "Anachronia",
    access: "elective",
    combatTier: "B",
    summary: "Rex rings, BGH, gemstone armour, ability unlocks.",
    keyUnlocks: ["Igneous / Rex rings", "Gemstone armour", "T90 boots line"],
  },
  {
    id: "desert",
    name: "Desert",
    access: "elective",
    combatTier: "S",
    summary: "Raids, Heart of Gielinor, high-end uniques (ZGS, SGB, drygores, Inq staff).",
    keyUnlocks: ["Drygores", "ZGS", "SGB", "Inquisitor staff", "Achtó"],
  },
  {
    id: "morytania",
    name: "Morytania",
    access: "elective",
    combatTier: "B",
    summary: "Araxxi nox weapons, RoTS malevolent, blisterwood.",
    keyUnlocks: ["Nox scythe/staff/bow", "Malevolent", "Sunspear"],
  },
  {
    id: "tirannwn",
    name: "Tirannwn",
    access: "elective",
    combatTier: "C",
    summary: "Prif, crystal weapons, Solak blightbound, masterwork staff pressure.",
    keyUnlocks: ["Prif crystal", "Blightbound Xbows", "Attuned crystal"],
  },
  {
    id: "kandarin",
    name: "Kandarin",
    access: "elective",
    combatTier: "C",
    summary: "Legiones ascension crossbows, ancient invention, POF.",
    keyUnlocks: ["Ascension crossbows", "Ancient Invention"],
  },
  {
    id: "fremennik",
    name: "Fremennik",
    access: "elective",
    combatTier: "D",
    summary: "Glacor tank boots line, DKs, Lunar. Often skippable for pure DPS.",
    keyUnlocks: ["Steadfast/Ragefire/Glaiven", "Yak-hide"],
  },
] as const;

export const FREE_REGION_IDS: RegionId[] = REGIONS.filter(
  (r) => r.access === "free" || r.access === "milestone",
).map((r) => r.id);

export const ELECTIVE_REGION_IDS: RegionId[] = REGIONS.filter((r) => r.access === "elective").map(
  (r) => r.id,
);

/** Max elective unlocks in Equilibrium (wiki: 3 additional milestones). */
export const MAX_ELECTIVES = 3;

export interface CombatItem {
  id: string;
  name: string;
  slot: ItemSlot;
  style: CombatStyle;
  tier: number;
  kind: ArmourKind;
  /** Regions that must be unlocked (all of them) to obtain/craft. Empty = free regions only / always. */
  requires: RegionId[];
  /** Ability damage contribution if weapon/offhand weapon */
  abilityDamage?: number;
  /** Armour rating contribution */
  armour?: number;
  /** Life points from gear */
  lp?: number;
  /** Prayer bonus */
  prayer?: number;
  /** True for two-handed weapons (no off-hand allowed) */
  twoHanded?: boolean;
  notes?: string;
}

/**
 * Curated BiS ladders per style/slot. Not every item in the game —
 * enough to model realistic region-gated progressions.
 */
export const ITEMS: readonly CombatItem[] = [
  // ─── Necromancy weapons ───
  {
    id: "death-guard-70",
    name: "Death Guard (T70)",
    slot: "weapon",
    style: "necromancy",
    tier: 70,
    kind: "none",
    requires: [],
    abilityDamage: 857,
    notes: "Misthalin Rasial ladder start",
  },
  {
    id: "death-guard-90",
    name: "Death Guard (T90)",
    slot: "weapon",
    style: "necromancy",
    tier: 90,
    kind: "none",
    requires: [],
    abilityDamage: 2052,
  },
  {
    id: "omni-guard",
    name: "Omni guard (T95)",
    slot: "weapon",
    style: "necromancy",
    tier: 95,
    kind: "none",
    requires: [],
    abilityDamage: 2450,
    notes: "Rasial unique — free Misthalin (flag: killed:rasial)",
  },
  {
    id: "skull-lantern-90",
    name: "Skull lantern (T90)",
    slot: "offhand",
    style: "necromancy",
    tier: 90,
    kind: "none",
    requires: [],
    abilityDamage: 1026,
  },
  {
    id: "soulbound-lantern",
    name: "Soulbound lantern (T95)",
    slot: "offhand",
    style: "necromancy",
    tier: 95,
    kind: "none",
    requires: [],
    abilityDamage: 1225,
    notes: "Rasial unique (flag: killed:rasial)",
  },

  // ─── Melee weapons ───
  {
    id: "chaotic-rapier",
    name: "Chaotic rapier",
    slot: "weapon",
    style: "melee",
    tier: 80,
    kind: "none",
    requires: ["forinthry"],
    abilityDamage: 1223,
  },
  {
    id: "drygore-mace",
    name: "Drygore mace",
    slot: "weapon",
    style: "melee",
    tier: 90,
    kind: "none",
    requires: ["desert"],
    abilityDamage: 2052,
  },
  {
    id: "khopesh-elidinis",
    name: "Khopesh of Elidinis",
    slot: "weapon",
    style: "melee",
    tier: 92,
    kind: "none",
    requires: [],
    abilityDamage: 2200,
    notes: "Gate of Elidinis — Misthalin",
  },
  {
    id: "ezk",
    name: "Ek-ZekKil (T95 2H)",
    slot: "weapon",
    style: "melee",
    tier: 95,
    kind: "none",
    requires: [],
    abilityDamage: 2688,
    twoHanded: true,
    notes: "Zamorak front — accessible from free path content",
  },
  {
    id: "zgs",
    name: "Zaros godsword",
    slot: "weapon",
    style: "melee",
    tier: 92,
    kind: "none",
    requires: ["desert"],
    abilityDamage: 2458,
    twoHanded: true,
  },
  {
    id: "mw-2h",
    name: "Masterwork 2H sword",
    slot: "weapon",
    style: "melee",
    tier: 90,
    kind: "none",
    requires: ["asgarnia"],
    abilityDamage: 2450,
    twoHanded: true,
  },
  {
    id: "drygore-oh",
    name: "Drygore off-hand",
    slot: "offhand",
    style: "melee",
    tier: 90,
    kind: "none",
    requires: ["desert"],
    abilityDamage: 1026,
  },
  {
    id: "khopesh-tumeken",
    name: "Khopesh of Tumeken",
    slot: "offhand",
    style: "melee",
    tier: 92,
    kind: "none",
    requires: [],
    abilityDamage: 1100,
  },

  // ─── Magic weapons ───
  {
    id: "seismic-wand",
    name: "Seismic wand",
    slot: "weapon",
    style: "magic",
    tier: 90,
    kind: "none",
    requires: ["asgarnia"],
    abilityDamage: 2052,
    notes: "Vorago — Asgarnia",
  },
  {
    id: "fsoa",
    name: "Fractured Staff of Armadyl",
    slot: "weapon",
    style: "magic",
    tier: 95,
    kind: "none",
    requires: [],
    abilityDamage: 2688,
    twoHanded: true,
    notes: "Kerapac — Misthalin",
  },
  {
    id: "inq-staff",
    name: "Inquisitor staff",
    slot: "weapon",
    style: "magic",
    tier: 80,
    kind: "none",
    requires: ["desert"],
    abilityDamage: 1400,
    twoHanded: true,
  },
  {
    id: "nox-staff",
    name: "Noxious staff",
    slot: "weapon",
    style: "magic",
    tier: 90,
    kind: "none",
    requires: ["morytania"],
    abilityDamage: 2450,
    twoHanded: true,
  },
  {
    id: "seismic-singularity",
    name: "Seismic singularity",
    slot: "offhand",
    style: "magic",
    tier: 90,
    kind: "none",
    requires: ["asgarnia"],
    abilityDamage: 1026,
  },
  {
    id: "virtus-book",
    name: "Virtus book",
    slot: "offhand",
    style: "magic",
    tier: 80,
    kind: "none",
    requires: ["desert"],
    abilityDamage: 768,
  },

  // ─── Ranged weapons ───
  {
    id: "asc-xbow",
    name: "Ascension crossbow",
    slot: "weapon",
    style: "ranged",
    tier: 90,
    kind: "none",
    requires: ["kandarin"],
    abilityDamage: 2052,
  },
  {
    id: "bolg",
    name: "Bow of the Last Guardian",
    slot: "weapon",
    style: "ranged",
    tier: 95,
    kind: "none",
    requires: [],
    abilityDamage: 2688,
    twoHanded: true,
    notes: "Zemouregal & Vorkath path — Misthalin",
  },
  {
    id: "sgb",
    name: "Seren godbow",
    slot: "weapon",
    style: "ranged",
    tier: 92,
    kind: "none",
    requires: ["desert"],
    abilityDamage: 2458,
    twoHanded: true,
  },
  {
    id: "nox-bow",
    name: "Noxious longbow",
    slot: "weapon",
    style: "ranged",
    tier: 90,
    kind: "none",
    requires: ["morytania"],
    abilityDamage: 2450,
    twoHanded: true,
  },
  {
    id: "blightbound",
    name: "Blightbound crossbows",
    slot: "weapon",
    style: "ranged",
    tier: 92,
    kind: "none",
    requires: ["tirannwn"],
    abilityDamage: 2200,
  },
  {
    id: "asc-oh",
    name: "Off-hand Ascension crossbow",
    slot: "offhand",
    style: "ranged",
    tier: 90,
    kind: "none",
    requires: ["kandarin"],
    abilityDamage: 1026,
  },
  {
    id: "eldritch-xbow",
    name: "Eldritch crossbow",
    slot: "weapon",
    style: "ranged",
    tier: 90,
    kind: "none",
    requires: ["forinthry"],
    abilityDamage: 2450,
    twoHanded: true,
  },

  // ─── Tank / power armour (style-strict — never cross-style BiS) ───
  {
    id: "deathwarden-70",
    name: "Deathwarden robe set (T70)",
    slot: "body",
    style: "necromancy",
    tier: 70,
    kind: "tank",
    requires: [],
    armour: 420,
    lp: 420,
  },
  {
    id: "deathwarden-90",
    name: "Deathwarden robe set (T90)",
    slot: "body",
    style: "necromancy",
    tier: 90,
    kind: "tank",
    requires: [],
    armour: 720,
    lp: 900,
    notes: "Full set proxy (helm/body/legs/boots/gloves) — free Kili/Rasial ladder",
  },
  {
    id: "deathdealer-90",
    name: "Deathdealer robe set (T90 power)",
    slot: "body",
    style: "necromancy",
    tier: 90,
    kind: "power",
    requires: [],
    armour: 480,
    lp: 400,
    notes: "Pre-TFN necro power (Kili)",
  },
  {
    id: "tfn-robes",
    name: "Robes of the First Necromancer (T95)",
    slot: "body",
    style: "necromancy",
    tier: 95,
    kind: "power",
    requires: [],
    armour: 560,
    lp: 450,
    notes: "TFN power BiS — Rasial (flag: killed:rasial). NEVER Cryptbloom for necro.",
  },
  {
    id: "free-melee-tank",
    name: "Hybrid tank plate (free-path)",
    slot: "body",
    style: "melee",
    tier: 80,
    kind: "tank",
    requires: [],
    armour: 520,
    lp: 550,
    notes: "Best free-region melee tank proxy (quest/barrows-tier)",
  },
  {
    id: "bandos",
    name: "Bandos armour set",
    slot: "body",
    style: "melee",
    tier: 70,
    kind: "power",
    requires: ["asgarnia"],
    armour: 400,
    lp: 300,
  },
  {
    id: "cryptbloom",
    name: "Cryptbloom armour set",
    slot: "body",
    style: "magic",
    tier: 95,
    kind: "tank",
    requires: [],
    armour: 850,
    lp: 1100,
    notes: "Croesus — free path MAGIC tank only. Illegal as necro BiS.",
  },
  {
    id: "tectonic",
    name: "Tectonic armour set",
    slot: "body",
    style: "magic",
    tier: 90,
    kind: "power",
    requires: ["forinthry"],
    armour: 520,
    lp: 350,
  },
  {
    id: "elite-tectonic",
    name: "Elite tectonic set",
    slot: "body",
    style: "magic",
    tier: 92,
    kind: "power",
    requires: ["asgarnia"],
    armour: 560,
    lp: 380,
  },
  {
    id: "malevolent",
    name: "Malevolent armour set",
    slot: "body",
    style: "melee",
    tier: 90,
    kind: "power",
    requires: ["morytania"],
    armour: 540,
    lp: 360,
  },
  {
    id: "trimmed-mw",
    name: "Trimmed masterwork melee set",
    slot: "body",
    style: "melee",
    tier: 92,
    kind: "tank",
    requires: ["morytania", "asgarnia"],
    armour: 920,
    lp: 1400,
    notes: "Multi-region craft pressure",
  },
  {
    id: "anima-core-zam",
    name: "Anima core of Zamorak (tank-ish)",
    slot: "body",
    style: "melee",
    tier: 80,
    kind: "hybrid",
    requires: ["desert"],
    armour: 500,
    lp: 500,
  },
  {
    id: "dracolich",
    name: "Dracolich armour set",
    slot: "body",
    style: "ranged",
    tier: 90,
    kind: "power",
    requires: [],
    armour: 500,
    lp: 340,
    notes: "Vorkath — Misthalin",
  },
  {
    id: "elite-dracolich",
    name: "Elite dracolich set",
    slot: "body",
    style: "ranged",
    tier: 92,
    kind: "power",
    requires: [],
    armour: 540,
    lp: 360,
  },
  {
    id: "sirenic",
    name: "Sirenic armour set",
    slot: "body",
    style: "ranged",
    tier: 90,
    kind: "power",
    requires: ["forinthry"],
    armour: 520,
    lp: 350,
  },
  {
    id: "elite-sirenic",
    name: "Elite sirenic set",
    slot: "body",
    style: "ranged",
    tier: 92,
    kind: "power",
    requires: ["asgarnia"],
    armour: 560,
    lp: 380,
  },
  {
    id: "gemstone-armour",
    name: "Gemstone armour set",
    slot: "body",
    style: "all",
    tier: 80,
    kind: "tank",
    requires: ["anachronia"],
    armour: 480,
    lp: 600,
  },
  {
    id: "achto",
    name: "Achtó armour pieces",
    slot: "body",
    style: "all",
    tier: 90,
    kind: "tank",
    requires: ["desert"],
    armour: 780,
    lp: 900,
  },

  // ─── Shields / defenders (critical for Aegis) ───
  {
    id: "mithril-kiteshield",
    name: "High-tier kite (early)",
    slot: "offhand",
    style: "all",
    tier: 60,
    kind: "shield",
    requires: [],
    armour: 250,
    lp: 100,
  },
  {
    id: "corrupt-dragon-shield",
    name: "Strong melee shield (T70)",
    slot: "offhand",
    style: "melee",
    tier: 70,
    kind: "shield",
    requires: [],
    armour: 350,
    lp: 150,
  },
  {
    id: "divine-spirit-shield",
    name: "Divine spirit shield",
    slot: "offhand",
    style: "all",
    tier: 75,
    kind: "shield",
    requires: ["asgarnia"],
    armour: 420,
    lp: 200,
    notes: "Corp — Asgarnia path",
  },
  {
    id: "malevolent-kiteshield",
    name: "Malevolent kiteshield",
    slot: "offhand",
    style: "melee",
    tier: 90,
    kind: "shield",
    requires: ["morytania"],
    armour: 491,
    lp: 250,
  },
  {
    id: "merciless-kiteshield",
    name: "Merciless kiteshield",
    slot: "offhand",
    style: "magic",
    tier: 90,
    kind: "shield",
    requires: ["morytania"],
    armour: 491,
    lp: 250,
  },
  {
    id: "vengeful-kiteshield",
    name: "Vengeful kiteshield",
    slot: "offhand",
    style: "ranged",
    tier: 90,
    kind: "shield",
    requires: ["morytania"],
    armour: 491,
    lp: 250,
  },
  {
    id: "kalphite-defender",
    name: "Kalphite defender / repayer",
    slot: "offhand",
    style: "melee",
    tier: 90,
    kind: "defender",
    requires: ["desert"],
    armour: 200,
    abilityDamage: 480,
  },
  {
    id: "ancient-lantern",
    name: "Ancient lantern (necro shield-like)",
    slot: "offhand",
    style: "necromancy",
    tier: 85,
    kind: "shield",
    requires: [],
    armour: 400,
    lp: 200,
    notes: "Tank necro off-hand proxy when not dual-wielding lantern",
  },
  {
    id: "elysian-spirit-shield",
    name: "Elysian spirit shield",
    slot: "offhand",
    style: "all",
    tier: 75,
    kind: "shield",
    requires: ["asgarnia"],
    armour: 420,
    lp: 200,
  },

  // ─── Boots (notable region locks) ───
  {
    id: "emberkeen",
    name: "Emberkeen boots (T90)",
    slot: "boots",
    style: "melee",
    tier: 90,
    kind: "power",
    requires: ["forinthry"],
    armour: 80,
    lp: 100,
    notes: "Arch-Glacor upgrade line",
  },
  {
    id: "steadfast",
    name: "Steadfast boots",
    slot: "boots",
    style: "melee",
    tier: 85,
    kind: "tank",
    requires: ["fremennik"],
    armour: 100,
    lp: 120,
  },
  {
    id: "ragefire",
    name: "Ragefire boots",
    slot: "boots",
    style: "magic",
    tier: 85,
    kind: "tank",
    requires: ["fremennik"],
    armour: 100,
    lp: 120,
  },
  {
    id: "glaiven",
    name: "Glaiven boots",
    slot: "boots",
    style: "ranged",
    tier: 85,
    kind: "tank",
    requires: ["fremennik"],
    armour: 100,
    lp: 120,
  },
  {
    id: "laceration",
    name: "Laceration boots",
    slot: "boots",
    style: "melee",
    tier: 90,
    kind: "power",
    requires: ["anachronia"],
    armour: 70,
    lp: 80,
  },

  // ─── Rings ───
  {
    id: "ring-of-death",
    name: "Ring of death",
    slot: "ring",
    style: "all",
    tier: 85,
    kind: "none",
    requires: ["asgarnia"],
    prayer: 3,
  },
  {
    id: "reaver-ring",
    name: "Reaver's ring",
    slot: "ring",
    style: "all",
    tier: 90,
    kind: "none",
    requires: ["anachronia"],
    notes: "Rex matriarchs",
  },
  {
    id: "lotd",
    name: "Luck of the Dwarves",
    slot: "ring",
    style: "all",
    tier: 70,
    kind: "none",
    requires: ["fremennik"],
  },
  {
    id: "asylum-surgeon",
    name: "Asylum surgeon's ring",
    slot: "ring",
    style: "all",
    tier: 85,
    kind: "none",
    requires: ["desert"],
  },

  // ─── Capes ───
  {
    id: "fire-cape",
    name: "Fire cape / TokHaar-Kal",
    slot: "cape",
    style: "melee",
    tier: 60,
    kind: "none",
    requires: [],
    armour: 40,
    notes: "Karamja (milestone free)",
  },
  {
    id: "god-wars-cape",
    name: "God wars cape",
    slot: "cape",
    style: "all",
    tier: 70,
    kind: "none",
    requires: ["asgarnia"],
    armour: 50,
    prayer: 2,
  },
  {
    id: "igneous-kal",
    name: "Igneous Kal-Zuk",
    slot: "cape",
    style: "all",
    tier: 90,
    kind: "none",
    requires: [],
    armour: 60,
    prayer: 2,
    notes: "Zuk accessible via free-path combat progression",
  },

  // ─── Amulets ───
  {
    id: "sac-e",
    name: "Amulet of souls (or essence)",
    slot: "amulet",
    style: "all",
    tier: 90,
    kind: "none",
    requires: ["asgarnia"],
    prayer: 4,
  },
  {
    id: "reaper-necklace",
    name: "Reaper necklace",
    slot: "amulet",
    style: "all",
    tier: 90,
    kind: "none",
    requires: ["asgarnia"],
  },
  {
    id: "essence-of-finality",
    name: "Essence of Finality amulet",
    slot: "amulet",
    style: "all",
    tier: 90,
    kind: "none",
    requires: ["asgarnia"],
    notes: "Vorago — Asgarnia",
  },
];

export function regionById(id: RegionId): RegionDef {
  return REGIONS.find((r) => r.id === id)!;
}

export function itemAccessible(item: CombatItem, unlocked: ReadonlySet<RegionId>): boolean {
  return item.requires.every((r) => unlocked.has(r));
}

export function accessibleItems(unlocked: readonly RegionId[]): CombatItem[] {
  const set = new Set(unlocked);
  return ITEMS.filter((i) => itemAccessible(i, set));
}

export type OffhandMode = "shield" | "defender" | "dual" | "2h";

export interface ResolvedLoadout {
  unlocked: RegionId[];
  style: CombatStyle extends "all" ? never : CombatStyle;
  mode: OffhandMode;
  pieces: CombatItem[];
  /** Summed model stats */
  totalArmour: number;
  totalWeaponAd: number;
  totalLp: number;
  totalPrayer: number;
  weaponTier: number;
  missingSlots: string[];
  notes: string[];
}

/**
 * Style legality for equipping.
 * - Exact style always OK
 * - style:"all" OK for jewellery / hybrid utility / hybrid armour / shields
 * - style:"all" NEVER OK as main-hand weapon (wiki mis-tags pollute BiS)
 * - Damage off-hands (kind none + AD) must match combat style
 * - Power/tank body of wrong combat style is illegal
 */
export function itemStyleLegal(
  item: Pick<CombatItem, "slot" | "style" | "kind" | "abilityDamage">,
  combatStyle: Exclude<CombatStyle, "all">,
): boolean {
  if (item.style === combatStyle) return true;
  if (item.style !== "all") return false;

  // Hybrid jewellery / aura / pocket / ammo
  if (
    item.slot === "ring" ||
    item.slot === "amulet" ||
    item.slot === "cape" ||
    item.slot === "pocket" ||
    item.slot === "aura" ||
    item.slot === "ammo"
  ) {
    return true;
  }

  // Main-hand weapons must be style-exact (block Obsidian blade / whip vine etc.)
  if (item.slot === "weapon") return false;

  // Off-hand: shields/defenders may be hybrid; damage OH must be style-exact
  if (item.slot === "offhand") {
    if (item.kind === "shield" || item.kind === "defender") return true;
    if (item.kind === "none" && (item.abilityDamage ?? 0) > 0) return false;
    return true;
  }

  // Hybrid armour pieces (gemstone, achto) allowed as style:all
  if (["body", "helmet", "legs", "boots", "gloves"].includes(item.slot)) {
    return true;
  }

  return false;
}

function styleMatch(item: CombatItem, style: CombatStyle): boolean {
  if (style === "all") return true;
  return itemStyleLegal(item, style);
}

/** Score body armour for tank vs power offhand modes. */
export function scoreBodyForMode(
  item: Pick<CombatItem, "armour" | "lp" | "kind" | "tier">,
  wantTank: boolean,
): number {
  const armour = item.armour ?? 0;
  const lp = item.lp ?? 0;
  if (wantTank) {
    return armour * 2 + lp + (item.kind === "tank" ? 500 : item.kind === "hybrid" ? 200 : 0);
  }
  // Power / dual / 2h — never prefer tank armour just because armour rating is high
  const powerBoost =
    item.kind === "power" ? 900 : item.kind === "hybrid" ? 250 : item.kind === "tank" ? -400 : 0;
  return item.tier * 12 + powerBoost + armour * 0.2 + lp * 0.15;
}

/**
 * Greedy best-in-slot from accessible items for a style + offhand mode.
 * Body set items are whole-set proxies (one body entry covers armour set).
 * Enforces 2H vs dual/shield/defender mutual exclusion + style/region gates.
 */
export function resolveLoadout(
  unlocked: readonly RegionId[],
  style: Exclude<CombatStyle, "all">,
  mode: OffhandMode,
): ResolvedLoadout {
  const unlockedSet = new Set(unlocked);
  const pool = accessibleItems(unlocked).filter((i) => styleMatch(i, style));
  const notes: string[] = [];
  const pieces: CombatItem[] = [];
  const missing: string[] = [];

  const pickBest = (
    candidates: CombatItem[],
    score: (i: CombatItem) => number,
  ): CombatItem | undefined => {
    if (!candidates.length) return undefined;
    return [...candidates].sort((a, b) => score(b) - score(a) || b.tier - a.tier)[0];
  };

  const is2h = (w: CombatItem) => !!w.twoHanded;

  const weapons = pool.filter((i) => i.slot === "weapon");

  let weapon: CombatItem | undefined;
  if (mode === "2h") {
    weapon = pickBest(
      weapons.filter((w) => is2h(w)),
      (i) => (i.abilityDamage ?? 0) + i.tier * 2,
    );
    if (!weapon) weapon = pickBest(weapons, (i) => (i.abilityDamage ?? 0) + i.tier * 2);
  } else {
    // shield / defender / dual: prefer 1H main-hand
    const oneHand = weapons.filter((w) => !is2h(w));
    weapon = pickBest(oneHand, (i) => (i.abilityDamage ?? 0) + i.tier * 2);
    if (!weapon) {
      weapon = pickBest(weapons, (i) => (i.abilityDamage ?? 0) + i.tier * 2);
      if (weapon && is2h(weapon)) notes.push("No 1H BiS — using 2H (off-hand disabled)");
    }
  }

  if (weapon) pieces.push(weapon);
  else missing.push("weapon");

  const weaponIs2h = weapon ? is2h(weapon) : false;

  const bodies = pool.filter((i) => i.slot === "body");
  const wantTank = mode === "shield";
  const body = pickBest(bodies, (i) => scoreBodyForMode(i, wantTank));
  if (body) {
    pieces.push(body);
    if (style === "necromancy" && /cryptbloom/i.test(body.id + body.name)) {
      // Should be impossible via style gate — keep as hard fail note
      notes.push("CRITICAL: Cryptbloom on necro — style gate failed");
    }
  } else missing.push("armour set");

  if (weaponIs2h || mode === "2h") {
    notes.push("2H weapon — no off-hand");
  } else if (mode === "dual") {
    const ohWep = pickBest(
      pool.filter((i) => i.slot === "offhand" && i.kind === "none" && (i.abilityDamage ?? 0) > 0),
      (i) => i.abilityDamage ?? 0,
    );
    if (ohWep) pieces.push(ohWep);
    else missing.push("off-hand weapon");
  } else if (mode === "defender") {
    const def = pickBest(
      pool.filter((i) => i.slot === "offhand" && i.kind === "defender"),
      (i) => (i.armour ?? 0) + (i.abilityDamage ?? 0) * 0.5,
    );
    if (def) pieces.push(def);
    else {
      const ohWep = pickBest(
        pool.filter((i) => i.slot === "offhand" && i.kind === "none" && (i.abilityDamage ?? 0) > 0),
        (i) => i.abilityDamage ?? 0,
      );
      if (ohWep) {
        pieces.push(ohWep);
        notes.push("No defender available — dual-wield OH");
      } else missing.push("defender");
    }
  } else {
    const shield = pickBest(
      pool.filter((i) => i.slot === "offhand" && i.kind === "shield"),
      (i) => (i.armour ?? 0) * 2 + (i.lp ?? 0),
    );
    if (shield) pieces.push(shield);
    else missing.push("shield");
  }

  const boots = pickBest(
    pool.filter((i) => i.slot === "boots"),
    (i) => {
      // Prefer style-exact boots over hybrid
      const styleBoost = i.style === style ? 50 : 0;
      return (i.armour ?? 0) + (i.lp ?? 0) + i.tier + styleBoost;
    },
  );
  if (boots) pieces.push(boots);

  const ring = pickBest(
    pool.filter((i) => i.slot === "ring"),
    (i) => i.tier + (i.prayer ?? 0),
  );
  if (ring) pieces.push(ring);

  const cape = pickBest(
    pool.filter((i) => i.slot === "cape"),
    (i) => i.tier + (i.armour ?? 0),
  );
  if (cape) pieces.push(cape);

  const amulet = pickBest(
    pool.filter((i) => i.slot === "amulet"),
    (i) => i.tier + (i.prayer ?? 0) * 10,
  );
  if (amulet) pieces.push(amulet);

  // Hard reject any piece that somehow violated style/region
  const legal = pieces.filter((p) => {
    if (!itemStyleLegal(p, style)) {
      notes.push(`Stripped illegal style piece: ${p.name}`);
      return false;
    }
    if (!itemAccessible(p, unlockedSet)) {
      notes.push(`Stripped region-locked piece: ${p.name}`);
      return false;
    }
    return true;
  });
  pieces.length = 0;
  pieces.push(...legal);

  const baseArmour = 400;
  const baseLp = 9900;

  let totalArmour = baseArmour;
  let totalWeaponAd = 0;
  let totalLp = baseLp;
  let totalPrayer = 0;
  let weaponTier = 1;

  for (const p of pieces) {
    totalArmour += p.armour ?? 0;
    totalWeaponAd += p.abilityDamage ?? 0;
    totalLp += p.lp ?? 0;
    totalPrayer += p.prayer ?? 0;
    if (p.slot === "weapon") weaponTier = Math.max(weaponTier, p.tier);
  }

  // 2H single-weapon kits: slight AD pad so they compete with dual fairer
  if (weaponIs2h) totalWeaponAd = Math.round(totalWeaponAd * 1.05);

  totalWeaponAd = Math.round(totalWeaponAd + 900);

  if (!unlocked.includes("forinthry") && !unlocked.includes("asgarnia")) {
    notes.push("No Wilderness/Asgarnia — limited high-end shields & jewellery");
  }
  if (mode === "shield" && !pieces.some((p) => p.kind === "shield") && !weaponIs2h) {
    notes.push("WARNING: no shield in loadout — Aegis only 25%");
  }

  return {
    unlocked: [...unlocked],
    style,
    mode: weaponIs2h ? "2h" : mode,
    pieces,
    totalArmour,
    totalWeaponAd,
    totalLp,
    totalPrayer,
    weaponTier,
    missingSlots: missing,
    notes,
  };
}

/** Named region packages players actually pick. */
export interface RegionPackage {
  id: string;
  name: string;
  description: string;
  electives: RegionId[];
  tags: string[];
}

export const REGION_PACKAGES: readonly RegionPackage[] = [
  {
    id: "free-only",
    name: "Free regions only",
    description:
      "Misthalin + Havenhythe + Karamja. Still has FSOA, BOLG, EZK, Rasial/Deathwarden/TFN, Cryptbloom (magic), Vorkath. No Invention.",
    electives: [],
    tags: ["starter", "realistic-early"],
  },
  {
    id: "forinthry-asgarnia-anach",
    name: "Wildy + Asgarnia + Anachronia",
    description: "Chaotics/Glacor, Invention/GWD/EOF, Rex rings. Strong all-rounder.",
    electives: ["forinthry", "asgarnia", "anachronia"],
    tags: ["generalist", "popular"],
  },
  {
    id: "desert-asgarnia-forinthry",
    name: "Desert + Asgarnia + Wildy",
    description: "Heart uniques + EOF + chaotics. Max weapon access.",
    electives: ["desert", "asgarnia", "forinthry"],
    tags: ["weapons", "raids"],
  },
  {
    id: "mory-asgarnia-forinthry",
    name: "Morytania + Asgarnia + Wildy",
    description: "Nox + Malevolent kiteshields (huge for Aegis) + GWD/EOF.",
    electives: ["morytania", "asgarnia", "forinthry"],
    tags: ["aegis-shields", "tank"],
  },
  {
    id: "desert-mory-asgarnia",
    name: "Desert + Mory + Asgarnia",
    description: "Raids weapons + RoTS shields + Invention. No Daemonheim shop.",
    electives: ["desert", "morytania", "asgarnia"],
    tags: ["pvm"],
  },
  {
    id: "necro-focus",
    name: "Necro comfort (Wildy+Asg+Ana)",
    description:
      "Rasial/Deathwarden/TFN free; electives fill jewellery, boots, shields, Invention (Asgarnia).",
    electives: ["forinthry", "asgarnia", "anachronia"],
    tags: ["necromancy"],
  },
  {
    id: "skip-combat-skilling",
    name: "Tirannwn + Kandarin + Frem",
    description: "Skilling-heavy electives — weak combat gear. Stress-test for bad pathing.",
    electives: ["tirannwn", "kandarin", "fremennik"],
    tags: ["trap", "skilling"],
  },
];

export function unlockedFromPackage(pkg: RegionPackage): RegionId[] {
  return [...FREE_REGION_IDS, ...pkg.electives];
}

export function unlockedFromElectives(electives: readonly RegionId[]): RegionId[] {
  const clean = electives.filter((e) => ELECTIVE_REGION_IDS.includes(e)).slice(0, MAX_ELECTIVES);
  return [...FREE_REGION_IDS, ...clean];
}

/** Audit helper: list pieces that violate style or region for a resolved loadout. */
export function findIllegalLoadoutPieces(
  loadout: ResolvedLoadout,
): { piece: CombatItem; reasons: string[] }[] {
  const unlocked = new Set(loadout.unlocked);
  const bad: { piece: CombatItem; reasons: string[] }[] = [];
  for (const p of loadout.pieces) {
    const reasons: string[] = [];
    if (!itemStyleLegal(p, loadout.style as Exclude<CombatStyle, "all">)) {
      reasons.push(`style ${p.style} illegal for ${loadout.style}`);
    }
    if (!itemAccessible(p, unlocked)) {
      reasons.push(`missing regions: ${p.requires.filter((r) => !unlocked.has(r)).join(",")}`);
    }
    if (loadout.style === "necromancy" && /cryptbloom/i.test(p.id + p.name)) {
      reasons.push("Cryptbloom must never equip on necromancy");
    }
    if (reasons.length) bad.push({ piece: p, reasons });
  }
  return bad;
}
