import type { EntityType } from '../use-cases/links/link-text.js';

/** The GM made an entity visible to players (from the site or from the Discord bot). */
export interface EntityRevealed {
  type: EntityType;
  id: number;
}

type Listener<E> = (event: E) => void | Promise<void>;

class Channel<E> {
  private listeners = new Set<Listener<E>>();

  on(listener: Listener<E>): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: E): void {
    for (const listener of this.listeners) {
      Promise.resolve()
        .then(() => listener(event))
        .catch((err: unknown) => console.error('[entity-events] listener failed', err));
    }
  }
}

/**
 * In-process domain events. Adapters (the Discord bot) subscribe; use-cases publish.
 * Listeners run asynchronously: a failing listener never breaks the use-case that published.
 */
export class EntityEvents {
  readonly revealed = new Channel<EntityRevealed>();
  /** A combat encounter was saved (turn, HP, conditions…). */
  readonly encounterSaved = new Channel<{ id: number }>();
}

export const entityEvents = new EntityEvents();
