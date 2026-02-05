import mongoose, { Schema, Document } from 'mongoose';

export interface IRecurringPayment extends Document {
  userId: mongoose.Types.ObjectId;
  categoryId: mongoose.Types.ObjectId;
  pledgeId?: mongoose.Types.ObjectId;
  amount: number;
  currency: string;
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annually';
  dayOfWeek?: number; // 0-6 for weekly
  dayOfMonth?: number; // 1-31 for monthly
  paymentMethod: {
    type: 'card' | 'bank_transfer' | 'mobile_money';
    provider: string;
    authorizationCode?: string;
    last4?: string;
    bank?: string;
    accountName?: string;
  };
  schedule: {
    startDate: Date;
    endDate?: Date;
    nextPaymentDate: Date;
    lastPaymentDate?: Date;
    totalPayments: number;
    completedPayments: number;
    failedPayments: number;
  };
  status: 'active' | 'paused' | 'cancelled' | 'completed' | 'failed';
  retryPolicy: {
    maxRetries: number;
    currentRetries: number;
    retryInterval: number; // hours
  };
  notifications: {
    beforePayment: boolean;
    onSuccess: boolean;
    onFailure: boolean;
    daysBefore: number;
  };
  history: Array<{
    date: Date;
    action: 'created' | 'payment_success' | 'payment_failed' | 'paused' | 'resumed' | 'cancelled';
    transactionId?: mongoose.Types.ObjectId;
    amount?: number;
    error?: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const recurringPaymentSchema = new Schema<IRecurringPayment>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'PartnershipCategory', required: true },
    pledgeId: { type: Schema.Types.ObjectId, ref: 'Pledge' },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'NGN' },
    frequency: {
      type: String,
      enum: ['weekly', 'biweekly', 'monthly', 'quarterly', 'annually'],
      required: true,
    },
    dayOfWeek: { type: Number, min: 0, max: 6 },
    dayOfMonth: { type: Number, min: 1, max: 31 },
    paymentMethod: {
      type: {
        type: String,
        enum: ['card', 'bank_transfer', 'mobile_money'],
        required: true,
      },
      provider: { type: String, required: true },
      authorizationCode: String,
      last4: String,
      bank: String,
      accountName: String,
    },
    schedule: {
      startDate: { type: Date, required: true },
      endDate: Date,
      nextPaymentDate: { type: Date, required: true },
      lastPaymentDate: Date,
      totalPayments: { type: Number, default: 0 },
      completedPayments: { type: Number, default: 0 },
      failedPayments: { type: Number, default: 0 },
    },
    status: {
      type: String,
      enum: ['active', 'paused', 'cancelled', 'completed', 'failed'],
      default: 'active',
    },
    retryPolicy: {
      maxRetries: { type: Number, default: 3 },
      currentRetries: { type: Number, default: 0 },
      retryInterval: { type: Number, default: 24 },
    },
    notifications: {
      beforePayment: { type: Boolean, default: true },
      onSuccess: { type: Boolean, default: true },
      onFailure: { type: Boolean, default: true },
      daysBefore: { type: Number, default: 1 },
    },
    history: [
      {
        date: { type: Date, default: Date.now },
        action: {
          type: String,
          enum: ['created', 'payment_success', 'payment_failed', 'paused', 'resumed', 'cancelled'],
        },
        transactionId: { type: Schema.Types.ObjectId, ref: 'Transaction' },
        amount: Number,
        error: String,
      },
    ],
  },
  { timestamps: true }
);

recurringPaymentSchema.index({ userId: 1, status: 1 });
recurringPaymentSchema.index({ 'schedule.nextPaymentDate': 1, status: 1 });
recurringPaymentSchema.index({ categoryId: 1 });

export const RecurringPayment = mongoose.model<IRecurringPayment>('RecurringPayment', recurringPaymentSchema);
