export class RemoveCityFromWorld {
  constructor(private cityRepo: { setWorld(id: number, worldId: number | null): Promise<void> }) {}
  execute(cityId: number) {
    return this.cityRepo.setWorld(cityId, null);
  }
}
