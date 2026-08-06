/**
 * RS3 Equilibrium XP routing engine.
 *
 * Base rates are approximate main-game peak XP/hr for the method at that band
 * (community-typical, not lab-perfect). League mult (5×→8×→12×→16×) is applied
 * on top. Methods are gated by region unlocks where relevant.
 */

export type SkillId =
  | "attack"
  | "strength"
  | "defence"
  | "ranged"
  | "prayer"
  | "magic"
  | "runecrafting"
  | "construction"
  | "constitution"
  | "agility"
  | "herblore"
  | "thieving"
  | "crafting"
  | "fletching"
  | "slayer"
  | "hunter"
  | "mining"
  | "smithing"
  | "fishing"
  | "cooking"
  | "firemaking"
  | "woodcutting"
  | "farming"
  | "summoning"
  | "dungeoneering"
  | "divination"
  | "invention"
  | "archaeology"
  | "necromancy";

export interface SkillMeta {
  id: SkillId;
  name: string;
  category: "combat" | "gather" | "artisan" | "support" | "elite";
  maxLevel: number;
}

export const SKILLS: SkillMeta[] = [
  { id: "attack", name: "Attack", category: "combat", maxLevel: 99 },
  { id: "strength", name: "Strength", category: "combat", maxLevel: 99 },
  { id: "defence", name: "Defence", category: "combat", maxLevel: 99 },
  { id: "ranged", name: "Ranged", category: "combat", maxLevel: 99 },
  { id: "prayer", name: "Prayer", category: "combat", maxLevel: 99 },
  { id: "magic", name: "Magic", category: "combat", maxLevel: 99 },
  { id: "constitution", name: "Constitution", category: "combat", maxLevel: 99 },
  { id: "necromancy", name: "Necromancy", category: "combat", maxLevel: 120 },
  { id: "slayer", name: "Slayer", category: "combat", maxLevel: 120 },
  { id: "summoning", name: "Summoning", category: "combat", maxLevel: 99 },
  { id: "agility", name: "Agility", category: "support", maxLevel: 99 },
  { id: "thieving", name: "Thieving", category: "support", maxLevel: 99 },
  { id: "hunter", name: "Hunter", category: "gather", maxLevel: 99 },
  { id: "mining", name: "Mining", category: "gather", maxLevel: 110 },
  { id: "fishing", name: "Fishing", category: "gather", maxLevel: 99 },
  { id: "woodcutting", name: "Woodcutting", category: "gather", maxLevel: 110 },
  { id: "farming", name: "Farming", category: "gather", maxLevel: 120 },
  { id: "divination", name: "Divination", category: "gather", maxLevel: 99 },
  { id: "archaeology", name: "Archaeology", category: "gather", maxLevel: 120 },
  { id: "cooking", name: "Cooking", category: "artisan", maxLevel: 99 },
  { id: "firemaking", name: "Firemaking", category: "artisan", maxLevel: 99 },
  { id: "crafting", name: "Crafting", category: "artisan", maxLevel: 99 },
  { id: "fletching", name: "Fletching", category: "artisan", maxLevel: 99 },
  { id: "smithing", name: "Smithing", category: "artisan", maxLevel: 110 },
  { id: "herblore", name: "Herblore", category: "artisan", maxLevel: 120 },
  { id: "runecrafting", name: "Runecrafting", category: "artisan", maxLevel: 110 },
  { id: "construction", name: "Construction", category: "artisan", maxLevel: 99 },
  { id: "dungeoneering", name: "Dungeoneering", category: "elite", maxLevel: 120 },
  { id: "invention", name: "Invention", category: "elite", maxLevel: 120 },
];

/** Cumulative XP required to reach a level (RS3 formula). */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  let total = 0;
  for (let lvl = 1; lvl < level; lvl++) {
    total += Math.floor(lvl + 300 * Math.pow(2, lvl / 7));
  }
  return Math.floor(total / 4);
}

export function levelFromXp(xp: number): number {
  let lo = 1;
  let hi = 120;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi + 1) / 2);
    if (xpForLevel(mid) <= xp) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export function xpBetween(fromLevel: number, toLevel: number): number {
  return Math.max(0, xpForLevel(toLevel) - xpForLevel(fromLevel));
}

/** League XP mult by combat/relic tier band (wiki Equilibrium). */
export const LEAGUE_XP_MULT: { minTier: number; mult: number; label: string }[] = [
  { minTier: 1, mult: 5, label: "T1–2 · 5×" },
  { minTier: 2, mult: 8, label: "T2–3 · 8×" },
  { minTier: 4, mult: 12, label: "T4–5 · 12×" },
  { minTier: 6, mult: 16, label: "T6+ · 16×" },
];

export function leagueMultForRelicTier(relicTier: number): number {
  let m = 5;
  for (const row of LEAGUE_XP_MULT) {
    if (relicTier >= row.minTier) m = row.mult;
  }
  return m;
}

export type RegionTag =
  | "free"
  | "misthalin"
  | "havenhythe"
  | "karamja"
  | "asgarnia"
  | "desert"
  | "morytania"
  | "forinthry"
  | "anachronia"
  | "tirannwn"
  | "kandarin"
  | "fremennik"
  | "any";

export interface TrainingMethod {
  id: string;
  skill: SkillId;
  name: string;
  /** Inclusive level band where this is the intended method */
  minLevel: number;
  maxLevel: number;
  /**
   * Peak main-game base XP/hr at the top of the band (before league mult).
   * Combat often trains multiple skills; we list primary.
   */
  baseXpPerHour: number;
  /**
   * Secondary skills trained at fraction of primary rate (e.g. combat styles).
   * value = fraction of baseXpPerHour applied to that skill.
   */
  alsoTrains?: Partial<Record<SkillId, number>>;
  regions: RegionTag[];
  intensity: "afk" | "semi" | "clicky" | "tick";
  /** Lower = earlier in optimal route when rates similar */
  priority: number;
  notes?: string;
  /** If true, method is passive/background (farm runs, etc.) */
  passive?: boolean;
  /** Supplies / unlock dependency note */
  needs?: string;
}

/**
 * Curated top methods per skill/level. Rates are community-typical peaks.
 * When multiple overlap, route engine picks highest effective XP/hr.
 */
export const METHODS: TrainingMethod[] = [
  // ── Combat (slayer / bosses cover multi-skill) ─────────────────────
  {
    id: "cbt-chickens",
    skill: "attack",
    name: "Low combat (chickens / cows / goblins)",
    minLevel: 1,
    maxLevel: 30,
    baseXpPerHour: 25_000,
    alsoTrains: { strength: 1, defence: 0.4, constitution: 0.35 },
    regions: ["free"],
    intensity: "afk",
    priority: 10,
  },
  {
    id: "cbt-slayer-early",
    skill: "attack",
    name: "Early Slayer tasks (free regions)",
    minLevel: 30,
    maxLevel: 60,
    baseXpPerHour: 80_000,
    alsoTrains: { strength: 1, defence: 0.5, constitution: 0.4, slayer: 0.35 },
    regions: ["free"],
    intensity: "semi",
    priority: 5,
  },
  {
    id: "cbt-slayer-mid",
    skill: "attack",
    name: "Mid Slayer + AOE tasks",
    minLevel: 60,
    maxLevel: 90,
    baseXpPerHour: 220_000,
    alsoTrains: { strength: 1, defence: 0.55, constitution: 0.45, slayer: 0.4 },
    regions: ["free", "asgarnia", "desert"],
    intensity: "semi",
    priority: 3,
  },
  {
    id: "cbt-slayer-late",
    skill: "attack",
    name: "High Slayer / reaper / ED trash",
    minLevel: 90,
    maxLevel: 99,
    baseXpPerHour: 450_000,
    alsoTrains: { strength: 1, defence: 0.5, constitution: 0.45, slayer: 0.35 },
    regions: ["free", "asgarnia", "desert", "forinthry"],
    intensity: "semi",
    priority: 2,
  },
  {
    id: "cbt-revolution-camp",
    skill: "strength",
    name: "Revolution combat camp (best free style)",
    minLevel: 50,
    maxLevel: 99,
    baseXpPerHour: 350_000,
    alsoTrains: { attack: 0.9, defence: 0.5, constitution: 0.4 },
    regions: ["free"],
    intensity: "afk",
    priority: 8,
    notes: "Use for pure combat levels when not on Slayer",
  },
  {
    id: "rng-early",
    skill: "ranged",
    name: "Early ranged combat (cows / hill giants)",
    minLevel: 1,
    maxLevel: 40,
    baseXpPerHour: 40_000,
    alsoTrains: { defence: 0.2, constitution: 0.3 },
    regions: ["free"],
    intensity: "afk",
    priority: 6,
  },
  {
    id: "rng-slayer",
    skill: "ranged",
    name: "Ranged Slayer / chinning-style packs",
    minLevel: 40,
    maxLevel: 99,
    baseXpPerHour: 400_000,
    alsoTrains: { defence: 0.3, constitution: 0.4, slayer: 0.3 },
    regions: ["free", "tirannwn", "kandarin"],
    intensity: "semi",
    priority: 4,
  },
  {
    id: "mage-early",
    skill: "magic",
    name: "Early magic combat / splash→strike",
    minLevel: 1,
    maxLevel: 40,
    baseXpPerHour: 35_000,
    alsoTrains: { defence: 0.15, constitution: 0.25 },
    regions: ["free"],
    intensity: "afk",
    priority: 6,
  },
  {
    id: "mage-combat",
    skill: "magic",
    name: "Magic combat / burst tasks",
    minLevel: 40,
    maxLevel: 99,
    baseXpPerHour: 380_000,
    alsoTrains: { defence: 0.3, constitution: 0.4 },
    regions: ["free", "asgarnia", "desert"],
    intensity: "semi",
    priority: 4,
  },
  {
    id: "necro-quests-early",
    skill: "necromancy",
    name: "Necro quests + ritual ladder",
    minLevel: 1,
    maxLevel: 60,
    baseXpPerHour: 120_000,
    regions: ["misthalin", "free"],
    intensity: "semi",
    priority: 1,
    notes: "Priority path for OCOBCC / BOCBOO builds",
  },
  {
    id: "necro-rituals",
    skill: "necromancy",
    name: "Rituals (efficient)",
    minLevel: 20,
    maxLevel: 90,
    baseXpPerHour: 500_000,
    regions: ["free"],
    intensity: "semi",
    priority: 2,
  },
  {
    id: "necro-combat",
    skill: "necromancy",
    name: "Necro combat / Rasial attempts",
    minLevel: 70,
    maxLevel: 120,
    baseXpPerHour: 600_000,
    alsoTrains: { constitution: 0.35, defence: 0.25 },
    regions: ["free"],
    intensity: "semi",
    priority: 1,
    notes: "Also farm Omni + lantern",
  },
  {
    id: "prayer-bones-early",
    skill: "prayer",
    name: "Bones on altar / gilded",
    minLevel: 1,
    maxLevel: 70,
    baseXpPerHour: 400_000,
    regions: ["free", "asgarnia"],
    intensity: "clicky",
    priority: 3,
    needs: "Bones supply",
  },
  {
    id: "prayer-powder",
    skill: "prayer",
    name: "Powder of burials / high bones",
    minLevel: 70,
    maxLevel: 99,
    baseXpPerHour: 1_200_000,
    regions: ["free", "asgarnia"],
    intensity: "clicky",
    priority: 2,
  },
  {
    id: "summ-charms",
    skill: "summoning",
    name: "Charming + pouches (best available)",
    minLevel: 1,
    maxLevel: 99,
    baseXpPerHour: 800_000,
    regions: ["free", "asgarnia", "karamja"],
    intensity: "semi",
    priority: 3,
    needs: "Charms from combat",
  },

  // ── Gathering ──────────────────────────────────────────────────────
  {
    id: "mine-copper-tin",
    skill: "mining",
    name: "Copper/tin → iron",
    minLevel: 1,
    maxLevel: 30,
    baseXpPerHour: 30_000,
    regions: ["free"],
    intensity: "afk",
    priority: 5,
  },
  {
    id: "mine-coal-mith",
    skill: "mining",
    name: "Coal / mithril",
    minLevel: 30,
    maxLevel: 60,
    baseXpPerHour: 80_000,
    regions: ["free", "asgarnia", "fremennik"],
    intensity: "afk",
    priority: 4,
  },
  {
    id: "mine-orthen",
    skill: "mining",
    name: "Orthen / high-tier rocks",
    minLevel: 70,
    maxLevel: 110,
    baseXpPerHour: 250_000,
    regions: ["anachronia", "free"],
    intensity: "semi",
    priority: 2,
  },
  {
    id: "mine-alaea",
    skill: "mining",
    name: "Primal / late ore (best unlocked)",
    minLevel: 90,
    maxLevel: 110,
    baseXpPerHour: 400_000,
    regions: ["free", "anachronia", "forinthry"],
    intensity: "semi",
    priority: 1,
  },
  {
    id: "wc-trees",
    skill: "woodcutting",
    name: "Trees → oaks → willows",
    minLevel: 1,
    maxLevel: 40,
    baseXpPerHour: 40_000,
    regions: ["free"],
    intensity: "afk",
    priority: 5,
  },
  {
    id: "wc-maples-yews",
    skill: "woodcutting",
    name: "Maples / yews / magic",
    minLevel: 40,
    maxLevel: 80,
    baseXpPerHour: 120_000,
    regions: ["free", "kandarin", "tirannwn"],
    intensity: "afk",
    priority: 3,
  },
  {
    id: "wc-crystal-incan",
    skill: "woodcutting",
    name: "Crystal / incandescent / best tree",
    minLevel: 80,
    maxLevel: 110,
    baseXpPerHour: 300_000,
    regions: ["tirannwn", "free", "anachronia"],
    intensity: "semi",
    priority: 2,
  },
  {
    id: "fish-shrimp",
    skill: "fishing",
    name: "Shrimp → trout/salmon",
    minLevel: 1,
    maxLevel: 40,
    baseXpPerHour: 35_000,
    regions: ["free"],
    intensity: "afk",
    priority: 5,
  },
  {
    id: "fish-lob-shark",
    skill: "fishing",
    name: "Lobsters → sharks / cavefish",
    minLevel: 40,
    maxLevel: 80,
    baseXpPerHour: 90_000,
    regions: ["free", "karamja", "fremennik"],
    intensity: "afk",
    priority: 3,
  },
  {
    id: "fish-swarm",
    skill: "fishing",
    name: "Swarm / best late method",
    minLevel: 80,
    maxLevel: 99,
    baseXpPerHour: 250_000,
    regions: ["free", "anachronia", "fremennik"],
    intensity: "semi",
    priority: 2,
  },
  {
    id: "hunt-crimson",
    skill: "hunter",
    name: "Bird snares → deadfall",
    minLevel: 1,
    maxLevel: 50,
    baseXpPerHour: 50_000,
    regions: ["free", "karamja"],
    intensity: "semi",
    priority: 4,
  },
  {
    id: "hunt-grenwalls",
    skill: "hunter",
    name: "Grenwalls / box traps mid",
    minLevel: 50,
    maxLevel: 80,
    baseXpPerHour: 180_000,
    regions: ["tirannwn", "free", "anachronia"],
    intensity: "semi",
    priority: 3,
  },
  {
    id: "hunt-protean",
    skill: "hunter",
    name: "Best high Hunter (proteans / Big Game)",
    minLevel: 80,
    maxLevel: 99,
    baseXpPerHour: 400_000,
    regions: ["free", "anachronia", "havenhythe"],
    intensity: "semi",
    priority: 2,
  },
  {
    id: "farm-runs",
    skill: "farming",
    name: "Herb + tree runs (passive)",
    minLevel: 1,
    maxLevel: 120,
    baseXpPerHour: 150_000,
    regions: ["free", "any"],
    intensity: "semi",
    priority: 1,
    passive: true,
    notes: "League 5× grow speed — run often",
  },
  {
    id: "div-wisps",
    skill: "divination",
    name: "Wisps ladder (pale → luminous)",
    minLevel: 1,
    maxLevel: 70,
    baseXpPerHour: 60_000,
    regions: ["free"],
    intensity: "afk",
    priority: 4,
  },
  {
    id: "div-incan",
    skill: "divination",
    name: "Incandescent / best wisp",
    minLevel: 70,
    maxLevel: 99,
    baseXpPerHour: 200_000,
    regions: ["free", "asgarnia"],
    intensity: "semi",
    priority: 2,
  },
  {
    id: "arch-tutorial",
    skill: "archaeology",
    name: "Arch tutorial + early sites",
    minLevel: 1,
    maxLevel: 70,
    baseXpPerHour: 100_000,
    regions: ["free", "misthalin"],
    intensity: "semi",
    priority: 2,
  },
  {
    id: "arch-high",
    skill: "archaeology",
    name: "High-tier excavation",
    minLevel: 70,
    maxLevel: 120,
    baseXpPerHour: 350_000,
    regions: ["free", "desert", "anachronia", "asgarnia"],
    intensity: "semi",
    priority: 2,
  },

  // ── Artisan ────────────────────────────────────────────────────────
  {
    id: "cook-shrimp",
    skill: "cooking",
    name: "Cook fish ladder",
    minLevel: 1,
    maxLevel: 80,
    baseXpPerHour: 200_000,
    regions: ["free"],
    intensity: "afk",
    priority: 3,
    needs: "Raw fish from Fishing",
  },
  {
    id: "cook-high",
    skill: "cooking",
    name: "High fish / rocktails / best",
    minLevel: 80,
    maxLevel: 99,
    baseXpPerHour: 450_000,
    regions: ["free"],
    intensity: "afk",
    priority: 2,
  },
  {
    id: "fm-logs",
    skill: "firemaking",
    name: "Burn logs ladder",
    minLevel: 1,
    maxLevel: 90,
    baseXpPerHour: 300_000,
    regions: ["free"],
    intensity: "semi",
    priority: 3,
  },
  {
    id: "fm-incin",
    skill: "firemaking",
    name: "Incinerator / high FM",
    minLevel: 90,
    maxLevel: 99,
    baseXpPerHour: 700_000,
    regions: ["free", "asgarnia"],
    intensity: "clicky",
    priority: 2,
  },
  {
    id: "craft-leather",
    skill: "crafting",
    name: "Leather / jewellery early",
    minLevel: 1,
    maxLevel: 60,
    baseXpPerHour: 80_000,
    regions: ["free"],
    intensity: "semi",
    priority: 4,
  },
  {
    id: "craft-urns-glass",
    skill: "crafting",
    name: "Urns / glass / high craft",
    minLevel: 60,
    maxLevel: 99,
    baseXpPerHour: 350_000,
    regions: ["free", "asgarnia"],
    intensity: "semi",
    priority: 2,
  },
  {
    id: "fletch-arrows",
    skill: "fletching",
    name: "Arrows / bows ladder",
    minLevel: 1,
    maxLevel: 70,
    baseXpPerHour: 150_000,
    regions: ["free"],
    intensity: "afk",
    priority: 3,
  },
  {
    id: "fletch-broad",
    skill: "fletching",
    name: "Broad arrows / high fletch",
    minLevel: 70,
    maxLevel: 99,
    baseXpPerHour: 600_000,
    regions: ["free"],
    intensity: "afk",
    priority: 2,
  },
  {
    id: "smith-bronze",
    skill: "smithing",
    name: "Bronze → steel smithing",
    minLevel: 1,
    maxLevel: 50,
    baseXpPerHour: 80_000,
    regions: ["free"],
    intensity: "semi",
    priority: 4,
  },
  {
    id: "smith-corrupted",
    skill: "smithing",
    name: "Corrupted / burial / best smith",
    minLevel: 50,
    maxLevel: 110,
    baseXpPerHour: 500_000,
    regions: ["free", "asgarnia"],
    intensity: "semi",
    priority: 2,
  },
  {
    id: "herb-clean",
    skill: "herblore",
    name: "Clean herbs + early potions",
    minLevel: 1,
    maxLevel: 70,
    baseXpPerHour: 200_000,
    regions: ["free"],
    intensity: "clicky",
    priority: 3,
    needs: "Herbs from Farming/Slayer",
  },
  {
    id: "herb-overload",
    skill: "herblore",
    name: "Overloads / combination potions",
    minLevel: 70,
    maxLevel: 120,
    baseXpPerHour: 800_000,
    regions: ["free", "asgarnia"],
    intensity: "clicky",
    priority: 1,
    needs: "High herb supply — bottleneck skill",
  },
  {
    id: "rc-air",
    skill: "runecrafting",
    name: "Air → pure ess ladders",
    minLevel: 1,
    maxLevel: 70,
    baseXpPerHour: 50_000,
    regions: ["free"],
    intensity: "semi",
    priority: 5,
  },
  {
    id: "rc-abyss-soul",
    skill: "runecrafting",
    name: "Abyss / soul / best RC",
    minLevel: 70,
    maxLevel: 110,
    baseXpPerHour: 250_000,
    regions: ["free", "asgarnia", "forinthry"],
    intensity: "clicky",
    priority: 2,
  },
  {
    id: "con-planks",
    skill: "construction",
    name: "Plank make + flatpacks",
    minLevel: 1,
    maxLevel: 99,
    baseXpPerHour: 500_000,
    regions: ["free", "asgarnia"],
    intensity: "clicky",
    priority: 2,
    needs: "Logs + coins",
  },

  // ── Support ────────────────────────────────────────────────────────
  {
    id: "agi-gnome",
    skill: "agility",
    name: "Gnome → Draynor → Varrock courses",
    minLevel: 1,
    maxLevel: 50,
    baseXpPerHour: 30_000,
    regions: ["free"],
    intensity: "clicky",
    priority: 4,
  },
  {
    id: "agi-advanced",
    skill: "agility",
    name: "Advanced courses / best unlocked",
    minLevel: 50,
    maxLevel: 99,
    baseXpPerHour: 120_000,
    regions: ["free", "anachronia", "tirannwn", "asgarnia"],
    intensity: "clicky",
    priority: 2,
    notes: "Relic may double course XP",
  },
  {
    id: "thieve-men",
    skill: "thieving",
    name: "Pickpocket men → stalls",
    minLevel: 1,
    maxLevel: 50,
    baseXpPerHour: 40_000,
    regions: ["free"],
    intensity: "semi",
    priority: 4,
  },
  {
    id: "thieve-safecrack",
    skill: "thieving",
    name: "Safecracking / dwarves / best",
    minLevel: 50,
    maxLevel: 99,
    baseXpPerHour: 350_000,
    regions: ["free", "asgarnia", "fremennik"],
    intensity: "semi",
    priority: 2,
  },

  // ── Elite ──────────────────────────────────────────────────────────
  {
    id: "dg-floors",
    skill: "dungeoneering",
    name: "DG floors / Sinkholes / ED",
    minLevel: 1,
    maxLevel: 120,
    baseXpPerHour: 400_000,
    regions: ["free", "forinthry"],
    intensity: "semi",
    priority: 2,
    notes: "DG trader outside Wildy without Forinthry",
  },
  {
    id: "inv-disassemble",
    skill: "invention",
    name: "Disassemble + siphon (post-80s)",
    minLevel: 1,
    maxLevel: 120,
    baseXpPerHour: 300_000,
    regions: ["asgarnia", "free"],
    intensity: "semi",
    priority: 1,
    needs: "80 Craft/Smith/Div + Asgarnia ideal",
    notes: "Tutorial auto-complete at 80s — Asgarnia strongly preferred",
  },
];

export function skillById(id: SkillId): SkillMeta {
  return SKILLS.find((s) => s.id === id)!;
}

export function methodsForSkill(skill: SkillId): TrainingMethod[] {
  return METHODS.filter((m) => m.skill === skill || (m.alsoTrains && skill in m.alsoTrains));
}

export function methodXpForSkill(m: TrainingMethod, skill: SkillId): number {
  if (m.skill === skill) return m.baseXpPerHour;
  const frac = m.alsoTrains?.[skill];
  return frac ? m.baseXpPerHour * frac : 0;
}

/** Region tags unlocked from free + electives. */
export function unlockedTags(electives: readonly string[]): Set<RegionTag> {
  const s = new Set<RegionTag>(["free", "misthalin", "havenhythe", "karamja", "any"]);
  for (const e of electives) s.add(e as RegionTag);
  return s;
}

export function methodAvailable(m: TrainingMethod, unlocked: Set<RegionTag>): boolean {
  return m.regions.some((r) => r === "any" || unlocked.has(r));
}

export interface MethodPick {
  method: TrainingMethod;
  skill: SkillId;
  levelFrom: number;
  levelTo: number;
  baseXpHr: number;
  effectiveXpHr: number;
  hours: number;
  xpNeeded: number;
  leagueMult: number;
}

/** Best method for a skill at a given level with current unlocks. */
export function bestMethodAt(
  skill: SkillId,
  level: number,
  unlocked: Set<RegionTag>,
  leagueMult: number,
): { method: TrainingMethod; xpHr: number } | null {
  let best: TrainingMethod | null = null;
  let bestRate = 0;
  for (const m of METHODS) {
    if (level < m.minLevel || level > m.maxLevel) continue;
    if (!methodAvailable(m, unlocked)) continue;
    const rate = methodXpForSkill(m, skill);
    if (rate <= 0) continue;
    if (rate > bestRate || (rate === bestRate && m.priority < (best?.priority ?? 99))) {
      best = m;
      bestRate = rate;
    }
  }
  if (!best) return null;
  return { method: best, xpHr: bestRate * leagueMult };
}

/**
 * Ladder a single skill from start→goal: switch methods when better band opens.
 */
export function chartSkill(
  skill: SkillId,
  fromLevel: number,
  toLevel: number,
  electives: readonly string[],
  relicTier: number,
): MethodPick[] {
  const unlocked = unlockedTags(electives);
  const mult = leagueMultForRelicTier(relicTier);
  const picks: MethodPick[] = [];
  let lvl = fromLevel;
  while (lvl < toLevel) {
    const pick = bestMethodAt(skill, lvl, unlocked, mult);
    if (!pick) {
      // advance 1 level with zero method (gap)
      lvl++;
      continue;
    }
    // extend while same method remains best
    let end = lvl + 1;
    while (end <= toLevel) {
      const next = bestMethodAt(skill, end === toLevel ? end - 1 : end, unlocked, mult);
      if (!next || next.method.id !== pick.method.id) break;
      end++;
      if (end > toLevel) break;
    }
    const levelTo = Math.min(end, toLevel);
    const xpNeeded = xpBetween(lvl, levelTo);
    const eff = pick.xpHr;
    const hours = eff > 0 ? xpNeeded / eff : Infinity;
    picks.push({
      method: pick.method,
      skill,
      levelFrom: lvl,
      levelTo,
      baseXpHr: pick.xpHr / mult,
      effectiveXpHr: eff,
      hours,
      xpNeeded,
      leagueMult: mult,
    });
    lvl = levelTo;
  }
  return picks;
}

export interface SkillRouteSummary {
  skill: SkillId;
  name: string;
  from: number;
  to: number;
  totalHours: number;
  steps: MethodPick[];
  bestLateMethod: string;
  peakXpHr: number;
}

export function chartAllSkills(
  targets: Partial<Record<SkillId, number>>,
  electives: readonly string[],
  relicTier: number,
  fromLevel = 1,
): SkillRouteSummary[] {
  const out: SkillRouteSummary[] = [];
  for (const s of SKILLS) {
    const to = targets[s.id] ?? 0;
    if (to <= fromLevel) continue;
    const steps = chartSkill(s.id, fromLevel, Math.min(to, s.maxLevel), electives, relicTier);
    const totalHours = steps.reduce((a, b) => a + (Number.isFinite(b.hours) ? b.hours : 0), 0);
    const peak = steps.reduce((a, b) => Math.max(a, b.effectiveXpHr), 0);
    out.push({
      skill: s.id,
      name: s.name,
      from: fromLevel,
      to: Math.min(to, s.maxLevel),
      totalHours,
      steps,
      bestLateMethod: steps[steps.length - 1]?.method.name ?? "—",
      peakXpHr: peak,
    });
  }
  return out.sort((a, b) => b.totalHours - a.totalHours);
}

/** Recommended league play order phases (not pure XP — gated by utility). */
export interface RoutePhase {
  id: string;
  title: string;
  goal: string;
  estimatedHours: number;
  relicTier: number;
  electives: string[];
  priorities: { skill: string; to: number; method: string; why: string }[];
  notes: string[];
}

export function buildLeagueRoute(opts?: {
  combatPath?: "necro" | "melee" | "mage" | "ranged";
  electives?: string[];
}): RoutePhase[] {
  const combat = opts?.combatPath ?? "necro";
  const electives = opts?.electives ?? ["asgarnia", "desert", "forinthry"];

  const phases: RoutePhase[] = [];

  // Phase 1 — free only, T1 mult 5x
  {
    const e: string[] = [];
    const herb = chartSkill("herblore", 1, 70, e, 1);
    const necro = chartSkill("necromancy", 1, 80, e, 1);
    const combatS = chartSkill("attack", 1, 70, e, 1);
    const prayer = chartSkill("prayer", 1, 70, e, 1);
    const hours =
      herb.reduce((a, b) => a + b.hours, 0) * 0.5 +
      necro.reduce((a, b) => a + b.hours, 0) +
      combatS.reduce((a, b) => a + b.hours, 0) * 0.3 +
      prayer.reduce((a, b) => a + b.hours, 0) * 0.4;
    phases.push({
      id: "p1-free",
      title: "Phase 1 — Free regions (Misthalin / Havenhythe / Karamja)",
      goal: "Unlock first blessings, Rasial attempts, early 70s combat",
      estimatedHours: Math.round(hours * 10) / 10,
      relicTier: 1,
      electives: [],
      priorities: [
        {
          skill: "Necromancy",
          to: 80,
          method: necro[0]?.method.name ?? "Rituals",
          why: "Weapons + style for winning builds",
        },
        {
          skill: "Slayer / combat",
          to: 70,
          method: "Early Slayer tasks",
          why: "League points + charms + supplies",
        },
        {
          skill: "Herblore",
          to: 70,
          method: herb.map((s) => s.method.name).join(" → "),
          why: "Overloads later; start herb bank now",
        },
        {
          skill: "Prayer",
          to: 70,
          method: prayer.map((s) => s.method.name).join(" → "),
          why: "Curses / damage prayers",
        },
        {
          skill: "Farming",
          to: 50,
          method: "Herb + tree runs",
          why: "Passive with 5× grow — never skip runs",
        },
      ],
      notes: [
        "Karamja unlocks at first task milestone automatically.",
        "Camp Rasial as soon as kills are possible for Omni + lantern.",
        "Blessing: start T1 Order (Aegis) for OCOBCC path.",
      ],
    });
  }

  // Phase 2 — Asgarnia
  {
    const e = [electives[0]!];
    const inv = chartSkill("invention", 1, 80, e, 2);
    const craft = chartSkill("crafting", 1, 80, e, 2);
    const smith = chartSkill("smithing", 1, 80, e, 2);
    const div = chartSkill("divination", 1, 80, e, 2);
    const hours =
      inv.reduce((a, b) => a + b.hours, 0) +
      (craft.reduce((a, b) => a + b.hours, 0) +
        smith.reduce((a, b) => a + b.hours, 0) +
        div.reduce((a, b) => a + b.hours, 0)) *
        0.35;
    phases.push({
      id: "p2-asgarnia",
      title: `Phase 2 — Unlock ${electives[0] ?? "Asgarnia"} (recommended first)`,
      goal: "Invention + jewellery + mid PvM access",
      estimatedHours: Math.round(hours * 10) / 10,
      relicTier: 2,
      electives: e,
      priorities: [
        {
          skill: "Crafting / Smithing / Div",
          to: 80,
          method: "Best unlocked artisan methods",
          why: "Invention gate",
        },
        {
          skill: "Invention",
          to: 80,
          method: inv.map((s) => s.method.name).join(" → "),
          why: "Perks — permanent DPS & skilling",
        },
        {
          skill: combat === "necro" ? "Necromancy" : "Combat",
          to: 95,
          method: combat === "necro" ? "Rasial / necro combat" : "Slayer + combat camp",
          why: "T95 weapons + style depth",
        },
        {
          skill: "Herblore",
          to: 96,
          method: "Overloads path",
          why: "Mandatory for late PvM",
        },
      ],
      notes: [
        "Asgarnia: RoD, Souls/EOF, GWD, Invention heartland.",
        "XP mult should be 8× after T2 relic.",
        "Keep farming runs; herb is the long bottleneck.",
      ],
    });
  }

  // Phase 3 — second elective
  {
    const e = electives.slice(0, 2);
    const arch = chartSkill("archaeology", 1, 90, e, 4);
    const dg = chartSkill("dungeoneering", 1, 80, e, 4);
    const hours =
      arch.reduce((a, b) => a + b.hours, 0) * 0.4 + dg.reduce((a, b) => a + b.hours, 0) * 0.3 + 8;
    phases.push({
      id: "p3-second",
      title: `Phase 3 — Unlock ${electives[1] ?? "Desert"}`,
      goal: "Fill gear gaps (Achtó / raids / wildy) + push 99s",
      estimatedHours: Math.round(hours * 10) / 10,
      relicTier: 4,
      electives: e,
      priorities: [
        {
          skill: "All combat 99",
          to: 99,
          method: "High Slayer + reaper",
          why: "Damage + tasks for points",
        },
        {
          skill: "Archaeology",
          to: 90,
          method: arch.map((s) => s.method.name).join(" → "),
          why: "Relics / chronotes / power",
        },
        {
          skill: "Dungeoneering",
          to: 80,
          method: dg.map((s) => s.method.name).join(" → "),
          why: "Chaotics / tokens without full Wildy",
        },
        {
          skill: "Summoning",
          to: 99,
          method: "Pouch spam from charm bank",
          why: "Familiar DPS / utility",
        },
      ],
      notes: [
        "12× XP at T4 — burn artisan 99s here.",
        "Desert: Achtó / Heart. Forinthry: boots / DG ecosystem.",
      ],
    });
  }

  // Phase 4 — third elective + max
  {
    const e = electives.slice(0, 3);
    const targets: Partial<Record<SkillId, number>> = {};
    for (const s of SKILLS) targets[s.id] = s.maxLevel >= 99 ? 99 : s.maxLevel;
    targets.necromancy = 120;
    targets.invention = 120;
    targets.slayer = 120;
    targets.herblore = 120;
    targets.farming = 120;
    targets.archaeology = 120;
    targets.dungeoneering = 120;
    targets.mining = 110;
    targets.smithing = 110;
    targets.woodcutting = 110;
    targets.runecrafting = 110;

    const all = chartAllSkills(targets, e, 6, 1);
    // residual hours rough: assume half already done in earlier phases
    const residual = all.reduce((a, b) => a + b.totalHours, 0) * 0.35;
    phases.push({
      id: "p4-max",
      title: `Phase 4 — Unlock ${electives[2] ?? "Forinthry"} + max push`,
      goal: "120 elites + remaining 99s under 16×",
      estimatedHours: Math.round(residual * 10) / 10,
      relicTier: 6,
      electives: e,
      priorities: all.slice(0, 8).map((s) => ({
        skill: s.name,
        to: s.to,
        method: s.bestLateMethod,
        why: `Slowest remaining (~${s.totalHours.toFixed(1)}h full ladder at 16×)`,
      })),
      notes: [
        "16× XP — finish slow skills (RC, Agility, Arch, Invention 120).",
        "Combat path OCOBCC (ST) or BOCBOO (multi) should be complete.",
        "Passive farming runs continue forever.",
      ],
    });
  }

  return phases;
}

/** Compact top-method table: skill → level bands → best method. */
export function topMethodMatrix(
  electives: readonly string[],
  relicTier: number,
): {
  skill: SkillId;
  name: string;
  bands: { range: string; method: string; xpHr: number; intensity: string }[];
}[] {
  const unlocked = unlockedTags(electives);
  const mult = leagueMultForRelicTier(relicTier);
  const checkpoints = [1, 30, 50, 70, 90, 99, 110, 120];
  return SKILLS.map((s) => {
    const bands: { range: string; method: string; xpHr: number; intensity: string }[] = [];
    for (let i = 0; i < checkpoints.length - 1; i++) {
      const lo = checkpoints[i]!;
      const hi = checkpoints[i + 1]!;
      if (lo >= s.maxLevel) break;
      const mid = Math.min(lo + 1, s.maxLevel - 1);
      const pick = bestMethodAt(s.id, mid, unlocked, mult);
      if (!pick) continue;
      // skip duplicate consecutive
      const prev = bands[bands.length - 1];
      if (prev && prev.method === pick.method.name) {
        prev.range = `${prev.range.split("–")[0]}–${Math.min(hi, s.maxLevel)}`;
        continue;
      }
      bands.push({
        range: `${lo}–${Math.min(hi, s.maxLevel)}`,
        method: pick.method.name,
        xpHr: Math.round(pick.xpHr),
        intensity: pick.method.intensity,
      });
    }
    return { skill: s.id, name: s.name, bands };
  });
}
