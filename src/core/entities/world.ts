export interface WorldProps {
  id?: number;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  imageAlt?: string | null;
  imageMime?: string | null;
  imageSize?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class World {
  readonly id?: number;
  readonly name: string;
  readonly description?: string | null;
  readonly imageUrl?: string | null;
  readonly imageAlt?: string | null;
  readonly imageMime?: string | null;
  readonly imageSize?: number | null;
  readonly createdAt?: Date;
  readonly updatedAt?: Date;

  private constructor(p: WorldProps) {
    this.id = p.id;
    this.name = p.name;
    this.description = p.description ?? null;
    this.imageUrl = p.imageUrl ?? null;
    this.imageAlt = p.imageAlt ?? null;
    this.imageMime = p.imageMime ?? null;
    this.imageSize = p.imageSize ?? null;
    this.createdAt = p.createdAt;
    this.updatedAt = p.updatedAt;
  }

  static create(p: Omit<WorldProps, 'id' | 'createdAt' | 'updatedAt'>) {
    if (!p.name?.trim()) throw new Error('World name is required');
    return new World(p);
  }
  static rehydrate(p: WorldProps) {
    return new World(p);
  }
}
