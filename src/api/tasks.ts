import { api } from '../services/api';
import type { MeetingTaskDto, TaskStatus } from '../types/meeting';

export interface CreateTaskPayload {
  description: string;
  assigneeId?: number;
  dueDate?: string;
  status?: TaskStatus;
}

export const getMyTasks = () =>
  api.get<MeetingTaskDto[]>('/tasks/mine');

export const getOrgTasks = (orgId: number) =>
  api.get<MeetingTaskDto[]>(`/organizations/${orgId}/tasks`);

export const createTask = (orgId: number, payload: CreateTaskPayload) =>
  api.post<MeetingTaskDto>(`/organizations/${orgId}/tasks`, payload);

export const updateTask = (taskId: number, payload: Partial<CreateTaskPayload>) =>
  api.put<MeetingTaskDto>(`/tasks/${taskId}`, payload);

export const deleteTask = (taskId: number) =>
  api.delete<void>(`/tasks/${taskId}`);
