import type { FastifyInstance } from 'fastify';

import { createPlayerInput } from '../../../core/use-cases/player/create-player'; // Zod já existe
import { PlayerController } from '../controllers/player.controller';
import { created, ok, PlayerModel, PlayersModel } from '../schemas';
// se usar withGM:
export async function playerRoutes(app: FastifyInstance) {
  const ctrl = new PlayerController();

  app.get(
    '/api/players',
    {
      schema: {
        tags: ['Players'],
        response: ok(PlayersModel),
      },
    },
    ctrl.list.bind(ctrl),
  );

  app.post(
    '/api/players',
    app.withGM({
      schema: {
        tags: ['Players'],
        body: createPlayerInput, // Zod de ENTRADA
        response: created(PlayerModel), // Zod de SAÍDA
      },
    }),
    ctrl.create.bind(ctrl),
  );
}
