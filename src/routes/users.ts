import { Hono } from 'hono';
import { User, Transaction, Pledge } from '../models';
import { authMiddleware, validate } from '../middleware';
import { successResponse, errorResponse, sanitizeUser } from '../utils';
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
      upcomingRecurring: [], // TODO: Implement recurring payments
    });
  } catch (error: any) {
    return errorResponse(c, 'FETCH_FAILED', error.message, 500);
  }
});

export { users as userRoutes };
