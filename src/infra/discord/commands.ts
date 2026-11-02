import {
  type SlashCommandBooleanOption,
  SlashCommandBuilder,
  type SlashCommandStringOption,
} from 'discord.js';

import { ORACLE_CHOICES } from './handlers/dice.js';
import { HELP_TOPIC_CHOICES } from './handlers/help.js';

const privateOption = (description: string) => (o: SlashCommandBooleanOption) =>
  o.setName('private').setDescription(description);

/** Slash commands, registered on the configured server when the bot starts. */
export const COMMANDS = [
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('How to use the bot: dice, the world, your character, GM tools')
    .addStringOption((o) =>
      o
        .setName('topic')
        .setDescription('Jump to a topic')
        .addChoices(...HELP_TOPIC_CHOICES),
    ),

  new SlashCommandBuilder()
    .setName('roll')
    .setDescription('Roll dice: 1d20+5, 2d6-1, 4d6kh3, 2d20kl1…')
    .addStringOption((o) =>
      o
        .setName('dice')
        .setDescription('Dice expression, e.g. 1d20+5')
        .setRequired(true)
        .setMaxLength(100),
    )
    .addStringOption((o) =>
      o.setName('label').setDescription('What the roll is for (Stealth, Attack…)').setMaxLength(60),
    )
    .addBooleanOption((o) => o.setName('secret').setDescription('Only you see the result')),

  new SlashCommandBuilder()
    .setName('oracle')
    .setDescription('Ask the oracle a yes/no question nobody prepared an answer for')
    .addStringOption((o) =>
      o
        .setName('question')
        .setDescription('Is the guard awake?')
        .setRequired(true)
        .setMaxLength(200),
    )
    .addStringOption((o) =>
      o
        .setName('odds')
        .setDescription('How likely is a yes? (default: even)')
        .addChoices(...ORACLE_CHOICES),
    ),

  new SlashCommandBuilder()
    .setName('lookup')
    .setDescription('Show a city, NPC, creature, lore, wiki page… with its picture')
    .addStringOption((o) =>
      o
        .setName('query')
        .setDescription('Name to look up')
        .setRequired(true)
        .setAutocomplete(true)
        .setMaxLength(100),
    )
    .addBooleanOption(
      privateOption('Only you see the answer (GM: full view, hidden entries included)'),
    ),

  new SlashCommandBuilder()
    .setName('item')
    .setDescription('Show an item from the catalogue')
    .addStringOption((o) =>
      o
        .setName('name')
        .setDescription('Item name or code')
        .setRequired(true)
        .setAutocomplete(true)
        .setMaxLength(100),
    )
    .addBooleanOption(privateOption('Only you see the answer (GM: prices, access and notes)')),

  new SlashCommandBuilder()
    .setName('session')
    .setDescription('Read a session diary (the latest by default)')
    .addIntegerOption((o) => o.setName('number').setDescription('Session number').setMinValue(1)),

  new SlashCommandBuilder()
    .setName('timeline')
    .setDescription('The latest events of the campaign timeline')
    .addIntegerOption((o) =>
      o
        .setName('count')
        .setDescription('How many events (default 5)')
        .setMinValue(1)
        .setMaxValue(10),
    ),

  new SlashCommandBuilder()
    .setName('combat')
    .setDescription('Post the live initiative board of the current combat'),

  new SlashCommandBuilder()
    .setName('reveal')
    .setDescription('GM: make something visible to players and announce it')
    .addStringOption((o) =>
      o
        .setName('what')
        .setDescription('Hidden entry to reveal')
        .setRequired(true)
        .setAutocomplete(true)
        .setMaxLength(100),
    ),

  // ── Your character (needs a /link by the GM) ──
  new SlashCommandBuilder()
    .setName('me')
    .setDescription('Your character: pools, defenses, saves, weapons (only you see it)'),

  new SlashCommandBuilder()
    .setName('check')
    .setDescription('Roll a skill check with the bonus from your sheet')
    .addStringOption((o) =>
      o.setName('skill').setDescription('Skill').setRequired(true).setAutocomplete(true),
    )
    .addBooleanOption((o) => o.setName('secret').setDescription('Only you see the result')),

  new SlashCommandBuilder()
    .setName('save')
    .setDescription('Roll a saving throw with the bonus from your sheet')
    .addStringOption((o) =>
      o
        .setName('type')
        .setDescription('Which save')
        .setRequired(true)
        .addChoices(
          { name: 'Fortitude', value: 'fort' },
          { name: 'Reflex', value: 'ref' },
          { name: 'Will', value: 'will' },
        ),
    )
    .addBooleanOption((o) => o.setName('secret').setDescription('Only you see the result')),

  new SlashCommandBuilder()
    .setName('init')
    .setDescription('Roll initiative with the bonus from your sheet'),

  new SlashCommandBuilder()
    .setName('attack')
    .setDescription('Attack with a weapon from your sheet (attack + damage)')
    .addStringOption((o) =>
      o.setName('weapon').setDescription('Weapon').setRequired(true).setAutocomplete(true),
    ),

  new SlashCommandBuilder()
    .setName('progress')
    .setDescription('Your XP and credits per session (only you see it)'),

  new SlashCommandBuilder()
    .setName('quests')
    .setDescription('Quests assigned to your character (only you see it)'),

  // ── GM: who plays whom ──
  new SlashCommandBuilder()
    .setName('link')
    .setDescription('GM: link a Discord user to a player character and sheet')
    .addUserOption((o) => o.setName('user').setDescription('Discord user').setRequired(true))
    .addStringOption((o) =>
      o
        .setName('player')
        .setDescription('Player character')
        .setRequired(true)
        .setAutocomplete(true),
    )
    .addStringOption((o) =>
      o
        .setName('sheet')
        .setDescription('Starfinder sheet for rolls (leave empty: no rolls)')
        .setAutocomplete(true),
    ),

  new SlashCommandBuilder()
    .setName('unlink')
    .setDescription('GM: remove the link of a Discord user')
    .addUserOption((o) => o.setName('user').setDescription('Discord user').setRequired(true)),

  new SlashCommandBuilder().setName('links').setDescription('GM: who plays which character'),

  // ── GM: run the combat from Discord (same rules as the site tracker) ──
  new SlashCommandBuilder()
    .setName('encounter')
    .setDescription('GM: act on the running combat')
    .addSubcommand((s) =>
      s.setName('next').setDescription('Next turn (starts the combat if needed)'),
    )
    .addSubcommand((s) =>
      s
        .setName('damage')
        .setDescription('Deal damage (Stamina first, then HP)')
        .addStringOption((o) => target(o))
        .addIntegerOption((o) =>
          o
            .setName('amount')
            .setDescription('Damage')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(9999),
        )
        .addBooleanOption((o) =>
          o.setName('hp_only').setDescription('Skip Stamina (straight to HP)'),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('heal')
        .setDescription('Recover Stamina, HP or Resolve')
        .addStringOption((o) => target(o))
        .addStringOption((o) =>
          o
            .setName('pool')
            .setDescription('Which pool')
            .setRequired(true)
            .addChoices(
              { name: 'Stamina', value: 'sp' },
              { name: 'Hit Points', value: 'hp' },
              { name: 'Resolve', value: 'rp' },
            ),
        )
        .addIntegerOption((o) =>
          o
            .setName('amount')
            .setDescription('Amount')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(9999),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('condition')
        .setDescription('Add a condition')
        .addStringOption((o) => target(o))
        .addStringOption((o) =>
          o
            .setName('name')
            .setDescription('Condition')
            .setRequired(true)
            .setAutocomplete(true)
            .setMaxLength(60),
        )
        .addIntegerOption((o) =>
          o
            .setName('rounds')
            .setDescription('Rounds (empty: until removed)')
            .setMinValue(1)
            .setMaxValue(99),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('clear')
        .setDescription('Remove a condition')
        .addStringOption((o) => target(o))
        .addStringOption((o) =>
          o
            .setName('condition')
            .setDescription('Condition')
            .setRequired(true)
            .setAutocomplete(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('out')
        .setDescription('Take a combatant out of the fight (or back in)')
        .addStringOption((o) => target(o))
        .addBooleanOption((o) =>
          o.setName('out').setDescription('Out of the fight? (false: back in)').setRequired(true),
        ),
    ),

  new SlashCommandBuilder()
    .setName('say')
    .setDescription('GM: an NPC speaks in this channel, with their name and portrait')
    .addStringOption((o) =>
      o.setName('npc').setDescription('Who speaks').setRequired(true).setAutocomplete(true),
    )
    .addStringOption((o) =>
      o.setName('text').setDescription('What they say').setRequired(true).setMaxLength(2000),
    ),

  new SlashCommandBuilder()
    .setName('handout')
    .setDescription('GM: send a private clue to one player (by direct message)')
    .addUserOption((o) => o.setName('user').setDescription('Who receives it').setRequired(true))
    .addStringOption((o) =>
      o
        .setName('entry')
        .setDescription('A lore, NPC, city… (hidden ones too)')
        .setAutocomplete(true)
        .setMaxLength(100),
    )
    .addStringOption((o) => o.setName('note').setDescription('A note or letter').setMaxLength(2000))
    .addAttachmentOption((o) => o.setName('image').setDescription('A picture, map, document…')),
].map((c) => c.toJSON());

function target(o: SlashCommandStringOption) {
  return o.setName('target').setDescription('Combatant').setRequired(true).setAutocomplete(true);
}
