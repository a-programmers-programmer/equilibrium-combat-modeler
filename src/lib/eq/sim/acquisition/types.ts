import type { SkillId } from "../../xp";
import type { Style } from "../../gear";
import type { ArmourProfileId } from "../armour";
import type { PoisonKitId } from "../poison";
import type { FamiliarId } from "../summoning";
import type { InventionTier } from "../invention";
import type { RegionTag } from "../requirements";
import type { DropSourceId, DropCalcResult } from "./drops";

export type ComponentKind =
  | "skill"
  | "drop"
  | "set-drop"
  | "craft"
  | "unlock"
  | "relic"
  | "blessing"
  | "familiar"
  | "consumable"
  | "jewellery";

export interface AcqComponent {
  id: string;
  name: string;
  kind: ComponentKind;
  requiresRegions?: RegionTag[];
  requiresAllRegions?: RegionTag[];
  skillReqs?: Partial<Record<SkillId, number>>;
  drop?: {
    sourceId: DropSourceId;
    pieces?: number;
    rateDenom?: number;
    kph?: number;
  };
  fixedHours?: number;
  fixedHoursFn?: () => number;
  trainsCombat?: boolean;
  notes?: string;
  tags?: string[];
  /** Multiplier applied when perkfection is on (default 1) */
  perkfectionMult?: number;
}

export interface ComponentCost {
  id: string;
  name: string;
  kind: ComponentKind;
  exclusiveHours: number;
  skillHoursDetail: { skill: SkillId; hours: number }[];
  skillHoursSum: number;
  dropDetail?: DropCalcResult;
  trainsCombat: boolean;
  notes: string[];
  blocked?: string[];
}

export interface BuildSpec {
  id: string;
  name: string;
  style: Style;
  armour: ArmourProfileId;
  poison: PoisonKitId;
  familiar: FamiliarId;
  invention: InventionTier;
  regions: RegionTag[];
  electives: string[];
  gearTier: "mid" | "end";
  perkfection?: boolean;
  aegisPath?: boolean;
  relicsT7?: boolean;
  farmLeagueTier?: number;
  bisJewellery?: boolean;
}

export interface AcquisitionPlan {
  spec: BuildSpec;
  rareMultUsed: number;
  farmLeagueTier: number;
  components: ComponentCost[];
  blocked: { id: string; reasons: string[] }[];
  skillUnionHours: number;
  skillBySkill: { skill: SkillId; hours: number }[];
  exclusiveHours: number;
  combatExclusiveHours: number;
  wallClockP50: number;
  wallClockP90: number;
  wallClockMean: number;
  parallelCredit: number;
  sensitivity: Record<string, number>;
  breakdown: string[];
  ledger: {
    id: string;
    name: string;
    exclusiveH: number;
    drop?: string;
  }[];
}
