export interface GmNoteProps {
  id?: number;
  title: string;
  content?: string | null;
  tags?: string | null; // comma-separated
  pinned?: boolean;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

export class GmNote {
  private constructor(readonly props: GmNoteProps) {}

  toJSON() {
    return this.props;
  }

  static create(props: Omit<GmNoteProps, 'id' | 'createdAt' | 'updatedAt'>) {
    if (!props.title?.trim()) throw new Error('Title is required');
    return new GmNote({ pinned: false, ...props });
  }

  static rehydrate(props: GmNoteProps) {
    return new GmNote(props);
  }
}
