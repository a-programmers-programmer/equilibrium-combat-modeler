/**
 * Print full XP ladders + league route.
 * Usage: npx tsx scripts/chart-routes.ts
 */
import { writeFileSync, mkdirSync } from "fs";
import {
  SKILLS,
  chartAllSkills,
  chartSkill,
  topMethodMatrix,
  buildLeagueRoute,
  leagueMultForRelicTier,
  type SkillId,
} from "../src/lib/eq/xp.ts";

const ELECTIVES = ["asgarnia", "desert", "forinthry"];

function fmtHr(h: number): string {
  if (!Number.isFinite(h)) return "∞";
  if (h < 0.05) return "<3m";
  if (h < 1) return `${Math.round(h * 60)}m`;
  return `${h.toFixed(1)}h`;
}

function fmtXp(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}m`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(Math.round(n));
}

console.log("╔══════════════════════════════════════════════════════════════╗");
console.log("║  EQUILIBRIUM — TOP XP/HR ROUTES (league mult applied)       ║");
console.log("╚══════════════════════════════════════════════════════════════╝\n");

for (const tier of [1, 2, 4, 6]) {
  const mult = leagueMultForRelicTier(tier);
  console.log(`\n### Method matrix @ relic band T${tier} (${mult}×) · electives ${ELECTIVES.join("+")}\n`);
  const matrix = topMethodMatrix(ELECTIVES, tier);
  for (const row of matrix) {
    console.log(`── ${row.name} ──`);
    for (const b of row.bands) {
      console.log(
        `  ${b.range.padEnd(8)} ${fmtXp(b.xpHr).padStart(8)}/hr  [${b.intensity.padEnd(5)}]  ${b.method}`,
      );
    }
  }
}

// Full 1→99/120 hours at 16× with electives
console.log("\n\n### Hours 1→goal at 16× (Asgarnia+Desert+Forinthry) — SLOWEST FIRST\n");
const targets: Partial<Record<SkillId, number>> = {};
for (const s of SKILLS) {
  if (s.maxLevel >= 120) targets[s.id] = s.id === "necromancy" || s.id === "invention" || s.id === "slayer" || s.id === "herblore" || s.id === "farming" || s.id === "archaeology" || s.id === "dungeoneering" ? 120 : 99;
  else if (s.maxLevel >= 110) targets[s.id] = 110;
  else targets[s.id] = 99;
}
const all = chartAllSkills(targets, ELECTIVES, 6, 1);
let sum = 0;
for (const s of all) {
  sum += s.totalHours;
  console.log(
    `${s.name.padEnd(14)} 1→${String(s.to).padEnd(3)}  ${fmtHr(s.totalHours).padStart(7)}  peak ${fmtXp(s.peakXpHr)}/hr  via ${s.bestLateMethod}`,
  );
}
console.log(`\nSUM pure sequential: ${fmtHr(sum)} (overstates — combat multi-trains & passive farm parallelize)\n`);

// Detail ladders for key skills
console.log("\n### Detailed ladders (16×)\n");
for (const skill of ["necromancy", "herblore", "invention", "slayer", "prayer", "agility", "runecrafting", "archaeology"] as SkillId[]) {
  const steps = chartSkill(skill, 1, targets[skill] ?? 99, ELECTIVES, 6);
  console.log(`\n${skill.toUpperCase()}`);
  for (const st of steps) {
    console.log(
      `  ${String(st.levelFrom).padStart(3)}→${String(st.levelTo).padEnd(3)}  ${fmtHr(st.hours).padStart(6)}  ${fmtXp(st.effectiveXpHr)}/hr  ${st.method.name}`,
    );
  }
}

// League phased route
console.log("\n\n### PHASED LEAGUE ROUTE (necro path)\n");
const route = buildLeagueRoute({ combatPath: "necro", electives: ELECTIVES });
let routeH = 0;
for (const p of route) {
  routeH += p.estimatedHours;
  console.log(`\n${p.title}`);
  console.log(`  Goal: ${p.goal}`);
  console.log(`  Est. active hours: ${fmtHr(p.estimatedHours)} · relic band ~T${p.relicTier} · unlocks [${p.electives.join(", ") || "free only"}]`);
  for (const pr of p.priorities) {
    console.log(`  • ${pr.skill} → ${pr.to}: ${pr.method}`);
    console.log(`      (${pr.why})`);
  }
  for (const n of p.notes) console.log(`  ⚠ ${n}`);
}
console.log(`\nRoute est. total (phased, overlapping): ~${fmtHr(routeH)}`);

mkdirSync("artifacts", { recursive: true });
const report = {
  generated: new Date().toISOString(),
  electives: ELECTIVES,
  methodMatrix16x: topMethodMatrix(ELECTIVES, 6),
  hoursToCap16x: all.map((s) => ({
    skill: s.skill,
    name: s.name,
    to: s.to,
    hours: Math.round(s.totalHours * 100) / 100,
    peakXpHr: Math.round(s.peakXpHr),
    lateMethod: s.bestLateMethod,
    steps: s.steps.map((st) => ({
      from: st.levelFrom,
      to: st.levelTo,
      hours: Math.round(st.hours * 100) / 100,
      xpHr: Math.round(st.effectiveXpHr),
      method: st.method.name,
      intensity: st.method.intensity,
    })),
  })),
  sequentialSumHours: Math.round(sum * 10) / 10,
  phasedRoute: route,
  phasedRouteHours: Math.round(routeH * 10) / 10,
};
writeFileSync("artifacts/xp-routes.json", JSON.stringify(report, null, 2));
console.log("\nWrote artifacts/xp-routes.json");
