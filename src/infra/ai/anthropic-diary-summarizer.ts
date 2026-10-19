import type { DiarySummarizer } from '../../core/use-cases/session-diary/session-diary.js';
import { env } from '../config/env.js';

const SYSTEM = `You write session diaries for a tabletop RPG campaign (Phantasy Star setting, Starfinder rules).
The game master gives you loose notes taken during or after a session. Turn them into a clear, readable session summary in Markdown.

Rules:
- Write in the same language as the notes.
- Only use facts present in the notes. Never invent events, names, outcomes or motives. If something is unclear, keep it vague rather than guessing.
- When the notes mention an entity from the provided list, write it as a wiki link exactly as listed: [[Name]]. Link each entity at most once per section. Do not link names that are not in the list.
- Structure: a short opening paragraph (2-3 sentences), then "##" sections with headings in the notes' language for: what happened (chronological bullets), people and places involved, and open threads / hooks for next session. Omit a section if the notes have nothing for it.
- Keep it concise: usually 150-400 words.
- Output only the Markdown, with no preamble or closing remarks.`;

/** Session diary summaries through the Anthropic Messages API (server-side key). */
export class AnthropicDiarySummarizer implements DiarySummarizer {
  get enabled() {
    return Boolean(env.ANTHROPIC_API_KEY);
  }

  async summarize({
    sessionTitle,
    notes,
    names,
  }: {
    sessionTitle: string;
    notes: string;
    names: string[];
  }) {
    const user = [
      `Session: ${sessionTitle}`,
      '',
      'Entities that can be linked (one per line):',
      names.join('\n') || '(none)',
      '',
      'GM notes:',
      '<notes>',
      notes,
      '</notes>',
    ].join('\n');

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: env.ANTHROPIC_MODEL,
        max_tokens: 2000,
        system: SYSTEM,
        messages: [{ role: 'user', content: user }],
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      const err = new Error(`AI request failed (${res.status}): ${detail}`) as Error & {
        statusCode: number;
      };
      err.statusCode = 502;
      throw err;
    }
    const body = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const text = (body.content ?? [])
      .filter((c) => c.type === 'text')
      .map((c) => c.text ?? '')
      .join('')
      .trim();
    if (!text) {
      const err = new Error('AI returned an empty summary') as Error & { statusCode: number };
      err.statusCode = 502;
      throw err;
    }
    return text;
  }
}
