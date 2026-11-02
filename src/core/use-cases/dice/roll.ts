/**
 * Dice expressions for the table: `1d20+5`, `2d6-1`, `4d6kh3`, `2d20kl1 + 1d4 + 2`.
 * Pure (the random source is injectable) so it is reusable by any adapter and testable.
 */
import { randomInt } from 'node:crypto';

export interface DieTerm {
  kind: 'dice';
  sign: 1 | -1;
  count: number;
  sides: number;
  /** Keep the highest/lowest N dice. */
  keep?: { mode: 'h' | 'l'; n: number };
}
export interface ConstTerm {
  kind: 'const';
  sign: 1 | -1;
  value: number;
}
export type Term = DieTerm | ConstTerm;

export interface RolledTerm {
  term: Term;
  /** Every die rolled, in order (empty for constants). */
  dice: { value: number; kept: boolean }[];
  /** Signed subtotal of the term. */
  subtotal: number;
}

export interface RollResult {
  expression: string;
  terms: RolledTerm[];
  total: number;
  /** Set when the roll has exactly one kept d20: natural 20 / natural 1. */
  natural?: 'crit' | 'fumble';
}

export class DiceExpressionError extends Error {
  readonly statusCode = 400;
}

export const DICE_LIMITS = { length: 100, terms: 20, dice: 100, sides: 1000, constant: 10_000 };

const TERM = /^(\d*)d(\d+)(?:k([hl])(\d+))?$|^(\d+)$/;

/** Parses `2d6+1d4-2` into signed terms. Whitespace is ignored; `D` and `d` are equivalent. */
export function parseDice(expression: string): Term[] {
  const src = expression.replace(/\s+/g, '').toLowerCase();
  if (!src) throw new DiceExpressionError('Empty dice expression.');
  if (src.length > DICE_LIMITS.length) throw new DiceExpressionError('Dice expression too long.');

  const parts = src.match(/[+-]?[^+-]+/g);
  if (!parts || parts.join('') !== src)
    throw new DiceExpressionError(`Invalid dice: ${expression}`);
  if (parts.length > DICE_LIMITS.terms) throw new DiceExpressionError('Too many terms.');

  let dice = 0;
  return parts.map((part) => {
    const sign: 1 | -1 = part.startsWith('-') ? -1 : 1;
    const body = part.replace(/^[+-]/, '');
    const m = TERM.exec(body);
    if (!m) throw new DiceExpressionError(`Invalid term: ${body}`);
    if (m[5] !== undefined) {
      const value = Number(m[5]);
      if (value > DICE_LIMITS.constant)
        throw new DiceExpressionError(`Modifier too large: ${value}`);
      return { kind: 'const', sign, value };
    }
    const count = m[1] ? Number(m[1]) : 1;
    const sides = Number(m[2]);
    if (count < 1) throw new DiceExpressionError(`Roll at least one die: ${body}`);
    if (sides < 2 || sides > DICE_LIMITS.sides)
      throw new DiceExpressionError(`Dice must have 2 to ${DICE_LIMITS.sides} sides: ${body}`);
    dice += count;
    if (dice > DICE_LIMITS.dice)
      throw new DiceExpressionError(`At most ${DICE_LIMITS.dice} dice per roll.`);
    const term: DieTerm = { kind: 'dice', sign, count, sides };
    if (m[3]) {
      const n = Number(m[4]);
      if (n < 1 || n > count)
        throw new DiceExpressionError(`Keep between 1 and ${count} dice: ${body}`);
      term.keep = { mode: m[3] as 'h' | 'l', n };
    }
    return term;
  });
}

/** Canonical text of the parsed terms (`1d20 + 5`). */
export function formatDice(terms: Term[]): string {
  return terms
    .map((t, i) => {
      const body =
        t.kind === 'const'
          ? String(t.value)
          : `${t.count}d${t.sides}${t.keep ? `k${t.keep.mode}${t.keep.n}` : ''}`;
      if (i === 0) return t.sign < 0 ? `-${body}` : body;
      return `${t.sign < 0 ? '-' : '+'} ${body}`;
    })
    .join(' ');
}

export type RandomInt = (sides: number) => number;
/** Uniform 1..sides from the OS CSPRNG (no modulo bias). */
export const fairDie: RandomInt = (sides) => randomInt(1, sides + 1);

export function rollDice(expression: string, random: RandomInt = fairDie): RollResult {
  const terms = parseDice(expression);
  const rolled: RolledTerm[] = terms.map((term) => {
    if (term.kind === 'const') return { term, dice: [], subtotal: term.sign * term.value };
    const values = Array.from({ length: term.count }, () => random(term.sides));
    const kept = new Set<number>();
    if (term.keep) {
      const order = values
        .map((v, i) => ({ v, i }))
        .sort((a, b) => (term.keep!.mode === 'h' ? b.v - a.v : a.v - b.v) || a.i - b.i);
      order.slice(0, term.keep.n).forEach(({ i }) => kept.add(i));
    } else values.forEach((_, i) => kept.add(i));
    const dice = values.map((value, i) => ({ value, kept: kept.has(i) }));
    const sum = dice.filter((d) => d.kept).reduce((s, d) => s + d.value, 0);
    return { term, dice, subtotal: term.sign * sum };
  });

  const d20s = rolled.flatMap((r) =>
    r.term.kind === 'dice' && r.term.sides === 20 ? r.dice.filter((d) => d.kept) : [],
  );
  const natural =
    d20s.length === 1
      ? d20s[0].value === 20
        ? 'crit'
        : d20s[0].value === 1
          ? 'fumble'
          : undefined
      : undefined;

  return {
    expression: formatDice(terms),
    terms: rolled,
    total: rolled.reduce((s, r) => s + r.subtotal, 0),
    ...(natural ? { natural } : {}),
  };
}
