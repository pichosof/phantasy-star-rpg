export interface CityProps {
  id?: number;
  name: string;
  region?: string | null;
  description?: string | null;
  discovered?: boolean;
  createdAt?: Date;
}
export class City {
  private constructor(readonly props: CityProps) {}
  static create(p: Omit<CityProps, 'id' | 'createdAt'>) {
    if (!p.name?.trim()) throw new Error('Name required');
    return new City({ discovered: false, ...p });
  }
  static rehydrate(p: CityProps) {
    return new City(p);
  }
}
