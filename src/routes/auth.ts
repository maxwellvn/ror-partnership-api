import { Hono } from 'hono';
import { authService } from '../services';
import { validate } from '../middleware';
import { successResponse, errorResponse, sanitizeUser } from '../utils';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '@ror/shared';

const auth = new Hono();

// Register
auth.post('/register', validate(registerSchema), async (c) => {
  try {
    const input = await c.req.json();
    const { user, requiresVerification } = await authService.register(input);

    return successResponse(c, {
      user: sanitizeUser(user),
      requiresVerification,
      email: user.email,
    }, 201);
  } catch (error: any) {
    if (error.message.includes('already exists')) {
      return errorResponse(c, 'USER_EXISTS', error.message, 409);
    }
    return errorResponse(c, 'REGISTRATION_FAILED', error.message, 500);
  }
});

// Login
auth.post('/login', validate(loginSchema), async (c) => {
  try {
    const input = await c.req.json();
    const result = await authService.login(input);

    if (result.requiresVerification) {
      return successResponse(c, {
        user: sanitizeUser(result.user),
        requiresVerification: true,
        email: result.user.email,
      });
    }

    return successResponse(c, {
      user: sanitizeUser(result.user),
      tokens: result.tokens,
    });
  } catch (error: any) {
    return errorResponse(c, 'AUTH_INVALID_CREDENTIALS', 'Invalid email/password', 401);
  }
});

// Verify Email
auth.post('/verify-email', async (c) => {
  try {
    const { email, code } = await c.req.json();

    if (!email || !code) {
      return errorResponse(c, 'VALIDATION_ERROR', 'Email and verification code are required', 400);
    }

    const { user, tokens } = await authService.verifyEmail(email, code);

    return successResponse(c, {
      user: sanitizeUser(user),
      tokens,
    });
  } catch (error: any) {
    if (error.message.includes('expired')) {
      return errorResponse(c, 'VERIFICATION_EXPIRED', error.message, 400);
    }
    if (error.message.includes('Invalid verification')) {
      return errorResponse(c, 'VERIFICATION_INVALID', error.message, 400);
    }
    if (error.message.includes('already verified')) {
      return errorResponse(c, 'ALREADY_VERIFIED', error.message, 400);
    }
    return errorResponse(c, 'VERIFICATION_FAILED', error.message, 400);
  }
});

// Resend Verification Code
auth.post('/resend-verification', async (c) => {
  try {
    const { email } = await c.req.json();

    if (!email) {
      return errorResponse(c, 'VALIDATION_ERROR', 'Email is required', 400);
    }

    await authService.resendVerificationCode(email);

    return successResponse(c, {
      message: 'If an account exists with this email, a new verification code will be sent',
    });
  } catch (error: any) {
    if (error.message.includes('already verified')) {
      return errorResponse(c, 'ALREADY_VERIFIED', error.message, 400);
    }
    return errorResponse(c, 'RESEND_FAILED', error.message, 500);
  }
});

// KingsChat OAuth callback (web intermediary)
auth.post('/kingschat/callback', async (c) => {
  try {
    const url = new URL(c.req.url);
    const appRedirect = url.searchParams.get('app_redirect') || '';

    if (!appRedirect) {
      return errorResponse(c, 'KINGSCHAT_CALLBACK_MISSING_REDIRECT', 'Missing app_redirect', 400);
    }

    const contentType = c.req.header('content-type') || '';
    let bodyParams: Record<string, string> = {};

    if (contentType.includes('application/json')) {
      const body = await c.req.json();
      Object.entries(body || {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          bodyParams[key] = String(value);
        }
      });
    } else {
      const body = await c.req.parseBody();
      Object.entries(body || {}).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          bodyParams[key] = String(value[0]);
        } else if (value !== undefined && value !== null) {
          bodyParams[key] = String(value);
        }
      });
    }

    const redirectUrl = new URL(appRedirect);

    // Pass through any tokens or errors from KingsChat
    Object.entries(bodyParams).forEach(([key, value]) => {
      if (key !== 'app_redirect') {
        redirectUrl.searchParams.set(key, value);
      }
    });

    return c.redirect(redirectUrl.toString(), 302);
  } catch (error: any) {
    return errorResponse(c, 'KINGSCHAT_CALLBACK_FAILED', error.message || 'Callback failed', 500);
  }
});

// KingsChat OAuth callback (some providers send GET)
auth.get('/kingschat/callback', async (c) => {
  try {
    const url = new URL(c.req.url);
    const appRedirect = url.searchParams.get('app_redirect') || '';

    if (!appRedirect) {
      return errorResponse(c, 'KINGSCHAT_CALLBACK_MISSING_REDIRECT', 'Missing app_redirect', 400);
    }

    const redirectUrl = new URL(appRedirect);

    url.searchParams.forEach((value, key) => {
      if (key !== 'app_redirect') {
        redirectUrl.searchParams.set(key, value);
      }
    });

    return c.redirect(redirectUrl.toString(), 302);
  } catch (error: any) {
    return errorResponse(c, 'KINGSCHAT_CALLBACK_FAILED', error.message || 'Callback failed', 500);
  }
});

// KingsChat login (exchange KingsChat access token for app tokens)
auth.post('/kingschat', async (c) => {
  try {
    const body = await c.req.json();
    const accessToken = body.accessToken || body.access_token;
    const refreshToken = body.refreshToken || body.refresh_token;

    if (!accessToken) {
      return errorResponse(c, 'KINGSCHAT_TOKEN_MISSING', 'Access token is required', 400);
    }

    const { user, tokens } = await authService.loginWithKingChat(accessToken, refreshToken);

    return successResponse(c, {
      user: sanitizeUser(user),
      tokens,
    });
  } catch (error: any) {
    return errorResponse(c, 'KINGSCHAT_LOGIN_FAILED', error.message || 'Login failed', 500);
  }
});

// Refresh Token
auth.post('/refresh', validate(refreshTokenSchema), async (c) => {
  try {
    const { refreshToken } = await c.req.json();
    const tokens = await authService.refreshTokens(refreshToken);

    return successResponse(c, tokens);
  } catch (error: any) {
    return errorResponse(c, 'AUTH_INVALID_TOKEN', 'Invalid or expired refresh token', 401);
  }
});

// Logout (client-side token removal, but we can blacklist tokens with Redis)
auth.post('/logout', async (c) => {
  // TODO: Implement token blacklisting with Redis
  return successResponse(c, { message: 'Logged out successfully' });
});

// Forgot Password
auth.post('/forgot-password', validate(forgotPasswordSchema), async (c) => {
  try {
    const { email } = await c.req.json();
    await authService.forgotPassword(email);

    return successResponse(c, {
      message: 'If an account exists with this email, a password reset link will be sent',
    });
  } catch (error: any) {
    return errorResponse(c, 'RESET_FAILED', error.message, 500);
  }
});

// Reset Password
auth.post('/reset-password', validate(resetPasswordSchema), async (c) => {
  try {
    const { token, newPassword } = await c.req.json();
    await authService.resetPassword(token, newPassword);

    return successResponse(c, { message: 'Password reset successfully' });
  } catch (error: any) {
    return errorResponse(c, 'RESET_FAILED', error.message, 400);
  }
});

export { auth as authRoutes };
