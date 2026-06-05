import { api } from '../services/api';
import type { CompanyAdmin, CompanyAdminListResponse, InvoiceListResponse } from '../types/billing';

export async function listAdminCompanies(): Promise<CompanyAdminListResponse> {
  return api.get('/admin/billing/companies');
}

export async function toggleCompanyActive(companyId: number): Promise<CompanyAdmin> {
  return api.put(`/admin/billing/companies/${companyId}/toggle`, {});
}

export async function listAdminInvoices(): Promise<InvoiceListResponse> {
  return api.get('/admin/billing/invoices');
}

export async function generateMonthlyInvoices(): Promise<{ generated: number }> {
  return api.post('/admin/billing/invoices/generate', {});
}
