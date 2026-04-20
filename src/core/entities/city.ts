export interface CityImage {
  id: number;
  cityId: number;
  url: string;
  alt: string | null;
  mime: string;
  size: number;
  position: number;
  createdAt: Date;
}

export interface CityProps {
  id?: number;
  name: string;
  region?: string | null;
  description?: string | null;
  discovered?: boolean;
  imageUrl?: string | null;
  imageAlt?: string | null;
  imageMime?: string | null;
  imageSize?: number | null;
  images?: CityImage[];
  worldId?: number | null;
  coordinates?: string | null;
  visible?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
export class City {
  private constructor(readonly props: CityProps) {}
  toJSON() {
    return this.props;
  }
  static create(p: Omit<CityProps, 'id' | 'createdAt'>) {
    if (!p.name?.trim()) throw new Error('Name required');
    return new City({ discovered: false, ...p });
  }
  static rehydrate(p: CityProps) {
    return new City(p);
  }
}
