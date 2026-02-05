import bcrypt from 'bcrypt';
import { User, IUser } from '../models';
import { config } from '../config';
import { generateTokens, verifyRefreshToken } from '../utils/token';
import { RegisterInput, LoginInput } from '@ror/shared';
import { emailService } from './email.service';

export class AuthService {
  private async fetchKingChatProfile(accessToken: string) {
    const response = await fetch(config.kingchat.apiUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to fetch KingsChat profile (status ${response.status}): ${errorText || 'unknown'}`
      );
    }

    return response.json();
  }

  private splitName(displayName?: string) {
    if (!displayName) return { firstName: 'KingsChat', lastName: 'User' };
    const parts = displayName.trim().split(/\s+/);
    if (parts.length === 1) return { firstName: parts[0], lastName: 'User' };
    return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
  }

  async register(input: RegisterInput): Promise<{ user: IUser; requiresVerification: boolean }> {
    // Check if user exists
    const existingUser = await User.findOne({
      $or: [{ email: input.email }, ...(input.phone ? [{ phone: input.phone }] : [])],
    });

    if (existingUser) {
      throw new Error('User with this email or phone already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(input.password, config.bcryptRounds);

    // Generate verification code
    const verificationCode = emailService.generateVerificationCode();
    const verificationExpiry = new Date(Date.now() + config.verificationCodeExpiry);

    // Create user (not yet email-verified)
    const user = await User.create({
      email: input.email,
      phone: input.phone,
      passwordHash,
      isEmailVerified: false,
      emailVerificationCode: verificationCode,
      emailVerificationExpiry: verificationExpiry,
      profile: {
        firstName: input.firstName,
        lastName: input.lastName,
        displayName: `${input.firstName} ${input.lastName}`,
      },
      preferences: {
        currency: 'NGN',
        language: 'en',
        notificationsEnabled: true,
        emailUpdates: true,
      },
      status: 'active',
      role: 'partner',
    });

    // Send verification email
    try {
      await emailService.sendVerificationCode(input.email, verificationCode, input.firstName);
    } catch (err) {
      console.error('Failed to send verification email:', err);
      // Don't block registration if email fails - user can resend
    }

    return { user, requiresVerification: true };
  }

  async verifyEmail(email: string, code: string): Promise<{ user: IUser; tokens: ReturnType<typeof generateTokens> }> {
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      throw new Error('User not found');
    }

    if (user.isEmailVerified) {
      throw new Error('Email is already verified');
    }

    if (!user.emailVerificationCode || !user.emailVerificationExpiry) {
      throw new Error('No verification code found. Please request a new one.');
    }

    if (new Date() > user.emailVerificationExpiry) {
      throw new Error('Verification code has expired. Please request a new one.');
    }

    if (user.emailVerificationCode !== code) {
      throw new Error('Invalid verification code');
    }

    // Mark as verified and clear code
    user.isEmailVerified = true;
    user.emailVerificationCode = undefined;
    user.emailVerificationExpiry = undefined;
    user.lastLoginAt = new Date();
    await user.save();

    const tokens = generateTokens(user);
    return { user, tokens };
  }

  async resendVerificationCode(email: string): Promise<void> {
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      // Don't reveal if user exists
      return;
    }

    if (user.isEmailVerified) {
      throw new Error('Email is already verified');
    }

    const verificationCode = emailService.generateVerificationCode();
    const verificationExpiry = new Date(Date.now() + config.verificationCodeExpiry);

    user.emailVerificationCode = verificationCode;
    user.emailVerificationExpiry = verificationExpiry;
    await user.save();

    await emailService.sendVerificationCode(email, verificationCode, user.profile.firstName);
  }

  async login(input: LoginInput): Promise<{ user: IUser; tokens?: ReturnType<typeof generateTokens>; requiresVerification?: boolean }> {
    // Find user by email or phone
    const user = await User.findOne({
      $or: [{ email: input.identifier }, { phone: input.identifier }],
      status: 'active',
    });

    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(input.password, user.passwordHash);

    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    // Check if email is verified (skip for KingsChat users)
    if (!user.isEmailVerified && !user.kingchatId) {
      // Resend verification code
      const verificationCode = emailService.generateVerificationCode();
      const verificationExpiry = new Date(Date.now() + config.verificationCodeExpiry);

      user.emailVerificationCode = verificationCode;
      user.emailVerificationExpiry = verificationExpiry;
      await user.save();

      try {
        await emailService.sendVerificationCode(user.email, verificationCode, user.profile.firstName);
      } catch (err) {
        console.error('Failed to send verification email:', err);
      }

      return { user, requiresVerification: true };
    }

    // Update last login
    user.lastLoginAt = new Date();
    await user.save();

    const tokens = generateTokens(user);

    return { user, tokens };
  }

  async loginWithKingChat(
    accessToken: string,
    refreshToken?: string
  ): Promise<{ user: IUser; tokens: ReturnType<typeof generateTokens> }> {
    const profile = await this.fetchKingChatProfile(accessToken);

    const kingchatId = profile.id || profile.userId;
    const email = profile.email?.toLowerCase();
    const displayName =
      profile.displayName ||
      profile.display_name ||
      profile.name ||
      profile.username;
    const avatar = profile.avatar || profile.profilePicture || profile.profile_picture;

    const firstFromProfile = profile.first_name || profile.firstName;
    const lastFromProfile = profile.last_name || profile.lastName;
    const { firstName, lastName } =
      firstFromProfile || lastFromProfile
        ? {
            firstName: firstFromProfile || 'KingsChat',
            lastName: lastFromProfile || 'User',
          }
        : this.splitName(displayName);

    let user = await User.findOne({
      $or: [
        ...(kingchatId ? [{ kingchatId }] : []),
        ...(email ? [{ email }] : []),
      ],
    });

    if (!user) {
      const passwordHash = await bcrypt.hash(crypto.randomUUID(), config.bcryptRounds);
      user = await User.create({
        email,
        passwordHash,
        kingchatId,
        kingchatAccessToken: accessToken,
        kingchatRefreshToken: refreshToken,
        isEmailVerified: true, // KingsChat users are auto-verified
        profile: {
          firstName,
          lastName,
          displayName,
          avatar,
        },
        preferences: {
          currency: 'NGN',
          language: 'en',
          notificationsEnabled: true,
          emailUpdates: true,
        },
        status: 'active',
        role: 'partner',
        lastLoginAt: new Date(),
      });
    } else {
      user.kingchatId = kingchatId || user.kingchatId;
      user.kingchatAccessToken = accessToken;
      user.kingchatRefreshToken = refreshToken || user.kingchatRefreshToken;
      user.profile.firstName = firstName || user.profile.firstName;
      user.profile.lastName = lastName || user.profile.lastName;
      user.profile.displayName = displayName || user.profile.displayName;
      user.profile.avatar = avatar || user.profile.avatar;
      user.isEmailVerified = true; // KingsChat users are auto-verified
      user.lastLoginAt = new Date();
      await user.save();
    }

    const tokens = generateTokens(user);
    return { user, tokens };
  }

  async refreshTokens(refreshToken: string): Promise<ReturnType<typeof generateTokens>> {
    const decoded = verifyRefreshToken(refreshToken);

    if (!decoded) {
      throw new Error('Invalid refresh token');
    }

    const user = await User.findById(decoded.sub);

    if (!user || user.status !== 'active') {
      throw new Error('User not found or inactive');
    }

    return generateTokens(user);
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await User.findOne({ email });

    if (!user) {
      // Don't reveal if user exists
      return;
    }

    // TODO: Generate reset token and send email
    // For now, just log
    console.log(`Password reset requested for: ${email}`);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    // TODO: Verify reset token and update password
    throw new Error('Not implemented');
  }

  async getUserById(userId: string): Promise<IUser | null> {
    return User.findById(userId);
  }
}

export const authService = new AuthService();
