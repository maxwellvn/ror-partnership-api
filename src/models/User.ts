import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  email: string;
  phone?: string;
  passwordHash: string;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  emailVerificationCode?: string;
  emailVerificationExpiry?: Date;
  kingchatId?: string;
  kingchatAccessToken?: string;
  kingchatRefreshToken?: string;
  profile: {
    firstName: string;
    lastName: string;
    displayName?: string;
    avatar?: string;
    dateOfBirth?: Date;
    gender?: 'male' | 'female' | 'other';
  };
  churchAffiliation?: {
    zoneId?: mongoose.Types.ObjectId;
    groupId?: mongoose.Types.ObjectId;
    churchId?: mongoose.Types.ObjectId;
    membershipId?: string;
  };
  contact?: {
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };
  preferences: {
    currency: string;
    language: string;
    notificationsEnabled: boolean;
    emailUpdates: boolean;
  };
  status: 'active' | 'inactive' | 'suspended';
  role: 'partner' | 'admin' | 'super_admin';
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  deletedAt?: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    isPhoneVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationCode: String,
    emailVerificationExpiry: Date,
    kingchatId: {
      type: String,
      unique: true,
      sparse: true,
    },
    kingchatAccessToken: String,
    kingchatRefreshToken: String,
    profile: {
      firstName: { type: String, required: true },
      lastName: { type: String, required: true },
      displayName: String,
      avatar: String,
      dateOfBirth: Date,
      gender: {
        type: String,
        enum: ['male', 'female', 'other'],
      },
    },
    churchAffiliation: {
      zoneId: { type: Schema.Types.ObjectId, ref: 'Zone' },
      groupId: { type: Schema.Types.ObjectId, ref: 'Group' },
      churchId: { type: Schema.Types.ObjectId, ref: 'Church' },
      membershipId: String,
    },
    contact: {
      address: String,
      city: String,
      state: String,
      country: String,
      postalCode: String,
    },
    preferences: {
      currency: { type: String, default: 'NGN' },
      language: { type: String, default: 'en' },
      notificationsEnabled: { type: Boolean, default: true },
      emailUpdates: { type: Boolean, default: true },
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended'],
      default: 'active',
    },
    role: {
      type: String,
      enum: ['partner', 'admin', 'super_admin'],
      default: 'partner',
    },
    lastLoginAt: Date,
    deletedAt: Date,
  },
  {
    timestamps: true,
  }
);

// Indexes (email, phone, kingchatId already indexed via unique: true)
userSchema.index({ 'churchAffiliation.zoneId': 1 });
userSchema.index({ 'churchAffiliation.churchId': 1 });
userSchema.index({ status: 1, createdAt: -1 });

export const User = mongoose.model<IUser>('User', userSchema);
