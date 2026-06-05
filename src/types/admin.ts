export type GlobalRole = 'OWNER' | 'ADMIN' | 'SUPERVISOR' | 'MANAGER' | 'EMPLOYEE';
export type OrgRole = GlobalRole;

export interface ApiUser {
  id: number;
  name: string;
  email: string;
  globalRole?: GlobalRole | null;
}

export interface UserListResponse {
  users?: ApiUser[];
  totalCount?: number;
}

export interface UserResponse {
  id: number;
  name: string;
  email: string;
  globalRole?: GlobalRole | null;
  organizationId?: number | null;
}

export interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
  globalRole?: GlobalRole;
  organizationId?: number;
}

export interface UpdateUserRequest {
  name?: string;
  email?: string;
  password?: string;
  globalRole?: GlobalRole;
}

export interface OrganizationSummary {
  id: number;
  name: string;
  address?: string | null;
  companyId?: number | null;
  ownerId?: number | null;
  memberCount?: number;
}

export interface OrganizationListResponse {
  organizations?: OrganizationSummary[];
  totalCount?: number;
}

export interface OrganizationDetail extends OrganizationSummary {
  companyName?: string | null;
  ownerName?: string | null;
}

export interface CreateOrganizationRequest {
  name: string;
  address?: string;
  companyId?: number | null;
}

export interface UpdateOrganizationRequest {
  name?: string;
  address?: string;
}

export interface AssignRoleRequest {
  userId: number;
  role: OrgRole;
}

export interface OrganizationMembershipResponse {
  id: number;
  userId: number;
  userName?: string;
  organizationId: number;
  createdAt?: string;
}

export interface MeResponse extends ApiUser {
  memberships?: OrganizationMembershipResponse[];
}
