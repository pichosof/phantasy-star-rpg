// src/infra/http/plugins/visibility-filter.ts
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

type Obj = Record<string, unknown>;

/**
 * The shape an item will actually serialize to. Entities keep their fields in `props`
 * and expose them via `toJSON()`, so checking the raw object misses `visible`.
 */
function shapeOf(item: unknown): Obj | null {
  if (typeof item !== 'object' || item === null || Array.isArray(item)) return null;
  const obj = item as Obj & { toJSON?: () => unknown; props?: unknown };
  if (typeof obj.toJSON === 'function') {
    const json = obj.toJSON();
    return typeof json === 'object' && json !== null ? (json as Obj) : null;
  }
  if (obj.props && typeof obj.props === 'object' && !('visible' in obj)) return obj.props as Obj;
  return obj;
}

const isHidden = (item: unknown) => shapeOf(item)?.visible === false;

/**
 * Undiscovered bestiary entries and dungeons are listed to players by name only —
 * the UI already hides the rest, but the API used to send it anyway.
 * Undiscovered cities keep their text (the UI shows it) but lose their images.
 */
const UNDISCOVERED_KEEP = new Set([
  'id',
  'name',
  'discovered',
  'visible',
  'cityId',
  'worldId',
  'createdAt',
  'updatedAt',
]);
type Kind = 'beast' | 'dungeon' | 'city' | null;

function redactUndiscovered(shape: Obj, kind: Kind): Obj {
  if (kind === 'city') {
    const rest = { ...shape };
    for (const k of ['imageAlt', 'imageMime', 'imageSize']) delete rest[k];
    return { ...rest, imageUrl: null, images: [] };
  }
  const out: Obj = {};
  for (const k of UNDISCOVERED_KEEP) if (k in shape) out[k] = shape[k];
  if ('images' in shape) out.images = [];
  return out;
}

const KIND_BY_KEY: Record<string, Kind> = { beasts: 'beast', dungeons: 'dungeon', cities: 'city' };

function kindForRoute(url: string | undefined): Kind {
  if (!url) return null;
  if (url.startsWith('/api/bestiary')) return 'beast';
  if (url.startsWith('/api/dungeons')) return 'dungeon';
  if (url.startsWith('/api/cities')) return 'city';
  return null;
}

function sanitizeList(list: unknown[], kind: Kind): unknown[] {
  return list.filter((item) => !isHidden(item)).map((item) => sanitizeItem(item, kind));
}

/** Filters hidden entries in nested arrays (e.g. /api/tags/:id/entities) and redacts undiscovered ones. */
function sanitizeItem(item: unknown, kind: Kind): unknown {
  const shape = shapeOf(item);
  if (!shape) return item;

  let changed = false;
  let out: Obj = shape;
  if (kind && shape.discovered === false) {
    out = redactUndiscovered(shape, kind);
    changed = true;
  }
  for (const [key, value] of Object.entries(out)) {
    if (!Array.isArray(value) || key === 'images') continue;
    const next = sanitizeList(value, KIND_BY_KEY[key] ?? null);
    if (next.length !== value.length || next.some((v, i) => v !== value[i])) {
      out = { ...out, [key]: next };
      changed = true;
    }
  }
  return changed ? out : item;
}

export default fp(async (app: FastifyInstance) => {
  app.addHook(
    'preSerialization',
    async (req: FastifyRequest, _reply: FastifyReply, payload: unknown) => {
      if (req.method !== 'GET' || req.isGM) return payload;
      const kind = kindForRoute(req.routeOptions.url);
      return Array.isArray(payload) ? sanitizeList(payload, kind) : sanitizeItem(payload, kind);
    },
  );
});
