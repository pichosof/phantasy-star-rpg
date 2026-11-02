import type { APIEmbed, APIEmbedField } from 'discord.js';

import {
  armorClass,
  type Bonus,
  initiativeBonus,
  parseStarfinderSheet,
  SAVES,
  type SaveKey,
  saveBonus,
  SF_SKILLS,
  SheetDataError,
  skillBonus,
  type StarfinderSheet,
  weaponRoll,
} from '../../../core/use-cases/character-sheets/starfinder.js';
import type { RandomInt } from '../../../core/use-cases/dice/roll.js';
import { rollDice } from '../../../core/use-cases/dice/roll.js';
import { DiscordLinkError } from '../../../core/use-cases/discord-links/discord-links.js';
import { normalizeName } from '../../../core/use-cases/links/link-text.js';
import { container } from '../../../di/container.js';
import { type BotReply, COLOR, errorReply, imageUrl, siteUrl, truncate } from '../format.js';

import { breakdown, rollReply } from './dice.js';

export const NOT_LINKED = 'You are not linked to a character yet. Ask the GM to run `/link`.';

interface Character {
  playerId: number;
  name: string;
  level: number;
  portrait: string | null;
  sheetName: string;
  sheet: StarfinderSheet;
}

type Loaded = { character: Character } | { error: BotReply };

const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

/** The caller's linked character and sheet, or the reason it cannot be used. */
export async function loadCharacter(discordUserId: string): Promise<Loaded> {
  const link = await container.resolve('getDiscordLink').execute(discordUserId);
  if (!link) return { error: errorReply(NOT_LINKED) };
  const [player] = await container.resolve('playerRepo').findById(link.playerId);
  if (!player) throw new Error(`Linked player ${link.playerId} does not exist`);
  if (link.sheetId === null)
    return {
      error: errorReply(`No sheet is linked to **${player.name}**. Ask the GM to \`/link\` it.`),
    };
  const sheet = await container.resolve('getCharacterSheet').execute(link.sheetId);
  if (!sheet) throw new Error(`Linked sheet ${link.sheetId} does not exist`);
  try {
    return {
      character: {
        playerId: player.id,
        name: player.name,
        level: player.level,
        portrait: player.imageUrl,
        sheetName: sheet.props.name,
        sheet: parseStarfinderSheet(sheet.props.data),
      },
    };
  } catch (e) {
    if (e instanceof SheetDataError) return { error: sheetError(sheet.props.name, e) };
    throw e;
  }
}

const sheetError = (sheetName: string, e: SheetDataError) =>
  errorReply(`**${sheetName}**: ${e.message}\nThe GM can fix it on the site (GM → Sheets).`);

/** Runs a sheet computation; a missing/unreadable field becomes a clear error reply. */
function fromSheet<T>(c: Character, compute: () => T): { value: T } | { error: BotReply } {
  try {
    return { value: compute() };
  } catch (e) {
    if (e instanceof SheetDataError) return { error: sheetError(c.sheetName, e) };
    throw e;
  }
}

/** d20 + bonus, shown with how the bonus was reached. */
function d20Reply(c: Character, bonus: Bonus, secret: boolean, random?: RandomInt): BotReply {
  const reply = rollReply(`1d20${signed(bonus.total)}`, {
    label: bonus.label,
    who: c.name,
    secret,
    random,
  });
  const embed = reply.embeds?.[0];
  if (embed) embed.footer = { text: `${bonus.label} ${signed(bonus.total)} = ${bonus.parts}` };
  return reply;
}

export async function checkReply(
  userId: string,
  skill: string,
  secret: boolean,
  random?: RandomInt,
): Promise<BotReply> {
  const loaded = await loadCharacter(userId);
  if ('error' in loaded) return loaded.error;
  const c = loaded.character;
  const bonus = fromSheet(c, () => skillBonus(c.sheet, skill));
  return 'error' in bonus ? bonus.error : d20Reply(c, bonus.value, secret, random);
}

export async function saveReply(
  userId: string,
  save: SaveKey,
  secret: boolean,
  random?: RandomInt,
): Promise<BotReply> {
  const loaded = await loadCharacter(userId);
  if ('error' in loaded) return loaded.error;
  const c = loaded.character;
  const bonus = fromSheet(c, () => saveBonus(c.sheet, save));
  return 'error' in bonus ? bonus.error : d20Reply(c, bonus.value, secret, random);
}

export async function initiativeReply(userId: string, random?: RandomInt): Promise<BotReply> {
  const loaded = await loadCharacter(userId);
  if ('error' in loaded) return loaded.error;
  const c = loaded.character;
  const bonus = fromSheet(c, () => initiativeBonus(c.sheet));
  return 'error' in bonus ? bonus.error : d20Reply(c, bonus.value, false, random);
}

/** Attack roll plus damage; a natural 20 shows the doubled damage and the critical effect. */
export async function attackReply(
  userId: string,
  weaponName: string,
  random?: RandomInt,
): Promise<BotReply> {
  const loaded = await loadCharacter(userId);
  if ('error' in loaded) return loaded.error;
  const c = loaded.character;
  const weapon = fromSheet(c, () => weaponRoll(c.sheet, weaponName));
  if ('error' in weapon) return weapon.error;
  const w = weapon.value;

  const attack = rollDice(`1d20${signed(w.attack)}`, random);
  const lines = [
    `🎯 **Attack** \`${attack.expression}\`: ${breakdown(attack)} = **${attack.total}**`,
  ];
  if (w.damage) {
    const damage = rollDice(w.damage, random);
    const type = w.damageType ? ` ${w.damageType}` : '';
    lines.push(
      `💥 **Damage** \`${damage.expression}\`: ${breakdown(damage)} = **${damage.total}**${type}`,
    );
    if (attack.natural === 'crit')
      lines.push(
        `✨ **Natural 20!** Critical if it hits: **${damage.total * 2}**${type}` +
          (w.critical ? ` + ${w.critical}` : ''),
      );
  } else lines.push('*The sheet lists no damage roll for this weapon.*');
  if (attack.natural === 'fumble') lines.push('💀 **Natural 1…**');

  return {
    embeds: [
      {
        color:
          attack.natural === 'crit'
            ? COLOR.gold
            : attack.natural === 'fumble'
              ? COLOR.danger
              : COLOR.brand,
        author: { name: `${c.name} attacks` },
        title: truncate(w.name, 256),
        description: lines.join('\n'),
      },
    ],
  };
}

/** Private character summary (the sheet is GM-only on the site; each player sees their own). */
export async function meReply(userId: string): Promise<BotReply> {
  const loaded = await loadCharacter(userId);
  if ('error' in loaded) return loaded.error;
  const c = loaded.character;
  const s = c.sheet;
  const computed = fromSheet(c, () => ({
    ac: armorClass(s),
    init: initiativeBonus(s),
    saves: (Object.keys(SAVES) as SaveKey[]).map((k) => saveBonus(s, k)),
    weapons: (s.weapons ?? []).map((w) => weaponRoll(s, w.name ?? '')),
  }));
  if ('error' in computed) return computed.error;
  const { ac, init, saves, weapons } = computed.value;

  const pool = (cur?: number, max?: number) =>
    cur === undefined || max === undefined ? 'not on the sheet' : `${cur}/${max}`;
  const fields: APIEmbedField[] = [
    {
      name: 'Stamina · HP · Resolve',
      value: `${pool(s.staminaCurrent, s.staminaTotal)} · ${pool(s.hpCurrent, s.hpTotal)} · ${pool(s.resolveCurrent, s.resolveTotal)}`,
    },
    { name: 'EAC · KAC', value: `${ac.eac} · ${ac.kac}`, inline: true },
    { name: 'Initiative', value: signed(init.total), inline: true },
    {
      name: 'Saves',
      value: saves.map((b) => `${b.label.slice(0, 4)} ${signed(b.total)}`).join(' · '),
      inline: true,
    },
  ];
  if (weapons.length)
    fields.push({
      name: 'Weapons',
      value: truncate(
        weapons
          .map(
            (w) =>
              `**${w.name}** ${signed(w.attack)}${w.damage ? ` · ${w.damage}${w.damageType ? ` ${w.damageType}` : ''}` : ''}`,
          )
          .join('\n'),
        1024,
      ),
    });
  if (s.credits !== undefined)
    fields.push({
      name: 'Credits',
      value: `${s.credits.toLocaleString('en-US')} cr`,
      inline: true,
    });
  if (s.xpEarned !== undefined)
    fields.push({
      name: 'XP',
      value: s.xpNextLevel !== undefined ? `${s.xpEarned} / ${s.xpNextLevel}` : String(s.xpEarned),
      inline: true,
    });

  const portrait = imageUrl(c.portrait);
  const embed: APIEmbed = {
    color: COLOR.brand,
    author: { name: '🛡️ Your character' },
    title: truncate(c.name, 256),
    description: [s.classLevel, s.race, s.theme].filter(Boolean).join(' · ') || undefined,
    fields,
    ...(portrait ? { thumbnail: { url: portrait } } : {}),
    footer: { text: `Sheet: ${c.sheetName}` },
  };
  return { embeds: [embed], ephemeral: true };
}

export async function progressReply(userId: string): Promise<BotReply> {
  const link = await container.resolve('getDiscordLink').execute(userId);
  if (!link) return errorReply(NOT_LINKED);
  const [player] = await container.resolve('playerRepo').findById(link.playerId);
  // Same rule as the site: players only see the progress of visible characters.
  if (!player?.visible)
    return errorReply(`**${player?.name}** is not visible to players on the site yet.`);
  const { entries, totals } = await container
    .resolve('getPlayerProgress')
    .execute(link.playerId, false);
  const lines = entries
    .slice(-10)
    .map(
      (e) =>
        `**${e.sessionTitle ?? 'Hidden session'}**${e.sessionDate ? ` *(${e.sessionDate})*` : ''}: ` +
        `${signed(e.xp)} XP · ${signed(e.credits)} cr${e.note ? ` · ${e.note}` : ''}`,
    );
  return {
    embeds: [
      {
        color: COLOR.brand,
        author: { name: '📈 Progress' },
        title: truncate(player?.name ?? 'Character', 256),
        url: siteUrl('player'),
        description: lines.length ? truncate(lines.join('\n'), 3500) : '*No rewards yet.*',
        fields: [
          { name: 'Total XP', value: String(totals.xp), inline: true },
          {
            name: 'Total credits',
            value: `${totals.credits.toLocaleString('en-US')} cr`,
            inline: true,
          },
        ],
      },
    ],
    ephemeral: true,
  };
}

export async function questsReply(userId: string): Promise<BotReply> {
  const link = await container.resolve('getDiscordLink').execute(userId);
  if (!link) return errorReply(NOT_LINKED);
  const [player] = await container.resolve('playerRepo').findById(link.playerId);
  if (!player?.visible)
    return errorReply(`**${player?.name}** is not visible to players on the site yet.`);
  const quests = await container
    .resolve('listQuestsByPlayerId')
    .execute(link.playerId, { includeHidden: false });
  const icon = (status: string) =>
    status === 'completed' ? '✅' : status === 'failed' ? '❌' : '📜';
  return {
    embeds: [
      {
        color: COLOR.brand,
        author: { name: '📜 Your quests' },
        url: siteUrl('quest'),
        description: quests.length
          ? truncate(
              quests
                .map(
                  (q) =>
                    `${icon(q.assignment)} **${q.title}**${q.assignment !== 'assigned' ? ` *(${q.assignment})*` : ''}`,
                )
                .join('\n'),
              4000,
            )
          : '*No quests assigned.*',
      },
    ],
    ephemeral: true,
  };
}

// ── Autocomplete ──────────────────────────────────────────────────────────

const matches = (query: string, label: string) => {
  const q = normalizeName(query);
  return !q || normalizeName(label).includes(q);
};

/** Skills with the caller's bonus when they have a character (and a readable sheet). */
export async function skillChoices(userId: string, query: string) {
  const loaded = await loadCharacter(userId);
  const sheet = 'character' in loaded ? loaded.character.sheet : null;
  return SF_SKILLS.filter((s) => matches(query, s.label)).map((s) => {
    let suffix = '';
    if (sheet) {
      const untrained = s.trainedOnly && (sheet.skills?.[s.key]?.ranks ?? 0) < 1;
      if (untrained) suffix = ' (trained only)';
      else {
        try {
          suffix = ` (${signed(skillBonus(sheet, s.key).total)})`;
        } catch (e) {
          if (!(e instanceof SheetDataError)) throw e;
          suffix = ' (sheet incomplete)';
        }
      }
    }
    return { name: `${s.label}${suffix}`, value: s.key };
  });
}

export async function weaponChoices(userId: string, query: string) {
  const loaded = await loadCharacter(userId);
  if ('error' in loaded) return [];
  return (loaded.character.sheet.weapons ?? [])
    .map((w) => w.name ?? '')
    .filter((name) => name && matches(query, name))
    .slice(0, 25)
    .map((name) => ({ name: name.slice(0, 100), value: name.slice(0, 100) }));
}

export async function playerChoices(query: string) {
  return (await container.resolve('listPlayers').execute())
    .filter((p) => matches(query, p.name))
    .slice(0, 25)
    .map((p) => ({ name: `${p.name} · Lv ${p.level}`.slice(0, 100), value: String(p.id) }));
}

export async function sheetChoices(query: string) {
  return (await container.resolve('listCharacterSheets').execute('starfinder'))
    .filter((s) => matches(query, s.props.name))
    .slice(0, 25)
    .map((s) => ({ name: s.props.name.slice(0, 100), value: String(s.props.id) }));
}

// ── GM: links ─────────────────────────────────────────────────────────────

const parseId = (value: string, what: string) => {
  if (!/^\d+$/.test(value.trim()))
    throw new DiscordLinkError(`Pick the ${what} from the suggestions.`);
  return Number(value.trim());
};

export async function linkReply(
  discordUserId: string,
  player: string,
  sheet: string | null,
): Promise<BotReply> {
  try {
    const link = await container.resolve('linkDiscordUser').execute({
      discordUserId,
      playerId: parseId(player, 'player'),
      sheetId: sheet === null ? null : parseId(sheet, 'sheet'),
    });
    const [p] = await container.resolve('playerRepo').findById(link.playerId);
    const s = link.sheetId
      ? await container.resolve('getCharacterSheet').execute(link.sheetId)
      : null;
    return {
      embeds: [
        {
          color: COLOR.success,
          description:
            `<@${discordUserId}> now plays **${p?.name}**` +
            (s ? ` with the sheet **${s.props.name}**.` : ' (no sheet: rolls are off).'),
        },
      ],
      ephemeral: true,
    };
  } catch (e) {
    if (e instanceof DiscordLinkError) return errorReply(e.message);
    throw e;
  }
}

export async function unlinkReply(discordUserId: string): Promise<BotReply> {
  const removed = await container.resolve('unlinkDiscordUser').execute(discordUserId);
  return removed
    ? {
        embeds: [{ color: COLOR.success, description: `<@${discordUserId}> is no longer linked.` }],
        ephemeral: true,
      }
    : errorReply(`<@${discordUserId}> was not linked.`);
}

export async function linksReply(): Promise<BotReply> {
  const links = await container.resolve('listDiscordLinks').execute();
  const players = new Map(
    (await container.resolve('listPlayers').execute()).map((p) => [p.id, p.name]),
  );
  const sheets = new Map(
    (await container.resolve('listCharacterSheets').execute()).map((s) => [
      s.props.id,
      s.props.name,
    ]),
  );
  return {
    embeds: [
      {
        color: COLOR.brand,
        author: { name: '🔗 Linked players' },
        description: links.length
          ? links
              .map(
                (l) =>
                  `<@${l.discordUserId}> → **${players.get(l.playerId)}**` +
                  (l.sheetId ? ` · sheet *${sheets.get(l.sheetId)}*` : ' · *no sheet*'),
              )
              .join('\n')
          : '*Nobody is linked yet. Use `/link`.*',
      },
    ],
    ephemeral: true,
  };
}
