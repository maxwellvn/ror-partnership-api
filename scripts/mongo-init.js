// MongoDB Initialization Script for ROR Partnership
// This runs on first container startup

// Switch to the application database
db = db.getSiblingDB('ror_partnership');

// Create application user
db.createUser({
  user: 'ror_app',
  pwd: 'ror_app_password',
  roles: [
    {
      role: 'readWrite',
      db: 'ror_partnership',
    },
  ],
});

// Create indexes for better performance
db.users.createIndex({ email: 1 }, { unique: true, sparse: true });
db.users.createIndex({ phone: 1 }, { unique: true, sparse: true });
db.users.createIndex({ kingchatId: 1 }, { unique: true, sparse: true });
db.users.createIndex({ 'churchAffiliation.churchId': 1 });
db.users.createIndex({ status: 1 });
db.users.createIndex({ createdAt: -1 });

db.transactions.createIndex({ userId: 1 });
db.transactions.createIndex({ transactionRef: 1 }, { unique: true });
db.transactions.createIndex({ status: 1 });
db.transactions.createIndex({ createdAt: -1 });
db.transactions.createIndex({ 'category.categoryId': 1 });

db.pledges.createIndex({ userId: 1 });
db.pledges.createIndex({ pledgeRef: 1 }, { unique: true });
db.pledges.createIndex({ status: 1 });
db.pledges.createIndex({ 'timeline.targetDate': 1 });

db.partnershipcategories.createIndex({ slug: 1 }, { unique: true });
db.partnershipcategories.createIndex({ code: 1 }, { unique: true });
db.partnershipcategories.createIndex({ type: 1 });

db.zones.createIndex({ code: 1 }, { unique: true });
db.zones.createIndex({ status: 1 });

db.groups.createIndex({ code: 1 }, { unique: true });
db.groups.createIndex({ zoneId: 1 });
db.groups.createIndex({ status: 1 });

db.churches.createIndex({ code: 1 }, { unique: true });
db.churches.createIndex({ groupId: 1 });
db.churches.createIndex({ zoneId: 1 });
db.churches.createIndex({ status: 1 });

db.recurringpayments.createIndex({ userId: 1 });
db.recurringpayments.createIndex({ status: 1 });
db.recurringpayments.createIndex({ nextPaymentDate: 1 });

db.notifications.createIndex({ userId: 1 });
db.notifications.createIndex({ read: 1 });
db.notifications.createIndex({ createdAt: -1 });

print('Database initialized successfully!');
