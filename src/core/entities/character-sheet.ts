export type CharacterSheetType = 'gurps' | 'starfinder';

export interface CharacterSheetProps {
  id?: number;
  type: CharacterSheetType;
  name: string;
  data: Record<string, unknown>;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

export class CharacterSheet {
  private constructor(readonly props: CharacterSheetProps) {}

  toJSON() { return this.props; }

  static create(props: Omit<CharacterSheetProps, 'id' | 'createdAt' | 'updatedAt'>) {
    if (!props.name?.trim()) throw new Error('Name is required');
    if (props.type !== 'gurps' && props.type !== 'starfinder') throw new Error('Invalid type');
    return new CharacterSheet({ ...props, data: props.data ?? {} });
  }

  static rehydrate(props: CharacterSheetProps) {
    return new CharacterSheet(props);
  }
}
