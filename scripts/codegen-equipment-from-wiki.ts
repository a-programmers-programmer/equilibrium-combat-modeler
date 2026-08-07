/**
 * Parse Equilibrium League notable-drops wikitext from RS Wiki dumps
 * and codegen OOP equipment with region/source restrictions.
 *
 * Usage:
 *   npx tsx scripts/codegen-equipment-from-wiki.ts
 *
 * Inputs: scripts/data/Equilibrium_League_Regions_*_Notable_Drops.json
 * Output: src/lib/eq/sim/equipment.generated.ts
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "fs";
import { join } from "path";

const DATA = "scripts/data";
const OUT = "src/lib/eq/sim/equipment.generated.ts";

type RegionId =
  | "misthalin"
  | "havenhythe"
  | "karamja"
  | "forinthry"
  | "asgarnia"
  | "anachronia"
  | "desert"
  | "morytania"
  | "tirannwn"
  | "kandarin"
  | "fremennik";

const FILE_REGION: Record<string, RegionId> = {
  Misthalin: "misthalin",
  Havenhythe: "havenhythe",
  Karamja: "karamja",
  Wilderness: "forinthry",
  Asgarnia: "asgarnia",
  Anachronia: "anachronia",
  Desert: "desert",
  Morytania: "morytania",
  Tirannwn: "tirannwn",
  Kandarin: "kandarin",
  Fremennik: "fremennik",
};

type Slot =
  | "weapon"
  | "offhand"
  | "helmet"
  | "body"
  | "legs"
  | "boots"
  | "gloves"
  | "cape"
  | "amulet"
  | "ring"
  | "aura"
  | "pocket"
  | "material"
  | "codex"
  | "unknown";

type Style = "necromancy" | "melee" | "magic" | "ranged" | "all";

interface RawDrop {
  name: string;
  source: string;
  region: RegionId;
  rarity?: string;
}

interface GearDef {
  id: string;
  name: string;
  slot: Slot;
  style: Style;
  tier: number;
  kind: "tank" | "power" | "hybrid" | "shield" | "defender" | "none";
  regions: RegionId[];
  source: string;
  rarity?: string;
  twoHanded?: boolean;
  skillReqs: { skill: string; level: number }[];
  quests: string[];
  flags: string[];
  abilityDamage?: number;
  armour?: number;
  notes: string;
  wikiGenerated: true;
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

function stripWiki(s: string): string {
  return s
    .replace(/\[\[[^\]|]*\|([^\]]+)\]\]/g, "$1")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/<ref[^>]*>.*?<\/ref>/gis, "")
    .replace(/<ref[^/]*\/>/gi, "")
    .replace(/''+/g, "")
    .trim();
}

function parseTemplateParams(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  // split on | but not inside [[ ]]
  let cur = "";
  let depth = 0;
  const parts: string[] = [];
  for (let i = 0; i < body.length; i++) {
    const c = body[i]!;
    if (c === "[" && body[i + 1] === "[") {
      depth++;
      cur += "[[";
      i++;
      continue;
    }
    if (c === "]" && body[i + 1] === "]") {
      depth = Math.max(0, depth - 1);
      cur += "]]";
      i++;
      continue;
    }
    if (c === "|" && depth === 0) {
      parts.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  if (cur) parts.push(cur);
  for (const p of parts) {
    const eq = p.indexOf("=");
    if (eq < 0) continue;
    const k = p.slice(0, eq).trim();
    const v = p.slice(eq + 1).trim();
    out[k] = v;
  }
  return out;
}

function extractDrops(wikitext: string, region: RegionId): RawDrop[] {
  const drops: RawDrop[] = [];
  const re = /\{\{LeagueBoostedDrop\|([^}]*(?:\{\{[^}]*\}\}[^}]*)*)\}\}/gi;
  // simpler: line-based
  for (const line of wikitext.split("\n")) {
    if (!line.includes("LeagueBoostedDrop")) continue;
    const m = line.match(/\{\{LeagueBoostedDrop\|(.+)\}\}/i);
    if (!m) continue;
    const params = parseTemplateParams(m[1]!);
    const nameRaw =
      params.optname || params.name || params.image || params.Name || "";
    const sourceRaw =
      params.optsource || params.source || params.Source || "unknown";
    const rarity = params.rarity;
    const names = expandNames(nameRaw, params.image);
    for (const name of names) {
      if (!name || name.length < 2) continue;
      drops.push({
        name: stripWiki(name),
        source: stripWiki(sourceRaw),
        region,
        rarity,
      });
    }
  }
  return drops;
}

function expandNames(optname: string, image?: string): string[] {
  const cleaned = stripWiki(optname);
  // split on commas outside of parentheses
  const fromOpt = splitComma(cleaned);
  if (fromOpt.length > 1) return fromOpt.map((s) => s.trim()).filter(Boolean);
  if (image) {
    const imgs = image.split(",").map((s) => s.trim()).filter(Boolean);
    if (imgs.length > 1) return imgs;
  }
  // "Bandos equipment" style — keep as package
  if (cleaned) return [cleaned];
  return image ? [image] : [];
}

function splitComma(s: string): string[] {
  const out: string[] = [];
  let cur = "";
  let depth = 0;
  for (const c of s) {
    if (c === "(") depth++;
    if (c === ")") depth = Math.max(0, depth - 1);
    if (c === "," && depth === 0) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function inferSlot(name: string): Slot {
  const n = name.toLowerCase();
  if (/codex|ability/.test(n)) return "codex";
  if (/signet|scale|energy|scrap|fragment|shard|tip|cap|plume|shaft|focus|projector|handle|base|piece|component|orb of|heart of|seed|totem|core|residue|token/.test(n))
    return "material";
  if (/boots|shoes|treads|greaves$/.test(n) && !/robe bottom|platelegs|plateskirt/.test(n)) return "boots";
  if (/glove|vamb|gaunt|wraps|cuffs|bracelet/.test(n)) return "gloves";
  if (/helm|hood|mask|coif|hat|circlet|faceguard|full helm/.test(n)) return "helmet";
  if (/platelegs|plateskirt|robe bottom|chaps|tassets|legs|bottom/.test(n)) return "legs";
  if (/platebody|robe top|chestplate|hauberk|body|top|cuirass|garb/.test(n)) return "body";
  if (/kiteshield|shield|defender|repriser|ward|book of|orb$|lantern|singularity|focus$/.test(n))
    return "offhand";
  if (/cape|cloak|kal-/.test(n)) return "cape";
  if (/amulet|necklace|pendant/.test(n)) return "amulet";
  if (/ring/.test(n)) return "ring";
  if (/aura/.test(n)) return "aura";
  if (
    /sword|scimitar|rapier|mace|dagger|spear|halberd|maul|battleaxe|warhammer|claw|whip|scythe|khopesh|godsword|longsword|2h|staff|wand|crossbow|bow|blowpipe|chinchompa|guard$|blade|cleaver|flail|hastae|noose|sunspear|bolg|sgb|ezk|fsoa|ascens|blight|drygore|seismic|noxious|chaotic|inquisitor|decimation|annihilation|obliteration|serpentine|crozier|crook|sceptre|rod of|wand of/.test(
      n,
    )
  )
    return "weapon";
  if (/equipment|armour|armor|set/.test(n)) return "body"; // package proxy
  return "unknown";
}

function inferStyle(name: string, source: string): Style {
  const n = (name + " " + source).toLowerCase();
  if (/necro|rasial|death guard|omni|soulbound|deathwarden|deathdealer|hermod|amascut|tumeken|devourer/.test(n))
    return "necromancy";
  if (/bow|crossbow|sirenic|dracolich|ascension|blightbound|royal|ava|range|zaryte|death's swiftness/.test(n))
    return "ranged";
  if (/staff|wand|seismic|tectonic|virtus|subjugation|mystic|magic|sunshine|kerapac|scripture|anima core of seren|cryptbloom|inquisitor/.test(n))
    return "magic";
  if (/bandos|torva|malevolent|drygore|khopesh|rapier|scythe|godsword|melee|graardor|zamorak|armadyl|saradomin|chaotic|masterwork|trimmed|ezk|noxious scythe|vestments of havoc/.test(n))
    return "melee";
  return "all";
}

function inferTier(name: string, slot: Slot): number {
  const n = name.toLowerCase();
  if (/t95|tier 95|omni|soulbound|fsoa|bolg|ezk|cryptbloom|elite tectonic|elite sirenic|trimmed masterwork|devourer|tumeken's light|devourer's guard/.test(n))
    return 95;
  if (/t92|tier 92|elite |khopesh|sgb|zgs|seren godbow|zaros godsword|blightbound/.test(n)) return 92;
  if (/t90|tier 90|drygore|seismic|noxious|malevolent|tectonic|sirenic|ascens|staff of armadyl|chaotic|death guard \(t90\)|deathwarden robe|masterwork|igneous|emberkeen|achto|anima core/.test(n))
    return 90;
  if (/t85|steadfast|ragefire|glaiven|asylum|ring of death/.test(n)) return 85;
  if (/t80|bandos|subjugation|armadyl|virtus|chaotic|royal/.test(n)) return 80;
  if (/dragon |royal|t70|torva|pernix|virtus/.test(n)) return 70;
  if (slot === "material" || slot === "codex") return 0;
  return 75;
}

function inferKind(name: string, slot: Slot): GearDef["kind"] {
  const n = name.toLowerCase();
  if (slot === "offhand") {
    if (/defender|repriser/.test(n)) return "defender";
    if (/shield|kite|ward|spirit shield|lantern|singularity|book/.test(n)) return "shield";
    return "none";
  }
  if (/tank|deathwarden|cryptbloom|achto|malevolent kite/.test(n)) return "tank";
  if (/power|deathdealer|tectonic|sirenic|malevolent|torva|pernix|virtus|elite/.test(n)) return "power";
  return "none";
}

function is2h(name: string): boolean {
  return /2h|godsword|godbow|staff of|ek-zekkil|longbow|bow of|noxious staff|noxious longbow|scythe|spear|halberd|maul|ezk|fsoa|bolg|sgb|zgs|sunspear|inquisitor staff/.test(
    name.toLowerCase(),
  );
}

function skillReqsFor(name: string, style: Style, tier: number, slot: Slot): { skill: string; level: number }[] {
  if (slot === "material" || slot === "codex" || tier <= 0) return [];
  const lvl = Math.min(tier, 99);
  const out: { skill: string; level: number }[] = [];
  if (slot === "weapon" || slot === "offhand") {
    if (style === "melee") {
      out.push({ skill: "attack", level: Math.min(lvl, 90) });
      if (/2h|maul|godsword|scythe|halberd/.test(name.toLowerCase()))
        out.push({ skill: "strength", level: Math.min(lvl, 90) });
    } else if (style === "magic") out.push({ skill: "magic", level: Math.min(lvl, 95) });
    else if (style === "ranged") out.push({ skill: "ranged", level: Math.min(lvl, 95) });
    else if (style === "necromancy") out.push({ skill: "necromancy", level: Math.min(lvl, 95) });
  } else if (["helmet", "body", "legs", "boots", "gloves"].includes(slot)) {
    out.push({ skill: "defence", level: Math.min(Math.max(lvl - 10, 1), 90) });
    if (style === "magic") out.push({ skill: "magic", level: Math.min(lvl, 90) });
    if (style === "ranged") out.push({ skill: "ranged", level: Math.min(lvl, 90) });
    if (style === "necromancy") out.push({ skill: "necromancy", level: Math.min(lvl, 90) });
  }
  // Crafted high-end
  if (/masterwork|trimmed masterwork/.test(name.toLowerCase())) {
    out.push({ skill: "smithing", level: 99 });
  }
  if (/elite tectonic|elite sirenic/.test(name.toLowerCase())) {
    out.push({ skill: "crafting", level: 93 });
  }
  return out;
}

function flagsFor(name: string, source: string): string[] {
  const flags: string[] = [];
  const s = source.toLowerCase();
  const n = name.toLowerCase();
  if (/rasial/.test(s) || /omni guard|soulbound lantern/.test(n)) flags.push("killed:rasial");
  if (/vorago/.test(s)) flags.push("killed:vorago");
  if (/kerapac/.test(s) || /fsoa|fractured staff/.test(n)) flags.push("killed:kerapac");
  if (/amascut|devourer/.test(s)) flags.push("killed:amascut");
  if (/zuk|fight kiln|igneous/.test(s + n)) flags.push("killed:zuk");
  if (/arch-glacor|glacor/.test(s)) flags.push("killed:arch-glacor");
  if (/solak/.test(s)) flags.push("killed:solak");
  if (/nex/.test(s)) flags.push("killed:nex");
  if (/rods of anantry|rise of the six|barrows: rise/.test(s)) flags.push("killed:rots");
  if (/legiones|ascension/.test(s + n)) flags.push("killed:legiones");
  if (/rex matriarch/.test(s)) flags.push("killed:rex-matriarchs");
  if (/araxxi|araxxor/.test(s)) flags.push("killed:araxxi");
  if (/telos/.test(s)) flags.push("killed:telos");
  if (/zamora.?k|k'?ril/.test(s)) flags.push("killed:kril");
  if (/graardor/.test(s)) flags.push("killed:graardor");
  if (/zilyana/.test(s)) flags.push("killed:zilyana");
  if (/kree/.test(s)) flags.push("killed:kree");
  return [...new Set(flags)];
}

function questsFor(name: string, source: string, region: RegionId): string[] {
  const q: string[] = [];
  const n = (name + source).toLowerCase();
  if (/rasial|omni|soulbound|deathwarden|deathdealer/.test(n)) q.push("necromancy-questline");
  if (/plague's end|crystal|blightbound|prif/.test(n) || region === "tirannwn") {
    // region unlock auto-completes many quests in league
  }
  if (/while guthix sleeps|torva|virtus|pernix/.test(n)) q.push("while-guthix-sleeps");
  if (/ritual of the mahjarrat|koh|zgs/.test(n)) q.push("ritual-of-the-mahjarrat");
  return q;
}

function modelStats(slot: Slot, style: Style, tier: number, kind: GearDef["kind"], twoHanded?: boolean) {
  if (slot === "material" || slot === "codex" || slot === "unknown") return {};
  if (slot === "weapon") {
    const base = tier >= 95 ? 2450 : tier >= 92 ? 2250 : tier >= 90 ? 2050 : tier >= 80 ? 1400 : 900;
    return { abilityDamage: twoHanded ? Math.round(base * 1.1) : base };
  }
  if (slot === "offhand") {
    if (kind === "shield") return { armour: tier >= 90 ? 400 : tier >= 75 ? 300 : 150, abilityDamage: 0 };
    if (kind === "defender") return { armour: 200, abilityDamage: Math.round(tier * 8) };
    return { abilityDamage: tier >= 95 ? 1225 : tier >= 90 ? 1026 : 600 };
  }
  if (slot === "body") {
    return {
      armour: kind === "tank" ? tier * 12 : tier * 8,
      lp: kind === "tank" ? tier * 40 : tier * 20,
    };
  }
  if (["helmet", "legs", "boots", "gloves"].includes(slot)) {
    return { armour: Math.round(tier * 2.5), lp: tier * 5 };
  }
  if (slot === "cape") return { armour: 40, prayer: 2 };
  if (slot === "ring" || slot === "amulet") return { prayer: 3 };
  return {};
}

// ── Parse all dumps ──
const drops: RawDrop[] = [];
for (const file of readdirSync(DATA)) {
  if (!file.includes("Notable_Drops") || !file.endsWith(".json")) continue;
  const regionKey = Object.keys(FILE_REGION).find((k) => file.includes(k));
  if (!regionKey) {
    console.warn("skip region map", file);
    continue;
  }
  const region = FILE_REGION[regionKey]!;
  const raw = JSON.parse(readFileSync(join(DATA, file), "utf8"));
  const wt = raw?.parse?.wikitext?.["*"] ?? "";
  const d = extractDrops(wt, region);
  console.log(region, "drops lines →", d.length, "from", file);
  drops.push(...d);
}

// Also seed critical free-path gear not always on drop tables
const SEED: RawDrop[] = [
  { name: "Omni guard", source: "Rasial, the First Necromancer", region: "misthalin" },
  { name: "Soulbound lantern", source: "Rasial, the First Necromancer", region: "misthalin" },
  { name: "Death Guard (T90)", source: "Necromancy talent / Kili", region: "misthalin" },
  { name: "Deathwarden robe set", source: "Necromancy talent / Kili", region: "misthalin" },
  { name: "Deathdealer robe set", source: "Necromancy talent / Kili", region: "misthalin" },
  { name: "Fractured Staff of Armadyl", source: "Kerapac", region: "misthalin" },
  { name: "Bow of the Last Guardian", source: "Zemouregal & Vorkath path", region: "misthalin" },
  { name: "Ek-ZekKil", source: "Zamorak, Lord of Chaos", region: "misthalin" },
  { name: "Cryptbloom armour set", source: "Croesus", region: "misthalin" },
  { name: "Khopesh of Elidinis", source: "Gate of Elidinis", region: "misthalin" },
  { name: "Khopesh of Tumeken", source: "Gate of Elidinis", region: "misthalin" },
  { name: "Igneous Kal-Zuk", source: "TzKal-Zuk", region: "karamja" },
  { name: "Fire cape", source: "TzHaar Fight Cave", region: "karamja" },
  { name: "Essence of Finality amulet", source: "Vorago", region: "asgarnia" },
  { name: "Amulet of souls", source: "GWD2 / Soul Reaver", region: "asgarnia" },
  { name: "Ring of death", source: "GWD2", region: "asgarnia" },
  { name: "Malevolent kiteshield", source: "Barrows: Rise of the Six", region: "morytania" },
  { name: "Trimmed masterwork melee set", source: "Smithing + Malevolent", region: "morytania" },
  { name: "Emberkeen boots", source: "Arch-Glacor", region: "forinthry" },
  { name: "Chaotic rapier", source: "Dungeoneering reward shop", region: "forinthry" },
  { name: "Stormguard / Ancient Invention access", source: "Stormguard Citadel Dig Site", region: "kandarin" },
];
drops.push(...SEED);

// Dedupe by name+region, merge sources
const map = new Map<string, GearDef>();
for (const d of drops) {
  const slot = inferSlot(d.name);
  // skip pure junk materials optionally — keep them as material with restrictions
  const style = inferStyle(d.name, d.source);
  const tier = inferTier(d.name, slot);
  const kind = inferKind(d.name, slot);
  const twoHanded = slot === "weapon" && is2h(d.name);
  const idBase = slug(d.name);
  const id = idBase || slug(d.source + "-" + d.region);
  const key = id;
  const stats = modelStats(slot, style, tier, kind, twoHanded);
  const existing = map.get(key);
  if (existing) {
    if (!existing.regions.includes(d.region)) existing.regions.push(d.region);
    if (d.source && !existing.source.includes(d.source)) {
      existing.source += ` | ${d.source}`;
    }
    for (const f of flagsFor(d.name, d.source)) {
      if (!existing.flags.includes(f)) existing.flags.push(f);
    }
    continue;
  }
  map.set(key, {
    id,
    name: d.name,
    slot,
    style,
    tier,
    kind,
    regions: [d.region],
    source: d.source,
    rarity: d.rarity,
    twoHanded: twoHanded || undefined,
    skillReqs: skillReqsFor(d.name, style, tier, slot),
    quests: questsFor(d.name, d.source, d.region),
    flags: flagsFor(d.name, d.source),
    abilityDamage: (stats as { abilityDamage?: number }).abilityDamage,
    armour: (stats as { armour?: number }).armour,
    notes: `Wiki source: ${d.source} @ ${d.region}${d.rarity ? ` (${d.rarity})` : ""}`,
    wikiGenerated: true,
  });
}

const items = [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
console.log("Unique gear defs:", items.length);
console.log(
  "By slot:",
  items.reduce(
    (acc, i) => {
      acc[i.slot] = (acc[i.slot] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  ),
);

// Codegen TypeScript
const lines: string[] = [];
lines.push(`/**`);
lines.push(` * AUTO-GENERATED by scripts/codegen-equipment-from-wiki.ts`);
lines.push(` * Source: RS Wiki Equilibrium League region notable drops`);
lines.push(` * Generated: ${new Date().toISOString()}`);
lines.push(` * DO NOT EDIT BY HAND — re-run codegen.`);
lines.push(` */`);
lines.push(``);
lines.push(`export type GenRegionId =`);
lines.push(`  | "misthalin" | "havenhythe" | "karamja" | "forinthry" | "asgarnia"`);
lines.push(`  | "anachronia" | "desert" | "morytania" | "tirannwn" | "kandarin" | "fremennik";`);
lines.push(``);
lines.push(`export type GenSlot = "weapon" | "offhand" | "helmet" | "body" | "legs" | "boots" | "gloves" | "cape" | "amulet" | "ring" | "aura" | "pocket" | "material" | "codex" | "unknown";`);
lines.push(`export type GenStyle = "necromancy" | "melee" | "magic" | "ranged" | "all";`);
lines.push(``);
lines.push(`export interface GeneratedGearDef {`);
lines.push(`  id: string;`);
lines.push(`  name: string;`);
lines.push(`  slot: GenSlot;`);
lines.push(`  style: GenStyle;`);
lines.push(`  tier: number;`);
lines.push(`  kind: "tank" | "power" | "hybrid" | "shield" | "defender" | "none";`);
lines.push(`  regions: GenRegionId[];`);
lines.push(`  source: string;`);
lines.push(`  rarity?: string;`);
lines.push(`  twoHanded?: boolean;`);
lines.push(`  skillReqs: { skill: string; level: number }[];`);
lines.push(`  quests: string[];`);
lines.push(`  flags: string[];`);
lines.push(`  abilityDamage?: number;`);
lines.push(`  armour?: number;`);
lines.push(`  notes: string;`);
lines.push(`  wikiGenerated: true;`);
lines.push(`}`);
lines.push(``);
lines.push(`export const GENERATED_GEAR: readonly GeneratedGearDef[] = ${JSON.stringify(items, null, 2)} as const;`);
lines.push(``);
lines.push(`export const GENERATED_GEAR_BY_ID: Readonly<Record<string, GeneratedGearDef>> = Object.fromEntries(`);
lines.push(`  GENERATED_GEAR.map((g) => [g.id, g]),`);
lines.push(`);`);
lines.push(``);

mkdirSync("src/lib/eq/sim", { recursive: true });
writeFileSync(OUT, lines.join("\n"));
console.log("Wrote", OUT, "bytes", lines.join("\n").length);

// Also write JSON artifact
mkdirSync("artifacts", { recursive: true });
writeFileSync(
  "artifacts/wiki-gear-catalog.json",
  JSON.stringify(
    {
      generated: new Date().toISOString(),
      count: items.length,
      byRegion: items.reduce(
        (a, i) => {
          for (const r of i.regions) a[r] = (a[r] ?? 0) + 1;
          return a;
        },
        {} as Record<string, number>,
      ),
      bySlot: items.reduce(
        (a, i) => {
          a[i.slot] = (a[i.slot] ?? 0) + 1;
          return a;
        },
        {} as Record<string, number>,
      ),
      items,
    },
    null,
    2,
  ),
);
console.log("Wrote artifacts/wiki-gear-catalog.json");
