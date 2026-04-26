export interface GmImageProps {
  id?: number;
  filename: string;
  url: string;
  alt?: string | null;
  mime: string;
  size: number;
  createdAt?: Date | null;
}

export class GmImage {
  private constructor(readonly props: GmImageProps) {}

  toJSON() {
    return this.props;
  }

  static create(props: Omit<GmImageProps, 'id' | 'createdAt'>) {
    if (!props.url) throw new Error('URL is required');
    return new GmImage(props);
  }

  static rehydrate(props: GmImageProps) {
    return new GmImage(props);
  }
}
