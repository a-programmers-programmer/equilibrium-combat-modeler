/**
 * Wazzy-tier-aligned constrained search + multi-panel damage plots.
 * Starter regions = Misthalin+Havenhythe+Karamja (NOT F2P).
 *
 * npx tsx scripts/sim-wazzy-constrained.ts
 */
import { writeFileSync, mkdirSync } from "fs";
import type { Path } from "../src/lib/eq/blessings.ts";
import { activeBlessings, validateBlessingPathAffinity } from "../src/lib/eq/blessings.ts";
import { stageById, type Style } from "../src/lib/eq/gear.ts";
import { modelCombat, gearFromPackage, gearFromRegions, type GearSnapshot } from "../src/lib/eq/model.ts";
import { REGION_PACKAGES } from "../src/lib/eq/items.ts";
import {
  validateRelicLoadout,
  stackRelicPlayerMult,
  type RelicId,
  activeRelicsFromLoadout,
  relicRestrictionReport,
} from "../src/lib/eq/sim/relics.ts";
import {
  WAZZY_DOC_URL,
  WAZZY_RELIC_TIERS,
  WAZZY_COMBAT_ROUTES,
  WAZZY_REGIONS,
  type CombatRoute,
} from "../src/lib/eq/sim/wazzy-tiers.ts";
import { pickBestFamiliar, type FamiliarId } from "../src/lib/eq/sim/summoning.ts";
import { Player } from "../src/lib/eq/sim/player.ts";
import type { RegionTag } from "../src/lib/eq/sim/requirements.ts";
import type { TargetTag } from "../src/lib/eq/sim/bane.ts";

const stage = stageById("endgame");

function playerFor(electives: RegionTag[], sum: number): Player {
  const p = new Player({ electives, relicTier: 7 });
  p.setLevel("summoning", sum);
  for (const sk of ["attack", "strength", "defence", "magic", "ranged", "necromancy"] as const) {
    p.setLevel(sk, 99);
  }
  p.setFlag("league:contract-claws-auto");
  if (electives.includes("forinthry")) {
    p.setFlag("unlocked:ancient-summoning");
    p.setFlag("unlocked:binding-contracts");
    p.setFlag("unlocked:binding-ripper");
    p.setFlag("killed:nihil");
    p.setFlag("unlocked:nihil-pouches");
    p.setFlag("unlocked:dungeoneering-kalg");
  }
  return p;
}

function primarySecondary(active: RelicId[]): { primary: RelicId; secondary: RelicId | null } {
  const combatOrder: RelicId[] = [
    "devout",
    "infernal-fire",
    "icyenic-faith",
    "naragi-edict",
    "perkfection",
    "divine-druid",
  ];
  const picked = combatOrder.filter((id) => active.includes(id));
  return {
    primary: picked[0] ?? "none",
    secondary: picked[1] ?? null,
  };
}

function gearFor(style: Style, electives: RegionTag[]) {
  const arch = style === "melee" ? "shield-tank" : "power-dps";
  if (electives.length === 0) {
    return gearFromPackage(REGION_PACKAGES.find((p) => p.id === "free-only")!, style, arch);
  }
  // Prefer matching packages
  const set = new Set(electives);
  if (set.has("forinthry") && set.has("desert") && set.has("anachronia")) {
    // no exact package — use regions
    return gearFromRegions(electives as any, style, arch);
  }
  if (set.has("forinthry") && set.has("asgarnia") && set.has("desert")) {
    return gearFromPackage(
      REGION_PACKAGES.find((p) => p.id === "desert-asgarnia-forinthry")!,
      style,
      arch,
    );
  }
  return gearFromRegions(electives as any, style, arch);
}

function scoreRoute(
  route: CombatRoute,
  style: Style,
  hour: number,
  sum: number,
  targetTags: TargetTag[] = ["general"],
) {
  const v = validateRelicLoadout({
    byTier: route.byTier,
    rejuvenatedExtra: route.rejuvenatedExtra,
  });
  const electives = hour < 12 ? ([] as RegionTag[]) : hour < 22 ? route.electives.slice(0, 1) : hour < 32 ? route.electives.slice(0, 2) : route.electives;
  // progressive electives
  const player = playerFor(electives, sum);
  const { snapshot, offhand } = gearFor(style, electives);
  const best = pickBestFamiliar(player.snapshot(), {
    devout: v.devout,
    divineDruid: v.divineDruid,
    accessMode: "soft",
  });
  const { primary, secondary } = primarySecondary(v.active);
  const st = hour < 8 ? stageById("early")! : hour < 18 ? stageById("mid")! : hour < 30 ? stageById("late")! : stage;

  let snap: GearSnapshot = snapshot;
  if (hour < 18) {
    const w = hour / 18;
    const arch = style === "melee" ? "shield-tank" : "power-dps";
    snap = {
      ...snapshot,
      armour: Math.round(st.armour[arch] * (1 - w) + snapshot.armour * w),
      baselineAd: Math.round(st.baselineAd[style] * (1 - w) + snapshot.baselineAd * w),
    };
  }

  const r = modelCombat({
    picks: route.blessingPicks,
    style,
    stage: st,
    archetype: style === "melee" ? "shield-tank" : "power-dps",
    offhand,
    herbloreLevel: Math.min(110, 40 + hour),
    targetTiles: 1,
    multiContentWeight: 0,
    powerburst: hour >= 18,
    gear: snap,
    familiar: best.familiarId as FamiliarId,
    relic: primary,
    relicSecondary: secondary,
    summoningLevel: sum,
    summoningPlayer: player.snapshot(),
    familiarAccess: "soft",
    baneRegions: ["free", "misthalin", "havenhythe", "karamja", ...electives],
    targetTags,
  });

  return {
    route: route.id,
    label: route.label,
    valid: v.valid,
    errors: v.errors,
    active: v.active,
    style,
    hour,
    sum,
    electives,
    familiar: best.name,
    famDps: r.familiar?.dps ?? 0,
    playerDps: r.dps,
    totalDps: r.totalDps,
    blessings: activeBlessings(route.blessingPicks).map((b) => b.id),
    god: validateBlessingPathAffinity(route.blessingPicks),
  };
}

console.log("╔══════════════════════════════════════════════════════════════╗");
console.log("║  WAZZY-TIER CONSTRAINED SEARCH + DAMAGE PLOTS                ║");
console.log("╚══════════════════════════════════════════════════════════════╝\n");
console.log("Doc:", WAZZY_DOC_URL);
console.log("\nWazzy relic tiers:");
for (const [t, info] of Object.entries(WAZZY_RELIC_TIERS)) {
  console.log(`  T${t} (${info.confidence}): ${info.relics.join(", ")}`);
}
console.log("\n", relicRestrictionReport().summary);

// Validate all routes
console.log("\n=== ROUTE VALIDITY (Wazzy constraints) ===");
for (const route of WAZZY_COMBAT_ROUTES) {
  const v = validateRelicLoadout({
    byTier: route.byTier,
    rejuvenatedExtra: route.rejuvenatedExtra,
  });
  console.log(
    `${v.valid ? "VALID  " : "INVALID"} ${route.id.padEnd(24)} active=[${v.active.join(", ")}]`,
  );
  if (v.errors.length) console.log("        ", v.errors.join("; "));
}

// Endgame ranking
console.log("\n=== ENDGAME TOTAL DPS (sum99, full electives, melee+necro) ===");
const endRows: ReturnType<typeof scoreRoute>[] = [];
for (const route of WAZZY_COMBAT_ROUTES) {
  for (const style of ["melee", "necromancy", "magic", "ranged"] as Style[]) {
    endRows.push(scoreRoute(route, style, 50, 99));
  }
}
endRows
  .filter((r) => r.valid)
  .sort((a, b) => b.totalDps - a.totalDps)
  .slice(0, 16)
  .forEach((r, i) => {
    console.log(
      `#${String(i + 1).padStart(2)} ${Math.round(r.totalDps).toLocaleString().padStart(8)} ${r.style.padEnd(11)} ${r.route.padEnd(22)} fam=${Math.round(r.famDps)} ${r.familiar.slice(0, 22)}`,
    );
  });

// Capability matrix: what each region set unlocks
console.log("\n=== CAPABILITY GATES (necro, devout+infernal path) ===");
const route = WAZZY_COMBAT_ROUTES.find((r) => r.id === "devout-infernal")!;
for (const [label, el, sum] of [
  ["starter only", [] as RegionTag[], 99],
  ["+forinthry", ["forinthry"] as RegionTag[], 99],
  ["+forinthry+desert", ["forinthry", "desert"] as RegionTag[], 99],
  ["Wazzy full", WAZZY_REGIONS, 99],
  ["starter sum70", [] as RegionTag[], 70],
] as const) {
  const r = scoreRoute({ ...route, electives: [...el] }, "necromancy", 50, sum);
  console.log(
    `${label.padEnd(22)} fam=${Math.round(r.famDps).toString().padStart(5)} ${r.familiar.padEnd(28)} total=${Math.round(r.totalDps)}`,
  );
}

// Hour curves for key routes
const curveHours = [0, 4, 8, 12, 16, 20, 24, 28, 32, 40, 50, 60, 80];
const sumCurve = (h: number) => {
  if (h < 6) return 40;
  if (h < 14) return 70;
  if (h < 24) return 90;
  if (h < 36) return 96;
  return 99;
};

const plotRoutes = [
  "devout-infernal",
  "devout-icyenic",
  "perk-devout-infernal",
  "rejuv-druid-icyenic",
  "prod-infernal",
  "no-combat-relics",
] as const;

const colors: Record<string, string> = {
  "devout-infernal": "#f472b6",
  "devout-icyenic": "#38bdf8",
  "perk-devout-infernal": "#a78bfa",
  "rejuv-druid-icyenic": "#fbbf24",
  "prod-infernal": "#4ade80",
  "no-combat-relics": "#64748b",
};

const series: { id: string; name: string; color: string; points: { hour: number; total: number; fam: number; sum: number; electives: string }[] }[] = [];

for (const id of plotRoutes) {
  const route = WAZZY_COMBAT_ROUTES.find((r) => r.id === id)!;
  const points = curveHours.map((hour) => {
    const sum = sumCurve(hour);
    // progressive electives inside scoreRoute by hour
    const r = scoreRoute(route, "melee", hour, sum);
    return {
      hour,
      total: r.totalDps,
      fam: r.famDps,
      sum,
      electives: r.electives.join("+") || "starter",
    };
  });
  series.push({ id, name: route.label, color: colors[id]!, points });
}

console.log("\n=== MELEE TOTAL @ HOURS (Wazzy routes) ===");
for (const h of [8, 20, 32, 50]) {
  console.log(`Hour ${h}:`);
  for (const s of series) {
    const p = s.points.find((x) => x.hour === h)!;
    console.log(
      `  ${s.id.padEnd(22)} ${Math.round(p.total).toLocaleString().padStart(8)}  fam ${Math.round(p.fam).toString().padStart(5)}  sum${p.sum}  ${p.electives}`,
    );
  }
}

// Multi-panel SVG: total DPS, familiar DPS, starter vs full
function svgPlot(
  title: string,
  seriesIn: typeof series,
  yKey: "total" | "fam",
  maxH = 80,
): string {
  const W = 920;
  const H = 420;
  const pad = { l: 64, r: 20, t: 44, b: 52 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const maxY = Math.max(...seriesIn.flatMap((s) => s.points.map((p) => p[yKey]))) * 1.08 || 1;
  const x = (h: number) => pad.l + (h / maxH) * innerW;
  const y = (v: number) => pad.t + innerH - (v / maxY) * innerH;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="100%" height="100%" fill="#0f172a"/>
  <text x="${W / 2}" y="26" text-anchor="middle" fill="#e2e8f0" font-family="system-ui,sans-serif" font-size="15" font-weight="600">${title}</text>
  <text x="${W / 2}" y="42" text-anchor="middle" fill="#64748b" font-size="10" font-family="system-ui,sans-serif">Wazzy tier map · starter regions ≠ F2P · gated familiars</text>`;
  for (const h of [0, 20, 40, 60, 80]) {
    s += `<line x1="${x(h)}" y1="${pad.t}" x2="${x(h)}" y2="${pad.t + innerH}" stroke="#1e293b"/><text x="${x(h)}" y="${H - 20}" text-anchor="middle" fill="#94a3b8" font-size="10">${h}h</text>`;
  }
  for (let i = 0; i <= 4; i++) {
    const v = (maxY * i) / 4;
    s += `<line x1="${pad.l}" y1="${y(v)}" x2="${pad.l + innerW}" y2="${y(v)}" stroke="#1e293b"/><text x="${pad.l - 6}" y="${y(v) + 3}" text-anchor="end" fill="#94a3b8" font-size="9">${(v / 1000).toFixed(0)}k</text>`;
  }
  seriesIn.forEach((ser, idx) => {
    const d = ser.points
      .map((p, i) => `${i ? "L" : "M"} ${x(p.hour).toFixed(1)} ${y(p[yKey]).toFixed(1)}`)
      .join(" ");
    s += `<path d="${d}" fill="none" stroke="${ser.color}" stroke-width="2.2"/>`;
    s += `<rect x="${pad.l + 8}" y="${pad.t + 8 + idx * 14}" width="12" height="3" fill="${ser.color}"/><text x="${pad.l + 24}" y="${pad.t + 12 + idx * 14}" fill="#cbd5e1" font-size="10" font-family="system-ui,sans-serif">${ser.name.slice(0, 48)}</text>`;
  });
  s += `</svg>`;
  return s;
}

mkdirSync("artifacts", { recursive: true });
mkdirSync("public", { recursive: true });

const svgTotal = svgPlot("Melee total DPS vs hours (Wazzy routes)", series, "total");
const svgFam = svgPlot("Familiar DPS vs hours (region/sum gated)", series, "fam");
writeFileSync("artifacts/wazzy-dps-hours.svg", svgTotal);
writeFileSync("artifacts/wazzy-fam-hours.svg", svgFam);
writeFileSync("public/wazzy-dps-hours.svg", svgTotal);
writeFileSync("public/wazzy-fam-hours.svg", svgFam);

// Style comparison bar chart endgame
const styleBars = (["melee", "necromancy", "magic", "ranged"] as Style[]).map((style) => {
  const best = endRows
    .filter((r) => r.style === style && r.valid)
    .sort((a, b) => b.totalDps - a.totalDps)[0]!;
  return { style, ...best };
});
const maxBar = Math.max(...styleBars.map((b) => b.totalDps));
let barSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="280" viewBox="0 0 720 280">
  <rect width="100%" height="100%" fill="#0f172a"/>
  <text x="360" y="28" text-anchor="middle" fill="#e2e8f0" font-size="15" font-weight="600" font-family="system-ui,sans-serif">Best legal endgame total DPS by style (Wazzy tiers)</text>`;
styleBars.forEach((b, i) => {
  const y = 50 + i * 50;
  const w = (b.totalDps / maxBar) * 480;
  barSvg += `<text x="12" y="${y + 18}" fill="#94a3b8" font-size="12" font-family="system-ui,sans-serif">${b.style}</text>
  <rect x="100" y="${y}" width="${w}" height="28" rx="4" fill="#38bdf8"/>
  <text x="${110 + w}" y="${y + 18}" fill="#e2e8f0" font-size="11" font-family="system-ui,sans-serif">${Math.round(b.totalDps).toLocaleString()} · ${b.route}</text>`;
});
barSvg += `</svg>`;
writeFileSync("artifacts/wazzy-style-bars.svg", barSvg);
writeFileSync("public/wazzy-style-bars.svg", barSvg);

const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><title>Wazzy-tier Equilibrium DPS</title>
<style>
body{margin:0;background:#0f172a;color:#e2e8f0;font-family:system-ui,sans-serif;padding:24px;line-height:1.5}
h1{font-size:1.3rem} h2{font-size:1.05rem;color:#94a3b8;margin-top:2rem}
a{color:#38bdf8} .card{background:#1e293b;border-radius:12px;padding:16px;margin:16px 0;max-width:960px}
img,object{max-width:100%;border-radius:8px;border:1px solid #334155}
table{border-collapse:collapse;font-size:13px} th,td{border:1px solid #334155;padding:6px 10px}
th{background:#0f172a} .ok{color:#4ade80} .bad{color:#f87171}
</style></head><body>
<h1>Wazzy-aligned relic tiers · constrained DPS</h1>
<p>Source: <a href="${WAZZY_DOC_URL}">Wazzy Leagues Hub</a>. 
<strong>Starter regions</strong> = Misthalin + Havenhythe + Karamja (everyone gets these — not free-to-play).</p>
<div class="card">
<h2>Wazzy relic tier map</h2>
<table><tr><th>Tier</th><th>Relics</th><th>Confidence</th></tr>
${Object.entries(WAZZY_RELIC_TIERS)
  .map(
    ([t, i]) =>
      `<tr><td>T${t}</td><td>${i.relics.join(", ")}</td><td>${i.confidence}</td></tr>`,
  )
  .join("")}
</table>
<p>Key: <b>T5 Devout</b> + <b>T7 Infernal</b> are different tiers → both legal. 
<b>T7 Infernal / Naragi / Icyenic</b> are mutually exclusive. 
<b>T6 Rejuvenated</b> reclaimes a <i>previous</i> tier skip (e.g. Divine Druid).</p>
</div>
<div class="card"><h2>Melee total DPS vs hours</h2>
<object data="/wazzy-dps-hours.svg" type="image/svg+xml"></object></div>
<div class="card"><h2>Familiar DPS vs hours (gated)</h2>
<object data="/wazzy-fam-hours.svg" type="image/svg+xml"></object></div>
<div class="card"><h2>Best endgame by style</h2>
<object data="/wazzy-style-bars.svg" type="image/svg+xml"></object></div>
</body></html>`;
writeFileSync("public/wazzy-dps.html", html);

const report = {
  source: WAZZY_DOC_URL,
  tiers: WAZZY_RELIC_TIERS,
  routes: WAZZY_COMBAT_ROUTES.map((r) => ({
    id: r.id,
    label: r.label,
    validation: validateRelicLoadout({
      byTier: r.byTier,
      rejuvenatedExtra: r.rejuvenatedExtra,
    }),
  })),
  endgameTop: endRows.filter((r) => r.valid).sort((a, b) => b.totalDps - a.totalDps).slice(0, 20),
  series,
  styleBars,
  conclusions: {
    freeMeans: "starter regions (Misthalin/Havenhythe/Karamja), NOT free-to-play",
    bestCombatRelicPair: "T5 Devout + T7 Infernal (or Icyenic) — different tiers",
    cannot: "Infernal+Icyenic same T7; Rejuvenated does not unlock same-tier second pick",
    regions: "Forinthry required for Ripper; starter-only → Steel titan with Devout",
    wazzyPersonal: "Survivalist→Superheated→Voidwalker→Antiquarian→Production→Rejuv(Druid)→Icyenic",
  },
};
writeFileSync("artifacts/wazzy-constrained-sim.json", JSON.stringify(report, null, 2));
console.log("\nWrote artifacts/wazzy-*.svg, public/wazzy-dps.html, artifacts/wazzy-constrained-sim.json");
