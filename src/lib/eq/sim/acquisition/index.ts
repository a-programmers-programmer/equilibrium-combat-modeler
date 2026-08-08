/**
 * Acquisition domain — public API.
 *
 * Layout:
 *   math.ts        pure kill/hour math + constants
 *   drops.ts       DROP_SOURCES + calcDrop
 *   types.ts       shared types
 *   components.ts  declarative component catalog
 *   recipes.ts     build → component ids
 *   cost.ts        cost one component
 *   plan.ts        wall-clock plan
 */

export * from "./math";
export * from "./drops";
export * from "./types";
export * from "./components";
export * from "./recipes";
export * from "./cost";
export * from "./plan";

// Re-export passives used by scripts for convenience
export {
  LEAGUE_TIER_PASSIVES,
  RARE_MULT_SCENARIOS,
  relicLadderHours,
  blessingTrackHours,
} from "../league-passives";
