export class EncounterNotFoundError extends Error {
  readonly statusCode = 404;
  constructor(id: number) {
    super(`Encounter ${id} not found`);
  }
}

/** Another device saved first; the client must reload (or overwrite explicitly). */
export class EncounterConflictError extends Error {
  readonly statusCode = 409;
  constructor(readonly currentVersion: number) {
    super('The encounter was changed on another device.');
  }
}
