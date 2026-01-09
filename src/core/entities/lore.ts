import type { LoreCategory } from '../../infra/db/schema';

export interface LoreProps {
  id?: number;
  title: string;
  visible?: boolean| null;
  category?: LoreCategory | null; // <-- aceita null
  content?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Lore {
  private constructor(readonly props: LoreProps) {}

  static create(p: Omit<LoreProps, 'id' | 'createdAt'>) {
    if (!p.title?.trim()) throw new Error('Title required');
    return new Lore(p);
  }

  static rehydrate(p: LoreProps) {
    return new Lore(p); // agora compatível com null
  }
}
