import { describe, it, expect, beforeAll } from 'bun:test';

const API_URL = 'http://localhost:3000/v1';

let partnerToken: string;
let adminToken: string;
let categoryId: string;

describe('ROR Partnership API Tests', () => {
  // Setup: Get tokens before tests
  beforeAll(async () => {
    // Login as partner
    const partnerLogin = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'partner@test.com',
        password: 'partner123',
      }),
    });
    const partnerData = await partnerLogin.json();
    partnerToken = partnerData.data?.tokens?.accessToken || '';

    // Login as admin
    const adminLogin = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'admin@rorpartnership.com',
        password: 'admin123',
      }),
    });
    const adminData = await adminLogin.json();
    adminToken = adminData.data?.tokens?.accessToken || '';

    // Get a category ID
    const categories = await fetch(`${API_URL}/partnerships/categories`);
    const catData = await categories.json();
    categoryId = catData.data?.categories?.[0]?._id || '';
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const res = await fetch(`${API_URL}/health`);
      const data = await res.json();
      expect(data.status).toBe('ok');
    });
  });

  describe('Authentication', () => {
    it('should login with valid credentials', async () => {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: 'partner@test.com',
          password: 'partner123',
        }),
      });
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.tokens.accessToken).toBeDefined();
    });

    it('should reject invalid credentials', async () => {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: 'partner@test.com',
          password: 'wrongpassword',
        }),
      });
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('AUTH_INVALID_CREDENTIALS');
    });

    it('should validate registration input', async () => {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'invalid-email',
          password: 'short',
        }),
      });
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should refresh token', async () => {
      // First get a refresh token
      const loginRes = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: 'partner@test.com',
          password: 'partner123',
        }),
      });
      const loginData = await loginRes.json();

      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refreshToken: loginData.data.tokens.refreshToken,
        }),
      });
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.accessToken).toBeDefined();
    });
  });

  describe('User Endpoints', () => {
    it('should get user profile', async () => {
      const res = await fetch(`${API_URL}/users/me`, {
        headers: { Authorization: `Bearer ${partnerToken}` },
      });
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.user.email).toBe('partner@test.com');
    });

    it('should reject without token', async () => {
      const res = await fetch(`${API_URL}/users/me`);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('AUTH_TOKEN_MISSING');
    });

    it('should get user dashboard', async () => {
      const res = await fetch(`${API_URL}/users/me/dashboard`, {
        headers: { Authorization: `Bearer ${partnerToken}` },
      });
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('totalGiving');
      expect(data.data).toHaveProperty('activePledges');
    });
  });

  describe('Partnership Categories', () => {
    it('should list categories', async () => {
      const res = await fetch(`${API_URL}/partnerships/categories`);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data.categories)).toBe(true);
      expect(data.data.categories.length).toBeGreaterThan(0);
    });

    it('should get featured categories', async () => {
      const res = await fetch(`${API_URL}/partnerships/featured`);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data.featured)).toBe(true);
    });

    it('should get category by slug', async () => {
      const res = await fetch(`${API_URL}/partnerships/categories/rhapsody-distribution`);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.category.slug).toBe('rhapsody-distribution');
    });
  });

  describe('Pledges', () => {
    it('should create a pledge', async () => {
      const res = await fetch(`${API_URL}/pledges`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${partnerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'Test Pledge',
          categoryId,
          targetAmount: 50000,
          targetDate: '2026-12-31T00:00:00.000Z',
          reminderFrequency: 'weekly',
        }),
      });
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.pledge.title).toBe('Test Pledge');
    });

    it('should list pledges', async () => {
      const res = await fetch(`${API_URL}/pledges`, {
        headers: { Authorization: `Bearer ${partnerToken}` },
      });
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data.pledges)).toBe(true);
    });
  });

  describe('Transactions', () => {
    it('should list transactions', async () => {
      const res = await fetch(`${API_URL}/transactions`, {
        headers: { Authorization: `Bearer ${partnerToken}` },
      });
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data).toHaveProperty('pagination');
    });

    it('should get transaction summary', async () => {
      const res = await fetch(`${API_URL}/transactions/summary/stats`, {
        headers: { Authorization: `Bearer ${partnerToken}` },
      });
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('totalAmount');
      expect(data.data).toHaveProperty('byCategory');
    });
  });

  describe('Admin Endpoints', () => {
    it('should get admin dashboard', async () => {
      const res = await fetch(`${API_URL}/admin/dashboard`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('summary');
    });

    it('should reject partner from admin endpoints', async () => {
      const res = await fetch(`${API_URL}/admin/dashboard`, {
        headers: { Authorization: `Bearer ${partnerToken}` },
      });
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('AUTH_INSUFFICIENT_PERMISSIONS');
    });

    it('should list partners', async () => {
      const res = await fetch(`${API_URL}/admin/partners`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data).toHaveProperty('pagination');
    });

    it('should list transactions', async () => {
      const res = await fetch(`${API_URL}/admin/transactions`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data).toHaveProperty('pagination');
    });

    it('should get reports', async () => {
      const res = await fetch(`${API_URL}/admin/reports/summary`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('report');
    });
  });
});
