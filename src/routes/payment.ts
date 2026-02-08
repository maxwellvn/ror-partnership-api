import { Hono } from 'hono';
import { config } from '../config';
import { PartnershipCategory, Transaction } from '../models';
import { paymentService } from '../services';

const payment = new Hono();

const buildRedirectUrl = (
  baseRedirect: string,
  params: Record<string, string | undefined>
) => {
  const redirectUrl = new URL(baseRedirect);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      redirectUrl.searchParams.set(key, value);
    }
  });
  return redirectUrl.toString();
};

const resolveAppRedirect = (requestedRedirect: string | null) => {
  const fallback = `${config.mobileAppScheme}://give`;
  if (!requestedRedirect) {
    return fallback;
  }

  try {
    new URL(requestedRedirect);
    return requestedRedirect;
  } catch {
    return fallback;
  }
};

payment.get('/callback', async (c) => {
  try {
    const url = new URL(c.req.url);
    const providerRef =
      url.searchParams.get('reference') ||
      url.searchParams.get('trxref') ||
      '';
    const appRedirect = resolveAppRedirect(url.searchParams.get('app_redirect'));

    if (!providerRef) {
      return c.redirect(
        buildRedirectUrl(appRedirect, {
          status: 'failed',
          code: 'MISSING_REFERENCE',
          message: 'Missing payment reference',
        }),
        302
      );
    }

    const transaction = await Transaction.findOne({
      $or: [{ transactionRef: providerRef }, { externalRef: providerRef }],
    });

    if (!transaction) {
      return c.redirect(
        buildRedirectUrl(appRedirect, {
          status: 'failed',
          code: 'TRANSACTION_NOT_FOUND',
          providerRef,
          message: 'Transaction not found',
        }),
        302
      );
    }

    if (transaction.status === 'completed') {
      return c.redirect(
        buildRedirectUrl(appRedirect, {
          status: 'success',
          transactionRef: transaction.transactionRef,
          providerRef,
        }),
        302
      );
    }

    const paymentData = await paymentService.verifyPaystack(providerRef);

    if (paymentData.status !== 'success') {
      transaction.status = 'failed';
      transaction.statusHistory.push({
        status: 'failed',
        timestamp: new Date(),
        reason: paymentData.gateway_response || 'Payment verification failed',
      });
      await transaction.save();

      return c.redirect(
        buildRedirectUrl(appRedirect, {
          status: 'failed',
          code: 'PAYMENT_FAILED',
          transactionRef: transaction.transactionRef,
          providerRef,
          message: paymentData.gateway_response || 'Payment failed',
        }),
        302
      );
    }

    transaction.status = 'completed';
    transaction.completedAt = new Date();
    transaction.payment.providerRef = paymentData.reference || providerRef;
    transaction.payment.cardLast4 = paymentData.authorization?.last4;
    transaction.payment.cardBrand = paymentData.authorization?.brand;
    transaction.statusHistory.push({
      status: 'completed',
      timestamp: new Date(),
    });
    await transaction.save();

    await PartnershipCategory.findByIdAndUpdate(transaction.category.categoryId, {
      $inc: {
        'stats.totalContributions': 1,
        'stats.totalAmount': transaction.amount.displayValue,
      },
      $set: {
        'stats.lastUpdated': new Date(),
      },
    });

    return c.redirect(
      buildRedirectUrl(appRedirect, {
        status: 'success',
        transactionRef: transaction.transactionRef,
        providerRef,
      }),
      302
    );
  } catch (error: any) {
    const url = new URL(c.req.url);
    const appRedirect = resolveAppRedirect(url.searchParams.get('app_redirect'));

    return c.redirect(
      buildRedirectUrl(appRedirect, {
        status: 'failed',
        code: 'CALLBACK_ERROR',
        message: error?.message || 'Payment callback failed',
      }),
      302
    );
  }
});

// Stripe callback
payment.get('/stripe/callback', async (c) => {
  try {
    const url = new URL(c.req.url);
    const sessionId = url.searchParams.get('session_id') || '';
    const cancelled = url.searchParams.get('cancelled') === 'true';
    const appRedirect = resolveAppRedirect(url.searchParams.get('app_redirect'));

    if (!sessionId) {
      return c.redirect(
        buildRedirectUrl(appRedirect, {
          status: 'failed',
          code: 'MISSING_SESSION',
          message: 'Missing Stripe session ID',
        }),
        302
      );
    }

    // Verify with Stripe
    const stripeResult = await paymentService.verifyStripe(sessionId);

    // Find the transaction by metadata stored during session creation
    // The transactionRef is stored in Stripe session metadata
    // We need to look up by externalRef (sessionId) or by querying Stripe
    const transaction = await Transaction.findOne({
      externalRef: sessionId,
    });

    if (!transaction) {
      return c.redirect(
        buildRedirectUrl(appRedirect, {
          status: 'failed',
          code: 'TRANSACTION_NOT_FOUND',
          message: 'Transaction not found',
        }),
        302
      );
    }

    if (transaction.status === 'completed') {
      return c.redirect(
        buildRedirectUrl(appRedirect, {
          status: 'success',
          transactionRef: transaction.transactionRef,
        }),
        302
      );
    }

    if (cancelled || stripeResult.status !== 'success') {
      transaction.status = 'failed';
      transaction.statusHistory.push({
        status: 'failed',
        timestamp: new Date(),
        reason: cancelled ? 'User cancelled payment' : 'Payment not completed',
      });
      await transaction.save();

      return c.redirect(
        buildRedirectUrl(appRedirect, {
          status: 'failed',
          code: 'PAYMENT_FAILED',
          transactionRef: transaction.transactionRef,
          message: cancelled ? 'Payment cancelled' : 'Payment failed',
        }),
        302
      );
    }

    // Payment successful
    transaction.status = 'completed';
    transaction.completedAt = new Date();
    transaction.payment.providerRef = stripeResult.paymentIntent || sessionId;
    transaction.statusHistory.push({
      status: 'completed',
      timestamp: new Date(),
    });
    await transaction.save();

    // Update category stats
    await PartnershipCategory.findByIdAndUpdate(transaction.category.categoryId, {
      $inc: {
        'stats.totalContributions': 1,
        'stats.totalAmount': transaction.amount.displayValue,
      },
      $set: {
        'stats.lastUpdated': new Date(),
      },
    });

    return c.redirect(
      buildRedirectUrl(appRedirect, {
        status: 'success',
        transactionRef: transaction.transactionRef,
      }),
      302
    );
  } catch (error: any) {
    const url = new URL(c.req.url);
    const appRedirect = resolveAppRedirect(url.searchParams.get('app_redirect'));

    return c.redirect(
      buildRedirectUrl(appRedirect, {
        status: 'failed',
        code: 'CALLBACK_ERROR',
        message: error?.message || 'Stripe callback failed',
      }),
      302
    );
  }
});

export default payment;
