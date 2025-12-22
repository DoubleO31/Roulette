import { z } from 'zod';
import { insertSessionSchema, insertSpinSchema, sessions, spins } from './schema';

// Shared types
export const errorSchemas = {
  notFound: z.object({ message: z.string() }),
  validation: z.object({ message: z.string(), field: z.string().optional() }),
};

export const api = {
  sessions: {
    create: {
      method: 'POST' as const,
      path: '/api/sessions',
      input: z.object({}).optional(),
      responses: {
        201: z.custom<typeof sessions.$inferSelect>(),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/sessions/:id',
      responses: {
        200: z.custom<any>(), // Returns GameState
        404: errorSchemas.notFound,
      },
    },
  },
  spins: {
    create: {
      method: 'POST' as const,
      path: '/api/spins',
      input: z.object({
        sessionId: z.number(),
        result: z.string(),
      }),
      responses: {
        201: z.custom<any>(), // Returns updated GameState
        404: errorSchemas.notFound,
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
