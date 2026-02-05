import { z } from 'zod';

// Auth Schemas
export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  phone: z.string().min(10, 'Phone number must be at least 10 digits').optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
});

export const loginSchema = z.object({
  identifier: z.string().min(1, 'Email or phone is required'),
  password: z.string().min(1, 'Password is required'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

// User Schemas
export const updateProfileSchema = z.object({
  profile: z.object({
    firstName: z.string().min(2).optional(),
    lastName: z.string().min(2).optional(),
    displayName: z.string().optional(),
    dateOfBirth: z.string().datetime().optional(),
    gender: z.enum(['male', 'female', 'other']).optional(),
  }).optional(),
  contact: z.object({
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
    postalCode: z.string().optional(),
  }).optional(),
  preferences: z.object({
    currency: z.string().optional(),
    language: z.string().optional(),
    notificationsEnabled: z.boolean().optional(),
    emailUpdates: z.boolean().optional(),
  }).optional(),
});

export const updateChurchAffiliationSchema = z.object({
  zoneId: z.string().optional(),
  groupId: z.string().optional(),
  churchId: z.string().optional(),
});

// Transaction Schemas
export const createTransactionSchema = z.object({
  categoryId: z.string().min(1, 'Category ID is required'),
  amount: z.number().positive('Amount must be greater than 0'),
  currency: z.string().default('NGN'),
  paymentMethod: z.enum(['paystack', 'espees', 'stripe']),
});

export const completeTransactionSchema = z.object({
  transactionRef: z.string().min(1, 'Transaction reference is required'),
  providerRef: z.string().min(1, 'Provider reference is required'),
  status: z.enum(['completed', 'failed']),
});

// Partnership Category Schemas
export const createCategorySchema = z.object({
  slug: z.string().min(1),
  code: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  shortDescription: z.string().optional(),
  type: z.enum(['core', 'campaign', 'initiative']),
  config: z.object({
    minimumAmount: z.number().nonnegative(),
    suggestedAmounts: z.array(z.number()),
    currency: z.string().default('NGN'),
    allowRecurring: z.boolean().default(true),
    isActive: z.boolean().default(true),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    targetAmount: z.number().optional(),
  }),
  display: z.object({
    order: z.number().default(0),
    showOnHome: z.boolean().default(false),
    showInList: z.boolean().default(true),
    badge: z.string().optional(),
  }).optional(),
});

// Pledge Schemas
export const createPledgeSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  categoryId: z.string().min(1, 'Category ID is required'),
  targetAmount: z.number().positive('Target amount must be greater than 0'),
  targetDate: z.string().datetime(),
  reminderFrequency: z.enum(['daily', 'weekly', 'monthly']).optional(),
});

export const updatePledgeSchema = z.object({
  title: z.string().optional(),
  targetAmount: z.number().positive().optional(),
  targetDate: z.string().datetime().optional(),
  reminderFrequency: z.enum(['daily', 'weekly', 'monthly']).optional(),
});

export const contributeToPledgeSchema = z.object({
  amount: z.number().positive('Amount must be greater than 0'),
  paymentMethod: z.enum(['paystack', 'espees', 'stripe']),
});

// Recurring Payment Schemas
export const createRecurringPaymentSchema = z.object({
  categoryId: z.string().min(1),
  amount: z.number().positive(),
  frequency: z.enum(['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly']),
  dayOfWeek: z.number().min(0).max(6).optional(),
  dayOfMonth: z.number().min(1).max(31).optional(),
  paymentMethodToken: z.string().min(1),
  startDate: z.string().datetime(),
});

// Query Schemas
export const paginationSchema = z.object({
  page: z.coerce.number().positive().default(1),
  limit: z.coerce.number().positive().max(100).default(20),
});

export const transactionQuerySchema = paginationSchema.extend({
  status: z.enum(['pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled']).optional(),
  categoryId: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

// Type exports
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type CreatePledgeInput = z.infer<typeof createPledgeSchema>;
export type CreateRecurringPaymentInput = z.infer<typeof createRecurringPaymentSchema>;
