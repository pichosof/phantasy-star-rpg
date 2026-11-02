import type { APIEmbed } from 'discord.js';

import type { Encounter } from '../../../core/entities/encounter.js';
import { EncounterNotFoundError } from '../../../core/use-cases/encounters/errors.js';
import { type BoardEntry, toPlayerBoard } from '../../../core/use-cases/encounters/player-board.js';
import { container } from '../../../di/container.js';
import { type BotReply, COLOR, errorReply, truncate } from '../format.js';

export const COMBAT_REFRESH_PREFIX = 'combat:refresh:';

const HEALTH_ICON: Record<NonNullable<BoardEntry['health']>, string> = {
  Unhurt: '🟢',
  Hurt: '🟡',
  Bloodied: '🟠',
  Critical: '🔴',
  Down: '💀',
};
const KIND_ICON: Record<BoardEntry['kind'], string> = { pc: '🛡️', npc: '🧑', monster: '🦂' };

function line(e: BoardEntry): string {
  const init = e.initiative === null ? '—' : String(e.initiative);
  const name = e.defeated ? `~~${e.name}~~` : e.current ? `**${e.name}**` : e.name;
  const status = e.pools
    ? `SP ${e.pools.sp} · HP ${e.pools.hp} · RP ${e.pools.rp}`
    : `${HEALTH_ICON[e.health ?? 'Unhurt']} ${e.health}`;
  const conditions = e.conditions.length ? ` · *${e.conditions.join(', ')}*` : '';
  return `${e.current ? '▶️' : '▫️'} \`${init.padStart(3)}\` ${KIND_ICON[e.kind]} ${name} — ${status}${conditions}`;
}

export function boardEmbed(encounter: Encounter): APIEmbed {
  const board = toPlayerBoard(encounter.props.state);
  const current = board.entries.find((e) => e.current);
  const ended = encounter.props.status === 'ended';
  return {
    color: ended ? COLOR.muted : COLOR.danger,
    author: {
      name: ended
        ? '⚔️ Combat ended'
        : board.round > 0
          ? `⚔️ Round ${board.round}`
          : '⚔️ Rolling initiative…',
    },
    title: truncate(encounter.props.name, 256),
    description: board.entries.length
      ? truncate(board.entries.map(line).join('\n'), 4000)
      : '*No combatants yet.*',
    ...(current && !ended ? { footer: { text: `${current.name}'s turn` } } : {}),
    timestamp: (encounter.props.updatedAt ?? new Date()).toISOString(),
  };
}

/** The encounter the GM is running: the most recently updated active one. */
export async function activeEncounter(): Promise<Encounter | null> {
  const all = await container.resolve('listEncounters').execute();
  return (
    all
      .filter((e) => e.props.status === 'active')
      .sort(
        (a, b) => (b.props.updatedAt?.getTime() ?? 0) - (a.props.updatedAt?.getTime() ?? 0),
      )[0] ?? null
  );
}

/** The board, plus the encounter id when there is one (to keep the posted message live). */
export async function combatReply(id?: number): Promise<BotReply & { encounterId?: number }> {
  const encounter = id
    ? await container
        .resolve('getEncounter')
        .execute(id)
        .catch((err: unknown) => {
          if (err instanceof EncounterNotFoundError) return null; // deleted on the site
          throw err;
        })
    : await activeEncounter();
  if (!encounter) return errorReply('No combat is running right now.');
  return {
    encounterId: encounter.props.id,
    embeds: [boardEmbed(encounter)],
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 2,
            label: 'Refresh',
            emoji: { name: '🔄' },
            custom_id: `${COMBAT_REFRESH_PREFIX}${encounter.props.id}`,
          },
        ],
      },
    ],
  };
}
