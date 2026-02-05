import mongoose, { Schema, Document } from 'mongoose';

export interface IChurch extends Document {
  name: string;
  code: string;
  groupId: mongoose.Types.ObjectId;
  zoneId: mongoose.Types.ObjectId;
  type: 'satellite' | 'cell' | 'online';
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  leadership: Array<{
    userId: mongoose.Types.ObjectId;
    role: 'pastor' | 'admin' | 'treasurer';
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
    memberCount: number;
    partnerCount: number;
    totalContributions: number;
  };
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

const churchSchema = new Schema<IChurch>(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, uppercase: true },
    groupId: { type: Schema.Types.ObjectId, ref: 'Group', required: true },
    zoneId: { type: Schema.Types.ObjectId, ref: 'Zone', required: true },
    type: {
      type: String,
      enum: ['satellite', 'cell', 'online'],
      default: 'satellite',
    },
    address: {
      street: String,
      city: String,
      state: String,
      country: String,
      coordinates: {
        lat: Number,
        lng: Number,
      },
    },
    leadership: [
      {
        userId: { type: Schema.Types.ObjectId, ref: 'User' },
        role: {
          type: String,
          enum: ['pastor', 'admin', 'treasurer'],
        },
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
      memberCount: { type: Number, default: 0 },
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

churchSchema.index({ code: 1 }, { unique: true });
churchSchema.index({ groupId: 1, status: 1 });
churchSchema.index({ zoneId: 1, status: 1 });

export const Church = mongoose.model<IChurch>('Church', churchSchema);
