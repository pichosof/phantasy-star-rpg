export interface LibraryDocumentProps {
  id?: number;
  title: string;
  description?: string | null;
  category?: string | null;
  filename: string;
  originalName: string;
  url: string;
  mime: string;
  size: number;
  visible?: boolean;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

export class LibraryDocument {
  private constructor(readonly props: LibraryDocumentProps) {}

  toJSON() { return this.props; }

  static create(props: Omit<LibraryDocumentProps, 'id' | 'createdAt' | 'updatedAt'>) {
    if (!props.title?.trim()) throw new Error('Title is required');
    if (!props.url) throw new Error('URL is required');
    return new LibraryDocument({ ...props, visible: props.visible ?? true });
  }

  static rehydrate(props: LibraryDocumentProps) {
    return new LibraryDocument(props);
  }
}
