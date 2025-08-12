export class UnlinkQuestFromCity {
  constructor(
    private links: { unlinkQuestFromCity(questId: number, cityId: number): Promise<void> },
  ) {}
  execute(questId: number, cityId: number) {
    return this.links.unlinkQuestFromCity(questId, cityId);
  }
}
