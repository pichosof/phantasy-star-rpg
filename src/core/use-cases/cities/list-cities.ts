import type { CityDrizzleRepository } from '../../../infra/repositories/city.drizzle.repository';
export class ListCities {
  constructor(private repo: CityDrizzleRepository) {}
  async execute() {
    return this.repo.list();
  }
}
