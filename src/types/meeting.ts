export type MeetingStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type MeetingRole = 'MODERATOR' | 'PRESENTER' | 'PARTICIPANT';
export type TaskStatus = 'TO_DO' | 'IN_PROGRESS' | 'DONE';

export interface ParticipationDto {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  role: MeetingRole;
}

export interface AgendaItemDto {
  id: number;
  title: string;
  description?: string;
  allocatedDurationMinutes: number;
  actualDurationMinutes?: number;
  orderIndex: number;
}

export interface MeetingTaskDto {
  id: number;
  description: string;
  assigneeId?: number;
  assigneeName?: string;
  dueDate?: string;
  status: TaskStatus;
  meetingId?: number;
  meetingSubject?: string;
  organizationId?: number;
}

export interface MeetingDto {
  id: number;
  subject: string;
  description?: string;
  scheduledDateTime: string;
  plannedDurationMinutes: number;
  status: MeetingStatus;
  organizationId: number;
  organizationName: string;
  moderatorId?: number;
  moderatorName?: string;
  participants: ParticipationDto[];
  agendaItems: AgendaItemDto[];
  tasks: MeetingTaskDto[];
  collaborativeNote: string;
}

export interface MeetingListItem {
  id: number;
  subject: string;
  description?: string;
  scheduledDateTime: string;
  plannedDurationMinutes: number;
  status: MeetingStatus;
  organizationId: number;
  organizationName: string;
  moderatorId?: number;
  moderatorName?: string;
  participantCount: number;
  agendaItemCount: number;
  taskCount: number;
}

export interface CreateMeetingPayload {
  subject: string;
  description?: string;
  scheduledDateTime: string;
  plannedDurationMinutes: number;
  participants?: { userId: number; role?: MeetingRole }[];
  agendaItems?: { title: string; description?: string; allocatedDurationMinutes: number; orderIndex?: number }[];
}

export interface MeetingStatsDto {
  totalMeetings: number;
  scheduledMeetings: number;
  inProgressMeetings: number;
  completedMeetings: number;
  cancelledMeetings: number;
  averageDurationMinutes: number;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
}
