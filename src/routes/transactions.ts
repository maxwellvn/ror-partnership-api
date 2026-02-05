import { Hono } from 'hono';
import mongoose from 'mongoose';
import { Transaction, PartnershipCategory, User } from '../models';
import { paymentService } from '../services';
import { authMiddleware, validate } from '../middleware';
import {
  successResponse,
  errorResponse,
  paginatedResponse,
  generateTransactionRef,
  toSmallestUnit,
} from '../utils';
import {
  createTransactionSchema,
  completeTransactionSchema,
  transactionQuerySchema,
} from '@ror/shared';

const transactions = new Hono();

// Apply auth middleware to all routes
transactions.use('*', authMiddleware);

// Create a new transaction (initiate giving)
transactions.post('/give', validate(createTransactionSchema), async (c) => {
  try {
    const { id } = c.get('user');
    const input = await c.req.json();

    // Verify category exists and is active
    const category = await PartnershipCategory.findById(input.categoryId);

    if (!category || !category.config.isActive) {
      return errorResponse(c, 'INVALID_CATEGORY', 'Category not found or inactive', 400);
    }

    // Check minimum amount
    if (input.amount < category.config.minimumAmount) {
      return errorResponse(
        c,
        'AMOUNT_TOO_LOW',
        `Minimum amount is ${category.config.minimumAmount}`,
        400
      );
    }

    // Get user for email
    const user = await User.findById(id);
    if (!user) {
      return errorResponse(c, 'USER_NOT_FOUND', 'User not found', 404);
    }

    // Create transaction
    const transactionRef = generateTransactionRef();
    const amountInSmallestUnit = toSmallestUnit(input.amount, input.currency);

    const transaction = await Transaction.create({
      transactionRef,
      userId: id,
      type: category.type === 'campaign' ? 'campaign' : 'partnership',
      category: {
        categoryId: category._id,
        categoryType: category.type,
        categoryName: category.name,
      },
      amount: {
        value: amountInSmallestUnit,
        currency: input.currency,
        displayValue: input.amount,
      },
      payment: {
        method: input.paymentMethod,
      },
      status: 'pending',
      statusHistory: [
        {
          status: 'pending',
          timestamp: new Date(),
        },
      ],
      attribution: user.churchAffiliation,
      metadata: {
        ipAddress: c.req.header('x-forwarded-for') || 'unknown',
        userAgent: c.req.header('user-agent'),
        platform: c.req.header('x-platform') as any,
        appVersion: c.req.header('x-app-version'),
      },
    });

    // Initialize payment with provider
    const paymentResult = await paymentService.initializePayment(
      transaction,
      user.email,
      input.paymentMethod
    );

    // Update transaction with external reference
    transaction.externalRef = paymentResult.paymentData.reference;
    await transaction.save();

    return successResponse(c, {
      transaction: {
        _id: transaction._id,
        transactionRef: transaction.transactionRef,
        status: transaction.status,
        amount: transaction.amount,
      },
      paymentData: paymentResult.paymentData,
    }, 201);
  } catch (error: any) {
    console.error('Transaction creation error:', error);
    return errorResponse(c, 'TRANSACTION_FAILED', error.message, 500);
  }
});

// Complete transaction (callback from payment gateway)
transactions.post('/give/complete', validate(completeTransactionSchema), async (c) => {
  try {
    const input = await c.req.json();

    const transaction = await Transaction.findOne({
      transactionRef: input.transactionRef,
    });

    if (!transaction) {
      return errorResponse(c, 'TRANSACTION_NOT_FOUND', 'Transaction not found', 404);
    }

    if (transaction.status === 'completed') {
      return successResponse(c, { transaction });
    }

    // Verify payment with provider
    if (transaction.payment.method === 'paystack') {
      const paymentData = await paymentService.verifyPaystack(input.providerRef);

      if (paymentData.status !== 'success') {
        transaction.status = 'failed';
        transaction.statusHistory.push({
          status: 'failed',
          timestamp: new Date(),
          reason: paymentData.gateway_response,
        });
        await transaction.save();

        return errorResponse(c, 'PAYMENT_FAILED', 'Payment verification failed', 402);
      }

      // Update transaction
      transaction.status = 'completed';
      transaction.completedAt = new Date();
      transaction.payment.providerRef = paymentData.reference;
      transaction.payment.cardLast4 = paymentData.authorization?.last4;
      transaction.payment.cardBrand = paymentData.authorization?.brand;
      transaction.statusHistory.push({
        status: 'completed',
        timestamp: new Date(),
      });

      await transaction.save();

      // Update category stats
      await PartnershipCategory.findByIdAndUpdate(transaction.category.categoryId, {
        $inc: {
          'stats.totalContributions': 1,
          'stats.totalAmount': transaction.amount.displayValue,
        },
        $set: {
          'stats.lastUpdated': new Date(),
        },
      });
    }

    return successResponse(c, { transaction });
  } catch (error: any) {
    console.error('Transaction completion error:', error);
    return errorResponse(c, 'COMPLETION_FAILED', error.message, 500);
  }
});

// List user transactions
transactions.get('/', async (c) => {
  try {
    const { id } = c.get('user');
    const query = c.req.query();

    const page = parseInt(query.page || '1');
    const limit = parseInt(query.limit || '20');
    const skip = (page - 1) * limit;

    const filter: any = { userId: id };

    if (query.status) {
      filter.status = query.status;
    }

    if (query.categoryId) {
      filter['category.categoryId'] = query.categoryId;
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
      Transaction.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Transaction.countDocuments(filter),
    ]);

    return paginatedResponse(c, transactions, page, limit, total);
  } catch (error: any) {
    return errorResponse(c, 'FETCH_FAILED', error.message, 500);
  }
});

// Get single transaction
transactions.get('/:id', async (c) => {
  try {
    const { id: userId } = c.get('user');
    const { id } = c.req.param();

    const transaction = await Transaction.findOne({
      _id: id,
      userId,
    });

    if (!transaction) {
      return errorResponse(c, 'TRANSACTION_NOT_FOUND', 'Transaction not found', 404);
    }

    return successResponse(c, { transaction });
  } catch (error: any) {
    return errorResponse(c, 'FETCH_FAILED', error.message, 500);
  }
});

// Get giving summary/statistics
transactions.get('/summary/stats', async (c) => {
  try {
    const { id } = c.get('user');
    const period = c.req.query('period') || 'all';

    let dateFilter: any = {};
    const now = new Date();

    switch (period) {
      case 'week':
        dateFilter = { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
        break;
      case 'month':
        dateFilter = { $gte: new Date(now.getFullYear(), now.getMonth(), 1) };
        break;
      case 'quarter':
        const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        dateFilter = { $gte: quarterStart };
        break;
      case 'year':
        dateFilter = { $gte: new Date(now.getFullYear(), 0, 1) };
        break;
    }

    const matchStage: any = {
      userId: new mongoose.Types.ObjectId(id),
      status: 'completed',
    };

    if (Object.keys(dateFilter).length > 0) {
      matchStage.createdAt = dateFilter;
    }

    const [summary, byCategory, trend] = await Promise.all([
      // Total summary
      Transaction.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: '$amount.displayValue' },
            transactionCount: { $sum: 1 },
          },
        },
      ]),

      // By category
      Transaction.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: '$category.categoryId',
            categoryName: { $first: '$category.categoryName' },
            totalAmount: { $sum: '$amount.displayValue' },
            count: { $sum: 1 },
          },
        },
        { $sort: { totalAmount: -1 } },
      ]),

      // Trend (by month)
      Transaction.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
            },
            totalAmount: { $sum: '$amount.displayValue' },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]),
    ]);

    return successResponse(c, {
      totalAmount: summary[0]?.totalAmount || 0,
      transactionCount: summary[0]?.transactionCount || 0,
      byCategory,
      trend,
    });
  } catch (error: any) {
    return errorResponse(c, 'FETCH_FAILED', error.message, 500);
  }
});

export { transactions as transactionRoutes };
