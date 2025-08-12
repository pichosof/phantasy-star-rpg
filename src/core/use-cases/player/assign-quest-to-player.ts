export class AssignQuestToPlayer {
  constructor(
    private links: { assignQuestToPlayer(playerId: number, questId: number): Promise<void> },
  ) {}
  execute(playerId: number, questId: number) {
    return this.links.assignQuestToPlayer(playerId, questId);
  }
}
