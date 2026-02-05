import mongoose, { Schema, Document } from 'mongoose';

export interface ITransaction extends Document {
  transactionRef: string;
  externalRef?: string;
  userId: mongoose.Types.ObjectId;
  type: 'partnership' | 'campaign' | 'initiative' | 'subscription';
  category: {
    categoryId: mongoose.Types.ObjectId;
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
    updatedBy?: mongoose.Types.ObjectId;
  }>;
  recurringPaymentId?: mongoose.Types.ObjectId;
  offlineRecord?: {
    isOffline: boolean;
    recordedBy?: mongoose.Types.ObjectId;
    approvedBy?: mongoose.Types.ObjectId;
    approvedAt?: Date;
    receiptNumber?: string;
    notes?: string;
  };
  attribution?: {
    churchId?: mongoose.Types.ObjectId;
    groupId?: mongoose.Types.ObjectId;
    zoneId?: mongoose.Types.ObjectId;
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

const transactionSchema = new Schema<ITransaction>(
  {
    transactionRef: {
      type: String,
      required: true,
      unique: true,
    },
    externalRef: String,
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: ['partnership', 'campaign', 'initiative', 'subscription'],
      required: true,
    },
    category: {
      categoryId: {
        type: Schema.Types.ObjectId,
        ref: 'PartnershipCategory',
        required: true,
      },
      categoryType: {
        type: String,
        enum: ['core', 'campaign', 'initiative'],
        required: true,
      },
      categoryName: {
        type: String,
        required: true,
      },
    },
    amount: {
      value: { type: Number, required: true },
      currency: { type: String, required: true, default: 'NGN' },
      displayValue: { type: Number, required: true },
    },
    payment: {
      method: {
        type: String,
        enum: ['paystack', 'espees', 'stripe', 'cash', 'bank_transfer'],
        required: true,
      },
      provider: String,
      providerRef: String,
      cardLast4: String,
      cardBrand: String,
      bankName: String,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled'],
      default: 'pending',
    },
    statusHistory: [
      {
        status: String,
        timestamp: { type: Date, default: Date.now },
        reason: String,
        updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      },
    ],
    recurringPaymentId: {
      type: Schema.Types.ObjectId,
      ref: 'RecurringPayment',
    },
    offlineRecord: {
      isOffline: { type: Boolean, default: false },
      recordedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      approvedAt: Date,
      receiptNumber: String,
      notes: String,
    },
    attribution: {
      churchId: { type: Schema.Types.ObjectId, ref: 'Church' },
      groupId: { type: Schema.Types.ObjectId, ref: 'Group' },
      zoneId: { type: Schema.Types.ObjectId, ref: 'Zone' },
    },
    metadata: {
      ipAddress: String,
      userAgent: String,
      platform: {
        type: String,
        enum: ['android', 'ios', 'web'],
      },
      appVersion: String,
    },
    completedAt: Date,
  },
  {
    timestamps: true,
  }
);

// Indexes (transactionRef already indexed via unique: true)
transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ status: 1, createdAt: -1 });
transactionSchema.index({ 'category.categoryId': 1, createdAt: -1 });
transactionSchema.index({ 'attribution.zoneId': 1, createdAt: -1 });
transactionSchema.index({ 'attribution.churchId': 1, createdAt: -1 });
transactionSchema.index({ createdAt: -1 });

export const Transaction = mongoose.model<ITransaction>('Transaction', transactionSchema);
