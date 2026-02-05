import { Context, Next } from 'hono';
import { ZodSchema, ZodError } from 'zod';

export const validate = (schema: ZodSchema, target: 'body' | 'query' | 'param' = 'body') => {
  return async (c: Context, next: Next) => {
    try {
      let data: unknown;

      switch (target) {
        case 'body':
          data = await c.req.json();
          break;
        case 'query':
          data = c.req.query();
          break;
        case 'param':
          data = c.req.param();
          break;
      }

      const validated = schema.parse(data);
      c.set('validated' as any, validated);
      await next();
    } catch (error) {
      if (error instanceof ZodError) {
        return c.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid input data',
              details: error.errors.map((e) => ({
                field: e.path.join('.'),
                message: e.message,
              })),
            },
          },
          400
        );
      }

      // JSON parse error
      if (error instanceof SyntaxError) {
        return c.json(
          {
            success: false,
            error: {
              code: 'INVALID_JSON',
              message: 'Invalid JSON in request body',
            },
          },
          400
        );
      }

      throw error;
    }
  };
};
