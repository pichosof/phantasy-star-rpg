import type {
  GeneratorTaskState,
  PortraitGenerator,
} from '../../core/use-cases/portraits/portraits.js';
import { env, type FotorConfig } from '../config/env.js';

const API = 'https://api-b.fotor.com';
/** Fixed on purpose: a model change is a code change, never a silent substitution. */
export const FOTOR_MODEL = 'seedream-4-0-250828';
const MAX_RESULT_BYTES = 30 * 1024 * 1024;

class FotorError extends Error {
  readonly statusCode = 502;
}

interface FotorEnvelope<T> {
  code?: string;
  msg?: string;
  data?: T;
}

/** NPC portraits through the Fotor OpenAPI (server-side key; see docs.fotor.com). */
export class FotorPortraitGenerator implements PortraitGenerator {
  get enabled() {
    return env.FOTOR !== null;
  }

  private config(): FotorConfig {
    if (!env.FOTOR) throw new Error('Fotor is not configured (FOTOR_API_KEY is empty)');
    return env.FOTOR;
  }

  private async call<T>(path: string, init: { method?: string; body?: string } = {}): Promise<T> {
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config().apiKey}`,
      },
      signal: AbortSignal.timeout(30_000),
    });
    const text = await res.text();
    if (!res.ok)
      throw new FotorError(`Fotor ${path} answered ${res.status}: ${text.slice(0, 300)}`);
    const body = JSON.parse(text) as FotorEnvelope<T>;
    if (body.code !== '000' || body.data === undefined)
      throw new FotorError(`Fotor ${path} refused: ${body.msg ?? text.slice(0, 300)}`);
    return body.data;
  }

  /** `/files/...` references become absolute: Fotor fetches them from the public API. */
  private absolute(url: string) {
    return url.startsWith('/files/') ? `${this.config().publicApiUrl}${url}` : url;
  }

  async submit(input: { prompt: string; references: string[]; width: number; height: number }) {
    const data = await this.call<{ taskId?: string }>(`/v1/aiart/imagegeneration/${FOTOR_MODEL}`, {
      method: 'POST',
      body: JSON.stringify({
        width: input.width,
        height: input.height,
        content: [
          { type: 'text', text: input.prompt },
          ...input.references.map((url) => ({
            type: 'image_url',
            url: this.absolute(url),
            role: 'smart_reference',
          })),
        ],
      }),
    });
    if (!data.taskId) throw new FotorError('Fotor accepted the task but returned no taskId');
    return data.taskId;
  }

  async status(taskId: string): Promise<GeneratorTaskState> {
    const data = await this.call<{
      status?: number;
      resultUrl?: string;
      hasHsfw?: boolean;
      msg?: string;
    }>(`/v1/aiart/tasks/${encodeURIComponent(taskId)}`);
    switch (data.status) {
      case 0:
        return { state: 'pending' };
      case 1:
        if (!data.resultUrl)
          throw new FotorError(`Fotor task ${taskId} is done without a resultUrl`);
        return { state: 'done', resultUrl: data.resultUrl };
      case 2:
        return {
          state: 'failed',
          reason: data.hasHsfw
            ? 'Blocked by the Fotor content filter.'
            : `Fotor could not generate it${data.msg ? `: ${data.msg}` : '.'}`,
        };
      default:
        throw new FotorError(`Fotor task ${taskId} has an unknown status: ${String(data.status)}`);
    }
  }

  async fetchResult(resultUrl: string) {
    const url = new URL(resultUrl);
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.fotor.com'))
      throw new FotorError(`Unexpected Fotor result URL: ${resultUrl}`);
    const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    if (!res.ok) throw new FotorError(`Downloading the result answered ${res.status}`);
    const mime = (res.headers.get('content-type') ?? '').split(';')[0].trim();
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime))
      throw new FotorError(`The result is not a supported image (${mime || 'no content-type'})`);
    const data = Buffer.from(await res.arrayBuffer());
    if (data.length > MAX_RESULT_BYTES) throw new FotorError('The result is larger than 30 MB');
    return { data, mime };
  }
}
