import { Hono } from 'hono';
import { Church, Group, Zone, User } from '../models';
import { authMiddleware, adminMiddleware } from '../middleware/auth';
import mongoose from 'mongoose';

const churches = new Hono();

// PUBLIC: Get churches by group for registration dropdown
// No auth required - used by mobile app registration
churches.get('/public', async (c) => {
  try {
    const { groupId } = c.req.query();

    if (!groupId) {
      return c.json({ success: false, error: 'groupId is required' }, 400);
    }

    const churchesList = await Church.find({ groupId, status: 'active' })
      .select('_id name code type')
      .sort({ name: 1 });

    return c.json({
      success: true,
      data: churchesList,
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Get all churches (admin)
churches.get('/', authMiddleware, adminMiddleware, async (c) => {
  try {
    const { status, type, groupId, zoneId, page = '1', limit = '20', search } = c.req.query();

    const query: any = {};
    if (status) query.status = status;
    if (type) query.type = type;
    if (groupId) query.groupId = groupId;
    if (zoneId) query.zoneId = zoneId;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
        { 'address.city': { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [churches, total] = await Promise.all([
      Church.find(query)
        .populate('groupId', 'name code')
        .populate('zoneId', 'name code')
        .populate('leadership.userId', 'profile.firstName profile.lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Church.countDocuments(query),
    ]);

    return c.json({
      success: true,
      data: {
        churches,
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

// Get church by ID
churches.get('/:id', authMiddleware, async (c) => {
  try {
    const { id } = c.req.param();

    const church = await Church.findById(id)
      .populate('groupId', 'name code')
      .populate('zoneId', 'name code')
      .populate('leadership.userId', 'profile.firstName profile.lastName email');

    if (!church) {
      return c.json({ success: false, error: 'Church not found' }, 404);
    }

    return c.json({
      success: true,
      data: church,
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Create church (admin)
churches.post('/', authMiddleware, adminMiddleware, async (c) => {
  try {
    const body = await c.req.json();

    // Check if code already exists
    const existing = await Church.findOne({ code: body.code?.toUpperCase() });
    if (existing) {
      return c.json({ success: false, error: 'Church code already exists' }, 400);
    }

    // Verify group exists
    const group = await Group.findById(body.groupId);
    if (!group) {
      return c.json({ success: false, error: 'Group not found' }, 400);
    }

    const church = new Church({
      ...body,
      code: body.code?.toUpperCase(),
      zoneId: group.zoneId,
    });

    await church.save();

    // Update group and zone stats
    await Promise.all([
      Group.findByIdAndUpdate(body.groupId, {
        $inc: { 'stats.churchCount': 1 },
      }),
      Zone.findByIdAndUpdate(group.zoneId, {
        $inc: { 'stats.churchCount': 1 },
      }),
    ]);

    return c.json({
      success: true,
      data: church,
    }, 201);
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Update church (admin)
churches.put('/:id', authMiddleware, adminMiddleware, async (c) => {
  try {
    const { id } = c.req.param();
    const body = await c.req.json();

    const church = await Church.findByIdAndUpdate(
      id,
      { $set: body },
      { new: true, runValidators: true }
    );

    if (!church) {
      return c.json({ success: false, error: 'Church not found' }, 404);
    }

    return c.json({
      success: true,
      data: church,
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Add leadership to church
churches.post('/:id/leadership', authMiddleware, adminMiddleware, async (c) => {
  try {
    const { id } = c.req.param();
    const { userId, role } = await c.req.json();

    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      return c.json({ success: false, error: 'User not found' }, 400);
    }

    const church = await Church.findByIdAndUpdate(
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

    if (!church) {
      return c.json({ success: false, error: 'Church not found' }, 404);
    }

    // Update user's church affiliation
    await User.findByIdAndUpdate(userId, {
      'churchAffiliation.churchId': church._id,
      'churchAffiliation.role': role,
    });

    return c.json({
      success: true,
      data: church,
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Remove leadership from church
churches.delete('/:id/leadership/:userId', authMiddleware, adminMiddleware, async (c) => {
  try {
    const { id, userId } = c.req.param();

    const church = await Church.findByIdAndUpdate(
      id,
      {
        $pull: {
          leadership: { userId: new mongoose.Types.ObjectId(userId) },
        },
      },
      { new: true }
    );

    if (!church) {
      return c.json({ success: false, error: 'Church not found' }, 404);
    }

    return c.json({
      success: true,
      data: church,
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Get church members
churches.get('/:id/members', authMiddleware, async (c) => {
  try {
    const { id } = c.req.param();
    const { page = '1', limit = '20', search } = c.req.query();

    const query: any = { 'churchAffiliation.churchId': id };
    if (search) {
      query.$or = [
        { 'profile.firstName': { $regex: search, $options: 'i' } },
        { 'profile.lastName': { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [members, total] = await Promise.all([
      User.find(query)
        .select('profile email phone churchAffiliation createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(query),
    ]);

    return c.json({
      success: true,
      data: {
        members,
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

// Get church statistics
churches.get('/:id/stats', authMiddleware, async (c) => {
  try {
    const { id } = c.req.param();

    const church = await Church.findById(id);
    if (!church) {
      return c.json({ success: false, error: 'Church not found' }, 404);
    }

    const memberCount = await User.countDocuments({ 'churchAffiliation.churchId': id });

    // Update stats
    church.stats.memberCount = memberCount;
    await church.save();

    return c.json({
      success: true,
      data: church.stats,
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Delete church (admin) - soft delete
churches.delete('/:id', authMiddleware, adminMiddleware, async (c) => {
  try {
    const { id } = c.req.param();

    const church = await Church.findById(id);
    if (!church) {
      return c.json({ success: false, error: 'Church not found' }, 404);
    }

    church.status = 'inactive';
    await church.save();

    // Update group and zone stats
    await Promise.all([
      Group.findByIdAndUpdate(church.groupId, {
        $inc: { 'stats.churchCount': -1 },
      }),
      Zone.findByIdAndUpdate(church.zoneId, {
        $inc: { 'stats.churchCount': -1 },
      }),
    ]);

    return c.json({
      success: true,
      message: 'Church deactivated successfully',
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

export default churches;
