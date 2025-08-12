export class UnlinkLoreFromCity {
  constructor(
    private links: { unlinkLoreFromCity(loreId: number, cityId: number): Promise<void> },
  ) {}
  execute(loreId: number, cityId: number) {
    return this.links.unlinkLoreFromCity(loreId, cityId);
  }
}
