import mongoose, { Schema, Document } from 'mongoose';

export interface IPledge extends Document {
  pledgeRef: string;
  userId: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  categoryId: mongoose.Types.ObjectId;
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
  transactions: mongoose.Types.ObjectId[];
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

const pledgeSchema = new Schema<IPledge>(
  {
    pledgeRef: {
      type: String,
      required: true,
      unique: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: String,
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'PartnershipCategory',
      required: true,
    },
    target: {
      amount: { type: Number, required: true },
      currency: { type: String, default: 'NGN' },
      displayAmount: { type: Number, required: true },
    },
    progress: {
      currentAmount: { type: Number, default: 0 },
      percentage: { type: Number, default: 0 },
      contributionCount: { type: Number, default: 0 },
      lastContribution: Date,
    },
    timeline: {
      startDate: { type: Date, default: Date.now },
      targetDate: { type: Date, required: true },
      completedDate: Date,
    },
    transactions: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Transaction',
      },
    ],
    status: {
      type: String,
      enum: ['active', 'completed', 'paused', 'cancelled'],
      default: 'active',
    },
    reminders: {
      enabled: { type: Boolean, default: false },
      frequency: {
        type: String,
        enum: ['daily', 'weekly', 'monthly'],
      },
      lastSent: Date,
      nextScheduled: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes (pledgeRef already indexed via unique: true)
pledgeSchema.index({ userId: 1, status: 1, createdAt: -1 });
pledgeSchema.index({ userId: 1, categoryId: 1 });
pledgeSchema.index({ 'timeline.targetDate': 1, status: 1 });

export const Pledge = mongoose.model<IPledge>('Pledge', pledgeSchema);
