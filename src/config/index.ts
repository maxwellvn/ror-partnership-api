export const config = {
  port: parseInt(Bun.env.PORT || '3000'),
  nodeEnv: Bun.env.BUN_ENV || 'development',

  // Database
  mongoUri: Bun.env.MONGODB_URI || 'mongodb://localhost:27017/ror_partnership',
  redisUrl: Bun.env.REDIS_URL || 'redis://localhost:6379',

  // JWT
  jwtSecret: Bun.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
  jwtAccessExpiry: Bun.env.JWT_ACCESS_EXPIRY || '1h',
  jwtRefreshExpiry: Bun.env.JWT_REFRESH_EXPIRY || '7d',

  // Payment Gateways
  paystack: {
    secretKey: Bun.env.PAYSTACK_SECRET_KEY || '',
    publicKey: Bun.env.PAYSTACK_PUBLIC_KEY || '',
  },

  stripe: {
    secretKey: Bun.env.STRIPE_SECRET_KEY || '',
    publishableKey: Bun.env.STRIPE_PUBLISHABLE_KEY || '',
    webhookSecret: Bun.env.STRIPE_WEBHOOK_SECRET || '',
  },

  espees: {
    apiUrl: Bun.env.ESPEES_API_URL || '',
    merchantId: Bun.env.ESPEES_MERCHANT_ID || '',
    apiKey: Bun.env.ESPEES_API_KEY || '',
  },

  // KingChat OAuth (no client secret needed - public OAuth)
  kingchat: {
    clientId: Bun.env.KINGCHAT_CLIENT_ID || 'com.kingschat',
    callbackUrl: Bun.env.KINGCHAT_CALLBACK_URL || '',
    apiUrl: Bun.env.KINGCHAT_API_URL || 'https://connect.kingsch.at/api/profile',
  },

  // SMTP Mail
  smtp: {
    host: Bun.env.SMTP_HOST || 'smtp.hostinger.com',
    port: parseInt(Bun.env.SMTP_PORT || '465'),
    secure: true,
    user: Bun.env.SMTP_USER || '',
    pass: Bun.env.SMTP_PASS || '',
    from: Bun.env.SMTP_FROM || Bun.env.SMTP_USER || '',
  },

  // API URL
  apiUrl: Bun.env.API_URL || 'http://localhost:3000',
  appUrl: Bun.env.APP_URL || 'http://localhost:5173',

  // Mobile app
  mobileAppScheme: Bun.env.MOBILE_APP_SCHEME || 'rorpartnership',

  // Bcrypt
  bcryptRounds: 12,

  // Email verification
  verificationCodeExpiry: 10 * 60 * 1000, // 10 minutes
};
