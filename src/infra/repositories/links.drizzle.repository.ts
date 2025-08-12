import { eq, and } from 'drizzle-orm';

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
}
