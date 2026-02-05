import { nanoid } from 'nanoid';

// Generate unique transaction reference
export const generateTransactionRef = (): string => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = nanoid(8).toUpperCase();
  return `TXN-${timestamp}-${random}`;
};

// Generate unique pledge reference
export const generatePledgeRef = (): string => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = nanoid(6).toUpperCase();
  return `PLG-${timestamp}-${random}`;
};

// Generate unique recurring payment reference
export const generateRecurringRef = (): string => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = nanoid(6).toUpperCase();
  return `REC-${timestamp}-${random}`;
};

// Convert amount to smallest currency unit (kobo/cents)
export const toSmallestUnit = (amount: number, currency: string = 'NGN'): number => {
  // Most currencies use 100 subunits (kobo, cents, etc.)
  return Math.round(amount * 100);
};

// Convert from smallest currency unit to display value
export const toDisplayValue = (value: number, currency: string = 'NGN'): number => {
  return value / 100;
};

// Format currency for display
export const formatCurrency = (amount: number, currency: string = 'NGN'): string => {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
  }).format(amount);
};

// Calculate percentage
export const calculatePercentage = (current: number, target: number): number => {
  if (target === 0) return 0;
  return Math.min(Math.round((current / target) * 100), 100);
};

// Sanitize user object for response (remove sensitive fields)
export const sanitizeUser = (user: any) => {
  const { passwordHash, kingchatAccessToken, kingchatRefreshToken, ...safeUser } = user.toObject
    ? user.toObject()
    : user;
  return safeUser;
};
