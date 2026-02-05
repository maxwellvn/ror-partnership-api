import mongoose, { Schema, Document } from 'mongoose';

export interface ICampaign extends Document {
  name: string;
  code: string;
  description: string;
  categoryId?: mongoose.Types.ObjectId;
  churchId?: mongoose.Types.ObjectId;
  groupId?: mongoose.Types.ObjectId;
  zoneId?: mongoose.Types.ObjectId;
  scope: 'church' | 'group' | 'zone' | 'global';
  target: {
    amount: number;
    currency: string;
    partnerCount?: number;
  };
  progress: {
    currentAmount: number;
    partnerCount: number;
    transactionCount: number;
    percentComplete: number;
  };
  timeline: {
    startDate: Date;
    endDate: Date;
    isExtended: boolean;
    originalEndDate?: Date;
  };
  media: {
    bannerImage?: string;
    thumbnailImage?: string;
    videoUrl?: string;
  };
  settings: {
    allowRecurring: boolean;
    minimumAmount?: number;
    maximumAmount?: number;
    suggestedAmounts: number[];
    showProgress: boolean;
    showDonorNames: boolean;
    sendUpdates: boolean;
  };
  milestones: Array<{
    amount: number;
    title: string;
    description?: string;
    reachedAt?: Date;
  }>;
  updates: Array<{
    title: string;
    content: string;
    postedAt: Date;
    postedBy: mongoose.Types.ObjectId;
  }>;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled';
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const campaignSchema = new Schema<ICampaign>(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, uppercase: true },
    description: { type: String, required: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'PartnershipCategory' },
    churchId: { type: Schema.Types.ObjectId, ref: 'Church' },
    groupId: { type: Schema.Types.ObjectId, ref: 'Group' },
    zoneId: { type: Schema.Types.ObjectId, ref: 'Zone' },
    scope: {
      type: String,
      enum: ['church', 'group', 'zone', 'global'],
      default: 'church',
    },
    target: {
      amount: { type: Number, required: true },
      currency: { type: String, default: 'NGN' },
      partnerCount: Number,
    },
    progress: {
      currentAmount: { type: Number, default: 0 },
      partnerCount: { type: Number, default: 0 },
      transactionCount: { type: Number, default: 0 },
      percentComplete: { type: Number, default: 0 },
    },
    timeline: {
      startDate: { type: Date, required: true },
      endDate: { type: Date, required: true },
      isExtended: { type: Boolean, default: false },
      originalEndDate: Date,
    },
    media: {
      bannerImage: String,
      thumbnailImage: String,
      videoUrl: String,
    },
    settings: {
      allowRecurring: { type: Boolean, default: true },
      minimumAmount: Number,
      maximumAmount: Number,
      suggestedAmounts: [{ type: Number }],
      showProgress: { type: Boolean, default: true },
      showDonorNames: { type: Boolean, default: false },
      sendUpdates: { type: Boolean, default: true },
    },
    milestones: [
      {
        amount: { type: Number, required: true },
        title: { type: String, required: true },
        description: String,
        reachedAt: Date,
      },
    ],
    updates: [
      {
        title: { type: String, required: true },
        content: { type: String, required: true },
        postedAt: { type: Date, default: Date.now },
        postedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      },
    ],
    status: {
      type: String,
      enum: ['draft', 'active', 'paused', 'completed', 'cancelled'],
      default: 'draft',
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

campaignSchema.index({ code: 1 }, { unique: true });
campaignSchema.index({ status: 1, 'timeline.startDate': 1 });
campaignSchema.index({ scope: 1, status: 1 });
campaignSchema.index({ churchId: 1, status: 1 });
campaignSchema.index({ groupId: 1, status: 1 });
campaignSchema.index({ zoneId: 1, status: 1 });

export const Campaign = mongoose.model<ICampaign>('Campaign', campaignSchema);
