import { useMemo, useState, useCallback } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Shield,
  Swords,
  Scale,
  Flame,
  ChevronRight,
  AlertTriangle,
  Layers,
  Target,
  BookOpen,
  FlaskConical,
  Trophy,
  Map,
  Copy,
  Check,
  Package,
  Crosshair,
  Info,
  Route,
  Timer,
  TrendingUp,
} from "lucide-react";
import { PATHS, type Path, BLESSINGS, blessingAt, PATH_TIERS } from "@/lib/eq/blessings";
import {
  STYLES,
  type BuildArchetype,
  type Style,
  stageById,
} from "@/lib/eq/gear";
import { modelCombat, formatDps, type ModelInput } from "@/lib/eq/model";
import {
  REGIONS,
  REGION_PACKAGES,
  FREE_REGION_IDS,
  ELECTIVE_REGION_IDS,
  MAX_ELECTIVES,
  ITEMS,
  type RegionId,
} from "@/lib/eq/items";
import { PRESETS, type PathPreset } from "@/lib/eq/presets";
import {
  rankPaths,
  rankRegions,
  rankPresets,
  gearFromCustomElectives,
  formatBuildShare,
  CROWN_PATHS,
} from "@/lib/eq/lab";
import {
  SKILLS,
  buildLeagueRoute,
  topMethodMatrix,
  chartAllSkills,
  chartSkill,
  leagueMultForRelicTier,
  type SkillId,
} from "@/lib/eq/xp";
import {
  simulateLeagueRoute,
  INVENTION_UNLOCK,
  ANCIENT_INVENTION_UNLOCK,
  type RegionTag,
} from "@/lib/eq/sim";
import { cn } from "@/lib/utils";
import { SignedIn, SignedOut, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

type Tab = "overview" | "build" | "lab" | "regions" | "items" | "catalog" | "route";

const ARCHETYPES: { id: BuildArchetype; label: string; hint: string }[] = [
  { id: "shield-tank", label: "Shield tank", hint: "75% Aegis" },
  { id: "defender", label: "Defender", hint: "50% Aegis" },
  { id: "power-dps", label: "Power / dual", hint: "25% Aegis" },
];

const TIER_LABELS = ["T1", "T2", "T3", "T5", "T6", "T7"] as const;

function pathClass(path: Path) {
  return path === "Order" ? "path-order" : path === "Balance" ? "path-balance" : "path-chaos";
}

function PathIcon({ path, className }: { path: Path; className?: string }) {
  if (path === "Order") return <Shield className={className} />;
  if (path === "Balance") return <Scale className={className} />;
  return <Flame className={className} />;
}

const DEFAULT = PRESETS[0]!;
const DEFAULT_ELECTIVES: RegionId[] = ["morytania", "asgarnia", "forinthry"];

export function ModelerApp() {
  const [tab, setTab] = useState<Tab>("overview");
  const [picks, setPicks] = useState<Path[]>([...DEFAULT.picks]);
  const [style, setStyle] = useState<Style>("necromancy");
  const [archetype, setArchetype] = useState<BuildArchetype>("shield-tank");
  const [electives, setElectives] = useState<RegionId[]>(DEFAULT_ELECTIVES);
  const [herblore, setHerblore] = useState(110);
  const [targetTiles, setTargetTiles] = useState(1);
  const [multiWeight, setMultiWeight] = useState(0.1);
  const [powerburst, setPowerburst] = useState(true);
  const [activePreset, setActivePreset] = useState(DEFAULT.id);
  const [copied, setCopied] = useState(false);
  const [itemFilter, setItemFilter] = useState<"all" | Style | "shields">("all");
  const { isPending } = useCurrentUserState();

  const stage = stageById("endgame");

  const { snapshot, loadout } = useMemo(
    () => gearFromCustomElectives(electives, style, archetype),
    [electives, style, archetype],
  );

  const input: ModelInput = useMemo(
    () => ({
      picks,
      style,
      stage,
      archetype,
      herbloreLevel: herblore,
      targetTiles,
      multiContentWeight: multiWeight,
      powerburst,
      gear: snapshot,
    }),
    [picks, style, stage, archetype, herblore, targetTiles, multiWeight, powerburst, snapshot],
  );

  const result = useMemo(() => modelCombat(input), [input]);

  const pathRanks = useMemo(
    () =>
      rankPaths({
        style,
        archetype,
        gear: snapshot,
        multi: multiWeight,
        herblore,
      }),
    [style, archetype, snapshot, multiWeight, herblore],
  );

  const regionRanks = useMemo(
    () => rankRegions({ picks, style, archetype, multi: multiWeight }),
    [picks, style, archetype, multiWeight],
  );

  const presetRanks = useMemo(
    () => rankPresets({ style, archetype, gear: snapshot, multi: multiWeight }),
    [style, archetype, snapshot, multiWeight],
  );

  const breakdownData = [
    { key: "Core abilities", v: result.breakdown.coreAbility },
    { key: "Big Boned", v: result.breakdown.bigBonedFlat },
    { key: "Cinders", v: result.breakdown.cindersOnHit },
    { key: "Inferno", v: result.breakdown.inferno },
    { key: "Light of Sara", v: result.breakdown.lightOfSaradomin },
    { key: "Splash Zone", v: result.breakdown.splashBonus },
    { key: "Tearing Grasps", v: result.breakdown.tearingGrasps },
    { key: "Other", v: result.breakdown.other },
  ].filter((d) => d.v > 1);

  const chartPresets = presetRanks.slice(0, 8).map((c) => ({
    full: c.name.replace(/ — .*/, "").slice(0, 18),
    dps: Math.round(c.result.dps),
    path: c.result.god4 ?? "Balance",
  }));

  const applyPreset = useCallback((p: PathPreset) => {
    setPicks([...p.picks]);
    setActivePreset(p.id);
    setArchetype(p.preferredArchetype);
    if (p.preferredStyles[0]) setStyle(p.preferredStyles[0]);
  }, []);

  const applyCrown = useCallback((picksIn: Path[], id: string) => {
    setPicks([...picksIn]);
    setActivePreset(id);
  }, []);

  function setPick(index: number, path: Path) {
    setPicks((prev) => {
      const next = [...prev];
      next[index] = path;
      return next;
    });
    setActivePreset("");
  }

  function toggleElective(id: RegionId) {
    setElectives((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_ELECTIVES) return [...prev.slice(1), id];
      return [...prev, id];
    });
  }

  function applyPackage(pkgId: string) {
    const pkg = REGION_PACKAGES.find((p) => p.id === pkgId);
    if (pkg) setElectives([...pkg.electives]);
  }

  async function copyBuild() {
    const text = formatBuildShare({
      picks,
      style,
      archetype,
      electives,
      dps: result.dps,
      mult: result.vsBaseline,
      armour: result.stats.armour,
      ad: result.stats.effectiveAd,
      pieces: loadout.pieces.map((p) => p.name),
    });
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  const pathCode = picks.map((p) => p[0]).join("");
  const matchingPkg = REGION_PACKAGES.find(
    (p) =>
      p.electives.length === electives.length &&
      p.electives.every((e) => electives.includes(e)),
  );

  const filteredItems = ITEMS.filter((item) => {
    if (itemFilter === "all") return true;
    if (itemFilter === "shields") return item.kind === "shield" || item.kind === "defender";
    return item.style === itemFilter || item.style === "all";
  });

  const tabs: { id: Tab; label: string; icon: typeof FlaskConical }[] = [
    { id: "overview", label: "Overview", icon: Trophy },
    { id: "build", label: "Builder", icon: Layers },
    { id: "lab", label: "Lab", icon: FlaskConical },
    { id: "route", label: "XP Route", icon: Route },
    { id: "regions", label: "Regions", icon: Map },
    { id: "items", label: "Items", icon: Package },
    { id: "catalog", label: "Blessings", icon: BookOpen },
  ];

  return (
    <div className="mx-auto max-w-7xl px-3 pb-20 pt-4 sm:px-5 sm:pt-6">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">
            RS3 Leagues II · Equilibrium
          </p>
          <h1 className="display mt-1 text-3xl font-semibold text-fg sm:text-4xl">
            Combat Modeler
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Full stack: blessing paths, region locks, item loadouts, and relative DPS. Pick 3
            electives, load a crown path, compare.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={copyBuild}
            className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius)] border border-border bg-surface px-3 py-2 text-sm text-muted transition hover:border-border-strong hover:text-fg"
          >
            {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy build"}
          </button>
          {isPending ? (
            <div className="h-8 w-8 animate-pulse rounded-full bg-surface-2" />
          ) : (
            <>
              <SignedOut>
                <a
                  href="/login"
                  className="rounded-[var(--radius)] border border-border px-3 py-2 text-sm text-muted hover:text-fg"
                >
                  Sign in
                </a>
              </SignedOut>
              <SignedIn>
                <UserButton />
              </SignedIn>
            </>
          )}
        </div>
      </header>

      {/* Live summary strip */}
      <div className="mb-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Model DPS"
          value={formatDps(result.dps)}
          sub={`${result.vsBaseline.toFixed(2)}× baseline`}
          accent
        />
        <SummaryCard label="Path" value={pathCode} sub={`${result.god4 ?? "—"} / ${result.god8 ?? "—"} gods`} />
        <SummaryCard
          label="Effective AD"
          value={result.stats.effectiveAd.toLocaleString()}
          sub={`Armour ${result.stats.armour.toLocaleString()}`}
        />
        <SummaryCard
          label="Regions"
          value={`${electives.length}/${MAX_ELECTIVES}`}
          sub={matchingPkg?.name ?? (electives.join(", ") || "Free only")}
        />
      </div>

      <nav className="mb-5 flex gap-1 overflow-x-auto border-b border-border pb-px">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-t-[var(--radius-sm)] px-3 py-2 text-sm font-medium transition",
              tab === id
                ? "border border-b-0 border-border bg-surface text-fg"
                : "text-muted hover:text-fg",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </nav>

      {tab === "overview" && (
        <div className="space-y-4">
          <section className="panel p-4 sm:p-5">
            <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold">
              <Trophy className="h-5 w-5 text-primary" />
              Recommended right now
            </h2>
            <p className="mb-4 text-sm text-muted">
              Under your current regions ({matchingPkg?.name ?? "custom"}) · {style} · {archetype}
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              {pathRanks.slice(0, 4).map((row, i) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => {
                    applyCrown(row.picks, row.id);
                    setTab("build");
                  }}
                  className="panel-inset p-4 text-left transition hover:border-primary/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="mono text-[10px] text-primary">#{i + 1}</span>
                      <h3 className="font-semibold text-fg">{row.name}</h3>
                    </div>
                    <div className="text-right">
                      <div className="mono text-xl font-semibold text-primary">
                        {formatDps(row.result.dps)}
                      </div>
                      <div className="text-[11px] text-muted">
                        {row.result.vsBaseline.toFixed(2)}×
                      </div>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted">{row.note}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {row.picks.map((p, idx) => (
                      <span
                        key={idx}
                        className={cn(
                          "path-chip rounded px-1.5 py-0.5 text-[10px] font-semibold",
                          pathClass(p),
                        )}
                      >
                        {TIER_LABELS[idx]} {p[0]}
                      </span>
                    ))}
                  </div>
                  <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
                    Load in builder <ChevronRight className="h-3 w-3" />
                  </span>
                </button>
              ))}
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="panel p-4">
              <h2 className="mb-3 text-sm font-semibold">Best region packages for this path</h2>
              <ul className="space-y-1.5">
                {regionRanks.slice(0, 5).map((row, i) => (
                  <li key={row.pkg.id}>
                    <button
                      type="button"
                      onClick={() => applyPackage(row.pkg.id)}
                      className="flex w-full items-center justify-between gap-2 rounded-[var(--radius)] border border-border px-3 py-2.5 text-left text-sm hover:border-border-strong"
                    >
                      <span>
                        <span className="mono text-[10px] text-faint">#{i + 1}</span>{" "}
                        {row.pkg.name}
                      </span>
                      <span className="mono text-primary">{formatDps(row.result.dps)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            <section className="panel p-4">
              <h2 className="mb-3 text-sm font-semibold">How to use this</h2>
              <ol className="list-inside list-decimal space-y-2 text-sm text-muted">
                <li>
                  <strong className="text-fg">Regions</strong> — free Misthalin/Havenhythe/Karamja +
                  pick 3 electives (shields matter for Aegis).
                </li>
                <li>
                  <strong className="text-fg">Builder</strong> — load a crown path or hand-pick O/B/C
                  per tier. Gods auto-resolve.
                </li>
                <li>
                  <strong className="text-fg">Lab</strong> — re-rank all crowns under your gear.
                </li>
                <li>
                  <strong className="text-fg">Copy build</strong> — export a text summary.
                </li>
              </ol>
              <div className="mt-4 flex gap-2 rounded-[var(--radius)] border border-border bg-bg-elevated p-3 text-xs text-muted">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                Relative model (not a live ability parse). Good for ranking paths and region
                packages; absolute DPS numbers are synthetic units.
              </div>
            </section>
          </div>

          <section className="panel p-4">
            <h2 className="mb-3 text-sm font-semibold">Your resolved loadout</h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {loadout.pieces.map((p) => (
                <div key={p.id} className="panel-inset px-3 py-2 text-xs">
                  <div className="text-faint">{p.slot}</div>
                  <div className="font-medium text-fg">{p.name}</div>
                  <div className="mono text-faint">
                    T{p.tier}
                    {p.requires.length ? ` · ${p.requires.join("+")}` : " · free"}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {tab === "build" && (
        <div className="grid gap-4 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-5">
            <section className="panel p-4">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Crosshair className="h-4 w-4 text-primary" />
                Style & archetype
              </h2>
              <div className="mb-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {STYLES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStyle(s.id)}
                    className={cn(
                      "min-h-11 rounded-[var(--radius-sm)] border px-2 py-2 text-xs font-medium",
                      style === s.id
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border text-muted hover:text-fg",
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {ARCHETYPES.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setArchetype(a.id)}
                    className={cn(
                      "min-h-11 rounded-[var(--radius-sm)] border px-2 py-2 text-xs",
                      archetype === a.id
                        ? "border-primary bg-primary/15 text-fg"
                        : "border-border text-muted hover:text-fg",
                    )}
                  >
                    <div className="font-medium">{a.label}</div>
                    <div className="text-[10px] text-faint">{a.hint}</div>
                  </button>
                ))}
              </div>
            </section>

            <section className="panel p-4">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Layers className="h-4 w-4 text-primary" />
                Path ({pathCode})
              </h2>
              <div className="mb-3 flex flex-wrap gap-1.5">
                {PRESETS.filter((p) => (p.labRank ?? 99) <= 4).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyPreset(p)}
                    className={cn(
                      "rounded-full border px-2.5 py-1.5 text-xs",
                      activePreset === p.id
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border text-muted hover:text-fg",
                    )}
                  >
                    #{p.labRank} {p.name.replace(/ — .*/, "").replace("Crown ", "")}
                  </button>
                ))}
              </div>
              <div className="space-y-3">
                {PATH_TIERS.map((tier, i) => {
                  const path = picks[i] ?? "Order";
                  const def = blessingAt(tier, path);
                  return (
                    <div key={tier} className="panel-inset p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="mono text-xs text-faint">
                          {TIER_LABELS[i]} · Tier {tier}
                        </span>
                        {def && (
                          <span className={cn("text-xs font-medium", pathClass(path))}>
                            {def.name}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {PATHS.map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setPick(i, p)}
                            className={cn(
                              "path-chip flex min-h-11 items-center justify-center gap-1.5 rounded-[var(--radius-sm)] px-2 py-2 text-xs font-semibold",
                              pathClass(p),
                            )}
                            data-active={path === p}
                          >
                            <PathIcon path={p} className="h-3.5 w-3.5" />
                            {p}
                          </button>
                        ))}
                      </div>
                      {def && <p className="mt-2 text-xs text-muted">{def.short}</p>}
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border border-border px-2 py-1 text-muted">
                  God T4: <strong className="text-fg">{result.god4 ?? "—"}</strong>
                </span>
                <span className="rounded-full border border-border px-2 py-1 text-muted">
                  God T8: <strong className="text-fg">{result.god8 ?? "—"}</strong>
                </span>
              </div>
            </section>

            <section className="panel p-4">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Target className="h-4 w-4 text-primary" />
                Content mix
              </h2>
              <label className="mb-3 block text-xs text-muted">
                Multi / AoE weight
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(multiWeight * 100)}
                  onChange={(e) => setMultiWeight(Number(e.target.value) / 100)}
                  className="mt-1 w-full accent-[var(--color-primary)]"
                />
                <span className="mono text-fg">{Math.round(multiWeight * 100)}%</span>
              </label>
              <label className="mb-3 block text-xs text-muted">
                Target tiles
                <input
                  type="range"
                  min={1}
                  max={25}
                  value={targetTiles}
                  onChange={(e) => setTargetTiles(Number(e.target.value))}
                  className="mt-1 w-full accent-[var(--color-primary)]"
                />
                <span className="mono text-fg">{targetTiles}</span>
              </label>
              <label className="mb-3 block text-xs text-muted">
                Herblore
                <input
                  type="range"
                  min={1}
                  max={120}
                  value={herblore}
                  onChange={(e) => setHerblore(Number(e.target.value))}
                  className="mt-1 w-full accent-[var(--color-primary)]"
                />
                <span className="mono text-fg">{herblore}</span>
              </label>
              <label className="flex items-center gap-2 text-xs text-muted">
                <input
                  type="checkbox"
                  checked={powerburst}
                  onChange={(e) => setPowerburst(e.target.checked)}
                  className="accent-[var(--color-primary)]"
                />
                Powerburst EV (Big Boned)
              </label>
            </section>
          </div>

          <div className="space-y-4 lg:col-span-7">
            <section className="panel p-4 sm:p-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted">Relative DPS</p>
                  <p className="display mono mt-1 text-4xl font-semibold text-primary sm:text-5xl">
                    {formatDps(result.dps)}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    <span className="mono text-success">{result.vsBaseline.toFixed(2)}×</span> vs
                    no-blessing · T{result.gear.weaponTier} weapons
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <Stat label="AD" value={result.stats.effectiveAd.toLocaleString()} />
                  <Stat label="Armour" value={result.stats.armour.toLocaleString()} />
                  <Stat label="Max LP" value={result.stats.maxLp.toLocaleString()} />
                  <Stat label="Flat/hit" value={result.stats.flatPerHit.toLocaleString()} />
                  <Stat label="Hits/s" value={result.stats.hitsPerSecond.toFixed(2)} />
                  <Stat label="CDR" value={result.stats.cdrMultiplier.toFixed(2)} />
                </div>
              </div>
              {result.warnings.length > 0 && (
                <div className="mt-4 space-y-1.5">
                  {result.warnings.map((w) => (
                    <div
                      key={w}
                      className="flex gap-2 rounded-[var(--radius-sm)] border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning"
                    >
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {w}
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-4 flex flex-wrap gap-1.5">
                {result.flags.map((f) => (
                  <span
                    key={f}
                    className="rounded-full border border-border bg-bg-elevated px-2 py-0.5 text-[11px] text-muted"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </section>

            <section className="panel p-4">
              <h2 className="mb-3 text-sm font-semibold">Damage breakdown</h2>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={breakdownData} layout="vertical" margin={{ left: 4, right: 12 }}>
                    <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fill: "var(--color-muted)", fontSize: 11 }} />
                    <YAxis
                      type="category"
                      dataKey="key"
                      width={100}
                      tick={{ fill: "var(--color-muted)", fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--color-surface-2)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      formatter={(v: number) => formatDps(v)}
                    />
                    <Bar dataKey="v" fill="var(--color-primary)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="panel p-4">
              <h2 className="mb-3 text-sm font-semibold">Active blessings</h2>
              <ul className="space-y-2">
                {result.active.map((b) => (
                  <li
                    key={`${b.tier}-${b.id}`}
                    className={cn("panel-inset flex gap-3 p-3", pathClass(b.path))}
                  >
                    <div
                      className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                      style={{
                        background: "color-mix(in oklab, var(--path) 20%, transparent)",
                        color: "var(--path)",
                      }}
                    >
                      <PathIcon path={b.path} className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-fg">{b.name}</span>
                        <span className="mono text-[10px] text-faint">
                          T{b.tier}
                          {b.god ? " God" : ""}
                        </span>
                      </div>
                      <p className="text-xs text-muted">{b.short}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="panel p-4">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Swords className="h-4 w-4 text-primary" />
                Loadout from regions
              </h2>
              <ul className="space-y-1.5 text-xs">
                {loadout.pieces.map((p) => (
                  <li key={p.id} className="panel-inset flex justify-between gap-2 px-2.5 py-2">
                    <span>
                      <span className="text-faint">{p.slot}</span> {p.name}
                    </span>
                    <span className="mono text-faint">T{p.tier}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      )}

      {tab === "lab" && (
        <div className="space-y-4">
          <section className="panel p-4">
            <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold">
              <FlaskConical className="h-4 w-4 text-primary" />
              Path ranking under your gear
            </h2>
            <p className="mb-4 text-xs text-muted">
              {style} · {archetype} · electives [{electives.join(", ") || "none"}] · multi{" "}
              {Math.round(multiWeight * 100)}%
            </p>
            <div className="h-64 w-full sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartPresets} margin={{ bottom: 48, left: 0, right: 8 }}>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="full"
                    interval={0}
                    angle={-28}
                    textAnchor="end"
                    height={60}
                    tick={{ fill: "var(--color-muted)", fontSize: 9 }}
                  />
                  <YAxis tick={{ fill: "var(--color-muted)", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-surface-2)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v: number) => [formatDps(v), "DPS"]}
                  />
                  <Bar dataKey="dps" radius={[4, 4, 0, 0]}>
                    {chartPresets.map((e, i) => (
                      <Cell
                        key={i}
                        fill={
                          e.path === "Order"
                            ? "var(--color-order)"
                            : e.path === "Chaos"
                              ? "var(--color-chaos)"
                              : "var(--color-balance)"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <div className="grid gap-3 md:grid-cols-2">
            {pathRanks.map((row, i) => (
              <button
                key={row.id}
                type="button"
                onClick={() => {
                  applyCrown(row.picks, row.id);
                  setTab("build");
                }}
                className="panel p-4 text-left transition hover:border-border-strong"
              >
                <div className="flex justify-between gap-2">
                  <div>
                    <span className="mono text-xs text-faint">#{i + 1}</span>
                    <h3 className="font-semibold">{row.name}</h3>
                  </div>
                  <div className="text-right">
                    <div className="mono text-lg font-semibold text-primary">
                      {formatDps(row.result.dps)}
                    </div>
                    <div className="text-xs text-muted">{row.result.vsBaseline.toFixed(2)}×</div>
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted">{row.note}</p>
                <div className="mt-2 mono text-[11px] text-faint">
                  AD {row.result.stats.effectiveAd} · arm {row.result.stats.armour}
                </div>
              </button>
            ))}
          </div>

          <section className="panel p-4">
            <h2 className="mb-3 text-sm font-semibold">Crown reference codes</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-faint">
                    <th className="py-2 pr-2">Code</th>
                    <th className="py-2 pr-2">T1–T3</th>
                    <th className="py-2 pr-2">T5–T7</th>
                    <th className="py-2">Role</th>
                  </tr>
                </thead>
                <tbody>
                  {CROWN_PATHS.map((c) => (
                    <tr key={c.id} className="border-b border-border/60">
                      <td className="py-2 pr-2 mono font-medium text-primary">
                        {c.picks.map((p) => p[0]).join("")}
                      </td>
                      <td className="py-2 pr-2 text-muted">
                        {c.picks.slice(0, 3).join(" · ")}
                      </td>
                      <td className="py-2 pr-2 text-muted">
                        {c.picks.slice(3).join(" · ")}
                      </td>
                      <td className="py-2 text-muted">{c.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[11px] text-faint">
              O = Order · B = Balance · C = Chaos · slots are T1 T2 T3 T5 T6 T7
            </p>
          </section>
        </div>
      )}

      {tab === "regions" && (
        <div className="grid gap-4 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-5">
            <section className="panel p-4">
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Map className="h-4 w-4 text-primary" />
                Elective unlocks ({electives.length}/{MAX_ELECTIVES})
              </h2>
              <p className="mb-3 text-xs text-muted">
                Always free: {FREE_REGION_IDS.join(", ")}. Tap electives (max {MAX_ELECTIVES}).
              </p>
              <div className="mb-3 flex flex-wrap gap-1.5">
                {REGION_PACKAGES.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyPackage(p.id)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[11px]",
                      matchingPkg?.id === p.id
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border text-muted hover:text-fg",
                    )}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
              <div className="space-y-1.5">
                {ELECTIVE_REGION_IDS.map((id) => {
                  const r = REGIONS.find((x) => x.id === id)!;
                  const on = electives.includes(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => toggleElective(id)}
                      className={cn(
                        "flex w-full min-h-11 items-start justify-between gap-2 rounded-[var(--radius)] border px-3 py-2.5 text-left text-sm transition",
                        on
                          ? "border-primary bg-primary/10 text-fg"
                          : "border-border text-muted hover:text-fg",
                      )}
                    >
                      <div>
                        <div className="font-medium">{r.name}</div>
                        <div className="text-[11px] text-faint">
                          PvM {r.combatTier} · {r.keyUnlocks.slice(0, 2).join(", ")}
                        </div>
                      </div>
                      <span className="mono text-xs">{on ? "ON" : "off"}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>

          <div className="space-y-4 lg:col-span-7">
            <section className="panel p-4">
              <h2 className="mb-3 text-sm font-semibold">Package ranking for current path</h2>
              <ul className="space-y-1.5">
                {regionRanks.map((row, i) => (
                  <li key={row.pkg.id}>
                    <button
                      type="button"
                      onClick={() => applyPackage(row.pkg.id)}
                      className="flex w-full flex-wrap items-center justify-between gap-2 rounded-[var(--radius)] border border-border px-3 py-2.5 text-left text-sm hover:border-border-strong"
                    >
                      <div>
                        <span className="mono text-[10px] text-faint">#{i + 1}</span>{" "}
                        {row.pkg.name}
                        <div className="text-[11px] text-muted">
                          arm {row.armour} · T{row.weaponTier} ·{" "}
                          {row.pkg.electives.join(", ") || "free only"}
                        </div>
                      </div>
                      <span className="mono font-semibold text-primary">
                        {formatDps(row.result.dps)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            <section className="panel p-4">
              <h2 className="mb-3 text-sm font-semibold">All regions</h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-border text-faint">
                      <th className="py-2 pr-2">Region</th>
                      <th className="py-2 pr-2">Access</th>
                      <th className="py-2 pr-2">PvM</th>
                      <th className="py-2">Key gear</th>
                    </tr>
                  </thead>
                  <tbody>
                    {REGIONS.map((r) => (
                      <tr key={r.id} className="border-b border-border/60">
                        <td className="py-2 pr-2 font-medium text-fg">{r.name}</td>
                        <td className="py-2 pr-2 text-muted">
                          {r.access === "free"
                            ? "Free"
                            : r.access === "milestone"
                              ? "Milestone"
                              : "Elective"}
                        </td>
                        <td className="py-2 pr-2 text-muted">{r.combatTier}</td>
                        <td className="py-2 text-muted">{r.keyUnlocks.join(", ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      )}

      {tab === "items" && (
        <div className="space-y-4">
          <section className="panel p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Package className="h-4 w-4 text-primary" />
                Item catalog ({filteredItems.length})
              </h2>
              <div className="flex flex-wrap gap-1">
                {(
                  [
                    ["all", "All"],
                    ["necromancy", "Necro"],
                    ["melee", "Melee"],
                    ["magic", "Magic"],
                    ["ranged", "Ranged"],
                    ["shields", "Shields"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setItemFilter(id)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs",
                      itemFilter === id
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border text-muted hover:text-fg",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {filteredItems.map((item) => {
                const unlocked = item.requires.every(
                  (r) => FREE_REGION_IDS.includes(r) || electives.includes(r),
                );
                const inLoadout = loadout.pieces.some((p) => p.id === item.id);
                return (
                  <div
                    key={item.id}
                    className={cn(
                      "panel-inset p-3 text-xs",
                      inLoadout && "ring-1 ring-primary/40",
                      !unlocked && "opacity-50",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-medium text-fg">{item.name}</div>
                      <span className="mono text-faint">T{item.tier}</span>
                    </div>
                    <div className="mt-1 text-faint">
                      {item.slot} · {item.style} · {item.kind}
                    </div>
                    <div className="mt-1 text-muted">
                      {item.abilityDamage != null && `AD ${item.abilityDamage} `}
                      {item.armour != null && `Arm ${item.armour} `}
                      {item.lp != null && `LP ${item.lp}`}
                    </div>
                    <div className="mt-1 mono text-[10px] text-faint">
                      {item.requires.length ? item.requires.join(" + ") : "free regions"}
                      {unlocked ? " · accessible" : " · locked"}
                      {inLoadout ? " · equipped" : ""}
                    </div>
                    {item.notes && <p className="mt-1 text-muted">{item.notes}</p>}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {tab === "catalog" && (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((tier) => {
            const tierBlessings = BLESSINGS.filter((b) => b.tier === tier);
            return (
              <section key={tier} className="panel p-4">
                <h2 className="mb-3 text-sm font-semibold">
                  Tier {tier}
                  {tier === 4 || tier === 8 ? " · God (auto from majority)" : ""}
                </h2>
                <div className="grid gap-2 md:grid-cols-3">
                  {tierBlessings.map((b) => (
                    <div key={b.id} className={cn("panel-inset p-3", pathClass(b.path))}>
                      <div className="flex items-center gap-2" style={{ color: "var(--path)" }}>
                        <PathIcon path={b.path} className="h-4 w-4" />
                        <span className="font-medium">{b.path}</span>
                      </div>
                      <h3 className="mt-1 font-semibold text-fg">{b.name}</h3>
                      <p className="mt-1 text-xs text-muted">{b.short}</p>
                      <ul className="mt-2 list-inside list-disc space-y-0.5 text-[11px] text-faint">
                        {b.effects.map((e) => (
                          <li key={e}>{e}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {tab === "route" && <XpRoutePanel electives={electives} />}

      <footer className="mt-10 border-t border-border pt-4 text-center text-[11px] text-faint">
        Fan-made Equilibrium modeler · relative DPS · XP routes are peak-rate estimates · not Jagex
      </footer>
    </div>
  );
}

function fmtXpHr(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}m`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(Math.round(n));
}

function fmtHours(h: number): string {
  if (!Number.isFinite(h)) return "—";
  if (h < 0.05) return "<3m";
  if (h < 1) return `${Math.round(h * 60)}m`;
  return `${h.toFixed(1)}h`;
}

function XpRoutePanel({ electives }: { electives: RegionId[] }) {
  const [relicTier, setRelicTier] = useState(6);
  const [skillFocus, setSkillFocus] = useState<SkillId>("necromancy");
  const [wantAncient, setWantAncient] = useState(false);

  const eList = (
    electives.length
      ? electives
      : wantAncient
        ? (["asgarnia", "kandarin", "forinthry"] as RegionId[])
        : (["asgarnia", "desert", "forinthry"] as RegionId[])
  ) as unknown as RegionTag[];

  const simRoute = useMemo(
    () =>
      simulateLeagueRoute({
        electives: eList,
        wantAncientInvention: wantAncient || eList.includes("kandarin"),
      }),
    // recompute when electives / ancient toggle change
    [electives, wantAncient],
  );

  const route = useMemo(
    () =>
      buildLeagueRoute({
        combatPath: "necro",
        electives: eList as unknown as string[],
      }),
    [electives, wantAncient],
  );

  const matrix = useMemo(() => topMethodMatrix(eList as unknown as string[], relicTier), [electives, wantAncient, relicTier]);

  const hours = useMemo(() => {
    const targets: Partial<Record<SkillId, number>> = {};
    for (const s of SKILLS) {
      if (
        ["necromancy", "invention", "slayer", "herblore", "farming", "archaeology", "dungeoneering"].includes(
          s.id,
        )
      )
        targets[s.id] = Math.min(120, s.maxLevel);
      else if (s.maxLevel >= 110) targets[s.id] = 110;
      else targets[s.id] = 99;
    }
    return chartAllSkills(targets, eList as unknown as string[], relicTier, 1);
  }, [electives, wantAncient, relicTier]);

  const ladder = useMemo(() => {
    const meta = SKILLS.find((s) => s.id === skillFocus)!;
    const to = [
      "necromancy",
      "invention",
      "slayer",
      "herblore",
      "farming",
      "archaeology",
      "dungeoneering",
    ].includes(skillFocus)
      ? Math.min(120, meta.maxLevel)
      : meta.maxLevel >= 110
        ? 110
        : 99;
    return chartSkill(skillFocus, 1, to, eList as unknown as string[], relicTier);
  }, [skillFocus, electives, wantAncient, relicTier]);

  const mult = leagueMultForRelicTier(relicTier);

  return (
    <div className="space-y-4">
      <section className="panel p-4 sm:p-5">
        <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold">
          <Route className="h-5 w-5 text-primary" />
          Full-game XP route (requirement-gated sim)
        </h2>
        <p className="mb-3 text-sm text-muted">
          OOP sim: methods only run when skill / region / quest / flag requirements pass. Invention is not free.
        </p>

        <div className="mb-4 grid gap-2 sm:grid-cols-2">
          <div className="panel-inset p-3 text-sm">
            <div className="text-xs font-semibold uppercase text-faint">Standard Invention</div>
            <p className="mt-1 text-fg">{INVENTION_UNLOCK.describe()}</p>
            <p className="mt-1 text-xs text-muted">
              Guild = Falador / <strong>Asgarnia</strong>. Tutorial auto-completes once 80 Craft/Smith/Div met.
            </p>
          </div>
          <div className="panel-inset p-3 text-sm">
            <div className="text-xs font-semibold uppercase text-faint">Ancient Invention</div>
            <p className="mt-1 text-fg">{ANCIENT_INVENTION_UNLOCK.describe()}</p>
            <p className="mt-1 text-xs text-muted">
              Stormguard = <strong>Kandarin</strong>. Asgarnia+Desert+Wildy never unlocks ancient gizmos.
            </p>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={wantAncient}
              onChange={(e) => setWantAncient(e.target.checked)}
              className="h-4 w-4"
            />
            Prefer Ancient Invention (include Kandarin)
          </label>
          <div className="flex gap-1">
            {[1, 2, 4, 6].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setRelicTier(t)}
                className={cn(
                  "min-h-9 rounded-[var(--radius-sm)] px-3 text-sm font-medium",
                  relicTier === t ? "bg-primary text-primary-fg" : "bg-surface-2 text-muted hover:text-fg",
                )}
              >
                T{t} · {leagueMultForRelicTier(t)}×
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <SummaryCard
            label="Simulated route"
            value={fmtHours(simRoute.totalHours)}
            sub={`Ancient: ${simRoute.finalInvention.ancient ? "YES" : "NO"}`}
            accent
          />
          <SummaryCard
            label="Standard Invention"
            value={simRoute.finalInvention.standard ? "Unlocked" : "Locked"}
            sub={
              simRoute.finalInvention.standard
                ? "Asgarnia + 80s"
                : simRoute.finalInvention.missingStandard.slice(0, 2).join(", ")
            }
          />
          <SummaryCard
            label="Electives in sim"
            value={eList.join(" · ")}
            sub={wantAncient ? "Ancient-priority" : "Regions tab / combat default"}
          />
        </div>
        {!simRoute.finalInvention.ancient && (
          <p className="mt-3 rounded-[var(--radius-sm)] border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
            Ancient Invention blocked: {simRoute.finalInvention.missingAncient.join(" · ")}. Take{" "}
            <strong>Kandarin</strong> instead of Desert if you want ancient gizmos.
          </p>
        )}
      </section>

      <section className="panel p-4 sm:p-5">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
          <Timer className="h-4 w-4 text-primary" />
          Simulated phases (hard gates)
        </h2>
        <div className="space-y-3">
          {simRoute.phases.map((p) => (
            <div key={p.id} className="panel-inset p-3 sm:p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="font-semibold text-fg">{p.title}</h3>
                <span className="mono text-xs text-primary">{fmtHours(p.hours)}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-2 text-[11px]">
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5",
                    p.invention.standard ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300",
                  )}
                >
                  Inv {p.invention.standard ? "ON" : "OFF"}
                </span>
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5",
                    p.invention.ancient ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300",
                  )}
                >
                  Ancient {p.invention.ancient ? "ON" : "OFF"}
                </span>
                <span className="text-faint">
                  necro {p.levels.necromancy} · inv {p.levels.invention} · arch {p.levels.archaeology} · c/s/d{" "}
                  {p.levels.crafting}/{p.levels.smithing}/{p.levels.divination}
                </span>
              </div>
              <ul className="mt-2 max-h-40 space-y-0.5 overflow-y-auto text-xs text-muted">
                {p.actions.slice(0, 18).map((a) => (
                  <li key={a}>· {a}</li>
                ))}
                {p.actions.length > 18 && <li>… +{p.actions.length - 18} more</li>}
              </ul>
            </div>
          ))}
        </div>
        <ul className="mt-3 space-y-1 text-xs text-faint">
          {simRoute.notes.map((n) => (
            <li key={n}>• {n}</li>
          ))}
        </ul>
      </section>

      <section className="panel p-4 sm:p-5">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
          <TrendingUp className="h-4 w-4 text-primary" />
          Hours to cap @ {mult}× (rate matrix)
        </h2>
        <div className="max-h-[28rem] overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-surface text-xs uppercase text-faint">
              <tr>
                <th className="py-1.5 pr-2">Skill</th>
                <th className="py-1.5 pr-2">To</th>
                <th className="py-1.5 pr-2">Hours</th>
                <th className="py-1.5 pr-2">Peak XP/hr</th>
                <th className="py-1.5">Late method</th>
              </tr>
            </thead>
            <tbody>
              {hours.map((s) => (
                <tr
                  key={s.skill}
                  className="cursor-pointer border-t border-border/60 hover:bg-surface-2"
                  onClick={() => setSkillFocus(s.skill)}
                >
                  <td className="py-1.5 pr-2 font-medium">{s.name}</td>
                  <td className="mono py-1.5 pr-2 text-muted">{s.to}</td>
                  <td className="mono py-1.5 pr-2 text-primary">{fmtHours(s.totalHours)}</td>
                  <td className="mono py-1.5 pr-2">{fmtXpHr(s.peakXpHr)}</td>
                  <td className="truncate py-1.5 text-xs text-muted">{s.bestLateMethod}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Skill ladder detail</h2>
          <select
            className="min-h-10 rounded-[var(--radius-sm)] border border-border bg-surface-2 px-2 text-sm"
            value={skillFocus}
            onChange={(e) => setSkillFocus(e.target.value as SkillId)}
          >
            {SKILLS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          {ladder.map((st) => (
            <div
              key={st.method.id + st.levelFrom}
              className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-border px-3 py-2"
            >
              <div>
                <span className="mono text-xs text-faint">
                  {st.levelFrom}→{st.levelTo}
                </span>
                <div className="font-medium text-fg">{st.method.name}</div>
                <div className="text-[11px] text-muted">
                  {st.method.intensity}
                  {st.method.notes ? ` · ${st.method.notes}` : ""}
                </div>
              </div>
              <div className="text-right">
                <div className="mono text-sm text-primary">{fmtXpHr(st.effectiveXpHr)}/hr</div>
                <div className="text-xs text-muted">{fmtHours(st.hours)}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel p-4 sm:p-5">
        <h2 className="mb-3 text-base font-semibold">All skills · top method by band @ {mult}×</h2>
        <div className="space-y-4">
          {matrix.map((row) => (
            <div key={row.skill}>
              <h3 className="mb-1 text-sm font-semibold text-fg">{row.name}</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <tbody>
                    {row.bands.map((b) => (
                      <tr key={b.range + b.method} className="border-t border-border/50">
                        <td className="mono py-1 pr-3 text-faint">{b.range}</td>
                        <td className="mono py-1 pr-3 text-primary">{fmtXpHr(b.xpHr)}</td>
                        <td className="py-1 pr-3 text-muted">{b.intensity}</td>
                        <td className="py-1">{b.method}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <div className="panel px-3 py-3">
      <div className="text-[10px] uppercase tracking-wide text-faint">{label}</div>
      <div className={cn("mono mt-0.5 text-xl font-semibold", accent ? "text-primary" : "text-fg")}>
        {value}
      </div>
      <div className="truncate text-[11px] text-muted">{sub}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-sm)] border border-border bg-bg-elevated px-2.5 py-1.5 text-right">
      <div className="text-[10px] uppercase tracking-wide text-faint">{label}</div>
      <div className="mono text-sm font-medium text-fg">{value}</div>
    </div>
  );
}
