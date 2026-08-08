/**
 * Declarative build → component recipe rules.
 * Each rule appends component ids; order preserved, then deduped.
 */

import type { RegionTag } from "../requirements";
import { ELECTIVE_REGIONS } from "./math";
import type { BuildSpec } from "./types";

type Rule = (spec: BuildSpec, out: string[]) => void;

const push = (out: string[], ...ids: string[]) => {
  for (const id of ids) out.push(id);
};

const RULES: Rule[] = [
  // Meta progression
  (s, o) => push(o, s.relicsT7 === false ? "relics-t5" : "relics-t7"),
  (s, o) => {
    if (s.aegisPath !== false) push(o, "blessings-aegis-path");
  },

  // Elective region unlocks present in spec.regions
  (s, o) => {
    const regs = new Set(s.regions);
    for (const r of ELECTIVE_REGIONS) {
      if (regs.has(r as RegionTag)) push(o, `unlock-${r}`);
    }
  },

  // Style gear ladder
  (s, o) => {
    const regs = new Set(s.regions);
    const end = s.gearTier === "end";

    if (s.style === "necromancy") {
      push(o, end ? "skill-necro-95" : "skill-necro-90");
      if (end) push(o, "skill-necro-99");
      push(o, "skill-prayer-95", end ? "kili-t90" : "kili-t70");
      if (end) {
        push(o, "rasial-omni-soul");
        push(
          o,
          s.armour === "tfn-power" || s.armour === "power-bis"
            ? "rasial-tfn-set"
            : "deathwarden-t90-set",
        );
      } else {
        push(o, "deathwarden-t90-set");
      }
      push(o, "jewellery-reaper-stack");
      return;
    }

    if (s.style === "magic") {
      push(o, end ? "skill-magic-99" : "skill-magic-90", "skill-prayer-95");
      if (s.armour === "cryptbloom-tank") push(o, "cryptbloom-set");
      if (end && regs.has("anachronia")) push(o, "fsoa");
      push(o, "jewellery-reaper-stack");
      return;
    }

    if (s.style === "melee") {
      push(
        o,
        end ? "skill-combat-bundle-99" : "skill-combat-bundle-90",
        "skill-prayer-95",
      );
      push(
        o,
        regs.has("desert") && end ? "drygore-dual" : "melee-mid-weapons",
      );
      if (s.armour === "masterwork-tank") {
        push(o, "skill-smith-99", "masterwork-set");
      }
      push(o, "jewellery-reaper-stack");
      return;
    }

    if (s.style === "ranged") {
      push(
        o,
        end ? "skill-ranged-99" : "skill-ranged-90",
        "skill-prayer-95",
        "ranged-mid-weapons",
        "jewellery-reaper-stack",
      );
    }
  },

  // Herblore / ovls
  (s, o) => {
    if (s.gearTier === "end") push(o, "skill-herb-106", "elder-overload-line");
    else push(o, "skill-herb-96");
  },

  // Poison kits
  (s, o) => {
    if (s.poison === "none") return;
    push(o, "weapon-poison-plus-plus-plus");
    const cinder = [
      "wp-cinder",
      "full-melee-poison",
      "full-ranged-blowpipe",
      "cinder-only",
    ];
    if (cinder.includes(s.poison)) push(o, "skill-slayer-99", "cinderbane-gloves");
  },

  // Familiars
  (s, o) => {
    const map: Record<string, [string, string]> = {
      "steel-titan": ["skill-sum-99", "fam-steel-titan"],
      "ice-nihil": ["skill-sum-99", "fam-ice-nihil"],
      "ripper-demon": ["skill-sum-99", "fam-ripper"],
    };
    const pair = map[s.familiar];
    if (pair) push(o, ...pair);
  },

  // Invention
  (s, o) => {
    if (s.invention === "none") return;
    push(
      o,
      "skill-inv-gates",
      "skill-inv-90",
      "invention-unlock",
      "invention-perks-bis",
    );
    if (s.invention === "ancient") {
      push(o, "skill-arch-95", "skill-inv-99", "ancient-invention");
    }
  },

  // BiS jewellery
  (s, o) => {
    if (s.bisJewellery) push(o, "jewellery-eof-souls");
  },
];

/** Compose recipe ids for a build (deduped, stable order). */
export function recipeForBuild(spec: BuildSpec): string[] {
  const out: string[] = [];
  for (const rule of RULES) rule(spec, out);
  return [...new Set(out)];
}
