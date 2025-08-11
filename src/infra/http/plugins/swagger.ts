// src/infra/http/plugins/swagger.ts
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import fp from 'fastify-plugin';
import { jsonSchemaTransform } from 'fastify-type-provider-zod';

export default fp(async (app) => {
  await app.register(swagger, {
    openapi: {
      info: { title: 'Phantasy Star RPG API', version: '1.0.0' },
      components: {
        securitySchemes: {
          ApiKeyAuth: { type: 'apiKey', in: 'header', name: 'x-api-key' },
        },
      },
    },
    transform: jsonSchemaTransform,
  });

  await app.register(swaggerUI, {
    routePrefix: '/docs',
    staticCSP: {
      // permite os assets do UI e o script inline que ele injeta
      'default-src': ["'self'"],
      'style-src': ["'self'", "'unsafe-inline'"],
      'script-src': ["'self'", "'unsafe-inline'"],
      'img-src': ["'self'", 'data:'],
      'font-src': ["'self'"],
      'connect-src': ["'self'"],
    },
    uiConfig: { docExpansion: 'list', deepLinking: false },
  });
});
