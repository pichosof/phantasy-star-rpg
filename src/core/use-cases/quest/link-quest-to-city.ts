export class LinkQuestToCity {
  constructor(private links: { linkQuestToCity(questId: number, cityId: number): Promise<void> }) {}
  execute(questId: number, cityId: number) {
    return this.links.linkQuestToCity(questId, cityId);
  }
}
