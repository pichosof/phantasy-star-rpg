export interface SessionProps {
  id?: number;
  title: string;
  date: string; // ISO ou in-game
  summary?: string | null;
  createdAt?: Date;
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
  get createdAt() {
    return this.props.createdAt;
  }
}
