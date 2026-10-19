import type { FastifyInstance, FastifyError } from 'fastify';
import fp from 'fastify-plugin';
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

function isFastifyError(err: unknown): err is FastifyError {
  return err instanceof Error;
}

/**
 * Global error → JSON mapper. Wrapped in fastify-plugin so it applies to every route
 * (a plain `register` would scope it to this plugin only).
 *
 * Every response keeps Fastify's shape `{ statusCode, error, message }`, which the
 * frontend reads (`apiErrorMessage`); validation errors add an `issues` array.
 */
export const errorHandlerPlugin = fp(async (app: FastifyInstance) => {
  app.setErrorHandler((err: unknown, _req, reply) => {
    // Zod (use-case / controller validation)
    if (err instanceof ZodError) {
      const issues = err.issues.map((i) => ({
        path: i.path.join('.'),
        code: i.code,
        message: i.message,
      }));
      app.log.warn({ issues }, 'Validation error');
      const message = issues
        .map((i) => (i.path ? `${i.path}: ${i.message}` : i.message))
        .join('; ');
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message, issues });
    }

    // Fastify (AJV) schema validation: keep Fastify's own message
    if (hasValidation(err)) {
      const issues = err.validation.map((v) => ({
        path: v.instancePath || '',
        message: v.message ?? 'Invalid value',
      }));
      app.log.warn({ issues }, 'Schema validation error');
      return reply
        .status(400)
        .send({ statusCode: 400, error: 'Bad Request', message: err.message, issues });
    }

    if (isFastifyError(err)) {
      const status = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;
      if (status >= 500) app.log.error({ err }, 'Unhandled error');
      else app.log.warn({ err: err.message, status }, 'Request error');
      return reply.status(status).send({
        statusCode: status,
        error: err.name || 'Error',
        message: envSafeMessage(err, status, process.env.NODE_ENV),
      });
    }

    app.log.error({ err }, 'Unhandled non-Error throw');
    return reply
      .status(500)
      .send({ statusCode: 500, error: 'Error', message: 'Internal server error' });
  });
});

/** 4xx messages are meant for the client; 5xx details stay in the logs in production. */
function envSafeMessage(err: Error, status: number, nodeEnv?: string) {
  return nodeEnv === 'production' && status >= 500 ? 'Internal server error' : err.message;
}
