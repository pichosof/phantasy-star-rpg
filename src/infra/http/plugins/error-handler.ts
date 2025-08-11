import { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';

export async function errorHandlerPlugin(app: FastifyInstance) {
  app.setErrorHandler((err, req, reply) => {
    // Zod
    if (err instanceof ZodError) {
      const issues = err.issues.map((i) => ({
        path: i.path.join('.'),
        code: i.code,
        message: i.message,
      }));
      app.log.warn({ issues }, 'Validation error');
      return reply.status(400).send({
        error: 'ValidationError',
        issues,
      });
    }

    // Fastify schema validation
    if ((err as any).validation) {
      const issues = (err as any).validation.map((v: any) => ({
        path: v.instancePath || v.dataPath || '',
        message: v.message,
      }));
      app.log.warn({ issues }, 'Schema validation error');
      return reply.status(400).send({ error: 'SchemaValidationError', issues });
    }

    const status = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;
    app.log.error({ err }, 'Unhandled error');
    reply.status(status).send({
      error: err.name || 'Error',
      message: envSafeMessage(err, process.env.NODE_ENV),
    });
  });
}

function envSafeMessage(err: Error, nodeEnv?: string) {
  if (nodeEnv === 'production') return 'Internal server error';
  return err.message;
}
