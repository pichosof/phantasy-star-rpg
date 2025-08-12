export class LinkLoreToCity {
  constructor(private links: { linkLoreToCity(loreId: number, cityId: number): Promise<void> }) {}
  execute(loreId: number, cityId: number) {
    return this.links.linkLoreToCity(loreId, cityId);
  }
}
