import { type SlashCommandBooleanOption, SlashCommandBuilder } from 'discord.js';

import { ORACLE_CHOICES } from './handlers/dice.js';

const privateOption = (description: string) => (o: SlashCommandBooleanOption) =>
  o.setName('private').setDescription(description);

/** Slash commands, registered on the configured server when the bot starts. */
export const COMMANDS = [
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
].map((c) => c.toJSON());
