export class AssignCityToWorld {
  constructor(private cityRepo: { setWorld(id: number, worldId: number | null): Promise<void> }) {}
  execute(cityId: number, worldId: number) {
    return this.cityRepo.setWorld(cityId, worldId);
  }
}
