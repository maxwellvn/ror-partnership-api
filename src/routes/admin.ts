import { Hono } from 'hono';
import mongoose from 'mongoose';
import { User, Transaction, PartnershipCategory, Pledge } from '../models';
import { authMiddleware, adminMiddleware, validate } from '../middleware';
import { successResponse, errorResponse, paginatedResponse } from '../utils';
import { createCategorySchema, paginationSchema } from '@ror/shared';

const admin = new Hono();

// Apply auth and admin middleware to all routes
admin.use('*', authMiddleware);
admin.use('*', adminMiddleware);

// ==================== Dashboard ====================

admin.get('/dashboard', async (c) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // Summary stats
    const [totalPartners, totalTransactions, monthlyStats, lastMonthStats] = await Promise.all([
      User.countDocuments({ role: 'partner', status: 'active' }),
      Transaction.countDocuments({ status: 'completed' }),
      Transaction.aggregate([
        {
          $match: {
            status: 'completed',
            createdAt: { $gte: startOfMonth },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount.displayValue' },
            count: { $sum: 1 },
          },
        },
      ]),
      Transaction.aggregate([
        {
          $match: {
            status: 'completed',
            createdAt: { $gte: startOfLastMonth, $lt: startOfMonth },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount.displayValue' },
          },
        },
      ]),
    ]);

    // Recent transactions
    const recentTransactions = await Transaction.find({ status: 'completed' })
      .populate('userId', 'profile.firstName profile.lastName email')
      .sort({ createdAt: -1 })
      .limit(10);

    // Top partners this month
    const topPartners = await Transaction.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: { $gte: startOfMonth },
        },
      },
      {
        $group: {
          _id: '$userId',
          totalAmount: { $sum: '$amount.displayValue' },
          transactionCount: { $sum: 1 },
        },
      },
      { $sort: { totalAmount: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      {
        $project: {
          userId: '$_id',
          totalAmount: 1,
          transactionCount: 1,
          'user.profile.firstName': 1,
          'user.profile.lastName': 1,
          'user.email': 1,
        },
      },
    ]);

    return successResponse(c, {
      summary: {
        totalPartners,
        totalTransactions,
        monthlyTotal: monthlyStats[0]?.total || 0,
        monthlyCount: monthlyStats[0]?.count || 0,
        lastMonthTotal: lastMonthStats[0]?.total || 0,
        growthPercentage:
          lastMonthStats[0]?.total > 0
            ? (((monthlyStats[0]?.total || 0) - lastMonthStats[0].total) /
                lastMonthStats[0].total) *
              100
            : 0,
      },
      recentTransactions,
      topPartners,
    });
  } catch (error: any) {
    return errorResponse(c, 'FETCH_FAILED', error.message, 500);
  }
});

// ==================== Partner Management ====================

admin.get('/partners', async (c) => {
  try {
    const query = c.req.query();
    const page = parseInt(query.page || '1');
    const limit = parseInt(query.limit || '20');
    const skip = (page - 1) * limit;

    const filter: any = { role: 'partner' };

    if (query.search) {
      filter.$or = [
        { email: { $regex: query.search, $options: 'i' } },
        { phone: { $regex: query.search, $options: 'i' } },
        { 'profile.firstName': { $regex: query.search, $options: 'i' } },
        { 'profile.lastName': { $regex: query.search, $options: 'i' } },
      ];
    }

    if (query.status) {
      filter.status = query.status;
    }

    if (query.zoneId) {
      filter['churchAffiliation.zoneId'] = query.zoneId;
    }

    const [partners, total] = await Promise.all([
      User.find(filter)
        .select('-passwordHash -kingchatAccessToken -kingchatRefreshToken')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(filter),
    ]);

    return paginatedResponse(c, partners, page, limit, total);
  } catch (error: any) {
    return errorResponse(c, 'FETCH_FAILED', error.message, 500);
  }
});

admin.get('/partners/:id', async (c) => {
  try {
    const { id } = c.req.param();

    const partner = await User.findById(id).select(
      '-passwordHash -kingchatAccessToken -kingchatRefreshToken'
    );

    if (!partner) {
      return errorResponse(c, 'PARTNER_NOT_FOUND', 'Partner not found', 404);
    }

    const [transactions, pledges] = await Promise.all([
      Transaction.find({ userId: id }).sort({ createdAt: -1 }).limit(20),
      Pledge.find({ userId: id }).sort({ createdAt: -1 }),
    ]);

    return successResponse(c, { partner, transactions, pledges });
  } catch (error: any) {
    return errorResponse(c, 'FETCH_FAILED', error.message, 500);
  }
});

// ==================== Transaction Management ====================

admin.get('/transactions', async (c) => {
  try {
    const query = c.req.query();
    const page = parseInt(query.page || '1');
    const limit = parseInt(query.limit || '20');
    const skip = (page - 1) * limit;

    const filter: any = {};

    if (query.status) {
      filter.status = query.status;
    }

    if (query.categoryId) {
      filter['category.categoryId'] = query.categoryId;
    }

    if (query.userId) {
      filter.userId = query.userId;
    }

    if (query.startDate || query.endDate) {
      filter.createdAt = {};
      if (query.startDate) {
        filter.createdAt.$gte = new Date(query.startDate);
      }
      if (query.endDate) {
        filter.createdAt.$lte = new Date(query.endDate);
      }
    }

    const [transactions, total] = await Promise.all([
      Transaction.find(filter)
        .populate('userId', 'profile.firstName profile.lastName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Transaction.countDocuments(filter),
    ]);

    return paginatedResponse(c, transactions, page, limit, total);
  } catch (error: any) {
    return errorResponse(c, 'FETCH_FAILED', error.message, 500);
  }
});

admin.delete('/transactions/:id', async (c) => {
  try {
    const { id } = c.req.param();

    const transaction = await Transaction.findByIdAndDelete(id);

    if (!transaction) {
      return errorResponse(c, 'TRANSACTION_NOT_FOUND', 'Transaction not found', 404);
    }

    return successResponse(c, { message: 'Transaction deleted successfully' });
  } catch (error: any) {
    return errorResponse(c, 'DELETE_FAILED', error.message, 500);
  }
});

// ==================== Category Management ====================

admin.get('/categories', async (c) => {
  try {
    const categories = await PartnershipCategory.find()
      .sort({ 'display.order': 1, createdAt: -1 });

    return successResponse(c, { categories });
  } catch (error: any) {
    return errorResponse(c, 'FETCH_FAILED', error.message, 500);
  }
});

admin.post('/categories', validate(createCategorySchema), async (c) => {
  try {
    const { id } = c.get('user');
    const input = await c.req.json();

    // Check if slug or code exists
    const existing = await PartnershipCategory.findOne({
      $or: [{ slug: input.slug }, { code: input.code }],
    });

    if (existing) {
      return errorResponse(c, 'CATEGORY_EXISTS', 'Category with this slug or code already exists', 409);
    }

    const category = await PartnershipCategory.create({
      ...input,
      createdBy: id,
    });

    return successResponse(c, { category }, 201);
  } catch (error: any) {
    return errorResponse(c, 'CREATE_FAILED', error.message, 500);
  }
});

admin.put('/categories/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const input = await c.req.json();

    const category = await PartnershipCategory.findByIdAndUpdate(
      id,
      { $set: input },
      { new: true, runValidators: true }
    );

    if (!category) {
      return errorResponse(c, 'CATEGORY_NOT_FOUND', 'Category not found', 404);
    }

    return successResponse(c, { category });
  } catch (error: any) {
    return errorResponse(c, 'UPDATE_FAILED', error.message, 500);
  }
});

admin.delete('/categories/:id', async (c) => {
  try {
    const { id } = c.req.param();

    // Soft delete
    const category = await PartnershipCategory.findByIdAndUpdate(
      id,
      { $set: { deletedAt: new Date(), 'config.isActive': false } },
      { new: true }
    );

    if (!category) {
      return errorResponse(c, 'CATEGORY_NOT_FOUND', 'Category not found', 404);
    }

    return successResponse(c, { message: 'Category deleted successfully' });
  } catch (error: any) {
    return errorResponse(c, 'DELETE_FAILED', error.message, 500);
  }
});

// ==================== Reports ====================

admin.get('/reports/summary', async (c) => {
  try {
    const query = c.req.query();
    const startDate = query.startDate ? new Date(query.startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = query.endDate ? new Date(query.endDate) : new Date();
    const groupBy = query.groupBy || 'day';

    let dateFormat: string;
    switch (groupBy) {
      case 'week':
        dateFormat = '%Y-W%V';
        break;
      case 'month':
        dateFormat = '%Y-%m';
        break;
      default:
        dateFormat = '%Y-%m-%d';
    }

    const report = await Transaction.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: dateFormat, date: '$createdAt' } },
            category: '$category.categoryName',
          },
          totalAmount: { $sum: '$amount.displayValue' },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: '$_id.date',
          categories: {
            $push: {
              name: '$_id.category',
              amount: '$totalAmount',
              count: '$count',
            },
          },
          totalAmount: { $sum: '$totalAmount' },
          totalCount: { $sum: '$count' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return successResponse(c, { report, startDate, endDate, groupBy });
  } catch (error: any) {
    return errorResponse(c, 'REPORT_FAILED', error.message, 500);
  }
});

export { admin as adminRoutes };
