import { eq, and, or, isNull } from 'drizzle-orm';

import { db } from '../db/index.js';
import * as s from '../db/schema';

export class LinksDrizzleRepository {
  // Player ↔ Quest
  async assignQuestToPlayer(playerId: number, questId: number) {
    await db.insert(s.playerQuests).values({ playerId, questId }).onConflictDoNothing();
  }
  async setPlayerQuestStatus(
    playerId: number,
    questId: number,
    status: 'assigned' | 'completed' | 'failed',
  ) {
    await db
      .update(s.playerQuests)
      .set({ status, completedAt: status === 'completed' ? new Date() : null })
      .where(and(eq(s.playerQuests.playerId, playerId), eq(s.playerQuests.questId, questId)));
  }

  // Quest ↔ City
  async linkQuestToCity(questId: number, cityId: number) {
    await db.insert(s.questCities).values({ questId, cityId }).onConflictDoNothing();
  }
  async unlinkQuestFromCity(questId: number, cityId: number) {
    await db
      .delete(s.questCities)
      .where(and(eq(s.questCities.questId, questId), eq(s.questCities.cityId, cityId)));
  }
  

  // Lore ↔ City
  async linkLoreToCity(loreId: number, cityId: number) {
    await db.insert(s.loreCities).values({ loreId, cityId }).onConflictDoNothing();
  }
  async unlinkLoreFromCity(loreId: number, cityId: number) {
    await db
      .delete(s.loreCities)
      .where(and(eq(s.loreCities.loreId, loreId), eq(s.loreCities.cityId, cityId)));
  }

async listQuestsByCityId(cityId: number, opts?: { includeHidden?: boolean }) {
  const includeHidden = Boolean(opts?.includeHidden);

  const visiblePredicate = or(isNull(s.quests.visible), eq(s.quests.visible, true));

  const rows = await db
    .select({ quest: s.quests })
    .from(s.questCities)
    .innerJoin(s.quests, eq(s.questCities.questId, s.quests.id))
    .where(
      includeHidden
        ? eq(s.questCities.cityId, cityId)
        : and(eq(s.questCities.cityId, cityId), visiblePredicate),
    );

  return rows.map((r) => r.quest);
}


async listLoresByCityId(cityId: number, opts?: { includeHidden?: boolean }) {
  const includeHidden = Boolean(opts?.includeHidden);

  const visiblePredicate = or(isNull(s.lores.visible), eq(s.lores.visible, true));

  const rows = await db
    .select({ lore: s.lores })
    .from(s.loreCities)
    .innerJoin(s.lores, eq(s.loreCities.loreId, s.lores.id))
    .where(
      includeHidden
        ? eq(s.loreCities.cityId, cityId)
        : and(eq(s.loreCities.cityId, cityId), visiblePredicate),
    );

  return rows.map((r) => r.lore);
}


  

}
