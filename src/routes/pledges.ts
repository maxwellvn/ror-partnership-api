import { Hono } from 'hono';
import { Pledge, PartnershipCategory, Transaction, User } from '../models';
import { paymentService } from '../services';
import { authMiddleware, validate } from '../middleware';
import {
  successResponse,
  errorResponse,
  paginatedResponse,
  generatePledgeRef,
  generateTransactionRef,
  toSmallestUnit,
  calculatePercentage,
} from '../utils';
import {
  createPledgeSchema,
  updatePledgeSchema,
  contributeToPledgeSchema,
} from '@ror/shared';

const pledges = new Hono();

// Apply auth middleware to all routes
pledges.use('*', authMiddleware);

// Create a new pledge
pledges.post('/', validate(createPledgeSchema), async (c) => {
  try {
    const { id } = c.get('user');
    const input = await c.req.json();

    // Verify category exists
    const category = await PartnershipCategory.findById(input.categoryId);

    if (!category || !category.config.isActive) {
      return errorResponse(c, 'INVALID_CATEGORY', 'Category not found or inactive', 400);
    }

    const pledge = await Pledge.create({
      pledgeRef: generatePledgeRef(),
      userId: id,
      title: input.title,
      categoryId: input.categoryId,
      target: {
        amount: toSmallestUnit(input.targetAmount),
        currency: 'NGN',
        displayAmount: input.targetAmount,
      },
      progress: {
        currentAmount: 0,
        percentage: 0,
        contributionCount: 0,
      },
      timeline: {
        startDate: new Date(),
        targetDate: new Date(input.targetDate),
      },
      status: 'active',
      reminders: input.reminderFrequency
        ? {
            enabled: true,
            frequency: input.reminderFrequency,
          }
        : undefined,
    });

    return successResponse(c, { pledge }, 201);
  } catch (error: any) {
    return errorResponse(c, 'CREATE_FAILED', error.message, 500);
  }
});

// List user pledges
pledges.get('/', async (c) => {
  try {
    const { id } = c.get('user');
    const status = c.req.query('status');

    const filter: any = { userId: id };

    if (status && status !== 'all') {
      filter.status = status;
    }

    const userPledges = await Pledge.find(filter)
      .populate('categoryId', 'name slug')
      .sort({ createdAt: -1 });

    return successResponse(c, { pledges: userPledges });
  } catch (error: any) {
    return errorResponse(c, 'FETCH_FAILED', error.message, 500);
  }
});

// Get single pledge with transactions
pledges.get('/:id', async (c) => {
  try {
    const { id: userId } = c.get('user');
    const { id } = c.req.param();

    const pledge = await Pledge.findOne({
      _id: id,
      userId,
    }).populate('categoryId', 'name slug');

    if (!pledge) {
      return errorResponse(c, 'PLEDGE_NOT_FOUND', 'Pledge not found', 404);
    }

    // Get associated transactions
    const transactions = await Transaction.find({
      _id: { $in: pledge.transactions },
    }).sort({ createdAt: -1 });

    return successResponse(c, { pledge, transactions });
  } catch (error: any) {
    return errorResponse(c, 'FETCH_FAILED', error.message, 500);
  }
});

// Update pledge
pledges.put('/:id', validate(updatePledgeSchema), async (c) => {
  try {
    const { id: userId } = c.get('user');
    const { id } = c.req.param();
    const input = await c.req.json();

    const pledge = await Pledge.findOne({ _id: id, userId });

    if (!pledge) {
      return errorResponse(c, 'PLEDGE_NOT_FOUND', 'Pledge not found', 404);
    }

    if (pledge.status !== 'active') {
      return errorResponse(c, 'PLEDGE_NOT_ACTIVE', 'Can only update active pledges', 400);
    }

    // Update fields
    if (input.title) pledge.title = input.title;
    if (input.targetAmount) {
      pledge.target.displayAmount = input.targetAmount;
      pledge.target.amount = toSmallestUnit(input.targetAmount);
      pledge.progress.percentage = calculatePercentage(
        pledge.progress.currentAmount,
        pledge.target.amount
      );
    }
    if (input.targetDate) pledge.timeline.targetDate = new Date(input.targetDate);
    if (input.reminderFrequency) {
      pledge.reminders = {
        enabled: true,
        frequency: input.reminderFrequency,
      };
    }

    await pledge.save();

    return successResponse(c, { pledge });
  } catch (error: any) {
    return errorResponse(c, 'UPDATE_FAILED', error.message, 500);
  }
});

// Cancel pledge
pledges.delete('/:id', async (c) => {
  try {
    const { id: userId } = c.get('user');
    const { id } = c.req.param();

    const pledge = await Pledge.findOneAndUpdate(
      { _id: id, userId, status: 'active' },
      { status: 'cancelled' },
      { new: true }
    );

    if (!pledge) {
      return errorResponse(c, 'PLEDGE_NOT_FOUND', 'Pledge not found or already cancelled', 404);
    }

    return successResponse(c, { message: 'Pledge cancelled successfully' });
  } catch (error: any) {
    return errorResponse(c, 'DELETE_FAILED', error.message, 500);
  }
});

// Contribute to pledge
pledges.post('/:id/contribute', validate(contributeToPledgeSchema), async (c) => {
  try {
    const { id: userId } = c.get('user');
    const { id } = c.req.param();
    const input = await c.req.json();

    const pledge = await Pledge.findOne({ _id: id, userId, status: 'active' });

    if (!pledge) {
      return errorResponse(c, 'PLEDGE_NOT_FOUND', 'Pledge not found or not active', 404);
    }

    // Get category
    const category = await PartnershipCategory.findById(pledge.categoryId);

    if (!category || !category.config.isActive) {
      return errorResponse(c, 'INVALID_CATEGORY', 'Category not found or inactive', 400);
    }

    // Get user
    const user = await User.findById(userId);
    if (!user) {
      return errorResponse(c, 'USER_NOT_FOUND', 'User not found', 404);
    }

    // Create transaction
    const transactionRef = generateTransactionRef();
    const amountInSmallestUnit = toSmallestUnit(input.amount);

    const transaction = await Transaction.create({
      transactionRef,
      userId,
      type: 'partnership',
      category: {
        categoryId: category._id,
        categoryType: category.type,
        categoryName: category.name,
      },
      amount: {
        value: amountInSmallestUnit,
        currency: 'NGN',
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
    });

    // Initialize payment
    const paymentResult = await paymentService.initializePayment(
      transaction,
      user.email,
      input.paymentMethod
    );

    transaction.externalRef = paymentResult.paymentData.reference;
    await transaction.save();

    // Link transaction to pledge (will be updated on completion)
    pledge.transactions.push(transaction._id);
    await pledge.save();

    return successResponse(c, {
      transaction: {
        _id: transaction._id,
        transactionRef: transaction.transactionRef,
        status: transaction.status,
        amount: transaction.amount,
      },
      pledge: {
        _id: pledge._id,
        pledgeRef: pledge.pledgeRef,
      },
      paymentData: paymentResult.paymentData,
    }, 201);
  } catch (error: any) {
    return errorResponse(c, 'CONTRIBUTION_FAILED', error.message, 500);
  }
});

export { pledges as pledgeRoutes };
