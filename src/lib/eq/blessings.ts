/** Equilibrium League blessings catalogue + path rules.
 * Formulas aligned with sonnaya2/Equilibrium planner (ruleset + damage.ts).
 */

export type Path = "Order" | "Balance" | "Chaos";
export type Offhand = "none" | "defender" | "shield";

export const PATHS: readonly Path[] = ["Order", "Balance", "Chaos"] as const;

/** Path tiers (player picks). God tiers are derived. */
export const PATH_TIERS = [1, 2, 3, 5, 6, 7] as const;
export const GOD_TIERS = [4, 8] as const;

export type BlessingId =
  | "adrenaline-junkie"
  | "big-boned"
  | "teragards-aegis"
  | "abyssal-cinders"
  | "barkscales"
  | "striking-light"
  | "avernic-rampage"
  | "eternal-sustenance"
  | "steadfast-will"
  | "demons-mark"
  | "splash-zone"
  | "sacred-fervor"
  | "havoc-born"
  | "true-equilibrium"
  | "higher-power"
  | "unholy-critual"
  | "tearing-thorns"
  | "lord-of-light"
  | "perfidious"
  | "envenomed"
  | "tempered-heart"
  | "chaotic-insight"
  | "power-archive"
  | "genesis-essence";

export interface BlessingDef {
  id: BlessingId;
  name: string;
  path: Path;
  tier: number;
  god?: boolean;
  short: string;
  effects: string[];
  /** Modeling notes when effect is partial */
  modelNotes?: string[];
}

export const BLESSINGS: readonly BlessingDef[] = [
  {
    id: "adrenaline-junkie",
    name: "Adrenaline Junkie",
    path: "Chaos",
    tier: 1,
    short: "+50% max adren & generation",
    effects: [
      "Maximum adrenaline increased by 50%",
      "Adrenaline generation increased by 50%",
    ],
  },
  {
    id: "big-boned",
    name: "Big Boned",
    path: "Balance",
    tier: 1,
    short: "+50% LP; +5% max LP flat per hit",
    effects: [
      "Maximum life points increased by 50%",
      "All damage you deal gains 5% of your maximum life points as bonus damage",
    ],
    modelNotes: [
      "Flat rides nearly all player-sourced hits (abilities, DoTs, conjures, Light, Inferno)",
      "Inherits parent crit state; does not ride itself",
    ],
  },
  {
    id: "teragards-aegis",
    name: "Teragard's Aegis",
    path: "Order",
    tier: 1,
    short: "AD += 25/50/75% of armour",
    effects: [
      "Base ability damage increased by 25% of total armour value",
      "50% with defender, 75% with shield",
      "Base health regen +2.5% max LP (5% defender / 7.5% shield)",
    ],
  },
  {
    id: "abyssal-cinders",
    name: "Abyssal Cinders",
    path: "Chaos",
    tier: 2,
    short: "+15% AD on-hit + Inferno procs",
    effects: [
      "On hit: +15% of ability damage as bonus damage",
      "5% chance Inferno of Zamorak (100–200% AD)",
    ],
  },
  {
    id: "barkscales",
    name: "Barkscales",
    path: "Balance",
    tier: 2,
    short: "Armour mitigation + Grasp retaliate",
    effects: [
      "Incoming damage reduced by 10% of armour value",
      "After 5 reductions: Grasp of Guthix (80–120% AD poison, 3×3)",
    ],
  },
  {
    id: "striking-light",
    name: "Striking Light",
    path: "Order",
    tier: 2,
    short: "+40% basics + Light of Saradomin",
    effects: [
      "Basic attack damage +40%",
      "Basics unleash Light of Saradomin (9s CD): 40–60% AD + 250% armour",
    ],
  },
  {
    id: "avernic-rampage",
    name: "Avernic Rampage",
    path: "Chaos",
    tier: 3,
    short: "5% free-adren windows (7.2s)",
    effects: [
      "On-attack 5% chance: 7.2s of free abilities & specials (except G-maul)",
    ],
  },
  {
    id: "eternal-sustenance",
    name: "Eternal Sustenance",
    path: "Balance",
    tier: 3,
    short: "Food free; no adren loss on eat",
    effects: [
      "Food is not consumed when eaten",
      "No adrenaline loss when eating",
    ],
  },
  {
    id: "steadfast-will",
    name: "Steadfast Will",
    path: "Order",
    tier: 3,
    short: "Empowered defensives (armour dmg)",
    effects: [
      "Bash: +350–450% armour damage",
      "Preparation: −12s all ability CDs",
      "Reflect: 100% reflect + 10–15% armour extra, up to 8 targets",
      "Revenge: doubled duration/CD, max stacks 20",
    ],
  },
  {
    id: "demons-mark",
    name: "Demon's Mark",
    path: "Chaos",
    tier: 4,
    god: true,
    short: "Accuracy uses target weakness",
    effects: ["Accuracy always calculated using target's weakness"],
  },
  {
    id: "splash-zone",
    name: "Splash Zone",
    path: "Balance",
    tier: 4,
    god: true,
    short: "+30% multi; AoE +5%/tile",
    effects: [
      "AoE and multi-target attacks deal +30% damage",
      "AoE deals +5% damage per tile the target occupies",
    ],
  },
  {
    id: "sacred-fervor",
    name: "Sacred Fervor",
    path: "Order",
    tier: 4,
    god: true,
    short: "30% global ability/spec CDR",
    effects: [
      "Melee/Magic/Ranged/Necromancy ability and special attack cooldowns reduced by 30%",
    ],
  },
  {
    id: "havoc-born",
    name: "Havoc Born",
    path: "Chaos",
    tier: 5,
    short: "+20% dmg; −25% LP & armour",
    effects: [
      "Damage +20%",
      "Maximum LP −25%",
      "Armour value −25%",
    ],
  },
  {
    id: "true-equilibrium",
    name: "True Equilibrium",
    path: "Balance",
    tier: 5,
    short: "Stats × unique paths (max 3×)",
    effects: [
      "Per unique path (T1–T6 picks): +75 base AD, +50 armour, +500 LP, +5% crit chance, +7.5% crit dmg, +5 prayer",
      "1 path → 1×, 2 paths → 2×, 3 paths → 3×",
    ],
  },
  {
    id: "higher-power",
    name: "Higher Power",
    path: "Order",
    tier: 5,
    short: "+30% base AD; lose key ultimates",
    effects: [
      "Base ability damage +30%",
      "Lose Berserk, Death's Swiftness, Living Death, Sunshine",
    ],
  },
  {
    id: "unholy-critual",
    name: "Unholy Critual",
    path: "Chaos",
    tier: 6,
    short: "Crit convert + Inferno on crit",
    effects: [
      "+15% crit chance (cap 50%); excess → crit damage 1:1",
      "Inferno +50% crit damage; crits unleash Inferno",
    ],
  },
  {
    id: "tearing-thorns",
    name: "Tearing Thorns",
    path: "Balance",
    tier: 6,
    short: "DoTs 2× duration; LP-scaled Grasps",
    effects: [
      "DoT abilities last 100% longer",
      "Every 5th DoT hit: Grasp (+20–30% max LP + 80–120% AD poison)",
    ],
  },
  {
    id: "lord-of-light",
    name: "Lord of Light",
    path: "Order",
    tier: 6,
    short: "5× Light scatter; prayer scaling",
    effects: [
      "Basics trigger Light of Saradomin 5× (14.4s CD), each hits up to 8 targets",
      "Light +2% per prayer bonus; heals 5% of damage dealt",
    ],
  },
  {
    id: "perfidious",
    name: "Perfidious",
    path: "Chaos",
    tier: 7,
    short: "5× Inferno rate; proc CD cuts",
    effects: [
      "Inferno activation chance ×5",
      "Grasp requirement reduced to 2",
      "Light of Saradomin CD → 4.8s",
    ],
  },
  {
    id: "envenomed",
    name: "Envenomed",
    path: "Balance",
    tier: 7,
    short: "Poison +50% + 2%/Herb level",
    effects: [
      "Poison damage +50% + 2% per Herblore level",
      "Damaging an enemy disables poison immunity for 30s",
    ],
  },
  {
    id: "tempered-heart",
    name: "Tempered Heart",
    path: "Order",
    tier: 7,
    short: "+6% adren every 1.2s",
    effects: ["Generate 6% adrenaline every 1.2 seconds"],
  },
  {
    id: "chaotic-insight",
    name: "Chaotic Insight",
    path: "Chaos",
    tier: 8,
    god: true,
    short: "Set pieces count +2 each",
    effects: [
      "Each combat equipment item counts as 2 additional pieces toward its set effect",
    ],
  },
  {
    id: "power-archive",
    name: "Power Archive",
    path: "Balance",
    tier: 8,
    god: true,
    short: "Gizmo bot; perk ranks doubled",
    effects: [
      "Automaton Control Bot stores up to 20 gizmos",
      "Combat perk ranks doubled (where ranks help)",
    ],
  },
  {
    id: "genesis-essence",
    name: "Genesis Essence",
    path: "Order",
    tier: 8,
    god: true,
    short: "Weapons treated as T120",
    effects: ["Equipped weapons are treated as tier 120"],
  },
] as const;

const byId = new Map(BLESSINGS.map((b) => [b.id, b]));
const byTierPath = new Map(
  BLESSINGS.map((b) => [`${b.tier}:${b.path}`, b] as const),
);

export function blessingById(id: BlessingId): BlessingDef {
  return byId.get(id)!;
}

export function blessingAt(tier: number, path: Path): BlessingDef | undefined {
  return byTierPath.get(`${tier}:${path}`);
}

/** God for a segment of 3 path picks. */
export function deriveGodPath(segment: readonly Path[]): Path | null {
  if (segment.length < 3) return null;
  const counts: Record<Path, number> = { Order: 0, Balance: 0, Chaos: 0 };
  for (const p of segment.slice(0, 3)) counts[p] += 1;
  for (const path of PATHS) if (counts[path] >= 2) return path;
  if (PATHS.every((p) => counts[p] >= 1)) return "Balance";
  return null;
}

/**
 * Ordered path picks for the 6 path tiers: [T1,T2,T3,T5,T6,T7]
 * God4 uses first 3 picks; God8 uses last 3.
 */
export function activeBlessings(picks: readonly Path[]): BlessingDef[] {
  const active: BlessingDef[] = [];
  const pathTiers = [...PATH_TIERS];
  picks.forEach((path, i) => {
    const tier = pathTiers[i];
    if (tier == null) return;
    const b = blessingAt(tier, path);
    if (b) active.push(b);
  });
  // God 4 from picks 0-2
  if (picks.length >= 3) {
    const g = deriveGodPath(picks.slice(0, 3));
    if (g) {
      const b = blessingAt(4, g);
      if (b) active.push(b);
    }
  }
  // God 8 from picks 3-5
  if (picks.length >= 6) {
    const g = deriveGodPath(picks.slice(3, 6));
    if (g) {
      const b = blessingAt(8, g);
      if (b) active.push(b);
    }
  }
  return active;
}

export function uniquePaths(picks: readonly Path[]): number {
  return new Set(picks).size;
}

export function hasId(active: readonly BlessingDef[], id: BlessingId): boolean {
  return active.some((b) => b.id === id);
}

export function pathColor(path: Path): string {
  if (path === "Order") return "var(--color-order)";
  if (path === "Balance") return "var(--color-balance)";
  return "var(--color-chaos)";
}
