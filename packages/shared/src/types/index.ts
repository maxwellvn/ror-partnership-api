// User Types
export interface User {
  _id: string;
  email: string;
  phone?: string;
  passwordHash: string;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  kingchatId?: string;
  profile: {
    firstName: string;
    lastName: string;
    displayName?: string;
    avatar?: string;
    dateOfBirth?: Date;
    gender?: 'male' | 'female' | 'other';
  };
  churchAffiliation?: {
    zoneId?: string;
    groupId?: string;
    churchId?: string;
    membershipId?: string;
  };
  contact?: {
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };
  preferences: {
    currency: string;
    language: string;
    notificationsEnabled: boolean;
    emailUpdates: boolean;
  };
  status: 'active' | 'inactive' | 'suspended';
  role: 'partner' | 'admin' | 'super_admin';
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

// Transaction Types
export interface Transaction {
  _id: string;
  transactionRef: string;
  externalRef?: string;
  userId: string;
  type: 'partnership' | 'campaign' | 'initiative' | 'subscription';
  category: {
    categoryId: string;
    categoryType: 'core' | 'campaign' | 'initiative';
    categoryName: string;
  };
  amount: {
    value: number;
    currency: string;
    displayValue: number;
  };
  payment: {
    method: 'paystack' | 'espees' | 'stripe' | 'cash' | 'bank_transfer';
    provider?: string;
    providerRef?: string;
    cardLast4?: string;
    cardBrand?: string;
    bankName?: string;
  };
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'cancelled';
  statusHistory: Array<{
    status: string;
    timestamp: Date;
    reason?: string;
    updatedBy?: string;
  }>;
  attribution?: {
    churchId?: string;
    groupId?: string;
    zoneId?: string;
  };
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
    platform?: 'android' | 'ios' | 'web';
    appVersion?: string;
  };
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

// Partnership Category Types
export interface PartnershipCategory {
  _id: string;
  slug: string;
  code: string;
  name: string;
  description: string;
  shortDescription?: string;
  type: 'core' | 'campaign' | 'initiative';
  parentCategory?: string;
  assets?: {
    icon?: string;
    image?: string;
    bannerImage?: string;
    color?: string;
  };
  config: {
    minimumAmount: number;
    suggestedAmounts: number[];
    currency: string;
    allowRecurring: boolean;
    isActive: boolean;
    startDate?: Date;
    endDate?: Date;
    targetAmount?: number;
  };
  display: {
    order: number;
    showOnHome: boolean;
    showInList: boolean;
    badge?: string;
  };
  stats?: {
    totalContributions: number;
    totalAmount: number;
    contributorCount: number;
    lastUpdated: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

// Pledge Types
export interface Pledge {
  _id: string;
  pledgeRef: string;
  userId: string;
  title: string;
  description?: string;
  categoryId: string;
  target: {
    amount: number;
    currency: string;
    displayAmount: number;
  };
  progress: {
    currentAmount: number;
    percentage: number;
    contributionCount: number;
    lastContribution?: Date;
  };
  timeline: {
    startDate: Date;
    targetDate: Date;
    completedDate?: Date;
  };
  transactions: string[];
  status: 'active' | 'completed' | 'paused' | 'cancelled';
  reminders?: {
    enabled: boolean;
    frequency: 'daily' | 'weekly' | 'monthly';
    lastSent?: Date;
    nextScheduled?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string }>;
  };
  meta?: {
    timestamp: string;
    requestId: string;
  };
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Auth Types
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}
