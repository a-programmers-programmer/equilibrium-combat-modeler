/**
 * Player state for the Equilibrium progression simulator.
 */

import type { SkillId } from "../xp";
import { SKILLS, xpForLevel, levelFromXp, leagueMultForRelicTier } from "../xp";
import {
  type PlayerSnapshot,
  type RegionTag,
  regionsFromElectives,
  INVENTION_UNLOCK,
  ANCIENT_INVENTION_UNLOCK,
  FREE_REGIONS,
} from "./requirements";

export class Player {
  levels: Record<SkillId, number>;
  xp: Record<SkillId, number>;
  regions: Set<RegionTag>;
  quests: Set<string>;
  flags: Set<string>;
  relicTier: number;
  hours: number;
  log: string[];

  constructor(opts?: {
    electives?: readonly string[];
    relicTier?: number;
    levels?: Partial<Record<SkillId, number>>;
  }) {
    this.levels = {} as Record<SkillId, number>;
    this.xp = {} as Record<SkillId, number>;
    for (const s of SKILLS) {
      const lvl = opts?.levels?.[s.id] ?? 1;
      this.levels[s.id] = lvl;
      this.xp[s.id] = xpForLevel(lvl);
    }
    this.regions = regionsFromElectives(opts?.electives ?? []);
    // free regions always present
    for (const r of FREE_REGIONS) this.regions.add(r);
    this.quests = new Set();
    this.flags = new Set();
    this.relicTier = opts?.relicTier ?? 1;
    this.hours = 0;
    this.log = [];
  }

  snapshot(): PlayerSnapshot {
    return {
      levels: { ...this.levels },
      regions: this.regions,
      quests: this.quests,
      flags: this.flags,
      relicTier: this.relicTier,
    };
  }

  level(skill: SkillId): number {
    return this.levels[skill] ?? 1;
  }

  setLevel(skill: SkillId, level: number): void {
    const meta = SKILLS.find((s) => s.id === skill);
    const cap = meta?.maxLevel ?? 99;
    const lvl = Math.max(1, Math.min(level, cap));
    this.levels[skill] = lvl;
    this.xp[skill] = xpForLevel(lvl);
  }

  addXp(skill: SkillId, amount: number): number {
    const meta = SKILLS.find((s) => s.id === skill);
    const cap = meta?.maxLevel ?? 99;
    const before = this.levels[skill] ?? 1;
    this.xp[skill] = (this.xp[skill] ?? 0) + amount;
    const maxXp = xpForLevel(cap);
    if (this.xp[skill]! > maxXp) this.xp[skill] = maxXp;
    this.levels[skill] = Math.min(cap, levelFromXp(this.xp[skill]!));
    return (this.levels[skill] ?? 1) - before;
  }

  unlockRegion(region: RegionTag): void {
    this.regions.add(region);
    this.log.push(`Unlocked region: ${region}`);
  }

  completeQuest(id: string, name?: string): void {
    this.quests.add(id);
    this.log.push(`Quest: ${name ?? id}`);
  }

  setFlag(flag: string, label?: string): void {
    this.flags.add(flag);
    this.log.push(`Flag: ${label ?? flag}`);
  }

  setRelicTier(tier: number): void {
    this.relicTier = tier;
    this.log.push(`Relic tier → ${tier} (${leagueMultForRelicTier(tier)}× XP)`);
  }

  /** Auto-grant league freebies when skill gates are met. */
  syncAutoUnlocks(): void {
    const snap = this.snapshot();
    // Invention tutorial auto-completes in Equilibrium once 80s met AND Asgarnia
    if (
      (this.level("crafting") >= 80 &&
        this.level("smithing") >= 80 &&
        this.level("divination") >= 80 &&
        this.regions.has("asgarnia")) &&
      !this.flags.has("invention_tutorial")
    ) {
      this.setFlag("invention_tutorial", "Invention tutorial auto-complete");
    }
    // Howl's workshop: model as available once Arch 95 + Kandarin (mystery grind abstracted)
    if (
      this.level("archaeology") >= 95 &&
      this.regions.has("kandarin") &&
      this.level("invention") >= 85 &&
      !this.flags.has("howls_floating_workshop")
    ) {
      this.setFlag(
        "howls_floating_workshop",
        "Howl's Floating Workshop / Stormguard (Kandarin)",
      );
    }
    void snap;
  }

  hasInvention(): boolean {
    return INVENTION_UNLOCK.satisfied(this.snapshot());
  }

  hasAncientInvention(): boolean {
    return ANCIENT_INVENTION_UNLOCK.satisfied(this.snapshot());
  }

  leagueMult(): number {
    return leagueMultForRelicTier(this.relicTier);
  }
}
