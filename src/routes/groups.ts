import { Hono } from 'hono';
import { Group, Church, Zone } from '../models';
import { authMiddleware, adminMiddleware } from '../middleware/auth';
import mongoose from 'mongoose';

const groups = new Hono();

// PUBLIC: Get groups by zone for registration dropdown
// No auth required - used by mobile app registration
groups.get('/public', async (c) => {
  try {
    const { zoneId } = c.req.query();

    if (!zoneId) {
      return c.json({ success: false, error: 'zoneId is required' }, 400);
    }

    const groupsList = await Group.find({ zoneId, status: 'active' })
      .select('_id name code')
      .sort({ name: 1 });

    return c.json({
      success: true,
      data: groupsList,
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Get all groups (admin)
groups.get('/', authMiddleware, adminMiddleware, async (c) => {
  try {
    const { status, zoneId, page = '1', limit = '20', search } = c.req.query();

    const query: any = {};
    if (status) query.status = status;
    if (zoneId) query.zoneId = zoneId;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [groups, total] = await Promise.all([
      Group.find(query)
        .populate('zoneId', 'name code')
        .populate('leadership.userId', 'profile.firstName profile.lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Group.countDocuments(query),
    ]);

    return c.json({
      success: true,
      data: {
        groups,
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

// Get group by ID
groups.get('/:id', authMiddleware, async (c) => {
  try {
    const { id } = c.req.param();

    const group = await Group.findById(id)
      .populate('zoneId', 'name code')
      .populate('leadership.userId', 'profile.firstName profile.lastName email');

    if (!group) {
      return c.json({ success: false, error: 'Group not found' }, 404);
    }

    // Get churches in this group
    const churches = await Church.find({ groupId: id, status: 'active' })
      .select('name code type stats')
      .limit(20);

    return c.json({
      success: true,
      data: { group, churches },
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Create group (admin)
groups.post('/', authMiddleware, adminMiddleware, async (c) => {
  try {
    const body = await c.req.json();

    // Check if code already exists
    const existing = await Group.findOne({ code: body.code?.toUpperCase() });
    if (existing) {
      return c.json({ success: false, error: 'Group code already exists' }, 400);
    }

    // Verify zone exists
    const zone = await Zone.findById(body.zoneId);
    if (!zone) {
      return c.json({ success: false, error: 'Zone not found' }, 400);
    }

    const group = new Group({
      ...body,
      code: body.code?.toUpperCase(),
    });

    await group.save();

    // Update zone stats
    await Zone.findByIdAndUpdate(body.zoneId, {
      $inc: { 'stats.groupCount': 1 },
    });

    return c.json({
      success: true,
      data: group,
    }, 201);
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Update group (admin)
groups.put('/:id', authMiddleware, adminMiddleware, async (c) => {
  try {
    const { id } = c.req.param();
    const body = await c.req.json();

    const group = await Group.findByIdAndUpdate(
      id,
      { $set: body },
      { new: true, runValidators: true }
    );

    if (!group) {
      return c.json({ success: false, error: 'Group not found' }, 404);
    }

    return c.json({
      success: true,
      data: group,
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Add leadership to group
groups.post('/:id/leadership', authMiddleware, adminMiddleware, async (c) => {
  try {
    const { id } = c.req.param();
    const { userId, role } = await c.req.json();

    const group = await Group.findByIdAndUpdate(
      id,
      {
        $push: {
          leadership: {
            userId: new mongoose.Types.ObjectId(userId),
            role,
            assignedAt: new Date(),
          },
        },
      },
      { new: true }
    ).populate('leadership.userId', 'profile.firstName profile.lastName email');

    if (!group) {
      return c.json({ success: false, error: 'Group not found' }, 404);
    }

    return c.json({
      success: true,
      data: group,
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Remove leadership from group
groups.delete('/:id/leadership/:userId', authMiddleware, adminMiddleware, async (c) => {
  try {
    const { id, userId } = c.req.param();

    const group = await Group.findByIdAndUpdate(
      id,
      {
        $pull: {
          leadership: { userId: new mongoose.Types.ObjectId(userId) },
        },
      },
      { new: true }
    );

    if (!group) {
      return c.json({ success: false, error: 'Group not found' }, 404);
    }

    return c.json({
      success: true,
      data: group,
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Get group statistics
groups.get('/:id/stats', authMiddleware, async (c) => {
  try {
    const { id } = c.req.param();

    const group = await Group.findById(id);
    if (!group) {
      return c.json({ success: false, error: 'Group not found' }, 404);
    }

    const churchCount = await Church.countDocuments({ groupId: id, status: 'active' });

    // Update stats
    group.stats.churchCount = churchCount;
    await group.save();

    return c.json({
      success: true,
      data: group.stats,
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Delete group (admin) - soft delete
groups.delete('/:id', authMiddleware, adminMiddleware, async (c) => {
  try {
    const { id } = c.req.param();

    const group = await Group.findById(id);
    if (!group) {
      return c.json({ success: false, error: 'Group not found' }, 404);
    }

    // Check if group has churches
    const churchCount = await Church.countDocuments({ groupId: id, status: 'active' });
    if (churchCount > 0) {
      return c.json({
        success: false,
        error: 'Cannot delete group with active churches'
      }, 400);
    }

    group.status = 'inactive';
    await group.save();

    // Update zone stats
    await Zone.findByIdAndUpdate(group.zoneId, {
      $inc: { 'stats.groupCount': -1 },
    });

    return c.json({
      success: true,
      message: 'Group deactivated successfully',
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

export default groups;
