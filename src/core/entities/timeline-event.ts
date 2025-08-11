export interface TimelineEventProps {
  id?: number;
  title: string;
  date: string;
  description?: string | null;
  createdAt?: Date;
}
export class TimelineEvent {
  private constructor(readonly props: TimelineEventProps) {}
  static create(p: Omit<TimelineEventProps, 'id' | 'createdAt'>) {
    if (!p.title?.trim()) throw new Error('Title required');
    if (!p.date?.trim()) throw new Error('Date required');
    return new TimelineEvent(p);
  }
  static rehydrate(p: TimelineEventProps) {
    return new TimelineEvent(p);
  }
}
