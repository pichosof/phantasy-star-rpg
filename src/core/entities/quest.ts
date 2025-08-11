export interface QuestProps {
  id?: number;
  title: string;
  status?: 'active' | 'completed' | 'failed';
  description?: string | null;
  reward?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Quest {
  readonly id?: number;
  readonly title: string;
  readonly status: 'active' | 'completed' | 'failed';
  readonly description?: string | null;
  readonly reward?: string | null;
  readonly createdAt?: Date;
  readonly updatedAt?: Date;

  private constructor(props: QuestProps) {
    this.id = props.id;
    this.title = props.title;
    this.status = props.status ?? 'active';
    this.description = props.description ?? null;
    this.reward = props.reward ?? null;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: Omit<QuestProps, 'id' | 'createdAt' | 'updatedAt'>) {
    if (!props.title?.trim()) throw new Error('Title is required');
    return new Quest(props);
  }

  static rehydrate(props: QuestProps) {
    return new Quest(props);
  }
}
