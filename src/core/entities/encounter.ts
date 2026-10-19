export type EncounterStatus = 'active' | 'ended';

export interface EncounterProps {
  id?: number;
  name: string;
  sessionId?: number | null;
  status: EncounterStatus;
  /** EncounterState (see use-cases/encounters/encounter-state.ts), kept opaque here. */
  state: unknown;
  version: number;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

export class Encounter {
  private constructor(readonly props: EncounterProps) {}

  toJSON() {
    return this.props;
  }

  static create(props: Pick<EncounterProps, 'name' | 'sessionId' | 'state'>) {
    if (!props.name?.trim()) throw new Error('Name is required');
    return new Encounter({ ...props, name: props.name.trim(), status: 'active', version: 1 });
  }

  static rehydrate(props: EncounterProps) {
    return new Encounter(props);
  }
}
