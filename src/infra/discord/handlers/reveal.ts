import type { EntityType } from '../../../core/use-cases/links/link-text.js';
import { container, type Registry } from '../../../di/container.js';
import { type BotReply, COLOR, discord, errorReply, TYPE_ICON, TYPE_LABEL } from '../format.js';

import { clearEntityCache, entityChoices, type EntityRef, knownEntities } from './lookup.js';

/** Types the GM can reveal from Discord, with the same use-case the site calls. */
const REVEAL_USE_CASE: Partial<Record<EntityType, keyof Registry>> = {
  city: 'setCityVisibility',
  npc: 'setNpcVisibility',
  player: 'setPlayerVisibility',
  session: 'setSessionVisibility',
  lore: 'setLoreVisibility',
  wiki: 'setWikiPageVisibility',
  beast: 'setMonsterVisibility',
  timeline: 'setTimelineVisibility',
  world: 'setWorldVisibility',
};

export const revealChoices = (query: string) =>
  entityChoices(query, true, (e) => !e.visible && e.type in REVEAL_USE_CASE);

export async function revealReply(ref: EntityRef): Promise<BotReply> {
  const key = REVEAL_USE_CASE[ref.type];
  if (!key) return errorReply(`${TYPE_LABEL[ref.type]} entries cannot be revealed from Discord.`);
  const entity = (await knownEntities(true)).find((e) => e.type === ref.type && e.id === ref.id);
  if (!entity) return errorReply('Nothing found.');
  if (entity.visible) return errorReply(`**${entity.name}** is already visible to players.`);

  const useCase = container.resolve(key) as {
    execute(id: number, visible: boolean): Promise<void>;
  };
  await useCase.execute(ref.id, true);
  clearEntityCache();
  return {
    embeds: [
      {
        color: COLOR.success,
        description:
          `${TYPE_ICON[ref.type]} **${entity.name}** is now visible to players.` +
          (discord().announceChannelId
            ? `\nIt will be announced in <#${discord().announceChannelId}> shortly.`
            : ''),
      },
    ],
    ephemeral: true,
  };
}
