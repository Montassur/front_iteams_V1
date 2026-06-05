import { api } from '../services/api';
import type { AssignRoleRequest, OrganizationMembershipResponse } from '../types/admin';
function normalizeMemberships(payload: unknown): OrganizationMembershipResponse[] {
  const data = payload as OrganizationMembershipResponse[] | { memberships?: OrganizationMembershipResponse[]; items?: OrganizationMembershipResponse[]; content?: OrganizationMembershipResponse[] } | undefined;
  if (Array.isArray(data)) return data;
  return data?.memberships ?? data?.items ?? data?.content ?? [];
}
export async function listMemberships(orgId: number) {
  const response = await api.get<unknown>(`/organizations/${orgId}/memberships`);
  return normalizeMemberships(response);
}
export async function assignMembership(orgId: number, payload: AssignRoleRequest) {
  return api.post<OrganizationMembershipResponse>(`/organizations/${orgId}/memberships`, payload);
}
export async function removeMembership(orgId: number, membershipId: number) {
  return api.delete<void>(`/organizations/${orgId}/memberships/${membershipId}`);
}
