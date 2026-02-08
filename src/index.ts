import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { config } from './config';
import { connectDatabase } from './config/database';
import {
  authRoutes,
  userRoutes,
  partnershipRoutes,
  transactionRoutes,
  pledgeRoutes,
  adminRoutes,
  zoneRoutes,
  groupRoutes,
  churchRoutes,
  subscriptionRoutes,
  notificationRoutes,
  recurringPaymentRoutes,
  campaignRoutes,
  offlineContributionRoutes,
  paymentRoutes,
} from './routes';

// Initialize app
const app = new Hono().basePath('/v1');

// Build allowed origins dynamically
const getAllowedOrigins = () => {
  const origins: string[] = [
    config.appUrl,
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:8081',
    'http://localhost:19006',
  ];

  // Add production origins
  if (config.nodeEnv === 'production') {
    origins.push('https://dashboard.rorpartnership.com');
    origins.push('https://app.rorpartnership.com');
  }

  // Add mobile app scheme
  const mobileScheme = Bun.env.MOBILE_APP_SCHEME || 'rorpartnership';
  origins.push(`${mobileScheme}://`);

  return origins.filter(Boolean);
};

// Global middleware
app.use('*', cors({
  origin: getAllowedOrigins(),
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposeHeaders: ['X-Request-Id'],
  maxAge: 86400,
}));
app.use('*', logger());
app.use('*', secureHeaders());

// Health check
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// Auth & User routes
app.route('/auth', authRoutes);
app.route('/users', userRoutes);

// Partnership routes
app.route('/partnerships', partnershipRoutes);
app.route('/transactions', transactionRoutes);
app.route('/pledges', pledgeRoutes);

// Church hierarchy routes
app.route('/zones', zoneRoutes);
app.route('/groups', groupRoutes);
app.route('/churches', churchRoutes);

// Feature routes
app.route('/subscriptions', subscriptionRoutes);
app.route('/notifications', notificationRoutes);
app.route('/recurring-payments', recurringPaymentRoutes);
app.route('/campaigns', campaignRoutes);
app.route('/offline-contributions', offlineContributionRoutes);
app.route('/payment', paymentRoutes);

// Admin routes
app.route('/admin', adminRoutes);

// 404 handler
app.notFound((c) => {
  return c.json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Resource not found',
    },
  }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: config.nodeEnv === 'development' ? err.message : 'Internal server error',
    },
  }, 500);
});

// Start server
const startServer = async () => {
  try {
    // Connect to database
    await connectDatabase();

    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   ROR Partnership API Server                              ║
║                                                           ║
║   Environment: ${config.nodeEnv.padEnd(40)}║
║   Port: ${config.port.toString().padEnd(47)}║
║   API Base: ${(config.apiUrl + '/v1').padEnd(43)}║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    `);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default {
  port: config.port,
  fetch: app.fetch,
};
