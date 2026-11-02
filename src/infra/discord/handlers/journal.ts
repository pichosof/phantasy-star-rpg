import {
  type BotReply,
  COLOR,
  errorReply,
  imageUrl,
  linkButton,
  siteUrl,
  toDiscordMarkdown,
  truncate,
} from '../format.js';

import { knownEntities } from './lookup.js';

/** Sessions players can read, in play order (by id, like the site). */
async function visibleOf(type: 'session' | 'timeline') {
  return (await knownEntities(false)).filter((e) => e.type === type).sort((a, b) => a.id - b.id);
}

/** A session diary: the latest by default, or the Nth published one. */
export async function sessionReply(number: number | null): Promise<BotReply> {
  const sessions = await visibleOf('session');
  if (!sessions.length) return errorReply('No session has been published yet.');
  const index = number === null ? sessions.length - 1 : number - 1;
  const s = sessions[index];
  if (!s)
    return errorReply(
      `There are ${sessions.length} published sessions. Pick 1–${sessions.length}.`,
    );

  const text = toDiscordMarkdown(s.text);
  const body = truncate(text, 3800, '\n\n*…continues on the site.*');
  const image = imageUrl(s.imageUrl);
  return {
    embeds: [
      {
        color: COLOR.brand,
        author: {
          name: `🎲 Session ${index + 1} of ${sessions.length}${s.date ? ` · ${s.date}` : ''}`,
        },
        title: truncate(s.name, 256),
        url: siteUrl('session'),
        ...(body ? { description: body } : {}),
        ...(image ? { image: { url: image } } : {}),
      },
    ],
    components: [linkButton('Read on site', siteUrl('session'))],
  };
}

/** The last N timeline events players know about, oldest first. */
export async function timelineReply(count: number): Promise<BotReply> {
  const events = (await visibleOf('timeline')).slice(-count);
  if (!events.length) return errorReply('The timeline is still empty.');
  const lines = events.map((e) => {
    const text = truncate(toDiscordMarkdown(e.text).replace(/\s*\n+\s*/g, ' '), 220);
    return `**${e.date ?? '—'}** · **${e.name}**${text ? `\n${text}` : ''}`;
  });
  return {
    embeds: [
      {
        color: COLOR.brand,
        author: { name: '⏳ Timeline' },
        title: `Last ${events.length} event${events.length === 1 ? '' : 's'}`,
        url: siteUrl('timeline'),
        description: truncate(lines.join('\n\n'), 4000),
      },
    ],
    components: [linkButton('Full timeline', siteUrl('timeline'))],
  };
}
