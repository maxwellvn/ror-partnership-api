import { config } from '../config';
import { Transaction, ITransaction } from '../models';

export interface PaystackInitResponse {
  authorizationUrl: string;
  accessCode: string;
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
        callback_url: `${config.apiUrl}/v1/payment/callback`,
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

  // Initialize Espees payment (placeholder)
  async initializeEspees(transaction: ITransaction): Promise<any> {
    // TODO: Implement Espees payment
    throw new Error('Espees integration not implemented');
  }

  // Generic payment initialization
  async initializePayment(
    transaction: ITransaction,
    email: string,
    method: 'paystack' | 'espees'
  ): Promise<PaymentInitResult> {
    switch (method) {
      case 'paystack':
        const paystackResult = await this.initializePaystack(transaction, email);
        return {
          provider: 'paystack',
          paymentData: paystackResult,
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
