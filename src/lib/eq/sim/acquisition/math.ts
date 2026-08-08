/** Pure drop / kill math — no game data. */

export function expectedKills(rateDenom: number): number {
  return rateDenom;
}

export function geometricQuantile(rateDenom: number, p: number): number {
  const pr = 1 / rateDenom;
  if (pr >= 1) return 1;
  return Math.ceil(Math.log(1 - p) / Math.log(1 - pr));
}

export function couponCollectorKills(
  uniqueRateDenom: number,
  distinctItems: number,
): number {
  let H = 0;
  for (let i = 1; i <= distinctItems; i++) H += 1 / i;
  return uniqueRateDenom * H;
}

export function couponCollectorP90(
  uniqueRateDenom: number,
  distinctItems: number,
): number {
  return (
    couponCollectorKills(uniqueRateDenom, distinctItems) *
    (1.35 + 0.05 * Math.min(distinctItems, 6))
  );
}

export function hoursFromKills(kills: number, killsPerHour: number): number {
  return kills / Math.max(0.1, killsPerHour);
}

export const COMBAT_SKILLS = [
  "attack",
  "strength",
  "defence",
  "constitution",
  "necromancy",
  "magic",
  "ranged",
  "slayer",
] as const;

export const STARTER_REGIONS = [
  "free",
  "misthalin",
  "havenhythe",
  "karamja",
] as const;

export const ELECTIVE_REGIONS = [
  "forinthry",
  "asgarnia",
  "kandarin",
  "tirannwn",
  "desert",
  "anachronia",
] as const;

export const MIN_COMPONENT_HOURS = 0.15;
export const PARALLEL_COMBAT_EFFICIENCY = 0.85;
export const COMBAT_BUNDLE_FACTOR = 1.2;
