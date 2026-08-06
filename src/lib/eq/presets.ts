import type { Path } from "./blessings";
import type { BuildArchetype, Style } from "./gear";

export interface PathPreset {
  id: string;
  name: string;
  description: string;
  picks: Path[]; // T1,T2,T3,T5,T6,T7
  preferredArchetype: BuildArchetype;
  preferredStyles: Style[];
  tags: string[];
  /** Rank from exhaustive model sweep (1 = best in lab) */
  labRank?: number;
}

/**
 * Lab-validated presets from 729 path × style/gear/archetype sweep (52k+ sims).
 * Path letters = Order/Balance/Chaos at T1,T2,T3,T5,T6,T7.
 */
export const PRESETS: readonly PathPreset[] = [
  {
    id: "crown-st-oocobo",
    name: "Crown ST — OOCOBO",
    description:
      "LAB #1 single-target Necro (~5.5×). Aegis + Striking Light + Avernic free windows + Higher Power + Tearing Thorns DoTs + Tempered Heart + Sacred Fervor + Genesis T120. Hybrid density + DoT grasps beats pure Order by ~34%.",
    picks: ["Order", "Order", "Chaos", "Order", "Balance", "Order"],
    preferredArchetype: "shield-tank",
    preferredStyles: ["necromancy", "melee", "magic"],
    tags: ["lab-#1", "cracked", "st", "necro", "hybrid"],
    labRank: 1,
  },
  {
    id: "crown-multi-ocoooc",
    name: "Crown Multi — OCOOOC",
    description:
      "LAB #1 multi/AoE and best generalist. Aegis + Abyssal Cinders + Steadfast + Higher Power + Lord of Light + Perfidious (4.8s Light) + Sacred Fervor + Genesis. Light scatter + Inferno spam scales hard into multi.",
    picks: ["Order", "Chaos", "Order", "Order", "Order", "Chaos"],
    preferredArchetype: "shield-tank",
    preferredStyles: ["necromancy", "melee", "magic", "ranged"],
    tags: ["lab-#1-multi", "cracked", "generalist", "light"],
    labRank: 2,
  },
  {
    id: "runner-oocobb",
    name: "DoT Runner — OOCOBB",
    description:
      "Near-crown ST: Aegis + Striking + Avernic + Higher Power + Tearing Thorns + Envenomed. Trades Genesis for Power Archive (Balance God2) — slightly less weapon AD, more perk EV + poison.",
    picks: ["Order", "Order", "Chaos", "Order", "Balance", "Balance"],
    preferredArchetype: "shield-tank",
    preferredStyles: ["necromancy", "magic"],
    tags: ["lab-top", "dots", "poison"],
    labRank: 3,
  },
  {
    id: "keep-ults-ocoboc",
    name: "Keep Ultimates — OCOBOC",
    description:
      "Best path that skips Higher Power so you keep Living Death / Berserk / Sunshine / DS. Aegis + Cinders + Steadfast + 3× True Equilibrium + Lord + Perfidious + Sacred Fervor + Power Archive. Only ~7% behind crown ST; excellent multi.",
    picks: ["Order", "Chaos", "Order", "Balance", "Order", "Chaos"],
    preferredArchetype: "shield-tank",
    preferredStyles: ["necromancy", "melee", "magic", "ranged"],
    tags: ["no-higher-power", "true-eq", "flexible"],
    labRank: 4,
  },
  {
    id: "order-shield",
    name: "Pure Order (classic)",
    description:
      "Full Saradomin: Aegis → Striking → Steadfast → Higher Power → Lord → Tempered + Sacred Fervor + Genesis. Clean and strong (~4.1×) but lab shows hybrid Chaos T3/T2 beats it by 30%+.",
    picks: ["Order", "Order", "Order", "Order", "Order", "Order"],
    preferredArchetype: "shield-tank",
    preferredStyles: ["necromancy", "melee", "magic", "ranged"],
    tags: ["classic", "order", "simple"],
    labRank: 20,
  },
  {
    id: "aegis-cinders-crit",
    name: "Cinders Crit — OCOOCC",
    description:
      "Aegis + Cinders + Steadfast + Higher Power + Unholy Critual + Perfidious + Sacred Fervor + Chaotic Insight. Inferno-on-crit engine; Chaos God2 for set stacking.",
    picks: ["Order", "Chaos", "Order", "Order", "Chaos", "Chaos"],
    preferredArchetype: "shield-tank",
    preferredStyles: ["melee", "necromancy"],
    tags: ["inferno", "crit", "chaos-god2"],
    labRank: 9,
  },
  {
    id: "big-boned-order-g1",
    name: "Big Boned Order G1",
    description:
      "Best Big Boned family in lab: Big Boned + Striking + Steadfast + Higher Power + Thorns + Tempered with Order gods (Sacred Fervor + Genesis). Still ~17% behind Aegis crown at endgame shield Necro.",
    picks: ["Balance", "Order", "Order", "Order", "Balance", "Order"],
    preferredArchetype: "shield-tank",
    preferredStyles: ["necromancy", "magic"],
    tags: ["big-boned", "flat"],
    labRank: 30,
  },
  {
    id: "full-chaos",
    name: "Full Chaos Burst",
    description:
      "Pure Chaos: Adren Junkie → Cinders → Avernic → Havoc → Unholy Critual → Perfidious + Demon's Mark + Chaotic Insight. Fun burst kit; lab ranks it far below Order-shield (~2.75× vs ~5.5×).",
    picks: ["Chaos", "Chaos", "Chaos", "Chaos", "Chaos", "Chaos"],
    preferredArchetype: "power-dps",
    preferredStyles: ["melee", "necromancy"],
    tags: ["burst", "chaos", "fun"],
    labRank: 80,
  },
  {
    id: "mixed-aegis-eq",
    name: "Aegis + True Eq Mix",
    description:
      "Order early for Sacred Fervor, Balance T5 True Eq with deliberate path mix. Solid flexible build; not lab-optimal once Higher Power + Genesis are available.",
    picks: ["Order", "Order", "Balance", "Balance", "Chaos", "Order"],
    preferredArchetype: "shield-tank",
    preferredStyles: ["necromancy", "magic"],
    tags: ["hybrid", "true-eq"],
  },
  {
    id: "balance-full",
    name: "Full Balance Tank-DPS",
    description:
      "Big Boned → Barkscales → Eternal → True Eq → Thorns → Envenomed + Splash + Power Archive. Survival king; DPS trails Aegis packages hard.",
    picks: ["Balance", "Balance", "Balance", "Balance", "Balance", "Balance"],
    preferredArchetype: "power-dps",
    preferredStyles: ["necromancy", "magic"],
    tags: ["survival", "balance"],
  },
];

export function presetById(id: string): PathPreset | undefined {
  return PRESETS.find((p) => p.id === id);
}
