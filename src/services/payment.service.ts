import Stripe from 'stripe';
import { config } from '../config';
import { Transaction, ITransaction } from '../models';

const stripe = new Stripe(config.stripe.secretKey);

export interface PaystackInitResponse {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
}

export interface StripeInitResponse {
  authorizationUrl: string;
  sessionId: string;
  reference: string;
}

export interface PaymentInitResult {
  provider: string;
  paymentData: any;
}

export class PaymentService {
  // Initialize Paystack payment
  async initializePaystack(
    transaction: ITransaction,
    email: string
  ): Promise<PaystackInitResponse> {
    const appRedirect = `${config.mobileAppScheme}://give`;
    const callbackUrl = `${config.apiUrl}/v1/payment/callback?app_redirect=${encodeURIComponent(appRedirect)}`;

    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.paystack.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: transaction.amount.value,
        currency: transaction.amount.currency,
        reference: transaction.transactionRef,
        callback_url: callbackUrl,
        metadata: {
          userId: transaction.userId.toString(),
          categoryId: transaction.category.categoryId.toString(),
          transactionId: transaction._id.toString(),
        },
      }),
    });

    const data = await response.json();

    if (!data.status) {
      throw new Error(data.message || 'Failed to initialize payment');
    }

    return {
      authorizationUrl: data.data.authorization_url,
      accessCode: data.data.access_code,
      reference: data.data.reference,
    };
  }

  // Verify Paystack payment
  async verifyPaystack(reference: string): Promise<any> {
    const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: {
        Authorization: `Bearer ${config.paystack.secretKey}`,
      },
    });

    const data = await response.json();

    if (!data.status) {
      throw new Error(data.message || 'Failed to verify payment');
    }

    return data.data;
  }

  // Validate Paystack webhook signature
  validatePaystackWebhook(body: string, signature: string): boolean {
    const hash = new Bun.CryptoHasher('sha512')
      .update(body)
      .digest('hex');

    // Compare with HMAC using secret key
    const expectedHash = Bun.CryptoHasher.hash('sha512', body, config.paystack.secretKey);
    return hash === signature;
  }

  // Initialize Stripe Checkout Session
  async initializeStripe(
    transaction: ITransaction,
    email: string
  ): Promise<StripeInitResponse> {
    const appRedirect = `${config.mobileAppScheme}://give`;
    const callbackUrl = `${config.apiUrl}/v1/payment/stripe/callback`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: transaction.amount.currency.toLowerCase(),
            product_data: {
              name: transaction.category.categoryName,
              description: `Partnership giving - ${transaction.transactionRef}`,
            },
            unit_amount: transaction.amount.value,
          },
          quantity: 1,
        },
      ],
      success_url: `${callbackUrl}?session_id={CHECKOUT_SESSION_ID}&app_redirect=${encodeURIComponent(appRedirect)}`,
      cancel_url: `${callbackUrl}?session_id={CHECKOUT_SESSION_ID}&cancelled=true&app_redirect=${encodeURIComponent(appRedirect)}`,
      metadata: {
        transactionRef: transaction.transactionRef,
        userId: transaction.userId.toString(),
        categoryId: transaction.category.categoryId.toString(),
        transactionId: transaction._id.toString(),
      },
    });

    return {
      authorizationUrl: session.url!,
      sessionId: session.id,
      reference: transaction.transactionRef,
    };
  }

  // Verify Stripe payment
  async verifyStripe(sessionId: string): Promise<{ status: string; paymentIntent?: string }> {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const isPaid = session.payment_status === 'paid';

    return {
      status: isPaid ? 'success' : 'failed',
      paymentIntent: typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id,
    };
  }

  // Initialize Espees payment (placeholder)
  async initializeEspees(transaction: ITransaction): Promise<any> {
    // TODO: Implement Espees payment
    throw new Error('Espees integration not implemented');
  }

  // Generic payment initialization
  async initializePayment(
    transaction: ITransaction,
    email: string,
    method: 'paystack' | 'stripe' | 'espees'
  ): Promise<PaymentInitResult> {
    switch (method) {
      case 'paystack':
        const paystackResult = await this.initializePaystack(transaction, email);
        return {
          provider: 'paystack',
          paymentData: paystackResult,
        };
      case 'stripe':
        const stripeResult = await this.initializeStripe(transaction, email);
        return {
          provider: 'stripe',
          paymentData: stripeResult,
        };
      case 'espees':
        const espeesResult = await this.initializeEspees(transaction);
        return {
          provider: 'espees',
          paymentData: espeesResult,
        };
      default:
        throw new Error(`Unsupported payment method: ${method}`);
    }
  }
}

export const paymentService = new PaymentService();
