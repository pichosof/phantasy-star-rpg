export interface WikiPageProps {
  id?: number;
  title: string;
  category?: string | null;
  content?: string | null;
  pinned?: boolean;
  visible?: boolean;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

export class WikiPage {
  private constructor(readonly props: WikiPageProps) {}

  static create(p: Omit<WikiPageProps, 'id' | 'createdAt' | 'updatedAt'>) {
    if (!p.title?.trim()) throw new Error('Title required');
    return new WikiPage({ ...p, pinned: p.pinned ?? false, visible: p.visible ?? true });
  }

  static rehydrate(p: WikiPageProps) {
    return new WikiPage(p);
  }

  toJSON() {
    return this.props;
  }
}
