import { z } from 'zod';

import { itemDamage, itemType } from './classify.js';

export const ITEM_ORIGINS = ['starfinder', 'algol', 'homebrew'] as const;
export const ITEM_REGIONS = ['motavia', 'dezolis', 'kolian'] as const;
/**
 * How an item can be obtained in AW 2284 (canon v1.0 channels):
 * free = everyday trade, order = commission/specialist, spot = occasional used/grey-market offer,
 * institutional = universities/labs only, relic = possible Era das Maravilhas find, none = not available.
 */
export const ITEM_ACCESS = ['free', 'order', 'spot', 'institutional', 'relic', 'none'] as const;
export const ITEM_VISIBILITY = ['public', 'gm'] as const;
/** proposal = not homologated · approved = homologated by the GM · published = in the player catalogue. */
export const ITEM_STATUS = ['proposal', 'approved', 'published'] as const;
/** Loot sites of the loot generator. */
export const LOOT_SITES = ['seed', 'orbital', 'cave', 'cellar'] as const;

export type ItemAccess = (typeof ITEM_ACCESS)[number];

export interface Item {
  id: number;
  code: string;
  name: string;
  localName: string | null;
  origin: (typeof ITEM_ORIGINS)[number];
  kind: string;
  group: string | null;
  category: string | null;
  level: number;
  damage: string | null;
  unit: string | null;
  region: (typeof ITEM_REGIONS)[number];
  description: string | null;
  rules: string | null;
  sourceUrl: string | null;
  localPrice: number | null;
  availabilityNote: string | null;
  // GM only
  refPrice: number | null;
  access: ItemAccess;
  channel: string | null;
  tags: string[];
  shops: string[];
  loot: string[];
  policies: string | null;
  flags: string | null;
  gmNotes: string | null;
  audit: Record<string, string> | null;
  visibility: (typeof ITEM_VISIBILITY)[number];
  status: (typeof ITEM_STATUS)[number];
  createdAt: Date | null;
  updatedAt: Date | null;
}

export type ItemInput = Omit<Item, 'id' | 'createdAt' | 'updatedAt'>;

export interface ItemRepository {
  list(opts: { playerView: boolean }): Promise<Item[]>;
  get(id: number): Promise<Item | null>;
  create(input: ItemInput): Promise<Item>;
  update(id: number, data: Partial<ItemInput>): Promise<Item | null>;
  delete(id: number): Promise<boolean>;
  /** Insert or update by code, in one transaction. Returns counts. */
  upsertMany(rows: ItemInput[]): Promise<{ created: number; updated: number }>;
}

export class ItemNotFoundError extends Error {
  readonly statusCode = 404;
  constructor() {
    super('Item not found');
  }
}

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => v || null);
const list = z.array(z.string().trim().min(1).max(40)).max(40).default([]);

export const itemInput = z.object({
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(200),
  localName: text(200),
  origin: z.enum(ITEM_ORIGINS).default('homebrew'),
  kind: z.string().trim().min(1).max(40),
  group: text(60),
  category: text(60),
  level: z.number().int().min(0).max(30).default(0),
  damage: text(60),
  unit: text(60),
  region: z.enum(ITEM_REGIONS).default('motavia'),
  description: text(4000),
  rules: text(4000),
  sourceUrl: text(500),
  localPrice: z
    .number()
    .int()
    .min(0)
    .max(10_000_000)
    .nullish()
    .transform((v) => v ?? null),
  availabilityNote: text(300),
  refPrice: z
    .number()
    .int()
    .min(0)
    .max(10_000_000)
    .nullish()
    .transform((v) => v ?? null),
  access: z.enum(ITEM_ACCESS).default('none'),
  channel: text(300),
  tags: list,
  shops: list,
  loot: z.array(z.enum(LOOT_SITES)).max(LOOT_SITES.length).default([]),
  policies: text(300),
  flags: text(500),
  gmNotes: text(8000),
  audit: z
    .record(z.string(), z.string().max(8000))
    .nullish()
    .transform((v) => v ?? null),
  visibility: z.enum(ITEM_VISIBILITY).default('gm'),
  status: z.enum(ITEM_STATUS).default('proposal'),
});
export const itemPatch = itemInput.partial();
export const importInput = z.object({ items: z.array(itemInput).min(1).max(200) });

/** What players can learn about an item: never access, reference price, audit or GM notes. */
export function toPlayerItem(i: Item) {
  return {
    id: i.id,
    code: i.code,
    name: i.localName ?? i.name,
    originalName: i.localName ? i.name : null,
    origin: i.origin,
    kind: i.kind,
    type: itemType(i),
    damageType: itemDamage(i),
    group: i.group,
    category: i.category,
    level: i.level,
    damage: i.damage,
    unit: i.unit,
    region: i.region,
    description: i.description,
    rules: i.rules,
    sourceUrl: i.sourceUrl,
    localPrice: i.localPrice,
    availability: PLAYER_AVAILABILITY[i.access] ?? null,
    availabilityNote: i.availabilityNote,
  };
}
export type PlayerItem = ReturnType<typeof toPlayerItem>;

const PLAYER_AVAILABILITY: Partial<Record<ItemAccess, string>> = {
  free: 'Common trade',
  order: 'Made to order',
  spot: 'Occasional offer',
};

/** GM list without the heavy audit blob (open one item to read it). */
/** Kind → type and weapon damage family, for the catalogue filters. */
const classified = <T extends Item | Omit<Item, 'audit'>>(i: T) => ({
  ...i,
  type: itemType(i),
  damageType: itemDamage(i),
});

const summary = (item: Item) => {
  const rest: Partial<Item> = { ...item };
  delete rest.audit;
  return classified(rest as Omit<Item, 'audit'>);
};

export class ListItems {
  constructor(private repo: ItemRepository) {}
  async execute(gm: boolean) {
    const rows = await this.repo.list({ playerView: !gm });
    return gm ? rows.map(summary) : rows.map(toPlayerItem);
  }
}

export class GetItem {
  constructor(private repo: ItemRepository) {}
  async execute(id: number, gm: boolean) {
    const item = await this.repo.get(id);
    if (!item || (!gm && (item.visibility !== 'public' || item.status !== 'published')))
      throw new ItemNotFoundError();
    return gm ? classified(item) : toPlayerItem(item);
  }
}

export class ItemCodeTakenError extends Error {
  readonly statusCode = 409;
  constructor(code: string) {
    super(`Item code ${code} already exists`);
  }
}

const isUnique = (e: unknown) => e instanceof Error && /UNIQUE/.test(e.message);

export class CreateItem {
  constructor(private repo: ItemRepository) {}
  async execute(input: unknown) {
    const data = itemInput.parse(input) as ItemInput;
    try {
      return await this.repo.create(data);
    } catch (e) {
      throw isUnique(e) ? new ItemCodeTakenError(data.code) : e;
    }
  }
}

export class UpdateItem {
  constructor(private repo: ItemRepository) {}
  async execute(id: number, input: unknown) {
    // partial() still runs defaults/transforms on absent keys: keep only the keys sent.
    const sent = typeof input === 'object' && input !== null ? input : {};
    const data = Object.fromEntries(
      Object.entries(itemPatch.parse(input)).filter(([k]) => k in sent),
    ) as Partial<ItemInput>;
    const item = await this.repo.update(id, data).catch((e: unknown) => {
      throw isUnique(e) ? new ItemCodeTakenError(data.code ?? '') : e;
    });
    if (!item) throw new ItemNotFoundError();
    return item;
  }
}

export class DeleteItem {
  constructor(private repo: ItemRepository) {}
  async execute(id: number) {
    if (!(await this.repo.delete(id))) throw new ItemNotFoundError();
  }
}

/** Bulk upsert by code: used to seed a fresh environment (production) from the catalogue file. */
export class ImportItems {
  constructor(private repo: ItemRepository) {}
  execute(input: unknown) {
    const { items } = importInput.parse(input);
    return this.repo.upsertMany(items as ItemInput[]);
  }
}
