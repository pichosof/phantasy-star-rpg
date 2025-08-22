export interface PlayerProps {
  id?: number;
  name: string;
  level: number;
  background?: string | null;
  imageUrl?: string | null;
  imageAlt?: string | null;
  imageMime?: string | null; 
  sheetUrl?: string | null;
  sheetMime?: string | null;
  sheetSize?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Player {
  readonly id?: number;
  readonly name: string;
  readonly level: number;
  readonly background?: string | null;
  readonly imageUrl?: string | null;
  readonly imageAlt?: string | null;
  readonly imageMime?: string | null; 
  readonly sheetUrl?: string | null;
  readonly sheetMime?: string | null;
  readonly sheetSize?: string | null;
  readonly createdAt?: Date;
  readonly updatedAt?: Date;

  private constructor(props: PlayerProps) {
    this.id = props.id;
    this.name = props.name;
    this.level = props.level ?? 1;
    this.background = props.background ?? null;
    this.imageUrl = props.imageUrl ?? null;
    this.imageAlt = props.imageAlt ?? null;
    this.imageMime = props.imageMime ?? null;
    this.sheetUrl = props.sheetUrl ?? null;
    this.sheetMime = props.sheetMime ?? null;
    this.sheetSize = props.sheetSize ?? null;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: Omit<PlayerProps, 'id' | 'createdAt' | 'updatedAt'>) {
    if (!props.name?.trim()) throw new Error('Name is required');
    const level = props.level ?? 1;
    if (level < 1) throw new Error('Level must be >= 1');
    return new Player({ ...props, level });
  }

  static rehydrate(props: PlayerProps) {
    return new Player(props);
  }
}
