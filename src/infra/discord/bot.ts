import {
  type AutocompleteInteraction,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  Client,
  DiscordAPIError,
  Events,
  GatewayIntentBits,
  type GuildMember,
  type Interaction,
  type InteractionReplyOptions,
  MessageFlags,
  RESTJSONErrorCodes,
} from 'discord.js';

import { entityEvents } from '../../core/events/entity-events.js';
import type { OracleOdds } from '../../core/use-cases/dice/oracle.js';
import type { EntityType } from '../../core/use-cases/links/link-text.js';
import { LinkTargetNotFoundError } from '../../core/use-cases/links/links.js';
import { container } from '../../di/container.js';

import { COMMANDS } from './commands.js';
import { type BotReply, discord, errorReply, linkButton, siteUrl, TYPE_LABEL } from './format.js';
import { COMBAT_REFRESH_PREFIX, combatReply } from './handlers/combat.js';
import { oracleReply, parseRerollId, REROLL_PREFIX, rollReply } from './handlers/dice.js';
import { itemChoices, itemReply, resolveItemId } from './handlers/item.js';
import { sessionReply, timelineReply } from './handlers/journal.js';
import {
  clearEntityCache,
  entityChoices,
  entityEmbed,
  resolveRef,
  lookupReply,
} from './handlers/lookup.js';
import { revealChoices, revealReply } from './handlers/reveal.js';
import { setBotStatus } from './status.js';

type Log = {
  info(msg: string): void;
  warn(msg: string): void;
  error(obj: unknown, msg?: string): void;
};

/** Wait before announcing a reveal, so a quick hide-again (misclick) cancels it. */
const ANNOUNCE_DELAY_MS = 30_000;
const ANNOUNCE_DEDUPE_MS = 10 * 60_000;
/** Combat boards get edited at most this often while the GM clicks through turns. */
const BOARD_DEBOUNCE_MS = 1_500;
const MAX_BOARDS_PER_ENCOUNTER = 5;

const isGM = (userId: string) => discord().gmUserIds.includes(userId);

/** True for a Discord API error with one of the given codes (the only errors we expect). */
const isDiscordError = (err: unknown, ...codes: number[]) =>
  err instanceof DiscordAPIError && codes.includes(Number(err.code));

function toDiscord(reply: BotReply): InteractionReplyOptions {
  return {
    content: reply.content,
    embeds: reply.embeds,
    components: reply.components,
    allowedMentions: { parse: [] },
    ...(reply.ephemeral ? { flags: MessageFlags.Ephemeral } : {}),
  };
}

function displayName(i: ChatInputCommandInteraction | ButtonInteraction): string {
  const member = i.member as GuildMember | null;
  return member?.displayName ?? i.user.displayName ?? i.user.username;
}

/**
 * Discord adapter: slash commands over the same use-cases (and visibility rules) as the site,
 * reveal announcements and live combat boards. Runs inside the API process.
 */
export class DiscordBot {
  private client: Client | null = null;
  private unsubscribe: (() => void)[] = [];
  private announced = new Map<string, number>();
  /** Public /combat messages to keep in sync, per encounter. */
  private boards = new Map<number, { channelId: string; messageId: string }[]>();
  private boardTimers = new Map<number, ReturnType<typeof setTimeout>>();

  constructor(private log: Log) {}

  /** Resolves once logged in and the slash commands are registered; rejects otherwise. */
  async start(): Promise<void> {
    const cfg = discord();
    setBotStatus('starting');
    const client = new Client({ intents: [GatewayIntentBits.Guilds] });
    this.client = client;

    const ready = new Promise<void>((resolve, reject) => {
      client.once(Events.ClientReady, (c) => {
        c.guilds
          .fetch(cfg.guildId)
          .then((guild) => guild.commands.set(COMMANDS))
          .then(() => {
            setBotStatus('ready');
            this.log.info(
              `[discord] ready as ${c.user.tag}; ${COMMANDS.length} commands registered`,
            );
            resolve();
          })
          .catch(reject);
      });
    });
    client.on(Events.InteractionCreate, (i) => void this.handle(i));
    client.on(Events.Error, (err) => {
      setBotStatus('error', err);
      this.log.error(err, '[discord] client error');
    });
    client.on(Events.ShardDisconnect, () => setBotStatus('error', 'disconnected from the gateway'));
    client.on(Events.ShardResume, () => setBotStatus('ready'));

    this.unsubscribe.push(
      entityEvents.revealed.on(({ type, id }) => this.scheduleAnnouncement(type, id)),
      entityEvents.encounterSaved.on(({ id }) => this.scheduleBoardUpdate(id)),
    );
    try {
      await client.login(cfg.token);
      await ready;
    } catch (err) {
      setBotStatus('error', err);
      throw err;
    }
  }

  async stop(): Promise<void> {
    this.unsubscribe.forEach((u) => u());
    this.boardTimers.forEach((t) => clearTimeout(t));
    await this.client?.destroy();
    this.client = null;
    setBotStatus('off');
  }

  // ── Interactions ─────────────────────────────────────────────────────────

  private async handle(i: Interaction) {
    try {
      if (i.isAutocomplete()) return await this.autocomplete(i);
      if (i.isChatInputCommand()) return await this.command(i);
      if (i.isButton()) return await this.button(i);
    } catch (err) {
      this.log.error(err, '[discord] interaction failed');
      if (i.isRepliable() && !i.replied && !i.deferred)
        await i
          .reply(toDiscord(errorReply('Something went wrong. Try again in a moment.')))
          .catch((replyErr: unknown) => this.log.error(replyErr, '[discord] error reply failed'));
    }
  }

  private async autocomplete(i: AutocompleteInteraction) {
    const gm = isGM(i.user.id);
    const query = String(i.options.getFocused());
    const choices =
      i.commandName === 'lookup'
        ? await entityChoices(query, gm, (e) => e.type !== 'item')
        : i.commandName === 'item'
          ? await itemChoices(query, gm)
          : i.commandName === 'reveal' && gm
            ? await revealChoices(query)
            : [];
    // Suggestions are dropped when the user keeps typing (expired interaction): expected.
    await i.respond(choices).catch((err: unknown) => {
      if (!isDiscordError(err, RESTJSONErrorCodes.UnknownInteraction)) throw err;
    });
  }

  private async command(i: ChatInputCommandInteraction) {
    const gm = isGM(i.user.id);
    const priv = i.options.getBoolean('private') ?? false;
    switch (i.commandName) {
      case 'roll':
        return i.reply(
          toDiscord(
            rollReply(i.options.getString('dice', true), {
              label: i.options.getString('label'),
              who: displayName(i),
              secret: i.options.getBoolean('secret') ?? false,
            }),
          ),
        );
      case 'oracle':
        return i.reply(
          toDiscord(
            oracleReply(
              i.options.getString('question', true),
              (i.options.getString('odds') ?? 'even') as OracleOdds,
              displayName(i),
            ),
          ),
        );
      case 'lookup': {
        const found = await resolveRef(
          i.options.getString('query', true),
          gm && priv,
          (e) => e.type !== 'item',
        );
        return i.reply(
          toDiscord(
            'ref' in found
              ? await lookupReply(found.ref, { gm, private: priv })
              : errorReply(found.error),
          ),
        );
      }
      case 'item': {
        const found = await resolveItemId(i.options.getString('name', true), gm && priv);
        return i.reply(
          toDiscord(
            'id' in found
              ? await itemReply(found.id, { gm, private: priv })
              : errorReply(found.error),
          ),
        );
      }
      case 'session':
        return i.reply(toDiscord(await sessionReply(i.options.getInteger('number'))));
      case 'timeline':
        return i.reply(toDiscord(await timelineReply(i.options.getInteger('count') ?? 5)));
      case 'combat': {
        const reply = await combatReply();
        await i.reply(toDiscord(reply));
        if (reply.encounterId) {
          const msg = await i.fetchReply();
          this.trackBoard(reply.encounterId, msg.channelId, msg.id);
        }
        return;
      }
      case 'reveal': {
        if (!gm) return i.reply(toDiscord(errorReply('Only the GM can reveal things.')));
        const found = await resolveRef(i.options.getString('what', true), true, (e) => !e.visible);
        return i.reply(
          toDiscord('ref' in found ? await revealReply(found.ref) : errorReply(found.error)),
        );
      }
    }
  }

  private async button(i: ButtonInteraction) {
    if (i.customId.startsWith(REROLL_PREFIX)) {
      const { expression, label } = parseRerollId(i.customId);
      return i.reply(toDiscord(rollReply(expression, { label, who: displayName(i) })));
    }
    if (i.customId.startsWith(COMBAT_REFRESH_PREFIX)) {
      const id = Number(i.customId.slice(COMBAT_REFRESH_PREFIX.length));
      const reply = await combatReply(id);
      if (!reply.encounterId) return i.reply(toDiscord(reply));
      return i.update({ embeds: reply.embeds, components: reply.components });
    }
  }

  // ── Reveal announcements ────────────────────────────────────────────────

  private scheduleAnnouncement(type: EntityType, id: number) {
    const channelId = discord().announceChannelId;
    if (!channelId) return; // announcements explicitly turned off
    setTimeout(() => {
      this.announce(type, id, channelId).catch((err: unknown) =>
        this.log.error(err, '[discord] announcement failed'),
      );
    }, ANNOUNCE_DELAY_MS).unref();
  }

  private async announce(type: EntityType, id: number, channelId: string) {
    const key = `${type}:${id}`;
    const last = this.announced.get(key);
    if (last && Date.now() - last < ANNOUNCE_DEDUPE_MS) return;
    clearEntityCache();
    // Player view: if the GM hid it again meanwhile, it is not found and nothing is posted.
    const links = await container
      .resolve('getEntityLinks')
      .execute(type, id, false)
      .catch((err: unknown) => {
        if (err instanceof LinkTargetNotFoundError) return null;
        throw err;
      });
    if (!links) return;
    if (!this.client) throw new Error('Discord client is not running');
    const channel = await this.client.channels.fetch(channelId);
    if (!channel?.isSendable())
      throw new Error(`Announce channel ${channelId} is not a channel the bot can post in`);
    this.announced.set(key, Date.now());
    await channel.send({
      embeds: [entityEmbed(links, { headline: `✨ New discovery · ${TYPE_LABEL[type]}` })],
      components: [linkButton('Open on site', siteUrl(type))],
      allowedMentions: { parse: [] },
    });
  }

  // ── Live combat boards ──────────────────────────────────────────────────

  private trackBoard(encounterId: number, channelId: string, messageId: string) {
    const list = this.boards.get(encounterId) ?? [];
    list.push({ channelId, messageId });
    this.boards.set(encounterId, list.slice(-MAX_BOARDS_PER_ENCOUNTER));
  }

  private scheduleBoardUpdate(encounterId: number) {
    if (!this.boards.has(encounterId)) return;
    clearTimeout(this.boardTimers.get(encounterId));
    this.boardTimers.set(
      encounterId,
      setTimeout(() => {
        this.updateBoards(encounterId).catch((err: unknown) =>
          this.log.error(err, '[discord] combat board update failed'),
        );
      }, BOARD_DEBOUNCE_MS),
    );
  }

  private async updateBoards(encounterId: number) {
    this.boardTimers.delete(encounterId);
    const reply = await combatReply(encounterId);
    if (!reply.encounterId) return; // encounter deleted
    const alive: { channelId: string; messageId: string }[] = [];
    for (const board of this.boards.get(encounterId) ?? []) {
      try {
        const channel = await this.client?.channels.fetch(board.channelId);
        if (!channel?.isTextBased())
          throw new Error(`Combat board channel ${board.channelId} is not a text channel`);
        const message = await channel.messages.fetch(board.messageId);
        await message.edit({ embeds: reply.embeds, components: reply.components });
        alive.push(board);
      } catch (err) {
        // Someone deleted the message or the channel: expected, stop tracking it.
        const gone = isDiscordError(
          err,
          RESTJSONErrorCodes.UnknownMessage,
          RESTJSONErrorCodes.UnknownChannel,
        );
        if (!gone) throw err;
      }
    }
    this.boards.set(encounterId, alive);
  }
}
