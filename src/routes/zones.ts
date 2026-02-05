import { Hono } from 'hono';
import { Zone, Group, Church } from '../models';
import { authMiddleware, adminMiddleware } from '../middleware/auth';
import mongoose from 'mongoose';

const zones = new Hono();

// PUBLIC: Get all active zones for registration dropdown
// No auth required - used by mobile app registration
zones.get('/public', async (c) => {
  try {
    const zonesList = await Zone.find({ status: 'active' })
      .select('_id name code')
      .sort({ name: 1 });

    return c.json({
      success: true,
      data: zonesList,
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Get all zones (admin)
zones.get('/', authMiddleware, adminMiddleware, async (c) => {
  try {
    const { status, country, page = '1', limit = '20', search } = c.req.query();

    const query: any = {};
    if (status) query.status = status;
    if (country) query['location.country'] = country;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [zones, total] = await Promise.all([
      Zone.find(query)
        .populate('rzmId', 'profile.firstName profile.lastName email')
        .populate('leadership.userId', 'profile.firstName profile.lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Zone.countDocuments(query),
    ]);

    return c.json({
      success: true,
      data: {
        zones,
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

// Get zone by ID
zones.get('/:id', authMiddleware, async (c) => {
  try {
    const { id } = c.req.param();

    const zone = await Zone.findById(id)
      .populate('rzmId', 'profile.firstName profile.lastName email')
      .populate('leadership.userId', 'profile.firstName profile.lastName email');

    if (!zone) {
      return c.json({ success: false, error: 'Zone not found' }, 404);
    }

    // Get groups in this zone
    const groups = await Group.find({ zoneId: id, status: 'active' })
      .select('name code stats')
      .limit(10);

    return c.json({
      success: true,
      data: { zone, groups },
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Create zone (admin)
zones.post('/', authMiddleware, adminMiddleware, async (c) => {
  try {
    const body = await c.req.json();

    // Check if code already exists
    const existing = await Zone.findOne({ code: body.code?.toUpperCase() });
    if (existing) {
      return c.json({ success: false, error: 'Zone code already exists' }, 400);
    }

    const zone = new Zone({
      ...body,
      code: body.code?.toUpperCase(),
    });

    await zone.save();

    return c.json({
      success: true,
      data: zone,
    }, 201);
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Update zone (admin)
zones.put('/:id', authMiddleware, adminMiddleware, async (c) => {
  try {
    const { id } = c.req.param();
    const body = await c.req.json();

    const zone = await Zone.findByIdAndUpdate(
      id,
      { $set: body },
      { new: true, runValidators: true }
    );

    if (!zone) {
      return c.json({ success: false, error: 'Zone not found' }, 404);
    }

    return c.json({
      success: true,
      data: zone,
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Add leadership to zone
zones.post('/:id/leadership', authMiddleware, adminMiddleware, async (c) => {
  try {
    const { id } = c.req.param();
    const { userId, role } = await c.req.json();

    const zone = await Zone.findByIdAndUpdate(
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

    if (!zone) {
      return c.json({ success: false, error: 'Zone not found' }, 404);
    }

    return c.json({
      success: true,
      data: zone,
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Remove leadership from zone
zones.delete('/:id/leadership/:userId', authMiddleware, adminMiddleware, async (c) => {
  try {
    const { id, userId } = c.req.param();

    const zone = await Zone.findByIdAndUpdate(
      id,
      {
        $pull: {
          leadership: { userId: new mongoose.Types.ObjectId(userId) },
        },
      },
      { new: true }
    );

    if (!zone) {
      return c.json({ success: false, error: 'Zone not found' }, 404);
    }

    return c.json({
      success: true,
      data: zone,
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Get zone statistics
zones.get('/:id/stats', authMiddleware, async (c) => {
  try {
    const { id } = c.req.param();

    const zone = await Zone.findById(id);
    if (!zone) {
      return c.json({ success: false, error: 'Zone not found' }, 404);
    }

    const [groupCount, churchCount] = await Promise.all([
      Group.countDocuments({ zoneId: id, status: 'active' }),
      Church.countDocuments({ zoneId: id, status: 'active' }),
    ]);

    // Update stats
    zone.stats.groupCount = groupCount;
    zone.stats.churchCount = churchCount;
    await zone.save();

    return c.json({
      success: true,
      data: zone.stats,
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Delete zone (admin) - soft delete
zones.delete('/:id', authMiddleware, adminMiddleware, async (c) => {
  try {
    const { id } = c.req.param();

    // Check if zone has groups
    const groupCount = await Group.countDocuments({ zoneId: id, status: 'active' });
    if (groupCount > 0) {
      return c.json({
        success: false,
        error: 'Cannot delete zone with active groups'
      }, 400);
    }

    const zone = await Zone.findByIdAndUpdate(
      id,
      { $set: { status: 'inactive' } },
      { new: true }
    );

    if (!zone) {
      return c.json({ success: false, error: 'Zone not found' }, 404);
    }

    return c.json({
      success: true,
      message: 'Zone deactivated successfully',
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

export default zones;
