import { Hono } from 'hono';
import { Notification, User } from '../models';
import { authMiddleware, adminMiddleware } from '../middleware/auth';
import mongoose from 'mongoose';

const notifications = new Hono();

// Get user's notifications
notifications.get('/', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const { status, type, page = '1', limit = '20' } = c.req.query();

    const query: any = { userId: user._id };
    if (status) query.status = status;
    if (type) query.type = type;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [notifs, total, unreadCount] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Notification.countDocuments(query),
      Notification.countDocuments({ userId: user._id, status: { $ne: 'read' } }),
    ]);

    return c.json({
      success: true,
      data: {
        notifications: notifs,
        unreadCount,
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

// Get all notifications (admin)
notifications.get('/admin', authMiddleware, adminMiddleware, async (c) => {
  try {
    const { status, type, userId, page = '1', limit = '50' } = c.req.query();

    const query: any = {};
    if (status) query.status = status;
    if (type) query.type = type;
    if (userId) query.userId = userId;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [notifs, total] = await Promise.all([
      Notification.find(query)
        .populate('userId', 'profile.firstName profile.lastName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Notification.countDocuments(query),
    ]);

    return c.json({
      success: true,
      data: {
        notifications: notifs,
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

// Get notification by ID
notifications.get('/:id', authMiddleware, async (c) => {
  try {
    const { id } = c.req.param();
    const user = c.get('user');

    const notification = await Notification.findOne({ _id: id, userId: user._id });
    if (!notification) {
      return c.json({ success: false, error: 'Notification not found' }, 404);
    }

    return c.json({
      success: true,
      data: notification,
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Mark notification as read
notifications.put('/:id/read', authMiddleware, async (c) => {
  try {
    const { id } = c.req.param();
    const user = c.get('user');

    const notification = await Notification.findOneAndUpdate(
      { _id: id, userId: user._id },
      {
        $set: {
          status: 'read',
          readAt: new Date(),
        }
      },
      { new: true }
    );

    if (!notification) {
      return c.json({ success: false, error: 'Notification not found' }, 404);
    }

    return c.json({
      success: true,
      data: notification,
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Mark all notifications as read
notifications.put('/read-all', authMiddleware, async (c) => {
  try {
    const user = c.get('user');

    await Notification.updateMany(
      { userId: user._id, status: { $ne: 'read' } },
      {
        $set: {
          status: 'read',
          readAt: new Date(),
        }
      }
    );

    return c.json({
      success: true,
      message: 'All notifications marked as read',
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Create notification (admin or system)
notifications.post('/', authMiddleware, adminMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const { userId, userIds, type, title, message, data, priority, channels } = body;

    // Single user notification
    if (userId) {
      const notification = new Notification({
        userId,
        type,
        title,
        message,
        data,
        priority: priority || 'normal',
        channels: channels || { inApp: true },
        status: 'sent',
        delivery: { inAppSentAt: new Date() },
      });

      await notification.save();

      return c.json({
        success: true,
        data: notification,
      }, 201);
    }

    // Bulk notification
    if (userIds && Array.isArray(userIds)) {
      const notifications = userIds.map(uid => ({
        userId: new mongoose.Types.ObjectId(uid),
        type,
        title,
        message,
        data,
        priority: priority || 'normal',
        channels: channels || { inApp: true },
        status: 'sent',
        delivery: { inAppSentAt: new Date() },
      }));

      await Notification.insertMany(notifications);

      return c.json({
        success: true,
        message: `${notifications.length} notifications created`,
      }, 201);
    }

    return c.json({ success: false, error: 'userId or userIds required' }, 400);
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Send announcement to all users (admin)
notifications.post('/announcement', authMiddleware, adminMiddleware, async (c) => {
  try {
    const { title, message, priority, expiresAt } = await c.req.json();

    const users = await User.find({ status: 'active' }).select('_id');

    const notifications = users.map(user => ({
      userId: user._id,
      type: 'announcement',
      title,
      message,
      priority: priority || 'normal',
      channels: { inApp: true },
      status: 'sent',
      delivery: { inAppSentAt: new Date() },
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    }));

    await Notification.insertMany(notifications);

    return c.json({
      success: true,
      message: `Announcement sent to ${users.length} users`,
    }, 201);
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Delete notification
notifications.delete('/:id', authMiddleware, async (c) => {
  try {
    const { id } = c.req.param();
    const user = c.get('user');

    const notification = await Notification.findOneAndDelete({
      _id: id,
      userId: user._id
    });

    if (!notification) {
      return c.json({ success: false, error: 'Notification not found' }, 404);
    }

    return c.json({
      success: true,
      message: 'Notification deleted',
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Get notification stats (admin)
notifications.get('/admin/stats', authMiddleware, adminMiddleware, async (c) => {
  try {
    const stats = await Notification.aggregate([
      {
        $group: {
          _id: '$type',
          total: { $sum: 1 },
          read: { $sum: { $cond: [{ $eq: ['$status', 'read'] }, 1, 0] } },
          unread: { $sum: { $cond: [{ $ne: ['$status', 'read'] }, 1, 0] } },
        },
      },
    ]);

    const totalUnread = await Notification.countDocuments({ status: { $ne: 'read' } });

    return c.json({
      success: true,
      data: {
        byType: stats,
        totalUnread,
      },
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

export default notifications;
