import { api } from '../services/api';
import type { ConversationDto, MessageDto, UserSummaryDto } from '../types/chat';

export const getConversations = () => api.get<ConversationDto[]>('/chat/conversations');

export const getMessages = (convId: number) =>
  api.get<MessageDto[]>(`/chat/conversations/${convId}/messages`);

export const getOrCreateDm = (targetUserId: number) =>
  api.post<ConversationDto>(`/chat/conversations/dm/${targetUserId}`, {});

export const getOrCreateGroup = (orgId: number) =>
  api.post<ConversationDto>(`/chat/conversations/group/${orgId}`, {});

export const getOrgMembers = (orgId: number) =>
  api.get<UserSummaryDto[]>(`/chat/org/${orgId}/members`);

export const markRead = (convId: number) =>
  api.post<void>(`/chat/conversations/${convId}/read`, {});

export const getMyOrgs = () =>
  api.get<{ id: number; name: string }[]>('/chat/my-orgs');
