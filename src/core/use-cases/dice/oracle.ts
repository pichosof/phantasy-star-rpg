import { fairDie, type RandomInt } from './roll.js';

/**
 * Yes/no oracle for questions nobody prepared an answer for ("Is the guard awake?").
 * d100 against the odds; rolls close to the edges add "and"/"but", doubles add a twist.
 */
export const ORACLE_ODDS = {
  certain: 90,
  likely: 70,
  even: 50,
  unlikely: 30,
  impossible: 10,
} as const;
export type OracleOdds = keyof typeof ORACLE_ODDS;

export interface OracleResult {
  odds: OracleOdds;
  roll: number;
  answer: 'Yes' | 'No';
  /** "and" = stronger than asked, "but" = with a catch. */
  degree: 'and' | 'but' | null;
  /** Doubles (11, 22 … 99, 100): something unexpected also happens. */
  twist: boolean;
}

export function askOracle(odds: OracleOdds = 'even', random: RandomInt = fairDie): OracleResult {
  const chance = ORACLE_ODDS[odds];
  const roll = random(100);
  const yes = roll <= chance;
  const band = Math.max(5, Math.round(chance / 5));
  // Low rolls are strong yes ("and"); a yes close to the threshold comes with a catch.
  let degree: OracleResult['degree'] = null;
  if (yes) degree = roll <= band ? 'and' : roll > chance - band ? 'but' : null;
  else
    degree =
      roll > 100 - Math.round((100 - chance) / 5) ? 'and' : roll <= chance + band ? 'but' : null;
  const twist = roll === 100 || (roll > 10 && roll % 11 === 0);
  return { odds, roll, answer: yes ? 'Yes' : 'No', degree, twist };
}
