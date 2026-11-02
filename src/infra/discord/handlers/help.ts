import type { APIEmbed } from 'discord.js';

import { type BotReply, COLOR, discord, errorReply, linkButton } from '../format.js';

/**
 * The bot's built-in guide (/help). Every registered command must appear in some topic:
 * tests/discord.test.ts checks it, so the guide cannot fall behind the commands.
 */
interface Entry {
  /** How to call it, e.g. "/check skill: [secret:]". */
  usage: string;
  /** Command names it documents (`encounter damage` for subcommands). */
  covers: string[];
  text: string;
}

interface Topic {
  key: string;
  label: string;
  emoji: string;
  intro: string;
  gmOnly?: boolean;
  entries: Entry[];
}

export const HELP_TOPICS: Topic[] = [
  {
    key: 'start',
    label: 'Getting started',
    emoji: '✨',
    intro:
      'I am the table companion of the campaign: I roll dice, show the world as the site knows it, ' +
      'and roll from your own character sheet.\n\n' +
      '**1.** Type `/` and pick a command: options with suggestions fill in as you type.\n' +
      '**2.** Ask the GM to `/link` you to your character to use `/check`, `/attack`, `/me`…\n' +
      '**3.** Add `private: True` or `secret: True` when only you should see the answer.\n\n' +
      'I only ever show what players may see on the site: hidden places, people and secrets stay hidden.',
    entries: [{ usage: '/help [topic:]', covers: ['help'], text: 'This guide.' }],
  },
  {
    key: 'dice',
    label: 'Dice & oracle',
    emoji: '🎲',
    intro: 'Rolls anyone can make, no character needed.',
    entries: [
      {
        usage: '/roll dice: [label:] [secret:]',
        covers: ['roll'],
        text:
          '`1d20+5`, `2d6-1`, `4d6kh3` (keep highest 3), `2d20kl1` (keep lowest). ' +
          'Natural 20 / 1 are highlighted; **Roll again** repeats it.',
      },
      {
        usage: '/oracle question: [odds:]',
        covers: ['oracle'],
        text:
          'Yes/no for questions nobody prepared ("Is the guard awake?"). Answers may come with ' +
          '"and…" or "but…", and doubles bring a twist.',
      },
    ],
  },
  {
    key: 'world',
    label: 'The world',
    emoji: '🪐',
    intro: 'What the party knows, straight from the site.',
    entries: [
      {
        usage: '/lookup query: [private:]',
        covers: ['lookup'],
        text: 'A city, NPC, creature, lore, wiki page, quest… with its pictures and where it appears.',
      },
      {
        usage: '/item name: [private:]',
        covers: ['item'],
        text: 'An item of the catalogue: level, price, damage, availability.',
      },
      {
        usage: '/session [number:]',
        covers: ['session'],
        text: 'A session diary (the latest by default).',
      },
      {
        usage: '/timeline [count:]',
        covers: ['timeline'],
        text: 'The latest events of the campaign.',
      },
      {
        usage: '/combat',
        covers: ['combat'],
        text:
          'The live initiative board of the current fight. It updates by itself; foes show only ' +
          'how hurt they look. You get pinged when your character’s turn starts.',
      },
    ],
  },
  {
    key: 'character',
    label: 'Your character',
    emoji: '🛡️',
    intro: 'Rolls and details from your own sheet. Needs a `/link` by the GM.',
    entries: [
      {
        usage: '/me',
        covers: ['me'],
        text: 'Stamina, HP, Resolve, EAC/KAC, saves, weapons, credits (only you see it).',
      },
      {
        usage: '/check skill: [secret:]',
        covers: ['check'],
        text: 'Skill check with your bonus. Suggestions show the bonus; trained-only skills need ranks.',
      },
      { usage: '/save type: [secret:]', covers: ['save'], text: 'Fortitude, Reflex or Will.' },
      { usage: '/init', covers: ['init'], text: 'Initiative.' },
      {
        usage: '/attack weapon:',
        covers: ['attack'],
        text: 'Attack and damage of a weapon on your sheet; a natural 20 shows the critical damage.',
      },
      {
        usage: '/progress',
        covers: ['progress'],
        text: 'XP and credits earned per session (only you see it).',
      },
      {
        usage: '/quests',
        covers: ['quests'],
        text: 'Quests given to your character (only you see it).',
      },
    ],
  },
  {
    key: 'gm',
    label: 'Game master',
    emoji: '🎭',
    gmOnly: true,
    intro:
      'Tools for the GM. Answers are private unless they are meant for the table. ' +
      'With `private: True`, `/lookup` and `/item` show the full GM view (hidden entries included).',
    entries: [
      {
        usage: '/link user: player: [sheet:]',
        covers: ['link'],
        text: 'Who plays which character, and the Starfinder sheet their rolls use.',
      },
      {
        usage: '/unlink user: · /links',
        covers: ['unlink', 'links'],
        text: 'Remove a link · see everyone linked.',
      },
      {
        usage: '/reveal what:',
        covers: ['reveal'],
        text: 'Make a hidden entry visible. It is announced in the campaign channel after 30 s (unless hidden again).',
      },
      {
        usage: '/encounter next · damage · heal · condition · clear · out',
        covers: [
          'encounter',
          'encounter next',
          'encounter damage',
          'encounter heal',
          'encounter condition',
          'encounter clear',
          'encounter out',
        ],
        text:
          'Run the current fight with the site tracker’s rules (Stamina before HP, conditions ' +
          'counting down). If the tracker is open on the site, it will ask which version to keep.',
      },
      {
        usage: '/say npc: text:',
        covers: ['say'],
        text: 'The NPC speaks in this channel with their name and portrait (needs Manage Webhooks).',
      },
      {
        usage: '/handout user: [entry:] [note:] [image:]',
        covers: ['handout'],
        text: 'A private clue by direct message: an entry (hidden ones too), a note and/or a picture.',
      },
    ],
  },
];

export const HELP_SELECT_ID = 'help:topic';

function topicEmbed(topic: Topic): APIEmbed {
  return {
    color: topic.gmOnly ? COLOR.gold : COLOR.brand,
    author: { name: `${topic.emoji} Help · ${topic.label}` },
    description: topic.intro,
    fields: topic.entries.map((e) => ({ name: e.usage, value: e.text })),
    footer: { text: 'The full campaign lives on the site.' },
  };
}

/** A help page with a menu to switch topics; players never see the GM topic. */
export function helpReply(topicKey: string | null, gm: boolean): BotReply {
  const visible = HELP_TOPICS.filter((t) => gm || !t.gmOnly);
  const topic = visible.find((t) => t.key === (topicKey ?? 'start'));
  if (!topic)
    return errorReply(
      topicKey === 'gm' ? 'The GM topic is for the GM.' : `There is no help topic "${topicKey}".`,
    );
  return {
    embeds: [topicEmbed(topic)],
    components: [
      {
        type: 1,
        components: [
          {
            type: 3,
            custom_id: HELP_SELECT_ID,
            placeholder: 'More help…',
            options: visible.map((t) => ({
              label: t.label,
              value: t.key,
              emoji: { name: t.emoji },
              default: t.key === topic.key,
            })),
          },
        ],
      },
      linkButton('Open the site', discord().siteUrl),
    ],
    ephemeral: true,
  };
}

export const HELP_TOPIC_CHOICES = HELP_TOPICS.map((t) => ({ name: t.label, value: t.key }));
