export interface SessionProps {
  id?: number;
  title: string;
  date: string; // ISO ou in-game
  summary?: string | null;
  imageUrl?: string | null;
  imageAlt?: string | null;
  visible?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
export class Session {
  private constructor(readonly props: SessionProps) {}
  static create(p: Omit<SessionProps, 'id' | 'createdAt'>) {
    if (!p.title?.trim()) throw new Error('Title required');
    if (!p.date?.trim()) throw new Error('Date required');
    return new Session(p);
  }
  static rehydrate(p: SessionProps) {
    return new Session(p);
  }
  get id() {
    return this.props.id;
  }
  get title() {
    return this.props.title;
  }
  get date() {
    return this.props.date;
  }
  get summary() {
    return this.props.summary;
  }
  get imageUrl() {
    return this.props.imageUrl;
  }
  get imageAlt() {
    return this.props.imageAlt;
  }
  get visible() {
    return this.props.visible;
  }
  get createdAt() {
    return this.props.createdAt;
  }
  get updatedAt() {
    return this.props.updatedAt;
  }
}
