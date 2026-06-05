import { api } from '../services/api';
import type {
  AgendaItemDto,
  CreateMeetingPayload,
  MeetingDto,
  MeetingListItem,
  MeetingStatsDto,
  MeetingTaskDto,
  ParticipationDto,
  TaskStatus,
  MeetingStatus,
  MeetingRole,
} from '../types/meeting';

const base = (orgId: number) => `/organizations/${orgId}/meetings`;

export const getMeetings = (orgId: number) =>
  api.get<MeetingListItem[]>(base(orgId));

export const getMeeting = (orgId: number, meetingId: number) =>
  api.get<MeetingDto>(`${base(orgId)}/${meetingId}`);

export const createMeeting = (orgId: number, payload: CreateMeetingPayload) =>
  api.post<MeetingDto>(base(orgId), payload);

export const updateMeeting = (
  orgId: number,
  meetingId: number,
  payload: { subject?: string; description?: string; scheduledDateTime?: string; plannedDurationMinutes?: number; status?: MeetingStatus }
) => api.put<MeetingDto>(`${base(orgId)}/${meetingId}`, payload);

export const deleteMeeting = (orgId: number, meetingId: number) =>
  api.delete<void>(`${base(orgId)}/${meetingId}`);

export const getMeetingStats = (orgId: number) =>
  api.get<MeetingStatsDto>(`${base(orgId)}/stats`);

// Participants
export const getParticipants = (orgId: number, meetingId: number) =>
  api.get<ParticipationDto[]>(`${base(orgId)}/${meetingId}/participants`);

export const addParticipant = (orgId: number, meetingId: number, userId: number, role: MeetingRole = 'PARTICIPANT') =>
  api.post<ParticipationDto>(`${base(orgId)}/${meetingId}/participants`, { userId, role });

export const removeParticipant = (orgId: number, meetingId: number, userId: number) =>
  api.delete<void>(`${base(orgId)}/${meetingId}/participants/${userId}`);

export const updateParticipantRole = (orgId: number, meetingId: number, userId: number, role: MeetingRole) =>
  api.put<ParticipationDto>(`${base(orgId)}/${meetingId}/participants/${userId}/role`, { role });

export const endMeetingForAll = (orgId: number, meetingId: number) =>
  api.post<void>(`${base(orgId)}/${meetingId}/end-for-all`, {});

// Agenda
export const getAgenda = (orgId: number, meetingId: number) =>
  api.get<AgendaItemDto[]>(`${base(orgId)}/${meetingId}/agenda`);

export const addAgendaItem = (orgId: number, meetingId: number, payload: { title: string; description?: string; allocatedDurationMinutes: number }) =>
  api.post<AgendaItemDto>(`${base(orgId)}/${meetingId}/agenda`, payload);

export const updateAgendaItem = (orgId: number, meetingId: number, itemId: number, payload: Partial<AgendaItemDto>) =>
  api.put<AgendaItemDto>(`${base(orgId)}/${meetingId}/agenda/${itemId}`, payload);

export const deleteAgendaItem = (orgId: number, meetingId: number, itemId: number) =>
  api.delete<void>(`${base(orgId)}/${meetingId}/agenda/${itemId}`);

// Tasks
export const getMeetingTasks = (orgId: number, meetingId: number) =>
  api.get<MeetingTaskDto[]>(`${base(orgId)}/${meetingId}/tasks`);

export const addMeetingTask = (orgId: number, meetingId: number, payload: { description: string; assigneeId?: number; dueDate?: string }) =>
  api.post<MeetingTaskDto>(`${base(orgId)}/${meetingId}/tasks`, payload);

export const updateMeetingTask = (orgId: number, meetingId: number, taskId: number, payload: { description?: string; status?: TaskStatus; assigneeId?: number; dueDate?: string }) =>
  api.put<MeetingTaskDto>(`${base(orgId)}/${meetingId}/tasks/${taskId}`, payload);

export const deleteMeetingTask = (orgId: number, meetingId: number, taskId: number) =>
  api.delete<void>(`${base(orgId)}/${meetingId}/tasks/${taskId}`);

// My tasks (assigned to current user across all meetings)
export const getMyTasks = () =>
  api.get<MeetingTaskDto[]>('/tasks/mine');

// All tasks for an org (managers/supervisors)
export const getOrgTasks = (orgId: number) =>
  api.get<MeetingTaskDto[]>(`/organizations/${orgId}/tasks`);

// Collaborative Note
export const getNote = (orgId: number, meetingId: number) =>
  api.get<{ textContent: string }>(`${base(orgId)}/${meetingId}/note`);

export const updateNote = (orgId: number, meetingId: number, textContent: string) =>
  api.put<{ textContent: string }>(`${base(orgId)}/${meetingId}/note`, { textContent });
