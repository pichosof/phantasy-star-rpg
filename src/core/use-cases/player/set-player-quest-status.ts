export class SetPlayerQuestStatus {
  constructor(
    private links: {
      setPlayerQuestStatus(
        playerId: number,
        questId: number,
        status: 'assigned' | 'completed' | 'failed',
      ): Promise<void>;
    },
  ) {}
  execute(playerId: number, questId: number, status: 'assigned' | 'completed' | 'failed') {
    return this.links.setPlayerQuestStatus(playerId, questId, status);
  }
}
