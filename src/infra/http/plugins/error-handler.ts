import type { FastifyInstance, FastifyError } from 'fastify';
import { ZodError } from 'zod';

type AjvIssue = { instancePath?: string; dataPath?: string; message?: string };

function hasValidation(err: unknown): err is FastifyError & { validation: AjvIssue[] } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'validation' in (err as Record<string, unknown>) &&
    Array.isArray((err as { validation?: unknown }).validation)
  );
}

export async function errorHandlerPlugin(app: FastifyInstance) {
  app.setErrorHandler((err, _req, reply) => {
    // Zod
    if (err instanceof ZodError) {
      const issues = err.issues.map((i) => ({
        path: i.path.join('.'),
        code: i.code,
        message: i.message,
      }));
      app.log.warn({ issues }, 'Validation error');
      return reply.status(400).send({ error: 'ValidationError', issues });
    }

    // Fastify (AJV) schema validation
    if (hasValidation(err)) {
      const issues = err.validation.map((v) => ({
        path: v.instancePath || '',
        message: v.message ?? 'Invalid value',
      }));
      app.log.warn({ issues }, 'Schema validation error');
      return reply.status(400).send({ error: 'SchemaValidationError', issues });
    }

    const status = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;
    app.log.error({ err }, 'Unhandled error');
    return reply.status(status).send({
      error: err.name || 'Error',
      message: envSafeMessage(err, process.env.NODE_ENV),
    });
  });
}

function envSafeMessage(err: Error, nodeEnv?: string) {
  return nodeEnv === 'production' ? 'Internal server error' : err.message;
}
