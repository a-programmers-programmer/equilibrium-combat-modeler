/**
 * Every Requirement has a time cost. Recursive expansion + dedupe.
 *
 * Rules:
 * - SkillReq     → league-multed XP hours 1→level (phased)
 * - RegionReq    → elective unlock pad (starters still cost tutorial slice)
 * - QuestReq     → quest hours catalog
 * - FlagReq      → how you earn the flag (boss EV, tutorial, etc.)
 * - AllReq        → sum children (shared nodes deduped globally)
 * - AnyReq       → min(children) — pick cheapest path
 *
 * Nothing is free: even "misthalin" charges a starter-region share.
 */

import type { SkillId } from "../xp";
import { chartSkillLeaguePhased } from "./league-hours";
import {
  Requirement,
  SkillReq,
  RegionReq,
  AnyRegionReq,
  QuestReq,
  FlagReq,
  AllReq,
  AnyReq,
  RelicTierReq,
  type RegionTag,
  type PlayerSnapshot,
} from "./requirements";
import { calcDrop, type DropCalcResult } from "./acquisition";
import { rareMultAtTier, relicLadderHours } from "./league-passives";

/** Hedge: minimum hours never below this for any real unlock */
export const MIN_UNLOCK_HOURS = 0.15;

export interface TimedNode {
  reqId: string;
  describe: string;
  hours: number;
  kind: "skill" | "region" | "quest" | "flag" | "composite" | "drop" | "fixed";
  children?: TimedNode[];
  detail?: string;
  /** True if already paid via shared cache */
  shared?: boolean;
}

export interface ReqHoursResult {
  totalHours: number;
  nodes: TimedNode[];
  /** Flattened unique leaf costs */
  leaves: { id: string; hours: number; describe: string }[];
  missing: string[];
}

/** Starter regions still cost time (tutorial / first map). */
const REGION_HOURS: Record<string, number> = {
  free: 0.4,
  misthalin: 0.8,
  havenhythe: 0.6,
  karamja: 0.7,
  asgarnia: 2.5,
  desert: 3.0,
  morytania: 3.0,
  forinthry: 3.0,
  anachronia: 4.5,
  tirannwn: 5.5,
  kandarin: 3.0,
  fremennik: 3.5,
  any: 0.5,
};

/** Quest catalog — hours to complete (league mult on combat quests soft) */
const QUEST_HOURS: Record<string, { hours: number; name: string }> = {
  "ritual-of-the-mahjarrat": { hours: 2.5, name: "Ritual of the Mahjarrat" },
  "the-world-wakes": { hours: 1.5, name: "The World Wakes" },
  "plague's-end": { hours: 2.0, name: "Plague's End" },
  "while-guthix-sleeps": { hours: 3.0, name: "While Guthix Sleeps" },
  "the-branches-of-darkmeyer": { hours: 1.5, name: "Branches of Darkmeyer" },
  "one-of-a-kind": { hours: 1.2, name: "One of a Kind" },
  "hero-pass-necro": { hours: 0.5, name: "Necromancy intro / City of Um access" },
  "kili-row": { hours: 0.3, name: "Kili Row start" },
  default: { hours: 1.0, name: "Quest" },
};

/**
 * Flag acquisition paths — every flag costs time.
 * Boss flags use drop calc / kill EV; tutorials fixed.
 */
function flagHours(
  flag: string,
  ctx: CostContext,
): { hours: number; detail: string } {
  const rare = ctx.rareMult;
  if (flag === "killed:rasial" || flag === "rasial") {
    // At least one kill + learn; not full unique
    const d = calcDrop("rasial", { pieces: 1, rareMult: rare, rateDenom: 1 });
    // rateDenom 1 → 1 kill expected but learn tax still applies via 1 kill
    const h = Math.max(0.4, 1 / 24 / Math.max(0.3, 0.5) + 0.3); // ~first kill + setup
    return { hours: 0.8, detail: "First Rasial kill + instance setup" };
  }
  if (flag.startsWith("killed:")) {
    return { hours: 1.5, detail: `Boss unlock kill: ${flag}` };
  }
  if (flag === "invention_tutorial") {
    return { hours: 0.4, detail: "Invention tutorial (league auto after 80s)" };
  }
  if (flag === "howls_floating_workshop") {
    return { hours: 2.0, detail: "Howl's Floating Workshop / Stormguard path" };
  }
  if (flag.includes("kili") || flag.includes("deathwarden")) {
    return { hours: 0.5, detail: flag };
  }
  if (flag.includes("contract") || flag.includes("ripper")) {
    return { hours: 6, detail: "Binding contract grind" };
  }
  return { hours: 0.5, detail: `Flag: ${flag}` };
}

export interface CostContext {
  electives: readonly string[];
  rareMult: number;
  /** Already-paid req ids (dedupe) */
  paid: Set<string>;
  /** Player progress — if satisfied, 0 hours */
  player?: PlayerSnapshot;
  /** Depth guard */
  depth?: number;
}

function skillHours(skill: SkillId, level: number, electives: readonly string[]): number {
  if (level <= 1) return 0;
  return chartSkillLeaguePhased(skill, 1, level, electives).hours;
}

/**
 * Cost a single Requirement tree with global dedupe.
 */
export function costRequirement(
  req: Requirement,
  ctx: CostContext,
): TimedNode {
  const depth = ctx.depth ?? 0;
  if (!req) {
    return {
      reqId: "missing-req",
      describe: "no requirement object",
      hours: MIN_UNLOCK_HOURS,
      kind: "fixed",
      detail: "hedge — missing req",
    };
  }
  if (depth > 40) {
    return {
      reqId: "overflow",
      describe: "max depth",
      hours: 0,
      kind: "fixed",
    };
  }

  // Already satisfied on player?
  if (ctx.player && req.satisfied(ctx.player)) {
    return {
      reqId: req.id,
      describe: req.describe() + " (owned)",
      hours: 0,
      kind: "fixed",
      detail: "already satisfied",
    };
  }

  // Shared dedupe
  if (ctx.paid.has(req.id)) {
    return {
      reqId: req.id,
      describe: req.describe(),
      hours: 0,
      kind: "fixed",
      shared: true,
      detail: "shared/already paid",
    };
  }

  if (req instanceof SkillReq) {
    const h = skillHours(req.skill as SkillId, req.level, ctx.electives);
    ctx.paid.add(req.id);
    return {
      reqId: req.id,
      describe: req.describe(),
      hours: h,
      kind: "skill",
      detail: `XP 1→${req.level} league-phased`,
    };
  }

  if (req instanceof RegionReq) {
    const h = REGION_HOURS[req.region] ?? 2;
    ctx.paid.add(req.id);
    return {
      reqId: req.id,
      describe: req.describe(),
      hours: h,
      kind: "region",
      detail: `Region unlock/access pad`,
    };
  }

  if (req instanceof AnyRegionReq) {
    // Cheapest region path among options
    const options = req.regions.map((r) =>
      costRequirement(new RegionReq(r), { ...ctx, depth: depth + 1, paid: new Set(ctx.paid) }),
    );
    // Pick min — then mark that path paid on real ctx
    options.sort((a, b) => a.hours - b.hours);
    const best = options[0]!;
    // re-run best on real paid set
    const real = costRequirement(
      new RegionReq(req.regions[0]!),
      ctx,
    );
    // Actually cost the true cheapest region id
    let minH = Infinity;
    let minRegion = req.regions[0]!;
    for (const r of req.regions) {
      const pad = REGION_HOURS[r] ?? 2;
      if (pad < minH) {
        minH = pad;
        minRegion = r;
      }
    }
    if (!ctx.paid.has(`region:${minRegion}`)) {
      ctx.paid.add(`region:${minRegion}`);
      ctx.paid.add(req.id);
      return {
        reqId: req.id,
        describe: req.describe(),
        hours: minH,
        kind: "region",
        detail: `Cheapest region path → ${minRegion}`,
        children: [
          {
            reqId: `region:${minRegion}`,
            describe: `region:${minRegion}`,
            hours: minH,
            kind: "region",
          },
        ],
      };
    }
    ctx.paid.add(req.id);
    return {
      reqId: req.id,
      describe: req.describe(),
      hours: 0,
      kind: "region",
      shared: true,
    };
  }

  if (req instanceof QuestReq) {
    const q = QUEST_HOURS[req.questId] ?? QUEST_HOURS.default!;
    ctx.paid.add(req.id);
    return {
      reqId: req.id,
      describe: req.describe(),
      hours: q.hours,
      kind: "quest",
      detail: q.name,
    };
  }

  if (req instanceof FlagReq) {
    const f = flagHours(req.flag, ctx);
    ctx.paid.add(req.id);
    return {
      reqId: req.id,
      describe: req.describe(),
      hours: f.hours,
      kind: "flag",
      detail: f.detail,
    };
  }

  if (req instanceof AllReq) {
    const children = req.parts.map((r) =>
      costRequirement(r, { ...ctx, depth: depth + 1 }),
    );
    const hours = children.reduce((a, c) => a + c.hours, 0);
    ctx.paid.add(req.id);
    return {
      reqId: req.id,
      describe: req.describe(),
      hours,
      kind: "composite",
      children,
      detail: "ALL of",
    };
  }

  if (req instanceof AnyReq) {
    let best: TimedNode | null = null;
    let bestPaid: Set<string> | null = null;
    for (const r of req.parts) {
      const paidClone = new Set(ctx.paid);
      const node = costRequirement(r, {
        ...ctx,
        paid: paidClone,
        depth: depth + 1,
      });
      if (!best || node.hours < best.hours) {
        best = node;
        bestPaid = paidClone;
      }
    }
    if (bestPaid) {
      for (const id of bestPaid) ctx.paid.add(id);
    }
    ctx.paid.add(req.id);
    return {
      reqId: req.id,
      describe: req.describe(),
      hours: best?.hours ?? 0,
      kind: "composite",
      children: best ? [best] : [],
      detail: "ANY of (cheapest)",
    };
  }

  if (req instanceof RelicTierReq) {
    const h = relicLadderHours(req.minTier);
    ctx.paid.add(req.id);
    return {
      reqId: req.id,
      describe: req.describe(),
      hours: h,
      kind: "fixed",
      detail: `Relic ladder through T${req.minTier}`,
    };
  }

  // Unknown requirement type — never free
  ctx.paid.add(req.id);
  return {
    reqId: req.id,
    describe: req.describe(),
    hours: Math.max(MIN_UNLOCK_HOURS, 0.5),
    kind: "fixed",
    detail: "unknown req type — hedged 0.5h",
  };
}

export function summarizeReqHours(root: TimedNode): ReqHoursResult {
  const leaves: { id: string; hours: number; describe: string }[] = [];
  function walk(n: TimedNode) {
    if (!n.children?.length) {
      if (n.hours > 0 && !n.shared) {
        leaves.push({ id: n.reqId, hours: n.hours, describe: n.describe });
      }
      return;
    }
    for (const c of n.children) walk(c);
  }
  walk(root);
  return {
    totalHours: root.hours,
    nodes: [root],
    leaves,
    missing: [],
  };
}

/**
 * Cost an Equipment piece: its full Requirement graph.
 */
export function costEquipmentReq(
  req: Requirement,
  electives: readonly string[],
  rareMult = 6,
  player?: PlayerSnapshot,
): ReqHoursResult {
  const ctx: CostContext = {
    electives,
    rareMult,
    paid: new Set(),
    player,
  };
  const root = costRequirement(req, ctx);
  return summarizeReqHours(root);
}
