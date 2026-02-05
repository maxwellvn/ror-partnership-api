import { Hono } from 'hono';
import { PartnershipCategory } from '../models';
import { authMiddleware } from '../middleware';
import { successResponse, errorResponse } from '../utils';

const partnerships = new Hono();

// Public route - List all active categories
partnerships.get('/categories', async (c) => {
  try {
    const type = c.req.query('type');
    const active = c.req.query('active');

    const query: any = {};

    if (type) {
      query.type = type;
    }

    if (active !== undefined) {
      query['config.isActive'] = active === 'true';
    } else {
      // Default to active only
      query['config.isActive'] = true;
    }

    const categories = await PartnershipCategory.find(query)
      .sort({ 'display.order': 1 })
      .select('-deletedAt');

    return successResponse(c, { categories });
  } catch (error: any) {
    return errorResponse(c, 'FETCH_FAILED', error.message, 500);
  }
});

// Get category by ID or slug
partnerships.get('/categories/:idOrSlug', async (c) => {
  try {
    const { idOrSlug } = c.req.param();

    let category;

    // Check if it's an ObjectId or slug
    if (idOrSlug.match(/^[0-9a-fA-F]{24}$/)) {
      category = await PartnershipCategory.findById(idOrSlug);
    } else {
      category = await PartnershipCategory.findOne({ slug: idOrSlug });
    }

    if (!category) {
      return errorResponse(c, 'CATEGORY_NOT_FOUND', 'Category not found', 404);
    }

    return successResponse(c, { category });
  } catch (error: any) {
    return errorResponse(c, 'FETCH_FAILED', error.message, 500);
  }
});

// Get featured partnerships for home screen
partnerships.get('/featured', async (c) => {
  try {
    const featured = await PartnershipCategory.find({
      'config.isActive': true,
      'display.showOnHome': true,
    })
      .sort({ 'display.order': 1 })
      .limit(6);

    return successResponse(c, { featured });
  } catch (error: any) {
    return errorResponse(c, 'FETCH_FAILED', error.message, 500);
  }
});

export { partnerships as partnershipRoutes };
