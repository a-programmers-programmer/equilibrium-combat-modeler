/**
 * Trie + generator for legal Equilibrium relic loadouts.
 *
 * Uses Wazzy tier map as the option set (one pick per tier).
 * Rejuvenated (T6) expands with reclaimable prior-tier relics not already taken.
 *
 * Trie nodes are keyed by tier path for O(depth) insert/prefix filter.
 */

import type { RelicId } from "./relics";
import {
  RELIC_BY_ID,
  validateRelicLoadout,
  type RelicLoadout,
  type ValidatedRelics,
} from "./relics";
import { WAZZY_RELIC_TIERS } from "./wazzy-tiers";

/** Canonical options per tier from Wazzy hub */
export function optionsForTier(tier: number): RelicId[] {
  const row = WAZZY_RELIC_TIERS[tier];
  if (!row) return [];
  return [...row.relics];
}

export interface RelicCombo {
  /** Compact key for dedupe / trie */
  key: string;
  byTier: Partial<Record<number, RelicId>>;
  rejuvenatedExtra?: { fromTier: number; relic: RelicId };
  active: RelicId[];
  mult: number;
  devout: boolean;
  divineDruid: boolean;
  perkfection: boolean;
  combatTags: string[];
  valid: boolean;
  errors: string[];
}

export interface TrieNode {
  /** tier just chosen to reach here (0 = root) */
  tier: number;
  relic: RelicId | null;
  children: Map<string, TrieNode>;
  /** leaf payload */
  combo?: RelicCombo;
  /** subtree leaf count */
  leafCount: number;
}

function comboKey(loadout: RelicLoadout): string {
  const parts: string[] = [];
  for (let t = 1; t <= 7; t++) {
    parts.push(`${t}:${loadout.byTier[t] ?? "-"}`);
  }
  if (loadout.rejuvenatedExtra) {
    parts.push(
      `R${loadout.rejuvenatedExtra.fromTier}:${loadout.rejuvenatedExtra.relic}`,
    );
  }
  return parts.join("|");
}

function toCombo(loadout: RelicLoadout, v: ValidatedRelics): RelicCombo {
  const active = v.active;
  return {
    key: comboKey(loadout),
    byTier: { ...loadout.byTier },
    rejuvenatedExtra: loadout.rejuvenatedExtra
      ? { ...loadout.rejuvenatedExtra }
      : undefined,
    active: [...active],
    mult: v.mult,
    devout: v.devout,
    divineDruid: v.divineDruid,
    perkfection: active.includes("perkfection"),
    combatTags: active.flatMap((id) => RELIC_BY_ID[id]?.tags ?? []),
    valid: v.valid,
    errors: v.errors,
  };
}

/**
 * Enumerate ALL legal full 7-tier loadouts (+ rejuvenated extras).
 * ~thousands, not millions — fine to materialize.
 */
export function enumerateRelicCombos(opts?: {
  /** Only keep valid after validateRelicLoadout */
  validOnly?: boolean;
  /** Require at least one combat-tagged relic */
  combatOnly?: boolean;
}): RelicCombo[] {
  const validOnly = opts?.validOnly !== false;
  const combatOnly = opts?.combatOnly ?? false;
  const out: RelicCombo[] = [];
  const seen = new Set<string>();

  const t1 = optionsForTier(1);
  const t2 = optionsForTier(2);
  const t3 = optionsForTier(3);
  const t4 = optionsForTier(4);
  const t5 = optionsForTier(5);
  const t6 = optionsForTier(6);
  const t7 = optionsForTier(7);

  for (const a of t1) {
    for (const b of t2) {
      for (const c of t3) {
        for (const d of t4) {
          for (const e of t5) {
            for (const f of t6) {
              for (const g of t7) {
                const byTier: Partial<Record<number, RelicId>> = {
                  1: a,
                  2: b,
                  3: c,
                  4: d,
                  5: e,
                  6: f,
                  7: g,
                };

                if (f === "rejuvenated") {
                  // All reclaimable prior-tier options not already picked
                  for (let pt = 1; pt <= 5; pt++) {
                    for (const extra of optionsForTier(pt)) {
                      if (byTier[pt] === extra) continue;
                      const loadout: RelicLoadout = {
                        byTier,
                        rejuvenatedExtra: { fromTier: pt, relic: extra },
                      };
                      push(loadout);
                    }
                  }
                } else {
                  push({ byTier });
                }
              }
            }
          }
        }
      }
    }
  }

  function push(loadout: RelicLoadout) {
    const v = validateRelicLoadout(loadout);
    if (validOnly && !v.valid) return;
    if (combatOnly) {
      const tags = v.active.flatMap((id) => RELIC_BY_ID[id]?.tags ?? []);
      const combatish = tags.some((t) =>
        ["combat", "dps", "summoning", "familiar-dps", "invention", "prayer", "execute", "burst", "perks"].includes(
          t,
        ),
      );
      if (!combatish && !v.active.includes("devout") && !v.active.includes("infernal-fire")) {
        // still allow if any mult > 1
        if (v.mult <= 1.001 && !v.devout) return;
      }
    }
    const combo = toCombo(loadout, v);
    if (seen.has(combo.key)) return;
    seen.add(combo.key);
    out.push(combo);
  }

  return out;
}

/** Build trie from combos for prefix filtering (e.g. fix T5=devout). */
export function buildRelicTrie(combos: readonly RelicCombo[]): TrieNode {
  const root: TrieNode = {
    tier: 0,
    relic: null,
    children: new Map(),
    leafCount: 0,
  };

  for (const combo of combos) {
    let node = root;
    for (let t = 1; t <= 7; t++) {
      const id = combo.byTier[t] ?? "none";
      const key = `${t}:${id}`;
      let child = node.children.get(key);
      if (!child) {
        child = {
          tier: t,
          relic: id,
          children: new Map(),
          leafCount: 0,
        };
        node.children.set(key, child);
      }
      node = child;
    }
    // rejuvenated extra as extra depth
    if (combo.rejuvenatedExtra) {
      const key = `R${combo.rejuvenatedExtra.fromTier}:${combo.rejuvenatedExtra.relic}`;
      let child = node.children.get(key);
      if (!child) {
        child = {
          tier: 8,
          relic: combo.rejuvenatedExtra.relic,
          children: new Map(),
          leafCount: 0,
        };
        node.children.set(key, child);
      }
      node = child;
    }
    node.combo = combo;
  }

  // leaf counts bottom-up
  function count(n: TrieNode): number {
    if (n.combo) {
      n.leafCount = 1;
      return 1;
    }
    let c = 0;
    for (const ch of n.children.values()) c += count(ch);
    n.leafCount = c;
    return c;
  }
  count(root);
  return root;
}

/** Prefix filter: fixed tier picks → remaining combos via trie walk */
export function combosWithPrefix(
  root: TrieNode,
  prefix: Partial<Record<number, RelicId>>,
): RelicCombo[] {
  let nodes: TrieNode[] = [root];
  for (let t = 1; t <= 7; t++) {
    const fixed = prefix[t];
    const next: TrieNode[] = [];
    for (const n of nodes) {
      if (fixed) {
        const ch = n.children.get(`${t}:${fixed}`);
        if (ch) next.push(ch);
      } else {
        for (const ch of n.children.values()) {
          if (ch.tier === t) next.push(ch);
        }
      }
    }
    nodes = next;
    if (!nodes.length) return [];
  }
  // collect leaves (including rejuv children)
  const out: RelicCombo[] = [];
  function collect(n: TrieNode) {
    if (n.combo) out.push(n.combo);
    for (const ch of n.children.values()) collect(ch);
  }
  for (const n of nodes) collect(n);
  return out;
}

/** Stats for logging */
export function relicComboStats(combos: readonly RelicCombo[]) {
  const withDevout = combos.filter((c) => c.devout).length;
  const withInfernal = combos.filter((c) => c.active.includes("infernal-fire")).length;
  const withRejuv = combos.filter((c) => c.rejuvenatedExtra).length;
  const withPerk = combos.filter((c) => c.perkfection).length;
  const mults = combos.map((c) => c.mult);
  return {
    total: combos.length,
    withDevout,
    withInfernal,
    withRejuv,
    withPerk,
    maxMult: Math.max(...mults, 1),
    minMult: Math.min(...mults, 1),
    avgMult: mults.reduce((a, b) => a + b, 0) / Math.max(1, mults.length),
  };
}

/** Top combat-relevant combos by player mult (heuristic pre-rank) */
export function topCombatRelicCombos(
  combos: readonly RelicCombo[],
  n = 40,
): RelicCombo[] {
  return [...combos]
    .map((c) => {
      let score = c.mult;
      if (c.devout) score *= 1.15; // fam ceiling not in mult
      if (c.divineDruid) score *= 1.03;
      if (c.perkfection) score *= 1.02;
      if (c.active.includes("infernal-fire")) score *= 1.01;
      return { c, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map((x) => x.c);
}
