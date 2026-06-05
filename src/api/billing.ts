import { api } from '../services/api';
import type { Invoice, InvoiceListResponse, PayInvoiceResponse, SavedCard, SetupIntentResponse } from '../types/billing';

export async function getBillingConfig(): Promise<{ publishableKey: string }> {
  return api.get('/billing/config');
}

export async function getSetupIntent(): Promise<SetupIntentResponse> {
  return api.get('/billing/setup-intent');
}

export async function listPaymentMethods(): Promise<SavedCard[]> {
  return api.get('/billing/payment-methods');
}

export async function detachPaymentMethod(pmId: string): Promise<void> {
  return api.delete(`/billing/payment-methods/${encodeURIComponent(pmId)}`);
}

export async function listInvoices(): Promise<InvoiceListResponse> {
  return api.get('/billing/invoices');
}

export async function createInvoice(data: {
  description: string;
  amountCents: number;
  currency: string;
  dueDate?: string;
}): Promise<Invoice> {
  return api.post('/billing/invoices', data);
}

export async function payInvoice(invoiceId: number, paymentMethodId: string): Promise<PayInvoiceResponse> {
  return api.post(`/billing/invoices/${invoiceId}/pay`, { paymentMethodId });
}

export async function confirmPayment(invoiceId: number, paymentIntentId: string): Promise<Invoice> {
  return api.post(`/billing/invoices/${invoiceId}/confirm?paymentIntentId=${encodeURIComponent(paymentIntentId)}`, {});
}
