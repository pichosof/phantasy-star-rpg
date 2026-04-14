export interface MonsterProps {
  id?: number;
  name: string;
  type?: string | null;
  habitat?: string | null;
  weaknesses?: string | null;
  description?: string | null;
  discovered?: boolean;
  imageUrl?: string | null;
  imageAlt?: string | null;
  imageMime?: string | null;
  imageSize?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}
export class Monster {
  private constructor(readonly props: MonsterProps) {}
  toJSON() {
    return this.props;
  }
  static create(p: Omit<MonsterProps, 'id' | 'createdAt'>) {
    if (!p.name?.trim()) throw new Error('Name required');
    return new Monster({ discovered: false, ...p });
  }
  static rehydrate(p: MonsterProps) {
    return new Monster(p);
  }
}
