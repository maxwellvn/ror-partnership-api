import { Hono } from 'hono';
import { RecurringPayment, Transaction, Pledge } from '../models';
import { authMiddleware, adminMiddleware } from '../middleware/auth';

const recurringPayments = new Hono();

// Get user's recurring payments
recurringPayments.get('/', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const { status, page = '1', limit = '20' } = c.req.query();

    const query: any = { userId: user._id };
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [payments, total] = await Promise.all([
      RecurringPayment.find(query)
        .populate('categoryId', 'name code')
        .populate('pledgeId', 'targetAmount progress')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      RecurringPayment.countDocuments(query),
    ]);

    return c.json({
      success: true,
      data: {
        recurringPayments: payments,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Get all recurring payments (admin)
recurringPayments.get('/admin', authMiddleware, adminMiddleware, async (c) => {
  try {
    const { status, userId, frequency, page = '1', limit = '50' } = c.req.query();

    const query: any = {};
    if (status) query.status = status;
    if (userId) query.userId = userId;
    if (frequency) query.frequency = frequency;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [payments, total] = await Promise.all([
      RecurringPayment.find(query)
        .populate('userId', 'profile.firstName profile.lastName email')
        .populate('categoryId', 'name code')
        .sort({ 'schedule.nextPaymentDate': 1 })
        .skip(skip)
        .limit(parseInt(limit)),
      RecurringPayment.countDocuments(query),
    ]);

    return c.json({
      success: true,
      data: {
        recurringPayments: payments,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Get recurring payment by ID
recurringPayments.get('/:id', authMiddleware, async (c) => {
  try {
    const { id } = c.req.param();
    const user = c.get('user');

    const payment = await RecurringPayment.findOne({ _id: id, userId: user._id })
      .populate('categoryId', 'name code')
      .populate('pledgeId');

    if (!payment) {
      return c.json({ success: false, error: 'Recurring payment not found' }, 404);
    }

    return c.json({
      success: true,
      data: payment,
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Create recurring payment
recurringPayments.post('/', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();

    const {
      categoryId,
      pledgeId,
      amount,
      frequency,
      dayOfWeek,
      dayOfMonth,
      paymentMethod,
      startDate,
      endDate,
    } = body;

    // Calculate next payment date
    const start = new Date(startDate || Date.now());
    let nextPaymentDate = new Date(start);

    if (frequency === 'weekly' && dayOfWeek !== undefined) {
      while (nextPaymentDate.getDay() !== dayOfWeek) {
        nextPaymentDate.setDate(nextPaymentDate.getDate() + 1);
      }
    } else if (['monthly', 'quarterly', 'annually'].includes(frequency) && dayOfMonth) {
      nextPaymentDate.setDate(dayOfMonth);
      if (nextPaymentDate < start) {
        nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);
      }
    }

    const recurringPayment = new RecurringPayment({
      userId: user._id,
      categoryId,
      pledgeId,
      amount,
      currency: 'NGN',
      frequency,
      dayOfWeek,
      dayOfMonth,
      paymentMethod,
      schedule: {
        startDate: start,
        endDate: endDate ? new Date(endDate) : undefined,
        nextPaymentDate,
        totalPayments: 0,
        completedPayments: 0,
        failedPayments: 0,
      },
      status: 'active',
      history: [{
        date: new Date(),
        action: 'created',
      }],
    });

    await recurringPayment.save();

    return c.json({
      success: true,
      data: recurringPayment,
    }, 201);
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Update recurring payment
recurringPayments.put('/:id', authMiddleware, async (c) => {
  try {
    const { id } = c.req.param();
    const user = c.get('user');
    const body = await c.req.json();

    const payment = await RecurringPayment.findOne({ _id: id, userId: user._id });
    if (!payment) {
      return c.json({ success: false, error: 'Recurring payment not found' }, 404);
    }

    // Only allow certain fields to be updated
    const allowedUpdates = ['amount', 'dayOfWeek', 'dayOfMonth', 'notifications'];
    for (const key of Object.keys(body)) {
      if (allowedUpdates.includes(key)) {
        (payment as any)[key] = body[key];
      }
    }

    await payment.save();

    return c.json({
      success: true,
      data: payment,
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Pause recurring payment
recurringPayments.post('/:id/pause', authMiddleware, async (c) => {
  try {
    const { id } = c.req.param();
    const user = c.get('user');

    const payment = await RecurringPayment.findOne({ _id: id, userId: user._id });
    if (!payment) {
      return c.json({ success: false, error: 'Recurring payment not found' }, 404);
    }

    if (payment.status !== 'active') {
      return c.json({ success: false, error: 'Can only pause active payments' }, 400);
    }

    payment.status = 'paused';
    payment.history.push({
      date: new Date(),
      action: 'paused',
    });

    await payment.save();

    return c.json({
      success: true,
      data: payment,
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Resume recurring payment
recurringPayments.post('/:id/resume', authMiddleware, async (c) => {
  try {
    const { id } = c.req.param();
    const user = c.get('user');

    const payment = await RecurringPayment.findOne({ _id: id, userId: user._id });
    if (!payment) {
      return c.json({ success: false, error: 'Recurring payment not found' }, 404);
    }

    if (payment.status !== 'paused') {
      return c.json({ success: false, error: 'Can only resume paused payments' }, 400);
    }

    // Recalculate next payment date
    let nextPaymentDate = new Date();
    if (payment.frequency === 'weekly' && payment.dayOfWeek !== undefined) {
      while (nextPaymentDate.getDay() !== payment.dayOfWeek) {
        nextPaymentDate.setDate(nextPaymentDate.getDate() + 1);
      }
    } else if (payment.dayOfMonth) {
      nextPaymentDate.setDate(payment.dayOfMonth);
      if (nextPaymentDate < new Date()) {
        nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);
      }
    }

    payment.status = 'active';
    payment.schedule.nextPaymentDate = nextPaymentDate;
    payment.history.push({
      date: new Date(),
      action: 'resumed',
    });

    await payment.save();

    return c.json({
      success: true,
      data: payment,
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Cancel recurring payment
recurringPayments.post('/:id/cancel', authMiddleware, async (c) => {
  try {
    const { id } = c.req.param();
    const user = c.get('user');

    const payment = await RecurringPayment.findOne({ _id: id, userId: user._id });
    if (!payment) {
      return c.json({ success: false, error: 'Recurring payment not found' }, 404);
    }

    payment.status = 'cancelled';
    payment.history.push({
      date: new Date(),
      action: 'cancelled',
    });

    await payment.save();

    return c.json({
      success: true,
      message: 'Recurring payment cancelled',
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Process due payments (admin/cron endpoint)
recurringPayments.post('/process-due', authMiddleware, adminMiddleware, async (c) => {
  try {
    const now = new Date();

    // Find all due payments
    const duePayments = await RecurringPayment.find({
      status: 'active',
      'schedule.nextPaymentDate': { $lte: now },
    }).populate('userId');

    const results = {
      processed: 0,
      failed: 0,
      payments: [] as any[],
    };

    for (const payment of duePayments) {
      try {
        // Create transaction
        const transaction = new Transaction({
          userId: payment.userId,
          categoryId: payment.categoryId,
          pledgeId: payment.pledgeId,
          amount: payment.amount,
          currency: payment.currency,
          type: 'recurring',
          payment: {
            method: payment.paymentMethod.type,
            provider: payment.paymentMethod.provider,
            status: 'pending',
          },
          status: 'pending',
        });

        await transaction.save();

        // Update recurring payment schedule
        const nextDate = new Date(payment.schedule.nextPaymentDate);
        switch (payment.frequency) {
          case 'weekly':
            nextDate.setDate(nextDate.getDate() + 7);
            break;
          case 'biweekly':
            nextDate.setDate(nextDate.getDate() + 14);
            break;
          case 'monthly':
            nextDate.setMonth(nextDate.getMonth() + 1);
            break;
          case 'quarterly':
            nextDate.setMonth(nextDate.getMonth() + 3);
            break;
          case 'annually':
            nextDate.setFullYear(nextDate.getFullYear() + 1);
            break;
        }

        payment.schedule.nextPaymentDate = nextDate;
        payment.schedule.lastPaymentDate = now;
        payment.schedule.totalPayments += 1;
        payment.schedule.completedPayments += 1;
        payment.history.push({
          date: now,
          action: 'payment_success',
          transactionId: transaction._id,
          amount: payment.amount,
        });

        // Check if end date reached
        if (payment.schedule.endDate && nextDate > payment.schedule.endDate) {
          payment.status = 'completed';
        }

        await payment.save();

        results.processed++;
        results.payments.push({
          id: payment._id,
          transactionId: transaction._id,
          amount: payment.amount,
        });
      } catch (err: any) {
        payment.schedule.failedPayments += 1;
        payment.retryPolicy.currentRetries += 1;
        payment.history.push({
          date: now,
          action: 'payment_failed',
          error: err.message,
        });

        if (payment.retryPolicy.currentRetries >= payment.retryPolicy.maxRetries) {
          payment.status = 'failed';
        }

        await payment.save();
        results.failed++;
      }
    }

    return c.json({
      success: true,
      data: results,
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Get recurring payment stats (admin)
recurringPayments.get('/admin/stats', authMiddleware, adminMiddleware, async (c) => {
  try {
    const stats = await RecurringPayment.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
        },
      },
    ]);

    const upcomingPayments = await RecurringPayment.countDocuments({
      status: 'active',
      'schedule.nextPaymentDate': {
        $gte: new Date(),
        $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    return c.json({
      success: true,
      data: {
        byStatus: stats,
        upcomingThisWeek: upcomingPayments,
      },
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

export default recurringPayments;
