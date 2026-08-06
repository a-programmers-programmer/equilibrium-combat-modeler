# Equilibrium Combat Modeler

RS3 **Leagues II: Equilibrium** combat planner — blessing paths, region locks, item loadouts, and relative DPS ranking.

## Features

- **Blessing path builder** (Order / Balance / Chaos) with auto God T4/T8 majority
- **Region-locked gear** — free Misthalin + Havenhythe + Karamja, pick 3 electives
- **Item catalog** with region requirements and auto BiS loadout resolution
- **DPS lab** — rank crown paths and region packages under the same model
- **Copy build** export

## Stack

TanStack Start · React 19 · Vite · Tailwind v4 · Recharts

## Dev

```bash
npm install
npm run dev    # 0.0.0.0:8080
npm run typecheck
npm run build
```

## Sims

```bash
npx tsx scripts/run-sims.ts
```

## Attribution

Combat blessing formulas and pathing rules are aligned with the community planner
[sonnaya2/Equilibrium](https://github.com/sonnaya2/Equilibrium). This repo is a
standalone modeler app (not a drop-in fork of that Next.js codebase). A fork of
the upstream planner also lives at
[a-programmers-programmer/Equilibrium](https://github.com/a-programmers-programmer/Equilibrium).

Not affiliated with Jagex.
