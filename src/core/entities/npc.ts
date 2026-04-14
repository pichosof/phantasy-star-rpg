export interface NpcProps {
  id?: number;
  name: string;
  role?: string | null;
  description?: string | null;
  location?: string | null;
  visible?: boolean;
  imageUrl?: string | null;
  imageAlt?: string | null;
  imageMime?: string | null;
  imageSize?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Npc {
  private constructor(readonly props: NpcProps) {}

  toJSON() {
    return this.props;
  }

  static create(props: Omit<NpcProps, 'id' | 'createdAt' | 'updatedAt'>) {
    if (!props.name?.trim()) throw new Error('Name is required');
    return new Npc({ visible: false, ...props });
  }

  static rehydrate(props: NpcProps) {
    return new Npc(props);
  }
}
