export interface Invoice {
  id: number;
  description: string;
  amountCents: number;
  currency: string;
  status: 'PENDING' | 'PAID' | 'CANCELLED';
  dueDate: string | null;
  createdAt: string | null;
  stripePaymentIntentId?: string | null;
  invoiceMonth?: string | null;
  // admin-only fields
  companyId?: number | null;
  companyName?: string | null;
  ownerEmail?: string | null;
}

export interface CompanyAdmin {
  id: number;
  name: string;
  registryNumber: string | null;
  ownerName: string;
  ownerEmail: string;
  active: boolean;
  pendingInvoicesCount: number;
  paidInvoicesCount: number;
  totalPendingAmountCents: number;
  currency: string;
}

export interface CompanyAdminListResponse {
  companies: CompanyAdmin[];
  totalCount: number;
}

export interface InvoiceListResponse {
  invoices: Invoice[];
  totalCount: number;
}

export interface SavedCard {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

export interface SetupIntentResponse {
  clientSecret: string;
}

export interface PayInvoiceResponse {
  status: string;
  clientSecret: string | null;
}
