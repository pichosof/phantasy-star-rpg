import type { APIEmbed } from 'discord.js';

import {
  currentCombatant,
  STARFINDER_CONDITIONS,
} from '../../../core/use-cases/encounters/combat-engine.js';
import {
  type EncounterAction,
  EncounterActionError,
} from '../../../core/use-cases/encounters/encounter-actions.js';
import {
  type Combatant,
  encounterStateSchema,
} from '../../../core/use-cases/encounters/encounter-state.js';
import { normalizeName } from '../../../core/use-cases/links/link-text.js';
import { LinkTargetNotFoundError } from '../../../core/use-cases/links/links.js';
import { container } from '../../../di/container.js';
import { type BotReply, COLOR, errorReply, imageUrl, truncate } from '../format.js';

import { activeEncounter } from './combat.js';
import { type EntityRef, entityEmbeds } from './lookup.js';

const matches = (query: string, label: string) => {
  const q = normalizeName(query);
  return !q || normalizeName(label).includes(q);
};

// ── Combat (GM) ───────────────────────────────────────────────────────────

const NO_COMBAT = 'No combat is running right now. Start one in the site tracker.';

async function activeState() {
  const encounter = await activeEncounter();
  return encounter ? { encounter, state: encounterStateSchema.parse(encounter.props.state) } : null;
}

const pools = (c: Combatant) => `SP ${c.sp.current}/${c.sp.max} · HP ${c.hp.current}/${c.hp.max}`;

export async function combatantChoices(query: string) {
  const active = await activeState();
  if (!active) return [];
  return active.state.combatants
    .filter((c) => matches(query, c.name))
    .slice(0, 25)
    .map((c) => ({
      name: `${c.defeated ? '💀 ' : ''}${c.name} · ${pools(c)}`.slice(0, 100),
      value: c.id,
    }));
}

/** Starfinder conditions; for `clear`, the conditions the target actually has. */
export async function conditionChoices(query: string, targetId: string | null, current: boolean) {
  if (current) {
    const active = await activeState();
    const target = active?.state.combatants.find((c) => c.id === targetId);
    return (target?.conditions ?? [])
      .filter((k) => matches(query, k.name))
      .map((k) => ({
        name: `${k.name}${k.rounds === null ? '' : ` (${k.rounds})`}`.slice(0, 100),
        value: k.id,
      }));
  }
  const names = STARFINDER_CONDITIONS.filter((n) => matches(query, n)).map((n) => ({
    name: n,
    value: n,
  }));
  // A custom condition is allowed (same as the site), offered as typed.
  const typed = query.trim();
  const custom =
    typed && !STARFINDER_CONDITIONS.some((n) => n.toLowerCase() === typed.toLowerCase())
      ? [{ name: `Custom: ${typed}`.slice(0, 100), value: typed.slice(0, 60) }]
      : [];
  return [...custom, ...names].slice(0, 25);
}

/** Applies a GM action to the running combat; the posted boards update by themselves. */
export async function encounterActionReply(action: EncounterAction): Promise<BotReply> {
  const encounter = await activeEncounter();
  if (!encounter?.props.id) return errorReply(NO_COMBAT);
  try {
    const { encounter: saved, log } = await container
      .resolve('applyEncounterAction')
      .execute(encounter.props.id, action);
    const state = encounterStateSchema.parse(saved.props.state);
    const now = currentCombatant(state);
    return {
      embeds: [
        {
          color: COLOR.danger,
          author: { name: `⚔️ ${saved.props.name} · Round ${state.round}` },
          description: truncate(log.map((l) => `• ${l}`).join('\n') || 'Done.', 3000),
          ...(now ? { footer: { text: `${now.name}'s turn` } } : {}),
        },
      ],
      ephemeral: true,
    };
  } catch (e) {
    if (e instanceof EncounterActionError) return errorReply(e.message);
    throw e;
  }
}

/** Discord user who plays the combatant (PCs keep their sheet id as refId). */
export async function playerOfCombatant(c: Combatant): Promise<string | null> {
  if (c.kind !== 'pc' || !c.refId) return null;
  const links = await container.resolve('listDiscordLinks').execute();
  return links.find((l) => l.sheetId === c.refId)?.discordUserId ?? null;
}

// ── /say: an NPC speaks with their name and portrait ──────────────────────

export async function npcChoices(query: string) {
  return (await container.resolve('listNpcs').execute())
    .filter((n) => matches(query, n.props.name))
    .slice(0, 25)
    .map((n) => ({
      name: `${n.props.name}${n.props.role ? ` · ${n.props.role}` : ''}${n.props.visible ? '' : ' · 🔒 hidden'}`.slice(
        0,
        100,
      ),
      value: String(n.props.id),
    }));
}

export interface NpcVoice {
  username: string;
  avatarURL: string | undefined;
  hasPortrait: boolean;
}

/** Webhook identity of an NPC. Discord forbids "discord"/"clyde" in webhook names. */
export async function npcVoice(npcIdText: string): Promise<NpcVoice | { error: string }> {
  if (!/^\d+$/.test(npcIdText.trim())) return { error: 'Pick the NPC from the suggestions.' };
  const npc = (await container.resolve('listNpcs').execute()).find(
    (n) => n.props.id === Number(npcIdText),
  );
  if (!npc) return { error: 'That NPC does not exist.' };
  const name = npc.props.name.trim();
  if (/discord|clyde/i.test(name))
    return { error: `Discord does not allow "${name}" as a speaker name.` };
  const avatar = imageUrl(npc.props.imageUrl);
  return { username: name.slice(0, 80), avatarURL: avatar, hasPortrait: Boolean(avatar) };
}

// ── /handout: a private clue for one player ───────────────────────────────

/**
 * Cards sent by DM. The GM chooses what to share, so the full view is used (hidden entries
 * included) — without the "hidden" marker, which is GM-only information.
 */
export async function handoutEmbeds(
  ref: EntityRef | null,
  note: string | null,
): Promise<APIEmbed[] | { error: string }> {
  const embeds: APIEmbed[] = [];
  if (note?.trim())
    embeds.push({
      color: COLOR.gold,
      author: { name: '📜 Handout from the GM' },
      description: truncate(note.trim(), 4000),
    });
  if (ref) {
    try {
      const links = await container.resolve('getEntityLinks').execute(ref.type, ref.id, true);
      embeds.push(...entityEmbeds(links, { headline: '📜 Handout' }));
    } catch (e) {
      if (e instanceof LinkTargetNotFoundError) return { error: 'That entry does not exist.' };
      throw e;
    }
  }
  return embeds;
}
