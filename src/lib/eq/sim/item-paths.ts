/**
 * Every equippable item → full requirement path with hours.
 * Uses Equipment.req OOP graph + drop EV if source boss known.
 */

import {
  EQUIPMENT_CATALOG,
  type Equipment,
} from "./equipment";
import {
  costRequirement,
  type CostContext,
  type TimedNode,
  summarizeReqHours,
} from "./req-hours";
import { calcDrop } from "./acquisition";
import {
  AllReq,
  SkillReq,
  RegionReq,
  FlagReq,
  type RegionTag,
  type PlayerSnapshot,
} from "./requirements";
import { rareMultAtTier } from "./league-passives";

export interface ItemPath {
  itemId: string;
  name: string;
  style: string;
  tier: number;
  slot: string;
  /** Hours to satisfy requirement graph (skills/regions/quests/flags) */
  reqHours: number;
  /** Hours to obtain the drop/craft itself */
  obtainHours: number;
  /** Total wall for this item alone (no shared dedupe with others) */
  soloTotal: number;
  /** With shared paid set (for loadout) */
  sharedTotal: number;
  reqTree: TimedNode;
  leaves: { id: string; hours: number; describe: string }[];
  obtainDetail: string;
  regions: string[];
}

function inferObtain(
  e: Equipment,
  rareMult: number,
): { hours: number; detail: string } {
  const src = (e.source || "").toLowerCase();
  const name = e.name.toLowerCase();
  const notes = (e.notes || "").toLowerCase();
  const blob = `${src} ${name} ${notes}`;

  if (/rasial|omni|soulbound|first necromancer/.test(blob)) {
    const d = calcDrop("rasial", { pieces: 1, rareMult });
    return {
      hours: d.hoursMean,
      detail: `Rasial unique EV ${d.expectedKills.toFixed(0)}k rare×${rareMult}`,
    };
  }
  if (/croesus|cryptbloom/.test(blob)) {
    const d = calcDrop("croesus", { pieces: 1, rareMult });
    return {
      hours: d.hoursMean,
      detail: `Croesus unique EV rare×${rareMult}`,
    };
  }
  if (/kerapac|fractured staff|fsoa|armady/.test(blob)) {
    const d = calcDrop("kerapac", { pieces: 1, rareMult });
    return { hours: d.hoursMean, detail: `Kerapac piece EV rare×${rareMult}` };
  }
  if (/drygore|kalphite king/.test(blob)) {
    const d = calcDrop("kalphiteKing", { pieces: 1, rareMult });
    return { hours: d.hoursMean, detail: `KK drygore EV rare×${rareMult}` };
  }
  if (/cinderbane/.test(blob)) {
    const d = calcDrop("lostGroveOnTask", { pieces: 1, rareMult });
    return { hours: d.hoursMean, detail: `Lost Grove on-task EV rare×${rareMult}` };
  }
  if (/solak/.test(blob)) {
    const d = calcDrop("solak", { pieces: 1, rareMult });
    return { hours: d.hoursMean, detail: `Solak EV rare×${rareMult}` };
  }
  if (/craft|smith|kili|deathwarden|death guard|deathdealer/.test(blob)) {
    // Crafted — materials + time scaled by tier
    const h = 0.8 + e.tier * 0.04;
    return { hours: h, detail: `Craft/upgrade path ~T${e.tier}` };
  }
  if (/shop|ge |grand exchange|buy/.test(blob)) {
    return { hours: 0.2, detail: "Acquire/buy pad (never free)" };
  }
  // Default hedge — every item costs something
  return {
    hours: 0.75 + e.tier * 0.02,
    detail: "Default obtain hedge (source ambiguous)",
  };
}

export function pathForItem(
  e: Equipment,
  electives: readonly string[],
  opts?: {
    rareMult?: number;
    paid?: Set<string>;
    player?: PlayerSnapshot;
  },
): ItemPath {
  const rareMult = opts?.rareMult ?? rareMultAtTier(6);
  const paid = opts?.paid ?? new Set<string>();
  const ctx: CostContext = {
    electives,
    rareMult,
    paid,
    player: opts?.player,
  };
  const reqTree = costRequirement(e.req, ctx);
  const sum = summarizeReqHours(reqTree);
  const obtain = inferObtain(e, rareMult);

  // Mark obtain as not free
  const obtainH = Math.max(0.15, obtain.hours);
  const sharedTotal = sum.totalHours + obtainH;
  const soloPaid = new Set<string>();
  const soloTree = costRequirement(e.req, {
    electives,
    rareMult,
    paid: soloPaid,
    player: opts?.player,
  });
  const soloReq = summarizeReqHours(soloTree).totalHours;

  return {
    itemId: e.id,
    name: e.name,
    style: String(e.style),
    tier: e.tier,
    slot: String(e.slot),
    reqHours: sum.totalHours,
    obtainHours: obtainH,
    soloTotal: soloReq + obtainH,
    sharedTotal,
    reqTree,
    leaves: sum.leaves,
    obtainDetail: obtain.detail,
    regions: e.regions.map(String),
  };
}

export interface LoadoutPathResult {
  pieces: ItemPath[];
  totalHours: number;
  reqHours: number;
  obtainHours: number;
  /** Shared skill/region paid once */
  sharedSavings: number;
  ledger: { name: string; hours: number; detail: string }[];
}

/**
 * Full loadout: every piece timed with shared requirement dedupe.
 */
export function pathForLoadout(
  items: Equipment[],
  electives: readonly string[],
  opts?: { rareMult?: number; player?: PlayerSnapshot },
): LoadoutPathResult {
  const paid = new Set<string>();
  const rareMult = opts?.rareMult ?? 6;
  const pieces: ItemPath[] = [];
  let soloSum = 0;

  for (const e of items) {
    const solo = pathForItem(e, electives, {
      rareMult,
      player: opts?.player,
    });
    soloSum += solo.soloTotal;
    const shared = pathForItem(e, electives, {
      rareMult,
      paid,
      player: opts?.player,
    });
    pieces.push(shared);
  }

  const reqHours = pieces.reduce((a, p) => a + p.reqHours, 0);
  const obtainHours = pieces.reduce((a, p) => a + p.obtainHours, 0);
  const totalHours = reqHours + obtainHours;
  const sharedSavings = Math.max(0, soloSum - totalHours);

  return {
    pieces,
    totalHours,
    reqHours,
    obtainHours,
    sharedSavings,
    ledger: pieces.map((p) => ({
      name: p.name,
      hours: p.sharedTotal,
      detail: `req ${p.reqHours.toFixed(1)}h + obtain ${p.obtainHours.toFixed(1)}h (${p.obtainDetail})`,
    })),
  };
}

/**
 * Validate catalog: every combat-relevant item has non-empty req OR hedge obtain.
 */
export function auditCatalogRequirements(opts?: {
  style?: string;
  minTier?: number;
  limit?: number;
}): {
  total: number;
  withReq: number;
  zeroSoloRisk: { id: string; name: string; solo: number }[];
  sample: ItemPath[];
} {
  const minTier = opts?.minTier ?? 70;
  const pool = EQUIPMENT_CATALOG.filter((e) => {
    if (e.tier < minTier) return false;
    if (opts?.style && e.style !== opts.style && e.style !== "all") return false;
    return e.slot !== "unknown" && e.slot !== "material";
  });
  const sample: ItemPath[] = [];
  const zeroSoloRisk: { id: string; name: string; solo: number }[] = [];
  let withReq = 0;
  const limit = opts?.limit ?? 80;

  for (const e of pool.slice(0, limit)) {
    const p = pathForItem(e, ["asgarnia", "forinthry", "desert"], {
      rareMult: 6,
    });
    sample.push(p);
    if (p.reqHours > 0.01 || (e.skillReqs?.length ?? 0) > 0 || e.regions.length) {
      withReq++;
    }
    if (p.soloTotal < 0.2) {
      zeroSoloRisk.push({ id: e.id, name: e.name, solo: p.soloTotal });
    }
  }

  return {
    total: Math.min(pool.length, limit),
    withReq,
    zeroSoloRisk,
    sample: sample.sort((a, b) => b.soloTotal - a.soloTotal).slice(0, 25),
  };
}

/** Build AllReq from component skill + region fields for acquisition bridge */
export function reqFromComponentFields(opts: {
  skillReqs?: Partial<Record<string, number>>;
  requiresAllRegions?: RegionTag[];
  flags?: string[];
}): AllReq {
  const parts: (SkillReq | RegionReq | FlagReq)[] = [];
  if (opts.skillReqs) {
    for (const [sk, lvl] of Object.entries(opts.skillReqs)) {
      if (lvl && lvl > 1) parts.push(new SkillReq(sk as never, lvl));
    }
  }
  if (opts.requiresAllRegions) {
    for (const r of opts.requiresAllRegions) parts.push(new RegionReq(r));
  }
  if (opts.flags) {
    for (const f of opts.flags) parts.push(new FlagReq(f, f));
  }
  return new AllReq(parts.length ? parts : [new FlagReq("baseline", "baseline")]);
}
