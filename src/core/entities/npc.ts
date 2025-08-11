export interface NpcProps {
  id?: number;
  name: string;
  role?: string | null;
  description?: string | null;
  location?: string | null;
  imageUrl?: string | null;
  imageAlt?: string | null;
  imageMime?: string | null;
  imageSize?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Npc {
  readonly id?: number;
  readonly name: string;
  readonly role?: string | null;
  readonly description?: string | null;
  readonly location?: string | null;
  readonly imageUrl?: string | null;
  readonly imageAlt?: string | null;
  readonly imageMime?: string | null;
  readonly imageSize?: number | null;
  readonly createdAt?: Date;
  readonly updatedAt?: Date;

  private constructor(props: NpcProps) {
    this.id = props.id;
    this.name = props.name; // <- obrigatório, satisfaz o TS
    this.role = props.role ?? null;
    this.description = props.description ?? null;
    this.location = props.location ?? null;
    this.imageUrl = props.imageUrl ?? null;
    this.imageAlt = props.imageAlt ?? null;
    this.imageMime = props.imageMime ?? null;
    this.imageSize = props.imageSize ?? null;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: Omit<NpcProps, 'id' | 'createdAt' | 'updatedAt'>) {
    if (!props.name?.trim()) throw new Error('Name is required');
    return new Npc(props);
  }

  static rehydrate(props: NpcProps) {
    return new Npc(props);
  }
}
