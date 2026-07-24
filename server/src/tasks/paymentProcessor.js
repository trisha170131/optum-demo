import { randomUUID } from 'node:crypto';

/**
 * PaymentProcessor interface + mock implementation. Simulates a Stripe-test-mode-style checkout
 * entirely in-process — no card data is ever collected or transmitted, and no network call
 * leaves this process, per the demo's "no real card data" security requirement.
 *
 * Production swap: implement the same two methods against a real PCI-compliant processor
 * (e.g. Stripe, in test mode first) using their hosted checkout / Elements so raw card data
 * never touches this server either.
 */
export class PaymentProcessor {
  async createCheckout(_amountCents) { throw new Error('not implemented'); }
  async confirm(_checkoutId) { throw new Error('not implemented'); }
}

export class MockPaymentProcessor extends PaymentProcessor {
  constructor() {
    super();
    this.checkouts = new Map();
  }

  async createCheckout(amountCents) {
    const id = `chk_${randomUUID().slice(0, 10)}`;
    this.checkouts.set(id, { id, amountCents, status: 'pending' });
    return this.checkouts.get(id);
  }

  async confirm(checkoutId) {
    const checkout = this.checkouts.get(checkoutId);
    if (!checkout) throw new Error('unknown checkout');
    checkout.status = 'paid';
    checkout.paidAt = new Date().toISOString();
    return checkout;
  }
}

export const mockPaymentProcessor = new MockPaymentProcessor();
