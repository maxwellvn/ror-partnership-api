import { Hono } from 'hono';
import { Campaign, Transaction, User } from '../models';
import { authMiddleware, adminMiddleware } from '../middleware/auth';
import mongoose from 'mongoose';

const campaigns = new Hono();

// Get active campaigns (public)
campaigns.get('/active', async (c) => {
  try {
    const { scope, page = '1', limit = '10' } = c.req.query();

    const now = new Date();
    const query: any = {
      status: 'active',
      'timeline.startDate': { $lte: now },
      'timeline.endDate': { $gte: now },
    };

    if (scope) query.scope = scope;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [activeCampaigns, total] = await Promise.all([
      Campaign.find(query)
        .select('name code description target progress timeline media settings.showProgress')
        .sort({ 'timeline.endDate': 1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Campaign.countDocuments(query),
    ]);

    return c.json({
      success: true,
      data: {
        campaigns: activeCampaigns,
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

// Get all campaigns (admin)
campaigns.get('/', authMiddleware, adminMiddleware, async (c) => {
  try {
    const { status, scope, page = '1', limit = '20', search } = c.req.query();

    const query: any = {};
    if (status) query.status = status;
    if (scope) query.scope = scope;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [allCampaigns, total] = await Promise.all([
      Campaign.find(query)
        .populate('createdBy', 'profile.firstName profile.lastName')
        .populate('categoryId', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Campaign.countDocuments(query),
    ]);

    return c.json({
      success: true,
      data: {
        campaigns: allCampaigns,
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

// Get campaign by ID or code
campaigns.get('/:idOrCode', async (c) => {
  try {
    const { idOrCode } = c.req.param();

    let campaign;
    if (mongoose.Types.ObjectId.isValid(idOrCode)) {
      campaign = await Campaign.findById(idOrCode)
        .populate('categoryId', 'name code')
        .populate('updates.postedBy', 'profile.firstName profile.lastName');
    } else {
      campaign = await Campaign.findOne({ code: idOrCode.toUpperCase() })
        .populate('categoryId', 'name code')
        .populate('updates.postedBy', 'profile.firstName profile.lastName');
    }

    if (!campaign) {
      return c.json({ success: false, error: 'Campaign not found' }, 404);
    }

    return c.json({
      success: true,
      data: campaign,
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Create campaign (admin)
campaigns.post('/', authMiddleware, adminMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();

    // Check if code already exists
    const existing = await Campaign.findOne({ code: body.code?.toUpperCase() });
    if (existing) {
      return c.json({ success: false, error: 'Campaign code already exists' }, 400);
    }

    const campaign = new Campaign({
      ...body,
      code: body.code?.toUpperCase(),
      createdBy: user._id,
      progress: {
        currentAmount: 0,
        partnerCount: 0,
        transactionCount: 0,
        percentComplete: 0,
      },
    });

    await campaign.save();

    return c.json({
      success: true,
      data: campaign,
    }, 201);
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Update campaign (admin)
campaigns.put('/:id', authMiddleware, adminMiddleware, async (c) => {
  try {
    const { id } = c.req.param();
    const body = await c.req.json();

    // Don't allow updating certain fields
    delete body.progress;
    delete body.createdBy;
    delete body.code;

    const campaign = await Campaign.findByIdAndUpdate(
      id,
      { $set: body },
      { new: true, runValidators: true }
    );

    if (!campaign) {
      return c.json({ success: false, error: 'Campaign not found' }, 404);
    }

    return c.json({
      success: true,
      data: campaign,
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Add campaign update (admin)
campaigns.post('/:id/updates', authMiddleware, adminMiddleware, async (c) => {
  try {
    const { id } = c.req.param();
    const user = c.get('user');
    const { title, content } = await c.req.json();

    const campaign = await Campaign.findByIdAndUpdate(
      id,
      {
        $push: {
          updates: {
            title,
            content,
            postedAt: new Date(),
            postedBy: user._id,
          },
        },
      },
      { new: true }
    );

    if (!campaign) {
      return c.json({ success: false, error: 'Campaign not found' }, 404);
    }

    return c.json({
      success: true,
      data: campaign,
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Contribute to campaign
campaigns.post('/:id/contribute', authMiddleware, async (c) => {
  try {
    const { id } = c.req.param();
    const user = c.get('user');
    const { amount } = await c.req.json();

    const campaign = await Campaign.findById(id);
    if (!campaign) {
      return c.json({ success: false, error: 'Campaign not found' }, 404);
    }

    if (campaign.status !== 'active') {
      return c.json({ success: false, error: 'Campaign is not active' }, 400);
    }

    // Check min/max amounts
    if (campaign.settings.minimumAmount && amount < campaign.settings.minimumAmount) {
      return c.json({
        success: false,
        error: `Minimum contribution is ${campaign.settings.minimumAmount}`
      }, 400);
    }

    if (campaign.settings.maximumAmount && amount > campaign.settings.maximumAmount) {
      return c.json({
        success: false,
        error: `Maximum contribution is ${campaign.settings.maximumAmount}`
      }, 400);
    }

    // Create transaction
    const transaction = new Transaction({
      userId: user._id,
      categoryId: campaign.categoryId,
      campaignId: campaign._id,
      amount,
      currency: campaign.target.currency,
      type: 'one-time',
      payment: {
        method: 'card',
        provider: 'paystack',
        status: 'pending',
      },
      status: 'pending',
    });

    await transaction.save();

    return c.json({
      success: true,
      data: {
        transaction,
        message: 'Proceed to payment',
      },
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Update campaign progress (called after successful payment)
campaigns.put('/:id/progress', authMiddleware, adminMiddleware, async (c) => {
  try {
    const { id } = c.req.param();
    const { amount, isNewPartner } = await c.req.json();

    const campaign = await Campaign.findById(id);
    if (!campaign) {
      return c.json({ success: false, error: 'Campaign not found' }, 404);
    }

    campaign.progress.currentAmount += amount;
    campaign.progress.transactionCount += 1;
    if (isNewPartner) {
      campaign.progress.partnerCount += 1;
    }
    campaign.progress.percentComplete = Math.min(
      100,
      (campaign.progress.currentAmount / campaign.target.amount) * 100
    );

    // Check milestones
    for (const milestone of campaign.milestones) {
      if (!milestone.reachedAt && campaign.progress.currentAmount >= milestone.amount) {
        milestone.reachedAt = new Date();
      }
    }

    // Check if campaign is completed
    if (campaign.progress.currentAmount >= campaign.target.amount) {
      campaign.status = 'completed';
    }

    await campaign.save();

    return c.json({
      success: true,
      data: campaign.progress,
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Extend campaign (admin)
campaigns.post('/:id/extend', authMiddleware, adminMiddleware, async (c) => {
  try {
    const { id } = c.req.param();
    const { newEndDate } = await c.req.json();

    const campaign = await Campaign.findById(id);
    if (!campaign) {
      return c.json({ success: false, error: 'Campaign not found' }, 404);
    }

    if (!campaign.timeline.isExtended) {
      campaign.timeline.originalEndDate = campaign.timeline.endDate;
    }
    campaign.timeline.endDate = new Date(newEndDate);
    campaign.timeline.isExtended = true;

    if (campaign.status === 'completed') {
      campaign.status = 'active';
    }

    await campaign.save();

    return c.json({
      success: true,
      data: campaign,
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Change campaign status (admin)
campaigns.put('/:id/status', authMiddleware, adminMiddleware, async (c) => {
  try {
    const { id } = c.req.param();
    const { status } = await c.req.json();

    const campaign = await Campaign.findByIdAndUpdate(
      id,
      { $set: { status } },
      { new: true }
    );

    if (!campaign) {
      return c.json({ success: false, error: 'Campaign not found' }, 404);
    }

    return c.json({
      success: true,
      data: campaign,
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Get campaign contributors
campaigns.get('/:id/contributors', authMiddleware, async (c) => {
  try {
    const { id } = c.req.param();
    const { page = '1', limit = '20' } = c.req.query();

    const campaign = await Campaign.findById(id);
    if (!campaign) {
      return c.json({ success: false, error: 'Campaign not found' }, 404);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [transactions, total] = await Promise.all([
      Transaction.find({ campaignId: id, status: 'completed' })
        .populate('userId', campaign.settings.showDonorNames
          ? 'profile.firstName profile.lastName'
          : '_id')
        .select('amount createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Transaction.countDocuments({ campaignId: id, status: 'completed' }),
    ]);

    return c.json({
      success: true,
      data: {
        contributors: transactions,
        showNames: campaign.settings.showDonorNames,
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

// Get campaign stats (admin)
campaigns.get('/admin/stats', authMiddleware, adminMiddleware, async (c) => {
  try {
    const stats = await Campaign.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalTarget: { $sum: '$target.amount' },
          totalRaised: { $sum: '$progress.currentAmount' },
        },
      },
    ]);

    const activeCampaigns = await Campaign.find({ status: 'active' })
      .select('name progress.percentComplete timeline.endDate')
      .sort({ 'progress.percentComplete': -1 })
      .limit(5);

    return c.json({
      success: true,
      data: {
        byStatus: stats,
        topActiveCampaigns: activeCampaigns,
      },
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

export default campaigns;
