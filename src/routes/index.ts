export { authRoutes } from './auth';
export { userRoutes } from './users';
export { partnershipRoutes } from './partnerships';
export { transactionRoutes } from './transactions';
export { pledgeRoutes } from './pledges';
export { adminRoutes } from './admin';

// Church hierarchy routes
export { default as zoneRoutes } from './zones';
export { default as groupRoutes } from './groups';
export { default as churchRoutes } from './churches';

// Feature routes
export { default as subscriptionRoutes } from './subscriptions';
export { default as notificationRoutes } from './notifications';
export { default as recurringPaymentRoutes } from './recurring-payments';
export { default as campaignRoutes } from './campaigns';
export { default as offlineContributionRoutes } from './offline-contributions';
export { default as paymentRoutes } from './payment';
