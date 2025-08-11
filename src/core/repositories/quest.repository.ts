import { Quest } from '../entities/quest';

export interface IQuestRepository {
  create(quest: Quest): Promise<Quest>;
  list(): Promise<Quest[]>;
  complete(id: number): Promise<void>;
}
