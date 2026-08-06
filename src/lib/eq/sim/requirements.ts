/**
 * OOP requirement graph for Equilibrium progression.
 * Every training method / unlock is gated by composable requirements.
 */

import type { SkillId } from "../xp";

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

/** Mutable player snapshot the simulator evaluates against. */
export interface PlayerSnapshot {
  levels: Partial<Record<SkillId, number>>;
  regions: ReadonlySet<RegionTag>;
  quests: ReadonlySet<string>;
  /** Soft unlocks / mysteries / tutorials */
  flags: ReadonlySet<string>;
  relicTier: number;
}

export abstract class Requirement {
  abstract id: string;
  abstract satisfied(p: PlayerSnapshot): boolean;
  abstract describe(): string;
}

export class SkillReq extends Requirement {
  readonly id: string;
  constructor(
    public readonly skill: SkillId,
    public readonly level: number,
  ) {
    super();
    this.id = `skill:${skill}:${level}`;
  }
  satisfied(p: PlayerSnapshot): boolean {
    return (p.levels[this.skill] ?? 1) >= this.level;
  }
  describe(): string {
    return `${this.skill} ${this.level}+`;
  }
}

export class RegionReq extends Requirement {
  readonly id: string;
  constructor(public readonly region: RegionTag) {
    super();
    this.id = `region:${region}`;
  }
  satisfied(p: PlayerSnapshot): boolean {
    if (this.region === "any" || this.region === "free") {
      return (
        p.regions.has("free") ||
        p.regions.has("misthalin") ||
        p.regions.has("any")
      );
    }
    return p.regions.has(this.region) || p.regions.has("any");
  }
  describe(): string {
    return `region:${this.region}`;
  }
}

/** Any one of the listed regions is enough. */
export class AnyRegionReq extends Requirement {
  readonly id: string;
  constructor(public readonly regions: RegionTag[]) {
    super();
    this.id = `regions-any:${regions.join("|")}`;
  }
  satisfied(p: PlayerSnapshot): boolean {
    return this.regions.some((r) => new RegionReq(r).satisfied(p));
  }
  describe(): string {
    return `region ∈ {${this.regions.join(", ")}}`;
  }
}

export class QuestReq extends Requirement {
  readonly id: string;
  constructor(
    public readonly questId: string,
    public readonly questName: string,
  ) {
    super();
    this.id = `quest:${questId}`;
  }
  satisfied(p: PlayerSnapshot): boolean {
    return p.quests.has(this.questId);
  }
  describe(): string {
    return `quest:${this.questName}`;
  }
}

export class FlagReq extends Requirement {
  readonly id: string;
  constructor(
    public readonly flag: string,
    public readonly label: string,
  ) {
    super();
    this.id = `flag:${flag}`;
  }
  satisfied(p: PlayerSnapshot): boolean {
    return p.flags.has(this.flag);
  }
  describe(): string {
    return this.label;
  }
}

export class AllReq extends Requirement {
  readonly id: string;
  constructor(public readonly parts: Requirement[]) {
    super();
    this.id = `all(${parts.map((p) => p.id).join("&")})`;
  }
  satisfied(p: PlayerSnapshot): boolean {
    return this.parts.every((r) => r.satisfied(p));
  }
  describe(): string {
    return this.parts.map((p) => p.describe()).join(" AND ");
  }
}

export class AnyReq extends Requirement {
  readonly id: string;
  constructor(public readonly parts: Requirement[]) {
    super();
    this.id = `any(${parts.map((p) => p.id).join("|")})`;
  }
  satisfied(p: PlayerSnapshot): boolean {
    return this.parts.some((r) => r.satisfied(p));
  }
  describe(): string {
    return this.parts.map((p) => p.describe()).join(" OR ");
  }
}

export class RelicTierReq extends Requirement {
  readonly id: string;
  constructor(public readonly minTier: number) {
    super();
    this.id = `relic:${minTier}`;
  }
  satisfied(p: PlayerSnapshot): boolean {
    return p.relicTier >= this.minTier;
  }
  describe(): string {
    return `relic tier ${this.minTier}+`;
  }
}

/** Missing pieces for UI / debug. */
export function unsatisfied(req: Requirement, p: PlayerSnapshot): string[] {
  if (req.satisfied(p)) return [];
  if (req instanceof AllReq) {
    return req.parts.flatMap((r) => unsatisfied(r, p));
  }
  if (req instanceof AnyReq) {
    // all alternatives failed
    return [`need one of: ${req.describe()}`];
  }
  return [req.describe()];
}

// ── Well-known unlock bundles ────────────────────────────────────────

/** 80 Craft + Smith + Div (unboostable). Tutorial auto-completes in Equilibrium once skills met. */
export const INVENTION_SKILL_GATES = new AllReq([
  new SkillReq("crafting", 80),
  new SkillReq("smithing", 80),
  new SkillReq("divination", 80),
]);

/** Invention Guild is NE of Falador → Asgarnia. */
export const INVENTION_REGION = new RegionReq("asgarnia");

export const INVENTION_UNLOCK = new AllReq([
  INVENTION_SKILL_GATES,
  INVENTION_REGION,
  new FlagReq("invention_tutorial", "Invention tutorial (auto in league at 80s)"),
]);

/**
 * Ancient Invention (wiki + Equilibrium Kandarin page):
 * Stormguard Citadel Dig Site is listed under Kandarin, "including Ancient Invention".
 * - 85 Invention for ancient gizmos
 * - 95 Archaeology + Howl's Floating Workshop path for blueprints at Stormguard
 * - Portal via Temple of Ikov (Kandarin)
 */
export const ANCIENT_INVENTION_UNLOCK = new AllReq([
  new SkillReq("invention", 85),
  new SkillReq("archaeology", 95),
  new RegionReq("kandarin"),
  new FlagReq("howls_floating_workshop", "Howl's Floating Workshop / Stormguard blueprints"),
]);

export const FREE_REGIONS: RegionTag[] = [
  "free",
  "misthalin",
  "havenhythe",
  "karamja",
];

export function regionsFromElectives(electives: readonly string[]): Set<RegionTag> {
  const s = new Set<RegionTag>(FREE_REGIONS);
  s.add("any"); // "any" only for methods that truly have no region need — we use sparingly
  s.delete("any");
  for (const e of electives) s.add(e as RegionTag);
  return s;
}
