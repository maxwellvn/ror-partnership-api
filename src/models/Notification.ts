import mongoose, { Schema, Document } from 'mongoose';

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  type: 'payment' | 'pledge' | 'reminder' | 'announcement' | 'approval' | 'system' | 'campaign';
  title: string;
  message: string;
  data?: {
    entityType?: string;
    entityId?: mongoose.Types.ObjectId;
    actionUrl?: string;
    metadata?: Record<string, any>;
  };
  priority: 'low' | 'normal' | 'high' | 'urgent';
  channels: {
    inApp: boolean;
    email: boolean;
    push: boolean;
    sms: boolean;
  };
  delivery: {
    inAppSentAt?: Date;
    emailSentAt?: Date;
    pushSentAt?: Date;
    smsSentAt?: Date;
  };
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  readAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: ['payment', 'pledge', 'reminder', 'announcement', 'approval', 'system', 'campaign'],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    data: {
      entityType: String,
      entityId: Schema.Types.ObjectId,
      actionUrl: String,
      metadata: Schema.Types.Mixed,
    },
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal',
    },
    channels: {
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: false },
      push: { type: Boolean, default: false },
      sms: { type: Boolean, default: false },
    },
    delivery: {
      inAppSentAt: Date,
      emailSentAt: Date,
      pushSentAt: Date,
      smsSentAt: Date,
    },
    status: {
      type: String,
      enum: ['pending', 'sent', 'delivered', 'read', 'failed'],
      default: 'pending',
    },
    readAt: Date,
    expiresAt: Date,
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, status: 1 });
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ type: 1, status: 1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Notification = mongoose.model<INotification>('Notification', notificationSchema);
