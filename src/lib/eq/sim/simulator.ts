/**
 * Equilibrium progression simulator (OOP).
 * Trains skills only when method requirements are fully satisfied.
 */

import type { SkillId } from "../xp";
import { SKILLS, xpBetween, leagueMultForRelicTier } from "../xp";
import { Player } from "./player";
import { TRAIN_METHODS, xpForSkill, type TrainMethod } from "./methods";
import {
  unsatisfied,
  INVENTION_UNLOCK,
  ANCIENT_INVENTION_UNLOCK,
  type RegionTag,
  type Requirement,
} from "./requirements";

export interface MethodChoice {
  method: TrainMethod;
  skill: SkillId;
  xpHr: number;
  missing: string[];
  available: boolean;
}

export class ProgressionSim {
  constructor(public player: Player) {}

  availableMethods(skill: SkillId, atLevel?: number): MethodChoice[] {
    const lvl = atLevel ?? this.player.level(skill);
    const snap = this.player.snapshot();
    const mult = this.player.leagueMult();
    const out: MethodChoice[] = [];
    for (const m of TRAIN_METHODS) {
      const rate = xpForSkill(m, skill);
      if (rate <= 0) continue;
      if (lvl < m.minLevel || lvl > m.maxLevel) continue;
      const missing = unsatisfied(m.requires, snap);
      out.push({
        method: m,
        skill,
        xpHr: rate * mult,
        missing,
        available: missing.length === 0,
      });
    }
    return out.sort((a, b) => {
      if (a.available !== b.available) return a.available ? -1 : 1;
      return b.xpHr - a.xpHr || a.method.priority - b.method.priority;
    });
  }

  bestMethod(skill: SkillId, atLevel?: number): MethodChoice | null {
    const all = this.availableMethods(skill, atLevel);
    return all.find((m) => m.available) ?? null;
  }

  /**
   * Train a skill toward a target level using best available methods.
   * Returns hours spent and steps taken.
   */
  trainTo(
    skill: SkillId,
    targetLevel: number,
    opts?: { maxHours?: number; onStep?: (msg: string) => void },
  ): {
    hours: number;
    reached: number;
    steps: {
      method: string;
      from: number;
      to: number;
      hours: number;
      xpHr: number;
    }[];
    blocked?: string[];
  } {
    const meta = SKILLS.find((s) => s.id === skill)!;
    const cap = Math.min(targetLevel, meta.maxLevel);
    const steps: {
      method: string;
      from: number;
      to: number;
      hours: number;
      xpHr: number;
    }[] = [];
    let hours = 0;
    const maxH = opts?.maxHours ?? 1e9;

    while (this.player.level(skill) < cap && hours < maxH) {
      this.player.syncAutoUnlocks();
      const lvl = this.player.level(skill);
      const choice = this.bestMethod(skill, lvl);
      if (!choice) {
        const blocked = this.availableMethods(skill, lvl)
          .slice(0, 3)
          .flatMap((c) => c.missing);
        opts?.onStep?.(`BLOCKED ${skill} @${lvl}: ${[...new Set(blocked)].join("; ")}`);
        return {
          hours,
          reached: lvl,
          steps,
          blocked: [...new Set(blocked)],
        };
      }

      // Find how far this method remains best
      let end = lvl + 1;
      while (end <= cap) {
        const mid = Math.min(end, cap - 1);
        const next = this.bestMethod(skill, mid);
        if (!next || next.method.id !== choice.method.id) break;
        end++;
        if (end > cap) break;
      }
      const to = Math.min(end, cap);
      const xpNeed = xpBetween(lvl, to);
      const h = choice.xpHr > 0 ? xpNeed / choice.xpHr : Infinity;
      if (!Number.isFinite(h)) break;

      // Apply XP (also-trains simplified: primary only for level accuracy)
      this.player.addXp(skill, xpNeed);
      // also-trains proportional
      if (choice.method.alsoTrains) {
        for (const [sk, frac] of Object.entries(choice.method.alsoTrains)) {
          this.player.addXp(sk as SkillId, xpNeed * (frac as number));
        }
      }
      hours += h;
      this.player.hours += h;
      steps.push({
        method: choice.method.name,
        from: lvl,
        to: this.player.level(skill),
        hours: h,
        xpHr: choice.xpHr,
      });
      opts?.onStep?.(
        `${skill} ${lvl}→${this.player.level(skill)} via ${choice.method.name} (${h.toFixed(2)}h)`,
      );
      this.player.syncAutoUnlocks();
    }

    return { hours, reached: this.player.level(skill), steps };
  }

  unlockElective(region: RegionTag): void {
    this.player.unlockRegion(region);
    this.player.syncAutoUnlocks();
  }

  setRelic(tier: number): void {
    this.player.setRelicTier(tier);
  }

  inventionStatus(): {
    standard: boolean;
    ancient: boolean;
    missingStandard: string[];
    missingAncient: string[];
  } {
    const snap = this.player.snapshot();
    return {
      standard: INVENTION_UNLOCK.satisfied(snap),
      ancient: ANCIENT_INVENTION_UNLOCK.satisfied(snap),
      missingStandard: unsatisfied(INVENTION_UNLOCK, snap),
      missingAncient: unsatisfied(ANCIENT_INVENTION_UNLOCK, snap),
    };
  }
}

export interface PhaseResult {
  id: string;
  title: string;
  hours: number;
  actions: string[];
  invention: ReturnType<ProgressionSim["inventionStatus"]>;
  levels: Partial<Record<SkillId, number>>;
}

/**
 * Simulate a full league route with correct gates.
 * Default combat package Asgarnia+Desert+Forinthry does NOT unlock Ancient Invention
 * (needs Kandarin). Optional path swaps Desert for Kandarin.
 */
export function simulateLeagueRoute(opts?: {
  electives?: RegionTag[];
  wantAncientInvention?: boolean;
}): {
  phases: PhaseResult[];
  totalHours: number;
  finalInvention: ReturnType<ProgressionSim["inventionStatus"]>;
  notes: string[];
} {
  const wantAncient = opts?.wantAncientInvention ?? false;
  let electives: RegionTag[] = (opts?.electives as RegionTag[]) ?? [
    "asgarnia",
    "desert",
    "forinthry",
  ];
  if (wantAncient && !electives.includes("kandarin")) {
    // swap desert → kandarin by default for ancient path
    electives = ["asgarnia", "kandarin", electives.find((e) => e !== "asgarnia" && e !== "kandarin") ?? "forinthry"];
  }

  const player = new Player({ electives: [], relicTier: 1 });
  const sim = new ProgressionSim(player);
  const phases: PhaseResult[] = [];
  const notes: string[] = [
    "Invention Guild = Asgarnia (hard).",
    "Ancient Invention / Stormguard = Kandarin (hard) — not free, not Asgarnia-only.",
    "Invention tutorial auto-completes in Equilibrium once 80 Craft/Smith/Div + Asgarnia.",
    "80 Craft/Smith/Div cannot be boosted.",
  ];
  if (wantAncient) {
    notes.push(`Ancient path electives: ${electives.join(", ")}`);
  } else {
    notes.push(
      `Combat path electives: ${electives.join(", ")} — Ancient Invention LOCKED without Kandarin.`,
    );
  }

  const pushPhase = (id: string, title: string, actions: string[], hours: number) => {
    player.syncAutoUnlocks();
    phases.push({
      id,
      title,
      hours,
      actions,
      invention: sim.inventionStatus(),
      levels: {
        necromancy: player.level("necromancy"),
        invention: player.level("invention"),
        crafting: player.level("crafting"),
        smithing: player.level("smithing"),
        divination: player.level("divination"),
        archaeology: player.level("archaeology"),
        herblore: player.level("herblore"),
        attack: player.level("attack"),
        prayer: player.level("prayer"),
      },
    });
  };

  // ── Phase 1 free ──
  {
    const actions: string[] = [];
    let h = 0;
    sim.setRelic(1);
    const n = sim.trainTo("necromancy", 80, { onStep: (m) => actions.push(m) });
    h += n.hours;
    const a = sim.trainTo("attack", 60, { onStep: (m) => actions.push(m) });
    h += a.hours;
    const herb = sim.trainTo("herblore", 70, { onStep: (m) => actions.push(m) });
    h += herb.hours;
    const pray = sim.trainTo("prayer", 70, { onStep: (m) => actions.push(m) });
    h += pray.hours;
    const farm = sim.trainTo("farming", 50, { onStep: (m) => actions.push(m) });
    h += farm.hours * 0.3; // passive credit
    // Try invention early — should BLOCK
    const invTry = sim.trainTo("invention", 10);
    if (invTry.blocked) {
      actions.push(`Invention correctly BLOCKED: ${invTry.blocked.join("; ")}`);
    }
    pushPhase("p1", "Phase 1 — Free regions only", actions, h);
  }

  // ── Phase 2 Asgarnia ──
  {
    const actions: string[] = [];
    let h = 0;
    sim.unlockElective("asgarnia");
    sim.setRelic(2);
    actions.push("Unlocked Asgarnia (Invention Guild, Artisans, Crafting Guild)");
    // Gate skills for invention
    for (const sk of ["crafting", "smithing", "divination"] as SkillId[]) {
      const r = sim.trainTo(sk, 80, { onStep: (m) => actions.push(m) });
      h += r.hours;
      if (r.blocked) actions.push(`${sk} blocked: ${r.blocked.join("; ")}`);
    }
    player.syncAutoUnlocks();
    const inv = sim.inventionStatus();
    actions.push(
      inv.standard
        ? "Invention UNLOCKED (80s + Asgarnia + tutorial flag)"
        : `Invention still locked: ${inv.missingStandard.join("; ")}`,
    );
    if (inv.standard) {
      const ir = sim.trainTo("invention", 80, { onStep: (m) => actions.push(m) });
      h += ir.hours;
    }
    const necro = sim.trainTo("necromancy", 95, { onStep: (m) => actions.push(m) });
    h += necro.hours;
    const herb = sim.trainTo("herblore", 96, { onStep: (m) => actions.push(m) });
    h += herb.hours;
    // Ancient should still be blocked without Kandarin
    actions.push(
      sim.inventionStatus().ancient
        ? "Ancient Invention unlocked"
        : `Ancient Invention still LOCKED: ${sim.inventionStatus().missingAncient.join("; ")}`,
    );
    pushPhase("p2", "Phase 2 — Asgarnia", actions, h);
  }

  // ── Phase 3 second elective ──
  {
    const actions: string[] = [];
    let h = 0;
    const second = electives[1] ?? "desert";
    sim.unlockElective(second);
    sim.setRelic(4);
    actions.push(`Unlocked ${second}`);
    if (second === "kandarin") {
      const arch = sim.trainTo("archaeology", 95, { onStep: (m) => actions.push(m) });
      h += arch.hours;
      player.syncAutoUnlocks();
      if (player.level("invention") < 85 && player.hasInvention()) {
        const ir = sim.trainTo("invention", 85, { onStep: (m) => actions.push(m) });
        h += ir.hours;
      }
      player.syncAutoUnlocks();
      const st = sim.inventionStatus();
      actions.push(
        st.ancient
          ? "Ancient Invention UNLOCKED (Stormguard / Howl's)"
          : `Ancient still locked: ${st.missingAncient.join("; ")}`,
      );
      if (st.ancient) {
        const ag = sim.trainTo("invention", 99, { onStep: (m) => actions.push(m) });
        h += ag.hours;
      }
    } else {
      const arch = sim.trainTo("archaeology", 90, { onStep: (m) => actions.push(m) });
      h += arch.hours;
      actions.push("No Kandarin — Stormguard / Ancient Invention unavailable this phase");
    }
    for (const sk of ["attack", "strength", "ranged", "magic"] as SkillId[]) {
      const r = sim.trainTo(sk, 99);
      h += r.hours * 0.25; // multi-train discount
    }
    const sum = sim.trainTo("summoning", 99);
    h += sum.hours;
    const dg = sim.trainTo("dungeoneering", 80);
    h += dg.hours;
    pushPhase("p3", `Phase 3 — ${second}`, actions, h);
  }

  // ── Phase 4 third + max ──
  {
    const actions: string[] = [];
    let h = 0;
    const third = electives[2] ?? "forinthry";
    sim.unlockElective(third);
    sim.setRelic(6);
    actions.push(`Unlocked ${third}; 16× XP`);
    // push remaining
    const goals: [SkillId, number][] = [
      ["invention", 120],
      ["necromancy", 120],
      ["archaeology", 120],
      ["dungeoneering", 120],
      ["herblore", 120],
      ["farming", 120],
      ["slayer", 120],
      ["runecrafting", 110],
      ["mining", 110],
      ["smithing", 110],
      ["woodcutting", 110],
      ["agility", 99],
      ["thieving", 99],
      ["construction", 99],
      ["prayer", 99],
    ];
    for (const [sk, to] of goals) {
      if (player.level(sk) >= to) continue;
      const r = sim.trainTo(sk, to);
      if (r.blocked) {
        actions.push(`${sk}→${to} BLOCKED @${r.reached}: ${r.blocked.join("; ")}`);
      } else if (r.hours > 0.05) {
        actions.push(`${sk}→${r.reached}: ${r.hours.toFixed(1)}h`);
        h += r.hours;
      }
    }
    const st = sim.inventionStatus();
    actions.push(
      st.ancient
        ? "Final: Ancient Invention YES"
        : `Final: Ancient Invention NO — ${st.missingAncient.join("; ")}`,
    );
    pushPhase("p4", `Phase 4 — ${third} + max push`, actions, h);
  }

  const totalHours = phases.reduce((a, p) => a + p.hours, 0);
  return {
    phases,
    totalHours,
    finalInvention: sim.inventionStatus(),
    notes,
  };
}

export function explainRequirement(req: Requirement, player: Player): string[] {
  return unsatisfied(req, player.snapshot());
}
