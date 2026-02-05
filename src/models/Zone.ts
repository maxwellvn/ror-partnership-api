import mongoose, { Schema, Document } from 'mongoose';

export interface IZone extends Document {
  name: string;
  code: string;
  description?: string;
  rzmId?: mongoose.Types.ObjectId;
  leadership: Array<{
    userId: mongoose.Types.ObjectId;
    role: string;
    assignedAt: Date;
  }>;
  location: {
    country: string;
    region?: string;
    timezone?: string;
  };
  subscription?: {
    tier: 'basic' | 'standard' | 'premium' | 'enterprise';
    status: 'active' | 'expired' | 'trial';
    startDate?: Date;
    endDate?: Date;
    subscriptionId?: mongoose.Types.ObjectId;
  };
  stats: {
    groupCount: number;
    churchCount: number;
    partnerCount: number;
    totalContributions: number;
  };
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

const zoneSchema = new Schema<IZone>(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, uppercase: true },
    description: String,
    rzmId: { type: Schema.Types.ObjectId, ref: 'User' },
    leadership: [
      {
        userId: { type: Schema.Types.ObjectId, ref: 'User' },
        role: String,
        assignedAt: { type: Date, default: Date.now },
      },
    ],
    location: {
      country: { type: String, required: true },
      region: String,
      timezone: String,
    },
    subscription: {
      tier: {
        type: String,
        enum: ['basic', 'standard', 'premium', 'enterprise'],
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
      groupCount: { type: Number, default: 0 },
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

zoneSchema.index({ code: 1 }, { unique: true });
zoneSchema.index({ status: 1 });
zoneSchema.index({ 'location.country': 1 });

export const Zone = mongoose.model<IZone>('Zone', zoneSchema);
