import mongoose, { Schema, Document } from 'mongoose';

export interface IGroup extends Document {
  name: string;
  code: string;
  zoneId: mongoose.Types.ObjectId;
  leadership: Array<{
    userId: mongoose.Types.ObjectId;
    role: string;
    assignedAt: Date;
  }>;
  subscription?: {
    tier: 'basic' | 'standard' | 'premium';
    status: 'active' | 'expired' | 'trial';
    startDate?: Date;
    endDate?: Date;
    subscriptionId?: mongoose.Types.ObjectId;
  };
  stats: {
    churchCount: number;
    partnerCount: number;
    totalContributions: number;
  };
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

const groupSchema = new Schema<IGroup>(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, uppercase: true },
    zoneId: { type: Schema.Types.ObjectId, ref: 'Zone', required: true },
    leadership: [
      {
        userId: { type: Schema.Types.ObjectId, ref: 'User' },
        role: String,
        assignedAt: { type: Date, default: Date.now },
      },
    ],
    subscription: {
      tier: {
        type: String,
        enum: ['basic', 'standard', 'premium'],
        default: 'basic',
      },
      status: {
        type: String,
        enum: ['active', 'expired', 'trial'],
        default: 'trial',
      },
      startDate: Date,
      endDate: Date,
      subscriptionId: { type: Schema.Types.ObjectId, ref: 'Subscription' },
    },
    stats: {
      churchCount: { type: Number, default: 0 },
      partnerCount: { type: Number, default: 0 },
      totalContributions: { type: Number, default: 0 },
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
  },
  { timestamps: true }
);

groupSchema.index({ code: 1 }, { unique: true });
groupSchema.index({ zoneId: 1, status: 1 });

export const Group = mongoose.model<IGroup>('Group', groupSchema);
