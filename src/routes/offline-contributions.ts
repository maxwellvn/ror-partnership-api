import { Hono } from 'hono';
import { OfflineContribution, Transaction, Pledge, User, Church, Notification } from '../models';
import { authMiddleware, adminMiddleware } from '../middleware/auth';
import mongoose from 'mongoose';

const offlineContributions = new Hono();

// Get user's offline contributions
offlineContributions.get('/', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const { status, page = '1', limit = '20' } = c.req.query();

    const query: any = { userId: user._id };
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [contributions, total] = await Promise.all([
      OfflineContribution.find(query)
        .populate('categoryId', 'name code')
        .populate('churchId', 'name code')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      OfflineContribution.countDocuments(query),
    ]);

    return c.json({
      success: true,
      data: {
        contributions,
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

// Get pending approvals (admin/church leader)
offlineContributions.get('/pending', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const { churchId, page = '1', limit = '20' } = c.req.query();

    // Build query based on user role
    const query: any = { 'approval.status': 'pending' };

    if (user.role !== 'admin' && user.role !== 'superadmin') {
      // Church leaders can only see their church's contributions
      if (user.churchAffiliation?.churchId) {
        query.churchId = user.churchAffiliation.churchId;
      } else {
        return c.json({ success: false, error: 'No church affiliation found' }, 403);
      }
    } else if (churchId) {
      query.churchId = churchId;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [contributions, total] = await Promise.all([
      OfflineContribution.find(query)
        .populate('userId', 'profile.firstName profile.lastName email')
        .populate('categoryId', 'name code')
        .populate('churchId', 'name code')
        .populate('recordedBy', 'profile.firstName profile.lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      OfflineContribution.countDocuments(query),
    ]);

    return c.json({
      success: true,
      data: {
        contributions,
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

// Get all offline contributions (admin)
offlineContributions.get('/admin', authMiddleware, adminMiddleware, async (c) => {
  try {
    const { status, churchId, approvalStatus, page = '1', limit = '50' } = c.req.query();

    const query: any = {};
    if (status) query.status = status;
    if (churchId) query.churchId = churchId;
    if (approvalStatus) query['approval.status'] = approvalStatus;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [contributions, total] = await Promise.all([
      OfflineContribution.find(query)
        .populate('userId', 'profile.firstName profile.lastName email')
        .populate('categoryId', 'name code')
        .populate('churchId', 'name code')
        .populate('recordedBy', 'profile.firstName profile.lastName')
        .populate('approval.approvedBy', 'profile.firstName profile.lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      OfflineContribution.countDocuments(query),
    ]);

    return c.json({
      success: true,
      data: {
        contributions,
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

// Get offline contribution by ID
offlineContributions.get('/:id', authMiddleware, async (c) => {
  try {
    const { id } = c.req.param();

    const contribution = await OfflineContribution.findById(id)
      .populate('userId', 'profile.firstName profile.lastName email phone')
      .populate('categoryId', 'name code')
      .populate('churchId', 'name code')
      .populate('pledgeId')
      .populate('recordedBy', 'profile.firstName profile.lastName')
      .populate('approval.approvedBy', 'profile.firstName profile.lastName')
      .populate('approval.rejectedBy', 'profile.firstName profile.lastName')
      .populate('verification.verifiedBy', 'profile.firstName profile.lastName');

    if (!contribution) {
      return c.json({ success: false, error: 'Contribution not found' }, 404);
    }

    return c.json({
      success: true,
      data: contribution,
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Record offline contribution (church leader or admin)
offlineContributions.post('/', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();

    const {
      userId,
      categoryId,
      pledgeId,
      campaignId,
      churchId,
      amount,
      paymentMethod,
      paymentDetails,
      contributionDate,
      metadata,
    } = body;

    // Verify church exists
    const church = await Church.findById(churchId);
    if (!church) {
      return c.json({ success: false, error: 'Church not found' }, 400);
    }

    // Check if user has permission to record for this church
    const isAdmin = user.role === 'admin' || user.role === 'superadmin';
    const isChurchLeader = church.leadership.some(
      l => l.userId.toString() === user._id.toString()
    );

    if (!isAdmin && !isChurchLeader) {
      return c.json({
        success: false,
        error: 'Not authorized to record contributions for this church'
      }, 403);
    }

    const contribution = new OfflineContribution({
      userId,
      categoryId,
      pledgeId,
      campaignId,
      churchId,
      amount,
      currency: 'NGN',
      paymentMethod,
      paymentDetails,
      recordedBy: user._id,
      recordedAt: new Date(),
      contributionDate: new Date(contributionDate),
      status: 'submitted',
      metadata,
    });

    await contribution.save();

    // Create notification for admins
    const admins = await User.find({ role: { $in: ['admin', 'superadmin'] } }).select('_id');
    const notifications = admins.map(admin => ({
      userId: admin._id,
      type: 'approval',
      title: 'New Offline Contribution',
      message: `A new offline contribution of ${amount} NGN needs approval`,
      data: {
        entityType: 'OfflineContribution',
        entityId: contribution._id,
      },
      priority: 'normal',
      channels: { inApp: true },
      status: 'sent',
    }));

    await Notification.insertMany(notifications);

    return c.json({
      success: true,
      data: contribution,
    }, 201);
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Approve offline contribution
offlineContributions.post('/:id/approve', authMiddleware, async (c) => {
  try {
    const { id } = c.req.param();
    const user = c.get('user');
    const { comments } = await c.req.json();

    const contribution = await OfflineContribution.findById(id);
    if (!contribution) {
      return c.json({ success: false, error: 'Contribution not found' }, 404);
    }

    if (contribution.approval.status !== 'pending') {
      return c.json({ success: false, error: 'Contribution already processed' }, 400);
    }

    // Check permission
    const isAdmin = user.role === 'admin' || user.role === 'superadmin';
    const church = await Church.findById(contribution.churchId);
    const isChurchLeader = church?.leadership.some(
      l => l.userId.toString() === user._id.toString() &&
          (l.role === 'pastor' || l.role === 'admin')
    );

    if (!isAdmin && !isChurchLeader) {
      return c.json({ success: false, error: 'Not authorized to approve' }, 403);
    }

    // Update contribution
    contribution.approval.status = 'approved';
    contribution.approval.approvedBy = user._id;
    contribution.approval.approvedAt = new Date();
    contribution.approval.comments = comments;
    contribution.status = 'approved';

    await contribution.save();

    // Create transaction record
    const transaction = new Transaction({
      userId: contribution.userId,
      categoryId: contribution.categoryId,
      pledgeId: contribution.pledgeId,
      campaignId: contribution.campaignId,
      amount: contribution.amount,
      currency: contribution.currency,
      type: 'offline',
      payment: {
        method: contribution.paymentMethod,
        provider: 'offline',
        status: 'completed',
      },
      attribution: {
        churchId: contribution.churchId,
      },
      status: 'completed',
    });

    await transaction.save();

    // Update contribution sync status
    contribution.syncStatus.isSynced = true;
    contribution.syncStatus.syncedAt = new Date();
    contribution.syncStatus.transactionId = transaction._id;
    contribution.status = 'synced';
    await contribution.save();

    // Update pledge progress if applicable
    if (contribution.pledgeId) {
      await Pledge.findByIdAndUpdate(contribution.pledgeId, {
        $inc: { 'progress.paidAmount': contribution.amount },
      });
    }

    // Notify contributor
    await Notification.create({
      userId: contribution.userId,
      type: 'payment',
      title: 'Contribution Approved',
      message: `Your offline contribution of ${contribution.amount} NGN has been approved`,
      data: {
        entityType: 'Transaction',
        entityId: transaction._id,
      },
      priority: 'normal',
      channels: { inApp: true },
      status: 'sent',
    });

    return c.json({
      success: true,
      data: { contribution, transaction },
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Reject offline contribution
offlineContributions.post('/:id/reject', authMiddleware, async (c) => {
  try {
    const { id } = c.req.param();
    const user = c.get('user');
    const { reason } = await c.req.json();

    if (!reason) {
      return c.json({ success: false, error: 'Rejection reason required' }, 400);
    }

    const contribution = await OfflineContribution.findById(id);
    if (!contribution) {
      return c.json({ success: false, error: 'Contribution not found' }, 404);
    }

    if (contribution.approval.status !== 'pending') {
      return c.json({ success: false, error: 'Contribution already processed' }, 400);
    }

    // Check permission
    const isAdmin = user.role === 'admin' || user.role === 'superadmin';
    const church = await Church.findById(contribution.churchId);
    const isChurchLeader = church?.leadership.some(
      l => l.userId.toString() === user._id.toString() &&
          (l.role === 'pastor' || l.role === 'admin')
    );

    if (!isAdmin && !isChurchLeader) {
      return c.json({ success: false, error: 'Not authorized to reject' }, 403);
    }

    contribution.approval.status = 'rejected';
    contribution.approval.rejectedBy = user._id;
    contribution.approval.rejectedAt = new Date();
    contribution.approval.rejectionReason = reason;
    contribution.status = 'rejected';

    await contribution.save();

    // Notify contributor
    await Notification.create({
      userId: contribution.userId,
      type: 'payment',
      title: 'Contribution Rejected',
      message: `Your offline contribution of ${contribution.amount} NGN was rejected: ${reason}`,
      priority: 'high',
      channels: { inApp: true, email: true },
      status: 'sent',
    });

    return c.json({
      success: true,
      data: contribution,
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Verify offline contribution (add verification info)
offlineContributions.post('/:id/verify', authMiddleware, async (c) => {
  try {
    const { id } = c.req.param();
    const user = c.get('user');
    const { verificationMethod, comments } = await c.req.json();

    const contribution = await OfflineContribution.findById(id);
    if (!contribution) {
      return c.json({ success: false, error: 'Contribution not found' }, 404);
    }

    contribution.verification.isVerified = true;
    contribution.verification.verifiedBy = user._id;
    contribution.verification.verifiedAt = new Date();
    contribution.verification.verificationMethod = verificationMethod;

    await contribution.save();

    return c.json({
      success: true,
      data: contribution,
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Add attachment to contribution
offlineContributions.post('/:id/attachments', authMiddleware, async (c) => {
  try {
    const { id } = c.req.param();
    const { type, url } = await c.req.json();

    const contribution = await OfflineContribution.findByIdAndUpdate(
      id,
      {
        $push: {
          'verification.attachments': {
            type,
            url,
            uploadedAt: new Date(),
          },
        },
      },
      { new: true }
    );

    if (!contribution) {
      return c.json({ success: false, error: 'Contribution not found' }, 404);
    }

    return c.json({
      success: true,
      data: contribution,
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Get offline contribution stats (admin)
offlineContributions.get('/admin/stats', authMiddleware, adminMiddleware, async (c) => {
  try {
    const stats = await OfflineContribution.aggregate([
      {
        $group: {
          _id: '$approval.status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
        },
      },
    ]);

    const pendingCount = await OfflineContribution.countDocuments({
      'approval.status': 'pending'
    });

    const byChurch = await OfflineContribution.aggregate([
      { $match: { 'approval.status': 'approved' } },
      {
        $group: {
          _id: '$churchId',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
        },
      },
      { $sort: { totalAmount: -1 } },
      { $limit: 10 },
    ]);

    return c.json({
      success: true,
      data: {
        byStatus: stats,
        pendingCount,
        topChurches: byChurch,
      },
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

export default offlineContributions;
