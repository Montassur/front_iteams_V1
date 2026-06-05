import { api } from '../services/api';
import type { CreateOrganizationRequest, OrganizationDetail, OrganizationSummary, UpdateOrganizationRequest } from '../types/admin';

function normalizeOrganizations(payload: unknown): { organizations: OrganizationSummary[]; totalCount: number } {
  const data = payload as any;
  if (Array.isArray(data)) return { organizations: data, totalCount: data.length };
  const organizations = data?.organizations ?? data?.content ?? [];
  return { organizations, totalCount: data?.totalCount ?? organizations.length };
}

export async function listOrganizations() {
  return normalizeOrganizations(await api.get<unknown>('/organizations'));
}
export async function getOrganization(organizationId: number) {
  return api.get<OrganizationDetail>(`/organizations/${organizationId}`);
}
export async function createOrganization(payload: CreateOrganizationRequest) {
  return api.post<OrganizationDetail>('/organizations', payload);
}
export async function updateOrganization(organizationId: number, payload: UpdateOrganizationRequest) {
  return api.put<OrganizationDetail>(`/organizations/${organizationId}`, payload);
}
export async function deleteOrganization(organizationId: number) {
  return api.delete<void>(`/organizations/${organizationId}`);
}
