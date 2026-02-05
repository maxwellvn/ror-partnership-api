import { Hono } from 'hono';
import bcrypt from 'bcrypt';
import { User, Transaction, Pledge, RecurringPayment } from '../models';
import { authMiddleware, validate } from '../middleware';
import { successResponse, errorResponse, sanitizeUser } from '../utils';
import { config } from '../config';
import { emailService } from '../services/email.service';
import { updateProfileSchema, updateChurchAffiliationSchema } from '@ror/shared';

const users = new Hono();

// Apply auth middleware to all routes
users.use('*', authMiddleware);

// Get current user profile
users.get('/me', async (c) => {
  try {
    const { id } = c.get('user');
    const user = await User.findById(id);

    if (!user) {
      return errorResponse(c, 'USER_NOT_FOUND', 'User not found', 404);
    }

    return successResponse(c, { user: sanitizeUser(user) });
  } catch (error: any) {
    return errorResponse(c, 'FETCH_FAILED', error.message, 500);
  }
});

// Update current user profile
users.put('/me', validate(updateProfileSchema), async (c) => {
  try {
    const { id } = c.get('user');
    const input = await c.req.json();

    const user = await User.findByIdAndUpdate(
      id,
      {
        $set: {
          ...(input.profile && { profile: { ...input.profile } }),
          ...(input.contact && { contact: input.contact }),
          ...(input.preferences && { preferences: input.preferences }),
        },
      },
      { new: true, runValidators: true }
    );

    if (!user) {
      return errorResponse(c, 'USER_NOT_FOUND', 'User not found', 404);
    }

    return successResponse(c, { user: sanitizeUser(user) });
  } catch (error: any) {
    return errorResponse(c, 'UPDATE_FAILED', error.message, 500);
  }
});

// Update church affiliation
users.put('/me/church-affiliation', validate(updateChurchAffiliationSchema), async (c) => {
  try {
    const { id } = c.get('user');
    const input = await c.req.json();

    const user = await User.findByIdAndUpdate(
      id,
      {
        $set: {
          churchAffiliation: input,
        },
      },
      { new: true }
    );

    if (!user) {
      return errorResponse(c, 'USER_NOT_FOUND', 'User not found', 404);
    }

    return successResponse(c, { user: sanitizeUser(user) });
  } catch (error: any) {
    return errorResponse(c, 'UPDATE_FAILED', error.message, 500);
  }
});

// Verify current password (for re-auth before sensitive changes)
users.post('/me/verify-password', async (c) => {
  try {
    const { id } = c.get('user');
    const { password } = await c.req.json();

    if (!password) {
      return errorResponse(c, 'VALIDATION_ERROR', 'Password is required', 400);
    }

    const user = await User.findById(id);
    if (!user) {
      return errorResponse(c, 'USER_NOT_FOUND', 'User not found', 404);
    }

    if (!user.hasPassword) {
      return errorResponse(c, 'NO_PASSWORD', 'No password set on this account', 400);
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return errorResponse(c, 'INVALID_PASSWORD', 'Incorrect password', 401);
    }

    return successResponse(c, { verified: true });
  } catch (error: any) {
    return errorResponse(c, 'VERIFY_FAILED', error.message, 500);
  }
});

// Set or change password
users.put('/me/password', async (c) => {
  try {
    const { id } = c.get('user');
    const { currentPassword, newPassword } = await c.req.json();

    if (!newPassword || newPassword.length < 8) {
      return errorResponse(c, 'VALIDATION_ERROR', 'New password must be at least 8 characters', 400);
    }

    const user = await User.findById(id);
    if (!user) {
      return errorResponse(c, 'USER_NOT_FOUND', 'User not found', 404);
    }

    // If user already has a password, require current password
    if (user.hasPassword) {
      if (!currentPassword) {
        return errorResponse(c, 'VALIDATION_ERROR', 'Current password is required', 400);
      }
      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid) {
        return errorResponse(c, 'INVALID_PASSWORD', 'Current password is incorrect', 401);
      }
    }

    user.passwordHash = await bcrypt.hash(newPassword, config.bcryptRounds);
    user.hasPassword = true;
    await user.save();

    return successResponse(c, { user: sanitizeUser(user) });
  } catch (error: any) {
    return errorResponse(c, 'UPDATE_FAILED', error.message, 500);
  }
});

// Update email
users.put('/me/email', async (c) => {
  try {
    const { id } = c.get('user');
    const { email, password } = await c.req.json();

    if (!email) {
      return errorResponse(c, 'VALIDATION_ERROR', 'Email is required', 400);
    }

    const user = await User.findById(id);
    if (!user) {
      return errorResponse(c, 'USER_NOT_FOUND', 'User not found', 404);
    }

    // Require password verification
    if (user.hasPassword) {
      if (!password) {
        return errorResponse(c, 'VALIDATION_ERROR', 'Password is required to change email', 400);
      }
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return errorResponse(c, 'INVALID_PASSWORD', 'Incorrect password', 401);
      }
    }

    // Check email not taken
    const existing = await User.findOne({ email: email.toLowerCase(), _id: { $ne: id } });
    if (existing) {
      return errorResponse(c, 'EMAIL_TAKEN', 'An account with this email already exists', 409);
    }

    // Update email and require re-verification
    const verificationCode = emailService.generateVerificationCode();
    const verificationExpiry = new Date(Date.now() + config.verificationCodeExpiry);

    user.email = email.toLowerCase();
    user.isEmailVerified = false;
    user.emailVerificationCode = verificationCode;
    user.emailVerificationExpiry = verificationExpiry;
    await user.save();

    try {
      await emailService.sendVerificationCode(email, verificationCode, user.profile.firstName);
    } catch (err) {
      console.error('Failed to send verification email:', err);
    }

    return successResponse(c, {
      user: sanitizeUser(user),
      requiresVerification: true,
    });
  } catch (error: any) {
    return errorResponse(c, 'UPDATE_FAILED', error.message, 500);
  }
});

// Get user dashboard data
users.get('/me/dashboard', async (c) => {
  try {
    const { id } = c.get('user');

    // Get total giving
    const totalGivingResult = await Transaction.aggregate([
      {
        $match: {
          userId: id,
          status: 'completed',
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount.displayValue' },
        },
      },
    ]);

    // Get current month giving
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const currentMonthResult = await Transaction.aggregate([
      {
        $match: {
          userId: id,
          status: 'completed',
          createdAt: { $gte: startOfMonth },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount.displayValue' },
        },
      },
    ]);

    // Get active pledges
    const activePledges = await Pledge.find({
      userId: id,
      status: 'active',
    })
      .sort({ createdAt: -1 })
      .limit(5);

    // Get recent transactions
    const recentTransactions = await Transaction.find({
      userId: id,
    })
      .sort({ createdAt: -1 })
      .limit(10);

    return successResponse(c, {
      totalGiving: totalGivingResult[0]?.total || 0,
      currentMonthGiving: currentMonthResult[0]?.total || 0,
      activePledges,
      recentTransactions,
      upcomingRecurring: await RecurringPayment.find({
        userId: id,
        status: 'active',
        'schedule.nextPaymentDate': {
          $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      })
        .populate('categoryId', 'name code')
        .sort({ 'schedule.nextPaymentDate': 1 })
        .limit(5),
    });
  } catch (error: any) {
    return errorResponse(c, 'FETCH_FAILED', error.message, 500);
  }
});

export { users as userRoutes };
