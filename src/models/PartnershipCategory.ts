import mongoose, { Schema, Document } from 'mongoose';

export interface IPartnershipCategory extends Document {
  slug: string;
  code: string;
  name: string;
  description: string;
  shortDescription?: string;
  type: 'core' | 'campaign' | 'initiative';
  parentCategory?: mongoose.Types.ObjectId;
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
  stats: {
    totalContributions: number;
    totalAmount: number;
    contributorCount: number;
    lastUpdated: Date;
  };
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

const partnershipCategorySchema = new Schema<IPartnershipCategory>(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    shortDescription: String,
    type: {
      type: String,
      enum: ['core', 'campaign', 'initiative'],
      required: true,
    },
    parentCategory: {
      type: Schema.Types.ObjectId,
      ref: 'PartnershipCategory',
    },
    assets: {
      icon: String,
      image: String,
      bannerImage: String,
      color: String,
    },
    config: {
      minimumAmount: { type: Number, default: 0 },
      suggestedAmounts: { type: [Number], default: [1000, 5000, 10000, 50000] },
      currency: { type: String, default: 'NGN' },
      allowRecurring: { type: Boolean, default: true },
      isActive: { type: Boolean, default: true },
      startDate: Date,
      endDate: Date,
      targetAmount: Number,
    },
    display: {
      order: { type: Number, default: 0 },
      showOnHome: { type: Boolean, default: false },
      showInList: { type: Boolean, default: true },
      badge: String,
    },
    stats: {
      totalContributions: { type: Number, default: 0 },
      totalAmount: { type: Number, default: 0 },
      contributorCount: { type: Number, default: 0 },
      lastUpdated: { type: Date, default: Date.now },
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    deletedAt: Date,
  },
  {
    timestamps: true,
  }
);

// Indexes (slug already indexed via unique: true)
partnershipCategorySchema.index({ type: 1, 'config.isActive': 1, 'display.order': 1 });
partnershipCategorySchema.index({ 'display.showOnHome': 1, 'display.order': 1 });

export const PartnershipCategory = mongoose.model<IPartnershipCategory>(
  'PartnershipCategory',
  partnershipCategorySchema
);
