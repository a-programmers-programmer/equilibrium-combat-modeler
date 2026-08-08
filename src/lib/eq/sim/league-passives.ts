/**
 * Equilibrium league tier passives — XP mult + rare drop mult.
 *
 * Wiki (Equilibrium League main page, tier passives):
 * Rare items become more common as league tier rises:
 *   early  → 2×
 *   mid    → 4×  (alongside 12× XP band)
 *   late   → 6×
 *   T6+    → 8×  (alongside 16× XP)
 *
 * Aligns with Catalyst-style rare multipliers; Equilibrium wiki lists
 * 2× / 4× / 6× / 8× rare boosts on successive tier unlocks.
 */

export interface LeagueTierPassive {
  leagueTier: number;
  label: string;
  xpMult: number;
  rareMult: number;
  notes: string;
}

/** Approximate mapping relic/league tier → passives */
export const LEAGUE_TIER_PASSIVES: LeagueTierPassive[] = [
  { leagueTier: 1, label: "T1 start", xpMult: 5, rareMult: 1, notes: "Base before rare passive" },
  { leagueTier: 2, label: "T2", xpMult: 8, rareMult: 2, notes: "Rares 2× more common" },
  { leagueTier: 3, label: "T3", xpMult: 8, rareMult: 2, notes: "Rares still 2×" },
  { leagueTier: 4, label: "T4", xpMult: 12, rareMult: 4, notes: "Rares 4×; 12× XP" },
  { leagueTier: 5, label: "T5", xpMult: 12, rareMult: 4, notes: "Rares 4×" },
  { leagueTier: 6, label: "T6", xpMult: 16, rareMult: 6, notes: "Rares 6×; 16× XP starts" },
  { leagueTier: 7, label: "T7", xpMult: 16, rareMult: 8, notes: "Rares 8× at apex" },
];

export function rareMultAtTier(leagueTier: number): number {
  let m = 1;
  for (const row of LEAGUE_TIER_PASSIVES) {
    if (leagueTier >= row.leagueTier) m = row.rareMult;
  }
  return m;
}

export function xpMultAtTier(leagueTier: number): number {
  let m = 5;
  for (const row of LEAGUE_TIER_PASSIVES) {
    if (leagueTier >= row.leagueTier) m = row.xpMult;
  }
  return m;
}

/**
 * When farming endgame uniques you typically have T4–T7.
 * Default "endgame farm" rare mult = 6× (T6), with sensitivity 2/4/6/8.
 */
export const RARE_MULT_SCENARIOS = {
  noBoost: 1,
  earlyT2: 2,
  midT4: 4,
  lateT6: 6,
  apexT7: 8,
} as const;

/**
 * Relic ladder: league points / tasks to unlock each tier.
 * Not pure XP — calibrated from community routes (Wazzy-style above-avg).
 * Hours are exclusive wall-clock for tier unlock tasks after prior tier.
 */
export interface RelicTierUnlock {
  tier: number;
  exclusiveHours: number;
  notes: string;
}

export const RELIC_TIER_UNLOCKS: RelicTierUnlock[] = [
  { tier: 1, exclusiveHours: 0.5, notes: "Tutorial + first tasks" },
  { tier: 2, exclusiveHours: 1.2, notes: "Early combat/skilling tasks" },
  { tier: 3, exclusiveHours: 1.5, notes: "Mid tasks / first bosses" },
  { tier: 4, exclusiveHours: 1.8, notes: "Region tasks start stacking" },
  { tier: 5, exclusiveHours: 2.0, notes: "Devout tier — combat heavy" },
  { tier: 6, exclusiveHours: 2.2, notes: "Rejuvenated/Perkfection gate" },
  { tier: 7, exclusiveHours: 2.5, notes: "Apex combat relic tasks" },
];

/** Sum T1→Tmax exclusive (default T7 = full ladder) */
export function relicLadderHours(toTier = 7): number {
  return RELIC_TIER_UNLOCKS.filter((r) => r.tier <= toTier).reduce(
    (a, r) => a + r.exclusiveHours,
    0,
  );
}

/**
 * Blessing track: path picks need league progress / combat milestones.
 * Modeled as progressive unlocks alongside combat, with exclusive overhead.
 */
export interface BlessingTrackStep {
  id: string;
  exclusiveHours: number;
  notes: string;
}

export const BLESSING_AEGIS_TRACK: BlessingTrackStep[] = [
  { id: "path-t1-aegis", exclusiveHours: 0.8, notes: "Order T1 → Teragard foundation" },
  { id: "path-t2-cinders", exclusiveHours: 0.8, notes: "Chaos T2 → Abyssal Cinders" },
  { id: "path-t3-fervor", exclusiveHours: 0.9, notes: "Order T3 → Sacred Fervor" },
  { id: "god-t4-trueeq", exclusiveHours: 1.0, notes: "Balance God / True Equilibrium" },
  { id: "path-t5-crit", exclusiveHours: 0.9, notes: "Chaos mid → Unholy Critual" },
  { id: "path-t6-perf", exclusiveHours: 1.0, notes: "Chaos/Order → Perfidious / Light" },
];

export function blessingTrackHours(track: BlessingTrackStep[] = BLESSING_AEGIS_TRACK): number {
  return track.reduce((a, s) => a + s.exclusiveHours, 0);
}

/**
 * Boss learn tax: first kills are slower.
 * effectiveKph = kph * (1 - learnPenalty * e^(-kills/learnHalfLife))
 * For EV hours we inflate rate by learnFactor on expected kills.
 */
export function learnTaxHours(
  expectedKills: number,
  peakKph: number,
  opts?: { learnKills?: number; slowFactor?: number },
): number {
  const learnKills = opts?.learnKills ?? 25;
  const slowFactor = opts?.slowFactor ?? 0.55; // first kills at 55% speed
  if (expectedKills <= 0) return 0;
  const learn = Math.min(expectedKills, learnKills);
  const rest = Math.max(0, expectedKills - learnKills);
  const learnHours = learn / (peakKph * slowFactor);
  const restHours = rest / peakKph;
  return learnHours + restHours;
}
