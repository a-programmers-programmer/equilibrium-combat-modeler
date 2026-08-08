/**
 * Audit gear requirement correctness for Equilibrium combat modeler.
 *
 * Prints illegal combinations that still pass resolveLoadout / resolveLoadoutOOP /
 * gearFromPackage / abstract armour profiles. Exit code 1 if any CRITICAL remain.
 *
 * Usage: npx tsx scripts/audit-gear.ts
 */
import {
  REGION_PACKAGES,
  FREE_REGION_IDS,
  ITEMS,
  resolveLoadout,
  findIllegalLoadoutPieces,
  itemStyleLegal,
  itemAccessible,
  type CombatStyle,
  type OffhandMode,
  type RegionId,
} from "../src/lib/eq/items.ts";
import {
  EQUIPMENT_CATALOG,
  resolveLoadoutOOP,
} from "../src/lib/eq/sim/equipment.ts";
import {
  gearFromPackage,
  gearFromRegions,
  modelCombat,
  loadoutToSnapshot,
} from "../src/lib/eq/model.ts";
import { stageById, type Style } from "../src/lib/eq/gear.ts";
import {
  ARMOUR_PROFILES,
  sanitizeArmourProfile,
  type ArmourProfileId,
} from "../src/lib/eq/sim/armour.ts";
import type { PlayerSnapshot, RegionTag } from "../src/lib/eq/sim/requirements.ts";
import type { SkillId } from "../src/lib/eq/xp.ts";

const STYLES = ["necromancy", "melee", "magic", "ranged"] as const;
const MODES: OffhandMode[] = ["shield", "dual", "2h", "defender"];
const ARCHES = ["shield-tank", "power-dps", "defender"] as const;

type Issue = {
  severity: "CRITICAL" | "WARN" | "INFO";
  kind: string;
  detail: string;
};

const issues: Issue[] = [];

function player(unlocked: readonly RegionId[], opts?: { bosses?: boolean }): PlayerSnapshot {
  const regions = new Set<RegionTag>(["free", "misthalin", "havenhythe", "karamja"]);
  for (const r of unlocked) regions.add(r as RegionTag);
  const flags = new Set<string>([
    "unlocked:tune-bane",
    "unlocked:dinarrows",
    "unlocked:jas-anima",
    "killed:soulgazer",
    "unlocked:hexhunter-imbue",
    "unlocked:bgh-t3",
    "unlocked:inquisitor-assemble",
    "unlocked:inq-imbue",
    "unlocked:glacor-front",
    "unlocked:leng-core",
  ]);
  if (opts?.bosses !== false) {
    for (const f of [
      "killed:rasial",
      "killed:kerapac",
      "killed:vorkath-path",
      "killed:zamorak",
      "killed:zuk",
    ])
      flags.add(f);
  }
  const levels: Partial<Record<SkillId, number>> = {
    attack: 99,
    strength: 99,
    defence: 99,
    magic: 99,
    ranged: 99,
    necromancy: 99,
    smithing: 99,
    crafting: 99,
    prayer: 99,
    hunter: 99,
    runecrafting: 99,
  };
  return {
    levels,
    regions,
    quests: new Set(["ritual-of-the-mahjarrat", "necromancy-questline"]),
    flags,
    relicTier: 6,
  };
}

console.log("═══════════════════════════════════════════════════════════");
console.log(" Equilibrium gear audit — illegal combos that still pass");
console.log("═══════════════════════════════════════════════════════════\n");

// ── 1. Hand catalog: free items that look elective ─────────────────
console.log("── Hand ITEMS with requires=[] at T90+ ──");
for (const i of ITEMS.filter((x) => x.requires.length === 0 && x.tier >= 90)) {
  console.log(
    `  [INFO] free T${i.tier} ${i.style}/${i.slot}: ${i.name}${i.notes ? ` — ${i.notes}` : ""}`,
  );
  issues.push({
    severity: "INFO",
    kind: "free-high-tier",
    detail: `${i.id} T${i.tier} ${i.style}`,
  });
}

// ── 2. resolveLoadout (hand) style/region ──────────────────────────
console.log("\n── resolveLoadout (hand ITEMS) ──");
for (const style of STYLES) {
  for (const mode of MODES) {
    const load = resolveLoadout(FREE_REGION_IDS, style, mode);
    const bad = findIllegalLoadoutPieces(load);
    for (const b of bad) {
      const msg = `free ${style}/${mode}: ${b.piece.name} — ${b.reasons.join("; ")}`;
      console.log(`  [CRITICAL] ${msg}`);
      issues.push({ severity: "CRITICAL", kind: "hand-loadout-illegal", detail: msg });
    }
    for (const p of load.pieces) {
      if (p.slot === "weapon" && p.style === "all") {
        const msg = `free ${style}/${mode}: style:all weapon ${p.name}`;
        console.log(`  [CRITICAL] ${msg}`);
        issues.push({ severity: "CRITICAL", kind: "all-weapon", detail: msg });
      }
      if (style === "necromancy" && /cryptbloom/i.test(p.id + p.name)) {
        const msg = `free ${style}/${mode}: Cryptbloom on necro`;
        console.log(`  [CRITICAL] ${msg}`);
        issues.push({ severity: "CRITICAL", kind: "cryptbloom-necro", detail: msg });
      }
    }
  }
}

// ── 3. resolveLoadoutOOP + gearFromPackage ─────────────────────────
console.log("\n── gearFromPackage / resolveLoadoutOOP ──");
for (const pkg of REGION_PACKAGES) {
  for (const style of STYLES) {
    for (const arch of ARCHES) {
      const { loadout, snapshot } = gearFromPackage(pkg, style, arch);
      const bad = findIllegalLoadoutPieces(loadout);
      for (const b of bad) {
        const msg = `${pkg.id} ${style}/${arch}: ${b.piece.name} — ${b.reasons.join("; ")}`;
        console.log(`  [CRITICAL] ${msg}`);
        issues.push({ severity: "CRITICAL", kind: "oop-illegal", detail: msg });
      }
      for (const p of loadout.pieces) {
        if (p.slot === "weapon" && p.style !== style && p.style !== "all") {
          const msg = `${pkg.id} ${style}/${arch}: wrong-style weapon ${p.name} (${p.style})`;
          console.log(`  [CRITICAL] ${msg}`);
          issues.push({ severity: "CRITICAL", kind: "wrong-style-weapon", detail: msg });
        }
        if (p.slot === "weapon" && p.style === "all") {
          const msg = `${pkg.id} ${style}/${arch}: style:all weapon ${p.name}`;
          console.log(`  [CRITICAL] ${msg}`);
          issues.push({ severity: "CRITICAL", kind: "all-weapon", detail: msg });
        }
        if (style === "necromancy" && /cryptbloom/i.test(p.id + p.name)) {
          const msg = `${pkg.id} necro/${arch}: Cryptbloom equipped`;
          console.log(`  [CRITICAL] ${msg}`);
          issues.push({ severity: "CRITICAL", kind: "cryptbloom-necro", detail: msg });
        }
        // Region gate
        const unlocked = new Set(loadout.unlocked);
        if (!itemAccessible(p, unlocked)) {
          const miss = p.requires.filter((r) => !unlocked.has(r));
          // Empty requires is free — only flag non-empty missing
          if (miss.length) {
            const msg = `${pkg.id} ${style}/${arch}: ${p.name} needs ${miss.join("+")}`;
            console.log(`  [CRITICAL] ${msg}`);
            issues.push({ severity: "CRITICAL", kind: "region-gate", detail: msg });
          }
        }
      }
      // Armour profile must not be cryptbloom on non-magic
      if (snapshot.armourProfileId === "cryptbloom-tank" && style !== "magic") {
        const msg = `${pkg.id} ${style}/${arch}: profile cryptbloom-tank`;
        console.log(`  [CRITICAL] ${msg}`);
        issues.push({ severity: "CRITICAL", kind: "profile-cryptbloom", detail: msg });
      }
      if (
        style === "necromancy" &&
        arch === "shield-tank" &&
        snapshot.armourProfileId &&
        !["deathwarden-tank", "tank-aegis", "mixed-aegis-power"].includes(
          snapshot.armourProfileId,
        )
      ) {
        // TFN on tank is odd but not critical if deathwarden preferred
        if (snapshot.armourProfileId === "tfn-power") {
          console.log(
            `  [WARN] ${pkg.id} necro shield-tank got tfn-power (prefer deathwarden for Aegis)`,
          );
          issues.push({
            severity: "WARN",
            kind: "necro-tank-profile",
            detail: `${pkg.id} tfn on shield-tank`,
          });
        }
      }
    }
  }
}

// ── 4. Necro free BiS path ─────────────────────────────────────────
console.log("\n── Necro free BiS (Deathwarden / TFN / Rasial) ──");
{
  const tank = gearFromPackage(
    REGION_PACKAGES.find((p) => p.id === "free-only")!,
    "necromancy",
    "shield-tank",
  );
  const power = gearFromPackage(
    REGION_PACKAGES.find((p) => p.id === "free-only")!,
    "necromancy",
    "power-dps",
  );
  const tankBody = tank.loadout.pieces.find((p) => p.slot === "body");
  const powerBody = power.loadout.pieces.find((p) => p.slot === "body");
  console.log(
    `  tank body: ${tankBody?.name ?? "NONE"} → profile ${tank.snapshot.armourProfileId}`,
  );
  console.log(
    `  power body: ${powerBody?.name ?? "NONE"} → profile ${power.snapshot.armourProfileId}`,
  );
  if (tankBody && /cryptbloom/i.test(tankBody.name)) {
    issues.push({
      severity: "CRITICAL",
      kind: "cryptbloom-necro",
      detail: "free necro tank body is Cryptbloom",
    });
  }
  if (!tankBody || !/deathwarden/i.test(tankBody.id + tankBody.name)) {
    console.log("  [WARN] free necro tank body is not Deathwarden");
    issues.push({
      severity: "WARN",
      kind: "necro-tank-body",
      detail: tankBody?.name ?? "missing",
    });
  }
  if (
    !powerBody ||
    !/tfn|first necromancer|deathdealer/i.test(powerBody.id + powerBody.name)
  ) {
    console.log("  [WARN] free necro power body is not TFN/Deathdealer");
    issues.push({
      severity: "WARN",
      kind: "necro-power-body",
      detail: powerBody?.name ?? "missing",
    });
  }
  // Hard Rasial gate without ignoreBossFlags
  const hard = player(FREE_REGION_IDS, { bosses: false });
  const hardLoad = resolveLoadoutOOP(hard, "necromancy", "dual", {
    ignoreBossFlags: false,
  });
  const hasOmni = hardLoad.pieces.some((p) => /omni/i.test(p.name));
  const hasTfn = hardLoad.pieces.some((p) =>
    /first necromancer|tfn/i.test(p.id + p.name),
  );
  console.log(
    `  hard Rasial gate (no flags): omni=${hasOmni} tfn=${hasTfn} → ${hardLoad.pieces
      .filter((p) => p.slot === "weapon" || p.slot === "body")
      .map((p) => p.name)
      .join(" | ")}`,
  );
  if (hasOmni || hasTfn) {
    console.log("  [CRITICAL] Rasial uniques accessible without killed:rasial");
    issues.push({
      severity: "CRITICAL",
      kind: "rasial-gate",
      detail: "Omni/TFN without killed:rasial",
    });
  }
}

// ── 5. Armour profile sanitize ─────────────────────────────────────
console.log("\n── Armour profile style gates ──");
for (const style of STYLES) {
  for (const prof of ARMOUR_PROFILES) {
    const s = sanitizeArmourProfile(style, prof.id as ArmourProfileId, {
      hasAegis: true,
      offhand: "shield",
    });
    if (s.remapped) {
      console.log(`  [OK] ${prof.id} @ ${style} → ${s.profileId} (${s.reason})`);
    }
    // modelCombat must not keep illegal profile
    if (prof.legalStyles && !prof.legalStyles.includes(style as Style)) {
      const r = modelCombat({
        picks: ["Order", "Order", "Chaos", "Order", "Balance", "Order"],
        style: style as Style,
        stage: stageById("endgame"),
        archetype: "shield-tank",
        herbloreLevel: 110,
        targetTiles: 1,
        multiContentWeight: 0.1,
        powerburst: true,
        armourProfile: prof.id as ArmourProfileId,
      });
      if (r.armourBonuses?.profile === prof.id) {
        const msg = `modelCombat kept illegal ${prof.id} on ${style}`;
        console.log(`  [CRITICAL] ${msg}`);
        issues.push({ severity: "CRITICAL", kind: "profile-not-remapped", detail: msg });
      }
    }
  }
}

// ── 6. Invention gating ────────────────────────────────────────────
console.log("\n── Invention region gates ──");
{
  const free = gearFromPackage(
    REGION_PACKAGES.find((p) => p.id === "free-only")!,
    "magic",
    "power-dps",
  );
  const freeInv = modelCombat({
    picks: ["Order", "Order", "Chaos", "Order", "Balance", "Order"],
    style: "magic",
    stage: stageById("endgame"),
    archetype: "power-dps",
    herbloreLevel: 110,
    targetTiles: 1,
    multiContentWeight: 0.1,
    powerburst: true,
    gear: free.snapshot,
    inventionTier: "standard",
  });
  console.log(
    `  free-only + standard invention: tier=${freeInv.invention?.tier} locked=${freeInv.invention?.locked}`,
  );
  if (freeInv.invention && !freeInv.invention.locked && freeInv.invention.tier !== "none") {
    console.log("  [CRITICAL] Invention available without Asgarnia");
    issues.push({
      severity: "CRITICAL",
      kind: "invention-ungated",
      detail: "standard invention on free-only",
    });
  }

  const asg = gearFromPackage(
    REGION_PACKAGES.find((p) => p.id === "forinthry-asgarnia-anach")!,
    "magic",
    "power-dps",
  );
  const asgInv = modelCombat({
    picks: ["Order", "Order", "Chaos", "Order", "Balance", "Order"],
    style: "magic",
    stage: stageById("endgame"),
    archetype: "power-dps",
    herbloreLevel: 110,
    targetTiles: 1,
    multiContentWeight: 0.1,
    powerburst: true,
    gear: asg.snapshot,
    inventionTier: "standard",
  });
  console.log(
    `  Wildy+Asg+Ana + standard: tier=${asgInv.invention?.tier} locked=${asgInv.invention?.locked}`,
  );
  if (asgInv.invention?.locked || asgInv.invention?.tier === "none") {
    console.log("  [WARN] Invention locked despite Asgarnia in package");
    issues.push({
      severity: "WARN",
      kind: "invention-false-lock",
      detail: "standard invention blocked with Asgarnia",
    });
  }

  // Ancient needs Kandarin
  const noKand = modelCombat({
    picks: ["Order", "Order", "Chaos", "Order", "Balance", "Order"],
    style: "magic",
    stage: stageById("endgame"),
    archetype: "power-dps",
    herbloreLevel: 110,
    targetTiles: 1,
    multiContentWeight: 0.1,
    powerburst: true,
    gear: asg.snapshot,
    inventionTier: "ancient",
  });
  console.log(
    `  Wildy+Asg+Ana + ancient: tier=${noKand.invention?.tier} (expect standard fallback)`,
  );
  if (noKand.invention?.tier === "ancient") {
    console.log("  [CRITICAL] Ancient Invention without Kandarin");
    issues.push({
      severity: "CRITICAL",
      kind: "ancient-invention-ungated",
      detail: "ancient without kandarin",
    });
  }
}

// ── 7. Catalog style:all weapons that would pollute if gate fails ──
console.log("\n── Catalog weapons style:all (should not equip as BiS) ──");
const allWeps = EQUIPMENT_CATALOG.filter(
  (e) => e.slot === "weapon" && e.style === "all" && e.abilityDamage > 0,
);
for (const w of allWeps.slice(0, 15)) {
  console.log(`  [INFO] ${w.id} AD${w.abilityDamage} regs=[${w.regions.join(",")}]`);
}
if (allWeps.length > 15) console.log(`  … +${allWeps.length - 15} more`);

// ── 8. Sample loadouts print ───────────────────────────────────────
console.log("\n── Sample free-only loadouts ──");
for (const style of STYLES) {
  const { loadout, snapshot } = gearFromPackage(
    REGION_PACKAGES.find((p) => p.id === "free-only")!,
    style,
    "shield-tank",
  );
  const core = loadout.pieces
    .filter((p) => ["weapon", "body", "offhand"].includes(p.slot))
    .map((p) => `${p.slot}:${p.name}[${p.style}]`)
    .join(" | ");
  console.log(`  ${style}: ${core}`);
  console.log(`         profile=${snapshot.armourProfileId} AD=${snapshot.baselineAd} arm=${snapshot.armour}`);
}

// ── Summary ────────────────────────────────────────────────────────
const crit = issues.filter((i) => i.severity === "CRITICAL");
const warn = issues.filter((i) => i.severity === "WARN");
const info = issues.filter((i) => i.severity === "INFO");

console.log("\n═══════════════════════════════════════════════════════════");
console.log(` SUMMARY: ${crit.length} CRITICAL · ${warn.length} WARN · ${info.length} INFO`);
console.log("═══════════════════════════════════════════════════════════");
if (crit.length) {
  console.log("\nCRITICAL remaining:");
  for (const c of crit) console.log(`  • [${c.kind}] ${c.detail}`);
  process.exitCode = 1;
} else {
  console.log("\nNo CRITICAL illegal combos remaining in audited paths.");
  console.log("Known residual gaps (non-blocking):");
  console.log("  • Wiki-generated style:all weapons still in catalog (blocked at resolve)");
  console.log("  • gearFromPackage uses ignoreBossFlags=true (endgame assumption)");
  console.log("  • Hybrid style:all armour (achto/gemstone) still equippable as tank fill");
  console.log("  • Abstract GEAR_STAGES path has no item-level region checks");
}
