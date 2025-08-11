export interface PlayerProps {
  id?: number;
  name: string;
  level: number;
  background?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Player {
  readonly id?: number;
  readonly name: string;
  readonly level: number;
  readonly background?: string | null;
  readonly createdAt?: Date;
  readonly updatedAt?: Date;

  private constructor(props: PlayerProps) {
    this.id = props.id;
    this.name = props.name;
    this.level = props.level ?? 1;
    this.background = props.background ?? null;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: Omit<PlayerProps, "id" | "createdAt" | "updatedAt">) {
    if (!props.name?.trim()) throw new Error("Name is required");
    const level = props.level ?? 1;
    if (level < 1) throw new Error("Level must be >= 1");
    return new Player({ ...props, level });
  }

  static rehydrate(props: PlayerProps) {
    return new Player(props);
  }
}
