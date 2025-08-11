import { FastifyInstance } from 'fastify';
import { PlayerController } from '../controllers/player.controller.js';

export async function playerRoutes(app: FastifyInstance) {
  const ctrl = new PlayerController();

  app.get('/api/players', ctrl.list.bind(ctrl));
  app.post('/api/players', ctrl.create.bind(ctrl));
}
