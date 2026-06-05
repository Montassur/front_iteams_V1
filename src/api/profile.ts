import { api } from '../services/api';
import type { UserResponse } from '../types/admin';

export async function getProfile(): Promise<UserResponse> {
  return api.get('/profile');
}

export async function updateProfile(data: { name?: string; email?: string }): Promise<UserResponse> {
  return api.put('/profile', data);
}

export async function changePassword(data: { currentPassword: string; newPassword: string }): Promise<void> {
  return api.put('/profile/password', data);
}
