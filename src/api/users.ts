import { api } from '../services/api';
import type { ApiUser, CreateUserRequest, MeResponse, UpdateUserRequest, UserResponse } from '../types/admin';

function normalizeUsers(payload: unknown): { users: ApiUser[]; totalCount: number } {
  const data = payload as any;
  if (Array.isArray(data)) return { users: data, totalCount: data.length };
  const users = data?.users ?? data?.content ?? [];
  return { users, totalCount: data?.totalCount ?? users.length };
}

export async function listUsers() {
  return normalizeUsers(await api.get<unknown>('/users'));
}
export async function getUsersByOrganization(orgId: number) {
  return normalizeUsers(await api.get<unknown>(`/users/organization/${orgId}`));
}
export async function createUser(payload: CreateUserRequest) {
  return api.post<UserResponse>('/users', payload);
}
export async function updateUser(userId: number, payload: UpdateUserRequest) {
  return api.put<UserResponse>(`/users/${userId}`, payload);
}
export async function deleteUser(userId: number) {
  return api.delete<void>(`/users/${userId}`);
}
export async function getCurrentUser() {
  return api.get<MeResponse>('/users/me');
}
