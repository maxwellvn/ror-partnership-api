import { Context } from 'hono';

export const successResponse = <T>(c: Context, data: T, status: number = 200) => {
  return c.json(
    {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
      },
    },
    status
  );
};

export const errorResponse = (
  c: Context,
  code: string,
  message: string,
  status: number = 400,
  details?: Array<{ field: string; message: string }>
) => {
  return c.json(
    {
      success: false,
      error: {
        code,
        message,
        details,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
      },
    },
    status
  );
};

export const paginatedResponse = <T>(
  c: Context,
  data: T[],
  page: number,
  limit: number,
  total: number
) => {
  const totalPages = Math.ceil(total / limit);

  return c.json({
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
    },
  });
};
