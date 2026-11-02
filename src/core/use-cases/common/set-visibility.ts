import type { EntityEvents } from '../../events/entity-events.js';
import type { EntityType } from '../links/link-text.js';

export interface HasSetVisibility {
  setVisibility(id: number, visible: boolean): Promise<void>;
}

export class SetVisibility {
  /** With `reveal`, making an entity visible publishes an EntityRevealed event. */
  constructor(
    private repo: HasSetVisibility,
    private reveal?: { type: EntityType; events: EntityEvents },
  ) {}

  async execute(id: number, visible: boolean) {
    await this.repo.setVisibility(id, visible);
    if (visible && this.reveal) this.reveal.events.revealed.emit({ type: this.reveal.type, id });
  }
}
