import { Context, Next } from 'hono';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { User } from '../models';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
}

declare module 'hono' {
  interface ContextVariableMap {
    user: AuthUser;
  }
}

export const authMiddleware = async (c: Context, next: Next) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json(
      {
        success: false,
        error: {
          code: 'AUTH_TOKEN_MISSING',
          message: 'Authorization token is required',
        },
      },
      401
    );
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as {
      sub: string;
      email: string;
      role: string;
    };

    c.set('user', {
      id: decoded.sub,
      email: decoded.email,
      role: decoded.role,
    });

    await next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return c.json(
        {
          success: false,
          error: {
            code: 'AUTH_TOKEN_EXPIRED',
            message: 'Token has expired',
          },
        },
        401
      );
    }

    return c.json(
      {
        success: false,
        error: {
          code: 'AUTH_INVALID_TOKEN',
          message: 'Invalid token',
        },
      },
      401
    );
  }
};

export const adminMiddleware = async (c: Context, next: Next) => {
  const user = c.get('user');

  if (!user || !['admin', 'super_admin'].includes(user.role)) {
    return c.json(
      {
        success: false,
        error: {
          code: 'AUTH_INSUFFICIENT_PERMISSIONS',
          message: 'Admin access required',
        },
      },
      403
    );
  }

  await next();
};

export const superAdminMiddleware = async (c: Context, next: Next) => {
  const user = c.get('user');

  if (!user || user.role !== 'super_admin') {
    return c.json(
      {
        success: false,
        error: {
          code: 'AUTH_INSUFFICIENT_PERMISSIONS',
          message: 'Super admin access required',
        },
      },
      403
    );
  }

  await next();
};
