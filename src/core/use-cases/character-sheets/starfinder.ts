import { z } from 'zod';

/**
 * Starfinder 1e derived values for rolls made outside the site (Discord bot).
 *
 * Mirrors the front-end `src/utils/starfinder-calc.ts` (abilityMod, calcStarfinder,
 * skillBreakdown) and the skill list of `StarfinderSheetForm.tsx`: change both together.
 * One difference on purpose: a value a roll depends on (ability score, BAB, save base) must be
 * on the sheet. Instead of assuming 10/0 like the form does for empty inputs, the roll fails
 * and says which field to fill. Optional bonuses (ranks, misc) left empty are simply no bonus.
 */

export const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
export type Ability = (typeof ABILITIES)[number];

export const SF_SKILLS: { key: string; label: string; ability: Ability; trainedOnly?: boolean }[] =
  [
    { key: 'acrobatics', label: 'Acrobatics', ability: 'dex' },
    { key: 'athletics', label: 'Athletics', ability: 'str' },
    { key: 'bluff', label: 'Bluff', ability: 'cha' },
    { key: 'computers', label: 'Computers', ability: 'int', trainedOnly: true },
    { key: 'culture', label: 'Culture', ability: 'int', trainedOnly: true },
    { key: 'diplomacy', label: 'Diplomacy', ability: 'cha' },
    { key: 'disguise', label: 'Disguise', ability: 'cha' },
    { key: 'engineering', label: 'Engineering', ability: 'int', trainedOnly: true },
    { key: 'intimidate', label: 'Intimidate', ability: 'cha' },
    { key: 'life_science', label: 'Life Science', ability: 'int', trainedOnly: true },
    { key: 'medicine', label: 'Medicine', ability: 'int', trainedOnly: true },
    { key: 'mysticism', label: 'Mysticism', ability: 'wis', trainedOnly: true },
    { key: 'perception', label: 'Perception', ability: 'wis' },
    { key: 'physical_science', label: 'Physical Science', ability: 'int', trainedOnly: true },
    { key: 'piloting', label: 'Piloting', ability: 'dex' },
    { key: 'profession1', label: 'Profession (1)', ability: 'cha' },
    { key: 'profession2', label: 'Profession (2)', ability: 'cha' },
    { key: 'sense_motive', label: 'Sense Motive', ability: 'wis' },
    { key: 'sleight_of_hand', label: 'Sleight of Hand', ability: 'dex', trainedOnly: true },
    { key: 'stealth', label: 'Stealth', ability: 'dex' },
    { key: 'survival', label: 'Survival', ability: 'wis' },
  ];

export const SAVES = {
  fort: { label: 'Fortitude', base: 'fortBase', misc: 'fortMisc', ability: 'con' },
  ref: { label: 'Reflex', base: 'refBase', misc: 'refMisc', ability: 'dex' },
  will: { label: 'Will', base: 'willBase', misc: 'willMisc', ability: 'wis' },
} as const;
export type SaveKey = keyof typeof SAVES;

const num = z.number().finite().optional();
const skillSchema = z.object({
  ability: z.enum(ABILITIES).optional(),
  ranks: num,
  classBonus: z.boolean().optional(),
  miscMod: num,
});
const weaponSchema = z.object({
  name: z.string().optional(),
  attackBonus: z.string().optional(),
  damage: z.string().optional(),
  critical: z.string().nullish(),
  range: z.string().optional(),
  type: z.string().optional(),
});

/** The fields rolls use; anything else on the sheet is ignored. */
export const starfinderSheetSchema = z.object({
  classLevel: z.string().optional(),
  race: z.string().optional(),
  theme: z.string().optional(),
  str: num,
  dex: num,
  con: num,
  int: num,
  wis: num,
  cha: num,
  initiativeMisc: num,
  staminaTotal: num,
  staminaCurrent: num,
  hpTotal: num,
  hpCurrent: num,
  resolveTotal: num,
  resolveCurrent: num,
  armorBonus: num,
  armorKacBonus: num,
  armorMaxDex: num,
  armorMiscMod: num,
  fortBase: num,
  fortMisc: num,
  refBase: num,
  refMisc: num,
  willBase: num,
  willMisc: num,
  bab: num,
  meleeMisc: num,
  rangedMisc: num,
  thrownMisc: num,
  skills: z.record(z.string(), skillSchema).optional(),
  weapons: z.array(weaponSchema).optional(),
  credits: num,
  xpEarned: num,
  xpNextLevel: num,
});
export type StarfinderSheet = z.infer<typeof starfinderSheetSchema>;

/** A roll needs data the sheet does not have (or has in a form we cannot read). */
export class SheetDataError extends Error {
  readonly statusCode = 422;
}

export const abilityMod = (score: number) => Math.floor((score - 10) / 2);

const LABEL: Record<Ability, string> = {
  str: 'STR',
  dex: 'DEX',
  con: 'CON',
  int: 'INT',
  wis: 'WIS',
  cha: 'CHA',
};

export function parseStarfinderSheet(data: unknown): StarfinderSheet {
  const raw = typeof data === 'string' ? (JSON.parse(data) as unknown) : data;
  const parsed = starfinderSheetSchema.safeParse(raw);
  if (!parsed.success)
    throw new SheetDataError(
      `The sheet has unreadable fields: ${parsed.error.issues[0]?.path.join('.')}`,
    );
  return parsed.data;
}

/** Ability modifier of a score the roll requires. */
export function requiredMod(sheet: StarfinderSheet, ability: Ability): number {
  const score = sheet[ability];
  if (score === undefined) throw new SheetDataError(`The sheet has no ${LABEL[ability]} score.`);
  return abilityMod(score);
}

/** A bonus that the roll requires the sheet to state (BAB, save base). */
function requiredValue(
  sheet: StarfinderSheet,
  field: keyof StarfinderSheet,
  label: string,
): number {
  const value = sheet[field];
  if (typeof value !== 'number') throw new SheetDataError(`The sheet has no ${label}.`);
  return value;
}

export interface Bonus {
  label: string;
  total: number;
  /** How the total was reached, e.g. "1 rank + 3 class + 2 DEX". */
  parts: string;
}

const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
const describe = (parts: [string, number][]) =>
  parts
    .filter(([, v], i) => v !== 0 || i === 0)
    .map(([k, v]) => `${signed(v)} ${k}`)
    .join(' ');

/** Skill bonus (site rule: +3 class bonus only with at least 1 rank; Profession may change ability). */
export function skillBonus(sheet: StarfinderSheet, key: string): Bonus {
  const def = SF_SKILLS.find((s) => s.key === key);
  if (!def) throw new SheetDataError(`Unknown skill: ${key}`);
  const skill = sheet.skills?.[key];
  const ranks = skill?.ranks ?? 0;
  if (def.trainedOnly && ranks < 1)
    throw new SheetDataError(`${def.label} is trained-only and the sheet has no ranks in it.`);
  const ability = skill?.ability ?? def.ability;
  const classBonus = skill?.classBonus && ranks > 0 ? 3 : 0;
  const misc = skill?.miscMod ?? 0;
  const mod = requiredMod(sheet, ability);
  return {
    label: def.label,
    total: ranks + classBonus + mod + misc,
    parts: describe([
      [LABEL[ability], mod],
      ['ranks', ranks],
      ['class', classBonus],
      ['misc', misc],
    ]),
  };
}

export function saveBonus(sheet: StarfinderSheet, key: SaveKey): Bonus {
  const def = SAVES[key];
  const base = requiredValue(sheet, def.base, `${def.label} base save`);
  const mod = requiredMod(sheet, def.ability);
  const misc = sheet[def.misc] ?? 0;
  return {
    label: def.label,
    total: base + mod + misc,
    parts: describe([
      ['base', base],
      [LABEL[def.ability], mod],
      ['misc', misc],
    ]),
  };
}

export function initiativeBonus(sheet: StarfinderSheet): Bonus {
  const mod = requiredMod(sheet, 'dex');
  const misc = sheet.initiativeMisc ?? 0;
  return {
    label: 'Initiative',
    total: mod + misc,
    parts: describe([
      ['DEX', mod],
      ['misc', misc],
    ]),
  };
}

/** EAC/KAC exactly as the site computes them (max DEX from armor caps the DEX bonus). */
export function armorClass(sheet: StarfinderSheet) {
  const dex = requiredMod(sheet, 'dex');
  const effectiveDex = sheet.armorMaxDex !== undefined ? Math.min(dex, sheet.armorMaxDex) : dex;
  const misc = sheet.armorMiscMod ?? 0;
  return {
    eac: 10 + (sheet.armorBonus ?? 0) + effectiveDex + misc,
    kac: 10 + (sheet.armorKacBonus ?? 0) + effectiveDex + misc,
  };
}

export interface WeaponRoll {
  name: string;
  attack: number;
  /** Dice expression for the roller (`1d4+1`), or null when the sheet lists no damage. */
  damage: string | null;
  damageType: string | null;
  critical: string | null;
}

const DAMAGE = /^(\d+d\d+(?:\s*[+-]\s*\d+)?)\s*([A-Za-z][A-Za-z &/,]*)?$/;

/**
 * A weapon as the sheet states it. The attack bonus is the sheet's own total (Hephaistos
 * export), so it is used as written; it must be a whole number.
 */
export function weaponRoll(sheet: StarfinderSheet, name: string): WeaponRoll {
  const weapon = sheet.weapons?.find((w) => w.name === name);
  if (!weapon) throw new SheetDataError(`The sheet has no weapon called ${name}.`);
  const bonus = weapon.attackBonus?.replace(/\s+/g, '');
  if (!bonus || !/^[+-]?\d+$/.test(bonus))
    throw new SheetDataError(
      `${name}: the attack bonus "${weapon.attackBonus ?? ''}" is not a number.`,
    );
  const damageText = weapon.damage?.replace(/\s+/g, ' ').trim() ?? '';
  let damage: string | null = null;
  let damageType: string | null = null;
  if (damageText && damageText !== '-') {
    const m = DAMAGE.exec(damageText);
    if (!m) throw new SheetDataError(`${name}: cannot read the damage "${damageText}".`);
    damage = m[1].replace(/\s+/g, '');
    damageType = m[2]?.trim() || null;
  }
  return {
    name,
    attack: Number(bonus),
    damage,
    damageType,
    critical: weapon.critical?.trim() || null,
  };
}
