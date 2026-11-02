/** Bot state for `/api/health/discord`: a broken bot must be visible, not silently absent. */
export type BotState = 'off' | 'starting' | 'ready' | 'error';

export const botStatus: { state: BotState; error: string | null; since: Date } = {
  state: 'off',
  error: null,
  since: new Date(),
};

export function setBotStatus(state: BotState, error?: unknown) {
  botStatus.state = state;
  botStatus.error =
    error === undefined ? null : error instanceof Error ? error.message : String(error);
  botStatus.since = new Date();
}
