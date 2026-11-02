import { askOracle, ORACLE_ODDS, type OracleOdds } from '../../../core/use-cases/dice/oracle.js';
import {
  DiceExpressionError,
  type RandomInt,
  type RollResult,
  rollDice,
} from '../../../core/use-cases/dice/roll.js';
import { type BotReply, COLOR, errorReply } from '../format.js';

/** Button custom id prefix; the expression and label ride along (Discord caps ids at 100). */
export const REROLL_PREFIX = 'roll:';

export function rerollId(expression: string, label: string | null): string | null {
  const id = `${REROLL_PREFIX}${expression}${label ? `|${label}` : ''}`;
  return id.length <= 100 ? id : null;
}

export function parseRerollId(id: string): { expression: string; label: string | null } {
  const [expression, ...rest] = id.slice(REROLL_PREFIX.length).split('|');
  return { expression, label: rest.join('|') || null };
}

/** `[14] + 5` with dropped dice struck through and natural 20/1 bolded. */
export function breakdown(result: RollResult): string {
  return result.terms
    .map((t, i) => {
      const sign = t.term.sign < 0 ? '-' : '+';
      let body: string;
      if (t.term.kind === 'const') body = String(t.term.value);
      else {
        const sides = t.term.sides;
        const dice = t.dice.map((d) => {
          const v =
            sides === 20 && d.kept && (d.value === 20 || d.value === 1)
              ? `**${d.value}**`
              : String(d.value);
          return d.kept ? v : `~~${d.value}~~`;
        });
        body = `[${dice.join(', ')}]`;
      }
      return i === 0 ? (t.term.sign < 0 ? `-${body}` : body) : `${sign} ${body}`;
    })
    .join(' ');
}

export function rollReply(
  expression: string,
  opts: { label?: string | null; who: string; secret?: boolean; random?: RandomInt },
): BotReply {
  let result: RollResult;
  try {
    result = rollDice(expression, opts.random);
  } catch (e) {
    if (e instanceof DiceExpressionError)
      return errorReply(`${e.message}\nExamples: \`1d20+5\`, \`2d6-1\`, \`4d6kh3\`, \`2d20kl1\`.`);
    throw e;
  }

  const label = opts.label?.trim() || null;
  const natural =
    result.natural === 'crit'
      ? '\n✨ **Natural 20!**'
      : result.natural === 'fumble'
        ? '\n💀 **Natural 1…**'
        : '';
  const reroll = rerollId(result.expression, label);
  return {
    embeds: [
      {
        color:
          result.natural === 'crit'
            ? COLOR.gold
            : result.natural === 'fumble'
              ? COLOR.danger
              : COLOR.brand,
        author: {
          name: `${opts.who} rolls${label ? ` · ${label}` : ''}${opts.secret ? ' (secret)' : ''}`,
        },
        description: `🎲 \`${result.expression}\`\n${breakdown(result)} = **${result.total}**${natural}`,
      },
    ],
    // A secret roll keeps no button: the reroll would land in the channel.
    components:
      reroll && !opts.secret
        ? [
            {
              type: 1,
              components: [
                {
                  type: 2,
                  style: 2,
                  label: 'Roll again',
                  emoji: { name: '🎲' },
                  custom_id: reroll,
                },
              ],
            },
          ]
        : [],
    ephemeral: opts.secret ?? false,
  };
}

export const ORACLE_CHOICES = (Object.keys(ORACLE_ODDS) as OracleOdds[]).map((k) => ({
  name: `${k[0].toUpperCase()}${k.slice(1)} (${ORACLE_ODDS[k]}%)`,
  value: k,
}));

export function oracleReply(
  question: string,
  odds: OracleOdds,
  who: string,
  random?: RandomInt,
): BotReply {
  const r = askOracle(odds, random);
  const answer = `${r.answer}${r.degree ? `, ${r.degree}…` : '.'}`;
  return {
    embeds: [
      {
        color: r.answer === 'Yes' ? COLOR.success : COLOR.danger,
        author: { name: `${who} asks the oracle` },
        title: `🔮 ${question}`.slice(0, 256),
        description: `**${answer}**${r.twist ? '\n⚡ *Something unexpected also happens.*' : ''}`,
        footer: { text: `Odds: ${odds} (${ORACLE_ODDS[odds]}%) · d100 = ${r.roll}` },
      },
    ],
  };
}
