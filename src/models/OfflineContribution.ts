import mongoose, { Schema, Document } from 'mongoose';

export interface IOfflineContribution extends Document {
  userId: mongoose.Types.ObjectId;
  categoryId: mongoose.Types.ObjectId;
  pledgeId?: mongoose.Types.ObjectId;
  campaignId?: mongoose.Types.ObjectId;
  churchId: mongoose.Types.ObjectId;
  amount: number;
  currency: string;
  paymentMethod: 'cash' | 'check' | 'bank_deposit' | 'mobile_transfer' | 'other';
  paymentDetails: {
    receiptNumber?: string;
    checkNumber?: string;
    bankName?: string;
    depositDate?: Date;
    reference?: string;
    notes?: string;
  };
  recordedBy: mongoose.Types.ObjectId;
  recordedAt: Date;
  contributionDate: Date;
  approval: {
    status: 'pending' | 'approved' | 'rejected';
    approvedBy?: mongoose.Types.ObjectId;
    approvedAt?: Date;
    rejectedBy?: mongoose.Types.ObjectId;
    rejectedAt?: Date;
    rejectionReason?: string;
    comments?: string;
  };
  verification: {
    isVerified: boolean;
    verifiedBy?: mongoose.Types.ObjectId;
    verifiedAt?: Date;
    verificationMethod?: string;
    attachments: Array<{
      type: 'receipt' | 'photo' | 'document';
      url: string;
      uploadedAt: Date;
    }>;
  };
  syncStatus: {
    isSynced: boolean;
    syncedAt?: Date;
    transactionId?: mongoose.Types.ObjectId;
    syncError?: string;
  };
  metadata: {
    deviceId?: string;
    appVersion?: string;
    location?: {
      lat: number;
      lng: number;
    };
  };
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'synced';
  createdAt: Date;
  updatedAt: Date;
}

const offlineContributionSchema = new Schema<IOfflineContribution>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'PartnershipCategory', required: true },
    pledgeId: { type: Schema.Types.ObjectId, ref: 'Pledge' },
    campaignId: { type: Schema.Types.ObjectId, ref: 'Campaign' },
    churchId: { type: Schema.Types.ObjectId, ref: 'Church', required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'NGN' },
    paymentMethod: {
      type: String,
      enum: ['cash', 'check', 'bank_deposit', 'mobile_transfer', 'other'],
      required: true,
    },
    paymentDetails: {
      receiptNumber: String,
      checkNumber: String,
      bankName: String,
      depositDate: Date,
      reference: String,
      notes: String,
    },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    recordedAt: { type: Date, default: Date.now },
    contributionDate: { type: Date, required: true },
    approval: {
      status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending',
      },
      approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      approvedAt: Date,
      rejectedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      rejectedAt: Date,
      rejectionReason: String,
      comments: String,
    },
    verification: {
      isVerified: { type: Boolean, default: false },
      verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      verifiedAt: Date,
      verificationMethod: String,
      attachments: [
        {
          type: { type: String, enum: ['receipt', 'photo', 'document'] },
          url: String,
          uploadedAt: { type: Date, default: Date.now },
        },
      ],
    },
    syncStatus: {
      isSynced: { type: Boolean, default: false },
      syncedAt: Date,
      transactionId: { type: Schema.Types.ObjectId, ref: 'Transaction' },
      syncError: String,
    },
    metadata: {
      deviceId: String,
      appVersion: String,
      location: {
        lat: Number,
        lng: Number,
      },
    },
    status: {
      type: String,
      enum: ['draft', 'submitted', 'approved', 'rejected', 'synced'],
      default: 'draft',
    },
  },
  { timestamps: true }
);

offlineContributionSchema.index({ userId: 1, status: 1 });
offlineContributionSchema.index({ churchId: 1, 'approval.status': 1 });
offlineContributionSchema.index({ recordedBy: 1 });
offlineContributionSchema.index({ contributionDate: -1 });
offlineContributionSchema.index({ 'syncStatus.isSynced': 1, status: 1 });

export const OfflineContribution = mongoose.model<IOfflineContribution>('OfflineContribution', offlineContributionSchema);
