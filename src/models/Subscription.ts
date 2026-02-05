import mongoose, { Schema, Document } from 'mongoose';

export interface ISubscription extends Document {
  name: string;
  tier: 'basic' | 'standard' | 'premium' | 'enterprise';
  entityType: 'church' | 'group' | 'zone';
  entityId: mongoose.Types.ObjectId;
  pricing: {
    amount: number;
    currency: string;
    billingCycle: 'monthly' | 'quarterly' | 'annually';
  };
  features: {
    maxMembers: number;
    maxAdmins: number;
    analyticsAccess: boolean;
    customBranding: boolean;
    apiAccess: boolean;
    prioritySupport: boolean;
    offlineMode: boolean;
    bulkImport: boolean;
  };
  status: 'active' | 'expired' | 'cancelled' | 'trial' | 'pending';
  trial: {
    isTrialPeriod: boolean;
    trialStartDate?: Date;
    trialEndDate?: Date;
  };
  billing: {
    lastPaymentDate?: Date;
    nextPaymentDate?: Date;
    paymentMethod?: string;
    autoRenew: boolean;
  };
  history: Array<{
    action: 'created' | 'upgraded' | 'downgraded' | 'renewed' | 'cancelled' | 'expired';
    fromTier?: string;
    toTier?: string;
    date: Date;
    reason?: string;
  }>;
  startDate: Date;
  endDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionSchema = new Schema<ISubscription>(
  {
    name: { type: String, required: true },
    tier: {
      type: String,
      enum: ['basic', 'standard', 'premium', 'enterprise'],
      required: true,
    },
    entityType: {
      type: String,
      enum: ['church', 'group', 'zone'],
      required: true,
    },
    entityId: { type: Schema.Types.ObjectId, required: true, refPath: 'entityType' },
    pricing: {
      amount: { type: Number, required: true },
      currency: { type: String, default: 'NGN' },
      billingCycle: {
        type: String,
        enum: ['monthly', 'quarterly', 'annually'],
        default: 'monthly',
      },
    },
    features: {
      maxMembers: { type: Number, default: 100 },
      maxAdmins: { type: Number, default: 3 },
      analyticsAccess: { type: Boolean, default: false },
      customBranding: { type: Boolean, default: false },
      apiAccess: { type: Boolean, default: false },
      prioritySupport: { type: Boolean, default: false },
      offlineMode: { type: Boolean, default: false },
      bulkImport: { type: Boolean, default: false },
    },
    status: {
      type: String,
      enum: ['active', 'expired', 'cancelled', 'trial', 'pending'],
      default: 'pending',
    },
    trial: {
      isTrialPeriod: { type: Boolean, default: false },
      trialStartDate: Date,
      trialEndDate: Date,
    },
    billing: {
      lastPaymentDate: Date,
      nextPaymentDate: Date,
      paymentMethod: String,
      autoRenew: { type: Boolean, default: true },
    },
    history: [
      {
        action: {
          type: String,
          enum: ['created', 'upgraded', 'downgraded', 'renewed', 'cancelled', 'expired'],
        },
        fromTier: String,
        toTier: String,
        date: { type: Date, default: Date.now },
        reason: String,
      },
    ],
    startDate: { type: Date, required: true },
    endDate: Date,
  },
  { timestamps: true }
);

subscriptionSchema.index({ entityType: 1, entityId: 1 });
subscriptionSchema.index({ status: 1 });
subscriptionSchema.index({ tier: 1 });
subscriptionSchema.index({ 'billing.nextPaymentDate': 1 });

export const Subscription = mongoose.model<ISubscription>('Subscription', subscriptionSchema);
