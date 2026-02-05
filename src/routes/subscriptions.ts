import { Hono } from 'hono';
import { Subscription, Church, Group, Zone } from '../models';
import { authMiddleware, adminMiddleware } from '../middleware/auth';

const subscriptions = new Hono();

// Subscription tier features
const tierFeatures = {
  basic: {
    maxMembers: 100,
    maxAdmins: 3,
    analyticsAccess: false,
    customBranding: false,
    apiAccess: false,
    prioritySupport: false,
    offlineMode: false,
    bulkImport: false,
  },
  standard: {
    maxMembers: 500,
    maxAdmins: 10,
    analyticsAccess: true,
    customBranding: false,
    apiAccess: false,
    prioritySupport: false,
    offlineMode: true,
    bulkImport: true,
  },
  premium: {
    maxMembers: 2000,
    maxAdmins: 25,
    analyticsAccess: true,
    customBranding: true,
    apiAccess: true,
    prioritySupport: true,
    offlineMode: true,
    bulkImport: true,
  },
  enterprise: {
    maxMembers: -1, // unlimited
    maxAdmins: -1,
    analyticsAccess: true,
    customBranding: true,
    apiAccess: true,
    prioritySupport: true,
    offlineMode: true,
    bulkImport: true,
  },
};

const tierPricing = {
  basic: { monthly: 5000, quarterly: 13500, annually: 48000 },
  standard: { monthly: 15000, quarterly: 40500, annually: 144000 },
  premium: { monthly: 35000, quarterly: 94500, annually: 336000 },
  enterprise: { monthly: 100000, quarterly: 270000, annually: 960000 },
};

// Get all subscriptions (admin)
subscriptions.get('/', authMiddleware, adminMiddleware, async (c) => {
  try {
    const { status, tier, entityType, page = '1', limit = '20' } = c.req.query();

    const query: any = {};
    if (status) query.status = status;
    if (tier) query.tier = tier;
    if (entityType) query.entityType = entityType;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [subs, total] = await Promise.all([
      Subscription.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Subscription.countDocuments(query),
    ]);

    return c.json({
      success: true,
      data: {
        subscriptions: subs,
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

// Get subscription plans/tiers
subscriptions.get('/plans', async (c) => {
  return c.json({
    success: true,
    data: {
      tiers: Object.keys(tierFeatures),
      features: tierFeatures,
      pricing: tierPricing,
    },
  });
});

// Get subscription by ID
subscriptions.get('/:id', authMiddleware, async (c) => {
  try {
    const { id } = c.req.param();

    const subscription = await Subscription.findById(id);
    if (!subscription) {
      return c.json({ success: false, error: 'Subscription not found' }, 404);
    }

    return c.json({
      success: true,
      data: subscription,
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Get subscription for entity
subscriptions.get('/entity/:entityType/:entityId', authMiddleware, async (c) => {
  try {
    const { entityType, entityId } = c.req.param();

    const subscription = await Subscription.findOne({
      entityType,
      entityId,
      status: { $in: ['active', 'trial'] },
    });

    return c.json({
      success: true,
      data: subscription,
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Create subscription (admin)
subscriptions.post('/', authMiddleware, adminMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const { tier, entityType, entityId, billingCycle = 'monthly', startTrial = false } = body;

    // Verify entity exists
    let entity;
    switch (entityType) {
      case 'church':
        entity = await Church.findById(entityId);
        break;
      case 'group':
        entity = await Group.findById(entityId);
        break;
      case 'zone':
        entity = await Zone.findById(entityId);
        break;
    }

    if (!entity) {
      return c.json({ success: false, error: `${entityType} not found` }, 400);
    }

    // Check for existing active subscription
    const existing = await Subscription.findOne({
      entityType,
      entityId,
      status: { $in: ['active', 'trial'] },
    });

    if (existing) {
      return c.json({ success: false, error: 'Entity already has an active subscription' }, 400);
    }

    const features = tierFeatures[tier as keyof typeof tierFeatures];
    const pricing = tierPricing[tier as keyof typeof tierPricing];

    const startDate = new Date();
    let endDate = new Date();
    let status = 'active';

    if (startTrial) {
      status = 'trial';
      endDate.setDate(endDate.getDate() + 14); // 14-day trial
    } else {
      switch (billingCycle) {
        case 'monthly':
          endDate.setMonth(endDate.getMonth() + 1);
          break;
        case 'quarterly':
          endDate.setMonth(endDate.getMonth() + 3);
          break;
        case 'annually':
          endDate.setFullYear(endDate.getFullYear() + 1);
          break;
      }
    }

    const subscription = new Subscription({
      name: `${tier.charAt(0).toUpperCase() + tier.slice(1)} Plan`,
      tier,
      entityType,
      entityId,
      pricing: {
        amount: pricing[billingCycle as keyof typeof pricing],
        currency: 'NGN',
        billingCycle,
      },
      features,
      status,
      trial: startTrial ? {
        isTrialPeriod: true,
        trialStartDate: startDate,
        trialEndDate: endDate,
      } : { isTrialPeriod: false },
      billing: {
        nextPaymentDate: endDate,
        autoRenew: true,
      },
      startDate,
      endDate,
      history: [{
        action: 'created',
        toTier: tier,
        date: new Date(),
      }],
    });

    await subscription.save();

    // Update entity subscription reference
    switch (entityType) {
      case 'church':
        await Church.findByIdAndUpdate(entityId, {
          'subscription.tier': tier,
          'subscription.status': status,
          'subscription.startDate': startDate,
          'subscription.endDate': endDate,
          'subscription.subscriptionId': subscription._id,
        });
        break;
      case 'group':
        await Group.findByIdAndUpdate(entityId, {
          'subscription.tier': tier,
          'subscription.status': status,
          'subscription.startDate': startDate,
          'subscription.endDate': endDate,
          'subscription.subscriptionId': subscription._id,
        });
        break;
      case 'zone':
        await Zone.findByIdAndUpdate(entityId, {
          'subscription.tier': tier,
          'subscription.status': status,
          'subscription.startDate': startDate,
          'subscription.endDate': endDate,
          'subscription.subscriptionId': subscription._id,
        });
        break;
    }

    return c.json({
      success: true,
      data: subscription,
    }, 201);
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Upgrade/downgrade subscription
subscriptions.put('/:id/change-tier', authMiddleware, adminMiddleware, async (c) => {
  try {
    const { id } = c.req.param();
    const { newTier, reason } = await c.req.json();

    const subscription = await Subscription.findById(id);
    if (!subscription) {
      return c.json({ success: false, error: 'Subscription not found' }, 404);
    }

    const oldTier = subscription.tier;
    const action = tierFeatures[newTier as keyof typeof tierFeatures].maxMembers >
                   tierFeatures[oldTier as keyof typeof tierFeatures].maxMembers
                   ? 'upgraded' : 'downgraded';

    subscription.tier = newTier;
    subscription.features = tierFeatures[newTier as keyof typeof tierFeatures];
    subscription.pricing.amount = tierPricing[newTier as keyof typeof tierPricing][
      subscription.pricing.billingCycle as keyof typeof tierPricing.basic
    ];
    subscription.history.push({
      action,
      fromTier: oldTier,
      toTier: newTier,
      date: new Date(),
      reason,
    });

    await subscription.save();

    return c.json({
      success: true,
      data: subscription,
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Renew subscription
subscriptions.post('/:id/renew', authMiddleware, adminMiddleware, async (c) => {
  try {
    const { id } = c.req.param();

    const subscription = await Subscription.findById(id);
    if (!subscription) {
      return c.json({ success: false, error: 'Subscription not found' }, 404);
    }

    const newEndDate = new Date(subscription.endDate || new Date());
    switch (subscription.pricing.billingCycle) {
      case 'monthly':
        newEndDate.setMonth(newEndDate.getMonth() + 1);
        break;
      case 'quarterly':
        newEndDate.setMonth(newEndDate.getMonth() + 3);
        break;
      case 'annually':
        newEndDate.setFullYear(newEndDate.getFullYear() + 1);
        break;
    }

    subscription.status = 'active';
    subscription.endDate = newEndDate;
    subscription.billing.lastPaymentDate = new Date();
    subscription.billing.nextPaymentDate = newEndDate;
    subscription.trial.isTrialPeriod = false;
    subscription.history.push({
      action: 'renewed',
      date: new Date(),
    });

    await subscription.save();

    return c.json({
      success: true,
      data: subscription,
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Cancel subscription
subscriptions.post('/:id/cancel', authMiddleware, adminMiddleware, async (c) => {
  try {
    const { id } = c.req.param();
    const { reason } = await c.req.json();

    const subscription = await Subscription.findById(id);
    if (!subscription) {
      return c.json({ success: false, error: 'Subscription not found' }, 404);
    }

    subscription.status = 'cancelled';
    subscription.billing.autoRenew = false;
    subscription.history.push({
      action: 'cancelled',
      date: new Date(),
      reason,
    });

    await subscription.save();

    return c.json({
      success: true,
      message: 'Subscription cancelled successfully',
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

export default subscriptions;
