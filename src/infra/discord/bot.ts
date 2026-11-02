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
  PermissionFlagsBits,
  RESTJSONErrorCodes,
  type Webhook,
} from 'discord.js';

import { entityEvents } from '../../core/events/entity-events.js';
import type { SaveKey } from '../../core/use-cases/character-sheets/starfinder.js';
import type { OracleOdds } from '../../core/use-cases/dice/oracle.js';
import { currentCombatant } from '../../core/use-cases/encounters/combat-engine.js';
import type { EncounterAction } from '../../core/use-cases/encounters/encounter-actions.js';
import { encounterStateSchema } from '../../core/use-cases/encounters/encounter-state.js';
import type { EntityType } from '../../core/use-cases/links/link-text.js';
import { LinkTargetNotFoundError } from '../../core/use-cases/links/links.js';
import { container } from '../../di/container.js';

import { COMMANDS } from './commands.js';
import {
  type BotReply,
  branded,
  COLOR,
  discord,
  errorReply,
  linkButton,
  siteUrl,
  TYPE_LABEL,
} from './format.js';
import {
  attackReply,
  checkReply,
  initiativeReply,
  linkReply,
  linksReply,
  meReply,
  playerChoices,
  progressReply,
  questsReply,
  saveReply,
  sheetChoices,
  skillChoices,
  unlinkReply,
  weaponChoices,
} from './handlers/character.js';
import { COMBAT_REFRESH_PREFIX, combatReply } from './handlers/combat.js';
import { oracleReply, parseRerollId, REROLL_PREFIX, rollReply } from './handlers/dice.js';
import {
  combatantChoices,
  conditionChoices,
  encounterActionReply,
  handoutEmbeds,
  npcChoices,
  npcVoice,
  playerOfCombatant,
} from './handlers/gm.js';
import { itemChoices, itemReply, resolveItemId } from './handlers/item.js';
import { sessionReply, timelineReply } from './handlers/journal.js';
import {
  clearEntityCache,
  entityChoices,
  entityEmbeds,
  type EntityRef,
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
    embeds: branded(reply.embeds),
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
    const focused = i.options.getFocused(true);
    const query = String(focused.value);
    const choices = await this.suggestions(
      i.commandName,
      focused.name,
      query,
      i.user.id,
      gm,
      (name) => i.options.getString(name),
    );
    // Suggestions are dropped when the user keeps typing (expired interaction): expected.
    await i.respond(choices).catch((err: unknown) => {
      if (!isDiscordError(err, RESTJSONErrorCodes.UnknownInteraction)) throw err;
    });
  }

  private async suggestions(
    command: string,
    option: string,
    query: string,
    userId: string,
    gm: boolean,
    other: (name: string) => string | null,
  ): Promise<{ name: string; value: string }[]> {
    switch (command) {
      case 'lookup':
        return entityChoices(query, gm, (e) => e.type !== 'item');
      case 'item':
        return itemChoices(query, gm);
      case 'reveal':
        return gm ? revealChoices(query) : [];
      case 'check':
        return skillChoices(userId, query);
      case 'attack':
        return weaponChoices(userId, query);
      case 'link':
        if (!gm) return [];
        return option === 'sheet' ? sheetChoices(query) : playerChoices(query);
      case 'encounter':
        if (!gm) return [];
        if (option === 'target') return combatantChoices(query);
        return conditionChoices(query, other('target'), option === 'condition');
      case 'say':
        return gm ? npcChoices(query) : [];
      case 'handout':
        return gm ? entityChoices(query, true, (e) => e.type !== 'item') : [];
      default:
        return [];
    }
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
      case 'me':
        return i.reply(toDiscord(await meReply(i.user.id)));
      case 'check':
        return i.reply(
          toDiscord(
            await checkReply(
              i.user.id,
              i.options.getString('skill', true),
              i.options.getBoolean('secret') ?? false,
            ),
          ),
        );
      case 'save':
        return i.reply(
          toDiscord(
            await saveReply(
              i.user.id,
              i.options.getString('type', true) as SaveKey,
              i.options.getBoolean('secret') ?? false,
            ),
          ),
        );
      case 'init':
        return i.reply(toDiscord(await initiativeReply(i.user.id)));
      case 'attack':
        return i.reply(
          toDiscord(await attackReply(i.user.id, i.options.getString('weapon', true))),
        );
      case 'progress':
        return i.reply(toDiscord(await progressReply(i.user.id)));
      case 'quests':
        return i.reply(toDiscord(await questsReply(i.user.id)));
      case 'link':
      case 'unlink':
      case 'links': {
        if (!gm) return i.reply(toDiscord(errorReply('Only the GM can manage links.')));
        if (i.commandName === 'links') return i.reply(toDiscord(await linksReply()));
        const user = i.options.getUser('user', true);
        if (i.commandName === 'unlink') return i.reply(toDiscord(await unlinkReply(user.id)));
        return i.reply(
          toDiscord(
            await linkReply(
              user.id,
              i.options.getString('player', true),
              i.options.getString('sheet'),
            ),
          ),
        );
      }
      case 'encounter':
        if (!gm) return i.reply(toDiscord(errorReply('Only the GM can run the combat.')));
        return i.reply(toDiscord(await encounterActionReply(encounterAction(i))));
      case 'say':
        if (!gm) return i.reply(toDiscord(errorReply('Only the GM can speak as an NPC.')));
        return i.reply(toDiscord(await this.say(i)));
      case 'handout':
        if (!gm) return i.reply(toDiscord(errorReply('Only the GM can send handouts.')));
        return i.reply(toDiscord(await this.handout(i)));
      default:
        throw new Error(`Unhandled command: ${i.commandName}`);
    }
  }

  // ── /say: NPCs speak through a channel webhook ──────────────────────────

  /** One webhook per channel, created by the bot the first time an NPC speaks there. */
  private webhooks = new Map<string, Webhook>();

  private async say(i: ChatInputCommandInteraction): Promise<BotReply> {
    const voice = await npcVoice(i.options.getString('npc', true));
    if ('error' in voice) return errorReply(voice.error);
    const channel = i.channel;
    if (!channel || !('guild' in channel) || !channel.guild)
      return errorReply('NPCs can only speak in a server channel.');
    if (!i.appPermissions?.has(PermissionFlagsBits.ManageWebhooks))
      return errorReply(
        'The bot needs the **Manage Webhooks** permission in this channel to speak as NPCs. ' +
          'Give it in the channel (or server) settings → Permissions → RPG Picho.',
      );
    const thread = channel.isThread() ? channel : null;
    const host = thread ? thread.parent : channel;
    if (!host || !('fetchWebhooks' in host))
      return errorReply('NPCs cannot speak in this kind of channel.');

    let webhook = this.webhooks.get(host.id);
    if (!webhook) {
      const me = this.client?.user?.id;
      webhook =
        (await host.fetchWebhooks()).find((w) => w.owner?.id === me && w.name === WEBHOOK_NAME) ??
        (await host.createWebhook({ name: WEBHOOK_NAME, reason: 'NPC voices (/say)' }));
      this.webhooks.set(host.id, webhook);
    }
    await webhook.send({
      content: i.options.getString('text', true),
      username: voice.username,
      avatarURL: voice.avatarURL,
      allowedMentions: { parse: [] },
      ...(thread ? { threadId: thread.id } : {}),
    });
    return {
      embeds: [
        {
          color: COLOR.success,
          description:
            `🗣️ Sent as **${voice.username}**.` +
            (voice.hasPortrait
              ? ''
              : ' *(No portrait on the site: Discord shows a default avatar.)*'),
        },
      ],
      ephemeral: true,
    };
  }

  // ── /handout: a private clue by DM ──────────────────────────────────────

  private async handout(i: ChatInputCommandInteraction): Promise<BotReply> {
    const user = i.options.getUser('user', true);
    if (user.bot) return errorReply('Handouts go to players, not bots.');
    const entry = i.options.getString('entry');
    const note = i.options.getString('note');
    const image = i.options.getAttachment('image');
    if (!entry && !note?.trim() && !image)
      return errorReply('Give the handout an entry, a note or an image.');

    let ref: EntityRef | null = null;
    if (entry) {
      const found = await resolveRef(entry, true);
      if ('error' in found) return errorReply(found.error);
      ref = found.ref;
    }
    const embeds = await handoutEmbeds(ref, note);
    if ('error' in embeds) return errorReply(embeds.error);
    try {
      await user.send({
        ...(embeds.length
          ? { embeds: branded(embeds) }
          : { content: '📜 **Handout from the GM**' }),
        ...(image ? { files: [{ attachment: image.url, name: image.name }] } : {}),
      });
    } catch (e) {
      if (isDiscordError(e, RESTJSONErrorCodes.CannotSendMessagesToThisUser))
        return errorReply(
          `<@${user.id}> does not accept direct messages from this server. ` +
            "They can allow it in the server's Privacy Settings.",
        );
      throw e;
    }
    return {
      embeds: [{ color: COLOR.success, description: `📜 Handout sent to <@${user.id}>.` }],
      ephemeral: true,
    };
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
      return i.update({ embeds: branded(reply.embeds), components: reply.components });
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
      embeds: branded(entityEmbeds(links, { headline: `✨ New discovery · ${TYPE_LABEL[type]}` })),
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
        await message.edit({ embeds: branded(reply.embeds), components: reply.components });
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
    await this.announceTurn(encounterId, alive[alive.length - 1]?.channelId);
  }

  /** Last announced turn per encounter (`round:combatantId`), so each turn pings once. */
  private announcedTurns = new Map<number, string>();

  /** "@player, it's your turn" in the board's channel, when a linked PC starts their turn. */
  private async announceTurn(encounterId: number, channelId: string | undefined) {
    if (!channelId) return;
    const encounter = await container.resolve('getEncounter').execute(encounterId);
    const state = encounterStateSchema.parse(encounter.props.state);
    const acting = currentCombatant(state);
    if (!acting || encounter.props.status === 'ended') return;
    const key = `${state.round}:${acting.id}`;
    if (this.announcedTurns.get(encounterId) === key) return;
    this.announcedTurns.set(encounterId, key);
    const userId = await playerOfCombatant(acting);
    if (!userId) return;
    const channel = await this.client?.channels.fetch(channelId);
    if (!channel?.isSendable())
      throw new Error(`Combat board channel ${channelId} is not a channel the bot can post in`);
    await channel.send({
      content: `🎯 <@${userId}>, it's **${acting.name}**'s turn (round ${state.round}).`,
      allowedMentions: { users: [userId] },
    });
  }
}

const WEBHOOK_NAME = 'RPG Picho voices';

/** `/encounter <subcommand>` → the action the site tracker would apply. */
function encounterAction(i: ChatInputCommandInteraction): EncounterAction {
  const target = () => i.options.getString('target', true);
  switch (i.options.getSubcommand()) {
    case 'next':
      return { type: 'next' };
    case 'damage':
      return {
        type: 'damage',
        target: target(),
        amount: i.options.getInteger('amount', true),
        hpOnly: i.options.getBoolean('hp_only') ?? false,
      };
    case 'heal':
      return {
        type: 'heal',
        target: target(),
        pool: i.options.getString('pool', true) as 'sp' | 'hp' | 'rp',
        amount: i.options.getInteger('amount', true),
      };
    case 'condition':
      return {
        type: 'condition',
        target: target(),
        name: i.options.getString('name', true),
        rounds: i.options.getInteger('rounds'),
      };
    case 'clear':
      return {
        type: 'uncondition',
        target: target(),
        conditionId: i.options.getString('condition', true),
      };
    case 'out':
      return { type: 'defeated', target: target(), defeated: i.options.getBoolean('out', true) };
    default:
      throw new Error(`Unhandled /encounter subcommand: ${i.options.getSubcommand()}`);
  }
}
